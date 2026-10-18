"""Web 交互式纸面原型桥接器（供 Pyodide 浏览器端与本地 Web 打包器调用）。

提供零依赖、纯 JSON 进出的全量状态快照、合法命令分类、幕僚推荐、单步/多步推演、
悔棋回退、三大剧本预设加载、0-18旬行军余粮曲线预演与《汉书》体纪事生成。
"""
import copy
import json

from . import metrics
from .ai import make_bot
from .engine import combat, commands, economy, resolver, supply, victory
from .engine.state import GameState, load_json
from .play import format_turn_observation
from .rulesets import attach_rules

_SESSION = {
    "state": None,
    "side": "han",
    "ruleset": "v1",
    "opp_bot": "baseline",
    "scenario": "mo_bei_zhi_hou",
    "history": [],
    "turn_logs": [],
    "merged_cands": [],
    "recommended": [],
}


SCENARIO_META = {
    "mo_bei_zhi_hou": {
        "id": "mo_bei_zhi_hou",
        "title": "剧本②：漠北之后（元狩四年 · 前119年）",
        "subtitle": "标准主沙盒 · 40季（10年） · 断匈奴右臂、设立西域都护府",
        "start_year": -119,
        "start_month": 1,
        "max_months": 120,
        "desc": "卫青、霍去病漠北决战之后，汉武帝决意遣博望侯张骞持节通乌孙，断匈奴右臂；伊稚斜单于则以右贤王与僮仆都尉严控天山北道与楼兰锁钥。",
    },
    "lou_lan_gu_shi": {
        "id": "lou_lan_gu_shi",
        "title": "剧本①：楼兰姑师（元封三年 · 前108年）",
        "subtitle": "紧凑破局剧本 · 12季（3年） · 破楼兰劫使之罪、通盐泽丝路",
        "start_year": -108,
        "start_month": 1,
        "max_months": 36,
        "desc": "楼兰、姑师（车师前）当道苦汉使者，屡为匈奴耳目劫掠精使。汉廷诏命从票侯赵破奴与王恢率属国骑及河西兵出玉门关问罪破敌。",
    },
    "du_hu_fu": {
        "id": "du_hu_fu",
        "title": "剧本③：郑吉并护北道（地节二年 · 前68年）",
        "subtitle": "中后期决战剧本 · 36季（9年） · 争车师、迎日逐王先贤掸来降",
        "start_year": -68,
        "start_month": 1,
        "max_months": 108,
        "desc": "侍郎郑吉率免刑罪人田渠犁、乌垒，发诸国兵攻破车师；匈奴内部握衍朐鞮单于与日逐王先贤掸猜忌日深，历史性的『日逐降汉、并护两道』近在眼前。",
    },
}


def categorize_command(cmd):
    t = cmd.get("type", "")
    if t in (
        "comply_edict", "bargain_edict", "forge_edict", "request_appropriation",
        "petition_protectorate", "distribute_rewards", "pacify_tribe",
        "play_tactical_card", "set_tax",
    ):
        return "politics"
    if t in (
        "dispatch_elite_envoy", "hire_mission", "make_vassal", "enfeoff",
        "accept_dual_allegiance", "assassinate_king", "welcome_rizhu",
        "demand_vassal", "intimidate_city", "install_prince", "lobby",
    ):
        return "diplomacy"
    if t in ("convoy", "load", "build_tuntian", "build_beacon", "expand_farm"):
        return "logistics"
    return "military"


