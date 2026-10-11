extends RefCounted
# 汉廷信任（设计 §5.7 的数值核）：每月根据战绩/属国变化增减，影响年度拨款，降到 0 即被召回（汉方失败）。
# 诏令、副使/监军、矫诏尚未实现；朝廷风向（eras）按年份缩放奖惩。

static func era(s) -> Dictionary:
	var y: int = s.year()
	for e in s.bal["court"]["eras"]:
		if y < int(e["until_year"]):
			return e
	return s.bal["court"]["eras"][-1]

static func month_end(s) -> void:
	var c: Dictionary = s.bal["court"]
	var e := era(s)
	var st: Dictionary = s.stats
	var vassals := 0
	for r in s.relations.values():
		if r["overlord"] == "han":
			vassals += 1
	var cur := {"xn_cas": st["xn_battle_dead"], "han_cas": st["han_casualties"], "horses": st["horses_captured"], "hexi_lost": st["hexi_lost"], "vassals": vassals}
	if s.court_prev.is_empty():
		s.court_prev = cur
		return
	var p: Dictionary = s.court_prev
	var delta := 0.0
	delta += float(cur["xn_cas"] - p["xn_cas"]) / 1000.0 * float(c["kill_per_1000"]) * float(e["kill"])
	delta += float(cur["han_cas"] - p["han_cas"]) / 1000.0 * float(c["loss_per_1000"]) * float(e["loss"])
	delta += float(cur["horses"] - p["horses"]) / 1000.0 * float(c["horse_per_1000"]) * float(e["kill"])
	delta += float(cur["hexi_lost"] - p["hexi_lost"]) * float(c["lost_commandery"])
	var gained := maxi(0, cur["vassals"] - p["vassals"])
	delta += float(gained) * float(c["new_vassal"]) * float(e["vassal"])
	if delta <= 0.0 and gained == 0 and cur["xn_cas"] == p["xn_cas"]:
		delta -= float(c["idle_decay_month"])  # 久无功绩，朝中非议
	s.trust = clampf(s.trust + delta, 0.0, 100.0)
	s.court_prev = cur
	if s.trust < float(c["recall_below"]) and s.winner == "":
		s.winner = "xiongnu"
		s.win_reason = "汉廷召回使节（信任归零）"
		s.log_event("victory", s.win_reason)

## 年度拨款倍率（信任越高拨付越多）。
static func grant_mult(s) -> float:
	for t in s.bal["court"]["grant_mult"]:
		if s.trust >= float(t["min"]):
			return float(t["mult"])
	return 0.4
