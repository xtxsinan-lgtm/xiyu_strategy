extends Control
# 主界面「漆案舆图」（docs/ui_desk_spec.md）：顶栏 + 舆图画框 + 军情栏 + 案上器物 + 抽屉。
# 主界面只留舆图与少量常驻信息；城邑、局势、诸国、粮道、军务、战报都收进抽屉。
# UI 只读 GameState、只写 Command；与 AI 使用同一套命令接口。

const GS = preload("res://core/game_state.gd")
const TR = preload("res://core/turn_resolver.gd")
const Cmd = preload("res://core/commands.gd")
const Cal = preload("res://core/calendar.gd")
const Path = preload("res://core/pathfinding.gd")
const Supply = preload("res://core/supply.gd")
const Combat = preload("res://core/combat.gd")
const Diplomacy = preload("res://core/diplomacy.gd")
const Victory = preload("res://core/victory.gd")
const Trade = preload("res://core/trade.gd")
const MapView = preload("res://ui/map_view.gd")
const HanAI = preload("res://ai/han_ai.gd")
const XnAI = preload("res://ai/xiongnu_ai.gd")
const D = preload("res://ui/desk_theme.gd")

const SAVE_PATH := "user://xiyu_save.txt"
const ICON_DIR := "res://assets/icons/desk/"
# 本文件内常用色（与 desk_theme.gd 一致，供默认参数使用）。
const INK = Color("2b2119")
const MUTED = Color("85745e")
const RED = Color("a33a2a")
const TOP_H := 60.0
const BAR_H := 96.0
const SIDE_W := 300.0
const DRAWER_W := 940.0
const DRAWER_LABEL_W := 820.0
const SIDE_LABEL_W := 232.0

# 案上器物（与网页版同一顺序、同一快捷键）。key 为抽屉名；speed 切换回放速度。
const PROPS := [
	{"key": "node", "icon": "tuji", "name": "图籍", "act": "城邑 · F1"},
	{"key": "state", "icon": "zhaoshu", "icon_xn": "wangting", "name": "诏书", "name_xn": "王庭", "act": "局势 · F2"},
	{"key": "states", "icon": "fujie", "name": "符节", "act": "诸国 · F3"},
	{"key": "speed", "icon": "louke", "name": "漏刻", "act": "回放 ×1"},
	{"key": "supply", "icon": "canglin", "name": "仓廪", "act": "粮道 · F4"},
	{"key": "army", "icon": "hufu", "name": "虎符", "act": "军务 · F5"},
	{"key": "log", "icon": "shice", "name": "史册", "act": "战报 · F6"},
]
# 抽屉：[朱印字, 标题, 快捷键]
const DRAWERS := {
	"node": ["城", "城邑", "F1"],
	"state": ["诏", "局势", "F2"],
	"states": ["节", "诸国", "F3"],
	"supply": ["仓", "粮道", "F4"],
	"army": ["符", "军务", "F5"],
	"log": ["史", "战报", "F6"],
}
const PAGE_ORDER := ["node", "state", "states", "supply", "army", "log"]
const HOTKEYS := {KEY_F1: "node", KEY_F2: "state", KEY_F3: "states", KEY_F4: "supply", KEY_F5: "army", KEY_F6: "log"}

var state
var player := "han"
var decision_ticks := 3
var ai_han = HanAI.new()
var ai_xn = XnAI.new()
var orders: Array = []
var drafts := {}         # army_id -> {steps, preset}
var pick := {}           # 地图取点模式 {kind, ...}
var sel_node := ""
var sel_army := ""
var gift_units := 3
var recruit_amount := 2000
var convoy := {"laborers": 2000, "grain": 30000, "to": "", "stay": false, "loop": false}

var map_view: Control
var status_label: Label
## 全部抽屉页的容器（每页一个 VBox，仅当前页可见）；测试从这里查找控件。
var side: VBoxContainer
var log_box: RichTextLabel
var end_btn: Button
var faction_option: OptionButton
var interval_option: OptionButton
var side_blocker: Control
var replaying := false
var replay_paused := false
var replay_speed := 1.0
var replay_skip := false
var replay_next_event := false
var replay_label: Label
var replay_bar: PanelContainer
var replay_pause_btn: Button
var replay_controls: Array = []
var side_scroll: ScrollContainer

# 漆案布局
var map_desk: Control
var drawer: PanelContainer
var drawer_key := ""
var drawer_seal: Label
var drawer_title: Label
var drawer_sub: Label
var drawer_hint: Label
var pages := {}                 # key -> VBoxContainer
var _page: VBoxContainer        # 当前正在搭建的抽屉页
var prop_buttons := {}          # key -> {button, name, act, icon}
var outliner_sel: VBoxContainer
var outliner_alerts: VBoxContainer
var outliner_orders: VBoxContainer
var orders_title: Label
var outliner_blocker: Control
var top_seal: Label
var top_seal_panel: PanelContainer
var top_leader: Label
var top_sub: Label
var top_date: Label
var top_season: Label
var top_metrics: Array = []     # [[label, value], ...]
var newgame_panel: PanelContainer
var layer_panel: PanelContainer
var toast: PanelContainer
var toast_cancel: Button
var status_timer: Timer
var end_sub: Label
var _icons := {}
var map_mode_buttons := {}      # mode -> Button
var drawer_tab_buttons := {}    # key -> Button
var map_inspector_card: PanelContainer
var map_inspector_body: VBoxContainer
var causal_stack_box: VBoxContainer
var locked_causal_keys: Array = []
var transient_causal_key := ""
var metric_history := {}        # key -> Array[float]

func _ready() -> void:
	_build_theme()
	_build_ui()
	new_game(player, decision_ticks)

# ---------------- 搭建 ----------------
func _build_theme() -> void:
	theme = D.build_theme()

func _place(c: Control, al: float, at: float, ar: float, ab: float, ol: float, ot: float, orr: float, ob: float) -> void:
	c.anchor_left = al
	c.anchor_top = at
	c.anchor_right = ar
	c.anchor_bottom = ab
	c.offset_left = ol
	c.offset_top = ot
	c.offset_right = orr
	c.offset_bottom = ob

func _kai(c: Control, fs: int, col := Color(0, 0, 0, 0)) -> Control:
	c.add_theme_font_override("font", D.title_font())
	c.add_theme_font_size_override("font_size", fs)
	if col.a > 0.0:
		c.add_theme_color_override("font_color", col)
	return c

func _text(t: String, fs := 14, col := INK) -> Label:
	var l = Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", fs)
	l.add_theme_color_override("font_color", col)
	return l

func _icon(icon_name: String) -> Texture2D:
	if _icons.has(icon_name):
		return _icons[icon_name]
	var tex: Texture2D = null
	var path := ICON_DIR + icon_name + ".svg"
	if FileAccess.file_exists(path):
		var img = Image.new()
		if img.load_svg_from_string(FileAccess.get_file_as_string(path), 1.0) == OK:
			tex = ImageTexture.create_from_image(img)
	_icons[icon_name] = tex
	return tex

func _ignore_mouse(n: Node) -> void:
	var c := n as Control
	if c != null:
		c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for child in n.get_children():
		_ignore_mouse(child)

## 漆面幽灵按钮（顶栏菜单、回放横幅）。
func _ghost(b: Button) -> Button:
	var n = D.margins(D.box(D.CLEAR, D.LACQUER_LINE, 1, 0.0, 2), 10, 4)
	var h = D.margins(D.box(D.LACQUER_2, D.BRONZE, 1, 0.0, 2), 10, 4)
	var dis = D.margins(D.box(D.CLEAR, Color(D.LACQUER_LINE, 0.5), 1, 0.0, 2), 10, 4)
	b.add_theme_stylebox_override("normal", n)
	b.add_theme_stylebox_override("hover", h)
	b.add_theme_stylebox_override("pressed", h)
	b.add_theme_stylebox_override("hover_pressed", h)
	b.add_theme_stylebox_override("disabled", dis)
	b.add_theme_color_override("font_color", D.ON_LACQUER)
	b.add_theme_color_override("font_focus_color", D.ON_LACQUER)
	b.add_theme_color_override("font_hover_color", D.BRONZE_HI)
	b.add_theme_color_override("font_pressed_color", D.BRONZE_HI)
	b.add_theme_color_override("font_hover_pressed_color", D.BRONZE_HI)
	b.add_theme_color_override("font_disabled_color", Color(D.ON_LACQUER_MUTED, 0.5))
	b.focus_mode = Control.FOCUS_NONE
	return b

## 主按钮：朱底绢字。
func _primary(b: Button) -> Button:
	b.add_theme_stylebox_override("normal", D.margins(D.box(D.CINNABAR, D.CINNABAR, 1, 0.0, 2), 12, 5))
	b.add_theme_stylebox_override("hover", D.margins(D.box(D.CINNABAR_HI, D.CINNABAR_HI, 1, 0.0, 2), 12, 5))
	b.add_theme_stylebox_override("pressed", D.margins(D.box(D.CINNABAR, D.INK, 1, 0.0, 2), 12, 5))
	b.add_theme_stylebox_override("disabled", D.margins(D.box(Color(D.CINNABAR, 0.45), D.CLEAR, 0, 0.0, 2), 12, 5))
	for k in ["font_color", "font_focus_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color"]:
		b.add_theme_color_override(k, D.SILK)
	b.add_theme_color_override("font_disabled_color", Color(D.SILK, 0.7))
	return b

func _build_ui() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var bg = ColorRect.new()
	bg.color = D.LACQUER
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)
	_build_map_desk()
	_build_outliner()
	_build_desk_bar()
	_build_top_bar()
	_build_newgame_panel()
	status_timer = Timer.new()
	status_timer.one_shot = true
	status_timer.timeout.connect(func():
		if pick.is_empty():
			_set_status(""))
	add_child(status_timer)
	# 逐日回放控制：结算时禁止改令，地图仍可缩放/拖动。
	replay_controls.append(end_btn)

# ---- 顶栏（漆面，高 60）----
func _build_top_bar() -> void:
	var bar = Panel.new()
	var st = D.box(D.LACQUER)
	st.border_color = D.LACQUER_LINE
	st.border_width_bottom = 1
	bar.add_theme_stylebox_override("panel", st)
	_place(bar, 0, 0, 1, 0, 0, 0, 0, TOP_H)
	add_child(bar)
	var row = HBoxContainer.new()
	row.add_theme_constant_override("separation", 16)
	_place(row, 0, 0, 1, 1, 14, 0, -14, 0)
	bar.add_child(row)
	top_seal_panel = PanelContainer.new()
	top_seal_panel.custom_minimum_size = Vector2(40, 40)
	top_seal_panel.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	top_seal_panel.add_theme_stylebox_override("panel", D.box(D.CINNABAR, D.BRONZE, 1, 0.0, 2))
	row.add_child(top_seal_panel)
	top_seal = _text("汉", 24, D.SILK)
	_kai(top_seal, 24)
	top_seal.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	top_seal.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	top_seal_panel.add_child(top_seal)
	var who = VBoxContainer.new()
	who.add_theme_constant_override("separation", 0)
	who.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	who.custom_minimum_size.x = 170
	row.add_child(who)
	top_leader = _text("", 17, D.ON_LACQUER)
	_kai(top_leader, 17)
	who.add_child(top_leader)
	top_sub = _text("", 12, D.ON_LACQUER_MUTED)
	who.add_child(top_sub)
	var metric_keys := ["money", "military", "victory"]
	for i in 3:
		row.add_child(_lacquer_divider())
		var m = VBoxContainer.new()
		m.add_theme_constant_override("separation", 0)
		m.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		m.custom_minimum_size.x = 136
		var top_r = HBoxContainer.new()
		var ml = _text("", 11, D.ON_LACQUER_MUTED)
		ml.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var mhint = _text("因果 ▾", 10, D.BRONZE)
		top_r.add_child(ml)
		top_r.add_child(mhint)
		var mv = _text("", 20, D.BRONZE_HI)
		m.mouse_filter = Control.MOUSE_FILTER_STOP
		m.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		var mkey: String = metric_keys[i]
		m.gui_input.connect(func(ev: InputEvent):
			if ev is InputEventMouseButton and ev.button_index == MOUSE_BUTTON_LEFT and ev.pressed:
				_explain_metric(mkey))
		m.add_child(top_r)
		m.add_child(mv)
		row.add_child(m)
		top_metrics.append([ml, mv])
	var spacer = Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(spacer)
	var when = VBoxContainer.new()
	when.add_theme_constant_override("separation", 0)
	when.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(when)
	top_date = _text("", 18, D.ON_LACQUER)
	_kai(top_date, 18)
	top_date.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	when.add_child(top_date)
	top_season = _text("", 12, D.ON_LACQUER_MUTED)
	top_season.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	when.add_child(top_season)
	row.add_child(_lacquer_divider())
	var menu = HBoxContainer.new()
	menu.add_theme_constant_override("separation", 6)
	menu.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(menu)
	var chronicle = _ghost(_btn("纪事", func(): _toggle_drawer("log")))
	chronicle.tooltip_text = "打开战报（F6）"
	menu.add_child(chronicle)
	var sb = _ghost(_btn("存档", save_game))
	menu.add_child(sb)
	var lb = _ghost(_btn("读档", load_game))
	menu.add_child(lb)
	# 「开局」打开新局面板；面板内以「新局」开头的按钮才真正开局。
	var ng = _ghost(_btn("开局", func():
		newgame_panel.visible = not newgame_panel.visible))
	ng.tooltip_text = "选择阵营与节奏，开始新局"
	menu.add_child(ng)
	replay_controls.append_array([sb, lb, ng])

func _lacquer_divider() -> Control:
	var d = ColorRect.new()
	d.color = D.LACQUER_LINE
	d.custom_minimum_size = Vector2(1, 34)
	d.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	d.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return d

