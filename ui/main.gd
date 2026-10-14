extends Control
# 主界面：顶栏（日期/资源/胜利进度/结束回合）+ 节点图地图 + 侧栏（节点/军队/计划编辑）+ 战报。
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
const FRONTIER_ART = preload("res://assets/art/frontier-caravan.png")
const Fonts = preload("res://ui/font_provider.gd")

const SAVE_PATH := "user://xiyu_save.txt"
const INK = Color("e8debf")
const PAPER = Color("111917")
const PANEL = Color("1c2824")
const RED = Color("df967c")
const GOLD = Color("c8aa6a")

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
var top_label: RichTextLabel
var goal_label: Label
var status_label: Label
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
var replay_bar: HBoxContainer
var replay_pause_btn: Button
var replay_controls: Array = []
var side_scroll: ScrollContainer

func _ready() -> void:
	_build_theme()
	_build_ui()
	new_game(player, decision_ticks)

# ---------------- 搭建 ----------------
func _build_theme() -> void:
	var th = Theme.new()
	var font = Fonts.body_font()
	th.default_font = font
	th.default_font_size = 15
	th.set_color("font_color", "Label", INK)
	th.set_color("default_color", "RichTextLabel", INK)
	th.set_color("font_color", "Button", INK)
	th.set_color("font_disabled_color", "Button", Color("827d6d"))
	th.set_color("font_color", "CheckBox", INK)
	th.set_color("font_color", "OptionButton", INK)
	th.set_color("font_hover_color", "Button", INK)
	for st in ["normal", "hover", "pressed", "disabled"]:
		var b = StyleBoxFlat.new()
		b.bg_color = {"normal": Color("2b3b32"), "hover": Color("3b5140"), "pressed": Color("4b6148"), "disabled": Color("252e27")}[st]
		b.set_corner_radius_all(4)
		b.set_border_width_all(1)
		b.border_color = Color("78643e")
		b.content_margin_left = 8
		b.content_margin_right = 8
		b.content_margin_top = 6
		b.content_margin_bottom = 6
		th.set_stylebox(st, "Button", b)
		th.set_stylebox(st, "OptionButton", b)
	var le = StyleBoxFlat.new()
	le.bg_color = Color("141f1b")
	le.set_border_width_all(1)
	le.border_color = Color("78643e")
	le.content_margin_left = 6
	le.content_margin_right = 6
	th.set_stylebox("normal", "LineEdit", le)
	th.set_stylebox("focus", "LineEdit", le)
	th.set_color("font_color", "LineEdit", INK)
	th.set_color("caret_color", "LineEdit", INK)
	theme = th

