extends RefCounted
# 匈奴：驻军维护属国、属国步兵配合攻城、夏季集结、预排秋季出击、游骑截粮。
const U = preload("res://ai/ai_utils.gd")
const Cmd = preload("res://core/commands.gd")
const Diplomacy = preload("res://core/diplomacy.gd")
const Combat = preload("res://core/combat.gd")
const Path = preload("res://core/pathfinding.gd")
var faction = "xiongnu"
var mem = {}

func think(state) -> Array:
	var cmds: Array = []
	var prof: Dictionary = state.ai_profiles["xiongnu_default"]
	_taxes(state, cmds, prof)
	for sid in state.relations:
		if Diplomacy.can_demand(state, sid) == "":
			cmds.append(Cmd.make("demand_vassal", faction, {"state": sid}))
	_recruit(state, cmds, prof)
	var assigned := {}
	_detachments(state, cmds, prof, assigned)
	_campaign(state, cmds, prof, assigned)
	return cmds

func _taxes(state, cmds: Array, prof: Dictionary) -> void:
	for sid in state.relations:
		var rel: Dictionary = state.relations[sid]
		if rel["overlord"] != faction:
			continue
		var level := 0
		# 预算跨过整个月/季度，防止季度末怨恨超限。
		for candidate in range(3, -1, -1):
			var increase: float = maxf(0.0, state.bal["diplomacy"]["tax_rates"][candidate]["res"] - state.bal["diplomacy"]["resentment_decay_month"])
			if rel["xn_resentment"] + increase * state.decision_ticks / 3.0 < prof["max_resentment"] - 10:
				level = candidate
				break
		if level != int(rel["tax_level"]):
			cmds.append(Cmd.make("set_tax", faction, {"state": sid, "level": level}))

func _recruit(state, cmds: Array, prof: Dictionary) -> void:
	var troops := 0
	var infantry := 0
	for army in U.field_armies(state, faction):
		troops += state.army_size(army)
		infantry += U.count_units(army, "infantry")
	var troop_limit: int = int(prof["max_field_troops"]) - int(prof.get("long_plan_reserve_per_month", 0)) * maxi(0, int(state.decision_ticks / 3) - 1)
	var room: int = troop_limit - troops
	if room > 0:
		for nid in ["youxian_wang", "chanyu_ting", "long_cheng"]:
			var n: Dictionary = state.nodes[nid]
			if n["faction"] != faction:
				continue
			var cap: int = int(n["pop"] * state.bal["xiongnu"]["levy_ratio"]) - n["recruited"].get("nomad", 0)
			var cavalry_room: int = maxi(0, room - maxi(0, int(prof["infantry_target"]) - infantry))
			var amount := mini(mini(cap, cavalry_room), int(3000 * state.decision_ticks / 3.0))
			amount = mini(amount, maxi(0, int((n["horses"] - 20000) / 2)))
			if amount >= 1000:
				cmds.append(Cmd.make("recruit", faction, {"node": nid, "source": "nomad", "units": {"horse_archer": amount}, "preset": "balanced"}))
				room -= amount
				break
	var need: int = mini(prof["infantry_target"] - infantry, room)
	for sid in state.relations:
		if need < 300:
			break
		var rel: Dictionary = state.relations[sid]
		if rel["overlord"] != faction or rel["xn_resentment"] > prof["max_resentment"] - state.bal["xiongnu"]["vassal_levy_resentment"]:
			continue
		for n in state.nodes_of_state(sid):
			var cap: int = int(n["pop"] * state.bal["xiongnu"]["vassal_infantry_levy_ratio"]) - n["recruited"].get("vassal", 0)
			var amount := mini(need, cap)
			if amount >= 300:
				cmds.append(Cmd.make("recruit", faction, {"node": n["id"], "source": "vassal", "units": {"infantry": amount}, "preset": "balanced", "role": "siege"}))
				need -= amount

func _plan(state, cmds: Array, army: Dictionary, steps: Array, role: String, preset := "balanced") -> void:
	var cmd = Cmd.make("set_plan", faction, {"army": army["id"], "steps": steps, "preset": preset, "role": role})
	if Cmd.validate(state, cmd) == "":
		cmds.append(cmd)

