extends RefCounted
# 命令：玩家与 AI 共用。cmd 是 Dictionary：{type, faction, ...}。
# validate() 返回 "" 表示合法，否则返回原因；apply() 执行。

const Diplomacy = preload("res://core/diplomacy.gd")
const Buffs = preload("res://core/buff_system.gd")
const Supply = preload("res://core/supply.gd")
const Economy = preload("res://core/economy.gd")

static func make(type: String, faction: String, args := {}) -> Dictionary:
	var c = {"type": type, "faction": faction}
	c.merge(args)
	return c

static func validate(state, c: Dictionary) -> String:
	var f: String = c["faction"]
	match c["type"]:
		"set_plan":
			var a = state.armies.get(c["army"])
			if a == null or a["faction"] != f:
				return "不是你的军队"
			for s in c["steps"]:
				for key in ["node", "from", "to"]:
					if s.has(key) and not state.nodes.has(s[key]):
						return "未知地点 " + str(s[key])
				if s["type"] == "ambush":
					var ri = int(s.get("route", -1))
					if ri < 0 or ri >= state.routes.size():
						return "设伏道路无效"
					var route: Dictionary = state.routes[ri]
					if s.get("node", "") not in [route["a"], route["b"]] or s.get("months", 0) <= 0:
						return "设伏须选择道路端点和持续月份"
				if a["is_convoy"] and s["type"] in ["siege", "burn", "ambush"]:
					return "运输队不能执行攻击步骤"
				if s["type"] in ["siege", "burn"] and state.nodes.get(s.get("node", ""), {}).get("type", "") == "junction":
					return "路口无城可攻、无田可焚"
			return ""
		"recruit":
			return _v_recruit(state, c)
		"load":
			var a = state.armies.get(c["army"])
			if a == null or a["faction"] != f:
				return "不是你的军队"
			if not a["loc"].has("node"):
				return "军队在路上"
			var n: Dictionary = state.nodes[a["loc"]["node"]]
			if not state.is_supply_node(n, f):
				return "此处不是己方补给点"
			return ""
		"convoy":
			var n = state.nodes.get(c["from"])
			if n == null or not state.nodes.has(c["to"]):
				return "地点无效"
			if c["from"] == c["to"]:
				return "起点与目的地不能相同"
			if c["grain"] < 0:
				return "装粮不能为负数"
			if not state.is_supply_node(n, f):
				return "起点不是己方补给点"
			if c["laborers"] <= 0:
				return "需要民夫"
			var avail = int(n["pop"] * state.bal["han"]["laborer_levy_ratio"]) - n["levied_out"]
			if f != "han":
				return "仅汉可组织民夫运输"
			if c["laborers"] > avail and n["type"] != "source":
				return "民夫不足（可征 %d）" % avail
			return ""
		"split":
			var a = state.armies.get(c["army"])
			if a == null or a["faction"] != f or not a["loc"].has("node"):
				return "无法拆分"
			for t in c["units"]:
				if c["units"][t] < 0:
					return "拆分兵力不能为负数"
				if a["units"].get(t, 0) < c["units"][t]:
					return "兵力不足"
			return ""
		"merge":
			if c["army"] == c["into"]:
				return "不能合并军队自身"
			var a = state.armies.get(c["army"])
			var b = state.armies.get(c["into"])
			if a == null or b == null or a["faction"] != f or b["faction"] != f:
				return "无法合并"
			if not (a["loc"].has("node") and b["loc"].has("node") and a["loc"]["node"] == b["loc"]["node"]):
				return "须在同一节点"
			return ""
		"disband":
			var a = state.armies.get(c["army"])
			return "" if a != null and a["faction"] == f else "不是你的军队"
		"expand_farm":
			var n = state.nodes.get(c["node"])
			if f != "han" or n == null or n["faction"] != "han":
				return "仅限汉直辖节点"
			if n["farm_cap"] <= 0:
				return "无农田"
			if Buffs.has(state, "farm_expanding", n["id"]):
				return "正在扩田"
			if n["farm_cap"] >= n["farm_cap_base"] * state.bal["farm"]["potential_mult"]:
				return "已达上限"
			if state.factions[f]["money"] < state.bal["farm"]["expand_cost_money"]:
				return "钱不足"
			return ""
		"found_colony":
			var n = state.nodes.get(c["node"])
			var a = state.armies.get(c["army"])
			if f != "han" or n == null or a == null:
				return "无效"
			if a["faction"] != f or not a["is_convoy"] or state.army_size(a) > 0:
				return "须使用己方无战斗部队的运输队"
			if state.controller(n) != "han":
				return "须在汉直辖或汉属国"
			if not (a["loc"].has("node") and a["loc"]["node"] == n["id"]) or a["laborers"] <= 0:
				return "运输队须在场且有民夫"
			return ""
		"gift":
			if f != "han" or not state.relations.has(c["state"]):
				return "无效"
			if c["units"] <= 0:
				return "赏赐份数须大于零"
			if state.factions["han"]["money"] < c["units"] * state.bal["diplomacy"]["gift_unit_money"]:
				return "钱不足"
			return ""
		"enfeoff":
			return Diplomacy.can_enfeoff(state, c["state"]) if f == "han" else "仅汉"
		"make_vassal":
			return Diplomacy.can_vassal(state, c["state"]) if f == "han" else "仅汉"
		"demand_vassal":
			return Diplomacy.can_demand(state, c["state"]) if f == "xiongnu" else "仅匈奴"
		"set_tax":
			var rel = state.relations.get(c["state"])
			if f != "xiongnu" or rel == null or rel["overlord"] != "xiongnu":
				return "仅限匈奴属国"
			return ""
		"buy_grain":
			var n = state.nodes.get(c["node"])
			if f != "han" or n == null or not state.relations.has(n["faction"]):
				return "无效"
			if c["amount"] <= 0:
				return "购粮数量须大于零"
			var rel: Dictionary = state.relations[n["faction"]]
			if rel["overlord"] != "han" and rel["han_status"] != "enfeoffed":
				return "需册封或属国"
			if n["grain"] < c["amount"]:
				return "城邦存粮不足"
			if state.factions["han"]["money"] < c["amount"] / 100.0 * Diplomacy.buy_grain_price(state, n["faction"]):
				return "钱不足"
			return ""
	return "未知命令"

