"""W2 新规则集（`v1`）专属 AI 策略集合（S08 三阶段功业 AI、防嫉妒分赏 AI 与 5×5 非传递克制变体）。

当 `state.ext` 中挂载了 `"v1"` 规则集时，`baseline` / `aggressive` / `conservative` / `greedy` / `random_legal`
自动路由至本模块对应的 S08 新规则 AI 实现；在 `baseline` 规则集下则 100% 保持 W1 原版行为不变。
"""
import math

from ..engine import combat, commands, economy, supply, victory
from . import utils as U

HEXI = ["wu_wei", "zhang_ye", "jiu_quan", "dun_huang", "ju_yan"]
PRIORITY = {"wu_lei": 3.5, "cheshi_qian": 3.5, "lou_lan": 3.0, "yan_qi": 2.2, "qiu_ci": 2.0, "wei_li": 2.0}


def perceived_threat_at(state, node_id, enemy_faction, horizon_days):
    """S05/S08 五级迷雾感知威胁：根据烽燧与属国视野叠加感知噪声，严禁直读全知精确值。"""
    v1 = state.ext.get("v1")
    raw = U.enemy_threat_at(state, node_id, enemy_faction, horizon_days)
    if not v1 or raw <= 0:
        return raw
    beacons = v1["logistics"]["beacons"]
    if node_id in beacons or any(nb in beacons for nb in state.near_neighbors(node_id)):
        err = 0.06  # L1 烽燧覆盖
    elif state.controller(state.nodes[node_id]) != enemy_faction:
        err = 0.16  # L2 属国耳目
    else:
        err = 0.28  # L3 塞外盲区
    # 基于回合与节点哈希的确定性感知偏差（保证存档读档 100% 一致）
    h = ((state.seed * 31 + state.turn * 17 + sum(ord(c) for c in node_id)) % 200 - 100) / 100.0
    return max(0.0, raw * (1.0 + h * err))


