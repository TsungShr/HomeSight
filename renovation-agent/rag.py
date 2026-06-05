"""RAG核心：向量存储 + 检索 + Ollama对话"""
import os
import json as _json
from typing import Optional
import httpx
import ollama
from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
EMBED_MODEL = os.getenv('OLLAMA_EMBED_MODEL', 'mxbai-embed-large')
CHAT_MODEL = os.getenv('OLLAMA_CHAT_MODEL', 'llama3.2')
VECTOR_DIR = os.getenv('VECTOR_STORE_DIR', './vector_store')


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0


class VectorStore:
    """基于JSON持久化 + Ollama embed + 余弦相似度的轻量向量库"""

    def __init__(self, db_file: str = None):
        if db_file is None:
            os.makedirs(VECTOR_DIR, exist_ok=True)
            db_file = os.path.join(VECTOR_DIR, 'knowledge.json')
        self.db_file = db_file
        self._load()

    def _load(self):
        if os.path.exists(self.db_file):
            with open(self.db_file, 'r', encoding='utf-8') as f:
                data = _json.load(f)
                self.vectors = data.get('vectors', [])
        else:
            self.vectors = []

    def _save(self):
        os.makedirs(os.path.dirname(self.db_file) or '.', exist_ok=True)
        with open(self.db_file, 'w', encoding='utf-8') as f:
            _json.dump({'vectors': self.vectors}, f, ensure_ascii=False)

    def embed_text(self, text: str) -> list[float]:
        with httpx.Client(timeout=60) as client:
            resp = client.post(
                f'{OLLAMA_BASE}/api/embeddings',
                json={'model': EMBED_MODEL, 'prompt': text}
            )
            resp.raise_for_status()
            return resp.json()['embedding']

    def add_documents(self, documents: list[dict]):
        if not documents:
            return
        for doc in documents:
            emb = self.embed_text(doc['text'])
            self.vectors.append({
                'id': doc['id'],
                'text': doc['text'],
                'embedding': emb,
                'metadata': doc.get('metadata', {})
            })
        self._save()

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        if not self.vectors:
            return []
        q_emb = self.embed_text(query)
        scored = []
        for v in self.vectors:
            score = cosine_similarity(q_emb, v['embedding'])
            scored.append({
                'id': v['id'],
                'text': v['text'],
                'metadata': v.get('metadata', {}),
                'distance': 1 - score,
            })
        scored.sort(key=lambda x: x['distance'])
        return scored[:top_k]

    def count(self) -> int:
        return len(self.vectors)

    def clear(self):
        self.vectors = []
        self._save()


class RenovationAgent:
    """装修知识智能体"""

    def __init__(self):
        self.vector_store = VectorStore()
        self._system_prompt = """你是一位专业的装修顾问，熟悉室内设计、水电布局、材料选购、施工工艺等装修知识。

你的知识来自大量装修视频教程和专业资料。请基于已有知识库回答用户关于户型设计、装修建议的问题。

回答要求：
1. 专业、实用、有针对性
2. 结合户型图的具体信息给出建议
3. 适当引用参考视频/资料的要点
4. 如果知识库中没有相关信息，诚实告知用户
"""

    def ingest_video(self, video_info: dict, subtitle_text: str, chunk_size: int = 500):
        """将视频字幕内容摄入知识库"""
        from subtitle import chunk_text

        chunks = chunk_text(subtitle_text, chunk_size=chunk_size)
        if not chunks:
            return 0

        video_id = video_info.get('video_id', 'unknown')
        platform = video_info.get('platform', 'bilibili')
        docs = []
        for i, chunk in enumerate(chunks):
            docs.append({
                'id': f'{video_id}_chunk_{i}',
                'text': chunk,
                'metadata': {
                    'video_title': video_info.get('title', ''),
                    'video_id': video_id,
                    'uploader': video_info.get('uploader', ''),
                    'platform': platform,
                    'source': f'{platform}_subtitle',
                }
            })

        self.vector_store.add_documents(docs)
        return len(chunks)

    def chat(self, query: str, room_info: Optional[str] = None) -> dict:
        """对话：结合知识库检索 + LLM生成回答"""
        # 1. 检索相关知识
        relevant_docs = self.vector_store.search(query, top_k=5)

        # 2. 构建上下文
        context_parts = []
        for doc in relevant_docs:
            meta = doc['metadata']
            source = f"[来源: {meta.get('video_title', '未知视频')}]"
            context_parts.append(f"{source}\n{doc['text']}")

        context_text = '\n\n---\n\n'.join(context_parts) if context_parts else ''

        # 3. 构建提示词
        room_context = ''
        if room_info:
            room_context = f"\n\n用户户型信息：\n{room_info}"

        user_prompt = f"""基于以下装修知识库内容，回答用户的问题。如果知识库中没有相关信息，请说明。

--- 知识库内容 ---
{context_text if context_text else '（知识库为空，请基于通用装修知识回答）'}
--- 知识库结束 ---

{room_context}

用户问题：{query}"""

        # 4. 调用Ollama
        try:
            response = ollama.chat(
                model=CHAT_MODEL,
                messages=[
                    {'role': 'system', 'content': self._system_prompt},
                    {'role': 'user', 'content': user_prompt},
                ],
                options={
                    'temperature': 0.7,
                    'num_ctx': 8192,
                }
            )
            answer = response['message']['content']
        except Exception as e:
            answer = f"抱歉，AI服务暂时不可用：{str(e)}"

        return {
            'answer': answer,
            'sources': [
                {
                    'video_title': doc['metadata'].get('video_title', ''),
                    'video_id': doc['metadata'].get('video_id', ''),
                    'platform': doc['metadata'].get('platform', 'bilibili'),
                    'text_preview': doc['text'][:200] + '...' if len(doc['text']) > 200 else doc['text'],
                    'relevance': round(1 - doc['distance'], 3) if doc.get('distance') else 1,
                }
                for doc in relevant_docs
            ],
            'total_chunks': self.vector_store.count(),
        }
