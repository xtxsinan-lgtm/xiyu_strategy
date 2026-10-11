extends RefCounted
# Buff 引擎（设计 §7）。定义在 data/buffs.json，回调在本文件 CALLBACKS 中以静态函数实现。
# 实例：{id, scope, target, remaining, params}。scope: global / state（target=国家id）/ node（target=节点id）。
# ctx 约定：{state, buff, target, params}，回调可读写 state。
# period=month 的 Buff 每月末执行 on_turn，period=turn（默认）每个玩家回合初执行；duration 的单位与 period 一致。

const MAX_STACKS := 5

## 添加 Buff。叠加规则：unique=已存在则忽略；refresh=刷新持续时间；stack=可叠加（上限 MAX_STACKS）。返回实例或空字典。
static func add(state, def_id: String, target := "", override_params := {}) -> Dictionary:
	var def: Dictionary = state.buff_defs[def_id]
	var existing := find(state, def_id, target)
	var rule: String = def.get("stack", "unique")
	if not existing.is_empty():
		match rule:
			"unique":
				return {}
			"refresh":
				existing["remaining"] = int(def["duration"])
				return existing
			"stack":
				if count(state, def_id, target) >= MAX_STACKS:
					return {}
	var params: Dictionary = def.get("params", {}).duplicate()
	params.merge(override_params, true)
	var b := {"id": def_id, "scope": def["scope"], "target": target, "remaining": int(def["duration"]), "params": params}
	state.buffs.append(b)
	_call(state, def.get("on_apply", ""), b)
	return b

static func find(state, def_id: String, target := "") -> Dictionary:
	for b in state.buffs:
		if b["id"] == def_id and b["target"] == target:
			return b
	return {}

static func has(state, def_id: String, target := "") -> bool:
	return not find(state, def_id, target).is_empty()

static func count(state, def_id: String, target := "") -> int:
	var c := 0
	for b in state.buffs:
		if b["id"] == def_id and b["target"] == target:
			c += 1
	return c

## 汇总某个数值参数（如 farm_mult）：多个实例按乘积。
static func product(state, param: String, target: String) -> float:
	var v := 1.0
	for b in state.buffs:
		if b["target"] == target and b["params"].has(param):
			v *= float(b["params"][param])
	return v

static func remove(state, b: Dictionary) -> void:
	var def: Dictionary = state.buff_defs[b["id"]]
	_call(state, def.get("on_remove", ""), b)
	state.buffs.erase(b)

## 执行指定周期（"turn"/"month"）的 Buff：先 on_turn，再递减持续时间，到期则移除。
static func tick(state, period: String) -> void:
	for b in state.buffs.duplicate():
		var def: Dictionary = state.buff_defs[b["id"]]
		if def.get("period", "turn") != period:
			continue
		_call(state, def.get("on_turn", ""), b)
		if b["remaining"] > 0:
			b["remaining"] -= 1
			if b["remaining"] == 0:
				remove(state, b)

static func _call(state, cb: String, b: Dictionary) -> void:
	if cb == "":
		return
	var ctx := {"state": state, "buff": b, "target": b["target"], "params": b["params"]}
	match cb:
		"influence_tick": _influence_tick(ctx)
		"farm_expand_finish": _farm_expand_finish(ctx)
		"season_winter": _season_winter(ctx)
		_: push_error("未知 Buff 回调: " + cb)

# ---------- 回调 ----------
## 册封/和亲：每月对目标国增加汉影响力（受上限约束）；若该国已非独立于汉（被匈奴收为属国）则不再生效。
static func _influence_tick(ctx: Dictionary) -> void:
	var s = ctx["state"]
	var rel: Dictionary = s.relations.get(ctx["target"], {})
	if rel.is_empty() or rel["overlord"] == "xiongnu":
		return
	rel["han_influence"] = minf(float(s.bal["diplomacy"]["influence_max"]), float(rel["han_influence"]) + float(ctx["params"]["amount"]))

## 屯田扩建完成：开垦度 += amount（上限 1.0）。
static func _farm_expand_finish(ctx: Dictionary) -> void:
	var s = ctx["state"]
	var n: Dictionary = s.nodes[ctx["target"]]
	n["farm_dev"] = minf(1.0, float(n["farm_dev"]) + float(ctx["params"]["amount"]))
	n["colonies"] += 1
	n["levied_out"] = maxi(0, int(n["levied_out"]) - int(ctx["params"].get("labor", 0)))
	s.log_event("farm", "%s 屯田扩建完成，开垦度 %.2f" % [n["name"], n["farm_dev"]], {"node": n["id"]})

## 冬季：枯草、封山路。写入 state.season_flags，供经济/移动查询；非冬季自动清除。
static func _season_winter(ctx: Dictionary) -> void:
	ctx["state"].season_flags["winter"] = ctx["state"].is_winter()
