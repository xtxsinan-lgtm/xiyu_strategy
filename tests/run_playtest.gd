extends SceneTree
# 可复现的玩家操作回归：实际控件改值、提交命令、双方月/季推进及长途运输。
const GS = preload("res://core/game_state.gd")
const Cmd = preload("res://core/commands.gd")
const Executor = preload("res://core/plan_executor.gd")
const Path = preload("res://core/pathfinding.gd")
const Supply = preload("res://core/supply.gd")
const Diplomacy = preload("res://core/diplomacy.gd")
var failed := 0
var passed := 0

func check(condition: bool, message: String) -> void:
	if condition:
		passed += 1
	else:
		failed += 1
		push_error(message)

func button(scene, prefix: String) -> Button:
	for b in scene.find_children("*", "Button", true, false):
		if b.text.begins_with(prefix):
			return b
	return null

func spin(scene, suffix: String) -> SpinBox:
	for s in scene.side.find_children("*", "SpinBox", true, false):
		if s.suffix == suffix:
			return s
	return null

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var scene = load("res://ui/main.tscn").instantiate()
	root.add_child(scene)
	await process_frame
	scene.new_game("han", 3, 101)
	scene.faction_option.select(1)
	scene.faction_option.item_selected.emit(1)
	scene.interval_option.select(1)
	scene.interval_option.item_selected.emit(1)
	check(scene.player == "han" and scene.decision_ticks == 3, "开局选项不改变当前局指挥权及节奏")
	button(scene, "新局").pressed.emit()
	check(scene.player == "xiongnu" and scene.decision_ticks == 9, "点击新局后应用所选阵营及节奏")

	scene.new_game("han", 3, 101)
	scene.sel_node = "wu_lei"
	scene.refresh()
	spin(scene, "份（每份100钱）").value = 8
	var gift_gain = Diplomacy.gift_gain(scene.state, scene.state.relations["wu_lei"], 8)
	check(button(scene, "赏赐").text == "赏赐 (+%.0f 影响力)" % gift_gain, "赏赐收益随输入更新")
	button(scene, "赏赐").pressed.emit()
	check(scene.orders.back()["units"] == 8, "赏赐按当前输入份数提交")

	scene.sel_node = "dun_huang"
	scene.refresh()
	spin(scene, " 人").value = 3500
	button(scene, "中央军·步兵").pressed.emit()
	check(scene.orders.back()["units"]["infantry"] == 3500, "征召按当前输入人数提交")
	scene.convoy["to"] = "jiu_quan"
	scene.refresh()
	spin(scene, " 民夫").value = 1500
	check(spin(scene, " 斛").value == 22500 and scene.convoy["grain"] == 22500, "自动满载22500斛完整显示，不被输入框步长舍入")
	spin(scene, " 斛").value = 15000
	for opt in scene.side.find_children("*", "OptionButton", true, false):
		if opt.get_item_text(0) == "运达后返回":
			opt.select(1)
			opt.item_selected.emit(1)
			break
	button(scene, "发运").pressed.emit()
	var cc: Dictionary = scene.orders.back()
	check(cc["laborers"] == 1500 and cc["grain"] == 15000 and cc["loop"], "运输输入及循环模式按当前值提交")
	var copied = cc["grain"]
	scene.convoy["grain"] = 30000
	check(cc["grain"] == copied, "排队命令保留提交时的数量")

	var aid = "han_g_dunhuang"
	scene.queue(Cmd.make("set_plan", "han", {"army": aid, "steps": [{"type": "move_to", "node": "lou_lan"}]}))
	scene.queue(Cmd.make("set_plan", "han", {"army": aid, "steps": [{"type": "hold", "node": "dun_huang", "until": "end"}]}))
	var plans = scene.orders.filter(func(c): return c["type"] == "set_plan" and c["army"] == aid)
	check(plans.size() == 1 and plans[0]["steps"][0]["type"] == "hold", "再次提交同军计划替换旧命令")
	scene._start_pick({"kind": "convoy_to"}, "选择目的地")
	scene._start_pick({"kind": "convoy_to"}, "选择目的地")
	check(scene.pick.is_empty(), "再次点击同一选点按钮可以取消")

	# 含驻守与围攻的计划应明确显示其时间，而非仅计算路程。
	scene.sel_army = aid
	var a: Dictionary = scene.state.armies[aid]
	scene._draft(a)["steps"] = [{"type": "hold", "node": "dun_huang", "months": 2}, {"type": "siege", "node": "lou_lan", "max_months": 3, "assault_when": 0.5}]
	scene.refresh()
	var expected_days = ceili(150.0 + Path.days_to(scene.state, "dun_huang", "lou_lan"))
	var preview_found = false
	for label in scene.side.find_children("*", "Label", true, false):
		if label.text.begins_with("预演："):
			preview_found = label.text.contains("%d 天" % expected_days)
	check(preview_found, "预演计入驻守时间及围城上限")

	# 双方四种开局，走完外交/征召与回放的真实 UI 调用路径。
	for faction in ["han", "xiongnu"]:
		for interval in [3, 9]:
			scene.new_game(faction, interval, 123)
			if faction == "han":
				scene.queue(Cmd.make("gift", "han", {"state": "wu_lei", "units": 4}))
			else:
				scene.queue(Cmd.make("set_tax", "xiongnu", {"state": "lou_lan", "level": 1}))
			for turn in 4:
				scene.replay_speed = 1000.0
				await scene.end_turn()
			check(scene.state.tick == interval * 4 and not scene.replaying, "%s %d旬制四回合正常结束回放" % [faction, interval])
			check(scene.state.log.filter(func(e): return e["kind"] == "rejected").is_empty(), "四回合没有被拒命令")
			var restored = GS.new()
			check(restored.from_save(scene.state.to_save()) and restored.state_hash() == scene.state.state_hash(), "试玩后存档状态一致")

	# 长途返程不应只保留固定 1.5 月粮，也不能把剩余口粮吞掉。
	var state = GS.new()
	state.load_scenario("res://data/scenario_mvp.json", 21, 3)
	var army: Dictionary = state.new_army("han", "zhang_ye", {}, 0, 15000, 1000)
	army["is_convoy"] = true
	army["convoy_home"] = "chang_an"
	army["plan"]["steps"] = [{"type": "deliver", "node": "zhang_ye"}, {"type": "return_to", "node": "chang_an"}]
	state.nodes["chang_an"]["levied_out"] = 1000
	var reserve = Executor.return_ration(state, army, state.nodes["zhang_ye"])
	var days = Path.days_to(state, "zhang_ye", "chang_an", Executor.army_speed(state, army), true)
	check(days > 45.0, "回归路线超过旧版固定 1.5 月留粮时长")
	check(reserve >= Supply.need_per_month(state, army) * days / 30.0, "返程口粮覆盖实际古道时长")
	var before = state.stock(state.nodes["zhang_ye"], "han")
	Executor._unload(state, army, state.nodes["zhang_ye"])
	check(is_equal_approx(army["grain"], reserve), "卸粮后按实际返程留粮")
	check(is_equal_approx(state.stock(state.nodes["zhang_ye"], "han") - before + army["grain"], 15000.0), "卸粮与留粮守恒")
	for day in ceili(days) + 5:
		if not state.armies.has(army["id"]):
			break
		Executor.move_all(state, 1.0)
		if state.armies.has(army["id"]):
			Supply.tick(state, army, 1.0)
	check(not state.armies.has(army["id"]) and army["starving"] == 0, "长途运输返程完成且不因固定留粮量断粮")
	check(state.nodes["chang_an"]["levied_out"] == 0, "完成运输释放征发民夫")

	check(Cmd.validate(state, Cmd.make("gift", "han", {"state": "wu_lei", "units": -1})) != "", "负份数赏赐不能凭空增加钱")
	check(Cmd.validate(state, Cmd.make("merge", "han", {"army": aid, "into": aid})) != "", "军队不能与自身合并")
	check(Cmd.validate(state, Cmd.make("found_colony", "han", {"node": "dun_huang", "army": aid})) != "", "建立屯田区不能吞掉战斗军队")
	print("玩家操作与后勤检查：通过 %d，失败 %d" % [passed, failed])
	quit(1 if failed else 0)
