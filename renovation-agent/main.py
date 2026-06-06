"""FastAPI服务层"""
import os
import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
import asyncio

# 修复 Windows 控制台 GBK 编码
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, errors='replace')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, errors='replace')

load_dotenv()

app = FastAPI(title='装修知识智能体', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局agent实例（懒加载）
_agent = None


def get_agent():
    global _agent
    if _agent is None:
        from rag import RenovationAgent
        _agent = RenovationAgent()
    return _agent


class IngestRequest(BaseModel):
    url: str
    chunk_size: int = 500


class ChatRequest(BaseModel):
    query: str
    room_info: Optional[str] = None


class VideoInfo(BaseModel):
    title: str
    video_id: str
    duration: int
    uploader: str
    url: str
    platform: str = 'bilibili'


@app.get('/')
def root():
    return {'status': 'ok', 'service': '装修知识智能体 RAG Agent'}


@app.get('/health')
def health():
    agent = get_agent()
    return {
        'status': 'healthy',
        'knowledge_chunks': agent.vector_store.count(),
    }


@app.get('/video/info')
def video_info(url: str) -> VideoInfo:
    """获取视频信息（不下载）"""
    from subtitle import get_video_info as _get_info
    try:
        info = _get_info(url)
        return VideoInfo(
            title=info.get('title', ''),
            video_id=info.get('video_id', ''),
            duration=info.get('duration', 0),
            uploader=info.get('uploader', ''),
            url=info.get('webpage_url', url),
            platform=info.get('platform', 'bilibili'),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f'获取视频信息失败: {str(e)}')


@app.post('/ingest')
async def ingest_video(req: IngestRequest, background_tasks: BackgroundTasks):
    """摄入视频到知识库（后台任务，支持B站+抖音）"""
    from subtitle import download_subtitle as _get_subtitle, get_video_info as _get_info

    # 先获取视频信息
    try:
        video_info = _get_info(req.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f'获取视频信息失败: {str(e)}')

    platform = video_info.get('platform', 'bilibili')
    video_id = video_info.get('video_id', '')
    subtitle_dir = os.getenv('SUBTITLE_DIR', './subtitles')

    if platform == 'bilibili':
        sub_file = Path(subtitle_dir) / f'{video_id}.srt'
        if sub_file.exists():
            with open(sub_file, 'r', encoding='utf-8') as f:
                content_text = f.read()
            content_type = 'subtitle'
        else:
            try:
                content_text, content_type = _get_subtitle(req.url, subtitle_dir)
            except Exception as e:
                content_text = ''
                content_type = 'none'
    else:
        try:
            content_text, content_type = _get_subtitle(req.url, subtitle_dir)
        except Exception as e:
            content_text = ''
            content_type = 'none'

    if not content_text.strip():
        raise HTTPException(
            status_code=422,
            detail=f'无法获取任何内容（字幕/弹幕/AI文稿）: {video_info.get("title", video_id)}，请尝试其他视频'
        )

    # 后台摄入向量库
    async def _ingest():
        agent = get_agent()
        count = agent.ingest_video(video_info, content_text, req.chunk_size)
        print(f'[KB] Ingested [{platform}] "{video_info.get("title", "")}" ({content_type}), {count} chunks'.encode('ascii', 'replace').decode('ascii'))

    background_tasks.add_task(_ingest)

    return {
        'status': 'ingesting',
        'video_title': video_info.get('title', ''),
        'video_id': video_id,
        'platform': platform,
        'content_type': content_type,
        'content_chars': len(content_text),
        'message': f'已获取内容（{content_type}），正在后台摄入知识库...',
    }


@app.post('/chat')
async def chat(req: ChatRequest) -> dict:
    """对话：基于知识库回答装修问题"""
    agent = get_agent()
    if agent.vector_store.count() == 0:
        return {
            'answer': '知识库为空，请先摄入装修视频。发送B站链接到 /ingest 接口即可开始学习。',
            'sources': [],
            'total_chunks': 0,
        }

    result = agent.chat(req.query, req.room_info)
    return result


@app.get('/knowledge/stats')
def knowledge_stats():
    """知识库统计"""
    agent = get_agent()
    return {
        'total_chunks': agent.vector_store.count(),
    }


@app.post('/knowledge/clear')
def clear_knowledge():
    """清空知识库"""
    agent = get_agent()
    agent.vector_store.clear()
    return {'status': 'cleared', 'total_chunks': 0}


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8081, reload=False)
