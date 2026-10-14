extends RefCounted
# 围城、强攻、攻陷后果、焚田/劫掠。

const Combat = preload("res://core/combat.gd")
const Buffs = preload("res://core/buff_system.gd")

static func _enemy_of_node(state, node: Dictionary, f: String) -> bool:
	var ctl: String = state.controller(node)
	return ctl != f

static func siege_damage_per_tick(state, armies: Array) -> float:
	var dmg = 0.0
	for a in armies:
		for t in a["units"]:
			dmg += a["units"][t] * state.units[t]["siege"]
	return dmg * state.bal["siege"]["siege_damage_k"] / 3.0

## 每 tick：对停在目标节点且当前步骤为 siege 的军队推进围城。
static func tick(state, days := 10.0) -> void:
	var groups = {}  # node id -> {faction -> [armies]}
	for id in state.armies:
		var a: Dictionary = state.armies[id]
		var steps: Array = a["plan"]["steps"]
		if steps.is_empty() or steps[0]["type"] != "siege" or not a["loc"].has("node"):
			continue
		var nid: String = steps[0]["node"]
		if a["loc"]["node"] != nid:
			continue
		if not groups.has(nid):
			groups[nid] = {}
		if not groups[nid].has(a["faction"]):
			groups[nid][a["faction"]] = []
		groups[nid][a["faction"]].append(a)
	for nid in groups:
		var node: Dictionary = state.nodes[nid]
		for f in groups[nid]:
			var armies: Array = groups[nid][f].filter(func(x): return state.armies.has(x["id"]))
			if armies.is_empty():
				continue
			_siege_step(state, node, f, armies, days)

static func _siege_step(state, node: Dictionary, f: String, armies: Array, days := 10.0) -> void:
	var nid: String = node["id"]
	if state.controller(node) == f:
		_finish_step(armies)
		node["under_siege_by"] = ""
		return
	# 仍有敌野战部队同在节点 → 先打野战（遭遇系统已处理），此处不推进围城
	for e in state.armies_at(nid):
		if state.is_hostile(e["faction"], f) and state.army_size(e) > 0:
			return
	var step: Dictionary = armies[0]["plan"]["steps"][0]
	node["under_siege_by"] = f
	step["days"] = step.get("days", 0.0) + days
	node["wall_hp"] = maxf(0.0, node["wall_hp"] - siege_damage_per_tick(state, armies) * days / 10.0)
	var assault_ratio: float = step.get("assault_when", state.bal["siege"]["default_assault_ratio"])
	var ready: bool = node["wall_hp_max"] <= 0.0 or (assault_ratio >= 0.0 and node["wall_hp"] <= assault_ratio * node["wall_hp_max"])
	if ready:
		_assault(state, node, f, armies)
	if step.get("max_months", 0) > 0 and step["days"] >= step["max_months"] * 30.0 and state.controller(node) != f:
		for a in armies:
			if not a["plan"]["steps"].is_empty() and a["plan"]["steps"][0]["type"] == "siege":
				a["plan"]["steps"].pop_front()
				a["plan"]["step_ticks"] = 0
		node["under_siege_by"] = ""
		state.log_event("siege", "围攻%s超时解围" % node["name"])

static func _finish_step(armies: Array) -> void:
	for a in armies:
		if not a["plan"]["steps"].is_empty() and a["plan"]["steps"][0]["type"] == "siege":
			a["plan"]["steps"].pop_front()
			a["plan"]["step_ticks"] = 0

static func _assault(state, node: Dictionary, f: String, armies: Array) -> void:
	var militia: Dictionary = {}
	for t in node["militia"]:
		if node["militia"][t] > 0:
			militia[t] = float(node["militia"][t])
	if Combat.total(militia) <= 0:
		capture(state, node, f)
		_finish_step(armies)
		return
	# 预估：胜算过低则继续围困，不送死
	var ctx = {"b_def": Combat.wall_mult(state, node)}
	var p = Combat.expected_p(state, Combat.merged_units(armies), militia, ctx)
	if p < 0.55:
		return
	var rep = Combat.resolve_battle(state, armies, [], node["name"] + "（强攻）", {"node": node, "militia": militia, "defender": "b", "wall_mult": Combat.wall_mult(state, node), "b_faction": state.controller(node) if state.controller(node) != "" else node["faction"]})
	if rep["winner"] == f:
		capture(state, node, f)
		_finish_step(armies.filter(func(x): return state.armies.has(x["id"])))

