extends SceneTree
# 规则测试（无需插件）：
#   godot --headless --path . --script res://tests/run_tests.gd

const GS = preload("res://core/game_state.gd")
const TR = preload("res://core/turn_resolver.gd")
const Cal = preload("res://core/calendar.gd")
const Cmd = preload("res://core/commands.gd")
const Combat = preload("res://core/combat.gd")
const Supply = preload("res://core/supply.gd")
const Diplomacy = preload("res://core/diplomacy.gd")
const Trade = preload("res://core/trade.gd")
const Victory = preload("res://core/victory.gd")
const Path = preload("res://core/pathfinding.gd")
const Economy = preload("res://core/economy.gd")
const HanAI = preload("res://ai/han_ai.gd")
const XnAI = preload("res://ai/xiongnu_ai.gd")
const MapView = preload("res://ui/map_view.gd")

var passed = 0
var failed = 0

func ok(cond: bool, msg: String) -> void:
	if cond:
		passed += 1
	else:
		failed += 1
		print("  FAIL: ", msg)

func near(a: float, b: float, tol: float, msg: String) -> void:
	ok(absf(a - b) <= tol, "%s（%s vs %s）" % [msg, str(a), str(b)])

func fresh(seed_value := 1, dt := 3):
	var s = GS.new()
	s.load_scenario("res://data/scenario_mvp.json", seed_value, dt)
	return s

func _init() -> void:
	test_data()
	test_calendar()
	test_economy()
	test_pathfinding()
	test_map_connections_and_colors()
	test_junctions()
	test_historical_travel()
	test_supply_tmax()
	test_combat()
	test_encounter_and_evade()
	test_siege_and_capture()
	test_diplomacy_and_trade()
	test_citystate()
	test_victory()
	test_daily_movement()
	test_interval_consistency()
	test_determinism()
	test_balance_regressions()
	test_ai_smoke()
	print("通过 %d，失败 %d" % [passed, failed])
	quit(1 if failed > 0 else 0)

func test_data() -> void:
	print("data")
	var s = fresh()
	ok(s.nodes.size() == 43, "43 个节点（含 1 处路口）")
	ok(s.routes.size() >= 50, "边数")
	var cnt = 0
	for sid in s.relations:
		if s.factions[sid].get("counts_for_victory", false):
			cnt += 1
	ok(cnt == 18, "18 个计入胜利的城邦")
	for r in s.routes:
		ok(s.nodes.has(r["a"]) and s.nodes.has(r["b"]), "边端点存在")

func test_calendar() -> void:
	print("calendar")
	ok(Cal.month_of(0, 1) == 1 and Cal.month_of(3, 1) == 2 and Cal.month_of(36, 1) == 1, "月份")
	ok(Cal.year_of(36, -119, 1) == -118, "年份")
	ok(Cal.season_of(8) == "autumn" and Cal.season_of(12) == "winter" and Cal.season_of(3) == "spring", "季节")
	ok(Cal.is_month_end(2) and not Cal.is_month_end(3), "月末")

func test_economy() -> void:
	print("economy")
	var s = fresh()
	var n = s.nodes["long_xi"]
	n["farm_cap"] = 10000
	n["farm_dev"] = 0.4  # 4000 劳力
	n["pop"] = 100000
	n["levied_out"] = 0
	n["horses"] = 0
	n["grain"] = 1000000.0
	near(Economy.farm_workers(s, n), 4000.0, 0.01, "劳力 = cap×dev")
	var harvest: float = 4000.0 * s.bal["food"]["farm_yield_per_worker_year"]
	near(Economy.farm_output_year(s, n), harvest, 0.01, "秋收按4000劳力及配置的单位年产量计算")
	var g0: float = n["grain"]
	s.tick = 5  # 第 2 月末，不是收获月
	Economy.monthly(s)
	ok(n["grain"] <= g0, "非收获月不入库")
	s.tick = 7 * 3 + 2  # 8 月
	var g1: float = n["grain"]
	Economy.monthly(s)
	ok(abs((n["grain"] - g1) - (harvest - 200000.0)) < 1.0, "收获月入库产粮，减当月口粮200000")
	# 饥荒
	var m = fresh().nodes["lun_tai"]
	var s2 = fresh()
	var t = s2.nodes["lun_tai"]
	t["grain"] = 0.0
	t["horses"] = 0
	var p0: int = t["pop"]
	s2.tick = 2
	Economy.monthly(s2)
	ok(t["pop"] < p0 and t["starving"], "断粮则人口 −5%")

