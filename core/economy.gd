extends RefCounted
# 月度经济：农业（秋收）、人口消耗、牧业（马奶/宰马/增长）、汉年度拨款。

const Buffs = preload("res://core/buff_system.gd")

static func farm_workers(state, n: Dictionary) -> float:
	var ratio: float = state.bal["food"]["labor_ratio_city"]
	return maxf(0.0, minf(float(n["farm_cap"]) * n["farm_dev"], n["pop"] * ratio - n["levied_out"]))

static func farm_output_year(state, n: Dictionary) -> float:
	var out: float = farm_workers(state, n) * state.bal["food"]["farm_yield_per_worker_year"]
	if Buffs.has(state, "sacked", n["id"]):
		out *= Buffs.param(state, "sacked", n["id"], "farm_mult", 0.5)
	return out

static func colony_output_year(state, n: Dictionary) -> float:
	if n["colonies"] <= 0:
		return 0.0
	var room = maxf(0.0, float(n["farm_cap"]) - farm_workers(state, n))
	var workers = minf(float(n["colonies"]), room)
	return workers * state.bal["food"]["farm_yield_per_worker_year"]

static func monthly(state) -> void:
	var month: int = state.month()
	var season: String = state.season()
	var f: Dictionary = state.bal["food"]
	if month == 1:
		_new_year(state)
	for id in state.nodes:
		var n: Dictionary = state.nodes[id]
		if n["type"] == "source" or n["type"] == "pass":
			continue
		_node_month(state, n, month, season, f)

static func _node_month(state, n: Dictionary, month: int, season: String, f: Dictionary) -> void:
	# 秋收
	if month == state.bal["calendar"]["harvest_month"] and n["under_siege_by"] == "":
		n["grain"] += farm_output_year(state, n)
		var c = colony_output_year(state, n)
		if c > 0:
			n["depot"]["han"] = n["depot"].get("han", 0.0) + c
	# 牧业：马奶 + 自养羊群 → 抵消口粮
	var need: float = n["pop"] * f["civilian_per_month"]
	var cap: int = n["pasture_cap"]
	if cap > 0 and n["horses"] > 0:
		need -= n["horses"] * f["milk_per_horse_month"][season]
	if n["type"] == "nomad":
		need -= n["pop"] * f["pastoral_self_per_pop_month"]
	need = maxf(0.0, need)
	var eat = minf(need, n["grain"])
	n["grain"] -= eat
	need -= eat
	if need > 0.5 and n["horses"] > 0 and cap > 0:
		var kill = mini(int(n["horses"]), int(ceil(need / f["horse_slaughter_food"])))
		n["horses"] -= kill
		need -= kill * f["horse_slaughter_food"]
	if need > 0.5 and n["pop"] > 0:
		n["starving"] = true
		n["starve_streak"] += 1
		n["pop"] = int(n["pop"] * (1.0 - state.bal["pop"]["starve_loss_month"]))
		n["starved_year"] = true
	else:
		n["starving"] = false
		n["starve_streak"] = 0
	# 马匹增长/超载
	if cap > 0:
		if float(month) in state.bal["calendar"]["spring_months"]:
			n["horses"] += n["horses"] * state.bal["horses"]["spring_growth"] / 3.0 * maxf(0.0, 1.0 - float(n["horses"]) / cap)
			n["horses"] = int(n["horses"])
		if n["horses"] > cap:
			n["horses"] -= int((n["horses"] - cap) * state.bal["horses"]["overgraze_death_month"])
	# 招募额度回流（牧民轮换）
	for k in n["recruited"].keys():
		if k != "tuntian":
			n["recruited"][k] = int(n["recruited"][k] * 0.92)

static func _new_year(state) -> void:
	for id in state.nodes:
		var n: Dictionary = state.nodes[id]
		if not n.has("pop_cap"):
			n["pop_cap"] = int(n["pop"] * state.bal["pop"]["cap_mult"])
		if n["pop"] > 0 and not n.get("starved_year", false) and n["pop"] < n["pop_cap"]:
			n["pop"] = int(n["pop"] * (1.0 + state.bal["pop"]["growth_year_if_surplus"]))
		n["starved_year"] = false
		# 本地民兵按年恢复
		var fid: String = n["faction"]
		var kind: String = state.kind_of(fid)
		if kind == "citystate" or kind == "great":
			var ratio: float = state.bal["local_militia_ratio"] if kind == "citystate" else state.bal["great_militia_ratio"]
			var total = int(n["pop"] * ratio)
			if kind == "citystate":
				n["militia"] = {"infantry": total / 2, "crossbow": total - total / 2}
			else:
				n["militia"] = {"cavalry": int(total * 0.7), "infantry": total - int(total * 0.7)}
	var h: Dictionary = state.bal["han"]
	if state.turn > 0 or state.tick > 0:
		state.factions["han"]["money"] += h["annual_money"]
		for t in h["central_regen_year"]:
			state.central[t] = mini(int(h["central_cap"][t]), int(state.central.get(t, 0)) + int(h["central_regen_year"][t]))