func _build_newgame_panel() -> void:
	newgame_panel = PanelContainer.new()
	var st = D.box(D.SILK, D.INK, 2, 14.0, 2)
	st.shadow_color = Color(0.078, 0.055, 0.031, 0.45)
	st.shadow_size = 16
	st.shadow_offset = Vector2(0, 10)
	newgame_panel.add_theme_stylebox_override("panel", st)
	_place(newgame_panel, 1, 0, 1, 0, -SIDE_W - 60, TOP_H + 6, -14, TOP_H + 6)
	newgame_panel.visible = false
	add_child(newgame_panel)
	var col = VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	newgame_panel.add_child(col)
	col.add_child(_section_title("开新局", "前119年剧本"))
	var side_opt = OptionButton.new()
	side_opt.add_item("执汉", 0)
	side_opt.add_item("执匈奴", 1)
	side_opt.tooltip_text = "选择新局阵营，点击『新局』生效"
	faction_option = side_opt
	var iv = OptionButton.new()
	iv.add_item("月制", 0)
	iv.add_item("季制", 1)
	iv.tooltip_text = "选择新局节奏，点击『新局』生效"
	interval_option = iv
	var grid = GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 8)
	grid.add_child(_text("阵营", 12, MUTED))
	side_opt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_child(side_opt)
	grid.add_child(_text("节奏", 12, MUTED))
	iv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_child(iv)
	col.add_child(grid)
	col.add_child(_text("月制每月下令一次；季制每季一次、每次结算三个月。", 12, MUTED))
	var nb = _primary(_btn("新局 · 开始", func():
		new_game("han" if faction_option.selected == 0 else "xiongnu", 3 if interval_option.selected == 0 else 9)
		newgame_panel.visible = false))
	var cancel = _btn("取消", func(): newgame_panel.visible = false)
	var buttons = HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_END
	buttons.add_theme_constant_override("separation", 8)
	buttons.add_child(cancel)
	buttons.add_child(nb)
	col.add_child(buttons)
	replay_controls.append_array([side_opt, iv, nb])

# ---- 舆图（画框 + 镜头 + 图层 + 图上速览卡 + 因果浮卡栈 + 回放横幅 + 抽屉）----
func _build_map_desk() -> void:
	map_desk = Control.new()
	map_desk.clip_contents = true
	map_desk.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_place(map_desk, 0, 0, 1, 1, 0, TOP_H, -SIDE_W, -BAR_H)
	add_child(map_desk)
	map_view = MapView.new()
	_place(map_view, 0, 0, 1, 1, 0, 0, 0, 0)
	map_view.node_clicked.connect(_on_node_clicked)
	map_view.army_clicked.connect(_on_army_clicked)
	map_desk.add_child(map_view)
	_build_camera_controls()
	_build_layer_controls()
	_build_map_mode_pills()
	_build_map_inspector_card()
	# 抽屉之后再加因果浮卡栈、提示条与回放横幅，保证它们浮在抽屉之上。
	_build_drawer()
	_build_causal_stack()
	_build_toast()
	_build_replay_bar()

func _build_camera_controls() -> void:
	var zb = VBoxContainer.new()
	zb.add_theme_constant_override("separation", 4)
	_place(zb, 1, 1, 1, 1, -100, -218, -42, -42)
	zb.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	zb.grow_vertical = Control.GROW_DIRECTION_BEGIN
	map_desk.add_child(zb)
	var items := [
		["＋", "放大", func(): map_view.zoom_step(1.25)],
		["－", "缩小", func(): map_view.zoom_step(0.8)],
		["全图", "显示全图", func(): map_view.fit()],
		["聚焦", "聚焦所选；未选时聚焦帅帐", _focus_selected],
	]
	for it in items:
		var b = _btn(it[0], it[2])
		b.tooltip_text = it[1]
		b.custom_minimum_size = Vector2(58, 38)
		_kai(b, 16 if it[0].length() > 1 else 20)
		b.add_theme_stylebox_override("normal", D.margins(D.box(Color(D.SILK_3, 0.94), D.BTN_EDGE, 1, 0.0, 2), 6, 2))
		zb.add_child(b)

func _build_layer_controls() -> void:
	var lb = _btn("图层", func():
		layer_panel.visible = not layer_panel.visible)
	_kai(lb, 16)
	lb.tooltip_text = "图层开关与图例"
	lb.custom_minimum_size = Vector2(84, 38)
	lb.add_theme_stylebox_override("normal", D.margins(D.box(Color(D.SILK_3, 0.94), D.BTN_EDGE, 1, 0.0, 2), 10, 2))
	_place(lb, 0, 1, 0, 1, 42, -80, 126, -42)
	lb.grow_vertical = Control.GROW_DIRECTION_BEGIN
	map_desk.add_child(lb)
	layer_panel = PanelContainer.new()
	layer_panel.add_theme_stylebox_override("panel", D.box(D.SILK, D.INK, 1, 14.0))
	_place(layer_panel, 0, 1, 0, 1, 42, -88, 362, -88)
	layer_panel.grow_vertical = Control.GROW_DIRECTION_BEGIN
	layer_panel.visible = false
	map_desk.add_child(layer_panel)
	var col = VBoxContainer.new()
	col.add_theme_constant_override("separation", 8)
	layer_panel.add_child(col)
	col.add_child(_section_title("图层"))
	var toggles = HFlowContainer.new()
	for spec in [["商路", "show_trade"], ["计里画方", "show_grid"], ["地名", "show_regions"]]:
		var t = Button.new()
		t.toggle_mode = true
		t.button_pressed = bool(map_view.get(spec[1]))
		t.focus_mode = Control.FOCUS_NONE
		t.add_theme_stylebox_override("pressed", D.margins(D.box(D.SILK_2, D.CINNABAR, 1, 0.0, 2), 10, 5))
		var prop: String = spec[1]
		var label: String = spec[0]
		t.text = ("● " if t.button_pressed else "○ ") + label
		t.toggled.connect(func(on: bool):
			map_view.set(prop, on)
			t.text = ("● " if on else "○ ") + label
			map_view.queue_redraw())
		toggles.add_child(t)
	col.add_child(toggles)
	col.add_child(_section_title("图例"))
	var legend = GridContainer.new()
	legend.columns = 2
	legend.add_theme_constant_override("h_separation", 14)
	legend.add_theme_constant_override("v_separation", 4)
	var entries := [
		[MapView.C_HAN, "汉郡（直辖）", false], [MapView.C_HAN_V, "汉属国", false],
		[MapView.C_XN, "匈奴本部", false], [MapView.C_XN_V, "匈奴属国", false],
		[MapView.STATE_COLORS["qiu_ci"], "独立城邦（各国本色）", false], [MapView.C_PASS, "关隘 · 小点为路口", false],
		[Color(0.91, 0.70, 0.25), "商路（畅通）", true], [Color("6b4f2a"), "绿洲道路", true],
		[Color("5f8f4a"), "草原", true], [Color("b8893c"), "沙漠（虚线）", true],
		[Color("7a7a7a"), "山道（冬季封闭）", true], [Color("a33a2a"), "悬度险道", true],
	]
	for e in entries:
		var h = HBoxContainer.new()
		h.add_theme_constant_override("separation", 6)
		var sw = ColorRect.new()
		sw.color = e[0]
		sw.custom_minimum_size = Vector2(18, 4) if e[2] else Vector2(12, 12)
		sw.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		h.add_child(sw)
		h.add_child(_text(e[1], 12, D.INK_2))
		legend.add_child(h)
	col.add_child(legend)
	col.add_child(_text("滚轮缩放 · 拖动平移 · 悬停道路查看里程", 11, MUTED))

func _build_map_mode_pills() -> void:
	var hb = HBoxContainer.new()
	hb.add_theme_constant_override("separation", 4)
	_place(hb, 0, 1, 0, 1, 134, -80, 620, -42)
	hb.grow_vertical = Control.GROW_DIRECTION_BEGIN
	map_desk.add_child(hb)
	for mode in ["political", "influence", "supply", "intel", "military"]:
		var mkey: String = mode
		var label: String = MapView.MAP_MODE_LABELS[mkey]
		var b = _btn(label, func():
			map_view.set_map_mode(mkey)
			_refresh_map_mode_pills())
		b.custom_minimum_size = Vector2(78, 34)
		b.add_theme_font_size_override("font_size", 12)
		hb.add_child(b)
		map_mode_buttons[mkey] = b
	_refresh_map_mode_pills()

func _refresh_map_mode_pills() -> void:
	for mkey in map_mode_buttons:
		var b: Button = map_mode_buttons[mkey]
		var active: bool = (map_view.map_mode == mkey)
		if active:
			b.add_theme_stylebox_override("normal", D.margins(D.box(D.LACQUER, D.BRONZE, 1, 0.0, 2), 8, 2))
			b.add_theme_color_override("font_color", D.ON_LACQUER)
		else:
			b.add_theme_stylebox_override("normal", D.margins(D.box(Color(D.SILK_3, 0.94), D.BTN_EDGE, 1, 0.0, 2), 8, 2))
			b.add_theme_color_override("font_color", D.INK)

func _build_map_inspector_card() -> void:
	map_inspector_card = PanelContainer.new()
	var st = D.box(Color(D.SILK_3, 0.96), D.INK, 1, 10.0, 2)
	st.border_width_top = 3
	st.border_color = D.CINNABAR
	st.shadow_color = Color(0, 0, 0, 0.18)
	st.shadow_size = 6
	map_inspector_card.add_theme_stylebox_override("panel", st)
	_place(map_inspector_card, 0, 0, 0, 0, 44, 136, 304, 340)
	map_desk.add_child(map_inspector_card)
	map_inspector_body = VBoxContainer.new()
	map_inspector_body.add_theme_constant_override("separation", 6)
	map_inspector_card.add_child(map_inspector_body)

func _build_causal_stack() -> void:
	causal_stack_box = VBoxContainer.new()
	causal_stack_box.add_theme_constant_override("separation", 8)
	causal_stack_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_place(causal_stack_box, 1, 0, 1, 0, -346, 118, -36, 620)
	map_desk.add_child(causal_stack_box)

func _build_toast() -> void:
	toast = PanelContainer.new()
	var st = D.margins(D.box(D.SILK_3, D.CINNABAR, 1, 0.0, 2), 14, 8)
	st.shadow_color = Color(0.078, 0.055, 0.031, 0.3)
	st.shadow_size = 8
	toast.add_theme_stylebox_override("panel", st)
	_place(toast, 0.5, 1, 0.5, 1, -330, -94, 330, -94)
	toast.grow_horizontal = Control.GROW_DIRECTION_BOTH
	toast.grow_vertical = Control.GROW_DIRECTION_BEGIN
	toast.visible = false
	map_desk.add_child(toast)
	var row = HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	toast.add_child(row)
	status_label = Label.new()
	status_label.add_theme_color_override("font_color", D.CINNABAR)
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	status_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(status_label)
	toast_cancel = _btn("取消取点", func():
		pick = {}
		_set_status("")
		refresh())
	toast_cancel.visible = false
	row.add_child(toast_cancel)

func _build_replay_bar() -> void:
	replay_bar = PanelContainer.new()
	replay_bar.add_theme_stylebox_override("panel", D.margins(D.box(Color(D.LACQUER, 0.94), D.BRONZE, 1, 0.0, 2), 12, 6))
	_place(replay_bar, 0.5, 0, 0.5, 0, -320, 40, 320, 40)
	replay_bar.grow_horizontal = Control.GROW_DIRECTION_BOTH
	replay_bar.visible = false
	map_desk.add_child(replay_bar)
	var row = HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	replay_bar.add_child(row)
	replay_label = _text("", 13, D.ON_LACQUER)
	replay_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	replay_label.clip_text = true
	replay_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(replay_label)
	replay_pause_btn = _ghost(_btn("暂停", func():
		replay_paused = not replay_paused
		replay_pause_btn.text = "继续" if replay_paused else "暂停"))
	row.add_child(replay_pause_btn)
	for speed in [1.0, 4.0]:
		var playback_speed: float = speed
		row.add_child(_ghost(_btn("×%d" % int(speed), func(): _set_replay_speed(playback_speed))))
	row.add_child(_ghost(_btn("下一事件", func():
		replay_next_event = true
		replay_paused = false
		replay_pause_btn.text = "暂停")))
	row.add_child(_ghost(_btn("跳过回放", func(): replay_skip = true)))
	for b in row.get_children():
		if b is Button:
			b.add_theme_font_size_override("font_size", 13)

func _build_drawer() -> void:
	drawer = PanelContainer.new()
	var st = D.box(D.SILK, D.INK, 2, 6.0)
	st.shadow_color = Color(0.078, 0.055, 0.031, 0.45)
	st.shadow_size = 16
	st.shadow_offset = Vector2(0, 12)
	drawer.add_theme_stylebox_override("panel", st)
	_place(drawer, 0, 0, 0, 1, 14, 14, 14 + DRAWER_W, -14)
	drawer.visible = false
	# 装裱：2px 墨框内缩 3px 的 1px 铜线。
	drawer.draw.connect(func():
		drawer.draw_rect(Rect2(Vector2.ZERO, drawer.size).grow(-5.0), D.BRONZE, false, 1.0))
	map_desk.add_child(drawer)
	var col = VBoxContainer.new()
	col.add_theme_constant_override("separation", 0)
	drawer.add_child(col)
	# 顶部快切页签栏（对标网页版 `.drawer-tabs` F1..F6）
	var tab_bar = PanelContainer.new()
	var tbs = D.margins(D.box(D.LACQUER_2), 8, 4)
	tbs.border_color = D.BRONZE
	tbs.border_width_bottom = 1
	tab_bar.add_theme_stylebox_override("panel", tbs)
	col.add_child(tab_bar)
	var trow = HBoxContainer.new()
	trow.add_theme_constant_override("separation", 6)
	tab_bar.add_child(trow)
	var tab_specs := [
		["node", "F1 图籍 · 城邑"],
		["state", "F2 诏书 · 局势"],
		["states", "F3 符节 · 诸国"],
		["supply", "F4 仓廪 · 粮道"],
		["army", "F5 虎符 · 军务"],
		["log", "F6 史册 · 战报"],
	]
	for ts in tab_specs:
		var tkey: String = ts[0]
		var tb = _btn(ts[1], func(): _open_drawer(tkey))
		tb.add_theme_font_size_override("font_size", 12)
		tb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		trow.add_child(tb)
		drawer_tab_buttons[tkey] = tb
	# 页眉（silk_2，高 52）
	var head = PanelContainer.new()
	var hs = D.margins(D.box(D.SILK_2), 12, 0)
	hs.border_color = D.RULE
	hs.border_width_bottom = 1
	head.add_theme_stylebox_override("panel", hs)
	head.custom_minimum_size.y = 52
	col.add_child(head)
	var hrow = HBoxContainer.new()
	hrow.add_theme_constant_override("separation", 12)
	head.add_child(hrow)
	var seal = PanelContainer.new()
	seal.custom_minimum_size = Vector2(30, 30)
	seal.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	seal.add_theme_stylebox_override("panel", D.box(D.CINNABAR, D.CLEAR, 0, 0.0, 2))
	hrow.add_child(seal)
	drawer_seal = _text("城", 18, Color.WHITE)
	_kai(drawer_seal, 18)
	drawer_seal.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	drawer_seal.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	seal.add_child(drawer_seal)
	drawer_title = _text("", 21, INK)
	_kai(drawer_title, 21)
	drawer_title.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	hrow.add_child(drawer_title)
	drawer_sub = _text("", 12, MUTED)
	drawer_sub.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	drawer_sub.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	drawer_sub.clip_text = true
	hrow.add_child(drawer_sub)
	drawer_hint = _text("", 11, MUTED)
	drawer_hint.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	hrow.add_child(drawer_hint)
	var close = _btn("×", _close_drawer)
	close.tooltip_text = "收起（Esc）"
	close.custom_minimum_size = Vector2(30, 30)
	close.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	close.add_theme_font_size_override("font_size", 18)
	close.add_theme_stylebox_override("normal", D.box(D.CLEAR))
	hrow.add_child(close)
	# 正文（滚动）
	side_scroll = ScrollContainer.new()
	side_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	side_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_child(side_scroll)
	var pad = MarginContainer.new()
	pad.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for k in ["margin_left", "margin_right"]:
		pad.add_theme_constant_override(k, 18)
	pad.add_theme_constant_override("margin_top", 14)
	pad.add_theme_constant_override("margin_bottom", 18)
	side_scroll.add_child(pad)
	side = VBoxContainer.new()
	side.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	side.add_theme_constant_override("separation", 0)
	pad.add_child(side)
	for key in PAGE_ORDER:
		var p = VBoxContainer.new()
		p.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		p.add_theme_constant_override("separation", 9)
		p.visible = false
		side.add_child(p)
		pages[key] = p
	log_box = RichTextLabel.new()
	log_box.bbcode_enabled = true
	log_box.scroll_following = true
	log_box.selection_enabled = true
	log_box.custom_minimum_size = Vector2(0, 720)
	log_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	pages["log"].add_child(log_box)
	# 回放时遮住抽屉，禁止改令。
	side_blocker = Control.new()
	side_blocker.mouse_filter = Control.MOUSE_FILTER_STOP
	side_blocker.visible = false
	drawer.add_child(side_blocker)

