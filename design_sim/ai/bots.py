"""多策略机器人集合（S09 §6.1）：贪心、激进、保守、随机合法。

配合 baseline（han_ai.py / xiongnu_ai.py），为双方各提供 5 套策略以检测支配策略与决策多样性。
"""
from ..engine import combat, commands, economy
from . import utils as U
from .han_ai import HanAI
from .xiongnu_ai import XiongnuAI


class HanAggressiveAI(HanAI):
    """激进汉 AI：压低备用金与出征胜率阈值，扩大远征搜索跳数，优先军事破局。"""
    def __init__(self):
        super().__init__({
            "money_reserve": 200,
            "attack_win_prob": 0.48,
            "defense_warning_days": 15,
            "gift_batch": 2,
            "expedition_max_hops": 6,
        })


class HanConservativeAI(HanAI):
    """保守汉 AI：高备用金、高防御预警、高出征胜率门槛，专注屯田固守与稳健外交。"""
    def __init__(self):
        super().__init__({
            "money_reserve": 900,
            "attack_win_prob": 0.78,
            "defense_warning_days": 60,
            "defense_batch": 3000,
            "gift_batch": 4,
            "expedition_max_hops": 3,
        })


class HanGreedyAI(HanAI):
    """贪心汉 AI：短视最大化当回合属国数与影响力（先拉满内附/册封/赏赐与扩田，再管后勤与防务）。"""
    def __init__(self):
        super().__init__({
            "money_reserve": 0,
            "gift_batch": 4,
            "max_gifts_per_turn": 8,
            "attack_win_prob": 0.55,
        })

    def think(self, state):
        cmds = []
        prof = self._profile(state)
        horizon = state.decision_ticks * 10.0
        budget = float(state.factions["han"]["money"])
        # 贪心顺序：外交 → 扩田 → 远征 → 防守 → 运粮
        budget = self._diplomacy(state, cmds, prof, budget)
        budget = self._economy(state, cmds, prof, budget)
        self._expedition(state, cmds, prof, horizon, budget)
        budget = self._defense(state, cmds, prof, horizon, budget)
        self._logistics(state, cmds, prof)
        return cmds


class XiongnuAggressiveAI(XiongnuAI):
    """激进匈奴 AI：提高野战兵力上限与税率容忍度，降低攻城胜率门槛，提前集结强攻河西。"""
    def __init__(self):
        super().__init__({
            "max_field_troops": 38000,
            "infantry_target": 7000,
            "max_resentment": 75,
            "rally_month": 4,
            "attack_month": 7,
            "min_attack_probability": 0.45,
            "raiders": 3,
        })


class XiongnuConservativeAI(XiongnuAI):
    """保守匈奴 AI：压低属国怨恨上限防叛离，增加西域驻军，仅在高胜率时南下。"""
    def __init__(self):
        super().__init__({
            "max_field_troops": 26000,
            "infantry_target": 4000,
            "max_resentment": 45,
            "min_attack_probability": 0.70,
            "presence_troops": 2000,
            "raiders": 1,
        })


class XiongnuGreedyAI(XiongnuAI):
    """贪心匈奴 AI：短视最大化当季税率与直接攻城，不做游骑与驻军分兵，全年伺机扑向最弱河西城。"""
    def __init__(self):
        super().__init__({
            "max_field_troops": 35000,
            "max_resentment": 82,
            "min_attack_probability": 0.42,
            "rally_month": 2,
            "attack_month": 5,
            "raiders": 0,
        })

    def think(self, state):
        cmds = []
        prof = self._profile(state)
        for sid in state.relations:
            if economy.can_demand(state, sid) == "":
                cmds.append(commands.make("demand_vassal", self.faction, {"state": sid}))
        self._taxes(state, cmds, prof)
        self._recruit(state, cmds, prof)
        self._campaign(state, cmds, prof, {})
        return cmds


class RandomLegalAI:
    """随机合法 AI：每回合从 enumerate_legal_commands 中随机抽取 1–4 条不冲突的合法命令。"""
    def __init__(self, faction, max_cmds=4):
        self.faction = faction
        self.max_cmds = max_cmds

    def think(self, state):
        cands = commands.enumerate_legal_commands(state, self.faction)
        if not cands:
            return []
        # 使用独立于主状态演进或基于回合的确定性洗牌
        idxs = list(range(len(cands)))
        for i in range(len(idxs) - 1, 0, -1):
            j = state.rng.randint(0, i)
            idxs[i], idxs[j] = idxs[j], idxs[i]

        picked = []
        used_armies = set()
        used_states = set()
        money_left = float(state.factions[self.faction]["money"])
        target_k = state.rng.randint(1, self.max_cmds)

        for idx in idxs:
            if len(picked) >= target_k:
                break
            c = cands[idx]
            t = c["type"]
            if "army" in c:
                if c["army"] in used_armies:
                    continue
            if "state" in c:
                if c["state"] in used_states:
                    continue
            cost = _estimate_cmd_cost(state, c)
            if cost > money_left:
                continue
            if commands.validate(state, c) == "":
                picked.append(c)
                money_left -= cost
                if "army" in c:
                    used_armies.add(c["army"])
                if "state" in c:
                    used_states.add(c["state"])
        return picked


def _estimate_cmd_cost(state, c):
    t = c["type"]
    if t == "gift":
        return c["units"] * state.bal["diplomacy"]["gift_unit_money"]
    if t == "enfeoff":
        return state.bal["diplomacy"]["enfeoff_cost_money"]
    if t == "expand_farm":
        return state.bal["farm"]["expand_cost_money"]
    if t == "recruit" and c.get("source") == "central":
        return sum(cnt / 1000.0 * state.units[ut]["cost_money_per_1000"] for ut, cnt in c["units"].items())
    return 0.0