func _build_ui() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var bg = ColorRect.new()
	bg.color = PAPER
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var root = VBoxContainer.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_theme_constant_override("separation", 6)
	add_child(root)
	# 顶栏
	var top = PanelContainer.new()
	top.add_theme_stylebox_override("panel", _flat(PANEL))
	root.add_child(top)
	var top_rows = VBoxContainer.new()
	top_rows.add_theme_constant_override("separation", 8)
	top.add_child(top_rows)
	var th = HBoxContainer.new()
	th.add_theme_constant_override("separation", 8)
	top_rows.add_child(th)
	var brand = Label.new()
	brand.text = "西 域  ·  汉 匈 争 霸"
	brand.add_theme_font_size_override("font_size", 24)
	brand.add_theme_color_override("font_color", GOLD)
	brand.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	th.add_child(brand)
	var era = Label.new()
	era.text = "边塞 · 商路 · 兵粮"
	era.add_theme_color_override("font_color", Color("a5ae97"))
	th.add_child(era)
	var side_opt = OptionButton.new()
	side_opt.add_item("执汉", 0)
	side_opt.add_item("执匈奴", 1)
	side_opt.tooltip_text = "选择新局阵营，点击『新局』生效"
	th.add_child(side_opt)
	faction_option = side_opt
	var iv = OptionButton.new()
	iv.add_item("月制", 0)
	iv.add_item("季制", 1)
	iv.tooltip_text = "选择新局节奏，点击『新局』生效"
	th.add_child(iv)
	interval_option = iv
	var nb = Button.new()
	nb.text = "新局"
	nb.pressed.connect(func(): new_game("han" if side_opt.selected == 0 else "xiongnu", 3 if iv.selected == 0 else 9))
	th.add_child(nb)
	var sb = Button.new()
	sb.text = "存档"
	sb.pressed.connect(save_game)
	th.add_child(sb)
	var lb = Button.new()
	lb.text = "读档"
	lb.pressed.connect(load_game)
	th.add_child(lb)
	end_btn = Button.new()
	end_btn.text = "结束回合 ▶"
	end_btn.add_theme_font_size_override("font_size", 16)
	end_btn.pressed.connect(end_turn)
	th.add_child(end_btn)
	var info = HBoxContainer.new()
	info.add_theme_constant_override("separation", 20)
	top_rows.add_child(info)
	top_label = RichTextLabel.new()
	top_label.bbcode_enabled = true
	top_label.fit_content = true
	top_label.scroll_active = false
	top_label.custom_minimum_size = Vector2(550, 25)
	top_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	info.add_child(top_label)
	goal_label = Label.new()
	goal_label.add_theme_color_override("font_color", GOLD)
	info.add_child(goal_label)
	# 逐日回放控制：结算时禁止改令，地图仍可缩放/拖动。
	replay_controls = [side_opt, iv, nb, sb, lb, end_btn]
	replay_bar = HBoxContainer.new()
	replay_bar.visible = false
	root.add_child(replay_bar)
	replay_label = Label.new()
	replay_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	replay_bar.add_child(replay_label)
	replay_pause_btn = _btn("暂停", func():
		replay_paused = not replay_paused
		replay_pause_btn.text = "继续" if replay_paused else "暂停")
	replay_bar.add_child(replay_pause_btn)
	for speed in [1.0, 4.0]:
		var playback_speed: float = speed
		replay_bar.add_child(_btn("×%d" % int(speed), func(): replay_speed = playback_speed))
	replay_bar.add_child(_btn("下一事件", func():
		replay_next_event = true
		replay_paused = false
		replay_pause_btn.text = "暂停"))
	replay_bar.add_child(_btn("跳过回放", func(): replay_skip = true))
	# 主体
	var body = HSplitContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(body)
	map_view = MapView.new()
	map_view.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	map_view.custom_minimum_size = Vector2(600, 300)
	map_view.node_clicked.connect(_on_node_clicked)
	map_view.army_clicked.connect(_on_army_clicked)
	body.add_child(map_view)
	var sp = PanelContainer.new()
	sp.add_theme_stylebox_override("panel", _flat(PANEL))
	sp.custom_minimum_size = Vector2(410, 0)
	body.add_child(sp)
	var inspector = VBoxContainer.new()
	inspector.add_theme_constant_override("separation", 12)
	sp.add_child(inspector)
	var hero = Control.new()
	hero.custom_minimum_size = Vector2(360, 104)
	hero.clip_contents = true
	inspector.add_child(hero)
	var art = TextureRect.new()
	art.texture = FRONTIER_ART
	art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	art.set_anchors_preset(Control.PRESET_FULL_RECT)
	art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hero.add_child(art)
	var hero_title = Label.new()
	hero_title.text = "西 域 战 局\n军政与后勤"
	hero_title.position = Vector2(15, 19)
	hero_title.add_theme_font_size_override("font_size", 20)
	hero_title.add_theme_color_override("font_color", Color("f4e7c8"))
	hero_title.add_theme_color_override("font_shadow_color", Color("151916"))
	hero_title.add_theme_constant_override("shadow_offset_x", 1)
	hero_title.add_theme_constant_override("shadow_offset_y", 2)
	hero.add_child(hero_title)
	side_scroll = ScrollContainer.new()
	side_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	side_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	inspector.add_child(side_scroll)
	side_blocker = Control.new()
	side_blocker.set_anchors_preset(Control.PRESET_FULL_RECT)
	side_blocker.mouse_filter = Control.MOUSE_FILTER_STOP
	side_blocker.visible = false
	sp.add_child(side_blocker)
	side = VBoxContainer.new()
	side.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	side.add_theme_constant_override("separation", 9)
	side_scroll.add_child(side)
	# 状态行 + 战报
	status_label = Label.new()
	status_label.add_theme_color_override("font_color", RED)
	root.add_child(status_label)
	var lp = PanelContainer.new()
	lp.add_theme_stylebox_override("panel", _flat(PANEL))
	lp.custom_minimum_size = Vector2(0, 122)
	root.add_child(lp)
	log_box = RichTextLabel.new()
	log_box.bbcode_enabled = true
	log_box.scroll_following = true
	var log_rows = VBoxContainer.new()
	lp.add_child(log_rows)
	var log_title = Label.new()
	log_title.text = "军 情  ·  本 回 合 战 报"
	log_title.add_theme_color_override("font_color", GOLD)
	log_title.add_theme_font_size_override("font_size", 13)
	log_rows.add_child(log_title)
	log_box.size_flags_vertical = Control.SIZE_EXPAND_FILL
	log_rows.add_child(log_box)

