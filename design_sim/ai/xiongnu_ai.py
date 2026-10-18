"""匈奴基线 AI —— 移植自 ai/xiongnu_ai.gd。"""
from ..engine import combat, commands, economy, supply
from . import utils as U


class XiongnuAI:
    faction = "xiongnu"

    def __init__(self, profile_overrides=None):
        self.mem = {}
        self.profile_overrides = dict(profile_overrides or {})

    def _profile(self, state):
        prof = dict(state.ai_profiles["xiongnu_default"])
        prof.update(self.profile_overrides)
        return prof

    def think(self, state):
        cmds = []
        prof = self._profile(state)
        self._taxes(state, cmds, prof)
        for sid in state.relations:
            if economy.can_demand(state, sid) == "":
                cmds.append(commands.make("demand_vassal", self.faction, {"state": sid}))
        self._recruit(state, cmds, prof)
        assigned = {}
        self._detachments(state, cmds, prof, assigned)
        self._campaign(state, cmds, prof, assigned)
        return cmds

    def _taxes(self, state, cmds, prof):
        for sid, rel in state.relations.items():
            if rel["overlord"] != self.faction:
                continue
            level = 0
            for candidate in range(3, -1, -1):
                increase = max(
                    0.0,
                    state.bal["diplomacy"]["tax_rates"][candidate]["res"]
                    - state.bal["diplomacy"]["resentment_decay_month"],
                )
                if rel["xn_resentment"] + increase * state.decision_ticks / 3.0 < prof["max_resentment"] - 10:
                    level = candidate
                    break
            if level != int(rel["tax_level"]):
                cmds.append(commands.make("set_tax", self.faction, {"state": sid, "level": level}))

    def _recruit(self, state, cmds, prof):
        troops = 0
        infantry = 0
        for army in U.field_armies(state, self.faction):
            troops += state.army_size(army)
            infantry += U.count_units(army, "infantry")
        troop_limit = int(prof["max_field_troops"]) - int(prof.get("long_plan_reserve_per_month", 0)) * max(
            0, int(state.decision_ticks // 3) - 1
        )
        room = troop_limit - troops
        if room > 0:
            for nid in ("youxian_wang", "chanyu_ting", "long_cheng"):
                n = state.nodes[nid]
                if n["faction"] != self.faction:
                    continue
                cap = int(n["pop"] * state.bal["xiongnu"]["levy_ratio"]) - n["recruited"].get("nomad", 0)
                cavalry_room = max(0, room - max(0, int(prof["infantry_target"]) - infantry))
                amount = min(min(cap, cavalry_room), int(3000 * state.decision_ticks / 3.0))
                amount = min(amount, max(0, int((n["horses"] - 20000) // 2)))
                if amount >= 1000:
                    cmds.append(commands.make("recruit", self.faction, {
                        "node": nid, "source": "nomad", "units": {"horse_archer": amount}, "preset": "balanced"
                    }))
                    room -= amount
                    break
        need = min(int(prof["infantry_target"]) - infantry, room)
        for sid, rel in state.relations.items():
            if need < 300:
                break
            if (
                rel["overlord"] != self.faction
                or rel["xn_resentment"] > prof["max_resentment"] - state.bal["xiongnu"]["vassal_levy_resentment"]
            ):
                continue
            for n in state.nodes_of_state(sid):
                cap = int(n["pop"] * state.bal["xiongnu"]["vassal_infantry_levy_ratio"]) - n["recruited"].get("vassal", 0)
                amount = min(need, cap)
                if amount >= 300:
                    cmds.append(commands.make("recruit", self.faction, {
                        "node": n["id"], "source": "vassal", "units": {"infantry": amount},
                        "preset": "balanced", "role": "siege"
                    }))
                    need -= amount

    def _plan(self, state, cmds, army, steps, role, preset="balanced"):
        cmd = commands.make("set_plan", self.faction, {
            "army": army["id"], "steps": steps, "preset": preset, "role": role
        })
        if commands.validate(state, cmd) == "":
            cmds.append(cmd)

    def _detachments(self, state, cmds, prof, assigned):
        busy = {}
        raiders = []
        for a in U.field_armies(state, self.faction):
            role = a.get("ai_role", "")
            if role == "presence":
                steps = a["plan"]["steps"]
                if steps:
                    busy[steps[-1].get("node", "")] = "busy"
            elif role == "raid":
                raiders.append(a)
        for nid in ("cheshi_qian", "lou_lan", "yan_qi", "cheshi_hou"):
            sid = state.nodes[nid]["faction"]
            rel = state.relations.get(sid, {})
            if not rel or rel["overlord"] != self.faction or nid in busy:
                continue
            if rel["xn_intimidation"] >= 65 and rel["han_influence"] < rel["xn_intimidation"] - 20:
                continue
            small = self._nearest_idle(state, nid, assigned, 500, 2500)
            if small is not None:
                assigned[small["id"]] = "busy"
                self._plan(state, cmds, small, [{"type": "hold", "node": nid, "until": "end"}], "presence", "raider")
                busy[nid] = "busy"
            else:
                large = self._nearest_idle(state, nid, assigned, 6000, 99999)
                if large is not None:
                    cmds.append(commands.make("split", self.faction, {
                        "army": large["id"],
                        "units": {"horse_archer": int(prof["presence_troops"])},
                        "grain": 6000,
                        "role": "presence",
                    }))
                    assigned[large["id"]] = "split"
                    break
        for a in U.field_armies(state, self.faction):
            if (
                a.get("ai_role", "") == "presence"
                and U.is_idle(a)
                and a["id"] not in assigned
                and (not a["plan"]["steps"] or a["plan"]["steps"][0].get("node", "") not in ("cheshi_qian", "lou_lan", "yan_qi", "cheshi_hou"))
            ):
                for nid in ("cheshi_qian", "lou_lan", "yan_qi", "cheshi_hou"):
                    if state.controller(state.nodes[nid]) == self.faction and nid not in busy:
                        self._plan(state, cmds, a, [{"type": "hold", "node": nid, "until": "end"}], "presence", "raider")
                        busy[nid] = "busy"
                        assigned[a["id"]] = "busy"
                        break
        for a in raiders:
            assigned[a["id"]] = "busy"
            if not U.is_idle(a) or "node" not in a["loc"]:
                continue
            target = "yang_guan"
            ridx = state.route_between(target, "lou_lan")
            self._plan(
                state,
                cmds,
                a,
                [{"type": "ambush", "node": target, "route": ridx, "months": 2}, {"type": "return_to", "node": "yi_wu"}],
                "raid",
                "raider",
            )
        if len(raiders) < prof["raiders"] and 5 <= state.month() <= 10:
            large = self._nearest_idle(state, "yi_wu", assigned, 8000, 99999)
            if large is not None:
                cmds.append(commands.make("split", self.faction, {
                    "army": large["id"],
                    "units": {"horse_archer": int(prof["raid_troops"])},
                    "grain": 6000,
                    "role": "raid",
                }))
                assigned[large["id"]] = "split"

    def _nearest_idle(self, state, target, assigned, low, high):
        best = None
        distance = float("inf")
        for a in U.field_armies(state, self.faction):
            if (
                a["id"] in assigned
                or not U.is_idle(a)
                or "node" not in a["loc"]
                or a.get("ai_role", "") in ("presence", "raid", "siege")
            ):
                continue
            size = state.army_size(a)
            if size < low or size > high or U.count_units(a, "horse_archer") < low:
                continue
            days = state.days_to(a["loc"]["node"], target, combat.army_speed(state, a), False)
            if days < distance:
                distance = days
                best = a
        return best

    def _campaign(self, state, cmds, prof, assigned):
        month = state.month()
        if month < prof["rally_month"] or month > 10:
            return
        rally = "yi_wu"
        gathered = []
        for a in U.field_armies(state, self.faction):
            if (
                assigned.get(a["id"], "") == "busy"
                or a.get("ai_role", "") in ("presence", "raid")
                or not U.is_idle(a)
                or "node" not in a["loc"]
            ):
                continue
            if a["loc"]["node"] == rally:
                if a["id"] not in assigned:
                    gathered.append(a)
            else:
                if state.is_supply_node(state.nodes[a["loc"]["node"]], self.faction):
                    cmds.append(commands.make("load", self.faction, {
                        "army": a["id"],
                        "grain": supply.carry_cap(state, a) - a["grain"],
                        "laborers": 0,
                    }))
                self._plan(
                    state,
                    cmds,
                    a,
                    [{"type": "move_to", "node": rally}, {"type": "hold", "node": rally, "until": "end"}],
                    "siege" if U.count_units(a, "infantry") > 0 else "field",
                    "assault",
                )
        if not gathered:
            return
        gathered.sort(key=lambda a: state.army_size(a), reverse=True)
        leader = gathered[0]
        for i in range(1, len(gathered)):
            cmds.append(commands.make("merge", self.faction, {"army": gathered[i]["id"], "into": leader["id"]}))
        units = combat.merged_units(gathered)
        if month < 7:
            return
        target = self._pick_target(state, units, prof)
        if target == "":
            return
        steps = []
        if month < prof["attack_month"]:
            steps.append({"type": "hold", "node": rally, "months": prof["attack_month"] - month})
        steps.append({"type": "burn", "node": target})
        steps.append({"type": "siege", "node": target, "max_months": prof["siege_months"], "assault_when": 0.65})
        steps.append({"type": "return_to", "node": rally})
        self._plan(state, cmds, leader, steps, "field", "assault")
        state.log_event(
            "ai",
            "匈奴预排秋季攻势：%d 人，步兵 %d，目标%s" % (
                int(combat.total(units)), units.get("infantry", 0), state.nodes[target]["name"]
            ),
        )

    def _pick_target(self, state, units, prof):
        best = ""
        score = float("-inf")
        for nid in state.bal["victory"]["xn_targets"]:
            n = state.nodes[nid]
            if n["faction"] != "han":
                continue
            defenders = dict(n["militia"])
            for a in state.armies_at(nid):
                if a["faction"] == "han":
                    for ut, cnt in a["units"].items():
                        defenders[ut] = defenders.get(ut, 0) + cnt
            probability = combat.expected_p(state, units, defenders, {"b_def": combat.wall_mult(state, n)})
            if probability < prof["min_attack_probability"]:
                continue
            value = probability * 10.0 - state.days_to("yi_wu", nid, 1.0, False) / 60.0
            if value > score:
                score = value
                best = nid
        return best