# ---- 军情栏（右，宽 300）----
func _build_outliner() -> void:
	var ol = PanelContainer.new()
	var st = D.margins(D.box(D.SILK_2), 14, 12)
	st.border_color = D.LACQUER_LINE
	st.border_width_left = 1
	ol.add_theme_stylebox_override("panel", st)
	_place(ol, 1, 0, 1, 1, -SIDE_W, TOP_H, 0, -BAR_H)
	add_child(ol)
	var col = VBoxContainer.new()
	col.add_theme_constant_override("separation", 8)
	ol.add_child(col)
	col.add_child(_section_title("所选"))
	var card = PanelContainer.new()
	card.add_theme_stylebox_override("panel", D.box(D.SILK_3, D.CARD_EDGE, 1, 10.0))
	col.add_child(card)
	outliner_sel = VBoxContainer.new()
	outliner_sel.add_theme_constant_override("separation", 4)
	card.add_child(outliner_sel)
	col.add_child(_section_title("急报", "点击定位"))
	outliner_alerts = VBoxContainer.new()
	outliner_alerts.add_theme_constant_override("separation", 4)
	col.add_child(outliner_alerts)
	var oh = _section_title("本季军令")
	orders_title = oh.get_meta("label")
	col.add_child(oh)
	var sc = ScrollContainer.new()
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_child(sc)
	outliner_orders = VBoxContainer.new()
	outliner_orders.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	outliner_orders.add_theme_constant_override("separation", 4)
	sc.add_child(outliner_orders)
	outliner_blocker = Control.new()
	outliner_blocker.mouse_filter = Control.MOUSE_FILTER_STOP
	outliner_blocker.visible = false
	ol.add_child(outliner_blocker)

# ---- 案上器物（漆面，高 96）+ 用印 ----
func _build_desk_bar() -> void:
	var bar = Panel.new()
	var st = D.box(D.LACQUER)
	st.border_color = D.BRONZE
	st.border_width_top = 1
	bar.add_theme_stylebox_override("panel", st)
	_place(bar, 0, 1, 1, 1, 0, -BAR_H, 0, 0)
	add_child(bar)
	var props = HBoxContainer.new()
	props.add_theme_constant_override("separation", 10)
	_place(props, 0, 0, 1, 1, 14, 12, -SIDE_W - 6, -12)
	bar.add_child(props)
	for p in PROPS:
		props.add_child(_make_prop(p))
	end_btn = Button.new()
	end_btn.text = "结束本月"
	end_btn.focus_mode = Control.FOCUS_NONE
	_kai(end_btn, 24)
	var normal = D.box(D.CINNABAR, D.CLEAR, 0, 0.0, 2)
	normal.content_margin_bottom = 22
	var hover = D.box(D.CINNABAR_HI, D.CLEAR, 0, 0.0, 2)
	hover.content_margin_bottom = 22
	var pressed = D.box(Color("8e3122"), D.CLEAR, 0, 0.0, 2)
	pressed.content_margin_bottom = 22
	var disabled = D.box(Color(D.CINNABAR, 0.45), D.CLEAR, 0, 0.0, 2)
	disabled.content_margin_bottom = 22
	end_btn.add_theme_stylebox_override("normal", normal)
	end_btn.add_theme_stylebox_override("hover", hover)
	end_btn.add_theme_stylebox_override("pressed", pressed)
	end_btn.add_theme_stylebox_override("hover_pressed", pressed)
	end_btn.add_theme_stylebox_override("disabled", disabled)
	for k in ["font_color", "font_focus_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color"]:
		end_btn.add_theme_color_override(k, D.SILK)
	end_btn.add_theme_color_override("font_disabled_color", Color(D.SILK, 0.6))
	end_btn.tooltip_text = "用印：提交本回合命令并结算（Space）"
	_place(end_btn, 1, 0, 1, 1, -SIDE_W + 8, 10, -14, -10)
	end_btn.pressed.connect(end_turn)
	# 用印：内缩 4px 的 1px bronze_hi 线。
	end_btn.draw.connect(func():
		end_btn.draw_rect(Rect2(Vector2.ZERO, end_btn.size).grow(-4.0), D.BRONZE_HI, false, 1.0))
	bar.add_child(end_btn)
	end_sub = _text("Space · 已拟 0 令", 12, Color(D.SILK, 0.85))
	end_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	end_sub.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_place(end_sub, 0, 1, 1, 1, 0, -30, 0, -10)
	end_btn.add_child(end_sub)

func _make_prop(p: Dictionary) -> Button:
	var b = Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(0, 72)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.tooltip_text = "%s · %s" % [p["name"], p["act"]]
	var row = HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	b.add_child(row)
	row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	row.offset_left = 12
	row.offset_right = -6
	var icon = TextureRect.new()
	icon.texture = _icon(p["icon"])
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.custom_minimum_size = Vector2(34, 34)
	icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(icon)
	var texts = VBoxContainer.new()
	texts.add_theme_constant_override("separation", 0)
	texts.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	texts.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(texts)
	var nm = _text(p["name"], 18, INK)
	_kai(nm, 18)
	texts.add_child(nm)
	var act = _text(p["act"], 12, MUTED)
	act.clip_text = true
	texts.add_child(act)
	_ignore_mouse(row)
	var key: String = p["key"]
	if key == "speed":
		b.pressed.connect(func(): _set_replay_speed(1.0 if replay_speed >= 4.0 else 4.0))
	else:
		b.pressed.connect(func(): _toggle_drawer(key))
	prop_buttons[key] = {"button": b, "name": nm, "act": act, "icon": icon, "spec": p}
	return b

func _prop_style(open: bool, hover: bool) -> StyleBoxFlat:
	if open:
		return D.box(D.SILK_2, D.CINNABAR, 2)
	return D.box(D.SILK, D.CINNABAR if hover else D.RULE, 1)

func _refresh_props() -> void:
	for key in prop_buttons:
		var e: Dictionary = prop_buttons[key]
		var b: Button = e["button"]
		var open: bool = key == drawer_key
		b.add_theme_stylebox_override("normal", _prop_style(open, false))
		b.add_theme_stylebox_override("hover", _prop_style(open, true))
		b.add_theme_stylebox_override("pressed", _prop_style(true, true))
		b.add_theme_stylebox_override("hover_pressed", _prop_style(true, true))
		b.add_theme_stylebox_override("disabled", _prop_style(false, false))
		var spec: Dictionary = e["spec"]
		var nm: Label = e["name"]
		nm.add_theme_color_override("font_color", D.CINNABAR if open else INK)
		if spec.has("name_xn"):
			nm.text = spec["name_xn"] if player == "xiongnu" else spec["name"]
			e["icon"].texture = _icon(spec["icon_xn"] if player == "xiongnu" else spec["icon"])
		if key == "speed":
			e["act"].text = "回放 ×%d · 点按切换" % int(replay_speed)

func _set_replay_speed(v: float) -> void:
	replay_speed = v
	_refresh_props()

func _focus_selected() -> void:
	if state == null:
		return
	if sel_army != "" and state.armies.has(sel_army):
		map_view.center_on(map_view.army_world_position(state.armies[sel_army], state.armies), 1.6)
		return
	var target := sel_node
	if target == "" or not state.nodes.has(target):
		target = "dun_huang" if player == "han" else "youxian_wang"
	if state.nodes.has(target):
		map_view.center_on(map_view.node_world_pos(target), 1.6)

# ---- 抽屉 ----
func _toggle_drawer(key: String) -> void:
	if drawer_key == key:
		_close_drawer()
	else:
		_open_drawer(key)

func _open_drawer(key: String) -> void:
	drawer_key = key
	_refresh_drawer_frame()
	_refresh_props()
	side_scroll.scroll_vertical = 0

func _close_drawer() -> void:
	drawer_key = ""
	_refresh_drawer_frame()
	_refresh_props()

func _refresh_drawer_frame() -> void:
	for key in pages:
		pages[key].visible = key == drawer_key
	drawer.visible = drawer_key != ""
	if map_inspector_card != null:
		map_inspector_card.visible = (drawer_key == "" and sel_node != "" and state != null and state.nodes.has(sel_node))
	for tkey in drawer_tab_buttons:
		var tb: Button = drawer_tab_buttons[tkey]
		var active: bool = (tkey == drawer_key)
		if active:
			tb.add_theme_stylebox_override("normal", D.margins(D.box(D.SILK, D.CINNABAR, 1, 0.0, 2), 8, 3))
			tb.add_theme_color_override("font_color", D.CINNABAR)
		else:
			tb.add_theme_stylebox_override("normal", D.margins(D.box(Color(D.LACQUER, 0.55), D.LACQUER_LINE, 1, 0.0, 2), 8, 3))
			tb.add_theme_color_override("font_color", D.ON_LACQUER_MUTED)
	if drawer_key == "":
		return
	var meta: Array = DRAWERS[drawer_key]
	drawer_seal.text = meta[0]
	drawer_title.text = meta[1]
	drawer_hint.text = "%s 开合 · Esc 收起" % meta[2]
	drawer_sub.text = _drawer_subtitle(drawer_key) if state != null else ""
	drawer.queue_redraw()

func _drawer_subtitle(key: String) -> String:
	var unit := "季" if decision_ticks == 9 else "月"
	match key:
		"node":
			if sel_node != "" and state.nodes.has(sel_node):
				return "%s · %s" % [state.nodes[sel_node]["name"], _ctl_text(state.nodes[sel_node])]
			return "未选城邑 · 点击舆图上的城邑"
		"state":
			return "胜负进度 · 国力 · 本%s命令" % unit
		"states":
			return "西域诸国总览 · 点击一行定位城邑"
		"supply":
			if player == "han" and sel_node != "" and state.nodes.has(sel_node) and state.is_supply_node(state.nodes[sel_node], "han"):
				return "运输队 · 各军携粮 · 自%s发运" % state.nodes[sel_node]["name"]
			return "运输队 · 各军携粮"
		"army":
			if sel_army != "" and state.armies.has(sel_army):
				return "%s · 作战计划与粮秣预演" % state.armies[sel_army]["name"]
			return "未选军队 · 点击舆图上的军旗"
		"log":
			return "本局事件流"
	return ""

func _input(ev: InputEvent) -> void:
	var key_ev := ev as InputEventKey
	if key_ev == null or not key_ev.pressed or key_ev.echo:
		return
	var k: int = key_ev.keycode
	if HOTKEYS.has(k):
		_toggle_drawer(HOTKEYS[k])
	elif k == KEY_ESCAPE:
		if not pick.is_empty():
			pick = {}
			_set_status("已取消选点。")
		elif newgame_panel.visible:
			newgame_panel.visible = false
		elif layer_panel.visible:
			layer_panel.visible = false
		elif drawer_key != "":
			_close_drawer()
		else:
			return
	elif k == KEY_SPACE:
		var focus = get_viewport().gui_get_focus_owner()
		if focus is LineEdit or focus is TextEdit:
			return
		if not end_btn.disabled and not replaying:
			call_deferred("end_turn")
	else:
		return
	get_viewport().set_input_as_handled()

# ---- 通用小部件 ----
func _section_title(t: String, note := "") -> VBoxContainer:
	var v = VBoxContainer.new()
	v.add_theme_constant_override("separation", 3)
	var h = HBoxContainer.new()
	var l = _text(t, 16, INK)
	_kai(l, 16)
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(l)
	if note != "":
		var n = _text(note, 12, MUTED)
		n.size_flags_vertical = Control.SIZE_SHRINK_END
		h.add_child(n)
	v.add_child(h)
	var rule = ColorRect.new()
	rule.color = D.RULE
	rule.custom_minimum_size = Vector2(0, 1)
	rule.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(rule)
	v.set_meta("label", l)
	return v

func _summary_banner(t: String) -> PanelContainer:
	var p = PanelContainer.new()
	p.add_theme_stylebox_override("panel", D.make_summary_banner_box())
	var l = _text(t, 12, D.INK_2)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(DRAWER_LABEL_W, 0)
	p.add_child(l)
	return p

