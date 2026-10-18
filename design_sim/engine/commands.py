"""命令校验与执行 —— 移植自 core/commands.gd，并提供新规则命令扩展注册表与合法命令枚举器。"""
import copy

from . import buffs, combat, economy, supply

# 新规则命令注册表：cmd_type -> {"validate": fn(state, c)->str, "apply": fn(state, c)->None, "describe": fn(state, c)->str}
CUSTOM_COMMANDS = {}


def register_command(cmd_type, validate_fn, apply_fn, describe_fn=None):
    """供 S01–S06 新规则插件注册新增命令。"""
    CUSTOM_COMMANDS[cmd_type] = {
        "validate": validate_fn,
        "apply": apply_fn,
        "describe": describe_fn,
    }


def make(cmd_type, faction, args=None):
    c = {"type": cmd_type, "faction": faction}
    if args:
        c.update(args)
    return c


def validate(state, c):
    # 1) 先让激活的规则集插件拦截或校验自定义命令
    for rule in getattr(state, "rules", ()):
        v = rule.validate_command(state, c)
        if v is not None:
            return v
    t = c.get("type", "")
    if t in CUSTOM_COMMANDS:
        return CUSTOM_COMMANDS[t]["validate"](state, c)

    f = c.get("faction", "")
    if t == "set_plan":
        a = state.armies.get(c.get("army"))
        if a is None or a["faction"] != f:
            return "不是你的军队"
        for s in c.get("steps", ()):
            for key in ("node", "from", "to"):
                if key in s and s[key] not in state.nodes:
                    return "未知地点 " + str(s[key])
            if s.get("type") == "ambush":
                ri = int(s.get("route", -1))
                if ri < 0 or ri >= len(state.routes):
                    return "设伏道路无效"
                route = state.routes[ri]
                if s.get("node", "") not in (route["a"], route["b"]) or s.get("months", 0) <= 0:
                    return "设伏须选择道路端点和持续月份"
            if a["is_convoy"] and s.get("type") in ("siege", "burn", "ambush"):
                return "运输队不能执行攻击步骤"
        return ""

    if t == "recruit":
        return _v_recruit(state, c)

    if t == "load":
        a = state.armies.get(c.get("army"))
        if a is None or a["faction"] != f:
            return "不是你的军队"
        if "node" not in a["loc"]:
            return "军队在路上"
        n = state.nodes[a["loc"]["node"]]
        if not state.is_supply_node(n, f):
            return "此处不是己方补给点"
        return ""

    if t == "convoy":
        n = state.nodes.get(c.get("from"))
        if n is None or c.get("to") not in state.nodes:
            return "地点无效"
        if c["from"] == c["to"]:
            return "起点与目的地不能相同"
        if c["grain"] < 0:
            return "装粮不能为负数"
        if not state.is_supply_node(n, f):
            return "起点不是己方补给点"
        if c["laborers"] <= 0:
            return "需要民夫"
        avail = int(n["pop"] * state.bal["han"]["laborer_levy_ratio"]) - n["levied_out"]
        if f != "han":
            return "仅汉可组织民夫运输"
        if c["laborers"] > avail and n["type"] != "source":
            return "民夫不足（可征 %d）" % avail
        return ""

    if t == "split":
        a = state.armies.get(c.get("army"))
        if a is None or a["faction"] != f or "node" not in a["loc"]:
            return "无法拆分"
        for ut, cnt in c.get("units", {}).items():
            if cnt < 0:
                return "拆分兵力不能为负数"
            if a["units"].get(ut, 0) < cnt:
                return "兵力不足"
        return ""

    if t == "merge":
        if c.get("army") == c.get("into"):
            return "不能合并军队自身"
        a = state.armies.get(c.get("army"))
        b = state.armies.get(c.get("into"))
        if a is None or b is None or a["faction"] != f or b["faction"] != f:
            return "无法合并"
        if not ("node" in a["loc"] and "node" in b["loc"] and a["loc"]["node"] == b["loc"]["node"]):
            return "须在同一节点"
        return ""

    if t == "disband":
        a = state.armies.get(c.get("army"))
        return "" if (a is not None and a["faction"] == f) else "不是你的军队"

    if t == "expand_farm":
        n = state.nodes.get(c.get("node"))
        if f != "han" or n is None or n["faction"] != "han":
            return "仅限汉直辖节点"
        if n["farm_cap"] <= 0:
            return "无农田"
        if buffs.has(state, "farm_expanding", n["id"]):
            return "正在扩田"
        if n["farm_cap"] >= n["farm_cap_base"] * state.bal["farm"]["potential_mult"]:
            return "已达上限"
        if state.factions[f]["money"] < state.bal["farm"]["expand_cost_money"]:
            return "钱不足"
        return ""

    if t == "found_colony":
        n = state.nodes.get(c.get("node"))
        a = state.armies.get(c.get("army"))
        if f != "han" or n is None or a is None:
            return "无效"
        if a["faction"] != f or not a["is_convoy"] or state.army_size(a) > 0:
            return "须使用己方无战斗部队的运输队"
        if state.controller(n) != "han":
            return "须在汉直辖或汉属国"
        if not ("node" in a["loc"] and a["loc"]["node"] == n["id"]) or a["laborers"] <= 0:
            return "运输队须在场且有民夫"
        return ""

    if t == "gift":
        if f != "han" or c.get("state") not in state.relations:
            return "无效"
        if c.get("units", 0) <= 0:
            return "赏赐份数须大于零"
        if state.factions["han"]["money"] < c["units"] * state.bal["diplomacy"]["gift_unit_money"]:
            return "钱不足"
        return ""

    if t == "enfeoff":
        return economy.can_enfeoff(state, c.get("state", "")) if f == "han" else "仅汉"

    if t == "make_vassal":
        return economy.can_vassal(state, c.get("state", "")) if f == "han" else "仅汉"

    if t == "demand_vassal":
        return economy.can_demand(state, c.get("state", "")) if f == "xiongnu" else "仅匈奴"

    if t == "set_tax":
        rel = state.relations.get(c.get("state"))
        if f != "xiongnu" or rel is None or rel["overlord"] != "xiongnu":
            return "仅限匈奴属国"
        return ""

    if t == "buy_grain":
        n = state.nodes.get(c.get("node"))
        if f != "han" or n is None or n["faction"] not in state.relations:
            return "无效"
        if c.get("amount", 0) <= 0:
            return "购粮数量须大于零"
        rel = state.relations[n["faction"]]
        if rel["overlord"] != "han" and rel["han_status"] != "enfeoffed":
            return "需册封或属国"
        if n["grain"] < c["amount"]:
            return "城邦存粮不足"
        if state.factions["han"]["money"] < c["amount"] / 100.0 * economy.buy_grain_price(state, n["faction"]):
            return "钱不足"
        return ""

    return "未知命令"


