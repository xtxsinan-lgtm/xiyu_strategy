extends RefCounted
# 「漆案舆图」配色、字体与主题（docs/ui_desk_spec.md §2–4）。与网页版共用同一套色值。
# 主题在代码中构建，不依赖编辑器导入资源。

const Fonts = preload("res://ui/font_provider.gd")

# ---- 漆 · 绢 · 朱 · 铜 ----
const LACQUER = Color("1c1511")
const LACQUER_2 = Color("2b201a")
const LACQUER_LINE = Color("4a3a2c")
const SILK = Color("f2ead8")
const SILK_2 = Color("e7dcc4")
const SILK_3 = Color("fbf7ee")
const INK = Color("2b2119")
const INK_2 = Color("4e4033")
const MUTED = Color("85745e")
const CINNABAR = Color("a33a2a")
const CINNABAR_HI = Color("c2513b")
const BRONZE = Color("b48c4e")
const BRONZE_HI = Color("d9b877")
const PATINA = Color("3e6b5a")
const AMBER = Color("b9822d")
const XN = Color("6b4a33")
const ON_LACQUER = Color("efe4cc")
const ON_LACQUER_MUTED = Color("a8957a")
const MAP_BG = Color("d9c8a3")
# 规则线 = ink 35%；卡片边 = ink 20%；按钮边 = ink 45%。
const RULE = Color(0.1686, 0.1294, 0.098, 0.35)
const CARD_EDGE = Color(0.1686, 0.1294, 0.098, 0.20)
const BTN_EDGE = Color(0.1686, 0.1294, 0.098, 0.45)
const CLEAR = Color(0, 0, 0, 0)

# ---- 字号 ----
const FS_BODY = 14
const FS_NOTE = 12
const FS_TAG = 11
const FS_SECTION = 16
const FS_DRAWER = 21
const FS_METRIC = 20

static var _title: Font


## 楷体标题字体；无窗口验证时退回正文字体，避免依赖系统字体服务。
static func title_font() -> Font:
	if _title != null:
		return _title
	if DisplayServer.get_name() == "headless":
		_title = Fonts.body_font()
		return _title
	var f = SystemFont.new()
	f.font_names = PackedStringArray(["LXGW WenKai", "Kaiti SC", "STKaiti", "KaiTi", "Songti SC"])
	f.fallbacks = [Fonts.body_font()]
	_title = f
	return _title


static func box(bg: Color, border: Color = CLEAR, width: int = 0, margin: float = 0.0, radius: int = 0) -> StyleBoxFlat:
	var b = StyleBoxFlat.new()
	b.bg_color = bg
	if width > 0:
		b.border_color = border
		b.set_border_width_all(width)
	b.set_corner_radius_all(radius)
	b.content_margin_left = margin
	b.content_margin_right = margin
	b.content_margin_top = margin
	b.content_margin_bottom = margin
	return b


static func margins(b: StyleBox, h: float, v: float) -> StyleBox:
	b.content_margin_left = h
	b.content_margin_right = h
	b.content_margin_top = v
	b.content_margin_bottom = v
	return b


## 实心三角形图标（下拉箭头、微调按钮）。
static func triangle(w: int, h: int, col: Color, up: bool = false) -> ImageTexture:
	var img = Image.create_empty(w, h, false, Image.FORMAT_RGBA8)
	img.fill(CLEAR)
	var mid := (w - 1) * 0.5
	for y in h:
		var row := (h - 1 - y) if up else y
		var half := mid * (1.0 - float(row) / float(maxi(h - 1, 1)))
		for x in w:
			if absf(float(x) - mid) <= half + 0.5:
				img.set_pixel(x, y, col)
	return ImageTexture.create_from_image(img)


static func dot(d: int, col: Color) -> ImageTexture:
	var img = Image.create_empty(d, d, false, Image.FORMAT_RGBA8)
	img.fill(CLEAR)
	var c := (d - 1) * 0.5
	for y in d:
		for x in d:
			if Vector2(x - c, y - c).length() <= d * 0.5 - 0.5:
				img.set_pixel(x, y, col)
	return ImageTexture.create_from_image(img)


static func _button_styles(th: Theme, type_name: String) -> void:
	var normal = margins(box(SILK_3, BTN_EDGE, 1, 0.0, 2), 10, 5)
	var hover = margins(box(SILK_3, CINNABAR, 1, 0.0, 2), 10, 5)
	var pressed = margins(box(SILK_2, CINNABAR, 1, 0.0, 2), 10, 5)
	var disabled = margins(box(Color(SILK_3, 0.45), Color(INK, 0.2), 1, 0.0, 2), 10, 5)
	th.set_stylebox("normal", type_name, normal)
	th.set_stylebox("hover", type_name, hover)
	th.set_stylebox("pressed", type_name, pressed)
	th.set_stylebox("hover_pressed", type_name, pressed)
	th.set_stylebox("disabled", type_name, disabled)
	th.set_stylebox("focus", type_name, StyleBoxEmpty.new())
	th.set_color("font_color", type_name, INK)
	th.set_color("font_focus_color", type_name, INK)
	th.set_color("font_hover_color", type_name, CINNABAR)
	th.set_color("font_pressed_color", type_name, CINNABAR)
	th.set_color("font_hover_pressed_color", type_name, CINNABAR)
	th.set_color("font_disabled_color", type_name, Color(INK, 0.45))


