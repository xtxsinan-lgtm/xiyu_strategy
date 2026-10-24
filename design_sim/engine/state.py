"""GameState —— 现有 Godot `core/game_state.gd` 的 Python 抽象移植。

所有数值从仓库 data/*.json 读取（balance / units / buffs / ai_profiles / scenario_mvp /
route_calibration），不手抄。实体依旧用 dict，便于与 GDScript 对照。
"""
import copy
import json
import os
import random
from collections import deque

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(REPO, "data")

_JSON_CACHE = {}


def load_json(path):
    if not os.path.isabs(path):
        path = os.path.join(REPO, path)
    if path not in _JSON_CACHE:
        with open(path, encoding="utf-8") as f:
            _JSON_CACHE[path] = json.load(f)
    return copy.deepcopy(_JSON_CACHE[path])


def deep_merge(base, over):
    """把 over 覆盖进 base（就地），用于 params 覆盖 balance / ai_profiles。"""
    for k, v in (over or {}).items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            deep_merge(base[k], v)
        else:
            base[k] = copy.deepcopy(v)
    return base


TICKS_PER_MONTH = 3
SEASON_CN = {"spring": "春", "summer": "夏", "autumn": "秋", "winter": "冬"}


def season_of(month):
    if 2 <= month <= 4:
        return "spring"
    if 5 <= month <= 7:
        return "summer"
    if 8 <= month <= 10:
        return "autumn"
    return "winter"


