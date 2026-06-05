"""装修知识智能体 - README

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

### 3. 摄入视频知识
```bash
# 单个视频
curl -X POST http://localhost:8081/ingest \
  -H "Content-Type: application/json" \
  -d '{"bilibili_url": "https://www.bilibili.com/video/BV1xxx"}'

# 获取视频信息（不下载）
curl "http://localhost:8081/video/info?bilibili_url=https://www.bilibili.com/video/BV1xxx"
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
| GET /video/info | 获取视频信息 | 输入B站URL，返回标题、时长等 |
| POST /ingest | 摄入视频 | 后台下载字幕并存储向量 |
| POST /chat | 对话问答 | 基于知识库+LLM生成回答 |
| GET /knowledge/stats | 知识库统计 | chunk总数 |
| POST /knowledge/clear | 清空知识库 | 删除所有已摄入内容 |

## 集成到小程序

在小程序后端（Java）添加一个Controller接口，调用本地Python服务：

```java
@GetMapping("/advice")
public Map<String, Object> getDecorationAdvice(
        @RequestParam String query,
        @RequestParam(required = false) String roomInfo) {
    RestTemplate rt = new RestTemplate();
    Map resp = rt.postForObject(
        "http://localhost:8081/chat",
        Map.of("query", query, "roomInfo", roomInfo),
        Map.class
    );
    return resp;
}
```

## 模型要求

- Embedding模型: `mxbai-embed-large`（向量生成）
- Chat模型: `llama3.2`（对话生成）

如需换模型，修改 `.env` 文件中的 `OLLAMA_EMBED_MODEL` 和 `OLLAMA_CHAT_MODEL`。

## 300个视频批量摄入

创建一个视频URL列表文件，每行一个链接，然后：

```python
import httpx
import asyncio

urls = open('video_urls.txt').read().strip().split('\n')

async def ingest_all():
    async with httpx.AsyncClient(timeout=60) as client:
        for url in urls:
            try:
                r = await client.post('http://localhost:8081/ingest', json={'bilibili_url': url})
                print(r.json())
                await asyncio.sleep(2)  # 避免请求过快
            except Exception as e:
                print(f'失败: {url} - {e}')

asyncio.run(ingest_all())
```
