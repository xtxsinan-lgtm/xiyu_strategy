"""回合与旬/月结算器 —— 移植自 core/turn_resolver.gd，并集成新规则插件生命周期钩子。"""
import copy

from . import buffs, combat, commands, economy, executor, siege, supply, victory


class RulesetPlugin:
    """新规则模块基类（供 W2 接入 S01–S06 使用）。

    每个规则集可继承本类并按需覆写对应钩子，注册在 design_sim/rulesets/ 中。
    """
    name = "base"

    def setup(self, state):
        """开局初始化：向 state.ext[self.name] 写入新规则状态变量，或覆盖初始数据。"""
        pass

    def validate_command(self, state, cmd):
        """命令合法性拦截：返回 "" 表示合法，非空字符串表示拒绝原因，None 表示交由基线校验。"""
        return None

    def apply_command(self, state, cmd):
        """命令执行拦截：返回 True 表示已由本插件处理，False 表示交由基线执行。"""
        return False

    def legal_commands(self, state, faction):
        """返回本插件为指定阵营新增的合法候选命令列表（用于 CLI 试玩与决策密度统计）。"""
        return []

    def on_turn_start(self, state):
        """每个决策回合开始（应用玩家/AI 命令前）触发。"""
        pass

    def on_substep(self, state, days):
        """每个子步（移动/遭遇/围城/补给后）触发，适合传递中的诏令/使团/自动化补给线推进。"""
        pass

    def on_month_end(self, state):
        """每月月末（基线经济/围城/外交/商路/城邦/Buff 结算后，胜利判定前）触发。"""
        pass

    def on_quarter_end(self, state):
        """每季季末（第 3/6/9/12 月末，on_month_end 之后）触发。"""
        pass

    def on_turn_end(self, state):
        """每个决策回合结束（全部 tick 跑完后）触发。"""
        pass

    def victory_check(self, state):
        """覆写月度胜利判定：返回 True 表示已由本插件完成判定，False 则走基线 victory.monthly。"""
        return False

    def score_override(self, state):
        """覆写计分公式：返回 {"han": float, "xiongnu": float}，或 None 走基线计分。"""
        return None

    def signature_override(self, state):
        """覆写终局签名字符串：返回 str 或 None 走默认签名。"""
        return None

    def describe_state(self, state, faction):
        """返回附加的局势摘要行列表（供 play.py 文字界面展示）。"""
        return []

    def collect_metrics(self, state):
        """返回附加的单局统计字典（供 metrics.py 汇总）。"""
        return {}


def resolve(state, orders, capture_days=False):
    """执行一个决策回合（WEGO 同时下令 → 推进 state.decision_ticks 旬）。"""
    for rule in getattr(state, "rules", ()):
        rule.on_turn_start(state)

    state.events = []
    rejected = []
    applied = []
    frames = []

    # 记录本回合各阵营下达的原始命令数与合法命令池大小（用于 L12 决策密度统计）
    turn_record = {
        "turn": state.turn,
        "tick": state.tick,
        "year": state.year(),
        "month": state.month(),
        "orders_submitted": {f: len(cmds) for f, cmds in orders.items()},
        "orders_applied": {"han": 0, "xiongnu": 0},
        "orders_rejected": {"han": 0, "xiongnu": 0},
        "applied_types": {"han": [], "xiongnu": []},
    }
    if state.turn < 12:
        turn_record["han_legal_pool_size"] = len(commands.enumerate_legal_commands(state, "han"))

    # 1) 计划先写入，其余即时命令按随机顺序（与 core/turn_resolver.gd 完全一致）
    instant = []
    for f in orders:
        for c in orders[f]:
            instant.append(c)
    _shuffle(state, instant)
    instant.sort(key=lambda x: 0 if x.get("type") == "set_plan" else 1)

    for c in instant:
        f = c.get("faction", "")
        why = commands.validate(state, c)
        if why == "":
            commands.apply(state, c)
            applied.append(c)
            if f in turn_record["orders_applied"]:
                turn_record["orders_applied"][f] += 1
                turn_record["applied_types"][f].append(c.get("type", ""))
        else:
            rejected.append({"cmd": c, "why": why})
            if f in turn_record["orders_rejected"]:
                turn_record["orders_rejected"][f] += 1
            state.log_event("rejected", "命令被拒绝（%s）：%s" % (c.get("type", ""), why))

    state. stats["rejected_commands"] = state.stats.get("rejected_commands", 0) + len(rejected)
    if not hasattr(state, "turn_records"):
        state.turn_records = []
    state.turn_records.append(turn_record)

    # 2) tick 循环
    for _ in range(state.decision_ticks):
        if state.winner != "":
            break
        run_tick(state, frames, capture_days)

    for rule in getattr(state, "rules", ()):
        rule.on_turn_end(state)

    state.turn += 1
    return {
        "events": list(state.events),
        "rejected": rejected,
        "applied": applied,
        "winner": state.winner,
        "frames": frames,
    }


