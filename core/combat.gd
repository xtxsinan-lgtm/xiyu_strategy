extends RefCounted
# 野战结算：避战判定 → 3 回合（远程/近战/侧翼）→ 崩溃判定 → 追击与俘马。

const Supply = preload("res://core/supply.gd")

static func combat_units(a: Dictionary) -> Dictionary:
	return a["units"]

static func total(u: Dictionary) -> float:
	var s = 0.0
	for t in u:
		s += u[t]
	return s

static func strength(state, a: Dictionary) -> float:
	var s = 0.0
	for t in a["units"]:
		var d: Dictionary = state.units[t]
		s += a["units"][t] * (d["melee"] + d["ranged"])
	return s

static func strength_units(state, u: Dictionary) -> float:
	var s = 0.0
	for t in u:
		var d: Dictionary = state.units[t]
		s += u[t] * (d["melee"] + d["ranged"])
	return s

static func army_speed(state, a: Dictionary) -> float:
	if a["is_convoy"]:
		return float(state.bal.get("movement", {}).get("convoy_speed_mult", 1.0))
	var sp = 99.0
	var any = false
	for t in a["units"]:
		if a["units"][t] > 0:
			sp = minf(sp, state.units[t]["speed"])
			any = true
	if not any:
		return 1.0
	if a["laborers"] > 0:
		sp = minf(sp, 1.0)
	return sp

static func merged_units(armies: Array) -> Dictionary:
	var u = {}
	for a in armies:
		for t in a["units"]:
			u[t] = u.get(t, 0.0) + a["units"][t]
	return u

static func starving_mult(state, armies: Array) -> float:
	var tot = 0.0
	var starv = 0.0
	for a in armies:
		var s: float = state.army_size(a)
		tot += s
		if a["starving"] > 0:
			starv += s
	if tot > 0 and starv / tot > 0.5:
		return state.bal["combat"]["starving_combat_mult"]
	return 1.0

# ---------- 纯战斗数学 ----------
static func _rows(state, u: Dictionary) -> Dictionary:
	var rows = {"front": {}, "mobile": {}, "back": {}}
	for t in u:
		if u[t] > 0.01:
			rows[state.units[t]["row"]][t] = u[t]
	return rows

static func _target_row(rows: Dictionary) -> String:
	for r in ["front", "mobile", "back"]:
		if not rows[r].is_empty():
			return r
	return ""

static func _avg_def(state, row: Dictionary, key: String) -> float:
	var n = 0.0
	var s = 0.0
	for t in row:
		n += row[t]
		s += row[t] * state.units[t][key]
	return s / n if n > 0 else 1.0

static func _damage(state, att: Dictionary, def: Dictionary, mult: float, defmult: float, ambush: bool, noise: float, rng: RandomNumberGenerator) -> Dictionary:
	var c: Dictionary = state.bal["combat"]
	var drows = _rows(state, def)
	var arows = _rows(state, att)
	var cas = {}
	var trow = _target_row(drows)
	if trow == "":
		return cas
	var jitter = 1.0 + (rng.randf_range(-noise, noise) if noise > 0 else 0.0)
	var raw = {}  # row -> float casualties
	# 远程
	var ranged = 0.0
	for r in arows:
		for t in arows[r]:
			var d: Dictionary = state.units[t]
			if d["ranged"] > 0:
				var v: float = arows[r][t] * d["ranged"]
				if trow == "mobile" and "anti_mobile" in d["tags"]:
					v *= c["anti_mobile_bonus"]
				ranged += v
	if ambush:
		ranged *= c["ambush_ranged_mult"]
	raw[trow] = raw.get(trow, 0.0) + ranged * mult * c["k_ranged"] / _avg_def(state, drows[trow], "rdef") / defmult * jitter
	# 近战（前排+机动）
	var melee = 0.0
	for r in ["front", "mobile"]:
		for t in arows[r]:
			melee += arows[r][t] * state.units[t]["melee"]
	raw[trow] += melee * mult * c["k_melee"] / _avg_def(state, drows[trow], "mdef") / defmult * jitter
	# 侧翼
	var mob_a = 0.0
	for t in arows["mobile"]:
		mob_a += arows["mobile"][t]
	var mob_d = 0.0
	for t in drows["mobile"]:
		mob_d += drows["mobile"][t]
	if mob_a > 0 and mob_a >= c["flank_ratio"] * mob_d and not drows["back"].is_empty():
		var excess = mob_a - mob_d
		var avg_melee = 0.0
		for t in arows["mobile"]:
			avg_melee += arows["mobile"][t] * state.units[t]["melee"]
		avg_melee /= mob_a
		raw["back"] = raw.get("back", 0.0) + excess * avg_melee * mult * c["k_melee"] / _avg_def(state, drows["back"], "mdef") / defmult * jitter
	# 分配到具体兵种
	for r in raw:
		var rowtot = 0.0
		for t in drows[r]:
			rowtot += drows[r][t]
		if rowtot <= 0:
			continue
		var amt: float = minf(raw[r], rowtot)
		for t in drows[r]:
			cas[t] = cas.get(t, 0.0) + amt * drows[r][t] / rowtot
	return cas

