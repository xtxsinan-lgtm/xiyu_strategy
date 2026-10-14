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
if t["decision_ticks"] not in (t["ticks_per_month"], t["ticks_per_month"] * 3):
    errs.append("decision_ticks 不是月制或季制")
if not 1 <= sc["start"]["month"] <= 12: errs.append("开局月份不在 1-12")
print(f"节点 {len(ids)}，路段 {len(sc['routes'])}，势力 {len(fids)}，兵种 {len(units)}")
print("\n".join(errs) or "OK")
sys.exit(1 if errs else 0)
