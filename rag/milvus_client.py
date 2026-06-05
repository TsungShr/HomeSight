"""
Milvus 向量库操作封装
使用 pymilvus 轻量模式（MilvusClient），无需 Docker 服务
存储装饰知识库的向量数据
"""
import os
import uuid
import config
from pymilvus import MilvusClient, DataType

COLLECTION_NAME = config.COLLECTION_NAME

_schema = None
_client = None


def get_client() -> MilvusClient:
    global _client
    if _client is None:
        os.makedirs(os.path.dirname(config.MILVUS_DB_PATH) or ".", exist_ok=True)
        _client = MilvusClient(uri=config.MILVUS_DB_PATH)
        print(f"  Milvus 数据库: {config.MILVUS_DB_PATH}")
    return _client


def init_collection():
    """初始化 Collection，若已存在则跳过"""
    client = get_client()

    if client.has_collection(COLLECTION_NAME):
        stats = client.get_collection_stats(COLLECTION_NAME)
        print(f"  Collection '{COLLECTION_NAME}' 已存在，共 {stats.get('row_count', 0)} 条记录")
        return

    client.create_collection(
        collection_name=COLLECTION_NAME,
        dimension=config.OPENAI_EMBEDDING_DIM,
        metric_type="IP",  # 内积相似度（cosine，需要先归一化，这里用 IP 即可）
        consistency_level="Eventually",
        schema=MilvusClient.create_schema(
            auto_id=True,
            enable_dynamic_field=True,
            description="装修知识库 RAG 向量数据",
        ),
    )

    client.create_index(
        collection_name=COLLECTION_NAME,
        field_name="vector",
        index_type="AUTOINDEX",
        metric_type="IP",
        params={},
    )
    print(f"  Collection '{COLLECTION_NAME}' 创建完成")


def insert(text: str, vector: list[float], source_bv: str, source_title: str, chunk_index: int):
    """插入单条向量数据"""
    client = get_client()
    client.insert(
        collection_name=COLLECTION_NAME,
        data=[{
            "text": text,
            "vector": vector,
            "source_bv": source_bv,
            "source_title": source_title,
            "chunk_index": chunk_index,
        }]
    )


def insert_batch(rows: list[dict]):
    """批量插入向量数据"""
    if not rows:
        return
    client = get_client()
    client.insert(
        collection_name=COLLECTION_NAME,
        data=rows,
    )


def search(query_vector: list[float], top_k: int = 5, min_similarity: float = 0.0) -> list[dict]:
    """
    向量检索
    返回 top_k 条结果，每条包含 text, source_bv, source_title, score
    """
    client = get_client()

    if not client.has_collection(COLLECTION_NAME):
        print("  Warning: Collection 不存在，请先运行 ingest.py")
        return []

    results = client.search(
        collection_name=COLLECTION_NAME,
        data=[query_vector],
        limit=top_k,
        output_fields=["text", "source_bv", "source_title", "chunk_index"],
    )

    hits = []
    for hit in results[0]:
        score = hit.get("score", 0)
        if min_similarity > 0 and score < min_similarity:
            continue
        entity = hit.get("entity", hit)
        hits.append({
            "text": entity.get("text", ""),
            "source_bv": entity.get("source_bv", ""),
            "source_title": entity.get("source_title", ""),
            "chunk_index": entity.get("chunk_index", 0),
            "score": score,
        })
    return hits


def count() -> int:
    """返回 Collection 中总记录数"""
    client = get_client()
    if not client.has_collection(COLLECTION_NAME):
        return 0
    stats = client.get_collection_stats(COLLECTION_NAME)
    return stats.get("row_count", 0)
