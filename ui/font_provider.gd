extends RefCounted
# 无窗口验证直接读取系统字体文件，避免依赖 macOS 字体服务；不复制或分发系统字体。
static var cached: Font

static func body_font() -> Font:
	if cached != null:
		return cached
	if OS.get_name() == "macOS" and DisplayServer.get_name() == "headless":
		var path = "/System/Library/Fonts/STHeiti Light.ttc"
		if FileAccess.file_exists(path):
			var bytes = FileAccess.get_file_as_bytes(path)
			if not bytes.is_empty():
				var file = FontFile.new()
				file.data = bytes
				file.allow_system_fallback = false
				file.fallbacks = [ThemeDB.fallback_font]
				cached = file
				return cached
	var system = SystemFont.new()
	system.font_names = PackedStringArray(["PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", "sans-serif"])
	cached = system
	return cached
