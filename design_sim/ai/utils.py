"""AI 共用工具函数 —— 移植自 ai/ai_utils.gd。"""
from ..engine import combat


def field_armies(state, faction):
    return [
        a for a in state.armies.values()
        if a["faction"] == faction and not a["is_convoy"] and state.army_size(a) > 0
    ]


def is_idle(a):
    steps = a["plan"]["steps"]
    return (not steps) or (
        len(steps) == 1 and steps[0]["type"] == "hold" and steps[0].get("until", "") == "end"
    )


def at_node(a):
    return a["loc"]["node"] if "node" in a["loc"] else ""


def enemy_threat_at(state, node_id, enemy, horizon_days):
    total = 0.0
    for a in field_armies(state, enemy):
        frm = at_node(a) if "node" in a["loc"] else a["loc"]["to"]
        days = state.days_to(frm, node_id, combat.army_speed(state, a), True)
        if days <= horizon_days:
            total += combat.strength(state, a)
    return total


def garrison_strength(state, node_id, faction):
    s = 0.0
    for a in state.armies_at(node_id):
        if a["faction"] == faction and not a["is_convoy"]:
            s += combat.strength(state, a)
    return s


def militia_strength(state, node):
    return combat.strength_units(state, node["militia"])


def months_between(state, a, b, speed=1.0):
    return state.days_to(a, b, speed, True) / 30.0


def need_grain(state, soldiers, laborers, horses, months):
    f = state.bal["food"]
    return (
        soldiers * f["soldier_per_month"]
        + laborers * f["laborer_per_month"]
        + horses * f["horse_fodder_per_month_off_pasture"]
    ) * months


def count_units(a, unit_type):
    return int(a["units"].get(unit_type, 0))
