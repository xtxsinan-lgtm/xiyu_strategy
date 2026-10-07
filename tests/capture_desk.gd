extends SceneTree
func _initialize() -> void:
	call_deferred("capture")
func capture() -> void:
	var scene = load("res://main.tscn").instantiate()
	root.add_child(scene)
	scene.show_desk()
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://district-preview.png")
	# 点击目录并执行实际按钮，验证重建界面后的信号仍正常。
	for child in scene.desk.get_children():
		if child is Button and child.text == "执行 · 电话网络": child.pressed.emit(); break
	assert(scene.campaign.cities[4].policies.phone == 10)
	scene.desk_category = "群众"
	scene.desk_selection = "aid"
	scene.render_desk()
	for child in scene.desk.get_children():
		if child is Button and child.text == "执行 · 农会互助": assert(child.disabled)
	await process_frame
	quit()
