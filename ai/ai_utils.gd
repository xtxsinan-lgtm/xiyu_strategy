extends RefCounted
# AI 共用工具：战力估算、可达范围、威胁、补给可行性。

const Path = preload("res://core/pathfinding.gd")
const Combat = preload("res://core/combat.gd")
const Supply = preload("res://core/supply.gd")
const Cmd = preload("res://core/commands.gd")

static func field_armies(state, f: String) -> Array:
	var out = []
	for id in state.armies:
		var a = state.armies[id]
		if a["faction"] == f and not a["is_convoy"] and state.army_size(a) > 0:
			out.append(a)
	return out

static func is_idle(a: Dictionary) -> bool:
	return a["plan"]["steps"].is_empty() or (a["plan"]["steps"].size() == 1 and a["plan"]["steps"][0]["type"] == "hold" and a["plan"]["steps"][0].get("until", "") == "end")

static func at_node(a: Dictionary) -> String:
	return a["loc"]["node"] if a["loc"].has("node") else ""

## 本回合时长内敌军可到达的节点 → 总战力
static func enemy_threat_at(state, node_id: String, enemy: String, horizon_days: float) -> float:
	var total = 0.0
	for a in field_armies(state, enemy):
		var from = at_node(a) if a["loc"].has("node") else a["loc"]["to"]
		var days = Path.days_to(state, from, node_id, Combat.army_speed(state, a), true)
		if days <= horizon_days:
			total += Combat.strength(state, a)
	return total

static func garrison_strength(state, node_id: String, f: String) -> float:
	var s = 0.0
	for a in state.armies_at(node_id):
		if a["faction"] == f and not a["is_convoy"]:
			s += Combat.strength(state, a)
	return s

static func militia_strength(state, node: Dictionary) -> float:
	return Combat.strength_units(state, node["militia"])

## 出征可行性：携粮 t_max ≥ 往返月数×1.2 + 围城月数
static func months_between(state, a: String, b: String, speed := 1.0) -> float:
	return Path.days_to(state, a, b, speed, true) / 30.0

static func need_grain(state, soldiers: int, laborers: int, horses: int, months: float) -> float:
	var f = state.bal["food"]
	return (soldiers * f["soldier_per_month"] + laborers * f["laborer_per_month"] + horses * f["horse_fodder_per_month_off_pasture"]) * months

static func count_units(a: Dictionary, t: String) -> int:
	return int(a["units"].get(t, 0))
