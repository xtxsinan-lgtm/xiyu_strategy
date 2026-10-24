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
var map_mode := "political"    # political | influence | supply | intel | military
var zoom := 1.0
var pan := Vector2.ZERO
var _drag := false
var _drag_moved := false
var _army_rects: Array = []    # [{rect, id}]
var _font: Font
var _title_font: Font

const MAP_MODE_LABELS = {
	"political": "疆域臣属",
	"influence": "汉匈倾侧",
	"supply": "仓廪粮道",
	"intel": "烽燧视野",
	"military": "兵力态势",
}

const HYDRO_RIVERS = [
	{"name": "塔里木河", "pts": [[225, 380], [310, 332], [420, 305], [535, 310], [615, 335], [676, 374]], "w": 2.2},
	{"name": "和田河", "pts": [[355, 485], [368, 415], [390, 322]], "w": 1.5},
	{"name": "叶尔羌河", "pts": [[248, 438], [285, 378], [322, 332]], "w": 1.5},
	{"name": "伊犁水", "pts": [[425, 165], [320, 152], [215, 138]], "w": 1.8},
	{"name": "疏勒河", "pts": [[835, 442], [765, 422], [688, 382]], "w": 1.5},
	{"name": "弱水", "pts": [[895, 435], [880, 320], [865, 205]], "w": 1.5},
	{"name": "药杀水", "pts": [[192, 272], [122, 235], [52, 208]], "w": 1.9},
	{"name": "妫水", "pts": [[185, 478], [110, 432], [35, 395]], "w": 2.0},
]

const HYDRO_LAKES = [
	{"name": "盐泽", "pos": [678, 376], "rx": 24.0, "ry": 11.5, "rot": -0.21},
	{"name": "居延泽", "pos": [862, 192], "rx": 18.0, "ry": 9.0, "rot": 0.14},
	{"name": "敦薨泽", "pos": [590, 256], "rx": 15.0, "ry": 8.0, "rot": -0.14},
	{"name": "热海", "pos": [292, 198], "rx": 22.0, "ry": 9.0, "rot": -0.09},
	{"name": "夷播海", "pos": [195, 128], "rx": 32.0, "ry": 11.0, "rot": -0.26},
]

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

func set_map_mode(mode: String) -> void:
	if MAP_MODE_LABELS.has(mode):
		map_mode = mode
		queue_redraw()

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

func node_mode_color(id: String, n: Dictionary) -> Color:
	if map_mode == "political":
		return node_color(n)
	var f: String = n["faction"]
	var rel: Dictionary = state.relations.get(f, {})
	if map_mode == "influence":
		if f == "han":
			return Color("a33a2a")
		if f == "xiongnu":
			return Color("5d4037")
		if rel.is_empty():
			return Color("9c8b70")
		var net := float(rel.get("han_influence", 0.0)) - float(rel.get("xn_intimidation", 0.0))
		if net >= 20.0:
			return Color("b83b2b")
		if net >= 5.0:
			return Color("d97a54")
		if net <= -20.0:
			return Color("5d4037")
		if net <= -5.0:
			return Color("8d6e63")
		return Color("c9a654")
	elif map_mode == "supply":
		var g := float(n.get("grain", 0.0))
		if g >= 200000.0:
			return Color("1f6f50")
		if g >= 80000.0:
			return Color("3d9970")
		if g >= 25000.0:
			return Color("b8893c")
		return Color("9c7a54")
	elif map_mode == "intel":
		var ctl: String = state.controller(n)
		if ctl == "han" or float(rel.get("han_influence", 0.0)) >= 55.0:
			return Color("1a4b8c")
		if float(rel.get("han_influence", 0.0)) >= 25.0:
			return Color("4668b5")
		return Color("7a7468")
	elif map_mode == "military":
		var troops := 0
		var mil_dict: Dictionary = n.get("militia", {})
		for ut in mil_dict:
			troops += int(mil_dict[ut])
		for aid in state.armies:
			if state.armies[aid]["loc"].get("node", "") == id:
				troops += state.army_size(state.armies[aid])
		if troops >= 5000:
			return Color("a33a2a")
		if troops >= 2000:
			return Color("c96a3b")
		return Color("8a7b65")
	return node_color(n)