func _flat(c: Color) -> StyleBoxFlat:
	var b = StyleBoxFlat.new()
	b.bg_color = c
	b.content_margin_left = 12
	b.content_margin_right = 12
	b.content_margin_top = 10
	b.content_margin_bottom = 10
	b.border_color = Color("65583b")
	b.set_border_width_all(1)
	b.set_corner_radius_all(4)
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
	map_view.state = state
	map_view.fit()
	log_box.clear()
	_log("[b]西域策略 · 前119年[/b]　你执【%s】。点击地图上的城市或军队开始。红色军旗为汉军，棕色为匈奴；金色粗线是畅通的商路。" % state.factions[f]["name"])
	_log("目标：" + _goal_text())
	_log("城市颜色：独立国家各有本国色，同国城市同色；浅红为汉属国、浅棕为匈奴属国，直接占领为宗主国深色。")
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

func end_turn() -> void:
	if state.winner != "" or replaying:
		return
	var all = {player: orders.duplicate()}
	state.decision_ticks = decision_ticks
	if player == "han":
		all["xiongnu"] = ai_xn.think(state)
	else:
		all["han"] = ai_han.think(state)
	var head = "[color=#c8aa6a][b]—— %s ——[/b][/color]" % state.date_text()
	var replay_state = GS.new()
	replay_state.from_save(state.to_save())
	replaying = true
	side_blocker.visible = true
	side.mouse_filter = Control.MOUSE_FILTER_IGNORE
	side_scroll.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for control in replay_controls:
		control.disabled = true
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
			_log("[color=#a5ae97]命令未执行：%s（%s）[/color]" % [r["cmd"]["type"], r["why"]])
	orders.clear()
	drafts.clear()
	pick = {}
	replaying = false
	side_blocker.visible = false
	for control in replay_controls:
		control.disabled = false
	side.mouse_filter = Control.MOUSE_FILTER_PASS
	side_scroll.mouse_filter = Control.MOUSE_FILTER_STOP
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
	var col := "#e8debf"
	match e["kind"]:
		"battle":
			col = "#edab83"
			var w: String = e["report"]["where"]
			if state.nodes.has(w):
				map_view.flash[w] = 90
		"capture":
			col = "#edab83"
			map_view.flash[e["node"]] = 120
		"defect":
			col = "#90bdb5"
		"diplomacy":
			col = "#c5abc9"
		"trigger", "evade":
			col = "#90bdb5"
		"starve", "rout", "convoy":
			col = "#dab469"
		"victory":
			col = "#edab83"
		"ai":
			col = "#a5ae97"
	_log("[color=%s]%s　%s[/color]" % [col, e["date"], e["text"]])