def _v_recruit(state, c):
    f = c["faction"]
    n = state.nodes.get(c.get("node"))
    if n is None:
        return "地点无效"
    tot = 0
    units = c.get("units", {})
    for t, cnt in units.items():
        if t not in state.units or cnt < 0:
            return "兵种或征召数量无效"
        tot += int(cnt)
    if tot <= 0:
        return "数量为 0"
    h = state.bal["han"]
    src = c.get("source", "")
    if src == "central":
        if f != "han" or n["faction"] != "han":
            return "中央军只能在汉直辖城征召"
        for t, cnt in units.items():
            if state.central.get(t, 0) < cnt:
                return "中央军池不足（%s）" % state.units[t]["name"]
        cost = sum(cnt / 1000.0 * state.units[t]["cost_money_per_1000"] for t, cnt in units.items())
        if state.factions[f]["money"] < cost:
            return "钱不足（需 %d）" % int(cost)
    elif src == "tuntian":
        if f != "han" or n["faction"] != "han" or n["farm_cap"] <= 0:
            return "屯田兵须在汉屯田城"
        cap = int(n["pop"] * h["tuntian_levy_ratio"]) - n["recruited"].get("tuntian", 0)
        if tot > cap or list(units.keys()) != ["infantry"]:
            return "屯田兵仅步兵，上限 %d" % cap
    elif src == "hu":
        if f != "han" or state.controller(n) != "han" or n["faction"] == "han":
            return "胡骑须在汉属国征召"
        cap2 = int(n["pop"] * h["hu_cavalry_levy_ratio"]) - n["recruited"].get("hu", 0)
        if tot > cap2 or list(units.keys()) != ["cavalry"]:
            return "胡骑仅骑兵，上限 %d" % cap2
        if n["horses"] < tot:
            return "当地马匹不足"
        if state.factions[f]["money"] < tot / 1000.0 * h["hu_cavalry_cost_per_1000"]:
            return "钱不足"
    elif src == "nomad":
        if f != "xiongnu" or n["faction"] != "xiongnu":
            return "须在匈奴直辖地征召"
        cap3 = int(n["pop"] * state.bal["xiongnu"]["levy_ratio"]) - n["recruited"].get("nomad", 0)
        if tot > cap3 or list(units.keys()) != ["horse_archer"]:
            return "牧民征召仅弓骑，上限 %d" % cap3
        if n["horses"] < tot * 2:
            return "马匹不足（每骑 2 匹）"
    elif src == "vassal":
        if f != "xiongnu" or state.controller(n) != "xiongnu" or n["faction"] == "xiongnu":
            return "须在匈奴属国征召"
        cap4 = int(n["pop"] * state.bal["xiongnu"]["vassal_infantry_levy_ratio"]) - n["recruited"].get("vassal", 0)
        if tot > cap4 or list(units.keys()) != ["infantry"]:
            return "属国征召仅步兵，上限 %d" % cap4
    else:
        return "未知兵源"
    return ""


