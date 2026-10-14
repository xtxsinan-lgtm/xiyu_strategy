extends SceneTree
# UI 回放集成验证：暂停、事件快进、跳过、最终状态以及保存/读档。
var failed := 0

func check(condition: bool, message: String) -> void:
	if not condition:
		failed += 1
		push_error(message)

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var scene = load("res://ui/main.tscn").instantiate()
	root.add_child(scene)
	await process_frame
	scene.new_game("han", 9, 42)
	var editing = scene.state.armies["han_g_dunhuang"]
	editing["plan"]["steps"] = [{"type": "hold", "node": "dun_huang", "until": "end"}]
	scene.sel_army = editing["id"]
	scene.pick = {"kind": "step", "type": "move_to", "army": editing["id"]}
	scene._resolve_pick("lou_lan")
	check(scene._draft(editing)["steps"].size() == 1 and scene._draft(editing)["steps"][0]["type"] == "move_to", "新移动命令接替已有无限驻守")
	var draft = scene._draft(editing)
	draft["steps"] = [{"type": "hold", "node": "dun_huang", "until": "end"}, {"type": "siege", "node": "lou_lan", "max_months": 3, "assault_when": 0.5}, {"type": "ambush", "node": "yang_guan", "route": scene.state.adj["yang_guan"][0], "months": 2}]
	scene.refresh()
	await process_frame
	for option in scene.side.find_children("*", "OptionButton", true, false):
		if option.get_item_text(0) == "驻守直到再次改令":
			option.item_selected.emit(1)
			break
	await process_frame
	for spin in scene.side.find_children("*", "SpinBox", true, false):
		if spin.prefix == "围攻 ":
			spin.value = 5
		elif spin.prefix == "墙≤":
			spin.value = 65
		elif spin.prefix == "设伏 ":
			spin.value = 3
	check(draft["steps"][0].get("months", 0) == 1 and not draft["steps"][0].has("until"), "玩家可以设置计时驻守后继续行动")
	check(draft["steps"][1]["max_months"] == 5 and is_equal_approx(draft["steps"][1]["assault_when"], 0.65), "玩家可以设置与 AI 相同的围攻时限和强攻阈值")
	check(draft["steps"][2]["months"] == 3, "玩家可以设置设伏月份")
	scene.new_game("han", 9, 42)
	# 在季度中途产生明确事件，用于验证下一事件定位。
	var army = scene.state.new_army("han", "lun_tai", {"infantry": 1000}, 0, 100000, 1000)
	army["plan"]["triggers"] = []
	army["plan"]["steps"] = [{"type": "hold", "node": "lun_tai", "months": 1}, {"type": "burn", "node": "wu_lei"}]
	var start_hash = scene.state.state_hash()
	scene.end_turn()
	check(scene.replaying, "结算后进入回放")
	check(scene.end_btn.disabled and scene.side_blocker.visible, "回放期间禁止改令")
	check(scene.map_view.state != scene.state, "回放与真实结算状态隔离")
	scene.replay_paused = true
	await process_frame
	var paused_date = scene.replay_label.text
	for i in 4:
		await process_frame
	check(scene.replay_label.text == paused_date, "暂停时日期停止推进")
	scene.replay_next_event = true
	scene.replay_paused = false
	for i in 100:
		await process_frame
		if scene.replay_paused or not scene.replaying:
			break
	check(scene.replay_paused, "下一事件自动暂停")
	scene.replay_skip = true
	for i in 100:
		await process_frame
		if not scene.replaying:
			break
	check(not scene.replaying, "跳过回放可以结束季度")
	check(scene.state.tick == 9, "结算到季度结束")
	check(scene.map_view.state == scene.state, "回放结束恢复最终状态")
	check(not scene.end_btn.disabled and not scene.side_blocker.visible, "恢复下令")
	check(scene.state.state_hash() != start_hash, "季度已产生有效状态变化")
	var restored = load("res://core/game_state.gd").new()
	check(restored.from_save(scene.state.to_save()), "新状态仍可读档")
	check(restored.state_hash() == scene.state.state_hash(), "逐日结算存档无丢失")
	print("回放集成测试失败 %d" % failed)
	quit(1 if failed else 0)