def _shuffle(state, arr):
    for i in range(len(arr) - 1, 0, -1):
        j = state.rng.randint(0, i)
        arr[i], arr[j] = arr[j], arr[i]


def run_tick(state, frames=None, capture_days=False):
    """推进 1 旬（10 天），按 state.substep_days 划分子步。"""
    if frames is None:
        frames = []
    steps_per_tick = max(1, int(round(10.0 / max(1.0, float(state.substep_days)))))
    dt = 10.0 / steps_per_tick

    for step_idx in range(steps_per_tick):
        day = int(round((step_idx + 1) * dt)) - 1
        state.day_offset = day
        event_start = len(state.events)

        executor.move_all(state, dt)
        combat.encounters(state)
        siege.tick(state, dt)

        for aid in list(state.armies.keys()):
            if aid in state.armies:
                supply.tick(state, state.armies[aid], dt)
                if state.army_size(state.armies[aid]) == 0 and state.armies[aid]["laborers"] == 0:
                    state.remove_army(aid)

        executor.check_triggers(state)

        for rule in getattr(state, "rules", ()):
            rule.on_substep(state, dt)

        if step_idx == steps_per_tick - 1 and (state.tick % 3) == 2:
            month_end(state)

        if capture_days:
            frames.append({
                "tick": state.tick,
                "day_offset": day,
                "date": state.date_text(),
                "armies": copy.deepcopy(state.armies),
                "nodes": copy.deepcopy(state.nodes),
                "relations": copy.deepcopy(state.relations),
                "routes": copy.deepcopy(state.routes),
                "events": copy.deepcopy(state.events[event_start:]),
            })

        if state.winner != "":
            break

    state.day_offset = 0
    state.tick += 1


def month_end(state):
    """月末结算：经济 → 围城 → 外交 → 商路 → 城邦叛服 → Buff → 规则钩子 → 胜利判定 → 历史快照。"""
    economy.economy_monthly(state)
    siege.monthly(state)
    economy.diplomacy_monthly(state)
    economy.trade_monthly(state)
    economy.citystate_monthly(state)
    buffs.tick(state)

    rules = getattr(state, "rules", ())
    for rule in rules:
        rule.on_month_end(state)

    if (state.tick + 1) % 9 == 0:
        for rule in rules:
            rule.on_quarter_end(state)

    overridden = False
    for rule in rules:
        if rule.victory_check(state):
            overridden = True
            break
    if not overridden:
        victory.monthly(state)

    sc = victory.score(state)
    for rule in rules:
        ov = rule.score_override(state)
        if ov is not None:
            sc = ov
    state.history.append({
        "month_index": state.tick // 3 + 1,
        "year": state.year(),
        "month": state.month(),
        "han_money": state.factions["han"]["money"],
        "xn_money": state.factions["xiongnu"]["money"],
        "han_vassals": victory.han_vassals(state),
        "xn_vassals": victory.xn_vassals(state),
        "hexi_xn": victory.hexi_held_by_xn(state),
        "han_score": sc["han"],
        "xn_score": sc["xiongnu"],
        "dun_huang_grain": int(state.nodes["dun_huang"]["grain"]),
    })