static func build_theme() -> Theme:
	var th = Theme.new()
	th.default_font = Fonts.body_font()
	th.default_font_size = FS_BODY
	# 文字
	th.set_color("font_color", "Label", INK)
	th.set_color("default_color", "RichTextLabel", INK)
	th.set_stylebox("normal", "RichTextLabel", StyleBoxEmpty.new())
	th.set_stylebox("focus", "RichTextLabel", StyleBoxEmpty.new())
	th.set_color("selection_color", "RichTextLabel", Color(BRONZE, 0.35))
	# 面板：绢底 + 1px 规则线，直角
	th.set_stylebox("panel", "PanelContainer", box(SILK, RULE, 1, 10.0))
	th.set_stylebox("panel", "Panel", box(SILK, RULE, 1))
	th.set_stylebox("panel", "AcceptDialog", box(SILK, RULE, 1, 12.0))
	# 按钮
	_button_styles(th, "Button")
	_button_styles(th, "OptionButton")
	_button_styles(th, "MenuButton")
	th.set_icon("arrow", "OptionButton", triangle(10, 6, INK))
	th.set_constant("arrow_margin", "OptionButton", 6)
	# 输入框 / 微调框
	var le = margins(box(SILK_3, RULE, 1, 0.0, 2), 7, 4)
	var le_focus = margins(box(SILK_3, CINNABAR, 1, 0.0, 2), 7, 4)
	var le_ro = margins(box(SILK_2, CARD_EDGE, 1, 0.0, 2), 7, 4)
	th.set_stylebox("normal", "LineEdit", le)
	th.set_stylebox("focus", "LineEdit", le_focus)
	th.set_stylebox("read_only", "LineEdit", le_ro)
	th.set_color("font_color", "LineEdit", INK)
	th.set_color("font_uneditable_color", "LineEdit", MUTED)
	th.set_color("font_placeholder_color", "LineEdit", MUTED)
	th.set_color("caret_color", "LineEdit", CINNABAR)
	th.set_color("selection_color", "LineEdit", Color(BRONZE, 0.35))
	var up = triangle(9, 5, INK, true)
	var down = triangle(9, 5, INK)
	var up_hi = triangle(9, 5, CINNABAR, true)
	var down_hi = triangle(9, 5, CINNABAR)
	for suffix in ["", "_hover", "_pressed", "_disabled"]:
		th.set_icon("up" + suffix, "SpinBox", up_hi if suffix in ["_hover", "_pressed"] else up)
		th.set_icon("down" + suffix, "SpinBox", down_hi if suffix in ["_hover", "_pressed"] else down)
	# 下拉菜单
	th.set_stylebox("panel", "PopupMenu", box(SILK_3, BTN_EDGE, 1, 4.0))
	th.set_stylebox("hover", "PopupMenu", box(SILK_2, CLEAR, 0, 0.0))
	var sep_line = StyleBoxLine.new()
	sep_line.color = RULE
	th.set_stylebox("separator", "PopupMenu", sep_line)
	th.set_color("font_color", "PopupMenu", INK)
	th.set_color("font_hover_color", "PopupMenu", CINNABAR)
	th.set_color("font_disabled_color", "PopupMenu", Color(INK, 0.45))
	th.set_color("font_separator_color", "PopupMenu", MUTED)
	th.set_color("font_accelerator_color", "PopupMenu", MUTED)
	th.set_icon("radio_checked", "PopupMenu", dot(8, CINNABAR))
	th.set_icon("radio_unchecked", "PopupMenu", dot(8, CLEAR))
	th.set_icon("checked", "PopupMenu", dot(8, CINNABAR))
	th.set_icon("unchecked", "PopupMenu", dot(8, CLEAR))
	th.set_stylebox("panel", "PopupPanel", box(SILK_3, BTN_EDGE, 1, 6.0))
	# 进度条：高 6，绢色轨道
	th.set_stylebox("background", "ProgressBar", box(SILK_2, CARD_EDGE, 1))
	th.set_stylebox("fill", "ProgressBar", box(CINNABAR))
	th.set_color("font_color", "ProgressBar", INK)
	# 滚动条
	for sb_type in ["VScrollBar", "HScrollBar"]:
		th.set_stylebox("scroll", sb_type, margins(box(Color(SILK_2, 0.6)), 3, 3))
		th.set_stylebox("scroll_focus", sb_type, margins(box(Color(SILK_2, 0.6)), 3, 3))
		th.set_stylebox("grabber", sb_type, margins(box(Color(INK, 0.30), CLEAR, 0, 0.0, 2), 3, 3))
		th.set_stylebox("grabber_highlight", sb_type, margins(box(Color(INK, 0.50), CLEAR, 0, 0.0, 2), 3, 3))
		th.set_stylebox("grabber_pressed", sb_type, margins(box(CINNABAR, CLEAR, 0, 0.0, 2), 3, 3))
	# 悬停提示
	th.set_stylebox("panel", "TooltipPanel", margins(box(SILK_3, INK, 1), 9, 6))
	th.set_color("font_color", "TooltipLabel", INK)
	th.set_font_size("font_size", "TooltipLabel", FS_NOTE + 1)
	# 分隔线
	var hline = StyleBoxLine.new()
	hline.color = RULE
	hline.thickness = 1
	th.set_stylebox("separator", "HSeparator", hline)
	th.set_constant("separation", "HSeparator", 9)
	var vline = StyleBoxLine.new()
	vline.color = LACQUER_LINE
	vline.thickness = 1
	vline.vertical = true
	th.set_stylebox("separator", "VSeparator", vline)
	th.set_constant("separation", "VSeparator", 1)
	th.set_constant("h_separation", "HFlowContainer", 6)
	th.set_constant("v_separation", "HFlowContainer", 6)
	return th