## 纯函数：a/b 为 {兵种: 数量(float)}。返回 {loss_a, loss_b, winner: "a"/"b"/"", rounds}
static func fight(state, ua: Dictionary, ub: Dictionary, ctx := {}) -> Dictionary:
	var c: Dictionary = state.bal["combat"]
	var noise: float = ctx.get("noise", c["noise"])
	var rng: RandomNumberGenerator = ctx.get("rng", state.rng)
	var A = ua.duplicate()
	var B = ub.duplicate()
	var init_a = total(A)
	var init_b = total(B)
	var loss_a = {}
	var loss_b = {}
	var winner = ""
	for rnd in int(c["rounds"]):
		var db = _damage(state, A, B, ctx.get("a_mult", 1.0), ctx.get("b_def", 1.0), ctx.get("a_ambush", false) and rnd == 0, noise, rng)
		var da = _damage(state, B, A, ctx.get("b_mult", 1.0), ctx.get("a_def", 1.0), ctx.get("b_ambush", false) and rnd == 0, noise, rng)
		for t in db:
			B[t] = maxf(0.0, B[t] - db[t])
			loss_b[t] = loss_b.get(t, 0.0) + db[t]
		for t in da:
			A[t] = maxf(0.0, A[t] - da[t])
			loss_a[t] = loss_a.get(t, 0.0) + da[t]
		var fa = total(loss_a) / maxf(init_a, 1.0)
		var fb = total(loss_b) / maxf(init_b, 1.0)
		var ba: bool = fa >= c["break_loss_ratio"] or total(A) < 1.0
		var bb: bool = fb >= c["break_loss_ratio"] or total(B) < 1.0
		if ba or bb:
			if ba and bb:
				winner = "a" if fa < fb else "b"
			else:
				winner = "b" if ba else "a"
			break
	if winner == "":
		var fa2 = total(loss_a) / maxf(init_a, 1.0)
		var fb2 = total(loss_b) / maxf(init_b, 1.0)
		if absf(fa2 - fb2) > 0.005:
			winner = "a" if fa2 < fb2 else "b"
	return {"loss_a": loss_a, "loss_b": loss_b, "winner": winner, "init_a": init_a, "init_b": init_b}

## 无噪声预估：返回我方（a）胜率估计 0~1，供 if_favorable 与 AI 使用。
static func expected_p(state, ua: Dictionary, ub: Dictionary, ctx := {}) -> float:
	if total(ua) <= 0:
		return 0.0
	if total(ub) <= 0:
		return 1.0
	var c2 = ctx.duplicate()
	c2["noise"] = 0.0
	var r = fight(state, ua, ub, c2)
	var fa: float = total(r["loss_a"]) / maxf(r["init_a"], 1.0)
	var fb: float = total(r["loss_b"]) / maxf(r["init_b"], 1.0)
	return clampf(0.5 + 2.0 * (fb - fa), 0.0, 1.0)

