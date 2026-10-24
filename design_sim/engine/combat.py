"""野战 —— 移植自 core/combat.gd。

保留全部关键非线性：3 回合远程/近战/侧翼、25% 崩溃线、城墙防御乘数、断粮 0.7、伏击远程 ×1.5、
避战（速度 ≥1.3 倍）、追击与俘马、运输队被劫、汉胜利对周边城邦的影响力辐射。
随机仅为每回合 ±noise 的伤害抖动（与 Godot 相同的分布，但 RNG 不同，无法逐局复现）。
"""
from . import supply


def total(u):
    return float(sum(u.values()))


def strength(state, a):
    U = state.units
    return sum(n * (U[t]["melee"] + U[t]["ranged"]) for t, n in a["units"].items())


def strength_units(state, u):
    U = state.units
    return sum(n * (U[t]["melee"] + U[t]["ranged"]) for t, n in u.items())


def army_speed(state, a):
    if a["is_convoy"]:
        return float(state.bal.get("movement", {}).get("convoy_speed_mult", 1.0))
    sp = 99.0
    anyu = False
    for t, n in a["units"].items():
        if n > 0:
            sp = min(sp, state.units[t]["speed"])
            anyu = True
    if not anyu:
        return 1.0
    if a["laborers"] > 0:
        sp = min(sp, 1.0)
    v1 = getattr(state, "ext", {}).get("v1")
    if v1:
        cid = a.get("commander", "")
        ch = v1.get("characters", {}).get(cid)
        if ch and "cavalry_leader" in ch.get("traits", ()):
            sp *= 1.12
        if a["faction"] == "han" and v1.get("diplomacy", {}).get("dayuan_horse_bonus") and a["units"].get("cavalry", 0) > 0:
            sp *= 1.08
    return sp


def merged_units(armies):
    u = {}
    for a in armies:
        for t, n in a["units"].items():
            u[t] = u.get(t, 0.0) + n
    return u


def starving_mult(state, armies):
    tot = 0.0
    starv = 0.0
    for a in armies:
        s = state.army_size(a)
        tot += s
        if a["starving"] > 0:
            starv += s
    if tot > 0 and starv / tot > 0.5:
        return state.bal["combat"]["starving_combat_mult"]
    return 1.0


def _rows(state, u):
    rows = {"front": {}, "mobile": {}, "back": {}}
    for t, n in u.items():
        if n > 0.01:
            rows[state.units[t]["row"]][t] = n
    return rows


def _target_row(rows):
    for r in ("front", "mobile", "back"):
        if rows[r]:
            return r
    return ""


def _avg_def(state, row, key):
    n = 0.0
    s = 0.0
    for t, c in row.items():
        n += c
        s += c * state.units[t][key]
    return s / n if n > 0 else 1.0


def _damage(state, att, dfn, mult, defmult, ambush, noise, rng):
    c = state.bal["combat"]
    U = state.units
    drows = _rows(state, dfn)
    arows = _rows(state, att)
    cas = {}
    trow = _target_row(drows)
    if trow == "":
        return cas
    jitter = 1.0 + (rng.uniform(-noise, noise) if noise > 0 else 0.0)
    raw = {}
    ranged = 0.0
    for r in arows.values():
        for t, n in r.items():
            d = U[t]
            if d["ranged"] > 0:
                v = n * d["ranged"]
                if trow == "mobile" and "anti_mobile" in d["tags"]:
                    v *= c["anti_mobile_bonus"]
                ranged += v
    if ambush:
        ranged *= c["ambush_ranged_mult"]
    raw[trow] = raw.get(trow, 0.0) + ranged * mult * c["k_ranged"] / _avg_def(state, drows[trow], "rdef") / defmult * jitter
    melee = 0.0
    for r in ("front", "mobile"):
        for t, n in arows[r].items():
            melee += n * U[t]["melee"]
    raw[trow] += melee * mult * c["k_melee"] / _avg_def(state, drows[trow], "mdef") / defmult * jitter
    mob_a = sum(arows["mobile"].values())
    mob_d = sum(drows["mobile"].values())
    if mob_a > 0 and mob_a >= c["flank_ratio"] * mob_d and drows["back"]:
        excess = mob_a - mob_d
        avg_melee = sum(n * U[t]["melee"] for t, n in arows["mobile"].items()) / mob_a
        raw["back"] = raw.get("back", 0.0) + excess * avg_melee * mult * c["k_melee"] / _avg_def(state, drows["back"], "mdef") / defmult * jitter
    for r, amt0 in raw.items():
        rowtot = sum(drows[r].values())
        if rowtot <= 0:
            continue
        amt = min(amt0, rowtot)
        for t, n in drows[r].items():
            cas[t] = cas.get(t, 0.0) + amt * n / rowtot
    return cas