def apply(state, c):
    for rule in getattr(state, "rules", ()):
        if rule.apply_command(state, c):
            return
    t = c["type"]
    if t in CUSTOM_COMMANDS:
        CUSTOM_COMMANDS[t]["apply"](state, c)
        return

    f = c["faction"]
    if t == "set_plan":
        a = state.armies[c["army"]]
        a["plan"]["steps"] = [copy.deepcopy(s) for s in c["steps"]]
        a["plan"]["step_ticks"] = 0
        if "preset" in c:
            state.apply_preset(a, c["preset"])
        if "engage" in c:
            a["plan"]["engage"] = list(c["engage"])
        if "triggers" in c:
            a["plan"]["triggers"] = copy.deepcopy(c["triggers"])
        a["plan"]["reacted"] = False
        a["init_size"] = state.army_size(a)
        a["path"] = []
        if "role" in c:
            a["ai_role"] = c["role"]
        a["origin"] = a["loc"]["node"] if "node" in a["loc"] else a["loc"]["from"]
        a["garrison"] = (c["preset"] == "garrison") if "preset" in c else a["garrison"]

    elif t == "recruit":
        _a_recruit(state, c)

    elif t == "load":
        a = state.armies[c["army"]]
        n = state.nodes[a["loc"]["node"]]
        room = supply.carry_cap(state, a) - a["grain"]
        lab = int(c.get("laborers", 0))
        if lab > 0 and f == "han":
            avail = int(n["pop"] * state.bal["han"]["laborer_levy_ratio"]) - n["levied_out"]
            lab = min(lab, max(0, avail))
            a["laborers"] += lab
            n["levied_out"] += lab
            a["convoy_home"] = n["id"]
            room = supply.carry_cap(state, a) - a["grain"]
        g = max(0.0, min(float(c.get("grain", 0)), room))
        if n["type"] != "source":
            if f == "xiongnu" and n["faction"] != f:
                g = min(g, float(n["grain"]))
                n["grain"] -= g
                relation = state.relations[n["faction"]]
                if g > 0:
                    relation["xn_resentment"] = min(100.0, relation["xn_resentment"] + state.bal["diplomacy"]["levy_grain_resentment"])
            else:
                g = min(g, state.stock(n, f))
                state.set_stock(n, f, state.stock(n, f) - g)
        a["grain"] += g

    elif t == "convoy":
        n = state.nodes[c["from"]]
        a = state.new_army(f, c["from"], {}, 0, 0, int(c["laborers"]))
        a["is_convoy"] = True
        a["name"] = "运输队" + a["id"].split("_")[-1]
        a["init_size"] = 0
        a["convoy_home"] = n["id"]
        a["ai_role"] = c.get("role", "")
        a["origin"] = n["id"]
        n["levied_out"] += int(c["laborers"])
        g = min(float(c["grain"]), supply.carry_cap(state, a))
        if n["type"] != "source":
            g = min(g, state.stock(n, f))
            state.set_stock(n, f, state.stock(n, f) - g)
        a["grain"] = g
        state.apply_preset(a, "cautious")
        a["plan"]["triggers"] = []
        a["plan"]["engage"] = ["never", 0.0]
        if c.get("loop", False):
            a["plan"]["steps"] = [{"type": "loop_convoy", "from": c["from"], "to": c["to"], "grain_per_trip": c["grain"], "phase": "go"}]
        elif c.get("stay", False):
            a["plan"]["steps"] = [{"type": "deliver", "node": c["to"]}, {"type": "hold", "node": c["to"], "until": "end"}]
        else:
            a["plan"]["steps"] = [{"type": "deliver", "node": c["to"]}, {"type": "return_to", "node": c["from"]}]

    elif t == "split":
        a = state.armies[c["army"]]
        b = state.new_army(f, a["loc"]["node"], dict(c["units"]))
        mounts_all = sum(int(a["units"][ut]) * int(state.units[ut]["horses"]) for ut in a["units"])
        mounts_out = sum(int(c["units"][ut]) * int(state.units[ut]["horses"]) for ut in c["units"])
        hh = min(mounts_out, int(max(0, a["horses"]) * float(mounts_out) / max(1, mounts_all)))
        a["horses"] -= hh
        b["horses"] += hh
        for ut in c["units"]:
            a["units"][ut] -= c["units"][ut]
        g = min(float(c.get("grain", 0)), a["grain"])
        a["grain"] -= g
        b["grain"] = g
        lab = min(int(c.get("laborers", 0)), a["laborers"])
        a["laborers"] -= lab
        b["laborers"] = lab
        b["plan"]["engage"] = list(a["plan"]["engage"])
        b["ai_role"] = c.get("role", "")
        b["init_size"] = state.army_size(b)

    elif t == "merge":
        a = state.armies[c["army"]]
        b = state.armies[c["into"]]
        for ut, cnt in a["units"].items():
            b["units"][ut] = b["units"].get(ut, 0) + cnt
        b["horses"] += a["horses"]
        b["grain"] += a["grain"]
        b["laborers"] += a["laborers"]
        b["init_size"] = state.army_size(b)
        state.remove_army(a["id"])

    elif t == "disband":
        a = state.armies[c["army"]]
        if "node" in a["loc"]:
            n = state.nodes[a["loc"]["node"]]
            if f == "han" and state.controller(n) == "han":
                for ut, cnt in a["units"].items():
                    if ut in state.bal["han"]["central_cap"]:
                        state.central[ut] = min(int(state.bal["han"]["central_cap"][ut]), state.central.get(ut, 0) + cnt)
            state.set_stock(n, f, state.stock(n, f) + a["grain"])
        state.remove_army(a["id"])

    elif t == "expand_farm":
        n = state.nodes[c["node"]]
        state.factions[f]["money"] -= state.bal["farm"]["expand_cost_money"]
        b = buffs.apply(state, "farm_expanding", n["id"], {"amount": state.bal["farm"]["expand_amount"]})
        b["turns_left"] = state.bal["farm"]["expand_turns"]
        state.log_event("economy", "开始扩大屯田：" + n["name"], {"node": n["id"]})

    elif t == "found_colony":
        n = state.nodes[c["node"]]
        a = state.armies[c["army"]]
        n["colonies"] += a["laborers"]
        if a["grain"] > 0:
            state.set_stock(n, f, state.stock(n, f) + a["grain"])
        state.remove_army(a["id"])
        state.log_event("economy", "在%s设立屯田区" % n["name"], {"node": n["id"]})

    elif t == "gift":
        economy.gift(state, c["state"], int(c["units"]))

    elif t == "enfeoff":
        economy.enfeoff(state, c["state"])

    elif t == "make_vassal":
        economy.make_vassal(state, c["state"])

    elif t == "demand_vassal":
        economy.demand_vassal(state, c["state"])

    elif t == "set_tax":
        state.relations[c["state"]]["tax_level"] = max(0, min(3, int(c["level"])))

    elif t == "buy_grain":
        n = state.nodes[c["node"]]
        price = economy.buy_grain_price(state, n["faction"])
        state.factions["han"]["money"] -= int(c["amount"] / 100.0 * price)
        n["grain"] -= c["amount"]
        n["depot"]["han"] = n["depot"].get("han", 0.0) + c["amount"]


