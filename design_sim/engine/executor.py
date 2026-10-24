"""常备指令执行 —— 移植自 core/plan_executor.gd（移动/步骤推进/运输循环/触发器）。"""
import math

from . import combat, siege, supply
from .state import route_speed, travel_days


def current_step(a):
    s = a["plan"]["steps"]
    return s[0] if s else None


def advance(a):
    if a["plan"]["steps"]:
        a["plan"]["steps"].pop(0)
    a["plan"]["step_ticks"] = 0
    a["path"] = []


def _pos_a(route, from_id, prog):
    return prog if route["a"] == from_id else 1.0 - prog


def _has_hostile_at(state, nid, f):
    for e in state.armies_at(nid):
        if state.is_hostile(e["faction"], f) and state.army_size(e) > 0:
            return True
    return False


def move_all(state, days):
    for aid in list(state.armies.keys()):
        a = state.armies.get(aid)
        if a is None:
            continue
        a["trace"] = []
        _advance_plan(state, a, days)


def _here(a):
    return a["loc"].get("node", "")


def _advance_plan(state, a, days_left):
    guard = 0
    while days_left > 0.001 and guard < 24:
        guard += 1
        step = current_step(a)
        if step is None:
            a["status"] = "idle"
            if a["is_convoy"]:
                _disband_convoy(state, a)
            return
        here = _here(a)
        t = step["type"]
        if t in ("move_to", "return_to"):
            if here == step["node"]:
                advance(a)
                continue
            days_left = _travel(state, a, step["node"], days_left)
            if a["loc"].get("node") == step["node"]:
                advance(a)
                continue
            return
        elif t == "hold":
            tn = step.get("node", here)
            if tn != "" and here != tn:
                days_left = _travel(state, a, tn, days_left)
                if a["loc"].get("node") == tn:
                    continue
                return
            a["status"] = "holding"
            if step.get("until", "") != "end" and step.get("months", 0) > 0:
                step["days"] = step.get("days", 0.0) + days_left
                if step["days"] >= step["months"] * 30.0:
                    advance(a)
            return
        elif t in ("siege", "burn", "ambush", "deliver", "loop_convoy"):
            if t == "loop_convoy":
                _loop_convoy(state, a, step, days_left)
                return
            tgt = step.get("node", step.get("to", here))
            if here != tgt:
                days_left = _travel(state, a, tgt, days_left)
                if a["loc"].get("node") != tgt:
                    return
                continue
            if t == "siege":
                a["status"] = "sieging"
                return
            if t == "burn":
                siege.burn(state, a, state.nodes[tgt])
                advance(a)
                continue
            if t == "ambush":
                a["status"] = "ambushing"
                step["days"] = step.get("days", 0.0) + days_left
                if step["days"] >= step.get("months", 1) * 30.0:
                    advance(a)
                return
            if t == "deliver":
                _unload(state, a, state.nodes[tgt])
                advance(a)
                continue
        else:
            advance(a)


