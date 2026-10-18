# S06 事件、人物与史书叙事系统（Events, Characters & Historical Narrative Specification）

> **所有权声明**：本文件（S06）唯一拥有**事件引擎（触发器 DSL / 选项 / 原子效果 Effect 词表 / 事件链调度 / 中期大事件保底配额）**、**人物通用数据模型（`Character` 属性 / 特性 Tag / 登场与寿元检定 / 候补生成池）**、**EA 25 名史实人物完整花名册（`data/characters.json`）**、**EA 40 条叙事与军政事件表（`data/events.json`）**、**本季纪事（《汉书》编年体回合摘要）生成规则**以及**终局《汉书·西域传/匈奴列传》附传与 1080×1920 竖版战报分享卡模板**。
>
> **上位依据**：严格遵守 [00_bible.md](00_bible.md) L1–L12 与 [STATUS.md](STATUS.md) 已裁决项 **[R-01]–[R-05]**。

---

## 1. 目的与支柱（Purpose & Pillars）

### 1.1 服务的体验支柱
本系统直接支撑《设计圣经》第 4 根核心支柱**「人与史：每局都能讲出一个有名有姓、有史可对照的故事」**，并将叙事深度织入前 3 根玩法支柱：
1. **人与史（核心支柱）**：拒绝空洞的“某将军率某编号部队攻克某城”。在西域争霸中，率七百轻骑擒楼兰王的是浞野侯**赵破奴**，持节入乌孙的是博望侯**张骞**，在轮台与龟兹间因屯田被杀的是扜弥太子**赖丹**，因不得立而率众迎降郑吉的是匈奴日逐王**先贤掸**。每季结算自动撰写的《本季纪事》与终局自动拼装的《汉书》列传体附传，把玩家的排兵布阵转化为可阅读、可截图分享的历史篇章。
2. **将在外（支柱 2 联动）**：具名人物是稀缺的“授权载体”（汉方同时在场上限 4–6 人）。名将与名使不仅提供统率与辞令修正，更自带性格底色——外戚李广利有`trait_greedy`（贪功）与`家室在吏`隐患，陈汤、傅介子有`trait_forger`（擅矫制）与封侯执念，杜周、暴胜之等监军御史则会放大朝廷问责。派谁出塞、派谁留守敦煌，本身就是政治押注。
3. **帝国对联盟（支柱 3 联动）**：汉方事件围绕“诏令时差、持节矫制、使臣死节、武帝晚年悔意（轮台诏）”展开；匈奴事件围绕“单于庭继承暗流（匿丧矫令）、日逐王怨望、白灾瓦解、汉降将献策（穿井筑城/祠兵）”展开。双方拥有截然不同的叙事母题与危机节奏。
4. **万里粮道（支柱 1 联动）**：后勤与屯田直接触发历史事件——屯田压迫超标触发《赖丹之死》，远征断粮触发将领哗变或自刎对簿，大宛献天马或抗命匿马直接决定河西粮道的战略走向。

### 1.2 L7 机制准入检验（它让哪些已有回合决策更难做？）

根据圣经 **L7（一个机制只有在“让某个已有的回合决策更难做”时才允许加入）**，S06 的四大子机制均直接制造两难权衡：

| 机制模块 | 关联圣经条目 | 它让哪个既有回合决策更难做？（两难抉择） |
|---|---|---|
| **① 具名人物在场与性格双刃剑** | L6 人物 v0 / R-02 | **派将/派使决策更难做**：高统率/高辞令名将往往带有强烈的政治或后勤副作用（如李广利统率 72 但带`trait_greedy`增加强征怨恨且畏罪易叛；傅介子`eloquence=86`但`caution=28`极易引发外交流血冲突；赵破奴善轻骑奇袭但受巫蛊牵连）。玩家必须在“高能力平推”与“政治安全/低损耗”之间权衡。 |
| **② 罪状与日逐王怨望→请降事件链** | L6 新机制⑥ | **汉方兵力驻防与匈奴分赃决策更难做**：对匈奴玩家而言，打压日逐王（少给赏赐/剥夺僮仆税分成）能省下赏赐池稳住左贤王，但会推高`rizhu_grievance`（怨望值），一旦突破阈值就会触发日逐王私通汉使；对汉方玩家而言，收到请降密信后只有 **9 旬（1 季）窗口**调集 ≥3,000 兵马并派具名将使出塞迎降，是抽调轮台防线主力冒险北上接应（可能中匈奴诱敌之计或后方空虚），还是按兵不动错失罢免僮仆都尉（+25 功业）的千载良机？ |
| **③ 中期重大事件保底配额与分支抉择** | L6 事件引擎 / S01-R12 | **中期资源留存（Buffer）决策更难做**：T10–T32 期间必有 1–3 次重大历史冲击（白灾瓦解、大宛匿马、单于继承危机、轮台悔诏）。玩家不能把每一分军粮、赏赐金与朝廷信任都榨干在极限扩张上，必须时刻预留应急储备（如匈奴需在 Q4 前留存赏赐池以防白灾+继承双重崩盘；汉方需在武帝悔意累积期抢先完成关键屯田）。 |
| **④ 史官纪事与终局附传评价体系** | L1 / L10 / S01-R05 | **战术捷径与身后名的权衡更难做**：屠城（`sack`）、频繁矫诏（`precedent` 累积）、强征掠食虽然能解眼前燃眉之急，但会被事件引擎永久刻入 `character_biographies` 与 `state.victory.key_events_occurred`，不仅触发后续报复事件（如《冤魂作祟》《轮台罪己诏》），更会导致终局《汉书》附传降格为“有功不侯”甚至“酷暴自恣，下狱弃市”。 |

---

## 2. 玩家视角（Player Perspective）

### 2.1 玩家在何时、何界面做什么决策？
1. **季初事件竹简弹窗（Season Start Event Modal）**：每季第 1 旬（Tick 0/9/18...）结算完上一季尾声状态后，若有满足触发条件的事件，界面中央展开**汉代木牍/竹简卷轴弹窗**（匈奴方为狼头金饰皮卷）。弹窗顶部显示事件名与史书引文，中部为 ≤120 字的文言/半文言叙事正文，底部提供 **2–3 个明确标出数值后果与风险概率的决策选项**。玩家必须做出选择后方进入本季下令阶段。
2. **左栏人物竹简牌与详情卡（Character Roster & Inspector）**：主界面左侧常驻当前在场的具名人物名牌（汉方 4–6 人，匈奴方单于+4 部王+僮仆都尉）。点击名牌可查看其四维能力（统率/勇武/辞令/谨慎）、2 个特性标签、当前所在节点/随行部队、年龄与健康状态，以及本局已立下的《生平功过录》。指派精使团（`send_envoy`）、组建远征军（`submit_plan`）、迎降部王或申请矫诏时，均需从在场人物槽中点选具体人物。
3. **季末《本季纪事》侧边卷轴（Seasonal Chronicle Drawer）**：每季 9 旬执行完毕后，右侧展开《本季纪事》，用凝练的《汉书》编年体（3–6 条，每条 20–45 字）汇总本季要闻（如*“元封三年春，浞野侯破奴将七百骑出玉门，虏楼兰王，遂定其国。”*）。
4. **终局《太史公/兰台令史附传》与战报分享卡（Endgame Biography & Share Card）**：游戏结束时，系统根据本局关键事件、功业/威服值、矫诏先例与人物生平，自动生成一篇 250–400 字的《汉书·西域传》或《匈奴列传》体裁附传，并可一键导出 **1080×1920 竖版战报长图**。

---

### 2.2 具体回合示例 A：日逐王怨望 → 请降事件链的双边博弈（带精确数字）

**背景状态（剧本②《漠北之后》第 22 季 / 前 114 年夏 Q2，Tick 189）**：
- **匈奴侧**：乌维单于新立（`chanyu_prestige = 52`），前任伊稚斜单于病逝时触发了 `evt_chanyu_succession`（单于继承危机），曾获先代许诺继承大位的日逐王**先贤掸**（`xn_xianxianshan`，统率 82 / 勇武 78 / 辞令 65 / 谨慎 74，特性 `trait_resentful_prince` 怨望贵人 + `trait_tongpu_master` 掌管西域）未能即位，初始怨望值 `rizhu_grievance = 45`。
- **第 22 季五月龙城大会（Q2 季初）**：匈奴玩家因东线左贤王部（`loyalty = 38`）濒临叛乱，将赏赐池中仅有的 `600` 钱全部拨给左贤王，对日逐王部选了“不予赏赐”，且在本季强令僮仆都尉从焉耆、龟兹加征三档重税（岁币大搜括）全部充入单于庭，未给日逐王分润。
- **数值结算**：
  1. 日逐王忠诚度由 `46` 跌至 `46 - 8（龙城未赏） - 6（独占僮仆税） = 32`（进入 `<35` 动摇区间 `wavering`）。
  2. 日逐王怨望值 `rizhu_grievance` 更新：`45 + 15（龙城冷落） + 12（剥夺西域税权） = 72`（突破阈值 `>= 70`）。

**第 23 季初（前 114 年秋 Q3，Tick 198）事件触发**：
- **步骤 1（匈奴弹窗 `evt_rizhu_estranged`【日逐王不肯会蹛林】）**：
  - **正文**：*“日逐王先贤掸以先单于遗命不得立，素怀怨望。及单于夺其僮仆赋入，先贤掸遂称疾不赴秋蹛林之会，阴聚所部骑万余于焉耆北山。”*
  - **匈奴玩家选项**：
    - **选项 A【遣贵人赐金安抚】**（需赏赐池 `>= 400` 钱）：`reward_pool -400`，`rizhu.loyalty +18`，`rizhu_grievance -25`（危机解除）。但此时匈奴玩家 `reward_pool` 仅剩 `120` 钱，**条件不足灰显**！
    - **选项 B【分拨僮仆岁入之半】**：未来 4 季匈奴西域岁币收入 `-50%`，`rizhu.loyalty +10`，`rizhu_grievance -15`（降至 `57`，暂缓请降）。
    - **选项 C【遣使切责，削其左大将】**：`chanyu_prestige +5`，但 `rizhu.loyalty -15`（跌至 `17`），`rizhu_grievance +20`（升至 `92`），**立即激活汉方迎降事件 `evt_rizhu_offers_surrender`**。
  - **匈奴决策**：匈奴玩家不愿放弃西域岁币（怕冬季发不出左贤王赏赐），冒险选了 **选项 C**，企图靠单于威压震慑日逐王，同时急令右贤王率 4,000 骑向焉耆方向移动准备武力弹压。

- **步骤 2（汉方同旬弹窗 `evt_rizhu_offers_surrender`【日逐王遣使请降】）**：
  - **正文**：*“匈奴日逐王先贤掸与单于有隙，率其众万余骑屯焉耆北，密遣使诣渠犁屯田所，愿举部内属，乞汉使持节将兵迎之。失此期（9 旬内），必为单于所并。”*
  - **汉方当前态势**：汉方功业值 `58 / 100`，朝廷信任 `64`，渠犁（`lun_tai`）驻有屯田校尉**郑吉**（`han_zheng_ji`，统率 85 `command_tier=9`，特性 `trait_tuntian_master` + `trait_welcomer` 招降纳叛）及汉军 `2,500` 人；敦煌另有赵破奴 `2,000` 骑（距焉耆需行军 11 旬，赶不上 9 旬窗口）。
  - **汉方玩家选项**：
    - **选项 A【命郑吉持节，发渠犁卒与诸国兵迎之】**（推荐）：开启 `rizhu_surrender_window = 9` 旬任务目标——9 旬内需有具名汉将率 `>= 3,000` 兵力抵达 `yan_qi`（焉耆）或 `che_shi_qian`（车师前国）。若当前无朝廷北伐诏令，此举视为**便宜行事（轻度矫诏）**：先扣 `court.trust -5`，`court.precedent +8`，但若迎降成功，朝廷大悦返还 `trust +18`！
    - **选项 B【飞章奏请长安，待诏书发河西大军】**：不扣信任、不增矫诏先例，奏疏往返需 `10` 旬（窗口延长至 `12` 旬，但期间日逐王每季有 `45%` 概率被单于击灭或反悔）。
    - **选项 C【疑其诈诱，闭营不纳】**：`court.trust +2`（持重），日逐王部被单于吞并，本局永久关闭日逐王降汉线。
  - **汉方决策**：玩家选 **选项 A**！由于郑吉在渠犁只有 `2,500` 汉军（差 `500` 人满 `3,000` 迎降门槛），玩家立即在同一季下达 S02/S04 联动命令 `levy_vassal_troops`（以节发 2 跳内属国尉犁、危须兵 `1,200` 人），合兵 `3,700` 人由郑吉率领，耗粮 `666` 斛，3 旬即进抵焉耆（`yan_qi`）！

- **步骤 3（Tick 201 迎降交接与连锁结算 `evt_rizhu_surrender_complete`）**：
  - 郑吉（具名名将在场，且带 `trait_welcomer`）率 `3,700 >= 3,000` 军抵达焉耆，抢在匈奴右贤王（尚在 4 旬路程外）之前完成接应！
  - **R-04 校验**：因有具名将使郑吉随军，**100% 接收日逐王部众无哗变**（若无具名将领则会发生 25% 哗变损耗）。
  - **全局原子效果结算**：
    1. **匈奴侧**：`state.tribes.rizhu.status = "defected_han"`，日逐王部原地裁撤；`state.tribes.tongpu_active = false`（**罢僮仆都尉**）；`chanyu_prestige -20`（由 `57` 暴跌至 `37`）；调用 `Diplomacy.on_tongpu_deposed(state)`，全西域城邦匈奴威吓 $X$ 立即 `-15` 且解除 `X_floor = 30` 保底！
    2. **汉方侧**：调用 `Victory.on_rizhu_surrender(state)`，汉方立即获得 **+15 永久勋值（`P_deed`）** 与 **+10 罢僮仆都尉状态分（`S_tongpu`）**，汉功业值从 `58` 跃升至 **`83 / 100`**！朝廷信任 `+18`（涨至 `77`），郑吉生平事迹写入 `"迎日逐王先贤掸，威震西域"`，并向 `state.victory.key_events_occurred` 写入 `"rizhu_surrender"`，直接迈入设立西域都护府的终局冲刺！

---

### 2.3 具体回合示例 B：本季纪事与终局《汉书》附传生成展示

#### （1）季末《本季纪事》生成示例（前 114 年秋 Q3 季末，Tick 207）
系统读取本季 `state.chronicle.season_entries` 中的 4 条结构化事件，套用 `S06-R07` 编年体模板渲染如下：
> **【元鼎三年秋（第 23 季）· 西域纪事】**
> - **七月**，匈奴日逐王先贤掸与单于有隙，遣使诣渠犁请降。
> - **八月**，卫司马郑吉持节发渠犁屯卒及尉犁诸国兵三千七百人，北迎先贤掸于焉耆。
> - **八月**，日逐王将万二千人随吉诣敦煌降，匈奴僮仆都尉由此罢，西域诸国皆震。
> - **九月**，天子嘉吉之功，诏封日逐王为归德侯，吉威重于西域。

#### （2）终局《汉书·西域传》附传生成示例（第 28 季汉方达成 `HAN_DUHUFU` 立府胜利）
当第 28 季汉方维持功业值 `>= 100` 满 4 季获胜时，系统读取持节主将（郑吉）、关键事迹栈（`["loulan_regicide", "tuntian_established", "rizhu_surrender"]`）、朝廷信任（`82`）与矫诏先例值（`precedent = 22 < 45` 未触发嫌隙压制），由 `S06-R08` 拼装出终局附传：
> **《汉书·傅常郑甘陈段传》附传（本局生成）**
> 郑吉，会稽人也。以侍郎从军，数出西域，为人强执习外国事。始屯田渠犁，积粟万四千斛，以赡诸国使。会楼兰王安归数遮杀汉使，吉与义阳侯傅介子设奇计斩安归首，更立尉屠耆为王，国号鄯善。
> 及匈奴乖乱，日逐王先贤掸欲降汉，吉即便宜发渠犁屯卒及诸国兵三千余人迎之。既至，汉封先贤掸为归德侯。吉既破车师，降日逐，威震西域，遂并护车师以西北道，故号**都护**。都护之置，自吉始焉。
> 上嘉其功，诏曰：“都护西域骑都尉吉，抚循外蛮，宣明威信，迎匈奴日逐王，罢僮仆都尉，功莫大焉。”遂封吉为**安远侯**，食邑千户。
> **【太史公/兰台评曰：⭐⭐⭐⭐⭐ 功冠西域·封安远侯（终局签名：`HAN_MAIN_DUHUFU_RIZHU_SURRENDER`）】**

> *对比分支*：若玩家在局中曾屠戮轮台（`sack_count = 2`）且屡次擅自矫诏（`precedent = 58 >= 45`），即便同样达成都护府胜利，末段评语将自动切换为：
> *“……然吉数矫制发兵，屠灭小国，塞外怨苦。有司奏吉专权生事，上以其功大，诏赦勿治，然亦不封侯，仅赐爵关内侯、黄金百斤而已。【评定：⭐⭐⭐ 功过相抵·有功不侯】”*

