extends RefCounted
# Buff 骨架：on_apply / on_turn / on_remove 由名字映射到 handler。

static func apply(state, def_id: String, target: String, params := {}) -> Dictionary:
	var def: Dictionary = state.buff_defs[def_id]
	for b in state.buffs:
		if b["def"] == def_id and b["target"] == target:
			match def.get("stack", "refresh"):
				"unique":
					return b
				"refresh":
					b["turns_left"] = def.get("duration", -1)
					return b
	var p: Dictionary = def.get("params", {}).duplicate()
	p.merge(params, true)
	var buff = {"def": def_id, "target": target, "turns_left": int(def.get("duration", -1)), "params": p}
	state.buffs.append(buff)
	_call(state, def.get("on_apply", ""), buff)
	return buff

static func has(state, def_id: String, target: String) -> bool:
	for b in state.buffs:
		if b["def"] == def_id and b["target"] == target:
			return true
	return false

static func param(state, def_id: String, target: String, key: String, default: Variant) -> Variant:
	for b in state.buffs:
		if b["def"] == def_id and b["target"] == target:
			return b["params"].get(key, default)
	return default

static func remove_all(state, def_id: String, target: String) -> void:
	var keep = []
	for b in state.buffs:
		if b["def"] == def_id and b["target"] == target:
			continue
		keep.append(b)
	state.buffs = keep

## 每月调用一次。
static func tick(state) -> void:
	var keep = []
	for b in state.buffs:
		var def: Dictionary = state.buff_defs[b["def"]]
		_call(state, def.get("on_turn", ""), b)
		if b["turns_left"] > 0:
			b["turns_left"] -= 1
			if b["turns_left"] == 0:
				_call(state, def.get("on_remove", ""), b)
				continue
		keep.append(b)
	state.buffs = keep

static func _call(state, handler: String, buff: Dictionary) -> void:
	match handler:
		"influence_tick":
			var r = state.relations.get(buff["target"])
			if r != null:
				r["han_influence"] = minf(state.bal["diplomacy"]["influence_max"], r["han_influence"] + buff["params"]["amount"])
		"farm_expand_finish":
			var n = state.nodes.get(buff["target"])
			if n != null:
				var cap: float = n["farm_cap_base"] * state.bal["farm"]["potential_mult"]
				n["farm_cap"] = int(minf(cap, n["farm_cap"] + buff["params"]["amount"]))
		_:
			pass
