"""AI 策略工厂与注册表。"""
from .bots import (
    HanAggressiveAI,
    HanConservativeAI,
    HanGreedyAI,
    RandomLegalAI,
    XiongnuAggressiveAI,
    XiongnuConservativeAI,
    XiongnuGreedyAI,
)
from .han_ai import HanAI
from .v1_bots import V1HanAI, V1XiongnuAI
from .xiongnu_ai import XiongnuAI

HAN_BOTS = {
    "baseline": HanAI,
    "aggressive": HanAggressiveAI,
    "conservative": HanConservativeAI,
    "greedy": HanGreedyAI,
    "random_legal": lambda: RandomLegalAI("han"),
}

XIONGNU_BOTS = {
    "baseline": XiongnuAI,
    "aggressive": XiongnuAggressiveAI,
    "conservative": XiongnuConservativeAI,
    "greedy": XiongnuGreedyAI,
    "random_legal": lambda: RandomLegalAI("xiongnu"),
}


class _RulesetAwareBot:
    def __init__(self, base_bot, v1_bot):
        self.base_bot = base_bot
        self.v1_bot = v1_bot

    def think(self, state):
        if "v1" in getattr(state, "ext", {}):
            return self.v1_bot.think(state)
        return self.base_bot.think(state)


def make_bot(faction, name="baseline", ruleset=None):
    table = HAN_BOTS if faction == "han" else XIONGNU_BOTS
    if name not in table:
        raise ValueError("未知的 %s AI 策略: %s（可选：%s）" % (faction, name, ", ".join(sorted(table.keys()))))
    base_inst = table[name]()
    v1_inst = V1HanAI(name) if faction == "han" else V1XiongnuAI(name)
    return _RulesetAwareBot(base_inst, v1_inst)

