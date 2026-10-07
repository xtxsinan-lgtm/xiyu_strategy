class_name Campaign
extends RefCounted
## 纯规则层：没有界面依赖。数值是学习版设计，不是原作内部数据。
signal changed
var week: int = 1
var people: Array = []
var cities: Array = []
var armies: Array = []
var selected_person: int = 0
var selected_army: int = 0
var selected_city: int = 4
var hold_weeks: int = 0
var result: String = ""
var reports: Array = []
const CONNECTIONS = [[0,1],[0,2],[0,3],[1,2],[2,3],[3,4],[4,5],[4,6],[4,7],[5,6],[6,7],[7,8],[8,9],[9,0]]
var save_path: String = "user://campaign.json"

func _init() -> void:
	reset()

func reset() -> void:
	week = 1
	selected_person = 0
	selected_army = 0
	selected_city = 4
	hold_weeks = 0
	result = ""
	people = [person("唐生智", "省长 / 军官", 75, 180, 25), person("白崇禧", "军官 / 参谋", 100, 100, 50)]
	cities = []
	var names = ["长沙", "浏阳", "醴陵", "株洲", "衡阳", "郴州", "江华", "永州", "怀化", "湘西"]
	var positions = [[470,110],[700,155],[750,325],[520,310],[480,470],[650,660],[450,760],[290,630],[200,380],[220,150]]
	var incomes = [90,32,35,32,50,30,15,18,24,22]
	for i in range(10):
		cities.append({"name": names[i], "x": positions[i][0], "y": positions[i][1], "owner": 0 if i in [4,5,6] else 1, "income": incomes[i], "order": 70, "support": 65 if i in [4,5,6] else 35, "garrison": 8000 if i == 0 else (3500 if i < 4 else (0 if i < 7 else 2000))})
	armies = [army("湘军第一师",0,9000,18000), army("第七军",1,16000,20000)]
	reports = ["第 1 周 · 衡阳\n目标：占领长沙，并守住两周。\n先发军饷，再选择相邻城市行军。唐生智可治理地区、向白崇禧转交资金。"]
	changed.emit()

func person(n: String, role: String, influence: int, money: int, followers: int) -> Dictionary:
	return {"name":n,"role":role,"energy":4,"influence":influence,"money":money,"followers":followers}

func army(n: String, commander: int, troops: int, labour: int) -> Dictionary:
	return {"name":n,"commander":commander,"city":4,"troops":troops,"labour":labour,"morale":80,"training":60,"paid":false,"moved":false}

func log_message(message: String) -> void:
	reports.push_front("第 %d 周 · %s" % [week, message])
	if reports.size() > 40:
		reports.resize(40)
	changed.emit()

func reject(message: String) -> bool:
	log_message("行动未执行：" + message)
	return false

func spend(energy: int, money: int = 0, followers: int = 0) -> bool:
	if result != "":
		return reject("本局已结束，可重新开局。")
	var p = people[selected_person]
	if p.energy < energy:
		return reject("气力不足，推进下一周恢复。")
	if p.money < money:
		return reject("资金不足，可从同伴转交或等待税收。")
	if p.followers < followers:
		return reject("支持者不足，先组织集会。")
	p.energy -= energy
	p.money -= money
	p.followers -= followers
	return true

func command_allowed() -> bool:
	if armies[selected_army].troops <= 0:
		return reject("该部队已被击溃。")
	if armies[selected_army].commander != selected_person:
		return reject("请先选择这支部队的指挥官。")
	return true

func salary() -> int:
	return ceili(armies[selected_army].troops / 400.0)

func pay() -> bool:
	if not command_allowed(): return false
	var a = armies[selected_army]
	if a.paid: return reject("本周已经发过军饷。")
	if not spend(1, salary()): return false
	a.paid = true
	a.morale = mini(100, a.morale + 8)
	log_message("%s已收到军饷，士气提高。" % a.name)
	return true

func organize(kind: String) -> bool:
	if not command_allowed(): return false
	var a = armies[selected_army]
	match kind:
		"labour":
			if not spend(1, 20): return false
			a.labour += 5000
			log_message("招募 5,000 名运输劳工，改善行军补给。")
		"train":
			if not spend(1, 15): return false
			a.training = mini(100, a.training + 12)
			log_message("%s训练度提高至 %d。" % [a.name, a.training])
		"recruit":
			if not spend(1, 25, 10): return false
			a.troops += 2000
			a.training = maxi(20, a.training - 5)
			log_message("补充 2,000 名新兵，混编后训练度略有下降。")
	return true

func neighbours(id: int) -> Array:
	var ids: Array = []
	for edge in CONNECTIONS:
		if edge[0] == id: ids.append(edge[1])
		if edge[1] == id: ids.append(edge[0])
	return ids

func power(a: Dictionary) -> int:
	return int(a.troops * (0.5 + a.training / 100.0) * (0.4 + a.morale / 100.0))