def _travel(state, a, target, days_left):
    speed = combat.army_speed(state, a)
    guard = 0
    while days_left > 0.001 and guard < 16:
        guard += 1
        loc = a["loc"]
        if "node" in loc:
            if loc["node"] == target:
                return days_left
            if not a["path"] or a["path"][-1] != target:
                a["path"] = state.path_to(loc["node"], target, speed)
                if not a["path"]:
                    a["status"] = "blocked"
                    return 0.0
            nxt = a["path"][0]
            idx = state.route_between(loc["node"], nxt)
            if state.route_closed(idx):
                a["status"] = "blocked"
                a["path"] = []
                return 0.0
            a["loc"] = {"route": idx, "from": loc["node"], "to": nxt, "prog": 0.0}
        else:
            if not a["path"] or a["path"][-1] != target:
                r = state.routes[loc["route"]]
                cost_to = (1.0 - loc["prog"]) * travel_days(r, speed) + state.days_to(loc["to"], target, speed)
                cost_from = loc["prog"] * travel_days(r, speed) + state.days_to(loc["from"], target, speed)
                if cost_from < cost_to:
                    loc["from"], loc["to"] = loc["to"], loc["from"]
                    loc["prog"] = 1.0 - loc["prog"]
                rest = state.path_to(loc["to"], target, speed, True)
                a["path"] = [loc["to"]] + rest
        loc2 = a["loc"]
        r2 = state.routes[loc2["route"]]
        a["status"] = "moving"
        rs = route_speed(r2, speed)
        dneed = (1.0 - loc2["prog"]) * travel_days(r2, speed)
        p0 = _pos_a(r2, loc2["from"], loc2["prog"])
        if days_left + 1e-9 >= dneed:
            days_left = max(0.0, days_left - dneed)
            a["trace"].append({"route": loc2["route"], "p0": p0, "p1": _pos_a(r2, loc2["from"], 1.0)})
            a["prev_node"] = loc2["from"]
            arrive = loc2["to"]
            a["loc"] = {"node": arrive}
            if a["path"]:
                a["path"].pop(0)
            if _has_hostile_at(state, arrive, a["faction"]):
                return 0.0
            if arrive == target:
                return days_left
        else:
            loc2["prog"] += days_left * rs / r2["days"]
            a["trace"].append({"route": loc2["route"], "p0": p0, "p1": _pos_a(r2, loc2["from"], loc2["prog"])})
            return 0.0
    return days_left


def return_ration(state, a, node):
    if not a["is_convoy"]:
        return 0.0
    home = ""
    for st in a["plan"]["steps"]:
        if st["type"] == "loop_convoy":
            home = st["from"]
            break
        if st["type"] == "return_to":
            home = st["node"]
            break
    if home == "" or home == node["id"]:
        return 0.0
    days = state.days_to(node["id"], home, combat.army_speed(state, a), True)
    return supply.need_per_month(state, a) * (math.ceil(days) + 1.0) / 30.0


def _unload(state, a, node):
    if a["grain"] > 0:
        f = a["faction"]
        if state.controller(node) == f or node["type"] == "source":
            ration = min(a["grain"], return_ration(state, a, node))
            state.set_stock(node, f, state.stock(node, f) + a["grain"] - ration)
            state.stats["grain_delivered_" + f] = state.stats.get("grain_delivered_" + f, 0.0) + a["grain"] - ration
            a["grain"] = ration


def _loop_convoy(state, a, step, days_left):
    f = a["faction"]
    phase = step.get("phase", "load")
    here = _here(a)
    if phase == "load":
        if here != step["from"]:
            days_left = _travel(state, a, step["from"], days_left)
            return days_left if a["loc"].get("node") == step["from"] else 0.0
        node = state.nodes[step["from"]]
        cap = supply.carry_cap(state, a) - a["grain"]
        want = min(cap, float(step.get("grain_per_trip", cap)))
        have = state.stock(node, f) if node["type"] != "source" else want
        take = min(want, have)
        if take > 0:
            a["grain"] += take
            if node["type"] != "source":
                state.set_stock(node, f, state.stock(node, f) - take)
            step["phase"] = "go"
        return 0.0
    if phase == "go":
        if here != step["to"]:
            days_left = _travel(state, a, step["to"], days_left)
            if a["loc"].get("node") != step["to"]:
                return 0.0
        _unload(state, a, state.nodes[step["to"]])
        step["phase"] = "back"
        return days_left
    if here != step["from"]:
        days_left = _travel(state, a, step["from"], days_left)
        if a["loc"].get("node") != step["from"]:
            return 0.0
    step["phase"] = "load"
    return days_left


def _disband_convoy(state, a):
    if "node" not in a["loc"] or a["id"] not in state.armies:
        return
    n = state.nodes[a["loc"]["node"]]
    if state.controller(n) == a["faction"] and state.army_size(a) == 0:
        if a["grain"] > 0:
            _unload(state, a, n)
        src = state.nodes.get(a.get("convoy_home", n["id"]), n)
        src["levied_out"] = max(0, src["levied_out"] - a["laborers"])
        state.remove_army(a["id"])


