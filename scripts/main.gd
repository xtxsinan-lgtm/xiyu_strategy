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
var desk: Panel
var desk_category: String = "建设"
var desk_selection: String = "phone"
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
	map_view.city_clicked.connect(func(id): campaign.selected_city = id; page = "city"; refresh(); show_desk())
	map_view.army_clicked.connect(func(id): campaign.selected_army = id; page = "army"; refresh())
	button_at("部队",Vector2(949,97),Vector2(109,40),func(): page = "army"; refresh())
	button_at("地区",Vector2(1064,97),Vector2(109,40),func(): page = "city"; refresh())
	button_at("建设",Vector2(1179,97),Vector2(109,40),func(): page = "policy"; refresh())
	button_at("战报",Vector2(1294,97),Vector2(117,40),func(): page = "reports"; refresh())
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
	elif page == "policy": policy_panel()
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
	if is_instance_valid(desk): render_desk()

func army_panel() -> void:
	var a = campaign.armies[campaign.selected_army]
	text_line(a.name,28,GOLD)
	text_line("指挥官 %s  /  驻地 %s" % [campaign.people[a.commander].name,campaign.cities[a.city].name],16)
	text_line("士兵 %s    劳工 %s\n战力 %s   ·   后勤%s" % [a.troops,a.labour,campaign.power(a),"充足" if a.labour >= a.troops * 2 else "不足"],16)
	text_line("步枪 %d  /  机枪 %d  /  火炮 %d" % [a.rifles,a.machine_guns,a.artillery],15,GOLD)
	meter("士气",a.morale)
	meter("训练",a.training)
	text_line("本周军饷：%s  /  行军：%s" % ["已付" if a.paid else "未付","可连续行动" if a.moved else "可行动"],14)
	if a.commander != campaign.selected_person:
		action_button("切换到指挥官 %s" % campaign.people[a.commander].name,func(): campaign.selected_person = a.commander; refresh())
	action_button("发军饷  ·  1 气力 / %d 资金" % campaign.salary(),campaign.pay)
	action_button("招募劳工  ·  1 气力 / 20 资金",func(): campaign.organize("labour"),"增加 5,000 劳工；建议每名士兵配 2 名劳工。")
	action_button("操练部队  ·  1 气力 / 15 资金",func(): campaign.organize("train"),"训练 +12。")
	action_button("补充新兵  ·  1 气力 / 25 资金 / 10 支持",func(): campaign.organize("recruit"))
	action_button("购置步枪  ·  1 气力 / 25 资金",func(): campaign.organize("weapons"),"增加 1,000 支步枪。")
	action_button("接管驻地  ·  3 气力",campaign.occupy)

func city_panel() -> void:
	var c = campaign.cities[campaign.selected_city]
	text_line(c.name,28,GOLD)
	action_button("打开地区档案 / 政策工作区",show_desk)
	text_line("我方控制" if c.owner == 0 else "敌方控制",18)
	text_line("基础税收 %d / 周  ·  守军 %d\n实际税收另计政策收益和维护费" % [c.income,c.garrison],16)
	meter("秩序",c.order)
	meter("民众支持",c.support)
	text_line("阶层影响力：农民 %d / 工人 %d\n乡绅 %d / 商人 %d / 学生 %d" % [c.classes["农民"],c.classes["工人"],c.classes["乡绅"],c.classes["商人"],c.classes["学生"]],15,GOLD)
	var a = campaign.armies[campaign.selected_army]
	text_line("当前部队 %s / %s" % [a.name,campaign.cities[a.city].name],16)
	action_button("行军 / 进攻 %s  ·  1 气力" % c.name,func(): campaign.march(campaign.selected_city))
	if c.owner != 0:
		text_line("守军消灭后仍需接管。长沙需要部队驻守，反攻强度为 9,000。",14,GOLD)
	action_button("兴办实业  ·  1 气力 / 20 资金",func(): campaign.govern("develop"))
	action_button("赈济安民  ·  1 气力 / 20 资金",func(): campaign.govern("relief"))
	action_button("组织集会  ·  1 气力 / 5 资金",campaign.rally)

