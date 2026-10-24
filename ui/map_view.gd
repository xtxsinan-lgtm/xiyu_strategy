extends Control
# 节点图地图：节点=城市/部领，边=商路（也是行军路线）。只读 GameState；点击通过信号交给 main。
# 舆图画框（docs/ui_desk_spec.md §5）：框带 + 天干地支方格 + 题签 + 指北 + 绢色罩与暗角。

const ARMY_ICON = preload("res://assets/icons/standard.svg")
const CONVOY_ICON = preload("res://assets/icons/convoy.svg")
const CITY_ICON = preload("res://assets/icons/city.svg")
const NOMAD_ICON = preload("res://assets/icons/nomad.svg")
const Fonts = preload("res://ui/font_provider.gd")
const Desk = preload("res://ui/desk_theme.gd")
const ATLAS = preload("res://assets/art/western-regions-atlas-v2.png")
const LAYOUT_PATH = "res://data/map_presentation.json"
const Trade = preload("res://core/trade.gd")

signal node_clicked(id: String)
signal army_clicked(id: String)

var layout: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(LAYOUT_PATH))
var _curve_cache := {}
var hovered_node := ""
var hovered_route := -1
var state = null
var replay_from := {}
var replay_progress := 1.0
var selected_node := ""
var selected_army := ""
var preview_path: Array = []   # 计划预览：节点 id 序列
var preview_color := Color(1.0, 0.85, 0.2)
var flash: Dictionary = {}     # node id -> 剩余帧
var show_trade := true
var show_grid := true          # 「计里画方」墨线
var show_regions := true       # 区域地名
var zoom := 1.0
var pan := Vector2.ZERO
var _drag := false
var _drag_moved := false
var _army_rects: Array = []    # [{rect, id}]
var _font: Font
var _title_font: Font

const C_HAN = Color("c0392b")
const C_XN = Color("5d4037")
const C_HAN_V = Color("e08a80")
const C_XN_V = Color("a1887f")
const C_PASS = Color("b8b8b8")
const C_JUNCTION = Color("8a7550")
const BG = Color("d9c8a3")
const SILK_WASH = Color(0.949, 0.890, 0.729, 0.30)
const FRAME_INSET = 8.0
const FRAME_BAND = 22.0
const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]
const GRID_COL = 100.0         # 世界坐标每 100 单位一列
const GRID_ROWS = 6            # 画布高度分 6 行
# 固定到国家 id：同国同色，读档、回放及脱离宗主国后仍恢复原色。
const STATE_COLORS = {
	"dong_qiemi": Color("d99032"),
	"cheshi_qian": Color("287c8e"),
	"cheshi_hou": Color("835cad"),
	"yan_qi": Color("559b48"),
	"wei_li": Color("c45c91"),
	"wu_lei": Color("4668b5"),
	"lun_tai": Color("9a9d30"),
	"qiu_ci": Color("25977a"),
	"gu_mo": Color("ba7037"),
	"wen_su": Color("bd4770"),
	"shu_le": Color("5a479b"),
	"sha_che": Color("a47cba"),
	"yu_tian": Color("e0b13e"),
	"jing_jue": Color("679baa"),
	"qie_mo": Color("a9b75c"),
	"lou_lan": Color("d46b43"),
	"juan_du": Color("4b7440"),
	"xiu_xun": Color("8d5d78"),
	"dawan": Color("3566cf"),
	"kangju": Color("6d8a24"),
	"dayuezhi": Color("a343b5"),
	"jibin": Color("367064"),
	"wusun": Color("26aaa3"),
}

func _ready() -> void:
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_STOP
	_font = Fonts.body_font()
	_title_font = Desk.title_font()

func fit() -> void:
	zoom = 1.0
	pan = Vector2.ZERO
	queue_redraw()

## 以视图中心为锚缩放（镜头按钮用）。
func zoom_step(f: float) -> void:
	_zoom_at(size * 0.5, f)