func _set_status(t: String) -> void:
	status_label.text = t

# ---------------- 交互 ----------------
func _on_node_clicked(id: String) -> void:
	if replaying:
		return
	if not pick.is_empty():
		_resolve_pick(id)
		return
	sel_node = id
	map_view.selected_node = id
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
	refresh()
	side_scroll.scroll_vertical = 0

func _start_pick(p: Dictionary, hint: String) -> void:
	if pick == p:
		pick = {}
		_set_status("已取消选点。")
		return
	pick = p
	_set_status("▶ " + hint + "（点击地图上的节点；再次点击同一按钮取消）")

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
	_set_status("已加入本回合命令（%d 条）。点击『结束回合』执行。" % orders.size())
	refresh()

# ---------------- 刷新 ----------------
func refresh() -> void:
	_refresh_top()
	_refresh_side()
	map_view.selected_node = sel_node
	map_view.selected_army = sel_army
	map_view.preview_path = _preview_path()
	map_view.queue_redraw()
	end_btn.text = ("结束回合 ▶（%s）" % ("季" if decision_ticks == 9 else "月")) if state.winner == "" else "对局结束"

func _fmt(n: float) -> String:
	if absf(n) >= 100000.0:
		return "%.1f万" % (n / 10000.0)
	if absf(n) >= 10000.0:
		return "%.2f万" % (n / 10000.0)
	return str(int(n))

func _refresh_top() -> void:
	var f: Dictionary = state.factions[player]
	var t = "[b]%s[/b]　%s季　" % [state.date_text(), Cal.season_cn(state.season())]
	if state.is_winter():
		t += "[color=#90bdb5]（冬：山道封闭）[/color]　"
	t += "钱 [b]%d[/b]" % f["money"]
	if player == "han":
		t += "　中央军池 步%s 弩%s 骑%s" % [_fmt(state.central.get("infantry", 0)), _fmt(state.central.get("crossbow", 0)), _fmt(state.central.get("cavalry", 0))]
	top_label.text = ""
	top_label.append_text(t)
	if player == "han":
		goal_label.text = "属国 %d/11　乌垒%s 车师前%s　连续 %d/12 月" % [Victory.han_vassals(state), "✓" if state.relations["wu_lei"]["overlord"] == "han" else "✗", "✓" if state.relations["cheshi_qian"]["overlord"] == "han" else "✗", state.streak["han"]]
	else:
		goal_label.text = "河西四郡 %d/4　连续 %d/6 月" % [Victory.hexi_held_by_xn(state), state.streak["xiongnu"]]

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

# ---------------- 侧栏 ----------------
func _clear_side() -> void:
	for c in side.get_children():
		side.remove_child(c)
		c.queue_free()

func _lbl(t: String, bold := false, col := INK, wrap := true) -> Label:
	var l = Label.new()
	l.text = t
	l.add_theme_color_override("font_color", col)
	if wrap:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.custom_minimum_size = Vector2(340, 0)
	if bold:
		l.add_theme_font_size_override("font_size", 17)
	return l

func _btn(t: String, cb: Callable, why := "") -> Button:
	var b = Button.new()
	b.text = t
	b.pressed.connect(cb)
	if why != "":
		b.disabled = true
		b.tooltip_text = why
		b.text = t
	return b

func _row(items: Array) -> HFlowContainer:
	var h = HFlowContainer.new()
	h.add_theme_constant_override("h_separation", 5)
	h.add_theme_constant_override("v_separation", 4)
	for i in items:
		h.add_child(i)
	return h

