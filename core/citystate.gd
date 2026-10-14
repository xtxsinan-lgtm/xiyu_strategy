extends RefCounted
# 城邦归属规则（规则，不是玩家 AI）。每月检查叛离/倒向。

static func monthly(state) -> void:
	var c: Dictionary = state.bal["citystate"]
	for sid in state.relations:
		var rel: Dictionary = state.relations[sid]
		var m: float = 1.5 if state.kind_of(sid) == "great" else 1.0
		var ov: String = rel["overlord"]
		if ov == "xiongnu" and rel["xn_intimidation"] < c["rebel_xn_intimidation_below"] and rel["xn_resentment"] > c["rebel_xn_resentment_above"]:
			rel["overlord"] = ""
			state.log_event("defect", "%s 叛离匈奴" % state.factions[sid]["name"], {"state": sid})
		elif ov == "han" and rel["xn_intimidation"] > rel["han_influence"] + c["defect_to_xn_margin"] * m:
			rel["overlord"] = "xiongnu"
			rel["han_status"] = "none"
			state.log_event("defect", "%s 畏惧匈奴，倒向匈奴" % state.factions[sid]["name"], {"state": sid})
		elif ov == "" and rel["han_influence"] >= rel["xn_intimidation"] + c["defect_to_han_margin"] * m and rel["han_status"] == "enfeoffed":
			if not rel.get("wants_han", false):
				state.log_event("defect", "%s 有意内附" % state.factions[sid]["name"], {"state": sid})
			rel["wants_han"] = true
		else:
			rel["wants_han"] = false
