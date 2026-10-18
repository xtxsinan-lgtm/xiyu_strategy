"""后勤 —— 移植自 core/supply.gd。按 days（子步长）调用。"""
import math


def carry_cap(state, a):
    f = state.bal["food"]
    return state.army_size(a) * f["soldier_carry"] + a["laborers"] * f["laborer_carry"]


def need_per_month(state, a, on_pasture_=False):
    f = state.bal["food"]
    horses_off = 0.0 if on_pasture_ else float(a["horses"])
    return state.army_size(a) * f["soldier_per_month"] + a["laborers"] * f["laborer_per_month"] + horses_off * f["horse_fodder_per_month_off_pasture"]


def t_max(state, a):
    need = need_per_month(state, a, a["faction"] == "xiongnu")
    if need <= 0:
        return 99.0
    stock = a["grain"]
    if a["faction"] == "xiongnu":
        stock += a["horses"] * state.bal["food"]["horse_slaughter_food"] * 0.5
    return stock / need


def on_pasture(state, a):
    if "node" in a["loc"]:
        n = state.nodes[a["loc"]["node"]]
        return n["pasture_cap"] > 0 and a["faction"] == "xiongnu"
    return state.routes[a["loc"]["route"]]["terrain"] == "steppe"


def _pasture_has_room(state, node):
    grazing = node["horses"]
    for army in state.armies_at(node["id"]):
        grazing += army["horses"]
    return grazing <= node["pasture_cap"]


def tick(state, a, days=10.0):
    if a["is_convoy"] and state.army_size(a) == 0 and a["laborers"] == 0:
        return
    f = state.bal["food"]
    third = days / 30.0
    pasture = on_pasture(state, a)
    need = need_per_month(state, a, pasture) * third
    fac = a["faction"]
    if a["is_convoy"] and "node" in a["loc"]:
        cn = state.nodes[a["loc"]["node"]]
        if state.is_supply_node(cn, fac) and state.stock(cn, fac) >= need:
            state.set_stock(cn, fac, state.stock(cn, fac) - need)
            a["starving"] = 0
            return
    if "node" in a["loc"] and not a["is_convoy"]:
        n = state.nodes[a["loc"]["node"]]
        if state.is_supply_node(n, fac):
            room = carry_cap(state, a) - a["grain"]
            if room > 0:
                src = state.stock(n, fac)
                if n["type"] == "source":
                    src = room
                elif fac == "xiongnu" and n["faction"] != "xiongnu":
                    src = float(n["grain"])
                pull = min(room, src)
                if pull > 0:
                    a["grain"] += pull
                    if n["type"] != "source":
                        if fac == "xiongnu" and n["faction"] != "xiongnu":
                            n["grain"] -= pull
                            r = state.relations.get(n["faction"])
                            if r is not None:
                                r["xn_resentment"] = min(100.0, r["xn_resentment"] + state.bal["diplomacy"]["levy_grain_resentment"] * third)
                        else:
                            state.set_stock(n, fac, state.stock(n, fac) - pull)
    if fac == "xiongnu" and "node" in a["loc"]:
        hn = state.nodes[a["loc"]["node"]]
        if hn["type"] == "nomad" and state.is_supply_node(hn, "xiongnu") and _pasture_has_room(state, hn):
            mounts = sum(n * int(state.units[t]["horses"]) for t, n in a["units"].items())
            if a["horses"] < mounts and state.season() in ("spring", "summer"):
                a["horses"] = min(mounts, a["horses"] + int(math.ceil(mounts * 0.03 * days / 10.0)))
            a["starving"] = 0
            return
    if fac == "xiongnu":
        milk = a["horses"] * f["milk_per_horse_month"][state.season()] * third
        need = max(0.0, need - milk)
    eat = min(need, a["grain"])
    a["grain"] -= eat
    need -= eat
    if need > 0.5 and fac == "xiongnu" and a["horses"] > 0:
        kill = min(int(a["horses"]), int(math.ceil(need / f["horse_slaughter_food"])))
        a["horses"] -= kill
        need -= kill * f["horse_slaughter_food"]
    if need > 0.5:
        a["starving"] += 1
        if a["starving"] == 1:
            state.log_event("starve", "%s 断粮（%d 人）" % (a["name"], state.army_size(a) + a["laborers"]), {"army": a["id"]})
        before = state.army_size(a) + a["laborers"]
        _attrition(state, a, state.bal["attrition"]["no_food_month"] * third, days < 10.0)
        state.stats["starve_losses"] = state.stats.get("starve_losses", 0) + before - state.army_size(a) - a["laborers"]
    else:
        a["starving"] = 0
    if "route" in a["loc"]:
        terr = state.routes[a["loc"]["route"]]["terrain"]
        rate = state.bal["attrition"].get(terr + "_month", 0.0)
        if rate > 0:
            before2 = state.army_size(a) + a["laborers"]
            _attrition(state, a, rate * third, days < 10.0)
            state.stats["terrain_losses"] = state.stats.get("terrain_losses", 0) + before2 - state.army_size(a) - a["laborers"]


def _loss(a, key, amount, fractional):
    if not fractional:
        return int(math.ceil(amount))
    rem = a.setdefault("attrition_remainder", {})
    tot = amount + float(rem.get(key, 0.0))
    lost = int(math.floor(tot))
    rem[key] = tot - lost
    return lost


def _attrition(state, a, frac, fractional=False):
    for t in list(a["units"].keys()):
        lost = _loss(a, t, a["units"][t] * frac, fractional)
        a["units"][t] = max(0, a["units"][t] - lost)
        a["horses"] = max(0, a["horses"] - lost * int(state.units[t]["horses"]))
        count_casualty(state, a["faction"], lost)
    a["laborers"] = max(0, a["laborers"] - _loss(a, "laborers", a["laborers"] * frac, fractional))


def count_casualty(state, faction, n):
    if faction == "han":
        state.stats["han_casualties"] += n
    elif faction == "xiongnu":
        state.stats["xn_casualties"] += n