static func capture(state, node: Dictionary, attacker: String) -> void:
	var d: Dictionary = state.bal["diplomacy"]
	var old_faction: String = node["faction"]
	var kind: String = state.kind_of(old_faction)
	node["under_siege_by"] = ""
	node["wall_hp"] = node["wall_hp_max"] * 0.5
	state.stats["sieges_won"] += 1
	if kind == "major":
		if old_faction == "han" and "hexi_commandery" in node["tags"]:
			state.stats["hexi_lost"] += 1
		node["faction"] = attacker
		node["grain"] = node["grain"] * 0.5
		node["horses"] = int(node["horses"] * 0.5)
		node["pop"] = int(node["pop"] * 0.9)
		node["militia"] = {}
	elif kind == "citystate":
		var rel: Dictionary = state.relations[old_faction]
		rel["overlord"] = attacker
		rel["han_status"] = "none"
		var loot: float = node["grain"] * 0.5
		if attacker == "han":
			node["depot"]["han"] = node["depot"].get("han", 0.0) + loot * 0.5
			node["grain"] -= loot * 0.5
			for sid in state.relations:
				if sid == old_faction:
					continue
				for n2 in state.nodes_of_state(sid):
					if state.hops(node["id"], n2["id"], d["victory_near_hops"]) <= d["victory_near_hops"]:
						state.relations[sid]["han_influence"] = clampf(state.relations[sid]["han_influence"] + d["han_conquest_influence_neighbor"], 0.0, 100.0)
						break
			rel["han_influence"] = maxf(rel["han_influence"], 25.0)
			rel["xn_intimidation"] = 0.0
		else:
			node["grain"] -= loot
			state.factions["xiongnu"]["money"] += int(node["pop"] * 0.02)
			rel["xn_intimidation"] = minf(100.0, rel["xn_intimidation"] + d["xn_sack_intimidation"])
			rel["xn_resentment"] = minf(100.0, rel["xn_resentment"] + d["xn_sack_resentment"])
			for sid in state.relations:
				if sid == old_faction:
					continue
				for n3 in state.nodes_of_state(sid):
					if state.hops(node["id"], n3["id"], d["victory_near_hops"]) <= d["victory_near_hops"]:
						state.relations[sid]["xn_intimidation"] = minf(100.0, state.relations[sid]["xn_intimidation"] + d["xn_sack_neighbor"])
						break
		var ratio: float = state.bal["local_militia_ratio"] * 0.3
		var tot = int(node["pop"] * ratio)
		node["militia"] = {"infantry": tot / 2, "crossbow": tot - tot / 2}
	else:  # 大国节点：直接易主
		node["faction"] = attacker
		node["militia"] = {}
		node["grain"] = node["grain"] * 0.5
	state.log_event("capture", "%s 攻陷 %s" % [state.factions[attacker]["name"], node["name"]], {"node": node["id"], "by": attacker})

## 月末：围城中的守军断粮
static func monthly(state) -> void:
	for id in state.nodes:
		var node: Dictionary = state.nodes[id]
		var f: String = node["under_siege_by"]
		if f == "":
			continue
		# 围城者已离开
		var present = false
		for a in state.armies_at(id):
			if a["faction"] == f:
				present = true
		if not present:
			node["under_siege_by"] = ""
			continue
		var ctl: String = state.controller(node)
		var food: float = node["grain"] if ctl == node["faction"] or ctl == "" else node["grain"]
		if food <= 0.0:
			for t in node["militia"]:
				node["militia"][t] = int(node["militia"][t] * (1.0 - state.bal["siege"]["starve_attrition"]))
			if state.rng.randf() < state.bal["siege"]["starve_surrender_chance"]:
				var defenders = false
				for e in state.armies_at(id):
					if state.is_hostile(e["faction"], f) and state.army_size(e) > 0:
						defenders = true
				if not defenders:
					capture(state, node, f)

## 焚田/劫牧：军队位于敌方节点
static func burn(state, a: Dictionary, node: Dictionary) -> void:
	var f: String = a["faction"]
	if state.controller(node) == f:
		return
	for e in state.armies_at(node["id"]):
		if state.is_hostile(e["faction"], f) and state.army_size(e) > 0:
			return
	state.stats["raids_" + f] = state.stats.get("raids_" + f, 0) + 1
	var loot: float = minf(node["grain"] * state.bal["raid"]["grain_loot_ratio"], maxf(0.0, preload("res://core/supply.gd").carry_cap(state, a) - a["grain"]))
	node["grain"] -= loot
	a["grain"] += loot
	state.stats["grain_raided_" + f] = state.stats.get("grain_raided_" + f, 0.0) + loot
	if f == "xiongnu":
		state.factions[f]["money"] += int(node["pop"] * state.bal["raid"]["money_per_pop"])
	if node["farm_cap"] > 0:
		node["farm_dev"] = maxf(state.bal["farm"]["min_dev"], node["farm_dev"] - state.bal["farm"]["burn_dev_loss"])
		Buffs.apply(state, "sacked", node["id"])
	if node["pasture_cap"] > 0 and node["horses"] > 0:
		var take = int(node["horses"] * 0.25)
		node["horses"] -= take
		a["horses"] += take
		state.stats["horses_captured"] += take
	node["pop"] = int(node["pop"] * 0.97)
	state.log_event("raid", "%s 劫掠 %s" % [state.factions[f]["name"], node["name"]], {"node": node["id"]})
	if f == "xiongnu":
		var sid: String = node["faction"]
		if state.relations.has(sid):
			state.relations[sid]["xn_resentment"] = minf(100.0, state.relations[sid]["xn_resentment"] + 10.0)
