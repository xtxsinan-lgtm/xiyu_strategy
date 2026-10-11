extends RefCounted
# 势力 AI（参数见 data/ai_profiles.json）。每个玩家回合开始时对 state.ai_factions 中的势力各运行一次。
# 匈奴：税率调节 → 收拢败军/回防 → 选择一个有把握的目标发动战役（秋季更积极）。
# 汉：用钱经营外交（赏赐→册封→属国）→ 向缺粮边郡运粮 → 失地时从中央军组建反攻军。

const Actions = preload("res://core/actions.gd")
const Combat = preload("res://core/combat.gd")
const Pathfinding = preload("res://core/pathfinding.gd")

static func run(s, fid: String) -> void:
	match fid:
		"xiongnu": _xiongnu(s)
		"han": _han(s)

# ---------- 公共 ----------
static func _defense_power(s, n: Dictionary, attacker: String) -> float:
	var p = 0.0
	for a in s.armies_at(n["id"]):
		if a["faction"] != attacker and not a["is_convoy"]:
			p += Combat.power(s, a)
	for t in n["militia"]:
		p += float(n["militia"][t]) * (float(s.units[t]["melee"]) * float(s.units[t]["mdef"]) + float(s.units[t]["ranged"]) * float(s.units[t]["rdef"]) + 0.5)
	return p * (1.0 + float(s.bal["combat"]["wall_def_per_level"]) * float(n["walls"]))

static func _field_armies(s, fid: String) -> Array:
	var out = []
	for a in s.armies.values():
		if a["faction"] == fid and not a["is_convoy"] and not a["garrison"]:
			out.append(a)
	return out

# ---------- 战役（集结 → 进攻）----------
## 避免各军先后零星到达被各个击破：先集结到离目标最近的己方节点，全部到齐（或超时）再同时出击。
static func _stage_node(s, fid: String, target: String, members: Array) -> String:
	var from_target = Pathfinding.dijkstra(s, target, 1.0, {}, true)["dist"]
	var hostile = Actions.hostile_nodes(s, fid)
	var reach = {}
	for a in members:
		var r = Pathfinding.dijkstra(s, a["loc"]["node"], Actions.army_speed(s, a), hostile, true)["dist"]
		if reach.is_empty():
			reach = r
		else:
			for k in reach.keys():
				if not r.has(k):
					reach.erase(k)
	var best = ""
	var bd = INF
	for id in reach:
		var n: Dictionary = s.nodes[id]
		if id == target or s.controller(n) != fid or n["type"] == "source" or not from_target.has(id):
			continue
		if from_target[id] < bd:
			bd = from_target[id]
			best = id
	return best

static func _start_campaign(s, fid: String, target: String, members: Array) -> bool:
	var stage = _stage_node(s, fid, target, members)
	if stage == "":
		return false
	var ids = []
	for a in members:
		s.apply_preset(a, "aggressive")
		a["garrison"] = false
		a.erase("mission")
		if Actions.order_move(s, a["id"], stage, true)["ok"] or a["loc"].get("node", "") == stage:
			ids.append(a["id"])
	if ids.is_empty():
		return false
	s.campaigns[fid] = {"target": target, "stage": stage, "members": ids, "phase": "gather", "deadline": s.turn + 3}
	s.log_event("ai", "%s 集结 %d 支军队于 %s，目标 %s" % [s.factions[fid]["name"], ids.size(), s.nodes[stage]["name"], s.nodes[target]["name"]])
	return true

## 推进战役状态；返回 true 表示仍有战役在进行（本回合不再另起战役）。
static func _campaign_tick(s, fid: String) -> bool:
	if not s.campaigns.has(fid):
		return false
	var c: Dictionary = s.campaigns[fid]
	var alive = []
	for id in c["members"]:
		if s.armies.has(id):
			alive.append(s.armies[id])
	if alive.is_empty() or s.controller(s.nodes[c["target"]]) == fid:
		s.campaigns.erase(fid)
		return false
	var settled = true
	for a in alive:
		if a["loc"].has("route") or not a["path"].is_empty() or a["status"] == "moving":
			settled = false
	if c["phase"] == "gather":
		if settled or s.turn >= int(c["deadline"]):
			c["phase"] = "attack"
			for a in alive:
				if a["loc"].has("node") and a["loc"]["node"] == c["stage"]:
					Actions.order_move(s, a["id"], c["target"])
			s.log_event("ai", "%s 自 %s 出击 %s" % [s.factions[fid]["name"], s.nodes[c["stage"]]["name"], s.nodes[c["target"]]["name"]])
		return true
	if settled:
		s.campaigns.erase(fid)
		return false
	return true