# ---------- 把战斗落到军队上 ----------
static func _apply_losses(state, armies: Array, loss: Dictionary) -> int:
	var dead_total = 0
	var tot = merged_units(armies)
	for t in loss:
		var lost_t = int(round(loss[t]))
		if lost_t <= 0:
			continue
		var remaining = lost_t
		var avail: float = tot.get(t, 0.0)
		for a in armies:
			if remaining <= 0:
				break
			var have: int = a["units"].get(t, 0)
			if have <= 0:
				continue
			var share = int(round(lost_t * have / maxf(avail, 1.0)))
			share = clampi(share, 0, mini(have, remaining))
			a["units"][t] = have - share
			a["horses"] = maxi(0, a["horses"] - share * int(state.units[t]["horses"]))
			remaining -= share
			dead_total += share
		# 取整余数补给第一支有该兵种的军队
		if remaining > 0:
			for a in armies:
				var have2: int = a["units"].get(t, 0)
				if have2 > 0:
					var take = mini(have2, remaining)
					a["units"][t] = have2 - take
					a["horses"] = maxi(0, a["horses"] - take * int(state.units[t]["horses"]))
					dead_total += take
					break
	return dead_total

static func _ctx_for(state, side_a: Array, side_b: Array, opts: Dictionary) -> Dictionary:
	var ctx = {"a_mult": starving_mult(state, side_a), "b_mult": starving_mult(state, side_b), "a_def": 1.0, "b_def": 1.0}
	if opts.get("defender", "") != "" and opts.get("wall_mult", 1.0) > 1.0:
		if opts["defender"] == "a":
			ctx["a_def"] = opts["wall_mult"]
		else:
			ctx["b_def"] = opts["wall_mult"]
	if opts.get("ambush", "") == "a":
		ctx["a_ambush"] = true
	elif opts.get("ambush", "") == "b":
		ctx["b_ambush"] = true
	return ctx

static func wall_mult(state, node: Dictionary) -> float:
	if node["walls"] <= 0:
		return 1.0
	var ratio: float = node["wall_hp"] / maxf(node["wall_hp_max"], 1.0)
	return 1.0 + state.bal["combat"]["wall_def_per_level"] * node["walls"] * ratio

## 执行一场战斗。side_a/side_b 为军队 dict 列表（非民兵）。militia_b 可为守城民兵 {unit: n}。
## 返回报告 dict。
static func resolve_battle(state, side_a: Array, side_b: Array, where: String, opts := {}) -> Dictionary:
	var ua = merged_units(side_a)
	var ub = merged_units(side_b)
	var node_ref: Dictionary = opts.get("node", {})
	var militia: Dictionary = opts.get("militia", {})
	if not militia.is_empty():
		for t in militia:
			ub[t] = ub.get(t, 0.0) + militia[t]
	var ctx = _ctx_for(state, side_a, side_b, opts)
	var fa_name: String = side_a[0]["faction"] if not side_a.is_empty() else ""
	var fb_name: String = side_b[0]["faction"] if not side_b.is_empty() else opts.get("b_faction", "")
	var report = {"where": where, "a": fa_name, "b": fb_name, "winner": "", "loss_a": 0, "loss_b": 0, "horses_captured": 0}
	var ta = total(ua)
	var tb = total(ub)
	if ta <= 0.0 and tb <= 0.0:
		return report
	var res: Dictionary
	if ta <= 0.0:
		res = {"loss_a": {}, "loss_b": {}, "winner": "b"}
	elif tb <= 0.0:
		res = {"loss_a": {}, "loss_b": {}, "winner": "a"}
	else:
		res = fight(state, ua, ub, ctx)
	var dead_a = _apply_losses(state, side_a, res["loss_a"])
	var dead_b = 0
	if not militia.is_empty():
		# 先扣民兵：按兵种比例分摊
		var lb: Dictionary = res["loss_b"]
		for t in militia:
			var share = lb.get(t, 0.0) * militia[t] / maxf(ub.get(t, 1.0), 1.0)
			var lost = mini(int(militia[t]), int(round(share)))
			opts["node"]["militia"][t] = maxi(0, int(opts["node"]["militia"][t]) - lost)
			dead_b += lost
			lb[t] = lb.get(t, 0.0) - share
		dead_b += _apply_losses(state, side_b, lb)
	else:
		dead_b = _apply_losses(state, side_b, res["loss_b"])
	var winner_side: String = res["winner"]
	var win_armies: Array = side_a if winner_side == "a" else side_b
	var lose_armies: Array = side_b if winner_side == "a" else side_a
	# 追击与俘马
	if winner_side != "":
		var mob_w = 0.0
		for a in win_armies:
			for t in a["units"]:
				if state.units[t]["row"] == "mobile":
					mob_w += a["units"][t]
		var pursuit = mob_w * state.bal["combat"]["pursuit_k"]
		var lose_size = 0.0
		for a in lose_armies:
			lose_size += state.army_size(a)
		pursuit = minf(pursuit, lose_size * 0.3)
		if pursuit > 0:
			var tl = merged_units(lose_armies)
			var fl = {}
			var tt = total(tl)
			for t in tl:
				fl[t] = pursuit * tl[t] / maxf(tt, 1.0)
			var extra = _apply_losses(state, lose_armies, fl)
			if winner_side == "a":
				dead_b += extra
			else:
				dead_a += extra
		var captured = 0
		for a in lose_armies:
			var take = int(a["horses"] * state.bal["combat"]["horse_capture_ratio"])
			a["horses"] -= take
			captured += take
		if captured > 0 and not win_armies.is_empty():
			win_armies[0]["horses"] += captured
			state.stats["horses_captured"] += captured
		report["horses_captured"] = captured
	report["winner"] = fa_name if winner_side == "a" else (fb_name if winner_side == "b" else "")
	report["loss_a"] = dead_a
	report["loss_b"] = dead_b
	Supply._count_casualty(state, fa_name, dead_a)
	Supply._count_casualty(state, fb_name, dead_b)
	state.stats["battles"] += 1
	# 输家溃退；输家若是运输队则被劫
	for a in lose_armies:
		if a["is_convoy"] or state.army_size(a) == 0:
			_plunder_convoy(state, a, win_armies)
	if winner_side != "":
		for a in lose_armies:
			if state.armies.has(a["id"]):
				retreat_army(state, a, opts.get("attacker_fallback", ""))
	# 清理全灭军队
	for a in side_a + side_b:
		if state.armies.has(a["id"]) and state.army_size(a) == 0 and a["laborers"] == 0:
			state.remove_army(a["id"])
	var text = "%s 战于%s：%s 损 %d，%s 损 %d，%s 胜" % [state.factions[fa_name]["name"] if fa_name != "" else "?", where, state.factions[fa_name]["name"] if fa_name != "" else "?", dead_a, state.factions[fb_name]["name"] if state.factions.has(fb_name) else "守军", dead_b, state.factions[report["winner"]]["name"] if report["winner"] != "" else "无"]
	state.log_event("battle", text, {"report": report})
	if winner_side != "" and report["winner"] == "han" and fb_name == "xiongnu":
		_han_victory_effect(state, where, node_ref)
	return report

