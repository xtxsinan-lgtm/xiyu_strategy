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
	check(game.people[0].money == 180,"失败行动不能扣除资金")
	game.selected_person = 1
	check(not game.march(3),"欠饷不能行军")
	check(game.pay(),"指挥官可以发饷")
	check(game.march(3),"部队可攻入株洲")
	check(game.cities[3].owner == 1,"战胜不自动获得控制权")
	check(not game.march(0),"同周不能二次行军")
	check(game.occupy(),"战胜后可接管")
	game.next_week()
	check(game.people[1].energy == 4,"下周恢复气力")
	check(game.people[0].money > 180,"税收进入省长账户")
	check(not game.armies[1].paid,"下周重新支付军饷")
	# 按实际行动成本完成一局，验证胜利条件可达。
	game.selected_person = 0
	check(game.transfer(),"省长能转交资金")
	game.selected_person = 1
	check(game.pay(),"第二周发饷")
	check(game.organize("labour"),"补充后勤")
	check(game.march(0),"攻入长沙")
	check(game.occupy(),"接管长沙")
	game.next_week()
	check(game.hold_weeks == 1,"守住第一周")
	game.selected_person = 0
	check(game.transfer(),"补充守军资金")
	game.selected_person = 1
	check(game.pay(),"守军支付军饷")
	game.next_week()
	check(game.result.begins_with("胜利"),"守住两周触发胜利")
	game.save_path = "user://test_campaign.json"
	game.save_game()
	var loaded = Campaign.new()
	loaded.save_path = game.save_path
	check(loaded.load_game(),"读取存档")
	check(loaded.result == game.result and loaded.week == game.week,"存档保留周数和胜利状态")
	check(loaded.armies[1].troops == game.armies[1].troops,"存档保留部队")
	DirAccess.remove_absolute(game.save_path)
	game.reset()
	game.people[0].energy = 0
	check(not game.rally(),"气力耗尽不能行动")
	check(game.people[0].followers == 25,"气力不足不改变资源")
	game.armies[0].morale = 80
	game.next_week()
	check(game.armies[0].morale == 68,"欠饷降低士气")
	check(game.armies[0].troops < 9000,"欠饷出现逃兵")
	print("Campaign checks: ","PASS" if errors == 0 else "FAIL", " / errors=",errors)
	quit(errors)
