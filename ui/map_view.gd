extends Control
# 节点图地图：节点=城市/部领，边=商路（也是行军路线）。只读 GameState；点击通过信号交给 main。

const ARMY_ICON = preload("res://assets/icons/standard.svg")
const CONVOY_ICON = preload("res://assets/icons/convoy.svg")
const CITY_ICON = preload("res://assets/icons/city.svg")
const NOMAD_ICON = preload("res://assets/icons/nomad.svg")
const Fonts = preload("res://ui/font_provider.gd")
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
var zoom := 1.0
var pan := Vector2.ZERO
var _drag := false
var _drag_moved := false
var _army_rects: Array = []    # [{rect, id}]
var _font: Font

const C_HAN = Color("c0392b")
const C_XN = Color("5d4037")
const C_HAN_V = Color("e08a80")
const C_XN_V = Color("a1887f")
const C_PASS = Color("b8b8b8")
const BG = Color("e9dcc0")
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

func fit() -> void:
	zoom = 1.0
	pan = Vector2.ZERO
	queue_redraw()

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
	draw_rect(map_rect, Color(0.95, 0.89, 0.73, 0.38))
	if state == null:
		return
	_army_rects.clear()
	var s := _base_scale() * zoom
	# 区域底色提示
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
		if n["type"] != "pass":
			draw_texture_rect(NOMAD_ICON if n["type"] == "nomad" else CITY_ICON, Rect2(p - Vector2(6, 6), Vector2(12, 12)), false)
		var label: String = n["name"]
		var fs := int(clampf(14.0 * sqrt(zoom), 12.0, 20.0))
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
	# 固定在屏幕边角的导航与图例，不随着拖动失去位置。
	draw_style_box(_label_box(), Rect2(14, 14, 300, 59))
	draw_string(_font, Vector2(26, 37), "西域舆图  /  前119年战略示意", HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color("37291a"))
	draw_string(_font, Vector2(26, 58), "滚轮缩放 · 拖动平移 · 悬停查看里程", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("66523a"))
	draw_style_box(_label_box(), Rect2(14, size.y - 53, 337, 37))
	draw_string(_font, Vector2(26, size.y - 30), "金色：商路  虚线：险道  交叉处不可换路", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("493820"))

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
	return "%s\n约 %.0f 公里 · %s · 步兵约 %d 天\n持续日行约 %.0f 公里；骑兵优势上限 %.2f 倍\n%s\n路线交叉不创建节点；仅城市／关隘可换路。\n未计战斗与封路等待；图上长度不用于计时。" % [names, closest["distance_km"], terrain_names[closest["terrain"]], ceili(closest["days"]), speed, closest.get("mounted_speed_cap", 1.0), methods.get(closest.get("calibration_method", ""), "路线估计")]

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
