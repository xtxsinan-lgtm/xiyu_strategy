"""围城、强攻、攻陷后果、焚田 —— 移植自 core/siege.gd。"""
from . import buffs, combat, supply


def siege_damage_per_tick(state, armies):
    dmg = 0.0
    v1 = getattr(state, "ext", {}).get("v1")
    chars = v1.get("characters", {}) if v1 else {}
    for a in armies:
        mult = 1.25 if a.get("is_convict") else 1.0
        cid = a.get("commander", "")
        if cid and cid in chars:
            traits = chars[cid].get("traits", ())
            if "siege_master" in traits or "stern" in traits:
                mult *= 1.20
        for t, n in a["units"].items():
            dmg += n * state.units[t]["siege"] * mult
    return dmg * state.bal["siege"]["siege_damage_k"] / 3.0


def tick(state, days=10.0):
    groups = {}
    for a in state.armies.values():
        steps = a["plan"]["steps"]
        if not steps or steps[0]["type"] != "siege" or "node" not in a["loc"]:
            continue
        nid = steps[0]["node"]
        if a["loc"]["node"] != nid:
            continue
        groups.setdefault(nid, {}).setdefault(a["faction"], []).append(a)
    for nid, g in groups.items():
        node = state.nodes[nid]
        for f, lst in g.items():
            armies = [x for x in lst if x["id"] in state.armies]
            if armies:
                _siege_step(state, node, f, armies, days)


def _hostile_present(state, nid, f):
    for e in state.armies_at(nid):
        if state.is_hostile(e["faction"], f) and state.army_size(e) > 0:
            return True
    return False


def _siege_step(state, node, f, armies, days):
    if state.controller(node) == f:
        _finish_step(armies)
        node["under_siege_by"] = ""
        return
    if _hostile_present(state, node["id"], f):
        return
    step = armies[0]["plan"]["steps"][0]
    node["under_siege_by"] = f
    step["days"] = step.get("days", 0.0) + days
    node["wall_hp"] = max(0.0, node["wall_hp"] - siege_damage_per_tick(state, armies) * days / 10.0)
    ar = step.get("assault_when", state.bal["siege"]["default_assault_ratio"])
    ready = node["wall_hp_max"] <= 0.0 or (ar >= 0.0 and node["wall_hp"] <= ar * node["wall_hp_max"])
    if ready:
        _assault(state, node, f, armies)
    if step.get("max_months", 0) > 0 and step["days"] >= step["max_months"] * 30.0 and state.controller(node) != f:
        for a in armies:
            if a["plan"]["steps"] and a["plan"]["steps"][0]["type"] == "siege":
                a["plan"]["steps"].pop(0)
                a["plan"]["step_ticks"] = 0
        node["under_siege_by"] = ""
        state.log_event("siege", "围攻%s超时解围" % node["name"])


def _finish_step(armies):
    for a in armies:
        if a["plan"]["steps"] and a["plan"]["steps"][0]["type"] == "siege":
            a["plan"]["steps"].pop(0)
            a["plan"]["step_ticks"] = 0


def _assault(state, node, f, armies):
    militia = {t: float(n) for t, n in node["militia"].items() if n > 0}
    if combat.total(militia) <= 0:
        capture(state, node, f)
        _finish_step(armies)
        return
    ctx = {"b_def": combat.wall_mult(state, node)}
    p = combat.expected_p(state, combat.merged_units(armies), militia, ctx)
    if p < 0.55:
        return
    ctl = state.controller(node)
    rep = combat.resolve_battle(state, armies, [], node["name"] + "（强攻）",
                                {"node": node, "militia": militia, "defender": "b", "wall_mult": combat.wall_mult(state, node),
                                 "b_faction": ctl if ctl != "" else node["faction"]})
    if rep["winner"] == f:
        capture(state, node, f)
        _finish_step([x for x in armies if x["id"] in state.armies])