func _build_territory_polygon(id: String, base_r: float) -> PackedVector2Array:
	var c := node_world_pos(id)
	var num_angles := 12
	var poly := PackedVector2Array()
	for i in num_angles:
		var ang := TAU * float(i) / float(num_angles)
		var dir := Vector2.from_angle(ang)
		var r := base_r
		for oid in state.nodes:
			if oid == id:
				continue
			var v := node_world_pos(oid) - c
			var d2 := v.length_squared()
			if d2 < 4.0:
				continue
			var proj := v.dot(dir)
			if proj > 0.0:
				var half_dist := (d2 / (2.0 * proj)) * 0.86
				if half_dist < r:
					r = maxf(16.0, half_dist)
		var wave := 1.0 + 0.06 * sin(float(i) * 3.0 + c.x * 0.05)
		poly.append(to_screen(c + dir * (r * wave)))
	return poly

func _draw_polygon_hachures(poly: PackedVector2Array, col: Color, step: float = 8.0) -> void:
	if poly.size() < 3:
		return
	var min_p := poly[0]
	var max_p := poly[0]
	for p in poly:
		min_p.x = minf(min_p.x, p.x)
		min_p.y = minf(min_p.y, p.y)
		max_p.x = maxf(max_p.x, p.x)
		max_p.y = maxf(max_p.y, p.y)
	var diag := (max_p.x - min_p.x) + (max_p.y - min_p.y)
	var d := -diag
	while d <= diag:
		var a := Vector2(min_p.x + d, min_p.y)
		var b := Vector2(min_p.x + d + (max_p.y - min_p.y), max_p.y)
		var clipped := Geometry2D.intersect_polyline_with_polygon(PackedVector2Array([a, b]), poly)
		for seg in clipped:
			if seg.size() >= 2:
				draw_line(seg[0], seg[seg.size() - 1], col, 1.2, true)
		d += step

func _draw_hydrography(s: float) -> void:
	for rv in HYDRO_RIVERS:
		var curve := Curve2D.new()
		curve.bake_interval = 4.0
		var pts: Array = rv["pts"]
		for i in pts.size():
			var p := Vector2(pts[i][0], pts[i][1])
			var tangent := Vector2.ZERO
			if i > 0 and i < pts.size() - 1:
				tangent = (Vector2(pts[i + 1][0], pts[i + 1][1]) - Vector2(pts[i - 1][0], pts[i - 1][1])) * 0.22
			curve.add_point(p, -tangent, tangent)
		var scr := PackedVector2Array()
		for bp in curve.get_baked_points():
			scr.append(to_screen(bp))
		if scr.size() >= 2:
			var w: float = float(rv["w"]) * clampf(s, 0.8, 1.5)
			draw_polyline(scr, Color(0.92, 0.88, 0.78, 0.52), w + 1.8, true)
			draw_polyline(scr, Color(0.29, 0.46, 0.53, 0.65), w, true)
	for lk in HYDRO_LAKES:
		var center := to_screen(Vector2(lk["pos"][0], lk["pos"][1]))
		var rx: float = float(lk["rx"]) * s
		var ry: float = float(lk["ry"]) * s
		var rot: float = float(lk["rot"])
		var outer_pts := PackedVector2Array()
		var inner_pts := PackedVector2Array()
		for i in 25:
			var ang := TAU * float(i) / 24.0
			var p1 := Vector2(cos(ang) * rx, sin(ang) * ry).rotated(rot)
			var p2 := Vector2(cos(ang) * rx * 0.70, sin(ang) * ry * 0.70).rotated(rot)
			outer_pts.append(center + p1)
			inner_pts.append(center + p2)
		draw_colored_polygon(outer_pts, Color(0.36, 0.54, 0.60, 0.42))
		draw_polyline(outer_pts, Color(0.21, 0.36, 0.42, 0.70), 1.1, true)
		draw_polyline(inner_pts, Color(0.93, 0.91, 0.83, 0.52), 0.8, true)
		if _font != null:
			var fs := int(clampf(10.0 * sqrt(zoom), 9.0, 14.0))
			_text_centered(_font, center - Vector2(0, ry + 6.0), lk["name"], fs, Color(0.19, 0.32, 0.38, 0.86))