func _bar(label: String, v: float, vmax: float, col: Color) -> Control:
	var h = HBoxContainer.new()
	var l = Label.new()
	l.text = label
	l.custom_minimum_size = Vector2(62, 0)
	h.add_child(l)
	var pb = ProgressBar.new()
	pb.max_value = vmax
	pb.value = v
	pb.show_percentage = false
	pb.custom_minimum_size = Vector2(190, 16)
	pb.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var fill = StyleBoxFlat.new()
	fill.bg_color = col
	pb.add_theme_stylebox_override("fill", fill)
	var back = StyleBoxFlat.new()
	back.bg_color = Color("cbb98c")
	pb.add_theme_stylebox_override("background", back)
	h.add_child(pb)
	var n = Label.new()
	n.text = " %d" % int(v)
	h.add_child(n)
	return h

func _sep() -> HSeparator:
	return HSeparator.new()

func _refresh_side() -> void:
	_clear_side()
	if not pick.is_empty():
		var cancel = _btn("取消取点", func():
			pick = {}
			_set_status("")
			refresh())
		side.add_child(cancel)
	if sel_army != "" and state.armies.has(sel_army):
		_army_section(state.armies[sel_army])
		side.add_child(_sep())
	elif sel_army != "":
		sel_army = ""
	if sel_node != "":
		_node_section(state.nodes[sel_node])
	side.add_child(_sep())
	_orders_section()

func _ctl_text(n: Dictionary) -> String:
	var ctl: String = state.controller(n)
	if n["faction"] == "han" or n["faction"] == "xiongnu":
		return "直辖 · " + state.factions[n["faction"]]["name"]
	var rel = state.relations.get(n["faction"], {})
	var k = "大国" if state.kind_of(n["faction"]) == "great" else "城邦"
	if ctl == "":
		return "%s（%s）· 独立" % [state.factions[n["faction"]]["name"], k]
	return "%s（%s）· %s属国" % [state.factions[n["faction"]]["name"], k, state.factions[ctl]["name"]]

func _node_section(n: Dictionary) -> void:
	side.add_child(_lbl(n["name"], true))
	side.add_child(_lbl(_ctl_text(n), false, Color("b8b195")))
	var stock_f: String = state.controller(n) if state.controller(n) != "" else n["faction"]
	var info = "人口 %s　存粮 %s" % [_fmt(n["pop"]), _fmt(n["grain"])]
	if n["depot"].get("han", 0) > 0 and n["faction"] != "han":
		info += "（汉仓 %s）" % _fmt(n["depot"]["han"])
	if n["pasture_cap"] > 0:
		info += "　马 %s/%s" % [_fmt(n["horses"]), _fmt(n["pasture_cap"])]
	side.add_child(_lbl(info))
	if n["farm_cap"] > 0:
		side.add_child(_lbl("农田 %s×开垦 %d%%　年产约 %s" % [_fmt(n["farm_cap"]), int(n["farm_dev"] * 100), _fmt(preload("res://core/economy.gd").farm_output_year(state, n))]))
	if n["walls"] > 0:
		side.add_child(_bar("城墙", n["wall_hp"], maxf(n["wall_hp_max"], 1.0), Color("7a6a50")))
	if n["colonies"] > 0:
		side.add_child(_lbl("屯田民 %s" % _fmt(n["colonies"])))
	if n["under_siege_by"] != "":
		side.add_child(_lbl("被%s围困" % state.factions[n["under_siege_by"]]["name"], true, RED))
	var mil = 0
	for t in n["militia"]:
		mil += int(n["militia"][t])
	if mil > 0:
		side.add_child(_lbl("本地民兵 %s" % _fmt(mil)))
	var here = state.armies_at(n["id"])
	if not here.is_empty():
		var parts = []
		var totals := {}
		for a in here:
			var label: String = state.factions[a["faction"]]["name"] + ("运输" if a["is_convoy"] else "军")
			totals[label] = totals.get(label, 0) + state.army_size(a) + (a["laborers"] if a["is_convoy"] else 0)
		for label in totals:
			parts.append("%s %s" % [label, _fmt(totals[label])])
		side.add_child(_lbl("驻军：" + "；".join(parts)))
		var army_picker = OptionButton.new()
		army_picker.add_item("选择本城军队（%d 支）" % here.size())
		var army_ids: Array[String] = []
		for a in here:
			army_ids.append(a["id"])
			army_picker.add_item("%s · %s 人" % [a["name"], _fmt(state.army_size(a) + (a["laborers"] if a["is_convoy"] else 0))])
		army_picker.item_selected.connect(func(i):
			if i > 0:
				_on_army_clicked(army_ids[i - 1]))
		side.add_child(army_picker)
	var sid: String = n["faction"]
	if state.relations.has(sid):
		var rel: Dictionary = state.relations[sid]
		side.add_child(_bar("汉影响力", rel["han_influence"], 100, Color("c67861")))
		side.add_child(_bar("匈奴威吓", rel["xn_intimidation"], 100, Color("ccad7e")))
		side.add_child(_bar("对匈怨恨", rel["xn_resentment"], 100, Color("cbaa62")))
		var st = "宗主：" + (state.factions[rel["overlord"]]["name"] if rel["overlord"] != "" else "无")
		if rel["han_status"] == "enfeoffed":
			st += "　已受汉册封"
		if rel["overlord"] == "xiongnu":
			st += "　税率 %d" % rel["tax_level"]
		if rel.get("wants_han", false):
			st += "　【有意内附】"
		side.add_child(_lbl(st))
		var open_n := false
		for tr in state.trade_routes:
			if n["id"] in Trade.open_prefix(state, tr):
				open_n = true
		side.add_child(_lbl("商路：" + ("畅通 +1.5影响力/月" if open_n else "未通"), false, Color("d5bb7b") if open_n else Color("999d8e")))
		_diplomacy_actions(n, sid)
	_economy_actions(n)

