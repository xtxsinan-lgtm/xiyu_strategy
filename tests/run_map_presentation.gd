extends SceneTree
# 显示路径、悬停及缩放必须与军队坐标一致，且不改动模拟距离或存档。
const GS = preload("res://core/game_state.gd")
const MapView = preload("res://ui/map_view.gd")
const Path = preload("res://core/pathfinding.gd")
const HanAI = preload("res://ai/han_ai.gd")
const Cmd = preload("res://core/commands.gd")
var passed := 0
var failed := 0

func check(value: bool, message: String) -> void:
	if value:
		passed += 1
	else:
		failed += 1
		push_error(message)

func _initialize() -> void:
	var state = GS.new()
	state.load_scenario("res://data/scenario_mvp.json", 100, 3)
	var original_save = state.to_save()
	var view = MapView.new()
	view.state = state
	view.size = Vector2(1300, 700)
	check(view.layout["positions"].size() == state.nodes.size(), "全部节点（含路口）都有新版显示坐标")
	check(view.node_world_pos("cheshi_hou").y < view.node_world_pos("cheshi_qian").y, "车师后置于车师前北侧")
	for route in state.routes:
		var curve = view.route_curve(route)
		check(curve.sample_baked(0).distance_to(view.node_world_pos(route["a"])) < 0.01 and curve.sample_baked(curve.get_baked_length()).distance_to(view.node_world_pos(route["b"])) < 0.01, "曲线连接其对应道路端点")
	var ri = state.route_between("dun_huang", "yi_wu")
	var route: Dictionary = state.routes[ri]
	var curve = view.route_curve(route)
	var point: Vector2 = curve.sample_baked(curve.get_baked_length() * 0.5)
	var army: Dictionary = state.armies["han_g_dunhuang"].duplicate(true)
	army["loc"] = {"route": ri, "from": "dun_huang", "to": "yi_wu", "prog": 0.5}
	check(view.army_world_position(army, {}).distance_to(point) < 0.01, "道路军队位于绘制的曲线上")
	army["loc"] = {"route": ri, "from": "yi_wu", "to": "dun_huang", "prog": 0.25}
	check(view.army_world_position(army, {}).distance_to(curve.sample_baked(curve.get_baked_length() * 0.75)) < 0.01, "逆向行军正确沿曲线反向推进")
	check(view._route_at(view.to_screen(point)) == ri, "曲线悬停识别与绘制一致")
	check(view._get_tooltip(view.to_screen(point)).contains("450 公里"), "道路悬停显示模型实际里程")
	var mouse_point = view.to_screen(view.node_world_pos("wu_lei"))
	view._zoom_at(mouse_point, 1.4)
	check(view.to_screen(view.node_world_pos("wu_lei")).distance_to(mouse_point) < 0.01, "缩放保持鼠标处世界位置稳定")
	check(state.to_save() == original_save, "显示曲线、布局及缩放不改变模拟状态或存档")
	check(Path.travel_days({"days": 100.0 / 20.0}, 1.0) < Path.travel_days({"days": 100.0 / 12.0}, 1.0), "等距离山道行军比普通道路慢")
	view.free()

	# 外交不能在60影响力处盲目停止，季度行动量须覆盖整个决策间隔。
	var han = HanAI.new()
	for sid in state.relations:
		state.relations[sid]["overlord"] = "han"
	var relation: Dictionary = state.relations["wu_lei"]
	relation["overlord"] = ""
	relation["han_status"] = "enfeoffed"
	relation["han_influence"] = 60.0
	relation["xn_intimidation"] = 70.0
	var commands: Array = []
	han._diplomacy(state, commands, state.ai_profiles["han_default"], 5000.0)
	check(commands.any(func(c): return c["type"] == "gift" and c["state"] == "wu_lei"), "影响力未高出威吓15时仍继续争取")
	state.decision_ticks = 9
	commands.clear()
	han._diplomacy(state, commands, state.ai_profiles["han_default"], 5000.0)
	check(commands.size() == 1 and commands[0]["units"] == state.ai_profiles["han_default"]["gift_batch"] * 3, "季度赏赐覆盖三个月的行动量")
	relation["xn_intimidation"] = 100.0
	commands.clear()
	han._diplomacy(state, commands, state.ai_profiles["han_default"], 5000.0)
	check(commands.is_empty(), "外交无法达到的高威吓目标不浪费赏赐")
	# 前线退至张掖后，居延运输与野战军装载同时消耗当地民夫。
	var logistics = GS.new()
	logistics.load_scenario("res://data/scenario_mvp.json", 101, 9)
	logistics.armies.clear()
	logistics.nodes["dun_huang"]["faction"] = "xiongnu"
	logistics.nodes["jiu_quan"]["faction"] = "xiongnu"
	logistics.nodes["zhang_ye"]["pop"] = 30000
	logistics.nodes["zhang_ye"]["grain"] = 1000000.0
	logistics.new_army("han", "zhang_ye", {"infantry": 4000, "crossbow": 3000, "cavalry": 1500}, 1500)
	var convoy = Cmd.make("convoy", "han", {"from": "zhang_ye", "to": "ju_yan", "laborers": 2500, "grain": 37500})
	commands = [convoy]
	han._expedition(logistics, commands, logistics.ai_profiles["han_default"], 90.0, 1000.0)
	var loads = commands.filter(func(c): return c["type"] == "load")
	check(loads.size() == 1 and loads[0]["laborers"] <= 500, "远征装载扣除已为运输预留的民夫")
	for command in commands:
		var why = Cmd.validate(logistics, command)
		check(why == "", "共用民夫额度的运输与装载命令均合法：" + why)
		if why == "":
			Cmd.apply(logistics, command)
	check(logistics.nodes["zhang_ye"]["levied_out"] <= 3000, "同回合征发不超人口动员上限")
	logistics.armies.clear()
	commands.clear()
	han._expedition(logistics, commands, logistics.ai_profiles["han_default"], 90.0, 0.0)
	check(not commands.any(func(c): return c["type"] == "recruit"), "远征征召使用扣除已排队开支的剩余预算")
	print("地图显示及AI检查：通过 %d，失败 %d" % [passed, failed])
	quit(1 if failed else 0)
