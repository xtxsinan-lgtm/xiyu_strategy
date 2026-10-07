extends SceneTree
var errors: int = 0
func check(condition: bool, message: String) -> void:
	if not condition:
		printerr("FAIL: " + message)
		errors += 1

func _initialize() -> void:
	var game = Campaign.new()
	game.selected_army = 1
	check(not game.pay(),"非指挥官不能支付军饷")
	check(game.people[0].money == 180,"失败行动不扣资源")
	game.selected_person = 1
	check(game.organize("labour"),"补充后勤")
	check(game.march(3),"欠饷可攻入株洲")
	check(game.cities[3].owner == 1,"战胜不自动控制地区")
	check(game.armies[1].machine_guns == 54,"战斗缴获机枪")
	check(game.march(0),"同周可再次行军")
	check(game.armies[1].city == 0,"连续行军抵达长沙")
	check(not game.occupy(),"剩余气力不足以接管")
	game.next_week()
	check(game.cities[0].garrison == 0,"驻军阻止敌方在本城重新增兵")
	check(game.people[1].energy == 4,"下周恢复气力")
	check(game.occupy(),"气力恢复后接管长沙")
	check(game.cities[0].classes["农民"] == 7,"接管减少阶层影响力")
	check(game.pay(),"支付守军军饷")
	game.next_week()
	check(game.hold_weeks == 1,"守住第一周")
	game.selected_person = 0
	check(game.transfer(),"补充守军资金")
	game.selected_person = 1
	check(game.pay(),"守军支付军饷")
	game.next_week()
	check(game.result.begins_with("胜利"),"完整战役胜利条件可达")
	game.save_path = "user://test_campaign.json"
	game.save_game()
	var loaded = Campaign.new()
	loaded.save_path = game.save_path
	check(loaded.load_game(),"新版存档可读取")
	check(loaded.result == game.result and loaded.week == game.week,"保留周数及胜利状态")
	check(loaded.armies[1].machine_guns == game.armies[1].machine_guns,"保留武器库存")
	game.reset()
	game.selected_city = 4
	check(game.start_policy("phone"),"启动电话建设")
	var balance: int = game.people[0].money
	check(not game.start_policy("phone"),"重复启动不扣款")
	check(game.people[0].money == balance,"重复启动保留资金")
	check(game.inspect(),"省长巡视")
	check(game.cities[4].policies.phone == 20,"巡视加快建设")
	check(game.cities[4].classes["农民"] == 11,"巡视提高阶层影响力")
	check(game.cities[0].classes["农民"] == 10,"巡视不影响敌方地区")
	game.next_week()
	check(game.cities[4].policies.phone == 35,"周结算推进政策")
	game.cities[4].policies.phone = 95
	check(game.inspect(),"再次巡视")
	check(game.cities[4].policies.phone == 99,"巡视不能直接完工")
	game.next_week()
	check(game.cities[4].policies.phone == 100,"周结算完成建设")
	check(game.policy_income(game.cities[4]) == int(game.cities[4].income * game.cities[4].order / 100.0) + 6,"完工收益扣维护费")
	game.cities[4].policies.school = 95
	var student: int = game.cities[4].classes["学生"]
	game.next_week()
	check(game.cities[4].classes["学生"] == student + 15,"学校完工生效")
	game.next_week()
	check(game.cities[4].classes["学生"] == student + 15,"完工奖励只发一次")
	game.cities[3].policies.phone = 10
	game.next_week()
	check(game.cities[3].policies.phone == 10,"敌方占领时建设暂停")
	game.save_game()
	check(loaded.load_game(),"政策存档读取")
	check(loaded.cities[4].policies.phone == 100,"政策进度保留")
	# 真实版本一结构：删除新增字段，再验证自动补齐。
	var legacy = JSON.parse_string(FileAccess.get_file_as_string(game.save_path))
	legacy.version = 1
	for c in legacy.cities:
		c.erase("classes")
		c.erase("policies")
	for a in legacy.armies:
		for key in ["rifles","machine_guns","artillery"]: a.erase(key)
	var file = FileAccess.open(game.save_path, FileAccess.WRITE)
	file.store_string(JSON.stringify(legacy))
	file.close()
	check(loaded.load_game(),"版本一存档迁移")
	check(loaded.armies[1].rifles == loaded.armies[1].troops,"旧档默认装备正确")
	check(loaded.cities[4].classes.has("学生"),"旧档补齐阶层")
	DirAccess.remove_absolute(game.save_path)
	game.reset()
	game.people[0].energy = 0
	check(not game.rally(),"气力不足不能行动")
	check(game.people[0].followers == 25,"失败不改变资源")
	game.next_week()
	check(game.armies[0].morale == 68,"欠饷降低士气")
	game.reset()
	check(not game.organize_farmers(true),"互助需要农会前置")
	check(game.people[0].energy == 4,"缺少前置不消耗气力")
	check(game.organize_farmers(),"成立农会")
	check(game.cities[4].classes["农民"] == 15,"农会提高影响力")
	check(game.people[0].influence == 70,"农会消耗人脉")
	game.next_week()
	check(game.organize_farmers(true),"农会解锁互助")
	check(game.cities[4].classes["农民"] == 20,"互助提高影响力")
	# 同路线比较道路对运输损失的实际效果。
	var plain = Campaign.new()
	var road = Campaign.new()
	plain.march(5)
	road.cities[4].policies.roads = 100
	road.cities[5].policies.roads = 100
	road.march(5)
	check(road.armies[0].troops > plain.armies[0].troops,"道路减轻行军损耗")
	var equipped: int = game.power(game.armies[0])
	game.armies[0].rifles = 0
	check(game.power(game.armies[0]) < equipped,"步枪不足降低战力")
	print("Campaign checks: ","PASS" if errors == 0 else "FAIL", " / errors=",errors)
	quit(errors)
