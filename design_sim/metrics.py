"""指标采集与汇总模块（L12 验收数字 + Godot 基线校准对照 + 支配策略检测）。"""
import collections
import math
import statistics

from .engine import victory


def extract_game_record(state):
    """从单局结束后的 GameState 提取与 Godot sim_runner.gd 完全对齐的单局记录及扩展指标。"""
    sc = getattr(state, "final_score", None)
    if sc is None:
        sc = victory.score(state)
        for rule in getattr(state, "rules", ()):
            ov = rule.score_override(state)
            if ov is not None:
                sc = ov

    months = state.tick // 3
    han_v_end = victory.han_vassals(state)
    xn_v_end = victory.xn_vassals(state)
    hexi_xn_end = victory.hexi_held_by_xn(state)
    hexi_han_end = len(state.bal["victory"]["xn_targets"]) - hexi_xn_end
    win_kind = getattr(state, "win_kind", "")
    if not win_kind:
        if "都护" in state.win_reason:
            win_kind = "han_main"
        elif "河西" in state.win_reason:
            win_kind = "xn_main"
        elif state.win_reason.startswith("到期"):
            win_kind = "expiry"
        else:
            win_kind = "other"

    # 终局签名：1) 原始 reason 签名（与 Godot CSV 对照）；2) 结构化签名（或新规则覆写）
    reason_sig = state.win_reason
    year_bucket = min(20, max(1, (months + 23) // 24 * 2))  # 2 年一桶
    struct_sig = "%s|H%d:X%d|HX%d|Y%d" % (win_kind, han_v_end, xn_v_end, hexi_han_end, year_bucket)
    for rule in getattr(state, "rules", ()):
        sig_ov = rule.signature_override(state)
        if sig_ov is not None:
            struct_sig = sig_ov

    # 前 10 回合汉方有意义命令数与候选池大小
    turn_recs = getattr(state, "turn_records", [])
    first10 = turn_recs[:10]
    han_f10_applied = [r["orders_applied"]["han"] for r in first10]
    han_f10_pool = [r.get("han_legal_pool_size", 0) for r in first10]

    # 逆转检测：获胜方在局中是否曾处于显著劣势（分差落后 >= 20 或汉曾失河西城后翻盘）
    reversed_win = False
    if state.history and state.winner in ("han", "xiongnu"):
        if state.winner == "han":
            min_diff = min(h["han_score"] - h["xn_score"] for h in state.history)
            ever_hexi_down = any(h["hexi_xn"] > 0 for h in state.history)
            reversed_win = (min_diff <= -20.0) or ever_hexi_down
        else:
            min_diff = min(h["xn_score"] - h["han_score"] for h in state.history)
            reversed_win = min_diff <= -20.0

    rec = {
        "seed": state.seed,
        "winner": state.winner,
        "win_kind": win_kind,
        "reason": state.win_reason,
        "reason_signature": reason_sig,
        "structural_signature": struct_sig,
        "months": months,
        "years": round(months / 12.0, 2),
        "turns": state.turn,
        "han_vassals_end": han_v_end,
        "han_vassals_peak": state.stats.get("han_vassals_peak", han_v_end),
        "xn_vassals_end": xn_v_end,
        "hexi_xn_end": hexi_xn_end,
        "han_score": sc["han"],
        "xn_score": sc["xiongnu"],
        "battles": state.stats.get("battles", 0),
        "han_cas": state.stats.get("han_casualties", 0),
        "xn_cas": state.stats.get("xn_casualties", 0),
        "sieges": state.stats.get("sieges_won", 0),
        "raids": state.stats.get("raids_xiongnu", 0) + state.stats.get("raids_han", 0),
        "convoys_lost": state.stats.get("convoys_lost", 0),
        "grain_delivered": round(state.stats.get("grain_delivered_han", 0.0), 1),
        "starve_losses": state.stats.get("starve_losses", 0),
        "terrain_losses": state.stats.get("terrain_losses", 0),
        "hexi_lost": state.stats.get("hexi_lost", 0),
        "hexi_lost_first_month": state.stats.get("hexi_lost_first_month", -1),
        "han_conquests": state.stats.get("han_conquests", 0),
        "trade_income": state.stats.get("trade_income", 0),
        "trade_blocked_months": state.stats.get("trade_blocked_months", 0),
        "rejected_commands": state.stats.get("rejected_commands", 0),
        "han_first10_cmds_avg": round(statistics.mean(han_f10_applied), 2) if han_f10_applied else 0.0,
        "han_first10_cmds_by_turn": han_f10_applied,
        "han_first10_pool_avg": round(statistics.mean(han_f10_pool), 2) if han_f10_pool else 0.0,
        "reversed_win": reversed_win,
        "checkpoints": _extract_checkpoints(state.history),
    }
    for rule in getattr(state, "rules", ()):
        rec.update(rule.collect_metrics(state))
    return rec


def _extract_checkpoints(history):
    """提取第 12 / 60 / 120 / 180 / 240 月（第 1/5/10/15/20 年）的资源快照。"""
    by_m = {h["month_index"]: h for h in history}
    out = {}
    for m in (12, 60, 120, 180, 240):
        if m in by_m:
            h = by_m[m]
            out[str(m)] = {
                "han_money": h["han_money"],
                "xn_money": h["xn_money"],
                "han_vassals": h["han_vassals"],
                "xn_vassals": h["xn_vassals"],
                "hexi_xn": h["hexi_xn"],
                "han_score": h["han_score"],
                "xn_score": h["xn_score"],
                "dun_huang_grain": h["dun_huang_grain"],
            }
    return out


def wilson_95_interval(wins, total):
    """计算胜率的 95% Wilson 置信区间（百分比），与 tools/summarize_sims.py 对齐。"""
    if total <= 0:
        return [0.0, 0.0]
    z = 1.959963984540054
    p = wins / float(total)
    denom = 1.0 + z * z / total
    center = (p + z * z / (2.0 * total)) / denom
    half = z * math.sqrt((p * (1.0 - p) + z * z / (4.0 * total)) / total) / denom
    return [round(max(0.0, center - half) * 100.0, 1), round(min(1.0, center + half) * 100.0, 1)]


def summarize_records(records, meta=None):
    """汇总多局记录，输出 L12 全部指标 + Godot 校准对照指标。"""
    n = len(records)
    if n == 0:
        return {}
    wins = collections.Counter(r["winner"] for r in records)
    han_wins = wins.get("han", 0)
    xn_wins = wins.get("xiongnu", 0)

    han_main = sum(1 for r in records if r["win_kind"] == "han_main")
    xn_main = sum(1 for r in records if r["win_kind"] == "xn_main")
    expiry_cnt = sum(1 for r in records if r["win_kind"] == "expiry")
    han_recall_cnt = sum(1 for r in records if r["win_kind"] == "han_recall")
    xn_scatter_cnt = sum(1 for r in records if r["win_kind"] == "xn_scatter")
    collapse_cnt = han_recall_cnt + xn_scatter_cnt

    # 终局签名统计（同时提供 reason 签名、结构化 4 段签名与 2 段粗粒度签名）
    reason_counter = collections.Counter(r["reason_signature"] for r in records)
    struct_counter = collections.Counter(r["structural_signature"] for r in records)
    coarse_counter = collections.Counter(r.get("coarse_signature", r["structural_signature"].split("__")[0]) for r in records)

    reason_max_share = (reason_counter.most_common(1)[0][1] / float(n)) if reason_counter else 0.0
    struct_max_share = (struct_counter.most_common(1)[0][1] / float(n)) if struct_counter else 0.0
    coarse_max_share = (coarse_counter.most_common(1)[0][1] / float(n)) if coarse_counter else 0.0

    # 前 10 回合汉方有意义命令均数与逐回合均值
    han_f10_avg = statistics.mean(r["han_first10_cmds_avg"] for r in records)
    han_f10_pool_avg = statistics.mean(r["han_first10_pool_avg"] for r in records)
    by_turn_lists = [[] for _ in range(10)]
    for r in records:
        for idx, val in enumerate(r.get("han_first10_cmds_by_turn", ())):
            if idx < 10:
                by_turn_lists[idx].append(val)
    han_f10_curve = [round(statistics.mean(lst), 2) if lst else 0.0 for lst in by_turn_lists]

    months_list = [r["months"] for r in records]
    years_list = [m / 12.0 for m in months_list]
    nonexp_months = sorted(r["months"] for r in records if r["win_kind"] != "expiry")

    # 资源曲线汇总
    resource_curves = {}
    for m_key in ("12", "60", "120", "180", "240"):
        pts = [r["checkpoints"][m_key] for r in records if m_key in r.get("checkpoints", {})]
        if pts:
            resource_curves["month_" + m_key] = {
                "sample_size": len(pts),
                "han_money": round(statistics.mean(p["han_money"] for p in pts), 1),
                "xn_money": round(statistics.mean(p["xn_money"] for p in pts), 1),
                "han_vassals": round(statistics.mean(p["han_vassals"] for p in pts), 2),
                "xn_vassals": round(statistics.mean(p["xn_vassals"] for p in pts), 2),
                "hexi_xn": round(statistics.mean(p["hexi_xn"] for p in pts), 2),
                "han_score": round(statistics.mean(p["han_score"] for p in pts), 1),
                "xn_score": round(statistics.mean(p["xn_score"] for p in pts), 1),
                "dun_huang_grain": round(statistics.mean(p["dun_huang_grain"] for p in pts), 0),
            }

    han_main_pct = round(han_main * 100.0 / n, 2)
    xn_main_pct = round(xn_main * 100.0 / n, 2)
    expiry_pct = round(expiry_cnt * 100.0 / n, 2)
    collapse_pct = round(collapse_cnt * 100.0 / n, 2)

    l12_eval = {
        "han_main_win_pct": han_main_pct,
        "han_main_in_20_35": 20.0 <= han_main_pct <= 35.0,
        "xn_main_win_pct": xn_main_pct,
        "xn_main_in_20_35": 20.0 <= xn_main_pct <= 35.0,
        "expiry_pct": expiry_pct,
        "expiry_le_50": expiry_pct <= 50.0,
        "political_collapse_pct": collapse_pct,
        "han_recall_pct": round(han_recall_cnt * 100.0 / n, 2),
        "xn_scatter_pct": round(xn_scatter_cnt * 100.0 / n, 2),
        "reason_signature_count": len(reason_counter),
        "reason_signature_max_share_pct": round(reason_max_share * 100.0, 2),
        "structural_signature_count": len(struct_counter),
        "structural_signature_max_share_pct": round(struct_max_share * 100.0, 2),
        "coarse_signature_count": len(coarse_counter),
        "coarse_signature_max_share_pct": round(coarse_max_share * 100.0, 2),
        "signatures_ge_15_and_le_20pct": len(struct_counter) >= 15 and struct_max_share <= 0.20,
        "han_first10_meaningful_cmds_avg": round(han_f10_avg, 2),
        "han_first10_cmds_ge_3": han_f10_avg >= 3.0,
        "han_first10_legal_pool_avg": round(han_f10_pool_avg, 2),
    }
    l12_eval["all_passed"] = (
        l12_eval["han_main_in_20_35"]
        and l12_eval["xn_main_in_20_35"]
        and l12_eval["expiry_le_50"]
        and l12_eval["signatures_ge_15_and_le_20pct"]
        and l12_eval["han_first10_cmds_ge_3"]
    )

    summary = {
        "meta": meta or {},
        "games": n,
        "seed_range": [records[0]["seed"], records[-1]["seed"]],
        "wins": {"han": han_wins, "xiongnu": xn_wins},
        "han_win_percent": round(han_wins * 100.0 / n, 2),
        "han_95_percent_interval": wilson_95_interval(han_wins, n),
        "win_breakdown": {
            "han_main": han_main,
            "xn_main": xn_main,
            "expiry": expiry_cnt,
            "han_expiry": sum(1 for r in records if r["win_kind"] == "expiry" and r["winner"] == "han"),
            "xn_expiry": sum(1 for r in records if r["win_kind"] == "expiry" and r["winner"] == "xiongnu"),
            "political_collapse": collapse_cnt,
            "han_recall": han_recall_cnt,
            "xn_scatter": xn_scatter_cnt,
        },
        "l12_metrics": l12_eval,
        "endgame_signatures": {
            "by_reason": [
                {"signature": k, "count": v, "share_pct": round(v * 100.0 / n, 2)}
                for k, v in reason_counter.most_common(15)
            ],
            "by_structure": [
                {"signature": k, "count": v, "share_pct": round(v * 100.0 / n, 2)}
                for k, v in struct_counter.most_common(20)
            ],
            "by_coarse": [
                {"signature": k, "count": v, "share_pct": round(v * 100.0 / n, 2)}
                for k, v in coarse_counter.most_common(12)
            ],
        },
        "decision_density": {
            "han_first10_cmds_avg": round(han_f10_avg, 2),
            "han_first10_cmds_by_turn": han_f10_curve,
            "han_first10_legal_pool_avg": round(han_f10_pool_avg, 2),
        },
        "duration": {
            "average_years": round(statistics.mean(years_list), 2),
            "median_years": round(statistics.median(years_list), 2),
            "min_years": round(min(years_list), 2),
            "max_years": round(max(years_list), 2),
            "non_expiry_months": nonexp_months,
        },
        "combat_and_logistics": {
            "hexi_ever_captured_percent": round(sum(1 for r in records if r["hexi_lost"] > 0) * 100.0 / n, 1),
            "games_without_battles": sum(1 for r in records if r["battles"] == 0),
            "expiry_games": expiry_cnt,
            "rejected_commands": sum(r["rejected_commands"] for r in records),
            "reversal_rate_pct": round(sum(1 for r in records if r["reversed_win"]) * 100.0 / n, 1),
            "avg_battles": round(statistics.mean(r["battles"] for r in records), 1),
            "avg_han_cas": round(statistics.mean(r["han_cas"] for r in records), 1),
            "avg_xn_cas": round(statistics.mean(r["xn_cas"] for r in records), 1),
            "avg_sieges": round(statistics.mean(r["sieges"] for r in records), 1),
            "avg_raids": round(statistics.mean(r["raids"] for r in records), 1),
            "avg_starve_losses": round(statistics.mean(r["starve_losses"] for r in records), 1),
            "avg_terrain_losses": round(statistics.mean(r["terrain_losses"] for r in records), 1),
            "avg_hexi_lost": round(statistics.mean(r["hexi_lost"] for r in records), 1),
            "avg_trade_blocked_months": round(statistics.mean(r["trade_blocked_months"] for r in records), 1),
            "avg_han_vassals_peak": round(statistics.mean(r["han_vassals_peak"] for r in records), 2),
            "avg_han_vassals_end": round(statistics.mean(r["han_vassals_end"] for r in records), 2),
            "avg_xn_vassals_end": round(statistics.mean(r["xn_vassals_end"] for r in records), 2),
            "han_vassals_peak_dist": dict(collections.Counter(str(r["han_vassals_peak"]) for r in records)),
            "han_vassals_end_dist": dict(collections.Counter(str(r["han_vassals_end"]) for r in records)),
        },
        "resource_curves": resource_curves,
    }
    if "han_merit_end" in records[0]:
        summary["v1_summary"] = {
            "avg_han_merit_end": round(statistics.mean(r["han_merit_end"] for r in records), 1),
            "avg_han_merit_peak": round(statistics.mean(r["han_merit_peak"] for r in records), 1),
            "avg_xn_weifu_end": round(statistics.mean(r["xn_weifu_end"] for r in records), 1),
            "avg_xn_weifu_peak": round(statistics.mean(r["xn_weifu_peak"] for r in records), 1),
            "avg_court_trust_end": round(statistics.mean(r["court_trust_end"] for r in records), 1),
            "avg_chanyu_prestige_end": round(statistics.mean(r["chanyu_prestige_end"] for r in records), 1),
            "rizhu_surrender_pct": round(sum(1 for r in records if r.get("rizhu_surrendered")) * 100.0 / n, 1),
            "baizai_pct": round(sum(1 for r in records if r.get("baizai_count", 0) > 0) * 100.0 / n, 1),
            "luntai_pct": round(sum(1 for r in records if r.get("luntai_active")) * 100.0 / n, 1),
            "lead_change_games_pct": round(sum(1 for r in records if r.get("lead_changes", 0) > 0) * 100.0 / n, 1),
            "end_type_dist": dict(collections.Counter(r.get("end_type", "") for r in records)),
            "han_grade_dist": dict(collections.Counter(r.get("han_grade", "") for r in records)),
            "xn_grade_dist": dict(collections.Counter(r.get("xn_grade", "") for r in records)),
        }
    return summary


def evaluate_dominance(matrix_results, threshold_pct=70.0):
    """检测支配策略（00_bible §6.3：某策略对所有对手胜率 > 70% 或对全部对手平均胜率 > 70% 即视为支配）。

    matrix_results: {(han_bot, xn_bot): {"han_win_pct": float, "xn_win_pct": float, "games": int}}
    """
    han_bots = sorted({k[0] for k in matrix_results})
    xn_bots = sorted({k[1] for k in matrix_results})

    han_dom = []
    han_avg_by_bot = {}
    for hb in han_bots:
        rates = [matrix_results[(hb, xb)]["han_win_pct"] for xb in xn_bots if (hb, xb) in matrix_results]
        if rates:
            avg_r = round(statistics.mean(rates), 1)
            han_avg_by_bot[hb] = avg_r
            if all(r > threshold_pct for r in rates) or avg_r > threshold_pct:
                han_dom.append({"bot": hb, "min_win_pct": min(rates), "avg_win_pct": avg_r})

    xn_dom = []
    xn_avg_by_bot = {}
    for xb in xn_bots:
        rates = [matrix_results[(hb, xb)]["xn_win_pct"] for hb in han_bots if (hb, xb) in matrix_results]
        if rates:
            avg_r = round(statistics.mean(rates), 1)
            xn_avg_by_bot[xb] = avg_r
            if all(r > threshold_pct for r in rates) or avg_r > threshold_pct:
                xn_dom.append({"bot": xb, "min_win_pct": min(rates), "avg_win_pct": avg_r})

    return {
        "threshold_pct": threshold_pct,
        "han_avg_win_pct_by_bot": han_avg_by_bot,
        "xn_avg_win_pct_by_bot": xn_avg_by_bot,
        "han_dominant_bots": han_dom,
        "xn_dominant_bots": xn_dom,
        "has_dominant_strategy": bool(han_dom or xn_dom),
        "matchups": {
            "%s_vs_%s" % (hb, xb): matrix_results[(hb, xb)]
            for hb in han_bots for xb in xn_bots if (hb, xb) in matrix_results
        },
    }