def fight(state, ua, ub, ctx=None):
    ctx = ctx or {}
    c = state.bal["combat"]
    noise = ctx.get("noise", c["noise"])
    rng = state.rng
    A = dict(ua)
    B = dict(ub)
    init_a = total(A)
    init_b = total(B)
    loss_a = {}
    loss_b = {}
    winner = ""
    for rnd in range(int(c["rounds"])):
        db = _damage(state, A, B, ctx.get("a_mult", 1.0), ctx.get("b_def", 1.0), ctx.get("a_ambush", False) and rnd == 0, noise, rng)
        da = _damage(state, B, A, ctx.get("b_mult", 1.0), ctx.get("a_def", 1.0), ctx.get("b_ambush", False) and rnd == 0, noise, rng)
        for t, v in db.items():
            B[t] = max(0.0, B[t] - v)
            loss_b[t] = loss_b.get(t, 0.0) + v
        for t, v in da.items():
            A[t] = max(0.0, A[t] - v)
            loss_a[t] = loss_a.get(t, 0.0) + v
        fa = total(loss_a) / max(init_a, 1.0)
        fb = total(loss_b) / max(init_b, 1.0)
        ba = fa >= c["break_loss_ratio"] or total(A) < 1.0
        bb = fb >= c["break_loss_ratio"] or total(B) < 1.0
        if ba or bb:
            if ba and bb:
                winner = "a" if fa < fb else "b"
            else:
                winner = "b" if ba else "a"
            break
    if winner == "":
        fa2 = total(loss_a) / max(init_a, 1.0)
        fb2 = total(loss_b) / max(init_b, 1.0)
        if abs(fa2 - fb2) > 0.005:
            winner = "a" if fa2 < fb2 else "b"
    return {"loss_a": loss_a, "loss_b": loss_b, "winner": winner, "init_a": init_a, "init_b": init_b}


def expected_p(state, ua, ub, ctx=None):
    if total(ua) <= 0:
        return 0.0
    if total(ub) <= 0:
        return 1.0
    c2 = dict(ctx or {})
    c2["noise"] = 0.0
    r = fight(state, ua, ub, c2)
    fa = total(r["loss_a"]) / max(r["init_a"], 1.0)
    fb = total(r["loss_b"]) / max(r["init_b"], 1.0)
    return min(1.0, max(0.0, 0.5 + 2.0 * (fb - fa)))


def _apply_losses(state, armies, loss):
    dead_total = 0
    tot = merged_units(armies)
    for t, lv in loss.items():
        lost_t = int(round(lv))
        if lost_t <= 0:
            continue
        remaining = lost_t
        avail = tot.get(t, 0.0)
        for a in armies:
            if remaining <= 0:
                break
            have = int(a["units"].get(t, 0))
            if have <= 0:
                continue
            share = int(round(lost_t * have / max(avail, 1.0)))
            share = max(0, min(share, have, remaining))
            a["units"][t] = have - share
            a["horses"] = max(0, a["horses"] - share * int(state.units[t]["horses"]))
            remaining -= share
            dead_total += share
        if remaining > 0:
            for a in armies:
                have2 = int(a["units"].get(t, 0))
                if have2 > 0:
                    take = min(have2, remaining)
                    a["units"][t] = have2 - take
                    a["horses"] = max(0, a["horses"] - take * int(state.units[t]["horses"]))
                    dead_total += take
                    break
    return dead_total


