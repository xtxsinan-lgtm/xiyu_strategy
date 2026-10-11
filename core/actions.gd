extends RefCounted
# 玩家/AI 可下达的行动。成功返回 {"ok":true}，失败返回 {"ok":false,"why":原因}。成本取自 balance.json。

const Buffs = preload("res://core/buffs.gd")
const Pathfinding = preload("res://core/pathfinding.gd")
const Economy = preload("res://core/economy.gd")

static func _fail(why: String) -> Dictionary:
	return {"ok": false, "why": why}

static func _pay(s, fid: String, money: int) -> bool:
	if int(s.factions[fid]["money"]) < money:
		return false
	s.factions[fid]["money"] -= money
	return true

## 赏赐：花钱一次性加影响力，边际递减（已赏赐累计越多，每单位收益越低；累计值每月衰减）。
static func gift(s, sid: String, money: int) -> Dictionary:
	var d: Dictionary = s.bal["diplomacy"]
	if not s.relations.has(sid):
		return _fail("无此国家")
	if not _pay(s, "han", money):
		return _fail("钱不足")
	var r: Dictionary = s.relations[sid]
	var units := float(money) / float(d["gift_unit_money"])
	var gain := 0.0
	for i in int(units):
		var mult := 1.0 / (1.0 + float(r["gifted"]) / (4.0 * float(d["gift_unit_influence"])))
		gain += float(d["gift_unit_influence"]) * mult
		r["gifted"] += float(d["gift_unit_influence"])
	r["han_influence"] = minf(float(d["influence_max"]), float(r["han_influence"]) + gain)
	return {"ok": true, "gain": gain}

static func enfeoff(s, sid: String) -> Dictionary:
	var d: Dictionary = s.bal["diplomacy"]
	var r: Dictionary = s.relations.get(sid, {})
	if r.is_empty() or s.kind_of(sid) == "":
		return _fail("无此国家")
	if r["han_status"] != "none":
		return _fail("已有册封层级")
	if r["overlord"] == "xiongnu":
		return _fail("匈奴属国不可册封")
	if float(r["han_influence"]) < float(d["enfeoff_min_influence"]):
		return _fail("影响力不足")
	if float(r["han_influence"]) < float(d["enfeoff_cost_influence"]) or not _pay(s, "han", int(d["enfeoff_cost_money"])):
		return _fail("钱不足")
	r["han_influence"] -= float(d["enfeoff_cost_influence"])
	r["han_status"] = "enfeoffed"
	Buffs.add(s, "han_enfeoffed", sid, {"amount": float(d["enfeoff_influence_month"])})
	return {"ok": true}

## 册封→属国：影响力够且威吓低于「影响力−margin」；成功解除匈奴属国。
static func make_vassal(s, sid: String) -> Dictionary:
	var d: Dictionary = s.bal["diplomacy"]
	var r: Dictionary = s.relations.get(sid, {})
	if r.is_empty() or r["han_status"] != "enfeoffed":
		return _fail("须先册封")
	if float(r["han_influence"]) < float(d["vassal_min_influence"]):
		return _fail("影响力不足")
	if float(r["xn_intimidation"]) > float(r["han_influence"]) - float(d["vassal_margin_over_intimidation"]):
		return _fail("匈奴威吓过高")
	r["han_influence"] -= float(d["vassal_cost_influence"])
	r["han_status"] = "vassal"
	r["overlord"] = "han"
	r["xn_status"] = "none"
	return {"ok": true}

static func marriage(s, sid: String) -> Dictionary:
	var d: Dictionary = s.bal["diplomacy"]
	var r: Dictionary = s.relations.get(sid, {})
	if r.is_empty() or r["marriage"] != "":
		return _fail("不可和亲")
	if r["overlord"] == "xiongnu":
		return _fail("匈奴属国不可和亲")
	if not _pay(s, "han", int(d["marriage_cost_money"])):
		return _fail("钱不足")
	r["marriage"] = "han"
	r["han_influence"] = minf(float(d["influence_max"]), float(r["han_influence"]) + float(d["marriage_cost_influence"]))
	Buffs.add(s, "han_marriage", sid)
	return {"ok": true}