func policy_panel() -> void:
	var c = campaign.cities[campaign.selected_city]
	text_line(c.name + " · 持续建设",26,GOLD)
	action_button("打开政策工作区",show_desk)
	text_line("周税收预计 %d（已计维护费）" % campaign.policy_income(c),15)
	text_line("建设从 10% 开始，每周推进。敌方控制时暂停；巡视只能加速到 99%，完工需周结算。",15)
	for id in Campaign.POLICIES:
		var definition = Campaign.POLICIES[id]
		var progress: int = int(c.policies.get(id, 0))
		meter(definition.name,progress)
		var effect: String = "完工后学生 +15、农民 +5" if id == "school" else ("道路两端完工，行军损耗减半" if id == "roads" else "完工后周税收 +8")
		text_line("每周 +%d%% · 维护 %d / 周\n%s" % [definition.step,definition.upkeep,effect],14)
		if not c.policies.has(id):
			action_button("启动%s · 1 气力 / %d 资金" % [definition.name,definition.cost],func(): campaign.start_policy(id))
		elif progress == 100: text_line("已完工 · 持续生效",14,GOLD)
	action_button("巡视全省 · 3 气力",campaign.inspect,"我方地区：各阶层 +1、秩序 +3，未完成建设 +10%。")

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
	body.text = "目标：十二周内控制长沙，并守住两周。\n\n① 选择人物；资源属于个人。转交 50 资金消耗 1 气力。\n② 点击部队，选择对应指挥官，发军饷、招募劳工和训练。\n③ 点击相邻城市，下达行军 / 进攻命令。每次消耗 1 气力，可以连续行军；运输不足会加重损耗。\n④ 击败守军后耗 3 气力接管，各阶层影响力下降 3。省长治理地区，税收在下一周进入省长账户。\n⑤ 下一周恢复气力、结算税收；欠饷会降低士气并造成逃兵。\n\n建设页：启动电话、道路、学校；按周推进，巡视加速。\n战力由兵力、训练、士气、步枪覆盖率和重武器共同决定。\n长沙防御 = 守军 × 1.5；控制后驻军战力至少 9,000 才能抵御反攻。\n\n学习结构：campaign.gd 管规则；strategic_map.gd 画地图；main.gd 管界面。\n这是依据实玩观察制作的独立学习原型，图形自绘，数值和敌军逻辑简化。"
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.add_theme_font_size_override("font_size",18)
	column.add_child(body)
	var close = Button.new()
	close.text = "返回战役"
	close.pressed.connect(func(): help_panel.queue_free())
	column.add_child(close)


# 地区档案：数据、分类目录和行动详情并排显示，避免长按钮列表。
func show_desk() -> void:
	if not is_instance_valid(desk):
		desk = Panel.new()
		desk.position = Vector2(40,96)
		desk.size = Vector2(1360,684)
		var style = StyleBoxFlat.new()
		style.bg_color = Color("202a2e")
		style.border_color = GOLD
		style.set_border_width_all(2)
		desk.add_theme_stylebox_override("panel",style)
		add_child(desk)
	render_desk()

func desk_label(parent: Control, text_value: String, pos: Vector2, dims: Vector2, font_size: int = 16, color: Color = CREAM) -> Label:
	var item = Label.new()
	item.text = text_value
	item.position = pos
	item.size = dims
	item.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	item.add_theme_font_size_override("font_size",font_size)
	item.add_theme_color_override("font_color",color)
	parent.add_child(item)
	return item

func desk_button(text_value: String, pos: Vector2, dims: Vector2, action: Callable) -> Button:
	var item = Button.new()
	item.text = text_value
	item.position = pos
	item.size = dims
	item.pressed.connect(action)
	desk.add_child(item)
	return item

func desk_box(pos: Vector2, dims: Vector2, color: Color) -> Panel:
	var box = Panel.new()
	box.position = pos
	box.size = dims
	var style = StyleBoxFlat.new()
	style.bg_color = color
	style.set_corner_radius_all(5)
	box.add_theme_stylebox_override("panel",style)
	desk.add_child(box)
	return box

