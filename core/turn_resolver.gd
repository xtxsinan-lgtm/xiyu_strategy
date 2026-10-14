extends RefCounted
# 回合结算：即时命令（随机先后）→ 计划写入 → tick 循环 → 月末结算。
# orders: {faction_id: [cmd, ...]}；cmd 格式见 commands.gd。

const Commands = preload("res://core/commands.gd")
const Cal = preload("res://core/calendar.gd")
const Economy = preload("res://core/economy.gd")
const Buffs = preload("res://core/buff_system.gd")
const Executor = preload("res://core/plan_executor.gd")
const Combat = preload("res://core/combat.gd")
const Siege = preload("res://core/siege.gd")
const Supply = preload("res://core/supply.gd")
const Diplomacy = preload("res://core/diplomacy.gd")
const Trade = preload("res://core/trade.gd")
const Citystate = preload("res://core/citystate.gd")
const Victory = preload("res://core/victory.gd")

static func resolve(state, orders: Dictionary, capture_days := false) -> Dictionary:
	state.events = []
	var rejected = []
	var frames: Array = []
	# 1) 计划先写入，其余即时命令按随机顺序
	var instant = []
	for f in orders:
		for c in orders[f]:
			instant.append(c)
	_shuffle(state, instant)
	instant.sort_custom(func(x, y): return (0 if x["type"] == "set_plan" else 1) < (0 if y["type"] == "set_plan" else 1))
	for c in instant:
		var why = Commands.validate(state, c)
		if why == "":
			Commands.apply(state, c)
		else:
			rejected.append({"cmd": c, "why": why})
			state.log_event("rejected", "命令被拒绝（%s）：%s" % [c["type"], why])
	# 2) tick 循环
	for i in state.decision_ticks:
		if state.winner != "":
			break
		run_tick(state, frames, capture_days)
	state.turn += 1
	return {"events": state.events.duplicate(), "rejected": rejected, "winner": state.winner, "frames": frames}

static func _shuffle(state, arr: Array) -> void:
	for i in range(arr.size() - 1, 0, -1):
		var j: int = state.rng.randi_range(0, i)
		var t = arr[i]
		arr[i] = arr[j]
		arr[j] = t

static func run_tick(state, frames: Array = [], capture_days := false) -> void:
	# 保留旬/月日历和经济节奏，每旬内部逐日移动、遭遇、围城、消耗。
	for day in 10:
		state.day_offset = day
		var event_start: int = state.events.size()
		Executor.move_all(state, 1.0)
		Combat.encounters(state)
		Siege.tick(state, 1.0)
		for id in state.armies.keys():
			if state.armies.has(id):
				Supply.tick(state, state.armies[id], 1.0)
				if state.army_size(state.armies[id]) == 0 and state.armies[id]["laborers"] == 0:
					state.remove_army(id)
		Executor.check_triggers(state)
		if day == 9 and Cal.is_month_end(state.tick):
			month_end(state)
		if capture_days:
			frames.append({"tick": state.tick, "day_offset": day, "date": state.date_text(),
				"armies": state.armies.duplicate(true), "nodes": state.nodes.duplicate(true),
				"relations": state.relations.duplicate(true), "routes": state.routes.duplicate(true),
				"events": state.events.slice(event_start).duplicate(true)})
		if state.winner != "":
			break
	state.day_offset = 0
	state.tick += 1

static func month_end(state) -> void:
	Economy.monthly(state)
	Siege.monthly(state)
	Diplomacy.monthly(state)
	Trade.monthly(state)
	Citystate.monthly(state)
	Buffs.tick(state)
	Victory.monthly(state)
