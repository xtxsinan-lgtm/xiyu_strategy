extends RefCounted
# 游戏状态根对象：纯数据 + 查询。实体全部用 Dictionary，便于存档/哈希/测试。

const Cal = preload("res://core/calendar.gd")

var bal: Dictionary
var units: Dictionary
var buff_defs: Dictionary
var ai_profiles: Dictionary
var scenario_id := ""
var start_year := -119
var start_month := 1
var max_turns := 240
var decision_ticks := 9
var player_faction := "han"

var tick := 0
var turn := 0
var rng := RandomNumberGenerator.new()

var factions := {}    # id -> {id,name,kind,money}
var nodes := {}       # id -> node dict
var routes := []      # [{a,b,terrain,days,raided_by}]
var adj := {}         # node id -> [route idx]
var relations := {}   # state id -> relation dict
var armies := {}      # id -> army dict
var trade_routes := []
var buffs := []
var central := {}     # 汉中央军池
var log: Array = []   # 全部历史事件
var events: Array = []  # 当前回合事件（供 UI 回放）
var winner := ""
var win_reason := ""
var streak := {"han": 0, "xiongnu": 0}
var stats := {"battles": 0, "han_casualties": 0, "xn_casualties": 0, "horses_captured": 0, "hexi_lost": 0, "han_vassals_peak": 0, "sieges_won": 0, "horses_lost": 0, "xn_battle_dead": 0, "han_battle_dead": 0}
var next_army_id := 1
var tuntian_started := false
var season_flags := {}   # 由全局 Buff 回调写入，如 {"winter": true}
var requests: Array = []  # 西域国家向汉/匈奴提出的请求（请求册封等），供 UI/AI 消费
var convoy_losses := 0
var trust := 50.0     # 汉廷对使节的信任（§5.7）
var court_prev := {}  # 上月统计快照
var campaigns := {}   # AI 战役：势力 id -> {target, stage, members, phase, deadline}
var ai_factions: Array = []  # 由 AI 控制的势力；默认空（测试用），游戏用 enable_default_ai()


static func load_json(path: String) -> Variant:
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		push_error("无法读取 " + path)
		return null
	return JSON.parse_string(f.get_as_text())


func load_scenario(path := "res://data/scenario_mvp.json", seed_value := 1, decision_ticks_value := -1) -> void:
	bal = load_json("res://data/balance.json")
	units = load_json("res://data/units.json")
	ai_profiles = load_json("res://data/ai_profiles.json")
	buff_defs = {}
	for b in load_json("res://data/buffs.json"):
		buff_defs[b["id"]] = b
	var sc: Dictionary = load_json(path)
	scenario_id = sc["id"]
	start_year = int(sc["start"]["year"])
	start_month = int(sc["start"]["month"])
	max_turns = int(sc["max_turns"])
	player_faction = sc.get("player_faction", "han")
	decision_ticks = decision_ticks_value if decision_ticks_value > 0 else int(bal["time"]["decision_ticks"])
	rng.seed = seed_value
	tick = 0
	turn = 0
	winner = ""
	log = []
	events = []
	factions = {}
	for f in sc["factions"]:
		f["money"] = int(f.get("money", 0))
		factions[f["id"]] = f
	nodes = {}
	for n in sc["nodes"]:
		_init_node(n)
		nodes[n["id"]] = n
	routes = []
	adj = {}
	for id in nodes:
		adj[id] = []
	for r in sc["routes"]:
		r["raided_by"] = ""
		r["closed_in_winter"] = r["terrain"] in ["mountain", "hazard"]
		adj[r["a"]].append(routes.size())
		adj[r["b"]].append(routes.size())
		routes.append(r)
	trade_routes = sc["trade_routes"]
	relations = {}
	for r in sc["relations"]:
		relations[r["state"]] = r
	armies = {}
	next_army_id = 1
	for a in sc["armies"]:
		var ar := new_army(a["faction"], a["at"], a["units"], int(a.get("horses", 0)), int(a.get("grain", 0)), int(a.get("laborers", 0)), a["id"])
		apply_preset(ar, a.get("preset", "balanced"))
		ar["origin"] = a["at"]
		if a.get("garrison", false):
			ar["garrison"] = true
	for r in relations.values():
		r["request_cd"] = 0
		r["gifted"] = 0.0
	central = sc["han_central_pool"].duplicate()
	buffs = []
	season_flags = {}
	campaigns = {}
	trust = float(bal["court"]["initial"])
	court_prev = {}
	requests = []
	streak = {"han": 0, "xiongnu": 0}
	stats = {"battles": 0, "han_casualties": 0, "xn_casualties": 0, "horses_captured": 0, "hexi_lost": 0, "han_vassals_peak": 0, "sieges_won": 0, "horses_lost": 0, "xn_battle_dead": 0, "han_battle_dead": 0}


func _init_node(n: Dictionary) -> void:
	n["wall_hp_max"] = float(n["walls"]) * float(bal["siege"]["wall_hp_per_level"])
	n["wall_hp"] = n["wall_hp_max"]
	n["levied_out"] = 0
	n["recruited"] = {}
	n["colonies"] = 0
	n["depot"] = {}
	n["under_siege_by"] = ""
	n["farm_cap_base"] = n["farm_cap"]
	n["pop_init"] = n["pop"]
	n["starving"] = false
	n["starve_streak"] = 0
	n["militia"] = {}
	var fid: String = n["faction"]
	var kind: String = factions[fid]["kind"] if factions.has(fid) else "major"
	if kind == "citystate" or kind == "great":
		var ratio: float = bal["local_militia_ratio"] if kind == "citystate" else bal["great_militia_ratio"]
		var total := int(n["pop"] * ratio)
		if kind == "citystate":
			n["militia"] = {"infantry": total / 2, "crossbow": total - total / 2}
		else:
			n["militia"] = {"cavalry": int(total * 0.7), "infantry": total - int(total * 0.7)}


