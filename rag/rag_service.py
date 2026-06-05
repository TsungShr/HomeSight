"""
RAG 微服务：FastAPI HTTP 服务
Java 后端通过 HTTP 调用此服务进行向量检索
启动: python rag_service.py
默认端口: 8000
"""
import os
import sys
import config
from pathlib import Path

# 确保 rag 模块可导入
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from embed import embed_text
import milvus_client


app = FastAPI(
    title="装修知识 RAG 服务",
    description="为 HomeSight 提供装修知识向量检索",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5
    min_similarity: float = 0.0


class SearchResult(BaseModel):
    text: str
    source_bv: str
    source_title: str
    chunk_index: int
    score: float


class HealthResponse(BaseModel):
    status: str
    collection: str
    total_records: int


@app.get("/health", response_model=HealthResponse)
def health():
    """健康检查接口"""
    count = milvus_client.count()
    return HealthResponse(
        status="ok",
        collection=config.COLLECTION_NAME,
        total_records=count,
    )


@app.post("/search", response_model=list[SearchResult])
def search(req: SearchRequest):
    """
    向量检索接口
    输入自然语言查询，返回最相关的装修知识片段
    """
    if not req.query or len(req.query.strip()) < 2:
        raise HTTPException(status_code=400, detail="query 不能为空")

    try:
        # 1. 查询文本向量化
        query_vector = embed_text(req.query)

        # 2. Milvus 向量检索
        hits = milvus_client.search(
            query_vector=query_vector,
            top_k=req.top_k,
            min_similarity=req.min_similarity,
        )

        return [SearchResult(**hit) for hit in hits]

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"检索失败: {str(e)}")


@app.post("/ingest-bv")
def ingest_bv(bv_id: str, title: str = ""):
    """在线摄入单个视频到向量库（可选）"""
    from bilibili_downloader import get_transcript
    from embed import chunk_text, embed_text

    text = get_transcript(bv_id)
    if not text or len(text) < 50:
        raise HTTPException(status_code=400, detail="字幕获取失败")

    chunks = chunk_text(text, chunk_size=512, overlap=50)
    rows = []
    for i, chunk in enumerate(chunks):
        try:
            vector = embed_text(chunk)
            rows.append({
                "text": chunk,
                "vector": vector,
                "source_bv": bv_id,
                "source_title": title or bv_id,
                "chunk_index": i,
            })
        except Exception as e:
            continue

    if rows:
        milvus_client.insert_batch(rows)

    return {"bv_id": bv_id, "chunks": len(rows), "total": milvus_client.count()}


def main():
    milvus_client.init_collection()
    count = milvus_client.count()
    print(f"\n{'=' * 40}")
    print(f"  装修知识 RAG 服务已启动")
    print(f"  Collection: {config.COLLECTION_NAME}")
    print(f"  当前记录数: {count}")
    print(f"  服务地址: http://localhost:8000")
    print(f"  API 文档: http://localhost:8000/docs")
    print(f"{'=' * 40}\n")

    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":
    main()