func _draw_territories() -> void:
	for id in state.nodes:
		var n: Dictionary = state.nodes[id]
		var ntype: String = n["type"]
		if ntype == "junction":
			continue
		var base_r := 40.0
		if ntype in ["source", "nomad"]:
			base_r = 50.0
		elif ntype == "pass":
			base_r = 28.0
		var poly := _build_territory_polygon(id, base_r)
		if poly.size() < 3:
			continue
		var col := node_mode_color(id, n)
		var is_sel := (id == selected_node)
		var fill_a := 0.28 if is_sel else (0.16 if map_mode == "political" else 0.22)
		draw_colored_polygon(poly, Color(col, fill_a))
		var closed := poly.duplicate()
		closed.append(poly[0])
		draw_polyline(closed, Color(col, 0.72 if is_sel else 0.38), 1.6 if is_sel else 1.0, true)
		var ctl: String = state.controller(n)
		if n["under_siege_by"] != "" or (map_mode == "political" and n["faction"] not in ["han", "xiongnu"] and ctl in ["han", "xiongnu"]):
			var hcol := Color(0.36, 0.25, 0.22, 0.28) if ctl == "xiongnu" else Color(0.64, 0.23, 0.16, 0.28)
			_draw_polygon_hachures(poly, hcol, 9.0)

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
	_draw_scale_bar()

func _draw_world() -> void:
	_army_rects.clear()
	var s := _base_scale() * zoom
	# 仿古水系湖泽与疆域多边形色晕
	_draw_hydrography(s)
	_draw_territories()
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
		draw_circle(p, rad, node_mode_color(id, n))
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

func _draw_zebra_neatline(r: Rect2) -> void:
	var seg := 24.0
	var bw := 3.5
	var x := r.position.x
	var idx := 0
	while x < r.end.x:
		var w := minf(seg, r.end.x - x)
		var col := Desk.INK if idx % 2 == 0 else Desk.SILK_3
		draw_rect(Rect2(x, r.position.y - bw, w, bw), col)
		draw_rect(Rect2(x, r.end.y, w, bw), col)
		x += seg
		idx += 1
	var y := r.position.y
	idx = 0
	while y < r.end.y:
		var h := minf(seg, r.end.y - y)
		var col := Desk.INK if idx % 2 == 0 else Desk.SILK_3
		draw_rect(Rect2(r.position.x - bw, y, bw, h), col)
		draw_rect(Rect2(r.end.x, y, bw, h), col)
		y += seg
		idx += 1

## 画框带：外线（距边 8px）+ 22px 绢色框带 + 内侧黑白相间比例尺界格 + 天干（列）/ 地支（行）及长安里数。
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
	_draw_zebra_neatline(inner)
	draw_rect(outer, Desk.INK, false, 1.5)
	draw_rect(inner, Desk.INK, false, 1.0)
	if _font == null:
		return
	var tick_col := Color(Desk.INK, 0.7)
	var label_col: Color = Desk.INK_2
	var fs := 12
	var band_mid_top := outer.position.y + FRAME_BAND * 0.5 - 1.0
	var band_mid_bottom := inner.end.y + FRAME_BAND * 0.5 + 1.0
	var band_mid_left := outer.position.x + FRAME_BAND * 0.5
	var band_mid_right := inner.end.x + FRAME_BAND * 0.5
	# 列：天干 + 距长安里数
	for i in range(0, _col_count() + 1):
		var x := _col_x(i)
		if x >= inner.position.x and x <= inner.end.x:
			draw_line(Vector2(x, inner.position.y - 6), Vector2(x, inner.position.y), tick_col, 1.0)
			draw_line(Vector2(x, inner.end.y), Vector2(x, inner.end.y + 6), tick_col, 1.0)
		if i < _col_count():
			var cx := _col_x(i + 0.5)
			if cx > inner.position.x + 8 and cx < inner.end.x - 8:
				var stem: String = STEMS[i % STEMS.size()]
				var li_txt := "京畿" if (9 - i) * 1200 <= 0 else "%d里" % ((9 - i) * 1200)
				_text_centered(_font, Vector2(cx, band_mid_top), "%s %s" % [stem, li_txt], 10, label_col)
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