func test_pathfinding() -> void:
	print("pathfinding")
	var s = fresh()
	var p = Path.path_to(s, "dun_huang", "lou_lan")
	ok(p == ["yang_guan", "lou_lan"], "敦煌→楼兰经阳关: %s" % str(p))
	s.tick = 10 * 3  # 11 月（冬）
	ok(s.is_winter(), "11 月为冬")
	var idx: int = s.route_between("cheshi_qian", "cheshi_hou")
	ok(s.route_closed(idx), "冬季山道封闭")
	ok(Path.path_to(s, "cheshi_qian", "cheshi_hou").size() > 1 or Path.path_to(s, "cheshi_qian", "cheshi_hou").is_empty(), "冬季不能走直达山道")

func test_junctions() -> void:
	print("junctions")
	var s = fresh()
	var j: Dictionary = s.nodes["beilu_chakou"]
	ok(j["type"] == "junction" and s.controller(j) == "" and j["pop"] == 0, "北麓岔口是无主路口")
	near(s.route_days(s.route_between("hu_jie", "beilu_chakou")) + s.route_days(s.route_between("beilu_chakou", "cheshi_qian")), 54.17, 0.01, "呼揭—车师前经路口总天数不变")
	near(s.route_days(s.route_between("cheshi_hou", "beilu_chakou")) + s.route_days(s.route_between("beilu_chakou", "chi_gu")), 65.0, 0.01, "车师后—乌孙经路口总天数不变")
	ok(s.route_between("hu_jie", "cheshi_qian") < 0 and s.route_between("cheshi_hou", "chi_gu") < 0, "原交叉直连已拆分为经路口")
	ok(s.hops("cheshi_hou", "chi_gu") == 1 and s.hops("hu_jie", "cheshi_qian") == 1, "路口不额外计跳数")
	ok(s.hops("chi_gu", "cheshi_qian") == 1, "路口两侧道路互通，乌孙与车师前相邻")
	ok("chi_gu" in s.near_neighbors("cheshi_hou") and not ("chi_gu" in s.neighbors("cheshi_hou")), "影响力穿过路口，行军仍走实际道路")
	s.tick = 5 * 3  # 6 月
	ok("beilu_chakou" in Path.path_to(s, "chi_gu", "cheshi_qian"), "乌孙→车师前可在路口换路")
	var a: Dictionary = s.armies["han_g_dunhuang"]
	for t in ["siege", "burn"]:
		var c = Cmd.make("set_plan", "han", {"army": a["id"], "steps": [{"type": t, "node": "beilu_chakou"}], "preset": "balanced"})
		ok(Cmd.validate(s, c) != "", "路口不可%s" % t)

func test_map_connections_and_colors() -> void:
	print("map connections and ownership colors")
	var s = fresh()
	s.tick = 12  # 夏季山道开放；就近连线不保证全年通行或必为最快路径。
	for pair in [["yi_wu", "dong_qiemi"], ["hu_jie", "cheshi_qian"]]:
		var source: String = pair[0]
		var target: String = pair[1]
		var origin := Vector2(s.nodes[source]["pos"][0], s.nodes[source]["pos"][1])
		var nearest := ""
		var distance := INF
		for id in s.nodes:
			var n: Dictionary = s.nodes[id]
			if s.kind_of(n["faction"]) not in ["citystate", "great"]:
				continue
			var d := origin.distance_squared_to(Vector2(n["pos"][0], n["pos"][1]))
			if d < distance:
				distance = d
				nearest = id
		ok(nearest == target and s.route_between(source, target) >= 0, "%s接最近的西域城市%s" % [source, target])
		ok(not s.route_closed(s.route_between(source, target)), "新连线在夏季可直接通行")
	ok(s.route_between("yi_wu", "cheshi_qian") < 0 and s.route_between("hu_jie", "chi_gu") < 0, "移除跨越近城的旧直连")
	var view = MapView.new()
	view.state = s
	var colors := []
	for sid in s.relations:
		s.relations[sid]["overlord"] = ""
	for sid in s.factions:
		if s.kind_of(sid) not in ["citystate", "great"]:
			continue
		var nation_nodes: Array = s.nodes_of_state(sid)
		var color: Color = view.node_color(nation_nodes[0])
		ok(not colors.has(color) and color not in [MapView.C_HAN, MapView.C_XN, MapView.C_HAN_V, MapView.C_XN_V], "%s独立颜色与其他国家不同" % sid)
		colors.append(color)
		for n in nation_nodes:
			ok(view.node_color(n) == color, "%s同国城市同色" % n["name"])
	var city: Dictionary = s.nodes["gu_mo"]
	var own_color: Color = view.node_color(city)
	s.relations["gu_mo"]["han_influence"] = 100.0
	s.relations["gu_mo"]["han_status"] = "enfeoffed"
	ok(view.node_color(city) == own_color, "赏赐、影响力和册封不改变独立国色")
	s.relations["gu_mo"]["overlord"] = "han"
	ok(view.node_color(city) == MapView.C_HAN_V, "汉属国显示汉属国色")
	preload("res://core/siege.gd").capture(s, city, "xiongnu")
	ok(view.node_color(city) == MapView.C_XN_V, "城邦被匈奴征服后随宗主国变色")
	s.relations["gu_mo"]["overlord"] = ""
	ok(view.node_color(city) == own_color, "恢复独立后恢复本国色")
	preload("res://core/siege.gd").capture(s, s.nodes["da_wan"], "han")
	ok(view.node_color(s.nodes["da_wan"]) == MapView.C_HAN, "大国城市被直接占领后变色")
	ok(view.node_color(s.nodes["yu_cheng"]) == MapView.STATE_COLORS["dawan"], "大宛未陷落城市仍保持大宛色")
	var restored = GS.new()
	restored.from_save(s.to_save())
	view.state = restored
	ok(view.node_color(restored.nodes["gu_mo"]) == own_color, "读档保持独立国家颜色")
	view.free()