## 把世界坐标移到视图中心；min_zoom > 0 时同时放大到至少该倍数。
func center_on(world: Vector2, min_zoom := 0.0) -> void:
	if min_zoom > 0.0:
		zoom = clampf(maxf(zoom, min_zoom), 0.6, 4.0)
	var area := Vector2(layout["canvas"][0], layout["canvas"][1]) * _base_scale()
	pan = size * 0.5 - world * (_base_scale() * zoom) - (size - area) * 0.5
	queue_redraw()

## 框带内侧（地图可视区）。
func inner_rect() -> Rect2:
	return Rect2(Vector2.ZERO, size).grow(-(FRAME_INSET + FRAME_BAND))

func _base_scale() -> float:
	return minf(size.x / float(layout["canvas"][0]), size.y / float(layout["canvas"][1]))

func to_screen(p: Vector2) -> Vector2:
	var s := _base_scale() * zoom
	var area := Vector2(layout["canvas"][0], layout["canvas"][1]) * _base_scale()
	return p * s + (size - area) * 0.5 + pan

func node_world_pos(id: String) -> Vector2:
	var p: Array = layout["positions"].get(id, state.nodes[id]["pos"])
	return Vector2(p[0], p[1])

func node_pos(id: String) -> Vector2:
	return to_screen(node_world_pos(id))

func route_curve(route: Dictionary) -> Curve2D:
	var key: String = route["a"] + "|" + route["b"]
	if _curve_cache.has(key):
		return _curve_cache[key]
	var points: Array = [node_world_pos(route["a"])]
	for p in layout["waypoints"].get(key, []):
		points.append(Vector2(p[0], p[1]))
	points.append(node_world_pos(route["b"]))
	var curve = Curve2D.new()
	curve.bake_interval = 3.0
	for i in points.size():
		var tangent := Vector2.ZERO
		if i > 0 and i < points.size() - 1:
			tangent = (points[i + 1] - points[i - 1]) * 0.15
		curve.add_point(points[i], -tangent, tangent)
	_curve_cache[key] = curve
	return curve

func route_screen_points(route: Dictionary) -> PackedVector2Array:
	var points := PackedVector2Array()
	for p in route_curve(route).get_baked_points():
		points.append(to_screen(p))
	return points

func _road(route: Dictionary, color: Color, width: float, dashed := false) -> void:
	var points = route_screen_points(route)
	if not dashed:
		draw_polyline(points, color, width, true)
		return
	var traveled := 0.0
	for i in range(1, points.size()):
		var a: Vector2 = points[i - 1]
		var b: Vector2 = points[i]
		if fmod(traveled, 12.0) < 7.5:
			draw_line(a, b, color, width, true)
		traveled += a.distance_to(b)

func _route_at(p: Vector2) -> int:
	var closest := -1
	var distance := 7.0
	for i in state.routes.size():
		var points = route_screen_points(state.routes[i])
		for j in range(1, points.size()):
			var d := p.distance_to(Geometry2D.get_closest_point_to_segment(p, points[j - 1], points[j]))
			if d < distance:
				distance = d
				closest = i
	return closest

func node_color(n: Dictionary) -> Color:
	var f: String = n["faction"]
	if f == "han":
		return C_HAN
	if f == "xiongnu":
		return C_XN
	if n["type"] == "pass":
		return C_PASS
	if n["type"] == "junction":
		return C_JUNCTION
	var ctl: String = state.controller(n)
	if ctl == "han":
		return C_HAN_V
	if ctl == "xiongnu":
		return C_XN_V
	if STATE_COLORS.has(f):
		return STATE_COLORS[f]
	# 新增国家或旧存档中的额外势力也有稳定颜色，不依赖遍历顺序或 RNG。
	var hue := float(f.sha256_buffer().decode_u16(0)) / 65536.0
	return Color.from_hsv(hue, 0.6, 0.72)

func _process(_dt: float) -> void:
	if not flash.is_empty():
		for k in flash.keys():
			flash[k] -= 1
			if flash[k] <= 0:
				flash.erase(k)
		queue_redraw()

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), BG)
	var map_rect = Rect2(to_screen(Vector2.ZERO), Vector2(layout["canvas"][0], layout["canvas"][1]) * _base_scale() * zoom)
	draw_texture_rect(ATLAS, map_rect, false)
	draw_rect(map_rect, SILK_WASH)
	if show_grid:
		_draw_grid()
	if state != null:
		_draw_world()
	_draw_vignette()
	_draw_frame()
	_draw_cartouche()
	_draw_compass()

