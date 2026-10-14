extends SceneTree
# 无战争空跑：检查经济曲线（粮食、人口、马匹）
const GS = preload("res://core/game_state.gd")
const TR = preload("res://core/turn_resolver.gd")

func _init() -> void:
	var s = GS.new()
	s.load_scenario("res://data/scenario_mvp.json", 1, 3)
	var watch := ["dun_huang", "long_xi", "qiu_ci", "youxian_wang", "chanyu_ting", "lou_lan", "da_wan"]
	for turn in 240:
		TR.resolve(s, {})
		if turn % 24 == 23 or turn == 0:
			var line := "%s |" % s.date_text()
			for id in watch:
				var n = s.nodes[id]
				line += " %s pop%d g%d h%d |" % [n["name"], n["pop"], n["grain"], n["horses"]]
			print(line)
		if s.winner != "":
			print("winner ", s.winner, s.win_reason)
			break
	print("hash ", s.state_hash())
	quit()
