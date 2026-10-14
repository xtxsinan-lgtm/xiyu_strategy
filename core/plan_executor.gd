extends RefCounted
# 常备指令执行：移动、步骤推进、触发器。回合中途玩家不能干预，军队只按 ArmyPlan 行事。

const Path = preload("res://core/pathfinding.gd")
const Combat = preload("res://core/combat.gd")
const Supply = preload("res://core/supply.gd")
const Siege = preload("res://core/siege.gd")

static func current_step(a: Dictionary) -> Variant:
	var s: Array = a["plan"]["steps"]
	return s[0] if not s.is_empty() else null

static func advance(a: Dictionary) -> void:
	if not a["plan"]["steps"].is_empty():
		a["plan"]["steps"].pop_front()
	a["plan"]["step_ticks"] = 0
	a["path"] = []

static func _pos_a(route: Dictionary, from_id: String, prog: float) -> float:
	return prog if route["a"] == from_id else 1.0 - prog

static func _has_hostile_at(state, node_id: String, f: String) -> bool:
	for e in state.armies_at(node_id):
		if state.is_hostile(e["faction"], f) and state.army_size(e) > 0:
			return true
	return false

## 移动阶段：所有军队前进一旬。
static func move_all(state, days := 10.0) -> void:
	for id in state.armies.keys():
		if not state.armies.has(id):
			continue
		var a: Dictionary = state.armies[id]
		a["trace"] = []
		_advance_plan(state, a, days)

static func _advance_plan(state, a: Dictionary, days_left: float) -> void:
	var guard = 0
	while days_left > 0.001 and guard < 24:
		guard += 1
		var step = current_step(a)
		if step == null:
			a["status"] = "idle"
			if a["is_convoy"]:
				_disband_convoy(state, a)
			return
		var here: String = a["loc"]["node"] if a["loc"].has("node") else ""
		match step["type"]:
			"move_to", "return_to":
				if here == step["node"]:
					advance(a)
					continue
				days_left = _travel(state, a, step["node"], days_left)
				if a["loc"].has("node") and a["loc"]["node"] == step["node"]:
					advance(a)
					continue
				return
			"hold":
				var tn: String = step.get("node", here)
				if tn != "" and here != tn:
					days_left = _travel(state, a, tn, days_left)
					if a["loc"].has("node") and a["loc"]["node"] == tn:
						continue
					return
				a["status"] = "holding"
				if step.get("until", "") != "end" and step.get("months", 0) > 0:
					step["days"] = step.get("days", 0.0) + days_left
					if step["days"] >= step["months"] * 30.0:
						advance(a)
				return
			"siege", "burn", "ambush", "deliver", "loop_convoy":
				var tgt: String = step.get("node", step.get("to", here))
				if step["type"] == "loop_convoy":
					days_left = _loop_convoy(state, a, step, days_left)
					return
				if here != tgt:
					days_left = _travel(state, a, tgt, days_left)
					if not (a["loc"].has("node") and a["loc"]["node"] == tgt):
						return
					continue
				match step["type"]:
					"siege":
						a["status"] = "sieging"
						return
					"burn":
						Siege.burn(state, a, state.nodes[tgt])
						advance(a)
						continue
					"ambush":
						a["status"] = "ambushing"
						step["days"] = step.get("days", 0.0) + days_left
						if step["days"] >= step.get("months", 1) * 30.0:
							advance(a)
						return
					"deliver":
						_unload(state, a, state.nodes[tgt])
						advance(a)
						continue
			_:
				advance(a)

static func army_speed(state, a: Dictionary) -> float:
	return Combat.army_speed(state, a)

