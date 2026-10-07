extends Control
## 界面层：按钮调用规则方法；changed 信号触发整体刷新。
const MapView = preload("res://scripts/strategic_map.gd")
var campaign = Campaign.new()
var map_view: Control
var header: Label
var detail: VBoxContainer
var roster: HBoxContainer
var history: Label
var status: Label
var page: String = "army"
var help_panel: PanelContainer
const DARK = Color("252e31")
const CREAM = Color("eee4cd")
const GOLD = Color("c3a468")

func _ready() -> void:
	var theme_data = Theme.new()
	var font = SystemFont.new()
	font.font_names = PackedStringArray(["PingFang SC","Microsoft YaHei","Noto Sans CJK SC","sans-serif"])
	theme_data.default_font = font
	theme_data.default_font_size = 16
	theme_data.set_color("font_color","Label",CREAM)
	for state in ["normal","hover","pressed","disabled"]:
		var box = StyleBoxFlat.new()
		box.bg_color = Color("405359") if state == "hover" else (Color("9a7943") if state == "pressed" else Color("303e42"))
		if state == "disabled": box.bg_color = Color("293236")
		box.set_border_width_all(1)
		box.border_color = Color("64716c") if state == "hover" else Color("4b5755")
		box.set_corner_radius_all(4)
		box.content_margin_left = 12
		box.content_margin_right = 12
		box.content_margin_top = 9
		box.content_margin_bottom = 9
		theme_data.set_stylebox(state,"Button",box)
	theme_data.set_color("font_color","Button",CREAM)
	theme_data.set_color("font_disabled_color","Button",Color("74827d"))
	theme = theme_data
	var bg = ColorRect.new()
	bg.color = DARK
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	header = label_at("",Vector2(30,18),Vector2(950,65),22)
	button_at("玩法 / 学习",Vector2(1025,23),Vector2(125,40),show_help)
	button_at("保存",Vector2(1160,23),Vector2( 70,40),campaign.save_game)
	button_at("读取",Vector2(1240,23),Vector2(70,40),func(): campaign.load_game())
	button_at("重开",Vector2(1320,23),Vector2(90,40),func(): campaign.reset())
	map_view = MapView.new()
	map_view.campaign = campaign
	map_view.position = Vector2(24,96)
	map_view.size = Vector2(900,684)
	add_child(map_view)
	map_view.city_clicked.connect(func(id): campaign.selected_city = id; page = "city"; refresh())
	map_view.army_clicked.connect(func(id): campaign.selected_army = id; page = "army"; refresh())
	button_at("部队",Vector2(949,97),Vector2(140,40),func(): page = "army"; refresh())
	button_at("地区",Vector2(1095,97),Vector2(140,40),func(): page = "city"; refresh())
	button_at("战报",Vector2(1241,97),Vector2(170,40),func(): page = "reports"; refresh())
	var scroll = ScrollContainer.new()
	scroll.position = Vector2(952,156)
	scroll.size = Vector2(455,523)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll)
	detail = VBoxContainer.new()
	detail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	detail.add_theme_constant_override("separation",10)
	scroll.add_child(detail)
	status = label_at("",Vector2(951,686),Vector2(454,35),15)
	button_at("下一周   →",Vector2(950,728),Vector2(459,52),campaign.next_week)
	roster = HBoxContainer.new()
	roster.position = Vector2(24,803)
	roster.size = Vector2(900, 70)
	roster.add_theme_constant_override("separation",12)
	add_child(roster)
	history = label_at("",Vector2(950,802),Vector2(457,75),14)
	campaign.changed.connect(refresh)
	refresh()


func label_at(text_value: String, pos: Vector2, dimensions: Vector2, font_size: int) -> Label:
	var item = Label.new()
	item.text = text_value
	item.position = pos
	item.size = dimensions
	item.add_theme_font_size_override("font_size",font_size)
	add_child(item)
	return item

func button_at(text_value: String, pos: Vector2, dimensions: Vector2, action: Callable) -> Button:
	var button = Button.new()
	button.text = text_value
	button.position = pos
	button.size = dimensions
	button.pressed.connect(action)
	add_child(button)
	return button

func clear_children(parent: Node) -> void:
	for child in parent.get_children():
		parent.remove_child(child)
		child.queue_free()

func text_line(text_value: String, font_size: int = 16, color: Color = CREAM) -> void:
	var item = Label.new()
	item.text = text_value
	item.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	item.add_theme_font_size_override("font_size",font_size)
	item.add_theme_color_override("font_color",color)
	detail.add_child(item)

func action_button(text_value: String, action: Callable, hint: String = "") -> void:
	var button = Button.new()
	button.text = text_value
	button.tooltip_text = hint
	button.pressed.connect(action)
	detail.add_child(button)

func meter(title: String, value: int) -> void:
	text_line("%s   %d / 100" % [title,value],14,GOLD)
	var bar = ProgressBar.new()
	bar.value = value
	bar.show_percentage = false
	bar.custom_minimum_size.y = 6
	var fill = StyleBoxFlat.new()
	fill.bg_color = GOLD
	var back = StyleBoxFlat.new()
	back.bg_color = Color("46504c")
	bar.add_theme_stylebox_override("fill",fill)
	bar.add_theme_stylebox_override("background",back)
	detail.add_child(bar)