def _v1_side_mult(state, armies, opts, is_side_a):
    v1 = state.ext.get("v1")
    if not v1:
        return 1.0
    fac = armies[0]["faction"] if armies else ("" if is_side_a else opts.get("b_faction", ""))
    mult = 1.0
    chars = v1["events"]["characters"]
    best_tier = 5
    for a in armies:
        cid = a.get("commander", "")
        if cid in chars:
            best_tier = max(best_tier, int(chars[cid].get("command_tier", 6)))
    coef = float(v1["cfg"]["s06"].get("command_tier_combat_coef", 0.03))
    mult *= 1.0 + coef * (best_tier - 3)
    if fac == "han":
        if v1["court"].get("forged_bonus_ticks", 0) > 0:
            mult *= 1.16
        if v1["events"].get("dawan_horses_obtained") and any(a["units"].get("cavalry", 0) > 0 for a in armies):
            mult *= 1.10
        node = opts.get("node")
        if node and node.get("id") in v1["logistics"]["beacons"] and not is_side_a:
            if v1["tribes"].get("active_tactical_card") != "raze_beacons":
                mult *= 1.08
    elif fac == "xiongnu":
        card = v1["tribes"].get("active_tactical_card", "")
        node = opts.get("node")
        if card in ("feigned_retreat", "night_raid"):
            has_beacon = node and node.get("id") in v1["logistics"]["beacons"]
            mult *= 1.04 if has_beacon else 1.14
        elif card == "clear_steppe" and not is_side_a:
            mult *= 1.12
        elif card == "raze_beacons" and node and node.get("id") in v1["logistics"]["beacons"]:
            mult *= 1.08
        if node and v1["tribes"].get("assembly_ticks", 0) > 0 and node.get("id") == v1["tribes"].get("assembly_target"):
            mult *= 1.12
    return mult


def _ctx_for(state, side_a, side_b, opts):
    ctx = {"a_mult": starving_mult(state, side_a), "b_mult": starving_mult(state, side_b), "a_def": 1.0, "b_def": 1.0}
    if "v1" in state.ext:
        ctx["a_mult"] *= _v1_side_mult(state, side_a, opts, True)
        ctx["b_mult"] *= _v1_side_mult(state, side_b, opts, False)
    if opts.get("defender", "") != "" and opts.get("wall_mult", 1.0) > 1.0:
        if opts["defender"] == "a":
            ctx["a_def"] = opts["wall_mult"]
        else:
            ctx["b_def"] = opts["wall_mult"]
    if opts.get("ambush", "") == "a":
        ctx["a_ambush"] = True
    elif opts.get("ambush", "") == "b":
        ctx["b_ambush"] = True
    return ctx


def wall_mult(state, node):
    if node["walls"] <= 0:
        return 1.0
    ratio = node["wall_hp"] / max(node["wall_hp_max"], 1.0)
    w = 1.0 + state.bal["combat"]["wall_def_per_level"] * node["walls"] * ratio
    v1 = state.ext.get("v1")
    if v1 and node["faction"] == "han" and node["id"] in v1["logistics"]["beacons"]:
        w *= float(v1["cfg"]["s05"].get("beacon_wall_mult", 1.15))
    return w


