extends RefCounted
# 外交月结（设计 §5.1/5.5）：衰减、商路辐射、大军威吓辐射、西域国家倾向与叛离/请求册封。

const Buffs = preload("res://core/buffs.gd")

static func month_end(s) -> void:
	var d: Dictionary = s.bal["diplomacy"]
	for sid in s.relations:
		var r: Dictionary = s.relations[sid]
		r["xn_intimidation"] = maxf(0.0, float(r["xn_intimidation"]) - _decay(s, r))
		r["xn_resentment"] = maxf(0.0, float(r["xn_resentment"]) - float(d["resentment_decay_month"]))
		r["gifted"] = maxf(0.0, float(r.get("gifted", 0.0)) * (1.0 - float(d["gift_decay"])))
		if r["xn_status"] == "vassal" and r["overlord"] == "xiongnu":
			_collect_tax(s, r)
	_trade(s)
	_xn_presence(s)
	for sid in s.relations:
		_citystate_ai(s, sid)

## 威吓每月衰减；匈奴册封/和亲/质子使衰减变慢（§5.4）。
static func _decay(s, r: Dictionary) -> float:
	var base := float(s.bal["diplomacy"]["intimidation_decay_month"])
	if r["xn_status"] != "none" or r["marriage"] == "xiongnu":
		base *= 0.5
	if r["hostage"] == "xiongnu":
		base = 0.0
	return base

## 匈奴属国按税率档位上缴钱，并积累怨恨（与税率成正比，§5.4）。
static func _collect_tax(s, r: Dictionary) -> void:
	var d: Dictionary = s.bal["diplomacy"]
	var level := clampi(int(r["tax_level"]), 0, d["tax_rates"].size() - 1)
	var tr: Dictionary = d["tax_rates"][level]
	var node: Dictionary = _state_capital(s, r["state"])
	if node.is_empty():
		return
	s.factions["xiongnu"]["money"] += int(float(node["pop"]) * float(tr["money"]) * 12.0 / 12.0)
	r["xn_resentment"] = minf(100.0, float(r["xn_resentment"]) + float(tr["res"]))

static func _state_capital(s, sid: String) -> Dictionary:
	for n in s.nodes_of_state(sid):
		return n
	return {}

## 商路辐射（§5.1）：自敦煌起沿路逐国推进；汉可通行（汉控制或独立且未被匈奴强压）则本国 +影响力、汉 +钱；
## 遇到被匈奴威吓压制的国家（威吓≥ban 且为匈奴属国，且无汉质子）则商路在该国中断，其后各国不再受益。
static func _trade(s) -> void:
	var t: Dictionary = s.bal["trade"]
	for tr in s.trade_routes:
		var blocked_by := ""
		for i in tr["nodes"].size():
			var nid: String = tr["nodes"][i]
			var n: Dictionary = s.nodes[nid]
			var fid: String = n["faction"]
			if i == 0 and s.controller(n) != "han":
				break
			if not s.relations.has(fid):
				continue
			if _route_raided(s, tr, i):
				blocked_by = nid
			var r: Dictionary = s.relations[fid]
			var banned: bool = r["overlord"] == "xiongnu" and float(r["xn_intimidation"]) >= float(t["ban_intimidation"]) and r["hostage"] != "han"
			if banned or blocked_by != "":
				blocked_by = nid
				break
			r["han_influence"] = minf(float(s.bal["diplomacy"]["influence_max"]), float(r["han_influence"]) + float(t["influence_per_state_month"]))
			s.factions["han"]["money"] += int(t["money_per_state_month"])

## 商路第 i 个节点所在段被袭扰（有匈奴非驻军军队驻扎在该节点或其前一节点）。
static func _route_raided(s, tr: Dictionary, i: int) -> bool:
	for j in [i, i - 1]:
		if j < 0:
			continue
		for a in s.armies_at(tr["nodes"][j]):
			if a["faction"] == "xiongnu" and not a["garrison"] and s.controller(s.nodes[tr["nodes"][j]]) != "xiongnu":
				return true
	return false

