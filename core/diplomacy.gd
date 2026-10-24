extends RefCounted
# 外交：影响力 / 威吓 / 怨恨；赏赐、册封、属国、臣服、税率、购粮；月度被动变化。

const Buffs = preload("res://core/buff_system.gd")

static func _d(state) -> Dictionary:
	return state.bal["diplomacy"]

static func mult(state, sid: String) -> float:
	return _d(state)["great_threshold_mult"] if state.kind_of(sid) == "great" else 1.0

static func gift_gain(state, rel: Dictionary, units: int) -> float:
	var d = _d(state)
	var inf: float = rel["han_influence"]
	for i in units:
		inf += d["gift_unit_influence"] * (1.0 - inf / d["influence_max"])
	return minf(inf, d["influence_max"]) - rel["han_influence"]

static func can_enfeoff(state, sid: String) -> String:
	var rel: Dictionary = state.relations.get(sid, {})
	if rel.is_empty():
		return "不是可外交对象"
	var d = _d(state)
	if rel["han_status"] == "enfeoffed" or rel["overlord"] == "han":
		return "已册封或已是属国"
	if rel["han_influence"] < d["enfeoff_min_influence"] * mult(state, sid):
		return "影响力不足（需 %d）" % int(d["enfeoff_min_influence"] * mult(state, sid))
	if state.factions["han"]["money"] < d["enfeoff_cost_money"]:
		return "钱不足"
	return ""

static func can_vassal(state, sid: String) -> String:
	var rel: Dictionary = state.relations.get(sid, {})
	if rel.is_empty():
		return "不是可外交对象"
	var d = _d(state)
	if rel["overlord"] == "han":
		return "已是汉属国"
	var m = mult(state, sid)
	if rel["han_influence"] < d["vassal_min_influence"] * m:
		return "影响力不足（需 %d）" % int(d["vassal_min_influence"] * m)
	if rel["han_influence"] < rel["xn_intimidation"] + d["vassal_margin_over_intimidation"] * m:
		return "影响力须高出匈奴威吓 %d" % int(d["vassal_margin_over_intimidation"] * m)
	return ""

static func can_demand(state, sid: String) -> String:
	var rel: Dictionary = state.relations.get(sid, {})
	if rel.is_empty():
		return "不是可外交对象"
	var d = _d(state)
	if rel["overlord"] == "xiongnu":
		return "已是匈奴属国"
	var m = mult(state, sid)
	if rel["xn_intimidation"] < d["xn_vassal_min_intimidation"] * m:
		return "威吓不足（需 %d）" % int(d["xn_vassal_min_intimidation"] * m)
	if rel["xn_intimidation"] <= rel["han_influence"]:
		return "威吓须高于汉影响力"
	return ""

static func gift(state, sid: String, units: int) -> void:
	var rel: Dictionary = state.relations[sid]
	state.factions["han"]["money"] -= units * _d(state)["gift_unit_money"]
	rel["han_influence"] += gift_gain(state, rel, units)
	state.log_event("diplomacy", "汉赏赐%s，影响力 %d" % [state.factions[sid]["name"], int(rel["han_influence"])], {"state": sid})

static func enfeoff(state, sid: String) -> void:
	var d = _d(state)
	var rel: Dictionary = state.relations[sid]
	state.factions["han"]["money"] -= d["enfeoff_cost_money"]
	rel["han_influence"] -= d["enfeoff_cost_influence"]
	rel["han_status"] = "enfeoffed"
	Buffs.apply(state, "han_enfeoffed", sid, {"amount": d["enfeoff_influence_month"]})
	state.log_event("diplomacy", "汉册封%s" % state.factions[sid]["name"], {"state": sid})

static func make_vassal(state, sid: String) -> void:
	var d = _d(state)
	var rel: Dictionary = state.relations[sid]
	rel["han_influence"] -= d["vassal_cost_influence"]
	rel["overlord"] = "han"
	rel["tax_level"] = 0
	state.log_event("diplomacy", "%s 成为汉属国" % state.factions[sid]["name"], {"state": sid})

static func demand_vassal(state, sid: String) -> void:
	var rel: Dictionary = state.relations[sid]
	if rel["overlord"] == "han":
		state.log_event("diplomacy", "%s 被迫改附匈奴" % state.factions[sid]["name"], {"state": sid})
	rel["overlord"] = "xiongnu"
	rel["han_status"] = "none"
	Buffs.remove_all(state, "han_enfeoffed", sid)
	state.log_event("diplomacy", "%s 臣服匈奴" % state.factions[sid]["name"], {"state": sid})

static func buy_grain_price(state, sid: String) -> float:
	var rel: Dictionary = state.relations[sid]
	if rel["overlord"] == "han":
		return state.bal["grain_price"]["vassal_money_per_100"]
	return state.bal["grain_price"]["enfeoffed_money_per_100"]

# ---------- 月度被动 ----------
static func monthly(state) -> void:
	var d = _d(state)
	# 匈奴军队威吓辐射（月末位置）
	var presence = {}  # state id -> 累加
	for id in state.armies:
		var a: Dictionary = state.armies[id]
		if a["faction"] != "xiongnu" or a["is_convoy"] or not a["loc"].has("node"):
			continue
		var here: String = a["loc"]["node"]
		var near = [here] + state.near_neighbors(here)
		var seen = {}
		for nid in near:
			var sid: String = state.nodes[nid]["faction"]
			if not state.relations.has(sid) or seen.has(sid):
				continue
			seen[sid] = true
			var pop = 0
			for n in state.nodes_of_state(sid):
				pop += n["pop"]
			if pop <= 0:
				continue
			presence[sid] = presence.get(sid, 0.0) + d["xn_presence_intimidation_per_10pct"] * (float(state.army_size(a)) / pop / 0.1)
	for sid in state.relations:
		var rel: Dictionary = state.relations[sid]
		rel["xn_intimidation"] = maxf(0.0, rel["xn_intimidation"] - d["intimidation_decay_month"])
		rel["xn_resentment"] = maxf(0.0, rel["xn_resentment"] - d["resentment_decay_month"])
		if presence.has(sid):
			rel["xn_intimidation"] = minf(100.0, rel["xn_intimidation"] + minf(presence[sid], d["xn_presence_cap_month"]) + d["intimidation_decay_month"])
		# 匈奴属国征税
		if rel["overlord"] == "xiongnu" and rel["tax_level"] > 0:
			var tr: Dictionary = d["tax_rates"][int(rel["tax_level"])]
			var pop2 = 0
			for n2 in state.nodes_of_state(sid):
				pop2 += n2["pop"]
			state.factions["xiongnu"]["money"] += int(pop2 * tr["money"] * 100.0 / 100.0)
			rel["xn_resentment"] = minf(100.0, rel["xn_resentment"] + tr["res"])
		rel["han_influence"] = clampf(rel["han_influence"], 0.0, d["influence_max"])
		rel["xn_intimidation"] = clampf(rel["xn_intimidation"], 0.0, 100.0)
