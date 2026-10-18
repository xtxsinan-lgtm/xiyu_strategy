#!/usr/bin/env python3
"""构建《西域·汉匈争霸》v1.0 交互式网页验证工作台数据包（`web/assets/`）。

将 `data/*.json`、`design_sim/**/*.py`、预计算开局快照、S09 200局验证结果与
`docs/design_v1/` 全部设计文档/工单打包为静态 JS 资源，供 GitHub Pages 零后端运行。
"""
import glob
import json
import os
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from design_sim import web_bridge as wb


def read_text(rel_path):
    p = os.path.join(REPO_ROOT, rel_path)
    with open(p, "r", encoding="utf-8") as f:
        return f.read()


def read_json(rel_path):
    return json.loads(read_text(rel_path))


def build():
    out_dir = os.path.join(REPO_ROOT, "web", "assets")
    os.makedirs(out_dir, exist_ok=True)

    # 1. 收集 data/*.json 与 design_sim/params.json（供 Pyodide 虚拟文件系统与前端地图渲染共用）
    vfs_files = {}
    for fn in (
        "data/ai_profiles.json",
        "data/balance.json",
        "data/buffs.json",
        "data/map_presentation.json",
        "data/route_calibration.json",
        "data/scenario_mvp.json",
        "data/units.json",
        "design_sim/params.json",
    ):
        vfs_files[fn] = read_text(fn)

    # 2. 收集全部 design_sim/**/*.py 源码（供 Pyodide 在浏览器内 100% 原生运行）
    for root, _, files in os.walk(os.path.join(REPO_ROOT, "design_sim")):
        for f in sorted(files):
            if f.endswith(".py") and f != "build_web.py":
                abs_p = os.path.join(root, f)
                rel_p = os.path.relpath(abs_p, REPO_ROOT).replace("\\", "/")
                vfs_files[rel_p] = read_text(rel_p)

    # 3. 预生成首回合（Turn 0）快照，确保网页打开 0.0 秒即可交互（无需等待 WASM 下载）
    initial_snapshots = {}
    for side in ("han", "xiongnu"):
        for scen in ("mo_bei_zhi_hou", "lou_lan_gu_shi", "du_hu_fu"):
            key = "%s__v1__%s" % (side, scen)
            initial_snapshots[key] = json.loads(
                wb.init_game_json(side=side, ruleset="v1", opp_bot="baseline", seed=11001, scenario=scen)
            )
        key_base = "%s__baseline__mo_bei_zhi_hou" % side
        initial_snapshots[key_base] = json.loads(
            wb.init_game_json(side=side, ruleset="baseline", opp_bot="baseline", seed=11001, scenario="mo_bei_zhi_hou")
        )

    # 4. 收集 S09 200局验证报告与 5x5 矩阵数据
    s09_results = {
        "v1_200q": read_json("design_sim/out_v1_q.json"),
        "baseline_200q": read_json("design_sim/out_baseline_q.json"),
        "baseline_200m": read_json("design_sim/out_baseline_m.json"),
        "v1_matrix": read_json("design_sim/out_v1_matrix_q.json"),
        "baseline_matrix": read_json("design_sim/out_matrix_q.json"),
    }

    bundle = {
        "map_presentation": read_json("data/map_presentation.json"),
        "scenario_mvp": read_json("data/scenario_mvp.json"),
        "balance": read_json("data/balance.json"),
        "units": read_json("data/units.json"),
        "params": read_json("design_sim/params.json"),
        "scenarios_meta": wb.SCENARIO_META,
        "initial_snapshots": initial_snapshots,
        "s09_results": s09_results,
        "vfs_files": vfs_files,
    }

    bundle_path = os.path.join(out_dir, "bundle_data.js")
    with open(bundle_path, "w", encoding="utf-8") as f:
        f.write("window.XIYU_BUNDLE = ")
        json.dump(bundle, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    # 5. 收集 docs/design_v1/ 下全部规范、研究报告与 24 张工单（供 Tab 4 文档库浏览）
    doc_entries = [
        {"id": "00_bible", "group": "总纲与注册表", "title": "00 设计圣经 (Design Bible L1-L12)", "path": "docs/design_v1/00_bible.md"},
        {"id": "01_registry", "group": "总纲与注册表", "title": "01 W3 跨文档审查与全局符号注册表", "path": "docs/design_v1/01_cross_review_and_registry.md"},
        {"id": "STATUS", "group": "总纲与注册表", "title": "STATUS 进度看板与全局裁决 R-01..R-05", "path": "docs/design_v1/STATUS.md"},
        {"id": "S01", "group": "核心系统规范 (S01-S10)", "title": "S01 胜利、失败、连续计分与三大剧本", "path": "docs/design_v1/S01_victory_scenarios.md"},
        {"id": "S02", "group": "核心系统规范 (S01-S10)", "title": "S02 长安朝堂、诏令与驿传文书时差", "path": "docs/design_v1/S02_han_court.md"},
        {"id": "S03", "group": "核心系统规范 (S01-S10)", "title": "S03 单于王庭、四部分赏与三次年会", "path": "docs/design_v1/S03_xiongnu_confederation.md"},
        {"id": "S04", "group": "核心系统规范 (S01-S10)", "title": "S04 18城邦外交、精使/募使与罪状讨伐", "path": "docs/design_v1/S04_citystates_diplomacy.md"},
        {"id": "S05", "group": "核心系统规范 (S01-S10)", "title": "S05 万里粮道、军屯、马政与五级迷雾", "path": "docs/design_v1/S05_logistics_military_fog.md"},
        {"id": "S06", "group": "核心系统规范 (S01-S10)", "title": "S06 事件引擎、25人花名册与史官纪事", "path": "docs/design_v1/S06_events_characters_narrative.md"},
        {"id": "S07", "group": "核心系统规范 (S01-S10)", "title": "S07 モ块化 UI、可读性与五课交互教学", "path": "docs/design_v1/S07_ux_onboarding.md"},
        {"id": "S08", "group": "核心系统规范 (S01-S10)", "title": "S08 零特权迷雾效用 AI 与 3x3 性格矩阵", "path": "docs/design_v1/S08_ai.md"},
        {"id": "S09", "group": "核心系统规范 (S01-S10)", "title": "S09 纸面模拟器架构与 200局验证报告", "path": "docs/design_v1/S09_simulation_validation.md"},
        {"id": "S10", "group": "核心系统规范 (S01-S10)", "title": "S10 工程实施总纲与双轨验收 SOP", "path": "docs/design_v1/S10_implementation_plan.md"},
        {"id": "P0A", "group": "原子实施工单 (T01-T24)", "title": "工单分册 P0A：数据、状态、胜利、汉廷、匈奴 (T01-T06)", "path": "docs/design_v1/tickets/P0A_data_and_state_tickets.md"},
        {"id": "P0B", "group": "原子实施工单 (T01-T24)", "title": "工单分册 P0B：外交、给食、粮道、马政、事件、主循环 (T07-T12)", "path": "docs/design_v1/tickets/P0B_diplomacy_logistics_events_tickets.md"},
        {"id": "P1", "group": "原子实施工单 (T01-T24)", "title": "工单分册 P1：迷雾、预演、零作弊AI、三剧本、纪事 (T13-T18)", "path": "docs/design_v1/tickets/P1_fog_ai_scenarios_tickets.md"},
        {"id": "P2", "group": "原子实施工单 (T01-T24)", "title": "工单分册 P2：双语本地化、UI重构、嵌套Tooltip、总门禁 (T19-T24)", "path": "docs/design_v1/tickets/P2_ui_loc_verification_tickets.md"},
        {"id": "R_AUDIT", "group": "Phase 0 前期调研报告", "title": "调研 1：现有 MVP 全量代码与模拟审计报告", "path": "docs/design_v1/research/report_audit.md"},
        {"id": "R_MARKET", "group": "Phase 0 前期调研报告", "title": "调研 2：商业历史策略游戏竞品成败深度分析", "path": "docs/design_v1/research/report_market.md"},
        {"id": "R_HISTORY", "group": "Phase 0 前期调研报告", "title": "调研 3：汉代西域与汉匈战争史料机制转化全考", "path": "docs/design_v1/research/report_history.md"},
        {"id": "R_EVO", "group": "Phase 0 前期调研报告", "title": "调研 4：《西域·汉匈争霸》商业化进化总蓝图", "path": "docs/design_v1/research/report_evolution.md"},
    ]
    for item in doc_entries:
        txt = read_text(item["path"])
        item["lines"] = txt.count("\n") + 1
        item["chars"] = len(txt)
        item["content"] = txt

    docs_path = os.path.join(out_dir, "docs_bundle.js")
    with open(docs_path, "w", encoding="utf-8") as f:
        f.write("window.XIYU_DOCS = ")
        json.dump(doc_entries, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    print("Built web bundles successfully:")
    print(" -", bundle_path, "%.1f KB" % (os.path.getsize(bundle_path) / 1024.0))
    print(" -", docs_path, "%.1f KB" % (os.path.getsize(docs_path) / 1024.0))


if __name__ == "__main__":
    build()