class V1HanAI:
    """S08 汉方三阶段功业效用 AI（支持 5 种策略性格参数化）。"""
    faction = "han"

    def __init__(self, style="baseline"):
        self.style = style

    def think(self, state):
        v1 = state.ext["v1"]
        vic = v1["victory"]
        court = v1["court"]
        tribes = v1["tribes"]
        logi = v1["logistics"]
        cmds = []

        G = vic["han_merit"]
        turn = state.turn
        horizon = state.decision_ticks * 10.0

        # 性格参数配置（S08 非传递克制环：拓边锐进 aggressive 克 贪利匈奴、持重营田 conservative 克 猛攻匈奴、重商外交 greedy 克 守成匈奴）
        if self.style == "aggressive":
            reserve = 160.0
            win_prob_req = 0.49
            def_ratio = 0.56
            use_forge = (turn >= 5 and court["trust"] >= 54.0)
            use_convict = (turn >= 2)
            max_envoys = 3
            tuntian_Focus = 2
        elif self.style == "conservative":
            reserve = 200.0
            win_prob_req = 0.56
            def_ratio = 0.44
            use_forge = False
            use_convict = (turn >= 5)
            max_envoys = 3
            tuntian_Focus = 2
        elif self.style == "greedy":
            reserve = 90.0
            win_prob_req = 0.58
            def_ratio = 1.25  # 轻视河西城防（被激进匈奴克制），全力经略西域外交与屯田
            use_forge = False
            use_convict = (turn >= 4)
            max_envoys = 4
            tuntian_Focus = 2
        elif self.style == "random_legal":
            return self._think_random_legal(state)
        else:  # baseline (S08 三阶段均衡都护 AI)
            reserve = 260.0
            win_prob_req = 0.56
            def_ratio = 0.60
            use_forge = (turn >= 8 and court["trust"] >= 54.0)
            use_convict = (turn >= 4)
            max_envoys = 3
            tuntian_Focus = 2

        budget = float(state.factions["han"]["money"]) - reserve

        # --- 0) 历史大窗口最优先：迎降日逐王 (S08-T08) ---
        c_rz = commands.make("welcome_rizhu", "han")
        if commands.validate(state, c_rz) == "":
            cmds.append(c_rz)

        # --- 1) S02 朝堂诏令响应与请款/请立都护 ---
        ed = court.get("active_edict")
        if ed and not ed.get("complied"):
            if self.style in ("conservative", "baseline") and not ed.get("bargained") and turn <= 4:
                c_bg = commands.make("bargain_edict", "han")
                if commands.validate(state, c_bg) == "":
                    cmds.append(c_bg)
            c_cp = commands.make("comply_edict", "han")
            if commands.validate(state, c_cp) == "":
                cmds.append(c_cp)

        if (state.factions["han"]["money"] < 550 or getattr(state, "han_horse_pool", 0) < 2200) and court["trust"] >= 54.0 and self.style != "conservative":
            c_ap = commands.make("request_appropriation", "han")
            if commands.validate(state, c_ap) == "":
                cmds.append(c_ap)

        if G >= 86.0 and budget >= 400 and court["trust"] >= 38.0:
            c_pet = commands.make("petition_protectorate", "han")
            if commands.validate(state, c_pet) == "":
                cmds.append(c_pet)
                budget -= 400

        # --- 2) S05 烽燧修筑与河西本土防卫 ---
        if self.style in ("conservative", "baseline", "aggressive") and budget >= 180:
            for bn in ("ju_yan", "lou_lan", "wu_lei", "cheshi_qian"):
                if bn not in logi["beacons"]:
                    c_bc = commands.make("build_beacon", "han", {"node": bn})
                    if commands.validate(state, c_bc) == "":
                        cmds.append(c_bc)
                        budget -= 160
                        break

        budget = self._defense(state, cmds, horizon, budget, def_ratio)

        # --- 3) S04 外交博弈：内附 / 册封 / 纳两属 / 斩王立新 / 精使与募使 ---
        budget = self._diplomacy_v1(state, cmds, budget, max_envoys, use_forge)

        # --- 4) S05 西域军屯、驿道粮线与河西农田扩建 ---
        if budget >= 240 and getattr(state, "han_horse_pool", 0) >= 600:
            for hub in ("lou_lan", "wu_lei", "wei_li", "cheshi_qian"):
                if hub not in logi.get("supply_lines", ["dun_huang"]):
                    c_sl = commands.make("setup_supply_line", "han", {"forward_hub": hub, "priority": 2})
                    if commands.validate(state, c_sl) == "":
                        cmds.append(c_sl)
                        budget -= 220
                        break

        tt_done = 0
        for nid in ("lou_lan", "wu_lei", "wei_li", "cheshi_qian", "dun_huang"):
            if tt_done >= tuntian_Focus or budget < 260:
                break
            c_tt = commands.make("build_tuntian", "han", {"node": nid})
            if commands.validate(state, c_tt) == "":
                cmds.append(c_tt)
                budget -= 260
                tt_done += 1

        if budget >= state.bal["farm"]["expand_cost_money"] and turn < 20:
            for nid in ("dun_huang", "jiu_quan", "wu_wei", "zhang_ye"):
                c_fm = commands.make("expand_farm", "han", {"node": nid})
                if commands.validate(state, c_fm) == "":
                    cmds.append(c_fm)
                    budget -= state.bal["farm"]["expand_cost_money"]
                    break

        # --- 5) S03/S05 北道破袭僮仆都尉税队 & 持节发诸国兵 ---
        if (self.style in ("baseline", "aggressive") and tribes["tongpu_active"] and turn % 2 == 1) or (
            self.style in ("conservative", "greedy") and tribes["tongpu_active"] and turn % 3 == 1
        ):
            c_it = commands.make("intercept_tongpu", "han")
            if commands.validate(state, c_it) == "":
                cmds.append(c_it)

        if self.style in ("baseline", "aggressive", "greedy") and budget >= 280 and turn >= 5:
            c_lv = commands.make("levy_vassal_troops", "han")
            if commands.validate(state, c_lv) == "":
                cmds.append(c_lv)
                budget -= 260

        # --- 6) S05 粮道转输与西域远征（含断粮红灯硬拦截 S08-T04） ---
        self._logistics_v1(state, cmds)
        self._expedition_v1(state, cmds, budget, win_prob_req, use_forge, use_convict)

        return cmds

    def _defense(self, state, cmds, horizon, budget, def_ratio):
        pool = dict(state.central)
        threats = {}
        cities = list(HEXI)
        for nid in cities:
            threats[nid] = perceived_threat_at(state, nid, "xiongnu", horizon + 35.0)
        cities.sort(
            key=lambda nid: threats[nid] / max(U.garrison_strength(state, nid, "han"), 1.0),
            reverse=True,
        )
        def_recruited = 0
        max_def_rec = 2 if self.style == "conservative" else 1
        for nid in cities:
            if def_recruited >= max_def_rec or budget < 520:
                break
            node = state.nodes[nid]
            if node["faction"] != "han":
                continue
            mine = U.garrison_strength(state, nid, "han") * combat.wall_mult(state, node)
            if threats[nid] < mine * def_ratio:
                continue
            current = sum(state.army_size(a) for a in state.armies_at(nid) if a["faction"] == "han")
            food_room = max(0, int((node["grain"] / 9.0 - node["pop"] * 2.0) / 3.0) - current)
            want = {}
            for ut in ("crossbow", "infantry"):
                amount = min(int(pool.get(ut, 0)), 2500, food_room)
                if amount >= 500:
                    want[ut] = amount
                    food_room -= amount
            if not want:
                continue
            cost = sum(want[ut] / 1000.0 * state.units[ut]["cost_money_per_1000"] for ut in want)
            if cost <= budget - 320:
                cmds.append(commands.make("recruit", "han", {
                    "node": nid, "source": "central", "units": want, "preset": "garrison"
                }))
                for ut in want:
                    pool[ut] -= want[ut]
                budget -= cost
                def_recruited += 1
        return budget

    def _diplomacy_v1(self, state, cmds, budget, max_envoys, use_forge):
        v1 = state.ext["v1"]
        court = v1["court"]

        # 1) 优先完成已达标的 make_vassal / enfeoff / accept_dual_allegiance / assassinate_king
        cands = [
            sid for sid in state.relations
            if state.factions[sid].get("counts_for_victory", False) and state.relations[sid]["overlord"] != "han"
        ]
        cands.sort(
            key=lambda sid: (
                PRIORITY.get(sid, 1.0) * 12.0
                + state.relations[sid]["han_influence"]
                - state.relations[sid]["xn_intimidation"] * 0.45
            ),
            reverse=True,
        )

        for sid in cands:
            if economy.can_vassal(state, sid) == "":
                cmds.append(commands.make("make_vassal", "han", {"state": sid}))
                continue
            if economy.can_enfeoff(state, sid) == "" and budget >= 200:
                cmds.append(commands.make("enfeoff", "han", {"state": sid}))
                budget -= 200
                continue
            c_dual = commands.make("accept_dual_allegiance", "han", {"state": sid})
            if commands.validate(state, c_dual) == "" and budget >= 160 and self.style in ("baseline", "greedy", "conservative"):
                cmds.append(c_dual)
                budget -= 160
                continue

        # 奇袭刺王（楼兰/车师/焉耆等有罪之国）
        if self.style in ("baseline", "aggressive", "greedy") and budget >= 320:
            for sid in ("lou_lan", "cheshi_qian", "wu_lei", "yan_qi"):
                rel = state.relations.get(sid)
                if rel and rel["overlord"] != "han" and rel.get("crimes_against_han", 0) > 0 and rel["han_influence"] >= 34.0:
                    c_ak = commands.make("assassinate_king", "han", {"state": sid})
                    if commands.validate(state, c_ak) == "":
                        cmds.append(c_ak)
                        budget -= 320
                        break

        # 2) 派遣精使团与募使团（兼顾乌孙/大宛大国盟好）
        envoys_sent = 0
        envoy_targets = list(cands)
        for gp in ("wu_sun", "da_wan"):
            if gp in state.relations and state.relations[gp]["han_influence"] < 60.0:
                envoy_targets.insert(0, gp)

        for sid in envoy_targets:
            if envoys_sent >= max_envoys or budget < 150:
                break
            rel = state.relations[sid]
            if int(rel.get("satiation", 0)) >= 2:
                continue
            if budget >= 320 and v1["diplomacy"]["elite_missions_this_quarter"] + envoys_sent < 2:
                c_el = commands.make("dispatch_elite_envoy", "han", {"state": sid, "budget": 320})
                if commands.validate(state, c_el) == "":
                    cmds.append(c_el)
                    budget -= 320
                    envoys_sent += 1
                    continue
            if budget >= 150:
                c_hm = commands.make("hire_mission", "han", {"state": sid, "budget": 150})
                if commands.validate(state, c_hm) == "":
                    cmds.append(c_hm)
                    budget -= 150
                    envoys_sent += 1

        # 3) 激进策略在信任充足时以自劾矫诏抢抓战机
        if self.style == "aggressive" and use_forge and court["trust"] >= 58.0 and state.turn % 3 == 2:
            c_fg = commands.make("forge_edict", "han", {"target": "cheshi_qian", "self_impeach": True})
            if commands.validate(state, c_fg) == "":
                cmds.append(c_fg)

        return budget

    def _logistics_v1(self, state, cmds):
        # 补充 1 支河西干线车队配合 SupplyLine，满足前 10 回合高密度后勤操作
        legs = [("chang_an", "long_xi"), ("long_xi", "wu_wei"), ("wu_wei", "zhang_ye"), ("jiu_quan", "dun_huang")]
        for src_id, dst_id in legs:
            src = state.nodes[src_id]
            dst = state.nodes[dst_id]
            if src["faction"] != "han" or dst["faction"] != "han":
                continue
            if dst["grain"] > 240000:
                continue
            workers = 6000 if src["type"] == "source" else min(2500, int(src["pop"] * state.bal["han"]["laborer_levy_ratio"]) - src["levied_out"])
            if workers >= 1500:
                c_cv = commands.make("convoy", "han", {"from": src_id, "to": dst_id, "grain": workers * 15.0, "laborers": workers})
                if commands.validate(state, c_cv) == "":
                    cmds.append(c_cv)
                    break

    def _expedition_v1(self, state, cmds, budget, win_prob_req, use_forge, use_convict):
        fields = [
            a for a in U.field_armies(state, "han")
            if not a["garrison"] and a["plan"]["preset"] != "garrison"
        ]
        home = "dun_huang"
        if state.nodes[home]["faction"] != "han":
            for cand in ("jiu_quan", "zhang_ye", "wu_wei"):
                if state.nodes[cand]["faction"] == "han":
                    home = cand
                    break

        if self.style == "baseline":
            army = next((a for a in fields if "node" in a["loc"] and U.is_idle(a)), None)
        else:
            # 清理残破野战军（兵力不足 2,200 的残部先遣散归池，同城多支空闲野战军自动合编）
            idle_fields = [a for a in fields if "node" in a["loc"] and U.is_idle(a)]
            valid_idle = []
            by_loc = {}
            for a in idle_fields:
                sz = state.army_size(a)
                nid = a["loc"]["node"]
                if sz < 2200 and state.nodes[nid]["faction"] == "han":
                    c_db = commands.make("disband", "han", {"army": a["id"]})
                    if commands.validate(state, c_db) == "":
                        cmds.append(c_db)
                        continue
                by_loc.setdefault(nid, []).append(a)
            for nid, grp in by_loc.items():
                grp.sort(key=lambda x: state.army_size(x), reverse=True)
                leader = grp[0]
                cur_sz = state.army_size(leader)
                for other in grp[1:]:
                    if cur_sz + state.army_size(other) <= 11500:
                        c_mg = commands.make("merge", "han", {"army": other["id"], "into": leader["id"]})
                        if commands.validate(state, c_mg) == "":
                            cmds.append(c_mg)
                            cur_sz += state.army_size(other)
                if cur_sz >= 2400:
                    valid_idle.append(leader)
            army = valid_idle[0] if valid_idle else None
        moving = [x for x in fields if not U.is_idle(x)]
        if moving:
            return
        if army is None:
            node = state.nodes[home]
            if use_convict and budget >= 180 and self.style in ("aggressive", "baseline", "greedy") and state.turn % 3 == 0:
                c_cv = commands.make("recruit_convict", "han", {"node": home, "count": 2500})
                if commands.validate(state, c_cv) == "":
                    cmds.append(c_cv)
                    return
            avail = dict(state.central)
            for p in cmds:
                if p["type"] == "recruit" and p.get("source") == "central":
                    for ut, cnt in p["units"].items():
                        avail[ut] -= cnt
            cav_want = min(1500, avail.get("cavalry", 0), int(getattr(state, "han_horse_pool", 0)))
            rec_cost = (
                3.5 * state.units["infantry"]["cost_money_per_1000"]
                + 2.5 * state.units["crossbow"]["cost_money_per_1000"]
                + (cav_want / 1000.0) * state.units["cavalry"]["cost_money_per_1000"]
            )
            if avail.get("infantry", 0) >= 3500 and avail.get("crossbow", 0) >= 2500 and budget >= rec_cost and node["grain"] > 110000:
                units_d = {"infantry": 3500, "crossbow": 2500}
                if cav_want >= 500:
                    units_d["cavalry"] = cav_want
                c_rec = commands.make("recruit", "han", {
                    "node": home,
                    "source": "central",
                    "units": units_d,
                    "preset": "balanced",
                })
                if commands.validate(state, c_rec) == "":
                    cmds.append(c_rec)
            return

        start_node = army["loc"]["node"]
        mine = combat.merged_units([army])
        # 选择攻击目标（先收复河西，再取楼兰/乌垒/车师前/焉耆）
        target = ""
        for nid in HEXI:
            if state.nodes[nid]["faction"] == "xiongnu":
                if self.style == "baseline":
                    target = nid
                    break
                n = state.nodes[nid]
                defenders = dict(n["militia"])
                for e in state.armies_at(nid):
                    if e["faction"] == "xiongnu":
                        for ut, cnt in e["units"].items():
                            defenders[ut] = defenders.get(ut, 0) + cnt
                p_hexi = combat.expected_p(state, mine, defenders, {"b_def": combat.wall_mult(state, n)})
                if p_hexi >= max(0.46, win_prob_req - 0.06):
                    target = nid
                    break
        if target == "":
            best_sc = -1.0
            max_hops = 5 if self.style == "aggressive" else (3 if self.style == "conservative" else 4)
            for sid, rel in state.relations.items():
                if rel["overlord"] == "han":
                    continue
                for n in state.nodes_of_state(sid):
                    if not state.factions[sid].get("counts_for_victory", False):
                        continue
                    hops = state.hops(start_node, n["id"], 6)
                    if hops > max_hops:
                        continue
                    defenders = dict(n["militia"])
                    for e in state.armies_at(n["id"]):
                        if e["faction"] == "xiongnu":
                            for ut, cnt in e["units"].items():
                                defenders[ut] = defenders.get(ut, 0) + cnt
                    p = combat.expected_p(state, mine, defenders, {"b_def": combat.wall_mult(state, n)})
                    if p < win_prob_req:
                        continue
                    sc = PRIORITY.get(sid, 1.0) * 2.5 - hops * 0.6 + p
                    if sc > best_sc:
                        best_sc = sc
                        target = n["id"]

        if target == "":
            return

        # S08-T04 远征断粮红灯硬拦截（结合已开通的驿道枢纽与屯田计算实际缺口）
        v1_logi = state.ext["v1"]["logistics"]
        supply_hubs = set(v1_logi.get("supply_lines", ["dun_huang"])) | set(k for k, v in v1_logi.get("tuntian_nodes", {}).items() if v > 0)
        m_raw = U.months_between(state, start_node, target, 1.0)
        m_hub = min([m_raw] + [U.months_between(state, h, target, 1.0) for h in supply_hubs if h in state.nodes])
        months_needed = min(3.4, m_hub * 1.15 + 1.6)
        soldiers = state.army_size(army)
        need = U.need_grain(state, soldiers, army["laborers"], army["horses"], months_needed)
        depot = state.nodes[start_node]
        load_grain = 0.0
        load_lab = 0
        if state.is_supply_node(depot, "han"):
            lab_avail = max(0, int(depot["pop"] * state.bal["han"]["laborer_levy_ratio"]) - depot["levied_out"])
            load_lab = max(0, min(2500, int((need - soldiers * 3.0) / 10.0) - army["laborers"], lab_avail))
            carry = soldiers * 3.0 + (army["laborers"] + load_lab) * 15.0
            load_grain = max(0.0, min(carry - army["grain"], state.stock(depot, "han") - (depot["pop"] * 6.0 if depot["faction"] == "han" else 0.0)))
        eat = U.need_grain(state, soldiers, army["laborers"] + load_lab, army["horses"], months_needed)

        if army["grain"] + load_grain < eat * 0.62 and target not in HEXI:
            # 粮道红灯拦截：远征西域若断粮风险高则不出兵送死（且不空发 load 指令）
            return

        if load_grain > 0 or load_lab > 0:
            cmds.append(commands.make("load", "han", {"army": army["id"], "grain": load_grain, "laborers": load_lab}))

        if use_forge and self.style in ("baseline", "aggressive") and target in ("cheshi_qian", "wu_lei") and state.ext["v1"]["court"]["trust"] >= 58.0:
            c_fg = commands.make("forge_edict", "han", {"target": target, "self_impeach": True})
            if commands.validate(state, c_fg) == "":
                cmds.append(c_fg)

        steps = [
            {"type": "siege", "node": target, "max_months": 3, "assault_when": 0.55},
            {"type": "return_to", "node": home},
        ]
        cmds.append(commands.make("set_plan", "han", {"army": army["id"], "steps": steps, "preset": "balanced"}))

    def _think_random_legal(self, state):
        v1 = state.ext["v1"]
        cmds = []
        c_rz = commands.make("welcome_rizhu", "han")
        if commands.validate(state, c_rz) == "":
            cmds.append(c_rz)
        ed = v1["court"].get("active_edict")
        if ed and not ed.get("complied"):
            c_cp = commands.make("comply_edict", "han")
            if commands.validate(state, c_cp) == "":
                cmds.append(c_cp)
        budget = float(state.factions["han"]["money"]) - 220.0
        horizon = state.decision_ticks * 10.0
        budget = self._defense(state, cmds, horizon, budget, 0.58)
        budget = self._diplomacy_v1(state, cmds, budget, 2, False)
        cands = commands.enumerate_legal_commands(state, "han")
        if cands:
            idxs = list(range(len(cands)))
            for i in range(len(idxs) - 1, 0, -1):
                j = state.rng.randint(0, i)
                idxs[i], idxs[j] = idxs[j], idxs[i]
            for idx in idxs:
                if len(cmds) >= 5 or budget < 200:
                    break
                c = cands[idx]
                if c["type"] in ("forge_edict", "split", "merge", "set_plan"):
                    continue
                if commands.validate(state, c) == "":
                    cmds.append(c)
                    budget -= 180
        self._expedition_v1(state, cmds, max(0.0, budget), 0.58, False, False)
        return cmds