def _a_recruit(state, c):
    f = c["faction"]
    n = state.nodes[c["node"]]
    tot = sum(int(v) for v in c["units"].values())
    horses = 0
    src = c["source"]
    if src == "central":
        for ut, cnt in c["units"].items():
            state.central[ut] -= cnt
            state.factions[f]["money"] -= int(cnt / 1000.0 * state.units[ut]["cost_money_per_1000"])
            horses += int(state.units[ut]["horses"]) * int(cnt)
    elif src == "tuntian":
        n["recruited"]["tuntian"] = n["recruited"].get("tuntian", 0) + tot
        n["levied_out"] += tot
    elif src == "hu":
        n["recruited"]["hu"] = n["recruited"].get("hu", 0) + tot
        n["horses"] -= tot
        horses = tot
        state.factions[f]["money"] -= int(tot / 1000.0 * state.bal["han"]["hu_cavalry_cost_per_1000"])
    elif src == "nomad":
        n["recruited"]["nomad"] = n["recruited"].get("nomad", 0) + tot
        n["horses"] -= tot * 2
        horses = tot * 2
    elif src == "vassal":
        n["recruited"]["vassal"] = n["recruited"].get("vassal", 0) + tot
        rel = state.relations.get(n["faction"])
        if rel is not None:
            rel["xn_resentment"] = min(100.0, rel["xn_resentment"] + state.bal["xiongnu"]["vassal_levy_resentment"])
    a = state.new_army(f, n["id"], dict(c["units"]), horses)
    state.apply_preset(a, c.get("preset", "balanced"))
    a["ai_role"] = c.get("role", "")
    a["origin"] = n["id"]
    a["name"] = "%s军%s" % (state.factions[f]["name"], a["id"].split("_")[-1])
    state.log_event("recruit", "%s 在%s召集 %d 人" % (state.factions[f]["name"], n["name"], tot), {"army": a["id"]})