def estimate_command_cost(state, cmd):
    t = cmd.get("type", "")
    if t == "dispatch_elite_envoy":
        return {"money": int(cmd.get("budget", 320)), "tag": "精使预算"}
    if t == "hire_mission":
        return {"money": int(cmd.get("budget", 150)), "tag": "募使预算"}
    if t == "enfeoff":
        return {"money": 200, "tag": "赐印绶"}
    if t == "accept_dual_allegiance":
        return {"money": 160, "tag": "纳两属"}
    if t == "assassinate_king":
        return {"money": 240, "tag": "奇袭刺王"}
    if t == "build_tuntian":
        return {"money": 260, "tag": "兴建军屯"}
    if t == "build_beacon":
        return {"money": 180, "tag": "修筑烽燧"}
    if t == "expand_farm":
        return {"money": int(state.bal["farm"]["expand_cost_money"]), "tag": "扩建农田"}
    if t == "petition_protectorate":
        return {"money": 400, "tag": "奏请立都护"}
    if t == "recruit_convict":
        return {"money": 180, "tag": "征七科谪"}
    if t == "recruit" and cmd.get("faction") == "han":
        cost = sum(
            cnt / 1000.0 * state.units[ut]["cost_money_per_1000"]
            for ut, cnt in cmd.get("units", {}).items()
            if ut in state.units
        )
        return {"money": int(cost), "tag": "征募汉军"}
    if t == "distribute_rewards":
        return {"money": int(cmd.get("amount", 600)), "tag": "四部分赏"}
    if t == "pacify_tribe":
        return {"money": 260, "tag": "专使安抚"}
    if t == "intimidate_city":
        return {"money": 100, "tag": "骑兵威压"}
    if t == "install_prince":
        return {"money": 260, "tag": "废立王子"}
    if t == "lobby":
        return {"money": int(cmd.get("gifts", 1)) * int(state.bal["diplomacy"]["gift_cost_money"]), "tag": "遣使厚币"}
    return {"money": 0, "tag": "军政指令"}


def command_target_node(state, cmd):
    for k in ("node", "to", "target"):
        if cmd.get(k) in state.nodes:
            return cmd.get(k)
    st = cmd.get("state", "")
    if st in state.nodes:
        return st
    if st in state.relations:
        ns = state.nodes_of_state(st)
        if ns:
            return ns[0]["id"]
    if cmd.get("type") == "set_plan":
        for step in cmd.get("steps", ()):
            if step.get("node") in state.nodes:
                return step.get("node")
    return ""


def apply_scenario_preset(state, scenario_id):
    meta = SCENARIO_META.get(scenario_id, SCENARIO_META["mo_bei_zhi_hou"])
    state.start_year = meta["start_year"]
    state.start_month = meta["start_month"]
    state.max_turns = meta["max_months"]
    v1 = state.ext.get("v1")
    if scenario_id == "lou_lan_gu_shi":
        state.factions["han"]["money"] = 3600
        if "lou_lan" in state.relations:
            state.relations["lou_lan"]["han_influence"] = 38.0
            state.relations["lou_lan"]["xn_intimidation"] = 50.0
            state.relations["lou_lan"]["crimes_against_han"] = 2
        if "cheshi_qian" in state.relations:
            state.relations["cheshi_qian"]["han_influence"] = 32.0
            state.relations["cheshi_qian"]["xn_intimidation"] = 58.0
            state.relations["cheshi_qian"]["crimes_against_han"] = 2
        if v1:
            v1["court"]["active_edict"] = {
                "id": "edict_punish_loulan_gushi",
                "title": "诏命从票侯赵破奴、王恢讨楼兰姑师劫使之罪",
                "target": "lou_lan",
                "deadline_turn": 5,
                "reward_money": 800,
                "reward_trust": 12.0,
                "penalty_trust": 6.0,
                "complied": False,
                "bargained": False,
            }
            v1["victory"]["han_perm_merit"] = 35.0
    elif scenario_id == "du_hu_fu":
        state.factions["han"]["money"] = 4200
        for sid in ("lou_lan", "qie_mo", "jing_jue", "yu_tian", "wei_li", "wu_lei", "qiu_ci"):
            if sid in state.relations:
                state.relations[sid]["overlord"] = "han"
                state.relations[sid]["han_influence"] = 78.0
                state.relations[sid]["xn_intimidation"] = 28.0
                state.relations[sid]["han_enfeoffed"] = True
        if "wu_sun" in state.relations:
            state.relations["wu_sun"]["han_influence"] = 68.0
        if v1:
            v1["logistics"]["tuntian_nodes"] = {"dun_huang": 2, "lou_lan": 2, "wu_lei": 2, "wei_li": 1}
            v1["logistics"]["beacons"] = ["wu_wei", "zhang_ye", "jiu_quan", "dun_huang", "ju_yan", "lou_lan", "wu_lei"]
            v1["tribes"]["tribes"]["rizhu"]["loyalty"] = 36.0
            v1["tribes"]["tribes"]["rizhu"]["grievance"] = 68.0
            v1["tribes"]["tribes"]["rizhu"]["surrender_window"] = 3
            v1["events"]["rizhu_offered"] = True
            v1["court"]["wind"] = "xuan_revival"
            v1["court"]["active_edict"] = {
                "id": "edict_protect_north_south",
                "title": "宣帝诏郑吉护南道、迎日逐王先贤掸并护车师西北道",
                "target": "cheshi_qian",
                "deadline_turn": 6,
                "reward_money": 900,
                "reward_trust": 14.0,
                "penalty_trust": 5.0,
                "complied": False,
                "bargained": False,
            }
            for rule in getattr(state, "rules", ()):
                if hasattr(rule, "_update_merit_and_weifu"):
                    rule._update_merit_and_weifu(state)


