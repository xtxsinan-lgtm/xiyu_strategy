extends RefCounted
# 回合推进与胜负判定。引擎每次推进 1 个 tick（10 天）；每 decision_ticks 个 tick 为玩家一个回合（一季）。
# 用法：Sim.start(state); 下令（Actions.*）; Sim.advance_turn(state) 或 Sim.step(state) 逐 tick，直到 state.winner != ""。

const Buffs = preload("res://core/buffs.gd")
const Economy = preload("res://core/economy.gd")
const Diplomacy = preload("res://core/diplomacy.gd")
const Warfare = preload("res://core/warfare.gd")
const Cal = preload("res://core/calendar.gd")

## 开局：挂载全局季节 Buff 并执行首个回合的回合初结算。
static func start(s) -> void:
	Buffs.add(s, "season_winter")
	_turn_start(s)

static func is_turn_start(s) -> bool:
	return s.tick % s.decision_ticks == 0

## 推进一个 tick。返回 true 表示刚好完成一个玩家回合。
static func step(s) -> bool:
	Warfare.step(s)
	if Cal.is_month_end(s.tick):
		Economy.month_end(s)
		Diplomacy.month_end(s)
		Buffs.tick(s, "month")
	s.tick += 1
	if s.tick % s.decision_ticks == 0:
		s.turn += 1
		_turn_end(s)
		if s.winner == "" and s.turn >= s.max_turns:
			_final_score(s)
		if s.winner == "":
			_turn_start(s)
		return true
	return false

## 推进到下一个玩家决策点（或有人获胜）。常备指令在此期间自主执行。
static func advance_turn(s) -> void:
	while s.winner == "":
		if step(s):
			return

## 快进至下一事件：运行到发生战斗/占领/叛离/请求册封之一、或回合结束为止（设计 §1.1 防拖沓）。
static func fast_forward(s) -> void:
	var seen: int = s.log.size()
	while s.winner == "":
		var done := step(s)
		for i in range(seen, s.log.size()):
			if s.log[i]["kind"] in ["battle", "capture", "diplomacy", "farm"]:
				return
		seen = s.log.size()
		if done:
			return

static func _turn_start(s) -> void:
	s.events = []
	Buffs.tick(s, "turn")
	# 中央军与年度拨款：每年包含正月的冬季回合开头（12 月起始）
	if s.month() == 12:
		var h: Dictionary = s.bal["han"]
		for t in h["central_regen_year"]:
			s.central[t] = mini(int(h["central_cap"][t]), int(s.central.get(t, 0)) + int(h["central_regen_year"][t]))
		s.factions["han"]["money"] += int(h["annual_money"])
		s.log_event("court", "年度拨款：钱 +%d，中央军补充" % int(h["annual_money"]))

static func _turn_end(s) -> void:
	_victory(s)

# ---------- 胜负（设计 §9）----------
static func han_condition(s) -> Dictionary:
	var v: Dictionary = s.bal["victory"]
	var count := 0
	var must_ok := true
	var max_int_ok := true
	for sid in s.relations:
		if s.factions[sid].get("counts_for_victory", false):
			var r: Dictionary = s.relations[sid]
			if r["overlord"] == "han":
				count += 1
				if float(r["xn_intimidation"]) >= float(v["han_max_intimidation"]):
					max_int_ok = false
	for sid in v["han_must_have"]:
		if s.relations[sid]["overlord"] != "han":
			must_ok = false
	var grain := 0.0
	for nid in v["han_depot_nodes"]:
		grain += s.stock(s.nodes[nid], "han")
	return {"count": count, "ok": count >= int(v["han_required"]) and must_ok and max_int_ok and grain >= float(v["han_depot_grain"]),
		"must": must_ok, "intim": max_int_ok, "depot_grain": grain}

static func xn_condition(s) -> bool:
	for nid in s.bal["victory"]["xn_targets"]:
		if s.controller(s.nodes[nid]) != "xiongnu":
			return false
	return true

static func _victory(s) -> void:
	var v: Dictionary = s.bal["victory"]
	var hc := han_condition(s)
	s.streak["han"] = int(s.streak["han"]) + 1 if hc["ok"] else 0
	s.streak["xiongnu"] = int(s.streak["xiongnu"]) + 1 if xn_condition(s) else 0
	s.stats["han_vassals_peak"] = maxi(int(s.stats["han_vassals_peak"]), int(hc["count"]))
	if s.streak["han"] >= int(v["han_hold_turns"]):
		s.winner = "han"
		s.win_reason = "设立西域都护府"
	elif s.streak["xiongnu"] >= int(v["xn_hold_turns"]):
		s.winner = "xiongnu"
		s.win_reason = "夺回河西四郡"
	if s.winner != "":
		s.log_event("victory", "%s 获胜：%s" % [s.winner, s.win_reason])

## 剧本结束仍无人胜利：按控制国数、河西持有、马匹计分（设计 §9 末）。
static func _final_score(s) -> void:
	var sc: Dictionary = s.bal["victory"]["score"]
	var vassals := 0
	for r in s.relations.values():
		if r["overlord"] == "han":
			vassals += 1
	var hexi_held := 0
	for nid in s.bal["victory"]["xn_targets"]:
		if s.controller(s.nodes[nid]) == "han":
			hexi_held += 1
	var horses := 0
	for n in s.nodes.values():
		if s.controller(n) == "han":
			horses += int(n["horses"])
	var han_score := float(vassals) * float(sc["han_vassal"]) + float(hexi_held) * float(sc["hexi_held"]) + float(horses) / 1000.0 * float(sc["horses_per_1000"])
	var xn_score := float(4 - hexi_held) * float(sc["hexi_held"]) + float(s.relations.size() - vassals) * float(sc["han_vassal"]) * 0.5
	s.winner = "han" if han_score >= xn_score else "xiongnu"
	s.win_reason = "剧本结束计分（汉 %.0f : 匈奴 %.0f）" % [han_score, xn_score]
	s.log_event("victory", "%s 获胜：%s" % [s.winner, s.win_reason])