def describe(state, c):
    """将命令字典格式化为可读的中文单行说明（用于 CLI 试玩与日志）。"""
    t = c.get("type", "")
    if t in CUSTOM_COMMANDS and CUSTOM_COMMANDS[t].get("describe"):
        return CUSTOM_COMMANDS[t]["describe"](state, c)
    if t == "gift":
        sid = c["state"]
        nm = state.factions.get(sid, {}).get("name", sid)
        cost = int(c["units"] * state.bal["diplomacy"]["gift_unit_money"])
        return "【外交·赏赐】向 %s(%s) 赐金 %d 份（耗 %d 钱）" % (nm, sid, c["units"], cost)
    if t == "enfeoff":
        sid = c["state"]
        nm = state.factions.get(sid, {}).get("name", sid)
        return "【外交·册封】赐印绶册封 %s(%s)（耗 200 钱）" % (nm, sid)
    if t == "make_vassal":
        sid = c["state"]
        nm = state.factions.get(sid, {}).get("name", sid)
        return "【外交·内附】纳 %s(%s) 为汉属国" % (nm, sid)
    if t == "demand_vassal":
        sid = c["state"]
        nm = state.factions.get(sid, {}).get("name", sid)
        return "【外交·索服】迫使 %s(%s) 臣服匈奴" % (nm, sid)
    if t == "set_tax":
        sid = c["state"]
        nm = state.factions.get(sid, {}).get("name", sid)
        return "【属国·征税】调整 %s(%s) 税率档位为 %d" % (nm, sid, c["level"])
    if t == "expand_farm":
        nid = c["node"]
        nm = state.nodes.get(nid, {}).get("name", nid)
        return "【内政·扩田】在 %s(%s) 扩建屯田（耗 %d 钱）" % (nm, nid, state.bal["farm"]["expand_cost_money"])
    if t == "convoy":
        fn = state.nodes.get(c["from"], {}).get("name", c["from"])
        tn = state.nodes.get(c["to"], {}).get("name", c["to"])
        return "【后勤·运粮】%s → %s（民夫 %d，运粮 %d 斛）" % (fn, tn, c["laborers"], int(c["grain"]))
    if t == "recruit":
        nm = state.nodes.get(c["node"], {}).get("name", c["node"])
        u_str = ", ".join("%s:%d" % (k, v) for k, v in c["units"].items())
        return "【军事·征召】在 %s(%s) 征召 [%s] (%s)" % (nm, c["node"], c["source"], u_str)
    if t == "load":
        return "【后勤·装粮】军队 %s 装载粮草 %d 斛、民夫 %d 人" % (c["army"], int(c.get("grain", 0)), int(c.get("laborers", 0)))
    if t == "merge":
        return "【军事·合并】将 %s 并入 %s" % (c["army"], c["into"])
    if t == "split":
        u_str = ", ".join("%s:%d" % (k, v) for k, v in c["units"].items())
        return "【军事·分兵】从 %s 拆分 (%s)" % (c["army"], u_str)
    if t == "set_plan":
        st_str = " → ".join("%s(%s)" % (s["type"], s.get("node", s.get("to", ""))) for s in c["steps"])
        return "【军令·计划】%s 执行：%s [%s]" % (c["army"], st_str, c.get("preset", "balanced"))
    if t == "buy_grain":
        nm = state.nodes.get(c["node"], {}).get("name", c["node"])
        return "【后勤·籴粮】在 %s 购粮 %d 斛" % (nm, int(c["amount"]))
    return "【命令】%s %s" % (t, str(c))


