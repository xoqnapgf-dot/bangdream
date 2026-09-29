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
OUT = ROOT / "assets" / "manifest.json"

TEXT_EXT = {".md", ".txt"}


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


def walk(d: pathlib.Path):
    dirs, files = [], []
    for entry in sorted(d.iterdir(), key=lambda p: natural_key(p.name)):
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
    tree = walk(LIB)
    nf, nd = count(tree)
    total = sum(p.stat().st_size for p in LIB.rglob("*") if p.is_file())
    data = {
        "root": LIB.name,
        "generated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "stats": {"files": nf, "dirs": nd, "bytes": total},
        "tree": tree,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"✅ {OUT.relative_to(ROOT)}  —  {nf} 个文件 / {nd} 个目录 / {total/1024:.0f} KB")


if __name__ == "__main__":
    main()
