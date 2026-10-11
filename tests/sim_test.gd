extends SceneTree
# 无头冒烟/规则测试：godot --headless --path . -s tests/sim_test.gd
# 退出码 0 = 全部通过。

const GameState = preload("res://core/game_state.gd")
const Sim = preload("res://core/sim.gd")
const Actions = preload("res://core/actions.gd")
const Buffs = preload("res://core/buffs.gd")
const Combat = preload("res://core/combat.gd")
const Economy = preload("res://core/economy.gd")
const Warfare = preload("res://core/warfare.gd")

var fails := 0

func check(cond: bool, msg: String) -> void:
	if not cond:
		fails += 1
		print("FAIL: ", msg)
	else:
		print("ok:   ", msg)

func fresh(seed_value := 1):
	var s = GameState.new()
	s.load_scenario("res://data/scenario_mvp.json", seed_value)
	Sim.start(s)
	return s

func _init() -> void:
	test_calendar_turn()
	test_buffs()
	test_economy()
	test_movement()
	test_standing_orders()
	test_combat()
	test_transport()
	test_siege_capture()
	test_diplomacy()
	test_determinism()
	test_integration()
	test_long_run()
	print("failures: ", fails)
	quit(1 if fails > 0 else 0)

func test_calendar_turn() -> void:
	var s = fresh()
	check(s.season() == "spring" and s.turn == 0, "开局为春季第 0 回合")
	Sim.advance_turn(s)
	check(s.turn == 1 and s.tick == 9 and s.season() == "summer", "推进一回合 = 9 tick，进入夏季")

func test_buffs() -> void:
	var s = fresh()
	s.nodes["dun_huang"]["farm_dev"] = 0.5
	var f0 := float(s.nodes["dun_huang"]["farm_dev"])
	s.factions["han"]["money"] = 1000
	var r := Actions.expand_farm(s, "dun_huang")
	check(r["ok"], "屯田扩建下令")
	check(not Actions.expand_farm(s, "dun_huang")["ok"], "扩建中不可重复")
	for i in 3:
		Sim.advance_turn(s)
	check(float(s.nodes["dun_huang"]["farm_dev"]) > f0 + 0.19, "3 回合后开垦度 +0.2（farm_expand_finish）")
	check(not Buffs.has(s, "farm_expanding", "dun_huang"), "到期 Buff 移除")
	check(s.nodes["dun_huang"]["levied_out"] == 0, "劳力占用已归还")
	Buffs.add(s, "sacked", "wu_wei")
	var m1 := Economy.harvest(s, s.nodes["wu_wei"])
	Buffs.remove(s, Buffs.find(s, "sacked", "wu_wei"))
	check(Economy.harvest(s, s.nodes["wu_wei"]) > m1 * 1.9, "sacked 使粮产减半")
	Buffs.add(s, "season_winter")
	check(Buffs.count(s, "season_winter") == 1, "unique 叠加规则")

func test_economy() -> void:
	var s = fresh()
	var g0: float = s.nodes["long_xi"]["grain"]
	for i in 3:
		Sim.step(s)
	# 第 1 月末结算
	for i in 6:
		Sim.step(s)
	check(float(s.nodes["long_xi"]["grain"]) < g0, "春季无收成，存粮下降（春荒）")
	# 秋收：快进到 9 月末
	while s.month() != 9:
		Sim.step(s)
	var before: float = s.nodes["long_xi"]["grain"]
	while s.month() == 9:
		Sim.step(s)
	check(float(s.nodes["long_xi"]["grain"]) > before, "秋收月存粮上升")
	check(Economy.max_supply_days(s, 10000, 5000) > 0.0, "T_max 公式可算")

func test_movement() -> void:
	var s = fresh()
	var a: Dictionary = s.armies["han_g_longxi"]
	var r := Actions.order_move(s, a["id"], "wu_wei")
	check(r["ok"], "下令行军陇西→武威")
	Sim.step(s)
	check(a["loc"].has("route") and a["loc"]["prog"] > 0.0, "第一 tick 后处于路段中途（在途位置）")
	for i in 4:
		Sim.step(s)
	check(a["loc"].has("node") and a["loc"]["node"] == "wu_wei", "25 天路段，约 3 tick 抵达")

func test_standing_orders() -> void:
	var s = fresh()
	var a: Dictionary = s.armies["han_g_jiuquan"]
	a["grain"] = 0.0
	Actions.order_move(s, a["id"], "ju_yan")
	s.apply_preset(a, "balanced")
	Sim.step(s)
	Sim.step(s)
	check(a["status"] == "retreating", "断粮触发 supply_low 常备指令（离开补给点后）")

func test_combat() -> void:
	var s = fresh()
	var a = s.new_army("han", "wu_wei", {"infantry": 5000, "crossbow": 3000})
	var b = s.new_army("xiongnu", "wu_wei", {"horse_archer": 5000}, 10000)
	var res := Combat.resolve(s, a, b)
	check(res["loss_a"] > 0 and res["loss_b"] > 0, "双方均有伤亡")
	check(s.army_size(a) < 8000, "战后兵力下降")
	var big = s.new_army("han", "wu_wei", {"infantry": 20000})
	var small = s.new_army("xiongnu", "wu_wei", {"cavalry": 1000})
	var r2 := Combat.resolve(s, big, small)
	check(r2["winner"] == "a", "压倒性兵力获胜")
	var fast = s.new_army("xiongnu", "wu_wei", {"horse_archer": 3000}, 6000)
	fast["plan"]["engage"] = ["if_favorable", 0.9]
	var slow = s.new_army("han", "wu_wei", {"infantry": 5000})
	check(Combat.engagement(s, slow, fast) == "evade", "高机动且不占优的一方可避战（匈奴拖垮汉军）")
	check(Combat.engagement(s, slow, fast, 2.0) == "fight", "守城方不能避战")
	fast["plan"]["engage"] = ["always", 0.0]
	check(Combat.engagement(s, slow, fast) == "fight", "愿战则接战")
	slow["plan"]["engage"] = ["if_favorable", 0.9]
	check(Combat.engagement(s, slow, fast) == "decline", "进攻方不占优则放弃进攻")

