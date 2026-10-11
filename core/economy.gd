extends RefCounted
# 经济月结（设计 §3）：粮食、人口、马群、军队口粮与消耗。每月末对全图结算一次。

const Buffs = preload("res://core/buffs.gd")

static func month_end(s) -> void:
	for id in s.nodes:
		var n: Dictionary = s.nodes[id]
		_node_food(s, n)
		_node_pop(s, n)
		_node_horses(s, n)
	for id in s.armies.keys():
		if s.armies.has(id):
			_army_food(s, s.armies[id])

## 汉/匈奴/城邦农耕城的存粮：秋收入库 − 居民 − 驻军 − 民夫。
static func _node_food(s, n: Dictionary) -> void:
	if n["type"] in ["source", "nomad", "pass"]:
		return
	var f: Dictionary = s.bal["food"]
	var grain := float(n["grain"])
	if s.month() == int(s.bal["calendar"]["harvest_month"]):
		grain += harvest(s, n)
	grain -= float(n["pop"]) * float(f["civilian_per_month"])
	n["grain"] = maxf(0.0, grain)
	n["starving"] = grain <= 0.0 and n["pop"] > 0
	n["starve_streak"] = int(n["starve_streak"]) + 1 if n["starving"] else 0

## 年产量 = 潜力 × 开垦度 × min(1, 劳力/需求劳力) × 劫掠系数 × 72；征召屯田兵/民夫（levied_out）占用劳力。
static func harvest(s, n: Dictionary) -> float:
	var f: Dictionary = s.bal["food"]
	var need := float(n["farm_cap"]) * float(n["farm_dev"])
	if need <= 0.0:
		return 0.0
	var ratio: float = f["labor_ratio_colony"] if n["colonies"] > 0 else f["labor_ratio_city"]
	var labor := maxf(0.0, float(n["pop"]) * ratio - float(n["levied_out"]))
	var eff := minf(1.0, labor / need)
	return need * eff * float(f["farm_yield_per_worker_year"]) * Buffs.product(s, "farm_mult", n["id"])

static func _node_pop(s, n: Dictionary) -> void:
	if n["pop"] <= 0 or n["type"] == "nomad":
		return
	var p: Dictionary = s.bal["pop"]
	if n["starving"]:
		n["pop"] = int(n["pop"] * (1.0 - float(p["starve_loss_month"])))
		return
	var surplus: bool = float(n["grain"]) >= float(n["pop"]) * float(s.bal["food"]["civilian_per_month"]) * 6.0
	if surplus:
		n["pop"] += int(n["pop"] * float(p["growth_year_if_surplus"]) / 12.0)

## 马群：春季增殖（按牧场余量）、牧场超载死亡；冬季靠粮料，无粮则冻饿死亡（season_winter Buff 设标志）。
static func _node_horses(s, n: Dictionary) -> void:
	if n["horses"] <= 0:
		return
	var h: Dictionary = s.bal["horses"]
	var cap := float(n["pasture_cap"])
	var month = s.month()
	if month in s.bal["calendar"]["spring_months"] and month == int(s.bal["calendar"]["spring_months"][-1]):
		var room := maxf(0.0, cap - float(n["horses"]))
		n["horses"] += int(minf(room, float(n["horses"]) * float(h["spring_growth"])))
	if float(n["horses"]) > cap:
		var die := int(float(n["horses"] - cap) * float(h["overgraze_death_month"]))
		n["horses"] -= die
		s.stats["horses_lost"] += die
	if s.season_flags.get("winter", false) and n["type"] != "nomad":
		var need := float(n["horses"]) * float(s.bal["food"]["horse_fodder_per_month_off_pasture"])
		if float(n["grain"]) >= need:
			n["grain"] -= need
		else:
			var die2 := int(n["horses"] * float(h["winter_no_fodder_death_month"]))
			n["horses"] -= die2
			s.stats["horses_lost"] += die2

## 军队口粮：在己方补给点优先吃补给点存粮并补满行囊；否则吃随军粮；匈奴军另有马奶补充。无粮则减员。
static func _army_food(s, a: Dictionary) -> void:
	var f: Dictionary = s.bal["food"]
	var soldiers = s.army_soldiers(a)
	var need := float(soldiers) * float(f["soldier_per_month"]) + float(a["laborers"]) * float(f["laborer_per_month"])
	if a["faction"] == "xiongnu":
		need = maxf(0.0, need - float(a["horses"]) * float(f["milk_per_horse_month"][s.season()]))
	if a["loc"].has("node"):
		var n: Dictionary = s.nodes[a["loc"]["node"]]
		if s.is_supply_node(n, a["faction"]) and n["type"] != "nomad":
			var take := minf(need, s.stock(n, a["faction"]))
			if n["type"] != "source":
				s.set_stock(n, a["faction"], s.stock(n, a["faction"]) - take)
			need -= take
			refill(s, a, n)
		elif n["type"] == "nomad" and a["faction"] == "xiongnu":
			need = 0.0
	var eat := minf(need, float(a["grain"]))
	a["grain"] -= eat
	need -= eat
	if need > 0.01:
		a["starving"] = int(a["starving"]) + 1
		var loss: float = s.bal["attrition"]["no_food_month"]
		_attrit(s, a, loss)
	else:
		a["starving"] = 0
	if a["loc"].has("route"):
		var terr: String = s.routes[a["loc"]["route"]]["terrain"]
		var key := terr + "_month"
		if s.bal["attrition"].has(key):
			_attrit(s, a, float(s.bal["attrition"][key]))

static func _attrit(s, a: Dictionary, rate: float) -> void:
	var lost := 0
	for t in a["units"]:
		var d := int(ceil(float(a["units"][t]) * rate))
		a["units"][t] = maxi(0, int(a["units"][t]) - d)
		lost += d
	if a["faction"] == "han":
		s.stats["han_casualties"] += lost
	else:
		s.stats["xn_casualties"] += lost
	if s.army_size(a) == 0:
		s.remove_army(a["id"])

## 行囊容量 = 士兵×携粮 + 民夫×携粮；在补给点补满（设计 §3.3）。
static func carry_capacity(s, a: Dictionary) -> float:
	var f: Dictionary = s.bal["food"]
	return float(s.army_soldiers(a)) * float(f["soldier_carry"]) + float(a["laborers"]) * float(f["laborer_carry"])

static func refill(s, a: Dictionary, n: Dictionary) -> void:
	var cap := carry_capacity(s, a)
	var want := maxf(0.0, cap - float(a["grain"]))
	if want <= 0.0:
		return
	var avail: float = 1e18 if n["type"] == "source" else s.stock(n, a["faction"])
	var take := minf(want, avail)
	if n["type"] != "source":
		s.set_stock(n, a["faction"], s.stock(n, a["faction"]) - take)
	a["grain"] += take

## 最大补给天数 T_max = M·k / (c·(N+M))（设计 §3.3 公式，用于 UI 与 AI 估算；返回天数）。
static func max_supply_days(s, soldiers: int, laborers: int) -> float:
	var f: Dictionary = s.bal["food"]
	var total := soldiers + laborers
	if total == 0:
		return 0.0
	var months := (float(soldiers) * float(f["soldier_carry"]) + float(laborers) * float(f["laborer_carry"])) / (float(f["soldier_per_month"]) * float(total))
	return months * 30.0