def build_chronicle_and_todos(state, side, recent_events=None):
    recent_events = recent_events or []
    v1 = state.ext.get("v1")
    date_str = state.date_text()
    q_num = state.turn + 1

    # 文言与白话双语本季纪事
    if not recent_events and state.turn == 0:
        scen = SCENARIO_META.get(_SESSION.get("scenario", "mo_bei_zhi_hou"), SCENARIO_META["mo_bei_zhi_hou"])
        classical = "%s（第1季）：%s。朝堂授节，西域三十六国观望汉匈锋芒。" % (date_str, scen["desc"])
        vernacular = "%s（开局第1季）：%s 现已拨付首季军资，请审视地图与幕僚建议下达首季指令。" % (date_str, scen["subtitle"])
    else:
        ev_texts = [e["text"] for e in recent_events if e.get("kind") in ("v1", "battle", "capture", "siege", "defect", "diplomacy", "starve", "victory")]
        if ev_texts:
            classical = "%s（第%d季）：%s" % (date_str, q_num, "；".join(ev_texts[:4]))
            vernacular = "%s（第%d季要闻）：本季共发生 %d 项军政大事——%s" % (date_str, q_num, len(ev_texts), "；".join(ev_texts[:3]))
        else:
            classical = "%s（第%d季）：塞下稍安，汉修河西亭障，转粟敦煌；匈奴牧马漠北，控弦待时。" % (date_str, q_num)
            vernacular = "%s（第%d季）：本季无大型决战，双方正在调度粮草、整补兵马与经营西域外交。" % (date_str, q_num)

    todos = []
    if v1:
        if side == "han":
            ed = v1["court"].get("active_edict")
            if ed and not ed.get("complied"):
                todos.append({
                    "level": "warn",
                    "title": "待奉诏令：《%s》" % ed["title"],
                    "detail": "限期第 %d 季前完成（当前第 %d 季），建议本季勾选【奉诏】或【上书讨价】。" % (ed["deadline_turn"], q_num),
                })
            if v1["tribes"]["tribes"]["rizhu"].get("surrender_window", 0) > 0:
                todos.append({
                    "level": "urgent",
                    "title": "历史破局窗口：匈奴日逐王先贤掸遣使请降！",
                    "detail": "剩余窗口 %d 季！立即勾选【发兵乌垒迎降日逐王】可直接获 +25 功业并永久罢黜僮仆都尉！" % v1["tribes"]["tribes"]["rizhu"]["surrender_window"],
                })
            if v1["victory"]["han_merit"] >= 86.0:
                todos.append({
                    "level": "urgent",
                    "title": "功业已达 %.1f：可上疏奏请设立西域都护府！" % v1["victory"]["han_merit"],
                    "detail": "维持功业 G ≥ 100 满 12 个月即可达成汉方主胜利。",
                })
            if state.nodes["dun_huang"]["grain"] < 140000:
                todos.append({
                    "level": "info",
                    "title": "敦煌前线仓粮偏低（%.0fk）" % (state.nodes["dun_huang"]["grain"] / 1000.0),
                    "detail": "建议兴建西域军屯或增派河西转运粮队。",
                })
        else:
            rz = v1["tribes"]["tribes"]["rizhu"]
            if rz["loyalty"] < 45.0 or rz.get("surrender_window", 0) > 0:
                todos.append({
                    "level": "urgent",
                    "title": "西翼警报：日逐王先贤掸忠诚跌至 %.0f！" % rz["loyalty"],
                    "detail": "随时可能率部叛降汉朝！请立即执行【专使安抚日逐王】或【四部分赏】。",
                })
            if v1["tribes"]["tactical_card_ticks"] == 0:
                todos.append({
                    "level": "info",
                    "title": "本季单于王庭战术卡就绪",
                    "detail": "可打出【诈败诱敌】【坚壁焚田】【拔除亭燧】【天山夜袭】或【远遁清野】。",
                })
    if not todos:
        todos.append({
            "level": "info",
            "title": "边塞态势平稳",
            "detail": "可根据幕僚★推荐指令稳步推进西域邦交、军屯与兵马部署。",
        })
    return {"classical": classical, "vernacular": vernacular, "todos": todos[:3]}


