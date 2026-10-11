extends RefCounted
# 战斗结算（设计 §4.4）：接战判定 → 远程 → 近战 → 侧翼 → 溃败与追击。
# 纯函数式：resolve() 原地修改双方 units/horses，返回结果摘要。

## 战力估值：用于接战判定与触发条件。
static func power(s, a: Dictionary) -> float:
	var p := 0.0
	for t in a["units"]:
		var u: Dictionary = s.units[t]
		p += float(a["units"][t]) * (float(u["melee"]) * float(u["mdef"]) + float(u["ranged"]) * float(u["rdef"]) + 0.5)
	if int(a["starving"]) > 0:
		p *= float(s.bal["combat"]["starving_combat_mult"])
	return p

static func mobile_count(s, a: Dictionary) -> int:
	var c := 0
	for t in a["units"]:
		if s.units[t]["row"] == "mobile":
			c += int(a["units"][t])
	return c

static func mobile_speed(s, a: Dictionary) -> float:
	var best := 0.0
	var tot := 0
	for t in a["units"]:
		if s.units[t]["row"] == "mobile" and int(a["units"][t]) > 0:
			best += float(s.units[t]["speed"]) * float(a["units"][t])
			tot += int(a["units"][t])
	return best / float(tot) if tot > 0 else 0.0

## 接战判定（阶段 1）：返回 "fight" / "evade"（防守方避战成功）/ "decline"（进攻方因不利放弃进攻）。
## engage=["always"|"if_favorable", ratio]：己方战力占比 ≥ ratio 才主动接战。机动力比值 ≥ evade_speed_margin 才能避战。
static func engagement(s, attacker: Dictionary, defender: Dictionary, defender_wall := 0.0) -> String:
	var c: Dictionary = s.bal["combat"]
	var pa := power(s, attacker)
	var pd := power(s, defender) * (1.0 + float(c["wall_def_per_level"]) * defender_wall)
	var share := pa / maxf(pa + pd, 1.0)
	var eng: Array = attacker["plan"]["engage"]
	if eng[0] == "if_favorable" and share < float(eng[1]):
		return "decline"
	if not defender["garrison"] and defender_wall <= 0.0:
		var spd_a := mobile_speed(s, attacker) if mobile_count(s, attacker) * 2 >= s.army_size(attacker) else 1.0
		var spd_d := mobile_speed(s, defender) if mobile_count(s, defender) * 2 >= s.army_size(defender) else 1.0
		var d_eng: Array = defender["plan"]["engage"]
		var d_share := 1.0 - share
		var wants_evade: bool = d_eng[0] == "if_favorable" and d_share < float(d_eng[1])
		if wants_evade and spd_d >= spd_a * float(c["evade_speed_margin"]):
			return "evade"
	return "fight"

static func _alloc(s, a: Dictionary, dmg_units: float, defkey: String) -> void:
	# 伤亡按 n/def 加权分配到各兵种
	var wsum := 0.0
	for t in a["units"]:
		wsum += float(a["units"][t]) / float(s.units[t][defkey])
	if wsum <= 0.0:
		return
	for t in a["units"].keys():
		var share := (float(a["units"][t]) / float(s.units[t][defkey])) / wsum
		a["units"][t] = maxi(0, int(a["units"][t]) - int(round(dmg_units * share)))

static func _attack_sum(s, a: Dictionary, key: String, rows: Array, vs: Dictionary) -> float:
	var c: Dictionary = s.bal["combat"]
	var total := 0.0
	for t in a["units"]:
		var u: Dictionary = s.units[t]
		if not (u["row"] in rows):
			continue
		var v := float(a["units"][t]) * float(u[key])
		if "anti_mobile" in u["tags"] and mobile_count(s, vs) > 0:
			v *= float(c["anti_mobile_bonus"])
		total += v
	return total

static func _def_avg(s, a: Dictionary, key: String) -> float:
	var n := 0.0
	var sum := 0.0
	for t in a["units"]:
		n += float(a["units"][t])
		sum += float(a["units"][t]) * float(s.units[t][key])
	return sum / n if n > 0.0 else 1.0

