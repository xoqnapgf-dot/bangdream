#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""扫描 资料库/ 目录，生成 assets/manifest.json 供前端文件浏览器使用。"""

import json
import os
import re
import pathlib
import datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
LIB = ROOT / "资料库"
OUTLINE = LIB / "项目文件大纲.txt"
OUT = ROOT / "assets" / "manifest.json"
OFFLINE_OUT = ROOT / "assets" / "offline-data.js"
VIDEO_META = ROOT / "assets" / "video-meta.json"
EPISODE_META = ROOT / "assets" / "episode-meta.json"
INDEX_HTML = ROOT / "index.html"

TEXT_EXT = {".md", ".txt"}
BEIJING_TZ = datetime.timezone(datetime.timedelta(hours=8))
# 不改文件名和内部相对链接，只固定读者看到的专题顺序：先 MyGO!!!!!，
# 后 Ave Mujica，再放跨作品或辅助资料。这里同时用于网站清单与文件大纲。
DISPLAY_FILE_ORDER = {
    path: rank
    for rank, path in enumerate((
        "00_剧情区/03_剧场版/MyGO剧场版_资料汇总.md",
        "00_剧情区/03_剧场版/AveMujica剧场版_prima_aurora资料汇总.md",
        "00_剧情区/04_漫画游戏/MyGO_漫画游戏情节汇总.md",
        "00_剧情区/04_漫画游戏/MyGO剧情对白_英文版.md",
        "00_剧情区/04_漫画游戏/少女乐团派对_MyGO相关活动剧情对白_中文版.md",
        "00_剧情区/04_漫画游戏/AveMujica漫画游戏情节汇总.md",
        "00_剧情区/04_漫画游戏/少女乐团派对_AveMujica相关剧情对白_中文版.md",
        "00_剧情区/04_漫画游戏/OurNotes内测社区反馈汇总.md",
        "00_剧情区/05_官方访谈与设定/MyGO_确证内容汇总.md",
        "00_剧情区/05_官方访谈与设定/AveMujica_确证内容汇总.md",
        "00_剧情区/06_社区解析_推测/MyGO_分析推测汇总.md",
        "00_剧情区/06_社区解析_推测/AveMujica_分析推测汇总.md",
        "00_剧情区/06_社区解析_推测/Yamaryo_個體化的擺盪與認同的放手.md",
        "00_剧情区/07_CP线梳理/MyGO_CP线梳理.md",
        "00_剧情区/07_CP线梳理/AveMujica_CP线梳理.md",
    ))
}


def read_text(p: pathlib.Path) -> str:
    b = p.read_bytes()
    for enc in ("utf-8", "gbk", "cp936"):
        try:
            return b.decode(enc)
        except UnicodeDecodeError:
            continue
    return b.decode("utf-8", errors="replace")


def extract_title(p: pathlib.Path, text: str) -> str:
    """md 取第一个 # 标题；txt 取第一行非空文本。"""
    if p.suffix == ".md":
        m = re.search(r"^#\s+(.+)$", text, re.M)
        if m:
            return m.group(1).strip()
    for line in text.splitlines():
        line = line.strip()
        if line:
            return line[:60]
    return p.stem


def summarize(text: str, limit: int = 90) -> str:
    """取一段可读的摘要，跳过标题/引用/表格等标记行。"""
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith(("#", ">", "|", "-", "*", "`", "=")):
            continue
        line = re.sub(r"[*`_\[\]]", "", line)
        if len(line) >= 12:
            return line[:limit]
    return ""


def natural_key(name: str):
    """让 01_ 02_ 10_ 这类前缀按数字排序。"""
    parts = re.split(r"(\d+)", name)
    return [int(x) if x.isdigit() else x for x in parts]


def display_key(path: pathlib.Path):
    """专题文件按策划顺序显示，其余条目仍按自然文件名排序。"""
    try:
        rel = path.relative_to(LIB).as_posix()
    except ValueError:
        rel = path.as_posix()
    rank = DISPLAY_FILE_ORDER.get(rel)
    return (0, rank) if rank is not None else (1, natural_key(path.name))