def resolve_battle(state, side_a, side_b, where, opts=None):
    opts = opts or {}
    ua = merged_units(side_a)
    ub = merged_units(side_b)
    militia = opts.get("militia", {})
    for t, n in militia.items():
        ub[t] = ub.get(t, 0.0) + n
    ctx = _ctx_for(state, side_a, side_b, opts)
    fa_name = side_a[0]["faction"] if side_a else ""
    fb_name = side_b[0]["faction"] if side_b else opts.get("b_faction", "")
    report = {"where": where, "a": fa_name, "b": fb_name, "winner": "", "loss_a": 0, "loss_b": 0, "horses_captured": 0}
    ta = total(ua)
    tb = total(ub)
    if ta <= 0.0 and tb <= 0.0:
        return report
    if ta <= 0.0:
        res = {"loss_a": {}, "loss_b": {}, "winner": "b"}
    elif tb <= 0.0:
        res = {"loss_a": {}, "loss_b": {}, "winner": "a"}
    else:
        res = fight(state, ua, ub, ctx)
    dead_a = _apply_losses(state, side_a, res["loss_a"])
    dead_b = 0
    if militia:
        lb = dict(res["loss_b"])
        node = opts["node"]
        for t in list(militia.keys()):
            share = lb.get(t, 0.0) * militia[t] / max(ub.get(t, 1.0), 1.0)
            lost = min(int(militia[t]), int(round(share)))
            node["militia"][t] = max(0, int(node["militia"][t]) - lost)
            dead_b += lost
            lb[t] = lb.get(t, 0.0) - share
        dead_b += _apply_losses(state, side_b, lb)
    else:
        dead_b = _apply_losses(state, side_b, res["loss_b"])
    ws = res["winner"]
    win_armies = side_a if ws == "a" else side_b
    lose_armies = side_b if ws == "a" else side_a
    if ws != "":
        mob_w = 0.0
        for a in win_armies:
            for t, n in a["units"].items():
                if state.units[t]["row"] == "mobile":
                    mob_w += n
        pursuit = mob_w * state.bal["combat"]["pursuit_k"]
        lose_size = sum(state.army_size(a) for a in lose_armies)
        pursuit = min(pursuit, lose_size * 0.3)
        if pursuit > 0:
            tl = merged_units(lose_armies)
            tt = total(tl)
            fl = {t: pursuit * n / max(tt, 1.0) for t, n in tl.items()}
            extra = _apply_losses(state, lose_armies, fl)
            if ws == "a":
                dead_b += extra
            else:
                dead_a += extra
        captured = 0
        for a in lose_armies:
            take = int(a["horses"] * state.bal["combat"]["horse_capture_ratio"])
            a["horses"] -= take
            captured += take
        if captured > 0 and win_armies:
            win_armies[0]["horses"] += captured
            state.stats["horses_captured"] += captured
        report["horses_captured"] = captured
    report["winner"] = fa_name if ws == "a" else (fb_name if ws == "b" else "")
    report["loss_a"] = dead_a
    report["loss_b"] = dead_b
    supply.count_casualty(state, fa_name, dead_a)
    supply.count_casualty(state, fb_name, dead_b)
    state.stats["battles"] += 1
    for a in lose_armies:
        if a["is_convoy"] or state.army_size(a) == 0:
            _plunder_convoy(state, a, win_armies)
    if ws != "":
        for a in lose_armies:
            if a["id"] in state.armies:
                retreat_army(state, a, opts.get("attacker_fallback", ""))
    for a in side_a + side_b:
        if a["id"] in state.armies and state.army_size(a) == 0 and a["laborers"] == 0:
            state.remove_army(a["id"])
    state.log_event("battle", "%s 战于%s：%s 损 %d，%s 损 %d，%s 胜" % (
        fa_name, where, fa_name, dead_a, fb_name or "守军", dead_b, report["winner"] or "无"), {"report": report})
    if ws != "" and report["winner"] == "han" and fb_name == "xiongnu":
        _han_victory_effect(state, where)
    return report


def _plunder_convoy(state, convoy, winners):
    if not winners or convoy["id"] not in state.armies:
        return
    winners[0]["grain"] += convoy["grain"] * state.bal["combat"]["convoy_capture_ratio"]
    state.log_event("convoy", "运输队被劫，失粮 %d" % int(convoy["grain"]))
    state.stats["convoys_lost"] = state.stats.get("convoys_lost", 0) + 1
    convoy["units"] = {}
    convoy["laborers"] = 0
    convoy["grain"] = 0.0
    state.remove_army(convoy["id"])


