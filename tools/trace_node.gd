extends SceneTree
const GS = preload("res://core/game_state.gd")
const TR = preload("res://core/turn_resolver.gd")
func _init() -> void:
	var s = GS.new()
	s.load_scenario("res://data/scenario_mvp.json", 1, 3)
	var id = "dun_huang"
	for m in 14:
		var n = s.nodes[id]
		var h0 = n["horses"]
		TR.resolve(s, {})
		print("m", m + 1, " mon", s.month(), " horses ", h0, " -> ", n["horses"], " pop ", n["pop"], " grain ", n["grain"], " starving ", n["starving"])
	quit()