def outline_lines(d: pathlib.Path, depth: int = 0):
    """按资料库里的真实层级列出目录与文件，供 项目文件大纲.txt 使用。"""
    lines = []
    entries = sorted(
        (e for e in d.iterdir() if not e.name.startswith(".")),
        key=display_key,
    )
    subdirs = [e for e in entries if e.is_dir()]
    files = [
        e for e in entries
        if e.is_file() and e.suffix.lower() in TEXT_EXT and e != OUTLINE
    ]
    for sub in subdirs:
        child = outline_lines(sub, depth + 1)
        if not child:
            continue
        if depth == 0 and lines:
            lines.append("")
        lines.append("  " * depth + sub.name + "/")
        lines.extend(child)
    if files and subdirs and depth == 0:
        lines.append("")
    for f in files:
        lines.append("  " * depth + f.name)
    return lines


def write_outline():
    """大纲随资料库内容一起生成，避免手工维护后与真实目录脱节。"""
    body = outline_lines(LIB)
    title = "MyGO!!!!! × Ave Mujica 资料库 项目文件大纲"
    text = "\n".join([
        title,
        "=" * 46,
        "",
        "本文件由 tools/build_manifest.py 生成，请勿手工修改。",
        f"内容与 {LIB.name}/ 下的真实目录结构一致（不含本文件）。",
        "",
        *body,
        "",
    ])
    OUTLINE.write_text(text, encoding="utf-8")


def walk(d: pathlib.Path):
    dirs, files = [], []
    for entry in sorted(d.iterdir(), key=display_key):
        if entry.name.startswith("."):
            continue
        if entry.is_dir():
            node = walk(entry)
            if node["children"]:
                dirs.append(node)
        elif entry.suffix.lower() in TEXT_EXT:
            text = read_text(entry)
            rel = entry.relative_to(LIB).as_posix()
            files.append({
                "type": "file",
                "name": entry.name,
                "stem": entry.stem,
                "path": rel,
                "ext": entry.suffix.lower().lstrip("."),
                "size": entry.stat().st_size,
                "chars": len(text),
                "title": extract_title(entry, text),
                "summary": summarize(text),
            })
    return {
        "type": "dir",
        "name": d.name,
        "path": d.relative_to(LIB).as_posix() if d != LIB else "",
        "children": dirs + files,
    }


def count(node):
    f = d = 0
    for c in node["children"]:
        if c["type"] == "file":
            f += 1
        else:
            d += 1
            sf, sd = count(c)
            f += sf
            d += sd
    return f, d


def main():
    if not LIB.is_dir():
        raise SystemExit(f"找不到资料库目录: {LIB}")
    # 先刷新大纲，再扫描，保证清单里记录的是大纲的最新体积。
    write_outline()
    tree = walk(LIB)
    nf, nd = count(tree)
    total = sum(p.stat().st_size for p in LIB.rglob("*") if p.is_file())
    now = datetime.datetime.now(BEIJING_TZ)
    data = {
        "root": LIB.name,
        # 固定使用北京时间，避免生成环境的本地时区影响页面显示。
        "generated": now.strftime("%Y-%m-%d %H:%M"),
        "stats": {"files": nf, "dirs": nd, "bytes": total},
        "tree": tree,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    video_meta = json.loads(VIDEO_META.read_text("utf-8")) if VIDEO_META.is_file() else {}
    episode_meta = json.loads(EPISODE_META.read_text("utf-8")) if EPISODE_META.is_file() else {}
    content = {
        p.relative_to(LIB).as_posix(): read_text(p)
        for p in LIB.rglob("*")
        if p.is_file() and p.suffix.lower() in TEXT_EXT
    }
    offline = json.dumps(
        {
            "manifest": data,
            "videoMeta": video_meta,
            "episodeMeta": episode_meta,
            "content": content,
        },
        ensure_ascii=False,
        separators=(",", ":"),
    ).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    OFFLINE_OUT.write_text("window.__BD_OFFLINE_DATA__=" + offline + ";\n", encoding="utf-8")

    # 每次重建内容时同步更新静态资源版本，避免部署站点继续使用旧离线包。
    if INDEX_HTML.is_file():
        index = INDEX_HTML.read_text("utf-8")
        version = now.strftime("%Y%m%d%H%M%S")
        index = re.sub(
            r"(assets/(?:style\.css|offline-data\.js|app\.js)\?v=)[^\"']+",
            rf"\g<1>{version}",
            index,
        )
        INDEX_HTML.write_text(index, encoding="utf-8")

    print(
        f"✅ {OUT.relative_to(ROOT)}  —  {nf} 个文件 / {nd} 个目录 / {total/1024:.0f} KB\n"
        f"✅ {OFFLINE_OUT.relative_to(ROOT)}  —  本地双击备用数据 {OFFLINE_OUT.stat().st_size/1024:.0f} KB"
    )


if __name__ == "__main__":
    main()
