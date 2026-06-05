"""视频下载和字幕提取模块（B站 + 抖音）"""
import subprocess
import json
import re
import shutil
import struct
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional
import srt

_YTDLP = shutil.which('yt-dlp') or r'C:\Users\Z\AppData\Local\Python\pythoncore-3.14-64\Scripts\yt-dlp.exe'

_BILIBILI_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.bilibili.com',
    'Origin': 'https://www.bilibili.com',
}


def get_platform(url: str) -> str:
    """识别 URL 平台：bilibili | douyin | unknown"""
    if 'douyin.com' in url or 'iesdouyin.com' in url:
        return 'douyin'
    if 'bilibili.com' in url or re.search(r'BV[a-zA-Z0-9]{10}', url):
        return 'bilibili'
    return 'unknown'


# ─────────────────────────── B站 ───────────────────────────

def extract_bvid(url: str) -> Optional[str]:
    patterns = [
        r'BV[a-zA-Z0-9]{10}',
        r'video/(BV[a-zA-Z0-9]{10})',
        r'bilibili\.com/video/(BV[a-zA-Z0-9]{10})',
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(0).replace('video/', '').replace('bilibili.com/', '')
    return None


def _api_get(url: str) -> dict:
    req = urllib.request.Request(url, headers=_BILIBILI_HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode('utf-8'))


def get_video_info(url: str) -> dict:
    """统一入口：根据 URL 类型调用对应平台获取视频信息"""
    platform = get_platform(url)
    if platform == 'bilibili':
        return _get_bilibili_info(url)
    elif platform == 'douyin':
        return _get_douyin_info(url)
    else:
        raise ValueError(f'不支持的平台: {url}')


def _get_bilibili_info(url: str) -> dict:
    bv_id = extract_bvid(url)
    if not bv_id:
        raise ValueError(f'无法从URL提取BV号: {url}')

    data = _api_get(f'https://api.bilibili.com/x/web-interface/view?bvid={bv_id}')
    if data.get('code') != 0:
        raise RuntimeError(f'B站API错误: {data.get("message", "未知错误")}')

    vd = data['data']
    return {
        'title': vd.get('title', ''),
        'video_id': bv_id,
        'duration': vd.get('duration', 0),
        'uploader': vd.get('owner', {}).get('name', ''),
        'webpage_url': url,
        'description': vd.get('desc', ''),
        'cid': vd.get('cid'),
        'platform': 'bilibili',
    }


def download_subtitle(url: str, output_dir: str = './subtitles') -> tuple[str, str]:
    """统一入口：下载字幕/弹幕/简介，返回 (content, content_type)"""
    platform = get_platform(url)
    if platform == 'bilibili':
        return _download_bilibili_subtitle(url, output_dir)
    elif platform == 'douyin':
        return _download_douyin_subtitle(url, output_dir)
    else:
        raise ValueError(f'不支持的平台: {url}')


def _download_bilibili_subtitle(url: str, output_dir: str = './subtitles') -> tuple[str, str]:
    bv_id = extract_bvid(url)
    if not bv_id:
        raise ValueError(f'无法从URL提取BV号: {url}')

    video_info = _get_bilibili_info(url)
    bv_id = video_info['video_id']

    # 1. 优先字幕API
    try:
        text = _fetch_subtitle_by_api(video_info['cid'])
        if len(text) > 200:
            return text, 'subtitle'
    except Exception:
        pass

    # 2. 回退：弹幕
    try:
        text = _fetch_danmaku(video_info['cid'])
        if len(text) > 200:
            return text, 'danmaku'
    except Exception:
        pass

    # 3. 回退：视频简介
    desc = video_info.get('description', '')
    if desc:
        return f'【视频简介】{desc}', 'description'

    return '', 'none'


def _fetch_subtitle_by_api(cid: int) -> str:
    try:
        sub_data = _api_get(
            f'https://api.bilibili.com/x/web-interface/translation/index?cid={cid}'
        )
        if sub_data.get('code') != 0:
            return ''

        subtitles = sub_data.get('data', {}).get('subtitles', [])
        if not subtitles:
            return ''

        first = subtitles[0]
        detail_url = 'https:' + first['subtitle_url']
        detail = _api_get(detail_url)

        lines = []
        for item in detail.get('body', []):
            content = item.get('content', '').strip()
            if content:
                lines.append(content)
        return '\n'.join(lines)
    except Exception:
        return ''


def _fetch_danmaku(cid: int) -> str:
    try:
        url = f'https://api.bilibili.com/x/v2/dm/web/view?type=1&oid={cid}&segment_index=1'
        req = urllib.request.Request(url, headers={
            **_BILIBILI_HEADERS,
            'Accept': '*/*',
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read()

        text = _decode_proto(raw)
        if len(text) < 100:
            return ''

        danmaku_lines = sorted(text, key=lambda x: x[0])
        result_lines = [f'[{_fmt_time(t)}] {c}' for t, c in danmaku_lines]
        return '\n'.join(result_lines)
    except Exception:
        return ''


def _decode_proto(data: bytes) -> list[tuple[int, str]]:
    results = []
    try:
        i = 0
        while i < len(data) - 8:
            header = data[i]
            if header == 0x0A:
                i += 1
                length = 0
                shift = 0
                while i < len(data) and (data[i] & 0x80) != 0:
                    length |= (data[i] & 0x7F) << shift
                    shift += 7
                    i += 1
                if i < len(data):
                    length |= data[i] << shift
                    i += 1

                segment = data[i:i+length]
                i += length

                time_val = 0.0
                text_parts = []

                j = 0
                while j < len(segment) - 2:
                    field = segment[j]
                    if field == 0x0D:
                        j += 1
                        if j + 4 <= len(segment):
                            time_val = struct.unpack('<f', segment[j:j+4])[0]
                            j += 4
                    elif field == 0x12:
                        j += 1
                        slen = segment[j]
                        j += 1
                        if j + slen <= len(segment):
                            text_parts.append(segment[j:j+slen].decode('utf-8', errors='ignore'))
                            j += slen
                    elif field == 0x15:
                        j += 1
                        if j + 4 <= len(segment):
                            ms = struct.unpack('>I', segment[j:j+4])[0]
                            time_val = ms / 1000.0
                            j += 4
                    else:
                        j += 1

                text = ''.join(text_parts).strip()
                if text and time_val > 0:
                    results.append((int(time_val), text))
            else:
                i += 1
    except Exception:
        pass

    return results


def _fmt_time(seconds: int) -> str:
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    return f'{h}:{m:02d}:{s:02d}'


# ─────────────────────────── 抖音 ───────────────────────────

def extract_douyin_id(url: str) -> Optional[str]:
    """从抖音 URL 中提取视频 ID，自动处理 video/ 和 shipin/ 两种格式"""
    m = re.search(r'douyin\.com/video/(\d+)', url)
    if m:
        return m.group(1)
    m = re.search(r'douyin\.com/shipin/(\d+)', url)
    if m:
        return m.group(1)
    m = re.search(r'iesdouyin\.com/share/video/(\d+)', url)
    if m:
        return m.group(1)
    return None


def _normalize_douyin_url(url: str) -> str:
    """将抖音 URL 统一转换为 shipin/ 格式（video/ 格式页面是 JS 空壳）"""
    m = re.search(r'douyin\.com/video/(\d+)', url)
    if m:
        return f'https://www.douyin.com/shipin/{m.group(1)}'
    m = re.search(r'iesdouyin\.com/share/video/(\d+)', url)
    if m:
        return f'https://www.douyin.com/shipin/{m.group(1)}'
    return url


def _fetch_douyin_page(url: str) -> str:
    """通过 urllib 直接抓取抖音页面（模拟浏览器）"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://www.douyin.com/',
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode('utf-8', errors='replace')


def _extract_ai_transcript(html: str) -> str:
    """从抖音页面 HTML 中提取 AI文稿 内容"""
    # 策略1: 找 "查看AI文稿" 后的文字块（直接跟随）
    # AI文稿标记后的文本，在下一个 ## 或相关视频标题之前
    pattern = r'查看AI文稿\s*[/\\]?\s*AI文稿\s*([\s\S]{10,5000}?)(?=##\s*相关视频|##\s*猜你喜欢|##\s*最新视频|##\s*热门推荐)'
    m = re.search(pattern, html)
    if m:
        text = m.group(1).strip()
        # 清理多余空白
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r'[ \t]+', ' ', text)
        return text.strip()

    # 策略2: 直接找 "AI文稿" 和下一个 ## 之间的内容
    pattern2 = r'AI文稿\s*([\s\S]{10,5000}?)(?=##)'
    m2 = re.search(pattern2, html)
    if m2:
        text = m2.group(1).strip()
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r'[ \t]+', ' ', text)
        return text.strip()

    return ''


def _get_douyin_info(url: str) -> dict:
    video_id = extract_douyin_id(url)
    if not video_id:
        raise ValueError(f'无法从URL提取抖音视频ID: {url}')

    # video/ 格式会返回 JS 空壳，必须转为 shipin/ 格式
    normalized_url = _normalize_douyin_url(url)
    try:
        html = _fetch_douyin_page(normalized_url)
    except Exception as e:
        raise RuntimeError(f'获取抖音页面失败: {e}')

    # 提取标题
    title_match = re.search(r'<h1[^>]*>\s*([^<]+)\s*</h1>', html)
    if not title_match:
        title_match = re.search(r'#\s*([^\n\r#]{5,100})\s*</h1>', html)
    title = title_match.group(1).strip() if title_match else ''

    # 提取作者
    author_match = re.search(r'粉丝[\d.]+万获赞[\d.]+万\s*([^\n\r]{1,50})', html)
    uploader = author_match.group(1).strip() if author_match else ''

    # 提取时长
    duration = 0
    dur_match = re.search(r'(\d{1,2}:\d{2})', html)
    if dur_match:
        parts = dur_match.group(1).split(':')
        if len(parts) == 2:
            duration = int(parts[0]) * 60 + int(parts[1])

    return {
        'title': title,
        'video_id': video_id,
        'duration': duration,
        'uploader': uploader,
        'webpage_url': normalized_url,
        'platform': 'douyin',
        '_html': html,
    }


def _download_douyin_subtitle(url: str, output_dir: str = './subtitles') -> tuple[str, str]:
    """获取抖音 AI文稿（自动字幕），回退到视频描述"""
    video_info = _get_douyin_info(url)
    html = video_info.get('_html', '')

    # 1. AI文稿
    if html:
        transcript = _extract_ai_transcript(html)
        if len(transcript) > 100:
            return transcript, 'transcript'

    # 2. 回退：提取页面中的完整描述文字（在相关视频之前的文字块）
    if html:
        # 抓取页面中所有 "查看AI文稿" 后紧跟的文字段落
        blocks = re.findall(r'查看AI文稿\s*</div>\s*<div[^>]*>([^<]{20,})', html)
        combined = '\n'.join(b.strip() for b in blocks if b.strip())
        if len(combined) > 100:
            return combined, 'transcript'

    # 3. 回退：从 HTML 提取正文描述（视频标题+标签文字）
    text_parts = []
    # 提取所有 #标签 文字
    tags = re.findall(r'#([^\s#<>]+)', html)
    if tags:
        text_parts.append(' '.join(f'#{t}' for t in tags[:30]))
    # 提取标题
    if video_info.get('title'):
        text_parts.insert(0, video_info['title'])
    if text_parts:
        text = ' | '.join(text_parts)
        return f'【抖音简介】{text}', 'description'

    return '', 'none'


# ─────────────────────────── 通用 ───────────────────────────

def parse_subtitle_to_text(subtitle_file: Path) -> str:
    try:
        with open(subtitle_file, 'r', encoding='utf-8') as f:
            subs = srt.parse(f.read())
        return '\n'.join(sub.content.strip() for sub in subs if sub.content.strip())
    except Exception:
        with open(subtitle_file, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    if len(text) <= chunk_size:
        return [text] if text.strip() else []
    chunks = []
    start = 0
    while start < len(text):
        chunk = text[start:start + chunk_size].strip()
        if chunk:
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks
