extends SceneTree
# 截图验证界面（需要图形环境，不能用 --headless）：
#   godot --path . --script res://tools/capture_ui.gd -- out.png [army|node|plan]
func _initialize() -> void:
	call_deferred("capture")

func capture() -> void:
	var args = OS.get_cmdline_user_args()
	var out = args[0] if args.size() > 0 else "/tmp/xiyu_ui.png"
	var mode = args[1] if args.size() > 1 else "node"
	var scene = load("res://ui/main.tscn").instantiate()
	root.add_child(scene)
	await process_frame
	await process_frame
	scene.new_game("han", 3, 1)
	if mode == "ambush":
		scene.new_game("xiongnu", 9, 1)
		var a = scene.state.armies.values().filter(func(x): return x["faction"] == "xiongnu")[0]
		scene.sel_army = a["id"]
		scene._draft(a)["preset"] = "assault"
		scene._draft(a)["steps"].append({"type": "ambush", "node": "yang_guan", "route": scene.state.adj["yang_guan"][0], "months": 2})
		scene.refresh()
	elif mode == "plan":
		# 选敦煌军队并编辑一个计划
		var a = scene.state.armies["han_g_dunhuang"]
		scene.sel_army = a["id"]
		scene._draft(a)["steps"].append({"type": "siege", "node": "lou_lan", "max_months": 3, "assault_when": 0.5})
		scene.sel_node = "lou_lan"
		scene.refresh()
	elif mode == "replay":
		scene.new_game("han", 9, 1)
		var a = scene.state.armies["han_g_dunhuang"]
		a["laborers"] = 2000
		a["grain"] = 45000.0
		a["plan"]["steps"] = [{"type": "move_to", "node": "lou_lan"}]
		a["plan"]["triggers"] = []
		scene.replay_speed = 4.0
		scene.end_turn()
		for i in 1000:
			await process_frame
			if scene.map_view.state.tick >= 1:
				scene.replay_paused = true
				scene.replay_pause_btn.text = "继续"
				break
	elif mode == "turn":
		for i in 4:
			scene.replay_speed = 100.0
			await scene.end_turn()
		scene.sel_node = "lou_lan"
		scene.refresh()
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(out)
	if scene.replaying:
		scene.replay_skip = true
		while scene.replaying:
			await process_frame
	quit()