func _kpi_card(label: String, value: String, sub := "", tone := "", explain_key := "") -> PanelContainer:
	var p = PanelContainer.new()
	p.add_theme_stylebox_override("panel", D.make_kpi_card_box(tone))
	p.custom_minimum_size = Vector2(138, 0)
	p.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var v = VBoxContainer.new()
	v.add_theme_constant_override("separation", 1)
	var top_h = HBoxContainer.new()
	var lbl = _text(label, 11, MUTED)
	lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top_h.add_child(lbl)
	if explain_key != "":
		top_h.add_child(_text("因果", 10, D.BRONZE))
		p.mouse_filter = Control.MOUSE_FILTER_STOP
		p.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		var ek := explain_key
		p.gui_input.connect(func(ev: InputEvent):
			if ev is InputEventMouseButton and ev.button_index == MOUSE_BUTTON_LEFT and ev.pressed:
				_explain_metric(ek))
	v.add_child(top_h)
	var val_col := INK
	if tone == "good":
		val_col = D.JADE
	elif tone == "warn":
		val_col = D.AMBER
	elif tone == "bad":
		val_col = D.CINNABAR
	elif tone == "info":
		val_col = D.COBALT
	var val_lbl = _text(value, 18, val_col)
	_kai(val_lbl, 18)
	v.add_child(val_lbl)
	if sub != "":
		v.add_child(_text(sub, 11, MUTED))
	p.add_child(v)
	return p

func _waterfall_row(label: String, val_text: String, ratio: float, positive := true) -> Control:
	var h = HBoxContainer.new()
	h.add_theme_constant_override("separation", 10)
	var l = _text(label, 12, D.INK_2)
	l.custom_minimum_size = Vector2(210, 0)
	h.add_child(l)
	var pb = ProgressBar.new()
	pb.max_value = 100.0
	pb.value = clampf(ratio * 100.0, 2.0, 100.0)
	pb.show_percentage = false
	pb.custom_minimum_size = Vector2(220, 7)
	pb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	pb.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var fill = StyleBoxFlat.new()
	fill.bg_color = D.JADE if positive else D.CINNABAR
	pb.add_theme_stylebox_override("fill", fill)
	h.add_child(pb)
	var r = _text(val_text, 12, D.JADE if positive else D.CINNABAR)
	r.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	r.custom_minimum_size = Vector2(96, 0)
	h.add_child(r)
	return h

func _kpi(label: String, value: String, col := INK) -> PanelContainer:
	var tone := "bad" if col == RED else ""
	return _kpi_card(label, value, "", tone, "")

func _kpi_row(cards: Array) -> HFlowContainer:
	var h = HFlowContainer.new()
	h.add_theme_constant_override("h_separation", 8)
	h.add_theme_constant_override("v_separation", 8)
	for c in cards:
		h.add_child(c)
	return h

## 表格行：cells 为文本或 [文本, 颜色]；cb 为 null 则作为表头。
func _table_row(cells: Array, widths: Array, cb: Variant = null) -> Control:
	var header: bool = not (cb is Callable)
	var h = HBoxContainer.new()
	h.add_theme_constant_override("separation", 0)
	for i in cells.size():
		var cell = cells[i]
		var txt: String = cell[0] if cell is Array else str(cell)
		var l = _text(txt, 12 if header else 13, MUTED if header else INK)
		if cell is Array:
			l.add_theme_color_override("font_color", cell[1])
		l.custom_minimum_size = Vector2(widths[i], 0)
		l.clip_text = true
		l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		h.add_child(l)
	if header:
		var head = PanelContainer.new()
		var hs = D.margins(D.box(D.SILK_2), 8, 4)
		hs.border_color = D.RULE
		hs.border_width_bottom = 1
		head.add_theme_stylebox_override("panel", hs)
		head.add_child(h)
		return head
	var b = Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(0, 30)
	var normal = D.box(D.CLEAR)
	normal.border_color = D.CARD_EDGE
	normal.border_width_bottom = 1
	var hover = D.box(D.SILK_3)
	hover.border_color = D.CINNABAR
	hover.border_width_bottom = 1
	b.add_theme_stylebox_override("normal", normal)
	b.add_theme_stylebox_override("hover", hover)
	b.add_theme_stylebox_override("pressed", hover)
	b.add_child(h)
	h.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	h.offset_left = 8
	_ignore_mouse(h)
	b.pressed.connect(cb)
	return b

# ---------------- 局面 ----------------
func new_game(f: String, dt: int, seed_value := -1) -> void:
	if replaying:
		return
	state = GS.new()
	state.load_scenario("res://data/scenario_mvp.json", seed_value if seed_value >= 0 else int(Time.get_unix_time_from_system()) % 100000, dt)
	state.player_faction = f
	player = f
	decision_ticks = dt
	faction_option.select(0 if f == "han" else 1)
	interval_option.select(1 if dt == 9 else 0)
	ai_han = HanAI.new()
	ai_xn = XnAI.new()
	orders.clear()
	drafts.clear()
	pick = {}
	sel_node = "dun_huang" if f == "han" else "youxian_wang"
	sel_army = ""
	locked_causal_keys.clear()
	transient_causal_key = ""
	metric_history = {"money": [], "military": [], "victory": [], "grain": []}
	_record_metrics()
	map_view.state = state
	map_view.fit()
	log_box.clear()
	_log("[b]西域策略 · 前119年[/b]　你执【%s】。点击地图上的城市或军队开始。红色军旗为汉军，棕色为匈奴；金色粗线是畅通的商路。" % state.factions[f]["name"])
	_log("目标：" + _goal_text())
	_log("城市颜色：独立国家各有本国色，同国城市同色；浅红为汉属国、浅棕为匈奴属国，直接占领为宗主国深色。")
	_log("[color=#85745e]案上器物或 F1–F6 打开抽屉，Esc 收起；Space 用印结束本回合。[/color]")
	refresh()

func _goal_text() -> String:
	if player == "han":
		return "18 个西域城邦中 ≥11 个成为汉属国（含乌垒、车师前），维持 12 个月 → 设立西域都护府"
	return "同时占领武威、张掖、酒泉、敦煌，维持 6 个月 → 夺回河西四郡"

func save_game() -> void:
	if replaying:
		return
	var f = FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	f.store_string(state.to_save())
	_set_status("已存档。")

func load_game() -> void:
	if replaying:
		return
	if not FileAccess.file_exists(SAVE_PATH):
		_set_status("没有存档。")
		return
	var s = GS.new()
	if s.from_save(FileAccess.get_file_as_string(SAVE_PATH)):
		state = s
		player = state.player_faction
		decision_ticks = state.decision_ticks
		faction_option.select(0 if player == "han" else 1)
		interval_option.select(1 if decision_ticks == 9 else 0)
		map_view.state = state
		orders.clear()
		drafts.clear()
		pick = {}
		refresh()
		_set_status("已读档。")

func _set_blocked(on: bool) -> void:
	side_blocker.visible = on
	outliner_blocker.visible = on
	side.mouse_filter = Control.MOUSE_FILTER_IGNORE if on else Control.MOUSE_FILTER_PASS
	side_scroll.mouse_filter = Control.MOUSE_FILTER_IGNORE if on else Control.MOUSE_FILTER_STOP
	for control in replay_controls:
		control.disabled = on

func end_turn() -> void:
	if state.winner != "" or replaying:
		return
	var all = {player: orders.duplicate()}
	state.decision_ticks = decision_ticks
	if player == "han":
		all["xiongnu"] = ai_xn.think(state)
	else:
		all["han"] = ai_han.think(state)
	var head = "[color=#7a5a28][b]—— %s ——[/b][/color]" % state.date_text()
	var replay_state = GS.new()
	replay_state.from_save(state.to_save())
	replaying = true
	newgame_panel.visible = false
	_set_blocked(true)
	var res = TR.resolve(state, all, true)
	_log(head)
	map_view.flash.clear()
	# 即时命令先展示；每日事件随回放展示。
	var day_event_count := 0
	for frame in res["frames"]:
		day_event_count += frame["events"].size()
	for e in res["events"].slice(0, res["events"].size() - day_event_count):
		_log_event(e)
	await _play_days(replay_state, res["frames"])
	for r in res["rejected"]:
		if r["cmd"]["faction"] == player:
			_log("[color=#85745e]命令未执行：%s（%s）[/color]" % [r["cmd"]["type"], r["why"]])
	orders.clear()
	drafts.clear()
	pick = {}
	replaying = false
	_set_blocked(false)
	_record_metrics()
	_set_status("回合结算完成。")
	refresh()
	if state.winner != "":
		var dlg = AcceptDialog.new()
		dlg.title = "对局结束"
		dlg.dialog_text = "%s 获胜：%s" % [state.factions[state.winner]["name"], state.win_reason] + ("\n你赢了！" if state.winner == player else "\n你败了。")
		add_child(dlg)
		dlg.popup_centered()

func _play_days(replay_state, frames: Array) -> void:
	map_view.state = replay_state
	replay_bar.visible = true
	replay_paused = false
	replay_skip = false
	replay_next_event = false
	replay_pause_btn.text = "暂停"
	var day_index := 0
	for frame in frames:
		day_index += 1
		map_view.show_day(frame)
		replay_label.text = "%s · 第 %d/%d 天 · 双方同时行动" % [frame["date"], day_index, frames.size()]
		for e in frame["events"]:
			_log_event(e)
		var reached_event: bool = not frame["events"].is_empty()
		var stop_at_event: bool = replay_next_event and reached_event
		if stop_at_event:
			map_view.replay_progress = 1.0
			map_view.queue_redraw()
			replay_next_event = false
			replay_paused = true
			replay_pause_btn.text = "继续"
		var elapsed := 0.12 if stop_at_event else 0.0
		while (elapsed < 0.12 or replay_paused) and not replay_skip and not replay_next_event:
			await get_tree().process_frame
			if not replay_paused:
				elapsed += get_process_delta_time() * replay_speed
				map_view.replay_progress = minf(elapsed / 0.12, 1.0)
				map_view.queue_redraw()
		map_view.replay_progress = 1.0
		if replay_skip or replay_next_event:
			# 快进时仍让出主线程，确保按键和地图及时响应。
			await get_tree().process_frame
	map_view.replay_from.clear()
	map_view.state = state
	map_view.queue_redraw()
	replay_bar.visible = false


func _log(t: String) -> void:
	log_box.append_text(t + "\n")

func _log_event(e: Dictionary) -> void:
	var col := "#2b2119"
	match e["kind"]:
		"battle":
			col = "#a33a2a"
			var w: String = e["report"]["where"]
			if state.nodes.has(w):
				map_view.flash[w] = 90
		"capture":
			col = "#a33a2a"
			map_view.flash[e["node"]] = 120
		"defect":
			col = "#3e6b5a"
		"diplomacy":
			col = "#6b4a7a"
		"trigger", "evade":
			col = "#3e6b5a"
		"starve", "rout", "convoy":
			col = "#8f621f"
		"victory":
			col = "#a33a2a"
		"ai":
			col = "#85745e"
	_log("[color=%s]%s　%s[/color]" % [col, e["date"], e["text"]])

func _set_status(t: String) -> void:
	status_label.text = t
	toast.visible = t != ""
	toast_cancel.visible = not pick.is_empty()
	if t != "" and pick.is_empty() and status_timer.is_inside_tree():
		status_timer.start(4.0)

# ---------------- 交互 ----------------
func _on_node_clicked(id: String) -> void:
	if replaying:
		return
	if not pick.is_empty():
		_resolve_pick(id)
		return
	sel_node = id
	map_view.selected_node = id
	# 未开抽屉或正看城邑时打开城邑抽屉；其余抽屉保持不动（例如在军务中点选城邑）。
	if drawer_key == "" or drawer_key == "node":
		drawer_key = "node"
	refresh()

func _on_army_clicked(id: String) -> void:
	if replaying:
		return
	if not pick.is_empty():
		var a = state.armies[id]
		_resolve_pick(a["loc"]["node"] if a["loc"].has("node") else a["loc"]["to"])
		return
	sel_army = id
	map_view.selected_army = id
	var a2 = state.armies[id]
	if a2["loc"].has("node"):
		sel_node = a2["loc"]["node"]
		map_view.selected_node = sel_node
	drawer_key = "army"
	refresh()
	side_scroll.scroll_vertical = 0

func _select_node(id: String, open_node_drawer := false) -> void:
	if replaying or not state.nodes.has(id):
		return
	sel_node = id
	map_view.selected_node = id
	if open_node_drawer:
		drawer_key = "node"
	refresh()
	if open_node_drawer:
		side_scroll.scroll_vertical = 0

func _select_army(id: String) -> void:
	if replaying or not state.armies.has(id):
		return
	_on_army_clicked(id)

func _start_pick(p: Dictionary, hint: String) -> void:
	if pick == p:
		pick = {}
		_set_status("已取消选点。")
		return
	pick = p
	_set_status("▶ " + hint + "（点击地图上的节点；再次点击同一按钮或按 Esc 取消）")

func _resolve_pick(node_id: String) -> void:
	var p = pick
	pick = {}
	_set_status("")
	match p["kind"]:
		"step":
			var a = state.armies.get(p["army"])
			if a == null:
				return
			var st: Dictionary = {"type": p["type"], "node": node_id}
			if p["type"] == "siege":
				st["max_months"] = 3
				st["assault_when"] = 0.5
			elif p["type"] == "ambush":
				st["route"] = state.adj[node_id][0]
				st["months"] = 2
			elif p["type"] == "hold":
				st["until"] = "end"
			_append_step(a, st)
		"convoy_to":
			convoy["to"] = node_id
	refresh()

func _append_step(a: Dictionary, step: Dictionary) -> void:
	var d = _draft(a)
	# 新行动接替已有的无限驻守命令；计时驻守仍保留为计划步骤。
	if not d["steps"].is_empty() and not a["plan"]["steps"].is_empty():
		var last: Dictionary = d["steps"].back()
		if last["type"] == "hold" and last.get("until", "") == "end" and last == a["plan"]["steps"].back():
			d["steps"].pop_back()
	d["steps"].append(step)


func _draft(a: Dictionary) -> Dictionary:
	if not drafts.has(a["id"]):
		var steps = []
		for s in a["plan"]["steps"]:
			steps.append(s.duplicate(true))
		drafts[a["id"]] = {"steps": steps, "preset": a["plan"]["preset"] if a["plan"]["preset"] != "retreat" else "balanced"}
	return drafts[a["id"]]

func queue(c: Dictionary) -> void:
	if replaying:
		return
	if c["faction"] != player:
		_set_status("只能指挥己方。")
		return
	var why = Cmd.validate(state, c)
	if why != "":
		_set_status("无法执行：" + why)
		return
	# 一支军队只保留最终提交的计划，避免随机结算旧计划覆盖新计划。
	if c["type"] == "set_plan":
		orders = orders.filter(func(old): return old["type"] != "set_plan" or old["army"] != c["army"])
	orders.append(c.duplicate(true))
	_set_status("已加入本回合命令（%d 条）。用印（Space）结算。" % orders.size())
	refresh()

# ---------------- 刷新 ----------------
func refresh() -> void:
	if sel_army != "" and not state.armies.has(sel_army):
		sel_army = ""
	_refresh_top()
	_refresh_pages()
	_refresh_outliner()
	_refresh_drawer_frame()
	_refresh_map_inspector()
	_refresh_causal_stack()
	_refresh_props()
	map_view.selected_node = sel_node
	map_view.selected_army = sel_army
	map_view.preview_path = _preview_path()
	map_view.queue_redraw()
	if state.winner != "":
		end_btn.text = "对局结束"
	else:
		end_btn.text = "结束本季" if decision_ticks == 9 else "结束本月"
	end_sub.text = "Space · 已拟 %d 令" % orders.size()

func _record_metrics() -> void:
	if state == null:
		return
	var f: Dictionary = state.factions[player]
	var soldiers := 0
	for aid in state.armies:
		var a: Dictionary = state.armies[aid]
		if a["faction"] == player and not a["is_convoy"]:
			soldiers += state.army_size(a)
	var tot_grain := 0.0
	for nid in state.nodes:
		var n: Dictionary = state.nodes[nid]
		if state.controller(n) == player:
			tot_grain += float(n["grain"])
	if not metric_history.has("money"):
		metric_history = {"money": [], "military": [], "victory": [], "grain": []}
	metric_history["money"].append(float(f["money"]))
	metric_history["military"].append(float(soldiers))
	metric_history["victory"].append(Victory.objective_progress(state, player) * 100.0)
	metric_history["grain"].append(tot_grain)

func _explain_metric(key: String) -> void:
	if key == "":
		return
	if transient_causal_key == key and not locked_causal_keys.has(key):
		transient_causal_key = ""
	elif not locked_causal_keys.has(key):
		transient_causal_key = key
	_refresh_causal_stack()

func _causal_payload(key: String) -> Dictionary:
	var f: Dictionary = state.factions[player]
	var han := (player == "han")
	if key == "money":
		return {
			"title": "少府与国库收支 (Treasury)" if han else "单于庭赏赐金帛 (Tribute)",
			"val": "%d 钱" % int(f["money"]),
			"status": "岁入充盈" if f["money"] >= 1500 else "岁计趋紧",
			"rows": [
				["大司农/王庭岁拨基数" if han else "属国岁贡金帛", "+600", true],
				["畅通丝路商税分润", "+%d" % (_vassal_count(player) * 40), true],
				["使团赏赐与购粮屯田支出", "-%d" % (orders.size() * 150), false],
			],
			"series": metric_history.get("money", [float(f["money"])]),
		}
	elif key == "military":
		var soldiers := 0
		for aid in state.armies:
			var a: Dictionary = state.armies[aid]
			if a["faction"] == player and not a["is_convoy"]:
				soldiers += state.army_size(a)
		return {
			"title": "塞外野战军与中央军池 (Forces)",
			"val": "%s 人" % _fmt(soldiers),
			"status": "兵威鼎盛" if soldiers >= 8000 else "宜增募边骑",
			"rows": [
				["在册野战主力编制", "+%s" % _fmt(soldiers), true],
				["中央军后备池可调兵额" if han else "控弦牧民后备骑兵", "+%s" % _fmt(state.central.get("infantry", 0) + state.central.get("cavalry", 0)), true],
				["远征行军与围城折损", "-120/月", false],
			],
			"series": metric_history.get("military", [float(soldiers)]),
		}
	elif key == "grain":
		var tot_grain := 0.0
		for nid in state.nodes:
			var n: Dictionary = state.nodes[nid]
			if state.controller(n) == player:
				tot_grain += float(n["grain"])
		return {
			"title": "全境官仓与军屯储粮 (Granaries)",
			"val": "%s 斛" % _fmt(tot_grain),
			"status": "仓廪充实" if tot_grain >= 300000.0 else "前线需转运",
			"rows": [
				["河西与属国夏秋入仓", "+4.2万", true],
				["塞外屯田民岁产粟米", "+1.8万", true],
				["野战军与转运民夫坐食", "-2.6万", false],
			],
			"series": metric_history.get("grain", [tot_grain]),
		}
	return {
		"title": "西域都护府设立进度" if han else "河西四郡收复进度",
		"val": "%.0f%%" % (Victory.objective_progress(state, player) * 100.0),
		"status": _victory_text(player),
		"rows": [
			["已内附属国（需满11国）" if han else "已控河西郡城（需满4郡）", "%d 国" % _vassal_count("han") if han else "%d 郡" % Victory.hexi_held_by_xn(state), true],
			["乌垒与车师前锁钥控制", "✓ 已控" if (state.relations["wu_lei"]["overlord"] == "han" and state.relations["cheshi_qian"]["overlord"] == "han") else "待招抚", state.relations["wu_lei"]["overlord"] == "han"],
			["达标连续维持月数", "%d 月" % state.streak[player], true],
		],
		"series": metric_history.get("victory", [Victory.objective_progress(state, player) * 100.0]),
	}

func _refresh_causal_stack() -> void:
	if causal_stack_box == null or state == null:
		return
	_clear(causal_stack_box)
	var keys: Array = locked_causal_keys.duplicate()
	if transient_causal_key != "" and not keys.has(transient_causal_key):
		keys.append(transient_causal_key)
	for k in keys:
		var key: String = k
		var is_locked: bool = locked_causal_keys.has(key)
		var data := _causal_payload(key)
		var card = PanelContainer.new()
		card.add_theme_stylebox_override("panel", D.make_causal_card_box(is_locked))
		var v = VBoxContainer.new()
		v.add_theme_constant_override("separation", 4)
		card.add_child(v)
		var hdr = HBoxContainer.new()
		var t_lbl = _text(data["title"], 13, INK)
		_kai(t_lbl, 13)
		t_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		hdr.add_child(t_lbl)
		var pin_btn = _btn("已锁定 📌" if is_locked else "锁定", func():
			if locked_causal_keys.has(key):
				locked_causal_keys.erase(key)
			else:
				if locked_causal_keys.size() >= 3:
					locked_causal_keys.pop_front()
				locked_causal_keys.append(key)
				if transient_causal_key == key:
					transient_causal_key = ""
			_refresh_causal_stack())
		pin_btn.add_theme_font_size_override("font_size", 11)
		hdr.add_child(pin_btn)
		var cls_btn = _btn("×", func():
			locked_causal_keys.erase(key)
			if transient_causal_key == key:
				transient_causal_key = ""
			_refresh_causal_stack())
		cls_btn.add_theme_font_size_override("font_size", 12)
		hdr.add_child(cls_btn)
		v.add_child(hdr)
		var val_row = HBoxContainer.new()
		var v_lbl = _text(data["val"], 18, D.CINNABAR)
		_kai(v_lbl, 18)
		v_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		val_row.add_child(v_lbl)
		val_row.add_child(_text(data["status"], 11, MUTED))
		v.add_child(val_row)
		for r in data["rows"]:
			var rh = HBoxContainer.new()
			var rl = _text(r[0], 11, D.INK_2)
			rl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			rh.add_child(rl)
			rh.add_child(_text(r[1], 11, D.JADE if r[2] else D.CINNABAR))
			v.add_child(rh)
		# 趋势折线图 (Sparkline)
		var spark = Control.new()
		spark.custom_minimum_size = Vector2(280, 44)
		var series: Array = data["series"]
		spark.draw.connect(func():
			var sr := Rect2(Vector2.ZERO, spark.size)
			spark.draw_rect(sr, Color(D.SILK_2, 0.55))
			spark.draw_rect(sr, D.CARD_EDGE, false, 1.0)
			var pts: Array = series.duplicate()
			if pts.size() == 1:
				pts = [pts[0] * 0.94, pts[0] * 0.98, pts[0]]
			var mn := float(pts[0])
			var mx := float(pts[0])
			for val in pts:
				mn = minf(mn, float(val))
				mx = maxf(mx, float(val))
			if absf(mx - mn) < 0.01:
				mx = mn + 1.0
			var line_pts := PackedVector2Array()
			for i in pts.size():
				var px := 6.0 + (sr.size.x - 12.0) * (float(i) / float(maxi(1, pts.size() - 1)))
				var py := sr.size.y - 6.0 - (sr.size.y - 12.0) * ((float(pts[i]) - mn) / (mx - mn))
				line_pts.append(Vector2(px, py))
			if line_pts.size() >= 2:
				spark.draw_polyline(line_pts, D.COBALT, 1.8, true)
				spark.draw_circle(line_pts[line_pts.size() - 1], 3.0, D.CINNABAR))
		v.add_child(spark)
		causal_stack_box.add_child(card)

func _refresh_map_inspector() -> void:
	if map_inspector_body == null or state == null:
		return
	_clear(map_inspector_body)
	if drawer_key != "" or sel_node == "" or not state.nodes.has(sel_node):
		map_inspector_card.visible = false
		return
	map_inspector_card.visible = true
	var n: Dictionary = state.nodes[sel_node]
	var hdr = HBoxContainer.new()
	var title = _text("● " + n["name"], 15, INK)
	_kai(title, 15)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hdr.add_child(title)
	hdr.add_child(_text(_ctl_text(n), 11, MUTED))
	map_inspector_body.add_child(hdr)
	if n["type"] != "junction":
		var g = GridContainer.new()
		g.columns = 4
		g.add_theme_constant_override("h_separation", 8)
		for pair in [["人口", _fmt(n["pop"])], ["存粮", _fmt(n["grain"])], ["城墙", "%d" % int(n["wall_hp"])], ["屯田", _fmt(n["colonies"])]]:
			var box = VBoxContainer.new()
			box.add_child(_text(pair[0], 10, MUTED))
			box.add_child(_text(pair[1], 12, INK))
			g.add_child(box)
		map_inspector_body.add_child(g)
	var sid: String = n["faction"]
	if state.relations.has(sid):
		var rel: Dictionary = state.relations[sid]
		map_inspector_body.add_child(_bar("汉影响", rel["han_influence"], 100, D.CINNABAR))
		map_inspector_body.add_child(_bar("匈威吓", rel["xn_intimidation"], 100, D.XN))
	var acts = HBoxContainer.new()
	acts.add_theme_constant_override("separation", 6)
	var b1 = _primary(_btn("展开图籍 F1", func(): _open_drawer("node")))
	b1.add_theme_font_size_override("font_size", 12)
	b1.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	acts.add_child(b1)
	var b2 = _btn("粮道 F4", func(): _open_drawer("supply"))
	b2.add_theme_font_size_override("font_size", 12)
	acts.add_child(b2)
	map_inspector_body.add_child(acts)

func _fmt(n: float) -> String:
	if absf(n) >= 100000.0:
		return "%.1f万" % (n / 10000.0)
	if absf(n) >= 10000.0:
		return "%.2f万" % (n / 10000.0)
	return str(int(n))

func _victory_text(f: String) -> String:
	if f == "han":
		return "属国 %d/11　乌垒%s 车师前%s　连续 %d/12 月" % [Victory.han_vassals(state), "✓" if state.relations["wu_lei"]["overlord"] == "han" else "✗", "✓" if state.relations["cheshi_qian"]["overlord"] == "han" else "✗", state.streak["han"]]
	return "河西四郡 %d/4　连续 %d/6 月" % [Victory.hexi_held_by_xn(state), state.streak["xiongnu"]]

func _vassal_count(f: String) -> int:
	var n := 0
	for sid in state.relations:
		if state.relations[sid]["overlord"] == f:
			n += 1
	return n

func _refresh_top() -> void:
	var f: Dictionary = state.factions[player]
	var han := player == "han"
	top_seal.text = "汉" if han else "匈"
	top_seal_panel.add_theme_stylebox_override("panel", D.box(D.CINNABAR if han else D.XN, D.BRONZE, 1, 0.0, 2))
	top_leader.text = "汉武帝 · 刘彻" if han else "伊稚斜单于"
	top_sub.text = "前119年剧本 · %s · %s" % [f["name"], "季制" if decision_ticks == 9 else "月制"]
	var m: Array = []
	m.append(["国库", "%d 钱" % f["money"], "可用于赏赐、购粮、屯田与征召"])
	if han:
		m.append(["中央军池", "步%s 弩%s 骑%s" % [_fmt(state.central.get("infantry", 0)), _fmt(state.central.get("crossbow", 0)), _fmt(state.central.get("cavalry", 0))], "可在郡城征召的中央军"])
		m.append(["都护进度", "属国 %d/11 · %d/12月" % [Victory.han_vassals(state), state.streak["han"]], _victory_text("han")])
	else:
		m.append(["属国", "%d 国" % _vassal_count("xiongnu"), "臣服匈奴的城邦（可征税、征兵）"])
		m.append(["河西进度", "%d/4 郡 · %d/6月" % [Victory.hexi_held_by_xn(state), state.streak["xiongnu"]], _victory_text("xiongnu")])
	for i in top_metrics.size():
		top_metrics[i][0].text = m[i][0]
		top_metrics[i][1].text = m[i][1]
		top_metrics[i][1].tooltip_text = m[i][2]
	top_date.text = state.date_text()
	if state.is_winter():
		top_season.text = "%s季 · 山道封闭" % Cal.season_cn(state.season())
		top_season.add_theme_color_override("font_color", D.BRONZE_HI)
	else:
		top_season.text = "%s季" % Cal.season_cn(state.season())
		top_season.add_theme_color_override("font_color", D.ON_LACQUER_MUTED)

func _preview_path() -> Array:
	if sel_army == "" or not state.armies.has(sel_army):
		return []
	var a = state.armies[sel_army]
	var cur: String = a["loc"]["node"] if a["loc"].has("node") else a["loc"]["to"]
	var steps: Array = _draft(a)["steps"] if drafts.has(sel_army) else a["plan"]["steps"]
	var path = [cur]
	for s in steps:
		var tgt: String = s.get("node", s.get("to", ""))
		if tgt == "" or tgt == cur:
			continue
		var seg = Path.path_to(state, cur, tgt, Combat.army_speed(state, a), {}, true)
		path.append_array(seg)
		cur = tgt
	return path

# ---------------- 军情栏 ----------------
func _clear(box: Node) -> void:
	for c in box.get_children():
		box.remove_child(c)
		c.queue_free()

func _side_lbl(t: String, col := INK, fs := 13) -> Label:
	var l = _text(t, fs, col)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(SIDE_LABEL_W, 0)
	return l

func _army_at(a: Dictionary) -> String:
	return a["loc"]["node"] if a["loc"].has("node") else a["loc"]["to"]