def enumerate_legal_commands(state, faction):
    """枚举当前状态下某阵营有意义的合法候选命令列表（供 CLI 试玩、随机/贪心 Bot 及 L12 决策密度统计使用）。"""
    out = []
    dt_scale = max(1, int(state.decision_ticks // 3))

    if faction == "han":
        # 1) 外交：make_vassal / enfeoff / gift
        gift_batch = int(state.ai_profiles["han_default"]["gift_batch"]) * dt_scale
        for sid, rel in state.relations.items():
            if not state.factions[sid].get("counts_for_victory", False):
                continue
            c_vas = make("make_vassal", "han", {"state": sid})
            if validate(state, c_vas) == "":
                out.append(c_vas)
            c_enf = make("enfeoff", "han", {"state": sid})
            if validate(state, c_enf) == "":
                out.append(c_enf)
            if rel["overlord"] != "han" and rel["han_influence"] < 98.0:
                c_gift = make("gift", "han", {"state": sid, "units": gift_batch})
                if validate(state, c_gift) == "":
                    out.append(c_gift)

        # 2) 内政：扩田
        for nid in ("dun_huang", "jiu_quan", "wu_wei", "zhang_ye", "long_xi"):
            c_farm = make("expand_farm", "han", {"node": nid})
            if validate(state, c_farm) == "":
                out.append(c_farm)

        # 3) 后勤：河西干线运粮
        legs = [("chang_an", "long_xi"), ("long_xi", "wu_wei"), ("wu_wei", "zhang_ye"),
                ("zhang_ye", "jiu_quan"), ("jiu_quan", "dun_huang"), ("zhang_ye", "ju_yan")]
        for src_id, dst_id in legs:
            src = state.nodes[src_id]
            dst = state.nodes[dst_id]
            if src["faction"] != "han" or dst["faction"] != "han":
                continue
            workers = 8000 if src["type"] == "source" else min(3000, int(src["pop"] * state.bal["han"]["laborer_levy_ratio"]) - src["levied_out"])
            if src["type"] != "source":
                spare = max(0.0, src["grain"] - src["pop"] * 12.0)
                workers = min(workers, int(spare / 15.0))
            if workers >= 1000:
                c_cv = make("convoy", "han", {"from": src_id, "to": dst_id, "grain": workers * 15.0, "laborers": workers})
                if validate(state, c_cv) == "":
                    out.append(c_cv)

        # 4) 征召：敦煌/酒泉/武威/张掖征召中央军
        for nid in ("dun_huang", "jiu_quan", "zhang_ye", "wu_wei"):
            if state.nodes[nid]["faction"] == "han" and state.nodes[nid]["grain"] > 90000:
                c_rec = make("recruit", "han", {
                    "node": nid, "source": "central",
                    "units": {"infantry": 2000, "crossbow": 1500}, "preset": "garrison"
                })
                if validate(state, c_rec) == "":
                    out.append(c_rec)
        if state.nodes["dun_huang"]["faction"] == "han" and state.nodes["dun_huang"]["grain"] > 150000:
            c_exp = make("recruit", "han", {
                "node": "dun_huang", "source": "central",
                "units": {"infantry": 4000, "crossbow": 3000, "cavalry": 1500}, "preset": "balanced"
            })
            if validate(state, c_exp) == "":
                out.append(c_exp)

        # 5) 野战军计划（驻防/出征）
        for a in state.armies.values():
            if a["faction"] != "han" or a["is_convoy"] or state.army_size(a) < 3000:
                continue
            here = a["loc"].get("node", "")
            if not here:
                continue
            if a["grain"] < supply.carry_cap(state, a) * 0.5:
                c_ld = make("load", "han", {"army": a["id"], "grain": supply.carry_cap(state, a) - a["grain"], "laborers": 2000})
                if validate(state, c_ld) == "":
                    out.append(c_ld)
            for tgt in ("lou_lan", "cheshi_qian", "yan_qi", "wu_lei"):
                if tgt in state.nodes and state.controller(state.nodes[tgt]) != "han":
                    c_pl = make("set_plan", "han", {
                        "army": a["id"],
                        "steps": [{"type": "siege", "node": tgt, "max_months": 3, "assault_when": 0.5},
                                  {"type": "return_to", "node": "dun_huang"}],
                        "preset": "balanced"
                    })
                    if validate(state, c_pl) == "":
                        out.append(c_pl)

    elif faction == "xiongnu":
        # 1) 外交：demand_vassal & 税率
        for sid, rel in state.relations.items():
            c_dem = make("demand_vassal", "xiongnu", {"state": sid})
            if validate(state, c_dem) == "":
                out.append(c_dem)
            if rel["overlord"] == "xiongnu":
                for lv in (0, 1, 2):
                    if int(rel["tax_level"]) != lv:
                        c_tx = make("set_tax", "xiongnu", {"state": sid, "level": lv})
                        if validate(state, c_tx) == "":
                            out.append(c_tx)
        # 2) 征召：本部弓骑与属国步兵
        for nid in ("youxian_wang", "chanyu_ting", "long_cheng"):
            c_nom = make("recruit", "xiongnu", {"node": nid, "source": "nomad", "units": {"horse_archer": 3000}, "preset": "balanced"})
            if validate(state, c_nom) == "":
                out.append(c_nom)
        for sid, rel in state.relations.items():
            if rel["overlord"] == "xiongnu" and rel["xn_resentment"] < 55:
                for n in state.nodes_of_state(sid):
                    c_vas = make("recruit", "xiongnu", {"node": n["id"], "source": "vassal", "units": {"infantry": 1000}, "preset": "balanced", "role": "siege"})
                    if validate(state, c_vas) == "":
                        out.append(c_vas)
        # 3) 军事行动：集结伊吾、南下攻河西、游骑设伏
        for a in state.armies.values():
            if a["faction"] != "xiongnu" or a["is_convoy"] or state.army_size(a) < 1500:
                continue
            here = a["loc"].get("node", "")
            if not here:
                continue
            if here != "yi_wu":
                c_mv = make("set_plan", "xiongnu", {
                    "army": a["id"],
                    "steps": [{"type": "move_to", "node": "yi_wu"}, {"type": "hold", "node": "yi_wu", "until": "end"}],
                    "preset": "assault"
                })
                if validate(state, c_mv) == "":
                    out.append(c_mv)
            for tgt in state.bal["victory"]["xn_targets"]:
                if state.nodes[tgt]["faction"] == "han" and state.army_size(a) >= 5000:
                    c_atk = make("set_plan", "xiongnu", {
                        "army": a["id"],
                        "steps": [{"type": "burn", "node": tgt},
                                  {"type": "siege", "node": tgt, "max_months": 3, "assault_when": 0.65},
                                  {"type": "return_to", "node": "yi_wu"}],
                        "preset": "assault"
                    })
                    if validate(state, c_atk) == "":
                        out.append(c_atk)

    for rule in getattr(state, "rules", ()):
        extra = rule.legal_commands(state, faction)
        if extra:
            out.extend(extra)

    return out