def compute_forage_tier(rel):
    score = rel["han_influence"] * 0.65 - rel["xn_intimidation"] * 0.35 - rel["xn_resentment"] * 0.15
    if rel["overlord"] == "han" or score >= 35.0:
        return {"tier": "WELCOME", "label": "箪食壶浆（免钱迎军供粮）", "color": "#10b981"}
    if score >= 12.0:
        return {"tier": "MARKET", "label": "平价开市（市价购粮 60%）", "color": "#3b82f6"}
    if score >= -8.0:
        return {"tier": "REFUSE", "label": "闭籴绝市（仅暗购 15%）", "color": "#f59e0b"}
    return {"tier": "HOSTILE", "label": "坚壁拒守（零供粮·需强攻）", "color": "#ef4444"}


def build_ending_biography(state):
    v1 = state.ext.get("v1")
    sc = victory.score(state)
    if not v1:
        return {
            "winner": state.winner,
            "win_reason": state.win_reason,
            "headline": "《西域博弈终局》胜者：%s（%s）" % (state.winner, state.win_reason),
            "biography": "自元狩四年至%s，汉匈争霸西域凡 %d 回合。终局计分：汉 %d，匈奴 %d。" % (
                state.date_text(), state.turn, int(sc["han"]), int(sc["xiongnu"])
            ),
            "grade_han": "基线计分",
            "grade_xn": "基线计分",
            "signature": state.win_reason,
        }
    vic = v1["victory"]
    court = v1["court"]
    tribes = v1["tribes"]
    grade_titles = {
        "G1_FENGHOU": "【第一档·裂土封侯】功冠西域，诏封千户列侯，图形麒麟阁",
        "G2_CIJUE": "【第二档·赐爵关内】奉使称旨，赐爵关内侯、黄金百斤",
        "G3_WUGONG": "【第三档·功过相抵】久役塞外，糜费巨万，罢归田里",
        "G4_XIAYU": "【第四档·下吏赎死】丧师乏食，下廷尉当死，纳钱赎为庶人",
        "G5_ZUZHU": "【第五档·槛车弃市】覆军失地，槛车征还长安，要斩弃市",
        "X1_LONGCHENG": "【第一档·饮马河西】天骄复起，百蛮震服，诸王岁会龙城",
        "X2_BINFU": "【第二档·西域岁献】控弦十万，僮仆赋税不绝于幕北",
        "X3_GUDI": "【第三档·保境自守】虽失南道，犹存漠北王庭根本",
        "X4_BUHUI": "【第四档·右臂断折】日逐外叛，西域断绝，诸王不肯会龙城",
        "X5_SHENSI": "【第五档·漠北瓦解】白灾大饥，五单于争立，诸部离散",
    }
    bio = (
        "《汉书·西域传》赞曰：自%s开局，历 %d 季至%s止。"
        "汉使最高功业达 %.1f（终局 %.1f），朝廷信任 %.1f，累计断粮饿死 %d 人；"
        "匈奴单于威望 %.1f，西域威服峰值 %.1f（终局 %.1f）。"
        "太史公终局签名：【%s】。"
    ) % (
        SCENARIO_META.get(_SESSION.get("scenario", "mo_bei_zhi_hou"), SCENARIO_META["mo_bei_zhi_hou"])["title"],
        state.turn,
        state.date_text(),
        vic["han_merit_peak"],
        vic["han_merit"],
        court["trust"],
        state.stats.get("starve_soldier_losses", 0),
        tribes["chanyu_prestige"],
        vic["xn_weifu_peak"],
        vic["xn_weifu"],
        vic["end_signature"] or state.win_reason,
    )
    return {
        "winner": state.winner,
        "win_reason": state.win_reason,
        "end_type": vic["end_type"],
        "headline": "终局裁定：%s" % (state.win_reason or "对局结束"),
        "biography": bio,
        "grade_han": grade_titles.get(vic["han_grade"], vic["han_grade"]),
        "grade_xn": grade_titles.get(vic["xn_grade"], vic["xn_grade"]),
        "signature": vic["end_signature"] or state.win_reason,
    }