---

## 3. 状态变量表（State Variables）

### 3.1 事件引擎与叙事全局状态（`state.events` & `state.chronicle`）

| 名称 | 所属对象 | 类型 | 取值范围 | 初值 | JSON 键 / 配置源 | 存档字段 |
|---|---|---|---|---|---|---|
| `fired_once` | `state.events` | `Array[String]` | 事件 ID 列表 | `[]` | `events.json → [id].once` | `events.fired_once` |
| `cooldowns` | `state.events` | `Dict[String, int]` | `{evt_id: 剩余季数 0..40}` | `{}` | `events.json → [id].cooldown_seasons` | `events.cooldowns` |
| `pending_queue` | `state.events` | `Array[Dict]` | 待弹窗事件实例栈（每季上限 2） | `[]` | `balance.json → events.max_popups_per_season` (`2`) | `events.pending_queue` |
| `chain_flags` | `state.events` | `Dict[String, Variant]` | 事件链跨回合标记与计时器 | `{}` | 运行时动态写入 | `events.chain_flags` |
| `major_events_count` | `state.events` | `int` | `0..10`（本局已触发重大事件数） | `0` | `balance.json → events.major_quota_min` (`1`), `major_quota_max` (`3`) | `events.major_events_count` |
| `last_major_event_season` | `state.events` | `int` | `-10..60`（上次重大事件季号） | `-10` | `balance.json → events.major_cooldown_seasons` (`4`) | `events.last_major_event_season` |
| `rizhu_grievance` | `state.events` | `int` | `0..100`（日逐王怨望值） | 剧本①② `15` / 剧本③ `65` | `scenarios/*.json → rizhu_grievance_init` | `events.rizhu_grievance` |
| `rizhu_surrender_window` | `state.events` | `int` | `0..12`（汉军迎降剩余旬数，0=未开启） | `0` | `balance.json → events.rizhu_window_ticks` (`9`) | `events.rizhu_surrender_window` |
| `emperor_regret` | `state.events` | `int` | `0..100`（武帝悔意值，>=80 触发轮台诏） | `0` | `balance.json → events.regret_luntai_threshold` (`80`) | `events.emperor_regret` |
| `season_entries` | `state.chronicle` | `Array[Dict]` | 当季纪事条目（季末清空归档） | `[]` | `balance.json → chronicle.max_entries_per_season` (`6`) | `chronicle.season_entries` |
| `history_annals` | `state.chronicle` | `Array[Dict]` | 历年编年史归档（供回看与终局附传） | `[]` | 运行时累积 | `chronicle.history_annals` |

### 3.2 人物通用数据模型（`Character` Object Schema）

> **R-02 强制对齐**：所有人物四维能力值（`command`, `valor`, `eloquence`, `caution`）统一存储为 **`0–100` 整数**（普通将使基准 `50–70`，名将/名使 `80–98`），并在读取时动态导出 **`command_tier = int(round(command / 10.0))`**（取值 `0..10`），供 S05 战斗公式 `1.0 + 0.03 * (command_tier - 3)` 直接调用。

| 字段名 | 所属对象 | 类型 | 取值范围 | 初值 / 默认值 | JSON 键（`data/characters.json`） | 存档字段 |
|---|---|---|---|---|---|---|
| `id` | `Character` | `String` | `han_*` / `xn_*` / `cs_*` | 必填唯一键 | `characters[i].id` | `characters[id].id` |
| `name_zh` | `Character` | `String` | 2–6 汉字（如 `"郑吉"`、`"先贤掸"`） | 必填 | `characters[i].name_zh` | `characters[id].name_zh` |
| `courtesy_title` | `Character` | `String` | 官爵/称号（如 `"安远侯·卫司马"`） | 必填 | `characters[i].courtesy_title` | `characters[id].courtesy_title` |
| `faction` | `Character` | `String` | `"han"` / `"xiongnu"` / `"citystate"` | 必填 | `characters[i].faction` | `characters[id].faction` |
| `home_state` | `Character` | `String` | 城邦 ID（仅西域人物，如 `"wu_sun"`） | `""` | `characters[i].home_state` | `characters[id].home_state` |
| `role_tags` | `Character` | `Array[String]` | `"general"`, `"envoy"`, `"holder"`, `"censor"`, `"chanyu"`, `"tribe_king"`, `"tongpu"`, `"king"`, `"princess"` | 必填 | `characters[i].role_tags` | `characters[id].role_tags` |
| `birth_year` | `Character` | `int` | `-180..-50`（负数表示公元前） | 必填 | `characters[i].birth_year` | `characters[id].birth_year` |
| `appear_year` | `Character` | `int` | `-119..-60`（登场年份） | 必填 | `characters[i].appear_year` | `characters[id].appear_year` |
| `death_year` | `Character` | `int` | `-119..-30`（史实基准寿限年） | 必填 | `characters[i].death_year` | `characters[id].death_year` |
| `health` | `Character` | `int` | `0..100`（`<=0` 病逝） | `100` | `balance.json → char.initial_health` (`100`) | `characters[id].health` |
| `status` | `Character` | `String` | `"unborn"`（未登场）/ `"active"`（在场）/ `"in_transit"`（在途）/ `"imprisoned"`（下狱）/ `"defected"`（叛降）/ `"dead"`（死亡） | 按剧本起始年判定 | `scenarios/*.json → characters_init` | `characters[id].status` |
| `at_node` | `Character` | `String` | 节点 ID（如 `"dun_huang"`, `"lun_tai"`） | 初始驻地 | `characters[i].init_node` | `characters[id].at_node` |
| `assigned_to` | `Character` | `String` | 绑定的军队 ID / 使团 ID / 部族 ID | `""`（空闲驻守） | 运行时绑定 | `characters[id].assigned_to` |
| `command` | `Character` | `int` | `0..100`（统率：行军/大军战力/损耗） | 普通 `60` | `characters[i].command` | `characters[id].command` |
| `command_tier` | `Character` | `int` | `0..10`（导出只读：`round(command/10.0)`） | 普通 `6` | 计算属性（对齐 R-02 & S05） | 不单独存盘（动态计算） |
| `valor` | `Character` | `int` | `0..100`（勇武：奇袭/野战冲击/斩将） | 普通 `60` | `characters[i].valor` | `characters[id].valor` |
| `eloquence` | `Character` | `int` | `0..100`（辞令：出使/招降/奏议说服） | 普通 `70` | `characters[i].eloquence` | `characters[id].eloquence` |
| `caution` | `Character` | `int` | `0..100`（谨慎：防伏击/抗矫诏/全身而退） | 普通 `65` | `characters[i].caution` | `characters[id].caution` |
| `ambition_marquis` | `Character` | `int` | `0..100`（封侯执念，影响矫诏倾向与怨望） | `50` | `characters[i].ambition_marquis` | `characters[id].ambition_marquis` |
| `traits` | `Character` | `Array[String]` | 固定 2 个特性 Tag（见 `S06-R05`） | `[]` | `characters[i].traits` | `characters[id].traits` |
| `is_generated` | `Character` | `bool` | `false`=史实 25 人，`true`=候补池生成 | `false` | 运行时生成标记 | `characters[id].is_generated` |
| `deeds_log` | `Character` | `Array[String]` | 人物生平功过记录（供附传拼装） | `[]` | 运行时追加 | `characters[id].deeds_log` |

### 3.3 `data/characters.json` 与 `data/events.json` 配置文件结构规范

```json
// data/characters.json 单条结构示例
{
  "id": "han_zheng_ji",
  "name_zh": "郑吉",
  "name_en": "Zheng Ji",
  "courtesy_title": "卫司马·安远侯",
  "faction": "han",
  "home_state": "",
  "role_tags": ["holder", "general", "envoy"],
  "birth_year": -105,
  "appear_year": -72,
  "death_year": -49,
  "init_node": "lun_tai",
  "command": 85,
  "valor": 74,
  "eloquence": 82,
  "caution": 80,
  "ambition_marquis": 75,
  "traits": ["trait_tuntian_master", "trait_welcomer"],
  "bio_intro_key": "char.han_zheng_ji.bio_intro"
}
```

```json
// data/events.json 单条结构示例
{
  "id": "evt_rizhu_offers_surrender",
  "title_key": "evt.rizhu_offers_surrender.title",
  "desc_key": "evt.rizhu_offers_surrender.desc",
  "category": "major_crisis",
  "target_faction": "han",
  "once": true,
  "cooldown_seasons": 0,
  "is_major_quota": true,
  "key_event_tag": "rizhu_surrender_offered",
  "trigger": {
    "all": [
      {"op": "gte", "var": "events.rizhu_grievance", "val": 70},
      {"op": "eq", "var": "tribes.tongpu_active", "val": true},
      {"op": "neq", "var": "tribes.rizhu.status", "val": "defected_han"}
    ]
  },
  "options": [
    {
      "opt_id": "a_welcome_with_troops",
      "text_key": "evt.rizhu_offers_surrender.opt_a",
      "effects": [
        {"op": "set_var", "target": "events.rizhu_surrender_window", "val": 9},
        {"op": "add_trust", "val": -5, "reason": "cheap_expedition_unauthorized"},
        {"op": "add_precedent", "val": 8}
      ],
      "ai_weight": {"base": 80, "modifiers": [{"cond": "han_troops_near_yanqi >= 2500", "add": 40}]}
    }
  ]
}
```

---

## 4. 规则与公式（Rules & Formulas）

### 4.1 `S06-R01` 事件引擎架构与触发器谓词 DSL 词表

#### （1）结算时机与执行顺序（Timing & Order）
事件引擎在每个季度周期（9 旬）内设 **3 个检定钩子**：
1. **季初主检定钩子（Season Start Hook，每季第 1 旬 Tick `0, 9, 18...` 阶段 A）**：
   - 先递减所有冷却计时器：对 `state.events.cooldowns` 中所有键执行 `cooldowns[k] = max(0, cooldowns[k] - 1)`。
   - 检查到期事件链（`scheduled_chain_events`）：凡 `due_season == current_season` 的事件优先推入 `pending_queue`。
   - 扫描 `data/events.json` 中 `hook == "season_start"` 的全部事件，过滤掉已在 `fired_once` 或 `cooldowns[id] > 0` 的条目，评估 `trigger` 谓词树。
   - 应用 `S06-R03` 中期大事件配额保底与冷却过滤。
   - 按优先级（`priority`: `chain_mandatory (100) > major_crisis (80) > historical_character (60) > minor_military_diplomatic (40)`）排序，每季最多弹出 **`max_popups_per_season = 2`** 条事件（超出部分顺延至下季或丢弃低优通用事件）。
2. **旬末即时检定钩子（Tick End Hook，每旬末阶段 D）**：
   - 仅检查轻量级即时窗口任务，例如**日逐王迎降窗口倒计时**（`rizhu_surrender_window > 0` 时，每旬检查是否有具名汉将率 `>= 3,000` 兵力抵达 `yan_qi` 或 `che_shi_qian`；若满足则立即触发 `evt_rizhu_surrender_complete`；若倒计时归零仍未满足则触发 `evt_rizhu_surrender_failed`）。
3. **行为回调钩子（Action Callback Hook，即时触发）**：
   - 由战斗（`on_battle_resolved`）、攻城（`on_city_captured`）、出使（`on_envoy_arrived` / `on_envoy_killed`）、年终白灾与寿元检定（`on_q4_winter_check`，每年 12 月下旬）直接按事件 ID 唤醒对应事件。

#### （2）触发器谓词 DSL 词表（Trigger Predicate Vocabulary）
`events.json` 中的 `trigger` 字段采用纯声明式 JSON 布尔树（支持 `"all": [...]`、`"any": [...]`、`"not": {...}` 嵌套），底层解释器 `EventEngine.eval_trigger(state, trigger_dict)` 支持以下 **18 个标准原子谓词**：

| 谓词操作符 (`op`) | 参数示例 | 语义说明与读取的数据源 |
|---|---|---|
| `season_between` | `{"op": "season_between", "min": 10, "max": 32}` | 当前季号 `state.season_idx` 在 `[min, max]` 闭区间内 |
| `year_bce_lte` | `{"op": "year_bce_lte", "val": 104}` | 当前公元前年份数字 `<= val`（如前 104 年及以后，即 `year_bce <= 104`） |
| `quarter_is` | `{"op": "quarter_is", "val": 4}` | 当前季度为 Q1(`1`)/Q2(`2`)/Q3(`3`)/Q4(`4`，冬季 10–12 月) |
| `scenario_is` | `{"op": "scenario_is", "val": "scn_mobei"}` | 当前剧本 ID 匹配（`scn_loulan` / `scn_mobei` / `scn_duhufu`） |
| `var_gte` / `var_lt` / `var_eq` | `{"op": "var_gte", "var": "events.rizhu_grievance", "val": 70}` | 读取 `state` 路径变量的数值或布尔值并比较 |
| `char_active` | `{"op": "char_active", "char_id": "han_zhang_qian"}` | 指定人物 `status == "active"` 且在场 |
| `char_at_region` | `{"op": "char_at_region", "char_id": "han_zheng_ji", "tag": "citystate_north"}` | 指定人物所在节点包含特定区域标签或位于指定节点列表 |
| `trust_between` | `{"op": "trust_between", "min": 0, "max": 35}` | 汉朝廷信任 `state.court.trust` 在 `[min, max]` 内（S02） |
| `prestige_between` | `{"op": "prestige_between", "min": 0, "max": 40}` | 匈奴单于威望 `state.tribes.chanyu_prestige` 在 `[min, max]` 内（S03） |
| `tribe_loyalty_lt` | `{"op": "tribe_loyalty_lt", "tribe": "rizhu", "val": 35}` | 指定匈奴部族忠诚度 `< val`（S03） |
| `influence_gte` | `{"op": "influence_gte", "state_id": "wu_sun", "val": 40}` | 汉对指定城邦/大国影响力 `>= val`（S04） |
| `has_crime` | `{"op": "has_crime", "state_id": "lou_lan"}` | 指定城邦对汉持有合法讨伐罪状 `Diplomacy.has_valid_crime == true`（S04） |
| `tuntian_pressure_gte` | `{"op": "tuntian_pressure_gte", "state_id": "qiu_ci", "val": 60}` | 指定城邦承受的汉屯田压迫值 `>= val`（S05 `state.tuntian_pressure`） |
| `horse_pool_lt` | `{"op": "horse_pool_lt", "faction": "han", "val": 1500}` | 国家马匹池数量 `< val`（S05） |
| `army_outside_gate` | `{"op": "army_outside_gate", "faction": "xiongnu", "min_troops": 4000}` | 指定阵营在塞外/西域有单支或合计兵力 `>= min_troops` 的野战军 |
| `flag_is` | `{"op": "flag_is", "flag": "wusun_married_xijun", "val": true}` | 检查 `state.events.chain_flags[flag] == val` |
| `random_chance` | `{"op": "random_chance", "prob": 0.25}` | 调用 `GameState.rng.randf() < prob` |
| `major_quota_available` | `{"op": "major_quota_available"}` | 校验 `S06-R03` 中期大事件配额未满且冷却已就绪 |

---

### 4.2 `S06-R02` 选项效果 Effect 原子词表（跨系统完整对齐）

事件选项中的 `effects` 数组由 `EventEngine.apply_effects(state, effects_array)` 顺序执行。为保证与 S01–S05 零歧义耦合，定义以下 **28 个标准原子 Effect**：

