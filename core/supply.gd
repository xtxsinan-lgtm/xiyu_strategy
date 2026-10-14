extends RefCounted
# 后勤：携粮、民夫、消耗、补给点、断粮减员、地形减员。每 tick（1/3 月）调用。

static func carry_cap(state, a: Dictionary) -> float:
	return state.army_size(a) * state.bal["food"]["soldier_carry"] + a["laborers"] * state.bal["food"]["laborer_carry"]

static func need_per_month(state, a: Dictionary, on_pasture := false) -> float:
	var f: Dictionary = state.bal["food"]
	var horses_off: float = 0.0 if on_pasture else float(a["horses"])
	return state.army_size(a) * f["soldier_per_month"] + a["laborers"] * f["laborer_per_month"] + horses_off * f["horse_fodder_per_month_off_pasture"]

## 携粮可支撑月数（UI 与 AI 共用）；匈奴把马匹也算作口粮储备。
static func t_max(state, a: Dictionary) -> float:
	var need = need_per_month(state, a, a["faction"] == "xiongnu")
	if need <= 0:
		return 99.0
	var stock: float = a["grain"]
	if a["faction"] == "xiongnu":
		stock += a["horses"] * state.bal["food"]["horse_slaughter_food"] * 0.5
	return stock / need

static func on_pasture(state, a: Dictionary) -> bool:
	if a["loc"].has("node"):
		var n: Dictionary = state.nodes[a["loc"]["node"]]
		return n["pasture_cap"] > 0 and a["faction"] == "xiongnu"
	return state.routes[a["loc"]["route"]]["terrain"] == "steppe"

static func tick(state, a: Dictionary, days := 10.0) -> void:
	if a["is_convoy"] and state.army_size(a) == 0 and a["laborers"] == 0:
		return
	var f: Dictionary = state.bal["food"]
	var third = days / 30.0
	var pasture = on_pasture(state, a)
	var need = need_per_month(state, a, pasture) * third
	# 运输队在补给点就地吃当地粮，不额外装载（避免把刚卸的粮又吸走）
	if a["is_convoy"] and a["loc"].has("node"):
		var cn: Dictionary = state.nodes[a["loc"]["node"]]
		if state.is_supply_node(cn, a["faction"]) and state.stock(cn, a["faction"]) >= need:
			state.set_stock(cn, a["faction"], state.stock(cn, a["faction"]) - need)
			a["starving"] = 0
			return
	# 友方补给点自动补满
	if a["loc"].has("node") and not a["is_convoy"]:
		var n: Dictionary = state.nodes[a["loc"]["node"]]
		if state.is_supply_node(n, a["faction"]):
			var room = carry_cap(state, a) - a["grain"]
			if room > 0:
				var src: float = state.stock(n, a["faction"])
				if n["type"] == "source":
					src = room
				elif a["faction"] == "xiongnu" and n["faction"] != "xiongnu":
					# 向属国征粮：不付钱，但怨恨上升
					src = float(n["grain"])
				var pull = minf(room, src)
				if pull > 0:
					a["grain"] += pull
					if n["type"] != "source":
						if a["faction"] == "xiongnu" and n["faction"] != "xiongnu":
							n["grain"] -= pull
							var r = state.relations.get(n["faction"])
							if r != null:
								r["xn_resentment"] = minf(100.0, r["xn_resentment"] + state.bal["diplomacy"]["levy_grain_resentment"] * third)
						else:
							state.set_stock(n, a["faction"], state.stock(n, a["faction"]) - pull)
	# 匈奴军队在本土牧区就食于部落：不耗粮，马群在春夏回升
	if a["faction"] == "xiongnu" and a["loc"].has("node"):
		var hn: Dictionary = state.nodes[a["loc"]["node"]]
		if hn["type"] == "nomad" and state.is_supply_node(hn, "xiongnu") and _pasture_has_room(state, hn):
			var mounts = 0
			for t in a["units"]:
				mounts += a["units"][t] * int(state.units[t]["horses"])
			if a["horses"] < mounts and state.season() in ["spring", "summer"]:
				a["horses"] = mini(mounts, a["horses"] + int(ceil(mounts * 0.03 * days / 10.0)))
			a["starving"] = 0
			return
	# 匈奴：马奶 + 宰马
	if a["faction"] == "xiongnu":
		var milk: float = a["horses"] * f["milk_per_horse_month"][state.season()] * third
		need = maxf(0.0, need - milk)
	var eat = minf(need, a["grain"])
	a["grain"] -= eat
	need -= eat
	if need > 0.5 and a["faction"] == "xiongnu" and a["horses"] > 0:
		var kill = mini(int(a["horses"]), int(ceil(need / f["horse_slaughter_food"])))
		a["horses"] -= kill
		need -= kill * f["horse_slaughter_food"]
	if need > 0.5:
		a["starving"] += 1
		if a["starving"] == 1:
			state.log_event("starve", "%s 断粮（%d 人，位于 %s）" % [a["name"], state.army_size(a) + a["laborers"], a["loc"].get("node", "路上")], {"army": a["id"]})
		var before = state.army_size(a) + a["laborers"]
		_attrition(state, a, state.bal["attrition"]["no_food_month"] * third, days < 10.0)
		state.stats["starve_losses"] = state.stats.get("starve_losses", 0) + before - state.army_size(a) - a["laborers"]
	else:
		a["starving"] = 0
	# 地形减员
	if a["loc"].has("route"):
		var terr: String = state.routes[a["loc"]["route"]]["terrain"]
		var rate: float = state.bal["attrition"].get(terr + "_month", 0.0)
		if rate > 0:
			var before2 = state.army_size(a) + a["laborers"]
			_attrition(state, a, rate * third, days < 10.0)
			state.stats["terrain_losses"] = state.stats.get("terrain_losses", 0) + before2 - state.army_size(a) - a["laborers"]

static func _pasture_has_room(state, node: Dictionary) -> bool:
	var grazing: int = node["horses"]
	for army in state.armies_at(node["id"]):
		grazing += army["horses"]
	return grazing <= node["pasture_cap"]


static func _loss(a: Dictionary, key: String, amount: float, fractional: bool) -> int:
	if not fractional:
		return int(ceil(amount))
	# 每日不足一人的损耗结转，避免小部队每天被向上取整。
	var remainder: Dictionary = a.get("attrition_remainder", {})
	var total: float = amount + float(remainder.get(key, 0.0))
	var lost := int(floor(total))
	remainder[key] = total - lost
	a["attrition_remainder"] = remainder
	return lost

static func _attrition(state, a: Dictionary, frac: float, fractional := false) -> void:
	for t in a["units"].keys():
		var lost = _loss(a, t, a["units"][t] * frac, fractional)
		a["units"][t] = maxi(0, a["units"][t] - lost)
		var per_horse: int = int(state.units[t]["horses"])
		a["horses"] = maxi(0, a["horses"] - lost * per_horse)
		_count_casualty(state, a["faction"], lost)
	a["laborers"] = maxi(0, a["laborers"] - _loss(a, "laborers", a["laborers"] * frac, fractional))

static func _count_casualty(state, faction: String, n: int) -> void:
	if faction == "han":
		state.stats["han_casualties"] += n
	elif faction == "xiongnu":
		state.stats["xn_casualties"] += n
