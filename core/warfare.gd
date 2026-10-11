extends RefCounted
# 军队行动：在途位置（路段+进度）、常备指令触发、接战、攻城与占领。设计 §1.2、§1.1、§4.4–4.5。
# 在途位置格式：loc = {"route": 路段下标, "from": 起点节点, "to": 终点节点, "prog": 已走天数}；在节点时 loc = {"node": id}。

const Pathfinding = preload("res://core/pathfinding.gd")
const Combat = preload("res://core/combat.gd")
const Actions = preload("res://core/actions.gd")
const Buffs = preload("res://core/buffs.gd")
const Economy = preload("res://core/economy.gd")
const Cal = preload("res://core/calendar.gd")

const DAYS_PER_TICK := 10.0

static func step(s) -> void:
	for id in s.armies.keys():
		if s.armies.has(id):
			s.armies[id]["arrived"] = false
			_check_triggers(s, s.armies[id])
	for id in s.armies.keys():
		if s.armies.has(id):
			_move(s, s.armies[id])
	_route_clashes(s)
	for nid in s.nodes:
		_node_clash(s, s.nodes[nid])
	_siege_upkeep(s)

# ---------- 移动 ----------
static func _move(s, a: Dictionary) -> void:
	var budget := DAYS_PER_TICK * Actions.army_speed(s, a)
	var guard := 0
	while budget > 0.0 and guard < 16:
		guard += 1
		if a["loc"].has("node"):
			if a["path"].is_empty():
				a["status"] = "idle"
				return
			var cur: String = a["loc"]["node"]
			var nxt: String = a["path"][0]
			var idx: int = s.route_between(cur, nxt)
			if idx < 0 or s.route_closed(idx):
				a["status"] = "blocked"
				return
			a["prev_node"] = cur
			a["loc"] = {"route": idx, "from": cur, "to": nxt, "prog": 0.0}
		else:
			var l: Dictionary = a["loc"]
			var remain: float = s.route_days(l["route"]) - float(l["prog"])
			if budget >= remain:
				budget -= remain
				a["loc"] = {"node": l["to"]}
				a["arrived"] = true
				a["path"].pop_front()
				a["trace"].append(l["to"])
				if a["is_convoy"] and a["path"].is_empty() and s.controller(s.nodes[l["to"]]) == a["faction"]:
					_unload(s, a)
					return
				var nd: Dictionary = s.nodes[l["to"]]
				if s.is_supply_node(nd, a["faction"]):
					Economy.refill(s, a, nd)
				# 节点上有敌军时必须停下（不能穿过）；进入敌方控制节点后也停下来接战
				for o in s.armies_at(l["to"]):
					if o["faction"] != a["faction"] and not o["is_convoy"] and s.army_size(o) > 0:
						return
				if s.controller(nd) != a["faction"] and s.controller(nd) != "" and s.is_hostile(a["faction"], s.controller(nd)):
					return
			else:
				l["prog"] = float(l["prog"]) + budget
				return

## 运输队抵达：粮入库，民夫回到居民中。
static func _unload(s, a: Dictionary) -> void:
	var n: Dictionary = s.nodes[a["loc"]["node"]]
	s.set_stock(n, a["faction"], s.stock(n, a["faction"]) + float(a["grain"]))
	if a["origin"] != "" and s.nodes[a["origin"]]["type"] != "source":
		n["pop"] += int(a["laborers"])
	s.log_event("convoy", "%s 抵达 %s，运入粮 %d" % [a["name"], n["name"], int(a["grain"])], {"node": n["id"]})
	s.remove_army(a["id"])

## 运输队被敌方战斗部队截获：粮按比例落入截击方行囊（上限行囊容量），运输队覆灭。
static func _intercept(s, hunter: Dictionary, convoy: Dictionary) -> void:
	var take = float(convoy["grain"]) * float(s.bal["combat"]["convoy_capture_ratio"])
	hunter["grain"] = minf(Economy.carry_capacity(s, hunter), float(hunter["grain"]) + take)
	s.convoy_losses += 1
	s.log_event("convoy", "%s 被 %s 截获，损失粮 %d" % [convoy["name"], hunter["name"], int(convoy["grain"])], {"army": convoy["id"]})
	s.remove_army(convoy["id"])