# ---------- 匈奴 ----------
static func _xiongnu(s) -> void:
	var prof: Dictionary = s.ai_profiles["xiongnu_default"]
	_xn_tax(s, prof)
	_xn_levy(s)
	var field = _field_armies(s, "xiongnu")
	# 闲置在外的军队：若所在城已为己方则驻守，否则回家
	for a in field:
		if a["status"] in ["idle", "blocked"] and a["loc"].has("node"):
			var n: Dictionary = s.nodes[a["loc"]["node"]]
			if s.controller(n) == "xiongnu" and n["id"] != a["origin"] and n["type"] != "nomad" and s.hostile_near(n["id"], "xiongnu"):
				a["garrison"] = true
			elif a.has("mission") and s.turn < int(a["mission"]["until"]):
				continue
			elif s.controller(n) != "xiongnu" and a["status"] == "idle" and n["under_siege_by"] == "":
				Actions.order_move(s, a["id"], a["origin"])
	if _campaign_tick(s, "xiongnu"):
		return
	field = _field_armies(s, "xiongnu")
	var pool = []
	for a in field:
		if a["loc"].has("node") and s.controller(s.nodes[a["loc"]["node"]]) == "xiongnu" and a["status"] in ["idle", "retreating"] and not a.get("recovering", false):
			pool.append(a)
	if pool.is_empty():
		return
	var aggr = float(prof["autumn_aggression"]) if s.season() == "autumn" else 1.0
	var best = null
	var best_score = 0.0
	for n in s.nodes.values():
		var owner = s.controller(n)
		if owner == "xiongnu" or n["type"] in ["source", "nomad"]:
			continue
		var hostile = owner == "han"
		var rebel = s.relations.has(n["faction"]) and owner == "" and s.relations[n["faction"]]["xn_resentment"] > 0 and s.relations[n["faction"]].get("xn_status", "") == "none" and float(s.relations[n["faction"]]["han_influence"]) > float(s.relations[n["faction"]]["xn_intimidation"])
		if not hostile and not rebel:
			continue
		var days = 1e9
		var mine = 0.0
		var group = []
		for a in pool:
			var d = Pathfinding.days_to(s, a["loc"]["node"], n["id"], Actions.army_speed(s, a), true)
			if d <= 150.0:
				days = minf(days, d) if group.is_empty() else maxf(days, d)
				mine += Combat.power(s, a)
				group.append(a)
		if group.is_empty():
			continue
		var need = _defense_power(s, n, "xiongnu") * float(prof["min_siege_ratio"])
		if mine < need:
			continue
		var value = 1.0 + (3.0 if "hexi_commandery" in n["tags"] else 0.0) + (2.0 if s.relations.has(n["faction"]) else 0.0)
		var score = value * aggr / (maxf(days, 10.0) * float(prof["w_cost"])) * (mine / maxf(need, 1.0)) / float(prof["w_risk"])
		if score > best_score:
			best_score = score
			best = {"node": n["id"], "group": group}
	if best == null:
		_xn_presence(s, pool)
		return
	_start_campaign(s, "xiongnu", best["node"], best["group"])

## 部领动员：战力不足 4 万时在人口大的部领征兵。
static func _xn_levy(s) -> void:
	var total = 0
	for a in _field_armies(s, "xiongnu"):
		total += s.army_size(a)
	if total >= 60000:
		return
	for id in ["youxian_wang", "chanyu_ting", "hu_jie", "long_cheng"]:
		Actions.levy_xiongnu(s, id)