func _draw_world() -> void:
	_army_rects.clear()
	var s := _base_scale() * zoom
	# 区域地名
	if show_regions:
		_draw_region_labels(s)
	# 商路高亮
	if show_trade:
		for tr in state.trade_routes:
			var open: Array = Trade.open_prefix(state, tr)
			for i in range(1, open.size()):
				var a: String = open[i - 1]
				var b: String = open[i]
				if state.route_between(a, b) >= 0:
					_road(state.routes[state.route_between(a, b)], Color(0.91, 0.70, 0.25, 0.85), 5.0 * minf(s, 1.5) + 1.0)
	# 边
	for r in state.routes:

		var col := Color("6b4f2a")
		var dashed := false
		match r["terrain"]:
			"steppe":
				col = Color("5f8f4a")
			"desert":
				col = Color("b8893c")
				dashed = true
			"mountain":
				col = Color("7a7a7a")
				dashed = true
			"hazard":
				col = Color("a33a2a")
				dashed = true
		if r["closed_in_winter"] and state.is_winter():
			col = col.lerp(Color("c9c9c9"), 0.7)
		if r["raided_by"] != "":
			col = Color("d02020")
		if dashed:
			_road(r, col, 1.6, true)
		else:
			_road(r, Color(0.98, 0.94, 0.82, 0.8), 3.6)
			_road(r, col, 1.6)
	if hovered_route >= 0 and hovered_route < state.routes.size():
		_road(state.routes[hovered_route], Color("f5e7aa"), 5.5)
		_road(state.routes[hovered_route], Color("704921"), 2.5)
	# 计划预览
	if preview_path.size() >= 2:
		for i in range(1, preview_path.size()):
			var ridx: int = state.route_between(preview_path[i - 1], preview_path[i])
			if ridx >= 0:
				_road(state.routes[ridx], preview_color, 3.5, true)
	# 节点
	for id in state.nodes:
		var n: Dictionary = state.nodes[id]
		var p := node_pos(id)
		var rad := 9.0
		match n["type"]:
			"source":
				rad = 12.0
			"pass":
				rad = 6.0
			"junction":
				rad = 4.0
			"nomad":
				rad = 10.0
		rad *= clampf(sqrt(zoom), 0.8, 1.6)
		if flash.has(id):
			draw_circle(p, rad + 12.0, Color(1.0, 0.5, 0.1, 0.5))
		if n["under_siege_by"] != "":
			draw_arc(p, rad + 6.0, 0, TAU, 24, Color("d02020"), 3.0)
		if id == selected_node:
			draw_arc(p, rad + 4.0, 0, TAU, 24, Color("ffffff"), 3.0)
		draw_circle(p + Vector2(0, 2), rad + 2, Color(0.15, 0.11, 0.08, 0.25))
		draw_circle(p, rad + 1.5, Color("eed4a0"))
		draw_circle(p, rad, node_color(n))
		draw_arc(p, rad, 0, TAU, 20, Color("2a1d10"), 1.5)
		if n["type"] not in ["pass", "junction"]:
			draw_texture_rect(NOMAD_ICON if n["type"] == "nomad" else CITY_ICON, Rect2(p - Vector2(6, 6), Vector2(12, 12)), false)
		var label: String = n["name"]
		var fs := int(clampf(14.0 * sqrt(zoom), 12.0, 20.0))
		if n["type"] == "junction":
			fs = int(clampf(11.0 * sqrt(zoom), 10.0, 16.0))
		var tw := _font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		var label_pos := p + Vector2(-tw * 0.5, rad + fs + 2)
		draw_style_box(_label_box(id == selected_node), Rect2(label_pos - Vector2(5, fs - 1), Vector2(tw + 10, fs + 7)))
		draw_string(_font, label_pos, label, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color("251c13"))
	# 图标与道路上的实际位置用连线连接，避免误认为已抵达城市。
	for id in state.armies:
		var a: Dictionary = state.armies[id]
		var anchor := army_position(a, state.armies)
		if replay_from.has(id):
			anchor = to_screen(replay_from[id]).lerp(to_screen(army_world_position(a, state.armies)), replay_progress)
		var pos := anchor + Vector2(0, -24)
		draw_line(anchor, pos + Vector2(0, 16), Color("6b4f2a"), 1.0)
		draw_circle(anchor, 3.0, C_HAN if a["faction"] == "han" else C_XN)
		_draw_army(a, pos)