## 匈奴大军驻扎的威吓辐射（§5.1）：军队规模/城邦人口每 10% 为本国 +3，月上限 10；邻接国减半。
static func _xn_presence(s) -> void:
	var d: Dictionary = s.bal["diplomacy"]
	for a in s.armies.values():
		if a["faction"] != "xiongnu" or a["garrison"] or not a["loc"].has("node"):
			continue
		var at: String = a["loc"]["node"]
		for nid in [at] + s.neighbors(at):
			var n: Dictionary = s.nodes[nid]
			if not s.relations.has(n["faction"]) or s.controller(n) == "xiongnu" and nid != at:
				continue
			var r: Dictionary = s.relations[n["faction"]]
			if r["overlord"] == "han":
				continue
			var ratio := float(s.army_size(a)) / maxf(1.0, float(n["pop"]))
			var gain := minf(float(d["xn_presence_cap_month"]), floorf(ratio / 0.1) * float(d["xn_presence_intimidation_per_10pct"]))
			if nid != at:
				gain *= 0.5
			r["xn_intimidation"] = minf(100.0, float(r["xn_intimidation"]) + gain)

## 倾向 = 汉影响力 − 匈奴威吓 + 怨恨×w − 距汉最近据点的跳数×修正（§5.5；王族个人倾向暂缺）。
static func lean(s, sid: String) -> float:
	var r: Dictionary = s.relations[sid]
	var d: Dictionary = s.bal["diplomacy"]
	var far := 0.0
	var cap := _state_capital(s, sid)
	if not cap.is_empty():
		var best := 99
		for id in ["dun_huang", "yumen_guan", "yang_guan"]:
			best = mini(best, s.hops(id, cap["id"], 12))
		far = float(best) * float(d["lean_far_per_hop"])
	return float(r["han_influence"]) - float(r["xn_intimidation"]) + float(r["xn_resentment"]) * float(d["lean_w_resentment"]) - far

static func _citystate_ai(s, sid: String) -> void:
	var r: Dictionary = s.relations[sid]
	if s.kind_of(sid) != "citystate":
		return
	var c: Dictionary = s.bal["citystate"]
	var d: Dictionary = s.bal["diplomacy"]
	if int(r["request_cd"]) > 0:
		r["request_cd"] = int(r["request_cd"]) - 1
	# 匈奴属国叛乱：威吓低而怨恨高
	if r["overlord"] == "xiongnu" and r["xn_status"] == "vassal" and float(r["xn_intimidation"]) < float(c["rebel_xn_intimidation_below"]) and float(r["xn_resentment"]) > float(c["rebel_xn_resentment_above"]):
		r["overlord"] = ""
		r["xn_status"] = "none"
		s.log_event("diplomacy", "%s 叛离匈奴" % s.factions[sid]["name"], {"state": sid})
		return
	# 汉属国/册封国：匈奴威吓压过汉影响力 → 册封失效（册封→独立）
	if r["han_status"] == "enfeoffed" and float(r["xn_intimidation"]) - float(r["han_influence"]) > float(c["defect_to_xn_margin"]):
		r["han_status"] = "none"
		_remove_state_buffs(s, "han_enfeoffed", sid)
		s.log_event("diplomacy", "%s 因匈奴威吓失去汉册封" % s.factions[sid]["name"], {"state": sid})
	if r["overlord"] == "" and r["han_status"] == "none":
		var xn_edge := float(r["xn_intimidation"]) - float(r["han_influence"])
		if xn_edge >= float(c["defect_to_xn_margin"]) and float(r["xn_intimidation"]) >= float(d["xn_vassal_min_intimidation"]):
			r["overlord"] = "xiongnu"
			r["xn_status"] = "vassal"
			s.log_event("diplomacy", "%s 降附匈奴" % s.factions[sid]["name"], {"state": sid})
		elif lean(s, sid) >= float(d["request_enfeoff_lean"]) and int(r["request_cd"]) == 0 and float(r["han_influence"]) >= float(d["enfeoff_min_influence"]):
			r["request_cd"] = int(d["request_cooldown_turns"]) * 3
			s.requests.append({"kind": "request_enfeoff", "state": sid, "tick": s.tick})
			s.log_event("diplomacy", "%s 遣使请求汉册封" % s.factions[sid]["name"], {"state": sid})

static func _remove_state_buffs(s, def_id: String, sid: String) -> void:
	var b: Dictionary = Buffs.find(s, def_id, sid)
	if not b.is_empty():
		Buffs.remove(s, b)