func _can(c: Dictionary) -> String:
	return Cmd.validate(state, c)

func _update_command_button(button: Button, command: Dictionary) -> void:
	var why = _can(command)
	button.disabled = why != ""
	button.tooltip_text = why

func _diplomacy_actions(n: Dictionary, sid: String) -> void:
	side.add_child(_sep())
	side.add_child(_lbl("外交", true))
	if player == "han":
		var sp = SpinBox.new()
		sp.min_value = 1
		sp.max_value = 30
		sp.value = gift_units
		sp.suffix = "份（每份100钱）"
		side.add_child(sp)
		var gain = Diplomacy.gift_gain(state, state.relations[sid], gift_units)
		var gc = Cmd.make("gift", "han", {"state": sid, "units": gift_units})
		var gift_button = _btn("赏赐 (+%.0f 影响力)" % gain, func(): queue(gc), _can(gc))
		sp.value_changed.connect(func(v):
			gift_units = int(v)
			gc["units"] = gift_units
			gift_button.text = "赏赐 (+%.0f 影响力)" % Diplomacy.gift_gain(state, state.relations[sid], gift_units)
			_update_command_button(gift_button, gc))
		side.add_child(_row([
			gift_button,
			_btn("册封", func(): queue(Cmd.make("enfeoff", "han", {"state": sid})), Diplomacy.can_enfeoff(state, sid)),
			_btn("纳为属国", func(): queue(Cmd.make("make_vassal", "han", {"state": sid})), Diplomacy.can_vassal(state, sid)),
		]))
		var bg = Cmd.make("buy_grain", "han", {"node": n["id"], "amount": 20000})
		side.add_child(_row([_btn("购粮 2万斛", func(): queue(bg), _can(bg))]))
	else:
		var rel = state.relations[sid]
		var items = [_btn("令其臣服", func(): queue(Cmd.make("demand_vassal", "xiongnu", {"state": sid})), Diplomacy.can_demand(state, sid))]
		if rel["overlord"] == "xiongnu":
			for lvl in 4:
				var tc = Cmd.make("set_tax", "xiongnu", {"state": sid, "level": lvl})
				items.append(_btn("税率%d%s" % [lvl, "●" if rel["tax_level"] == lvl else ""], func(): queue(tc)))
		side.add_child(_row(items))