func army_world_position(a: Dictionary, armies: Dictionary) -> Vector2:
	var loc: Dictionary = a["loc"]
	if loc.has("node"):
		var p := node_world_pos(loc["node"])
		var k := 0
		for id in armies:
			if id == a["id"]:
				break
			if armies[id]["loc"].get("node", "") == loc["node"]:
				k += 1
		return p + Vector2(19 + (k % 3) * 42, -(k / 3) * 45)
	var route: Dictionary = state.routes[loc["route"]]
	var curve := route_curve(route)
	var progress: float = loc["prog"] if route["a"] == loc["from"] else 1.0 - loc["prog"]
	return curve.sample_baked(curve.get_baked_length() * progress)

func army_position(a: Dictionary, armies: Dictionary) -> Vector2:
	return to_screen(army_world_position(a, armies))

func show_day(frame: Dictionary) -> void:
	replay_from.clear()
	for id in state.armies:
		replay_from[id] = army_world_position(state.armies[id], state.armies)
	for key in ["tick", "day_offset", "armies", "nodes", "relations", "routes"]:
		state.set(key, frame[key])
	replay_progress = 0.0
	queue_redraw()

func _draw_army(a: Dictionary, pos: Vector2) -> void:
	var col := C_HAN if a["faction"] == "han" else C_XN
	if a["is_convoy"]:
		col = col.lerp(Color("d9c36a"), 0.55)
	var cnt: int = state.army_size(a) + (a["laborers"] if a["is_convoy"] else 0)
	var txt: String = "%.1f万" % (cnt / 10000.0) if cnt >= 10000 else str(cnt)
	var rect := Rect2(pos - Vector2(16, 20), Vector2(32, 40))
	draw_style_box(_marker_box(col), rect)
	draw_texture_rect(CONVOY_ICON if a["is_convoy"] else ARMY_ICON, Rect2(pos - Vector2(13, 18), Vector2(26, 26)), false)
	if a["id"] == selected_army:
		draw_rect(rect.grow(3), Color("ffee33"), false, 2.0)
	var tw := _font.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
	draw_string(_font, pos + Vector2(-tw * 0.5, 17), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color.WHITE)
	if a["is_convoy"]:
		draw_string(_font, pos + Vector2(18, 0), "粮", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, col)
	_army_rects.append({"rect": rect.grow(3), "id": a["id"]})

func _marker_box(col: Color) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = col
	box.set_corner_radius_all(3)
	box.set_border_width_all(1)
	box.border_color = Color("fff3d0")
	return box

func _label_box(selected := false) -> StyleBoxFlat:
	var box = StyleBoxFlat.new()
	box.bg_color = Color(0.96, 0.91, 0.78, 0.94 if selected else 0.83)
	box.set_corner_radius_all(3)
	if selected:
		box.set_border_width_all(1)
		box.border_color = Color("9b742f")
	return box

func _draw_region_labels(s: float) -> void:
	for l in layout["regions"]:
		var p := to_screen(Vector2(l[1][0], l[1][1]))
		var font_size := int(clampf(21.0 * s, 13.0, 30.0))
		draw_string_outline(_font, p, l[0], HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, 2, Color(0.96, 0.92, 0.80, 0.6))
		draw_string(_font, p, l[0], HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, Color(0.30, 0.28, 0.22, 0.70))

# ---------------- 画框 ----------------
func _col_x(i: float) -> float:
	return to_screen(Vector2(i * GRID_COL, 0.0)).x

func _row_y(j: float) -> float:
	return to_screen(Vector2(0.0, j * float(layout["canvas"][1]) / GRID_ROWS)).y

