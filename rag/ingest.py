"""
装修知识 RAG 数据摄入脚本
用法:
  python ingest.py                         # 读取 videos.csv，批量处理所有视频
  python ingest.py --bv BV1GJ411x7h7       # 处理单个视频
  python ingest.py --videos videos.csv     # 指定 CSV 文件
  python ingest.py --limit 3               # 仅处理前3个（快速验证）
"""
import os
import sys
import csv
import time
import argparse
import pandas as pd
from pathlib import Path

import config
from bilibili_downloader import get_transcript
from embed import embed_text, chunk_text
import milvus_client


def parse_args():
    parser = argparse.ArgumentParser(description="装修知识 RAG 数据摄入")
    parser.add_argument("--bv", help="单个 BV 号（如 BV1GJ411x7h7）")
    parser.add_argument("--videos", default="videos.csv", help="视频列表 CSV 文件路径")
    parser.add_argument("--limit", type=int, default=0, help="限制处理数量（0=全部）")
    parser.add_argument("--batch-size", type=int, default=32, help="Embedding 批量大小")
    return parser.parse_args()


def ingest_single(bv_id: str, title: str = ""):
    """处理单个视频"""
    print(f"\n[{bv_id}] 开始处理: {title or bv_id}")

    # 1. 获取字幕文本
    print(f"  [1/3] 获取字幕...")
    text = get_transcript(bv_id)
    if not text or len(text) < 50:
        print(f"  警告: 字幕文本过短 ({len(text)} 字符)，跳过")
        return 0

    # 2. 文本分块
    print(f"  [2/3] 文本分块 (原始 {len(text)} 字符)...")
    chunks = chunk_text(text, chunk_size=512, overlap=50)
    print(f"  共 {len(chunks)} 个 chunk")
    if not chunks:
        return 0

    # 3. 向量化并入库
    print(f"  [3/3] 向量化入库...")
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
            print(f"    Chunk {i} 向量化失败: {e}")
            continue

        if len(rows) >= 32:
            milvus_client.insert_batch(rows)
            print(f"    批量入库 {len(rows)} 条")
            rows = []

    if rows:
        milvus_client.insert_batch(rows)
        print(f"    批量入库 {len(rows)} 条")

    print(f"  完成: {bv_id} ({len(chunks)} chunks)")
    return len(chunks)


def ingest_all(csv_path: str, limit: int = 0):
    """批量处理 CSV 中的所有视频"""
    if not os.path.exists(csv_path):
        print(f"错误: CSV 文件不存在: {csv_path}")
        print("请创建 videos.csv，格式：")
        print("  bv_id,title,tags")
        print("  BV1GJ411x7h7,小户型装修避坑指南,装修攻略")
        print("  BV1NM411v7Lp,厨房布局黄金法则,厨房设计")
        return

    df = pd.read_csv(csv_path)
    if limit > 0:
        df = df.head(limit)

    print(f"=" * 50)
    print(f"开始批量摄入: {len(df)} 个视频")
    print(f"=" * 50)

    milvus_client.init_collection()

    total_chunks = 0
    failed = []

    for idx, row in df.iterrows():
        bv_id = str(row.get("bv_id", row.get("bv", ""))).strip()
        title = str(row.get("title", "")).strip()

        if not bv_id or bv_id == "nan":
            print(f"跳过空 BV 号行 {idx}")
            continue

        try:
            n = ingest_single(bv_id, title)
            total_chunks += n
        except Exception as e:
            print(f"  处理失败: {e}")
            failed.append((bv_id, str(e)))

        time.sleep(1)  # 避免请求过快

    print(f"\n{'=' * 50}")
    print(f"批量摄入完成！共处理 {len(df) - len(failed)}/{len(df)} 个视频")
    print(f"总 chunks: {total_chunks}")
    print(f"Milvus 总记录数: {milvus_client.count()}")
    if failed:
        print(f"失败列表: {failed}")


def main():
    args = parse_args()

    if args.bv:
        milvus_client.init_collection()
        ingest_single(args.bv)
    else:
        ingest_all(args.videos, limit=args.limit)


if __name__ == "__main__":
    main()