def serialize_state():
    state = _SESSION["state"]
    side = _SESSION["side"]
    ruleset = _SESSION["ruleset"]

    advisor_ai = make_bot(side, "baseline", ruleset=ruleset)
    recommended = advisor_ai.think(state)
    legal_list = commands.enumerate_legal_commands(state, side)

    merged_cands = []
    seen_repr = set()
    rec_reprs = {repr(sorted(c.items())) for c in recommended}
    for c in recommended + legal_list:
        r = repr(sorted(c.items()))
        if r not in seen_repr and commands.validate(state, c) == "":
            seen_repr.add(r)
            merged_cands.append(c)

    _SESSION["merged_cands"] = merged_cands
    _SESSION["recommended"] = recommended

    cmd_items = []
    for idx, c in enumerate(merged_cands, start=1):
        r = repr(sorted(c.items()))
        cost_info = estimate_command_cost(state, c)
        cmd_items.append({
            "idx": idx,
            "type": c.get("type", ""),
            "desc": commands.describe(state, c),
            "category": categorize_command(c),
            "recommended": (r in rec_reprs),
            "cost_money": cost_info["money"],
            "tag": cost_info["tag"],
            "target_node": command_target_node(state, c),
            "raw": c,
        })

    sc = victory.score(state)
    v1 = state.ext.get("v1")
    nodes_out = {}
    for nid, n in state.nodes.items():
        rel = state.relations.get(n["faction"])
        armies_here = [
            {
                "id": a["id"],
                "name": a.get("name", a["id"]),
                "faction": a["faction"],
                "soldiers": state.army_size(a),
                "grain": int(a["grain"]),
                "laborers": int(a["laborers"]),
                "horses": int(a["horses"]),
                "status": a["status"],
                "is_convoy": bool(a["is_convoy"]),
                "commander": a.get("commander", ""),
            }
            for a in state.armies_at(nid)
        ]
        nodes_out[nid] = {
            "id": nid,
            "name": n["name"],
            "type": n["type"],
            "region": n.get("region", ""),
            "faction": n["faction"],
            "controller": state.controller(n),
            "pop": int(n["pop"]),
            "grain": int(n["grain"]),
            "farm_cap": int(n.get("farm_cap", 0)),
            "horses": int(n.get("horses", 0)),
            "walls": int(n.get("walls", 0)),
            "wall_hp": int(n.get("wall_hp", 0)),
            "militia": sum(n.get("militia", {}).values()),
            "has_beacon": bool(v1 and nid in v1["logistics"]["beacons"]),
            "tuntian_lv": int(v1["logistics"]["tuntian_nodes"].get(nid, 0)) if v1 else 0,
            "armies": armies_here,
            "relation": {
                "overlord": rel["overlord"],
                "han_influence": round(rel["han_influence"], 1),
                "xn_intimidation": round(rel["xn_intimidation"], 1),
                "xn_resentment": round(rel["xn_resentment"], 1),
                "tax_level": int(rel.get("tax_level", 1)),
                "is_dual": bool(rel.get("is_dual", False)),
                "han_enfeoffed": bool(rel.get("han_enfeoffed", False)),
                "crimes": int(rel.get("crimes_against_han", 0)),
                "forage": compute_forage_tier(rel),
            } if rel else None,
        }

    moving_armies = []
    for a in state.armies.values():
        if "from" in a["loc"] and "to" in a["loc"]:
            moving_armies.append({
                "id": a["id"],
                "name": a.get("name", a["id"]),
                "faction": a["faction"],
                "from": a["loc"]["from"],
                "to": a["loc"]["to"],
                "progress": round(a["loc"].get("progress", 0.5) / max(1.0, a["loc"].get("days", 10.0)), 2),
                "soldiers": state.army_size(a),
                "is_convoy": bool(a["is_convoy"]),
            })

    last_events = _SESSION["turn_logs"][-1]["events"] if _SESSION["turn_logs"] else []
    chronicle = build_chronicle_and_todos(state, side, last_events)

    return {
        "meta": {
            "turn": state.turn,
            "max_turns": state.max_turns // (state.decision_ticks // 3),
            "tick": state.tick,
            "date_text": state.date_text(),
            "season": state.season(),
            "side": side,
            "ruleset": ruleset,
            "opp_bot": _SESSION["opp_bot"],
            "scenario": _SESSION["scenario"],
            "seed": state.seed,
            "can_undo": len(_SESSION["history"]) > 0,
            "winner": state.winner,
            "win_reason": state.win_reason,
        },
        "scores": {
            "han": round(sc["han"], 1),
            "xiongnu": round(sc["xiongnu"], 1),
            "han_money": int(state.factions["han"]["money"]),
            "xn_money": int(state.factions["xiongnu"]["money"]),
            "han_vassals": victory.han_vassals(state),
            "xn_vassals": victory.xn_vassals(state),
            "hexi_han": 4 - victory.hexi_held_by_xn(state),
            "han_horse_pool": int(getattr(state, "han_horse_pool", 0)),
            "central_pool": dict(state.central),
            "starve_losses": int(state.stats.get("starve_soldier_losses", 0)),
            "han_casualties": int(state.stats.get("han_casualties", 0)),
            "xn_casualties": int(state.stats.get("xn_casualties", 0)),
        },
        "v1": {
            "victory": dict(v1["victory"]),
            "court": dict(v1["court"]),
            "tribes": copy.deepcopy(v1["tribes"]),
            "diplomacy": dict(v1["diplomacy"]),
            "logistics": copy.deepcopy(v1["logistics"]),
            "events_meta": {
                "major_events_count": v1["events"]["major_events_count"],
                "baizai_count": v1["events"]["baizai_count"],
                "rizhu_offered": v1["events"]["rizhu_offered"],
                "rizhu_surrendered": v1["events"]["rizhu_surrendered"],
                "wusun_married": v1["events"]["wusun_married"],
                "dawan_horses_obtained": v1["events"]["dawan_horses_obtained"],
            },
        } if v1 else None,
        "observation_text": format_turn_observation(state, side),
        "chronicle": chronicle,
        "commands": cmd_items,
        "nodes": nodes_out,
        "moving_armies": moving_armies,
        "turn_logs": _SESSION["turn_logs"][-8:],
        "ending": build_ending_biography(state) if state.winner != "" else None,
    }


