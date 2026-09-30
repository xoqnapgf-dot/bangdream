#!/usr/bin/env python3
"""资料库中容易回归的显示顺序与剧情修正检查。"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "资料库"


def find_dir(node: dict, path: str) -> dict:
    if node.get("path") == path:
        return node
    for child in node.get("children", []):
        if child.get("type") == "dir":
            try:
                return find_dir(child, path)
            except KeyError:
                pass
    raise KeyError(path)


def assert_order(tree: dict, path: str, expected: list[str]) -> None:
    node = find_dir(tree, path)
    actual = [item["name"] for item in node["children"] if item["type"] == "file"]
    assert actual == expected, f"{path} 顺序错误：{actual!r}"


def main() -> None:
    manifest = json.loads((ROOT / "assets/manifest.json").read_text(encoding="utf-8"))
    tree = manifest["tree"]
    assert_order(tree, "00_剧情区/03_剧场版", [
        "MyGO剧场版_资料汇总.md",
        "AveMujica剧场版_prima_aurora资料汇总.md",
    ])
    assert_order(tree, "00_剧情区/04_漫画游戏", [
        "MyGO_漫画游戏情节汇总.md",
        "AveMujica漫画游戏情节汇总.md",
        "MyGO剧情对白_英文版.md",
        "少女乐团派对_MyGO相关活动剧情对白_中文版.md",
        "少女乐团派对_AveMujica相关剧情对白_中文版.md",
        "OurNotes内测社区反馈汇总.md",
    ])

    # 页面必须服从 manifest；曾经这里二次按文件名排序，导致实际页面
    # 与上述检查结果相反。
    frontend = (ROOT / "assets/app.js").read_text(encoding="utf-8")
    assert ".sort(compareNodes)" not in frontend, "前端仍在覆盖 manifest 的策划顺序"
    assert "return (children || []).slice();" in frontend

    # 每个资料文件都必须带北京时间分钟时间；前端列表和阅读页都要展示。
    def check_updated(node: dict) -> None:
        for child in node.get("children", []):
            updated = child.get("updated")
            assert isinstance(updated, str) and len(updated) == 16, f"缺少分钟级更新时间：{child.get('path')}"
            assert updated[4] == "-" and updated[7] == "-" and updated[10] == " " and updated[13] == ":"
            if child["type"] == "dir":
                check_updated(child)

    check_updated(tree)
    assert "北京时间 ' + esc(f.updated)" in frontend, "文件清单未显示北京时间"
    assert "更新于北京时间 ' + node.updated" in frontend, "文件阅读页未显示更新时间"

    community_dir = LIB / "00_剧情区/06_社区解析_推测"
    mygo_community = (community_dir / "MyGO_分析推测汇总.md").read_text(encoding="utf-8")
    ave_community = (community_dir / "AveMujica_分析推测汇总.md").read_text(encoding="utf-8")
    yamaryo = (community_dir / "Yamaryo_個體化的擺盪與認同的放手.md").read_text(encoding="utf-8")
    for text in (mygo_community, ave_community):
        assert "双向情感障碍自杀率" not in text
        assert "系统自动/豆瓣" not in text
        assert "★★★★★" not in text
    assert "不是 `Mujica` 的拉丁语词源" in ave_community
    assert "非完整转载" in yamaryo and "缺少原站第 3、4 章" in yamaryo

    synopsis = (LIB / "00_剧情区/02_AveMujica动画/AveMujica_剧情总纲_整合版.md").read_text(encoding="utf-8")
    required = [
        "赤着一只脚继续冲出机场",
        "若麦拒绝了自己替她推荐的舞台试镜",
        "「上面」已经叫停",
        "永远在一起",
        "爱音与乐奈在台前并肩弹出双吉他段落",
        "若麦几次把视线落在她身上",
        "牵起她的手共舞", 
    ]
    for phrase in required:
        assert phrase in synopsis, f"剧情总纲缺少：{phrase}"
    assert "祥子ちゃん" not in synopsis
    assert "## 台词摘录" not in synopsis

    ave_interview = (LIB / "00_剧情区/05_官方访谈与设定/AveMujica_确证内容汇总.md").read_text(encoding="utf-8")
    mygo_interview = (LIB / "00_剧情区/05_官方访谈与设定/MyGO_确证内容汇总.md").read_text(encoding="utf-8")
    for phrase in ["一人 13 役", "5 台摄影机", "第 13 话《天球（そら）のMúsica》末尾"]:
        assert phrase in ave_interview, f"Ave Mujica 访谈汇总缺少：{phrase}"
    for phrase in ["爱音被选为开篇的叙事入口", "SPACE 关闭", "逐层加入乐器"]:
        assert phrase in mygo_interview, f"MyGO!!!!! 访谈汇总缺少：{phrase}"

    print("✅ 显示顺序与剧情/访谈回归检查通过")


if __name__ == "__main__":
    main()
