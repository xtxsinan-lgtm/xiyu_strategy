extends RefCounted
# 汉 AI：防守增援、外交（赏赐→册封→属国）、屯田、前沿运粮、有限度的出征。

const U = preload("res://ai/ai_utils.gd")
const Cmd = preload("res://core/commands.gd")
const Diplomacy = preload("res://core/diplomacy.gd")
const Combat = preload("res://core/combat.gd")
const Supply = preload("res://core/supply.gd")
const Path = preload("res://core/pathfinding.gd")

var faction = "han"
const HEXI = ["wu_wei", "zhang_ye", "jiu_quan", "dun_huang", "ju_yan"]
const PRIORITY = {"wu_lei": 3.0, "cheshi_qian": 3.0, "lou_lan": 2.0}
var mem = {}

func think(state) -> Array:
	var cmds = []
	var prof: Dictionary = state.ai_profiles["han_default"]
	var horizon: float = state.decision_ticks * 10.0
	var budget: float = state.factions["han"]["money"] - prof["money_reserve"]
	budget = _defense(state, cmds, prof, horizon, budget)
	budget = _diplomacy(state, cmds, prof, budget)
	budget = _economy(state, cmds, prof, budget)
	_logistics(state, cmds)
	_expedition(state, cmds, prof, horizon, budget)
	return cmds

func _defense(state, cmds: Array, prof: Dictionary, horizon: float, budget: float) -> float:
	var pool: Dictionary = state.central.duplicate()
	var threats := {}
	var cities: Array = HEXI.duplicate()
	for nid in cities:
		threats[nid] = U.enemy_threat_at(state, nid, "xiongnu", horizon + prof["defense_warning_days"])
	cities.sort_custom(func(a, b): return threats[a] / maxf(U.garrison_strength(state, a, "han"), 1.0) > threats[b] / maxf(U.garrison_strength(state, b, "han"), 1.0))
	for nid in cities:
		var node: Dictionary = state.nodes[nid]
		if node["faction"] != "han":
			continue
		var mine: float = U.garrison_strength(state, nid, "han") * Combat.wall_mult(state, node)
		if threats[nid] < mine * 0.8 or budget < 100:
			continue
		var current := 0
		for army in state.armies_at(nid):
			if army["faction"] == "han":
				current += state.army_size(army)
		var food_room: int = maxi(0, int((node["grain"] / prof["defense_food_months"] - node["pop"] * 2.0) / 3.0) - current)
		var want := {}
		for type in ["crossbow", "infantry"]:
			var amount := mini(mini(int(pool.get(type, 0)), int(prof["defense_batch"] * state.decision_ticks / 3.0)), food_room)
			if amount >= 500:
				want[type] = amount
				food_room -= amount
		if want.is_empty():
			continue
		var cost := 0.0
		for type in want:
			cost += want[type] / 1000.0 * state.units[type]["cost_money_per_1000"]
		if cost <= budget:
			cmds.append(Cmd.make("recruit", faction, {"node": nid, "source": "central", "units": want, "preset": "garrison"}))
			for type in want:
				pool[type] -= want[type]
			budget -= cost
	return budget

func _diplomacy(state, cmds: Array, prof: Dictionary, budget: float) -> float:
	var cands = []
	for sid in state.relations:
		if not state.factions[sid].get("counts_for_victory", false):
			continue
		var rel = state.relations[sid]
		if rel["overlord"] == "han":
			continue
		cands.append(sid)
	cands.sort_custom(func(a, b):
		var va: float = PRIORITY.get(a, 1.0) * 10.0 + state.relations[a]["han_influence"] - state.relations[a]["xn_intimidation"] * 0.5
		var vb: float = PRIORITY.get(b, 1.0) * 10.0 + state.relations[b]["han_influence"] - state.relations[b]["xn_intimidation"] * 0.5
		return va > vb)
	var gifts_done = 0
	var diplomacy: Dictionary = state.bal["diplomacy"]
	var gift_batch: int = int(prof["gift_batch"]) * maxi(1, int(state.decision_ticks / 3))
	for sid in cands:
		var rel = state.relations[sid]
		if Diplomacy.can_vassal(state, sid) == "":
			cmds.append(Cmd.make("make_vassal", faction, {"state": sid}))
			continue
		if Diplomacy.can_enfeoff(state, sid) == "" and budget >= 200:
			cmds.append(Cmd.make("enfeoff", faction, {"state": sid}))
			budget -= 200
			continue
		# 威吓过高的国家，赏赐徒劳：先等威吓衰减
		if rel["xn_intimidation"] > rel["han_influence"] + 40:
			continue
		if gifts_done < 4 and budget >= gift_batch * diplomacy["gift_unit_money"]:
			var multiplier = Diplomacy.mult(state, sid)
			var target_inf: float = maxf(diplomacy["vassal_min_influence"] * multiplier, rel["xn_intimidation"] + diplomacy["vassal_margin_over_intimidation"] * multiplier)
			# 威吓已高到无法用外交争取时，保留军费，等待军事削弱威吓。
			if target_inf > diplomacy["influence_max"]:
				continue
			if rel["han_influence"] < target_inf:
				cmds.append(Cmd.make("gift", faction, {"state": sid, "units": gift_batch}))
				budget -= gift_batch * diplomacy["gift_unit_money"]
				gifts_done += 1
	return budget