static func hostage(s, sid: String) -> Dictionary:
	var d: Dictionary = s.bal["diplomacy"]
	var r: Dictionary = s.relations.get(sid, {})
	if r.is_empty() or r["hostage"] != "" or r["han_status"] == "none":
		return _fail("须先册封且无质子")
	r["hostage"] = "han"
	r["han_influence"] = minf(float(d["influence_max"]), float(r["han_influence"]) + float(d["hostage_cost_influence"]))
	return {"ok": true}

## 屯田扩建：花钱 + 占用劳力，expand_turns 个回合后开垦度 +step（由 farm_expand_finish 回调完成）。
static func expand_farm(s, node_id: String) -> Dictionary:
	var f: Dictionary = s.bal["farm"]
	var n: Dictionary = s.nodes[node_id]
	if s.controller(n) != "han" and s.controller(n) != "xiongnu":
		return _fail("非己方控制")
	if float(n["farm_dev"]) >= 1.0 or n["farm_cap"] <= 0:
		return _fail("无可扩建")
	if Buffs.has(s, "farm_expanding", node_id):
		return _fail("已在扩建")
	var fid: String = s.controller(n)
	if not _pay(s, fid, int(f["expand_cost_money"])):
		return _fail("钱不足")
	var labor := int(float(n["pop"]) * float(f["expand_laborers_per_step"]))
	n["levied_out"] += labor
	Buffs.add(s, "farm_expanding", node_id, {"amount": float(f["expand_dev_step"]), "labor": labor})
	return {"ok": true, "labor": labor}

## 下达行军指令：按 Dijkstra 路径逐段前进（速度=最慢兵种），冬季封路段自动绕行/等待。
static func order_move(s, army_id: String, dest: String) -> Dictionary:
	var a: Dictionary = s.armies.get(army_id, {})
	if a.is_empty() or not a["loc"].has("node"):
		return _fail("军队不在节点上")
	var path := Pathfinding.path_to(s, a["loc"]["node"], dest, army_speed(s, a), {}, true)
	if path.is_empty():
		return _fail("无路径")
	a["path"] = path
	a["status"] = "moving"
	a["garrison"] = false
	return {"ok": true, "path": path}

static func army_speed(s, a: Dictionary) -> float:
	var v := 99.0
	for t in a["units"]:
		if int(a["units"][t]) > 0:
			v = minf(v, float(s.units[t]["speed"]))
	if a["laborers"] > 0:
		v = minf(v, 1.0)
	return 1.0 if v == 99.0 else v

## 运输行动（§3.3）：从己方节点 from 调粮 amount 到 to，需民夫 ≥ amount / 载量；民夫出行期间不计入居民（到达归还，路上吃粮即损耗）。
## 运输队是 is_convoy 的特殊军队（无战斗兵种）：遇敌军被截获，截获比例 combat.convoy_capture_ratio。
static func transport(s, fid: String, from_id: String, to_id: String, amount: int, laborers: int) -> Dictionary:
	var f: Dictionary = s.bal["food"]
	var n: Dictionary = s.nodes[from_id]
	if s.controller(n) != fid:
		return _fail("出发地非己方")
	if s.controller(s.nodes[to_id]) != fid:
		return _fail("目的地非己方")
	if float(amount) > float(laborers) * float(f["laborer_carry"]):
		return _fail("民夫载量不足")
	if laborers > int(n["pop"]) / 2 or s.stock(n, fid) < float(amount):
		return _fail("民夫或存粮不足")
	var path := Pathfinding.path_to(s, from_id, to_id, 1.0, {}, true)
	if path.is_empty():
		return _fail("无路径")
	s.set_stock(n, fid, s.stock(n, fid) - float(amount))
	n["pop"] -= laborers
	var a: Dictionary = s.new_army(fid, from_id, {}, 0, amount, laborers)
	a["is_convoy"] = true
	a["garrison"] = false
	a["path"] = path
	a["status"] = "moving"
	a["name"] = "运输队 " + a["id"]
	a["plan"]["triggers"] = []
	return {"ok": true, "id": a["id"]}