def _han_victory_effect(state, where):
    if where not in state.nodes:
        return
    d = state.bal["diplomacy"]
    h = int(d["victory_near_hops"])
    for sid, rel in state.relations.items():
        for n in state.nodes_of_state(sid):
            if state.hops(where, n["id"], h) <= h:
                rel["han_influence"] = min(d["influence_max"], rel["han_influence"] + d["victory_influence"])
                rel["xn_intimidation"] = max(0.0, rel["xn_intimidation"] - d["victory_intimidation_loss"])
                break


def retreat_army(state, a, fallback=""):
    dest = ""
    f = a["faction"]
    enemy_nodes = set()
    for e in state.armies.values():
        if state.is_hostile(e["faction"], f) and "node" in e["loc"] and not e["is_convoy"]:
            enemy_nodes.add(e["loc"]["node"])
    if "route" in a["loc"]:
        dest = a["loc"]["from"]
        if dest in enemy_nodes:
            dest = a["loc"]["to"]
    else:
        here = a["loc"]["node"]
        cands = []
        if fallback and fallback != here:
            cands.append(fallback)
        if a["prev_node"] != here:
            cands.append(a["prev_node"])
        cands.extend(state.neighbors(here))
        for cnd in cands:
            if cnd in enemy_nodes or cnd not in state.nodes:
                continue
            idx = state.route_between(here, cnd)
            if idx < 0 or state.route_closed(idx):
                continue
            ctl = state.controller(state.nodes[cnd])
            if ctl == f or ctl == "":
                dest = cnd
                break
    if dest == "":
        sz = state.army_size(a)
        state.log_event("rout", "%s 溃散" % a["name"])
        supply.count_casualty(state, f, sz)
        state.remove_army(a["id"])
        return
    a["plan"] = {"steps": [{"type": "move_to", "node": dest}, {"type": "hold", "node": dest, "months": 1}],
                 "triggers": [], "engage": a["plan"]["engage"], "preset": "retreat", "step_ticks": 0, "reacted": True}
    a["path"] = []
    a["status"] = "retreating"
    if "node" in a["loc"]:
        here2 = a["loc"]["node"]
        ridx = state.route_between(here2, dest)
        a["loc"] = {"route": ridx, "from": here2, "to": dest, "prog": 0.05}
        a["path"] = [dest]


def _want_fight(state, mine, theirs, opts):
    rule = "always"
    p = 0.0
    for a in mine:
        e = a["plan"]["engage"]
        if e[0] == "never":
            rule = "never"
        elif e[0] == "if_favorable" and rule != "never":
            rule = "if_favorable"
            p = max(p, float(e[1]))
    if rule == "always":
        return True
    if rule == "never":
        return False
    ctx = _ctx_for(state, mine, theirs, opts)
    return expected_p(state, merged_units(mine), merged_units(theirs), ctx) >= p


def _fastest(state, armies):
    return max((army_speed(state, a) for a in armies), default=0.0)


def _slowest(state, armies):
    return min((army_speed(state, a) for a in armies), default=99.0)


def _swap(opts):
    o = dict(opts)
    if o.get("defender") == "a":
        o["defender"] = "b"
    elif o.get("defender") == "b":
        o["defender"] = "a"
    if o.get("ambush") == "a":
        o["ambush"] = "b"
    elif o.get("ambush") == "b":
        o["ambush"] = "a"
    return o


def _fight_or_evade(state, side_a, side_b, where, opts):
    a_has = any(not x["is_convoy"] and state.army_size(x) > 0 for x in side_a)
    b_has = any(not x["is_convoy"] and state.army_size(x) > 0 for x in side_b)
    margin = state.bal["combat"]["evade_speed_margin"]
    a_wants = (not a_has) or _want_fight(state, side_a, side_b, opts)
    b_wants = (not b_has) or _want_fight(state, side_b, side_a, _swap(opts))
    if not a_wants and _slowest(state, side_a) >= margin * _fastest(state, side_b):
        state.log_event("evade", "%s 避战于%s" % (side_a[0]["name"], where))
        for x in side_a:
            retreat_army(state, x)
        return
    if not b_wants and _slowest(state, side_b) >= margin * _fastest(state, side_a):
        state.log_event("evade", "%s 避战于%s" % (side_b[0]["name"], where))
        for x in side_b:
            retreat_army(state, x)
        return
    resolve_battle(state, side_a, side_b, where, opts)


