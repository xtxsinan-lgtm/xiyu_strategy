extends SceneTree
func _init() -> void:
	var dirs := ["res://core", "res://ai"]
	for d in dirs:
		for f in DirAccess.get_files_at(d):
			if f.ends_with(".gd"):
				var s = load(d + "/" + f)
				print(d, "/", f, " -> ", "OK" if s != null and s.can_instantiate() else "FAIL")
	quit()
