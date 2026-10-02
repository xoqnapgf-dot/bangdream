#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""扫描 资料库/ 目录，生成 assets/manifest.json 供前端文件浏览器使用。"""

import json
import os
import re
import pathlib
import datetime
import subprocess
import sys

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
        "00_剧情区/04_漫画游戏/AveMujica漫画游戏情节汇总.md",
        "00_剧情区/04_漫画游戏/MyGO剧情对白_英文版.md",
        "00_剧情区/04_漫画游戏/少女乐团派对_MyGO相关活动剧情对白_中文版.md",
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


# 排在所在目录最后的文件（顺序即这里的先后）。
DISPLAY_LAST = (
    "00_剧情区/02_AveMujica动画/AveMujica_剧情总纲_整合版.md",
    # 两份视角稿已标为旧版，放到最后。
    "00_剧情区/02_AveMujica动画/故事情节（睦视角）.txt",
    "00_剧情区/02_AveMujica动画/故事情节（祥子视角）.txt",
)


def display_key(path: pathlib.Path):
    """专题文件按策划顺序显示，其余条目仍按自然文件名排序。"""
    try:
        rel = path.relative_to(LIB).as_posix()
    except ValueError:
        rel = path.as_posix()
    rank = DISPLAY_FILE_ORDER.get(rel)
    if rank is not None:
        return (0, rank)
    if rel in DISPLAY_LAST:
        return (2, DISPLAY_LAST.index(rel))
    return (1, natural_key(path.name))


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


def git_update_times() -> dict[str, str]:
    """返回资料库文件最后一次提交的北京时间（精确到分钟）。

    检出、重置会批量改写文件系统 mtime，因此历史时间只取 Git。工作区中
    已修改或未跟踪的文件尚无提交时间，明确使用本次生成时刻。
    """
    now = datetime.datetime.now(BEIJING_TZ).strftime("%Y-%m-%d %H:%M")
    try:
        history = subprocess.run(
            ["git", "-c", "core.quotepath=false", "log", "--no-merges", "--format=@@%ct%x09%s",
             "--name-only", "--no-renames", "--", LIB.name],
            cwd=ROOT, check=True, capture_output=True, text=True, encoding="utf-8",
        ).stdout
        dirty_output = subprocess.run(
            ["git", "-c", "core.quotepath=false", "status", "--porcelain", "-z", "--", LIB.name],
            cwd=ROOT, check=True, capture_output=True,
        ).stdout.decode("utf-8", errors="replace")
    except (OSError, subprocess.CalledProcessError):
        return {}

    result: dict[str, str] = {}
    stamp, subject = None, ""
    for line in history.splitlines():
        if line.startswith("@@"):
            head, _, subject = line[2:].partition("\t")
            try:
                stamp = datetime.datetime.fromtimestamp(int(head), BEIJING_TZ).strftime("%Y-%m-%d %H:%M")
            except ValueError:
                stamp = None
        elif stamp and line.startswith(LIB.name + "/"):
            rel = line[len(LIB.name) + 1:]
            if rel not in result:                      # 最新的提交最先出现
                result[rel] = stamp
                CHANGE_NOTES[rel] = subject.strip()

    # porcelain -z 的普通记录为“XY 路径”；重命名会多带一个 NUL 字段。
    fields = dirty_output.split("\0")
    i = 0
    while i < len(fields):
        record = fields[i]
        i += 1
        if not record:
            continue
        status, path = record[:2], record[3:]
        if status[0] in "RC" or status[1] in "RC":
            if i < len(fields):
                i += 1
        if path.startswith(LIB.name + "/"):
            rel = path[len(LIB.name) + 1:]
            result[rel] = now
            CHANGE_NOTES[rel] = BUILD_NOTE              # 还没提交：用构建时传入的说明
    return result