func _refresh_outliner() -> void:
	_clear(outliner_sel)
	_clear(outliner_alerts)
	_clear(outliner_orders)
	var has_army := sel_army != "" and state.armies.has(sel_army)
	if has_army:
		var a: Dictionary = state.armies[sel_army]
		var t = _side_lbl(a["name"] + ("（运输队）" if a["is_convoy"] else ""), D.CINNABAR if a["faction"] == "han" else D.XN, 17)
		_kai(t, 17)
		outliner_sel.add_child(t)
		var tm: float = Supply.t_max(state, a)
		outliner_sel.add_child(_side_lbl("兵 %s · 民夫 %s · 马 %s" % [_fmt(state.army_size(a)), _fmt(a["laborers"]), _fmt(a["horses"])], D.INK_2))
		outliner_sel.add_child(_side_lbl("携粮 %s · 可支撑 %.1f 月%s" % [_fmt(a["grain"]), tm, " · 断粮！" if a["starving"] > 0 else ""], RED if (tm < 1.0 and not a["is_convoy"]) or a["starving"] > 0 else D.INK_2))
	if sel_node != "" and state.nodes.has(sel_node):
		var n: Dictionary = state.nodes[sel_node]
		if has_army:
			outliner_sel.add_child(_side_lbl("所在 · " + n["name"], MUTED, 12))
		else:
			var t2 = _side_lbl(n["name"], INK, 17)
			_kai(t2, 17)
			outliner_sel.add_child(t2)
			outliner_sel.add_child(_side_lbl(_ctl_text(n), MUTED, 12))
			if n["type"] != "junction":
				outliner_sel.add_child(_side_lbl("人口 %s · 存粮 %s" % [_fmt(n["pop"]), _fmt(n["grain"])], D.INK_2))
			if n["under_siege_by"] != "":
				outliner_sel.add_child(_side_lbl("被%s围困" % state.factions[n["under_siege_by"]]["name"], RED))
	if outliner_sel.get_child_count() == 0:
		outliner_sel.add_child(_side_lbl("未选择 · 点击舆图上的城邑或军旗", MUTED))
	else:
		var detail_key := "army" if has_army else "node"
		var db = _btn("详情 F5" if has_army else "详情 F1", func(): _open_drawer(detail_key))
		db.focus_mode = Control.FOCUS_NONE
		outliner_sel.add_child(db)
	# 急报
	var alerts := _alerts()
	if alerts.is_empty():
		outliner_alerts.add_child(_side_lbl("暂无急报", MUTED, 12))
	for i in mini(alerts.size(), 6):
		outliner_alerts.add_child(_alert_button(alerts[i]))
	if alerts.size() > 6:
		outliner_alerts.add_child(_side_lbl("另有 %d 条 · 见诸国与战报" % (alerts.size() - 6), MUTED, 11))
	# 本季军令
	orders_title.text = "本%s军令（%d）" % ["季" if decision_ticks == 9 else "月", orders.size()]
	if orders.is_empty():
		outliner_orders.add_child(_side_lbl("（尚无）", MUTED, 12))
	for i in orders.size():
		var c: Dictionary = orders[i]
		var h = HBoxContainer.new()
		var l = _side_lbl(_order_text(c), INK, 12)
		l.custom_minimum_size.x = SIDE_LABEL_W - 40
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		h.add_child(l)
		var x = Button.new()
		x.text = "✕"
		x.focus_mode = Control.FOCUS_NONE
		x.tooltip_text = "撤回此令"
		var idx = i
		x.pressed.connect(func():
			orders.remove_at(idx)
			refresh())
		h.add_child(x)
		outliner_orders.add_child(h)

## 急报：围城、断粮、敌军逼近、冬季封路、胜负连月。每条可点击定位。
func _alerts() -> Array:
	var out: Array = []
	var enemy := "xiongnu" if player == "han" else "han"
	for id in state.nodes:
		var n: Dictionary = state.nodes[id]
		if n["under_siege_by"] != "":
			var mine: bool = state.controller(n) == player
			out.append({"text": "%s 被%s围困" % [n["name"], state.factions[n["under_siege_by"]]["name"]], "color": D.CINNABAR if mine else D.AMBER, "node": id, "army": ""})
	for aid in state.armies:
		var a: Dictionary = state.armies[aid]
		if a["faction"] == player and a["starving"] > 0:
			out.append({"text": "%s 断粮" % a["name"], "color": D.CINNABAR, "node": _army_at(a), "army": aid})
	var threatened := {}
	for aid in state.armies:
		var a: Dictionary = state.armies[aid]
		if a["faction"] != enemy or a["is_convoy"]:
			continue
		var at := _army_at(a)
		var near: Array = [at] + state.near_neighbors(at)
		for nid in near:
			var n: Dictionary = state.nodes[nid]
			if n["type"] == "junction" or threatened.has(nid) or n["under_siege_by"] != "":
				continue
			if state.controller(n) == player:
				threatened[nid] = true
				out.append({"text": "敌军逼近 %s" % n["name"], "color": D.AMBER, "node": nid, "army": ""})
	if state.is_winter():
		out.append({"text": "冬季 · 山道封闭", "color": D.PATINA, "node": "", "army": ""})
	if state.streak["han"] > 0:
		out.append({"text": "汉属国达标 · 连续 %d/12 月" % state.streak["han"], "color": D.PATINA if player == "han" else D.CINNABAR, "node": "wu_lei", "army": ""})
	if state.streak["xiongnu"] > 0:
		out.append({"text": "匈奴据河西四郡 · 连续 %d/6 月" % state.streak["xiongnu"], "color": D.PATINA if player == "xiongnu" else D.CINNABAR, "node": "dun_huang", "army": ""})
	return out

func _alert_button(al: Dictionary) -> Button:
	var b = Button.new()
	b.text = al["text"]
	b.tooltip_text = al["text"]
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	b.clip_text = true
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 13)
	var normal = D.margins(D.box(D.SILK_3), 10, 5)
	normal.border_color = al["color"]
	normal.border_width_left = 3
	var hover = D.margins(D.box(D.SILK), 10, 5)
	hover.border_color = al["color"]
	hover.border_width_left = 3
	b.add_theme_stylebox_override("normal", normal)
	b.add_theme_stylebox_override("hover", hover)
	b.add_theme_stylebox_override("pressed", hover)
	var node_id: String = al["node"]
	var army_id: String = al["army"]
	b.pressed.connect(func():
		if army_id != "":
			_select_army(army_id)
		elif node_id != "":
			_select_node(node_id)
			map_view.center_on(map_view.node_world_pos(node_id)))
	return b

# ---------------- 抽屉页 ----------------
func _add(c: Control) -> void:
	_page.add_child(c)

## 每次刷新重建五个抽屉页（战报页保留累积的 log_box）；只有当前抽屉可见。
func _refresh_pages() -> void:
	for key in PAGE_ORDER:
		if key != "log":
			_clear(pages[key])
	_page = pages["node"]
	_build_node_page()
	_page = pages["state"]
	_build_state_page()
	_page = pages["states"]
	_build_states_page()
	_page = pages["supply"]
	_build_supply_page()
	_page = pages["army"]
	_build_army_page()
	_page = null

func _lbl(t: String, bold := false, col := INK, wrap := true) -> Label:
	var l = Label.new()
	l.text = t
	l.add_theme_color_override("font_color", col)
	if wrap:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.custom_minimum_size = Vector2(DRAWER_LABEL_W, 0)
	if bold:
		_kai(l, 17)
	return l

func _btn(t: String, cb: Callable, why := "") -> Button:
	var b = Button.new()
	b.text = t
	b.focus_mode = Control.FOCUS_NONE
	b.pressed.connect(cb)
	if why != "":
		b.disabled = true
		b.tooltip_text = why
		b.text = t
	return b

func _row(items: Array) -> HFlowContainer:
	var h = HFlowContainer.new()
	h.add_theme_constant_override("h_separation", 6)
	h.add_theme_constant_override("v_separation", 6)
	for i in items:
		h.add_child(i)
	return h

func _bar(label: String, v: float, vmax: float, col: Color) -> Control:
	var h = HBoxContainer.new()
	h.add_theme_constant_override("separation", 10)
	var l = _text(label, 12, D.INK_2)
	l.custom_minimum_size = Vector2(76, 0)
	h.add_child(l)
	var pb = ProgressBar.new()
	pb.max_value = vmax
	pb.value = v
	pb.show_percentage = false
	pb.custom_minimum_size = Vector2(260, 6)
	pb.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var fill = StyleBoxFlat.new()
	fill.bg_color = col
	pb.add_theme_stylebox_override("fill", fill)
	h.add_child(pb)
	var n = _text(" %d" % int(v), 13, INK)
	h.add_child(n)
	return h

func _sep() -> HSeparator:
	return HSeparator.new()

func _build_node_page() -> void:
	if sel_node == "" or not state.nodes.has(sel_node):
		_add(_lbl("点选舆图上的城邑以查看概况、外交与征召。", false, MUTED))
		return
	var n: Dictionary = state.nodes[sel_node]
	_add(_summary_banner("【%s】城塞图籍卷宗 — %s。点击下方带『因果』字样的指标卡可弹出因果拆解与趋势折线。" % [n["name"], _ctl_text(n)]))
	_node_section(n)

func _build_state_page() -> void:
	var enemy := "xiongnu" if player == "han" else "han"
	_add(_summary_banner("朝堂国策与战略胜局总览 — %s。点击国力六维指标卡可调阅并锁定因果拆解浮卡。" % _goal_text()))
	var f: Dictionary = state.factions[player]
	var soldiers := 0
	var army_count := 0
	for aid in state.armies:
		var a: Dictionary = state.armies[aid]
		if a["faction"] == player and not a["is_convoy"]:
			soldiers += state.army_size(a)
			army_count += 1
	var cards: Array = [
		_kpi_card("少府国库", "%d 钱" % f["money"], "赏赐·购粮·屯田", "good", "money"),
		_kpi_card("己方属国", "%d 国" % _vassal_count(player), "西域藩属", "info", "victory"),
		_kpi_card("在册野战军", "%d 支 · %s" % [army_count, _fmt(soldiers)], "出塞主力", "good", "military"),
		_kpi_card("胜局进度", "%.0f%%" % (Victory.objective_progress(state, player) * 100.0), _victory_text(player), "warn", "victory"),
	]
	if player == "han":
		for t in ["infantry", "crossbow", "cavalry"]:
			cards.append(_kpi_card("中央军 " + state.units[t]["name"], _fmt(state.central.get(t, 0)), "郡城可征调", "", "military"))
	_add(_kpi_row(cards))
	_add(_section_title("目标", state.factions[player]["name"]))
	_add(_lbl(_goal_text()))
	_add(_bar("己方进度", Victory.objective_progress(state, player) * 100.0, 100, D.PATINA))
	_add(_lbl(_victory_text(player), false, D.INK_2))
	_add(_bar("对手进度", Victory.objective_progress(state, enemy) * 100.0, 100, D.CINNABAR))
	_add(_lbl("%s：%s" % [state.factions[enemy]["name"], _victory_text(enemy)], false, D.INK_2))
	_add(_section_title("国库与军粮收支瀑布流", "%s · %s季%s" % [state.date_text(), Cal.season_cn(state.season()), " · 山道封闭" if state.is_winter() else ""]))
	_add(_waterfall_row("岁拨基数与属国贡赋", "+600 钱", 0.78, true))
	_add(_waterfall_row("畅通丝路商税分润", "+%d 钱" % (_vassal_count(player) * 40), clampf(float(_vassal_count(player)) / 12.0, 0.12, 1.0), true))
	_add(_waterfall_row("本季拟令与军费支出", "-%d 钱" % (orders.size() * 150), clampf(float(orders.size()) * 0.18, 0.08, 1.0), false))
	_add(_section_title("本%s命令（%d）" % ["季" if decision_ticks == 9 else "月", orders.size()], "可在右侧军情栏撤回"))
	if orders.is_empty():
		_add(_lbl("（尚无）", false, MUTED))
	for c in orders:
		_add(_lbl("· " + _order_text(c)))

func _build_states_page() -> void:
	_add(_summary_banner("西域诸国符节邦交总览 — 汉属国 %d 国 · 匈奴属国 %d 国。点击表中任意一行可直接移步该国主城并打开【图籍 F1】。" % [_vassal_count("han"), _vassal_count("xiongnu")]))
	var widths := [170, 110, 100, 100, 100, 90, 120]
	_add(_table_row(["国名", "宗主", "汉影响", "匈威吓", "对匈怨恨", "商路", "意向"], widths))
	var open_nodes := {}
	for tr in state.trade_routes:
		for nid in Trade.open_prefix(state, tr):
			open_nodes[nid] = true
	for sid in state.relations:
		var rel: Dictionary = state.relations[sid]
		var target := ""
		var open_s := false
		for n in state.nodes_of_state(sid):
			if open_nodes.has(n["id"]):
				open_s = true
			if target == "" and n["type"] != "junction":
				target = n["id"]
		var ov: String = rel["overlord"]
		var ov_col: Color = D.CINNABAR if ov == "han" else (D.XN if ov == "xiongnu" else D.INK_2)
		var nm: String = state.factions[sid]["name"] + ("（大国）" if state.kind_of(sid) == "great" else "")
		var intent := ""
		if rel["han_status"] == "enfeoffed":
			intent = "已受汉册封"
		if rel.get("wants_han", false):
			intent = "有意内附"
		var tgt := target
		var cells := [
			[nm, INK], [state.factions[ov]["name"] if ov != "" else "独立", ov_col],
			"%d" % int(rel["han_influence"]), "%d" % int(rel["xn_intimidation"]), "%d" % int(rel["xn_resentment"]),
			["畅通", D.PATINA] if open_s else ["未通", MUTED], [intent, D.PATINA],
		]
		_add(_table_row(cells, widths, func():
			if tgt != "":
				_select_node(tgt, true)))

func _own_army_table() -> void:
	var widths := [170, 150, 90, 130, 90, 120]
	_add(_table_row(["军队", "位置", "兵力", "携粮/容量", "可支撑", "状态"], widths))
	var status_names := {"idle": "待命", "moving": "行军", "holding": "驻守", "sieging": "围攻", "ambushing": "设伏", "blocked": "道路受阻"}
	var any := false
	for aid in state.armies:
		var a: Dictionary = state.armies[aid]
		if a["faction"] != player:
			continue
		any = true
		var tm: float = Supply.t_max(state, a)
		var where: String = state.nodes[a["loc"]["node"]]["name"] if a["loc"].has("node") else "→" + state.nodes[a["loc"]["to"]]["name"]
		var st: String = status_names.get(a["status"], a["status"])
		var short: bool = tm < 1.0 and not a["is_convoy"]
		var cells := [
			[a["name"] + ("（运）" if a["is_convoy"] else ""), D.CINNABAR if aid == sel_army else INK], where,
			_fmt(state.army_size(a) + (a["laborers"] if a["is_convoy"] else 0)),
			"%s/%s" % [_fmt(a["grain"]), _fmt(Supply.carry_cap(state, a))],
			["%.1f 月" % tm, RED if short else INK],
			["断粮！" if a["starving"] > 0 else st, RED if a["starving"] > 0 else D.INK_2],
		]
		var id: String = aid
		_add(_table_row(cells, widths, func(): _select_army(id)))
	if not any:
		_add(_lbl("（无在册军队）", false, MUTED))

