extends RefCounted
# 商路：自敦煌起连续可通的前缀上，每个国家 +影响力，汉 +钱。遇到第一个不可通节点即截断。

static func node_passable(state, nid: String) -> bool:
	var n: Dictionary = state.nodes[nid]
	var f: String = n["faction"]
	if f == "xiongnu":
		return false
	if state.relations.has(f):
		var rel: Dictionary = state.relations[f]
		if rel["overlord"] == "xiongnu" and rel["xn_intimidation"] >= state.bal["trade"]["ban_intimidation"]:
			return false
	return true

static func open_prefix(state, tr: Dictionary) -> Array:
	var out = []
	var nodes: Array = tr["nodes"]
	for i in nodes.size():
		var nid: String = nodes[i]
		if i > 0:
			var idx: int = state.route_between(nodes[i - 1], nid)
			# 节点图里相邻商路段缺失则视为经陆路相连（只检查被劫）
			if idx >= 0 and state.routes[idx]["raided_by"] == "xiongnu":
				break
		if not node_passable(state, nid):
			break
		out.append(nid)
	return out

static func monthly(state) -> void:
	var t: Dictionary = state.bal["trade"]
	if state.routes.any(func(r): return r["raided_by"] == "xiongnu"):
		state.stats["trade_blocked_months"] = state.stats.get("trade_blocked_months", 0) + 1
	var credited = {}
	for tr in state.trade_routes:
		for nid in open_prefix(state, tr):
			var sid: String = state.nodes[nid]["faction"]
			if state.relations.has(sid) and not credited.has(sid + tr["id"]):
				credited[sid + tr["id"]] = true
				state.relations[sid]["han_influence"] = minf(100.0, state.relations[sid]["han_influence"] + t["influence_per_state_month"])
				state.factions["han"]["money"] += int(t["money_per_state_month"])
	# 伏击标记在无伏兵时自动解除
	for i in state.routes.size():
		var r: Dictionary = state.routes[i]
		if r["raided_by"] != "":
			var still = false
			for id in state.armies:
				var a: Dictionary = state.armies[id]
				var st = a["plan"]["steps"][0] if not a["plan"]["steps"].is_empty() else null
				if st != null and st["type"] == "ambush" and st.get("route", -1) == i:
					still = true
			if not still:
				r["raided_by"] = ""