static func _v_recruit(state, c: Dictionary) -> String:
	var f: String = c["faction"]
	var n = state.nodes.get(c["node"])
	if n == null:
		return "地点无效"
	var tot = 0
	for t in c["units"]:
		if not state.units.has(t) or c["units"][t] < 0:
			return "兵种或征召数量无效"
		tot += int(c["units"][t])
	if tot <= 0:
		return "数量为 0"
	var h: Dictionary = state.bal["han"]
	match c["source"]:
		"central":
			if f != "han" or n["faction"] != "han":
				return "中央军只能在汉直辖城征召"
			for t in c["units"]:
				if state.central.get(t, 0) < c["units"][t]:
					return "中央军池不足（%s）" % state.units[t]["name"]
			var cost = 0.0
			for t in c["units"]:
				cost += c["units"][t] / 1000.0 * state.units[t]["cost_money_per_1000"]
			if state.factions[f]["money"] < cost:
				return "钱不足（需 %d）" % int(cost)
		"tuntian":
			if f != "han" or n["faction"] != "han" or n["farm_cap"] <= 0:
				return "屯田兵须在汉屯田城"
			var cap = int(n["pop"] * h["tuntian_levy_ratio"]) - n["recruited"].get("tuntian", 0)
			if tot > cap or c["units"].keys() != ["infantry"]:
				return "屯田兵仅步兵，上限 %d" % cap
		"hu":
			if f != "han" or state.controller(n) != "han" or n["faction"] == "han":
				return "胡骑须在汉属国征召"
			var cap2 = int(n["pop"] * h["hu_cavalry_levy_ratio"]) - n["recruited"].get("hu", 0)
			if tot > cap2 or c["units"].keys() != ["cavalry"]:
				return "胡骑仅骑兵，上限 %d" % cap2
			if n["horses"] < tot:
				return "当地马匹不足"
			if state.factions[f]["money"] < tot / 1000.0 * h["hu_cavalry_cost_per_1000"]:
				return "钱不足"
		"nomad":
			if f != "xiongnu" or n["faction"] != "xiongnu":
				return "须在匈奴直辖地征召"
			var cap3 = int(n["pop"] * state.bal["xiongnu"]["levy_ratio"]) - n["recruited"].get("nomad", 0)
			if tot > cap3 or c["units"].keys() != ["horse_archer"]:
				return "牧民征召仅弓骑，上限 %d" % cap3
			if n["horses"] < tot * 2:
				return "马匹不足（每骑 2 匹）"
		"vassal":
			if f != "xiongnu" or state.controller(n) != "xiongnu" or n["faction"] == "xiongnu":
				return "须在匈奴属国征召"
			var cap4 = int(n["pop"] * state.bal["xiongnu"]["vassal_infantry_levy_ratio"]) - n["recruited"].get("vassal", 0)
			if tot > cap4 or c["units"].keys() != ["infantry"]:
				return "属国征召仅步兵，上限 %d" % cap4
		_:
			return "未知兵源"
	return ""

