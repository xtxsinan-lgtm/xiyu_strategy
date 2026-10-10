extends RefCounted
# Dijkstra：权重 = 路段天数 / 速度。冬季封闭路段不可走。

static func dijkstra(state, from_id: String, speed := 1.0, avoid := {}, ignore_closed := false) -> Dictionary:
	var dist := {from_id: 0.0}
	var prev := {}
	var open := [from_id]
	var done := {}
	while not open.is_empty():
		var best := 0
		for i in open.size():
			if dist[open[i]] < dist[open[best]]:
				best = i
		var cur: String = open[best]
		open.remove_at(best)
		if done.has(cur):
			continue
		done[cur] = true
		for idx in state.adj[cur]:
			var r: Dictionary = state.routes[idx]
			var nb: String = r["b"] if r["a"] == cur else r["a"]
			if avoid.has(nb) and nb != from_id:
				continue
			if not ignore_closed and state.route_closed(idx):
				continue
			var nd: float = dist[cur] + float(r["days"]) / maxf(speed, 0.1)
			if not dist.has(nb) or nd < dist[nb]:
				dist[nb] = nd
				prev[nb] = cur
				open.append(nb)
	return {"dist": dist, "prev": prev}

static func path_to(state, from_id: String, to_id: String, speed := 1.0, avoid := {}, ignore_closed := false) -> Array:
	if from_id == to_id:
		return []
	var res := dijkstra(state, from_id, speed, avoid, ignore_closed)
	if not res["dist"].has(to_id):
		return []
	var out := []
	var cur := to_id
	while cur != from_id:
		out.push_front(cur)
		cur = res["prev"][cur]
	return out

static func days_to(state, from_id: String, to_id: String, speed := 1.0, ignore_closed := true) -> float:
	var res := dijkstra(state, from_id, speed, {}, ignore_closed)
	return res["dist"].get(to_id, INF)
