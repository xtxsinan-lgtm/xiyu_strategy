extends Control
## 地图只负责显示和选择。所有规则交给 Campaign。
signal city_clicked(id: int)
signal army_clicked(id: int)
var campaign: Campaign
var font: Font
const INK = Color("403c31")
const BLUE = Color("345d70")
const RED = Color("995448")
var hovered: int = -1

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	font = SystemFont.new()
	font.font_names = PackedStringArray(["PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "sans-serif"])

func city_pos(i: int) -> Vector2:
	return Vector2(campaign.cities[i].x, campaign.cities[i].y) * Vector2(size.x / 900.0, size.y / 850.0)

func army_pos(i: int) -> Vector2:
	return city_pos(campaign.armies[i].city) + Vector2(-52 if i == 0 else 52, 30)

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		hovered = -1
		for i in range(campaign.cities.size()):
			if event.position.distance_to(city_pos(i)) < 33: hovered = i
		queue_redraw()
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		for i in range(campaign.armies.size()):
			if event.position.distance_to(army_pos(i)) < 24:
				army_clicked.emit(i)
				return
		for i in range(campaign.cities.size()):
			if event.position.distance_to(city_pos(i)) < 36:
				city_clicked.emit(i)
				return

func line_text(pos: Vector2, text: String, point_size: int, color: Color = INK) -> void:
	draw_string(font, pos, text, HORIZONTAL_ALIGNMENT_LEFT, -1, point_size, color)

func _draw() -> void:
	if campaign == null or font == null: return
	draw_rect(Rect2(Vector2.ZERO,size), Color("e4d5b2"))
	# 程序绘制的纸纹、山脉与边界，不使用原作图片。
	var rng = RandomNumberGenerator.new()
	rng.seed = 1926
	for i in range(1400):
		var p = Vector2(rng.randf_range(0,size.x),rng.randf_range(0,size.y))
		draw_circle(p,rng.randf_range(0.3,1.6),Color(0.36,0.29,0.17,0.06))
	var scale_v = Vector2(size.x/900.0,size.y/850.0)
	var outline = PackedVector2Array()
	for p in [[180,48],[400,20],[610,45],[790,135],[823,365],[730,485],[820,645],[695,799],[402,830],[350,726],[140,659],[126,442],[75,325],[155,185]]:
		outline.append(Vector2(p[0],p[1])*scale_v)
	draw_colored_polygon(outline,Color("dac6a0"))
	outline.append(outline[0])
	draw_polyline(outline, Color("9b8868"),2,true)
	for i in range(60):
		var p = Vector2(rng.randf_range(90,790),rng.randf_range(60,790))*scale_v
		var mountain = PackedVector2Array([p+Vector2(-12,5),p+Vector2(-3,-5),p+Vector2(2,0),p+Vector2(8,-8),p+Vector2(18,5)])
		draw_polyline(mountain,Color(0.46,0.40,0.29,0.22),1.2,true)
	var river = PackedVector2Array()
	for p in [[510,45],[455,195],[480,280],[455,400],[485,495],[420,590],[470,680],[432,816]]:
		river.append(Vector2(p[0],p[1])*scale_v)
	draw_polyline(river,Color("7b9f9a"),9,true)
	draw_polyline(river,Color("b1c6b4"),3,true)
	line_text(Vector2(425,555)*scale_v,"湘 江",18,Color("5f817f"))
	line_text(Vector2(44,90),"湖 南",40,Color(0.3,0.27,0.21,0.22))
	line_text(Vector2(44,118),"1926 / 地区连线示意",13,Color("887b61"))
	for edge in Campaign.CONNECTIONS:
		var a = city_pos(edge[0])
		var b = city_pos(edge[1])
		draw_line(a,b,Color("9c927a"),2,true)
		var distance = a.distance_to(b)
		for step in range(0,int(distance),12):
			var p = a.lerp(b,step/distance)
			var normal = (b-a).normalized().orthogonal()*4
			draw_line(p-normal,p+normal,Color("9c927a"),1,true)
	var selected = campaign.armies[campaign.selected_army]
	for neighbour in campaign.neighbours(selected.city):
		var a = city_pos(selected.city)
		var b = city_pos(neighbour)
		draw_line(a,b,Color(0.20,0.36,0.44,0.36),4,true)
		var middle = a.lerp(b,0.58)
		var dir = (b-a).normalized()
		draw_colored_polygon(PackedVector2Array([middle+dir*9,middle-dir*6+dir.orthogonal()*6,middle-dir*6-dir.orthogonal()*6]),BLUE)
	for i in range(campaign.cities.size()):
		var c = campaign.cities[i]
		var p = city_pos(i)
		var color = BLUE if c.owner == 0 else RED
		if i == campaign.selected_city or i == hovered:
			draw_arc(p,35,0,TAU,64,Color("ba9449"),3,true)
		draw_circle(p,27,Color("f3e7cc"))
		draw_arc(p,27,0,TAU,48,color,2,true)
		draw_circle(p,22,color)
		# 城门与房屋构成原创地图符号。
		draw_rect(Rect2(p+Vector2(-12,-2),Vector2(24,13)),Color("eee3c8"))
		draw_colored_polygon(PackedVector2Array([p+Vector2(-15,-3),p+Vector2(0,-15),p+Vector2(15,-3)]),Color("eee3c8"))
		draw_rect(Rect2(p+Vector2(-3,3),Vector2(6,8)),color)
		line_text(p+Vector2(-23,-37),c.name,20)
		if i == 0: line_text(p+Vector2(29,-25),"目标",12,RED)
		line_text(p+Vector2(32,-3),"税 %d" % c.income,12)
		if c.owner != 0: line_text(p+Vector2(-28,48),"守军 %.1fk" % (c.garrison/1000.0),12,RED)
	for i in range(campaign.armies.size()):
		var a = campaign.armies[i]
		if a.troops <= 0: continue
		var p = army_pos(i)
		draw_circle(p,21,BLUE)
		draw_arc(p,21,0,TAU,40,Color("f8eed6"),2,true)
		if i == campaign.selected_army: draw_arc(p,25,0,TAU,40,Color("c49b45"),3,true)
		line_text(p+Vector2(-14,5),"%.0fk" % (a.troops/1000.0),14,Color("fff2d6"))
		line_text(p+Vector2(-14,38),"唐" if i == 0 else "白",12,BLUE)
	line_text(Vector2(24,size.y-24),"蓝 · 我方    赭红 · 敌方    圆牌 · 部队    箭头 · 可行军路线",12)