## 路段/节点上：无己方战斗部队护送的运输队，被在场的敌方战斗部队截获。
static func _convoys_check(s, group: Array) -> void:
	for c in group:
		if not c["is_convoy"] or not s.armies.has(c["id"]):
			continue
		var hunter = null
		var escorted = false
		for o in group:
			if o["is_convoy"] or not s.armies.has(o["id"]) or s.army_size(o) == 0:
				continue
			if o["faction"] == c["faction"]:
				escorted = true
			elif hunter == null:
				hunter = o
		if hunter != null and not escorted:
			_intercept(s, hunter, c)

## 路中折返（常备指令撤退时用）：掉头回到出发节点。
static func _reverse(a: Dictionary, s) -> void:
	var l: Dictionary = a["loc"]
	if not l.has("route"):
		return
	a["loc"] = {"route": l["route"], "from": l["to"], "to": l["from"], "prog": s.route_days(l["route"]) - float(l["prog"])}
	a["path"] = [l["from"]]

# ---------- 常备指令（§1.1）----------
static func _anchor(a: Dictionary) -> String:
	return a["loc"]["node"] if a["loc"].has("node") else a["loc"]["to"]

static func _check_triggers(s, a: Dictionary) -> void:
	if a["garrison"] or a["status"] == "retreating":
		return
	if int(a.get("trigger_cd", 0)) > 0:
		a["trigger_cd"] = int(a["trigger_cd"]) - 1
		return
	for t in a["plan"]["triggers"]:
		if _cond(s, a, t):
			_react(s, a, t["react"], t["cond"])
			return

static func _cond(s, a: Dictionary, t: Dictionary) -> bool:
	match t["cond"]:
		"enemy_near":
			var here := _anchor(a)
			var mine := Combat.power(s, a)
			for e in s.armies.values():
				if not s.is_hostile(a["faction"], e["faction"]) or e["garrison"]:
					continue
				if s.hops(here, _anchor(e), int(t["hops"])) <= int(t["hops"]) and Combat.power(s, e) >= mine * float(t["ratio"]):
					return true
			return false
		"supply_low":
			var monthly := float(s.army_soldiers(a)) * float(s.bal["food"]["soldier_per_month"]) + float(a["laborers"]) * float(s.bal["food"]["laborer_per_month"])
			if monthly <= 0.0 or a["faction"] == "xiongnu":
				return false
			var at_supply: bool = a["loc"].has("node") and s.is_supply_node(s.nodes[a["loc"]["node"]], a["faction"])
			return not at_supply and float(a["grain"]) / monthly < float(t["months"])
		"losses_high":
			return float(s.army_size(a)) < float(a["init_size"]) * (1.0 - float(t["pct"]))
	return false

static func _react(s, a: Dictionary, react: String, cond: String) -> void:
	var dest := ""
	match react:
		"retreat_origin", "evade_home":
			dest = a["origin"]
		"return_supply":
			dest = _nearest_supply(s, a)
	if dest == "" or (a["loc"].has("node") and a["loc"]["node"] == dest):
		a["trigger_cd"] = 9
		return
	a["trigger_cd"] = 9
	if a["loc"].has("route"):
		_reverse(a, s)
		var tail := Pathfinding.path_to(s, a["loc"]["to"], dest, Actions.army_speed(s, a), {}, true)
		a["path"] = [a["loc"]["to"]] + tail if a["loc"]["to"] != dest else [dest]
	else:
		a["path"] = Pathfinding.path_to(s, a["loc"]["node"], dest, Actions.army_speed(s, a), {}, true)
	a["status"] = "retreating"
	s.log_event("army", "%s 触发常备指令「%s」→ %s" % [a["name"], cond, s.nodes[dest]["name"]], {"army": a["id"]})

static func _nearest_supply(s, a: Dictionary) -> String:
	var res := Pathfinding.dijkstra(s, _anchor(a), Actions.army_speed(s, a), {}, true)
	var best := ""
	var bd := INF
	for id in res["dist"]:
		if s.is_supply_node(s.nodes[id], a["faction"]) and res["dist"][id] < bd:
			bd = res["dist"][id]
			best = id
	return best

# ---------- 接战 ----------
static func _wall_level(n: Dictionary) -> float:
	return float(n["walls"]) * float(n["wall_hp"]) / maxf(1.0, float(n["wall_hp_max"]))

static func _retreat(s, a: Dictionary) -> void:
	if s.armies.has(a["id"]) and a["loc"].has("node"):
		var dest: String = a["prev_node"] if a["prev_node"] != a["loc"]["node"] else a["origin"]
		a["path"] = [dest] if dest != a["loc"]["node"] else []
		a["status"] = "retreating"