| 所属域 | 原子操作名 (`op`) | 参数 schema | 精确执行逻辑与跨系统调用接口 |
|---|---|---|---|
| **S01 胜利与功业** | `add_permanent_deed` | `{"val": 15, "tag": "rizhu_surrender"}` | 给汉方永久勋值 `state.victory.permanent_deed += val`（上限 30），并记录勋绩来源（S01） |
| **S01/S03/S04** | `trigger_rizhu_surrender` | `{"has_named_general": true}` | **日逐王降汉核心原子操作**：① 置 `state.tribes.rizhu.status = "defected_han"` 并移除日逐王部军队；② 置 `state.tribes.tongpu_active = false`；③ 调用 `Victory.on_rizhu_surrender(state)`（授汉 `+15` 永久勋与 `+10` 罢僮仆状态分，合计 `+25` 功业）；④ 调用 `Diplomacy.on_tongpu_deposed(state)`（全西域城邦匈奴威吓 $X - 15$ 并解除 `X_floor=30` 保底）；⑤ 若 `has_named_general == true`（R-04），汉方在焉耆获得 `2,000` 归义胡骑（100% 接收无哗变），若 `false` 则承受 25% 哗变损耗仅得 `1,500` 骑 |
| **S01 终局签名** | `append_key_event` | `{"tag": "luntai_edict"}` | 向 `state.victory.key_events_occurred` 追加唯一标签（供 S01 生成终局签名与史官评定） |
| **S02 汉廷信任** | `add_trust` | `{"val": -8, "reason": "envoy_humiliated"}` | 调用 `Court.modify_trust(state, val, reason)` 修改朝廷信任（夹逼 `0..100`） |
| **S02 矫诏先例** | `add_precedent` | `{"val": 12}` | 修改 `state.court.precedent = clamp(precedent + val, 0, 100)`（`>=45` 触发功大不封） |
| **S02 武帝悔意** | `add_emperor_regret` | `{"val": 20}` | 修改 `state.events.emperor_regret = clamp(emperor_regret + val, 0, 100)`；若突破 `>= 80` 且未触发过轮台诏，下季初必弹 `evt_luntai_edict` |
| **S02 诏令与风向** | `set_court_wind` | `{"wind": "rest", "duration_seasons": 20}` | 切换朝廷风向（`"expansion"` 开边 / `"rest"` 休息 / `"pragmatic"` 综核名实），`"rest"` 期间激活轮台诏远距屯田限制与屠城双倍扣信任 |
| **S02 专项诏令** | `issue_special_edict` | `{"template_id": "edict_conquer_dawan"}` | 调用 `Court.spawn_edict(state, template_id)` 生成在途诏书送往持节者 |
| **S03 单于威望** | `add_prestige` | `{"val": -12}` | 修改 `state.tribes.chanyu_prestige = clamp(prestige + val, 0, 100)` |
| **S03 赏赐池** | `add_reward_pool` | `{"val": -300}` | 调用 `Tribes.add_reward_pool(state, val)` 增减单于赏赐池金额 |
| **S03 部族忠诚** | `add_tribe_loyalty` | `{"tribe": "rizhu", "val": -15}` | 修改指定部族（`zuoxian`/`youxian`/`rizhu`/`lihu` 或 `"all"`）忠诚度（夹逼 `0..100`） |
| **S03 日逐怨望** | `add_rizhu_grievance` | `{"val": 20}` | 修改 `state.events.rizhu_grievance = clamp(rizhu_grievance + val, 0, 100)` |
| **S03 单于更替** | `trigger_chanyu_succession` | `{"new_chanyu": "xn_wuwei", "mode": "forged_will"}` | 更替在位单于人物；若 `mode == "forged_will"`（匿丧矫令），失位诸王部忠诚 `-18`，日逐王怨望 `+25`，当季诸王拒绝赴龙城会 |
| **S03/S05 白灾** | `trigger_white_disaster` | `{"severity": "severe"}` | 结算冬季大雨雪白灾：`mild`（轻度）塞外畜群与马匹池 `-15%`、各部忠诚 `-6`；`severe`（重度，当匈奴大军冬季在外时触发）塞外野战军损耗 `35%`、马匹池 `-30%`、各部忠诚 `-15`、单于威望 `-12`，并调用 `Diplomacy.on_white_disaster_weaken(state)` 使全西域匈奴威吓 $X - 10$ |
| **S04 城邦关系** | `modify_city_rel` | `{"state_id": "wu_sun", "inf": 15, "intim": 0, "resent": -5}` | 增减汉对城邦影响力 `inf`、匈奴威吓 `intim`、城邦怨恨 `resent` |
| **S04 罪状生成** | `add_crime_against_han` | `{"state_id": "lou_lan", "crime": "kill_envoy"}` | 向城邦写入合法讨伐罪状 `crimes_against_han`（使汉方出兵免于无名兴师与矫诏惩罚，且破城获 `+4.0` 讨罪战功） |
| **S04 宗主易帜** | `set_city_overlord` | `{"state_id": "lou_lan", "overlord": "han", "enfeoffed": true}` | 变更城邦宗主国与印绶册封状态（如傅介子刺楼兰立尉屠耆） |
| **S04 乌孙和亲** | `set_wusun_marriage` | `{"princess": "han_xijun", "active": true}` | 建立汉乌和亲状态（乌孙汉影响力保底 `>= 45`，解锁联合乌孙发兵） |
| **S05 马匹与钱粮** | `modify_resources` | `{"faction": "han", "money": -400, "grain": 0, "horses": 300, "node": "dun_huang"}` | 增减国库金钱、指定节点存粮或国家马匹池（`Supply.add_horses`） |
| **S05 特殊屯田** | `establish_special_tuntian` | `{"node": "lou_lan", "level": 1}` | 在指定节点直接建立 1 级伊循/渠犁屯田（免除建造周期） |
| **S06 人物状态** | `set_char_status` | `{"char_id": "han_li_guang", "status": "dead", "cause": "suicide"}` | 变更人物状态（`"active"` / `"imprisoned"` / `"defected"` / `"dead"`），若人物正统领军队或使团则自动触发继任交接 |
| **S06 人物叛降** | `defect_character` | `{"char_id": "han_li_guangli", "to_faction": "xiongnu"}` | 人物投降敌方阵营，其统领的残部解散，原阵营信任/威望 `-12` |
| **S06 事件链调度** | `schedule_event` | `{"evt_id": "evt_resentful_ghost", "delay_seasons": 3}` | 将后续事件排入 `delay_seasons` 季后的季初必弹队列 |
| **S06 变量与纪事** | `set_flag_and_chronicle` | `{"flag": "rizhu_window_open", "val": true, "chronicle_key": "chr.rizhu_plea"}` | 设置 `chain_flags` 并向当季《本季纪事》追加一条史官记录 |

---

### 4.3 `S06-R03` 每局中期大事件配额保底机制（对齐 `S01-R12`）

为解决旧版沙盒“中期 15–30 季无事发生、双方纯靠机械运粮对耗”的节奏塌陷问题，同时防止极端随机数导致开局暴毙或满屏弹窗，事件引擎严格执行**三阶段配额与冷却算法**：

#### （1）阶段划分与硬性约束
- **参数默认值（`data/balance.json → events`）**：
  - 新手保护期上限：`protection_end_season = 5`（默认 `5`，可调范围 `3..8`）
  - 中期保底窗口：`quota_window_start = 10`，`quota_window_end = 32`
  - 每局重大事件配额下限与上限：`major_quota_min = 1`（可调 `1..2`），`major_quota_max = 3`（可调 `2..4`）
  - 重大事件最小冷却间隔：`major_cooldown_seasons = 4`（可调 `3..6`，即两次重大事件之间至少间隔 4 个完整季度）

#### （2）每季初重大事件抽签与保底公式（Season Start Major Event Resolver）
设当前季号为 $T = \text{state.season\_idx}$，本局已触发重大事件数为 $C = \text{state.events.major\_events\_count}$，上次触发季号为 $T_{\text{last}} = \text{state.events.last\_major\_event\_season}$：
1. **保护期拦截（$T \le 5$）**：任何带有 `"is_major_quota": true` 的危机事件一律返回 `false`（剧本固定的开局叙事引导事件如《李广迷道》《博望侯二使》标记为 `"is_major_quota": false`，不受此限）。
2. **冷却与配额上限拦截**：若 $C \ge \text{major\_quota\_max}$（即已达 3 次），或 $T - T_{\text{last}} < 4$，所有随机重大危机事件一律返回 `false`。
3. **动态保底乘数 $M_{\text{pity}}(T, C)$（$10 \le T \le 32$）**：
   - 当 $10 \le T \le 17$：标准概率触发，$M_{\text{pity}} = 1.0$。
   - 当 $18 \le T \le 24$ 且 $C == 0$（中期过半仍未出过大事件）：每季触发概率乘数线性递增：
     $$M_{\text{pity}}(T, 0) = 1.0 + 0.25 \times (T - 17)$$
   - 当 $T == 25$ 且 $C == 0$（**硬保底触发点**）：系统强制从当前满足软前置条件（或放宽数值阈值 20%）的候选重大事件池中按权重必抽 1 条触发（$P = 1.0$），确保 100% 的对局在 `T10–T25` 内至少经历 1 次足以改变战略格局的历史大事件！

#### （3）8 类写入 `state.victory.key_events_occurred` 的核心历史事件标签
以下 8 类核心事件一旦触发并完成关键抉择，立即将对应 `key_event_tag` 写入 `state.victory.key_events_occurred`（供 S01 计算终局签名 `end_signature` 与史官评定）：
1. `"rizhu_surrender"`：日逐王率众降汉、罢僮仆都尉（`evt_rizhu_surrender_complete`）
2. `"white_disaster_crisis"`：匈奴遭遇冬季大雨雪白灾瓦解（`evt_white_disaster_collapse`）
3. `"chanyu_succession_crisis"`：单于病逝引发匿丧矫令或诸王内争（`evt_chanyu_succession` / `evt_hidden_mourning`）
4. `"luntai_edict"`：武帝悔征伐、颁布轮台罪己诏转向休息（`evt_luntai_edict`）
5. `"dawan_heavenly_horses"`：贰师将军征大宛夺取善马或盟誓得天马（`evt_dawan_horses_refused` → `evt_heavenly_horses_arrive`）
6. `"loulan_regicide"`：傅介子持节刺楼兰王安归、更立尉屠耆田伊循（`evt_loulan_assassination`）
7. `"wusun_grand_alliance"`：细君/解忧和亲乌孙并促成汉乌联军击匈奴（`evt_wusun_marriage` / `evt_five_generals_wusun`）
8. `"forged_edict_triumph"`：持节使臣便宜矫制发诸国兵立下不世之功（`evt_forged_edict_self_impeach` / `evt_suiyuan_bizhu`）

---

### 4.4 `S06-R04` 人物登场、在场槽上限、寿元检定与史书风候补生成池（对齐 `R-02`）

#### （1）人物登场与汉方 4–6 人具名槽上限
1. **剧本初始化与年代登场**：
   - 开局读取 `scenarios/*.json → characters_init` 激活初始在场人物。
   - 每年 Q1（正月上旬），检查所有 `status == "unborn"` 的史实人物：若当前公元前年份满足 `calendar.year_bce <= abs(char.appear_year)`，则将其转为 `"active"`，部署于 `init_node`，并在当季《本季纪事》记录*“某年春，朝廷拜某某为某官，遣诣敦煌/西域”*。
2. **汉方在场具名人物槽上限（`han_active_char_cap = 6`，标准维持 4–6 人）**：
   - 汉方同时处于 `"active"` 或 `"in_transit"` 的具名人物不得超过 `6` 人（含持节主使 1 人、领兵将领/副使 3–4 人、监军御史 0–1 人）。
   - 若新史实名将到了登场年份但槽位已满 6 人：① 若在场有候补生成人物（`is_generated == true`）且未统领在途大军，自动将其调回长安退役，腾出槽位给史实名将；② 若 6 人全为史实人物，则新人物进入 `reserve_pool`（长安候任池），玩家可在任意季初免费将其与一名驻留敦煌/酒泉的空闲人物轮换。

#### （2）年度寿元与病逝检定公式（每年 Q4 12 月下旬，对齐 `R-01`）
- 设当前公元前年份为 $Y_{\text{cur}}$（正整数，如前 114 年记为 $114$），人物史实卒年为 $Y_{\text{death}} = |\text{char.death\_year}|$：
  - 当 $Y_{\text{cur}} > Y_{\text{death}} + 2$（距离史实卒年尚有 2 年以上）：老死概率为 $0$（仅可能死于战场阵亡、刺杀或特定剧情事件如李广自刎）。
  - 当 $Y_{\text{cur}} \le Y_{\text{death}} + 2$（进入史实卒年前后窗口）：每年 Q4 季末（12 月下旬）先扣除自然衰老健康度 $\Delta H = 15 + 5 \times \max(0, Y_{\text{death}} - Y_{\text{cur}})$，随后检定年度病逝概率 $P_{\text{die}}$：
    $$P_{\text{die}} = \text{clamp}\left(0.20 + 0.25 \times (Y_{\text{death}} - Y_{\text{cur}} + 1) + 0.005 \times (100 - \text{health}),\ 0.05,\ 0.90\right)$$
  - **单于与持节者病逝连锁**：
    - 若病逝者为**在位匈奴单于**（`"chanyu" in role_tags`），立即唤醒 `evt_chanyu_succession`（单于继承三选一事件，见 S03 & `S06-R06`）。
    - 若病逝者为**现任汉方持节主使**（`"holder" in role_tags`），立即从在场汉方人物中按 `command + eloquence` 最高者自动代理节钺（若在场无具名人物，则从候补池立即递补 1 名代理都尉赴敦煌），并触发 `evt_holder_succession`。

#### （3）野战全军覆没与名将阵亡/被俘检定
当一支绑定了具名将领 `char` 的军队在野战或守城中全军覆没（剩余兵力 `<= 0`）时，调用 `Characters.roll_battle_fate(state, char, attacker_faction)`：
- **全身而退概率** $P_{\text{escape}} = \text{clamp}(0.40 + 0.004 \times \text{char.caution},\ 0.25,\ 0.80)$：将领仅受轻伤（`health -= 20`），3 旬后返回最近的己方控制城池。
- **阵亡概率** $P_{\text{killed}} = (1 - P_{\text{escape}}) \times \text{clamp}(0.30 + 0.004 \times \text{char.valor},\ 0.30,\ 0.70)$：将领阵亡（`status = "dead"`），敌方获得阵斩名将战功（对齐 S01 `Victory.record_event_award`），并记入《本季纪事》。
- **被俘概率** $P_{\text{captured}} = 1 - P_{\text{escape}} - P_{\text{killed}}$：汉将被匈奴俘获时，立即触发事件链 **`evt_sacrifice_captive`（祠兵/招降二选一，见事件 #15）**——匈奴可选择“屠以祠兵”振奋士气（但随后遇白灾将触发 #16《冤魂作祟》），或“以女妻之、厚待招降”（如李广利、赵破奴、李陵故事）。

#### （4）史书风候补人物生成池（Fallback Procedural Pool，对齐 `Q-S02-03` & `R-02`）
当汉方在场具名人物因阵亡/老死跌破 `< 3` 人且当前年份无待登场史实人物，或触发监军巡边而史实御史已耗尽时，`Characters.generate_fallback_character(state, role)` 使用 `GameState.rng` 从以下汉代史实语料库中无重名组合生成候补人物（`is_generated = true`）：
- **官号池（`fallback_titles`）**：
  - 将领类：`["护羌校尉", "戊己校尉", "屯田校尉", "强弩都尉", "骑都尉", "塞外都尉"]`
  - 使臣类：`["太中大夫", "中郎将", "谒者", "侍郎", "译长", "守属国都尉"]`
  - 监军类：`["侍御史", "绣衣直指", "丞相司直", "廷尉史"]`
- **姓氏与名讳池（`fallback_names`）**：
  - 姓氏：`["辛", "公孙", "韩", "田", "王", "杨", "杜", "任", "郭", "陈", "赵", "苏"]`
  - 名讳：`["武贤", "敖", "增", "广明", "顺", "奉", "延年", "破胡", "昌", "褒", "充", "庆忌"]`
- **匈奴候补部王池**：`["呼衍·左大将", "须卜·右谷蠡王", "兰氏·丁零王", "丘林·休屠王", "挛鞮·左日逐王"]`
- **候补人物属性分布**：`command, valor, eloquence, caution` 均由 `int(clamp(rng.randfn(60.0, 6.0), 48, 72))` 生成（严格落在 R-02 规定的普通将使 `50–70` 区间，绝不超越 `80+` 的史实名将），自带 1 个基础特性（如 `trait_cautious_official` 循吏守成）。

---

### 4.5 `S06-R05` EA 25 名史实人物完整花名册与特性词表

> **数据对齐说明**：
> 1. 遵循 **[R-02]**，全部人物的四维能力（`command` 统率、`valor` 勇武、`eloquence` 辞令、`caution` 谨慎）均为 `0–100` 整数；表中同时列出导出属性 `command_tier = round(command / 10.0)`（`0..10`），供 S05 战斗公式 `1 + 0.03 * (command_tier - 3)` 直接调用。
> 2. 完整覆盖 **[S02→S06]**（张骞、赵破奴、李广利、傅介子、常惠、郑吉、冯奉世、杜周、暴胜之）、**[S03→S06]**（历代单于、四部王、日逐王先贤掸/呼衍骨、僮仆都尉）、**[S04→S06]**（`eloquence`、`trait_pioneer` 凿空者、`trait_resolute` 勇决）与 **[S05→S06]**（`trait_greedy`、`trait_ambusher`、`trait_stern`、赖丹）的全部人物 ID 与特性钩子。

#### （1）汉方史实人物花名册（13 人）