# ---------- 触发器 ----------
def check_triggers(state):
    enemies = {"han": [], "xiongnu": []}
    for e in state.armies.values():
        if not e["is_convoy"] and state.army_size(e) > 0 and e["faction"] in enemies:
            nid = e["loc"]["node"] if "node" in e["loc"] else e["loc"]["to"]
            enemies[e["faction"]].append((nid, combat.strength(state, e)))
    for aid in list(state.armies.keys()):
        a = state.armies.get(aid)
        if a is None or not a["plan"]["triggers"]:
            continue
        for trg in a["plan"]["triggers"]:
            if _trigger_hit(state, a, trg, enemies):
                _react(state, a, trg)
                break


def _at_supply(state, a):
    return "node" in a["loc"] and state.is_supply_node(state.nodes[a["loc"]["node"]], a["faction"])


def _trigger_hit(state, a, trg, enemies):
    c = trg["cond"]
    if c == "supply_low":
        return (not a["is_convoy"]) and not _at_supply(state, a) and supply.t_max(state, a) <= trg["months"]
    if c == "losses_high":
        return a["init_size"] > 0 and not a["is_convoy"] and 1.0 - float(state.army_size(a)) / a["init_size"] >= trg["pct"]
    if c == "enemy_near":
        here = a["loc"]["node"] if "node" in a["loc"] else a["loc"]["to"]
        if trg.get("react") in ("retreat_origin", "evade_home") and here == a.get("origin", ""):
            return False
        my = sum(
            combat.strength(state, x)
            for x in state.armies.values()
            if x["faction"] == a["faction"]
            and not x["is_convoy"]
            and (x["loc"].get("node") if "node" in x["loc"] else x["loc"].get("to")) == here
        )
        if my <= 0:
            return False
        other = "xiongnu" if a["faction"] == "han" else "han"
        h = int(trg["hops"])
        st_cur = current_step(a)
        is_rally_move = (
            st_cur is not None
            and st_cur["type"] == "move_to"
            and st_cur.get("node") in state.nodes
            and state.controller(state.nodes[st_cur["node"]]) == a["faction"]
        )
        path_nodes = set(a.get("path", [])[: max(1, h)])
        path_nodes.add(here)
        for nid, st in enemies[other]:
            if is_rally_move and nid not in path_nodes:
                continue
            if st / my >= trg["ratio"] and state.hops(here, nid, h) <= h:
                return True
        return False
    if c == "target_lost":
        st = current_step(a)
        return st is not None and st["type"] in ("siege", "burn") and state.controller(state.nodes[st["node"]]) == a["faction"]
    return False


def _react(state, a, trg):
    react = trg["react"]
    dest = ""
    if react in ("retreat_origin", "evade_home"):
        dest = a["origin"]
    elif react == "return_supply":
        dest = _nearest_supply(state, a)
    elif react == "skip_step":
        advance(a)
        return
    if dest == "":
        dest = a["origin"]
    a["plan"] = {"steps": [{"type": "move_to", "node": dest}, {"type": "hold", "node": dest, "until": "end"}],
                 "triggers": [], "engage": a["plan"]["engage"], "preset": "retreat", "step_ticks": 0, "reacted": True}
    a["path"] = []
    state.stats["triggers_" + trg["cond"]] = state.stats.get("triggers_" + trg["cond"], 0) + 1
    state.log_event("trigger", "%s 触发【%s】→ 撤向 %s" % (a["name"], trg["cond"], dest), {"army": a["id"]})


def _nearest_supply(state, a):
    start = a["loc"]["node"] if "node" in a["loc"] else a["loc"]["to"]
    dist, _ = state.dijkstra(start, combat.army_speed(state, a), True)
    best = ""
    bd = float("inf")
    for nid, d in dist.items():
        n = state.nodes[nid]
        if state.is_supply_node(n, a["faction"]) and d < bd:
            if state.stock(n, a["faction"]) > 0 or n["type"] == "source" or a["faction"] == "xiongnu":
                bd = d
                best = nid
    return best
