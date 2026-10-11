#!/usr/bin/env python3
"""数据一致性检查（不依赖 Godot）：python3 tests/check_data.py"""
import json, sys
d = lambda f: json.load(open(f"data/{f}", encoding="utf-8"))
sc, bal, units = d("scenario_mvp.json"), d("balance.json"), d("units.json")
errs = []
ids = {n["id"] for n in sc["nodes"]}
fids = {f["id"] for f in sc["factions"]}
for r in sc["routes"]:
    for k in "ab":
        if r[k] not in ids: errs.append(f"路段端点不存在: {r}")
for t in sc["trade_routes"]:
    for n in t["nodes"]:
        if n not in ids: errs.append(f"商路节点不存在: {t['id']} {n}")
for n in sc["nodes"]:
    if n["faction"] not in fids: errs.append(f"节点势力不存在: {n['id']}")
for a in sc["armies"]:
    if a["at"] not in ids: errs.append(f"军队位置不存在: {a['id']}")
    for u in a["units"]:
        if u not in units: errs.append(f"未知兵种: {a['id']} {u}")
for r in sc["relations"]:
    if r["state"] not in fids: errs.append(f"关系对象不存在: {r['state']}")
v = bal["victory"]
for n in v["han_must_have"] + v["xn_targets"]:
    if n not in ids and n not in fids: errs.append(f"胜利条件引用不存在: {n}")
months = sum((bal["calendar"][k] for k in ("winter_months", "spring_months", "summer_months", "autumn_months")), [])
if sorted(months) != list(range(1, 13)): errs.append("四季月份未覆盖 1-12")
t = bal["time"]
if t["decision_ticks"] % (t["ticks_per_month"] * 3): errs.append("decision_ticks 不是整季")
if (sc["start"]["month"] - 3) % 3: errs.append("开局月份未对齐季首（3/6/9/12）")
chars = json.load(open("data/characters.json", encoding="utf-8"))["characters"]
cids = set()
for ch in chars:
    if ch["id"] in cids: errs.append(f"人物 id 重复: {ch['id']}")
    cids.add(ch["id"])
    if ch["faction"] not in fids: errs.append(f"人物势力不存在: {ch['id']} {ch['faction']}")
    if ch["birth"] is not None and ch["death"] is not None and ch["death"] < ch["birth"]: errs.append(f"人物卒年早于生年: {ch['id']}")
    if ch["active_from"] > ch["active_to"]: errs.append(f"人物活跃区间颠倒: {ch['id']}")
    if ch["verification"] not in ("searched", "recalled"): errs.append(f"人物核对状态非法: {ch['id']}")
    if not ch["named"] and ch["name"].count("王") == 0: errs.append(f"缺名国王应以称号命名: {ch['id']}")
    d = ch.get("defect")
    if d and d["to"] not in fids: errs.append(f"人物转属势力不存在: {ch['id']}")
print(f"节点 {len(ids)}，路段 {len(sc['routes'])}，势力 {len(fids)}，兵种 {len(units)}")
print("\n".join(errs) or "OK")
sys.exit(1 if errs else 0)