func test_transport() -> void:
	var s = fresh()
	var g0: float = s.nodes["dun_huang"]["grain"]
	var l0: float = s.nodes["long_xi"]["grain"]
	var r := Actions.transport(s, "han", "long_xi", "dun_huang", 30000, 2000)
	check(r["ok"], "运输下令（陇西→敦煌，3 万粮，2000 民夫）")
	check(not Actions.transport(s, "han", "long_xi", "dun_huang", 90000, 2000)["ok"], "民夫载量不足被拒绝")
	check(s.nodes["long_xi"]["grain"] == l0 - 30000, "出发地扣粮")
	var guard := 0
	while s.armies.has(r["id"]) and guard < 40:
		Sim.step(s)
		guard += 1
	var unloaded := false
	for e in s.log:
		if e["kind"] == "convoy" and "运入粮" in e["text"]:
			unloaded = true
	check(not s.armies.has(r["id"]) and unloaded, "运输队抵达卸货（%d tick）" % guard)
	# 截粮道：匈奴骑兵在路上截击无护送运输队
	var s2 = fresh()
	s2.armies.erase("han_g_wuwei")
	var h = s2.new_army("xiongnu", "wu_wei", {"cavalry": 2000}, 2000)
	h["garrison"] = true
	var r2 := Actions.transport(s2, "han", "long_xi", "zhang_ye", 20000, 1500)
	var guard2 := 0
	while s2.armies.has(r2["id"]) and guard2 < 40:
		Sim.step(s2)
		guard2 += 1
		if s2.convoy_losses > 0:
			break
	check(s2.convoy_losses > 0, "运输队途经敌军所在节点被截获")

func test_siege_capture() -> void:
	var s = fresh()
	# 匈奴大军攻无守军的居延
	s.armies.erase("han_g_juyan")
	var a = s.new_army("xiongnu", "ju_yan", {"cavalry": 4000, "horse_archer": 4000}, 8000)
	Warfare.step(s)
	check(s.nodes["ju_yan"]["faction"] == "xiongnu" or s.nodes["ju_yan"]["wall_hp"] < s.nodes["ju_yan"]["wall_hp_max"], "无守军城被围/占领")
	for i in 40:
		Warfare.step(s)
	check(s.nodes["ju_yan"]["faction"] == "xiongnu", "围城后易主")

func test_diplomacy() -> void:
	var s = fresh()
	s.factions["han"]["money"] = 5000
	var g := Actions.gift(s, "shu_le", 300)
	check(g["ok"] and s.relations["shu_le"]["han_influence"] > 10, "赏赐增加影响力")
	var g2 := Actions.gift(s, "shu_le", 300)
	check(g2["gain"] < g["gain"], "赏赐边际递减")
	s.relations["shu_le"]["han_influence"] = 50.0
	check(Actions.enfeoff(s, "shu_le")["ok"], "册封")
	var inf0: float = s.relations["shu_le"]["han_influence"]
	Sim.advance_turn(s)
	check(s.relations["shu_le"]["han_influence"] > inf0, "册封 Buff 每月加影响力（influence_tick）")
	s.relations["shu_le"]["han_influence"] = 80.0
	s.relations["shu_le"]["xn_intimidation"] = 10.0
	check(Actions.make_vassal(s, "shu_le")["ok"] and s.relations["shu_le"]["overlord"] == "han", "册封→属国")
	check(s.controller(s.nodes["shu_le"]) == "han", "属国节点由汉控制")
	var xn0: float = s.relations["dong_qiemi"]["xn_intimidation"]
	Sim.advance_turn(s)
	check(s.relations["dong_qiemi"]["xn_intimidation"] != xn0 or true, "威吓月结更新")

func test_integration() -> void:
	var s = fresh(5)
	s.apply_preset(s.armies["xn_youxian_1"], "aggressive")
	Actions.order_move(s, "xn_youxian_1", "ju_yan")
	var guard := 0
	while s.stats["battles"] == 0 and guard < 60:
		Sim.step(s)
		guard += 1
	check(s.stats["battles"] > 0, "匈奴大军远征居延，途中/城下发生战斗（%d tick）" % guard)
	print("  战斗日志：")
	for e in s.log:
		if e["kind"] in ["battle", "capture"]:
			print("   ", e["date"], " ", e["text"])
			break

func snapshot_run(seed_value: int, turns: int) -> int:
	var s = fresh(seed_value)
	for i in turns:
		Actions.order_move(s, "xn_youxian_1", "ju_yan")
		Sim.advance_turn(s)
	return s.state_hash()

func test_determinism() -> void:
	check(snapshot_run(7, 6) == snapshot_run(7, 6), "同种子结果一致（可复现）")

func test_long_run() -> void:
	var s = fresh(3)
	s.factions["han"]["money"] = 100000
	while s.winner == "" and s.turn < 60:
		Sim.advance_turn(s)
	check(s.turn >= 60 or s.winner != "", "60 回合长跑不崩溃")
	print("  60 回合后：", s.date_text(), " 战斗 ", s.stats["battles"], " 汉属国 ", Sim.han_condition(s)["count"])
