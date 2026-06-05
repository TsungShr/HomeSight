import os
from dotenv import load_dotenv

load_dotenv()

# OpenAI API 配置（用于 Embedding）
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
OPENAI_EMBEDDING_DIM = 1536

# Milvus 配置
MILVUS_HOST = os.getenv("MILVUS_HOST", "localhost")
MILVUS_PORT = int(os.getenv("MILVUS_PORT", "19530"))

# Milvus 轻量模式（文件数据库，不需要 Docker）
MILVUS_DB_PATH = os.getenv("MILVUS_DB_PATH", "./data/milvus_decoration.db")

# 集合名称
COLLECTION_NAME = "decoration_knowledge"

# RAG 服务地址（Java 后端通过 HTTP 调用）
RAG_SERVICE_URL = os.getenv("RAG_SERVICE_URL", "http://localhost:8000")

# 数据目录
DATA_DIR = "./data"
TEXT_DIR = os.path.join(DATA_DIR, "texts")