static func apply(state, c: Dictionary) -> void:
	var f: String = c["faction"]
	match c["type"]:
		"set_plan":
			var a: Dictionary = state.armies[c["army"]]
			var steps: Array = []
			for s in c["steps"]:
				steps.append(s.duplicate(true))
			a["plan"]["steps"] = steps
			a["plan"]["step_ticks"] = 0
			if c.has("preset"):
				state.apply_preset(a, c["preset"])
			if c.has("engage"):
				a["plan"]["engage"] = c["engage"]
			if c.has("triggers"):
				a["plan"]["triggers"] = c["triggers"]
			a["plan"]["reacted"] = false
			a["init_size"] = state.army_size(a)
			a["path"] = []
			if c.has("role"):
				a["ai_role"] = c["role"]
			a["origin"] = a["loc"]["node"] if a["loc"].has("node") else a["loc"]["from"]
			a["garrison"] = c["preset"] == "garrison" if c.has("preset") else a["garrison"]
		"recruit":
			_a_recruit(state, c)
		"load":
			var a: Dictionary = state.armies[c["army"]]
			var n: Dictionary = state.nodes[a["loc"]["node"]]
			var room = Supply.carry_cap(state, a) - a["grain"]
			var lab: int = int(c.get("laborers", 0))
			if lab > 0 and f == "han":
				var avail = int(n["pop"] * state.bal["han"]["laborer_levy_ratio"]) - n["levied_out"]
				lab = mini(lab, maxi(0, avail))
				a["laborers"] += lab
				n["levied_out"] += lab
				a["convoy_home"] = n["id"]
				room = Supply.carry_cap(state, a) - a["grain"]
			var g = maxf(0.0, minf(float(c.get("grain", 0)), room))
			if n["type"] != "source":
				if f == "xiongnu" and n["faction"] != f:
					g = minf(g, n["grain"])
					n["grain"] -= g
					var relation: Dictionary = state.relations[n["faction"]]
					if g > 0:
						relation["xn_resentment"] = minf(100.0, relation["xn_resentment"] + state.bal["diplomacy"]["levy_grain_resentment"])
				else:
					g = minf(g, state.stock(n, f))
					state.set_stock(n, f, state.stock(n, f) - g)
			a["grain"] += g
		"convoy":
			var n: Dictionary = state.nodes[c["from"]]
			var a: Dictionary = state.new_army(f, c["from"], {}, 0, 0, int(c["laborers"]))
			a["is_convoy"] = true
			a["name"] = "运输队" + a["id"].split("_")[-1]
			a["init_size"] = 0
			a["convoy_home"] = n["id"]
			a["ai_role"] = c.get("role", "")
			a["origin"] = n["id"]
			n["levied_out"] += int(c["laborers"])
			var g = minf(float(c["grain"]), Supply.carry_cap(state, a))
			if n["type"] != "source":
				g = minf(g, state.stock(n, f))
				state.set_stock(n, f, state.stock(n, f) - g)
			a["grain"] = g
			state.apply_preset(a, "cautious")
			a["plan"]["triggers"] = []
			a["plan"]["engage"] = ["never", 0.0]
			if c.get("loop", false):
				a["plan"]["steps"] = [{"type": "loop_convoy", "from": c["from"], "to": c["to"], "grain_per_trip": c["grain"], "phase": "go"}]
			else:
				if c.get("stay", false):
					a["plan"]["steps"] = [{"type": "deliver", "node": c["to"]}, {"type": "hold", "node": c["to"], "until": "end"}]
				else:
					a["plan"]["steps"] = [{"type": "deliver", "node": c["to"]}, {"type": "return_to", "node": c["from"]}]
		"split":
			var a: Dictionary = state.armies[c["army"]]
			var b: Dictionary = state.new_army(f, a["loc"]["node"], c["units"].duplicate())
			var mounts_all := 0
			var mounts_out := 0
			for t in a["units"]:
				mounts_all += int(a["units"][t]) * int(state.units[t]["horses"])
			for t in c["units"]:
				mounts_out += int(c["units"][t]) * int(state.units[t]["horses"])
			var hh: int = mini(mounts_out, int(maxi(0, a["horses"]) * float(mounts_out) / maxi(1, mounts_all)))
			a["horses"] -= hh
			b["horses"] += hh
			for t in c["units"]:
				a["units"][t] -= c["units"][t]
			var g = minf(float(c.get("grain", 0)), a["grain"])
			a["grain"] -= g
			b["grain"] = g
			var lab: int = mini(int(c.get("laborers", 0)), a["laborers"])
			a["laborers"] -= lab
			b["laborers"] = lab
			b["plan"]["engage"] = a["plan"]["engage"].duplicate()
			b["ai_role"] = c.get("role", "")
			b["init_size"] = state.army_size(b)
		"merge":
			var a: Dictionary = state.armies[c["army"]]
			var b: Dictionary = state.armies[c["into"]]
			for t in a["units"]:
				b["units"][t] = b["units"].get(t, 0) + a["units"][t]
			b["horses"] += a["horses"]
			b["grain"] += a["grain"]
			b["laborers"] += a["laborers"]
			b["init_size"] = state.army_size(b)
			state.remove_army(a["id"])
		"disband":
			var a: Dictionary = state.armies[c["army"]]
			if a["loc"].has("node"):
				var n: Dictionary = state.nodes[a["loc"]["node"]]
				if f == "han" and state.controller(n) == "han":
					for t in a["units"]:
						if t in state.bal["han"]["central_cap"]:
							state.central[t] = mini(int(state.bal["han"]["central_cap"][t]), state.central.get(t, 0) + a["units"][t])
				state.set_stock(n, f, state.stock(n, f) + a["grain"])
			state.remove_army(a["id"])
		"expand_farm":
			var n: Dictionary = state.nodes[c["node"]]
			state.factions[f]["money"] -= state.bal["farm"]["expand_cost_money"]
			var b = Buffs.apply(state, "farm_expanding", n["id"], {"amount": state.bal["farm"]["expand_amount"]})
			b["turns_left"] = state.bal["farm"]["expand_turns"]
			state.log_event("economy", "开始扩大屯田：" + n["name"], {"node": n["id"]})
		"found_colony":
			var n: Dictionary = state.nodes[c["node"]]
			var a: Dictionary = state.armies[c["army"]]
			n["colonies"] += a["laborers"]
			if a["grain"] > 0:
				state.set_stock(n, f, state.stock(n, f) + a["grain"])
			state.remove_army(a["id"])
			state.log_event("economy", "在%s设立屯田区" % n["name"], {"node": n["id"]})
		"gift":
			Diplomacy.gift(state, c["state"], int(c["units"]))
		"enfeoff":
			Diplomacy.enfeoff(state, c["state"])
		"make_vassal":
			Diplomacy.make_vassal(state, c["state"])
		"demand_vassal":
			Diplomacy.demand_vassal(state, c["state"])
		"set_tax":
			state.relations[c["state"]]["tax_level"] = clampi(int(c["level"]), 0, 3)
		"buy_grain":
			var n: Dictionary = state.nodes[c["node"]]
			var price = Diplomacy.buy_grain_price(state, n["faction"])
			state.factions["han"]["money"] -= int(c["amount"] / 100.0 * price)
			n["grain"] -= c["amount"]
			n["depot"]["han"] = n["depot"].get("han", 0.0) + c["amount"]