## 沿最短路向 target 移动，返回剩余天数。
static func _travel(state, a: Dictionary, target: String, days_left: float) -> float:
	var speed = army_speed(state, a)
	var guard = 0
	while days_left > 0.001 and guard < 16:
		guard += 1
		var loc: Dictionary = a["loc"]
		if loc.has("node"):
			if loc["node"] == target:
				return days_left
			if a["path"].is_empty() or a["path"].back() != target:
				a["path"] = Path.path_to(state, loc["node"], target, speed)
				if a["path"].is_empty():
					a["status"] = "blocked"
					return 0.0
			var nxt: String = a["path"][0]
			var idx: int = state.route_between(loc["node"], nxt)
			if state.route_closed(idx):
				a["status"] = "blocked"
				a["path"] = []
				return 0.0
			a["loc"] = {"route": idx, "from": loc["node"], "to": nxt, "prog": 0.0}
			loc = a["loc"]
		else:
			# 在路上：必要时掉头
			if a["path"].is_empty() or a["path"].back() != target:
				var r: Dictionary = state.routes[loc["route"]]
				var cost_to = (1.0 - loc["prog"]) * Path.travel_days(r, speed) + Path.days_to(state, loc["to"], target, speed)
				var cost_from = loc["prog"] * Path.travel_days(r, speed) + Path.days_to(state, loc["from"], target, speed)
				if cost_from < cost_to:
					var f: String = loc["from"]
					loc["from"] = loc["to"]
					loc["to"] = f
					loc["prog"] = 1.0 - loc["prog"]
				var rest = Path.path_to(state, loc["to"], target, speed, {}, true)
				a["path"] = [loc["to"]] + rest
		var r2: Dictionary = state.routes[a["loc"]["route"]]
		var loc2: Dictionary = a["loc"]
		a["status"] = "moving"
		var route_speed := Path.route_speed(r2, speed)
		var dneed: float = (1.0 - loc2["prog"]) * Path.travel_days(r2, speed)
		var p0 = _pos_a(r2, loc2["from"], loc2["prog"])
		if days_left >= dneed:
			days_left -= dneed
			var p1 = _pos_a(r2, loc2["from"], 1.0)
			a["trace"].append({"route": loc2["route"], "p0": p0, "p1": p1})
			a["prev_node"] = loc2["from"]
			var arrive: String = loc2["to"]
			a["loc"] = {"node": arrive}
			if not a["path"].is_empty():
				a["path"].pop_front()
			if _has_hostile_at(state, arrive, a["faction"]):
				return 0.0
			if arrive == target:
				return days_left
		else:
			loc2["prog"] += days_left * route_speed / r2["days"]
			var p2 = _pos_a(r2, loc2["from"], loc2["prog"])
			a["trace"].append({"route": loc2["route"], "p0": p0, "p1": p2})
			return 0.0
	return days_left

static func return_ration(state, a: Dictionary, node: Dictionary) -> float:
	if not a["is_convoy"]:
		return 0.0
	var home = ""
	for step in a["plan"]["steps"]:
		if step["type"] == "loop_convoy":
			home = step["from"]
			break
		if step["type"] == "return_to":
			home = step["node"]
			break
	if home == "" or home == node["id"]:
		return 0.0
	var days = Path.days_to(state, node["id"], home, army_speed(state, a), true)
	return Supply.need_per_month(state, a) * (ceil(days) + 1.0) / 30.0

static func _unload(state, a: Dictionary, node: Dictionary) -> void:
	if a["grain"] > 0:
		var f: String = a["faction"]
		if state.controller(node) == f or node["type"] == "source":
			var ration = minf(a["grain"], return_ration(state, a, node))
			state.set_stock(node, f, state.stock(node, f) + a["grain"] - ration)
			state.log_event("deliver", "%s 运粮 %d 至 %s" % [a["name"], int(a["grain"] - ration), node["name"]], {"node": node["id"]})
			a["grain"] = ration

static func _loop_convoy(state, a: Dictionary, step: Dictionary, days_left: float) -> float:
	# phase: "load" 在起点装粮 → "go" → 卸粮 → "back"
	var f: String = a["faction"]
	var phase: String = step.get("phase", "load")
	var here: String = a["loc"]["node"] if a["loc"].has("node") else ""
	if phase == "load":
		if here != step["from"]:
			days_left = _travel(state, a, step["from"], days_left)
			return days_left if (a["loc"].has("node") and a["loc"]["node"] == step["from"]) else 0.0
		var node: Dictionary = state.nodes[step["from"]]
		var cap = Supply.carry_cap(state, a) - a["grain"]
		var want = minf(cap, float(step.get("grain_per_trip", cap)))
		var have: float = state.stock(node, f) if node["type"] != "source" else want
		var take = minf(want, have)
		if take > 0:
			a["grain"] += take
			if node["type"] != "source":
				state.set_stock(node, f, state.stock(node, f) - take)
			step["phase"] = "go"
		return 0.0
	if phase == "go":
		if here != step["to"]:
			days_left = _travel(state, a, step["to"], days_left)
			if not (a["loc"].has("node") and a["loc"]["node"] == step["to"]):
				return 0.0
		_unload(state, a, state.nodes[step["to"]])
		step["phase"] = "back"
		return days_left
	# back
	if here != step["from"]:
		days_left = _travel(state, a, step["from"], days_left)
		if not (a["loc"].has("node") and a["loc"]["node"] == step["from"]):
			return 0.0
	step["phase"] = "load"
	return days_left