| ID (`id`) | 姓名与官爵 (`name_zh` / `courtesy_title`) | 角色标签 (`role_tags`) | 登场/卒年 (`appear` / `death`) | 初始节点 (`init_node`) | 统率 `command` (`tier`) | 勇武 `valor` | 辞令 `eloquence` | 谨慎 `caution` | 封侯执念 `ambition` | 专属特性 Tag ×2 (`traits`) |
|---|---|---|---|---|---|---|---|---|---|---|
| `han_zhang_qian` | **张骞**（博望侯·中郎将） | `holder`, `envoy` | `-119` / `-114` | `dun_huang` | 68 (`7`) | 62 | **96** | 84 | 60 | `trait_pioneer`, `trait_bowang_credit` |
| `han_zhao_ponu` | **赵破奴**（浞野侯·从票侯） | `holder`, `general` | `-119` / `-91` | `jiu_quan` | 82 (`8`) | **88** | 58 | 52 | 85 | `trait_ambusher`, `trait_light_raider` |
| `han_li_guang` | **李广**（前将军·飞将军） | `general` | `-119` / `-119` | `dun_huang` | 78 (`8`) | **95** | 50 | 35 | 95 | `trait_unlucky_path`, `trait_flying_general` |
| `han_lu_bode` | **路博德**（伏波将军·强弩都尉） | `general` | `-119` / `-99` | `ju_yan` | 80 (`8`) | 75 | 64 | 78 | 65 | `trait_crossbow_wall`, `trait_shame_rear` |
| `han_li_guangli` | **李广利**（贰师将军·海西侯） | `holder`, `general` | `-105` / `-88` | `dun_huang` | 72 (`7`) | 70 | 55 | 42 | **92** | `trait_greedy`, `trait_imperial_inlaw` |
| `han_xijun` | **刘细君**（江都公主·乌孙右夫人） | `princess`, `envoy` | `-108` / `-101` | `chang_an` | 30 (`3`) | 25 | **85** | 76 | 20 | `trait_yellow_swan`, `trait_royal_bride` |
| `han_jieyou` | **刘解忧**（楚王孙女·乌孙公主） | `princess`, `envoy` | `-101` / `-49` | `wu_sun` | 55 (`6`) | 48 | **92** | 85 | 50 | `trait_wusun_matriarch`, `trait_royal_bride` |
| `han_fu_jiezi` | **傅介子**（义阳侯·平乐监） | `holder`, `envoy` | `-80` / `-65` | `dun_huang` | 66 (`7`) | **89** | **86** | 28 | **90** | `trait_resolute`, `trait_forger` |
| `han_chang_hui` | **常惠**（长罗侯·光禄大夫） | `holder`, `general`, `envoy` | `-78` / `-46` | `dun_huang` | 84 (`8`) | 76 | **88** | 79 | 75 | `trait_vassal_levy`, `trait_veteran_envoy` |
| `han_zheng_ji` | **郑吉**（安远侯·西域都护） | `holder`, `general`, `envoy` | `-72` / `-49` | `lun_tai` | **86 (`9`)** | 74 | 82 | 82 | 75 | `trait_tuntian_master`, `trait_welcomer` |
| `han_feng_fengshi` | **冯奉世**（关内侯·卫候使者） | `holder`, `general`, `envoy` | `-68` / `-39` | `dun_huang` | 85 (`9`) | 80 | **87** | 68 | 82 | `trait_vassal_levy`, `trait_forger` |
| `han_du_zhou` | **杜周**（廷尉·侍御史监军） | `censor` | `-115` / `-94` | `chang_an` | 52 (`5`) | 40 | 78 | **90** | 60 | `trait_harsh_censor`, `trait_stern` |
| `han_bao_shengzhi` | **暴胜之**（绣衣直指·御史监军） | `censor` | `-100` / `-91` | `chang_an` | 60 (`6`) | 55 | 80 | **86** | 65 | `trait_harsh_censor`, `trait_stern` |

---

#### （2）匈奴史实人物花名册（7 人主表 + 历代继承单于子表）

| ID (`id`) | 姓名与称号 (`name_zh` / `courtesy_title`) | 角色标签 (`role_tags`) | 登场/卒年 (`appear` / `death`) | 初始节点 (`init_node`) | 统率 `command` (`tier`) | 勇武 `valor` | 辞令 `eloquence` | 谨慎 `caution` | 封侯/汗位执念 `ambition` | 专属特性 Tag ×2 (`traits`) |
|---|---|---|---|---|---|---|---|---|---|---|
| `xn_yizhixie` | **伊稚斜**（伊稚斜单于） | `chanyu`, `general` | `-119` / `-114` | `chanyu_ting` | **88 (`9`)** | 86 | 65 | 72 | 90 | `trait_strict_punisher`, `trait_steppe_overlord` |
| `xn_woyanqudi` | **握衍朐鞮**（握衍朐鞮单于·屠耆堂） | `chanyu`, `general` | `-68` / `-58` | `chanyu_ting` | 70 (`7`) | 78 | 45 | 38 | **95** | `trait_tyrant`, `trait_strict_punisher` |
| `xn_xubu_she` | **须卜奢**（左贤王·东方大部首领） | `tribe_king`, `general` | `-119` / `-70` | `chanyu_ting` | 82 (`8`) | 80 | 68 | 75 | 80 | `trait_eastern_pillar`, `trait_ambusher` |
| `xn_xiutu_yu` | **休屠余**（右贤王·西方大部首领） | `tribe_king`, `general` | `-119` / `-65` | `right_wise_court` | 80 (`8`) | 84 | 60 | 64 | 75 | `trait_steppe_raider`, `trait_greedy` |
| `xn_huyan_gu` | **呼衍骨**（前代日逐王 / 兼领犁汙前锋） | `tribe_king`, `general` | `-119` / `-85` | `yan_qi` | 78 (`8`) | 76 | 66 | 70 | 72 | `trait_tongpu_master`, `trait_steppe_raider` |
| `xn_xianxianshan` | **先贤掸**（日逐王·狐鹿姑单于之子） | `tribe_king`, `general` | `-85` / `-55` | `yan_qi` | **84 (`8`)** | 78 | 74 | 76 | **88** | `trait_resentful_prince`, `trait_tongpu_master` |
| `xn_tongpu_duwei` | **呼衍都尉**（僮仆都尉·驻焉耆危须间） | `tongpu`, `general` | `-119` / `-60` | `yan_qi` | 74 (`7`) | 72 | 62 | 68 | 60 | `trait_tax_extortionist`, `trait_stern` |

> **【S03 历代单于继承链与四部扩展子表】**：为完整支持 S03 `evt_chanyu_succession` 在前 119–前 60 年间的多次王位更替及 `lihu`（犁汙王）独立带兵，`data/characters.json` 的 `xiongnu_successors` 子表内建以下 4 名世系人物（不占初始 25 人名牌展示，按继承事件动态升格为主单于）：
> - `xn_wuwei`（**乌维单于**，`-114` 至 `-105`，统率 76 `tier=8` / 勇武 70 / 辞令 72 / 谨慎 82，特性 `trait_conservative_khan` 守成休养：每季自然恢复马匹池 `+80`、各部忠诚衰减减半）。
> - `xn_wushilu`（**乌师庐·儿单于**，`-105` 至 `-102`，统率 68 `tier=7` / 勇武 85 / 辞令 48 / 谨慎 32，特性 `trait_young_bellicose` 年少好杀：骑兵冲击 `+10%`，但每年各部忠诚 `-5` 且白灾损耗 `+20%`）。
> - `xn_xuluquanqu`（**虚闾权渠单于**，`-68` 至 `-60`，统率 82 `tier=8` / 勇武 78 / 辞令 75 / 谨慎 78，特性 `trait_steppe_overlord` 振作纲纪：病逝时必触发 `evt_hidden_mourning` 颛渠阏氏匿丧矫令立握衍朐鞮，直接引爆先贤掸降汉危机）。
> - `xn_lihu_wang`（**蒲奴·犁汙王**，驻 `yi_wu` 伊吾前锋部 `lihu` 首领，统率 75 `tier=8` / 勇武 82 / 辞令 52 / 谨慎 58，特性 `trait_ambusher` 轻骑奇袭 + `trait_beacon_raider` 拔燧好手）。

---

#### （3）西域城邦及大国史实人物花名册（5 人）

| ID (`id`) | 姓名与国别身份 (`name_zh` / `courtesy_title`) | 所属城邦 (`home_state`) | 登场/卒年 (`appear` / `death`) | 初始节点 (`init_node`) | 统率 `command` (`tier`) | 勇武 `valor` | 辞令 `eloquence` | 谨慎 `caution` | 特性 Tag ×2 (`traits`) |
|---|---|---|---|---|---|---|---|---|---|
| `cs_liejiaomi` | **猎骄靡**（乌孙大昆弥·昆莫） | `wu_sun` | `-119` / `-103` | `wu_sun` | 80 (`8`) | 78 | 74 | **85** | `trait_dual_marriage`, `trait_nomad_king` |
| `cs_wengguimi` | **翁归靡**（乌孙昆弥·肥王） | `wu_sun` | `-93` / `-60` | `wu_sun` | **84 (`8`)** | 80 | 78 | 76 | `trait_pro_han_allied`, `trait_nomad_king` |
| `cs_angui` | **安归**（楼兰王·尝质匈奴） | `lou_lan` | `-92` / `-77` | `lou_lan` | 64 (`6`) | 62 | 70 | 48 | `trait_envoy_raider`, `trait_two_faced` |
| `cs_mugua` | **毋寡**（大宛王·守贰师城） | `da_yuan` | `-119` / `-101` | `da_yuan` | 74 (`7`) | 70 | 55 | 45 | `trait_hoard_horses`, `trait_walled_defender` |
| `cs_laidan` | **赖丹**（扜弥太子·汉屯田校尉） | `yu_mi` / `han` | `-88` / `-78` | `lun_tai` | 68 (`7`) | 65 | 72 | 50 | `trait_foreign_colonizer`, `trait_tuntian_master` |

---

#### （4）人物特性词表与精确数值修正表（Trait Modifiers Dictionary）

所有特性定义于 `data/characters.json → trait_definitions`，供 S02/S03/S04/S05 直接按 ID 查询：

| 特性 ID | 中文名称 | 适用对象 | 精确数值修正与跨系统机制钩子 |
|---|---|---|---|
| `trait_greedy` | **贪功好利** | 李广利、休屠余 | **[对齐 S05]** 统兵执行强征/掠食时，城邦怨恨增量 `×1.35`；攻克城池时私吞战利品导致朝廷信任 `-3`（汉）或单于赏赐池少入账 `-25%`（匈奴） |
| `trait_ambusher` | **轻骑奇袭** | 赵破奴、须卜奢 | **[对齐 S05]** 统领纯骑兵部队（兵力 `<= 3,000`）时，行军速度 `+15%`，在 `ambush_road` 地形触发伏击检定成功率 `+25%`，首轮冲击伤害 `+15%` |
| `trait_stern` | **治军严酷** | 杜周、暴胜之、呼衍都尉 | **[对齐 S05]** 部队断粮哗变阈值延后 1 旬，野战防御 `+8%`；但每季自然非战斗减员 `+2%`，驻扎城邦时每季额外增加 `+2` 怨恨 |
| `trait_pioneer` | **凿空者** | 张骞 | **[对齐 S04/S05]** 率精使团出使时，视野半径 `+1` 跳，永久揭开途经节点的地理拓扑迷雾；首次抵达大国（乌孙/大宛/康居）时额外获得 `+15` 汉影响力 |
| `trait_bowang_credit` | **博望遗信** | 张骞 | **[对齐 S04]** 张骞在场或病逝后（只要曾出使西域），汉方后续所有精使团执行 `lobby_influence` 基础成功率永久 `+8%`（“诸后使往者皆称博望侯以为质于外国”） |
| `trait_resolute` | **勇决刺王** | 傅介子 | **[对齐 S04]** 执行外交奇袭/刺杀（如 `evt_loulan_assassination`）成功率 `+35%`；面对有罪状城邦执行 `intimidate` 时汉威慑效果 `+25%` |
| `trait_forger` | **便宜矫制** | 傅介子、冯奉世 | **[对齐 S02]** 发起未授权行动（矫诏）时，当次行动战力/出使成功率 `+15%`，且若行动大获全胜，上疏自劾（`self_impeach`）豁免惩罚概率 `+30%` |
| `trait_vassal_levy` | **以节发兵** | 常惠、冯奉世 | **[对齐 S02/S04]** 调用 `Diplomacy.levy_vassal_troops` 征调 2 跳内属国兵时，可征上限 `+40%`，且属国怨恨增加减半 |
| `trait_tuntian_master` | **屯田校尉** | 郑吉、赖丹 | **[对齐 S05]** 驻守屯田节点时，该节点秋收屯田产粮 `+25%`，修筑屯田耗时缩短 `2` 旬 |
| `trait_welcomer` | **招降纳叛** | 郑吉 | **[对齐 S01/S03]** 9 旬窗口内迎降动摇匈奴部王（特别是日逐王）时，判定门槛放宽（需兵力从 `3,000` 降至 `2,400`），且额外多接收 `+500` 归义胡骑 |
| `trait_harsh_censor` | **深文峻法** | 杜周、暴胜之 | **[对齐 S02]** 作为监军御史在场时，汉方任何败仗、丢城或未授权矫诏扣除的朝廷信任 `×1.40`，但每季贪腐损耗归零、奏请拨款审批通过率 `+15%` |
| `trait_light_raider` | **七百骑擒王** | 赵破奴 | **[对齐 S01/S04]** 率 `<= 2,000` 轻骑围攻守军 `<= 1,500` 的有罪小国（如楼兰）时，可直接触发突袭擒王检定，无需漫长围城 |
| `trait_shame_rear` | **羞为后距** | 路博德 | **[对齐 S02/S05]** 作为主力统帅时守城与强弩战力 `+12%`；但若被指派给 `ambition_marquis > 85` 的外戚将领（如李广利）充当后援运粮军，每季有 `20%` 概率触发拖延（行军速度 `-25%`） |
| `trait_unlucky_path` | **数奇迷道** | 李广 | **[对齐 S05/S06]** 野战勇武极高，但在沙漠/草原无向导行军时迷路损耗概率 `+20%`，前 119 年开局触发 `#1 李将军迷道` 事件 |
| `trait_strict_punisher` | **严罚军法** | 伊稚斜、握衍朐鞮 | **[对齐 S03]** 可对战败部王执行严惩以恢复单于威望 `+8`，但被罚部王忠诚度额外 `-18` 且日逐王怨望 `+15`（加速部王叛降汉朝） |
| `trait_tyrant` | **暴虐猜忌** | 握衍朐鞮 | **[对齐 S03]** 在位期间每季所有非直属部族忠诚度额外 `-4`，日逐王怨望每季自然 `+8` |
| `trait_resentful_prince` | **怨望贵人** | 先贤掸 | **[对齐 S01/S03]** 当单于威望 `< 50` 或龙城大会未获赏赐时，`rizhu_grievance` 增速 `×1.5`；一旦 `>= 70` 即向汉方渠犁发送请降密信 |
| `trait_tongpu_master` | **统摄僮仆** | 先贤掸、呼衍骨 | **[对齐 S03/S04]** 在位且未叛降时，维持僮仆都尉运转（西域属国匈奴威吓保底 `X_floor = 30`）；一旦降汉或阵亡，僮仆都尉立即罢免 |
| `trait_pro_han_allied` | **愿发国兵** | 翁归靡 | **[对齐 S04]** 乌孙处于汉和亲状态时，响应汉使（如常惠）联合出兵击匈奴的兵力规模 `+50%`（最高可发 5,000 乌孙骑兵协战） |
| `trait_hoard_horses` | **匿马拒汉** | 毋寡 | **[对齐 S04/S05]** 汉方通过常规贸易求购大宛善马必定被拒，触发 `#8 宛王匿马` 事件链；唯兵临城下破其外城或斩毋寡立昧蔡方可获汗血良马 |
| `trait_foreign_colonizer`| **外籍校尉** | 赖丹 | **[对齐 S05/S06]** 在轮台/渠犁主持屯田时，对邻国龟兹产生的 `tuntian_pressure` 每季额外 `+8`；当压迫值 `>= 60` 时必触发 `#18 赖丹之死` |
| `trait_yellow_swan` | **黄鹄之歌** | 刘细君 | **[对齐 S04]** 驻乌孙期间每季为汉提供 `+3` 乌孙影响力，但每年自身 `health -18`（水土不服早逝，死后触发续娶解忧公主事件） |
| `trait_wusun_matriarch` | **三代国母** | 刘解忧 | **[对齐 S04]** 驻乌孙期间汉影响力保底 `+15`，当匈奴侵逼乌孙时主动触发《上书求援》事件开启五将军联军窗口 |
| `trait_envoy_raider` | **遮杀汉使** | 安归 | **[对齐 S04]** 当匈奴对楼兰威吓 `> 50` 时，途经楼兰的汉方使团被劫掠/扣留概率 `+30%`（自动为汉方累积讨伐罪状） |

---

### 4.6 `S06-R06` EA 40 条事件完整设计表（史实 24 条核心链 + 16 条军政/边塞事件）

> **格式说明**：表中 `✦` 标记史实默认路径；`[大事件]` 表示 `is_major_quota = true`（受 `S06-R03` T1–T5 保护期与 T10–T32 保底配额约束）；括号内数字如 `[AI:75]` 表示该选项的基础 `ai_weight`。

#### （1）第一组：史料 24 条核心叙事事件链（`#01`–`#24`，完全对齐 `report_history.md` §四及 S01–S05 接口）

