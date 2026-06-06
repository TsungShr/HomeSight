# 装修知识智能体

混合问答 Agent：知识库向量检索 + DuckDuckGo 实时搜索 + Ollama LLM。

## 架构

```
用户问题
    │
    ├── 1. 本地知识库检索（Milvus/Ollama Embedding）
    │       └── B站视频字幕摄入的装修知识
    │
    ├── 2. 实时联网搜索（DuckDuckGo）
    │       └── 国家标准、品牌评测、行业文章
    │
    └── 3. Ollama LLM 综合回答
            └── 融合知识库 + 搜索结果，给出专业建议
```

## 快速启动

### 1. 安装依赖
```bash
cd renovation-agent
pip install -r requirements.txt
```

### 2. 启动服务
```bash
python main.py
```
服务地址: http://localhost:8081

### 3. 摄入视频知识（可选）
```bash
curl -X POST http://localhost:8081/ingest \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.bilibili.com/video/BV1xxx", "chunk_size": 500}'
```

### 4. 对话提问
```bash
curl -X POST http://localhost:8081/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "120平三居室如何做智能家居布局？", "room_info": "3室2厅1厨2卫，客厅朝南"}'
```

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| GET /health | 健康检查 | 返回知识库chunk数量 |
| GET /video/info | 获取视频信息 | 输入URL，返回标题、时长等 |
| POST /ingest | 摄入视频 | 后台下载字幕并存储向量 |
| POST /chat | 对话问答 | **知识库+联网搜索+LLM综合回答** |
| GET /knowledge/stats | 知识库统计 | chunk总数 |
| POST /knowledge/clear | 清空知识库 | 删除所有已摄入内容 |

## 回答来源

Agent 回答综合以下来源：

1. **本地知识库** — 你摄入的B站装修视频字幕，有精确的领域知识
2. **DuckDuckGo 搜索** — 实时联网获取国家标准、品牌评测、行业文章，补充时效性知识

即使知识库为空，联网搜索也能给出权威回答。

## 模型配置

在 `.env` 中修改：

```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=mxbai-embed-large   # 向量模型
OLLAMA_CHAT_MODEL=llama3.2             # 对话模型
```

支持任意 Ollama 模型，换模型后重启服务即可。