func render_desk() -> void:
	clear_children(desk)
	var c = campaign.cities[campaign.selected_city]
	var p = campaign.people[campaign.selected_person]
	desk_label(desk,"%s  /  地区档案" % c.name,Vector2(24,14),Vector2(500,45),28,GOLD)
	desk_label(desk,"执行人物：%s   气力 %d / 4   资金 %d   人脉 %d" % [p.name,p.energy,p.money,p.influence],Vector2(560,22),Vector2(620,30),16)
	desk_button("返回地图 ×",Vector2(1200,15),Vector2(135,40),func(): desk.queue_free())
	var select = OptionButton.new()
	select.position = Vector2(24,68)
	select.size = Vector2(310,40)
	for region in campaign.cities: select.add_item(region.name + (" · 我方" if region.owner == 0 else " · 敌方"))
	select.select(campaign.selected_city)
	select.item_selected.connect(func(id): campaign.selected_city = id; refresh())
	desk.add_child(select)
	for i in range(3):
		var category = ["建设","治理","群众"][i]
		var tab = desk_button(category,Vector2(360+i*140,68),Vector2(130,40),func(): desk_category = category; desk_selection = "phone" if category == "建设" else ("relief" if category == "治理" else "association"); render_desk())
		tab.modulate = GOLD if desk_category == category else Color.WHITE
	var a = campaign.armies[campaign.selected_army]
	var march_button = desk_button("行军 / 进攻此地 · 1 气力",Vector2(861,68),Vector2(475,40),func(): campaign.march(campaign.selected_city))
	march_button.disabled = campaign.selected_city not in campaign.neighbours(a.city) or a.commander != campaign.selected_person or p.energy < 1 or campaign.result != "" or a.troops <= 0
	march_button.tooltip_text = "%s · 驻地 %s · 战力 %d。需要相邻路线和对应指挥官。" % [a.name,campaign.cities[a.city].name,campaign.power(a)]
	var profile = desk_box(Vector2(24,124),Vector2(310,522),Color("303b3e"))
	desk_label(profile,"地区概况",Vector2(18,14),Vector2(270,35),21,GOLD)
	desk_label(profile,"%s控制   /   守军 %d\n秩序 %d  ·  民众支持 %d\n基础税收 %d  /  净税收 %d" % ["我方" if c.owner == 0 else "敌方",c.garrison,c.order,c.support,c.income,campaign.policy_income(c)],Vector2(18,58),Vector2(275,100),16)
	desk_label(profile,"社会阶层影响力",Vector2(18,170),Vector2(275,30),18,GOLD)
	for i in range(5):
		var group = Campaign.CLASSES[i]
		desk_label(profile,"%s   %d" % [group,c.classes[group]],Vector2(18,211+i*43),Vector2(100,25),15)
		var bar = ProgressBar.new()
		bar.position = Vector2(112,219+i*43)
		bar.size = Vector2(174,9)
		bar.show_percentage = false
		bar.value = c.classes[group]
		profile.add_child(bar)
	var active: Array = []
	for id in c.policies: active.append("%s %d%%" % [Campaign.POLICIES[id].name,c.policies[id]])
	desk_label(profile,"进行中 / 已完成\n" + ("、".join(active) if active.size() > 0 else "暂无建设项目"),Vector2(18,436),Vector2(276,70),14)
	var catalogue = desk_box(Vector2(360,124),Vector2(475,522),Color("283337"))
	desk_label(catalogue,"%s目录  /  选择项目查看条件" % desk_category,Vector2(18,14),Vector2(435,35),20,GOLD)
	var ids: Array = ["phone","roads","school"] if desk_category == "建设" else (["relief","develop","inspect"] if desk_category == "治理" else ["association","aid","rally"])
	var titles = {"phone":"电话网络","roads":"道路整修","school":"乡村学校","relief":"赈济安民","develop":"兴办实业","inspect":"巡视全省","association":"成立农会","aid":"农会互助","rally":"组织集会"}
	for i in range(ids.size()):
		var id = ids[i]
		var state: String = "即时行动"
		if Campaign.POLICIES.has(id):
			state = "%d%% · %s" % [c.policies.get(id,0),"完工" if c.policies.get(id,0) == 100 else ("建设中" if c.policies.has(id) else "未开展")]
		elif id == "association": state = "已成立" if c.association else "未成立 → 解锁互助"
		elif id == "aid": state = "已解锁" if c.association else "前置：成立农会"
		var card = desk_button("%s   %s\n%s" % ["●" if desk_selection == id else "○",titles[id],state],Vector2(380,182+i*118),Vector2(435,94),func(): desk_selection = id; render_desk())
		card.alignment = HORIZONTAL_ALIGNMENT_LEFT
		if desk_selection == id: card.modulate = GOLD
	desk_label(catalogue,"%s" % ("建设 10% → 逐周推进 → 完工后生效" if desk_category == "建设" else ("成立农会 → 解锁互助 → 提升影响力" if desk_category == "群众" else "恢复秩序 → 提高净税收 → 支持军费")),Vector2(18,447),Vector2(435,55),15,GOLD)
	var info = desk_box(Vector2(861,124),Vector2(475,522),Color("303b3e"))
	var id: String = desk_selection
	var energy: int = 1
	var money: int = 0
	var contacts: int = 0
	var effect: String = ""
	var reason: String = ""
	var action: Callable
	if Campaign.POLICIES.has(id):
		var def = Campaign.POLICIES[id]
		money = def.cost
		effect = "持续建设：初始 10%%，每周 +%d%%。\n维护费用：%d 资金 / 周。\n完工收益：基础净税收 +%d。" % [def.step,def.upkeep,def.income]
		if id == "roads": effect += "\n路线两端都完成道路后，行军损耗减半。"
		if id == "school": effect += "\n完工时学生影响力 +15、农民 +5。"
		if c.policies.has(id): reason = "该项目已开展，无需重复启动。"
		action = func(): campaign.start_policy(id)
	else:
		match id:
			"relief": money = 20; effect = "秩序 +15、支持 +10。\n农民影响力 +5、工人 +3。"; action = func(): campaign.govern("relief")
			"develop": money = 20; effect = "本地区基础周税收 +10。"; action = func(): campaign.govern("develop")
			"inspect": energy = 3; effect = "全省我方地区：各阶层影响力 +1、秩序 +3。\n未完工政策进度 +10，最高 99%。"; action = campaign.inspect
			"association":
				energy = 4
				contacts = 5
				effect = "农民影响力 +5。\n成立后解锁「农会互助」。"
				action = func(): campaign.organize_farmers()
				reason = "农会已经成立。" if c.association else ""
			"aid":
				energy = 2
				money = 10
				effect = "农民影响力 +5、秩序 +8。\n前置条件：本地区已成立农会。"
				action = func(): campaign.organize_farmers(true)
				reason = "需要先成立农会。" if not c.association else ""
			"rally": money = 5; effect = "当前人物支持者 +15、人脉 +5。"; action = campaign.rally
	if campaign.result != "": reason = "战役已结束。"
	elif id not in ["rally","inspect"] and c.owner != 0: reason = "该行动需要我方控制地区。"
	elif desk_category != "群众" and campaign.selected_person != 0: reason = "请切换到省长唐生智。"
	elif p.energy < energy: reason = "气力不足，下一周恢复。"
	elif p.money < money: reason = "资金不足，可等待税收或转交资金。"
	elif p.influence < contacts: reason = "人脉不足，先组织集会。"
	desk_label(info,titles[id],Vector2(20,18),Vector2(435,40),26,GOLD)
	desk_label(info,"行动成本\n气力 %d / 资金 %d / 人脉 %d" % [energy,money,contacts],Vector2(20,75),Vector2(435,70),18)
	desk_label(info,effect,Vector2(20,173),Vector2(435,167),17)
	desk_label(info,"行动条件\n" + ("条件满足，可以执行。" if reason == "" else reason),Vector2(20,352),Vector2(435,78),16,GOLD if reason == "" else Color("db9380"))
	var execute = desk_button("执行 · " + titles[id],Vector2(881,573),Vector2(435,50),action)
	execute.disabled = reason != ""
	desk_label(desk,"最近记录：" + str(campaign.reports[0]).replace("\n"," · "),Vector2(24,651),Vector2(1305,28),14).max_lines_visible = 1