# ---------- 查询 ----------
func date_text() -> String:
	return Cal.date_text(tick, start_year, start_month)

func month() -> int:
	return Cal.month_of(tick, start_month)

func year() -> int:
	return Cal.year_of(tick, start_year, start_month)

func season() -> String:
	return Cal.season_of(month())

func is_winter() -> bool:
	return month() in bal["calendar"]["winter_months"]

func kind_of(fid: String) -> String:
	return factions[fid]["kind"] if factions.has(fid) else ""

func is_state(fid: String) -> bool:
	return relations.has(fid)

## 节点的实际控制方："han"/"xiongnu"/""（独立）
func controller(node: Dictionary) -> String:
	var f: String = node["faction"]
	if f == "han" or f == "xiongnu":
		return f
	if relations.has(f):
		return relations[f]["overlord"]
	return ""

## 玩家对面的势力交给 AI。
func enable_default_ai() -> void:
	ai_factions = ["xiongnu" if player_faction == "han" else "han"]

## 该节点 1 跳内是否有敌对势力控制的节点或敌军。
func hostile_near(node_id: String, fid: String) -> bool:
	for nb in neighbors(node_id):
		var c := controller(nodes[nb])
		if c != "" and is_hostile(c, fid):
			return true
	return false

func is_hostile(f1: String, f2: String) -> bool:
	return (f1 == "han" and f2 == "xiongnu") or (f1 == "xiongnu" and f2 == "han")

func route_between(a: String, b: String) -> int:
	for idx in adj[a]:
		var r: Dictionary = routes[idx]
		if (r["a"] == a and r["b"] == b) or (r["a"] == b and r["b"] == a):
			return idx
	return -1

func neighbors(id: String) -> Array:
	var out := []
	for idx in adj[id]:
		var r: Dictionary = routes[idx]
		out.append(r["b"] if r["a"] == id else r["a"])
	return out

func route_days(idx: int) -> float:
	return float(routes[idx]["days"])

func route_closed(idx: int) -> bool:
	return routes[idx]["closed_in_winter"] and is_winter()

func armies_at(node_id: String) -> Array:
	var out := []
	for id in armies:
		var a: Dictionary = armies[id]
		if a["loc"].has("node") and a["loc"]["node"] == node_id:
			out.append(a)
	return out

func army_node(a: Dictionary) -> String:
	return a["loc"]["node"] if a["loc"].has("node") else ""

func hops(from_id: String, to_id: String, limit := 9) -> int:
	if from_id == to_id:
		return 0
	var seen := {from_id: 0}
	var q := [from_id]
	while not q.is_empty():
		var cur: String = q.pop_front()
		if seen[cur] >= limit:
			continue
		for nb in neighbors(cur):
			if not seen.has(nb):
				seen[nb] = seen[cur] + 1
				if nb == to_id:
					return seen[nb]
				q.append(nb)
	return 99

func nodes_of_state(sid: String) -> Array:
	var out := []
	for id in nodes:
		if nodes[id]["faction"] == sid:
			out.append(nodes[id])
	return out

# ---------- 库存（城市所属势力用 node.grain，其余势力用 depot）----------
func stock(node: Dictionary, fid: String) -> float:
	if node["faction"] == fid:
		return float(node["grain"])
	return float(node["depot"].get(fid, 0.0))

func set_stock(node: Dictionary, fid: String, v: float) -> void:
	if node["faction"] == fid:
		node["grain"] = maxf(0.0, v)
	else:
		node["depot"][fid] = maxf(0.0, v)

## 该势力能否在该节点补给（己方城市、己方属国）
func is_supply_node(node: Dictionary, fid: String) -> bool:
	if node["type"] == "source":
		return fid == "han"
	return controller(node) == fid

# ---------- 军队 ----------
func new_army(fid: String, at: String, u: Dictionary, horses := 0, grain := 0, laborers := 0, id := "") -> Dictionary:
	if id == "":
		id = "%s_%d" % [fid, next_army_id]
		next_army_id += 1
	var a := {
		"id": id, "faction": fid, "units": u.duplicate(), "horses": horses, "grain": float(grain), "laborers": laborers,
		"loc": {"node": at}, "plan": {"steps": [], "triggers": [], "engage": ["always", 0.0], "preset": "balanced", "step_ticks": 0},
		"is_convoy": false, "starving": 0, "prev_node": at, "origin": at, "init_size": 0, "status": "idle",
		"trace": [], "path": [], "garrison": false, "name": id,
	}
	a["init_size"] = army_size(a)
	armies[id] = a
	return a

func army_size(a: Dictionary) -> int:
	var s := 0
	for t in a["units"]:
		s += int(a["units"][t])
	return s

func army_soldiers(a: Dictionary) -> int:
	return army_size(a)

func apply_preset(a: Dictionary, preset: String) -> void:
	var p: Dictionary = bal["presets"].get(preset, bal["presets"]["balanced"])
	a["plan"]["preset"] = preset
	a["plan"]["engage"] = p["engage"].duplicate()
	a["plan"]["triggers"] = p["triggers"].duplicate(true)

func remove_army(id: String) -> void:
	armies.erase(id)

func log_event(kind: String, text: String, extra := {}) -> void:
	var e := {"tick": tick, "turn": turn, "date": date_text(), "kind": kind, "text": text}
	e.merge(extra)
	events.append(e)
	log.append(e)

func state_hash() -> int:
	var snap := {"tick": tick, "nodes": nodes, "armies": armies, "relations": relations, "factions": factions, "winner": winner}
	return JSON.stringify(snap, "", true).hash()