| # | 事件 ID 与标题 | 阵营 / 类别 | 触发条件 (`trigger`) | 史书风正文草稿（≤120 字） | 选项、精确数值效果 (`effects`) 与 `ai_weight` |
|---|---|---|---|---|---|
| 01 | `evt_li_guang_lost`<br>**李将军迷道** | 汉 / 人物链<br>(`once`) | `scn_mobei` T1 季初，`han_li_guang` 在场 | 前将军李广出东道，惑失道，后大将军。大将军青阴受上诫，遣长史急责广之幕府对簿。广谓其麾下曰：“广结发与匈奴大小七十余战，今迷失道，岂非天哉！” | **A✦ 拔刀自刭，全将门气节** `[AI:70]`：`han_li_guang` 亡，全军士气 `+10`（2季），写标记 `longxi_resentment=true`<br>**B 上书赎罪，贬为庶人** `[AI:30]`：`trust -5`，`money -200`，李广停职 12 季后复出 |
| 02 | `evt_zhang_qian_wusun`<br>**博望侯二使乌孙** | 汉 / 外交链<br>(`once`) | `han_zhang_qian` 在场且 `year_bce <= 118` | 博望侯张骞进言：“今单于新困于汉，故浑邪地空。诚以此际厚币赂乌孙，招以东居故地，与汉结昆弟，是断匈奴右臂也。” | **A✦ 将三百人、牛羊万头出使** `[AI:80]`：`money -450`，乌孙 `inf +25`，分遣副使揭开大宛/康居/大月氏迷雾且各 `inf +12`<br>**B 简从轻骑直诣赤谷城** `[AI:20]`：`money -150`，乌孙 `inf +15` |
| 03 | `evt_wusun_marriage`<br>**乌孙求聘与昆莫两妻** | 汉 / 外交链<br>**[大事件]** | 乌孙 `inf >= 40` 且未和亲（对齐 **S04**） | 乌孙昆莫猎骄靡遣使献马千匹，愿尚汉公主结昆弟。然匈奴闻之亦遣女妻昆莫，昆莫以汉公主为右夫人，匈奴女为左夫人。 | **A✦ 遣江都王女细君往妻之** `[AI:80]`：`money -300`，激活 `set_wusun_marriage(han_xijun)`，乌孙 `inf +25`，马匹 `+500`，记 `wusun_grand_alliance`<br>**B 赐金帛厚答，婉拒婚约** `[AI:15]`：`money -150`，乌孙 `inf -10`<br>**C 责其立匈奴女为左，绝使** `[AI:5]`：乌孙 `inf -25`，`trust +3` |
| 04 | `evt_wusun_levirate`<br>**从其国俗** | 汉 / 外交链<br>(`once`) | 已和亲乌孙，且 `cs_liejiaomi` 病逝或 `year_bce <= 103` | 乌孙昆莫年老，欲使其孙岑陬尚公主。公主不肯，上书言状曰：“愿得归骸骨汉地。”天子报曰：“从其国俗，欲与乌孙共灭胡！” | **A✦ 诏令从其国俗，再适岑陬** `[AI:75]`：维持和亲，乌孙 `inf +15`，细君 `health -30`（3季后由解忧接替）<br>**B 迎公主归长安** `[AI:25]`：和亲解除，乌孙 `inf -20`，`trust +4` |
| 05 | `evt_envoy_killed`<br>**汉使受辱与死节** | 汉 / 外交链<br>(`cooldown=3`) | 汉使团途经匈奴威吓 `X >= 50` 城邦（对齐 **S04**） | 楼兰、姑师当道苦之，数遮略汉使王恢等，绝其水草，甚或攻劫使者。使者泣血持节，飞章告变于敦煌幕府。 | **A✦ 暴其罪状于朝，请兵讨罪** `[AI:70]`：目标国生成 `add_crime_against_han("kill_envoy")`，`trust -2`<br>**B 忍辱吞声，重币买道** `[AI:15]`：`money -150`，`trust -6`，城邦 `intim +8`<br>**C 令使者便宜募胡骑格杀报复** `[AI:15]`：50% 概率斩其贵人（`inf +12`），50% 概率使者死节（`trust -6`，生成双倍罪状） |
| 06 | `evt_bound_horse_curse`<br>**缚马之书** | 汉匈 / 军事链<br>(`cooldown=6`) | 匈奴执行示弱/诅军或汉军围攻匈奴据点 | 匈奴将缚马前后足，置城下，驰言曰：“秦人，我丐若马！”巫者视之，或言此匈奴诅军之术，或言匈奴马足自缚乃天亡胡之兆。 | **A✦ 视为天赐吉兆，挥师急击** `[AI:65]`：本季汉军攻击 `+12%`，但若战败则 `emperor_regret +20`、`trust -10`<br>**B 疑有伏兵诅术，按甲固守** `[AI:35]`：汉军本季防御 `+10%`，匈奴获 `+100` 赏赐池喘息 |
| 07 | `evt_heavenly_horses_arrive`<br>**天马来·作天马歌** | 汉 / 军政链<br>(`once`) | 汉单次获乌孙/大宛良马 `>= 300` 匹 | 西极天马至玉门，体姿神骏，汗血霑赤。有司奏曰：“天马徕，从西极，涉流沙，九夷服。”请择上驷献诸太庙甘泉宫。 | **A✦ 献良马百匹入长安，作《天马歌》** `[AI:75]`：`horses -100`，`trust +15`，`emperor_regret -15`，`permanent_deed +5`<br>**B 尽留敦煌军中，充实塞外铁骑** `[AI:25]`：`horses +100`（不扣），`trust -4`，骑兵冲击永久 `+5%` |
| 08 | `evt_dawan_horses_refused`<br>**宛王匿马杀使** | 汉 / 破局链<br>**[大事件]** | `year_bce <= 105` 或汉求马被大宛拒绝（对齐 **S04**） | 汉使壮士车令等持千金及金马以请宛王毋寡善马。宛相与谋曰：“汉去我远，盐水往往乏食，安能奈我何？”遂椎金马，杀汉使于郁成。 | **A✦ 拜贰师将军李广利，发罪人兵讨宛** `[AI:75]`：大宛生成 `kill_envoy` 罪状，签发 `edict_conquer_dawan`，`han_li_guangli` 登场，记 `dawan_heavenly_horses`<br>**B 遣精使再携重金议和求马** `[AI:15]`：`money -500`，`trust -8`<br>**C 塞外道远，奏请罢宛役** `[AI:10]`：`trust -12`（武帝震怒） |
| 09 | `evt_shouxiang_city_pact`<br>**受降城之约** | 汉 / 军事链<br>**[大事件]** | 匈奴白灾后或某部王 `loyalty < 25` | 匈奴左大都尉欲杀单于降汉，密遣人语汉曰：“我欲杀单于降汉，汉远，即兵来迎我，我即发。”乞汉筑受降城并发骑接应。 | **A✦ 遣浞野侯赵破奴将二万骑出塞接应** `[AI:70]`：`money -300`；60% 概率接应成功（得 `2,500` 胡骑，匈奴 `prestige -15`）；40% 概率密谋败露遭伏击（汉军损 40%，赵破奴被俘）<br>**B 筑塞垣观望，不遣大军深入** `[AI:30]`：`money -150`，密谋部领被单于诛杀，匈奴各部 `loyalty -8` |
| 10 | `evt_family_implicated`<br>**家室在吏（巫蛊之祸）** | 汉 / 政治链<br>**[大事件]** | `year_bce <= 92` 且有具名汉将在外统兵 | 长安巫蛊狱起，丞相刘屈氂及贰师将军李广利家室皆坐收系吏。幕府从事夜入军帐密告曰：“君侯家属已下狱，还则伏诛，不若立大功以赎，或早自为计！” | **A 即遵朝命，释兵权诣廷尉对狱** `[AI:30]`：将领状态置 `"imprisoned"`，`trust +5`<br>**B✦ 秘不发丧，督全军孤注一掷急战** `[AI:50]`：本季该军战力 `+20%`，若本季未获大捷则将领执行 `defect_character("xiongnu")` 投降匈奴<br>**C 上疏力保将门无罪** `[AI:20]`：`trust -10`，`precedent +10`，将领留任 |
| 11 | `evt_luntai_edict`<br>**轮台罪己诏** | 汉 / 破局链<br>**[大事件]** | `emperor_regret >= 80` 或远征全军覆没 `>= 5000` 人 | 桑弘羊等奏言轮台东有溉田五千顷，请遣屯田卒置校尉。天子追悔往昔征伐之苦，下诏深陈既往之悔曰：“当今之务，在于禁苛暴，止擅赋，力本农，修马复令！” | **A✦ 奉诏罢远征，封丞相为富民侯（转入休息）** `[AI:100]`：`set_court_wind("rest", 20)`，关闭远征诏令，激活轮台诏远距屯田限制，每季拨款 `+200`、马匹恢复 `+100`，记 `luntai_edict` |
| 12 | `evt_hidden_mourning`<br>**匿丧矫令** | 匈奴 / 继承链<br>**[大事件]** | 在位单于病逝，触发继承时（对齐 **S03**） | 单于病甚，遗命立大贵人先贤掸等。既薨，颛渠阏氏与右贤王私通，秘不发丧，矫单于令立少子或旁支。诸王闻之大哗。 | **A 遵先单于遗命，迎立长贵（先贤掸/左贤王）** `[AI:35]`：`prestige +5`，`rizhu_grievance = 0`，但阏氏派叛乱（`youxian.loyalty -20`）<br>**B✦ 秘不发丧，矫令扶立新主** `[AI:65]`：`reward_pool +300`，但失位诸王拒绝赴龙城会（`all.loyalty -15`，`rizhu_grievance +30`），记 `chanyu_succession_crisis` |
| 13 | `evt_xianxianshan_passed_over`<br>**先贤掸不得代** | 匈奴 / 日逐链<br>(`once`) | `xn_xianxianshan` 在场且单于继承未立先贤掸 | 狐鹿姑单于临终谓诸贵人曰：“我子少，不能治国，当立弟右谷蠡王。”及后再传位，先贤掸终不得代，乃改封为日逐王，居西边，掌僮仆都尉。 | **A✦ 授以日逐王印，令专制西域僮仆赋税** `[AI:70]`：`rizhu_grievance +25`，`rizhu.loyalty +10`，保持 `tongpu_active = true`<br>**B 夺其西边兵权，召入单于庭监管** `[AI:30]`：`rizhu_grievance +45`，`rizhu.loyalty -25`（极速引爆请降链） |
| 14 | `evt_dig_well_build_fort`<br>**穿井筑城之议** | 匈奴 / 军政链<br>(`once`) | 匈奴拥有汉降将或 `season_idx >= 12` | 汉降人卫律等言于单于曰：“穿井筑城，治楼以藏谷，与秦人守之，汉兵至无奈我何。”然诸老贵人皆谏曰：“匈奴不能守城，筑城适足为秦人积粟耳！” | **A 采卫律策，于赵信城/右贤庭筑城积粟** `[AI:35]`：`reward_pool -300`，该节点防御 `+25%`、存粮 `+3,000` 斛（但若被汉军攻破则全数资敌）<br>**B✦ 从老贵人言，罢筑城，逐水草迁徙** `[AI:65]`：`prestige +6`，骑兵机动維持无损 |
| 15 | `evt_sacrifice_captive`<br>**祠兵与招降** | 匈奴 / 军事链<br>(`cooldown=4`) | 匈奴在野战中俘获汉方具名将领（`S06-R04`） | 匈奴生得汉将。卫律等害其宠，阴教巫者言：“太卜云，当以汉大将祠兵，神乃降福！”或劝单于以女妻之、封王置右校以收其用。 | **A 听巫者言，屠汉将以祠兵神** `[AI:45]`：`prestige +10`，全军士气 `+15%`，汉将死亡；排入 `schedule_event("evt_resentful_ghost", 3)`<br>**B✦ 厚待汉将，赐单于女，拜为右校王** `[AI:55]`：`reward_pool -200`，该将领转为匈奴客将，对汉军作战战术洞察 `+10%` |
| 16 | `evt_resentful_ghost`<br>**冤魂作祟** | 匈奴 / 灾害链<br>(`once`) | `#15` 选 A 后 4 季内遇冬季或白灾 | 自杀汉将祠兵后，连雨雪数月，畜产死，人民疫病，谷稼不熟。单于恐，卜之，巫言：“汉将神怒曰：我本欲降，何故杀我？” | **A✦ 筑祠室，以牛羊厚祭汉将亡魂** `[AI:75]`：`reward_pool -250`，`prestige -5`，解除疫病减员<br>**B 斩妄言巫者，严令部众不得语怪** `[AI:25]`：`prestige -15`，各部 `loyalty -10`，塞外马匹池额外 `-15%` |
| 17 | `evt_loulan_plea_yixun`<br>**鄯善新王请屯伊循** | 汉 / 屯田链<br>(`once`) | `#25` 傅介子刺楼兰立尉屠耆后（对齐 **S04/S05**） | 新立鄯善王尉屠耆泣谓汉使曰：“身在汉久，今归单弱，而前王有子在匈奴，恐为所杀。国中有伊循城，其地肥美，愿汉遣一将屯田积谷，我得依其威重！” | **A✦ 遣司马一人、吏士四十人田伊循以镇抚之** `[AI:90]`：`money -200`，调用 `establish_special_tuntian("lou_lan", 1)`，楼兰 `inf +25`、永久锁定亲汉<br>**B 赐印绶金帛，令其自募国人防守** `[AI:10]`：4 季后匈奴前王子反攻概率 `60%` |
| 18 | `evt_laidan_killed`<br>**赖丹之死（龟兹杀校尉）** | 汉 / 屯田链<br>**[大事件]** | `tuntian_pressure["qiu_ci"] >= 60`（对齐 **S05**） | 汉以故扜弥太子赖丹为校尉，将军屯田轮台，与渠犁地皆相连。龟兹贵人姑翼谓其王曰：“赖丹本臣属吾国，今佩汉印绶来迫吾国而田，必为害！”王即杀赖丹，而上书谢罪于汉。 | **A✦ 记大罪状，待傅介子/常惠问罪斩姑翼** `[AI:75]`：`cs_laidan` 亡，龟兹生成 `kill_envoy` 重罪状，`trust -4`<br>**B 立即发渠犁屯卒强攻龟兹** `[AI:15]`：立即交战，若无诏书计入矫诏<br>**C 受其谢罪书，置而不问** `[AI:10]`：`trust -12`，全西域汉 `inf -10` |
| 19 | `evt_forged_edict_self_impeach`<br>**矫制自劾** | 汉 / 政治链<br>(`cooldown=3`) | 持节使臣发起未授权发兵/奇袭（对齐 **S02**） | 持节使者见塞外机不可失，若请诏往返必逾旬月，乃与副校尉定议矫制发诸国兵。出师之日，使者按剑叹曰：“专命之罪，吾独当之！” | **A✦ 一面发兵出击，一面飞章上疏自劾待罪** `[AI:80]`：`trust -4`，`precedent +8`，若本季取胜则豁免降罪并返还 `trust +12`，记 `forged_edict_triumph`<br>**B 秘不奏闻，欲待大捷后一并报功** `[AI:20]`：暂不扣信任，但若战败或有监军在场则 `trust -22`、`precedent +20` |
| 20 | `evt_white_disaster_collapse`<br>**塞外大雨雪（白灾瓦解）** | 匈奴 / 破局链<br>**[大事件]** | Q4 冬季（12月下旬），匈奴大军在外或随机检定（对齐 **S03**） | 是岁冬，匈奴大雨雪，平地深数尺，畜产死，人民疫病，谷稼不熟，单于庭及诸王部冻馁者什三四。丁零乘弱攻其北，乌桓入其东，乌孙击其西！ | **A✦ 开单于庭内库振赡诸部，收缩西域防线** `[AI:70]`：执行 `trigger_white_disaster("severe")`，`reward_pool -400`，保住各部 `loyalty` 少跌 `+8`，记 `white_disaster_crisis`<br>**B 严令诸部自筹冬草，催逼西域倍输岁币** `[AI:30]`：执行 `trigger_white_disaster("severe")`，各部 `loyalty -18`，`rizhu_grievance +20`，全西域怨恨 `+15` |
| 21 | `evt_five_chanyus_omen`<br>**诸王乖离·分裂之兆** | 匈奴 / 危机链<br>**[大事件]** | `chanyu_prestige < 30` 且 `>= 2` 部 `loyalty < 30` | 单于威信既失，诸王各自拥兵自重，呼揭王、唯犁当户等阴相缔结，欲各立单于。草原人心惶惶，大帐号令不出百里。 | **A 大散金帛良马，会诸王于龙城泣血盟誓** `[AI:65]`：`reward_pool -500`，`horses -400`，`prestige +15`，各部 `loyalty +15`<br>**B 借故诱杀异己部王，以铁腕镇压** `[AI:35]`：`prestige +8`，但检定 50% 概率导致动摇部王立即进入 `rebellious` |
| 22 | `evt_tribute_submission_debate`<br>**称臣之议** | 匈奴 / 终局链<br>(`once`) | `chanyu_prestige <= 20` 且汉功业 `>= 80` | 匈奴连遭败绩，部众离散。左伊秩訾王劝单于曰：“匈奴彊弱有时，今汉方盛，乌孙城郭皆臣事汉，不若遣子入侍，可得汉厚赏以自存。”诸贵人多泣下不从。 | **A 忍辱遣质子入长安，与汉约为昆弟休兵** `[AI:40]`：`reward_pool +600`，`prestige -20`，停战 4 季<br>**B✦ 宁死漠北，绝不损冒顿先单于之威** `[AI:60]`：`prestige +12`，全军死战加成 `+15%`，但每季自然流失 `100` 骑 |
| 23 | `evt_white_horse_oath`<br>**刑白马之盟** | 汉 / 外交链<br>(`once`) | 汉使与动摇匈奴部王/乌孙会盟，对方欲北归 | 塞外诸王与汉使会于诺水之上，见汉军粮少，心怀狐疑，欲引众北去。若飞章请示长安，往返数月，彼必远飏！ | **A✦ 持节使臣当机立断，登坛刑白马盟誓** `[AI:80]`：盟约立即生效（`inf +25` 或部王归附），但朝廷弹劾专辄 `trust -6`、`precedent +10`<br>**B 谨守臣节，具状驰奏天子待报** `[AI:20]`：`trust +3`，但对方 70% 概率趁隙北遁，盟约告吹 |
| 24 | `evt_suiyuan_bizhu`<br>**犯强汉者，虽远必诛** | 汉 / 破局链<br>**[大事件]** | 敌方杀汉使且盘踞北道/西极，汉有 `trait_forger` 将使 | 逆胡负固西极，杀辱汉使，自以道远汉兵不能至。持节使者慷慨集诸校尉曰：“今不疾击，彼必吞并诸国。义士当立功万里之外，岂可坐视国威沦丧！” | **A✦ 便宜矫制，尽发屯卒与城郭诸国兵万里袭破之** `[AI:85]`：本季全军行军 `+20%`、战力 `+18%`、免除属国发兵怨恨，`precedent +15`；攻克目标即获 `permanent_deed +15`，记 `forged_edict_triumph`<br>**B 上书请调河西大军，按部就班推进** `[AI:15]`：`trust +4`，签发常规讨伐诏令 |

