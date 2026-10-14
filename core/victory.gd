extends RefCounted
# 胜利检查（按月）与到期计分。

static func han_vassals(state) -> int:
	var n = 0
	for sid in state.relations:
		if state.factions[sid].get("counts_for_victory", false) and state.relations[sid]["overlord"] == "han":
			n += 1
	return n

static func han_conditions_met(state) -> bool:
	var v: Dictionary = state.bal["victory"]
	if han_vassals(state) < v["han_required"]:
		return false
	for sid in v["han_must_have"]:
		if state.relations[sid]["overlord"] != "han":
			return false
	return true

static func hexi_held_by_xn(state) -> int:
	var c = 0
	for nid in state.bal["victory"]["xn_targets"]:
		if state.nodes[nid]["faction"] == "xiongnu":
			c += 1
	return c

static func score(state) -> Dictionary:
	var v: Dictionary = state.bal["victory"]["score"]
	var hexi_han = 0
	for nid in state.bal["victory"]["xn_targets"]:
		if state.nodes[nid]["faction"] == "han":
			hexi_han += 1
	var han_s: float = han_vassals(state) * v["han_vassal"] + hexi_han * v["hexi_held"]
	var xn_s: float = (4 - hexi_han) * v["hexi_held"]
	var xn_vassals = 0
	for sid in state.relations:
		if state.factions[sid].get("counts_for_victory", false) and state.relations[sid]["overlord"] == "xiongnu":
			xn_vassals += 1
	xn_s += xn_vassals * v["han_vassal"]
	# 只奖励当前仍生效的破坏，避免反复刷劫掠次数得分。
	var pressure := 0.0
	for node_id in state.bal["victory"]["xn_targets"]:
		if preload("res://core/buff_system.gd").has(state, "sacked", node_id) and state.nodes[node_id]["faction"] == "han":
			pressure += v["sacked_hexi"]
	xn_s += minf(pressure, v["raid_pressure_cap"])
	return {"han": han_s, "xiongnu": xn_s}

static func objective_progress(state, faction: String) -> float:
	var v: Dictionary = state.bal["victory"]
	if faction == "xiongnu":
		return float(hexi_held_by_xn(state)) / maxi(1, v["xn_targets"].size())
	var must := 0
	for sid in v["han_must_have"]:
		if state.relations[sid]["overlord"] == "han":
			must += 1
	return minf(minf(1.0, float(han_vassals(state)) / maxi(1, int(v["han_required"]))), float(must) / maxi(1, v["han_must_have"].size()))

static func _scored_winner(state, scores: Dictionary) -> Dictionary:
	if scores["han"] != scores["xiongnu"]:
		return {"winner": "han" if scores["han"] > scores["xiongnu"] else "xiongnu", "detail": ""}
	var h := objective_progress(state, "han")
	var x := objective_progress(state, "xiongnu")
	if not is_equal_approx(h, x):
		return {"winner": "han" if h > x else "xiongnu", "detail": "同分按目标完成度判定"}
	var v: Dictionary = state.bal["victory"]
	h = float(state.streak["han"]) / maxi(1, int(v["han_hold_turns"]))
	x = float(state.streak["xiongnu"]) / maxi(1, int(v["xn_hold_turns"]))
	if not is_equal_approx(h, x):
		return {"winner": "han" if h > x else "xiongnu", "detail": "同分按持续达标进度判定"}
	return {"winner": "han" if state.rng.randi_range(0, 1) == 0 else "xiongnu", "detail": "同分同进度，抽签判定"}


static func monthly(state) -> void:
	var v: Dictionary = state.bal["victory"]
	state.stats["han_vassals_peak"] = maxi(state.stats["han_vassals_peak"], han_vassals(state))
	if han_conditions_met(state):
		state.streak["han"] += 1
	else:
		state.streak["han"] = 0
	if hexi_held_by_xn(state) >= v["xn_targets"].size():
		state.streak["xiongnu"] += 1
	else:
		state.streak["xiongnu"] = 0
	if state.streak["han"] >= v["han_hold_turns"] and state.streak["xiongnu"] >= v["xn_hold_turns"]:
		var result := _scored_winner(state, score(state))
		state.winner = result["winner"]
		state.win_reason = "双方同月达成胜利条件，按分数与目标进度判定" + ("（%s）" % result["detail"] if result["detail"] != "" else "")
	elif state.streak["han"] >= v["han_hold_turns"]:
		state.winner = "han"
		state.win_reason = "设立西域都护府"
	elif state.streak["xiongnu"] >= v["xn_hold_turns"]:
		state.winner = "xiongnu"
		state.win_reason = "夺回河西四郡"
	elif state.tick / 3 + 1 >= state.max_turns:
		var s = score(state)
		var result := _scored_winner(state, s)
		state.winner = result["winner"]
		state.win_reason = "到期计分 汉%d : 匈奴%d" % [int(s["han"]), int(s["xiongnu"])] + ("（%s）" % result["detail"] if result["detail"] != "" else "")
	if state.winner != "":
		state.log_event("victory", "%s 获胜：%s" % [state.factions[state.winner]["name"], state.win_reason])