func refresh() -> void:
	if not is_instance_valid(header): return
	var p = campaign.people[campaign.selected_person]
	header.text = "湘南行军   /   第 %02d 周\n%s    气力 %d/4    资金 %d    支持者 %d    人脉 %d" % [campaign.week,p.name,p.energy,p.money,p.followers,p.influence]
	header.add_theme_font_size_override("font_size",19)
	clear_children(detail)
	clear_children(roster)
	for i in range(campaign.people.size()):
		var person = campaign.people[i]
		var button = Button.new()
		button.text = "%s%s   ·   %s\n气力 %d/4   /   资金 %d" % ["● " if i == campaign.selected_person else "○ ",person.name,person.role,person.energy,person.money]
		button.custom_minimum_size = Vector2(300,70)
		button.pressed.connect(func(): campaign.selected_person = i; refresh())
		roster.add_child(button)
	var transfer = Button.new()
	transfer.text = "转交资金 50\n消耗 1 气力"
	transfer.custom_minimum_size = Vector2(260,70)
	transfer.pressed.connect(campaign.transfer)
	roster.add_child(transfer)
	if page == "army": army_panel()
	elif page == "city": city_panel()
	else:
		text_line("行动记录",27,GOLD)
		for report in campaign.reports:
			text_line(report,15)
			text_line("────────────────────",14,Color("65736d"))
	status.text = campaign.result if campaign.result != "" else "任务：控制长沙，守住 %d / 2 周 · 限时十二周" % campaign.hold_weeks
	status.add_theme_color_override("font_color",GOLD)
	history.text = str(campaign.reports[0])
	history.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	history.max_lines_visible = 3
	map_view.queue_redraw()

func army_panel() -> void:
	var a = campaign.armies[campaign.selected_army]
	text_line(a.name,28,GOLD)
	text_line("指挥官 %s  /  驻地 %s" % [campaign.people[a.commander].name,campaign.cities[a.city].name],16)
	text_line("士兵 %s    劳工 %s\n战力 %s   ·   后勤%s" % [a.troops,a.labour,campaign.power(a),"充足" if a.labour >= a.troops * 2 else "不足"],16)
	meter("士气",a.morale)
	meter("训练",a.training)
	text_line("本周军饷：%s  /  行军：%s" % ["已付" if a.paid else "未付","已行动" if a.moved else "未行动"],14)
	if a.commander != campaign.selected_person:
		action_button("切换到指挥官 %s" % campaign.people[a.commander].name,func(): campaign.selected_person = a.commander; refresh())
	action_button("发军饷  ·  1 气力 / %d 资金" % campaign.salary(),campaign.pay)
	action_button("招募劳工  ·  1 气力 / 20 资金",func(): campaign.organize("labour"),"增加 5,000 劳工；建议每名士兵配 2 名劳工。")
	action_button("操练部队  ·  1 气力 / 15 资金",func(): campaign.organize("train"),"训练 +12。")
	action_button("补充新兵  ·  1 气力 / 25 资金 / 10 支持",func(): campaign.organize("recruit"))
	action_button("接管驻地  ·  1 气力 / 10 资金",campaign.occupy)

func city_panel() -> void:
	var c = campaign.cities[campaign.selected_city]
	text_line(c.name,28,GOLD)
	text_line("我方控制" if c.owner == 0 else "敌方控制",18)
	text_line("基础税收 %d / 周  ·  守军 %d\n实际税收 = 基础税收 × 秩序" % [c.income,c.garrison],16)
	meter("秩序",c.order)
	meter("民众支持",c.support)
	var a = campaign.armies[campaign.selected_army]
	text_line("当前部队 %s / %s" % [a.name,campaign.cities[a.city].name],16)
	action_button("行军 / 进攻 %s  ·  1 气力" % c.name,func(): campaign.march(campaign.selected_city))
	if c.owner != 0:
		text_line("守军消灭后仍需接管。长沙需要部队驻守，反攻强度为 9,000。",14,GOLD)
	action_button("兴办实业  ·  1 气力 / 20 资金",func(): campaign.govern("develop"))
	action_button("赈济安民  ·  1 气力 / 20 资金",func(): campaign.govern("relief"))
	action_button("组织集会  ·  1 气力 / 5 资金",campaign.rally)

func show_help() -> void:
	if is_instance_valid(help_panel):
		help_panel.queue_free()
		return
	help_panel = PanelContainer.new()
	help_panel.position = Vector2(240,160)
	help_panel.size = Vector2(960,580)
	var style = StyleBoxFlat.new()
	style.bg_color = DARK
	style.set_border_width_all(2)
	style.border_color = GOLD
	style.set_content_margin_all( 30)
	help_panel.add_theme_stylebox_override("panel",style)
	add_child(help_panel)
	var column = VBoxContainer.new()
	column.add_theme_constant_override("separation",18)
	help_panel.add_child(column)
	var title = Label.new()
	title.text = "湘南行军 · 玩法与学习"
	title.add_theme_font_size_override("font_size",28)
	column.add_child(title)
	var body = Label.new()
	body.text = "目标：十二周内控制长沙，并守住两周。\n\n① 选择人物；资源属于个人。转交 50 资金消耗 1 气力。\n② 点击部队，选择对应指挥官，发军饷、招募劳工和训练。\n③ 点击相邻城市，下达行军 / 进攻命令。每支部队每周行军一次。\n④ 击败守军后执行接管。省长治理地区，税收在下一周进入省长账户。\n⑤ 下一周恢复气力、结算税收；欠饷会降低士气并造成逃兵。\n\n战力 = 士兵 × (0.5 + 训练/100) × (0.4 + 士气/100)。\n长沙防御 = 守军 × 1.5；控制后驻军战力至少 9,000 才能抵御反攻。\n\n学习结构：campaign.gd 管规则；strategic_map.gd 画地图；main.gd 管界面。\n这是依据实玩观察制作的独立学习原型，图形自绘，数值和敌军逻辑简化。"
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.add_theme_font_size_override("font_size",18)
	column.add_child(body)
	var close = Button.new()
	close.text = "返回战役"
	close.pressed.connect(func(): help_panel.queue_free())
	column.add_child(close)