---

#### （2）第二组：16 条军政、边塞与核心闭环事件（`#25`–`#40`，补齐 S01–S05 全部钩子）

| # | 事件 ID 与标题 | 阵营 / 类别 | 触发条件 (`trigger`) | 史书风正文草稿（≤120 字） | 选项、精确数值效果 (`effects`) 与 `ai_weight` |
|---|---|---|---|---|---|
| 25 | `evt_loulan_assassination`<br>**傅介子刺楼兰王** | 汉 / 破局链<br>**[大事件]** | 楼兰有罪状且 `han_fu_jiezi`（或辞令>=80使臣）抵楼兰（对齐 **S04**） | 平乐监傅介子持节至楼兰，阳赐金币以饵其王安归。安归贪汉财物来见，酒酣，介子引王入帐后屏语，壮士二人自后刺之，刃交胸立死。介子持王首驰告诸贵人曰：“汉兵方至，敢动者灭国！” | **A✦ 传首诣阙，立质子尉屠耆为鄯善王** `[AI:95]`：`cs_angui` 亡，`set_city_overlord("lou_lan", "han", true)`，`permanent_deed +10`，`trust +12`，排入 `#17 楼兰请屯`，记 `loulan_regicide`<br>**B 乘势以兵威直接吞并其城** `[AI:5]`：得楼兰，但全西域怨恨 `+18` |
| 26 | `evt_rizhu_estranged`<br>**日逐王不肯会蹛林** | 匈奴 / 日逐链<br>**[大事件]** | `rizhu_grievance >= 65` 或 `rizhu.loyalty < 35`（对齐 **S03**） | 日逐王先贤掸与单于有隙，及单于夺其西域僮仆岁入，先贤掸遂称疾不赴秋蹛林大会，阴聚其部万余骑于焉耆北山，遣骑四出窥探汉塞。 | **A 拨赏赐池重金安抚（耗 400 钱）** `[AI:40]`：`reward_pool -400`，`rizhu.loyalty +18`，`rizhu_grievance -25`<br>**B 割让半数僮仆岁入予日逐王** `[AI:35]`：4 季西域岁币 `-50%`，`rizhu_grievance -15`<br>**C✦ 遣使严辞切责，削其左大将号** `[AI:25]`：`prestige +5`，`rizhu.loyalty -15`，`rizhu_grievance +20`，立即唤醒 `#27` |
| 27 | `evt_rizhu_offers_surrender`<br>**日逐王遣使请降** | 汉 / 破局链<br>**[大事件]** | `rizhu_grievance >= 70` 且 `tongpu_active == true`（对齐 **S01/S03**） | 匈奴日逐王先贤掸与单于构怨，率其众万余骑屯焉耆北，密遣使诣渠犁屯田所，愿举国降汉，乞汉使持节将兵三千迎之。失此九旬之期，必为单于所并！ | **A✦ 命驻军主将持节便宜发兵，九旬内进抵焉耆迎降** `[AI:85]`：置 `rizhu_surrender_window = 9` 旬，`trust -5`，`precedent +8`<br>**B 飞章奏请长安，待诏书至日发兵** `[AI:10]`：窗口延至 12 旬，但日逐王每季 45% 概率败亡<br>**C 疑其诈降诱敌，坚壁不纳** `[AI:5]`：`trust +2`，关闭日逐降汉线 |
| 28 | `evt_rizhu_surrender_complete`<br>**都护迎日逐·罢僮仆都尉** | 汉匈 / 结算链<br>(`once`) | `rizhu_surrender_window > 0` 且汉军 `>= 3000` 抵焉耆/车师 | 汉将持节率精卒及诸国兵北进焉耆。日逐王先贤掸望见汉节，乃率其众万二千人、小王将十二人随汉使诣敦煌降。匈奴僮仆都尉由此罢，西域北道廓清！ | **A✦ 护送日逐王诣长安受封归德侯，并护南北二道** `[AI:100]`：执行 `trigger_rizhu_surrender(has_named_general)`（汉得 `+15` 永久勋 `+10` 罢僮仆分 `=+25` 功业，`trust +18`，全西域匈奴威吓 $X-15$，匈奴 `prestige -20`），记 `rizhu_surrender` |
| 29 | `evt_chanyu_succession`<br>**单于庭大位更替** | 匈奴 / 继承链<br>**[大事件]** | 在位单于病逝或阵亡（对齐 **S03**） | 单于龙驭宾天，诸王贵人毕集龙城议立新君。左贤王位尊兵强，前代遗命之日逐王素有威望，而颛渠阏氏则欲扶立少主以专国政。 | **A 立左贤王（顺位稳健）** `[AI:45]`：`prestige +5`，`zuoxian.loyalty +20`，`rizhu_grievance +15`<br>**B 立日逐王系贵人（安抚西边）** `[AI:25]`：`rizhu_grievance = 0`，`rizhu.loyalty +25`，但 `zuoxian.loyalty -18`<br>**C✦ 阏氏矫令立少主/握衍朐鞮** `[AI:30]`：`reward_pool +250`，各部 `loyalty -12`，`rizhu_grievance +25` |
| 30 | `evt_five_generals_wusun`<br>**解忧上书·五将军助乌孙** | 汉 / 破局链<br>**[大事件]** | 解忧在乌孙，且匈奴侵逼乌孙或 `year_bce <= 73` | 匈奴发骑侵夺乌孙车延、恶师地，遣使胁求汉公主。公主与昆弥翁归靡飞章上书曰：“匈奴连岁侵击，愿发国半精兵五万骑，尽力击匈奴，唯天子出兵以救公主昆弥！” | **A✦ 遣常惠持节护乌孙兵，东西夹击右谷蠡庭** `[AI:85]`：`money -350`，乌孙立出 `4,000` 精骑协同汉军作战，击败匈奴后 `permanent_deed +10`、匈奴 `prestige -15`，记 `wusun_grand_alliance`<br>**B 赐金帛军械助守，不出塞外主力** `[AI:15]`：`money -200`，乌孙 `inf -8` |
| 31 | `evt_su_wu_shepherd`<br>**苏武北海牧羊** | 汉匈 / 人物链<br>(`once`) | 汉使被匈奴扣留（`detain_han_envoy`）或 `year_bce <= 100` | 中郎将苏武使匈奴，会缑王谋反事连，单于欲降之。武引佩刀自刺，气绝半日复息。单于壮其节，乃徙武北海上无人处，使牧羝，曰：“羝乳乃得归！”武杖汉节牧羊，卧起操持，节毛尽落。 | **A✦（汉）嘉其烈节，厚抚其家，每季声望長存** `[AI:100]`：汉每季 `trust +2`（持续 8 季），全西域汉 `inf +5`，終局附传加颂词<br>**B（匈）遣李陵置酒劝降** `[AI:100]`：苏武终不屈，匈奴 `prestige +3` |
| 32 | `evt_jinche_chijie`<br>**冯嫽锦车持节** | 汉 / 外交链<br>(`once`) | `han_jieyou` 在乌孙且乌孙发生内乱或倾向波动 | 乌孙右大将与昆弥有隙，国中震恐。汉侍者冯嫽习事有才略，尝随公主使城郭诸国，诸国敬信之，号曰“冯夫人”。都护奏请以冯嫽乘锦车持节，诏谕乌孙诸贵人。 | **A✦ 诏遣冯夫人乘锦车持节，宣抚乌孙大小昆弥** `[AI:90]`：`money -100`，乌孙 `inf +20`，`resent -15`，平息乌孙动乱<br>**B 调敦煌铁骑陈兵边境威慑** `[AI:10]`：`money -250`，乌孙 `intim +10`、`resent +8` |
| 33 | `evt_censor_inspection`<br>**绣衣直指巡边** | 汉 / 政治链<br>(`cooldown=6`) | `court.precedent >= 30` 或汉军在塞外损耗过高（对齐 **S02**） | 朝廷闻塞外将吏多专辄矫制，且军市钱粮靡费甚巨，乃遣侍御史杜周/绣衣直指暴胜之持斧巡行河西敦煌，案验幕府出入文簿。 | **A 倾心接待，开军市账簿任其核验** `[AI:60]`：`money -200`，`precedent -10`，`trust +6`，激活监军在场 4 季<br>**B 以军机机密为由拒不交账** `[AI:40]`：`trust -10`，`precedent +5`，免除监军随军 |
| 34 | `evt_convict_mutiny_merchant`<br>**七科谪怨哗与商路惊扰** | 汉 / 后勤链<br>(`cooldown=4`) | 当年招募 `convict` 罪人兵 `> 5000` 人（对齐 **S05/R-05**） | 幕府连发七科谪、弛刑徒数千人戍边。恶少年与亡命徒在河西道上强夺胡商驼队，鼓噪欲溃逃入南山。 | **A✦ 命严酷校尉斩首恶十余人，重申军法** `[AI:70]`：罪人兵减员 `300` 人，恢复商道秩序<br>**B 发酒肉金帛安抚罪卒** `[AI:30]`：`money -250`，本年商税维持 `×0.85` 惩罚 |
| 35 | `evt_beacon_neglected`<br>**亭卒猎兽·烽火乏** | 汉 / 迷雾链<br>(`cooldown=5`) | 河西/西域亭燧连续 4 季无战事 | 塞外久无警报，玉门以西某亭燧候卒怠惰，私离障塞入草泽射猎黄羊。会匈奴游骑百余人潜至，候卒惊走，竟未举蓬燔薪！ | **A 按汉律军法：乏烽火者腰斩，整肃全线候官** `[AI:75]`：`money -100`，全线烽燧侦察范围恢复并 `+10%` 截获防御<br>**B 念塞外苦寒，鞭责留用** `[AI:25]`：该路段烽燧失效 2 季（视野降级） |
| 36 | `evt_han_defector_metallurgy`<br>**汉降卒教铸兵刃** | 匈奴 / 军政链<br>(`once`) | 匈奴曾俘获汉军或拔除汉亭燧 `>= 2` 座 | 匈奴所得汉降卒及拔燧工匠中，有习铁官冶铸者，教单于庭鼓铸铁镝、修治劲弩，革胡骑骨矢之弊。 | **A✦ 设铁作坊，赏赐汉匠牛羊** `[AI:85]`：`reward_pool -180`，匈奴全军远程与穿甲战力永久 `+6%`<br>**B 驱汉卒牧马，不改弓马旧俗** `[AI:15]`：`horses +150` |
| 37 | `evt_wowu_heavenly_horse`<br>**渥洼神马出敦煌** | 汉 / 祥瑞链<br>(`once`) | 汉控制敦煌且 `season_idx >= 8` | 敦煌渥洼水中有奇马出，饮水河曲。刑徒暴利长巧以土人持勒靽立水旁，习久，遂收得其马以献，状貌异于凡驹。 | **A✦ 奉为天降祥瑞，驰献长安太庙** `[AI:85]`：`trust +10`，`emperor_regret -10`，`horses +100`<br>**B 留配持节主将作千里坐骑** `[AI:15]`：主将 `command +4`、行军速度 `+8%` |
| 38 | `evt_kangju_complaint`<br>**康居使者讼不平** | 汉 / 外交链<br>(`once`) | 汉对康居 `inf > 20` 且乌孙已和亲 | 康居遣使至敦煌献驼马，都护待之坐于乌孙使者之下，且酒食稍薄。康居使者大怒，归告其王曰：“汉独厚乌孙而卑我，何以服西域？” | **A 厚赐金帛，遣副使赴康居谢过定礼** `[AI:65]`：`money -200`，康居 `inf +15`、`resent -10`<br>**B✦ 上书言康居骄黠，不足以礼羁縻** `[AI:35]`：康居 `inf -15`、倒向匈奴（`intim +15`），但乌孙 `inf +8` |
| 39 | `evt_tongpu_tax_revolt`<br>**西域小国苦僮仆重敛** | 汉匈 / 外交链<br>(`cooldown=4`) | 匈奴连续 2 季开启三档重税（岁币大搜括，对齐 **S03/S04**） | 匈奴僮仆都尉于焉耆、尉犁间横征暴敛，夺其毡罽、牛羊、子女殆尽。诸国城郭泣怨，密遣胡商潜入汉屯田所乞师救援。 | **A（汉）遣精使携金帛抚慰，许以汉兵庇护** `[AI:80]`：`money -150`，北道诸国汉 `inf +12`，匈奴下季岁币实收 `-30%`<br>**B（匈）派日逐骑兵屠杀抗税村落立威** `[AI:70]`：当季立得 `+200` 钱，但全西域 `resent +15`、`rizhu_grievance +8` |
| 40 | `evt_qiuzi_heqin_ceremony`<br>**龟兹王绛宾慕汉仪** | 汉 / 外交链<br>(`once`) | 汉对龟兹 `inf >= 65` 且乌孙和亲存续 | 龟兹王绛宾尚乌孙公主解忧女弟史，入朝长安，大乐汉家仪法。归国后治宫室，作徼道周卫，出入传呼，撞钟鼓，如汉家仪。外国胡人皆曰：“驴非驴，马非马，若龟兹王，所谓骡也。” | **A✦ 赐以车骑旗鼓、歌吹数十人，册封亲汉印绶** `[AI:95]`：`money -150`，龟兹 `han_enfeoffed = true`（`+2` 功业），`inf +25`，北道补给线经过龟兹免损耗<br>**B 戒其勿僭汉制** `[AI:5]`：`trust +2`，龟兹 `inf -10` |

---

### 4.7 `S06-R07` 本季纪事（《汉书》编年体回合摘要）生成规则

每季末（第 9 旬阶段 E），系统调用 `Chronicle.compile_season_annals(state)`，从当季发生的动作与事件栈中按优先级筛选 **最多 5 条**，套用《汉书》文言模板生成《本季纪事》：

| 优先级 | 事件类别 (`entry_type`) | 文言句式模板（中文源字符串，支持命名占位符） | 触发源系统 |
|---|---|---|---|
| **P1 (100)** | 重大历史事件抉择 (`major_event`) | `"{season_prefix}，{event_chronicle_text}。"`（如：`“元封三年秋，匈奴日逐王先贤掸率众万余诣郑吉降，僮仆都尉由此罢。”`） | S06 `EventEngine` |
| **P2 (90)** | 攻城破国与立王 (`city_captured`) | - 立新王：`"{season_prefix}，{general_title}{general_name}攻拔{city_name}，更立亲{faction_name}贵人为王，城郭震服。"`<br>- 屠城：`"{season_prefix}，{general_name}破{city_name}，屠其城，获首虏数千级，诸国皆惧。"` | S05 `Siege` / S04 `Diplomacy` |
| **P3 (80)** | 野战大捷/覆没 (`major_battle`) | - 大捷：`"{season_prefix}，{winner_general}与{loser_faction}战于{node_name}，大破之，斩首虏{casualties}级。"`<br>- 覆没：`"{season_prefix}，{loser_general}深入{node_name}，粮绝道穷，为{winner_faction}所围，全军覆没。"` | S05 `Combat` |
| **P4 (70)** | 诏令与政治风向 (`court_edict`) | `"{season_prefix}，天子下诏{edict_title}，命持节使者{edict_summary}。"` | S02 `Court` |
| **P5 (60)** | 匈奴大会与白灾 (`steppe_council`) | `"{season_prefix}，单于会诸王于{council_place}，{council_outcome}。"` | S03 `Tribes` |
| **P6 (50)** | 屯田与凿空出使 (`tuntian_envoy`) | `"{season_prefix}，汉遣{char_name}于{node_name}开渠犁田，积谷赡军。"` / `"{char_name}持节使至{city_name}，宣明汉威。"` | S04 / S05 |