func _col_count() -> int:
	return ceili(float(layout["canvas"][0]) / GRID_COL)

## 「计里画方」：地图范围内 6% 墨色方格线。
func _draw_grid() -> void:
	var inner := inner_rect()
	var col := Color(Desk.INK, 0.06)
	var top := clampf(_row_y(0), inner.position.y, inner.end.y)
	var bottom := clampf(_row_y(GRID_ROWS), inner.position.y, inner.end.y)
	var left := clampf(_col_x(0), inner.position.x, inner.end.x)
	var right := clampf(_col_x(_col_count()), inner.position.x, inner.end.x)
	for i in range(1, _col_count()):
		var x := _col_x(i)
		if x > inner.position.x and x < inner.end.x:
			draw_line(Vector2(x, top), Vector2(x, bottom), col, 1.0)
	for j in range(1, GRID_ROWS):
		var y := _row_y(j)
		if y > inner.position.y and y < inner.end.y:
			draw_line(Vector2(left, y), Vector2(right, y), col, 1.0)

## 四边向内渐隐的暗角；四角两条叠加，自然更暗。
func _draw_vignette() -> void:
	var r := inner_rect()
	var w := minf(110.0, minf(r.size.x, r.size.y) * 0.25)
	var dark := Color(0.12, 0.07, 0.03, 0.22)
	var clear := Color(0.12, 0.07, 0.03, 0.0)
	var tl := r.position
	var tr := Vector2(r.end.x, r.position.y)
	var br := r.end
	var bl := Vector2(r.position.x, r.end.y)
	draw_polygon(PackedVector2Array([tl, tr, tr + Vector2(0, w), tl + Vector2(0, w)]), PackedColorArray([dark, dark, clear, clear]))
	draw_polygon(PackedVector2Array([bl, br, br - Vector2(0, w), bl - Vector2(0, w)]), PackedColorArray([dark, dark, clear, clear]))
	draw_polygon(PackedVector2Array([tl, bl, bl + Vector2(w, 0), tl + Vector2(w, 0)]), PackedColorArray([dark, dark, clear, clear]))
	draw_polygon(PackedVector2Array([tr, br, br - Vector2(w, 0), tr - Vector2(w, 0)]), PackedColorArray([dark, dark, clear, clear]))

func _text_centered(font: Font, center: Vector2, t: String, fs: int, col: Color) -> void:
	var w := font.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	var baseline := center.y + (font.get_ascent(fs) - font.get_descent(fs)) * 0.5
	draw_string(font, Vector2(center.x - w * 0.5, baseline), t, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, col)