static func _a_recruit(state, c: Dictionary) -> void:
	var f: String = c["faction"]
	var n: Dictionary = state.nodes[c["node"]]
	var tot = 0
	for t in c["units"]:
		tot += int(c["units"][t])
	var horses = 0
	match c["source"]:
		"central":
			for t in c["units"]:
				state.central[t] -= c["units"][t]
				state.factions[f]["money"] -= int(c["units"][t] / 1000.0 * state.units[t]["cost_money_per_1000"])
				horses += int(state.units[t]["horses"]) * int(c["units"][t])
		"tuntian":
			n["recruited"]["tuntian"] = n["recruited"].get("tuntian", 0) + tot
			n["levied_out"] += tot
		"hu":
			n["recruited"]["hu"] = n["recruited"].get("hu", 0) + tot
			n["horses"] -= tot
			horses = tot
			state.factions[f]["money"] -= int(tot / 1000.0 * state.bal["han"]["hu_cavalry_cost_per_1000"])
		"nomad":
			n["recruited"]["nomad"] = n["recruited"].get("nomad", 0) + tot
			n["horses"] -= tot * 2
			horses = tot * 2
		"vassal":
			n["recruited"]["vassal"] = n["recruited"].get("vassal", 0) + tot
			var rel = state.relations.get(n["faction"])
			if rel != null:
				rel["xn_resentment"] = minf(100.0, rel["xn_resentment"] + state.bal["xiongnu"]["vassal_levy_resentment"])
	var a: Dictionary = state.new_army(f, n["id"], c["units"].duplicate(), horses)
	state.apply_preset(a, c.get("preset", "balanced"))
	a["ai_role"] = c.get("role", "")
	a["origin"] = n["id"]
	a["name"] = "%s军%s" % [state.factions[f]["name"], a["id"].split("_")[-1]]
	state.log_event("recruit", "%s 在%s召集 %d 人" % [state.factions[f]["name"], n["name"], tot], {"army": a["id"]})