static func _plunder_convoy(state, convoy: Dictionary, winners: Array) -> void:
	if winners.is_empty() or not state.armies.has(convoy["id"]):
		return
	var cap: float = convoy["grain"] * state.bal["combat"]["convoy_capture_ratio"]
	winners[0]["grain"] += cap
	state.log_event("convoy", "运输队被劫，失粮 %d" % int(convoy["grain"]))
	convoy["units"] = {}
	convoy["laborers"] = 0
	convoy["grain"] = 0.0
	state.remove_army(convoy["id"])

static func _han_victory_effect(state, where: String, node: Dictionary) -> void:
	var node_id: String = where if state.nodes.has(where) else ""
	if node_id == "":
		return
	var d: Dictionary = state.bal["diplomacy"]
	for sid in state.relations:
		var rel: Dictionary = state.relations[sid]
		for n in state.nodes_of_state(sid):
			if state.hops(node_id, n["id"], d["victory_near_hops"]) <= d["victory_near_hops"]:
				rel["han_influence"] = minf(d["influence_max"], rel["han_influence"] + d["victory_influence"])
				rel["xn_intimidation"] = maxf(0.0, rel["xn_intimidation"] - d["victory_intimidation_loss"])
				break

## 败军撤退：优先回上一节点，否则相邻己方节点，实在无路则溃散。
static func retreat_army(state, a: Dictionary, fallback := "") -> void:
	var dest = ""
	var f: String = a["faction"]
	var enemy_nodes = {}
	for id in state.armies:
		var e: Dictionary = state.armies[id]
		if state.is_hostile(e["faction"], f) and e["loc"].has("node") and not e["is_convoy"]:
			enemy_nodes[e["loc"]["node"]] = true
	if a["loc"].has("route"):
		dest = a["loc"]["from"]
		if enemy_nodes.has(dest):
			dest = a["loc"]["to"]
	else:
		var here: String = a["loc"]["node"]
		var cands = []
		if fallback != "" and fallback != here:
			cands.append(fallback)
		if a["prev_node"] != here:
			cands.append(a["prev_node"])
		cands.append_array(state.neighbors(here))
		for cnd in cands:
			if enemy_nodes.has(cnd) or not state.nodes.has(cnd):
				continue
			var idx: int = state.route_between(here, cnd)
			if idx < 0 or state.route_closed(idx):
				continue
			var ctl: String = state.controller(state.nodes[cnd])
			if ctl == f or ctl == "":
				dest = cnd
				break
	if dest == "":
		var sz: int = state.army_size(a)
		state.log_event("rout", "%s 溃散" % a["name"])
		Supply._count_casualty(state, f, sz)
		state.remove_army(a["id"])
		return
	a["plan"] = {"steps": [{"type": "move_to", "node": dest}, {"type": "hold", "node": dest, "months": 1}], "triggers": [], "engage": a["plan"]["engage"], "preset": "retreat", "step_ticks": 0, "reacted": true}
	a["path"] = []
	a["status"] = "retreating"
	if a["loc"].has("node"):
		var here2: String = a["loc"]["node"]
		var ridx: int = state.route_between(here2, dest)
		a["loc"] = {"route": ridx, "from": here2, "to": dest, "prog": 0.05}
		a["path"] = [dest]