class GameState:
    def __init__(self, params, seed=1):
        self.params = params
        data = params.get("data", {})
        self.bal = load_json(data.get("balance", "data/balance.json"))
        deep_merge(self.bal, params.get("balance_overrides"))
        self.units = load_json(data.get("units", "data/units.json"))
        self.ai_profiles = load_json(data.get("ai_profiles", "data/ai_profiles.json"))
        deep_merge(self.ai_profiles, params.get("ai_profile_overrides"))
        self.buff_defs = {b["id"]: b for b in load_json(data.get("buffs", "data/buffs.json"))}
        sc = load_json(data.get("scenario", "data/scenario_mvp.json"))
        self.route_calib = load_json(data.get("route_calibration", "data/route_calibration.json"))
        self.scenario_id = sc["id"]
        self.start_year = int(sc["start"]["year"])
        self.start_month = int(sc["start"]["month"])
        self.max_turns = int(params.get("max_months", sc["max_months"]))
        self.decision_ticks = int(params.get("decision_ticks", 9))
        self.substep_days = float(params.get("substep_days", 2))
        self.seed = seed
        self.rng = random.Random(seed * 1000003 + 7)
        self.tick = 0
        self.day_offset = 0
        self.turn = 0
        self.winner = ""
        self.win_reason = ""
        self.log = []
        self.events = []
        self.keep_log = bool(params.get("keep_log", False))
        self.factions = {}
        for f in sc["factions"]:
            f["money"] = int(f.get("money", 0))
            self.factions[f["id"]] = f
        self.nodes = {}
        for n in sc["nodes"]:
            self._init_node(n)
            self.nodes[n["id"]] = n
        self._apply_route_calibration(sc)
        self.routes = []
        self.adj = {nid: [] for nid in self.nodes}
        self.nbrs = {nid: [] for nid in self.nodes}
        self.route_idx = {}
        for r in sc["routes"]:
            r["raided_by"] = ""
            r["closed_in_winter"] = r["terrain"] in ("mountain", "hazard")
            idx = len(self.routes)
            self.adj[r["a"]].append(idx)
            self.adj[r["b"]].append(idx)
            self.nbrs[r["a"]].append(r["b"])
            self.nbrs[r["b"]].append(r["a"])
            self.route_idx[(r["a"], r["b"])] = idx
            self.route_idx[(r["b"], r["a"])] = idx
            self.routes.append(r)
        self._hop = self._all_pairs_hops()
        self.trade_routes = sc["trade_routes"]
        self.relations = {r["state"]: r for r in sc["relations"]}
        for r in self.relations.values():
            r["han_influence"] = float(r["han_influence"])
            r["xn_intimidation"] = float(r["xn_intimidation"])
            r["xn_resentment"] = float(r["xn_resentment"])
        self.armies = {}
        self.next_army_id = 1
        for a in sc["armies"]:
            ar = self.new_army(a["faction"], a["at"], a["units"], int(a.get("horses", 0)),
                               int(a.get("grain", 0)), int(a.get("laborers", 0)), a["id"])
            self.apply_preset(ar, a.get("preset", "balanced"))
            ar["origin"] = a["at"]
            ar["name"] = a.get("name", a["id"])
            if a.get("garrison", False):
                ar["garrison"] = True
        self.central = dict(sc["han_central_pool"])
        self.buffs = []
        self.streak = {"han": 0, "xiongnu": 0}
        self.stats = {"battles": 0, "han_casualties": 0, "xn_casualties": 0, "horses_captured": 0,
                      "hexi_lost": 0, "han_vassals_peak": 0, "sieges_won": 0}
        self.history = []  # 每月快照（指标模块用）
        self.ext = {}      # 新规则模块的私有状态（S01–S06 扩展点）
        self._dij_cache = {}

    # ---------- 初始化 ----------
    def _apply_route_calibration(self, sc):
        """从 route_calibration.json 重新推导道路天数与骑兵上限，若与 scenario 不符则以校准表为准并记录。"""
        cal = self.route_calib
        model = cal["model"]
        recs = {(r["a"], r["b"]): r for r in cal["routes"]}
        self.calibration_mismatches = []
        for road in sc["routes"]:
            rec = recs.get((road["a"], road["b"]))
            if rec is None:
                continue
            days = round(rec["distance_km"] / model["foot_km_per_day"][rec["terrain"]], 2)
            cap = model["mounted_speed_cap"][rec["terrain"]]
            if abs(days - float(road["days"])) > 1e-6 or abs(cap - float(road.get("mounted_speed_cap", cap))) > 1e-6:
                self.calibration_mismatches.append((road["a"], road["b"]))
            road["days"] = days
            road["mounted_speed_cap"] = cap

    def _init_node(self, n):
        bal = self.bal
        n["wall_hp_max"] = float(n["walls"]) * float(bal["siege"]["wall_hp_per_level"])
        n["wall_hp"] = n["wall_hp_max"]
        n["levied_out"] = 0
        n["recruited"] = {}
        n["colonies"] = 0
        n["depot"] = {}
        n["under_siege_by"] = ""
        n["farm_cap_base"] = n["farm_cap"]
        n["starving"] = False
        n["starve_streak"] = 0
        n["grain"] = float(n["grain"])
        n["pop_cap"] = int(n["pop"] * bal["pop"]["cap_mult"])
        n["militia"] = {}
        fid = n["faction"]
        kind = self.factions[fid]["kind"] if fid in self.factions else "major"
        if kind in ("citystate", "great"):
            ratio = bal["local_militia_ratio"] if kind == "citystate" else bal["great_militia_ratio"]
            total = int(n["pop"] * ratio)
            if kind == "citystate":
                n["militia"] = {"infantry": total // 2, "crossbow": total - total // 2}
            else:
                n["militia"] = {"cavalry": int(total * 0.7), "infantry": total - int(total * 0.7)}

    def _all_pairs_hops(self):
        """跳数：路口（junction）位于道路中段，不额外计一跳。

        以半跳为单位：接触路口的路段计 1，其余计 2；结果向上取整为整跳。
        这样 车师后—路口—赤谷 仍为 1 跳，与拆分前一致。
        """
        out = {}
        for s in self.nodes:
            half = {s: 0}
            q = deque([s])
            while q:  # 权重仅 1/2 且图很小：用松弛式 BFS 即可得到最短距离
                c = q.popleft()
                for nb in self.nbrs[c]:
                    w = 1 if self._is_junction(c) or self._is_junction(nb) else 2
                    if half[c] + w < half.get(nb, 1 << 30):
                        half[nb] = half[c] + w
                        q.append(nb)
            out[s] = {nid: (h + 1) // 2 for nid, h in half.items()}
        # 保持道路直连顺序，路口后紧接其另一侧节点；无路口时与 nbrs 完全一致
        self.near = {}
        for s in self.nodes:
            seq = []
            for nb in self.nbrs[s]:
                seq.append(nb)
                if self._is_junction(nb):
                    seq.extend(x for x in self.nbrs[nb] if x != s)
            self.near[s] = list(dict.fromkeys(x for x in seq if out[s].get(x) == 1))
        return out

    def _is_junction(self, nid):
        return self.nodes[nid]["type"] == "junction"

    # ---------- 日历 ----------
    def month(self, tick=None):
        t = self.tick if tick is None else tick
        return (t // TICKS_PER_MONTH + self.start_month - 1) % 12 + 1

    def month_index(self):
        return self.tick // TICKS_PER_MONTH

    def year(self):
        return self.start_year + (self.tick // TICKS_PER_MONTH + self.start_month - 1) // 12

    def season(self):
        return season_of(self.month())

    def is_winter(self):
        return self.month() in self.bal["calendar"]["winter_months"]

    def date_text(self):
        return "前%d年%d月%s旬" % (-self.year(), self.month(), "上中下"[self.tick % 3])

    # ---------- 查询 ----------
    def kind_of(self, fid):
        return self.factions[fid]["kind"] if fid in self.factions else ""

    def controller(self, node):
        f = node["faction"]
        if f in ("han", "xiongnu"):
            return f
        rel = self.relations.get(f)
        if rel is not None:
            return rel["overlord"]
        return ""

    @staticmethod
    def is_hostile(f1, f2):
        return (f1 == "han" and f2 == "xiongnu") or (f1 == "xiongnu" and f2 == "han")

    def route_between(self, a, b):
        return self.route_idx.get((a, b), -1)

    def neighbors(self, nid):
        """道路直连的相邻节点（行军、撤退用）。"""
        return self.nbrs[nid]

    def near_neighbors(self, nid):
        """一跳范围内的节点：穿过路口视为直连（威吓辐射、烽燧视野等影响力用）。"""
        return self.near[nid]

    def route_closed(self, idx):
        return self.routes[idx]["closed_in_winter"] and self.is_winter()

    def armies_at(self, nid):
        return [a for a in self.armies.values() if a["loc"].get("node") == nid]

    def hops(self, a, b, limit=9):
        d = self._hop[a].get(b, 99)
        return d if d <= limit else 99

    def nodes_of_state(self, sid):
        return [n for n in self.nodes.values() if n["faction"] == sid]

    def state_pop(self, sid):
        return sum(n["pop"] for n in self.nodes.values() if n["faction"] == sid)

    def stock(self, node, fid):
        if node["faction"] == fid:
            return float(node["grain"])
        return float(node["depot"].get(fid, 0.0))

    def set_stock(self, node, fid, v):
        if node["faction"] == fid:
            node["grain"] = max(0.0, v)
        else:
            node["depot"][fid] = max(0.0, v)

    def is_supply_node(self, node, fid):
        if node["type"] == "source":
            return fid == "han"
        if self.controller(node) == fid:
            return True
        if fid == "han" and "v1" in getattr(self, "ext", {}):
            v1 = self.ext["v1"]
            if v1.get("logistics", {}).get("tuntian_nodes", {}).get(node["id"], 0) > 0:
                return True
            if node["depot"].get("han", 0.0) >= 1000.0:
                return True
        return False

    # ---------- 军队 ----------
    def new_army(self, fid, at, u, horses=0, grain=0, laborers=0, aid=""):
        if aid == "":
            aid = "%s_%d" % (fid, self.next_army_id)
            self.next_army_id += 1
        a = {
            "id": aid, "faction": fid, "units": dict(u), "horses": int(horses), "grain": float(grain),
            "laborers": int(laborers), "loc": {"node": at},
            "plan": {"steps": [], "triggers": [], "engage": ["always", 0.0], "preset": "balanced", "step_ticks": 0},
            "is_convoy": False, "starving": 0, "prev_node": at, "origin": at, "init_size": 0, "status": "idle",
            "trace": [], "path": [], "garrison": False, "name": aid,
        }
        a["init_size"] = self.army_size(a)
        self.armies[aid] = a
        return a

    @staticmethod
    def army_size(a):
        return int(sum(a["units"].values()))

    def apply_preset(self, a, preset):
        p = self.bal["presets"].get(preset, self.bal["presets"]["balanced"])
        a["plan"]["preset"] = preset
        a["plan"]["engage"] = list(p["engage"])
        a["plan"]["triggers"] = copy.deepcopy(p["triggers"])

    def remove_army(self, aid):
        a = self.armies.pop(aid, None)
        if a and a.get("commander") and "v1" in getattr(self, "ext", {}):
            v1_ext = self.ext["v1"]
            chars = v1_ext.get("characters") or v1_ext.get("events", {}).get("characters", {})
            ch = chars.get(a["commander"])
            if ch:
                if ch.get("assigned_army") == aid:
                    ch["assigned_army"] = ""
                if ch.get("at_army") == aid:
                    ch["at_army"] = ""

    def log_event(self, kind, text, extra=None):
        e = {"tick": self.tick, "turn": self.turn, "date": self.date_text(), "kind": kind, "text": text}
        if extra:
            e.update(extra)
        self.events.append(e)
        if self.keep_log:
            self.log.append(e)

    # ---------- 寻路缓存（权重只依赖 起点/速度/冬季封闭）----------
    def dijkstra(self, src, speed=1.0, ignore_closed=False):
        closed = (not ignore_closed) and self.is_winter()
        key = (src, speed, closed)
        hit = self._dij_cache.get(key)
        if hit is not None:
            return hit
        import heapq
        dist = {src: 0.0}
        prev = {}
        pq = [(0.0, src)]
        done = set()
        while pq:
            d, cur = heapq.heappop(pq)
            if cur in done:
                continue
            done.add(cur)
            for idx in self.adj[cur]:
                r = self.routes[idx]
                nb = r["b"] if r["a"] == cur else r["a"]
                if closed and r["closed_in_winter"]:
                    continue
                nd = d + travel_days(r, speed)
                if nb not in dist or nd < dist[nb]:
                    dist[nb] = nd
                    prev[nb] = cur
                    heapq.heappush(pq, (nd, nb))
        res = (dist, prev)
        self._dij_cache[key] = res
        return res

    def path_to(self, src, dst, speed=1.0, ignore_closed=False):
        if src == dst:
            return []
        dist, prev = self.dijkstra(src, speed, ignore_closed)
        if dst not in dist:
            return []
        out = []
        cur = dst
        while cur != src:
            out.append(cur)
            cur = prev[cur]
        out.reverse()
        return out

    def days_to(self, src, dst, speed=1.0, ignore_closed=True):
        dist, _ = self.dijkstra(src, speed, ignore_closed)
        return dist.get(dst, float("inf"))


def route_speed(route, speed=1.0):
    return max(0.1, min(speed, float(route.get("mounted_speed_cap", speed))))


def travel_days(route, speed=1.0):
    return float(route["days"]) / route_speed(route, speed)