## 示威：把一支闲置军队派到「汉影响力压过匈奴威吓」的独立/汉属邻国驻留 3 回合，借威吓辐射（§5.1）压住倾向。
static func _xn_presence(s, pool: Array) -> void:
	var ranked = []
	for sid in s.relations:
		var r: Dictionary = s.relations[sid]
		if s.kind_of(sid) != "citystate" or r["overlord"] == "xiongnu":
			continue
		var g = float(r["han_influence"]) - float(r["xn_intimidation"])
		if g > 0.0:
			ranked.append([g, sid])
	ranked.sort_custom(func(x, y): return x[0] > y[0])
	var used = {}
	for i in mini(3, ranked.size()):
		var a = _send_presence(s, pool, ranked[i][1], used)
		if a != null:
			used[a["id"]] = true

static func _send_presence(s, pool: Array, target: String, used: Dictionary):
	var cap_node = s.nodes_of_state(target)[0]
	var best = null
	var best_days = 1e9
	for a in pool:
		if s.army_size(a) < 3000 or used.has(a["id"]) or a.has("mission"):
			continue
		var d = Pathfinding.days_to(s, a["loc"]["node"], cap_node["id"], Actions.army_speed(s, a), true)
		if d < best_days:
			best_days = d
			best = a
	if best == null or best_days > 120.0:
		return null
	s.apply_preset(best, "balanced")
	best["garrison"] = false
	best["mission"] = {"kind": "presence", "until": s.turn + 3 + int(best_days / 90.0)}
	Actions.order_move(s, best["id"], cap_node["id"])
	return best

## 税率：怨恨低于上限则逐档加税，高于上限则降档；已叛离/非属国不处理。
static func _xn_tax(s, prof: Dictionary) -> void:
	var top = s.bal["diplomacy"]["tax_rates"].size() - 1
	for r in s.relations.values():
		if r["xn_status"] != "vassal" or r["overlord"] != "xiongnu":
			continue
		if float(r["xn_resentment"]) > float(prof["max_resentment"]):
			r["tax_level"] = maxi(0, int(r["tax_level"]) - 1)
		elif float(r["xn_resentment"]) < float(prof["max_resentment"]) * 0.5:
			r["tax_level"] = mini(top, int(r["tax_level"]) + 1)

# ---------- 汉 ----------
static func _han(s) -> void:
	var prof: Dictionary = s.ai_profiles["han_default"]
	_han_diplomacy(s, prof)
	_han_supply(s)
	_han_counterattack(s, prof)

static func _han_diplomacy(s, prof: Dictionary) -> void:
	for sid in s.relations:
		var r: Dictionary = s.relations[sid]
		if s.kind_of(sid) != "citystate" or r["overlord"] == "xiongnu":
			continue
		if r["han_status"] == "enfeoffed":
			Actions.make_vassal(s, sid)
		elif r["han_status"] == "none":
			Actions.enfeoff(s, sid)
	var cand = []
	for sid in s.relations:
		var r2: Dictionary = s.relations[sid]
		if s.kind_of(sid) == "citystate" and r2["overlord"] != "xiongnu" and r2["han_status"] != "vassal" and float(r2["han_influence"]) < 80.0:
			cand.append(sid)
	cand.sort_custom(func(x, y): return s.relations[x]["han_influence"] > s.relations[y]["han_influence"])
	var batch = int(prof["gift_batch"])
	for sid in cand:
		if batch <= 0 or int(s.factions["han"]["money"]) < int(prof["money_reserve"]) + 300:
			break
		if Actions.gift(s, sid, 300)["ok"]:
			batch -= 1

## 边郡存粮不足 6 个月口粮时，从陇西运粮（每次最多 6 万）。
static func _convoy_heading(s, fid: String, node_id: String) -> float:
	var cargo = 0.0
	for a in s.armies.values():
		if a["faction"] == fid and a["is_convoy"] and not a["path"].is_empty() and a["path"][-1] == node_id:
			cargo += float(a["grain"])
	return cargo