def init_game_json(side="han", ruleset="v1", opp_bot="baseline", seed=11001, decision_ticks=9, scenario="mo_bei_zhi_hou"):
    params = copy.deepcopy(load_json("design_sim/params.json"))
    params["decision_ticks"] = int(decision_ticks)
    state = GameState(params, seed=int(seed))
    attach_rules(state, ruleset)
    apply_scenario_preset(state, scenario)

    _SESSION["state"] = state
    _SESSION["side"] = side
    _SESSION["ruleset"] = ruleset
    _SESSION["opp_bot"] = opp_bot
    _SESSION["scenario"] = scenario
    _SESSION["history"] = []
    _SESSION["turn_logs"] = []
    return json.dumps(serialize_state(), ensure_ascii=False)


def step_turn_json(selected_indices_json="[]", use_advisor=False):
    state = _SESSION["state"]
    if state is None:
        return init_game_json()
    if state.winner != "":
        return json.dumps(serialize_state(), ensure_ascii=False)

    # 保存悔棋快照（最多保留 12 步）
    _SESSION["history"].append((copy.deepcopy(state), copy.deepcopy(_SESSION["turn_logs"])))
    if len(_SESSION["history"]) > 12:
        _SESSION["history"].pop(0)

    side = _SESSION["side"]
    opp = "xiongnu" if side == "han" else "han"
    ruleset = _SESSION["ruleset"]
    opp_ai = make_bot(opp, _SESSION["opp_bot"], ruleset=ruleset)

    if use_advisor:
        chosen = list(_SESSION["recommended"])
    else:
        indices = json.loads(selected_indices_json)
        cands = _SESSION["merged_cands"]
        chosen = [cands[i - 1] for i in indices if isinstance(i, int) and 1 <= i <= len(cands)]

    opp_cmds = opp_ai.think(state)
    turn_before = state.turn + 1
    date_before = state.date_text()

    res = resolver.resolve(state, {side: chosen, opp: opp_cmds}, capture_days=False)

    applied_mine = [commands.describe(state, c) for c in res["applied"] if c["faction"] == side]
    applied_opp = [commands.describe(state, c) for c in res["applied"] if c["faction"] == opp]
    rejected_mine = [
        {"desc": commands.describe(state, r["cmd"]), "why": r["why"]}
        for r in res["rejected"] if r["cmd"]["faction"] == side
    ]
    key_events = [
        {"date": e["date"], "kind": e["kind"], "text": e["text"]}
        for e in res["events"]
        if e["kind"] in ("v1", "battle", "capture", "siege", "raid", "defect", "diplomacy", "economy", "starve", "victory")
    ]

    _SESSION["turn_logs"].append({
        "turn": turn_before,
        "date": date_before,
        "applied_mine": applied_mine,
        "applied_opp": applied_opp,
        "rejected_mine": rejected_mine,
        "events": key_events[:18],
    })
    return json.dumps(serialize_state(), ensure_ascii=False)


