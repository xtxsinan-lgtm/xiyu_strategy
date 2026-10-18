"""月度经济 / 外交被动 / 商路 / 城邦归属 —— 移植自 core/economy.gd、diplomacy.gd、trade.gd、citystate.gd。"""
import math

from . import buffs


# ======================= economy.gd =======================
def farm_workers(state, n):
    ratio = state.bal["food"]["labor_ratio_city"]
    return max(0.0, min(float(n["farm_cap"]) * n["farm_dev"], n["pop"] * ratio - n["levied_out"]))


def farm_output_year(state, n):
    out = farm_workers(state, n) * state.bal["food"]["farm_yield_per_worker_year"]
    if buffs.has(state, "sacked", n["id"]):
        out *= buffs.param(state, "sacked", n["id"], "farm_mult", 0.5)
    return out


def colony_output_year(state, n):
    if n["colonies"] <= 0:
        return 0.0
    room = max(0.0, float(n["farm_cap"]) - farm_workers(state, n))
    return min(float(n["colonies"]), room) * state.bal["food"]["farm_yield_per_worker_year"]


def economy_monthly(state):
    month = state.month()
    season = state.season()
    f = state.bal["food"]
    if month == 1:
        _new_year(state)
    for n in state.nodes.values():
        if n["type"] in ("source", "pass"):
            continue
        _node_month(state, n, month, season, f)


def _node_month(state, n, month, season, f):
    if month == state.bal["calendar"]["harvest_month"] and n["under_siege_by"] == "":
        n["grain"] += farm_output_year(state, n)
        c = colony_output_year(state, n)
        if c > 0:
            n["depot"]["han"] = n["depot"].get("han", 0.0) + c
    need = n["pop"] * f["civilian_per_month"]
    cap = n["pasture_cap"]
    if cap > 0 and n["horses"] > 0:
        need -= n["horses"] * f["milk_per_horse_month"][season]
    if n["type"] == "nomad":
        need -= n["pop"] * f["pastoral_self_per_pop_month"]
    need = max(0.0, need)
    eat = min(need, n["grain"])
    n["grain"] -= eat
    need -= eat
    if need > 0.5 and n["horses"] > 0 and cap > 0:
        kill = min(int(n["horses"]), int(math.ceil(need / f["horse_slaughter_food"])))
        n["horses"] -= kill
        need -= kill * f["horse_slaughter_food"]
    if need > 0.5 and n["pop"] > 0:
        n["starving"] = True
        n["starve_streak"] += 1
        n["pop"] = int(n["pop"] * (1.0 - state.bal["pop"]["starve_loss_month"]))
        n["starved_year"] = True
    else:
        n["starving"] = False
        n["starve_streak"] = 0
    if cap > 0:
        if month in state.bal["calendar"]["spring_months"]:
            n["horses"] += n["horses"] * state.bal["horses"]["spring_growth"] / 3.0 * max(0.0, 1.0 - float(n["horses"]) / cap)
            n["horses"] = int(n["horses"])
        if n["horses"] > cap:
            n["horses"] -= int((n["horses"] - cap) * state.bal["horses"]["overgraze_death_month"])
    for k in list(n["recruited"].keys()):
        if k != "tuntian":
            n["recruited"][k] = int(n["recruited"][k] * 0.92)