static func _han_supply(s) -> void:
	var src: Dictionary = s.nodes["chang_an"]
	var depot_nodes: Array = s.bal["victory"]["han_depot_nodes"]
	for n in s.nodes.values():
		if s.controller(n) != "han" or n["type"] in ["source", "pass"]:
			continue
		if n["faction"] == "han" and int(n["pop"]) < int(n["pop_init"]) * 0.7:
			Actions.settle(s, n["id"], 5000)
		var inbound = _convoy_heading(s, "han", n["id"])
		if n["faction"] != "han":
			if inbound > 0.0:
				continue
			# 属国城邦：只在都护府屯田区（胜利条件的粮仓节点）建汉方粮仓，目标存粮 = 门槛×1.2
			if n["id"] in depot_nodes and s.stock(n, "han") < float(s.bal["victory"]["han_depot_grain"]) * 0.6 and s.stock(src, "han") > 200000.0:
				# 长安→乌垒超过民夫自载粮可支撑的行程（≈5 个月），改由敦煌（兵站）二程转运
				var hub: Dictionary = s.nodes["dun_huang"]
				if s.stock(hub, "han") > 150000.0:
					var lab = mini(2200, int(hub["pop"]) / 2 - 1)
					Actions.transport(s, "han", "dun_huang", n["id"], mini(30000, lab * 8), lab)
			continue
		var soldiers = 0
		for a in s.armies_at(n["id"]):
			if a["faction"] == "han":
				soldiers += s.army_size(a)
		var monthly = float(n["pop"]) * 2.0 + float(soldiers) * 3.0
		if n["id"] == "dun_huang":
			monthly *= 2.0  # 敦煌是西域转运兵站，备粮按 12 个月口粮
		var deficit = monthly * 6.0 - float(n["grain"]) - inbound
		var sent = 0
		while deficit > 0.0 and sent < 3 and s.stock(src, "han") > 200000.0:
			var amount = mini(60000, int(deficit))
			# 行程以月计：民夫自载 15 粮、每月自耗 3 粮，故多派民夫抵消途中消耗
			var months = Pathfinding.days_to(s, "chang_an", n["id"], 1.0, true) / 30.0
			var lab = int(ceil(float(amount) / maxf(1.0, float(s.bal["food"]["laborer_carry"]) - float(s.bal["food"]["laborer_per_month"]) * months)))
			if not Actions.transport(s, "han", "chang_an", n["id"], amount, lab)["ok"]:
				break
			deficit -= float(amount)
			sent += 1

## 河西城失陷时：闲置野战军 + 新征中央军先集结到离失地最近的己方节点（取得补给），到齐后统一出击。
static func _han_counterattack(s, prof: Dictionary) -> void:
	if _campaign_tick(s, "han"):
		return
	var lost = ""
	var lost_days = 1e9
	for n in s.nodes.values():
		# 汉直辖节点（含玉门关/阳关）被匈奴占领；优先河西四郡，其次离长安近者
		if n["faction"] == "han" and s.controller(n) == "xiongnu":
			var d = Pathfinding.days_to(s, "chang_an", n["id"], 1.0, true) - (1000.0 if n["id"] in s.bal["victory"]["xn_targets"] else 0.0)
			if d < lost_days:
				lost_days = d
				lost = n["id"]
	if lost == "":
		return
	var members = []
	for a in _field_armies(s, "han"):
		if a["status"] in ["idle", "retreating"] and a["loc"].has("node") and s.controller(s.nodes[a["loc"]["node"]]) == "han":
			members.append(a)
	var comp = {"infantry": mini(8000, int(s.central.get("infantry", 0))), "crossbow": mini(6000, int(s.central.get("crossbow", 0))), "cavalry": mini(6000, int(s.central.get("cavalry", 0)))}
	if comp["infantry"] + comp["crossbow"] + comp["cavalry"] >= 8000:
		var r = Actions.recruit_central(s, comp, "long_xi")
		if r["ok"]:
			members.append(s.armies[r["id"]])
	var power = 0.0
	for a in members:
		power += Combat.power(s, a)
	if power < _defense_power(s, s.nodes[lost], "han") * 1.3:
		return
	_start_campaign(s, "han", lost, members)
