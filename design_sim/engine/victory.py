"""胜利检查（按月）与到期计分 —— 移植自 core/victory.gd。

扩展点：规则模块可通过 hooks.victory_check / hooks.score 覆盖（见 rulesets/）。
"""
from . import buffs


def han_vassals(state):
    return sum(1 for sid, rel in state.relations.items()
               if state.factions[sid].get("counts_for_victory", False) and rel["overlord"] == "han")


def xn_vassals(state):
    return sum(1 for sid, rel in state.relations.items()
               if state.factions[sid].get("counts_for_victory", False) and rel["overlord"] == "xiongnu")


def han_conditions_met(state):
    v = state.bal["victory"]
    if han_vassals(state) < v["han_required"]:
        return False
    return all(state.relations[sid]["overlord"] == "han" for sid in v["han_must_have"])


def hexi_held_by_xn(state):
    return sum(1 for nid in state.bal["victory"]["xn_targets"] if state.nodes[nid]["faction"] == "xiongnu")


def score(state):
    v = state.bal["victory"]["score"]
    targets = state.bal["victory"]["xn_targets"]
    hexi_han = sum(1 for nid in targets if state.nodes[nid]["faction"] == "han")
    han_s = han_vassals(state) * v["han_vassal"] + hexi_han * v["hexi_held"]
    xn_s = (4 - hexi_han) * v["hexi_held"] + xn_vassals(state) * v["han_vassal"]
    pressure = 0.0
    for nid in targets:
        if buffs.has(state, "sacked", nid) and state.nodes[nid]["faction"] == "han":
            pressure += v["sacked_hexi"]
    xn_s += min(pressure, v["raid_pressure_cap"])
    return {"han": float(han_s), "xiongnu": float(xn_s)}


def objective_progress(state, faction):
    v = state.bal["victory"]
    if faction == "xiongnu":
        return float(hexi_held_by_xn(state)) / max(1, len(v["xn_targets"]))
    must = sum(1 for sid in v["han_must_have"] if state.relations[sid]["overlord"] == "han")
    return min(min(1.0, float(han_vassals(state)) / max(1, int(v["han_required"]))), float(must) / max(1, len(v["han_must_have"])))


def scored_winner(state, scores):
    if scores["han"] != scores["xiongnu"]:
        return ("han" if scores["han"] > scores["xiongnu"] else "xiongnu"), ""
    h = objective_progress(state, "han")
    x = objective_progress(state, "xiongnu")
    if abs(h - x) > 1e-9:
        return ("han" if h > x else "xiongnu"), "同分按目标完成度判定"
    v = state.bal["victory"]
    h = float(state.streak["han"]) / max(1, int(v["han_hold_turns"]))
    x = float(state.streak["xiongnu"]) / max(1, int(v["xn_hold_turns"]))
    if abs(h - x) > 1e-9:
        return ("han" if h > x else "xiongnu"), "同分按持续达标进度判定"
    return ("han" if state.rng.randint(0, 1) == 0 else "xiongnu"), "同分同进度，抽签判定"


def monthly(state):
    v = state.bal["victory"]
    state.stats["han_vassals_peak"] = max(state.stats["han_vassals_peak"], han_vassals(state))
    state.streak["han"] = state.streak["han"] + 1 if han_conditions_met(state) else 0
    state.streak["xiongnu"] = state.streak["xiongnu"] + 1 if hexi_held_by_xn(state) >= len(v["xn_targets"]) else 0
    state.win_kind = ""
    if state.streak["han"] >= v["han_hold_turns"] and state.streak["xiongnu"] >= v["xn_hold_turns"]:
        w, det = scored_winner(state, score(state))
        state.winner = w
        state.win_kind = "both_main"
        state.win_reason = "双方同月达成胜利条件" + ("（%s）" % det if det else "")
    elif state.streak["han"] >= v["han_hold_turns"]:
        state.winner = "han"
        state.win_kind = "han_main"
        state.win_reason = "设立西域都护府"
    elif state.streak["xiongnu"] >= v["xn_hold_turns"]:
        state.winner = "xiongnu"
        state.win_kind = "xn_main"
        state.win_reason = "夺回河西四郡"
    elif state.tick // 3 + 1 >= state.max_turns:
        s = score(state)
        w, det = scored_winner(state, s)
        state.winner = w
        state.win_kind = "expiry"
        state.final_score = s
        state.win_reason = "到期计分 汉%d : 匈奴%d" % (int(s["han"]), int(s["xiongnu"])) + ("（%s）" % det if det else "")
    if state.winner:
        state.log_event("victory", "%s 获胜：%s" % (state.winner, state.win_reason))