func test_historical_travel() -> void:
	print("historical travel")
	var s = fresh()
	var route: Dictionary = s.routes[s.route_between("cheshi_qian", "yan_qi")]
	ok(s.route_between("yumen_guan", "cheshi_qian") < 0 and s.route_between("lou_lan", "cheshi_qian") >= 0, "前119年玉门出西域经楼兰衔接车师，不使用后期开辟的新道")
	var north: Array = s.trade_routes[0]["nodes"]
	ok(north.find("lou_lan") == north.find("yumen_guan") + 1, "北道商路经过楼兰节点")
	ok(not Trade.open_prefix(s, s.trade_routes[0]).has("cheshi_qian"), "楼兰禁商会阻断途经楼兰的北道")
	near(route["distance_km"], 835 * 0.416, 0.01, "车师前—焉耆采用汉书835里")
	near(s.routes[s.route_between("qiu_ci", "gu_mo")]["distance_km"], 670 * 0.416, 0.01, "龟兹—姑墨采用汉书670里")
	var desert: Dictionary = s.routes[s.route_between("dun_huang", "yi_wu")]
	near(Path.travel_days(desert, 2.2), desert["days"] / 1.4, 0.01, "沙漠限制骑兵持续行军速度")
	var mountain: Dictionary = s.routes[s.route_between("wen_su", "chi_gu")]
	near(Path.travel_days(mountain, 2.2), mountain["days"] / 1.15, 0.01, "山道骑兵优势降低")
	var hazard: Dictionary = s.routes[s.route_between("sha_che", "ji_bin")]
	near(Path.travel_days(hazard, 2.2), hazard["days"], 0.01, "悬度骑兵不能两倍速通行")
	near(Path.travel_days({"days": 10}, 2.0), 5, 0.01, "旧存档无新字段时保持原道路计时")
	var convoy = s.new_army("han", "dun_huang", {}, 0, 100000, 1000)
	convoy["is_convoy"] = true
	near(Combat.army_speed(s, convoy), 0.75, 0.01, "运输队按辎重速度行进")
	var mixed = s.new_army("han", "dun_huang", {"cavalry": 1000, "infantry": 1})
	near(Combat.army_speed(s, mixed), 1, 0.01, "步骑混编受步兵限制")
	s.armies.clear()
	s.tick = 12
	var rider = s.new_army("xiongnu", "dun_huang", {"horse_archer": 1000}, 2000, 100000)
	rider["plan"]["triggers"] = []
	rider["plan"]["steps"] = [{"type": "move_to", "node": "yi_wu"}]
	var predicted: float = Path.days_to(s, "dun_huang", "yi_wu", Combat.army_speed(s, rider), false)
	preload("res://core/plan_executor.gd").move_all(s, 1.0)
	near(rider["loc"]["prog"], 1.0 / predicted, 0.0001, "实际每日行军与寻路估时一致，使用沙漠限速")
	preload("res://core/plan_executor.gd").move_all(s, predicted - 1.0)
	ok(rider["loc"].get("node", "") == "yi_wu", "预测时间内抵达目的地")
	var restored = GS.new()
	restored.from_save(s.to_save())
	ok(restored.routes[s.route_between("dun_huang", "yi_wu")]["distance_km"] == desert["distance_km"], "存档保留校准距离与速度限制")