# ---------- 每 tick 遭遇检测 ----------
static func _want_fight(state, mine: Array, theirs: Array, ctx_opts: Dictionary) -> bool:
	# 返回 true = 愿意迎战；false = 想避战
	var rule = "always"
	var p = 0.0
	for a in mine:
		var e: Array = a["plan"]["engage"]
		if e[0] == "never":
			rule = "never"
		elif e[0] == "if_favorable" and rule != "never":
			rule = "if_favorable"
			p = maxf(p, float(e[1]))
	if rule == "always":
		return true
	if rule == "never":
		return false
	var ctx = _ctx_for(state, mine, theirs, ctx_opts)
	var est = expected_p(state, merged_units(mine), merged_units(theirs), ctx)
	return est >= p

static func _fastest(state, armies: Array) -> float:
	var s = 0.0
	for a in armies:
		s = maxf(s, army_speed(state, a))
	return s

static func _slowest(state, armies: Array) -> float:
	var s = 99.0
	for a in armies:
		s = minf(s, army_speed(state, a))
	return s

static func _fight_or_evade(state, side_a: Array, side_b: Array, where: String, opts: Dictionary) -> void:
	# 运输队/无战斗力一方不选择避战
	var a_has = false
	for x in side_a:
		if not x["is_convoy"] and state.army_size(x) > 0:
			a_has = true
	var b_has = false
	for x in side_b:
		if not x["is_convoy"] and state.army_size(x) > 0:
			b_has = true
	var margin: float = state.bal["combat"]["evade_speed_margin"]
	var o_a = opts.duplicate()
	var o_b = opts.duplicate()
	var a_wants = not a_has or _want_fight(state, side_a, side_b, o_a)
	var b_wants = not b_has or _want_fight(state, side_b, side_a, _swap(opts))
	if not a_wants and _slowest(state, side_a) >= margin * _fastest(state, side_b):
		state.log_event("evade", "%s 避战于%s" % [side_a[0]["name"], where])
		for x in side_a:
			retreat_army(state, x)
		return
	if not b_wants and _slowest(state, side_b) >= margin * _fastest(state, side_a):
		state.log_event("evade", "%s 避战于%s" % [side_b[0]["name"], where])
		for x in side_b:
			retreat_army(state, x)
		return
	resolve_battle(state, side_a, side_b, where, opts)

static func _swap(opts: Dictionary) -> Dictionary:
	var o = opts.duplicate()
	if o.get("defender", "") == "a":
		o["defender"] = "b"
	elif o.get("defender", "") == "b":
		o["defender"] = "a"
	if o.get("ambush", "") == "a":
		o["ambush"] = "b"
	elif o.get("ambush", "") == "b":
		o["ambush"] = "a"
	return o