def undo_turn_json():
    if _SESSION["history"]:
        prev_state, prev_logs = _SESSION["history"].pop()
        _SESSION["state"] = prev_state
        _SESSION["turn_logs"] = prev_logs
    return json.dumps(serialize_state(), ensure_ascii=False)


def run_batch_sim_json(games=10, ruleset="v1", han_bot="baseline", xn_bot="baseline", seed_start=11001):
    params = copy.deepcopy(load_json("design_sim/params.json"))
    params["decision_ticks"] = 9
    records = []
    for i in range(int(games)):
        sd = int(seed_start) + i
        st = GameState(params, seed=sd)
        attach_rules(st, ruleset)
        h_ai = make_bot("han", han_bot, ruleset=ruleset)
        x_ai = make_bot("xiongnu", xn_bot, ruleset=ruleset)
        max_decision_turns = max(1, (st.max_turns * 3) // st.decision_ticks + 4)
        for _ in range(max_decision_turns):
            if st.winner != "":
                break
            hc = h_ai.think(st)
            xc = x_ai.think(st)
            resolver.resolve(st, {"han": hc, "xiongnu": xc}, capture_days=False)
        records.append(metrics.extract_game_record(st))
    summary = metrics.summarize_records(records, meta={
        "decision_ticks": 9,
        "ruleset": ruleset,
        "han_bot": han_bot,
        "xn_bot": xn_bot,
    })
    return json.dumps(summary, ensure_ascii=False)