func test_supply_tmax() -> void:
	print("supply")
	var s = fresh()
	var a = s.new_army("han", "dun_huang", {"infantry": 10000}, 0, 0, 10000)
	a["grain"] = Supply.carry_cap(s, a)
	near(a["grain"], 180000.0, 0.01, "载量 = 10000×3 + 10000×15")
	near(Supply.t_max(s, a), 3.0, 0.01, "T_max = 180000/60000 = 3 个月")
	# 断粮减员 10%/月 → 每 tick 约 3.3%
	a["grain"] = 0.0
	a["loc"] = {"node": "lun_tai"}  # 非己方补给点
	var before: int = s.army_size(a)
	for i in 3:
		Supply.tick(s, a)
	var lost = before - s.army_size(a)
	ok(lost > before * 0.08 and lost < before * 0.12, "断粮一月约损 10%%（%d）" % lost)

func test_combat() -> void:
	print("combat")
	var s = fresh()
	var r = Combat.fight(s, {"infantry": 5000.0}, {"infantry": 5000.0}, {"noise": 0.0})
	near(Combat.total(r["loss_a"]), Combat.total(r["loss_b"]), 1.0, "等量步兵对称伤亡")
	# 弩克骑
	var with_xbow = Combat.fight(s, {"crossbow": 3000.0, "infantry": 3000.0}, {"horse_archer": 6000.0}, {"noise": 0.0})
	var no_xbow = Combat.fight(s, {"infantry": 6000.0}, {"horse_archer": 6000.0}, {"noise": 0.0})
	ok(Combat.total(with_xbow["loss_b"]) > Combat.total(no_xbow["loss_b"]), "弩兵对骑兵杀伤更高")
	# 俘马
	var s2 = fresh()
	var h = s2.new_army("han", "dun_huang", {"infantry": 8000, "crossbow": 4000})
	var x = s2.new_army("xiongnu", "dun_huang", {"horse_archer": 2000}, 4000)
	var rep = Combat.resolve_battle(s2, [h], [x], "dun_huang", {})
	ok(rep["winner"] == "han", "汉胜")
	ok(rep["horses_captured"] > 0 and s2.stats["horses_captured"] > 0, "败方马匹被俘")

func test_encounter_and_evade() -> void:
	print("encounter")
	# 同节点
	var s = fresh()
	s.armies.clear()
	var h = s.new_army("han", "jiu_quan", {"infantry": 3000})
	var x = s.new_army("xiongnu", "jiu_quan", {"horse_archer": 3000}, 6000)
	h["plan"]["engage"] = ["always", 0.0]
	x["plan"]["engage"] = ["always", 0.0]
	Combat.encounters(s)
	ok(s.stats["battles"] == 1, "同节点触发战斗")
	# 路段相向交叉
	var s2 = fresh()
	s2.armies.clear()
	var h2 = s2.new_army("han", "dun_huang", {"infantry": 3000})
	var x2 = s2.new_army("xiongnu", "yi_wu", {"horse_archer": 3000}, 6000)
	h2["plan"]["steps"] = [{"type": "move_to", "node": "yi_wu"}]
	x2["plan"]["steps"] = [{"type": "move_to", "node": "dun_huang"}]
	h2["plan"]["engage"] = ["always", 0.0]
	x2["plan"]["engage"] = ["always", 0.0]
	for i in 6:
		TR.run_tick(s2)
	ok(s2.stats["battles"] >= 1, "路段相向相遇触发战斗")
	# 速度占优避战成功；速度劣势强制迎战
	var s3 = fresh()
	s3.armies.clear()
	var h3 = s3.new_army("han", "dun_huang", {"infantry": 9000})
	var x3 = s3.new_army("xiongnu", "dun_huang", {"horse_archer": 3000}, 6000)
	x3["plan"]["engage"] = ["never", 0.0]
	h3["plan"]["engage"] = ["always", 0.0]
	Combat.encounters(s3)
	ok(s3.stats["battles"] == 0, "弓骑速度占优，避战成功")
	var s4 = fresh()
	s4.armies.clear()
	var h4 = s4.new_army("han", "dun_huang", {"infantry": 9000})
	var x4 = s4.new_army("xiongnu", "dun_huang", {"horse_archer": 3000}, 6000)
	h4["plan"]["engage"] = ["never", 0.0]
	x4["plan"]["engage"] = ["always", 0.0]
	Combat.encounters(s4)
	ok(s4.stats["battles"] == 1, "步兵无法避开骑兵，被迫交战")

