extends SceneTree
# headless AI vs AI 批量模拟。
#   godot --headless --path . --script res://tools/sim_runner.gd -- --games 20 --seed 1 --decision-ticks 3 --out sim.csv

const GS = preload("res://core/game_state.gd")
const TR = preload("res://core/turn_resolver.gd")
const Victory = preload("res://core/victory.gd")
const HanAI = preload("res://ai/han_ai.gd")
const XnAI = preload("res://ai/xiongnu_ai.gd")

func _init() -> void:
	var args = _parse(OS.get_cmdline_user_args())
	var games: int = int(args.get("games", 5))
	var seed0: int = int(args.get("seed", 1))
	var dt: int = int(args.get("decision-ticks", 3))
	var verbose: bool = args.has("verbose")
	var out_path: String = args.get("out", "")
	var rows = ["seed,decision_ticks,winner,reason,months,han_vassals_end,han_vassals_peak,hexi_lost,battles,han_cas,xn_cas,horses_captured,sieges,rejected,raids,grain_raided,trade_blocked_months,starve_losses,terrain_losses"]
	var wins = {"han": 0, "xiongnu": 0}
	var rejection_details: Array = []
	for g in games:
		var s = GS.new()
		s.load_scenario("res://data/scenario_mvp.json", seed0 + g, dt)
		if args.has("xn-cap"):
			s.ai_profiles["xiongnu_default"]["max_field_troops"] = int(args["xn-cap"])
			s.ai_profiles["xiongnu_default"]["long_plan_reserve_per_month"] = 0
		if args.has("xn-prob"):
			s.ai_profiles["xiongnu_default"]["min_attack_probability"] = float(args["xn-prob"])
		var han = HanAI.new()
		var xn = XnAI.new()
		var rejected = 0
		var max_turns: int = s.max_turns * 3 / dt
		for t in max_turns:
			var res = TR.resolve(s, {"han": han.think(s), "xiongnu": xn.think(s)})
			for army in s.armies.values():
				if army["horses"] < 0 or army["grain"] < 0 or army["laborers"] < 0 or army["units"].values().any(func(n): return n < 0):
					push_error("资源出现负数：seed=%d army=%s" % [seed0 + g, army["id"]])
					quit(1)
					return
			rejected += res["rejected"].size()
			for rejection in res["rejected"]:
				rejection_details.append({"seed": seed0 + g, "decision_ticks": dt, "turn": t, "command": rejection["cmd"], "why": rejection["why"]})
			if verbose:
				for e in res["events"]:
					if e["kind"] in ["battle", "capture", "defect", "ai", "trigger", "victory", "rout", "evade", "convoy", "siege", "starve"]:
						print(e["date"], " ", e["text"])
				for r in res["rejected"]:
					print("  拒绝: ", r["cmd"]["type"], " ", r["why"])
			if s.winner != "":
				break
		wins[s.winner] = wins.get(s.winner, 0) + 1
		rows.append("%d,%d,%s,%s,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d" % [seed0 + g, dt, s.winner, s.win_reason, s.tick / 3, Victory.han_vassals(s), s.stats["han_vassals_peak"], s.stats["hexi_lost"], s.stats["battles"], s.stats["han_casualties"], s.stats["xn_casualties"], s.stats["horses_captured"], s.stats["sieges_won"], rejected])
		rows[-1] += ",%d,%.0f,%d,%d,%d" % [s.stats.get("raids_xiongnu", 0), s.stats.get("grain_raided_xiongnu", 0), s.stats.get("trade_blocked_months", 0), s.stats.get("starve_losses", 0), s.stats.get("terrain_losses", 0)]
		print(rows[-1])
		if verbose:
			print("stats ", s.stats)
	print("汉胜 %d / 匈奴胜 %d" % [wins["han"], wins.get("xiongnu", 0)])
	if out_path != "":
		var f = FileAccess.open(out_path, FileAccess.WRITE)
		f.store_string("\n".join(rows) + "\n")
	if args.has("rejected-out"):
		var detail_file = FileAccess.open(args["rejected-out"], FileAccess.WRITE)
		detail_file.store_string(JSON.stringify(rejection_details, "  ") + "\n")
	quit()

func _parse(a: PackedStringArray) -> Dictionary:
	var d = {}
	var i = 0
	while i < a.size():
		if a[i].begins_with("--"):
			var k = a[i].substr(2)
			if i + 1 < a.size() and not a[i + 1].begins_with("--"):
				d[k] = a[i + 1]
				i += 1
			else:
				d[k] = true
		i += 1
	return d
