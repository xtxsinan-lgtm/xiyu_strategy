extends RefCounted
# 史实人物（设计 §6）：data/characters.json 由 GameState 载入到 state.characters。
# 状态字段：alive、present（已登场且未退场）、faction_now（受 defect 影响）。生卒/登退场按「公元前年」整数比较。

static func load_all(s, path := "res://data/characters.json") -> void:
	s.characters = {}
	var data = s.load_json(path)
	if data == null:
		return
	for ch in data["characters"]:
		ch = ch.duplicate(true)
		ch["alive"] = true
		ch["faction_now"] = ch["faction"]
		s.characters[ch["id"]] = ch
	refresh(s)

## 按当前年份刷新：到卒年者去世、登场/退场、叛降转属。每月末调用即可（只在年份变化时记事件）。
static func refresh(s) -> void:
	var y: int = s.year()
	for ch in s.characters.values():
		if ch["alive"] and ch["death"] != null and y >= int(ch["death"]):
			ch["alive"] = false
			if y >= int(s.start_year) + 0 and s.tick > 0:
				s.log_event("character", "%s 去世" % ch["name"], {"character": ch["id"]})
		var d = ch.get("defect")
		if d != null and y >= int(d["year"]) and ch["faction_now"] != d["to"]:
			ch["faction_now"] = d["to"]
			if s.tick > 0:
				s.log_event("character", "%s 转投 %s" % [ch["name"], s.factions[d["to"]]["name"]], {"character": ch["id"]})
		ch["present"] = ch["alive"] and y >= int(ch["active_from"]) and y <= int(ch["active_to"])

static func present_of(s, faction: String, role := "") -> Array:
	var out := []
	for ch in s.characters.values():
		if ch["present"] and ch["faction_now"] == faction and (role == "" or ch["role"] == role):
			out.append(ch)
	return out

## 某国当前国王：优先史实有名者，否则占位的「某国王」。
static func ruler_of(s, state_id: String) -> Dictionary:
	var fallback := {}
	for ch in s.characters.values():
		if ch["role"] != "ruler" or ch["faction_now"] != state_id or not ch["alive"]:
			continue
		if ch["named"] and ch["present"]:
			return ch
		if not ch["named"]:
			fallback = ch
	return fallback

## 汉廷西域使节职位的现任：在世、在汉、已登场的 envoy 中取能力最高者（职位继任规则待细化）。
static func court_envoy(s) -> Dictionary:
	var best := {}
	var best_ab := -1
	for ch in present_of(s, "han", "envoy"):
		var ab: int = int(ch["attrs"].get("ability", 0) if ch["attrs"].get("ability", null) != null else 0)
		if ab > best_ab:
			best_ab = ab
			best = ch
	return best