class V1XiongnuAI:
    """S08 匈奴双路径威服/河西 AI 与防嫉妒分赏 AI（支持 5 种策略性格参数化）。"""
    faction = "xiongnu"

    def __init__(self, style="baseline"):
        self.style = style

    def think(self, state):
        v1 = state.ext["v1"]
        tribes_state = v1["tribes"]
        tribes = tribes_state["tribes"]
        cmds = []

        if self.style == "random_legal":
            return self._think_random_legal(state)

        # 性格参数配置（S08 非传递克制环：雄猜严罚 vs 怀柔守成 vs 贪利秋掠 vs 均衡单于）
        if self.style == "aggressive":
            # 雄猜严罚 (xn_iron_tyrant)：高压进取、重兵寇河西 -> 强克贪心汉 (greedy) 与随机汉，但被持重营田汉 (conservative) 克制
            max_troops = 31500
            inf_target = 5200
            max_resent = 62
            min_atk_p = 0.56
            reward_mode = "equal"
            reward_freq = 3
            path_b_focus = False
        elif self.style == "conservative":
            # 怀柔守成 (xn_conciliatory_elder)：固守漠北草原、审慎出击 -> 克冒进汉，但易被稳健/重商汉在西域抢先立都护
            max_troops = 30000
            inf_target = 4800
            max_resent = 45
            min_atk_p = 0.55
            reward_mode = "equal"
            reward_freq = 2
            path_b_focus = (state.turn >= 8)
        elif self.style == "greedy":
            # 贪利秋掠 (xn_greedy_raider)：搜刮岁币、废立亲匈王子、专攻西域路径 B -> 克保守汉 (conservative)，被激进/均衡汉克制
            max_troops = 27500
            inf_target = 4200
            max_resent = 64
            min_atk_p = 0.60
            reward_mode = "equal"
            reward_freq = 3
            path_b_focus = True
        else:  # baseline (S08 均衡单于 AI)
            max_troops = 32000
            inf_target = 5500
            max_resent = 60
            min_atk_p = 0.54
            reward_mode = "equal"
            reward_freq = 2
            path_b_focus = (state.turn >= 6 or state.seed % 2 == 1)

        # --- 1) S03 防嫉妒分赏与安抚动摇部族 (S08-T05) ---
        rz = tribes["rizhu"]
        if (rz.get("surrender_window", 0) > 0 or rz["loyalty"] < 38.0) and self.style in ("baseline", "conservative"):
            c_pac = commands.make("pacify_tribe", "xiongnu", {"tribe": "rizhu"})
            if commands.validate(state, c_pac) == "":
                cmds.append(c_pac)

        min_loy = min(tv["loyalty"] for tv in tribes.values() if tv["status"] != "defected_han")
        if (state.turn % reward_freq == 0 or min_loy < 48.0) and (tribes_state["reward_pool"] + state.factions["xiongnu"]["money"] >= 600):
            if self.style not in ("aggressive", "greedy") or min_loy < 44.0 or state.turn % 3 == 0:
                c_rw = commands.make("distribute_rewards", "xiongnu", {"amount": 600, "mode": reward_mode})
                if commands.validate(state, c_rw) == "":
                    cmds.append(c_rw)

        # --- 2) S03 季度战术卡选择与龙城/蹛林大会 ---
        if state.turn % 4 == 2 and (tribes_state["reward_pool"] + state.factions["xiongnu"]["money"] >= 450):
            asm_tgt = "lou_lan" if state.controller(state.nodes["lou_lan"]) != "xiongnu" else "dun_huang"
            c_asm = commands.make("hold_chanyu_assembly", "xiongnu", {"target": asm_tgt})
            if commands.validate(state, c_asm) == "":
                cmds.append(c_asm)

        if tribes_state["tactical_card_ticks"] == 0:
            if self.style == "aggressive":
                card = "scorched_earth" if state.month() in (4, 5, 6) else "night_raid"
            elif self.style == "conservative":
                card = "clear_steppe"
            elif self.style == "greedy":
                card = "raze_beacons" if len(v1["logistics"]["beacons"]) > 3 else "scorched_earth"
            else:
                card = "feigned_retreat" if state.month() in (7, 8, 9) else "scorched_earth"
            c_tc = commands.make("play_tactical_card", "xiongnu", {"card": card})
            if commands.validate(state, c_tc) == "":
                cmds.append(c_tc)

        # --- 3) S04 西域索服、威压与废立王子 ---
        for sid in state.relations:
            if economy.can_demand(state, sid) == "":
                cmds.append(commands.make("demand_vassal", "xiongnu", {"state": sid}))

        if path_b_focus or self.style in ("greedy", "baseline", "aggressive"):
            intimidate_cnt = 0
            max_intim = 2 if self.style == "aggressive" else 1
            for sid in ("lou_lan", "cheshi_qian", "wu_lei", "qiu_ci", "yan_qi", "yu_tian"):
                rel = state.relations.get(sid)
                if not rel:
                    continue
                if self.style in ("greedy", "baseline", "aggressive") and rel["overlord"] != "xiongnu" and rel["xn_intimidation"] >= 44.0 and state.turn % 2 == 0:
                    c_ip = commands.make("install_prince", "xiongnu", {"state": sid})
                    if commands.validate(state, c_ip) == "":
                        cmds.append(c_ip)
                        break
                if rel["xn_intimidation"] < 68.0 and intimidate_cnt < max_intim:
                    c_ic = commands.make("intimidate_city", "xiongnu", {"state": sid})
                    if commands.validate(state, c_ic) == "":
                        cmds.append(c_ic)
                        intimidate_cnt += 1

        # --- 4) 岁币税率调整 ---
        for sid, rel in state.relations.items():
            if rel["overlord"] != "xiongnu":
                continue
            lv = 1
            if self.style in ("aggressive", "greedy"):
                lv = 2 if rel["xn_resentment"] < 46 else 1
            elif self.style == "conservative":
                lv = 1 if rel["xn_resentment"] < 35 else 0
            else:
                lv = 2 if rel["xn_resentment"] < 42 else 1
            if int(rel["tax_level"]) != lv:
                cmds.append(commands.make("set_tax", "xiongnu", {"state": sid, "level": lv}))

        # --- 5) 征召与集结攻势（支持多集结点非背板选择 S08-T06） ---
        self._recruit_v1(state, cmds, max_troops, inf_target, max_resent)
        assigned = {}
        self._campaign_v1(state, cmds, assigned, min_atk_p, path_b_focus)
        return cmds

    def _recruit_v1(self, state, cmds, max_troops, inf_target, max_resent):
        troops = sum(state.army_size(a) for a in U.field_armies(state, "xiongnu"))
        infantry = sum(U.count_units(a, "infantry") for a in U.field_armies(state, "xiongnu"))
        room = max_troops - troops
        if room > 0:
            for nid in ("youxian_wang", "chanyu_ting", "long_cheng"):
                n = state.nodes[nid]
                if n["faction"] != "xiongnu":
                    continue
                cap = int(n["pop"] * state.bal["xiongnu"]["levy_ratio"]) - n["recruited"].get("nomad", 0)
                amount = min(cap, room, 6000, max(0, int((n["horses"] - 20000) // 2)))
                if amount >= 1500:
                    cmds.append(commands.make("recruit", "xiongnu", {
                        "node": nid, "source": "nomad", "units": {"horse_archer": amount}, "preset": "balanced"
                    }))
                    room -= amount
                    break
        need = min(inf_target - infantry, room)
        for sid, rel in state.relations.items():
            if need < 500:
                break
            if rel["overlord"] != "xiongnu" or rel["xn_resentment"] > max_resent:
                continue
            for n in state.nodes_of_state(sid):
                cap = int(n["pop"] * state.bal["xiongnu"]["vassal_infantry_levy_ratio"]) - n["recruited"].get("vassal", 0)
                amount = min(need, cap)
                if amount >= 500:
                    cmds.append(commands.make("recruit", "xiongnu", {
                        "node": n["id"], "source": "vassal", "units": {"infantry": amount}, "preset": "balanced", "role": "siege"
                    }))
                    need -= amount

    def _campaign_v1(self, state, cmds, assigned, min_atk_p, path_b_focus):
        month = state.month()
        if month < 4 or month > 10:
            return
        if self.style == "aggressive":
            rally = "youxian_wang" if state.seed % 3 != 0 else "yi_wu"
        elif self.style == "greedy" and state.nodes.get("yi_wu", {}).get("faction") == "xiongnu":
            rally = "yi_wu"
        elif self.style == "baseline" and path_b_focus and state.nodes.get("yi_wu", {}).get("faction") == "xiongnu":
            rally = "yi_wu"
        else:
            rally = "youxian_wang" if state.seed % 2 == 0 else "yi_wu"
        gathered = []
        for a in U.field_armies(state, "xiongnu"):
            if not U.is_idle(a) or "node" not in a["loc"]:
                continue
            if a["loc"]["node"] == rally:
                gathered.append(a)
            else:
                if state.is_supply_node(state.nodes[a["loc"]["node"]], "xiongnu"):
                    cmds.append(commands.make("load", "xiongnu", {
                        "army": a["id"], "grain": supply.carry_cap(state, a) - a["grain"], "laborers": 0
                    }))
                c_mv = commands.make("set_plan", "xiongnu", {
                    "army": a["id"],
                    "steps": [{"type": "move_to", "node": rally}, {"type": "hold", "node": rally, "until": "end"}],
                    "preset": "assault",
                })
                if commands.validate(state, c_mv) == "":
                    cmds.append(c_mv)
        if not gathered:
            return
        gathered.sort(key=lambda a: state.army_size(a), reverse=True)
        leader = gathered[0]
        merged_list = [leader]
        cur_sz = state.army_size(leader)
        if self.style in ("greedy", "random_legal"):
            max_merge = 16500
        elif self.style in ("aggressive", "conservative"):
            max_merge = 18500
        else:
            max_merge = 20500 if (state.turn >= 10 or state.seed % 3 == 0) else 18500
        for i in range(1, len(gathered)):
            if cur_sz + state.army_size(gathered[i]) <= max_merge:
                cmds.append(commands.make("merge", "xiongnu", {"army": gathered[i]["id"], "into": leader["id"]}))
                merged_list.append(gathered[i])
                cur_sz += state.army_size(gathered[i])
        units = combat.merged_units(merged_list)
        if month < 7:
            return

        # 选择攻击目标（路径 A 攻河西四郡 vs 路径 B 攻楼兰/车师/乌垒）
        if self.style == "greedy":
            cands = ["lou_lan", "cheshi_qian", "wu_lei", "yan_qi", "wei_li", "dun_huang"]
        else:
            cands = list(state.bal["victory"]["xn_targets"])
            if path_b_focus:
                cands = ["lou_lan", "cheshi_qian", "wu_lei"] + cands

        target = ""
        best_val = float("-inf")
        for nid in cands:
            if nid not in state.nodes:
                continue
            n = state.nodes[nid]
            if state.controller(n) == "xiongnu":
                continue
            if self.style in ("greedy", "conservative", "aggressive", "random_legal"):
                path_nodes = state.path_to(rally, nid, 1.0, False)
                if any(
                    mid in ("wu_wei", "zhang_ye", "jiu_quan", "dun_huang") and state.controller(state.nodes[mid]) == "han"
                    for mid in path_nodes[:-1]
                ):
                    continue
            defenders = dict(n["militia"])
            for a in state.armies_at(nid):
                if a["faction"] == "han":
                    for ut, cnt in a["units"].items():
                        defenders[ut] = defenders.get(ut, 0) + cnt
            p = combat.expected_p(state, units, defenders, {"b_def": combat.wall_mult(state, n)})
            if p < min_atk_p:
                continue
            val = p * 10.0 - state.days_to(rally, nid, 1.0, False) / 60.0
            if path_b_focus and nid in ("lou_lan", "cheshi_qian", "wu_lei"):
                val += 2.5
            if val > best_val:
                best_val = val
                target = nid

        if target == "":
            return

        steps = [
            {"type": "burn", "node": target},
            {"type": "siege", "node": target, "max_months": 3, "assault_when": 0.65},
            {"type": "return_to", "node": rally},
        ]
        c_pl = commands.make("set_plan", "xiongnu", {"army": leader["id"], "steps": steps, "preset": "assault"})
        if commands.validate(state, c_pl) == "":
            cmds.append(c_pl)

    def _think_random_legal(self, state):
        v1 = state.ext["v1"]
        tribes_state = v1["tribes"]
        tribes = tribes_state["tribes"]
        cmds = []
        rz = tribes["rizhu"]
        if rz.get("surrender_window", 0) > 0 or rz["loyalty"] < 38.0:
            c_pac = commands.make("pacify_tribe", "xiongnu", {"tribe": "rizhu"})
            if commands.validate(state, c_pac) == "":
                cmds.append(c_pac)
        if state.turn % 2 == 0 and (tribes_state["reward_pool"] + state.factions["xiongnu"]["money"] >= 600):
            c_rw = commands.make("distribute_rewards", "xiongnu", {"amount": 600, "mode": "equal"})
            if commands.validate(state, c_rw) == "":
                cmds.append(c_rw)
        for sid in state.relations:
            if economy.can_demand(state, sid) == "":
                cmds.append(commands.make("demand_vassal", "xiongnu", {"state": sid}))
        for sid in ("lou_lan", "cheshi_qian", "wu_lei"):
            rel = state.relations.get(sid)
            if rel and rel["xn_intimidation"] < 65.0:
                c_ic = commands.make("intimidate_city", "xiongnu", {"state": sid})
                if commands.validate(state, c_ic) == "":
                    cmds.append(c_ic)
                    break
        self._recruit_v1(state, cmds, 30000, 5000, 58)
        cands = commands.enumerate_legal_commands(state, "xiongnu")
        if cands:
            idxs = list(range(len(cands)))
            for i in range(len(idxs) - 1, 0, -1):
                j = state.rng.randint(0, i)
                idxs[i], idxs[j] = idxs[j], idxs[i]
            for idx in idxs:
                if len(cmds) >= 5:
                    break
                c = cands[idx]
                if c["type"] in ("split", "merge", "set_plan"):
                    continue
                if commands.validate(state, c) == "":
                    cmds.append(c)
        self._campaign_v1(state, cmds, {}, 0.55, True)
        return cmds