def encounters(state):
    for route in state.routes:
        route["raided_by"] = ""
    ambushers = []
    for army in state.armies.values():
        steps = army["plan"]["steps"]
        if not steps or steps[0]["type"] != "ambush" or "node" not in army["loc"]:
            continue
        ambushers.append(army)
        rid = steps[0].get("route", -1)
        if 0 <= rid < len(state.routes):
            route = state.routes[rid]
            if army["loc"]["node"] in (route["a"], route["b"]):
                route["raided_by"] = army["faction"]
    # 1) 同节点
    by_node = {}
    for a in state.armies.values():
        nid = a["loc"].get("node")
        if nid is not None and a["faction"] in ("han", "xiongnu"):
            by_node.setdefault(nid, {"han": [], "xiongnu": []})[a["faction"]].append(a)
    for nid, g in by_node.items():
        if not g["han"] or not g["xiongnu"]:
            continue
        h = [x for x in g["han"] if x["id"] in state.armies]
        x_ = [x for x in g["xiongnu"] if x["id"] in state.armies]
        if not h or not x_:
            continue
        node = state.nodes[nid]
        ctl = state.controller(node)
        opts = {"node": node}
        h_mobile = any(z["trace"] for z in h)
        x_mobile = any(z["trace"] for z in x_)
        dfn = ""
        if ctl == "han":
            dfn = "a"
        elif ctl == "xiongnu":
            dfn = "b"
        elif not h_mobile and x_mobile:
            dfn = "a"
        elif not x_mobile and h_mobile:
            dfn = "b"
        if dfn:
            opts["defender"] = dfn
            opts["wall_mult"] = wall_mult(state, node)
        _fight_or_evade(state, h, x_, nid, opts)
    # 2) 路段上相向/追赶
    seg = {}
    for a in state.armies.values():
        for tr in a["trace"]:
            seg.setdefault(tr["route"], []).append((a, tr["p0"], tr["p1"]))
    for ridx, lst in seg.items():
        if len(lst) < 2:
            continue
        for i in range(len(lst)):
            for j in range(i + 1, len(lst)):
                ua, u0, u1 = lst[i]
                va, v0, v1 = lst[j]
                if ua["id"] not in state.armies or va["id"] not in state.armies:
                    continue
                if not state.is_hostile(ua["faction"], va["faction"]):
                    continue
                if (u0 - v0) * (u1 - v1) > 0.0:
                    continue
                side_a = [ua] if ua["faction"] == "han" else [va]
                side_b = [va] if ua["faction"] == "han" else [ua]
                r = state.routes[ridx]
                _fight_or_evade(state, side_a, side_b, "道路(%s—%s)" % (r["a"], r["b"]), {})
    # 3) 设伏
    for amb in ambushers:
        if amb["id"] not in state.armies:
            continue
        steps = amb["plan"]["steps"]
        if not steps or steps[0]["type"] != "ambush" or "node" not in amb["loc"]:
            continue
        r2 = steps[0].get("route", -1)
        if r2 < 0 or r2 not in seg:
            continue
        state.routes[r2]["raided_by"] = amb["faction"]
        for ea, _, _ in seg[r2]:
            if ea["id"] in state.armies and amb["id"] in state.armies and state.is_hostile(ea["faction"], amb["faction"]):
                sa = [amb] if amb["faction"] == "han" else [ea]
                sb = [ea] if amb["faction"] == "han" else [amb]
                resolve_battle(state, sa, sb, "伏击", {"ambush": "a" if amb["faction"] == "han" else "b"})