## 画框带：外线（距边 8px）+ 22px 绢色框带 + 内线；框带上按当前视图标注天干（列）与地支（行）。
func _draw_frame() -> void:
	var outer := Rect2(Vector2.ZERO, size).grow(-FRAME_INSET)
	var inner := inner_rect()
	if inner.size.x <= 0.0 or inner.size.y <= 0.0:
		return
	# 框外留白与框带底色
	draw_rect(Rect2(0, 0, size.x, outer.position.y), BG)
	draw_rect(Rect2(0, outer.end.y, size.x, size.y - outer.end.y), BG)
	draw_rect(Rect2(0, 0, outer.position.x, size.y), BG)
	draw_rect(Rect2(outer.end.x, 0, size.x - outer.end.x, size.y), BG)
	draw_rect(Rect2(outer.position, Vector2(outer.size.x, FRAME_BAND)), Desk.SILK_2)
	draw_rect(Rect2(Vector2(outer.position.x, inner.end.y), Vector2(outer.size.x, FRAME_BAND)), Desk.SILK_2)
	draw_rect(Rect2(Vector2(outer.position.x, inner.position.y), Vector2(FRAME_BAND, inner.size.y)), Desk.SILK_2)
	draw_rect(Rect2(Vector2(inner.end.x, inner.position.y), Vector2(FRAME_BAND, inner.size.y)), Desk.SILK_2)
	draw_rect(outer, Desk.INK, false, 1.0)
	draw_rect(inner, Desk.INK, false, 1.0)
	if _font == null:
		return
	var tick_col := Color(Desk.INK, 0.7)
	var label_col: Color = Desk.INK_2
	var fs := 12
	var band_mid_top := outer.position.y + FRAME_BAND * 0.5
	var band_mid_bottom := inner.end.y + FRAME_BAND * 0.5
	var band_mid_left := outer.position.x + FRAME_BAND * 0.5
	var band_mid_right := inner.end.x + FRAME_BAND * 0.5
	# 列：天干
	for i in range(0, _col_count() + 1):
		var x := _col_x(i)
		if x >= inner.position.x and x <= inner.end.x:
			draw_line(Vector2(x, inner.position.y - 6), Vector2(x, inner.position.y), tick_col, 1.0)
			draw_line(Vector2(x, inner.end.y), Vector2(x, inner.end.y + 6), tick_col, 1.0)
		if i < _col_count():
			var cx := _col_x(i + 0.5)
			if cx > inner.position.x + 8 and cx < inner.end.x - 8:
				var stem: String = STEMS[i % STEMS.size()]
				_text_centered(_font, Vector2(cx, band_mid_top), stem, fs, label_col)
				_text_centered(_font, Vector2(cx, band_mid_bottom), stem, fs, label_col)
	# 行：地支
	for j in range(0, GRID_ROWS + 1):
		var y := _row_y(j)
		if y >= inner.position.y and y <= inner.end.y:
			draw_line(Vector2(inner.position.x - 6, y), Vector2(inner.position.x, y), tick_col, 1.0)
			draw_line(Vector2(inner.end.x, y), Vector2(inner.end.x + 6, y), tick_col, 1.0)
		if j < GRID_ROWS:
			var cy := _row_y(j + 0.5)
			if cy > inner.position.y + 8 and cy < inner.end.y - 8:
				var branch: String = BRANCHES[j % BRANCHES.size()]
				_text_centered(_font, Vector2(band_mid_left, cy), branch, fs, label_col)
				_text_centered(_font, Vector2(band_mid_right, cy), branch, fs, label_col)