def capture(state, node, attacker):
    d = state.bal["diplomacy"]
    old = node["faction"]
    kind = state.kind_of(old)
    node["under_siege_by"] = ""
    node["wall_hp"] = node["wall_hp_max"] * 0.5
    state.stats["sieges_won"] += 1
    h = int(d["victory_near_hops"])
    if kind == "major":
        if old == "han" and "hexi_commandery" in node["tags"]:
            state.stats["hexi_lost"] += 1
            state.stats.setdefault("hexi_lost_first_month", state.month_index())
        node["faction"] = attacker
        node["grain"] = node["grain"] * 0.5
        node["horses"] = int(node["horses"] * 0.5)
        node["pop"] = int(node["pop"] * 0.9)
        node["militia"] = {}
    elif kind == "citystate":
        rel = state.relations[old]
        rel["overlord"] = attacker
        rel["han_status"] = "none"
        loot = node["grain"] * 0.5
        if attacker == "han":
            node["depot"]["han"] = node["depot"].get("han", 0.0) + loot * 0.5
            node["grain"] -= loot * 0.5
            for sid in state.relations:
                if sid == old:
                    continue
                for n2 in state.nodes_of_state(sid):
                    if state.hops(node["id"], n2["id"], h) <= h:
                        state.relations[sid]["han_influence"] = min(100.0, max(0.0, state.relations[sid]["han_influence"] + d["han_conquest_influence_neighbor"]))
                        break
            rel["han_influence"] = max(rel["han_influence"], 25.0)
            rel["xn_intimidation"] = 0.0
            state.stats["han_conquests"] = state.stats.get("han_conquests", 0) + 1
        else:
            node["grain"] -= loot
            state.factions["xiongnu"]["money"] += int(node["pop"] * 0.02)
            rel["xn_intimidation"] = min(100.0, rel["xn_intimidation"] + d["xn_sack_intimidation"])
            rel["xn_resentment"] = min(100.0, rel["xn_resentment"] + d["xn_sack_resentment"])
            for sid in state.relations:
                if sid == old:
                    continue
                for n3 in state.nodes_of_state(sid):
                    if state.hops(node["id"], n3["id"], h) <= h:
                        state.relations[sid]["xn_intimidation"] = min(100.0, state.relations[sid]["xn_intimidation"] + d["xn_sack_neighbor"])
                        break
        tot = int(node["pop"] * state.bal["local_militia_ratio"] * 0.3)
        node["militia"] = {"infantry": tot // 2, "crossbow": tot - tot // 2}
    else:
        node["faction"] = attacker
        node["militia"] = {}
        node["grain"] = node["grain"] * 0.5
    state.log_event("capture", "%s 攻陷 %s" % (attacker, node["name"]), {"node": node["id"], "by": attacker})
    v1 = getattr(state, "ext", {}).get("v1")
    if v1:
        nid = node["id"]
        if attacker == "xiongnu":
            if nid in v1["logistics"]["beacons"]:
                v1["logistics"]["beacons"].remove(nid)
                state.factions["xiongnu"]["money"] += 80
                state.log_event("v1_beacon", "【烽燧焚毁】匈奴攻陷 %s，焚毁汉亭燧" % node["name"], {"node": nid})
            if v1["logistics"]["tuntian_nodes"].get(nid, 0) > 0:
                v1["logistics"]["tuntian_nodes"][nid] = max(0, v1["logistics"]["tuntian_nodes"][nid] - 1)
            tr = v1["tribes"]
            if tr.get("assembly_target") == nid and tr.get("assembly_ticks", 0) > 0:
                state.factions["xiongnu"]["money"] += 600
                tr["reward_pool"] += 300
                for tk in ("zuoxian", "youxian", "rizhu", "lihu"):
                    if tk in tr["tribes"] and tr["tribes"][tk]["status"] != "defected_han":
                        tr["tribes"][tk]["loyalty"] = min(100.0, tr["tribes"][tk]["loyalty"] + 8.0)
                tr["assembly_target"] = ""
                tr["assembly_ticks"] = 0
                state.log_event("v1_assembly", "【蹛林盟约告捷】匈奴攻克盟会目标 %s，诸王分赏战利，部族忠诚大振！" % node["name"], {"node": nid})
        elif attacker == "han":
            court = v1["court"]
            if court.get("forged_bonus_ticks", 0) > 0:
                court["trust"] = min(100.0, court["trust"] + 8.0)
                v1["victory"]["han_merit"] += 3.0
                court["forged_bonus_ticks"] = 0
                state.log_event("v1_court", "【功成不问矫制】汉军矫制破 %s 有功，朝廷释疑嘉奖（信任+8，功绩+3）" % node["name"], {"node": nid})
            if old == "da_wan" and not v1["events"].get("dawan_horses_obtained"):
                v1["events"]["dawan_horses_obtained"] = True
                if hasattr(state, "han_horse_pool"):
                    state.han_horse_pool += 2500
                v1["victory"]["han_merit"] += 8.0
                state.log_event("v1_event", "【天马徕·贰师破宛】汉军攻克%s，得汗血良马二千五百匹，天子大悦！" % node["name"], {"node": nid})


def monthly(state):
    for nid, node in state.nodes.items():
        f = node["under_siege_by"]
        if f == "":
            continue
        if not any(a["faction"] == f for a in state.armies_at(nid)):
            node["under_siege_by"] = ""
            continue
        if node["grain"] <= 0.0:
            for t in node["militia"]:
                node["militia"][t] = int(node["militia"][t] * (1.0 - state.bal["siege"]["starve_attrition"]))
            if state.rng.random() < state.bal["siege"]["starve_surrender_chance"]:
                if not _hostile_present(state, nid, f):
                    capture(state, node, f)


def burn(state, a, node):
    f = a["faction"]
    if state.controller(node) == f:
        return
    if _hostile_present(state, node["id"], f):
        return
    state.stats["raids_" + f] = state.stats.get("raids_" + f, 0) + 1
    loot = min(node["grain"] * state.bal["raid"]["grain_loot_ratio"], max(0.0, supply.carry_cap(state, a) - a["grain"]))
    node["grain"] -= loot
    a["grain"] += loot
    state.stats["grain_raided_" + f] = state.stats.get("grain_raided_" + f, 0.0) + loot
    if f == "xiongnu":
        raid_gold = int(node["pop"] * state.bal["raid"]["money_per_pop"])
        v1 = getattr(state, "ext", {}).get("v1")
        if v1 and v1["tribes"].get("active_tactical_card") == "scorched_earth":
            raid_gold = int(raid_gold * 1.15)
            tp = v1["logistics"].setdefault("tuntian_pressure", {})
            if isinstance(tp, dict):
                for tnid in v1["logistics"].get("tuntian_nodes", {}):
                    tp[tnid] = min(100.0, float(tp.get(tnid, 0.0)) + 5.0)
        state.factions[f]["money"] += raid_gold
    if node["farm_cap"] > 0:
        node["farm_dev"] = max(state.bal["farm"]["min_dev"], node["farm_dev"] - state.bal["farm"]["burn_dev_loss"])
        buffs.apply(state, "sacked", node["id"])
    if node["pasture_cap"] > 0 and node["horses"] > 0:
        take = int(node["horses"] * 0.25)
        node["horses"] -= take
        a["horses"] += take
        state.stats["horses_captured"] += take
    node["pop"] = int(node["pop"] * 0.97)
    state.log_event("raid", "%s 劫掠 %s" % (f, node["name"]), {"node": node["id"]})
    if f == "xiongnu":
        sid = node["faction"]
        if sid in state.relations:
            state.relations[sid]["xn_resentment"] = min(100.0, state.relations[sid]["xn_resentment"] + 10.0)