static func encounters(state) -> void:
	# 正在设伏就阻断该路段的商路，不依赖当天恰好有军队经过。
	for route in state.routes:
		route["raided_by"] = ""
	for army in state.armies.values():
		var steps: Array = army["plan"]["steps"]
		if steps.is_empty() or steps[0]["type"] != "ambush" or not army["loc"].has("node"):
			continue
		var route_id: int = steps[0].get("route", -1)
		if route_id >= 0 and route_id < state.routes.size():
			var route: Dictionary = state.routes[route_id]
			if army["loc"]["node"] in [route["a"], route["b"]]:
				route["raided_by"] = army["faction"]
	# 1) 同节点
	var by_node = {}
	for id in state.armies:
		var a: Dictionary = state.armies[id]
		if a["loc"].has("node"):
			if not by_node.has(a["loc"]["node"]):
				by_node[a["loc"]["node"]] = {"han": [], "xiongnu": []}
			if by_node[a["loc"]["node"]].has(a["faction"]):
				by_node[a["loc"]["node"]][a["faction"]].append(a)
	for nid in by_node:
		var g: Dictionary = by_node[nid]
		if g["han"].is_empty() or g["xiongnu"].is_empty():
			continue
		var h: Array = g["han"].filter(func(x): return state.armies.has(x["id"]))
		var x_: Array = g["xiongnu"].filter(func(x): return state.armies.has(x["id"]))
		if h.is_empty() or x_.is_empty():
			continue
		var node: Dictionary = state.nodes[nid]
		var ctl: String = state.controller(node)
		var opts = {"node": node}
		var h_mobile = h.any(func(z): return not z["trace"].is_empty())
		var x_mobile = x_.any(func(z): return not z["trace"].is_empty())
		var def = ""
		if ctl == "han":
			def = "a"
		elif ctl == "xiongnu":
			def = "b"
		elif not h_mobile and x_mobile:
			def = "a"
		elif not x_mobile and h_mobile:
			def = "b"
		if def != "":
			opts["defender"] = def
			opts["wall_mult"] = wall_mult(state, node)
		_fight_or_evade(state, h, x_, nid, opts)
	# 2) 路段上相向/追赶
	var seg = {}  # route idx -> [ {army, p0, p1} ]
	for id in state.armies:
		var a: Dictionary = state.armies[id]
		for tr in a["trace"]:
			if not seg.has(tr["route"]):
				seg[tr["route"]] = []
			seg[tr["route"]].append({"army": a, "p0": tr["p0"], "p1": tr["p1"]})
	for ridx in seg:
		var lst: Array = seg[ridx]
		for i in lst.size():
			for j in range(i + 1, lst.size()):
				var u: Dictionary = lst[i]
				var v: Dictionary = lst[j]
				var ua: Dictionary = u["army"]
				var va: Dictionary = v["army"]
				if not state.armies.has(ua["id"]) or not state.armies.has(va["id"]):
					continue
				if not state.is_hostile(ua["faction"], va["faction"]):
					continue
				if (u["p0"] - v["p0"]) * (u["p1"] - v["p1"]) > 0.0:
					continue
				var side_a: Array = [ua] if ua["faction"] == "han" else [va]
				var side_b: Array = [va] if ua["faction"] == "han" else [ua]
				_fight_or_evade(state, side_a, side_b, "道路(%s—%s)" % [state.nodes[state.routes[ridx]["a"]]["name"], state.nodes[state.routes[ridx]["b"]]["name"]], {})
	# 3) 设伏
	for id in state.armies.keys():
		if not state.armies.has(id):
			continue
		var amb: Dictionary = state.armies[id]
		var steps: Array = amb["plan"]["steps"]
		if steps.is_empty() or steps[0]["type"] != "ambush" or not amb["loc"].has("node"):
			continue
		var ridx2: int = steps[0].get("route", -1)
		if ridx2 < 0 or not seg.has(ridx2):
			continue
		state.routes[ridx2]["raided_by"] = amb["faction"]
		for e in seg[ridx2]:
			var ea: Dictionary = e["army"]
			if state.armies.has(ea["id"]) and state.armies.has(amb["id"]) and state.is_hostile(ea["faction"], amb["faction"]):
				var sa: Array = [amb] if amb["faction"] == "han" else [ea]
				var sb: Array = [ea] if amb["faction"] == "han" else [amb]
				resolve_battle(state, sa, sb, "伏击", {"ambush": "a" if amb["faction"] == "han" else "b"})