func test_siege_and_capture() -> void:
	print("siege")
	var s = fresh()
	s.armies.clear()
	var a = s.new_army("han", "wei_li", {"infantry": 4000, "crossbow": 3000}, 0, 100000)
	a["plan"]["steps"] = [{"type": "siege", "node": "wei_li", "assault_when": 0.5}]
	for i in 30:
		TR.run_tick(s)
		if s.relations["wei_li"]["overlord"] == "han":
			break
	ok(s.relations["wei_li"]["overlord"] == "han", "围城后攻陷尉犁成为汉属国")
	# 2 万弓骑攻 2 级城墙很慢
	var s2 = fresh()
	s2.armies.clear()
	var xa = s2.new_army("xiongnu", "dun_huang", {"horse_archer": 20000}, 40000)
	s2.nodes["dun_huang"]["wall_hp"] = s2.nodes["dun_huang"]["wall_hp_max"]
	var dmg: float = preload("res://core/siege.gd").siege_damage_per_tick(s2, [xa]) * 3.0
	near(2000.0 / dmg, 20.0, 1.0, "2 万弓骑攻 2 级城墙约 20 个月")

func test_diplomacy_and_trade() -> void:
	print("diplomacy")
	var s = fresh()
	var rel = s.relations["gu_mo"]
	var g1 = Diplomacy.gift_gain(s, rel, 1)
	rel["han_influence"] = 60.0
	var g2 = Diplomacy.gift_gain(s, rel, 1)
	ok(g2 < g1, "赏赐边际递减")
	rel["han_influence"] = 60.0
	rel["xn_intimidation"] = 45.0
	ok(Diplomacy.can_vassal(s, "gu_mo") == "", "影响力≥60 且 ≥威吓+15 可成属国")
	rel["xn_intimidation"] = 46.0
	ok(Diplomacy.can_vassal(s, "gu_mo") != "", "边界：差 14 不行")
	# 匈奴臣服顶掉汉宗主
	rel["overlord"] = "han"
	rel["xn_intimidation"] = 70.0
	rel["han_influence"] = 20.0
	ok(Diplomacy.can_demand(s, "gu_mo") == "", "威吓≥60 且高于影响力可令臣服")
	Diplomacy.demand_vassal(s, "gu_mo")
	ok(rel["overlord"] == "xiongnu", "臣服匈奴取代汉宗主")
	print("trade")
	var s2 = fresh()
	# 楼兰初始为匈奴属国且威吓 70 → 南道截断
	var south = s2.trade_routes[1]
	var pre = Trade.open_prefix(s2, south)
	ok(not pre.has("lou_lan") and not pre.has("qie_mo"), "楼兰禁商，南道其后全部截断")
	s2.relations["lou_lan"]["xn_intimidation"] = 30.0
	pre = Trade.open_prefix(s2, south)
	ok(pre.has("lou_lan") and pre.has("qie_mo"), "威吓下降后南道打通")
	var inf0: float = s2.relations["qie_mo"]["han_influence"]
	Trade.monthly(s2)
	near(s2.relations["qie_mo"]["han_influence"], inf0 + 1.5, 0.01, "商路沿途国家 +1.5 影响力/月")

func test_citystate() -> void:
	print("citystate")
	var s = fresh()
	var rel = s.relations["lou_lan"]
	rel["xn_intimidation"] = 10.0
	rel["xn_resentment"] = 60.0
	preload("res://core/citystate.gd").monthly(s)
	ok(rel["overlord"] == "", "威吓低且怨恨高则叛离匈奴")
	rel["overlord"] = "han"
	rel["han_influence"] = 10.0
	rel["xn_intimidation"] = 60.0
	preload("res://core/citystate.gd").monthly(s)
	ok(rel["overlord"] == "xiongnu", "威吓远超影响力则倒向匈奴")

