"""规则集注册表（Ruleset Registry）。

- `baseline`：不加载任何新规则插件，100% 沿用现有 Godot 规则（W1 现状校准基线）。
- W2 阶段可在此注册 `s01`–`s06` 或组合规则集 `design_v1`。
"""
from ..engine.resolver import RulesetPlugin
from .v1 import V1RulesetPlugin

RULESET_REGISTRY = {
    "baseline": [],
    "v1": [V1RulesetPlugin],
    "design_v1": [V1RulesetPlugin],
    "v1_all": [V1RulesetPlugin],
}


def register_ruleset(name, plugin_classes):
    """注册一个规则集名称到插件类列表的映射。"""
    RULESET_REGISTRY[name] = list(plugin_classes)


def build_rules(ruleset_name, params=None):
    """根据规则集名称实例化插件列表（支持用逗号拼接，如 's01,s02'）。"""
    if not ruleset_name or ruleset_name == "baseline":
        return []
    parts = [p.strip() for p in ruleset_name.split(",") if p.strip()]
    plugins = []
    for p in parts:
        if p == "baseline":
            continue
        if p not in RULESET_REGISTRY:
            raise ValueError("未知的 ruleset: %s（已注册：%s）" % (p, ", ".join(sorted(RULESET_REGISTRY.keys()))))
        for cls in RULESET_REGISTRY[p]:
            inst = cls(params) if callable(cls) and not isinstance(cls, RulesetPlugin) else cls
            plugins.append(inst)
    return plugins


def attach_rules(state, ruleset_name="baseline"):
    """为 GameState 挂载并初始化指定规则集插件。"""
    state.rules = build_rules(ruleset_name, state.params)
    for r in state.rules:
        r.setup(state)
    return state
