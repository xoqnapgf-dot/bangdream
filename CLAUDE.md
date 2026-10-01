# 工作约定

## 流程

- 开工前先同步 `main` 的最新状态，再改。
- 在指定的工作分支上改动并推送，不直接改 `main`；改完通过 PR 合并进 `main`。
- 合并后给出 GitHub Pages 链接：`https://xoqnapgf-dot.github.io/bangdream/`（合并后需几分钟重新部署）。
- 本文件只约束 Claude Code；`项目简介.txt` 中面向其他 agent 的约定（如 RawGitHack 预览）不在此处改动。
- 改完资料后运行 `python3 tools/build_manifest.py`，提交前跑 `python3 tools/check_content.py`、`node --check assets/app.js`、`git diff --check`。

## 内容

- 不删除、不改写站长放进来的原文；只增加结构、标注和来源。要改正文，先说明改哪里、为什么，等同意再改。
- 台词与剧情描述经多方搜索、交叉比对后收录；站长亲自看片核对的内容可作为来源，并在来源说明里注明。
- 逐帧 OCR 和素材库（`MyGo-Meme`、`mygo-mujica-archive`）只用于定位与配图，不能当台词或剧情内容的来源，也不得补写说话人和动作。
- 官方事实、社区推测、CP 观点分区归档，不把推测写成事实。
- 配图中的人物和话数必须实际核验，核验不了的不放；同人图与梗图只引外链并注明作者和出处。
- 其余细则见 `项目简介.txt`。