func test_victory() -> void:
	print("victory")
	var s = fresh()
	var ids = ["wu_lei", "cheshi_qian", "qiu_ci", "gu_mo", "wen_su", "shu_le", "sha_che", "yu_tian", "jing_jue", "qie_mo", "lou_lan"]
	for id in ids:
		s.relations[id]["overlord"] = "han"
	ok(Victory.han_conditions_met(s), "11 国含乌垒、车师前")
	s.tick = 2
	for i in 11:
		Victory.monthly(s)
	ok(s.winner == "", "11 个月尚未胜利")
	Victory.monthly(s)
	ok(s.winner == "han", "连续 12 个月汉胜")
	# 中断清零
	var s2 = fresh()
	for id in ids:
		s2.relations[id]["overlord"] = "han"
	for i in 5:
		Victory.monthly(s2)
	s2.relations["wu_lei"]["overlord"] = ""
	Victory.monthly(s2)
	ok(s2.streak["han"] == 0, "条件中断，连续月数清零")
	# 匈奴
	var s3 = fresh()
	for nid in s3.bal["victory"]["xn_targets"]:
		s3.nodes[nid]["faction"] = "xiongnu"
	for i in 6:
		Victory.monthly(s3)
	ok(s3.winner == "xiongnu", "匈奴占四郡 6 个月胜")

func _run_plan_game(dt: int, turns: int):
	var s = fresh(7, dt)
	var a = s.new_army("han", "dun_huang", {"infantry": 3000}, 0, 20000)
	a["plan"]["steps"] = [{"type": "move_to", "node": "lou_lan"}, {"type": "hold", "node": "lou_lan", "until": "end"}]
	for i in turns:
		TR.resolve(s, {})
	return s

func test_interval_consistency() -> void:
	print("interval")
	var s3 = _run_plan_game(3, 9)
	var s9 = _run_plan_game(9, 3)
	ok(s3.tick == s9.tick, "tick 数一致")
	ok(s3.state_hash() == s9.state_hash(), "计划不变时，月制×3 回合 = 季制×1 回合")

func test_determinism() -> void:
	print("determinism")
	var saved = fresh(123)
	saved.relations["wei_li"]["xn_intimidation"] = 96.6758578431373
	var restored = GS.new()
	ok(restored.from_save(saved.to_save()) and restored.state_hash() == saved.state_hash(), "存档精确保留曾发生舍入差异的威吓浮点值")
	ok(restored.rng.randf() == saved.rng.randf(), "读档精确保留随机数进度")
	var legacy := {"rng_seed": saved.rng.seed, "rng_state": saved.rng.state}
	for key in GS.SAVE_KEYS:
		legacy[key] = saved.get(key)
	ok(restored.from_save(var_to_str(legacy)) and restored.tick == saved.tick, "兼容旧版文本存档")
	var h1 = _run_with_ai(11, 60)
	var h2 = _run_with_ai(11, 60)
	ok(h1 == h2, "同 seed 同命令得到相同状态哈希")
	var h3 = _run_with_ai(12, 60)
	ok(h1 != h3, "不同 seed 状态不同")

func _run_with_ai(seed_value: int, turns: int) -> int:
	var s = fresh(seed_value, 3)
	var han = HanAI.new()
	var xn = XnAI.new()
	for i in turns:
		TR.resolve(s, {"han": han.think(s), "xiongnu": xn.think(s)})
	return s.state_hash()

func test_ai_smoke() -> void:
	print("ai smoke")
	for dt in [3, 9]:
		var s = fresh(5, dt)
		var han = HanAI.new()
		var xn = XnAI.new()
		var bad = 0
		for t in 24 * 3 / dt:
			var res = TR.resolve(s, {"han": han.think(s), "xiongnu": xn.think(s)})
			bad += res["rejected"].size()
		ok(s.tick == 24 * 3 or s.winner != "", "AI 对战 24 个月（决策间隔 %d tick）无报错" % dt)
		ok(bad == 0, "AI 命令均通过校验（被拒 %d）" % bad)