---

### 4.8 `S06-R08` 终局《汉书/匈奴列传》附传拼装模板与 1080×1920 竖版战报分享卡规范

#### （1）五段式《汉书》列传自动拼装算法（`BiographyGenerator.build_endgame_bio(state)`）
游戏结束时，系统以本局在任最久或立功最高的持节主将（汉）或单于（匈奴）为传主，按以下 **5 段式结构**动态拼装 280–400 字文言附传：

1. **第 1 段【起传·籍贯与拜官】**：读取传主 `bio_intro_key`（如郑吉：*“郑吉，会稽人也。以侍郎从军，数出西域，为人强执习外国事。”*；赵破奴：*“赵破奴，太原人也，尝亡入匈奴，已而归汉，为骠骑将军司马。”*）。
2. **第 2 段【初政·经营西域/草原】**：统计前 15 季主导战略（若 `tuntian_count >= 2` 写*“始兴屯田于渠犁、轮台间，积粟数万斛，塞外赖以饶给”*；若以精使外交为主写*“数持节行城郭诸国，厚币结乌孙，断匈奴右臂”*；匈奴则写*“初立，会诸王于龙城，申严号令，督僮仆都尉敛西域赋税”*）。
3. **第 3 段【大役·中盘高潮】**：从 `state.victory.key_events_occurred` 与 `deeds_log` 提取 2–3 件最高权重历史事迹拼入（如刺楼兰、夺天马、破车师、迎降日逐王、抗击白灾）。
4. **第 4 段【朝议·矫制与罪责检定（对齐 `S01→S02` & `R-03`）】**：
   - 若汉主胜且 `court.precedent < 45` 且 `sack_count == 0`：*“上嘉其功，诏封为列侯，食邑千五百户。”*
   - 若汉主胜但 `court.precedent >= 45`（触发**功大不封**）：*“既破敌立府，有司奏其数便宜矫制，专权塞外，不宜封侯。上从丞相议，诏赦其矫制之罪，赐爵关内侯、黄金百斤而已。”*
   - 若触发 `HAN_RECALL`（槛车征还战败）：若 `unpardoned_forged_edict == true` 写*“坐矫制不道、丧师辱国，槛车征诣廷尉，要斩弃市”*；否则写*“坐逗留畏懦、靡费万计，征下狱，赎为庶人”*。
   - 若触发 `XN_SCATTER`（诸部离散战败）：*“单于暴虐失道，赏罚不公，日逐叛于西，左贤离于东，诸部遂瓦解散走，漠南空虚。”*
5. **第 5 段【赞曰·史官五档评定】**：对齐 S01 史官 5 档星级（⭐⭐⭐⭐⭐ 功冠西域 / ⭐⭐⭐⭐ 威震塞外 / ⭐⭐⭐ 功过相抵 / ⭐⭐ 劳师靡饷 / ⭐ 丧师辱国），输出《太史公曰 / 赞曰》结语。

#### （2）1080×1920 竖版战报分享卡（Shareable Portrait Card）版面规范
供玩家一键保存 PNG 分享至社交平台（小红书/B站/Steam 社区/微信）：
- **画布尺寸**：`1080 × 1920 px`（9:16 竖屏），底纹为汉代居延汉简木纹与朱砂印章视觉风格。
- **六区垂直排布**：
  1. **天头区（`0–180px`）**：剧本名称、终局年号日期（如*“神爵二年秋 · 历时二十八季”*）、阵营徽记与结局大印（朱文篆书大印：`【都护西域·封安远侯】` 或 `【大漠霸主·威服百蛮】`）。
  2. **传主名牌区（`180–420px`）**：传主立绘剪影、姓名官爵、四维能力雷达与 2 枚金石特性印章。
  3. **核心附传竹简区（`420–1060px`）**：竖排仿宋/汉仪古籍字体渲染的《汉书》列传正文（约 300 字，关键人名地名加专名号下划线）。
  4. **西域态势缩略图（`1060–1420px`）**：42 节点终局染色微缩图，高亮标注本局补给主动脉、屯田仓城与大战役爆发点。
  5. **关键数据四格栏（`1420–1680px`）**：汉方显示 `都护功业值 / 朝廷信任终值 / 西域属国数 / 累计斩获首虏`；匈奴显示 `单于威服值 / 四部平均忠诚 / 累计岁币入账 / 塞外铁骑规模`。
  6. **落款与终局签名区（`1680–1920px`）**：史官星级评定（1–5 星）、终局签名代码（如 `END_SIG: HAN_DUHUFU_RIZHU_FORGED`）与随机种子码。

---

## 5. 命令表（Player & AI Commands）

> **遵守圣经 L9**：玩家与 AI 共用同一套事件响应与人物指派命令接口。

| 命令 ID | 参数 (`params`) | 前置条件 (`preconditions`) | 消耗 (`cost`) | 执行效果 (`effects`) | 失败返回码 |
|---|---|---|---|---|---|
| `resolve_event_option` | `evt_id: String`,<br>`opt_id: String` | 1. `evt_id` 位于当前 `state.events.pending_queue` 队首；<br>2. `opt_id` 存在于该事件的 `options` 中；<br>3. 若选项带资源门槛（如 `req_money >= 400`），当前阵营资源满足 | 选项定义的钱/粮/马/信任/威望消耗 | 1. 按序执行该选项的 `effects` 原子操作数组；<br>2. 将 `evt_id` 移出 `pending_queue`；若 `once == true` 记入 `fired_once`，若 `cooldown_seasons > 0` 写入 `cooldowns`；<br>3. 若 `is_major_quota == true`，`major_events_count += 1` 且 `last_major_event_season = season_idx` | `ERR_EVT_NOT_PENDING`<br>`ERR_OPT_INVALID`<br>`ERR_OPT_REQ_UNMET` |
| `assign_character` | `char_id: String`,<br>`target_type: String` (`"army"` / `"envoy"` / `"node"`),<br>`target_id: String` | 1. `char.faction == actor_faction` 且 `char.status == "active"`；<br>2. `char.assigned_to == ""`（或正处于同城空闲状态）；<br>3. `char.at_node == target.at_node`（人物必须与目标军队/使团在同一节点，符合 S02“行动需人物在场”） | 无额外金钱消耗（同城即时交接） | 1. 将 `char.assigned_to` 绑定至 `target_id`；<br>2. 目标军队立即获得 `char.command_tier` 战力乘数与特性修正，或精使团获得 `char.eloquence` 加成 | `ERR_CHAR_NOT_ACTIVE`<br>`ERR_CHAR_NODE_MISMATCH`<br>`ERR_CHAR_ALREADY_BUSY` |
| `rotate_reserve_character` | `retire_char_id: String`,<br>`activate_char_id: String` | 1. 仅限每季初下令阶段；<br>2. `retire_char` 处于 `dun_huang` / `jiu_quan` / `chang_an` 且未统领在途军队/使团；<br>3. `activate_char` 位于长安 `reserve_pool` 候任池中 | 0 钱（每季限轮换 1 人） | `retire_char` 移入 `reserve_pool`，`activate_char` 状态置 `"active"` 并部署于 `dun_huang` | `ERR_CHAR_IN_FIELD`<br>`ERR_ROTATE_LIMIT_REACHED` |
| `export_endgame_share_card` | `format: String` (`"png_1080x1920"` / `"markdown"`) | 游戏已进入终局结算界面（`state.game_over == true`） | 无 | 调用 `BiographyGenerator.build_endgame_bio(state)` 渲染《汉书》体附传并输出 1080×1920 战报长图至 `user://share_cards/` | `ERR_GAME_NOT_OVER` |

---

## 6. 与其他系统的接口（Cross-System Interfaces）

### 6.1 S06 导出的接口（供 S01–S05、S07、S08 调用）

| 调用方 | 导出函数 / 状态路径 | 签名与返回格式 | 用途说明 |
|---|---|---|---|
| **S01 胜利与剧本** | `EventEngine.init_scenario(state, scn_data)` | `(GameState, Dict) -> void` | **[对齐 S01→S06]** 剧本加载时读取 `characters_init`、`rizhu_grievance_init` 与 `scheduled_events`，初始化人物槽与事件链 |
| **S01 胜利与剧本** | `state.victory.key_events_occurred` | `Array[String]` | **[对齐 S01→S06]** 触发 8 类核心历史事件时自动追加标签，供 S01 计算终局签名 `end_signature` 与史官星级 |
| **S01 / S07** | `BiographyGenerator.build_endgame_bio(state)` | `(GameState) -> Dict` | 返回 `{title, paragraphs: Array[String], rating_stars: int, rating_title: String, share_card_data: Dict}` |
| **S02 汉廷与诏令** | `Characters.get_char(state, char_id)` | `(GameState, String) -> Character` | **[对齐 S02→S06 & R-02]** 提供 `eloquence` (0–100)、`caution` (0–100)、`ambition_marquis` (0–100)、`role_tags`、`traits` |
| **S02 汉廷与诏令** | `Characters.get_active_holder(state)` | `(GameState) -> Character` | 返回当前汉方持节主使对象（用于判定召还令送达节点、矫诏倾向与封侯等级） |
| **S02 汉廷与诏令** | `Characters.generate_fallback_character(state, role)` | `(GameState, String) -> Character` | **[对齐 Q-S02-03 & R-02]** 当史实将使或监军御史耗尽时，从史书风候补池生成递补人物 |
| **S03 匈奴联盟** | `EventEngine.trigger_immediate(state, evt_id, ctx)` | `(GameState, String, Dict) -> void` | **[对齐 S03→S06]** 供 S03 在单于病逝、部王叛乱或 Q4 白灾检定命中时直接唤醒 `evt_chanyu_succession`、`evt_rizhu_offers_surrender`、`evt_white_disaster_collapse` |
| **S04 城邦外交** | `Characters.get_envoy_modifiers(state, char_id)` | `(GameState, String) -> Dict` | **[对齐 S04→S06]** 返回 `{eloquence: int, has_pioneer: bool, has_resolute: bool, bowang_credit_bonus: float}` |
| **S05 后勤军事** | `Characters.get_commander_stats(state, char_id)` | `(GameState, String) -> Dict` | **[对齐 S05→S06 & R-02]** 返回 `{command: int (0..100), command_tier: int (0..10), valor: int, caution: int, traits: Array, at_node: String}`；无将领时返回默认 `command=20, command_tier=2, traits=[]` |
| **S07 / S08** | `Chronicle.get_season_entries(state)` | `(GameState) -> Array[String]` | 返回本季已渲染的《汉书》编年体纪事文本数组 |

### 6.2 S06 导入的接口（读取 S01–S05 的状态与函数）

| 提供方 | 导入函数 / 状态路径 | S06 调用时机与用途 |
|---|---|---|
| **S01** | `Victory.on_rizhu_surrender(state)` | 在 `evt_rizhu_surrender_complete`（`trigger_rizhu_surrender` 原子效果）中调用，为汉方授 `+15` 永久勋与 `+10` 罢僮仆状态分 |
| **S01** | `Victory.record_event_award(state, tag, val)` | 在名将阵斩、天马来朝、刺楼兰王等事件结算时调用，记录专项功业/战功 |
| **S02** | `Court.modify_trust(state, delta, reason)` | 在全部涉及朝廷信任增减的事件选项中调用；并读取 `state.court.precedent` 决定终局附传是否触发“功大不封” |
| **S03** | `state.tribes.tongpu_active` / `Tribes.add_reward_pool` | 读取/修改僮仆都尉在位状态、单于威望 `chanyu_prestige`、四部忠诚 `loyalty` 与赏赐池 |
| **S04** | `Diplomacy.on_tongpu_deposed(state)` | 在日逐王降汉（`evt_rizhu_surrender_complete`）时调用，使全西域匈奴威吓 $X - 15$ 并解除 `X_floor = 30` 保底 |
| **S04** | `Diplomacy.add_crime(state, state_id, crime_tag)` | 在 `evt_envoy_killed`、`evt_dawan_horses_refused`、`evt_laidan_killed` 中调用，生成合法讨伐罪状 |
| **S05** | `state.tuntian_pressure[state_id]` | **[对齐 S05→S06]** 每季初监听 `tuntian_pressure["qiu_ci"] >= 60`（或楼兰 `>= 60`），自动触发 `evt_laidan_killed`（赖丹之死） |
| **S05** | `Supply.add_horses(state, faction, count)` | 在《天马来》《乌孙求聘》《渥洼神马》等事件中向国家马匹池注入战马 |

---

## 7. AI 使用要点（AI Integration Notes — 细节归 S08）

1. **事件选项效用评分（Event Option Utility Scoring）**：
   - AI 响应 `resolve_event_option` 时，不读任何隐藏随机数，仅计算每个可执行选项的综合权重：
     $$W(\text{opt}) = \text{opt.ai\_weight.base} + \sum_{m \in \text{modifiers}} \mathbb{I}(\text{cond}(m)) \cdot m.\text{add}$$
   - **关键事件特化评分**：
     - 当汉 AI 触发 `evt_rizhu_offers_surrender`（日逐王请降）且在渠犁/敦煌/轮台有 `>= 2,000` 可调动兵力时，选项 A（9 旬内持节出兵迎降）权重固定 `+60`，同时向 `han_ai.gd` 注入最高优先级军事任务 `TASK_WELCOME_RIZHU`（目标节点：`yan_qi`，要求兵力 `>= 3,000` 且绑定具名将领）。
     - 当匈奴 AI 检测到 `rizhu_grievance >= 55` 时，在五月龙城大会与 `evt_rizhu_estranged` 中优先选择安抚日逐王（若 `reward_pool >= 400` 必选选项 A）。
2. **具名人物指派策略（Character Assignment Heuristics）**：
   - **远征主力军**：优先指派 `command_tier >= 8` 的将领；若执行轻骑突袭（目標城守军 `<= 1,500`），优先指派带 `trait_ambusher` / `trait_light_raider` 的赵破奴。
   - **精使团（`send_envoy`）**：通乌孙/大宛等大国优先指派 `han_zhang_qian`（`trait_pioneer`）；刺杀/威慑有罪小国优先指派 `han_fu_jiezi`（`trait_resolute`）；迎降日逐王或主持渠犁屯田优先指派 `han_zheng_ji`（`trait_tuntian_master` + `trait_welcomer`）。

---

## 8. UI 需求（UI Requirements — 细节归 S07）

### 8.1 季初竹简事件弹窗（Event Bamboo Scroll Modal）文字线框

```text
+========================================================================+
|  【 元鼎三年秋 · 边塞急递 】                      [重要历史事件 · 必选] |
|------------------------------------------------------------------------|
|  《 日逐王遣使请降 》                                                  |
|  “先贤掸以父单于遗命不得立，素怀怨望……” ——《汉书·西域传》             |
|                                                                        |
|  匈奴日逐王先贤掸与单于构怨，率其众万余骑屯焉耆北，密遣使诣渠犁屯田所，|
|  愿举国降汉，乞汉使持节将兵三千迎之。失此九旬之期，必为单于所并！      |
|------------------------------------------------------------------------|
|  ▶ [选项 A] 命驻军主将持节便宜发兵，九旬内进抵焉耆迎降（推荐）         |
|     效果：开启【迎降日逐王】9旬限时窗口 | 朝廷信任 -5 | 矫诏先例 +8    |
|     成功回报：功业值 +25（罢僮仆都尉）| 朝廷信任 +18 | 获归义胡骑 2000 |
|                                                                        |
|  ▶ [选项 B] 飞章奏请长安，待诏书至日发兵                               |
|     效果：不扣信任 | 窗口延至12旬，但日逐王每季有 45% 概率被单于击灭   |
|                                                                        |
|  ▶ [选项 C] 疑其诈降诱敌，坚壁不纳                                     |
|     效果：朝廷信任 +2 | 本局永久关闭日逐王请降线                       |
+========================================================================+
```