## 题签（左上）：仿古双线折角框 + 菱形界格，「西域都护舆图」楷 24、附当前舆图视角。
func _draw_cartouche() -> void:
	var font := _title_font if _title_font != null else _font
	if font == null:
		return
	var inner := inner_rect()
	var title := "西域都护舆图"
	var fs := 22
	var spacing := fs * 0.25
	var title_w := 0.0
	for ch in title:
		title_w += font.get_string_size(ch, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	title_w += spacing * (title.length() - 1)
	var sub := "前119年 · 道里据《汉书·西域传》"
	var sub_w := _font.get_string_size(sub, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
	var mode_str := "舆图视角：%s" % MAP_MODE_LABELS.get(map_mode, "疆域臣属")
	var card := Rect2(inner.position + Vector2(14, 14), Vector2(maxf(title_w, sub_w) + 42, 86))
	draw_rect(Rect2(card.position + Vector2(2, 3), card.size), Color(0, 0, 0, 0.16))
	draw_rect(card, Desk.SILK)
	draw_rect(card, Desk.INK, false, 1.5)
	draw_rect(card.grow(-3), Color(Desk.CINNABAR, 0.55), false, 1.0)
	# 四角回纹方格点缀
	for cp in [card.position + Vector2(5, 5), Vector2(card.end.x - 9, card.position.y + 5), Vector2(card.position.x + 5, card.end.y - 9), card.end - Vector2(9, 9)]:
		draw_rect(Rect2(cp, Vector2(4, 4)), Desk.CINNABAR, false, 1.0)
	var x := card.position.x + (card.size.x - title_w) * 0.5
	for ch in title:
		draw_string(font, Vector2(x, card.position.y + 32), ch, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Desk.INK)
		x += font.get_string_size(ch, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x + spacing
	# 菱形中线
	var rule_y := card.position.y + 41.0
	draw_line(Vector2(card.position.x + 14, rule_y), Vector2(card.end.x - 14, rule_y), Color(Desk.INK, 0.25), 1.0)
	var mid_x := card.position.x + card.size.x * 0.5
	draw_colored_polygon(PackedVector2Array([Vector2(mid_x, rule_y - 3), Vector2(mid_x + 3, rule_y), Vector2(mid_x, rule_y + 3), Vector2(mid_x - 3, rule_y)]), Desk.CINNABAR)
	draw_string(_font, Vector2(card.position.x + (card.size.x - sub_w) * 0.5, card.position.y + 58), sub, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Desk.MUTED)
	var mw := _font.get_string_size(mode_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
	draw_string(_font, Vector2(card.position.x + (card.size.x - mw) * 0.5, card.position.y + 75), mode_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Desk.CINNABAR)

## 指北（右上）：72 刻度罗盘环 + 八角方位花，四正「北/南/西/东」。
func _draw_compass() -> void:
	var inner := inner_rect()
	var c := Vector2(inner.end.x - 16 - 36, inner.position.y + 18 + 36)
	draw_circle(c, 36, Color(Desk.SILK, 0.92))
	draw_arc(c, 36, 0, TAU, 64, Desk.INK, 1.3, true)
	draw_arc(c, 31, 0, TAU, 64, Color(Desk.INK, 0.45), 0.9, true)
	# 72 刻度线（每 5° 一小格，每 30° 一大格）
	for deg_i in 72:
		var ang := deg_to_rad(float(deg_i * 5) - 90.0)
		var is_major := (deg_i % 6 == 0)
		var r1 := 30.5 if is_major else 33.0
		var r2 := 35.5
		draw_line(c + Vector2.from_angle(ang) * r1, c + Vector2.from_angle(ang) * r2, Color(Desk.INK, 0.78 if is_major else 0.38), 1.1 if is_major else 0.6, true)
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
		_text_centered(font, Vector2(c.x, c.y - 36 - 9), "北", 13, Desk.CINNABAR)
		_text_centered(font, Vector2(c.x, c.y + 36 + 9), "南", 10, Desk.INK_2)
		_text_centered(font, Vector2(c.x - 36 - 9, c.y), "西", 10, Desk.INK_2)
		_text_centered(font, Vector2(c.x + 36 + 9, c.y), "东", 10, Desk.INK_2)

## 比例尺（左下偏右，与图层胶囊并列）：「比例尺 · 五百里 (210 km)」黑白分节尺。
func _draw_scale_bar() -> void:
	if _font == null:
		return
	var inner := inner_rect()
	var box_r := Rect2(Vector2(inner.position.x + 14, inner.end.y - 74), Vector2(138, 32))
	draw_rect(box_r, Color(Desk.SILK, 0.92))
	draw_rect(box_r, Color(Desk.INK, 0.55), false, 1.0)
	draw_string(_font, box_r.position + Vector2(8, 13), "比例尺 · 五百里 (210km)", HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Desk.INK)
	var seg_w := 30.0
	for i in 4:
		var sr := Rect2(box_r.position + Vector2(8 + i * seg_w, 18), Vector2(seg_w, 5))
		draw_rect(sr, Desk.INK if i % 2 == 0 else Desk.SILK_3)
		draw_rect(sr, Desk.INK, false, 0.8)

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
