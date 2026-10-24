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
            rel["war_weariness"] = 0.0
            rel["last_insult_turn"] = -9

        # S05: 国家马匹池与初始河西烽燧、敦煌屯田
        state.han_horse_pool = int(s05.get("init_horse_pool", 5800))

        # S06: 初始化 25 名历史人物并绑定初始主力将领
        chars = {}
        for c in NAMED_CHARACTERS:
            cc = dict(c)
            cc["command_tier"] = int(round(cc["command"] / 10.0))
            cc["busy_until"] = 0
            cc["alive"] = True
            cc["assigned_army"] = ""
            cc["at_army"] = ""
            chars[cc["id"]] = cc

        han_armies = [a for a in state.armies.values() if a["faction"] == "han" and not a["is_convoy"]]
        han_gens = ["zhao_ponu", "gongsun_ao", "lu_bode", "zheng_ji"]
        for idx, a in enumerate(han_armies):
            if idx < len(han_gens):
                gid = han_gens[idx]
                a["commander"] = gid
                chars[gid]["at_army"] = a["id"]
                chars[gid]["assigned_army"] = a["id"]
                a["name"] = "%s(%s部)" % (a["name"], chars[gid]["name"])

        xn_armies = [a for a in state.armies.values() if a["faction"] == "xiongnu" and not a["is_convoy"]]
        xn_gens = ["yizhi_xie", "huyan_gu", "xian_xiandan", "xiutu_yu"]
        for idx, a in enumerate(xn_armies):
            if idx < len(xn_gens):
                gid = xn_gens[idx]
                a["commander"] = gid
                chars[gid]["at_army"] = a["id"]
                chars[gid]["assigned_army"] = a["id"]
                a["name"] = "%s(%s部)" % (a["name"], chars[gid]["name"])

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
                "last_assassinate_turn": -9,
                "assassinate_count": 0,
                "last_levy_vassal_turn": -9,
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
                "intimidate_this_quarter": 0,
                "intimidated_states_quarter": [],
                "assembly_target": "",
                "assembly_ticks": 0,
                "last_assembly_turn": -9,
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
                "supply_lines": ["dun_huang"],
                "beacons": ["wu_wei", "zhang_ye", "jiu_quan", "dun_huang"],
                "beacon_built_this_quarter": 0,
                "tuntian_nodes": {"dun_huang": 1},
                "tuntian_pressure": {},
                "convicts_year": 0,
                "auto_delivered_grain": 0.0,
            },
            "characters": chars,
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
            "accept_dual_allegiance", "install_prince", "welcome_rizhu",
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
            if state.turn - v1["court"].get("last_assassinate_turn", -9) < 3:
                return "奇袭刺王冷却中（每3季限1次）"
            if v1["court"].get("assassinate_count", 0) >= 3:
                return "诸国戒备森严，本局奇袭刺王已达上限(3次)"
            forged = v1["court"].get("forged_bonus_ticks", 0) > 0
            if rel.get("crimes_against_han", 0) <= 0 and not forged:
                return "需持有该国罪状或先行持节矫诏"
            if rel["han_influence"] < 34.0 and not forged:
                return "该国亲汉内应不足(需亲汉≥34或先行持节矫诏)"
            if rel["xn_intimidation"] > 78.0 and not forged:
                return "匈奴控弦重兵驻守(需威吓≤78或先行持节矫诏)"
            if money < 320:
                return "奇袭死士与重币经费不足(需320金)"
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
                return "仅汉方可辟筑驿道粮线"
            hub = cmd.get("forward_hub", "")
            prio = int(cmd.get("priority", v1["logistics"]["supply_priority"]))
            lines = v1["logistics"].get("supply_lines", ["dun_huang"])
            if hub and hub not in lines:
                if hub not in state.nodes:
                    return "枢纽节点无效"
                n = state.nodes[hub]
                rel = state.relations.get(n["faction"])
                has_han_presence = (
                    state.controller(n) == "han"
                    or v1["logistics"]["tuntian_nodes"].get(hub, 0) > 0
                    or (rel and (rel.get("is_dual") or rel["han_influence"] >= 42.0))
                    or any(a["faction"] == "han" and state.army_size(a) >= 1000 for a in state.armies_at(hub))
                )
                if not has_han_presence:
                    return "需先控制该节点、设有屯田或亲汉度≥42方可设驿站"
                if money < 220:
                    return "辟筑驿站经费不足(需220金)"
                if getattr(state, "han_horse_pool", 0) < 350:
                    return "国家马匹池不足以调拨驿传驼马(需350匹)"
                return ""
            if prio != v1["logistics"]["supply_priority"]:
                return ""
            return "该枢纽已接入驿道粮网"

        if t == "build_beacon":
            if f != "han":
                return "仅汉方可筑烽燧"
            nid = cmd.get("node", "")
            if nid not in state.nodes or nid in v1["logistics"]["beacons"]:
                return "该处已有烽燧或节点无效"
            if v1["logistics"].get("beacon_built_this_quarter", 0) >= 1:
                return "本季筑燧工卒已派发(每季限1处)"
            n = state.nodes[nid]
            rel = state.relations.get(n["faction"])
            has_reach = (
                nid == "ju_yan"
                or state.controller(n) == "han"
                or (rel and (rel.get("is_dual") or rel["han_influence"] >= 42.0))
                or any(a["faction"] == "han" and state.army_size(a) >= 1000 for a in state.armies_at(nid))
            )
            if not has_reach:
                return "需汉方控制、驻军或盟好城邦方可修筑塞外烽燧"
            chars = v1.get("characters", {})
            lu_alive = chars.get("lu_bode", {}).get("alive", False)
            cost = 130 if lu_alive else 180
            if money < cost:
                return "筑燧经费不足(需%d金)" % cost
            return ""

        if t == "levy_vassal_troops":
            if f != "han":
                return "仅汉方可持节发诸国兵"
            if state.turn - v1["court"].get("last_levy_vassal_turn", -9) < 3:
                return "诸国助战冷却中（每3季限1次）"
            n_ally = sum(
                1 for sid, r in state.relations.items()
                if (r["overlord"] == "han" or r.get("is_dual")) and r.get("war_weariness", 0.0) < 60.0
            )
            if n_ally < 3 and not v1["events"].get("wusun_married"):
                return "需至少3个未疲弊西域属国或已达成乌孙和亲"
            if money < 260:
                return "犒军赐金不足(需260金)"
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
            rel = state.relations[sid]
            if v1["tribes"].get("intimidate_this_quarter", 0) >= 2:
                return "本季僮仆铁骑巡行名额已满(每季限2国)"
            if state.turn - rel.get("last_intimidate_turn", -9) < 2:
                return "该城邦近期已受铁骑巡行震慑(冷却2季)"
            cost = 50 if v1["tribes"]["tongpu_active"] else 140
            if money < cost:
                return "铁骑巡行赏赐金不足(需%d金)" % cost
            return ""

        if t == "hold_chanyu_assembly":
            if f != "xiongnu":
                return "仅匈奴单于可召集龙城/蹛林大会"
            if state.turn - v1["tribes"].get("last_assembly_turn", -9) < 4:
                return "单于庭大会每年限办一次"
            if money + v1["tribes"]["reward_pool"] < 320:
                return "大会赐宴赏金不足(需320金)"
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
            n_ally = sum(1 for r in state.relations.values() if r["overlord"] == "han" or r.get("is_dual") or r.get("han_enfeoffed"))
            spawn_msg = ""
            if n_ally >= 2:
                hub = "wu_lei" if state.controller(state.nodes["wu_lei"]) == "han" else ("lou_lan" if state.controller(state.nodes["lou_lan"]) == "han" else "dun_huang")
                aux = state.new_army("han", hub, {"cavalry": 900, "infantry": 600}, 900, 16000.0, 0)
                state.apply_preset(aux, "assault")
                aux["name"] = "矫制诸国从军" + aux["id"].split("_")[-1]
                spawn_msg = "，于%s矫制调发诸国从军1,500人" % state.nodes[hub]["name"]
            record_key_event(state, "jiaozhao")
            state.log_event(
                "diplomacy",
                "汉使持节矫诏便宜发兵奇袭 %s%s（%s，信任 -%.0f）"
                % (tgt, spawn_msg, "附奏自劾" if self_imp else "秘而不宣", cost_trust),
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
            chars = v1.get("characters", {})
            envoy_cands = [
                ch for ch in chars.values()
                if ch.get("faction") == "han" and ch.get("alive", True) and ch.get("busy_until", 0) <= state.turn
                and (ch.get("role") == "envoy" or ch.get("eloquence", 0) >= 82)
            ]
            envoy_cands.sort(key=lambda x: int(x.get("eloquence", 70)), reverse=True)
            envoy_name = "持节正使"
            eloq_mult = 1.18
            if envoy_cands:
                env = envoy_cands[0]
                envoy_name = env["name"]
                env["busy_until"] = state.turn + 1
                eloq_mult = 1.12 + max(0.0, (float(env.get("eloquence", 80)) - 75.0) * 0.006)
                if "zaokong" in env.get("traits", ()) and rel["han_influence"] < 40.0:
                    eloq_mult *= 1.18
            max_gain = float(s04.get("gift_max_gain", 22.0))
            scale = float(s04.get("gift_budget_scale", 520.0))
            sat = int(rel.get("satiation", 0))
            gain = max_gain * (1.0 - math.exp(-budget / scale)) * eloq_mult * (0.78 ** sat)
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
                "汉遣精使【%s】持节出使 %s（预算 %d 金，亲汉度 +%.1f -> %.0f）"
                % (envoy_name, state.factions[sid]["name"], budget, gain, rel["han_influence"]),
                {"state": sid, "envoy": envoy_name},
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
            insult_prob = _clamp(0.16 + (rel["xn_intimidation"] - rel["han_influence"]) * float(s04.get("insult_diff_slope", 0.005)), 0.05, 0.50)
            if (
                rel["overlord"] != "han"
                and state.turn - rel.get("last_insult_turn", -9) >= 3
                and (rel["han_influence"] >= 20.0 or state.turn >= 3)
                and state.rng.random() < insult_prob
            ):
                rel["crimes_against_han"] = int(rel.get("crimes_against_han", 0)) + 1
                rel["last_insult_turn"] = state.turn
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
            forged = v1["court"].get("forged_bonus_ticks", 0) > 0
            if (
                not rel
                or rel["overlord"] == "han"
                or state.factions["han"]["money"] < 320
                or state.turn - v1["court"].get("last_assassinate_turn", -9) < 3
                or v1["court"].get("assassinate_count", 0) >= 3
                or (rel["han_influence"] < 34.0 and not forged)
            ):
                return True
            state.factions["han"]["money"] = max(0, state.factions["han"]["money"] - 320)
            v1["court"]["last_assassinate_turn"] = state.turn
            v1["court"]["assassinate_count"] = v1["court"].get("assassinate_count", 0) + 1
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
            if forged:
                v1["court"]["trust"] = _clamp(v1["court"]["trust"] + 8.0, 0.0, 100.0)
                v1["court"]["forged_bonus_ticks"] = 0
                v1["court"]["unpardoned_forged_edict"] = False
            else:
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
            for nb in state.near_neighbors(nid):
                sid = state.nodes[nb]["faction"]
                if sid in state.relations and state.relations[sid]["overlord"] == "xiongnu":
                    v1["logistics"]["tuntian_pressure"][sid] = v1["logistics"]["tuntian_pressure"].get(sid, 0.0) + 12.0
            state.log_event("economy", "汉于 %s 开渠设第 %d 级军屯（储粮 +18,000 斛）" % (n["name"], lv), {"node": nid})
            return True

        if t == "setup_supply_line":
            prio = int(cmd.get("priority", v1["logistics"]["supply_priority"]))
            hub = cmd.get("forward_hub", "")
            v1["logistics"]["supply_priority"] = _clamp(prio, 1, 3)
            lines = v1["logistics"].setdefault("supply_lines", ["dun_huang"])
            if hub and hub in state.nodes and hub not in lines:
                if state.factions["han"]["money"] >= 220 and getattr(state, "han_horse_pool", 0) >= 350:
                    state.factions["han"]["money"] -= 220
                    state.han_horse_pool -= 350
                    lines.append(hub)
                    v1["logistics"]["forward_hub"] = hub
                    dh = state.nodes["dun_huang"]
                    xfer = min(18000.0, max(0.0, dh["grain"] - 60000.0))
                    if xfer > 0:
                        dh["grain"] -= xfer
                        state.set_stock(state.nodes[hub], "han", state.stock(state.nodes[hub], "han") + xfer * 0.90)
                    self._add_han_event_merit(state, 1.5, "辟通%s西域驿道粮线" % state.nodes[hub]["name"])
                    state.log_event(
                        "economy",
                        "汉辟筑【敦煌—%s】驼马驿道粮线（拨官马350匹，首运军粮 %.0f 斛）" % (state.nodes[hub]["name"], xfer * 0.90),
                        {"node": hub},
                    )
                    return True
            state.log_event("economy", "调整河西—西域转输补给线（优先级 %d，前推枢纽 %s）" % (prio, hub or v1["logistics"]["forward_hub"]))
            return True

        if t == "build_beacon":
            nid = cmd["node"]
            if nid not in v1["logistics"]["beacons"] and v1["logistics"].get("beacon_built_this_quarter", 0) < 1:
                chars = v1.get("characters", {})
                cost = 130 if chars.get("lu_bode", {}).get("alive", False) else 180
                if state.factions["han"]["money"] < cost:
                    return True
                state.factions["han"]["money"] = max(0, state.factions["han"]["money"] - cost)
                v1["logistics"]["beacons"].append(nid)
                v1["logistics"]["beacon_built_this_quarter"] = v1["logistics"].get("beacon_built_this_quarter", 0) + 1
                n = state.nodes[nid]
                n["wall_hp_max"] += 150.0
                n["wall_hp"] = min(n["wall_hp_max"], n["wall_hp"] + 150.0)
                state.log_event("economy", "于 %s 修筑塞外烽燧亭障（耗 %d 金，视野精度提升，城防巩固）" % (n["name"], cost), {"node": nid})
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
            chars = v1.get("characters", {})
            for cid in ("lai_dan", "guo_chang", "wei_guang", "feng_fengshi"):
                ch = chars.get(cid)
                if ch and ch.get("alive", True) and not ch.get("assigned_army") and not ch.get("at_army"):
                    a["commander"] = cid
                    ch["assigned_army"] = a["id"]
                    ch["at_army"] = a["id"]
                    a["name"] = "%s(%s部)" % (a["name"], ch["name"])
                    break
            state.set_stock(state.nodes[nid], "han", state.stock(state.nodes[nid], "han") + 6000.0)
            state.log_event("recruit", "汉于 %s 征发七科谪驰刑士 %d 人充边助屯（攻城伤害+25%%，屯粮+6,000）" % (state.nodes[nid]["name"], cnt + 500))
            return True

        if t == "levy_vassal_troops":
            if state.turn - v1["court"].get("last_levy_vassal_turn", -9) < 3 or state.factions["han"]["money"] < 260:
                return True
            state.factions["han"]["money"] = max(0, state.factions["han"]["money"] - 260)
            v1["court"]["last_levy_vassal_turn"] = state.turn
            hub = "wu_lei" if state.controller(state.nodes["wu_lei"]) == "han" else (
                "lou_lan" if state.controller(state.nodes["lou_lan"]) == "han" else "dun_huang"
            )
            cav_cnt = 1500 + (1000 if v1["events"].get("wusun_married") else 0)
            inf_cnt = 1800
            a = state.new_army("han", hub, {"cavalry": cav_cnt, "infantry": inf_cnt}, cav_cnt, (cav_cnt + inf_cnt) * 6.0, 0)
            state.apply_preset(a, "balanced")
            a["name"] = "西域诸国联军" + a["id"].split("_")[-1]
            chars = v1.get("characters", {})
            for cid in ("chang_hui", "zheng_ji", "feng_fengshi"):
                ch = chars.get(cid)
                if ch and ch.get("alive", True) and not ch.get("assigned_army") and not ch.get("at_army"):
                    a["commander"] = cid
                    ch["assigned_army"] = a["id"]
                    ch["at_army"] = a["id"]
                    a["name"] = "%s(%s持节督师)" % (a["name"], ch["name"])
                    break
            for sid, r in state.relations.items():
                if r["overlord"] == "han" or r.get("is_dual"):
                    r["war_weariness"] = min(100.0, r.get("war_weariness", 0.0) + 9.0)
            state.log_event(
                "recruit",
                "汉使持节于 %s 征发西域诸国及乌孙助战兵 %d 人合击北道！" % (state.nodes[hub]["name"], cav_cnt + inf_cnt),
                {"army": a["id"], "node": hub},
            )
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
            if v1["tribes"].get("intimidate_this_quarter", 0) >= 2 or state.turn - rel.get("last_intimidate_turn", -9) < 2:
                return True
            cost = 50 if v1["tribes"]["tongpu_active"] else 140
            if state.factions["xiongnu"]["money"] < cost:
                return True
            state.factions["xiongnu"]["money"] = max(0, state.factions["xiongnu"]["money"] - cost)
            v1["tribes"]["intimidate_this_quarter"] = v1["tribes"].get("intimidate_this_quarter", 0) + 1
            v1["tribes"].setdefault("intimidated_states_quarter", []).append(sid)
            rel["last_intimidate_turn"] = state.turn
            rel["xn_intimidation"] = _clamp(rel["xn_intimidation"] + 13.5, 0.0, 100.0)
            rel["xn_resentment"] = _clamp(rel["xn_resentment"] + 4.0, 0.0, 100.0)
            margin = 14.0 if rel["overlord"] == "han" else 8.0
            if rel["xn_intimidation"] > rel["han_influence"] + margin and rel["overlord"] != "xiongnu":
                rel["overlord"] = "xiongnu"
                rel["is_dual"] = False
            state.log_event("diplomacy", "僮仆都尉铁骑巡行威压 %s（耗 %d 金，威吓 +13.5）" % (state.factions[sid]["name"], cost), {"state": sid})
            return True

        if t == "hold_chanyu_assembly":
            if state.turn - v1["tribes"].get("last_assembly_turn", -9) < 4:
                return True
            avail = state.factions["xiongnu"]["money"] + v1["tribes"]["reward_pool"]
            if avail < 320:
                return True
            v1["tribes"]["last_assembly_turn"] = state.turn
            pool_use = min(v1["tribes"]["reward_pool"], 320)
            v1["tribes"]["reward_pool"] -= pool_use
            if 320 - pool_use > 0:
                state.factions["xiongnu"]["money"] = max(0, state.factions["xiongnu"]["money"] - (320 - pool_use))
            for tk, tv in v1["tribes"]["tribes"].items():
                if tv["status"] != "defected_han":
                    tv["loyalty"] = _clamp(tv["loyalty"] + 7.5, 0.0, 100.0)
                    tv["grievance"] = max(0.0, tv.get("grievance", 0.0) - 8.0)
            v1["tribes"]["chanyu_prestige"] = _clamp(v1["tribes"]["chanyu_prestige"] + 4.5, 0.0, 100.0)
            for nid in ("chanyu_ting", "youxian_wang"):
                if nid in state.nodes and state.nodes[nid]["faction"] == "xiongnu":
                    state.nodes[nid]["horses"] += 1500
            tgt = cmd.get("target", "")
            if not tgt:
                for cand in ("lou_lan", "cheshi_qian", "wu_lei", "dun_huang", "jiu_quan"):
                    if cand in state.nodes and state.controller(state.nodes[cand]) != "xiongnu":
                        tgt = cand
                        break
            v1["tribes"]["assembly_target"] = tgt
            v1["tribes"]["assembly_ticks"] = 27
            tgt_nm = state.nodes.get(tgt, {}).get("name", "西域")
            state.log_event(
                "diplomacy",
                "【龙城/蹛林大会】单于会诸王课校人畜计，赐宴定盟主攻【%s】（诸部忠诚+7.5，主攻战力+12%%）" % tgt_nm,
                {"target": tgt},
            )
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

            for nid in ("ju_yan", "lou_lan", "wu_lei", "cheshi_qian"):
                c_bc = commands.make("build_beacon", "han", {"node": nid})
                if self.validate_command(state, c_bc) == "":
                    out.append(c_bc)

            for hub in ("lou_lan", "wu_lei", "wei_li", "cheshi_qian", "yan_qi"):
                c_sl = commands.make("setup_supply_line", "han", {"forward_hub": hub, "priority": 2})
                if self.validate_command(state, c_sl) == "":
                    out.append(c_sl)

            c_lv = commands.make("levy_vassal_troops", "han")
            if self.validate_command(state, c_lv) == "":
                out.append(c_lv)

            c_fg = commands.make("forge_edict", "han", {"target": "cheshi_qian", "self_impeach": True})
            if self.validate_command(state, c_fg) == "":
                out.append(c_fg)

            c_cv = commands.make("recruit_convict", "han", {"node": "dun_huang", "count": 2500})
            if self.validate_command(state, c_cv) == "":
                out.append(c_cv)

        elif faction == "xiongnu":
            for c in (
                commands.make("distribute_rewards", "xiongnu", {"amount": 600, "mode": "equal"}),
                commands.make("pacify_tribe", "xiongnu", {"tribe": "rizhu"}),
                commands.make("hold_chanyu_assembly", "xiongnu", {"target": "lou_lan"}),
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
        v1["tribes"]["intimidate_this_quarter"] = 0
        v1["tribes"]["intimidated_states_quarter"] = []
        v1["logistics"]["beacon_built_this_quarter"] = 0
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

        # S05 真实驿道补给网子步随军转输（须在驿道粮网/军屯/属国2跳可达范围内，且真实扣减枢纽存粮）与河西战马补配
        prio = v1["logistics"]["supply_priority"]
        lines = set(v1["logistics"].get("supply_lines", ["dun_huang"]))
        tt_nodes = v1["logistics"]["tuntian_nodes"]
        chars = v1.get("characters", {})
        loss_mult = 0.85 if (chars.get("sang_hongyang", {}).get("alive") or chars.get("zheng_ji", {}).get("alive")) else 1.05
        if prio >= 1:
            for a in state.armies.values():
                if a["faction"] != "han" or a["is_convoy"]:
                    continue
                here = a["loc"].get("node") or a["loc"].get("from", "")
                if here in HEXI_ALL and hasattr(state, "han_horse_pool") and state.han_horse_pool > 0:
                    need_horses = sum(int(a["units"].get(ut, 0)) * int(state.units[ut]["horses"]) for ut in a["units"])
                    if a.get("horses", 0) < need_horses:
                        add_h = min(int(state.han_horse_pool), need_horses - int(a.get("horses", 0)))
                        if add_h > 0:
                            a["horses"] += add_h
                            state.han_horse_pool -= add_h
                need_m = supply.need_per_month(state, a)
                if a["grain"] < need_m * 0.95 and here in state.nodes:
                    # 寻找可提供补给的驿道枢纽/军屯/汉控城池（已开通驿线或屯田辐射 4 跳，未开通则仅 2 跳）
                    best_hub = None
                    best_stock = 0.0
                    reach = 4 if (len(lines) > 1 or len(tt_nodes) > 1) else 2
                    for cand_id in [here] + state.near_neighbors(here) + list(lines) + list(tt_nodes.keys()):
                        if cand_id not in state.nodes or state.hops(here, cand_id, reach) > reach:
                            continue
                        cn = state.nodes[cand_id]
                        is_hub = (
                            cand_id in lines
                            or tt_nodes.get(cand_id, 0) > 0
                            or state.controller(cn) == "han"
                            or (cn["faction"] in state.relations and state.relations[cn["faction"]].get("is_dual"))
                        )
                        if not is_hub:
                            continue
                        st_avail = state.stock(cn, "han")
                        reserve = cn["pop"] * 3.0 if cn["faction"] == "han" else 500.0
                        if st_avail - reserve > best_stock:
                            best_stock = st_avail - reserve
                            best_hub = cn
                    if best_hub is not None and best_stock > 300.0:
                        topup = min(supply.carry_cap(state, a) - a["grain"], need_m * 0.92, best_stock / loss_mult)
                        if topup > 0:
                            state.set_stock(best_hub, "han", state.stock(best_hub, "han") - topup * loss_mult)
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
            hexi_held = sum(1 for nid in HEXI_FOUR if state.nodes[nid]["faction"] == "han")
            regen = 200 + hexi_held * 120
            state.han_horse_pool = min(16000, getattr(state, "han_horse_pool", 0) + regen)
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
        if v1["tribes"].get("assembly_ticks", 0) > 0:
            v1["tribes"]["assembly_ticks"] = max(0, v1["tribes"]["assembly_ticks"] - 3)
            if v1["tribes"]["assembly_ticks"] == 0:
                v1["tribes"]["assembly_target"] = ""

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

        self._tick_quarterly_upkeep(state)
        self._check_and_rotate_edict(state)

        # 3) S04 使团饱足度季度衰减 & 屯田压力/城邦自主反扑检定
        for rel in state.relations.values():
            rel["satiation"] = max(0, int(rel.get("satiation", 0)) - 1)
        self._tick_tuntian_pressure_and_autonomy(state)

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
        han_req = float(s01.get("han_threshold", 101.0)) + 4.2
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
        if hexi_xn_now >= 2 or (hexi_xn_now >= 1 and W >= 86.0):
            vic["xn_hexi_hold_months"] += (2 if hexi_xn_now >= 2 else 1)
        else:
            vic["xn_hexi_hold_months"] = max(0, vic["xn_hexi_hold_months"] - fail_dec)

        xn_req = float(s01.get("xn_threshold", 97.5)) - 2.5
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
        g_supply = min(3.0, max(0, len(logi.get("supply_lines", ["dun_huang"])) - 1) * 1.0)

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
            + g_supply
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
        w_assembly = 3.0 if tribes.get("assembly_ticks", 0) > 0 else 0.0

        d_sacred = vic["xn_sacred_penalty"]
        if state.nodes.get("yi_wu", {}).get("faction") == "han":
            d_sacred += 8.0

        W = round(w_hexi + w_vassal + w_hub + w_intim + w_tongpu + w_prestige + w_assembly + vic["xn_event_pool"] - d_sacred, 1)
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

        s_han_merit = _clamp((G - 8.0) * float(s01.get("han_merit_mult", 0.55)), 0.0, 52.0)
        han_horses = float(getattr(state, "han_horse_pool", 0))
        han_horses += sum(n["horses"] for n in state.nodes.values() if n["faction"] == "han")
        han_horses += sum(a["horses"] for a in state.armies.values() if a["faction"] == "han")
        horses_per_1000 = float(s01.get("horses_per_1000", 1.35))
        s_han_horse = _clamp((max(0.0, han_horses - 3000.0) / 1000.0) * horses_per_1000, 0.0, 15.0)

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
        """S05 自动化补给线与西域军屯月度补给（真实沿驿道转输军粮并计入郑吉/赖丹屯田加成）。"""
        v1 = state.ext["v1"]
        logi = v1["logistics"]
        prio = logi["supply_priority"]
        chars = v1.get("characters", {})

        if not (state.month() in (7, 8, 9) and state.nodes["dun_huang"]["grain"] > 260000):
            flow = 13500.0 * prio
            dh = state.nodes.get("dun_huang")
            if dh and dh["faction"] == "han" and dh["grain"] < 360000:
                dh["grain"] += flow
                logi["auto_delivered_grain"] += flow
            jq = state.nodes.get("jiu_quan")
            if jq and jq["faction"] == "han" and jq["grain"] < 240000:
                jq["grain"] += flow * 0.55

        # 沿已辟筑的西域驿道枢纽 (supply_lines) 从敦煌向前线粮仓转输
        lines = logi.get("supply_lines", ["dun_huang"])
        dh_node = state.nodes.get("dun_huang")
        if dh_node and dh_node["faction"] == "han" and len(lines) > 1:
            for hub_id in lines[1:]:
                if hub_id not in state.nodes:
                    continue
                hn = state.nodes[hub_id]
                if state.stock(hn, "han") < 85000.0 and dh_node["grain"] > 95000.0:
                    xfer = min(7500.0 * prio, dh_node["grain"] - 90000.0)
                    if xfer > 0:
                        dh_node["grain"] -= xfer
                        eff = 0.88 if chars.get("zheng_ji", {}).get("alive") else 0.80
                        state.set_stock(hn, "han", state.stock(hn, "han") + xfer * eff)

        luntai_mult = 1.30 if v1["court"]["luntai_edict_active"] else 1.0
        tt_master_mult = 1.20 if (chars.get("zheng_ji", {}).get("alive") or chars.get("lai_dan", {}).get("alive")) else 1.0
        for nid, lv in logi["tuntian_nodes"].items():
            if nid in state.nodes and lv > 0:
                n = state.nodes[nid]
                add_g = 2800.0 * lv * luntai_mult * tt_master_mult
                if state.month() == state.bal["calendar"]["harvest_month"]:
                    add_g += 12000.0 * lv * luntai_mult * tt_master_mult
                state.set_stock(n, "han", state.stock(n, "han") + add_g)

        for a in state.armies.values():
            if a["faction"] != "han" or a["is_convoy"]:
                continue
            need_m = supply.need_per_month(state, a)
            if a["grain"] < need_m * 1.55:
                here = a["loc"].get("node", a["loc"].get("from", ""))
                n = state.nodes.get(here)
                if n:
                    sid = n["faction"]
                    rel = state.relations.get(sid)
                    willing = False
                    if (
                        sid == "han"
                        or here in lines
                        or logi["tuntian_nodes"].get(here, 0) > 0
                        or (rel and (rel["overlord"] == "han" or rel.get("is_dual") or rel["han_influence"] >= 45.0))
                    ):
                        willing = True
                    elif state.army_size(a) >= 6500 and n["grain"] > 15000.0:
                        willing = True
                    if willing:
                        topup = min(supply.carry_cap(state, a) - a["grain"], need_m * 1.45)
                        if topup > 0:
                            avail_st = state.stock(n, "han")
                            if avail_st >= topup * 0.5:
                                state.set_stock(n, "han", max(0.0, avail_st - topup * 0.6))
                            elif n["grain"] > topup:
                                n["grain"] = max(0.0, n["grain"] - topup * 0.5)
                            a["grain"] += topup
                            a["starving"] = 0

    def _tick_quarterly_upkeep(self, state):
        """S02/S03/S05 季度军费度支、亭燧驿站维护费与官马池牧苑/互市补给与边防战马损耗。"""
        v1 = state.ext["v1"]
        logi = v1["logistics"]
        chars = v1.get("characters", {})

        # 1) 汉方官马池季度牧苑繁育、乌孙/大宛市马流入，以及在役骑兵/精使驼马损耗
        hexi_held = sum(1 for nid in HEXI_FOUR if state.nodes[nid]["faction"] == "han")
        horse_in = hexi_held * 55
        if v1["events"].get("wusun_married"):
            horse_in += 160
        if v1["events"].get("dawan_horses_obtained"):
            horse_in += 200
        active_han_cav = sum(
            int(a["units"].get("cavalry", 0))
            for a in state.armies.values()
            if a["faction"] == "han" and not a["is_convoy"]
        )
        horse_upkeep = int(round((active_han_cav / 1000.0) * 85.0 + len(logi.get("supply_lines", ["dun_huang"])) * 45.0))
        state.han_horse_pool = _clamp(int(getattr(state, "han_horse_pool", 0)) + horse_in - horse_upkeep, 0, 12000)

        # 2) 汉方季度超额边防军费、塞外烽燧与西域驿站维护（基础河西常备军 26,000 人由大司农岁计直供）
        han_troops = sum(state.army_size(a) for a in state.armies.values() if a["faction"] == "han" and not a["is_convoy"])
        excess_k = max(0.0, (han_troops - 26000.0) / 1000.0)
        extra_beacons = max(0, len(logi["beacons"]) - 4)
        extra_lines = max(0, len(logi.get("supply_lines", ["dun_huang"])) - 1)
        sang_mult = 0.80 if chars.get("sang_hongyang", {}).get("alive", True) else 1.0
        han_upkeep = int(round((excess_k * 28.0 + extra_beacons * 15.0 + extra_lines * 25.0) * sang_mult))
        if han_upkeep > 0 and state.factions["han"]["money"] > 450:
            state.factions["han"]["money"] = max(400, state.factions["han"]["money"] - han_upkeep)

        # 3) 匈奴王庭控弦大军军费与诸王例行岁赐维护
        xn_troops = sum(state.army_size(a) for a in state.armies.values() if a["faction"] == "xiongnu" and not a["is_convoy"])
        xn_excess_k = max(0.0, (xn_troops - 20000.0) / 1000.0)
        active_wings = sum(1 for tv in v1["tribes"]["tribes"].values() if tv["status"] != "defected_han")
        xn_upkeep = int(round(xn_excess_k * 28.0 + active_wings * 55.0))
        if xn_upkeep > 0 and state.factions["xiongnu"]["money"] > 500:
            state.factions["xiongnu"]["money"] = max(450, state.factions["xiongnu"]["money"] - xn_upkeep)

    def _tick_tuntian_pressure_and_autonomy(self, state):
        """S04/S05 屯田水草挤压反扑（赖丹轮台遇袭事件链）与城邦苦匈重敛/苦汉征发自主反正。"""
        v1 = state.ext["v1"]
        logi = v1["logistics"]
        beacons = set(logi["beacons"])

        # 1) 屯田挤压周边亲匈城邦水草 -> 触发袭屯或护屯立威
        for nid, lv in list(logi["tuntian_nodes"].items()):
            if lv <= 0 or nid in HEXI_ALL or nid not in state.nodes:
                continue
            guarded = (
                nid in beacons
                or any(a["faction"] == "han" and state.army_size(a) >= 1800 for a in state.armies_at(nid))
            )
            for nb in state.near_neighbors(nid):
                sid = state.nodes[nb]["faction"]
                rel = state.relations.get(sid)
                if not rel or rel["overlord"] == "han":
                    continue
                cur_p = logi["tuntian_pressure"].get(sid, 0.0)
                if not guarded and rel["overlord"] == "xiongnu":
                    cur_p += 4.5 * lv
                else:
                    cur_p = max(0.0, cur_p - 2.0)
                logi["tuntian_pressure"][sid] = cur_p
                if cur_p >= 22.0:
                    nm = state.factions[sid]["name"]
                    if guarded:
                        rel["crimes_against_han"] = int(rel.get("crimes_against_han", 0)) + 1
                        self._add_han_event_merit(state, 1.5, "护屯击退%s袭田胡骑" % nm)
                        logi["tuntian_pressure"][sid] = 6.0
                        state.log_event(
                            "battle",
                            "【护屯击胡】%s 不满 %s 军屯争水，遣骑夜袭；汉军据亭燧击走之，获讨伐罪状！" % (nm, state.nodes[nid]["name"]),
                            {"state": sid, "node": nid},
                        )
                    else:
                        tn = state.nodes[nid]
                        burned = min(6500.0, state.stock(tn, "han") * 0.35)
                        state.set_stock(tn, "han", max(0.0, state.stock(tn, "han") - burned))
                        rel["xn_intimidation"] = _clamp(rel["xn_intimidation"] + 7.0, 0.0, 100.0)
                        logi["tuntian_pressure"][sid] = 8.0
                        state.log_event(
                            "raid",
                            "【赖丹式屯田遇袭】%s 乘 %s 无备纵兵焚掠汉屯（损粮 %.0f 斛）！" % (nm, tn["name"], burned),
                            {"state": sid, "node": nid},
                        )

        # 2) 城邦自主外交：苦匈苛敛反正 vs 苦汉频征闭关
        for sid, rel in state.relations.items():
            rel["war_weariness"] = max(0.0, float(rel.get("war_weariness", 0.0)) - 3.0)
            if rel["overlord"] == "xiongnu" and rel["xn_resentment"] >= 78.0 and rel["xn_intimidation"] < 42.0:
                rel["overlord"] = ""
                rel["xn_intimidation"] = max(0.0, rel["xn_intimidation"] - 10.0)
                rel["han_influence"] = _clamp(rel["han_influence"] + 8.0, 0.0, 100.0)
                rel["xn_resentment"] = max(0.0, rel["xn_resentment"] - 25.0)
                state.log_event(
                    "defect",
                    "【苦匈重敛·举国反正】%s 不堪匈奴苛暴征索，乘胡骑势衰驱逐税使自立！" % state.factions[sid]["name"],
                    {"state": sid},
                )
            elif rel["overlord"] == "han" and rel.get("war_weariness", 0.0) >= 68.0 and rel["han_influence"] < 55.0:
                rel["overlord"] = ""
                rel["han_influence"] = max(0.0, rel["han_influence"] - 10.0)
                rel["war_weariness"] = max(0.0, rel["war_weariness"] - 25.0)
                state.log_event(
                    "defect",
                    "【诸国疲弊】%s 苦于频年从征，闭关自守暂停藩属义务" % state.factions[sid]["name"],
                    {"state": sid},
                )

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
            or (state.turn >= 20 and v1["victory"]["han_merit"] < 48.0 and hexi_lost_cnt >= 1 and state.stats.get("han_casualties", 0) >= 62000)
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
        hub = c.get("forward_hub", "西域")
        nm = state.nodes.get(hub, {}).get("name", hub)
        return "【后勤·辟筑驿线】辟通敦煌至 %s(%s) 驼马驿道粮线（耗 220 金、官马 350 匹）" % (nm, hub)
    if t == "levy_vassal_troops":
        return "【军事·发诸国兵】持节征调西域属国及乌孙联军 3,300+ 人合击北道（耗 260 金）"
    if t == "hold_chanyu_assembly":
        tgt = c.get("target", "西域")
        nm = state.nodes.get(tgt, {}).get("name", tgt)
        return "【王庭·蹛林大会】召集诸王课校人畜计、定盟主攻 %s（耗 320 金，诸部忠诚+7.5，主攻战力+12%%）" % nm
    if t == "build_beacon":
        nid = c.get("node", "")
        nm = state.nodes.get(nid, {}).get("name", nid)
        return "【边防·修筑烽燧】在 %s(%s) 筑塞外亭燧（耗 130~180 金，消迷雾+护屯+城防）" % (nm, nid)
    if t == "recruit_convict":
        nid = c.get("node", "dun_huang")
        nm = state.nodes.get(nid, {}).get("name", nid)
        return "【军事·七科谪】在 %s 征发驰刑罪人兵 3,000 人助屯强攻（耗 180 金，攻城+25%%）" % nm
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
        return "【僮仆·铁骑威压】遣僮仆都尉巡行震慑 %s(%s)（耗 75 金，每季限 2 国，威吓 +13）" % (nm, sid)
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
    "build_tuntian", "setup_supply_line", "build_beacon", "recruit_convict", "levy_vassal_troops",
    "welcome_rizhu", "intercept_tongpu",
    "distribute_rewards", "play_tactical_card", "intimidate_city", "install_prince", "pacify_tribe",
    "hold_chanyu_assembly",
):
    commands.register_command(_ct, lambda s, c: "", lambda s, c: None, _desc_v1_cmd)