def _new_year(state):
    for n in state.nodes.values():
        if n["pop"] > 0 and not n.get("starved_year", False) and n["pop"] < n["pop_cap"]:
            n["pop"] = int(n["pop"] * (1.0 + state.bal["pop"]["growth_year_if_surplus"]))
        n["starved_year"] = False
        kind = state.kind_of(n["faction"])
        if kind in ("citystate", "great"):
            ratio = state.bal["local_militia_ratio"] if kind == "citystate" else state.bal["great_militia_ratio"]
            total = int(n["pop"] * ratio)
            if kind == "citystate":
                n["militia"] = {"infantry": total // 2, "crossbow": total - total // 2}
            else:
                n["militia"] = {"cavalry": int(total * 0.7), "infantry": total - int(total * 0.7)}
    h = state.bal["han"]
    if state.turn > 0 or state.tick > 0:
        state.factions["han"]["money"] += h["annual_money"]
        for t, v in h["central_regen_year"].items():
            state.central[t] = min(int(h["central_cap"][t]), int(state.central.get(t, 0)) + int(v))


# ======================= diplomacy.gd =======================
def _d(state):
    return state.bal["diplomacy"]


def mult(state, sid):
    return _d(state)["great_threshold_mult"] if state.kind_of(sid) == "great" else 1.0


def gift_gain(state, rel, units):
    d = _d(state)
    inf = rel["han_influence"]
    for _ in range(units):
        inf += d["gift_unit_influence"] * (1.0 - inf / d["influence_max"])
    return min(inf, d["influence_max"]) - rel["han_influence"]


def can_enfeoff(state, sid):
    rel = state.relations.get(sid)
    if not rel:
        return "不是可外交对象"
    d = _d(state)
    if rel["han_status"] == "enfeoffed" or rel["overlord"] == "han":
        return "已册封或已是属国"
    if rel["han_influence"] < d["enfeoff_min_influence"] * mult(state, sid):
        return "影响力不足（需 %d）" % int(d["enfeoff_min_influence"] * mult(state, sid))
    if state.factions["han"]["money"] < d["enfeoff_cost_money"]:
        return "钱不足"
    return ""


def can_vassal(state, sid):
    rel = state.relations.get(sid)
    if not rel:
        return "不是可外交对象"
    d = _d(state)
    if rel["overlord"] == "han":
        return "已是汉属国"
    m = mult(state, sid)
    if rel["han_influence"] < d["vassal_min_influence"] * m:
        return "影响力不足（需 %d）" % int(d["vassal_min_influence"] * m)
    if rel["han_influence"] < rel["xn_intimidation"] + d["vassal_margin_over_intimidation"] * m:
        return "影响力须高出匈奴威吓 %d" % int(d["vassal_margin_over_intimidation"] * m)
    return ""


def can_demand(state, sid):
    rel = state.relations.get(sid)
    if not rel:
        return "不是可外交对象"
    d = _d(state)
    if rel["overlord"] == "xiongnu":
        return "已是匈奴属国"
    m = mult(state, sid)
    if rel["xn_intimidation"] < d["xn_vassal_min_intimidation"] * m:
        return "威吓不足（需 %d）" % int(d["xn_vassal_min_intimidation"] * m)
    if rel["xn_intimidation"] <= rel["han_influence"]:
        return "威吓须高于汉影响力"
    return ""


def gift(state, sid, units):
    rel = state.relations[sid]
    state.factions["han"]["money"] -= units * _d(state)["gift_unit_money"]
    rel["han_influence"] += gift_gain(state, rel, units)
    state.log_event("diplomacy", "汉赏赐%s，影响力 %d" % (sid, int(rel["han_influence"])), {"state": sid})


def enfeoff(state, sid):
    d = _d(state)
    rel = state.relations[sid]
    state.factions["han"]["money"] -= d["enfeoff_cost_money"]
    rel["han_influence"] -= d["enfeoff_cost_influence"]
    rel["han_status"] = "enfeoffed"
    buffs.apply(state, "han_enfeoffed", sid, {"amount": d["enfeoff_influence_month"]})
    state.log_event("diplomacy", "汉册封%s" % sid, {"state": sid})


def make_vassal(state, sid):
    d = _d(state)
    rel = state.relations[sid]
    rel["han_influence"] -= d["vassal_cost_influence"]
    rel["overlord"] = "han"
    rel["tax_level"] = 0
    state.log_event("diplomacy", "%s 成为汉属国" % sid, {"state": sid})


def demand_vassal(state, sid):
    rel = state.relations[sid]
    rel["overlord"] = "xiongnu"
    rel["han_status"] = "none"
    buffs.remove_all(state, "han_enfeoffed", sid)
    state.log_event("diplomacy", "%s 臣服匈奴" % sid, {"state": sid})


def buy_grain_price(state, sid):
    rel = state.relations[sid]
    if rel["overlord"] == "han":
        return state.bal["grain_price"]["vassal_money_per_100"]
    return state.bal["grain_price"]["enfeoffed_money_per_100"]


def diplomacy_monthly(state):
    d = _d(state)
    presence = {}
    for a in state.armies.values():
        if a["faction"] != "xiongnu" or a["is_convoy"] or "node" not in a["loc"]:
            continue
        here = a["loc"]["node"]
        seen = set()
        for nid in [here] + state.neighbors(here):
            sid = state.nodes[nid]["faction"]
            if sid not in state.relations or sid in seen:
                continue
            seen.add(sid)
            pop = state.state_pop(sid)
            if pop <= 0:
                continue
            presence[sid] = presence.get(sid, 0.0) + d["xn_presence_intimidation_per_10pct"] * (float(state.army_size(a)) / pop / 0.1)
    for sid, rel in state.relations.items():
        rel["xn_intimidation"] = max(0.0, rel["xn_intimidation"] - d["intimidation_decay_month"])
        rel["xn_resentment"] = max(0.0, rel["xn_resentment"] - d["resentment_decay_month"])
        if sid in presence:
            rel["xn_intimidation"] = min(100.0, rel["xn_intimidation"] + min(presence[sid], d["xn_presence_cap_month"]) + d["intimidation_decay_month"])
        if rel["overlord"] == "xiongnu" and rel["tax_level"] > 0:
            tr = d["tax_rates"][int(rel["tax_level"])]
            state.factions["xiongnu"]["money"] += int(state.state_pop(sid) * tr["money"])
            rel["xn_resentment"] = min(100.0, rel["xn_resentment"] + tr["res"])
        rel["han_influence"] = min(d["influence_max"], max(0.0, rel["han_influence"]))
        rel["xn_intimidation"] = min(100.0, max(0.0, rel["xn_intimidation"]))


# ======================= trade.gd =======================
def node_passable(state, nid):
    n = state.nodes[nid]
    f = n["faction"]
    if f == "xiongnu":
        return False
    rel = state.relations.get(f)
    if rel is not None and rel["overlord"] == "xiongnu" and rel["xn_intimidation"] >= state.bal["trade"]["ban_intimidation"]:
        return False
    return True


def open_prefix(state, tr):
    out = []
    nodes = tr["nodes"]
    for i, nid in enumerate(nodes):
        if i > 0:
            idx = state.route_between(nodes[i - 1], nid)
            if idx >= 0 and state.routes[idx]["raided_by"] == "xiongnu":
                break
        if not node_passable(state, nid):
            break
        out.append(nid)
    return out


def trade_monthly(state):
    t = state.bal["trade"]
    if any(r["raided_by"] == "xiongnu" for r in state.routes):
        state.stats["trade_blocked_months"] = state.stats.get("trade_blocked_months", 0) + 1
    credited = set()
    income = 0
    for tr in state.trade_routes:
        for nid in open_prefix(state, tr):
            sid = state.nodes[nid]["faction"]
            if sid in state.relations and (sid + tr["id"]) not in credited:
                credited.add(sid + tr["id"])
                state.relations[sid]["han_influence"] = min(100.0, state.relations[sid]["han_influence"] + t["influence_per_state_month"])
                state.factions["han"]["money"] += int(t["money_per_state_month"])
                income += int(t["money_per_state_month"])
    state.stats["trade_income"] = state.stats.get("trade_income", 0) + income
    for i, r in enumerate(state.routes):
        if r["raided_by"] != "":
            still = False
            for a in state.armies.values():
                st = a["plan"]["steps"][0] if a["plan"]["steps"] else None
                if st is not None and st["type"] == "ambush" and st.get("route", -1) == i:
                    still = True
                    break
            if not still:
                r["raided_by"] = ""


# ======================= citystate.gd =======================
def citystate_monthly(state):
    c = state.bal["citystate"]
    for sid, rel in state.relations.items():
        m = 1.5 if state.kind_of(sid) == "great" else 1.0
        ov = rel["overlord"]
        if ov == "xiongnu" and rel["xn_intimidation"] < c["rebel_xn_intimidation_below"] and rel["xn_resentment"] > c["rebel_xn_resentment_above"]:
            rel["overlord"] = ""
            state.log_event("defect", "%s 叛离匈奴" % sid, {"state": sid})
        elif ov == "han" and rel["xn_intimidation"] > rel["han_influence"] + c["defect_to_xn_margin"] * m:
            rel["overlord"] = "xiongnu"
            rel["han_status"] = "none"
            state.log_event("defect", "%s 倒向匈奴" % sid, {"state": sid})
        elif ov == "" and rel["han_influence"] >= rel["xn_intimidation"] + c["defect_to_han_margin"] * m and rel["han_status"] == "enfeoffed":
            rel["wants_han"] = True
        else:
            rel["wants_han"] = False
