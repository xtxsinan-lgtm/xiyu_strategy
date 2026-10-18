#!/usr/bin/env python3
"""批量模拟运行器与校准 CLI（S09）。

用法示例：
  python3 design_sim/run.py --games 200 --seed 11001 --decision-ticks 9 --ruleset baseline --out design_sim/out_baseline_q.json
  python3 design_sim/run.py --games 40 --seed 11001 --decision-ticks 3 --ruleset baseline --out design_sim/out_baseline_m.json
  python3 design_sim/run.py --games 20 --seed 11001 --matrix --matrix-games 10
"""
import argparse
import concurrent.futures
import copy
import json
import os
import sys
import time

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from design_sim.ai import HAN_BOTS, XIONGNU_BOTS, make_bot
from design_sim.engine import resolver
from design_sim.engine.state import GameState, load_json
from design_sim.metrics import evaluate_dominance, extract_game_record, summarize_records
from design_sim.rulesets import attach_rules


def run_single_game(args_tuple):
    """运行单局模拟，供串行或 ProcessPoolExecutor 调用。"""
    seed, params, ruleset, han_bot_name, xn_bot_name = args_tuple
    state = GameState(params, seed=seed)
    attach_rules(state, ruleset)
    han_ai = make_bot("han", han_bot_name, ruleset=ruleset)
    xn_ai = make_bot("xiongnu", xn_bot_name, ruleset=ruleset)

    max_decision_turns = max(1, (state.max_turns * 3) // state.decision_ticks + 4)
    for _ in range(max_decision_turns):
        if state.winner != "":
            break
        han_cmds = han_ai.think(state)
        xn_cmds = xn_ai.think(state)
        resolver.resolve(state, {"han": han_cmds, "xiongnu": xn_cmds}, capture_days=False)

    return extract_game_record(state)


def run_batch(games, seed_start, params, ruleset="baseline", han_bot="baseline", xn_bot="baseline", workers=1):
    tasks = [
        (seed_start + i, params, ruleset, han_bot, xn_bot)
        for i in range(games)
    ]
    if workers <= 1 or games <= 2:
        return [run_single_game(t) for t in tasks]
    import multiprocessing
    ctx = multiprocessing.get_context("fork") if "fork" in multiprocessing.get_all_start_methods() else None
    with concurrent.futures.ProcessPoolExecutor(max_workers=workers, mp_context=ctx) as ex:
        return list(ex.map(run_single_game, tasks))


def run_strategy_matrix(seed_start, games_per_pair, params, ruleset="baseline", workers=1, bots=None):
    """运行多策略交叉对战矩阵，用于支配策略检测（00_bible §6.3）。"""
    han_list = bots or ["baseline", "aggressive", "conservative", "greedy", "random_legal"]
    xn_list = bots or ["baseline", "aggressive", "conservative", "greedy", "random_legal"]
    matrix = {}
    for hb in han_list:
        for xb in xn_list:
            recs = run_batch(games_per_pair, seed_start, params, ruleset, hb, xb, workers)
            hw = sum(1 for r in recs if r["winner"] == "han")
            xw = sum(1 for r in recs if r["winner"] == "xiongnu")
            n = len(recs)
            matrix[(hb, xb)] = {
                "games": n,
                "han_win_pct": round(hw * 100.0 / max(1, n), 1),
                "xn_win_pct": round(xw * 100.0 / max(1, n), 1),
                "han_main_pct": round(sum(1 for r in recs if r["win_kind"] == "han_main") * 100.0 / max(1, n), 1),
                "xn_main_pct": round(sum(1 for r in recs if r["win_kind"] == "xn_main") * 100.0 / max(1, n), 1),
                "expiry_pct": round(sum(1 for r in recs if r["win_kind"] == "expiry") * 100.0 / max(1, n), 1),
            }
    return evaluate_dominance(matrix)


def print_summary(summary, elapsed):
    l12 = summary["l12_metrics"]
    c = summary["combat_and_logistics"]
    d = summary["duration"]
    w = summary["win_breakdown"]
    print("=" * 72)
    print(
        "[S09 Sim] Games=%d | Seeds=%d..%d | dt=%s | ruleset=%s | bots=%s vs %s | %.2fs"
        % (
            summary["games"],
            summary["seed_range"][0],
            summary["seed_range"][1],
            summary["meta"].get("decision_ticks"),
            summary["meta"].get("ruleset"),
            summary["meta"].get("han_bot"),
            summary["meta"].get("xn_bot"),
            elapsed,
        )
    )
    print("-" * 72)
    print(
        "Wins: Han=%d (%.1f%%, 95%% CI %s) | Xiongnu=%d (%.1f%%)"
        % (
            summary["wins"]["han"],
            summary["han_win_percent"],
            summary["han_95_percent_interval"],
            summary["wins"]["xiongnu"],
            100.0 - summary["han_win_percent"],
        )
    )
    print(
        "Breakdown: HanMain=%d (%.1f%%) | XnMain=%d (%.1f%%) | Expiry=%d (%.1f%%: Han %d, XN %d)"
        % (
            w["han_main"],
            l12["han_main_win_pct"],
            w["xn_main"],
            l12["xn_main_win_pct"],
            w["expiry"],
            l12["expiry_pct"],
            w["han_expiry"],
            w["xn_expiry"],
        )
    )
    print(
        "L12 Signatures: reason_unique=%d (max %.1f%%) | struct_unique=%d (max %.1f%%)"
        % (
            l12["reason_signature_count"],
            l12["reason_signature_max_share_pct"],
            l12["structural_signature_count"],
            l12["structural_signature_max_share_pct"],
        )
    )
    print(
        "L12 Decision Density (Han T1..T10): applied_avg=%.2f | legal_pool_avg=%.2f"
        % (l12["han_first10_meaningful_cmds_avg"], l12["han_first10_legal_pool_avg"])
    )
    print(
        "Stats: avg_years=%.2f | hexi_ever=%.1f%% | hexi_lost=%.1f | vassals_peak=%.2f (end=%.2f) | rejected=%d"
        % (
            d["average_years"],
            c["hexi_ever_captured_percent"],
            c["avg_hexi_lost"],
            c["avg_han_vassals_peak"],
            c["avg_han_vassals_end"],
            c["rejected_commands"],
        )
    )
    print(
        "Combat: battles=%.1f | sieges=%.1f | raids=%.1f | han_cas=%.0f | xn_cas=%.0f | starve=%.0f | trade_blk=%.1fm"
        % (
            c["avg_battles"],
            c["avg_sieges"],
            c["avg_raids"],
            c["avg_han_cas"],
            c["avg_xn_cas"],
            c["avg_starve_losses"],
            c["avg_trade_blocked_months"],
        )
    )
    print("Top Reason Signatures:")
    for item in summary["endgame_signatures"]["by_reason"][:6]:
        print("  - %s : %d (%.1f%%)" % (item["signature"], item["count"], item["share_pct"]))
    print("=" * 72)


def main():
    parser = argparse.ArgumentParser(description="《西域·汉匈争霸》S09 纸面模拟器 CLI")
    parser.add_argument("--games", type=int, default=40, help="模拟局数（默认 40）")
    parser.add_argument("--seed", type=int, default=11001, help="起始随机种子（默认 11001）")
    parser.add_argument("--decision-ticks", type=int, default=9, help="每决策回合旬数：9=季制，3=月制")
    parser.add_argument("--substep-days", type=float, default=None, help="每旬内部移动/遭遇子步天数（默认读 params.json）")
    parser.add_argument("--ruleset", type=str, default="baseline", help="规则集名称（默认 baseline）")
    parser.add_argument("--params", type=str, default="design_sim/params.json", help="参数文件路径")
    parser.add_argument("--han-bot", type=str, default="baseline", choices=sorted(HAN_BOTS.keys()), help="汉方策略")
    parser.add_argument("--xn-bot", type=str, default="baseline", choices=sorted(XIONGNU_BOTS.keys()), help="匈奴策略")
    parser.add_argument("--workers", type=int, default=0, help="并行进程数（0=自动）")
    parser.add_argument("--matrix", action="store_true", help="同时运行 5x5 跨策略支配检测矩阵")
    parser.add_argument("--matrix-games", type=int, default=10, help="矩阵每配对局数（默认 10）")
    parser.add_argument("--include-records", action="store_true", help="在输出 JSON 中附带逐局明细")
    parser.add_argument("--out", type=str, default="", help="输出 JSON 路径")
    args = parser.parse_args()

    params = load_json(args.params)
    params = copy.deepcopy(params)
    params["decision_ticks"] = args.decision_ticks
    if args.substep_days is not None:
        params["substep_days"] = args.substep_days

    workers = args.workers if args.workers > 0 else min(8, os.cpu_count() or 1)
    t0 = time.time()
    records = run_batch(
        args.games,
        args.seed,
        params,
        ruleset=args.ruleset,
        han_bot=args.han_bot,
        xn_bot=args.xn_bot,
        workers=workers,
    )
    elapsed = time.time() - t0

    meta = {
        "decision_ticks": args.decision_ticks,
        "substep_days": params.get("substep_days", 5),
        "ruleset": args.ruleset,
        "han_bot": args.han_bot,
        "xn_bot": args.xn_bot,
        "elapsed_seconds": round(elapsed, 2),
    }
    summary = summarize_records(records, meta=meta)
    print_summary(summary, elapsed)

    if args.matrix:
        t1 = time.time()
        dom = run_strategy_matrix(
            args.seed,
            args.matrix_games,
            params,
            ruleset=args.ruleset,
            workers=workers,
        )
        summary["dominance_analysis"] = dom
        print(
            "[Matrix] 5x5 Strategy Matrix (%d games/pair) completed in %.2fs | has_dominant=%s"
            % (args.matrix_games, time.time() - t1, dom["has_dominant_strategy"])
        )
        if dom["han_dominant_bots"]:
            print("  Han dominant:", dom["han_dominant_bots"])
        if dom["xn_dominant_bots"]:
            print("  Xiongnu dominant:", dom["xn_dominant_bots"])

    if args.include_records:
        summary["records"] = records

    if args.out:
        out_path = args.out if os.path.isabs(args.out) else os.path.join(REPO_ROOT, args.out)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        print("Saved summary to %s" % args.out)


if __name__ == "__main__":
    main()