## 结算。wall_a/wall_b：该方获得的城防等级（仅守城方 > 0）。返回 {winner:"a"/"b"/"", loss_a, loss_b, horses_captured}。
static func resolve(s, a: Dictionary, b: Dictionary, wall_a := 0.0, wall_b := 0.0) -> Dictionary:
	var c: Dictionary = s.bal["combat"]
	var size_a0 = s.army_size(a)
	var size_b0 = s.army_size(b)
	var mob_a0 := mobile_count(s, a)
	var mob_b0 := mobile_count(s, b)
	var fa := 1.0 / (1.0 + float(c["wall_def_per_level"]) * wall_a)
	var fb := 1.0 / (1.0 + float(c["wall_def_per_level"]) * wall_b)
	var sa := 0.7 if int(a["starving"]) > 0 else 1.0
	var sb := 0.7 if int(b["starving"]) > 0 else 1.0
	for round_i in int(c["rounds"]):
		var na = 1.0 + (s.rng.randf() * 2.0 - 1.0) * float(c["noise"])
		var nb = 1.0 + (s.rng.randf() * 2.0 - 1.0) * float(c["noise"])
		# 阶段 2 远程：后排 + 弓骑
		var ra = _attack_sum(s, a, "ranged", ["back", "mobile"], b) * float(c["k_ranged"]) * sa * na
		var rb = _attack_sum(s, b, "ranged", ["back", "mobile"], a) * float(c["k_ranged"]) * sb * nb
		# 阶段 3 近战：前排 + 机动（冲击）
		var ma = _attack_sum(s, a, "melee", ["front", "mobile"], b) * float(c["k_melee"]) * sa * na
		var mb = _attack_sum(s, b, "melee", ["front", "mobile"], a) * float(c["k_melee"]) * sb * nb
		# 阶段 4 侧翼：机动兵力占优则额外打击敌后排
		var ma_mob := mobile_count(s, a)
		var mb_mob := mobile_count(s, b)
		var flank_a := 0.0
		var flank_b := 0.0
		if mb_mob == 0 and ma_mob > 0 or (mb_mob > 0 and float(ma_mob) / float(mb_mob) >= float(c["flank_ratio"])):
			flank_a = _attack_sum(s, a, "melee", ["mobile"], b) * float(c["k_melee"]) * 0.5 * sa
		if ma_mob == 0 and mb_mob > 0 or (ma_mob > 0 and float(mb_mob) / float(ma_mob) >= float(c["flank_ratio"])):
			flank_b = _attack_sum(s, b, "melee", ["mobile"], a) * float(c["k_melee"]) * 0.5 * sb
		var dmg_to_b = (ra / _def_avg(s, b, "rdef") + (ma + flank_a) / _def_avg(s, b, "mdef")) * fb
		var dmg_to_a = (rb / _def_avg(s, a, "rdef") + (mb + flank_b) / _def_avg(s, a, "mdef")) * fa
		_alloc(s, b, dmg_to_b, "rdef")
		_alloc(s, a, dmg_to_a, "rdef")
		if s.army_size(a) == 0 or s.army_size(b) == 0:
			break
	# 阶段 5 溃败与追击
	var loss_a = size_a0 - s.army_size(a)
	var loss_b = size_b0 - s.army_size(b)
	var la := float(loss_a) / maxf(1.0, float(size_a0))
	var lb := float(loss_b) / maxf(1.0, float(size_b0))
	var winner := ""
	var broke := float(c["break_loss_ratio"])
	if s.army_size(a) == 0 or (la >= broke and la > lb):
		winner = "b"
	elif s.army_size(b) == 0 or (lb >= broke and lb > la):
		winner = "a"
	var captured := 0
	if winner != "":
		var w: Dictionary = a if winner == "a" else b
		var l: Dictionary = b if winner == "a" else a
		var w_mob := mobile_count(s, w)
		var pursuit := float(c["pursuit_k"]) * float(w_mob) / maxf(1.0, float(s.army_size(l))) * float(s.army_size(l))
		pursuit = minf(pursuit, float(s.army_size(l)) * 0.5)
		_alloc(s, l, pursuit, "mdef")
		captured = int(float(l["horses"]) * float(c["horse_capture_ratio"]))
		l["horses"] -= captured
		w["horses"] += captured
		s.stats["horses_captured"] += captured if w["faction"] == "han" else 0
	loss_a = size_a0 - s.army_size(a)
	loss_b = size_b0 - s.army_size(b)
	s.stats["battles"] += 1
	_account(s, a, loss_a)
	_account(s, b, loss_b)
	# 马匹随骑兵损失同比例消耗
	_scale_horses(a, size_a0, s.army_size(a))
	_scale_horses(b, size_b0, s.army_size(b))
	return {"winner": winner, "loss_a": loss_a, "loss_b": loss_b, "horses_captured": captured, "mob_a": mob_a0, "mob_b": mob_b0}

static func _account(s, a: Dictionary, loss: int) -> void:
	if a["faction"] == "han":
		s.stats["han_casualties"] += loss
	else:
		s.stats["xn_casualties"] += loss

static func _scale_horses(a: Dictionary, before: int, after: int) -> void:
	if before > 0 and after < before:
		a["horses"] = int(float(a["horses"]) * float(after) / float(before))
