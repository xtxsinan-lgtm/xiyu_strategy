extends SceneTree
# AI 对 AI 长跑观察：godot --headless --path . -s tests/ai_run.gd [-- 回合数 种子 玩家方]
const GameState = preload("res://core/game_state.gd")
const Sim = preload("res://core/sim.gd")

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var turns := int(args[0]) if args.size() > 0 else 80
	var seed_value := int(args[1]) if args.size() > 1 else 1
	var s = GameState.new()
	s.load_scenario("res://data/scenario_mvp.json", seed_value)
	s.ai_factions = ["han", "xiongnu"]
	Sim.start(s)
	var next_report := 0
	while s.winner == "" and s.turn < turns:
		Sim.advance_turn(s)
		if s.turn >= next_report:
			next_report += 20
			report(s)
	report(s)
	if args.size() > 2:
		dump(s)
	print("结果: ", s.winner, " ", s.win_reason)
	var kinds := {}
	for e in s.log:
		kinds[e["kind"]] = int(kinds.get(e["kind"], 0)) + 1
	print("事件统计: ", kinds)
	quit()

func report(s) -> void:
	var hc = Sim.han_condition(s)
	var hexi := 0
	for id in s.bal["victory"]["xn_targets"]:
		if s.controller(s.nodes[id]) == "han":
			hexi += 1
	var xn_vassals := 0
	for r in s.relations.values():
		if r["overlord"] == "xiongnu":
			xn_vassals += 1
	print("  长安粮仓 陇西%d 乌垒汉仓%d 轮台汉仓%d 敦煌%d" % [s.nodes["long_xi"]["grain"], s.stock(s.nodes["wu_lei"], "han"), s.stock(s.nodes["lun_tai"], "han"), s.nodes["dun_huang"]["grain"]])
	print("[%s 回合%d] 汉属国 %d(必需%s 威吓%s 屯粮%d) 匈奴属国 %d 河西持有 %d/4 战斗 %d 汉损 %d 匈损 %d 钱 %d 截粮 %d" % [s.date_text(), s.turn, hc["count"], hc["must"], hc["intim"], hc["depot_grain"], xn_vassals, hexi, s.stats["battles"], s.stats["han_casualties"], s.stats["xn_casualties"], s.factions["han"]["money"], s.convoy_losses])

func dump(s) -> void:
	for e in s.log:
		if e["kind"] in ["ai", "capture", "battle", "diplomacy"] and e["turn"] < 12:
			print(e["date"], " ", e["kind"], " ", e["text"])