static func _disband_convoy(state, a: Dictionary) -> void:
	if not a["loc"].has("node") or not state.armies.has(a["id"]):
		return
	var n: Dictionary = state.nodes[a["loc"]["node"]]
	if state.controller(n) == a["faction"] and state.army_size(a) == 0:
		if a["grain"] > 0:
			_unload(state, a, n)
		var src: Dictionary = state.nodes.get(a.get("convoy_home", n["id"]), n)
		src["levied_out"] = maxi(0, src["levied_out"] - a["laborers"])
		state.remove_army(a["id"])

# ---------- 触发器 ----------
static func check_triggers(state) -> void:
	var enemies = {}
	for f in ["han", "xiongnu"]:
		enemies[f] = []
	for id in state.armies:
		var e: Dictionary = state.armies[id]
		if not e["is_convoy"] and state.army_size(e) > 0:
			var nid: String = e["loc"]["node"] if e["loc"].has("node") else e["loc"]["to"]
			enemies[e["faction"]].append({"node": nid, "str": Combat.strength(state, e)})
	for id in state.armies.keys():
		if not state.armies.has(id):
			continue
		var a: Dictionary = state.armies[id]
		var plan: Dictionary = a["plan"]
		if plan["triggers"].is_empty():
			continue
		for trg in plan["triggers"]:
			if _trigger_hit(state, a, trg, enemies):
				_react(state, a, trg)
				break

static func _trigger_hit(state, a: Dictionary, trg: Dictionary, enemies: Dictionary) -> bool:
	match trg["cond"]:
		"supply_low":
			return not a["is_convoy"] and not _at_supply(state, a) and Supply.t_max(state, a) <= trg["months"]
		"losses_high":
			return a["init_size"] > 0 and 1.0 - float(state.army_size(a)) / a["init_size"] >= trg["pct"] and a["init_size"] > 0 and not a["is_convoy"]
		"enemy_near":
			var my = Combat.strength(state, a)
			if my <= 0:
				return false
			var other: String = "xiongnu" if a["faction"] == "han" else "han"
			var here: String = a["loc"]["node"] if a["loc"].has("node") else a["loc"]["to"]
			for e in enemies[other]:
				if e["str"] / my >= trg["ratio"] and state.hops(here, e["node"], int(trg["hops"])) <= int(trg["hops"]):
					return true
			return false
		"target_lost":
			var st = current_step(a)
			return st != null and st["type"] in ["siege", "burn"] and state.controller(state.nodes[st["node"]]) == a["faction"]
	return false

static func _at_supply(state, a: Dictionary) -> bool:
	return a["loc"].has("node") and state.is_supply_node(state.nodes[a["loc"]["node"]], a["faction"])

static func _react(state, a: Dictionary, trg: Dictionary) -> void:
	var react: String = trg["react"]
	var dest = ""
	var here: String = a["loc"]["node"] if a["loc"].has("node") else a["loc"]["from"]
	match react:
		"retreat_origin", "evade_home":
			dest = a["origin"]
		"return_supply":
			dest = _nearest_supply(state, a)
		"skip_step":
			advance(a)
			state.log_event("trigger", "%s 触发 %s：跳过当前步骤" % [a["name"], trg["cond"]], {"army": a["id"]})
			return
	if dest == "":
		dest = a["origin"]
	var keep_engage: Array = a["plan"]["engage"]
	a["plan"] = {"steps": [{"type": "move_to", "node": dest}, {"type": "hold", "node": dest, "until": "end"}], "triggers": [], "engage": keep_engage, "preset": "retreat", "step_ticks": 0, "reacted": true}
	a["path"] = []
	state.log_event("trigger", "%s 触发【%s】→ 撤向 %s" % [a["name"], trg["cond"], state.nodes[dest]["name"]], {"army": a["id"], "trigger": trg["cond"]})

static func _nearest_supply(state, a: Dictionary) -> String:
	var start: String = a["loc"]["node"] if a["loc"].has("node") else a["loc"]["to"]
	var res = Path.dijkstra(state, start, army_speed(state, a), {}, true)
	var best = ""
	var bd = INF
	for nid in res["dist"]:
		var n: Dictionary = state.nodes[nid]
		if state.is_supply_node(n, a["faction"]) and res["dist"][nid] < bd:
			if state.stock(n, a["faction"]) > 0 or n["type"] == "source" or a["faction"] == "xiongnu":
				bd = res["dist"][nid]
				best = nid
	return best