func march(target: int) -> bool:
	if not command_allowed(): return false
	var a = armies[selected_army]
	if a.moved: return reject("部队本周已行军，下一周可再次移动。")
	if target not in neighbours(a.city): return reject("只能沿地图路线前往相邻地区。")
	if not a.paid: return reject("尚未支付本周军饷。")
	if not spend(1): return false
	var c = cities[target]
	var shortage: bool = a.labour < a.troops * 2
	var loss: int = maxi(8, int(a.troops * (0.035 if shortage else 0.005)))
	a.troops = maxi(0, a.troops - loss)
	a.labour = maxi(0, a.labour - int(a.labour * 0.015))
	a.morale = maxi(10, a.morale - (12 if shortage else 3))
	a.moved = true
	if c.owner != 0 and c.garrison > 0:
		var attack: int = power(a)
		var defense: int = int(c.garrison * (1.5 if target == 0 else 1.15))
		if attack >= defense:
			var casualties: int = int(c.garrison * 0.22)
			a.troops = maxi(0, a.troops - casualties)
			c.garrison = 0
			a.city = target
			log_message("%s攻入%s！行军损失 %d，战斗损失 %d。\n战力 %d / 守军 %d；需再执行「接管地区」。" % [a.name,c.name,loss,casualties,attack,defense])
		else:
			a.troops = maxi(0, a.troops - int(c.garrison * 0.30))
			a.morale = maxi(10, a.morale - 15)
			c.garrison = maxi(0, c.garrison - int(attack * 0.20))
			log_message("攻打%s失利，部队退回原地。训练或补充兵力后再进攻。" % c.name)
	else:
		a.city = target
		log_message("%s抵达%s，损失 %d 名士兵%s。" % [a.name,c.name,loss,"；后勤不足，士气下降" if shortage else ""])
	selected_city = target
	changed.emit()
	return true

func occupy() -> bool:
	if not command_allowed(): return false
	var c = cities[armies[selected_army].city]
	if c.owner == 0: return reject("该地区已经由我方控制。")
	if c.garrison > 0: return reject("必须先击败守军。")
	if not spend(1, 10): return false
	c.owner = 0
	c.order = 55
	c.support = 50
	log_message("%s完成接管。恢复秩序后可增加税收。" % c.name)
	return true

func govern(kind: String) -> bool:
	if selected_person != 0: return reject("只有省长唐生智可执行地区治理。")
	var c = cities[selected_city]
	if c.owner != 0: return reject("只能治理已控制的地区。")
	if not spend(1, 20): return false
	if kind == "develop":
		c.income += 10
		log_message("%s兴办实业，基础周收入增加 10。" % c.name)
	else:
		c.order = mini(100, c.order + 15)
		c.support = mini(100, c.support + 10)
		log_message("%s赈济安民，秩序与支持提高。" % c.name)
	return true

func rally() -> bool:
	if not spend(1, 5): return false
	people[selected_person].followers += 15
	people[selected_person].influence += 5
	log_message("%s组织集会，获得 15 支持者与 5 人脉。" % people[selected_person].name)
	return true

func transfer() -> bool:
	if not spend(1, 50): return false
	var other: int = 1 - selected_person
	people[other].money += 50
	log_message("%s向%s转交 50 资金。" % [people[selected_person].name,people[other].name])
	return true

func next_week() -> void:
	if result != "": return
	week += 1
	var income: int = 0
	for c in cities:
		if c.owner == 0:
			income += int(c.income * c.order / 100.0)
			c.order = maxi(20, c.order - 2)
		else:
			c.garrison += 150
	people[0].money += income
	for p in people: p.energy = 4
	for a in armies:
		if not a.paid:
			a.morale = maxi(10, a.morale - 12)
			a.troops = maxi(0, a.troops - int(a.troops * 0.04))
			reports.push_front("欠饷：%s士气下降并出现逃兵。" % a.name)
		a.paid = false
		a.moved = false
	# 敌军逐周强化，并在攻占长沙之后发起一次可预期的反攻。
	if cities[0].owner == 0:
		var defense: int = 0
		for a in armies:
			if a.city == 0: defense += power(a)
		if defense < 9000:
			cities[0].owner = 1
			cities[0].garrison = 5000
			hold_weeks = 0
			reports.push_front("长沙守备不足，敌军反攻夺回城市。")
		else:
			hold_weeks += 1
			reports.push_front("长沙击退反攻，已守住 %d / 2 周。" % hold_weeks)
	if hold_weeks >= 2: result = "胜利 · 长沙已稳固控制"
	elif week > 12: result = "战役结束 · 未能在十二周内控制长沙"
	elif armies.all(func(a): return a.troops <= 0): result = "战役结束 · 所有部队被击溃"
	log_message("周结算：气力恢复到 4，省长收到税收 %d；敌方守军增加。%s" % [income,"\n" + result if result != "" else ""])

func save_game() -> void:
	var data = {"version":1,"week":week,"people":people,"cities":cities,"armies":armies,"hold_weeks":hold_weeks,"result":result,"reports":reports}
	var file = FileAccess.open(save_path, FileAccess.WRITE)
	if file == null:
		reject("无法写入存档。")
		return
	file.store_string(JSON.stringify(data))
	log_message("存档已保存。")

func load_game() -> bool:
	if not FileAccess.file_exists(save_path): return reject("还没有存档。")
	var data = JSON.parse_string(FileAccess.get_file_as_string(save_path))
	if not data is Dictionary or data.get("version") != 1: return reject("存档格式不兼容。")
	for key in ["people","cities","armies","reports"]:
		if not data.get(key) is Array: return reject("存档数据不完整。")
	if data.people.size() != 2 or data.cities.size() != 10 or data.armies.size() != 2: return reject("存档场景不匹配。")
	week = int(data.week)
	people = data.people
	cities = data.cities
	armies = data.armies
	hold_weeks = int(data.hold_weeks)
	result = data.result
	reports = data.reports
	log_message("存档已读取。")
	return true