func _detachments(state, cmds: Array, prof: Dictionary, assigned: Dictionary) -> void:
	var busy := {}
	var raiders: Array = []
	for a in U.field_armies(state, faction):
		var role: String = a.get("ai_role", "")
		if role == "presence":
			var steps: Array = a["plan"]["steps"]
			if not steps.is_empty():
				busy[steps.back().get("node", "")] = "busy"
		elif role == "raid":
			raiders.append(a)
	# 先维护商路门户；已有驻军不反复拆分主力。
	for nid in ["cheshi_qian", "lou_lan", "yan_qi", "cheshi_hou"]:
		var sid: String = state.nodes[nid]["faction"]
		var rel: Dictionary = state.relations.get(sid, {})
		if rel.is_empty() or rel["overlord"] != faction or busy.has(nid):
			continue
		if rel["xn_intimidation"] >= 65 and rel["han_influence"] < rel["xn_intimidation"] - 20:
			continue
		var small = _nearest_idle(state, nid, assigned, 500, 2500)
		if small != null:
			assigned[small["id"]] = "busy"
			_plan(state, cmds, small, [{"type": "hold", "node": nid, "until": "end"}], "presence", "raider")
			busy[nid] = "busy"
		else:
			var large = _nearest_idle(state, nid, assigned, 6000, 99999)
			if large != null:
				cmds.append(Cmd.make("split", faction, {"army": large["id"], "units": {"horse_archer": int(prof["presence_troops"])}, "grain": 6000, "role": "presence"}))
				assigned[large["id"]] = "split"
				break
	# 拆出的分遣队在下一决策阶段领受计划。
	for a in U.field_armies(state, faction):
		if a.get("ai_role", "") == "presence" and U.is_idle(a) and not assigned.has(a["id"]) and (a["plan"]["steps"].is_empty() or a["plan"]["steps"][0].get("node", "") not in ["cheshi_qian", "lou_lan", "yan_qi", "cheshi_hou"]):
			for nid in ["cheshi_qian", "lou_lan", "yan_qi", "cheshi_hou"]:
				if state.controller(state.nodes[nid]) == faction and not busy.has(nid):
					_plan(state, cmds, a, [{"type": "hold", "node": nid, "until": "end"}], "presence", "raider")
					busy[nid] = "busy"
					assigned[a["id"]] = "busy"
					break
	for a in raiders:
		assigned[a["id"]] = "busy"
		if not U.is_idle(a) or not a["loc"].has("node"):
			continue
		var from: String = a["loc"]["node"]
		var target := "yang_guan"
		var ridx: int = state.route_between(target, "lou_lan")
		_plan(state, cmds, a, [{"type": "ambush", "node": target, "route": ridx, "months": 2}, {"type": "return_to", "node": "yi_wu"}], "raid", "raider")
	# 游骑只占小部分骑兵，留出攻城主力。
	if raiders.size() < prof["raiders"] and state.month() >= 5 and state.month() <= 10:
		var large = _nearest_idle(state, "yi_wu", assigned, 8000, 99999)
		if large != null:
			cmds.append(Cmd.make("split", faction, {"army": large["id"], "units": {"horse_archer": int(prof["raid_troops"])}, "grain": 6000, "role": "raid"}))
			assigned[large["id"]] = "split"

func _nearest_idle(state, target: String, assigned: Dictionary, low: int, high: int):
	var best = null
	var distance := INF
	for a in U.field_armies(state, faction):
		if assigned.has(a["id"]) or not U.is_idle(a) or not a["loc"].has("node") or a.get("ai_role", "") in ["presence", "raid", "siege"]:
			continue
		var size: int = state.army_size(a)
		if size < low or size > high or U.count_units(a, "horse_archer") < low:
			continue
		var days := Path.days_to(state, a["loc"]["node"], target, Combat.army_speed(state, a))
		if days < distance:
			distance = days
			best = a
	return best

func _campaign(state, cmds: Array, prof: Dictionary, assigned: Dictionary) -> void:
	var month: int = state.month()
	if month < prof["rally_month"] or month > 10:
		return
	var rally := "yi_wu"
	var gathered: Array = []
	for a in U.field_armies(state, faction):
		if assigned.get(a["id"], "") == "busy" or a.get("ai_role", "") in ["presence", "raid"] or not U.is_idle(a) or not a["loc"].has("node"):
			continue
		if a["loc"]["node"] == rally:
			if not assigned.has(a["id"]):
				gathered.append(a)
		else:
			if state.is_supply_node(state.nodes[a["loc"]["node"]], faction):
				cmds.append(Cmd.make("load", faction, {"army": a["id"], "grain": preload("res://core/supply.gd").carry_cap(state, a) - a["grain"], "laborers": 0}))
			_plan(state, cmds, a, [{"type": "move_to", "node": rally}, {"type": "hold", "node": rally, "until": "end"}], "siege" if U.count_units(a, "infantry") > 0 else "field", "assault")
	if gathered.is_empty():
		return
	gathered.sort_custom(func(a, b): return state.army_size(a) > state.army_size(b))
	var leader: Dictionary = gathered[0]
	for i in range(1, gathered.size()):
		cmds.append(Cmd.make("merge", faction, {"army": gathered[i]["id"], "into": leader["id"]}))
	var units: Dictionary = Combat.merged_units(gathered)
	if month < 7:
		return
	var target := _pick_target(state, units, prof)
	if target == "":
		return
	var steps: Array = []
	if month < prof["attack_month"]:
		steps.append({"type": "hold", "node": rally, "months": prof["attack_month"] - month})
	steps.append({"type": "burn", "node": target})
	steps.append({"type": "siege", "node": target, "max_months": prof["siege_months"], "assault_when": 0.65})
	steps.append({"type": "return_to", "node": rally})
	_plan(state, cmds, leader, steps, "field", "assault")
	state.log_event("ai", "匈奴预排秋季攻势：%d 人，步兵 %d，目标%s" % [Combat.total(units), units.get("infantry", 0), state.nodes[target]["name"]])

func _pick_target(state, units: Dictionary, prof: Dictionary) -> String:
	var best := ""
	var score := -INF
	for nid in state.bal["victory"]["xn_targets"]:
		var n: Dictionary = state.nodes[nid]
		if n["faction"] != "han":
			continue
		var defenders: Dictionary = n["militia"].duplicate()
		for a in state.armies_at(nid):
			if a["faction"] == "han":
				for type in a["units"]:
					defenders[type] = defenders.get(type, 0) + a["units"][type]
		var probability := Combat.expected_p(state, units, defenders, {"b_def": Combat.wall_mult(state, n)})
		if probability < prof["min_attack_probability"]:
			continue
		var value: float = probability * 10.0 - Path.days_to(state, "yi_wu", nid, 1.0) / 60.0
		if value > score:
			score = value
			best = nid
	return best
