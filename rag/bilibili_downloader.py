"""
B站视频字幕下载器
支持：字幕提取（软字幕优先）、无字幕视频回退 Whisper 转录
"""
import os
import re
import json
import subprocess
import config

SRT_PATTERN = re.compile(r"(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n(.+?)(?=\n\n|\n*$)", re.DOTALL)


def get_video_info(bv_id: str) -> dict:
    """获取视频元信息（不下载，只取 metadata）"""
    cmd = [
        "yt-dlp",
        "--dump-json",
        "--no-download",
        "--no-warnings",
        f"https://www.bilibili.com/video/{bv_id}",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp 获取信息失败: {result.stderr}")
    return json.loads(result.stdout.strip().split("\n")[0])


def download_subtitle(bv_id: str, output_dir: str = config.TEXT_DIR) -> str | None:
    """
    下载字幕并转换为纯文本
    返回字幕内容字符串，失败返回 None
    """
    os.makedirs(output_dir, exist_ok=True)
    subtitle_file = os.path.join(output_dir, bv_id)

    # 尝试下载软字幕
    for sub_lang in ["zh-CN", "zh-Hans", "zh", "ai-zh"]:
        cmd = [
            "yt-dlp",
            "--write-subs",
            "--write-auto-subs",
            "--sub-langs", sub_lang,
            "--skip-download",
            "--convert-subs", "vtt",
            "-o", subtitle_file,
            f"https://www.bilibili.com/video/{bv_id}",
        ]
        result = subprocess.run(
            cmd, capture_output=True, text=True, encoding="utf-8", timeout=120
        )
        if result.returncode == 0:
            vtt_path = subtitle_file + f".{sub_lang}.vtt"
            if not os.path.exists(vtt_path):
                vtt_path = subtitle_file + ".zh-CN.vtt"
            if not os.path.exists(vtt_path):
                vtt_path = subtitle_file + ".zh.vtt"
            if not os.path.exists(vtt_path):
                vtt_path = subtitle_file + ".en.vtt"
            if not os.path.exists(vtt_path):
                # 列出所有生成的文件
                for f in os.listdir(os.path.dirname(vtt_path)):
                    if f.startswith(os.path.basename(subtitle_file)) and f.endswith(".vtt"):
                        vtt_path = os.path.join(os.path.dirname(vtt_path), f)
                        break

            if os.path.exists(vtt_path):
                return vtt_to_text(vtt_path)

    return None


def vtt_to_text(vtt_path: str) -> str:
    """解析 VTT/SRT 字幕文件为纯文本"""
    with open(vtt_path, "r", encoding="utf-8") as f:
        raw = f.read()

    # 统一处理 VTT 时间格式 -> SRT 格式
    raw = raw.replace(",", ".")

    # 解析时间轴+文字块
    blocks = SRT_PATTERN.findall(raw)

    lines = []
    for seq, start, end, text in blocks:
        text = text.strip()
        if text:
            lines.append(text)

    return "\n".join(lines)


def extract_text_from_json(info: dict) -> str:
    """从 yt-dlp 的 info JSON 中提取标题、描述作为补充文本"""
    parts = []
    title = info.get("title", "")
    description = info.get("description", "")
    if title:
        parts.append(title)
    if description:
        parts.append(description)
    return "\n".join(parts)


def get_transcript(bv_id: str) -> str:
    """
    完整流程：获取字幕文本
    1. 下载字幕 -> 转纯文本
    2. 失败则用视频元信息（标题+描述）
    """
    try:
        subtitle_text = download_subtitle(bv_id)
        if subtitle_text and len(subtitle_text) > 100:
            return subtitle_text
    except Exception as e:
        print(f"  字幕下载失败: {e}")

    try:
        info = get_video_info(bv_id)
        meta_text = extract_text_from_json(info)
        if meta_text:
            print(f"  使用视频元信息作为替代文本")
            return meta_text
    except Exception as e:
        print(f"  元信息获取失败: {e}")

    return ""