### 8.2 人物名牌与悬浮 Tooltip 规范
- **左栏人物名牌**：显示姓名、官爵简称、当前所在节点（如 `【渠犁】` 或 `【随第1军行军中】`）、统率阶级徽章（如 `统 9`）与 2 个特性短标签（如 `[屯田] [迎降]`）。
- **人物 Tooltip 文案模板**：
  - 标题：`{name_zh} · {courtesy_title}（{age}岁，健康：{health}/100）`
  - 四维栏：`统率：{command}（战力修正 {combat_mod_pct}%） | 勇武：{valor} | 辞令：{eloquence} | 谨慎：{caution}`
  - 特性栏：逐条列出 2 个特性的中文名与具体数值效果。
  - 生平录：列出本局该人物已触发的 `deeds_log`（最多显示最近 4 条）。

---

## 9. 玩家可见文本与本地化键值表（Localization Keys）

所有文本统一存放于 `data/localization/zh_CN.json`（及 `en_US.json`），S06 核心键值规范如下：

| 本地化 Key | 中文源文本（zh_CN） | 英文参考文本（en_US） |
|---|---|---|
| `ui.char.panel_title` | `在场将使名录（{current}/{max}）` | `Active Roster ({current}/{max})` |
| `ui.char.stat_command` | `统率：{val}（{tier}阶，战力{pct}）` | `Command: {val} (Tier {tier}, Combat {pct})` |
| `ui.char.stat_valor` | `勇武：{val}` | `Valor: {val}` |
| `ui.char.stat_eloquence` | `辞令：{val}` | `Eloquence: {val}` |
| `ui.char.stat_caution` | `谨慎：{val}` | `Caution: {val}` |
| `ui.char.status.active` | `在任（驻{node}）` | `Active (at {node})` |
| `ui.char.status.in_transit` | `随军/出使在途` | `In Transit` |
| `ui.char.status.imprisoned` | `下狱待审` | `Imprisoned` |
| `ui.char.status.dead` | `已故（{cause}）` | `Deceased ({cause})` |
| `trait.trait_greedy.name` | `贪功好利` | `Greedy for Spoils` |
| `trait.trait_ambusher.name` | `轻骑奇袭` | `Light Cavalry Ambusher` |
| `trait.trait_stern.name` | `治军严酷` | `Stern Disciplinarian` |
| `trait.trait_pioneer.name` | `凿空者` | `Trailblazer of the West` |
| `trait.trait_resolute.name` | `勇决刺王` | `Resolute Assassin` |
| `trait.trait_forger.name` | `便宜矫制` | `Bold Edict Forger` |
| `trait.trait_tuntian_master.name` | `屯田校尉` | `Master of Military Farms` |
| `trait.trait_welcomer.name` | `招降纳叛` | `Welcomer of Defectors` |
| `ui.chronicle.drawer_title` | `《本季纪事》· {year_str}` | `Seasonal Chronicle · {year_str}` |
| `ui.bio.modal_title` | `《汉书·西域列传》终局附传` | `Book of Han · Endgame Biography` |
| `ui.bio.export_btn` | `导出竖版战报长图 (1080×1920)` | `Export Portrait Share Card (1080×1920)` |
| `evt.rizhu_offers_surrender.title` | `日逐王遣使请降` | `The Rizhu King Offers Surrender` |
| `evt.white_disaster_collapse.title`| `塞外大雨雪·白灾瓦解` | `Great Blizzard of the Steppe` |
| `evt.luntai_edict.title` | `轮台罪己诏` | `The Penitential Edict of Luntai` |
| `evt.laidan_killed.title` | `赖丹之死（龟兹杀校尉）` | `Death of Lai Dan at Kucha` |

---

## 10. 边界情况处理（Edge Cases，共 12 条）

1. **统兵将领在行军途中病逝或被剧情事件处死**：
   - **处理**：该军队不原地蒸发，立即将 `commander_id` 置空，回退为无将默认统率（`command = 20, command_tier = 2`，战力乘数 `0.97x`），继续执行原定行军路线至下一节点，并在《本季纪事》记录*“某将卒于军中，司马摄行军事”*。
2. **精使团正使在出使途中病逝**：
   - **处理**：副使自动接替持节继续前往目标城邦，但出使结算时 `eloquence` 按默认候补值 `55` 计算，且失去原正使的专属特性加成。
3. **日逐王 9 旬迎降窗口（`rizhu_surrender_window > 0`）期间，汉军抵达焉耆但无具名将领随行**：
   - **处理**：严格执行 **[R-04]** 裁决——只要抵达焉耆/车师前国的汉军总兵力 `>= 3,000`，仍可成功触发 `evt_rizhu_surrender_complete`（罢免僮仆都尉、获 `+25` 功业），但因无具名将使弹压，归义胡骑发生 **25% 哗变损耗**（实收胡骑从 `2,000` 降至 `1,500` 人），且不获得额外信任加分。
4. **日逐王迎降窗口期间，焉耆与车师前国均被匈奴单于庭主力重兵占领**：
   - **处理**：若汉军在 9 旬内攻入焉耆/车师前国并击败驻守的匈奴单于军，战斗胜利瞬间立即完成日逐王迎降结算；若战败或 9 旬届满仍未踏入目标节点，触发 `evt_rizhu_surrender_failed`（日逐王先贤掸被单于诛杀，`rizhu.loyalty` 重置为 `50`，本局永久关闭日逐王请降线）。
5. **傅介子赴楼兰执行刺杀（`evt_loulan_assassination`）途中，楼兰已被另一支汉军武力攻陷**：
   - **处理**：攻陷瞬间自动取消在途的刺杀事件触发，若攻城汉军选择了“立新王”，同样可无缝衔接 `#17 鄯善新王请屯伊循` 事件。
6. **同一季初满足触发条件的事件超过 2 条（例如同时触发单于继承、白灾瓦解与汉使死节）**：
   - **处理**：按 `S06-R01` 优先级队列，当季仅弹出最高优先级的 `max_popups_per_season = 2` 条；第 3 条若为 `chain_mandatory` 或 `major_crisis`，自动压入下一季队首（`delay = 1` 季），绝不静默吞没核心大事件。
7. **玩家在事件竹简弹窗尚未做出选择时保存游戏并退出**：
   - **处理**：`state.events.pending_queue` 完整序列化进存档文件；读档恢复时，UI 初始化完毕后立即重新弹出队首事件，且随机数状态 `GameState.rng.state` 保持一致，杜绝反复读档刷概率（Save Scumming）。
8. **开启 60 季长局模式（前 119—前 104 以外延展）或连番血战导致汉方在场史实人物跌破 3 人**：
   - **处理**：每季初自动调用 `S06-R04` `Characters.generate_fallback_character` 从史书风候补池补足至 `4` 人（含至少 1 名持节都尉与 1 名使臣），确保精使团与出塞领兵永不因缺人而死锁。
9. **持节主使本人因《家室在吏》或《槛车召还令》下狱/叛降**：
   - **处理**：若为普通领兵将领（如李广利而非常驻都护）叛降，仅损失该将领与当季信任 `-12`；若为唯一持节主使且朝廷信任已归零被《槛车召还令》锁拿，则直接移交 S01/S02 触发 `HAN_RECALL` 政治崩盘结局。
10. **乌孙和亲公主细君在乌孙病逝时，乌孙正与汉军联合对匈奴作战**：
    - **处理**：触发 `#04 从其国俗` 或续嫁解忧公主（`han_jieyou`），联军状态不中断；若玩家主动选“迎公主归汉、断绝和亲”，则乌孙协战骑兵在下旬末撤回赤谷城。
11. **轮台罪己诏（`evt_luntai_edict`）触发时，汉方已有在途的远征大军或正在建造的远距屯田**：
    - **处理**：已在途的汉军不强制瞬移撤回，但不再获得新远征诏令补给；正在建造中的远距屯田允许建完当前级，但此后在 `"rest"` 风向持续期内禁止新建远距屯田（对齐 S02/S05）。
12. **终局《汉书》附传生成时，本局在第 6 季即因闪电战或政治崩盘极速结束**：
    - **处理**：当 `history_annals` 事迹少于 2 条时，第 3 段【大役】自动采用简短叙事兜底模板（如*“莅事未几，塞外剧变，仓促间未及展布方略”*），确保任何回合数结束都能生成语法严整、无空占位符的完整古文附传。

---

## 11. 调参旋钮与预期（Tuning Knobs & Expected Impact）

所有调参旋钮集中配置于 `data/balance.json → events / characters`：

| 参数 JSON 键 | 默认值 | 可调范围 | 调高时的预期影响 | 调低时的预期影响 |
|---|---|---|---|---|
| `events.major_quota_min` / `max` | `1` / `3` | `1..2` / `2..4` | 每局中盘历史戏剧性与逆转率上升，终局签名更加丰富 | 沙盒更偏向纯数值后勤对抗，意外冲击减少 |
| `events.major_cooldown_seasons` | `4` 季 | `3..6` 季 | 重大危机分布更均匀，给玩家充足喘息与恢复窗口 | 危机可能背靠背爆发（如刚遇白灾又逢单于暴毙），压迫感极强 |
| `events.rizhu_grievance_threshold`| `70` | `55..85` | 日逐王更难请降，汉方更依赖军事硬推车师/焉耆来攒功业 | 日逐王极易在中期请降，汉方立府胜率显著提升（需防汉胜率 >35%） |
| `events.rizhu_window_ticks` | `9` 旬 | `6..12` 旬 | 汉军有充裕时间从敦煌调兵迎降，迎降成功率大增 | 汉方必须提前在渠犁/轮台常驻 3,000 兵马才能赶上窗口 |
| `events.regret_luntai_threshold` | `80` | `60..100` | 武帝容忍度高，汉方可持续发动两次大宛级远征而不触发轮台诏 | 汉军一旦在大宛或漠北吃一场败仗即转入“休息”风向，强制转种田外交 |
| `char.command_tier_combat_coef` | `0.03` | `0.02..0.05`| 名将（`tier=9`）相比普通将领（`tier=6`）战力优势显著放大，英雄主义色彩浓 | 胜负更取决于兵力规模与粮道，名将加成温和 |
| `char.han_active_char_cap` | `6` 人 | `4..8` 人 | 汉方可同时多线派精使团并领多路大军，操作宽裕 | 具名人物极度紧缺，派张骞出使就少一员前线统帅，L7 权衡极尖锐 |
| `events.white_disaster_q4_prob` | `0.18` | `0.10..0.30`| 匈奴冬季远征风险极高，中期易因白灾瓦解而交出北道主动权 | 匈奴铁骑冬季存活力强，汉方更难靠天灾逆转 |

---

## 12. 验收测试（Acceptance Tests — Given / When / Then）

以下 10 条验收断言可直接由 `design_sim/` Python 模拟器与 Godot headless 单元测试执行验证：

1. **[TEST-S06-01] 人物属性量纲与 `command_tier` 导出（验证 R-02 & S05 接口）**：
   - **Given** 加载 `data/characters.json` 中的全部 25 名史实人物与任意候补生成人物；
   - **When** 检查每名人物的 `command, valor, eloquence, caution` 及调用 `Characters.get_commander_stats(state, id)`；
   - **Then** 四维能力均为 `0..100` 整数，`command_tier` 恒等于 `int(round(command / 10.0))`（取值 `0..10`），例如郑吉 `command=86` 导出 `command_tier=9`，S05 战力乘数精确为 `1 + 0.03*(9-3) = 1.18`。
2. **[TEST-S06-02] 新手保护期与中期重大事件保底配额（验证 S01-R12 & S06-R03）**：
   - **Given** 运行 200 局标准 40 季《漠北之后》模拟；
   - **When** 统计每局 `is_major_quota == true` 事件的触发季号与总次数；
   - **Then** 100% 的对局在 `T1–T5` 内触发重大危机次数为 `0`；在 `T10–T32` 内触发次数严格落在 `[1, 3]` 区间内，且同一局任意两次重大事件间隔 `>= 4` 季。
3. **[TEST-S06-03] 日逐王请降与具名将领迎降完整闭环（验证 R-04 & S01/S03/S04 联动）**：
   - **Given** `state.events.rizhu_grievance = 72 >= 70` 且 `tongpu_active == true`，汉方在季初 `evt_rizhu_offers_surrender` 选择选项 A 开启 `rizhu_surrender_window = 9` 旬；
   - **When** 郑吉（具名将领）率 `3,500` 军在第 5 旬进抵 `yan_qi`（焉耆）；
   - **Then** 立即触发 `evt_rizhu_surrender_complete`：`state.tribes.tongpu_active` 置为 `false`，汉方功业值增加 `+25`（`+15` 永久勋 `+10` 罢僮仆分），全西域匈奴威吓 $X$ 降低 `15` 且解除 `30` 保底，汉方在焉耆获得 `2,000` 归义胡骑（100% 无哗变）；若将领为空（无具名将领），则归义胡骑因 25% 哗变损耗仅得 `1,500` 人。
4. **[TEST-S06-04] 屯田压迫触发《赖丹之死》与讨伐罪状生成（验证 S05→S06 & S04 联动）**：
   - **Given** 汉方在 `lun_tai` 屯田使得邻国龟兹 `state.tuntian_pressure["qiu_ci"]` 累积至 `62 >= 60`；
   - **When** 进入下一季初事件检定阶段且玩家选择选项 A；
   - **Then** 必触发 `evt_laidan_killed`，`cs_laidan` 状态变为 `"dead"`，且 `Diplomacy.has_valid_crime(state, "qiu_ci")` 变为 `true`（汉方讨伐龟兹免矫诏且享讨罪战功）。
5. **[TEST-S06-05] 武帝悔意累积触发《轮台罪己诏》与朝廷风向切换（验证 S02 联动）**：
   - **Given** 汉方因远征失利与靡费使 `state.events.emperor_regret` 达到 `82 >= 80`；
   - **When** 下一季初结算事件队列；
   - **Then** 弹出 `evt_luntai_edict`，执行后 `state.court.wind` 切换为 `"rest"`（持续 20 季），`Court.is_luntai_edict_active(state)` 返回 `true`，且 `"luntai_edict"` 被追加至 `state.victory.key_events_occurred`。
6. **[TEST-S06-06] 单于病逝触发继承危机与日逐王怨望联动（验证 S03 联动）**：
   - **Given** 在位单于在 Q4 年终寿元检定中病逝；
   - **When** 触发 `evt_chanyu_succession` 且匈奴选择选项 C（阏氏匿丧矫令立少主/握衍朐鞮）；
   - **Then** 在位单于切换为继任者，四部 `loyalty` 下降 `12`，`rizhu_grievance` 增加 `25`，且 `"chanyu_succession_crisis"` 记入 `key_events_occurred`。
7. **[TEST-S06-07] 史实人物耗尽时的史书风候补池递补（验证 Q-S02-03 & R-02）**：
   - **Given** 汉方在场具名人物因阵亡或老死仅剩 `2` 人，且当前年份无待登场史实人物；
   - **When** 执行季初人物槽检定或调用 `Characters.generate_fallback_character(state, "general")`；
   - **Then** 自动生成 `is_generated == true` 的史书风候补人物（如 `"戊己校尉·辛武贤"`），其四维能力严格位于 `48..72` 之间，汉方在场人物恢复至 `>= 3` 人。
8. **[TEST-S06-08] 终局《汉书》附传对“功大不封（矫诏先例超标）”的精确反映（验证 S01→S02 & S06-R08）**：
   - **Given** 汉方达成 `HAN_DUHUFU` 立府主胜利，但局中累积 `state.court.precedent = 52 >= 45`；
   - **When** 调用 `BiographyGenerator.build_endgame_bio(state)`；
   - **Then** 生成的附传第 4 段包含*“赐爵关内侯”*与有司弹劾矫制文本，史官评定星级上限锁死为 `3` 星（`功过相抵·有功不侯`）。
9. **[TEST-S06-09] 同季弹窗上限与随机种子确定性（防刷档验证）**：
   - **Given** 同一季初人工构造 4 条同时满足触发条件的事件；
   - **When** 执行 `EventEngine.on_season_start(state)` 并在第 1 条弹窗时存档重读；
   - **Then** 当季 `pending_queue` 长度不超过 `2`，高优先级事件排在队首，且读档前后选项检定结果与随机数序列 100% 一致。
10. **[TEST-S06-10] 终局签名多样性贡献验证（验证圣经 L12）**：
    - **Given** 运行 200 局 AI 对 AI 标准难度模拟；
    - **When** 汇总 `state.victory.key_events_occurred` 参与构成的终局签名 `end_signature`；
    - **Then** 8 类核心事件标签至少有 6 类在 200 局样本中出现频率 `>= 8%`，协助 S01 达成“终局签名 `>= 15` 种且单一签名占比 `<= 20%`”的 L12 硬指标。

---

## 13. 未决问题（Open Questions）

> 截至 v1 完成，[STATUS.md](STATUS.md) 中涉及 S06 的全部历史待裁决项（**R-01** 历法季度与 Q4 白灾/寿元检定、**R-02** 人物 0–100 量纲与 `command_tier` 导出及史书风候补池、**R-03** 政治崩盘结局与附传归口、**R-04** 四部首领切换与 9 旬具名将领迎降无哗变、**R-05** 七科谪事件与后勤联动）均已由主策划统一裁决并在本规范中 100% 闭环落地，**本章无遗留阻塞问题**。
