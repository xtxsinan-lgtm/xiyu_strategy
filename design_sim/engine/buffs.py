"""Buff 骨架 —— 移植自 core/buff_system.gd（按月 tick）。新规则模块可用 register_handler 增加 handler。"""

HANDLERS = {}


def register_handler(name, fn):
    HANDLERS[name] = fn


def apply(state, def_id, target, params=None):
    d = state.buff_defs[def_id]
    for b in state.buffs:
        if b["def"] == def_id and b["target"] == target:
            stack = d.get("stack", "refresh")
            if stack == "unique":
                return b
            if stack == "refresh":
                b["turns_left"] = int(d.get("duration", -1))
                return b
    p = dict(d.get("params", {}))
    p.update(params or {})
    buff = {"def": def_id, "target": target, "turns_left": int(d.get("duration", -1)), "params": p}
    state.buffs.append(buff)
    _call(state, d.get("on_apply", ""), buff)
    return buff


def has(state, def_id, target):
    for b in state.buffs:
        if b["def"] == def_id and b["target"] == target:
            return True
    return False


def param(state, def_id, target, key, default):
    for b in state.buffs:
        if b["def"] == def_id and b["target"] == target:
            return b["params"].get(key, default)
    return default


def remove_all(state, def_id, target):
    state.buffs = [b for b in state.buffs if not (b["def"] == def_id and b["target"] == target)]


def tick(state):
    keep = []
    for b in state.buffs:
        d = state.buff_defs[b["def"]]
        _call(state, d.get("on_turn", ""), b)
        if b["turns_left"] > 0:
            b["turns_left"] -= 1
            if b["turns_left"] == 0:
                _call(state, d.get("on_remove", ""), b)
                continue
        keep.append(b)
    state.buffs = keep


def _influence_tick(state, buff):
    r = state.relations.get(buff["target"])
    if r is not None:
        r["han_influence"] = min(state.bal["diplomacy"]["influence_max"], r["han_influence"] + buff["params"]["amount"])


def _farm_expand_finish(state, buff):
    n = state.nodes.get(buff["target"])
    if n is not None:
        cap = n["farm_cap_base"] * state.bal["farm"]["potential_mult"]
        n["farm_cap"] = int(min(cap, n["farm_cap"] + buff["params"]["amount"]))


def _call(state, handler, buff):
    fn = HANDLERS.get(handler)
    if fn:
        fn(state, buff)


register_handler("influence_tick", _influence_tick)
register_handler("farm_expand_finish", _farm_expand_finish)
# season_winter 在 Godot 中为空回调（审计 §9-7），此处同样不注册。