func test_daily_movement() -> void:
	print("daily movement and replay")
	var s = fresh(42, 9)
	s.armies.clear()
	var a = s.new_army("han", "dun_huang", {"infantry": 1000}, 0, 100000, 1000)
	a["plan"]["steps"] = [{"type": "move_to", "node": "lou_lan"}]
	a["plan"]["triggers"] = []
	var result = TR.resolve(s, {}, true)
	ok(result["frames"].size() == 90, "季度记录连续90个每日位置")
	var first: Dictionary = result["frames"][0]["armies"][a["id"]]["loc"]
	var route: Dictionary = s.routes[first["route"]]
	near(first["prog"], Combat.army_speed(s, result["frames"][0]["armies"][a["id"]]) / route["days"], 0.0001, "首日按速度推进一日距离")
	ok(result["frames"][0]["date"].ends_with("1月1日"), "回放首日为1月1日")
	ok(result["frames"][89]["date"].ends_with("3月30日"), "回放季度末为3月30日")
	ok(s.tick == 9 and s.day_offset == 0, "季度结束进入下一决策日")
	var m = fresh(42, 3)
	m.armies.clear()
	var monthly = TR.resolve(m, {}, true)
	ok(monthly["frames"].size() == 30, "月制记录30日")
	var normal = TR.resolve(m, {})
	ok(normal["frames"].is_empty(), "批量模拟默认不保存回放快照")
	# 同一路段相向行军应在10日内被发现，不能等到旬末。
	var encounter = fresh(43, 3)
	encounter.armies.clear()
	# 本测试验证每日交叉检测，使用短测试道路，避免依赖实际古道长度。
	encounter.routes[encounter.route_between("dun_huang", "yi_wu")]["days"] = 6.0
	var h = encounter.new_army("han", "dun_huang", {"infantry": 3000}, 0, 100000)
	var x = encounter.new_army("xiongnu", "yi_wu", {"horse_archer": 3000}, 6000)
	for army in [h, x]:
		army["plan"]["triggers"] = []
		army["plan"]["engage"] = ["always", 0.0]
	h["plan"]["steps"] = [{"type": "move_to", "node": "yi_wu"}]
	x["plan"]["steps"] = [{"type": "move_to", "node": "dun_huang"}]
	var daily = TR.resolve(encounter, {}, true)
	var first_battle := -1
	for frame in daily["frames"]:
		for event in frame["events"]:
			if event["kind"] == "battle" and first_battle < 0:
				first_battle = event["day"]
	ok(first_battle >= 0 and first_battle < 10, "路上交叉在当天结算，早于旬末")