func _economy(state, cmds: Array, prof: Dictionary, budget: float) -> float:
	# 与月制每两个月一次扩田保持相同建设频率。
	var projects: int = ceili((state.tick + state.decision_ticks) / 6.0) - ceili(state.tick / 6.0)
	for nid in ["dun_huang", "jiu_quan", "wu_wei", "zhang_ye", "long_xi"]:
		if projects <= 0 or budget <= prof["money_reserve"]:
			break
		if Cmd.validate(state, Cmd.make("expand_farm", faction, {"node": nid})) == "":
			cmds.append(Cmd.make("expand_farm", faction, {"node": nid}))
			budget -= state.bal["farm"]["expand_cost_money"]
			projects -= 1
	return budget

## 河西逐段运粮：按决策覆盖的月份分配运输任务。
func _logistics(state, cmds: Array) -> void:
	var inbound := {}
	var convoys := 0
	for army in state.armies.values():
		if army["faction"] != faction or not army["is_convoy"]:
			continue
		convoys += 1
		for step in army["plan"]["steps"]:
			if step["type"] == "deliver":
				var start: String = army["loc"].get("node", army["loc"].get("to", ""))
				var months: float = U.months_between(state, start, step["node"], Combat.army_speed(state, army))
				var return_months: float = U.months_between(state, step["node"], army.get("convoy_home", start), Combat.army_speed(state, army))
				var net: float = maxf(0.0, army["grain"] - Supply.need_per_month(state, army) * (months + return_months))
				inbound[step["node"]] = inbound.get(step["node"], 0.0) + net
	if convoys >= state.ai_profiles["han_default"]["max_convoys"]:
		return
	# 补给沿河西干线逐段前推；长安是实际货源，不凭空给前线加粮。
	var legs: Array = [["chang_an", "long_xi"], ["long_xi", "wu_wei"], ["wu_wei", "zhang_ye"], ["zhang_ye", "jiu_quan"], ["jiu_quan", "dun_huang"], ["zhang_ye", "ju_yan"]]
	var candidates: Array = []
	for leg in legs:
		var node: Dictionary = state.nodes[leg[1]]
		if node["faction"] != faction:
			continue
		var need: float = node["pop"] * 2.0
		for army in state.armies_at(node["id"]):
			if army["faction"] == faction and not army["is_convoy"]:
				need += Supply.need_per_month(state, army)
		var deficit: float = need * 9.0 - node["grain"] - inbound.get(node["id"], 0.0)
		if deficit > 10000:
			candidates.append({"source": leg[0], "destination": leg[1], "deficit": deficit, "urgency": deficit / maxf(need, 1.0)})
	candidates.sort_custom(func(a, b): return a["urgency"] > b["urgency"])
	var dispatched := 0
	var reserved_workers := {}
	var reserved_grain := {}
	var slots: int = mini(int(state.decision_ticks / 3), int(state.ai_profiles["han_default"]["max_convoys"]) - convoys)
	for candidate in candidates:
		var destination: String = candidate["destination"]
		var source: Dictionary = state.nodes[candidate["source"]]
		if source["faction"] != faction:
			continue
		var workers: int = 8000 if source["type"] == "source" else mini(3000, int(source["pop"] * state.bal["han"]["laborer_levy_ratio"]) - source["levied_out"] - int(reserved_workers.get(source["id"], 0)))
		var keep: float = source["pop"] * 2.0 * 6.0
		for army in state.armies_at(source["id"]):
			if army["faction"] == faction and not army["is_convoy"]:
				keep += Supply.need_per_month(state, army) * 6.0
		var spare: float = INF if source["type"] == "source" else source["grain"] - keep - float(reserved_grain.get(source["id"], 0.0))
		workers = mini(workers, int(maxf(0.0, spare) / 15.0)) if not is_inf(spare) else workers
		if workers < 500:
			continue
		cmds.append(Cmd.make("convoy", faction, {"from": source["id"], "to": destination, "grain": workers * 15.0, "laborers": workers}))
		reserved_workers[source["id"]] = reserved_workers.get(source["id"], 0) + workers
		reserved_grain[source["id"]] = reserved_grain.get(source["id"], 0.0) + workers * 15.0
		dispatched += 1
		if dispatched >= slots:
			return