func _economy_actions(n: Dictionary) -> void:
	side.add_child(_sep())
	side.add_child(_lbl("经济与征召", true))
	var items = []
	if player == "han":
		var ef = Cmd.make("expand_farm", "han", {"node": n["id"]})
		items.append(_btn("扩大屯田 (200钱)", func(): queue(ef), _can(ef)))
	side.add_child(_row(items))
	var sp = SpinBox.new()
	sp.min_value = 500
	sp.max_value = 20000
	sp.step = 500
	sp.value = recruit_amount
	sp.suffix = " 人"
	var recruit_buttons: Array = []
	sp.value_changed.connect(func(v):
		recruit_amount = int(v)
		for entry in recruit_buttons:
			for unit in entry["command"]["units"]:
				entry["command"]["units"][unit] = recruit_amount
			_update_command_button(entry["button"], entry["command"]))
	side.add_child(sp)
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
	side.add_child(_row(rb))
	if player == "han" and state.is_supply_node(n, "han"):
		_convoy_section(n)

func _convoy_command(n: Dictionary) -> Dictionary:
	return Cmd.make("convoy", "han", {"from": n["id"], "to": convoy["to"] if convoy["to"] != "" else n["id"], "grain": convoy["grain"], "laborers": convoy["laborers"], "loop": convoy.get("loop", false), "stay": convoy.get("stay", false)})

