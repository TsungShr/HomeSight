"""RAG核心：向量存储 + 检索 + Ollama对话 + 实时网络搜索"""
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


def _web_search(query: str, max_results: int = 3) -> list[dict]:
    """实时联网搜索权威装修资料，返回摘要列表。失败返回空列表。"""
    try:
        from duckduckgo_search import DuckDuckGoSearch
        with DuckDuckGoSearch() as client:
            results = client.text(
                query,
                max_results=max_results,
                source='news',
            )
        hits = []
        for r in (results or []):
            hits.append({
                'title': r.get('title', ''),
                'body': r.get('body', ''),
                'href': r.get('href', ''),
            })
        return hits
    except Exception as e:
        print(f'  [WebSearch] 搜索失败: {e}')
        return []


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
                json={'model': EMBED_MODEL, 'prompt': text},
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
                'metadata': doc.get('metadata', {}),
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
    """装修知识智能体：知识库检索 + 网络搜索 + LLM综合回答"""

    def __init__(self):
        self.vector_store = VectorStore()
        self._system_prompt = """你是一位资深的室内装修设计专家，精通户型优化、水电布局、材料选购、
配色风格、施工工艺和验收标准。

你的知识来源包括：
1. 用户上传的装修视频教程（知识库）
2. 实时联网搜索到的权威资料（国家标准、品牌评测、行业文章）

回答要求：
1. 专业、实用、有针对性，结合用户具体户型
2. 知识库有相关内容时优先引用，并注明来源
3. 联网资料作为补充，增强回答的权威性和时效性
4. 如果知识库无相关信息，以联网搜索结果和通用专业知识作答
5. 适当引用参考资料的标题或来源
6. 回答结构清晰，分点列出重点"""

    def _build_kb_context(self, docs: list[dict]) -> str:
        if not docs:
            return ''
        parts = []
        for doc in docs:
            meta = doc['metadata']
            title = meta.get('video_title', '未知来源')
            parts.append(f"[知识库·{title}]\n{doc['text']}")
        return '\n\n'.join(parts)

    def _build_web_context(self, results: list[dict]) -> str:
        if not results:
            return ''
        parts = []
        for r in results:
            title = r.get('title', '无标题')
            body = r.get('body', '')
            href = r.get('href', '')
            # 取前300字摘要
            excerpt = body[:300] + ('...' if len(body) > 300 else '')
            parts.append(f"[网络·{title}]\n{excerpt}\n来源: {href}")
        return '\n\n'.join(parts)

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
        """混合回答：知识库检索 + 联网搜索 + LLM综合"""
        # 1. 并行检索：本地知识库 + 网络搜索
        kb_docs = self.vector_store.search(query, top_k=5)
        kb_context = self._build_kb_context(kb_docs)

        web_results = _web_search(f'装修 {query} 标准 规范', max_results=3)
        web_context = self._build_web_context(web_results)

        # 2. 构建提示词
        room_context = f'\n\n用户户型信息：\n{room_info}' if room_info else ''

        prompt_parts = []

        if kb_context:
            prompt_parts.append(f'【用户知识库（装修视频）】\n{kb_context}')

        if web_context:
            prompt_parts.append(f'【网络搜索结果】\n{web_context}')

        if not kb_context and not web_context:
            prompt_body = '（本次回答无参考资料，请基于你的专业知识作答）'
        else:
            prompt_body = '\n\n'.join(prompt_parts)

        user_prompt = f"""{prompt_body}{room_context}

用户问题：{query}

请结合以上参考资料，给出专业、实用的装修建议。如有多个要点请分点列出。"""

        # 3. 调用Ollama
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
                    'type': 'knowledge_base',
                }
                for doc in kb_docs
            ] + [
                {
                    'title': r.get('title', ''),
                    'url': r.get('href', ''),
                    'type': 'web_search',
                }
                for r in web_results
            ],
            'total_chunks': self.vector_store.count(),
            'web_results_count': len(web_results),
        }
