"""
OpenAI Embedding 封装
支持批量向量化、错误重试
"""
import os
import time
import config
from openai import OpenAI


def get_client() -> OpenAI:
    if not config.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY 未设置，请创建 .env 文件并填入你的 OpenAI API Key")
    return OpenAI(api_key=config.OPENAI_API_KEY)


def embed_text(text: str) -> list[float]:
    """单条文本向量化"""
    client = get_client()
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.embeddings.create(
                model=config.OPENAI_EMBEDDING_MODEL,
                input=text,
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"  Embedding 失败 (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise


def embed_batch(texts: list[str]) -> list[list[float]]:
    """批量向量化（节省 API 调用）"""
    client = get_client()
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.embeddings.create(
                model=config.OPENAI_EMBEDDING_MODEL,
                input=texts,
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            print(f"  批量 Embedding 失败 (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise


def chunk_text(text: str, chunk_size: int = 512, overlap: int = 50) -> list[str]:
    """
    简单分块：按字符数滑动窗口分块
    overlap=50 表示相邻块重叠50字符，保证上下文连续性
    """
    if len(text) <= chunk_size:
        return [text] if text.strip() else []

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += chunk_size - overlap

    return chunks