static func _route_clashes(s) -> void:
	var by_route := {}
	for a in s.armies.values():
		if a["loc"].has("route"):
			var k: int = a["loc"]["route"]
			if not by_route.has(k):
				by_route[k] = []
			by_route[k].append(a)
	for k in by_route:
		var list: Array = by_route[k]
		# 同路段相向/追及的敌军：运输队先被截
		var crossed = []
		for x in list:
			for y in list:
				if x != y and x["faction"] != y["faction"] and x["loc"]["from"] != y["loc"]["from"] and float(x["loc"]["prog"]) + float(y["loc"]["prog"]) >= s.route_days(k):
					crossed.append(x)
					crossed.append(y)
		_convoys_check(s, crossed)
		for i in list.size():
			for j in range(i + 1, list.size()):
				var a: Dictionary = list[i]
				var b: Dictionary = list[j]
				if not s.armies.has(a["id"]) or not s.armies.has(b["id"]) or not s.is_hostile(a["faction"], b["faction"]) or a["is_convoy"] or b["is_convoy"]:
					continue
				if a["loc"]["from"] == b["loc"]["from"]:
					continue
				var days: float = s.route_days(k)
				if float(a["loc"]["prog"]) + float(b["loc"]["prog"]) < days:
					continue
				_fight(s, a, b, 0.0, 0.0, "路段")

static func _fight(s, att: Dictionary, def: Dictionary, wall_att: float, wall_def: float, where: String) -> String:
	var eng := Combat.engagement(s, att, def, wall_def)
	if eng == "decline":
		_back_off(s, att)
		return "decline"
	if eng == "evade":
		_back_off(s, def)
		return "evade"
	var res := Combat.resolve(s, att, def, wall_att, wall_def)
	s.log_event("battle", "%s 战 %s（%s）：%s 损失 %d，%s 损失 %d" % [att["name"], def["name"], where, att["name"], res["loss_a"], def["name"], res["loss_b"]], {"winner": res["winner"]})
	if res["winner"] == "a":
		_rout(s, def)
	elif res["winner"] == "b":
		_rout(s, att)
	for x in [att, def]:
		if s.armies.has(x["id"]) and s.army_size(x) == 0 and not x["is_convoy"]:
			s.remove_army(x["id"])
	return res["winner"]

## 败退/避战：回到来路上一节点（路中的军队掉头）。
static func _back_off(s, a: Dictionary) -> void:
	if a["garrison"] or not s.armies.has(a["id"]):
		return
	if a["loc"].has("route"):
		_reverse(a, s)
	else:
		_retreat(s, a)
	a["status"] = "retreating"

static func _rout(s, a: Dictionary) -> void:
	if not s.armies.has(a["id"]) or s.army_size(a) == 0:
		return
	if a["garrison"]:
		return  # 守城军不撤离，下一 tick 继续抵抗直至全灭
	_back_off(s, a)

static func _node_clash(s, n: Dictionary) -> void:
	var here: Array = s.armies_at(n["id"])
	if here.size() < 1:
		return
	var owner: String = s.controller(n)
	_convoys_check(s, here)
	for pass_i in 4:
		var hans := []
		var xns := []
		for a in s.armies_at(n["id"]):
			if a["is_convoy"]:
				continue
			if a["faction"] == "han":
				hans.append(a)
			elif a["faction"] == "xiongnu":
				xns.append(a)
		if hans.is_empty() and xns.is_empty():
			return
		# 只有一方在场：对敌方城市则攻城/占领
		if hans.is_empty() or xns.is_empty():
			var present: Array = hans if xns.is_empty() else xns
			var side: String = present[0]["faction"]
			if owner != "" and owner != side and s.is_hostile(side, owner):
				_siege_or_capture(s, n, present, side)
			return
		var att: Dictionary
		var def: Dictionary
		var a0: Dictionary = hans[0]
		var b0: Dictionary = xns[0]
		# 进攻方：非节点控制方；双方都非控制方则取刚到达者
		if owner == "han" or (owner != "xiongnu" and b0["arrived"]):
			att = b0
			def = a0
		else:
			att = a0
			def = b0
		var wall: float = _wall_level(n) if s.controller(n) == def["faction"] else 0.0
		var r := _fight(s, att, def, 0.0, wall, n["name"])
		if r == "decline" or r == "evade":
			return