func _convoy_section(n: Dictionary) -> void:
	side.add_child(_lbl("运输队（征民夫，满载可运 %d 斛/人）" % state.bal["food"]["laborer_carry"], false, Color("b8b195")))
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
	side.add_child(_row([l1, l2]))
	var mode = OptionButton.new()
	for label in ["运达后返回", "循环运输", "运达后留驻（可设屯田区）"]:
		mode.add_item(label)
	mode.select(1 if convoy.get("loop", false) else (2 if convoy.get("stay", false) else 0))
	side.add_child(mode)
	var tname = state.nodes[convoy["to"]]["name"] if convoy["to"] != "" else "（未选）"
	var send = _btn("发运", func(): queue(_convoy_command(n)))
	side.add_child(_row([
		_btn("目的地：" + tname, func(): _start_pick({"kind": "convoy_to"}, "选择运输队目的地")), send,
	]))
	var estimate = _lbl("")
	side.add_child(estimate)
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
	side.add_child(_lbl("%s%s" % [a["name"], "（运输队）" if a["is_convoy"] else ""], true, RED if a["faction"] == "han" else Color("ccad7e")))
	var u = []
	for t in a["units"]:
		if a["units"][t] > 0:
			u.append("%s %s" % [state.units[t]["name"], _fmt(a["units"][t])])
	if a["laborers"] > 0:
		u.append("民夫 %s" % _fmt(a["laborers"]))
	side.add_child(_lbl("　".join(u) if not u.is_empty() else "（空）"))
	var tm = Supply.t_max(state, a)
	var info = "携粮 %s/%s　马 %s　可支撑 %.1f 月" % [_fmt(a["grain"]), _fmt(Supply.carry_cap(state, a)), _fmt(a["horses"]), tm]
	side.add_child(_lbl(info, false, RED if tm < 1.0 and not a["is_convoy"] else INK))
	var loc = "位于 " + state.nodes[a["loc"]["node"]]["name"] if a["loc"].has("node") else "行军 %s→%s (%d%%)" % [state.nodes[a["loc"]["from"]]["name"], state.nodes[a["loc"]["to"]]["name"], int(a["loc"]["prog"] * 100)]
	var status_names := {"idle": "待命", "moving": "行军", "holding": "驻守", "sieging": "围攻", "ambushing": "设伏", "blocked": "道路受阻"}
	side.add_child(_lbl("%s　速度 %.1f　状态 %s%s" % [loc, Combat.army_speed(state, a), status_names.get(a["status"], a["status"]), "　断粮！" if a["starving"] > 0 else ""]))
	if a["faction"] != player:
		return
	# 计划编辑
	var d = _draft(a)
	side.add_child(_lbl("行动计划", true))
	if d["steps"].is_empty():
		side.add_child(_lbl("（无：原地待命）", false, Color("999d8e")))
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
		side.add_child(h)
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
			side.add_child(duration)
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
			side.add_child(_row([limit, threshold]))
		if s["type"] == "ambush":
			var ro = OptionButton.new()
			var routes: Array = state.adj[s["node"]]
			for ri in routes.size():
				var route: Dictionary = state.routes[routes[ri]]
				ro.add_item("设伏道路：" + state.nodes[route["a"]]["name"] + "—" + state.nodes[route["b"]]["name"])
				if routes[ri] == s["route"]:
					ro.select(ri)
			ro.item_selected.connect(func(ri): s["route"] = routes[ri])
			side.add_child(ro)
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
			side.add_child(duration)
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
	side.add_child(_row(add))
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
	side.add_child(po)
	side.add_child(_lbl(_preset_text(d["preset"]), false, Color("b8b195")))
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
		side.add_child(_lbl("预演：行军与限时行动最多约 %d 天（%.1f 月）；携粮可支撑 %.1f 月%s" % [ceili(days), months, tm, "" if ok else " —— 粮不足，需沿途补给或加载" ], false, INK if ok else RED))
		side.add_child(_lbl("含计时驻守、设伏及围攻上限；沿途补给、战斗与冬季封路等待另计。无限驻守将停在该步骤。", false, Color("b8b195")))
	var apply = _btn("提交计划", func():
		queue(Cmd.make("set_plan", player, {"army": a["id"], "steps": d["steps"].duplicate(true), "preset": d["preset"]}))
		sel_army = a["id"])
	side.add_child(apply)
	# 装载
	if a["loc"].has("node") and state.is_supply_node(state.nodes[a["loc"]["node"]], player):
		var lc = Cmd.make("load", player, {"army": a["id"], "grain": Supply.carry_cap(state, a) - a["grain"], "laborers": 0})
		var lc2 = Cmd.make("load", player, {"army": a["id"], "grain": 1000000, "laborers": 2000})
		var row = [_btn("补满粮食", func(): queue(lc), _can(lc))]
		if player == "han":
			row.append(_btn("+2000民夫并装满", func(): queue(lc2), _can(lc2)))
		side.add_child(_row(row))
	side.add_child(_row([_btn("解散", func(): queue(Cmd.make("disband", player, {"army": a["id"]})))]))
	if a["is_convoy"] and a["loc"].has("node"):
		var fc = Cmd.make("found_colony", player, {"node": a["loc"]["node"], "army": a["id"]})
		side.add_child(_row([_btn("在此设立屯田区", func(): queue(fc), _can(fc))]))

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

func _orders_section() -> void:
	side.add_child(_lbl("本回合命令（%d）" % orders.size(), true))
	if orders.is_empty():
		side.add_child(_lbl("（尚无）", false, Color("999d8e")))
	for i in orders.size():
		var c: Dictionary = orders[i]
		var h = HBoxContainer.new()
		var l = Label.new()
		l.text = _order_text(c)
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.custom_minimum_size = Vector2(300, 0)
		h.add_child(l)
		var x = Button.new()
		x.text = "✕"
		var idx = i
		x.pressed.connect(func():
			orders.remove_at(idx)
			refresh())
		h.add_child(x)
		side.add_child(h)

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
