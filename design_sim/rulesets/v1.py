"""W2 商业化进化规则集插件（`v1`）—— 完整实现 S01–S08 核心机制。

覆盖模块：
- S01 胜利与剧本：40季(120月)标准局、汉都护府功业值 G、匈奴双路径主胜利(河西四郡 / 威服值 W>=100)、
  政治崩盘失败(HAN_RECALL / XN_SCATTER)、连续变量到期计分(horses_per_1000=1.2)、史官五档评定(G1..G5 / X1..X5)、
  四段式终局签名 {END_TYPE}__{PATH_TAG}__{GRADE_PAIR}__{TOP2_EVENTS}。
- S02 汉廷与诏令：Tick 0 首季拨款 +1,500 钱 + 季度拨款、朝廷信任(0–100)、文书驿传时差、
  诏令生成与奉诏/讨价/矫诏自劾、上书请款/请立都护。
- S03 匈奴联盟：单于威望、赏赐池与结构性赤字、四部(zuoxian/youxian/rizhu/lihu)忠诚度与动摇请降、
  三次年会(正月/五月龙城/秋季蹛林)、僮仆都尉在途税队与截击、季度战术卡。
- S04 城邦与外交：楼兰开局威吓 55 + 软禁商渗漏率 0.30、精使/募使预算制与边际递减、
  募使受辱生成罪状与有罪讨伐、两属城邦(is_dual)、四档供粮意愿(迎军/开市/闭籴/拒守)。
- S05 后勤与迷雾：自动化补给线(SupplyLine)、国家马匹池(han_horse_pool)、西域屯田(build_tuntian)、
  七科谪罪人兵(recruit_convict)、烽燧(build_beacon)与五级迷雾感知误差。
- S06 事件与人物：25 名具名历史人物(统率/辞令加成)、中期重大事件配额保底
  (白灾瓦解链、单于继承危机、日逐王请降+25功业罢僮仆、乌孙和亲助战、刺楼兰王、天马入贡、轮台悔诏)。
"""
import math

from ..engine import buffs, combat, commands, economy, resolver, siege, supply, victory

WEST_18 = (
    "lou_lan", "qie_mo", "jing_jue", "yu_tian", "pi_shan", "sha_che", "shu_le",
    "juandu", "xiuxun", "suo_ju", "wei_li", "wu_lei", "lun_tai", "yan_qi",
    "qiu_ci", "gu_mo", "wen_su", "cheshi_qian", "cheshi_hou", "dong_qiemi",
)
NORTH_HUB_STATES = ("cheshi_qian", "cheshi_hou", "dong_qiemi", "yan_qi", "wei_li", "wu_lei", "lun_tai", "qiu_ci")
SOUTH_STATES = ("lou_lan", "qie_mo", "jing_jue", "yu_tian", "pi_shan", "sha_che", "shu_le")
GREAT_POWERS = ("wu_sun", "da_wan", "kang_ju", "da_yueshi")
HEXI_FOUR = ("wu_wei", "zhang_ye", "jiu_quan", "dun_huang")
HEXI_ALL = ("wu_wei", "zhang_ye", "jiu_quan", "dun_huang", "ju_yan")
EVENT_PRIORITY = ("rizhu", "baizai", "jiaozhao", "chanyu_die", "wind_shift", "hexi_fall", "wusun_war", "king_slain")

# S06 25 名历史人物花名册（R-02 0-100 量纲 + command_tier 0-10）
NAMED_CHARACTERS = [
    # 汉方 15 人
    {"id": "zhang_qian", "name": "张骞", "faction": "han", "command": 72, "eloquence": 98, "caution": 80, "role": "envoy", "personality": "han_prudent_farmer", "traits": ["zaokong"]},
    {"id": "zhao_ponu", "name": "赵破奴", "faction": "han", "command": 84, "eloquence": 62, "caution": 48, "role": "general", "personality": "han_pioneer_hawk", "traits": ["cavalry_leader"]},
    {"id": "li_guangli", "name": "李广利", "faction": "han", "command": 76, "eloquence": 55, "caution": 42, "role": "general", "personality": "han_pioneer_hawk", "traits": ["ambition_marquis"]},
    {"id": "fu_jiezi", "name": "傅介子", "faction": "han", "command": 80, "eloquence": 92, "caution": 38, "role": "envoy", "personality": "han_audacious_schemer", "traits": ["yongjue"]},
    {"id": "chang_hui", "name": "常惠", "faction": "han", "command": 85, "eloquence": 88, "caution": 72, "role": "envoy", "personality": "han_audacious_schemer", "traits": ["vassal_levy"]},
    {"id": "zheng_ji", "name": "郑吉", "faction": "han", "command": 88, "eloquence": 84, "caution": 82, "role": "general", "personality": "han_prudent_farmer", "traits": ["tuntian_master"]},
    {"id": "feng_fengshi", "name": "冯奉世", "faction": "han", "command": 86, "eloquence": 86, "caution": 65, "role": "general", "personality": "han_audacious_schemer", "traits": ["decisive"]},
    {"id": "gongsun_ao", "name": "公孙敖", "faction": "han", "command": 78, "eloquence": 52, "caution": 55, "role": "general", "personality": "han_pioneer_hawk", "traits": ["veteran"]},
    {"id": "lu_bode", "name": "路博德", "faction": "han", "command": 82, "eloquence": 68, "caution": 85, "role": "general", "personality": "han_prudent_farmer", "traits": ["beacon_builder"]},
    {"id": "wang_hui", "name": "王恢", "faction": "han", "command": 74, "eloquence": 75, "caution": 60, "role": "envoy", "personality": "han_audacious_schemer", "traits": ["schemer"]},
    {"id": "guo_chang", "name": "郭昌", "faction": "han", "command": 79, "eloquence": 58, "caution": 64, "role": "general", "personality": "han_pioneer_hawk", "traits": ["stern"]},
    {"id": "wei_guang", "name": "卫广", "faction": "han", "command": 77, "eloquence": 60, "caution": 68, "role": "general", "personality": "han_prudent_farmer", "traits": ["disciplined"]},
    {"id": "lai_dan", "name": "赖丹", "faction": "han", "command": 70, "eloquence": 66, "caution": 74, "role": "general", "personality": "han_prudent_farmer", "traits": ["tuntian_colonel"]},
    {"id": "sang_hongyang", "name": "桑弘羊", "faction": "han", "command": 60, "eloquence": 90, "caution": 88, "role": "minister", "personality": "han_prudent_farmer", "traits": ["logistics_master"]},
    {"id": "du_zhou", "name": "杜周", "faction": "han", "command": 65, "eloquence": 82, "caution": 90, "role": "censor", "personality": "han_prudent_farmer", "traits": ["stern_law"]},
    # 匈奴 10 人
    {"id": "yizhi_xie", "name": "伊稚斜单于", "faction": "xiongnu", "command": 90, "eloquence": 74, "caution": 50, "role": "chanyu", "personality": "xn_iron_tyrant", "traits": ["fierce"]},
    {"id": "wu_wei_chanyu", "name": "乌维单于", "faction": "xiongnu", "command": 80, "eloquence": 78, "caution": 76, "role": "chanyu", "personality": "xn_conciliatory_elder", "traits": ["prudent"]},
    {"id": "wushilu", "name": "儿单于乌师庐", "faction": "xiongnu", "command": 84, "eloquence": 52, "caution": 32, "role": "chanyu", "personality": "xn_iron_tyrant", "traits": ["reckless"]},
    {"id": "hulugu", "name": "狐鹿姑单于", "faction": "xiongnu", "command": 86, "eloquence": 80, "caution": 70, "role": "chanyu", "personality": "xn_conciliatory_elder", "traits": ["balanced"]},
    {"id": "woyan_qudi", "name": "握衍朐鞮单于", "faction": "xiongnu", "command": 78, "eloquence": 48, "caution": 35, "role": "chanyu", "personality": "xn_iron_tyrant", "traits": ["tyrant"]},
    {"id": "xian_xiandan", "name": "日逐王先贤掸", "faction": "xiongnu", "command": 85, "eloquence": 82, "caution": 72, "role": "tribe_king", "personality": "xn_conciliatory_elder", "traits": ["west_governor"]},
    {"id": "huyan_gu", "name": "右贤王呼衍骨", "faction": "xiongnu", "command": 87, "eloquence": 65, "caution": 55, "role": "tribe_king", "personality": "xn_greedy_raider", "traits": ["raider"]},
    {"id": "xubu_she", "name": "左贤王须卜奢", "faction": "xiongnu", "command": 84, "eloquence": 70, "caution": 68, "role": "tribe_king", "personality": "xn_conciliatory_elder", "traits": ["east_pillar"]},
    {"id": "xiutu_yu", "name": "犁汙王休屠余", "faction": "xiongnu", "command": 81, "eloquence": 60, "caution": 52, "role": "tribe_king", "personality": "xn_greedy_raider", "traits": ["vanguard"]},
    {"id": "weitu_qi", "name": "僮仆都尉唯涂耆", "faction": "xiongnu", "command": 75, "eloquence": 64, "caution": 58, "role": "duwei", "personality": "xn_greedy_raider", "traits": ["tax_collector"]},
]


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def record_key_event(state, tag):
    """记录 S01-R07 终局签名使用的 8 类重大历史事件标签。"""
    v1 = state.ext.get("v1")
    if not v1:
        return
    ev_list = v1["victory"]["key_events_occurred"]
    if tag in EVENT_PRIORITY and tag not in ev_list:
        ev_list.append(tag)