## 节点上无守军时：先打民兵，再破城占领。围城：城墙受损、断粮后减员/投降（§4.4）。
static func _siege_or_capture(s, n: Dictionary, present: Array, side: String) -> void:
	var sg: Dictionary = s.bal["siege"]
	if n["type"] == "source":
		return
	var mil_total := 0
	for t in n["militia"]:
		mil_total += int(n["militia"][t])
	n["under_siege_by"] = side
	var dmg := 0.0
	for a in present:
		for t in a["units"]:
			dmg += float(a["units"][t]) * float(s.units[t]["siege"])
	n["wall_hp"] = maxf(0.0, float(n["wall_hp"]) - dmg * float(sg["siege_damage_k"]))
	if mil_total > 0:
		var m := {"id": "militia_" + n["id"], "name": n["name"] + "民兵", "faction": s.controller(n), "units": n["militia"].duplicate(), "horses": 0,
			"plan": {"engage": ["always", 0.0]}, "garrison": true, "starving": 0}
		var res := Combat.resolve(s, present[0], m, 0.0, _wall_level(n))
		n["militia"] = m["units"]
		s.log_event("battle", "%s 攻 %s 民兵：我损失 %d，民兵损失 %d" % [present[0]["name"], n["name"], res["loss_a"], res["loss_b"]])
		mil_total = 0
		for t in n["militia"]:
			mil_total += int(n["militia"][t])
		if s.army_size(present[0]) == 0:
			s.remove_army(present[0]["id"])
			return
	if mil_total > 0:
		return
	# 破城条件：城墙已毁，或城内断粮且投降判定成功
	var broken: bool = float(n["wall_hp"]) <= 0.0 or float(n["walls"]) == 0.0
	var starved: bool = float(n["grain"]) <= 0.0 and n["pop"] > 0 and s.rng.randf() < float(sg["starve_surrender_chance"])
	if broken or starved:
		capture(s, n, side)

static func _siege_upkeep(s) -> void:
	for n in s.nodes.values():
		if n["under_siege_by"] == "":
			continue
		var still := false
		for a in s.armies_at(n["id"]):
			if a["faction"] == n["under_siege_by"]:
				still = true
		if not still:
			n["under_siege_by"] = ""
			n["wall_hp"] = minf(float(n["wall_hp_max"]), float(n["wall_hp"]) + float(n["wall_hp_max"]) * 0.1)
		elif Cal.is_month_end(s.tick) and float(n["grain"]) <= 0.0:
			n["pop"] = int(n["pop"] * (1.0 - float(s.bal["siege"]["starve_attrition"])))

## 占领节点。汉/匈奴城直接易主；西域城邦则其宗主权易主（匈奴占领按「被劫掠」处理威吓与怨恨，汉占领削弱周边影响力）。
static func capture(s, n: Dictionary, by: String) -> void:
	var d: Dictionary = s.bal["diplomacy"]
	var old: String = s.controller(n)
	n["under_siege_by"] = ""
	n["wall_hp"] = float(n["wall_hp_max"]) * 0.5
	if n["faction"] == "han" or n["faction"] == "xiongnu":
		n["faction"] = by
		if old == "han" and by == "xiongnu" and "hexi_commandery" in n["tags"]:
			s.stats["hexi_lost"] += 1
	elif s.relations.has(n["faction"]):
		var r: Dictionary = s.relations[n["faction"]]
		r["overlord"] = by
		if by == "han":
			r["han_status"] = "puppet"
			r["xn_status"] = "none"
			for nb in s.nodes:
				var st: String = s.nodes[nb]["faction"]
				if st != n["faction"] and s.relations.has(st) and s.hops(n["id"], nb, 2) <= 2:
					s.relations[st]["han_influence"] = maxf(0.0, float(s.relations[st]["han_influence"]) + float(d["han_conquest_influence_neighbor"]))
		else:
			r["xn_status"] = "vassal"
			r["xn_intimidation"] = minf(100.0, float(r["xn_intimidation"]) + float(d["xn_sack_intimidation"]))
			r["xn_resentment"] = minf(100.0, float(r["xn_resentment"]) + float(d["xn_sack_resentment"]))
			for nb in s.nodes:
				var st2: String = s.nodes[nb]["faction"]
				if st2 != n["faction"] and s.relations.has(st2) and s.hops(n["id"], nb, 1) <= 1:
					s.relations[st2]["xn_intimidation"] = minf(100.0, float(s.relations[st2]["xn_intimidation"]) + float(d["xn_sack_neighbor"]))
			Buffs.add(s, "sacked", n["id"])
	s.stats["sieges_won"] += 1
	s.log_event("capture", "%s 占领 %s" % [by, n["name"]], {"node": n["id"], "by": by})