def meta_update_times() -> dict[str, tuple[str, str]]:
    """剧本的配图、资料卡写在 assets/episode-meta.json 里，不改 .txt 本身。

    逐次提交比对该文件里每个条目的内容：条目有变化，就把那次提交的北京时间
    记给对应的资料文件；工作区里尚未提交的变化记为本次生成时刻。
    """
    rel_meta = EPISODE_META.relative_to(ROOT).as_posix()
    now = datetime.datetime.now(BEIJING_TZ).strftime("%Y-%m-%d %H:%M")

    def git(*args: str) -> str:
        return subprocess.run(
            ["git", "-c", "core.quotepath=false", *args], cwd=ROOT, check=True,
            capture_output=True, text=True, encoding="utf-8",
        ).stdout

    result: dict[str, tuple[str, str]] = {}
    prev: dict = {}
    try:
        revs = git("log", "--no-merges", "--format=%H %ct %s", "--reverse", "--", rel_meta).splitlines()
        for line in revs:
            if not line.strip():
                continue
            rev, ct, subject = (line.split(" ", 2) + [""])[:3]
            cur = json.loads(git("show", f"{rev}:{rel_meta}"))
            stamp = datetime.datetime.fromtimestamp(int(ct), BEIJING_TZ).strftime("%Y-%m-%d %H:%M")
            for key, value in cur.items():
                if prev.get(key) != value:
                    result[key] = (stamp, subject.strip())
            prev = cur
        if EPISODE_META.is_file():
            cur = json.loads(EPISODE_META.read_text("utf-8"))
            for key, value in cur.items():
                if prev.get(key) != value:
                    result[key] = (now, BUILD_NOTE)
    except (OSError, ValueError, subprocess.CalledProcessError):
        return result
    return result


DEPRECATED: dict[str, str] = {}        # 文件 → 旧版本提示（episode-meta 里的 deprecated 字段）
UPDATE_TIMES: dict[str, str] = {}
CHANGE_NOTES: dict[str, str] = {}      # 文件 → 最近一次改动的说明（提交标题）
BUILD_NOTE = ""                        # 本次尚未提交的改动的说明，由 --note 传入
CURRENT_BUILD_TIME = ""


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
                "updated": UPDATE_TIMES.get(rel, CURRENT_BUILD_TIME),
                **({"changed": CHANGE_NOTES[rel][:90]} if CHANGE_NOTES.get(rel) else {}),
                **({"deprecated": DEPRECATED[rel]} if rel in DEPRECATED else {}),
            })
    children = dirs + files
    updated = max((child.get("updated") or "" for child in children), default="") or None
    return {
        "type": "dir",
        "name": d.name,
        "path": d.relative_to(LIB).as_posix() if d != LIB else "",
        "updated": updated,
        "children": children,
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
    global UPDATE_TIMES, CURRENT_BUILD_TIME, BUILD_NOTE
    if "--note" in sys.argv:
        k = sys.argv.index("--note")
        BUILD_NOTE = " ".join(sys.argv[k + 1:k + 2]).strip()
    if not LIB.is_dir():
        raise SystemExit(f"找不到资料库目录: {LIB}")
    # 先刷新大纲，再扫描，保证清单里记录的是大纲的最新体积。
    write_outline()
    CURRENT_BUILD_TIME = datetime.datetime.now(BEIJING_TZ).strftime("%Y-%m-%d %H:%M")
    UPDATE_TIMES = git_update_times()
    if EPISODE_META.is_file():
        for key, entry in json.loads(EPISODE_META.read_text("utf-8")).items():
            if isinstance(entry, dict) and entry.get("deprecated"):
                DEPRECATED[key] = str(entry["deprecated"])
    # 配图、资料卡的改动也算文件更新（取两者较晚的时间）
    for key, (stamp, note) in meta_update_times().items():
        if stamp > UPDATE_TIMES.get(key, ""):
            UPDATE_TIMES[key] = stamp
            CHANGE_NOTES[key] = note
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