func _expedition(state, cmds: Array, prof: Dictionary, horizon: float, budget: float) -> void:
	# 现有野战军
	var fields = []
	for a in U.field_armies(state, faction):
		if not a["garrison"] and a["plan"]["preset"] != "garrison":
			fields.append(a)
	var home = "dun_huang"
	if state.nodes[home]["faction"] != "han":
		for candidate in ["jiu_quan", "zhang_ye", "wu_wei", "long_xi"]:
			if state.nodes[candidate]["faction"] == "han":
				home = candidate
				break
	var army = null
	for a in fields:
		if a["loc"].has("node") and a["loc"]["node"] == home and U.is_idle(a):
			army = a
			break
	var moving = fields.filter(func(x): return not U.is_idle(x))
	if not moving.is_empty():
		return
	if army == null:
		# 组建：中央军在敦煌征召
		var node = state.nodes[home]
		var available: Dictionary = state.central.duplicate()
		for pending in cmds:
			if pending["type"] == "recruit" and pending["source"] == "central":
				for type in pending["units"]:
					available[type] -= pending["units"][type]
		var recruit_cost: float = 4.0 * state.units["infantry"]["cost_money_per_1000"] + 3.0 * state.units["crossbow"]["cost_money_per_1000"] + 1.5 * state.units["cavalry"]["cost_money_per_1000"]
		if available.get("infantry", 0) >= 4000 and available.get("crossbow", 0) >= 3000 and available.get("cavalry", 0) >= 1500 and budget >= recruit_cost and node["grain"] > 150000:
			cmds.append(Cmd.make("recruit", faction, {"node": home, "source": "central", "units": {"infantry": 4000, "crossbow": 3000, "cavalry": 1500}, "preset": "balanced"}))
		return
	# 合并停在敦煌待命的运输队
	for a in state.armies_at(home):
		if a["is_convoy"] and a["faction"] == faction and a["plan"]["steps"].size() > 0 and a["plan"]["steps"][0]["type"] == "hold":
			cmds.append(Cmd.make("merge", faction, {"army": a["id"], "into": army["id"]}))
	# 选目标
	var target = ""
	for nid in state.bal["victory"]["xn_targets"]:
		if state.nodes[nid]["faction"] == "xiongnu":
			var enemies: Array = state.armies_at(nid).filter(func(a): return a["faction"] == "xiongnu")
			if Combat.expected_p(state, Combat.merged_units([army]), Combat.merged_units(enemies), {"b_def": Combat.wall_mult(state, state.nodes[nid])}) >= prof["attack_win_prob"]:
				target = nid
				break
	if target == "":
		target = _pick_target(state, army, prof)
	if target == "":
		return
	var m: float = U.months_between(state, home, target, 1.0)
	var months_needed: float = 2.0 * m * 1.2 + 2.0
	var soldiers: int = state.army_size(army)
	var need: float = U.need_grain(state, soldiers, army["laborers"], army["horses"], months_needed)
	var depot = state.nodes[home]
	var lab_avail: int = int(depot["pop"] * state.bal["han"]["laborer_levy_ratio"]) - depot["levied_out"]
	# 运粮与远征装载共用同一民夫额度，不能各自按完整额度下令。
	for pending in cmds:
		if pending["type"] == "convoy" and pending["from"] == home:
			lab_avail -= int(pending["laborers"])
	var load_lab: int = clampi(int((need - soldiers * 3.0) / 12.0) - army["laborers"], 0, maxi(lab_avail, 0))
	var carry: float = soldiers * 3.0 + (army["laborers"] + load_lab) * 15.0
	var eat: float = U.need_grain(state, soldiers, army["laborers"] + load_lab, army["horses"], months_needed)
	var load_grain = maxf(0.0, minf(carry - army["grain"], depot["grain"] - depot["pop"] * 2.0 * 6.0))
	cmds.append(Cmd.make("load", faction, {"army": army["id"], "grain": load_grain, "laborers": load_lab}))
	if carry < eat or army["grain"] + load_grain < eat * 0.9:
		return  # 补给不足，继续等待运输队/存粮
	var steps = [{"type": "siege", "node": target, "max_months": 3, "assault_when": 0.5}, {"type": "return_to", "node": home}]
	cmds.append(Cmd.make("set_plan", faction, {"army": army["id"], "steps": steps, "preset": "balanced"}))
	state.log_event("ai", "汉出征 %s（%d 人，携粮可支撑约 %.1f 月）" % [state.nodes[target]["name"], soldiers, carry / maxf(U.need_grain(state, soldiers, army["laborers"] + load_lab, army["horses"], 1.0), 1.0)])

func _pick_target(state, army: Dictionary, prof: Dictionary) -> String:
	var best = ""
	var bscore = -1.0
	var mine = Combat.merged_units([army])
	for sid in state.relations:
		var rel = state.relations[sid]
		if rel["overlord"] != "xiongnu":
			continue
		for n in state.nodes_of_state(sid):
			if not state.factions[sid].get("counts_for_victory", false):
				continue
			var hops: int = state.hops("dun_huang", n["id"], 6)
			if hops > 4:
				continue
			var defenders = n["militia"].duplicate()
			for e in state.armies_at(n["id"]):
				if e["faction"] == "xiongnu":
					for t in e["units"]:
						defenders[t] = defenders.get(t, 0) + e["units"][t]
			var ctx = {"b_def": Combat.wall_mult(state, n)}
			var p: float = Combat.expected_p(state, mine, defenders, ctx)
			if p < prof["attack_win_prob"]:
				continue
			var sc: float = PRIORITY.get(sid, 1.0) * 2.0 - hops * 0.7 + p
			if sc > bscore:
				bscore = sc
				best = n["id"]
	return best
