"""汉基线 AI —— 移植自 ai/han_ai.gd。"""
import math

from ..engine import combat, commands, economy, supply
from . import utils as U

HEXI = ["wu_wei", "zhang_ye", "jiu_quan", "dun_huang", "ju_yan"]
PRIORITY = {"wu_lei": 3.0, "cheshi_qian": 3.0, "lou_lan": 2.0}


class HanAI:
    faction = "han"

    def __init__(self, profile_overrides=None):
        self.mem = {}
        self.profile_overrides = dict(profile_overrides or {})

    def _profile(self, state):
        prof = dict(state.ai_profiles["han_default"])
        prof.update(self.profile_overrides)
        return prof

    def think(self, state):
        cmds = []
        prof = self._profile(state)
        horizon = state.decision_ticks * 10.0
        budget = float(state.factions["han"]["money"]) - prof["money_reserve"]
        budget = self._defense(state, cmds, prof, horizon, budget)
        budget = self._diplomacy(state, cmds, prof, budget)
        budget = self._economy(state, cmds, prof, budget)
        self._logistics(state, cmds, prof)
        self._expedition(state, cmds, prof, horizon, budget)
        return cmds

    def _defense(self, state, cmds, prof, horizon, budget):
        pool = dict(state.central)
        threats = {}
        cities = list(HEXI)
        for nid in cities:
            threats[nid] = U.enemy_threat_at(state, nid, "xiongnu", horizon + prof["defense_warning_days"])
        cities.sort(
            key=lambda nid: threats[nid] / max(U.garrison_strength(state, nid, "han"), 1.0),
            reverse=True,
        )
        for nid in cities:
            node = state.nodes[nid]
            if node["faction"] != "han":
                continue
            mine = U.garrison_strength(state, nid, "han") * combat.wall_mult(state, node)
            if threats[nid] < mine * 0.8 or budget < 100:
                continue
            current = sum(state.army_size(a) for a in state.armies_at(nid) if a["faction"] == "han")
            food_room = max(0, int((node["grain"] / prof["defense_food_months"] - node["pop"] * 2.0) / 3.0) - current)
            want = {}
            for ut in ("crossbow", "infantry"):
                amount = min(
                    min(int(pool.get(ut, 0)), int(prof["defense_batch"] * state.decision_ticks / 3.0)),
                    food_room,
                )
                if amount >= 500:
                    want[ut] = amount
                    food_room -= amount
            if not want:
                continue
            cost = sum(want[ut] / 1000.0 * state.units[ut]["cost_money_per_1000"] for ut in want)
            if cost <= budget:
                cmds.append(commands.make("recruit", self.faction, {
                    "node": nid, "source": "central", "units": want, "preset": "garrison"
                }))
                for ut in want:
                    pool[ut] -= want[ut]
                budget -= cost
        return budget

    def _diplomacy(self, state, cmds, prof, budget):
        cands = []
        for sid, rel in state.relations.items():
            if not state.factions[sid].get("counts_for_victory", False):
                continue
            if rel["overlord"] == "han":
                continue
            cands.append(sid)
        cands.sort(
            key=lambda sid: (
                PRIORITY.get(sid, 1.0) * 10.0
                + state.relations[sid]["han_influence"]
                - state.relations[sid]["xn_intimidation"] * 0.5
            ),
            reverse=True,
        )
        gifts_done = 0
        dipl = state.bal["diplomacy"]
        gift_batch = int(prof["gift_batch"]) * max(1, int(state.decision_ticks // 3))
        max_gifts = int(prof.get("max_gifts_per_turn", 4))
        for sid in cands:
            rel = state.relations[sid]
            if economy.can_vassal(state, sid) == "":
                cmds.append(commands.make("make_vassal", self.faction, {"state": sid}))
                continue
            if economy.can_enfeoff(state, sid) == "" and budget >= 200:
                cmds.append(commands.make("enfeoff", self.faction, {"state": sid}))
                budget -= 200
                continue
            if rel["xn_intimidation"] > rel["han_influence"] + 40:
                continue
            if gifts_done < max_gifts and budget >= gift_batch * dipl["gift_unit_money"]:
                multiplier = economy.mult(state, sid)
                target_inf = max(
                    dipl["vassal_min_influence"] * multiplier,
                    rel["xn_intimidation"] + dipl["vassal_margin_over_intimidation"] * multiplier,
                )
                if target_inf > dipl["influence_max"]:
                    continue
                if rel["han_influence"] < target_inf:
                    cmds.append(commands.make("gift", self.faction, {"state": sid, "units": gift_batch}))
                    budget -= gift_batch * dipl["gift_unit_money"]
                    gifts_done += 1
        return budget

    def _economy(self, state, cmds, prof, budget):
        projects = math.ceil((state.tick + state.decision_ticks) / 6.0) - math.ceil(state.tick / 6.0)
        for nid in ("dun_huang", "jiu_quan", "wu_wei", "zhang_ye", "long_xi"):
            if projects <= 0 or budget <= prof["money_reserve"]:
                break
            c = commands.make("expand_farm", self.faction, {"node": nid})
            if commands.validate(state, c) == "":
                cmds.append(c)
                budget -= state.bal["farm"]["expand_cost_money"]
                projects -= 1
        return budget

    def _logistics(self, state, cmds, prof):
        inbound = {}
        convoys = 0
        for army in state.armies.values():
            if army["faction"] != self.faction or not army["is_convoy"]:
                continue
            convoys += 1
            for step in army["plan"]["steps"]:
                if step["type"] == "deliver":
                    start = army["loc"].get("node", army["loc"].get("to", ""))
                    months = U.months_between(state, start, step["node"], combat.army_speed(state, army))
                    return_months = U.months_between(
                        state, step["node"], army.get("convoy_home", start), combat.army_speed(state, army)
                    )
                    net = max(0.0, army["grain"] - supply.need_per_month(state, army) * (months + return_months))
                    inbound[step["node"]] = inbound.get(step["node"], 0.0) + net
        if convoys >= prof["max_convoys"]:
            return
        legs = [
            ["chang_an", "long_xi"],
            ["long_xi", "wu_wei"],
            ["wu_wei", "zhang_ye"],
            ["zhang_ye", "jiu_quan"],
            ["jiu_quan", "dun_huang"],
            ["zhang_ye", "ju_yan"],
        ]
        candidates = []
        for leg in legs:
            node = state.nodes[leg[1]]
            if node["faction"] != self.faction:
                continue
            need = node["pop"] * 2.0
            for army in state.armies_at(node["id"]):
                if army["faction"] == self.faction and not army["is_convoy"]:
                    need += supply.need_per_month(state, army)
            deficit = need * 9.0 - node["grain"] - inbound.get(node["id"], 0.0)
            if deficit > 10000:
                candidates.append({
                    "source": leg[0],
                    "destination": leg[1],
                    "deficit": deficit,
                    "urgency": deficit / max(need, 1.0),
                })
        candidates.sort(key=lambda x: x["urgency"], reverse=True)
        dispatched = 0
        reserved_workers = {}
        reserved_grain = {}
        slots = min(int(state.decision_ticks // 3), int(prof["max_convoys"]) - convoys)
        for candidate in candidates:
            destination = candidate["destination"]
            source = state.nodes[candidate["source"]]
            if source["faction"] != self.faction:
                continue
            if source["type"] == "source":
                workers = 8000
                spare = float("inf")
            else:
                workers = min(
                    3000,
                    int(source["pop"] * state.bal["han"]["laborer_levy_ratio"])
                    - source["levied_out"]
                    - int(reserved_workers.get(source["id"], 0)),
                )
                keep = source["pop"] * 2.0 * 6.0
                for army in state.armies_at(source["id"]):
                    if army["faction"] == self.faction and not army["is_convoy"]:
                        keep += supply.need_per_month(state, army) * 6.0
                spare = source["grain"] - keep - float(reserved_grain.get(source["id"], 0.0))
            if not math.isinf(spare):
                workers = min(workers, int(max(0.0, spare) / 15.0))
            if workers < 500:
                continue
            cmds.append(commands.make("convoy", self.faction, {
                "from": source["id"], "to": destination, "grain": workers * 15.0, "laborers": workers
            }))
            reserved_workers[source["id"]] = reserved_workers.get(source["id"], 0) + workers
            reserved_grain[source["id"]] = reserved_grain.get(source["id"], 0.0) + workers * 15.0
            dispatched += 1
            if dispatched >= slots:
                return

    def _expedition(self, state, cmds, prof, horizon, budget):
        fields = [
            a for a in U.field_armies(state, self.faction)
            if not a["garrison"] and a["plan"]["preset"] != "garrison"
        ]
        home = "dun_huang"
        if state.nodes[home]["faction"] != "han":
            for candidate in ("jiu_quan", "zhang_ye", "wu_wei", "long_xi"):
                if state.nodes[candidate]["faction"] == "han":
                    home = candidate
                    break
        army = None
        for a in fields:
            if a["loc"].get("node") == home and U.is_idle(a):
                army = a
                break
        moving = [x for x in fields if not U.is_idle(x)]
        if moving:
            return
        if army is None:
            node = state.nodes[home]
            available = dict(state.central)
            for pending in cmds:
                if pending["type"] == "recruit" and pending["source"] == "central":
                    for ut, cnt in pending["units"].items():
                        available[ut] -= cnt
            recruit_cost = (
                4.0 * state.units["infantry"]["cost_money_per_1000"]
                + 3.0 * state.units["crossbow"]["cost_money_per_1000"]
                + 1.5 * state.units["cavalry"]["cost_money_per_1000"]
            )
            if (
                available.get("infantry", 0) >= 4000
                and available.get("crossbow", 0) >= 3000
                and available.get("cavalry", 0) >= 1500
                and budget >= recruit_cost
                and node["grain"] > 150000
            ):
                cmds.append(commands.make("recruit", self.faction, {
                    "node": home,
                    "source": "central",
                    "units": {"infantry": 4000, "crossbow": 3000, "cavalry": 1500},
                    "preset": "balanced",
                }))
            return
        for a in state.armies_at(home):
            if (
                a["is_convoy"]
                and a["faction"] == self.faction
                and len(a["plan"]["steps"]) > 0
                and a["plan"]["steps"][0]["type"] == "hold"
            ):
                cmds.append(commands.make("merge", self.faction, {"army": a["id"], "into": army["id"]}))
        target = ""
        for nid in state.bal["victory"]["xn_targets"]:
            if state.nodes[nid]["faction"] == "xiongnu":
                enemies = [a for a in state.armies_at(nid) if a["faction"] == "xiongnu"]
                if combat.expected_p(
                    state,
                    combat.merged_units([army]),
                    combat.merged_units(enemies),
                    {"b_def": combat.wall_mult(state, state.nodes[nid])},
                ) >= prof["attack_win_prob"]:
                    target = nid
                    break
        if target == "":
            target = self._pick_target(state, army, prof)
        if target == "":
            return
        m = U.months_between(state, home, target, 1.0)
        months_needed = 2.0 * m * 1.2 + 2.0
        soldiers = state.army_size(army)
        need = U.need_grain(state, soldiers, army["laborers"], army["horses"], months_needed)
        depot = state.nodes[home]
        lab_avail = int(depot["pop"] * state.bal["han"]["laborer_levy_ratio"]) - depot["levied_out"]
        for pending in cmds:
            if pending["type"] == "convoy" and pending["from"] == home:
                lab_avail -= int(pending["laborers"])
        load_lab = max(0, min(int((need - soldiers * 3.0) / 12.0) - army["laborers"], max(lab_avail, 0)))
        carry = soldiers * 3.0 + (army["laborers"] + load_lab) * 15.0
        eat = U.need_grain(state, soldiers, army["laborers"] + load_lab, army["horses"], months_needed)
        load_grain = max(0.0, min(carry - army["grain"], depot["grain"] - depot["pop"] * 2.0 * 6.0))
        cmds.append(commands.make("load", self.faction, {
            "army": army["id"], "grain": load_grain, "laborers": load_lab
        }))
        if carry < eat or army["grain"] + load_grain < eat * 0.9:
            return
        steps = [
            {"type": "siege", "node": target, "max_months": 3, "assault_when": 0.5},
            {"type": "return_to", "node": home},
        ]
        cmds.append(commands.make("set_plan", self.faction, {
            "army": army["id"], "steps": steps, "preset": "balanced"
        }))
        state.log_event(
            "ai",
            "汉出征 %s（%d 人，携粮可支撑约 %.1f 月）" % (
                state.nodes[target]["name"],
                soldiers,
                carry / max(U.need_grain(state, soldiers, army["laborers"] + load_lab, army["horses"], 1.0), 1.0),
            ),
        )

    def _pick_target(self, state, army, prof):
        best = ""
        bscore = -1.0
        mine = combat.merged_units([army])
        max_hops = int(prof.get("expedition_max_hops", 4))
        for sid, rel in state.relations.items():
            if rel["overlord"] != "xiongnu":
                continue
            for n in state.nodes_of_state(sid):
                if not state.factions[sid].get("counts_for_victory", False):
                    continue
                hops = state.hops("dun_huang", n["id"], 6)
                if hops > max_hops:
                    continue
                defenders = dict(n["militia"])
                for e in state.armies_at(n["id"]):
                    if e["faction"] == "xiongnu":
                        for ut, cnt in e["units"].items():
                            defenders[ut] = defenders.get(ut, 0) + cnt
                ctx = {"b_def": combat.wall_mult(state, n)}
                p = combat.expected_p(state, mine, defenders, ctx)
                if p < prof["attack_win_prob"]:
                    continue
                sc = PRIORITY.get(sid, 1.0) * 2.0 - hops * 0.7 + p
                if sc > bscore:
                    bscore = sc
                    best = n["id"]
        return best