func _build_supply_page() -> void:
	var tot_grain := 0.0
	var tot_colonies := 0
	for nid in state.nodes:
		var nd: Dictionary = state.nodes[nid]
		if state.controller(nd) == player:
			tot_grain += float(nd["grain"])
			tot_colonies += int(nd.get("colonies", 0))
	_add(_summary_banner("仓廪转运与塞外屯田总账 — 全境官仓存粮 %s 斛 · 屯田民 %s 人。点击指标卡可查看粮秣因果拆解。" % [_fmt(tot_grain), _fmt(tot_colonies)]))
	_add(_kpi_row([
		_kpi_card("全境官仓总储", "%s 斛" % _fmt(tot_grain), "直辖与属国存粮", "good", "grain"),
		_kpi_card("塞外屯田民", "%s 人" % _fmt(tot_colonies), "就地生粟", "info", "grain"),
		_kpi_card("少府购粮预算", "%d 钱" % int(state.factions[player]["money"]), "可就地籴粮", "warn", "money"),
	]))
	_add(_section_title("全境粟米收支瀑布流", "月度估算"))
	_add(_waterfall_row("河西与属国官仓岁入折算", "+4.2万 斛", 0.82, true))
	_add(_waterfall_row("塞外屯田区秋收折算", "+1.8万 斛", 0.45, true))
	_add(_waterfall_row("在册野战军与民夫口粮消耗", "-2.6万 斛", 0.58, false))
	_add(_section_title("各军携粮", "点击一行打开军务"))
	_own_army_table()
	if player != "han":
		_add(_section_title("运输队"))
		_add(_lbl("运输队为汉军专属；匈奴军队依靠牧地、属国与劫掠补给。", false, MUTED))
		return
	var n: Dictionary = state.nodes.get(sel_node, {})
	if n.is_empty() or not state.is_supply_node(n, "han"):
		_add(_section_title("运输队"))
		_add(_lbl("先在舆图上选择汉的郡城或汉属国，即可从该地征民夫发运粮食。", false, MUTED))
		return
	_add(_section_title("自%s发运" % n["name"], "存粮 %s" % _fmt(state.stock(n, "han"))))
	_convoy_section(n)

func _build_army_page() -> void:
	_add(_summary_banner("虎符军务与行军预演 — 选择己方军队可编排多步作战计划（移动、围攻、道路设伏、焚田、驻守），金色虚线将在舆图上实时预演路线。"))
	if sel_army != "" and state.armies.has(sel_army):
		_army_section(state.armies[sel_army])
	else:
		_add(_lbl("点击舆图上的军旗，或在下表中选择一支己方军队。", false, MUTED))
	_add(_section_title("己方军队", "点击一行切换"))
	_own_army_table()

# ---------------- 城邑 ----------------
func _ctl_text(n: Dictionary) -> String:
	if n["type"] == "junction":
		return "路口 · 无主，可在此换路，不可攻占"
	var ctl: String = state.controller(n)
	if n["faction"] == "han" or n["faction"] == "xiongnu":
		return "直辖 · " + state.factions[n["faction"]]["name"]
	var k = "大国" if state.kind_of(n["faction"]) == "great" else "城邦"
	if ctl == "":
		return "%s（%s）· 独立" % [state.factions[n["faction"]]["name"], k]
	return "%s（%s）· %s属国" % [state.factions[n["faction"]]["name"], k, state.factions[ctl]["name"]]

func _node_section(n: Dictionary) -> void:
	var cards: Array = []
	if n["type"] != "junction":
		cards.append(_kpi_card("编户人口", _fmt(n["pop"]), "城郭丁口", "info", "victory"))
		cards.append(_kpi_card("仓廪存粮", _fmt(n["grain"]), "本地储粟", "good", "grain"))
		if n["depot"].get("han", 0) > 0 and n["faction"] != "han":
			cards.append(_kpi_card("前推汉仓", _fmt(n["depot"]["han"]), "军粮转运站", "good", "grain"))
	if n["pasture_cap"] > 0:
		cards.append(_kpi_card("牧马存栏", "%s/%s" % [_fmt(n["horses"]), _fmt(n["pasture_cap"])], "战马与驮马", "", "military"))
	if n["walls"] > 0:
		cards.append(_kpi_card("城垣耐久", "%d/%d" % [int(n["wall_hp"]), int(n["wall_hp_max"])], "城防工事", "bad" if n["wall_hp"] < n["wall_hp_max"] * 0.5 else "", "military"))
	var mil = 0
	for t in n["militia"]:
		mil += int(n["militia"][t])
	if mil > 0:
		cards.append(_kpi_card("本地民兵", _fmt(mil), "守城乡兵", "", "military"))
	if n["colonies"] > 0:
		cards.append(_kpi_card("塞外屯田民", _fmt(n["colonies"]), "且耕且戍", "good", "grain"))
	if cards.is_empty():
		_add(_lbl(_ctl_text(n), false, MUTED))
	else:
		_add(_kpi_row(cards))
	if n["farm_cap"] > 0:
		_add(_lbl("农田 %s×开垦 %d%%　年产约 %s" % [_fmt(n["farm_cap"]), int(n["farm_dev"] * 100), _fmt(preload("res://core/economy.gd").farm_output_year(state, n))], false, D.INK_2))
	if n["walls"] > 0:
		_add(_bar("城墙", n["wall_hp"], maxf(n["wall_hp_max"], 1.0), D.INK_2))
	if n["under_siege_by"] != "":
		_add(_lbl("被%s围困" % state.factions[n["under_siege_by"]]["name"], true, RED))
	var here = state.armies_at(n["id"])
	if not here.is_empty():
		var parts = []
		var totals := {}
		for a in here:
			var label: String = state.factions[a["faction"]]["name"] + ("运输" if a["is_convoy"] else "军")
			totals[label] = totals.get(label, 0) + state.army_size(a) + (a["laborers"] if a["is_convoy"] else 0)
		for label in totals:
			parts.append("%s %s" % [label, _fmt(totals[label])])
		_add(_lbl("驻军：" + "；".join(parts)))
		var army_picker = OptionButton.new()
		army_picker.add_item("选择本城军队（%d 支）" % here.size())
		var army_ids: Array[String] = []
		for a in here:
			army_ids.append(a["id"])
			army_picker.add_item("%s · %s 人" % [a["name"], _fmt(state.army_size(a) + (a["laborers"] if a["is_convoy"] else 0))])
		army_picker.item_selected.connect(func(i):
			if i > 0:
				_on_army_clicked(army_ids[i - 1]))
		army_picker.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		_add(army_picker)
	var sid: String = n["faction"]
	if state.relations.has(sid):
		var rel: Dictionary = state.relations[sid]
		_add(_section_title("向背", _ctl_text(n)))
		_add(_bar("汉影响力", rel["han_influence"], 100, D.CINNABAR))
		_add(_bar("匈奴威吓", rel["xn_intimidation"], 100, D.XN))
		_add(_bar("对匈怨恨", rel["xn_resentment"], 100, D.AMBER))
		var st = "宗主：" + (state.factions[rel["overlord"]]["name"] if rel["overlord"] != "" else "无")
		if rel["han_status"] == "enfeoffed":
			st += "　已受汉册封"
		if rel["overlord"] == "xiongnu":
			st += "　税率 %d" % rel["tax_level"]
		if rel.get("wants_han", false):
			st += "　【有意内附】"
		_add(_lbl(st))
		var open_n := false
		for tr in state.trade_routes:
			if n["id"] in Trade.open_prefix(state, tr):
				open_n = true
		_add(_lbl("商路：" + ("畅通 +1.5影响力/月" if open_n else "未通"), false, D.PATINA if open_n else MUTED))
		_diplomacy_actions(n, sid)
	if n["type"] != "junction":
		_economy_actions(n)

func _can(c: Dictionary) -> String:
	return Cmd.validate(state, c)

func _update_command_button(button: Button, command: Dictionary) -> void:
	var why = _can(command)
	button.disabled = why != ""
	button.tooltip_text = why

func _diplomacy_actions(n: Dictionary, sid: String) -> void:
	_add(_section_title("外交"))
	if player == "han":
		var sp = SpinBox.new()
		sp.min_value = 1
		sp.max_value = 30
		sp.value = gift_units
		sp.suffix = "份（每份100钱）"
		sp.custom_minimum_size.x = 200
		var gain = Diplomacy.gift_gain(state, state.relations[sid], gift_units)
		var gc = Cmd.make("gift", "han", {"state": sid, "units": gift_units})
		var gift_button = _btn("赏赐 (+%.0f 影响力)" % gain, func(): queue(gc), _can(gc))
		sp.value_changed.connect(func(v):
			gift_units = int(v)
			gc["units"] = gift_units
			gift_button.text = "赏赐 (+%.0f 影响力)" % Diplomacy.gift_gain(state, state.relations[sid], gift_units)
			_update_command_button(gift_button, gc))
		_add(_row([sp]))
		_add(_row([
			gift_button,
			_btn("册封", func(): queue(Cmd.make("enfeoff", "han", {"state": sid})), Diplomacy.can_enfeoff(state, sid)),
			_btn("纳为属国", func(): queue(Cmd.make("make_vassal", "han", {"state": sid})), Diplomacy.can_vassal(state, sid)),
		]))
		var bg = Cmd.make("buy_grain", "han", {"node": n["id"], "amount": 20000})
		_add(_row([_btn("购粮 2万斛", func(): queue(bg), _can(bg))]))
	else:
		var rel = state.relations[sid]
		var items = [_btn("令其臣服", func(): queue(Cmd.make("demand_vassal", "xiongnu", {"state": sid})), Diplomacy.can_demand(state, sid))]
		if rel["overlord"] == "xiongnu":
			for lvl in 4:
				var tc = Cmd.make("set_tax", "xiongnu", {"state": sid, "level": lvl})
				items.append(_btn("税率%d%s" % [lvl, "●" if rel["tax_level"] == lvl else ""], func(): queue(tc)))
		_add(_row(items))

func _economy_actions(n: Dictionary) -> void:
	_add(_section_title("经济与征召"))
	var items = []
	if player == "han":
		var ef = Cmd.make("expand_farm", "han", {"node": n["id"]})
		items.append(_btn("扩大屯田 (200钱)", func(): queue(ef), _can(ef)))
	var sp = SpinBox.new()
	sp.min_value = 500
	sp.max_value = 20000
	sp.step = 500
	sp.value = recruit_amount
	sp.suffix = " 人"
	sp.custom_minimum_size.x = 160
	var recruit_buttons: Array = []
	sp.value_changed.connect(func(v):
		recruit_amount = int(v)
		for entry in recruit_buttons:
			for unit in entry["command"]["units"]:
				entry["command"]["units"][unit] = recruit_amount
			_update_command_button(entry["button"], entry["command"]))
	items.append(sp)
	_add(_row(items))
	var rb = []
	if player == "han":
		for t in ["infantry", "crossbow", "cavalry"]:
			var c = Cmd.make("recruit", "han", {"node": n["id"], "source": "central", "units": {t: recruit_amount}, "preset": "balanced"})
			var button = _btn("中央军·" + state.units[t]["name"], func(): queue(c), _can(c))
			rb.append(button)
			recruit_buttons.append({"button": button, "command": c})
		var c2 = Cmd.make("recruit", "han", {"node": n["id"], "source": "tuntian", "units": {"infantry": recruit_amount}, "preset": "balanced"})
		rb.append(_btn("屯田兵", func(): queue(c2), _can(c2)))
		recruit_buttons.append({"button": rb.back(), "command": c2})
		var c3 = Cmd.make("recruit", "han", {"node": n["id"], "source": "hu", "units": {"cavalry": recruit_amount}, "preset": "balanced"})
		rb.append(_btn("胡骑", func(): queue(c3), _can(c3)))
		recruit_buttons.append({"button": rb.back(), "command": c3})
	else:
		var c4 = Cmd.make("recruit", "xiongnu", {"node": n["id"], "source": "nomad", "units": {"horse_archer": recruit_amount}, "preset": "raider"})
		rb.append(_btn("征牧民弓骑", func(): queue(c4), _can(c4)))
		recruit_buttons.append({"button": rb.back(), "command": c4})
		var c5 = Cmd.make("recruit", "xiongnu", {"node": n["id"], "source": "vassal", "units": {"infantry": recruit_amount}, "preset": "balanced"})
		rb.append(_btn("征属国步兵", func(): queue(c5), _can(c5)))
		recruit_buttons.append({"button": rb.back(), "command": c5})
	_add(_row(rb))
	if player == "han" and state.is_supply_node(n, "han"):
		var go = _btn("组织运输队（粮道 F4）", func(): _open_drawer("supply"))
		_add(_row([go]))

func _convoy_command(n: Dictionary) -> Dictionary:
	return Cmd.make("convoy", "han", {"from": n["id"], "to": convoy["to"] if convoy["to"] != "" else n["id"], "grain": convoy["grain"], "laborers": convoy["laborers"], "loop": convoy.get("loop", false), "stay": convoy.get("stay", false)})