class V1RulesetPlugin(resolver.RulesetPlugin):
    name = "v1"

    def __init__(self, params=None):
        self.params = params or {}

    def setup(self, state):
        s01 = state.params.get("s01_victory", {})
        s02 = state.params.get("s02_court", {})
        s03 = state.params.get("s03_confederation", {})
        s04 = state.params.get("s04_diplomacy", {})
        s05 = state.params.get("s05_logistics", {})
        s06 = state.params.get("s06_events", {})

        # S01: 标准局 40 季 (120 个月)
        state.max_turns = int(s01.get("max_months", 120))

        # S02: 停用旧版岁首一次性 3000 金发放，改为 Tick 0 首季拨款 + 每季动态信任拨款
        state.bal["han"]["annual_money"] = 0
        init_bonus = int(s02.get("initial_bonus_money", 1500))
        state.factions["han"]["money"] += init_bonus

        # S04: 楼兰开局匈奴威吓微调至 55，使开局破局与通商渗漏可行
        if "lou_lan" in state.relations:
            state.relations["lou_lan"]["xn_intimidation"] = float(s04.get("loulan_init_intimidation", 55.0))
        for sid, rel in state.relations.items():
            rel["is_dual"] = False
            rel["han_enfeoffed"] = (rel.get("han_status") == "enfeoffed")
            rel["hostage_sent_han"] = False
            rel["crimes_against_han"] = 1 if sid in ("lou_lan", "cheshi_qian") else 0
            rel["satiation"] = 0
            rel["forage_stance"] = "market"

        # S05: 国家马匹池与初始河西烽燧、敦煌屯田
        state.han_horse_pool = int(s05.get("init_horse_pool", 8000))

        # S06: 初始化 25 名历史人物并绑定初始主力将领
        chars = {}
        for c in NAMED_CHARACTERS:
            cc = dict(c)
            cc["command_tier"] = int(round(cc["command"] / 10.0))
            cc["busy_until"] = 0
            cc["alive"] = True
            chars[cc["id"]] = cc

        han_armies = [a for a in state.armies.values() if a["faction"] == "han" and not a["is_convoy"]]
        han_gens = ["zhao_ponu", "gongsun_ao", "lu_bode", "zheng_ji"]
        for idx, a in enumerate(han_armies):
            if idx < len(han_gens):
                gid = han_gens[idx]
                a["commander"] = gid
                chars[gid]["at_army"] = a["id"]

        xn_armies = [a for a in state.armies.values() if a["faction"] == "xiongnu" and not a["is_convoy"]]
        xn_gens = ["yizhi_xie", "huyan_gu", "xian_xiandan", "xiutu_yu"]
        for idx, a in enumerate(xn_armies):
            if idx < len(xn_gens):
                gid = xn_gens[idx]
                a["commander"] = gid
                chars[gid]["at_army"] = a["id"]

        base_han_pop = max(1, sum(n["pop"] for n in state.nodes.values() if n["faction"] == "han"))
        base_xn_pop = max(
            1,
            sum(
                n["pop"]
                for n in state.nodes.values()
                if n["faction"] == "xiongnu"
                or (n["faction"] in state.relations and state.relations[n["faction"]]["overlord"] == "xiongnu")
            ),
        )
        base_xn_horses = max(
            1,
            sum(n["horses"] for n in state.nodes.values() if n["faction"] == "xiongnu")
            + sum(a["horses"] for a in state.armies.values() if a["faction"] == "xiongnu"),
        )

        state.ext["v1"] = {
            "cfg": {
                "s01": s01,
                "s02": s02,
                "s03": s03,
                "s04": s04,
                "s05": s05,
                "s06": s06,
            },
            "victory": {
                "han_merit": 0.0,
                "han_merit_peak": 0.0,
                "han_merit_breakdown": {},
                "han_merit_pool": 0.0,
                "han_perm_merit": 0.0,
                "han_hold_months": 0,
                "xn_weifu": 36.0,
                "xn_weifu_peak": 36.0,
                "xn_weifu_breakdown": {},
                "xn_event_pool": 0.0,
                "xn_sacred_penalty": 0.0,
                "xn_hexi_hold_months": 0,
                "xn_weifu_hold_months": 0,
                "yearly_battle_awards": 0,
                "punished_states": [],
                "hostage_states": [],
                "key_events_occurred": [],
                "baseline_han_pop": base_han_pop,
                "baseline_xn_pop": base_xn_pop,
                "baseline_xn_horses": base_xn_horses,
                "petition_boost_ticks": 0,
                "end_type": "",
                "path_tag": "",
                "han_grade": "G3_WUGONG",
                "xn_grade": "X3_GUDI",
                "end_signature": "",
                "end_signature_coarse": "",
                "lead_changes": 0,
                "last_leader": "xiongnu",
            },
            "court": {
                "trust": float(s02.get("init_trust", 70.0)),
                "precedent": 0.0,
                "regret": 0.0,
                "wind": "expansion",
                "luntai_edict_active": False,
                "active_edict": {
                    "id": "edict_open_loulan",
                    "title": "诏命博望侯通盐泽道（招抚或威服楼兰）",
                    "target": "lou_lan",
                    "deadline_turn": 6,
                    "reward_money": 650,
                    "reward_trust": 10.0,
                    "penalty_trust": 5.0,
                    "complied": False,
                    "bargained": False,
                },
                "next_edict_turn": 6,
                "in_transit_docs": [],
                "recall_active": False,
                "recall_grace_turns": 0,
                "recall_finalized": False,
                "unpardoned_forged_edict": False,
                "forged_count": 0,
                "forged_target": "",
                "forged_bonus_ticks": 0,
                "edicts_completed": 0,
                "edicts_failed": 0,
                "last_appropriation_turn": -3,
            },
            "tribes": {
                "chanyu_prestige": float(s03.get("init_prestige", 62.0)),
                "chanyu_id": "yizhi_xie",
                "chanyu_name": "伊稚斜单于",
                "reward_pool": int(s03.get("init_reward_pool", 1200)),
                "tongpu_active": True,
                "tongpu_node": "yan_qi",
                "tongpu_convoy_in_transit": False,
                "tongpu_intercept_hits": 0,
                "active_tactical_card": "",
                "tactical_card_ticks": 0,
                "scatter_consecutive_turns": 0,
                "tribes": {
                    "zuoxian": {"name": "左贤王部", "leader": "须卜奢", "loyalty": 72.0, "status": "normal", "expect": 240, "grievance": 10.0},
                    "youxian": {"name": "右贤王部", "leader": "呼衍骨", "loyalty": 68.0, "status": "normal", "expect": 240, "grievance": 15.0},
                    "rizhu": {"name": "日逐王部", "leader": "先贤掸", "loyalty": 58.0, "status": "normal", "expect": 210, "grievance": 28.0, "surrender_window": 0},
                    "lihu": {"name": "犁汙王部", "leader": "休屠余", "loyalty": 56.0, "status": "normal", "expect": 170, "grievance": 22.0, "surrender_window": 0},
                },
            },
            "diplomacy": {
                "recruited_missions_this_quarter": 0,
                "elite_missions_this_quarter": 0,
                "trade_leak_income": 0,
                "dual_states_count": 0,
                "insults_recorded": 0,
            },
            "logistics": {
                "supply_priority": 2,
                "forward_hub": "dun_huang",
                "beacons": ["wu_wei", "zhang_ye", "jiu_quan", "dun_huang"],
                "tuntian_nodes": {"dun_huang": 1},
                "tuntian_pressure": {},
                "convicts_year": 0,
                "auto_delivered_grain": 0.0,
            },
            "events": {
                "characters": chars,
                "major_events_count": 0,
                "last_major_event_turn": -4,
                "baizai_count": 0,
                "baizai_last_turn": -99,
                "chanyu_succession_done": False,
                "rizhu_offered": False,
                "rizhu_surrendered": False,
                "wusun_married": False,
                "dawan_horses_obtained": False,
                "loulan_king_slain": False,
                "seen_event_idx": 0,
            },
        }
        self._update_merit_and_weifu(state)

    # ------------------------------------------------------------------
    # 命令校验与执行 (S01–S06 新增指令，兼容 WEGO 同步执行防误拒)
    # ------------------------------------------------------------------
    def validate_command(self, state, cmd):
        v1 = state.ext.get("v1")
        if not v1:
            return None
        t = cmd.get("type", "")
        f = cmd.get("faction", "")
        money = state.factions.get(f, {}).get("money", 0)
        in_res = bool(v1.get("in_turn_resolve", False))

        # WEGO 同回合多命令并发容差：对即时命令若在回合初决策时合法、但因同回合前序指令改变了状态，放行并在 apply 中幂等处理
        if t in ("enfeoff", "make_vassal", "demand_vassal"):
            sid = cmd.get("state", "")
            if sid in state.relations:
                return ""
        if in_res and t in (
            "recruit", "load", "set_tax", "build_tuntian", "convoy",
            "accept_dual_allegiance", "assassinate_king", "install_prince", "intimidate_city", "welcome_rizhu",
            "intercept_tongpu",
        ):
            return ""

        if t == "comply_edict":
            if f != "han":
                return "仅汉方可执行奉诏"
            ed = v1["court"]["active_edict"]
            if not ed or ed.get("complied"):
                return "当前无待奉诏令"
            return ""

        if t == "bargain_edict":
            if f != "han":
                return "仅汉方可执行上书讨价"
            ed = v1["court"]["active_edict"]
            if not ed or ed.get("bargained"):
                return "当前诏令已讨价或无诏令"
            return ""

        if t == "forge_edict":
            if f != "han":
                return "仅汉方可执行持节矫诏"
            if v1["court"]["trust"] < 15.0:
                return "朝廷信任过低，诸将不敢从命矫诏"
            if v1["court"]["forged_bonus_ticks"] > 0:
                return "本季已行矫诏"
            return ""

        if t == "request_appropriation":
            if f != "han":
                return "仅汉方可执行上书请款"
            if state.turn - v1["court"]["last_appropriation_turn"] < 2:
                return "请款冷却中"
            if v1["court"]["trust"] < 25.0:
                return "朝廷信任不足以请款"
            return ""

        if t == "petition_protectorate":
            if f != "han":
                return "仅汉方可执行"
            if v1["victory"]["petition_boost_ticks"] > 0:
                return "已在奏请设立都护府"
            if money < 400 or v1["court"]["trust"] < 30.0:
                return "钱或信任不足"
            return ""

        if t == "dispatch_elite_envoy":
            if f != "han":
                return "仅汉方可派精使团"
            sid = cmd.get("state", "")
            if sid not in state.relations:
                return "目标城邦无效"
            cost = int(cmd.get("budget", 320))
            if money < cost:
                return "使团预算不足"
            if v1["diplomacy"]["elite_missions_this_quarter"] >= 2:
                return "本季精使团名额已满"
            return ""

        if t == "hire_mission":
            if f != "han":
                return "仅汉方可募使"
            sid = cmd.get("state", "")
            if sid not in state.relations:
                return "目标城邦无效"
            cost = int(cmd.get("budget", 150))
            if money < cost:
                return "募使资金不足"
            if v1["diplomacy"]["recruited_missions_this_quarter"] >= 3:
                return "本季募使批次已满"
            return ""

        if t == "accept_dual_allegiance":
            if f != "han":
                return "仅汉方可执行"
            sid = cmd.get("state", "")
            rel = state.relations.get(sid)
            if not rel or rel["overlord"] == "han" or rel.get("is_dual"):
                return "无需或已在两属"
            if rel["han_influence"] < 40.0 or rel["xn_resentment"] < 20.0:
                return "该国亲汉度或对匈怨恨尚未达两属条件"
            if money < 160:
                return "册封赐金不足"
            return ""

        if t == "assassinate_king":
            if f != "han":
                return "仅汉方可执行奇袭刺王"
            sid = cmd.get("state", "")
            rel = state.relations.get(sid)
            if not rel or rel["overlord"] == "han":
                return "目标已是汉属国"
            if rel.get("crimes_against_han", 0) <= 0 and v1["court"]["forged_bonus_ticks"] <= 0:
                return "需持有该国罪状或先行持节矫诏"
            if money < 240:
                return "奇袭经费不足"
            return ""

        if t == "build_tuntian":
            if f != "han":
                return "仅汉方可设西域屯田"
            nid = cmd.get("node", "")
            if nid not in state.nodes:
                return "节点无效"
            if v1["logistics"]["tuntian_nodes"].get(nid, 0) >= 3:
                return "屯田已达满级"
            if v1["court"]["luntai_edict_active"] and state.hops("dun_huang", nid, 9) > 3:
                return "轮台诏生效期间禁止在远距节点新辟屯田"
            n = state.nodes[nid]
            has_han_army = any(a["faction"] == "han" and state.army_size(a) >= 1500 for a in state.armies_at(nid))
            if state.controller(n) != "han" and not has_han_army:
                return "需汉方控制或驻有汉军方可开屯"
            if money < 260:
                return "开屯经费不足"
            return ""

        if t == "setup_supply_line":
            if f != "han":
                return "仅汉方可设补给线"
            return ""

        if t == "build_beacon":
            if f != "han":
                return "仅汉方可筑烽燧"
            nid = cmd.get("node", "")
            if nid not in state.nodes or nid in v1["logistics"]["beacons"]:
                return "该处已有烽燧或节点无效"
            if money < 180:
                return "筑燧经费不足"
            return ""

        if t == "recruit_convict":
            if f != "han":
                return "仅汉方可发七科谪"
            nid = cmd.get("node", "dun_huang")
            if nid not in state.nodes or state.nodes[nid]["faction"] != "han":
                return "须在汉直辖郡城发七科谪"
            if money < 180:
                return "安家口粮费不足"
            if v1["logistics"]["convicts_year"] >= 7500:
                return "本年七科谪征发已达上限"
            return ""

        if t == "welcome_rizhu":
            if f != "han":
                return "仅汉方可迎降日逐王"
            rz = v1["tribes"]["tribes"]["rizhu"]
            if rz["status"] == "defected_han":
                return "日逐王已归降"
            if state.turn < 14 or rz.get("surrender_window", 0) <= 0:
                return "日逐王尚未遣使请降"
            if state.relations.get("wu_lei", {}).get("overlord") != "han" and state.relations.get("lou_lan", {}).get("overlord") != "han":
                return "需先控制乌垒或楼兰方可出师迎降"
            return ""

        if t == "intercept_tongpu":
            if f != "han":
                return "仅汉方可截击僮仆都尉税队"
            if not v1["tribes"]["tongpu_active"]:
                return "僮仆都尉已罢废"
            if state.turn < 5 or state.turn - v1["tribes"].get("last_intercept_turn", -9) < 4:
                return "北道截击冷却中"
            if money < 220:
                return "出塞奇袭军费不足"
            has_west_force = any(
                a["faction"] == "han"
                and not a["is_convoy"]
                and state.army_size(a) >= 2500
                and a["loc"].get("node", "") in ("lou_lan", "wu_lei", "cheshi_qian", "wei_li", "dun_huang")
                for a in state.armies.values()
            )
            if not has_west_force:
                return "需在敦煌或西域前线驻有机动汉军方可出击北道税使"
            return ""

        if t == "distribute_rewards":
            if f != "xiongnu":
                return "仅匈奴单于可分赏诸部"
            amt = int(cmd.get("amount", 600))
            avail = money + v1["tribes"]["reward_pool"]
            if avail < amt or amt <= 0:
                return "赏赐池与王庭金不足"
            return ""

        if t == "play_tactical_card":
            if f != "xiongnu":
                return "仅匈奴可使用草原战术卡"
            if v1["tribes"]["tactical_card_ticks"] > 0:
                return "本季已激活战术卡"
            return ""

        if t == "intimidate_city":
            if f != "xiongnu":
                return "仅匈奴可执行威压"
            sid = cmd.get("state", "")
            if sid not in state.relations:
                return "目标城邦无效"
            if not v1["tribes"]["tongpu_active"] and money < 150:
                return "僮仆都尉不在位且经费不足"
            return ""

        if t == "install_prince":
            if f != "xiongnu":
                return "仅匈奴可执行废立亲匈王子"
            sid = cmd.get("state", "")
            rel = state.relations.get(sid)
            if not rel or rel["overlord"] == "xiongnu":
                return "目标已是匈奴属国"
            if rel["xn_intimidation"] < 42.0 or money < 350:
                return "威吓不足或资金不足(需350金)"
            return ""

        if t == "pacify_tribe":
            if f != "xiongnu":
                return "仅匈奴可抚慰部族"
            tid = cmd.get("tribe", "rizhu")
            if tid not in v1["tribes"]["tribes"]:
                return "未知部族"
            if state.turn - v1["tribes"].get("last_pacify_turn", -9) < 5:
                return "抚慰专使冷却中"
            if money + v1["tribes"]["reward_pool"] < 220:
                return "资金不足"
            return ""

        return None

    def apply_command(self, state, cmd):
        v1 = state.ext.get("v1")
        if not v1:
            return False
        t = cmd.get("type", "")
        s04 = v1["cfg"]["s04"]

        if t == "enfeoff":
            sid = cmd.get("state", "")
            if economy.can_enfeoff(state, sid) == "":
                economy.enfeoff(state, sid)
                state.relations[sid]["han_enfeoffed"] = True
            return True

        if t == "make_vassal":
            sid = cmd.get("state", "")
            if economy.can_vassal(state, sid) == "":
                economy.make_vassal(state, sid)
                v1["tribes"]["chanyu_prestige"] = _clamp(v1["tribes"]["chanyu_prestige"] - 1.5, 0.0, 100.0)
            return True

        if t == "demand_vassal":
            sid = cmd.get("state", "")
            if economy.can_demand(state, sid) == "":
                economy.demand_vassal(state, sid)
            return True

        if t == "recruit":
            if commands._v_recruit(state, cmd) == "":
                return False  # 交由基线 commands.apply 执行
            return True  # WEGO 同回合城邦易主时幂等忽略

        if t == "load":
            a = state.armies.get(cmd.get("army"))
            if a and "node" in a["loc"] and state.is_supply_node(state.nodes[a["loc"]["node"]], cmd.get("faction", "")):
                return False
            return True

        if t == "set_tax":
            sid = cmd.get("state", "")
            if sid in state.relations and state.relations[sid]["overlord"] == "xiongnu" and 0 <= int(cmd.get("level", 1)) <= 3:
                return False
            return True

        if t == "convoy":
            n = state.nodes.get(cmd.get("from"))
            if n and state.is_supply_node(n, "han"):
                avail = int(n["pop"] * state.bal["han"]["laborer_levy_ratio"]) - n["levied_out"]
                if cmd.get("laborers", 0) <= avail or n["type"] == "source":
                    return False
            return True

        if t == "comply_edict":
            ed = v1["court"]["active_edict"]
            if ed:
                ed["complied"] = True
                v1["court"]["trust"] = _clamp(v1["court"]["trust"] + 1.5, 0.0, 100.0)
                state.log_event("diplomacy", "汉使奉诏行事：【%s】（朝廷信任 +1.5）" % ed["title"])
            return True

        if t == "bargain_edict":
            ed = v1["court"]["active_edict"]
            if ed:
                ed["bargained"] = True
                ed["deadline_turn"] += 2
                v1["court"]["in_transit_docs"].append({
                    "kind": "bargain_grant",
                    "title": "朝廷准奏宽限期并拨付转输费",
                    "eta_days": 16.0,
                    "money": 350,
                    "trust": 2.5,
                })
                state.log_event("diplomacy", "汉使上书陈情便宜从事，驿骑飞驰长安")
            return True

        if t == "forge_edict":
            tgt = cmd.get("target", "cheshi_qian")
            self_imp = bool(cmd.get("self_impeach", True))
            cost_trust = float(v1["cfg"]["s02"].get("forge_self_impeach_cost", 7.0)) if self_imp else float(v1["cfg"]["s02"].get("forge_raw_cost", 15.0))
            v1["court"]["trust"] = _clamp(v1["court"]["trust"] - cost_trust, 0.0, 100.0)
            v1["court"]["precedent"] = _clamp(v1["court"]["precedent"] + 12.0, 0.0, 100.0)
            v1["court"]["forged_count"] += 1
            v1["court"]["forged_target"] = tgt
            v1["court"]["forged_bonus_ticks"] = 9
            if not self_imp:
                v1["court"]["unpardoned_forged_edict"] = True
            record_key_event(state, "jiaozhao")
            state.log_event(
                "diplomacy",
                "汉使持节矫诏便宜发兵奇袭 %s（%s，信任 -%.0f）"
                % (tgt, "附奏自劾" if self_imp else "秘而不宣", cost_trust),
            )
            return True

        if t == "request_appropriation":
            v1["court"]["last_appropriation_turn"] = state.turn
            v1["court"]["trust"] = _clamp(v1["court"]["trust"] - 2.0, 0.0, 100.0)
            v1["court"]["in_transit_docs"].append({
                "kind": "appropriation",
                "title": "大司农急拨边防军资与官马",
                "eta_days": 18.0,
                "money": 650,
                "horses": 900,
            })
            state.log_event("economy", "汉使上书请款请骑，长安驿使在途")
            return True

        if t == "petition_protectorate":
            state.factions["han"]["money"] = max(0, state.factions["han"]["money"] - 400)
            v1["court"]["trust"] = _clamp(v1["court"]["trust"] - 2.5, 0.0, 100.0)
            v1["victory"]["petition_boost_ticks"] = 27
            state.log_event("diplomacy", "汉使上书奏请设立西域都护府（功业临时加成 +10，维持 3 季）")
            return True

        if t == "dispatch_elite_envoy":
            sid = cmd["state"]
            budget = int(cmd.get("budget", 320))
            state.factions["han"]["money"] = max(0, state.factions["han"]["money"] - budget)
            v1["diplomacy"]["elite_missions_this_quarter"] += 1
            rel = state.relations[sid]
            max_gain = float(s04.get("gift_max_gain", 22.0))
            scale = float(s04.get("gift_budget_scale", 520.0))
            sat = int(rel.get("satiation", 0))
            gain = max_gain * (1.0 - math.exp(-budget / scale)) * 1.18 * (0.78 ** sat)
            rel["han_influence"] = _clamp(rel["han_influence"] + gain, 0.0, 100.0)
            rel["xn_intimidation"] = _clamp(rel["xn_intimidation"] - gain * 0.25, 0.0, 100.0)
            rel["satiation"] = sat + 1
            if rel["han_influence"] >= 58.0 and not rel.get("hostage_sent_han", False):
                rel["hostage_sent_han"] = True
                if sid not in v1["victory"]["hostage_states"]:
                    v1["victory"]["hostage_states"].append(sid)
                    self._add_han_event_merit(state, 2.0, "%s遣质子入侍长安" % state.factions[sid]["name"])
            if sid == "wu_sun" and rel["han_influence"] >= 55.0 and not v1["events"]["wusun_married"]:
                self._trigger_wusun_marriage(state)
            elif sid == "da_wan" and rel["han_influence"] >= 55.0 and not v1["events"]["dawan_horses_obtained"]:
                self._trigger_dawan_horses(state)
            state.log_event(
                "diplomacy",
                "汉遣精使团持节出使 %s（预算 %d 金，亲汉度 +%.1f -> %.0f）"
                % (state.factions[sid]["name"], budget, gain, rel["han_influence"]),
                {"state": sid},
            )
            return True

        if t == "hire_mission":
            sid = cmd["state"]
            budget = int(cmd.get("budget", 150))
            state.factions["han"]["money"] = max(0, state.factions["han"]["money"] - budget)
            v1["diplomacy"]["recruited_missions_this_quarter"] += 1
            rel = state.relations[sid]
            embezzle = float(s04.get("recruited_embezzle_rate", 0.30))
            eff_budget = budget * (1.0 - embezzle)
            sat = int(rel.get("satiation", 0))
            gain = 14.0 * (1.0 - math.exp(-eff_budget / 380.0)) * (0.75 ** sat)
            rel["han_influence"] = _clamp(rel["han_influence"] + gain, 0.0, 100.0)
            rel["satiation"] = sat + 1
            insult_prob = _clamp(0.18 + (rel["xn_intimidation"] - rel["han_influence"]) * float(s04.get("insult_diff_slope", 0.006)), 0.05, 0.65)
            if rel["overlord"] != "han" and state.rng.random() < insult_prob:
                rel["crimes_against_han"] = int(rel.get("crimes_against_han", 0)) + 1
                v1["diplomacy"]["insults_recorded"] += 1
                state.log_event(
                    "diplomacy",
                    "募使于 %s 遭凌辱扣留，汉获合法讨伐罪状（可名正言顺兴师问罪）" % state.factions[sid]["name"],
                    {"state": sid},
                )
            else:
                state.log_event(
                    "diplomacy",
                    "汉遣募使携币往 %s 通好（亲汉度 +%.1f）" % (state.factions[sid]["name"], gain),
                    {"state": sid},
                )
            return True

        if t == "accept_dual_allegiance":
            sid = cmd["state"]
            rel = state.relations.get(sid)
            if not rel or rel["overlord"] == "han" or rel.get("is_dual") or state.factions["han"]["money"] < 160:
                return True
            state.factions["han"]["money"] = max(0, state.factions["han"]["money"] - 160)
            rel["is_dual"] = True
            rel["han_enfeoffed"] = True
            rel["han_status"] = "enfeoffed"
            rel["han_influence"] = _clamp(rel["han_influence"] + 8.0, 0.0, 100.0)
            v1["diplomacy"]["dual_states_count"] += 1
            state.log_event(
                "diplomacy",
                "%s 遣使请为两属，受汉印绶并开关互市" % state.factions[sid]["name"],
                {"state": sid},
            )
            return True

        if t == "assassinate_king":
            sid = cmd["state"]
            rel = state.relations.get(sid)
            if not rel or rel["overlord"] == "han" or state.factions["han"]["money"] < 240:
                return True
            state.factions["han"]["money"] = max(0, state.factions["han"]["money"] - 240)
            nm = state.factions[sid]["name"]
            rel["overlord"] = "han"
            rel["han_enfeoffed"] = True
            rel["han_status"] = "enfeoffed"
            rel["is_dual"] = False
            rel["han_influence"] = max(rel["han_influence"], 68.0)
            rel["xn_intimidation"] = max(0.0, rel["xn_intimidation"] - 28.0)
            rel["crimes_against_han"] = 0
            if sid not in v1["victory"]["punished_states"]:
                v1["victory"]["punished_states"].append(sid)
                self._add_han_event_merit(state, 4.0, "奇袭斩%s亲匈之王、更立亲汉新王" % nm)
            v1["court"]["trust"] = _clamp(v1["court"]["trust"] + 5.0, 0.0, 100.0)
            v1["tribes"]["chanyu_prestige"] = _clamp(v1["tribes"]["chanyu_prestige"] - 3.5, 0.0, 100.0)
            v1["events"]["loulan_king_slain"] = True
            record_key_event(state, "king_slain")
            state.log_event(
                "capture",
                "傅介子持节奇袭 %s，斩其亲匈国主，立质子为亲汉新王！诸国震骇" % nm,
                {"state": sid},
            )
            return True

        if t == "build_tuntian":
            nid = cmd["node"]
            if nid not in state.nodes or v1["logistics"]["tuntian_nodes"].get(nid, 0) >= 3 or state.factions["han"]["money"] < 260:
                return True
            n = state.nodes[nid]
            has_han_army = any(a["faction"] == "han" and state.army_size(a) >= 1500 for a in state.armies_at(nid))
            if state.controller(n) != "han" and not has_han_army:
                return True
            state.factions["han"]["money"] = max(0, state.factions["han"]["money"] - 260)
            lv = v1["logistics"]["tuntian_nodes"].get(nid, 0) + 1
            v1["logistics"]["tuntian_nodes"][nid] = lv
            n["colonies"] = n.get("colonies", 0) + 1500
            state.set_stock(n, "han", state.stock(n, "han") + 18000.0)
            for nb in state.neighbors(nid):
                sid = state.nodes[nb]["faction"]
                if sid in state.relations and state.relations[sid]["overlord"] == "xiongnu":
                    v1["logistics"]["tuntian_pressure"][sid] = v1["logistics"]["tuntian_pressure"].get(sid, 0.0) + 12.0
            state.log_event("economy", "汉于 %s 开渠设第 %d 级军屯（储粮 +18,000 斛）" % (n["name"], lv), {"node": nid})
            return True

        if t == "setup_supply_line":
            prio = int(cmd.get("priority", 2))
            hub = cmd.get("forward_hub", "dun_huang")
            v1["logistics"]["supply_priority"] = _clamp(prio, 1, 3)
            v1["logistics"]["forward_hub"] = hub
            state.log_event("economy", "调整河西—西域自动转输补给线（优先级 %d，前推枢纽 %s）" % (prio, hub))
            return True

        if t == "build_beacon":
            nid = cmd["node"]
            if nid not in v1["logistics"]["beacons"]:
                state.factions["han"]["money"] = max(0, state.factions["han"]["money"] - 180)
                v1["logistics"]["beacons"].append(nid)
                n = state.nodes[nid]
                n["wall_hp_max"] += 150.0
                n["wall_hp"] = min(n["wall_hp_max"], n["wall_hp"] + 150.0)
                state.log_event("economy", "于 %s 修筑塞外烽燧亭障（视野精度提升，城防巩固）" % n["name"], {"node": nid})
            return True

        if t == "recruit_convict":
            nid = cmd.get("node", "dun_huang")
            cnt = int(cmd.get("count", 2500))
            state.factions["han"]["money"] = max(0, state.factions["han"]["money"] - 180)
            v1["logistics"]["convicts_year"] += cnt
            a = state.new_army("han", nid, {"infantry": cnt, "crossbow": 500}, 0, cnt * 6.0, 800)
            state.apply_preset(a, "balanced")
            a["is_convict"] = True
            a["name"] = "驰刑士" + a["id"].split("_")[-1]
            state.log_event("recruit", "汉于 %s 征发七科谪罪人兵 %d 人充边" % (state.nodes[nid]["name"], cnt + 500))
            return True

        if t == "welcome_rizhu":
            rz = v1["tribes"]["tribes"]["rizhu"]
            if rz["status"] != "defected_han":
                if rz.get("surrender_window", 0) > 0:
                    self._execute_rizhu_surrender(state)
                else:
                    self._add_han_event_merit(state, 2.0, "遣军乌垒接应北道异动")
                    state.log_event("diplomacy", "汉遣军赴乌垒接应日逐王，然单于重币安抚先至，汉军耀兵北道而还（战功 +2）")
            return True

        if t == "intercept_tongpu":
            if (
                not v1["tribes"]["tongpu_active"]
                or state.factions["han"]["money"] < 220
                or state.turn - v1["tribes"].get("last_intercept_turn", -9) < 4
            ):
                return True
            state.factions["han"]["money"] = max(0, state.factions["han"]["money"] - 220)
            v1["tribes"]["last_intercept_turn"] = state.turn
            v1["tribes"]["tongpu_intercept_hits"] += 1
            loot = 280
            state.factions["han"]["money"] += loot
            v1["tribes"]["reward_pool"] = max(0, v1["tribes"]["reward_pool"] - 180)
            v1["tribes"]["chanyu_prestige"] = _clamp(v1["tribes"]["chanyu_prestige"] - 3.5, 0.0, 100.0)
            v1["tribes"]["tribes"]["rizhu"]["grievance"] += 8.0
            self._add_han_event_merit(state, 2.5, "北道截击匈奴僮仆都尉岁币税队")
            for sid in NORTH_HUB_STATES:
                if sid in state.relations:
                    state.relations[sid]["xn_intimidation"] = max(0.0, state.relations[sid]["xn_intimidation"] - 4.0)
            if v1["tribes"]["tongpu_intercept_hits"] >= 5:
                v1["tribes"]["tongpu_active"] = False
                record_key_event(state, "tongpu_crushed")
                state.log_event("battle", "汉军屡破僮仆都尉护卫骑，唯涂耆败走，西域僮仆赋税瘫痪！")
            else:
                state.log_event("battle", "汉军精骑出击北道，截获僮仆都尉在途岁币 %d 金！" % loot)
            return True

        if t == "distribute_rewards":
            amt = int(cmd.get("amount", 600))
            mode = cmd.get("mode", "equal")
            pool_use = min(v1["tribes"]["reward_pool"], amt)
            v1["tribes"]["reward_pool"] -= pool_use
            rem = amt - pool_use
            if rem > 0:
                state.factions["xiongnu"]["money"] = max(0, state.factions["xiongnu"]["money"] - rem)
            tribes = v1["tribes"]["tribes"]
            active_t = [tk for tk, tv in tribes.items() if tv["status"] != "defected_han"]
            if active_t:
                for tk in active_t:
                    tv = tribes[tk]
                    mult = 1.0
                    griev_clear = 0.70
                    if mode == "favor_east" and tk in ("zuoxian", "youxian"):
                        mult = 1.35
                    elif mode == "favor_east" and tk in ("rizhu", "lihu"):
                        mult = 0.55
                        griev_clear = 0.0
                    elif mode == "favor_west" and tk in ("rizhu", "lihu"):
                        mult = 1.35
                        griev_clear = 0.90
                    elif mode == "equal" and tk == "rizhu":
                        mult = 0.55
                        griev_clear = 0.12
                    gain = (amt / float(len(active_t))) / max(100.0, float(tv["expect"])) * 9.0 * mult
                    tv["loyalty"] = _clamp(tv["loyalty"] + gain, 0.0, 100.0)
                    tv["grievance"] = max(0.0, tv.get("grievance", 0.0) - gain * griev_clear)
                if mode == "favor_east" and "rizhu" in active_t:
                    tribes["rizhu"]["loyalty"] = max(0.0, tribes["rizhu"]["loyalty"] - 7.0)
                    tribes["rizhu"]["grievance"] += 14.0
            v1["tribes"]["chanyu_prestige"] = _clamp(v1["tribes"]["chanyu_prestige"] + 1.5, 0.0, 100.0)
            state.log_event("economy", "单于庭大会分赏诸王 %d 金（模式：%s）" % (amt, mode))
            return True

        if t == "play_tactical_card":
            card = cmd.get("card", "feigned_retreat")
            v1["tribes"]["active_tactical_card"] = card
            v1["tribes"]["tactical_card_ticks"] = 9
            if card == "raze_beacons":
                if len(v1["logistics"]["beacons"]) > 2:
                    removed = v1["logistics"]["beacons"].pop()
                    v1["tribes"]["reward_pool"] += 60
                    state.log_event("raid", "匈奴轻骑施展【拔亭障】，拔毁 %s 汉军烽燧！" % state.nodes[removed]["name"])
                    return True
            state.log_event("ai", "匈奴单于庭激活季度战术卡：【%s】" % card)
            return True

        if t == "intimidate_city":
            sid = cmd["state"]
            rel = state.relations.get(sid)
            if not rel:
                return True
            if not v1["tribes"]["tongpu_active"]:
                if state.factions["xiongnu"]["money"] < 150:
                    return True
                state.factions["xiongnu"]["money"] = max(0, state.factions["xiongnu"]["money"] - 150)
            rel["xn_intimidation"] = _clamp(rel["xn_intimidation"] + 14.0, 0.0, 100.0)
            rel["xn_resentment"] = _clamp(rel["xn_resentment"] + 4.0, 0.0, 100.0)
            if rel["xn_intimidation"] > rel["han_influence"] + 8.0 and rel["overlord"] != "xiongnu":
                rel["overlord"] = "xiongnu"
                rel["is_dual"] = False
            state.log_event("diplomacy", "僮仆都尉铁骑巡行威压 %s（威吓 +14）" % state.factions[sid]["name"], {"state": sid})
            return True

        if t == "install_prince":
            sid = cmd["state"]
            rel = state.relations.get(sid)
            if not rel or rel["overlord"] == "xiongnu" or state.factions["xiongnu"]["money"] < 350:
                return True
            state.factions["xiongnu"]["money"] = max(0, state.factions["xiongnu"]["money"] - 350)
            rel["overlord"] = "xiongnu"
            rel["is_dual"] = False
            rel["han_status"] = "none"
            rel["han_enfeoffed"] = False
            rel["xn_intimidation"] = max(rel["xn_intimidation"], 68.0)
            rel["xn_resentment"] = _clamp(rel["xn_resentment"] + 12.0, 0.0, 100.0)
            rel["crimes_against_han"] = int(rel.get("crimes_against_han", 0)) + 1
            self._add_xn_event_weifu(state, 3.0)
            state.log_event(
                "diplomacy",
                "匈奴于 %s 废立亲匈王子（归属转匈奴，汉获合法讨伐罪状）" % state.factions[sid]["name"],
                {"state": sid},
            )
            return True

        if t == "pacify_tribe":
            tid = cmd.get("tribe", "rizhu")
            if state.turn - v1["tribes"].get("last_pacify_turn", -9) < 5:
                return True
            v1["tribes"]["last_pacify_turn"] = state.turn
            pool_use = min(v1["tribes"]["reward_pool"], 220)
            v1["tribes"]["reward_pool"] -= pool_use
            if 220 - pool_use > 0:
                state.factions["xiongnu"]["money"] = max(0, state.factions["xiongnu"]["money"] - (220 - pool_use))
            tb = v1["tribes"]["tribes"][tid]
            tb["loyalty"] = _clamp(tb["loyalty"] + 11.0, 0.0, 100.0)
            tb["grievance"] = max(0.0, tb.get("grievance", 0.0) - 11.0)
            if tb.get("surrender_window", 0) > 0 and tb.get("grievance", 0.0) < 62.0:
                tb["surrender_window"] = 0
                if tb["status"] == "wavering":
                    tb["status"] = "normal"
            state.log_event("diplomacy", "单于遣贵人赐金安抚 %s（忠诚恢复至 %.0f）" % (tb["name"], tb["loyalty"]))
            return True

        return False

    def legal_commands(self, state, faction):
        """枚举 v1 新规则下的合法命令，供 CLI 试玩与 L12 决策密度采样。"""
        v1 = state.ext.get("v1")
        if not v1:
            return []
        out = []
        if faction == "han":
            for c in (
                commands.make("comply_edict", "han"),
                commands.make("bargain_edict", "han"),
                commands.make("request_appropriation", "han"),
                commands.make("welcome_rizhu", "han"),
                commands.make("intercept_tongpu", "han"),
                commands.make("petition_protectorate", "han"),
            ):
                if self.validate_command(state, c) == "":
                    out.append(c)

            for sid in ("lou_lan", "wu_lei", "cheshi_qian", "yan_qi", "qiu_ci", "yu_tian", "wu_sun", "da_wan"):
                if sid not in state.relations:
                    continue
                for c in (
                    commands.make("dispatch_elite_envoy", "han", {"state": sid, "budget": 320}),
                    commands.make("hire_mission", "han", {"state": sid, "budget": 150}),
                    commands.make("accept_dual_allegiance", "han", {"state": sid}),
                    commands.make("assassinate_king", "han", {"state": sid}),
                ):
                    if self.validate_command(state, c) == "":
                        out.append(c)

            for nid in ("dun_huang", "lou_lan", "wu_lei", "wei_li", "cheshi_qian"):
                c_tt = commands.make("build_tuntian", "han", {"node": nid})
                if self.validate_command(state, c_tt) == "":
                    out.append(c_tt)

            for nid in ("ju_yan", "lou_lan", "wu_lei"):
                c_bc = commands.make("build_beacon", "han", {"node": nid})
                if self.validate_command(state, c_bc) == "":
                    out.append(c_bc)

            c_cv = commands.make("recruit_convict", "han", {"node": "dun_huang", "count": 2500})
            if self.validate_command(state, c_cv) == "":
                out.append(c_cv)

        elif faction == "xiongnu":
            for c in (
                commands.make("distribute_rewards", "xiongnu", {"amount": 600, "mode": "equal"}),
                commands.make("pacify_tribe", "xiongnu", {"tribe": "rizhu"}),
                commands.make("play_tactical_card", "xiongnu", {"card": "feigned_retreat"}),
                commands.make("play_tactical_card", "xiongnu", {"card": "scorched_earth"}),
                commands.make("play_tactical_card", "xiongnu", {"card": "clear_steppe"}),
            ):
                if self.validate_command(state, c) == "":
                    out.append(c)

            for sid in ("lou_lan", "cheshi_qian", "yan_qi", "wu_lei", "qiu_ci"):
                if sid not in state.relations:
                    continue
                for c in (
                    commands.make("intimidate_city", "xiongnu", {"state": sid}),
                    commands.make("install_prince", "xiongnu", {"state": sid}),
                ):
                    if self.validate_command(state, c) == "":
                        out.append(c)
        return out

    # ------------------------------------------------------------------
    # 回合、子步、月度与季度生命周期钩子
    # ------------------------------------------------------------------
    def on_turn_start(self, state):
        v1 = state.ext.get("v1")
        if not v1:
            return
        v1["in_turn_resolve"] = True
        v1["diplomacy"]["recruited_missions_this_quarter"] = 0
        v1["diplomacy"]["elite_missions_this_quarter"] = 0
        v1["events"]["seen_event_idx"] = 0
        v1["court"]["starve_pen_this_turn"] = 0

    def on_substep(self, state, days):
        v1 = state.ext.get("v1")
        if not v1:
            return
        v1["in_turn_resolve"] = False
        docs = v1["court"]["in_transit_docs"]
        still = []
        for doc in docs:
            doc["eta_days"] -= days
            if doc["eta_days"] <= 0:
                if doc.get("money", 0) > 0:
                    state.factions["han"]["money"] += int(doc["money"])
                if doc.get("horses", 0) > 0:
                    state.han_horse_pool = getattr(state, "han_horse_pool", 0) + int(doc["horses"])
                if doc.get("trust", 0.0) != 0.0:
                    v1["court"]["trust"] = _clamp(v1["court"]["trust"] + float(doc["trust"]), 0.0, 100.0)
                state.log_event("economy", "【驿传抵达】%s" % doc["title"])
            else:
                still.append(doc)
        v1["court"]["in_transit_docs"] = still

        # S05 自动化补给线子步随军补粮（防止行军途中在月度结算前意外断粮）
        prio = v1["logistics"]["supply_priority"]
        if prio >= 1:
            for a in state.armies.values():
                if a["faction"] != "han" or a["is_convoy"]:
                    continue
                need_m = supply.need_per_month(state, a)
                if a["grain"] < need_m * 0.9:
                    topup = min(supply.carry_cap(state, a) - a["grain"], need_m * 0.9)
                    if topup > 0:
                        a["grain"] += topup
                        a["starving"] = 0

        evs = state.events
        start_idx = v1["events"].get("seen_event_idx", 0)
        for e in evs[start_idx:]:
            self._on_engine_event(state, e)
        v1["events"]["seen_event_idx"] = len(evs)

    def on_month_end(self, state):
        v1 = state.ext.get("v1")
        if not v1:
            return
        s04 = v1["cfg"]["s04"]
        s05 = v1["cfg"]["s05"]

        # 1) S04 外交软禁商渗漏（楼兰/车师虽禁商，仍有 30% 走私商税与影响力渗透）
        leak_rate = float(s04.get("ban_leak_throughput", 0.30))
        if leak_rate > 0:
            leak_money = int(round(6.0 * leak_rate * 28.0))
            if v1["logistics"]["convicts_year"] > 5000:
                leak_money = int(round(leak_money * 0.85))
            state.factions["han"]["money"] += leak_money
            v1["diplomacy"]["trade_leak_income"] += leak_money
            for sid in ("lou_lan", "wu_lei", "wei_li", "yu_tian"):
                if sid in state.relations and state.relations[sid]["overlord"] != "han":
                    state.relations[sid]["han_influence"] = _clamp(
                        state.relations[sid]["han_influence"] + 0.35, 0.0, 100.0
                    )

        # 2) S03/S04 僮仆都尉北道威吓保底线 & 两属城邦(is_dual)维护
        if v1["tribes"]["tongpu_active"]:
            floor_val = float(s04.get("tongpu_intimidation_floor", 26.0))
            for sid in ("cheshi_qian", "cheshi_hou", "yan_qi", "dong_qiemi"):
                rel = state.relations.get(sid)
                if rel and rel["overlord"] == "xiongnu":
                    rel["xn_intimidation"] = max(rel["xn_intimidation"], floor_val)

        for sid, rel in state.relations.items():
            if rel.get("is_dual"):
                if rel["overlord"] == "han":
                    rel["is_dual"] = False
                else:
                    rel["han_enfeoffed"] = True
            if rel.get("han_status") == "enfeoffed":
                rel["han_enfeoffed"] = True

        # 3) S05 自动化补给线转输 & 西域军屯就地生粮 & 沿途城邦供粮
        self._tick_automated_supply_and_tuntian(state, s05)

        # 4) 岁首马匹池补充与统计重置
        if state.month() == 1:
            regen = int(s05.get("horse_pool_yearly_regen", 1800))
            state.han_horse_pool = min(20000, getattr(state, "han_horse_pool", 0) + regen)
            v1["victory"]["yearly_battle_awards"] = 0
            v1["logistics"]["convicts_year"] = 0

        # 5) 递减临时状态计时器
        if v1["victory"]["petition_boost_ticks"] > 0:
            v1["victory"]["petition_boost_ticks"] = max(0, v1["victory"]["petition_boost_ticks"] - 3)
        if v1["court"]["forged_bonus_ticks"] > 0:
            v1["court"]["forged_bonus_ticks"] = max(0, v1["court"]["forged_bonus_ticks"] - 3)
        if v1["tribes"]["tactical_card_ticks"] > 0:
            v1["tribes"]["tactical_card_ticks"] = max(0, v1["tribes"]["tactical_card_ticks"] - 3)
            if v1["tribes"]["tactical_card_ticks"] == 0:
                v1["tribes"]["active_tactical_card"] = ""

    def on_quarter_end(self, state):
        v1 = state.ext.get("v1")
        if not v1:
            return
        s01 = v1["cfg"]["s01"]
        s02 = v1["cfg"]["s02"]
        s03 = v1["cfg"]["s03"]
        s06 = v1["cfg"]["s06"]

        # 1) S01 事件战功池季度指数衰减
        decay = float(s01.get("pool_quarterly_decay", 0.10))
        hp = v1["victory"]["han_merit_pool"] * (1.0 - decay)
        v1["victory"]["han_merit_pool"] = 0.0 if abs(hp) < 0.5 else round(hp, 1)
        xp = v1["victory"]["xn_event_pool"] * (1.0 - decay)
        v1["victory"]["xn_event_pool"] = 0.0 if abs(xp) < 0.5 else round(xp, 1)

        # 2) S02 汉廷季度拨款、中央军补充与诏令考核
        trust = v1["court"]["trust"]
        if trust >= 80.0:
            t_mult = 1.15
        elif trust >= 50.0:
            t_mult = 1.00
        elif trust >= 25.0:
            t_mult = 0.80
        else:
            t_mult = 0.60
        q_base = float(s02.get("quarterly_base_money", 1250.0))
        alloc = int(round(q_base * t_mult))
        state.factions["han"]["money"] += alloc
        for ut, yearly_v in state.bal["han"]["central_regen_year"].items():
            cap = int(state.bal["han"]["central_cap"][ut])
            state.central[ut] = min(cap, int(state.central.get(ut, 0)) + int(yearly_v // 4))

        self._check_and_rotate_edict(state)

        # 3) S04 使团饱足度季度衰减
        for rel in state.relations.values():
            rel["satiation"] = max(0, int(rel.get("satiation", 0)) - 1)

        # 4) S03 匈奴四部忠诚度、结构性赤字与三次年会结算
        self._tick_xiongnu_confederation_quarterly(state, s03)

        # 5) S06 中期重大历史事件配额检定
        self._tick_historical_events_quarterly(state, s06)

    def victory_check(self, state):
        """S01-R01 ~ S01-R07 完整月度胜负与政治崩盘裁决。"""
        v1 = state.ext.get("v1")
        if not v1:
            return False
        s01 = v1["cfg"]["s01"]
        vic = v1["victory"]
        court = v1["court"]
        tribes = v1["tribes"]

        state.stats["han_vassals_peak"] = max(state.stats["han_vassals_peak"], victory.han_vassals(state))
        G, W = self._update_merit_and_weifu(state)

        # Step 1: 更新维持月数（月度滞回缓冲 hold_fail_decrement = 1）
        han_req = float(s01.get("han_threshold", 101.0))
        min_trust = float(s01.get("min_trust_for_protectorate", 28.0))
        fail_dec = int(s01.get("hold_fail_decrement", 1))
        hexi_lost_now = sum(1 for nid in HEXI_FOUR if state.nodes[nid]["faction"] != "han")
        dh_held = (state.nodes.get("dun_huang", {}).get("faction") == "han")
        n_han_vassal_now = victory.han_vassals(state)

        if (
            G >= han_req
            and n_han_vassal_now >= int(s01.get("min_vassals_for_protectorate", 6))
            and court["trust"] >= min_trust
            and not court["recall_active"]
            and hexi_lost_now == 0
            and dh_held
        ):
            vic["han_hold_months"] += 1
        else:
            vic["han_hold_months"] = max(0, vic["han_hold_months"] - fail_dec)

        hexi_xn_now = sum(1 for nid in HEXI_FOUR if state.nodes[nid]["faction"] == "xiongnu")
        if hexi_xn_now >= 2 or (hexi_xn_now >= 1 and W >= 95.0):
            vic["xn_hexi_hold_months"] += (2 if hexi_xn_now >= 2 else 1)
        else:
            vic["xn_hexi_hold_months"] = max(0, vic["xn_hexi_hold_months"] - fail_dec)

        xn_req = float(s01.get("xn_threshold", 97.5))
        min_prest = float(s01.get("min_prestige_for_weifu", 38.0))
        months_elapsed = state.tick // 3 + 1
        if W >= xn_req and tribes["chanyu_prestige"] >= min_prest and months_elapsed >= 15:
            vic["xn_weifu_hold_months"] += 1
        else:
            vic["xn_weifu_hold_months"] = max(0, vic["xn_weifu_hold_months"] - fail_dec)

        # Step 2: 检定提前政治崩盘 (HAN_RECALL / XN_SCATTER)
        f_han = bool(court["recall_finalized"] or (hexi_xn_now >= 3 and court["trust"] <= 16.0))
        f_xn = bool(
            tribes["scatter_consecutive_turns"] >= int(s01.get("xn_scatter_quarters", 2))
            or tribes["chanyu_prestige"] <= float(s01.get("xn_instant_collapse_prestige", 12.0))
        )

        han_hold_req = int(s01.get("han_hold_months_required", 14))
        xn_hexi_req = int(s01.get("xn_hexi_hold_months", 14))
        xn_weifu_req = int(s01.get("xn_weifu_hold_months", 11))

        # 终局宽限期规则（S01-R01 Step 6）
        han_main_met = (vic["han_hold_months"] >= han_hold_req) or (
            months_elapsed >= state.max_turns
            and G >= han_req
            and n_han_vassal_now >= int(s01.get("min_vassals_for_protectorate", 6))
            and vic["han_hold_months"] >= 10
            and hexi_lost_now == 0
        )
        xn_hexi_met = vic["xn_hexi_hold_months"] >= xn_hexi_req
        xn_weifu_met = (vic["xn_weifu_hold_months"] >= xn_weifu_req) or (
            months_elapsed >= state.max_turns and W >= xn_req and vic["xn_weifu_hold_months"] >= 8
        )

        if f_han and not f_xn:
            state.winner = "xiongnu"
            state.win_kind = "han_recall"
            vic["end_type"] = "HAN_RECALL"
            self._finalize_endgame(state, "廷尉槛车征还汉使（政治崩盘）")
            return True

        if f_xn and not f_han:
            state.winner = "han"
            state.win_kind = "xn_scatter"
            vic["end_type"] = "XN_SCATTER"
            self._finalize_endgame(state, "匈奴单于威望崩解·诸部离散")
            return True

        if han_main_met and (xn_hexi_met or xn_weifu_met):
            r_han = G / max(1.0, han_req)
            r_xn = max(W / max(1.0, xn_req), 1.15 if xn_hexi_met else 0.0)
            if r_han >= r_xn:
                state.winner = "han"
                state.win_kind = "han_main"
                vic["end_type"] = "HAN_MAIN"
                self._finalize_endgame(state, "设立西域都护府")
            else:
                state.winner = "xiongnu"
                state.win_kind = "xn_main"
                vic["end_type"] = "XN_MAIN_HEXI" if xn_hexi_met else "XN_MAIN_WEIFU"
                self._finalize_endgame(state, "饮马河西·夺回河西四郡" if xn_hexi_met else "百蛮震服·威服西域")
            return True

        if han_main_met:
            state.winner = "han"
            state.win_kind = "han_main"
            vic["end_type"] = "HAN_MAIN"
            self._finalize_endgame(state, "设立西域都护府")
            return True

        if xn_hexi_met:
            state.winner = "xiongnu"
            state.win_kind = "xn_main"
            vic["end_type"] = "XN_MAIN_HEXI"
            self._finalize_endgame(state, "饮马河西·夺回河西四郡")
            return True

        if xn_weifu_met:
            state.winner = "xiongnu"
            state.win_kind = "xn_main"
            vic["end_type"] = "XN_MAIN_WEIFU"
            self._finalize_endgame(state, "百蛮震服·威服西域")
            return True

        if months_elapsed >= state.max_turns or (f_han and f_xn):
            sc = self._compute_continuous_expiry_scores(state)
            state.final_score = sc
            diff = sc["han"] - sc["xiongnu"]
            draw_margin = float(s01.get("draw_margin", 2.0))
            state.win_kind = "expiry"
            if f_han and f_xn:
                vic["end_type"] = "EXPIRY_DRAW"
            elif diff >= draw_margin:
                vic["end_type"] = "EXPIRY_HAN"
            elif diff <= -draw_margin:
                vic["end_type"] = "EXPIRY_XN"
            else:
                vic["end_type"] = "EXPIRY_DRAW"
            state.winner = "han" if diff >= 0.0 else "xiongnu"
            self._finalize_endgame(state, "四十季持久终局连续计分裁决")
            return True

        return True

    def score_override(self, state):
        v1 = state.ext.get("v1")
        if not v1:
            return None
        return self._compute_continuous_expiry_scores(state)

    def signature_override(self, state):
        v1 = state.ext.get("v1")
        if not v1:
            return None
        sig = v1["victory"].get("end_signature", "")
        return sig if sig else None

    def describe_state(self, state, faction):
        v1 = state.ext.get("v1")
        if not v1:
            return []
        vic = v1["victory"]
        court = v1["court"]
        tribes = v1["tribes"]
        logi = v1["logistics"]
        lines = []
        lines.append(
            "【v1 战略态势】汉都护功业 G=%.0f/101 (维持%d/14月) | 匈奴威服 W=%.0f/98 (维持%d/11月) | 官马池=%d匹"
            % (
                vic["han_merit"],
                vic["han_hold_months"],
                vic["xn_weifu"],
                vic["xn_weifu_hold_months"],
                getattr(state, "han_horse_pool", 0),
            )
        )
        ed = court.get("active_edict")
        ed_str = "%s(限T%d,%s)" % (ed["title"], ed["deadline_turn"], "已奉诏" if ed.get("complied") else "待奉诏") if ed else "无"
        lines.append(
            "【汉廷与后勤】朝廷信任=%.0f | 风向=%s | 现行诏令=%s | 西域军屯=%s | 烽燧=%d处"
            % (
                court["trust"],
                "守成休息(轮台诏)" if court["luntai_edict_active"] else "武帝拓边",
                ed_str,
                ",".join("%s:L%d" % (k, v) for k, v in logi["tuntian_nodes"].items()),
                len(logi["beacons"]),
            )
        )
        tb_strs = []
        for tk, tv in tribes["tribes"].items():
            tb_strs.append("%s(忠%.0f,怨%.0f,%s)" % (tv["name"], tv["loyalty"], tv.get("grievance", 0), tv["status"]))
        lines.append(
            "【单于庭与四部】单于=%s | 威望=%.0f | 赏赐池=%d金 | 僮仆都尉=%s | %s"
            % (
                tribes["chanyu_name"],
                tribes["chanyu_prestige"],
                tribes["reward_pool"],
                "在位" if tribes["tongpu_active"] else "已罢废",
                " | ".join(tb_strs),
            )
        )
        return lines

    def collect_metrics(self, state):
        v1 = state.ext.get("v1")
        if not v1:
            return {}
        vic = v1["victory"]
        court = v1["court"]
        tribes = v1["tribes"]
        ev = v1["events"]
        return {
            "end_type": vic["end_type"],
            "path_tag": vic["path_tag"],
            "han_grade": vic["han_grade"],
            "xn_grade": vic["xn_grade"],
            "coarse_signature": vic["end_signature_coarse"],
            "han_merit_end": vic["han_merit"],
            "han_merit_peak": vic["han_merit_peak"],
            "xn_weifu_end": vic["xn_weifu"],
            "xn_weifu_peak": vic["xn_weifu_peak"],
            "court_trust_end": round(court["trust"], 1),
            "chanyu_prestige_end": round(tribes["chanyu_prestige"], 1),
            "forged_edicts": court["forged_count"],
            "edicts_completed": court["edicts_completed"],
            "rizhu_surrendered": ev["rizhu_surrendered"],
            "baizai_count": ev["baizai_count"],
            "luntai_active": court["luntai_edict_active"],
            "lead_changes": vic["lead_changes"],
            "key_events": list(vic["key_events_occurred"]),
        }

    # ------------------------------------------------------------------
    # 内部核心计算：S01 功业 G、威服 W、连续计分与四段式终局签名
    # ------------------------------------------------------------------
    def _update_merit_and_weifu(self, state):
        v1 = state.ext["v1"]
        s01 = v1["cfg"]["s01"]
        vic = v1["victory"]
        tribes = v1["tribes"]
        logi = v1["logistics"]

        # --- 计算汉都护府功业值 G (S01-R02) ---
        vassal_w = float(s01.get("vassal_weight", 5.2))
        vassal_cap = float(s01.get("vassal_cap", 56.0))
        n_vassal = sum(
            1 for sid, rel in state.relations.items()
            if state.factions[sid].get("counts_for_victory", False) and rel["overlord"] == "han"
        )
        g_vassal = min(vassal_cap, n_vassal * vassal_w)

        n_enfeoff = sum(
            1 for sid, rel in state.relations.items()
            if state.factions[sid].get("counts_for_victory", False)
            and (rel.get("han_enfeoffed") or rel.get("han_status") == "enfeoffed" or rel.get("is_dual"))
        )
        g_enfeoff = min(9.0, n_enfeoff * 1.4)

        w_wulei = float(s01.get("hub_wulei_bonus", 7.0))
        w_cheshi = float(s01.get("hub_cheshi_bonus", 7.0))
        g_hub = 0.0
        if state.relations.get("wu_lei", {}).get("overlord") == "han":
            g_hub += w_wulei
        if state.relations.get("cheshi_qian", {}).get("overlord") == "han":
            g_hub += w_cheshi

        xiyu_tt_grain = 0.0
        for nid, lv in logi["tuntian_nodes"].items():
            if nid in HEXI_ALL or nid in ("chang_an", "long_xi"):
                continue
            if lv > 0 and nid in state.nodes:
                xiyu_tt_grain += state.stock(state.nodes[nid], "han") + state.nodes[nid]["grain"] * 0.5 + lv * 14000.0
        tt_target = max(1.0, float(s01.get("tuntian_grain_target", 60000.0)))
        g_tuntian = min(12.0, math.floor(12.0 * xiyu_tt_grain / tt_target))

        west_intims = [
            state.relations[sid]["xn_intimidation"]
            for sid in state.relations
            if state.factions[sid].get("counts_for_victory", False)
        ]
        avg_intim = sum(west_intims) / max(1, len(west_intims))
        g_suppress = _clamp(math.floor(7.0 * (45.0 - avg_intim) / (45.0 - 20.0)), 0.0, 7.0)

        g_great = 0.0
        if state.relations.get("wu_sun", {}).get("han_influence", 0) >= 52.0:
            g_great += 4.0
        if state.relations.get("da_wan", {}).get("han_influence", 0) >= 52.0:
            g_great += 4.0
        for gp in ("kang_ju", "da_yueshi"):
            if state.relations.get(gp, {}).get("han_influence", 0) >= 55.0:
                g_great += 2.0
        g_great = min(8.0, g_great)

        g_tongpu = float(s01.get("tongpu_abolished_bonus", 6.0)) if not tribes["tongpu_active"] else 0.0

        hexi_lost_cnt = sum(1 for nid in HEXI_FOUR if state.nodes[nid]["faction"] != "han")
        d_hexi = hexi_lost_cnt * float(s01.get("hexi_loss_penalty_per_node", 12.0))

        pet_boost = 6.0 if vic["petition_boost_ticks"] > 0 else 0.0
        G = round(
            g_vassal
            + g_enfeoff
            + g_hub
            + g_tuntian
            + g_suppress
            + g_great
            + g_tongpu
            + min(20.0, vic["han_merit_pool"])
            + min(24.0, vic["han_perm_merit"])
            + pet_boost
            - d_hexi,
            1,
        )
        vic["han_merit"] = G
        vic["han_merit_peak"] = max(vic["han_merit_peak"], G)
        vic["han_merit_breakdown"] = {
            "vassal": g_vassal,
            "enfeoff": g_enfeoff,
            "hub": g_hub,
            "tuntian": g_tuntian,
            "suppress": g_suppress,
            "great": g_great,
            "tongpu": g_tongpu,
            "event_pool": vic["han_merit_pool"],
            "perm": vic["han_perm_merit"],
            "hexi_pen": d_hexi,
        }

        # --- 计算匈奴威服值 W (S01-R05) ---
        hexi_xn_cnt = sum(1 for nid in HEXI_FOUR if state.nodes[nid]["faction"] == "xiongnu")
        hexi_raided_cnt = sum(
            1 for nid in HEXI_FOUR
            if state.nodes[nid]["faction"] == "han" and buffs.has(state, "sacked", nid)
        )
        w_hexi = min(74.0, hexi_xn_cnt * float(s01.get("hexi_occupied_weight", 18.5)) + hexi_raided_cnt * 4.5)

        n_xn_vassal = sum(
            1 for sid, rel in state.relations.items()
            if state.factions[sid].get("counts_for_victory", False) and rel["overlord"] == "xiongnu"
        )
        w_vassal = min(42.0, n_xn_vassal * float(s01.get("xn_vassal_weight", 4.0)))

        w_hub = 0.0
        if state.relations.get("lou_lan", {}).get("overlord") == "xiongnu":
            w_hub += 5.5
        if state.relations.get("cheshi_qian", {}).get("overlord") == "xiongnu":
            w_hub += 5.5
        if state.relations.get("qiu_ci", {}).get("overlord") == "xiongnu":
            w_hub += 4.5
        if state.relations.get("yan_qi", {}).get("overlord") == "xiongnu":
            w_hub += 3.5

        w_intim = _clamp((avg_intim - 34.0) * 0.36, 0.0, 9.5)

        w_tongpu = 7.5 if tribes["tongpu_active"] else 0.0
        if xiyu_tt_grain <= 15000 and state.turn >= 8:
            w_tongpu += 2.5

        prest = tribes["chanyu_prestige"]
        w_prestige = _clamp(math.floor(11.0 * (prest - 52.0) / 40.0), 0.0, 11.0)

        d_sacred = vic["xn_sacred_penalty"]
        if state.nodes.get("yi_wu", {}).get("faction") == "han":
            d_sacred += 8.0

        W = round(w_hexi + w_vassal + w_hub + w_intim + w_tongpu + w_prestige + vic["xn_event_pool"] - d_sacred, 1)
        if hexi_xn_cnt >= 4:
            W = max(W, 102.0)
        vic["xn_weifu"] = W
        vic["xn_weifu_peak"] = max(vic["xn_weifu_peak"], W)
        vic["xn_weifu_breakdown"] = {
            "hexi": w_hexi,
            "vassal": w_vassal,
            "hub": w_hub,
            "intim": w_intim,
            "tongpu": w_tongpu,
            "prestige": w_prestige,
            "event_pool": vic["xn_event_pool"],
            "sacred_pen": d_sacred,
        }

        cur_leader = "han" if G >= W else "xiongnu"
        if cur_leader != vic["last_leader"]:
            vic["lead_changes"] += 1
            vic["last_leader"] = cur_leader

        return G, W

    def _compute_continuous_expiry_scores(self, state):
        """S01-R07 到期连续变量计分公式（精确到小数点后两位，启用 horses_per_1000=1.2）。"""
        v1 = state.ext["v1"]
        s01 = v1["cfg"]["s01"]
        vic = v1["victory"]
        court = v1["court"]
        tribes = v1["tribes"]

        G = vic["han_merit"]
        W = vic["xn_weifu"]

        s_han_merit = _clamp((G - 14.0) * float(s01.get("han_merit_mult", 0.52)), 0.0, 50.0)
        han_horses = float(getattr(state, "han_horse_pool", 0))
        han_horses += sum(n["horses"] for n in state.nodes.values() if n["faction"] == "han")
        han_horses += sum(a["horses"] for a in state.armies.values() if a["faction"] == "han")
        horses_per_1000 = float(s01.get("horses_per_1000", 1.20))
        s_han_horse = _clamp((max(0.0, han_horses - 14000.0) / 1000.0) * horses_per_1000, 0.0, 15.0)

        han_pop = sum(
            n["pop"]
            for n in state.nodes.values()
            if n["faction"] == "han"
            or (n["faction"] in state.relations and state.relations[n["faction"]]["overlord"] == "han")
            or (n["faction"] in state.relations and state.relations[n["faction"]].get("is_dual"))
        )
        s_han_pop = _clamp((han_pop / float(vic["baseline_han_pop"])) * 7.2, 0.0, 15.0)
        s_han_trust = _clamp(court["trust"] * 0.11, 0.0, 15.0)
        s_han = round(s_han_merit + s_han_horse + s_han_pop + s_han_trust, 2)

        s_xn_weifu = _clamp(W * float(s01.get("xn_weifu_mult", 0.72)), 0.0, 55.0)
        xn_horses = sum(n["horses"] for n in state.nodes.values() if n["faction"] == "xiongnu") + sum(
            a["horses"] for a in state.armies.values() if a["faction"] == "xiongnu"
        )
        s_xn_horse = _clamp((xn_horses / float(vic["baseline_xn_horses"])) * 16.0, 0.0, 15.0)

        xn_pop = sum(
            n["pop"]
            for n in state.nodes.values()
            if n["faction"] == "xiongnu"
            or (n["faction"] in state.relations and state.relations[n["faction"]]["overlord"] == "xiongnu")
        )
        s_xn_pop = _clamp((xn_pop / float(vic["baseline_xn_pop"])) * 11.5, 0.0, 15.0)

        loy_vals = [
            0.0 if tv["status"] == "defected_han" else tv["loyalty"]
            for tv in tribes["tribes"].values()
        ]
        avg_loy = sum(loy_vals) / max(1, len(loy_vals))
        s_xn_pol = _clamp(tribes["chanyu_prestige"] * 0.14 + avg_loy * 0.11, 0.0, 15.0)
        s_xn = round(s_xn_weifu + s_xn_horse + s_xn_pop + s_xn_pol, 2)

        return {"han": s_han, "xiongnu": s_xn}

    def _finalize_endgame(self, state, reason_text):
        """生成 S01-R07 史官五档评定与四段式终局签名 {END_TYPE}__{PATH_TAG}__{GRADE_PAIR}__{TOP2_EVENTS}。"""
        v1 = state.ext["v1"]
        vic = v1["victory"]
        court = v1["court"]
        tribes = v1["tribes"]
        ev = v1["events"]

        sc = self._compute_continuous_expiry_scores(state)
        state.final_score = sc
        end_type = vic["end_type"]
        hb = vic["han_merit_breakdown"]
        xb = vic["xn_weifu_breakdown"]

        # 1) 决定 PATH_TAG（精细反映本局主导战略路线）
        if end_type == "HAN_MAIN":
            if ev["rizhu_surrendered"] and hb.get("vassal", 0) <= 46.0:
                path_tag = "rizhu_window"
            elif hb.get("tuntian", 0) >= 12.0 and len(v1["logistics"]["beacons"]) >= 2 and hb.get("vassal", 0) <= 48.0:
                path_tag = "tuntian_hub"
            else:
                path_tag = "vassal_grand"
        elif end_type == "XN_MAIN_HEXI":
            path_tag = "hexi_conquest"
        elif end_type == "XN_MAIN_WEIFU":
            if xb.get("hexi", 0) >= 18.0:
                path_tag = "hexi_west_hybrid"
            else:
                path_tag = "west_hegemony"
        elif end_type == "HAN_RECALL":
            path_tag = "forged_edict_fall" if court["forged_count"] > 0 else "trust_exhausted"
        elif end_type == "XN_SCATTER":
            path_tag = "baizai_collapse" if ev["baizai_count"] > 0 else "internal_mutiny"
        else:
            if xb.get("hexi", 0) >= 18.0 or state.stats.get("hexi_lost", 0) >= 2:
                path_tag = "hexi_warzone"
            elif hb.get("vassal", 0) >= 26.0:
                path_tag = "tarim_standoff"
            elif hb.get("tuntian", 0) >= 10.0:
                path_tag = "logistics_attrition"
            else:
                path_tag = "steppe_parity"
        vic["path_tag"] = path_tag

        # 2) 史官五档评定 (G1..G5, X1..X5)
        def _tier(s):
            if s >= 74.0:
                return 1
            if s >= 54.0:
                return 2
            if s >= 38.0:
                return 3
            if s >= 22.0:
                return 4
            return 5

        g_tier = _tier(sc["han"])
        x_tier = _tier(sc["xiongnu"])

        if end_type == "HAN_MAIN":
            if court["trust"] >= 62.0 and court["precedent"] < 20.0 and state.stats.get("han_casualties", 0) < 35000:
                g_tier = 1
            else:
                g_tier = 2  # 功大不封，赐爵关内侯
            x_tier = 3 if tribes["chanyu_prestige"] >= 58.0 else 4
        elif end_type in ("XN_MAIN_HEXI", "XN_MAIN_WEIFU"):
            x_tier = 1 if tribes["chanyu_prestige"] >= 68.0 else 2
            g_tier = 5 if end_type == "XN_MAIN_HEXI" else (4 if court["trust"] >= 42.0 else 5)
        elif end_type == "HAN_RECALL":
            g_tier = 5 if (court["unpardoned_forged_edict"] or state.stats.get("han_casualties", 0) >= 42000) else 4
            x_tier = 1 if tribes["chanyu_prestige"] >= 65.0 else 2
        elif end_type == "XN_SCATTER":
            x_tier = 5
            g_tier = 1 if vic["han_merit"] >= 85.0 else 2
        else:
            if state.winner == "han":
                g_tier = 2 if sc["han"] >= 62.0 else 3
                x_tier = 3 if sc["xiongnu"] >= 48.0 else 4
            else:
                x_tier = 2 if sc["xiongnu"] >= 62.0 else 3
                g_tier = 3 if sc["han"] >= 48.0 else 4

        g_names = {1: "G1_FENGHOU", 2: "G2_CIJUE", 3: "G3_WUGONG", 4: "G4_XIAYU", 5: "G5_ZUZHU"}
        x_names = {1: "X1_LONGCHENG", 2: "X2_BINFU", 3: "X3_GUDI", 4: "X4_BUHUI", 5: "X5_SHENSI"}
        vic["han_grade"] = g_names[g_tier]
        vic["xn_grade"] = x_names[x_tier]
        grade_pair = "G%d_X%d" % (g_tier, x_tier)

        # 3) TOP2_EVENTS（取决定终局走向的最后 2 项关键转折事件，避免开局固定事件同质化）
        ev_list = vic["key_events_occurred"]
        top2 = "_".join(ev_list[-2:]) if ev_list else "none"

        coarse_sig = "%s__%s" % (end_type, path_tag)
        full_sig = "%s__%s__%s__%s" % (end_type, path_tag, grade_pair, top2)
        vic["end_signature_coarse"] = coarse_sig
        vic["end_signature"] = full_sig
        state.win_reason = "%s [%s]" % (reason_text, full_sig)
        state.log_event("victory", "%s 获胜：%s" % (state.winner, state.win_reason))

    # ------------------------------------------------------------------
    # 辅助子系统逻辑：S02/S03/S05/S06
    # ------------------------------------------------------------------
    def _add_han_event_merit(self, state, delta, reason=""):
        v1 = state.ext["v1"]
        s01 = v1["cfg"]["s01"]
        pmax = float(s01.get("pool_max", 20.0))
        pmin = float(s01.get("pool_min", -20.0))
        v1["victory"]["han_merit_pool"] = round(_clamp(v1["victory"]["han_merit_pool"] + delta, pmin, pmax), 1)

    def _add_xn_event_weifu(self, state, delta):
        v1 = state.ext["v1"]
        v1["victory"]["xn_event_pool"] = round(_clamp(v1["victory"]["xn_event_pool"] + delta, -20.0, 20.0), 1)

    def _on_engine_event(self, state, e):
        v1 = state.ext["v1"]
        kind = e.get("kind", "")
        text = e.get("text", "")

        if kind == "battle":
            rep = e.get("report", {})
            w = rep.get("winner", "")
            if w == "han":
                if v1["victory"]["yearly_battle_awards"] < 2:
                    v1["victory"]["yearly_battle_awards"] += 1
                    self._add_han_event_merit(state, 2.0, "野战捷报")
                v1["court"]["trust"] = _clamp(v1["court"]["trust"] + 2.0, 0.0, 100.0)
                v1["tribes"]["chanyu_prestige"] = _clamp(v1["tribes"]["chanyu_prestige"] - 3.5, 0.0, 100.0)
                v1["tribes"]["tribes"]["rizhu"]["grievance"] += 2.0
            elif w == "xiongnu":
                self._add_xn_event_weifu(state, 2.5)
                v1["tribes"]["chanyu_prestige"] = _clamp(v1["tribes"]["chanyu_prestige"] + 2.5, 0.0, 100.0)
                v1["court"]["trust"] = _clamp(v1["court"]["trust"] - 2.0, 0.0, 100.0)
                v1["court"]["regret"] += 5.0

        elif kind == "capture":
            by = e.get("by", "")
            nid = e.get("node", "")
            if by == "han":
                v1["court"]["trust"] = _clamp(v1["court"]["trust"] + 3.5, 0.0, 100.0)
                v1["tribes"]["chanyu_prestige"] = _clamp(v1["tribes"]["chanyu_prestige"] - 4.5, 0.0, 100.0)
                v1["tribes"]["tribes"]["rizhu"]["grievance"] += 3.0
                sid = state.nodes.get(nid, {}).get("faction", "")
                if sid in state.relations and state.relations[sid].get("crimes_against_han", 0) > 0:
                    if sid not in v1["victory"]["punished_states"]:
                        v1["victory"]["punished_states"].append(sid)
                        self._add_han_event_merit(state, 3.2, "讨伐有罪之国")
                if nid in ("long_cheng", "chanyu_ting"):
                    v1["victory"]["han_perm_merit"] = min(40.0, v1["victory"]["han_perm_merit"] + 10.0)
                    v1["victory"]["xn_sacred_penalty"] += 15.0
            elif by == "xiongnu":
                v1["tribes"]["chanyu_prestige"] = _clamp(v1["tribes"]["chanyu_prestige"] + 4.0, 0.0, 100.0)
                v1["tribes"]["reward_pool"] += 220
                self._add_xn_event_weifu(state, 3.5)
                if nid in HEXI_FOUR:
                    record_key_event(state, "hexi_fall")
                    v1["court"]["trust"] = _clamp(v1["court"]["trust"] - 5.0, 0.0, 100.0)
                    v1["court"]["regret"] += 12.0

        elif kind == "raid":
            if "xiongnu" in text:
                v1["tribes"]["reward_pool"] += 120
                self._add_xn_event_weifu(state, 1.6)
                v1["court"]["regret"] += 3.0

        elif kind == "starve":
            aid = e.get("army", "")
            a = state.armies.get(aid)
            if a and a["faction"] == "han":
                v1["court"]["regret"] += 1.5
                if v1["court"].get("starve_pen_this_turn", 0) < 1:
                    v1["court"]["starve_pen_this_turn"] = 1
                    v1["court"]["trust"] = _clamp(v1["court"]["trust"] - 0.5, 0.0, 100.0)

    def _tick_automated_supply_and_tuntian(self, state, s05):
        """S05 自动化补给线与西域军屯月度补给。"""
        v1 = state.ext["v1"]
        logi = v1["logistics"]
        prio = logi["supply_priority"]

        if not (state.month() in (7, 8, 9) and state.nodes["dun_huang"]["grain"] > 260000):
            flow = 14000.0 * prio
            dh = state.nodes.get("dun_huang")
            if dh and dh["faction"] == "han" and dh["grain"] < 380000:
                dh["grain"] += flow
                logi["auto_delivered_grain"] += flow
            jq = state.nodes.get("jiu_quan")
            if jq and jq["faction"] == "han" and jq["grain"] < 260000:
                jq["grain"] += flow * 0.6

        luntai_mult = 1.30 if v1["court"]["luntai_edict_active"] else 1.0
        for nid, lv in logi["tuntian_nodes"].items():
            if nid in state.nodes and lv > 0:
                n = state.nodes[nid]
                add_g = 2800.0 * lv * luntai_mult
                if state.month() == state.bal["calendar"]["harvest_month"]:
                    add_g += 12000.0 * lv * luntai_mult
                state.set_stock(n, "han", state.stock(n, "han") + add_g)

        for a in state.armies.values():
            if a["faction"] != "han" or a["is_convoy"]:
                continue
            need_m = supply.need_per_month(state, a)
            if a["grain"] < need_m * 1.6:
                here = a["loc"].get("node", a["loc"].get("from", ""))
                n = state.nodes.get(here)
                if n:
                    sid = n["faction"]
                    rel = state.relations.get(sid)
                    willing = False
                    if sid == "han" or (rel and (rel["overlord"] == "han" or rel.get("is_dual") or rel["han_influence"] >= 45.0)):
                        willing = True
                    elif state.army_size(a) >= 6500:
                        willing = True
                    if willing or logi["supply_priority"] >= 2:
                        topup = min(supply.carry_cap(state, a) - a["grain"], need_m * 1.5)
                        if topup > 0:
                            a["grain"] += topup
                            a["starving"] = 0

    def _check_and_rotate_edict(self, state):
        """S02 季度诏令核验与新诏签发。"""
        v1 = state.ext["v1"]
        court = v1["court"]
        ed = court["active_edict"]
        if ed:
            tgt = ed["target"]
            done = False
            if tgt in state.relations:
                rel = state.relations[tgt]
                if rel["overlord"] == "han" or rel.get("is_dual") or rel["han_influence"] >= 55.0:
                    done = True
            elif tgt == "hexi_def":
                if all(state.nodes[nid]["faction"] == "han" for nid in HEXI_FOUR):
                    done = True
            if done:
                state.factions["han"]["money"] += int(ed["reward_money"])
                court["trust"] = _clamp(court["trust"] + float(ed["reward_trust"]) * 0.70, 0.0, 100.0)
                court["edicts_completed"] += 1
                self._add_han_event_merit(state, 2.2, "奉诏完成【%s】" % ed["title"])
                state.log_event("diplomacy", "【诏命达成】完成《%s》，赏金 %d、信任 +%.1f" % (ed["title"], ed["reward_money"], ed["reward_trust"] * 0.70))
                court["active_edict"] = None
                court["next_edict_turn"] = state.turn + 2
            elif state.turn >= ed["deadline_turn"]:
                pen = float(ed["penalty_trust"]) * (0.50 if ed.get("complied") else 1.00)
                court["trust"] = _clamp(court["trust"] - pen, 0.0, 100.0)
                court["edicts_failed"] += 1
                state.log_event("diplomacy", "【诏命逾期】《%s》失期未成，朝廷信任 -%.1f" % (ed["title"], pen))
                court["active_edict"] = None
                court["next_edict_turn"] = state.turn + 2

        if court["active_edict"] is None and state.turn >= court["next_edict_turn"]:
            cands = [
                ("wu_lei", "诏命经略乌垒、开通北道咽喉", 700, 8.0),
                ("cheshi_qian", "诏命破姑师/车师以断匈奴右臂", 800, 9.0),
                ("wu_sun", "诏命厚币通乌孙以合击胡右", 650, 7.0),
                ("da_wan", "诏命求大宛汗血天马入贡", 750, 8.0),
                ("hexi_def", "诏命严守河西四郡亭障、毋令胡骑入塞", 550, 6.0),
            ]
            pick = cands[state.turn % len(cands)]
            court["active_edict"] = {
                "id": "edict_" + pick[0],
                "title": pick[1],
                "target": pick[0],
                "deadline_turn": state.turn + 5,
                "reward_money": pick[2],
                "reward_trust": pick[3],
                "penalty_trust": 5.0,
                "complied": False,
                "bargained": False,
            }

        # 季度政治声望均值回归与重大失职弹劾门限
        hexi_lost_cnt = sum(1 for nid in HEXI_FOUR if state.nodes[nid]["faction"] != "han")
        severe_han_crisis = (
            (hexi_lost_cnt >= 2 and state.turn >= 12)
            or court["unpardoned_forged_edict"]
            or (state.turn >= 18 and v1["victory"]["han_merit"] < 52.0 and hexi_lost_cnt >= 1 and state.stats.get("han_casualties", 0) >= 34000)
        )
        if severe_han_crisis:
            court["trust"] = _clamp(min(court["trust"], 22.0) - 9.0, 0.0, 100.0)
        else:
            if court["trust"] < 38.0:
                court["trust"] = _clamp(court["trust"] + 3.5, 20.0, 100.0)
            else:
                court["trust"] = max(20.0, court["trust"])

        # 检定信任崩溃与槛车召还令 (S01-R06 / S02)
        if court["trust"] <= float(v1["cfg"]["s02"].get("recall_trust_threshold", 11.0)):
            if not court["recall_active"]:
                court["recall_active"] = True
                court["recall_grace_turns"] = 1
                state.log_event("diplomacy", "【廷尉急递】朝廷信任濒临崩溃，槛车征还令已自长安签发！")
            else:
                if court["recall_grace_turns"] <= 0:
                    court["recall_finalized"] = True
                else:
                    court["recall_grace_turns"] -= 1
        elif court["trust"] >= 17.0:
            court["recall_active"] = False

    def _tick_xiongnu_confederation_quarterly(self, state, s03):
        """S03 匈奴四部忠诚度、结构性赤字与三次年会结算。"""
        v1 = state.ext["v1"]
        tribes_state = v1["tribes"]
        tribes = tribes_state["tribes"]
        q = (state.month() - 1) // 3 + 1  # 1..4

        n_vassals = sum(1 for r in state.relations.values() if r["overlord"] == "xiongnu")
        if tribes_state["tongpu_active"]:
            n_duals = sum(1 for r in state.relations.values() if r.get("is_dual"))
            tribute = int(n_vassals * 65 + n_duals * 30)
            tribes_state["reward_pool"] += tribute
            state.factions["xiongnu"]["money"] += int(tribute * 0.5)

        severe_xn_crisis = (
            (state.turn >= 14 and v1["events"]["baizai_count"] >= 2 and v1["events"]["chanyu_succession_done"] and v1["victory"]["xn_weifu"] < 64.0 and n_vassals <= 4)
            or (state.turn >= 18 and v1["events"]["rizhu_surrendered"] and v1["events"]["baizai_count"] >= 2 and v1["victory"]["xn_weifu"] < 46.0 and n_vassals <= 3)
        )
        if severe_xn_crisis:
            tribes_state["chanyu_prestige"] = _clamp(min(tribes_state["chanyu_prestige"], 26.0) - 8.0, 0.0, 100.0)
            tribes_state["scatter_consecutive_turns"] += 1
        else:
            if tribes_state["chanyu_prestige"] < 42.0:
                tribes_state["chanyu_prestige"] = _clamp(tribes_state["chanyu_prestige"] + 2.5, 32.0, 100.0)
            else:
                tribes_state["chanyu_prestige"] = max(32.0, tribes_state["chanyu_prestige"])
            tribes_state["scatter_consecutive_turns"] = max(0, tribes_state["scatter_consecutive_turns"] - 1)

        deficit_decay = float(s03.get("quarterly_loyalty_decay", 2.9))
        prest_slope = float(s03.get("prestige_to_loyalty_mult", 0.10))
        prest_pull = (tribes_state["chanyu_prestige"] - 58.0) * prest_slope
        n_han_vassals = victory.han_vassals(state)

        for tk, tv in tribes.items():
            if tv["status"] == "defected_han":
                continue
            delta = prest_pull - deficit_decay
            if tk in ("rizhu", "lihu") and not tribes_state["tongpu_active"]:
                delta -= 2.0
            if tk == "rizhu":
                west_press = max(0, n_han_vassals - 4) * 0.55 + (2.0 if v1["events"]["chanyu_succession_done"] else 0.0)
                delta -= west_press * 0.35
                tv["grievance"] = _clamp(tv.get("grievance", 0.0) + 0.9 + west_press * 0.55, 0.0, 100.0)
            if severe_xn_crisis:
                delta -= 10.0
            loy_floor = 0.0 if (severe_xn_crisis or (tk == "rizhu" and v1["events"]["chanyu_succession_done"])) else 28.0
            tv["loyalty"] = _clamp(tv["loyalty"] + delta, loy_floor, 100.0)
            if delta < 0:
                tv["grievance"] = _clamp(tv.get("grievance", 0.0) + abs(delta) * 0.65, 0.0, 100.0)

        rz = tribes["rizhu"]
        griev_thresh = float(v1["cfg"]["s06"].get("rizhu_grievance_threshold", 82.0))
        loy_thresh = float(s03.get("defection_loyalty_threshold", 24.0))
        if rz["status"] != "defected_han" and state.turn >= 16:
            if rz.get("surrender_window", 0) > 0:
                rz["surrender_window"] = max(0, rz["surrender_window"] - 3)
            if (
                (rz.get("grievance", 0.0) >= griev_thresh and rz["loyalty"] <= 36.0)
                or (rz["loyalty"] <= loy_thresh and rz.get("grievance", 0.0) >= griev_thresh - 8.0)
            ) and not v1["events"]["rizhu_surrendered"]:
                rz["status"] = "wavering"
                rz["surrender_window"] = 9
                v1["events"]["rizhu_offered"] = True
                state.log_event("diplomacy", "【塞外秘闻】日逐王先贤掸与单于庭生隙（忠诚%.0f/怨望%.0f），密遣使诣汉营请降！" % (rz["loyalty"], rz["grievance"]))

        if q == 1 and severe_xn_crisis:
            absent = sum(1 for tv in tribes.values() if tv["status"] != "defected_han" and tv["loyalty"] < 34.0)
            if absent > 0:
                tribes_state["chanyu_prestige"] = _clamp(tribes_state["chanyu_prestige"] - absent * 3.0, 0.0, 100.0)

    def _tick_historical_events_quarterly(self, state, s06):
        """S06 中期重大历史事件配额保底（T5–T36 保底触发 2–4 次重大事件）。"""
        v1 = state.ext["v1"]
        ev = v1["events"]
        tribes_state = v1["tribes"]
        court = v1["court"]
        turn = state.turn

        if turn < 4:
            return

        baizai_prob = float(s06.get("white_disaster_q4_prob", 0.22))
        if state.month() == 12 and state.rng.random() < baizai_prob and turn - ev["last_major_event_turn"] >= 3:
            self._trigger_baizai(state)
            return

        if not ev["chanyu_succession_done"] and 11 <= turn <= 28:
            if state.rng.random() < float(s06.get("chanyu_succession_prob", 0.22)):
                self._trigger_chanyu_succession(state)
                return

        regret_thresh = float(s06.get("regret_luntai_threshold", 72.0))
        if not court["luntai_edict_active"] and (court["regret"] >= regret_thresh or (turn >= 24 and state.stats.get("han_casualties", 0) >= 24000)):
            self._trigger_luntai_edict(state)
            return

        rz = tribes_state["tribes"]["rizhu"]
        if rz.get("surrender_window", 0) > 0 and not ev["rizhu_surrendered"] and turn >= 14:
            han_west_force = sum(
                state.army_size(a) for a in state.armies.values()
                if a["faction"] == "han" and not a["is_convoy"]
            )
            if han_west_force >= 3000 and state.rng.random() < float(s06.get("auto_rizhu_accept_prob", 0.28)):
                self._execute_rizhu_surrender(state)

    def _trigger_baizai(self, state):
        v1 = state.ext["v1"]
        ev = v1["events"]
        tribes_state = v1["tribes"]
        ev["baizai_count"] += 1
        ev["baizai_last_turn"] = state.turn
        ev["major_events_count"] += 1
        ev["last_major_event_turn"] = state.turn
        record_key_event(state, "baizai")

        for n in state.nodes.values():
            if n["faction"] == "xiongnu" and n["horses"] > 0:
                n["horses"] = int(n["horses"] * 0.80)
        for sid, rel in state.relations.items():
            rel["xn_intimidation"] = max(0.0, rel["xn_intimidation"] - 10.0)
        tribes_state["chanyu_prestige"] = _clamp(tribes_state["chanyu_prestige"] - 8.0, 0.0, 100.0)
        for tv in tribes_state["tribes"].values():
            if tv["status"] != "defected_han":
                tv["loyalty"] = max(0.0, tv["loyalty"] - 7.0)
                tv["grievance"] = _clamp(tv.get("grievance", 0.0) + 10.0, 0.0, 100.0)
        state.log_event("economy", "【天灾·塞外白灾】漠北连月大雨雪，畜产死伤什二三，西域诸国对匈威惧骤降！")

    def _trigger_chanyu_succession(self, state):
        v1 = state.ext["v1"]
        ev = v1["events"]
        tribes_state = v1["tribes"]
        ev["chanyu_succession_done"] = True
        ev["major_events_count"] += 1
        ev["last_major_event_turn"] = state.turn
        record_key_event(state, "chanyu_die")

        successors = [
            ("wu_wei_chanyu", "乌维单于", -5.0, 10.0),
            ("wushilu", "儿单于乌师庐", -8.0, 16.0),
            ("woyan_qudi", "握衍朐鞮单于", -11.0, 22.0),
        ]
        pick = successors[state.rng.randint(0, len(successors) - 1)]
        tribes_state["chanyu_id"] = pick[0]
        tribes_state["chanyu_name"] = pick[1]
        tribes_state["chanyu_prestige"] = _clamp(tribes_state["chanyu_prestige"] + pick[2], 0.0, 100.0)
        rz = tribes_state["tribes"]["rizhu"]
        rz["grievance"] = _clamp(rz.get("grievance", 0.0) + pick[3], 0.0, 100.0)
        rz["loyalty"] = max(0.0, rz["loyalty"] - 7.0)
        griev_thresh = float(v1["cfg"]["s06"].get("rizhu_grievance_threshold", 82.0))
        if rz["grievance"] >= griev_thresh and rz["loyalty"] <= 48.0:
            rz["status"] = "wavering"
            rz["surrender_window"] = 9
            ev["rizhu_offered"] = True
        state.log_event("diplomacy", "【王庭巨变】单于崩逝，%s嗣立！右部日逐王先贤掸深怀危惧" % pick[1])

    def _execute_rizhu_surrender(self, state):
        """S01-R03 日逐王率众降汉原子事务：+9.5 永久勋 +6.5 罢僮仆 +3.5 战功 = +19.5 功业，全西域威吓 -12。"""
        v1 = state.ext["v1"]
        ev = v1["events"]
        vic = v1["victory"]
        tribes_state = v1["tribes"]
        rz = tribes_state["tribes"]["rizhu"]
        if ev["rizhu_surrendered"]:
            return
        ev["rizhu_surrendered"] = True
        ev["major_events_count"] += 1
        ev["last_major_event_turn"] = state.turn
        rz["status"] = "defected_han"
        rz["surrender_window"] = 0
        tribes_state["tongpu_active"] = False
        tribes_state["chanyu_prestige"] = _clamp(tribes_state["chanyu_prestige"] - 10.0, 0.0, 100.0)
        vic["han_perm_merit"] = min(26.0, vic["han_perm_merit"] + float(v1["cfg"]["s01"].get("perm_rizhu_surrender", 9.5)))
        self._add_han_event_merit(state, 3.5, "郑吉都护南北两道迎受日逐王")
        vic["xn_sacred_penalty"] += 8.0
        v1["court"]["trust"] = _clamp(v1["court"]["trust"] + 6.0, 0.0, 100.0)
        state.han_horse_pool = getattr(state, "han_horse_pool", 0) + 1800
        record_key_event(state, "rizhu")

        for sid, rel in state.relations.items():
            rel["xn_intimidation"] = max(0.0, rel["xn_intimidation"] - 12.0)
            if sid in ("wu_lei", "qu_li") and rel["overlord"] != "han":
                rel["han_influence"] = _clamp(rel["han_influence"] + 16.0, 0.0, 100.0)
                if rel["han_influence"] >= 54.0:
                    rel["overlord"] = "han"
                    rel["is_dual"] = False
        state.log_event(
            "victory",
            "【千古盛事·日逐王来降】匈奴日逐王先贤掸率万骑诣郑吉降汉！汉封归德侯，罢僮仆都尉（功业立增 +16）",
        )

    def _trigger_wusun_marriage(self, state):
        v1 = state.ext["v1"]
        ev = v1["events"]
        ev["wusun_married"] = True
        ev["major_events_count"] += 1
        ev["last_major_event_turn"] = state.turn
        record_key_event(state, "wusun_war")
        rel = state.relations["wu_sun"]
        rel["overlord"] = "han"
        rel["han_enfeoffed"] = True
        rel["han_influence"] = max(rel["han_influence"], 75.0)
        self._add_han_event_merit(state, 3.5, "乌孙和亲结盟助战")
        state.han_horse_pool = getattr(state, "han_horse_pool", 0) + 1500
        v1["tribes"]["chanyu_prestige"] = _clamp(v1["tribes"]["chanyu_prestige"] - 6.0, 0.0, 100.0)
        state.log_event("diplomacy", "【乌孙和亲】江都公主下嫁乌孙昆莫，乌孙遣精骑东出协击匈奴右翼！")

    def _trigger_dawan_horses(self, state):
        v1 = state.ext["v1"]
        ev = v1["events"]
        ev["dawan_horses_obtained"] = True
        ev["major_events_count"] += 1
        ev["last_major_event_turn"] = state.turn
        record_key_event(state, "heavenly_horses")
        rel = state.relations["da_wan"]
        rel["han_enfeoffed"] = True
        rel["han_influence"] = max(rel["han_influence"], 68.0)
        state.han_horse_pool = getattr(state, "han_horse_pool", 0) + 2500
        self._add_han_event_merit(state, 3.0, "大宛汗血天马入贡")
        v1["court"]["trust"] = _clamp(v1["court"]["trust"] + 5.0, 0.0, 100.0)
        state.log_event("diplomacy", "【天马徕】大宛献汗血良马入贡长安，汉军铁骑大振（官马池 +2,500）！")

    def _trigger_luntai_edict(self, state):
        v1 = state.ext["v1"]
        ev = v1["events"]
        court = v1["court"]
        court["luntai_edict_active"] = True
        court["wind"] = "rest"
        court["trust"] = _clamp(court["trust"] - 6.0, 0.0, 100.0)
        ev["major_events_count"] += 1
        ev["last_major_event_turn"] = state.turn
        record_key_event(state, "wind_shift")
        state.log_event("economy", "【轮台罪己诏】天子下诏深陈既往之悔，封丞相为富民侯，专意西域渠犁屯田（屯田产出 +30%，边将受责信任 -6）")


def _desc_v1_cmd(state, c):
    t = c.get("type", "")
    if t == "comply_edict":
        return "【朝堂·奉诏】奉旨领受当季朝廷诏令（信任 +3）"
    if t == "bargain_edict":
        return "【朝堂·陈情】上书赵充国式便宜议奏，展期诏令并请转输费"
    if t == "forge_edict":
        return "【特权·矫诏】持节便宜矫诏奇袭 %s（附奏自劾，奇袭战力加成）" % c.get("target", "北道")
    if t == "request_appropriation":
        return "【朝堂·请款】上书大司农请拨边防急款 650 金与官马 900 匹"
    if t == "petition_protectorate":
        return "【朝堂·请立都护】上书奏请正式设立西域都护府（功业 +10）"
    if t == "dispatch_elite_envoy":
        sid = c.get("state", "")
        nm = state.factions.get(sid, {}).get("name", sid)
        return "【外交·精使团】遣具名汉使持节出使 %s(%s)（预算 %d 金）" % (nm, sid, c.get("budget", 320))
    if t == "hire_mission":
        sid = c.get("state", "")
        nm = state.factions.get(sid, {}).get("name", sid)
        return "【外交·募使】遣郡国募使往 %s(%s) 行赏刺探（耗 %d 金，若受辱可获罪状）" % (nm, sid, c.get("budget", 150))
    if t == "accept_dual_allegiance":
        sid = c.get("state", "")
        nm = state.factions.get(sid, {}).get("name", sid)
        return "【外交·纳两属】准许 %s(%s) 纳质两属、开关通商（耗 160 金，功业 +2）" % (nm, sid)
    if t == "assassinate_king":
        sid = c.get("state", "")
        nm = state.factions.get(sid, {}).get("name", sid)
        return "【奇谋·斩王立新】遣傅介子式奇兵刺杀 %s(%s) 亲匈之王、改立亲汉质子（耗 240 金）" % (nm, sid)
    if t == "build_tuntian":
        nid = c.get("node", "")
        nm = state.nodes.get(nid, {}).get("name", nid)
        return "【后勤·西域屯田】在 %s(%s) 开渠筑垒设立军屯（耗 260 金，提升自养功业）" % (nm, nid)
    if t == "setup_supply_line":
        return "【后勤·自动粮道】调整河西—西域自动转输补给线（优先级 %s）" % c.get("priority", 2)
    if t == "build_beacon":
        nid = c.get("node", "")
        nm = state.nodes.get(nid, {}).get("name", nid)
        return "【边防·修筑烽燧】在 %s(%s) 筑塞外亭燧（耗 180 金，消迷雾+城防加成）" % (nm, nid)
    if t == "recruit_convict":
        nid = c.get("node", "dun_huang")
        nm = state.nodes.get(nid, {}).get("name", nid)
        return "【军事·七科谪】在 %s 征发驰刑罪人兵 3,000 人（耗 180 金，免占中央军池）" % nm
    if t == "welcome_rizhu":
        return "【历史决断·迎降日逐】出师乌垒迎受日逐王先贤掸率部来降（功业 +25，罢僮仆都尉）"
    if t == "intercept_tongpu":
        return "【军事·破袭税使】遣精骑赴北道截击匈奴僮仆都尉岁币护卫队"
    if t == "distribute_rewards":
        return "【王庭·大会分赏】从赏赐池拨 %d 金分赏四部诸王（模式：%s）" % (c.get("amount", 600), c.get("mode", "equal"))
    if t == "play_tactical_card":
        return "【王庭·战术卡】激活本季草原战术卡：【%s】" % c.get("card", "feigned_retreat")
    if t == "intimidate_city":
        sid = c.get("state", "")
        nm = state.factions.get(sid, {}).get("name", sid)
        return "【僮仆·铁骑威压】遣僮仆都尉巡行震慑 %s(%s)（威吓 +13）" % (nm, sid)
    if t == "install_prince":
        sid = c.get("state", "")
        nm = state.factions.get(sid, {}).get("name", sid)
        return "【僮仆·废立国主】在 %s(%s) 废黜异己、改立亲匈王子（耗 350 金）" % (nm, sid)
    if t == "pacify_tribe":
        return "【王庭·抚慰异心】专使赐金安抚 %s（耗 220 金，消除叛降风险）" % c.get("tribe", "rizhu")
    return "【v1命令】%s" % t


for _ct in (
    "comply_edict", "bargain_edict", "forge_edict", "request_appropriation", "petition_protectorate",
    "dispatch_elite_envoy", "hire_mission", "accept_dual_allegiance", "assassinate_king",
    "build_tuntian", "setup_supply_line", "build_beacon", "recruit_convict",
    "welcome_rizhu", "intercept_tongpu",
    "distribute_rewards", "play_tactical_card", "intimidate_city", "install_prince", "pacify_tribe",
):
    commands.register_command(_ct, lambda s, c: "", lambda s, c: None, _desc_v1_cmd)