## 题签（左上）：绢卡双线框，「西域诸国图」楷 26、字距 0.3em。
func _draw_cartouche() -> void:
	var font := _title_font if _title_font != null else _font
	if font == null:
		return
	var inner := inner_rect()
	var title := "西域诸国图"
	var fs := 26
	var spacing := fs * 0.3
	var title_w := 0.0
	for ch in title:
		title_w += font.get_string_size(ch, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	title_w += spacing * (title.length() - 1)
	var sub := "前119年 · 道里据《汉书·西域传》"
	var sub_w := _font.get_string_size(sub, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
	var card := Rect2(inner.position + Vector2(12, 12), Vector2(maxf(title_w, sub_w) + 36, 74))
	draw_rect(card, Desk.SILK)
	draw_rect(card, Desk.INK, false, 1.0)
	draw_rect(card.grow(-3), Desk.INK, false, 1.0)
	var x := card.position.x + (card.size.x - title_w) * 0.5
	for ch in title:
		draw_string(font, Vector2(x, card.position.y + 38), ch, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Desk.INK)
		x += font.get_string_size(ch, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x + spacing
	draw_string(_font, Vector2(card.position.x + (card.size.x - sub_w) * 0.5, card.position.y + 60), sub, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Desk.MUTED)

## 指北（右上）：直径 64 的圆 + 八角星，顶端「北」。
func _draw_compass() -> void:
	var inner := inner_rect()
	var c := Vector2(inner.end.x - 12 - 32, inner.position.y + 24 + 32)
	draw_circle(c, 32, Color(Desk.SILK, 0.88))
	draw_arc(c, 32, 0, TAU, 48, Desk.INK, 1.0, true)
	draw_arc(c, 27, 0, TAU, 48, Color(Desk.INK, 0.35), 1.0, true)
	for k in 8:
		var ang := -PI * 0.5 + k * PI / 4.0
		var r := 26.0 if k % 2 == 0 else 15.0
		var tip := c + Vector2.from_angle(ang) * r
		var left := c + Vector2.from_angle(ang - PI / 8.0) * 5.0
		var right := c + Vector2.from_angle(ang + PI / 8.0) * 5.0
		var dark: Color = Desk.CINNABAR if k == 0 else Desk.INK
		draw_colored_polygon(PackedVector2Array([c, left, tip]), dark)
		draw_colored_polygon(PackedVector2Array([c, tip, right]), Desk.SILK_3 if k != 0 else Desk.CINNABAR_HI)
		draw_polyline(PackedVector2Array([left, tip, right]), Color(Desk.INK, 0.8), 1.0, true)
	draw_circle(c, 2.5, Desk.INK)
	var font := _title_font if _title_font != null else _font
	if font != null:
		_text_centered(font, Vector2(c.x, c.y - 32 - 11), "北", 16, Desk.CINNABAR)

func _gui_input(ev: InputEvent) -> void:
	if state == null:
		return
	if ev is InputEventMouseButton:
		if ev.button_index == MOUSE_BUTTON_WHEEL_UP and ev.pressed:
			_zoom_at(ev.position, 1.12)
		elif ev.button_index == MOUSE_BUTTON_WHEEL_DOWN and ev.pressed:
			_zoom_at(ev.position, 1.0 / 1.12)
		elif ev.button_index == MOUSE_BUTTON_LEFT:
			if ev.pressed:
				_drag = true
				_drag_moved = false
			else:
				if _drag and not _drag_moved:
					_click(ev.position)
				_drag = false
	elif ev is InputEventMouseMotion and not _drag:
		hovered_route = _route_at(ev.position)
		queue_redraw()
	elif ev is InputEventMouseMotion and _drag:
		if ev.relative.length() > 0.0:
			if not _drag_moved and (ev.relative.length() > 1.5 or _drag_moved):
				_drag_moved = true
			if _drag_moved:
				pan += ev.relative
				queue_redraw()

func _get_tooltip(at_position: Vector2) -> String:
	if state == null:
		return ""
	var idx := _route_at(at_position)
	if idx < 0:
		return ""
	var closest: Dictionary = state.routes[idx]
	var names := "%s—%s" % [state.nodes[closest["a"]]["name"], state.nodes[closest["b"]]["name"]]
	if not closest.has("distance_km"):
		return "%s\n旧版道路：步兵约 %d 天" % [names, ceili(closest["days"])]
	var methods := {"recorded_li": "史书记载里数换算", "derived_itinerary": "合并古道或分段推算", "regional_estimate": "区域路线估计，确址未定", "identified_site": "遗址区域距离参照", "identified_corridor": "地理通道参照", "corrected_geography": "按地理研究修正史书里数", "conflicting_accounts": "记载有差异，采用区域估计"}
	var terrain_names := {"road": "绿洲道路", "steppe": "草原", "desert": "沙漠", "mountain": "山道", "hazard": "悬度险道"}
	var speed = closest["distance_km"] / closest["days"]
	return "%s\n约 %.0f 公里 · %s · 步兵约 %d 天\n持续日行约 %.0f 公里；骑兵优势上限 %.2f 倍\n%s\n道路只在城市、关隘与路口交汇，可在这些节点换路。\n未计战斗与封路等待；图上长度不用于计时。" % [names, closest["distance_km"], terrain_names[closest["terrain"]], ceili(closest["days"]), speed, closest.get("mounted_speed_cap", 1.0), methods.get(closest.get("calibration_method", ""), "路线估计")]

func _zoom_at(p: Vector2, f: float) -> void:
	var nz := clampf(zoom * f, 0.6, 4.0)
	var k := nz / zoom
	var area := Vector2(layout["canvas"][0], layout["canvas"][1]) * _base_scale()
	var center := (size - area) * 0.5
	pan = p - center - (p - center - pan) * k
	zoom = nz
	queue_redraw()

func _click(p: Vector2) -> void:
	for i in range(_army_rects.size() - 1, -1, -1):
		if _army_rects[i]["rect"].has_point(p):
			army_clicked.emit(_army_rects[i]["id"])
			return
	var best := ""
	var bd := 22.0
	for id in state.nodes:
		var d := node_pos(id).distance_to(p)
		if d < bd:
			bd = d
			best = id
	if best != "":
		node_clicked.emit(best)