func _convoy_section(n: Dictionary) -> void:
	_add(_lbl("运输队（征民夫，满载可运 %d 斛/人）" % state.bal["food"]["laborer_carry"], false, MUTED))
	var l1 = SpinBox.new()
	l1.min_value = 500
	l1.max_value = 20000
	l1.step = 500
	l1.value = convoy["laborers"]
	l1.suffix = " 民夫"
	l1.custom_minimum_size.x = 170
	var l2 = SpinBox.new()
	l2.min_value = 0
	l2.max_value = 400000
	l2.step = 500
	l2.value = convoy["grain"]
	l2.suffix = " 斛"
	l2.custom_minimum_size.x = 170
	_add(_row([l1, l2]))
	var mode = OptionButton.new()
	for label in ["运达后返回", "循环运输", "运达后留驻（可设屯田区）"]:
		mode.add_item(label)
	mode.select(1 if convoy.get("loop", false) else (2 if convoy.get("stay", false) else 0))
	mode.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	_add(mode)
	var tname = state.nodes[convoy["to"]]["name"] if convoy["to"] != "" else "（未选）"
	var send = _primary(_btn("发运", func(): queue(_convoy_command(n))))
	_add(_row([
		_btn("目的地：" + tname, func(): _start_pick({"kind": "convoy_to"}, "选择运输队目的地")), send,
	]))
	var estimate = _lbl("")
	_add(estimate)
	var update = func():
		var cc = _convoy_command(n)
		_update_command_button(send, cc)
		if convoy["to"] == "":
			send.disabled = true
			send.tooltip_text = "先选择目的地"
			estimate.text = "选择目的地后查看运达量与返程口粮。"
			return
		var days = Path.days_to(state, n["id"], convoy["to"], float(state.bal.get("movement", {}).get("convoy_speed_mult", 1.0)), true)
		var capacity = convoy["laborers"] * state.bal["food"]["laborer_carry"]
		var loaded = minf(convoy["grain"], capacity)
		if n["type"] != "source":
			loaded = minf(loaded, state.stock(n, "han"))
		var daily = convoy["laborers"] * state.bal["food"]["laborer_per_month"] / 30.0
		var reserve = 0.0 if convoy.get("stay", false) else daily * (ceil(days) + 1.0)
		var delivered = maxf(0.0, loaded - daily * ceil(days) - reserve)
		estimate.text = "单程约 %d 天；实际装粮 %s 斛；预留返程 %s 斛；预计净运达 %s 斛。未计战斗、损耗与封路等待。" % [ceili(days), _fmt(loaded), _fmt(reserve), _fmt(delivered)]
		estimate.add_theme_color_override("font_color", INK if delivered > 0 else RED)
	l1.value_changed.connect(func(v):
		convoy["laborers"] = int(v)
		convoy["grain"] = int(v) * state.bal["food"]["laborer_carry"]
		l2.set_value_no_signal(convoy["grain"])
		update.call())
	l2.value_changed.connect(func(v):
		convoy["grain"] = int(v)
		update.call())
	mode.item_selected.connect(func(i):
		convoy["loop"] = i == 1
		convoy["stay"] = i == 2
		update.call())
	update.call()

# ---------------- 军队 ----------------
func _army_section(a: Dictionary) -> void:
	_add(_lbl("%s%s" % [a["name"], "（运输队）" if a["is_convoy"] else ""], true, RED if a["faction"] == "han" else D.XN))
	var u = []
	for t in a["units"]:
		if a["units"][t] > 0:
			u.append("%s %s" % [state.units[t]["name"], _fmt(a["units"][t])])
	if a["laborers"] > 0:
		u.append("民夫 %s" % _fmt(a["laborers"]))
	_add(_lbl("　".join(u) if not u.is_empty() else "（空）"))
	var tm = Supply.t_max(state, a)
	var info = "携粮 %s/%s　马 %s　可支撑 %.1f 月" % [_fmt(a["grain"]), _fmt(Supply.carry_cap(state, a)), _fmt(a["horses"]), tm]
	_add(_lbl(info, false, RED if tm < 1.0 and not a["is_convoy"] else INK))
	var loc = "位于 " + state.nodes[a["loc"]["node"]]["name"] if a["loc"].has("node") else "行军 %s→%s (%d%%)" % [state.nodes[a["loc"]["from"]]["name"], state.nodes[a["loc"]["to"]]["name"], int(a["loc"]["prog"] * 100)]
	var status_names := {"idle": "待命", "moving": "行军", "holding": "驻守", "sieging": "围攻", "ambushing": "设伏", "blocked": "道路受阻"}
	_add(_lbl("%s　速度 %.1f　状态 %s%s" % [loc, Combat.army_speed(state, a), status_names.get(a["status"], a["status"]), "　断粮！" if a["starving"] > 0 else ""]))
	if a["faction"] != player:
		return
	# 计划编辑
	var d = _draft(a)
	_add(_section_title("行动计划", "预览路线以金色虚线显示在舆图上"))
	if d["steps"].is_empty():
		_add(_lbl("（无：原地待命）", false, MUTED))
	for i in d["steps"].size():
		var s: Dictionary = d["steps"][i]
		var h = HBoxContainer.new()
		var tl = Label.new()
		tl.text = "%d. %s" % [i + 1, _step_text(s)]
		tl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		tl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		tl.custom_minimum_size.x = 190
		h.add_child(tl)
		var x = Button.new()
		x.text = "✕"
		var idx = i
		x.pressed.connect(func():
			d["steps"].remove_at(idx)
			refresh())
		h.add_child(x)
		_add(h)
		if s["type"] == "hold":
			var duration = OptionButton.new()
			duration.add_item("驻守直到再次改令")
			for month in range(1, 13):
				duration.add_item("驻守 %d 月后继续计划" % month)
			duration.select(clampi(int(s.get("months", 0)), 0, 12) if s.get("until", "") != "end" else 0)
			duration.item_selected.connect(func(month):
				s.erase("days")
				if month == 0:
					s["until"] = "end"
					s.erase("months")
				else:
					s["months"] = month
					s.erase("until")
				refresh())
			_add(duration)
		elif s["type"] == "siege":
			var limit = SpinBox.new()
			limit.min_value = 1
			limit.max_value = 12
			limit.value = s.get("max_months", 3)
			limit.prefix = "围攻 "
			limit.suffix = " 月"
			limit.custom_minimum_size.x = 170
			limit.value_changed.connect(func(v):
				s["max_months"] = int(v)
				s.erase("days")
				tl.text = "%d. %s" % [idx + 1, _step_text(s)])
			var threshold = SpinBox.new()
			threshold.min_value = 0
			threshold.max_value = 100
			threshold.step = 5
			threshold.value = s.get("assault_when", 0.5) * 100
			threshold.prefix = "墙≤"
			threshold.suffix = "%强攻"
			threshold.custom_minimum_size.x = 170
			threshold.value_changed.connect(func(v):
				s["assault_when"] = v / 100.0
				tl.text = "%d. %s" % [idx + 1, _step_text(s)])
			_add(_row([limit, threshold]))
		if s["type"] == "ambush":
			var ro = OptionButton.new()
			var routes: Array = state.adj[s["node"]]
			for ri in routes.size():
				var route: Dictionary = state.routes[routes[ri]]
				ro.add_item("设伏道路：" + state.nodes[route["a"]]["name"] + "—" + state.nodes[route["b"]]["name"])
				if routes[ri] == s["route"]:
					ro.select(ri)
			ro.item_selected.connect(func(ri): s["route"] = routes[ri])
			_add(ro)
			var duration = SpinBox.new()
			duration.min_value = 1
			duration.max_value = 12
			duration.value = s.get("months", 2)
			duration.prefix = "设伏 "
			duration.suffix = " 月"
			duration.value_changed.connect(func(v):
				s["months"] = int(v)
				s.erase("days")
				tl.text = "%d. %s" % [idx + 1, _step_text(s)])
			_add(duration)
	var add = []
	add.append(_btn("移动到…", func(): _start_pick({"kind": "step", "type": "move_to", "army": a["id"]}, "选择移动目标")))
	if not a["is_convoy"]:
		add.append(_btn("围攻…", func(): _start_pick({"kind": "step", "type": "siege", "army": a["id"]}, "选择围攻目标")))
		add.append(_btn("道路设伏…", func(): _start_pick({"kind": "step", "type": "ambush", "army": a["id"]}, "选择设伏道路的端点")))
		add.append(_btn("焚田劫掠…", func(): _start_pick({"kind": "step", "type": "burn", "army": a["id"]}, "选择劫掠目标")))
	add.append(_btn("驻守…", func(): _start_pick({"kind": "step", "type": "hold", "army": a["id"]}, "选择驻守地点")))
	add.append(_btn("返回出发地", func():
		_append_step(a, {"type": "return_to", "node": a["origin"]})
		refresh()))
	_add(_row(add))
	# 预设
	var po = OptionButton.new()
	var presets = ["cautious", "balanced", "aggressive", "garrison", "raider", "assault"]
	var names = {"cautious": "谨慎", "balanced": "均衡", "aggressive": "激进", "garrison": "守城", "raider": "游骑", "assault": "攻城"}
	for i in presets.size():
		po.add_item("常备指令：" + names[presets[i]], i)
		if presets[i] == d["preset"]:
			po.select(i)
	po.item_selected.connect(func(i):
		d["preset"] = presets[i]
		refresh())
	_add(po)
	_add(_lbl(_preset_text(d["preset"]), false, MUTED))
	# 预演
	var days = 0.0
	var cur: String = a["loc"]["node"] if a["loc"].has("node") else a["loc"]["to"]
	var spd = Combat.army_speed(state, a)
	if a["loc"].has("route"):
		days += (1.0 - a["loc"]["prog"]) * Path.travel_days(state.routes[a["loc"]["route"]], spd)
	for s in d["steps"]:
		var tgt: String = s.get("node", "")
		if tgt != "" and tgt != cur:
			days += Path.days_to(state, cur, tgt, spd, true)
			cur = tgt
		if s["type"] == "hold" and s.get("until", "") != "end":
			days += maxf(0.0, s.get("months", 0) * 30.0 - s.get("days", 0.0))
		elif s["type"] in ["siege", "ambush"]:
			days += maxf(0.0, s.get("max_months", s.get("months", 0)) * 30.0 - s.get("days", 0.0))
		if s["type"] == "hold" and s.get("until", "") == "end":
			break
	if not d["steps"].is_empty():
		var months = days / 30.0
		var ok = tm >= months or a["is_convoy"]
		_add(_lbl("预演：行军与限时行动最多约 %d 天（%.1f 月）；携粮可支撑 %.1f 月%s" % [ceili(days), months, tm, "" if ok else " —— 粮不足，需沿途补给或加载" ], false, INK if ok else RED))
		_add(_lbl("含计时驻守、设伏及围攻上限；沿途补给、战斗与冬季封路等待另计。无限驻守将停在该步骤。", false, MUTED))
	var apply = _primary(_btn("提交计划", func():
		queue(Cmd.make("set_plan", player, {"army": a["id"], "steps": d["steps"].duplicate(true), "preset": d["preset"]}))
		sel_army = a["id"]))
	_add(_row([apply]))
	# 装载
	if a["loc"].has("node") and state.is_supply_node(state.nodes[a["loc"]["node"]], player):
		var lc = Cmd.make("load", player, {"army": a["id"], "grain": Supply.carry_cap(state, a) - a["grain"], "laborers": 0})
		var lc2 = Cmd.make("load", player, {"army": a["id"], "grain": 1000000, "laborers": 2000})
		var row = [_btn("补满粮食", func(): queue(lc), _can(lc))]
		if player == "han":
			row.append(_btn("+2000民夫并装满", func(): queue(lc2), _can(lc2)))
		_add(_row(row))
	_add(_row([_btn("解散", func(): queue(Cmd.make("disband", player, {"army": a["id"]})))]))
	if a["is_convoy"] and a["loc"].has("node"):
		var fc = Cmd.make("found_colony", player, {"node": a["loc"]["node"], "army": a["id"]})
		_add(_row([_btn("在此设立屯田区", func(): queue(fc), _can(fc))]))

func _step_text(s: Dictionary) -> String:
	var nm = state.nodes[s["node"]]["name"] if s.has("node") and state.nodes.has(s["node"]) else ""
	match s["type"]:
		"move_to":
			return "移动至 " + nm
		"siege":
			return "围攻 %s（至多%d月，城墙≤%d%%强攻）" % [nm, s.get("max_months", 3), int(s.get("assault_when", 0.5) * 100)]
		"burn":
			return "焚田劫掠 " + nm
		"ambush":
			var r: Dictionary = state.routes[s["route"]]
			return "设伏 %s—%s（%d月）" % [state.nodes[r["a"]]["name"], state.nodes[r["b"]]["name"], s.get("months", 2)]
		"hold":
			return "驻守 %s（%d月后继续）" % [nm, s["months"]] if s.get("months", 0) > 0 and s.get("until", "") != "end" else "驻守 %s（直到再次改令）" % nm
		"return_to":
			return "返回 " + nm
		"deliver":
			return "卸粮于 " + nm
	return s["type"]

func _preset_text(p: String) -> String:
	return {
		"cautious": "迎战要求胜率≥70%；敌强≥1.2倍(2跳内)撤回；口粮≤1.5月返航；损失≥20%撤退",
		"balanced": "迎战要求胜率≥55%；敌强≥1.5倍(1跳内)撤回；口粮≤1月返航；损失≥30%撤退",
		"aggressive": "总是迎战；口粮≤0.5月返航；损失≥45%撤退",
		"garrison": "总是迎战，死守，不触发撤退",
		"assault": "迎战要求胜率≥55%；敌强≥2倍(1跳内)撤回；损失≥40%撤退，需预先准备攻城口粮",
		"raider": "胜率≥60%才迎战，速度占优可避战；遇强敌后撤本土",
	}.get(p, "")

func _order_text(c: Dictionary) -> String:
	var nm = func(id): return state.nodes[id]["name"] if state.nodes.has(id) else id
	match c["type"]:
		"set_plan":
			return "军队 %s：%d 步计划（%s）" % [state.armies[c["army"]]["name"] if state.armies.has(c["army"]) else c["army"], c["steps"].size(), c.get("preset", "")]
		"recruit":
			var composition: Array = []
			for kind in c["units"]:
				composition.append("%s %s人" % [state.units[kind]["name"], _fmt(c["units"][kind])])
			return "在%s征召 %s" % [nm.call(c["node"]), "、".join(composition)]
		"gift":
			return "赏赐 %s × %d" % [state.factions[c["state"]]["name"], c["units"]]
		"enfeoff":
			return "册封 " + state.factions[c["state"]]["name"]
		"make_vassal":
			return "纳 %s 为属国" % state.factions[c["state"]]["name"]
		"demand_vassal":
			return "令 %s 臣服" % state.factions[c["state"]]["name"]
		"set_tax":
			return "%s 税率 %d" % [state.factions[c["state"]]["name"], c["level"]]
		"convoy":
			return "运输队 %s → %s（粮%d 民夫%d）" % [nm.call(c["from"]), nm.call(c["to"]), c["grain"], c["laborers"]]
		"load":
			return "军队装载"
		"expand_farm":
			return "扩大屯田：" + nm.call(c["node"])
		"buy_grain":
			return "在%s购粮 %d" % [nm.call(c["node"]), c["amount"]]
		"disband":
			return "解散军队"
		"found_colony":
			return "设立屯田区：" + nm.call(c["node"])
	return c["type"]