func test_balance_regressions() -> void:
	print("balance regressions")
	var s = fresh()
	s.armies.clear()
	var road: int = s.adj["yang_guan"][0]
	var a = s.new_army("xiongnu", "yang_guan", {"horse_archer": 1000}, 2000, 0)
	var order = Cmd.make("set_plan", "xiongnu", {"army": a["id"], "steps": [{"type": "ambush", "node": "yang_guan", "route": road, "months": 2}], "preset": "raider"})
	ok(Cmd.validate(s, order) == "", "玩家可提交与 AI 相同的设伏命令")
	Cmd.apply(s, order)
	Combat.encounters(s)
	ok(s.routes[road]["raided_by"] == "xiongnu", "没有军队经过时，设伏仍阻断商路")
	a["plan"]["steps"].clear()
	Combat.encounters(s)
	ok(s.routes[road]["raided_by"] == "", "撤离伏兵后恢复道路")
	order["steps"] = [{"type": "ambush", "node": "chang_an", "route": road, "months": 2}]
	ok(Cmd.validate(s, order) != "", "不能在不相邻的路上设伏")
	var v = s.nodes["cheshi_qian"]
	s.relations[v["faction"]]["overlord"] = "xiongnu"
	a["loc"] = {"node": v["id"]}
	var g0: float = v["grain"]
	var anger: float = s.relations[v["faction"]]["xn_resentment"]
	Cmd.apply(s, Cmd.make("load", "xiongnu", {"army": a["id"], "grain": 1000}))
	near(a["grain"], 1000, 0.01, "属国装粮从当地粮仓征取")
	near(v["grain"], g0 - 1000, 0.01, "征粮正确扣除属国库存")
	ok(s.relations[v["faction"]]["xn_resentment"] > anger, "征粮带来怨恨代价")
	Cmd.apply(s, Cmd.make("load", "xiongnu", {"army": a["id"], "grain": -1000}))
	near(a["grain"], 1000, 0.01, "负数装粮不能倒扣军粮")
	var pasture = fresh()
	pasture.armies.clear()
	var x = pasture.new_army("xiongnu", "yi_wu", {"horse_archer": 20000}, 40000, 0)
	pasture.nodes["yi_wu"]["grain"] = 0.0
	var mounts: int = x["horses"]
	Supply.tick(pasture, x, 30.0)
	ok(x["horses"] < mounts, "小牧区超载不能无偿供养大军")
	var home = fresh()
	home.armies.clear()
	var y = home.new_army("xiongnu", "chanyu_ting", {"horse_archer": 1000}, 2000, 0)
	Supply.tick(home, y, 30.0)
	ok(y["horses"] == 2000 and y["starving"] == 0, "有余量的本土牧区仍可就食")
	var raid = fresh()
	raid.armies.clear()
	var raider = raid.new_army("xiongnu", "dun_huang", {"horse_archer": 1000}, 2000, 0)
	var grain: float = raid.nodes["dun_huang"]["grain"]
	preload("res://core/siege.gd").burn(raid, raider, raid.nodes["dun_huang"])
	ok(raider["grain"] > 0 and raid.nodes["dun_huang"]["grain"] < grain, "劫掠实际夺取口粮而且受携粮上限约束")
	ok(raider["grain"] <= Supply.carry_cap(raid, raider), "不能劫掠超过携行上限的粮食")

	var levy = fresh()
	for army in levy.armies.values():
		if army["faction"] == "xiongnu":
			army["units"] = {"horse_archer": 1000}
	var commands = XnAI.new().think(levy)
	ok(commands.any(func(c): return c["type"] == "recruit" and c["source"] == "vassal" and c["units"].has("infantry")), "匈奴会合法征召属国步兵配合攻城")
	var summer = fresh(1, 9)
	summer.armies.clear()
	summer.tick = 18
	var main_army = summer.new_army("xiongnu", "yi_wu", {"horse_archer": 20000, "infantry": 4000}, 40000, 72000)
	for node in ["cheshi_qian", "lou_lan", "yan_qi", "cheshi_hou"]:
		var guard = summer.new_army("xiongnu", node, {"horse_archer": 1000}, 2000, 3000)
		guard["ai_role"] = "presence"
		guard["plan"]["steps"] = [{"type": "hold", "node": node, "until": "end"}]
	for i in 2:
		var raider_team = summer.new_army("xiongnu", "yang_guan", {"horse_archer": 1000}, 2000, 3000)
		raider_team["ai_role"] = "raid"
	commands = XnAI.new().think(summer)
	var campaign = commands.filter(func(c): return c["type"] == "set_plan" and c["army"] == main_army["id"])
	ok(campaign.size() == 1, "季度夏季决策会预排主力攻势")
	if campaign.size() == 1:
		var steps: Array = campaign[0]["steps"]
		ok(steps[0]["type"] == "hold" and steps[0]["months"] == 1 and steps[1]["type"] == "burn" and steps[2]["type"] == "siege", "等待八月后自动劫掠与围攻，无须季度内重新下令")

	main_army["units"] = {"horse_archer": 12000, "infantry": 1000}
	for node in summer.bal["victory"]["xn_targets"]:
		summer.nodes[node]["militia"] = {}
	commands = XnAI.new().think(summer)
	ok(commands.any(func(c): return c["type"] == "set_plan" and c["army"] == main_army["id"] and c["steps"].any(func(step): return step["type"] == "siege")), "兵力不足14000时仍可进攻无人守卫的河西城市")

	var split_state = fresh()
	split_state.armies.clear()
	var split_parent = split_state.new_army("xiongnu", "yi_wu", {"horse_archer": 10000}, 1000, 6000)
	Cmd.apply(split_state, Cmd.make("split", "xiongnu", {"army": split_parent["id"], "units": {"horse_archer": 2000}, "grain": 3000}))
	var split_child = split_state.armies.values().filter(func(a): return a["id"] != split_parent["id"])[0]
	ok(split_parent["horses"] >= 0 and split_child["horses"] >= 0, "损失马匹后拆分仍保持马匹非负")
	ok(split_parent["horses"] + split_child["horses"] == 1000, "拆分马匹总数守恒")
	ok(split_child["horses"] == 200, "骑兵按实际马匹比例拆分")
	ok(split_state.army_size(split_parent) + split_state.army_size(split_child) == 10000, "拆分兵力守恒")

	ok(GS.mixed_seed(42) == GS.mixed_seed(42), "种子散列可复现")
	ok(GS.mixed_seed(42) != GS.mixed_seed(43), "相邻输入种子分散为不同的63位种子")
	ok(fresh(42).rng.seed == GS.mixed_seed(42), "新局使用散列后的种子")

	var tie = fresh()
	for node in ["wu_wei", "zhang_ye", "jiu_quan"]:
		tie.nodes[node]["faction"] = "xiongnu"
	ok(Victory._scored_winner(tie, {"han": 100, "xiongnu": 100})["winner"] == "xiongnu", "同分根据目标进度判定，取消默认汉胜")
	var tie_wins := {"han": 0, "xiongnu": 0}
	for value in 32:
		var equal = fresh(value)
		var result = Victory._scored_winner(equal, {"han": 100, "xiongnu": 100})
		tie_wins[result["winner"]] += 1
	ok(tie_wins["han"] > 0 and tie_wins["xiongnu"] > 0, "目标和持续进度完全相同时，双方均有抽签胜出机会")
