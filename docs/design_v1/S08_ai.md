# S08 — AI 决策架构、性格矩阵与迷雾感知系统（AI Architecture, Personalities & Fog Perception）

> **所有权声明**：本文件（`S08_ai.md`）拥有汉方 AI（`ai/han_ai.gd`）、匈奴 AI（`ai/xiongnu_ai.gd`）、西域 18 城邦与 5 大国自主决策评估器（`ai/citystate_ai.gd`）、AI 共用感知与效用计算库（`ai/ai_utils.gd`）、跨季度记忆黑板（`AIBlackboard`）、42 节点语义标签系统（`node_semantic_tags`）、3×3 历史统帅性格矩阵以及三档难度 AI 行为修正（`data/ai_profiles.json`）的**唯一设计所有权**。
>
> **上位依据**：严格遵循 [`00_bible.md`](00_bible.md) 锁定决策 L1–L12 及 [`STATUS.md`](STATUS.md) 已裁决项 `[R-01]` 至 `[R-05]`。AI 与玩家完全共用 [`S02`](S02_han_court.md)–[`S05`](S05_logistics_military_fog.md) 定义的命令接口与校验管线，**零特权、零资源作弊、零全图透视**。

---

## 1. 目的与支柱（Purpose & Pillars）

### 1.1 现有 AI 架构的三大症结（基于代码审计与 S09 基线模拟）

对现有 [`ai/han_ai.gd`](../../ai/han_ai.gd)、[`ai/xiongnu_ai.gd`](../../ai/xiongnu_ai.gd) 的代码审计及 [`S09_simulation_validation.md`](S09_simulation_validation.md) 的 200 局蒙特卡洛校准揭示了三大结构性缺陷：

1. **硬编码“背板 AI”导致重玩价值归零**：
   - 现有 `han_ai.gd` 硬编码 `const HEXI = ["wu_wei", "zhang_ye", "jiu_quan", "dun_huang", "ju_yan"]`、`const PRIORITY = {"wu_lei": 3.0, "cheshi_qian": 3.0, "lou_lan": 2.0}` 及 6 段死板手工运粮 `legs`；
   - 现有 `xiongnu_ai.gd` 硬编码每年 4 月雷打不动在 `yi_wu`（伊吾）集结、8 月出击河西、游骑永远只截 `yang_guan — lou_lan` 一条边（第 123–125 行）。玩家只要玩过 2 局，就能在伊吾南口和阳关提前设伏“背板屠杀”AI。
2. **全图透视作弊违背圣经 L8/L9**：
   - 现有 `ai_utils.gd::enemy_threat_at` 直接遍历 `state.armies` 读取敌军精确位置与兵力真值；汉匈 AI 均能隔着三千里戈壁瞬间感知对方在长安或单于庭的征兵动作，彻底破坏了烽燧迷雾（S05）与部族暗流（S03）的设计初衷。
3. **单调支配策略与 0% 汉主胜死锁（S09 §5.2 实证）**：
   - 在 S09 的 5×5 策略交叉矩阵中，匈奴 `aggressive`（无脑猛攻河西）对汉方所有策略取得 **95.0% 平均胜率**（构成严重支配策略），而汉方在标准季制下主目标达成率为 **0.0%**——因为旧版汉 AI 既不会利用边际功业权重分阶段攻坚枢纽，也不会用募使试探罪状或矫诏奇袭，只会在北道高威吓城邦面前死锁发呆。

### 1.2 服务体验支柱映射

| 体验支柱 | S08 AI 架构的核心支撑机制 |
|---|---|
| **支柱一：万里粮道** | **补给线自动化与断粮红线预演**：汉 AI 废弃 6 段手工派车，改用 1–2 条动态 `SupplyLine`（S05），并在每次出塞前强制调用 `Preview.simulate_food_curve` 校核往返余粮与沿途城邦供粮意愿 $W$；匈奴 AI 则根据感知到的汉军粮道流量动态选点破袭亭燧（`raze_beacon`）与劫粮。 |
| **支柱二：将在外** | **诏令博弈与机会主义矫诏**：汉 AI 面对朝廷诏令（S02）不再机械接单，而是基于路途时差、兵力缺口与朝廷信任裕度，在「奉诏 / 上书讨价 / 抗辩推辞 / 持节矫诏（含自劾）」之间进行效用权衡，复现傅介子、陈汤式的“先斩后奏”。 |
| **支柱三：帝国对联盟** | **非对称双核决策循环**：汉 AI 围绕「朝廷信任—粮道负载—三阶段功业（筑基/攻坚/立府维持）」运转；匈奴 AI 围绕「单于威望—四部分赏防叛—三次年会投票—双路径（饮马河西 vs 威服西域）动态切换」运转，根除无脑 Rush 河西支配策略。 |
| **支柱四：人与史** | **3×3 统帅性格矩阵与城邦自主算计**：不同历史任期的主将/单于挂载鲜明性格权重（如汉使【拓边锐进 / 持重营田 / 奇谋刺袅】、单于【雄猜严罚 / 怀柔守成 / 贪利秋掠】），配合 18 城邦在两强夹缝中的骑墙、两属、索贿与背盟算计，使每局涌现截然不同的历史叙事。 |

### 1.3 机制准入表（圣经 L7：每个 AI 机制如何让玩家的回合决策更难做）

| S08 核心子模块 | 玩家受影响的回合决策 | 为什么这让玩家的决策变得更难、更有趣？ |
|---|---|---|
| **M1. 零特权迷雾感知与风险厌恶区间评估** | 汉/匈玩家：是否在边境增设烽燧/斥候、是否派疑兵佯动 | AI 只读 `Fog.get_perceived_state` 的模糊区间 `[size_min, size_max]` 并按性格风险系数 $\rho$ 估值。玩家可用小股骑兵在无烽燧区制造“大军压境”假象诱使持重型 AI 退兵，或故意隐蔽主力诱使锐进型 AI 孤军深入。 |
| **M2. 动态加权软最大（Softmax）集结点与伏击道选择** | 汉玩家：河西四郡驻防分配与粮道护航路线选择 | 匈奴 AI 彻底废除固定 `yi_wu` 集结与 `yang_guan` 设伏，改为对所有 `staging_xn` 与 `ambush_road` 标签节点按「距目标天数、暴露粮道流量、汉军烽燧盲区、部王偏好」计算效用并以温度系数 $\tau$ 采样。玩家无法再靠“背板”死守一处。 |
| **M3. 汉 AI 三阶段边际功业驱动与矫诏突袭** | 匈奴玩家：僮仆赋税档位调节与北道驻军分配 | 当匈奴玩家抽空北道驻军南下或对车师/楼兰横征暴敛时，汉 AI 会敏锐捕捉到高边际功业窗口，先派低成本募使博取罪状，或在信任充裕时直接**矫诏奇袭**，迫使匈奴玩家必须在“南下劫掠”与“镇守北道咽喉”间艰难平衡。 |
| **M4. 匈奴 AI 四部分赏博弈与双路径自适应切换** | 汉玩家：重点加固河西城防 vs 前出争夺西域城邦 | 若汉玩家把重兵龟缩在敦煌/武威死守城墙，匈奴 AI 不会傻撞坚城送死掉威望，而是自动切换至**路径 B（威服西域）**，拔除汉军亭燧、锁死楼兰禁商、护卫僮仆都尉冲刺 100 威服值，逼迫汉玩家必须出关决战。 |
| **M5. 18 城邦与 5 大国自主效用 AI** | 汉/匈玩家：对摇摆城邦应该继续砸钱拉拢、派兵震慑还是提前讨伐 | 城邦 AI 每季末根据自身倾向 $\text{Tilt}$、对汉/对匈怨恨与邻格驻军军威自主决策（请为两属、倒戈闭籴、截杀募使或密告军情）。玩家过度压榨属国赋税或强征军粮，会触发城邦在关键战役中途倒戈断粮。 |
| **M6. 3×3 统帅性格矩阵与季末复盘可读性** | 汉/匈玩家：换帅/单于更迭后的战略方针调整 | 面对【雄猜严罚】的握衍朐鞮单于，汉玩家的最佳策略是离间日逐王并准备受降；而面对【怀柔守成】的乌维单于，内部离间难以奏效，必须正面争夺乌垒屯田。对手换人即换打法。 |

---

## 2. 玩家视角（Player Perspective）

玩家在以下三个核心场景直接感知并与 S08 AI 展开心理博弈：
1. **情报与外交顶栏面板**：查看当前在位敌方统帅（持节汉使 / 匈奴单于）的**性格标签徽章**（如 `【雄猜严罚】`、`【奇谋刺袅】`）及其行为倾向提示 Tooltip；
2. **大地图迷雾与算筹动态**：观察敌方游骑、使团、集结部队的调动轨迹，利用烽燧视野差欺骗或预判 AI 主攻方向；
3. **季末《西域纪事》战报与复盘摘要**：阅读具有史书质感的 AI 决策归因（如*“单于见敦煌烽火严整，疑有伏兵，遂引骑西折，改掠车师”*）。

### 2.1 博弈示例一：汉方玩家利用烽燧盲区与疑兵，反制「贪利秋掠」型单于 AI

- **背景态势**：剧本②《漠北之后》第 7 季（前 118 年秋 Q3，7 月上旬，蹛林大会季）。
  - **玩家（汉使张骞）**：河西主力 `dun_huang` 驻军 6,500 人（城防完好、烽燧 L3 全覆盖），`ju_yan`（居延）驻军仅 1,500 人，但玩家上季刚在 `zhang_ye — ju_yan` 修筑了烽燧并在 `ju_yan` 囤粮 80,000 斛；同时，玩家正派赵破奴率 4,500 精骑护送精使团前往 `lou_lan`（楼兰）。
  - **AI（伊稚斜单于，挂载性格 `xn_greedy_raider`【贪利秋掠】）**：单于威望 $P = 52$，赏赐池仅剩 `420` 钱（下季期望分赏需 `880` 钱，资金缺口高达 `460` 钱）。
- **AI 感知与内部评分过程（零作弊迷雾视角）**：
  1. **迷雾过滤**：匈奴 AI 调用 `Fog.get_perceived_state(state, "xiongnu")`。由于汉方在 `dun_huang` 与 `ju_yan` 均有活跃亭燧反侦察，匈奴对 `ju_yan` 的情报是 30 天前的 L1 传闻：守军估计区间 `[1000, 3500]`（中值 `2250`），存粮估计 `85,000` 斛；而对 `lou_lan` 方向，因楼兰属匈奴（提供属国视野），匈奴 AI 清晰看到赵破奴 4,500 汉军正在阳关西进，且汉方一条 `chang_an -> dun_huang -> yang_guan` 的 2 级补给线正在满负荷运转（月运量 `32,000` 斛）。
  2. **集结点与目标效用评分**：
     - 性格 `xn_greedy_raider` 的权重为：战利品/劫粮权重 $w_{\text{loot}} = 1.45$、攻坚城惩罚 $w_{\text{siege\_risk}} = 1.35$、风险厌恶系数 $\rho = -0.15$（偏激进，按区间偏下界 `1875` 估算居延汉军）。
     - 候选方案 A（从 `fanfuren_cheng` 集结南下劫掠 `ju_yan`）：预期劫掠金 `+320` 钱、烧粮 `40,000` 斛，感知胜率 $\hat{P}_{\text{win}} = 0.78$，综合效用 $U(A) = 1.45 \times 68 \times 0.78 - 18 = \mathbf{58.9}$。
     - 候选方案 B（从 `yi_wu` 集结强攻 `dun_huang`）：敦煌感知守军 `[5500, 7500]` 叠加强城防，$\hat{P}_{\text{win}} = 0.24 < \text{min\_attack\_prob}(0.55)$，直接被剪枝淘汰（旧版 AI 若硬打必送死）。
     - 候选方案 C（主军从 `hu_jie` 集结进驻 `cheshi_qian` 震慑北道 + 分遣 2 支各 2,000 游骑赴 `yang_guan — lou_lan` 与 `jiu_quan — dun_huang` 发动战术卡【夜袭急击】截断汉补给线）：预期截获粮草与使团金 `+380` 钱，保住楼兰/车师不失（护住路径 B 威服分 $+14$），综合效用 $U(C) = \mathbf{74.2}$！
- **玩家看到的表现与决策互动**：
  - 玩家在 7 月中旬通过阳关烽燧收到预警：`「塞外胡骑未聚伊吾，呼揭尘头大起（估 6,000–9,000 骑），另有一支轻骑（约 2,000）绕过白龙堆直扑阳关粮道！」`
  - 玩家恍然大悟：这位【贪利秋掠】单于看穿了敦煌坚城难啃，改打“北保车师、南截阳关粮道”的组合拳！玩家当即在下季决策中将 `dun_huang -> yang_guan` 补给线护卫策略调高，并令赵破奴部半途设伏反吃匈奴游骑。

### 2.2 博弈示例二：匈奴玩家抽兵南下，遭「奇谋刺袅」型汉使 AI 募使碰瓷 + 矫诏突袭

- **背景态势**：剧本②第 14 季（前 116 年夏 Q2，4 月上旬）。
  - **玩家（匈奴单于）**：为筹集五月龙城大会赏赐，玩家将西域属国赋税统一调至 **3 档（横征暴敛，怨恨每季 `+14`）**，并将驻防 `yi_wu` 的犁汙王部 3,000 骑调往东方 `zhaoxin_cheng` 准备秋掠张掖，导致天山北道空虚；同时日逐王部因连续两季分赏满足度仅 `65%`，忠诚度跌至 `44`。
  - **AI（汉中郎将·傅介子/赵破奴，挂载性格 `han_audacious_schemer`【奇谋刺袅】）**：汉朝廷信任 `trust = 64`，国库 `2,100` 钱，敦煌集结有 5,000 精锐（2,500 骑 + 2,500 弩），当前都护府功业 $G = 58$（处于阶段 II 枢纽攻坚期），但手上**没有**针对 `cheshi_qian`（车师前国）的合法讨伐罪状，且没有朝廷征车师的诏书。
- **AI 感知与内部评分过程**：
  1. **读取边际功业与敌情**：汉 AI 调用 `Victory.get_marginal_merit_map(state)`，发现攻克并控制 `cheshi_qian` 可一口气斩获 **+16 点功业**（属国 6 + 北道咽喉枢纽 10），且能将北道匈奴威吓压低 15 点。
  2. **评估四部裂痕**：汉 AI 调用 `Tribes.get_visible_loyalty_range(state, "rizhu", "han")`，获得日逐王忠诚模糊区间 `[30, 60]`（中值 $\hat{L} = 45$），判定日逐王已出现动摇征兆。
  3. **两步连环奇谋生成**：
     - **第 1 步（Q1 季初已埋伏笔或本季同步试探）**：汉 AI 对高威吓、高怨恨的 `lou_lan` 派遣一支仅耗 `100` 钱的**募使团（`dispatch_envoy(kind="recruited")`）**——哪怕被楼兰王羞辱或扣押，也能稳赚一条 `insult_envoy` 合法罪状（免除后续讨伐楼兰的 `-8` 矫诏惩罚）！
     - **第 2 步（针对车师前的矫诏窗口评分）**：汉 AI ตรวจ发现 `yi_wu` 与 `cheshi_qian` 附近 30 天内感知敌军为 `0`（玩家已抽兵东调），若上疏长安请旨征讨车师，公文往返需 $28 \times 2 = 56$ 天（近 2 个月），届时秋季匈奴主力早已回援！
     - 性格 `han_audacious_schemer` 的矫诏效用加成为 $w_{\text{forge}} = 1.40$，信任安全垫阈值降至 `48`。当前 `trust = 64 >= 52`，执行 `forge_edict(target="cheshi_qian", self_impeach=true)` 仅扣 `-8` 信任（剩 `56`），而奇袭车师预期胜率 $\hat{P}_{\text{win}} = 0.86$，粮食预演 `Preview.simulate_food_curve` 返回 `"green"`（自带民夫 2,000 携粮充足）。
     - 矫诏突袭效用 $U(\text{ForgeAttack}) = 1.40 \times (16 \times 4.5) \times 0.86 - 8 \times 2.2 - 12 = \mathbf{57.1}$，远高于按兵不动请旨的 $U(\text{RequestEdict}) = 24.5$！
- **玩家看到的表现与决策互动**：
  - 匈奴玩家在季中突然收到警报：`「汉使赵破奴矫制发敦煌骑弩五千，自玉门疾趋车师前国！王庭远在赵信城，救之不及！」`
  - 匈奴玩家深刻体会到：面对【奇谋刺袅】型汉使，绝不能在汉朝廷信任充裕时贸然抽空北道防线！

---

## 3. 状态变量、记忆黑板与 42 节点语义标签字典（State Variables & Semantic Tags）

### 3.1 AI 状态变量与记忆黑板（`AIBlackboard`）

为消除无状态 AI“每回合失忆、朝令夕改、同一部队在两个目标间反复横跳”的通病，S08 在 `GameState` 中为每个主要阵营维护一个持久化的轻量级记忆黑板 `state.ai_blackboard`（随存档完整序列化，保证 S/L 后 AI 计划 100% 确定性复现）。

| 名称 | 所属对象 | 类型 | 取值范围 | 初值 | JSON 配置键（`data/ai_profiles.json`） | 存档字段（`state.ai_blackboard[faction]`） |
|---|---|---|---|---|---|---|
| `personality_id` | `AIBlackboard` | `String` | 汉 3 种 / 匈 3 种 ID | 按统帅/剧本初始化 | `personalities.<id>` | `personality_id` |
| `strategic_phase` | `AIBlackboard` (汉) | `int` | `1` (筑基) / `2` (攻坚) / `3` (立府维持) | `1` | `han_phases.merit_thresholds` | `strategic_phase` |
| `active_grand_path` | `AIBlackboard` (匈) | `String` | `"path_a_hexi"` / `"path_b_weifu"` / `"stabilize_tribes"` | `"path_b_weifu"` | `xiongnu_paths.switch_hysteresis` | `active_grand_path` |
| `committed_target_id` | `AIBlackboard` | `String` | 任意合法 `node_id` 或 `""` | `""` | `blackboard.commitment_seasons` | `committed_target_id` |
| `commitment_ttl` | `AIBlackboard` | `int` (季) | `0..4` | `0` | `blackboard.commitment_seasons` (默认 `2`) | `commitment_ttl` |
| `target_fail_counts` | `AIBlackboard` | `Dictionary` | `{node_id: int(0..5)}` | `{}` | `blackboard.fail_cooldown_seasons` | `target_fail_counts` |
| `target_cooldown_until` | `AIBlackboard` | `Dictionary` | `{node_id: int(tick)}` | `{}` | `blackboard.fail_cooldown_ticks` (默认 `18`) | `target_cooldown_until` |
| `last_seen_enemy_main` | `AIBlackboard` | `Dictionary` | `{node_id: String, est_size: int, tick: int}` | `{}` | — | `last_seen_enemy_main` |
| `supply_line_slots` | `AIBlackboard` (汉) | `Array[int]` | 活跃 `SupplyLine.id` 列表（上限 2–3 条） | `[1, 2]` | `han_logistics.max_auto_lines` | `supply_line_slots` |
| `bait_envoy_cooldown` | `AIBlackboard` (汉) | `Dictionary` | `{state_id: int(tick)}` | `{}` | `han_diplomacy.bait_cooldown_ticks` (默认 `18`) | `bait_envoy_cooldown` |
| `last_reward_ratios` | `AIBlackboard` (匈) | `Dictionary` | `{tribe_id: float(0.0..2.0)}` | `{}` | — | `last_reward_ratios` |
| `staged_rally_node` | `AIBlackboard` (匈) | `String` | 具有 `staging_xn` 标签的 `node_id` | `""` | — | `staged_rally_node` |
| `difficulty_tier` | `GameState` | `String` | `"qingche"` / `"chijie"` / `"suiyuan"` | `"chijie"` | `difficulty_modifiers.<tier>` | `state.difficulty_tier` |

> **目标承诺锁（Commitment Hysteresis）**：一旦 AI 将某节点设为战役主目标 `committed_target_id`，在 `commitment_ttl`（默认 2 季 = 18 旬）归零前，除非该目标已被攻克、或己方主力伤亡超过 40%、或首都/河西核心郡出现一级城防危机，否则在效用评估中对该目标赋予 **`+25.0` 的承诺惯性加值（`commitment_bonus`）**，彻底杜绝大军走到半路因微弱分数波动折返跑！

---

### 3.2 彻底废除硬编码：42 节点完整语义标签映射表（Semantic Tag Dictionary）

严格遵循 [`00_bible.md`](00_bible.md) §5 规定：**严禁在 `ai/*.gd` 代码中出现任何类似 `if nid == "yi_wu"` 或 `const HEXI = [...]` 的节点字符串硬编码！** 所有 AI 逻辑一律通过 `AIUtils.get_nodes_by_tag(state, tag)` 或读取节点的 `semantic_tags` 与 `base_strategic_weight` 进行检索与评分。

以下为 [`data/scenario_mvp.json`](../../data/scenario_mvp.json) 全部 **42 个节点** 的标准语义标签与战略基准权重映射表（存于 `data/ai_profiles.json -> node_semantics`）：

| # | 节点 ID (`node_id`) | 中文名称 | 初始阵营/类型 | 语义标签集合 (`semantic_tags`) | 战略基准权重 (`base_strategic_weight`) | AI 战术角色说明 |
|---|---|---|---|---|---|---|
| 1 | `chang_an` | 长安 | `han` / `source` | `["han_capital", "supply_source_han", "court_seat", "convict_recruit"]` | `5.0` | 汉帝国中枢、无限粮源起点、诏令/奏疏收发原点 |
| 2 | `long_xi` | 陇西 | `han` / `city` | `["han_interior", "supply_relay_han", "farm_expandable"]` | `2.5` | 关中至河西咽喉中转站、后方农田扩建点 |
| 3 | `wu_wei` | 武威 | `han` / `city` | `["hexi_commandery", "hexi_east", "supply_relay_han", "farm_expandable", "convict_recruit"]` | `4.0` | 河西东大门、匈奴路径 A 核心争夺目标之一 |
| 4 | `zhang_ye` | 张掖 | `han` / `city` | `["hexi_commandery", "hexi_center", "supply_relay_han", "farm_expandable", "convict_recruit", "juyan_branch_root"]` | `4.2` | 河西中枢、北通居延支线起点、路径 A 核心目标 |
| 5 | `jiu_quan` | 酒泉 | `han` / `city` | `["hexi_commandery", "hexi_west", "supply_relay_han", "farm_expandable", "convict_recruit"]` | `4.0` | 河西西段重镇、路径 A 核心目标 |
| 6 | `ju_yan` | 居延 | `han` / `city` | `["frontier_outpost_han", "staging_han_north", "ambush_target_east", "beacon_priority"]` | `3.2` | 汉北出漠南前哨、匈奴东路南下首要拔点 |
| 7 | `dun_huang` | 敦煌 | `han` / `city` | `["hexi_commandery", "hexi_west", "staging_han_main", "supply_terminal_hexi", "farm_expandable", "convict_recruit"]` | `4.8` | 汉经营西域总基地、西出两关总集结点、路径 A 核心目标 |
| 8 | `yumen_guan` | 玉门关 | `han` / `pass` | `["frontier_gate", "gate_north_route", "beacon_priority", "courier_chokepoint"]` | `3.8` | 西域北道门户、驿传咽喉、烽燧必争点 |
| 9 | `yang_guan` | 阳关 | `han` / `pass` | `["frontier_gate", "gate_south_route", "beacon_priority", "ambush_road", "courier_chokepoint"]` | `3.8` | 西域南道门户、粮道出塞第一险段 |
| 10 | `long_cheng` | 龙城 | `xiongnu` / `nomad` | `["xn_core", "xn_sacred_assembly", "tribe_home_zuoxian", "nomad_recruit"]` | `4.5` | 匈奴五月大会圣地、左贤王庭驻地 |
| 11 | `chanyu_ting` | 单于庭 | `xiongnu` / `nomad` | `["xn_core", "xn_capital", "nomad_recruit"]` | `5.0` | 单于王庭中枢、正月小会驻地 |
| 12 | `zhaoxin_cheng` | 赵信城 | `xiongnu` / `city` | `["staging_xn", "staging_xn_east", "xn_depot"]` | `3.0` | 匈奴漠南中路集结点（威胁居延/张掖） |
| 13 | `fanfuren_cheng` | 范夫人城 | `xiongnu` / `city` | `["staging_xn", "staging_xn_east", "xn_depot"]` | `3.0` | 匈奴东路集结点（威胁武威/张掖） |
| 14 | `youxian_wang` | 右贤王部 | `xiongnu` / `nomad` | `["xn_core", "tribe_home_youxian", "staging_xn", "staging_xn_center", "nomad_recruit"]` | `4.2` | 右贤王本帐、南下酒泉/敦煌中路大本营 |
| 15 | `hu_jie` | 呼揭 | `xiongnu` / `nomad` | `["staging_xn", "staging_xn_west", "xn_flank_north"]` | `2.8` | 匈奴西翼机动集结点（可支援车师或袭扰乌孙东境） |
| 16 | `yi_wu` | 伊吾 | `xiongnu` / `nomad` | `["staging_xn", "staging_xn_west", "tribe_home_lihu", "ambush_road", "gateway_xiyu_east"]` | `3.8` | 犁汙王驻地、西域东口集结点（威胁玉门关/车师/楼兰） |
| 17 | `dong_qiemi` | 东且弥 | `dong_qiemi` / `city` | `["citystate", "citystate_north", "mountain_pass_north"]` | `1.5` | 天山北麓小国、车师后翼侧护卫点 |
| 18 | `cheshi_qian` | 车师前 | `cheshi_qian` / `city` | `["citystate", "citystate_north", "merit_hub", "chokepoint_north", "tuntian_eligible", "presence_priority_xn"]` | `4.5` | **北道第一咽喉**（汉功业枢纽 +10、匈奴威服咽喉 +10） |
| 19 | `cheshi_hou` | 车师后 | `cheshi_hou` / `city` | `["citystate", "citystate_north", "staging_xn_aux", "presence_priority_xn"]` | `2.6` | 车师北翼屏障、匈奴骑兵南下车师前跳板 |
| 20 | `yan_qi` | 焉耆 | `yan_qi` / `city` | `["citystate", "citystate_north", "tongpu_seat", "tribe_home_rizhu", "chokepoint_north", "presence_priority_xn"]` | `4.2` | **僮仆都尉治所**、日逐王驻牧地、南北道腰部锁钥 |
| 21 | `wei_li` | 尉犁 | `wei_li` / `city` | `["citystate", "citystate_north", "corridor_link", "tuntian_eligible"]` | `2.2` | 连接楼兰、焉耆与乌垒的三角走廊节点 |
| 22 | `wu_lei` | 乌垒 | `wu_lei` / `city` | `["citystate", "citystate_north", "merit_hub", "duhu_seat_target", "tuntian_eligible", "chokepoint_center"]` | `4.8` | **西域都护府预定治所**（汉功业核心枢纽 +10，辐射全西域） |
| 23 | `lun_tai` | 轮台 | `lun_tai` / `city` | `["citystate", "citystate_north", "tuntian_prime", "tuntian_eligible", "chokepoint_center"]` | `4.0` | **汉西域核心屯田点**（渠犁/轮台大屯田基地，功业粮仓） |
| 24 | `qiu_ci` | 龟兹 | `qiu_ci` / `city` | `["citystate", "citystate_north", "populous_oasis", "forage_rich", "chokepoint_center"]` | `3.8` | 北道最大人口绿洲城邦、西进大宛必经大粮站 |
| 25 | `gu_mo` | 姑墨 | `gu_mo` / `city` | `["citystate", "citystate_north", "west_corridor"]` | `2.0` | 龟兹至疏勒/温宿西道中转城邦 |
| 26 | `wen_su` | 温宿 | `wen_su` / `city` | `["citystate", "citystate_north", "wusun_gateway"]` | `2.2` | 通往乌孙赤谷城的北山道门户 |
| 27 | `shu_le` | 疏勒 | `shu_le` / `city` | `["citystate", "citystate_north", "pamir_gateway", "forage_rich"]` | `3.0` | 葱岭东麓重镇、西出大宛北道终点枢纽 |
| 28 | `sha_che` | 莎车 | `sha_che` / `city` | `["citystate", "citystate_south", "south_hub", "forage_rich"]` | `3.0` | 南道西段枢纽重镇 |
| 29 | `yu_tian` | 于阗 | `yu_tian` / `city` | `["citystate", "citystate_south", "jade_trade_hub", "forage_rich"]` | `3.2` | 南道中段大国、丝路玉石商税核心节点 |
| 30 | `jing_jue` | 精绝 | `jing_jue` / `city` | `["citystate", "citystate_south", "desert_stepping_stone", "ambush_road"]` | `1.8` | 南道沙漠绿洲跳板、补给脆弱区 |
| 31 | `qie_mo` | 且末 | `qie_mo` / `city` | `["citystate", "citystate_south", "desert_stepping_stone", "tuntian_eligible"]` | `2.2` | 楼兰通往于阗的南道首站跳板 |
| 32 | `lou_lan` | 楼兰 | `lou_lan` / `city` | `["citystate", "citystate_south", "merit_hub", "chokepoint_east", "tuntian_prime", "tuntian_eligible", "ambush_road", "presence_priority_xn", "courier_chokepoint"]` | `4.8` | **西域第一东大门**（汉匈必争咽喉、南北道分水岭、伊循屯田点） |
| 33 | `juan_du` | 捐毒 | `juan_du` / `nomad` | `["citystate", "citystate_pamir", "mountain_nomad"]` | `1.2` | 葱岭行国小邦 |
| 34 | `xiu_xun` | 休循 | `xiu_xun` / `nomad` | `["citystate", "citystate_pamir", "mountain_nomad"]` | `1.2` | 葱岭行国小邦 |
| 35 | `yu_cheng` | 郁成 | `dawan` / `city` | `["great_power_node", "dawan_east_gate", "fortified_gate"]` | `2.8` | 大宛东大门（贰师伐宛前哨阻击点） |
| 36 | `da_wan` | 大宛 | `dawan` / `city` | `["great_power", "great_power_capital", "heavenly_horses", "forage_rich"]` | `3.8` | 大宛王城（贵山城）、汗血天马核心产区 |
| 37 | `ershi_cheng` | 贰师城 | `dawan` / `city` | `["great_power_node", "heavenly_horses"]` | `3.2` | 大宛良马城池、诏令专项讨伐目标 |
| 38 | `kang_ju` | 康居 | `kangju` / `nomad` | `["great_power", "great_power_capital", "steppe_ally_xn"]` | `2.5` | 葱岭西游牧大国（匈奴西翼潜在外援） |
| 39 | `da_yuezhi` | 大月氏 | `dayuezhi` / `city` | `["great_power", "great_power_capital", "trade_terminus"]` | `2.5` | 妫水贸易大国（张骞通使目标、高商税加成） |
| 40 | `ji_bin` | 罽宾 | `jibin` / `city` | `["great_power", "great_power_capital", "trade_terminus"]` | `2.0` | 南亚远方大国（丝路南支终点） |
| 41 | `chi_gu` | 乌孙 | `wusun` / `nomad` | `["great_power", "great_power_capital", "wusun_core", "marriage_alliance_target"]` | `4.2` | **乌孙昆莫王庭（赤谷城）**、汉“断匈奴右臂”头号和亲盟邦 |
| 42 | `yi_lie` | 伊列 | `wusun` / `nomad` | `["great_power_node", "wusun_east_flank"]` | `2.4` | 乌孙东境牧场、协攻车师/呼揭的出兵点 |

---

### 3.3 `data/ai_profiles.json` 完整配置键名结构

所有 AI 参数全部集中在 `data/ai_profiles.json` 中，严禁在 GDScript 中写魔法数字：

```json
{
  "global_utility": {
    "softmax_temperature_default": 4.5,
    "commitment_bonus": 25.0,
    "commitment_seasons": 2,
    "fail_cooldown_ticks": 18,
    "endgame_desperation_seasons": 8,
    "endgame_score_deficit_threshold": 6.0,
    "endgame_risk_tolerance_add": 0.45
  },
  "han_base": {
    "money_reserve_min": 500,
    "trust_safe_floor": 44,
    "trust_forge_min": 52,
    "phase_merit_thresholds": [55, 88, 100],
    "max_auto_supply_lines": 2,
    "default_attack_win_prob": 0.62,
    "tongpu_intercept_min_cavalry": 2000,
    "wavering_rescue_min_troops": 3000,
    "bait_envoy_cost": 100,
    "bait_cooldown_ticks": 18
  },
  "xiongnu_base": {
    "prestige_crisis_floor": 28,
    "loyalty_danger_threshold": 42,
    "jealousy_spread_max": 0.50,
    "path_switch_hysteresis": 0.12,
    "min_attack_probability": 0.55,
    "staging_softmax_temp": 3.5,
    "ambush_softmax_temp": 3.0,
    "beacon_raze_troops": 1500
  },
  "personalities": {
    "han_pioneer_hawk": {},
    "han_prudent_farmer": {},
    "han_audacious_schemer": {},
    "xn_iron_tyrant": {},
    "xn_conciliatory_elder": {},
    "xn_greedy_raider": {}
  },
  "difficulty_modifiers": {
    "qingche": {},
    "chijie": {},
    "suiyuan": {}
  },
  "citystate_ai": {
    "eval_interval_ticks": 9,
    "dual_request_min_inf": 25,
    "dual_request_min_resent_xn": 30,
    "trade_ban_min_intim": 60,
    "trade_ban_max_tilt": -20,
    "betray_supply_resent_han": 55
  },
  "node_semantics": {}
}
```


---

## 4. 规则与公式（Rules, Utility Models & Decision Pseudocode）

> **结算时机总览**：
> - **季初决策（每季第 1 旬，Tick `0, 9, 18, ...`）**：汉 AI（`HanAI.think`）与匈奴 AI（`XiongnuAI.think`）在 WEGO 下令阶段同步运行，先更新 `AIBlackboard` 与迷雾感知快照，再按效用评分生成本季命令列表 `Array[Command]`。
> - **年会与事件即时响应**：当触发朝廷诏令抵达、匈奴三次年会（正月/五月龙城/秋季蹛林）、单于崩逝继承三选一、部王请降或城邦破城善后时，调用对应的专项效用评估器即时返回选项。
> - **季末城邦/大国自主评估（每季第 9 旬季末结算）**：`CityStateAI.evaluate_quarter_end` 对 18 城邦与 5 大国逐一执行外交状态跃迁与自主动作。

---

### 4.1 规则 `S08-R01`：零特权迷雾感知层（Zero-Privilege Fog Perception Layer）

严格执行 [`00_bible.md`](00_bible.md) L9 与 [`STATUS.md`](STATUS.md) `[S05→S08]`、`[S03→S08]` 接口契约：**AI 严禁直接访问 `state.armies` 中的敌军实体、`state.nodes[nid].grain`（非己方节点）或 `state.tribes[tid].loyalty` 真值。** 所有威胁、守军与忠诚度评估必须通过以下三个感知函数读取。

#### 1. 敌军兵力与威胁的风险加权区间估值
对于感知层 `Fog.get_perceived_state(state, ai_faction)` 返回的任意敌军接触报告 $c$（含区间 `[c.size_min, c.size_max]`、点估计 `c.est_size`、情报账龄 `c.age_days`），定义 AI 的**风险厌恶系数** $\rho \in [-0.50, +0.50]$（由统帅性格与终局修正共同决定，$\rho > 0$ 代表谨慎高估敌军，$\rho < 0$ 代表激进低估敌军）：

$$\hat{S}(c, \rho) = \text{clamp}\!\left(c.\text{est\_size} + \rho \cdot (c.\text{size\_max} - c.\text{size\_min}),\; c.\text{size\_min},\; c.\text{size\_max}\right) \times \exp(-\lambda_{\text{decay}} \cdot \max(0, c.\text{age\_days} - 30))$$

- **默认参数**：情报陈旧衰减率 $\lambda_{\text{decay}} = 0.015\text{/日}$（可调范围 `0.005..0.030`，JSON 键 `global_utility.intel_age_decay_rate`）。当敌军虚影超过 30 日未刷新时，AI 对其在此处驻留的确信度按指数衰减，但同时通过 `Preview.compute_enemy_reach` 将其扩散为周边可达节点的潜在威胁：

$$\widehat{\text{Threat}}(n, f_{\text{enemy}}, H) = \sum_{c \in \text{PerceivedArmies}(f_{\text{enemy}})} \mathbb{I}\!\left(\text{DaysTo}(c.\text{last\_node}, n, c.\text{est\_speed}) \le H + c.\text{age\_days}\right) \cdot \hat{S}(c, \rho) \cdot \bar{\alpha}_{\text{unit}}(c)$$

其中 $\bar{\alpha}_{\text{unit}}(c)$ 为根据感知兵种构成的单位人均战力系数（若情报等级为 L1 未知兵种，对匈奴默认取骑射系数 `1.35`，对汉军默认取步弩混合系数 `1.15`）。

#### 2. 匈奴四部忠诚度的模糊区间估值
无论是匈奴单于 AI 还是汉使 AI，在评估四部 $i \in \{\text{zuoxian}, \text{youxian}, \text{rizhu}, \text{lihu}\}$ 的忠诚度时，统一调用 `Tribes.get_visible_loyalty_range(state, tribe_id, ai_faction) -> {min_l, max_l, wavering_detected}`：

$$\hat{L}_i(\rho) = \frac{\text{min\_l}_i + \text{max\_l}_i}{2} - \rho_{\text{pol}} \cdot \frac{\text{max\_l}_i - \text{min\_l}_i}{2}$$

- 对匈奴单于 AI：政治风险厌恶系数 $\rho_{\text{pol}} = +0.35$（宁可把部下想得更不忠，提前赏赐防叛）；
- 对汉使 AI：政治风险厌恶系数 $\rho_{\text{pol}} = -0.25$（仅在区间中偏上仍低于阈值时才确信其动摇，避免盲目派军扑空）。

#### 3. `ai/ai_utils.gd` 感知层重构伪代码

```gdscript
# ai/ai_utils.gd —— 零特权感知接口（彻底替换原直接遍历 state.armies 的实现）
static func estimate_contact_size(contact: Dictionary, rho: float, decay_rate := 0.015) -> float:
	var span: float = float(contact["size_max"] - contact["size_min"])
	var raw: float = clampf(float(contact["est_size"]) + rho * span, float(contact["size_min"]), float(contact["size_max"]))
	var stale_days: float = maxf(0.0, float(contact.get("age_days", 0)) - 30.0)
	return raw * exp(-decay_rate * stale_days)

static func perceived_enemy_threat_at(state, node_id: String, ai_faction: String, horizon_days: float, rho: float) -> float:
	var p_state: Dictionary = Fog.get_perceived_state(state, ai_faction)
	var total_threat := 0.0
	for c in p_state["enemy_contacts"]:
		var reach: Dictionary = Preview.compute_enemy_reach(state, c["contact_id"], horizon_days)
		if reach["reachable_nodes"].has(node_id):
			var dist_factor: float = reach["reachable_nodes"][node_id]["prob_weight"] # 距离越近权重越高 (0.25..1.0)
			var est_troops: float = estimate_contact_size(c, rho)
			var unit_mult: float = c.get("est_unit_quality", 1.35 if c["faction"] == "xiongnu" else 1.15)
			total_threat += est_troops * unit_mult * dist_factor
	return total_threat

static func perceived_defenders_at(state, node_id: String, ai_faction: String, rho: float) -> Dictionary:
	var p_state: Dictionary = Fog.get_perceived_state(state, ai_faction)
	var node_info: Dictionary = p_state["nodes"].get(node_id, {})
	# 若节点不在视野内，按最后已知城防民兵 + 节点战略等级基线先验估算
	var militia: Dictionary = node_info.get("est_militia", {"infantry": 1200}).duplicate()
	for c in p_state["enemy_contacts"]:
		if c["last_node"] == node_id and c.get("age_days", 0) <= 45:
			var s := int(estimate_contact_size(c, rho))
			var main_type: String = "horse_archer" if c["faction"] == "xiongnu" else "infantry"
			militia[main_type] = militia.get(main_type, 0) + s
	return militia
```

---

### 4.2 规则 `S08-R02`：通用效用评分框架（Utility AI Mathematical Model）

为兼顾战略理性与不可预测性，S08 所有高层决策统一采用**带承诺惯性与后勤风险惩罚的乘性-加性混合效用模型（Hybrid Multiplicative-Additive Utility Model）**。

#### 1. 核心效用方程
对于任意候选战略动作 $a \in \mathcal{A}_{\text{valid}}$（如远征某城、册封某国、集结某点、激活某战术卡）：

$$U(a) = \underbrace{w_p(\text{type}(a)) \cdot V_{\text{strategic}}(a) \cdot \left(\hat{P}_{\text{success}}(a)\right)^{\gamma}}_{\text{期望战略收益}} - \underbrace{w_{\text{risk}} \cdot R_{\text{logistics\_pol}}(a)}_{\text{后勤与政治风险惩罚}} - \underbrace{w_{\text{cost}} \cdot C_{\text{norm}}(a)}_{\text{归一化资源成本}} + \underbrace{B_{\text{commit}}(a)}_{\text{承诺惯性}} - \underbrace{P_{\text{cooldown}}(a)}_{\text{受挫冷却惩罚}}$$

各项系数定义与默认值（存于 `data/ai_profiles.json`）：
- $w_p(\text{type}(a)) \in [0.4, 2.0]$：当前统帅**性格矩阵**赋予该类动作的偏好乘数（见 `S08-R07`）；
- $V_{\text{strategic}}(a) \in [0, 100]$：动作的基础战略价值。对汉方远征/外交，直接读取 `S01.get_marginal_merit_map(state)[target] * 4.5 + base_strategic_weight * 5.0`；对匈奴，读取路径 A（河西破城权重）或路径 B（威服分增量 + 预期劫掠金 $/ 10$）；
- $\hat{P}_{\text{success}}(a) \in [0.0, 1.0]$：基于迷雾估计值计算的预期成功率（军事动作取 `Combat.expected_p`，外交动作取 `Diplomacy.estimate_mission_success`，诏令讨价取 `Court.calc_bargain_prob`）；指数 $\gamma = 1.25$（默认，抑制低胜率侥幸投机）；
- $R_{\text{logistics\_pol}}(a) \in [0, 100]$：后勤断粮风险与政治崩盘风险之和：
  - 若 `Preview.simulate_food_curve` 返回 `"red"`，则 $R_{\text{logistics\_pol}} = +999$（硬性一票否决）；返回 `"yellow"`（需破城或高价买粮才能返程），则 $R_{\text{logistics\_pol}} = 28.0$；返回 `"green"`，则 $R_{\text{logistics\_pol}} = 0.0$；
  - 若动作消耗朝廷信任导致预计 `trust < 44`（汉）或导致单于威望预计 `< 28`（匈），额外叠加政治风险 $+45.0$；
- $C_{\text{norm}}(a) = \frac{\text{MoneyCost}(a)}{\max(500, \text{AvailableBudget})} \times 20.0 + \frac{\text{LaborerOrHorseCost}(a)}{5000} \times 10.0$；
- $B_{\text{commit}}(a)$：若 $a.\text{target\_id} == \text{blackboard.committed\_target\_id}$ 且 $\text{commitment\_ttl} > 0$，加 `+25.0`，否则为 `0`；
- $P_{\text{cooldown}}(a)$：若 $\text{tick} < \text{blackboard.target\_cooldown\_until}[a.\text{target\_id}]$，罚 `-60.0`（防止在同一个啃不动的坚城下连续送死）。

#### 2. 软最大（Softmax）随机采样与温度控制
为彻底根除“背板 AI”，对于集结点选择、伏击路段选择以及分差在 `15%` 以内的并列最优目标，AI 不使用死板的 `argmax`，而是对前 $K=3$ 个最高分非劣选项执行 **Boltzmann Softmax 采样**（使用 `GameState.rng`）：

$$\Pr(\text{选择 } a_i) = \frac{\exp\!\left(\frac{U(a_i) - U_{\max}}{\tau}\right)}{\sum_{j=1}^{K} \exp\!\left(\frac{U(a_j) - U_{\max}}{\tau}\right)}$$

- 温度系数 $\tau$ 由难度档位与动作类型共同决定（标准难度下集结/设伏 $\tau = 3.5$，主战略目标 $\tau = 1.8$；最高难度「虽远必诛」下主目标 $\tau = 0.8$ 更趋近冷静最优解，而佯动/设伏保持 $\tau = 3.0$ 维持不可预测性）。

#### 3. 终局落后冲刺修正（Endgame Desperation Modifier，对齐 S01 §7.3）
每季初，若剩余回合数 $T_{\text{rem}} \le 8$ 季（最后 2 年），AI 调用 `Victory.evaluate_expiry_preview(state)`：
- 若自身未达成主胜利，且预览到期得分落后对手 $\Delta S_{\text{expiry}} \ge 6.0$ 分，触发**绝地反击态（`desperation_mode = true`）**：
  - 风险厌恶系数下调：$\rho \leftarrow \rho - 0.45$（更敢于进攻迷雾中的敌点）；
  - 最低出击胜率门槛下调：`attack_win_prob` 降低 `-0.12`（如汉从 `0.62` 降至 `0.50`）；
  - 汉 AI 矫诏信任门槛从 `52` 放宽至 `38`；匈奴 AI 自动在秋季开启 `chanyu_personal_command = true`（单于亲征 `+15%` 战力，孤注一掷）。

---

### 4.3 规则 `S08-R03`：汉方 AI 政治、后勤与外交决策（Han AI Court, Logistics & Diplomacy）

#### 1. 三阶段战略状态机（对齐 S01 §7.1）
每季初，汉 AI 读取当前都护府功业值 $G = \text{Victory.calc\_duhu\_merit}(state)$ 与维持月数 `han_hold_months`，更新 `blackboard.strategic_phase`：
- **阶段 I：河西筑基与东口破局期（$G < 55$）**
  - 战略重心：保住河西四郡秋收、打通 `yumen_guan / yang_guan -> lou_lan -> qie_mo` 走廊、优先对低威吓南道城邦派使团吃满前段属国功业分，并在 `lou_lan` 或 `lun_tai` 建立首个屯田点。
  - 持节者驻地：锚定具有 `staging_han_main` 或 `frontier_gate` 标签的节点（默认 `dun_huang`），保持距长安单程 $\le 28$ 旬的高效奏疏往返。
- **阶段 II：天山中段枢纽与屯田攻坚期（$55 \le G < 88$）**
  - 战略重心：读取 `Victory.get_marginal_merit_map(state)`，集中兵力与精使团争夺具有 `merit_hub` 标签的核心枢纽（`wu_lei` 乌垒、`cheshi_qian` 车师前），将具有 `tuntian_prime` 标签的节点（`lun_tai` 轮台）屯田扩建至 Lv2 并攒满 `60,000` 斛屯田粮；同时密切监听北道日逐王/犁汙王动摇信号。
  - 持节者驻地：一旦汉方控制 `lou_lan` 且在西域拥有至少 1 座驻军城邦，自动下达 `relocate_character` 将持节者前推至 `wu_lei` 或 `lun_tai`，解锁 2 跳内“以节发诸国兵”。
- **阶段 III：立府维持与河西死守期（$G \ge 100$ 或 `han_hold_months > 0` 或 $G \ge 88$ 临门一脚）**
  - 战略重心：当 $G \ge 100$ 进入 12 个月立府维持倒计时后，**严禁发起往返超过 60 天的远征**！所有机动野战军回撤驻防 `duhu_seat_target`（`wu_lei`）、`chokepoint_north`（`cheshi_qian`）与 `hexi_commandery`（河西四郡）；防务预算权重翻倍（$\times 2.0$）；若 `court.trust < 38` 或 `recall_active == true`，倾尽国库完成朝廷当前诏令或打一场防御反击胜仗以解除召还冻结。

#### 2. 应对朝廷诏令与主动上疏评分（对齐 S02 §7.1）
- **待回应诏令四选一**：对每份 `state == "pending_response"` 的诏令 $e$：
  1. 计算按期完成可行性 $F(e) = \text{clamp}\!\left(0.5 + \frac{(e.\text{deadline\_tick} - \text{tick}) - T_{\text{est}}(e)}{e.\text{deadline\_tick} - \text{tick}},\, 0.0,\, 1.0\right)$；
  2. 计算三项合法回应的效用（AI 永不选择“搁置不回”）：
     - $U_{\text{accept}} = 100 \cdot F(e) + 2.5 \cdot e.\text{reward\_trust} - 3.0 \cdot (1 - F(e)) \cdot |e.\text{penalty\_trust}|$
     - $U_{\text{bargain}} = 100 \cdot F_{\text{ext}}(e) \cdot P_{\text{bargain}}(e) - 15 \cdot \frac{D_{\text{roundtrip}}}{90} + \mathbb{I}(\text{winter\_snow\_pass}) \cdot 12.0$
     - $U_{\text{decline}} = -1.5 \cdot |0.5 \cdot e.\text{penalty\_trust}| - \mathbb{I}(e.\text{is\_strict}) \cdot 500.0$
  3. 选最高分下达 `respond_edict(edict_id, action, reason_tag)`。
- **主动上疏（`submit_memorial`）触发规则**：
  - 若 `money < 900` 且 `court.trust >= 50` 且无在途请款疏，下达 `submit_memorial(type="request_funds")`；
  - 若筹备阶段 II 枢纽攻坚或河西告急，且中央军可用额度 `< 3000`、`court.trust >= 55`，下达 `submit_memorial(type="request_troops")`。

#### 3. 自动化补给线管理（彻底替代旧版 6 段手工 `convoy`，对齐 S05 §7.1）
汉 AI 完全弃用原 `han_ai.gd::_logistics` 的 6 段手工派车，改为通过 S05 的 `manage_supply_line` 命令维护 **1–2 条常设自动补给线**：
1. **河西—西域主干线（Slot 1）**：
   - 起点恒为具有 `supply_source_han` 标签的 `chang_an`；
   - 终点动态绑定：开局为 `dun_huang`（`priority=2, target_months=6.0`）；当汉军攻克并驻军 `lou_lan` 后，终点延伸至 `lou_lan`；当持节者进驻 `wu_lei` 或 `lun_tai` 设屯田后，若沿途畅通则延伸至 `lun_tai`；
   - **秋收保护与战时加压调节**：每逢 Q3（7–9 月秋收季），若前线无一级战事且终点存粮 $\ge 4.5$ 个月，汉 AI 自动将主干线 `priority` 下调为 `1`（释放河西民夫归农，防止触发 S05 秋收减产惩罚）；而在发起大规模远征前 1 季，提前将 `priority` 调至 `3`、`target_months` 调至 `8.0`。
2. **居延北塞支线（Slot 2）**：
   - 起点 `zhang_ye`，终点 `ju_yan`（`priority=1, target_months=4.0`）；仅当 `ju_yan` 感知敌军威胁 $> 2,000$ 或存粮 $< 3.0$ 个月时激活，平时置为 `priority=0`（暂停）以节省张掖民夫。

#### 4. 阶梯式邦交与「募使碰瓷博罪状」伪代码（对齐 S04 §7.1）

```gdscript
# ai/han_ai.gd —— 政治、后勤与阶梯式邦交决策伪代码
func _court_and_edicts(state, cmds: Array, prof: Dictionary, bb: Dictionary) -> void:
	for edict in Court.get_pending_edicts(state):
		var f_now: float = _estimate_edict_feasibility(state, edict, 0)
		var f_ext: float = _estimate_edict_feasibility(state, edict, 6) # 延期6旬后的可行性
		var p_bargain: float = Court.preview_bargain_prob(state, edict["id"])
		var rt_days: float = Path.courier_days_roundtrip(state, "chang_an", Court.get_holder_node(state))
		var u_accept: float = 100.0 * f_now + 2.5 * edict["reward_trust"] - 3.0 * (1.0 - f_now) * absf(edict["penalty_trust"])
		var u_bargain: float = 100.0 * f_ext * p_bargain - 15.0 * (rt_days / 90.0)
		var u_decline: float = -1.5 * absf(0.5 * edict["penalty_trust"]) - (500.0 if edict.get("is_strict", false) else 0.0)
		var action := "accept"
		if u_bargain > u_accept and u_bargain > u_decline:
			action = "bargain"
		elif u_decline > u_accept and state.court["trust"] >= 45:
			action = "decline"
		cmds.append(Cmd.make("respond_edict", "han", {"edict_id": edict["id"], "action": action}))
	# 主动上疏请款/请兵
	if state.factions["han"]["money"] < 900 and state.court["trust"] >= 50 and not Court.has_active_memorial(state, "request_funds"):
		cmds.append(Cmd.make("submit_memorial", "han", {"type": "request_funds"}))

func _manage_auto_logistics(state, cmds: Array, prof: Dictionary, bb: Dictionary) -> void:
	var main_term := "dun_huang"
	if state.nodes["lou_lan"]["faction"] == "han" and Diplomacy.is_route_safe(state, "dun_huang", "lou_lan"):
		main_term = "lou_lan"
	var is_autumn_harvest: bool = (state.quarter() == 3)
	var prepping_war: bool = (bb["committed_target_id"] != "")
	var prio: int = 3 if prepping_war else (1 if is_autumn_harvest else 2)
	var target_m: float = 8.0 if prepping_war else 6.0
	cmds.append(Cmd.make("manage_supply_line", "han", {
		"slot": 1, "from": "chang_an", "to": main_term, "priority": prio, "target_months": target_m
	}))

func _diplomacy_utility(state, cmds: Array, prof: Dictionary, bb: Dictionary, budget: float) -> float:
	var merit_map: Dictionary = Victory.get_marginal_merit_map(state, "han")
	var cands: Array = []
	for sid in state.relations:
		var rel: Dictionary = state.relations[sid]
		if rel["overlord"] == "han" and rel.get("vassal_tier", "") == "vassal":
			continue
		# 1. 可直接纳为属国或册封印绶时，立即执行（零延迟高功业）
		if Diplomacy.can_vassal(state, sid) == "":
			cmds.append(Cmd.make("make_vassal", "han", {"state": sid}))
			continue
		if Diplomacy.can_enfeoff(state, sid) == "" and budget >= 200:
			cmds.append(Cmd.make("grant_enfeoffment", "han", {"state": sid}))
			budget -= 200.0
			continue
		# 2. 饱足度 >= 2 的城邦本季暂停送礼（S04 边际递减规则）
		if int(rel.get("satiation", 0)) >= 2:
			continue
		# 3. 评估派遣精使团 vs 募使团 vs 募使碰瓷博取罪状
		var m_val: float = merit_map.get(sid, 2.0) * 5.0 + U.node_strategic_weight(state, sid) * 3.0
		var gap_to_enfeoff: float = maxf(0.0, 30.0 - rel["han_influence"])
		var gap_to_vassal: float = maxf(0.0, maxf(60.0, rel["xn_intimidation"] + 15.0) - rel["han_influence"])
		if rel["xn_intimidation"] > rel["han_influence"] + 35.0:
			# 威吓锁死区：若该国是高价值咽喉且尚无合法讨伐罪状，评估「募使碰瓷博罪状」
			if m_val >= 25.0 and not Diplomacy.has_valid_crime(state, sid) and state.tick >= bb["bait_envoy_cooldown"].get(sid, 0):
				var u_bait: float = prof["w_schemer"] * m_val * 0.65 - 8.0
				cands.append({"sid": sid, "kind": "recruited", "tier": "small", "cost": 100.0, "utility": u_bait, "is_bait": true})
			continue
		# 正常拉拢：枢纽国且有空闲具名使臣时派精使团(grand)，普通南道小国派募使团(recruited)
		var char_id: String = Characters.pick_idle_envoy(state, "han")
		var use_grand: bool = (m_val >= 28.0 and char_id != "" and gap_to_vassal <= 35.0)
		var cost: float = 300.0 if use_grand else 120.0
		var p_arrive: float = Diplomacy.estimate_envoy_survival(state, sid)
		var u_env: float = prof["w_diplomacy"] * m_val * p_arrive - (cost / maxf(budget, 500.0)) * 20.0
		cands.append({"sid": sid, "kind": "grand" if use_grand else "recruited", "char_id": char_id, "cost": cost, "utility": u_env, "is_bait": false})
	cands.sort_custom(func(a, b): return a["utility"] > b["utility"])
	var dispatched := 0
	for item in cands:
		if dispatched >= 3 or item["utility"] <= 5.0 or budget < item["cost"]:
			break
		cmds.append(Cmd.make("dispatch_envoy", "han", {
			"target": item["sid"], "kind": item["kind"], "character_id": item.get("char_id", ""), "budget": item["cost"]
		}))
		if item["is_bait"]:
			bb["bait_envoy_cooldown"][item["sid"]] = state.tick + 18
		budget -= item["cost"]
		dispatched += 1
	return budget
```

---

### 4.4 规则 `S08-R04`：汉方 AI 防务、远征预演、矫诏奇袭与北道特种作战（Han AI Military）

#### 1. 基于语义标签的动态防务与罪人兵（`convict`）节制招募
- **防务扫描范围**：不再硬编码 `HEXI`，而是动态合并 `AIUtils.get_nodes_by_tag(state, "hexi_commandery")`、`get_nodes_by_tag(state, "frontier_outpost_han")` 以及己方已控制的 `merit_hub` 节点。
- **迷雾威胁响应**：对每个节点计算 $\widehat{\text{Threat}}(n, \text{"xiongnu"}, H + 30, \rho)$。当感知威胁超过本地城防有效战力 `0.85` 倍时触发征兵：
  - 优先在具有 `staging_han_main` 或受威胁节点调用中央军额度（`source="central"`）；
  - 若中央军额度耗尽且河西告急（威胁 $> 1.2\times$ 守军），调用七科谪招募罪人兵（`source="convict"`），但在常规态势下严格控制当年累计招募罪人兵 $\le 5,000$ 人（避免触发 S05 丝路商税 $\times 0.85$ 惩罚；仅在河西某郡城防濒临失守时才允许突破 5,000 上限）。

#### 2. 北道两大特种作战高优拦截器（对齐 S03 §7.4）
在常规远征评分前，汉 AI 优先检查两项高回报特种窗口：
1. **9 旬黄金窗口出塞迎降动摇部王（`RescueWaveringTribe`）**：
   - 当存在 `tribe.status == "wavering"` 且已向汉方发出请降信号（如日逐王或犁汙王请降，剩余窗口 $\le 9$ 旬）时：
   - 汉 AI 立即检索距离目标部王驻地最近、兵力 $\ge 3,000$ 的闲置野战军，优先为其绑定一名在场具名将使（遵循 `[R-04]`：有具名将使随行则 100% 接收 50% 丁口无哗变），赋予效用基数 **$U = +95.0$（最高战略优先级）**，生成直趋迎降节点的急行军计划。
2. **北道截击僮仆都尉税队（`InterceptTongpuEscort`）**：
   - 当 `Fog.get_perceived_state` 在北道走廊（`yan_qi — wei_li — cheshi_qian — yi_wu`）侦知带有 `command_owner == "tongpu"` 特征的匈奴税队护卫军，且汉方在 `dun_huang`、`lou_lan` 或 `wu_lei` 拥有闲置骑兵 $\ge 2,000$ 人时：
   - 评估截击胜率 $\hat{P}_{\text{win}}$ 与往返粮草，若 $\hat{P}_{\text{win}} \ge 0.68$ 且粮草绿灯，生成快速穿插截击计划（击败护卫军可缴获 50% 在途税银并概率击杀僮仆都尉，令全西域匈奴威吓 $-15$）。

#### 3. 远征生成、粮食曲线红绿灯预演与矫诏奇袭伪代码（对齐 S05 §7.3 & S02 §7.2）

```gdscript
# ai/han_ai.gd —— 远征、断粮预演拦截、矫诏突袭与特种作战伪代码
func _expedition_and_special_ops(state, cmds: Array, prof: Dictionary, bb: Dictionary, budget: float) -> void:
	var idle_armies: Array = U.idle_field_armies(state, "han")
	if idle_armies.is_empty():
		_try_assemble_expedition_army(state, cmds, prof, bb, budget)
		return
	var main_army: Dictionary = idle_armies[0]
	var origin: String = U.at_node(main_army)
	# 特种窗口 A：9旬内迎降动摇部王（最高优先级）
	for tid in ["rizhu", "lihu", "youxian", "zuoxian"]:
		if Tribes.is_offering_surrender_to_han(state, tid) and state.army_size(main_army) >= 3000:
			var meet_node: String = Tribes.get_surrender_meet_node(state, tid)
			var char_id: String = Characters.pick_commander_at(state, origin)
			if char_id != "":
				cmds.append(Cmd.make("assign_commander", "han", {"army": main_army["id"], "character_id": char_id}))
			var steps := [{"type": "move_to", "node": meet_node}, {"type": "return_to", "node": origin}]
			if _validate_food_and_dispatch(state, cmds, main_army, steps, "rescue_surrender"):
				return
	# 特种窗口 B：北道截击僮仆都尉税队
	var tongpu_contact: Dictionary = U.find_perceived_tongpu_escort(state, "han")
	if not tongpu_contact.is_empty() and U.count_units(main_army, "cavalry") >= 2000:
		var intercept_node: String = tongpu_contact["last_node"]
		var steps := [{"type": "move_to", "node": intercept_node}, {"type": "return_to", "node": origin}]
		if _validate_food_and_dispatch(state, cmds, main_army, steps, "intercept_tongpu"):
			return
	# 常规/矫诏远征目标效用评估
	var merit_map: Dictionary = Victory.get_marginal_merit_map(state, "han")
	var best_cand := {}
	var best_u := -INF
	for nid in U.get_nodes_by_tags(state, ["citystate", "staging_xn", "great_power_node"]):
		if state.nodes[nid]["faction"] == "han" or state.tick < bb["target_cooldown_until"].get(nid, 0):
			continue
		var sid: String = state.nodes[nid]["faction"]
		var has_auth: bool = Court.is_target_authorized(state, nid) or Diplomacy.has_valid_crime(state, sid) or sid == "xiongnu"
		var need_forge: bool = not has_auth
		if need_forge and state.court["trust"] < prof["trust_forge_min"]:
			continue # 朝廷信任不足以承担矫诏风险
		var est_def: Dictionary = U.perceived_defenders_at(state, nid, "han", prof["rho"])
		var p_win: float = Combat.expected_p(state, main_army["units"], est_def, {"b_def": Combat.wall_mult(state, state.nodes[nid])})
		if p_win < prof["attack_win_prob"]:
			continue
		var v_strat: float = merit_map.get(sid, 3.0) * 4.5 + U.node_strategic_weight(state, nid) * 5.0
		var u: float = prof["w_expedition"] * v_strat * pow(p_win, 1.25)
		if need_forge:
			u = prof["w_forge"] * u - 8.0 * 2.2 # 扣除矫诏自劾的8点信任折算代价
		if nid == bb["committed_target_id"] and bb["commitment_ttl"] > 0:
			u += 25.0
		if u > best_u:
			best_u = u
			best_cand = {"nid": nid, "sid": sid, "need_forge": need_forge, "p_win": p_win}
	if best_cand.is_empty() or best_u <= 15.0:
		return
	# 尝试生成作战计划并通过 S05 粮食预演硬门槛校验
	var target_nid: String = best_cand["nid"]
	var plan_steps := [{"type": "siege", "node": target_nid, "max_months": 3, "assault_when": 0.55}, {"type": "return_to", "node": origin}]
	if not _validate_food_and_dispatch(state, cmds, main_army, plan_steps, "expedition", best_cand["need_forge"], target_nid):
		# 若直攻断粮(red)，自动降级为先攻占或进驻半途最近的跳板节点
		var stepping: String = U.find_midway_stepping_stone(state, origin, target_nid)
		if stepping != "":
			var step_plan := [{"type": "siege", "node": stepping, "max_months": 2, "assault_when": 0.6}, {"type": "return_to", "node": origin}]
			_validate_food_and_dispatch(state, cmds, main_army, step_plan, "stepping_stone", false, stepping)

func _validate_food_and_dispatch(state, cmds: Array, army: Dictionary, steps: Array, role: String, need_forge := false, target_nid := "") -> bool:
	# 1. 调用 S05 粮食预演曲线，绝不派必饿死之兵
	var preview: Dictionary = Preview.simulate_food_curve(state, army, steps)
	if preview["summary_light"] == "red":
		# 尝试增配本地可用民夫与车载粮后重测
		var extra_lab: int = U.calc_affordable_extra_laborers(state, U.at_node(army), army)
		if extra_lab > 0:
			cmds.append(Cmd.make("load", "han", {"army": army["id"], "grain": extra_lab * 15.0, "laborers": extra_lab}))
			preview = Preview.simulate_food_curve_with_extra(state, army, steps, extra_lab, extra_lab * 15.0)
	if preview["summary_light"] == "red":
		return false # 仍为红灯，硬性熔断本季出征！
	# 2. 如需矫诏，先下达矫诏并自劾命令
	if need_forge:
		cmds.append(Cmd.make("forge_edict", "han", {"target": target_nid, "self_impeach": true}))
	# 3. 持节者在2跳内时，自动以节征发沿途属国协从兵
	if Court.can_levy_vassal_troops_for(state, target_nid):
		cmds.append(Cmd.make("levy_vassal_troops", "han", {"target": target_nid, "max_troops": 2000}))
	cmds.append(Cmd.make("set_plan", "han", {"army": army["id"], "steps": steps, "preset": "balanced", "role": role}))
	state.ai_blackboard["han"]["committed_target_id"] = target_nid
	state.ai_blackboard["han"]["commitment_ttl"] = 2
	return true
```


---

### 4.5 规则 `S08-R05`：匈奴 AI 全套决策规则与伪代码（Xiongnu Confederation & Campaign AI）

#### 1. 双路径动态自适应与防崩盘护栏（根除 S09 无脑 Rush 河西支配策略，对齐 S01 §7.2）
每季初，匈奴 AI 首先评估内部政治稳定度与两条主胜利路径的推进效率，更新 `blackboard.active_grand_path`：
1. **防崩盘硬性护栏（`"stabilize_tribes"`）**：
   - 调用 `Tribes.get_visible_loyalty_range(state, tid, "xiongnu")` 计算四部风险修正忠诚度 $\hat{L}_i(+0.35)$。
   - 若单于威望 $P_{\text{chanyu}} \le 28$，或存在任意一部 $\hat{L}_i \le 38$，或 `scatter_consecutive_turns >= 1`（已触发 1 季离散警告）：
   - 匈奴 AI **强制切换至 `"stabilize_tribes"` 模式**：本季严禁对汉军坚城（城防乘数 $\ge 1.5$ 的 `hexi_commandery`）发动围城战！资金 100% 优先注入四部分赏与五月龙城【厚币怀柔】，军事上只允许劫掠无城墙或弱防的暴露粮队、拔除落单亭燧以低伤亡刷回单于威望。
2. **路径 A（饮马河西 `"path_a_hexi"`）vs 路径 B（威服西域 `"path_b_weifu"`）效用比选**：
   - 计算路径 A 进度势能：
     $$E_A = 25.0 \times N_{\text{hexi\_captured}} + \sum_{n \in \text{Tag}(\text{hexi\_commandery})} \max\!\left(0,\; 20.0 \times \left(1.2 - \frac{\widehat{\text{Def}}(n)}{\text{MyMainCav}}\right)\right)$$
   - 计算路径 B 进度势能：
     $$E_B = 1.0 \times W_{\text{current}} + 15.0 \times \mathbb{I}(\text{tongpu\_active}) + \sum_{s \in \text{Tag}(\text{presence\_priority\_xn})} 8.0 \times \mathbb{I}(\text{overlord}(s) == \text{"xiongnu"})$$
   - 含滞回阈值（`path_switch_hysteresis = 0.12`）：当 $E_A > E_B \times (1 + 0.12) \cdot w_{\text{path\_b\_bias}}$ 且单于威望 $\ge 55$ 时选 `"path_a_hexi"`；当汉方河西四郡城防坚固（$\widehat{\text{Def}}(n)$ 高）时，$E_A$ 自动暴跌，匈奴 AI 平滑切换至 `"path_b_weifu"`，转而经略天山北道、锁死楼兰商路、护卫僮仆都尉并截击汉军出塞粮道。

#### 2. 四部分赏博弈防叛离算法（对齐 S03 §7.2）
匈奴 AI 每季初通过三步凸优化启发式分配 `reward_pool`：
- **第 1 步（紧急止血）**：若侦知某部 `wavering_detected == true` 且赏赐池 $\ge 400$ 钱，立即生成 `pacify_wavering_tribe`；若正值 Q1 且上季发生重度白灾，预留 `300` 钱执行 `relieve_white_disaster`。
- **第 2 步（基准满足比设定）**：设四部期望分赏为 $E_i$。对前线咽喉部族（`rizhu` 日逐王、`lihu` 犁汙王）若 $\hat{L}_i < 50$，目标满足比设为 $r_i^* = 1.05$；对秋季拟征调主力（如 `youxian` 右贤王），在 Q2/Q3 目标满足比设为 $r_i^* = 1.10$（确保 $\hat{L}_i \ge 60$ 享受征兵费用折扣与高响应率）；其余部族设为 $r_i^* = 0.85$。
- **第 3 步（防攀比嫉妒裁剪）**：若总预算不足，按比例缩放 $r_i$，并在缩放后强制执行极差投影：若 $\max_i r_i - \min_j r_j > 0.48$（逼近 S03 的 `0.50` 攀比红线），将最高部的超出额削峰填谷补贴给最低部，确保**绝不因 AI 自己分赏不均触发 `-8` 攀比忠诚惩罚**。

#### 3. 三次年会与单于继承三选一评分规则
- **Q1 正月诸长小会**：若在位单于年迈（年龄 $\ge 58$）且当前储君忠诚度估计 $\hat{L}_{\text{heir}} < 50$，评估改立左贤王或威望最高子弟；若威望充裕（$P \ge 65$），选择【申明军法】压制诸部宿怨。
- **Q2 五月龙城大会**：
  - 若 $P < 42$ 或任一部王 $\hat{L}_i < 48$ 且 `reward_pool >= 300`：必选 **【厚币怀柔】**（全员忠 `+8`）；
  - 若处于 `"path_a_hexi"` 备战期且 $P \ge 60$：选 **【祭天耀武】**（提升威望与秋掠动员上限）；
  - 否则选 **【平议牧界】**（均衡恢复草场承载力与部族关系）。
- **Q3 秋季蹛林大会（主攻靶标投票）**：
  - 汇总各部王 `preferred_targets` 与当前战略路径（`path_a_hexi` 倾向居延/酒泉/张掖，`path_b_weifu` 倾向车师前/楼兰/乌垒），选择既符合战略路径、又能迎合至少 1 名主力部王偏好（获 `+6` 忠诚与免征召费加成）的靶标。
- **单于崩逝继承危机（`evt_chanyu_succession` 三选一）**：
  - 【奉遗命立嫡长】效用：$U_1 = 1.2 \cdot \hat{L}_{\text{zuoxian}} + 0.8 \cdot P_{\text{current}}$（稳健守成首选）；
  - 【推戴强藩贤王】效用：$U_2 = 1.5 \cdot \text{Command}_{\text{youxian}} + 35.0 \cdot \mathbb{I}(\text{desperation\_mode}) - 20.0$（需要高统率强藩破局时选）；
  - 【权臣拥立幼主】效用：$U_3 = -50.0$（AI 极力规避幼主威望暴跌，仅在前两项储君均已阵亡/叛离时兜底）。

#### 4. 动态 Softmax 集结点、伏击道与季度战术卡伪代码（彻底消除背板）

```gdscript
# ai/xiongnu_ai.gd —— 匈奴分赏、年会、动态集结/伏击与战术卡全套伪代码
func think(state) -> Array:
	var cmds: Array = []
	var bb: Dictionary = state.ai_blackboard["xiongnu"]
	var prof: Dictionary = U.get_active_profile(state, "xiongnu")
	_update_grand_path(state, prof, bb)
	_distribute_rewards_and_tribes(state, cmds, prof, bb)
	_handle_seasonal_assembly(state, cmds, prof, bb)
	_diplomacy_and_tongpu_taxes(state, cmds, prof, bb)
	var assigned := {}
	_dynamic_detachments_and_raids(state, cmds, prof, bb, assigned)
	_dynamic_campaign_and_tactics(state, cmds, prof, bb, assigned)
	return cmds

func _distribute_rewards_and_tribes(state, cmds: Array, prof: Dictionary, bb: Dictionary) -> void:
	var pool: float = state.tribes["reward_pool"]
	# 1. 侦知私通汉使时最高优先安抚或弹压
	for tid in ["rizhu", "lihu", "youxian", "zuoxian"]:
		var vis: Dictionary = Tribes.get_visible_loyalty_range(state, tid, "xiongnu")
		if vis.get("wavering_detected", false) and pool >= 400.0:
			cmds.append(Cmd.make("pacify_wavering_tribe", "xiongnu", {"tribe_id": tid}))
			pool -= 400.0
	# 2. 计算防嫉妒安全分赏向量
	var alloc: Dictionary = U.solve_jealousy_safe_rewards(state, pool, prof["rho_pol"], 0.48)
	cmds.append(Cmd.make("distribute_rewards", "xiongnu", {"allocations": alloc}))

func _dynamic_detachments_and_raids(state, cmds: Array, prof: Dictionary, bb: Dictionary, assigned: Dictionary) -> void:
	# 1. 动态驻防存在感节点（按 semantic_tags == "presence_priority_xn" 检索，不再硬编码4城）
	var presence_nodes: Array = U.get_nodes_by_tag(state, "presence_priority_xn")
	presence_nodes.sort_custom(func(a, b): return U.node_strategic_weight(state, a) > U.node_strategic_weight(state, b))
	for nid in presence_nodes:
		var sid: String = state.nodes[nid]["faction"]
		var rel: Dictionary = state.relations.get(sid, {})
		if rel.get("overlord", "") != "xiongnu" or rel.get("xn_intimidation", 0) >= 68:
			continue
		var unit = U.pick_nearest_idle_army(state, "xiongnu", nid, assigned, 800, 3000)
		if unit != null:
			assigned[unit["id"]] = "presence"
			cmds.append(Cmd.make("set_plan", "xiongnu", {"army": unit["id"], "steps": [{"type": "hold", "node": nid, "until": "end"}], "role": "presence"}))
	# 2. 动态 Softmax 选择游骑设伏与拔亭燧路线（彻底废除硬编码 yang_guan-lou_lan）
	var raiders: Array = U.get_armies_by_role(state, "xiongnu", "raid")
	for r in raiders:
		if not U.is_idle(r):
			continue
		var cand_routes: Array = []
		for edge in U.get_edges_by_node_tag(state, "ambush_road"):
			var flow_est: float = Fog.estimate_han_supply_flow_on_edge(state, edge["id"], "xiongnu")
			var courier_bonus: float = 18.0 if U.node_has_tag(state, edge["to"], "courier_chokepoint") else 0.0
			var beacon_active: bool = Supply.has_beacon_cover(state, edge["id"])
			var u_edge: float = prof["w_raid"] * (flow_est * 0.8 + courier_bonus) - (15.0 if beacon_active else 0.0)
			cand_routes.append({"edge": edge, "utility": u_edge, "has_beacon": beacon_active})
		var chosen: Dictionary = U.softmax_select(state.rng, cand_routes, prof["ambush_softmax_temp"])
		if not chosen.is_empty():
			var e: Dictionary = chosen["edge"]
			var home_staging: String = U.nearest_node_with_tag(state, U.at_node(r), "staging_xn")
			var steps: Array = []
			if chosen["has_beacon"] and state.army_size(r) >= 1500:
				steps.append({"type": "raze_beacon", "node": e["from"]}) # 先拔除汉军烽燧致盲对手！
			steps.append({"type": "ambush", "node": e["from"], "route": e["id"], "months": 2})
			steps.append({"type": "return_to", "node": home_staging})
			cmds.append(Cmd.make("set_plan", "xiongnu", {"army": r["id"], "steps": steps, "preset": "raider", "role": "raid"}))

func _dynamic_campaign_and_tactics(state, cmds: Array, prof: Dictionary, bb: Dictionary, assigned: Dictionary) -> void:
	if bb["active_grand_path"] == "stabilize_tribes" or state.quarter() not in [2, 3]:
		return
	# 1. 根据路径 A / 路径 B 筛选候选主攻目标
	var target_pool: Array = U.get_nodes_by_tag(state, "hexi_commandery") if bb["active_grand_path"] == "path_a_hexi" else U.get_nodes_by_tags(state, ["merit_hub", "chokepoint_east", "chokepoint_north"])
	var scored_targets: Array = []
	var total_avail_units: Dictionary = U.merged_idle_units(state, "xiongnu", assigned)
	for nid in target_pool:
		if state.nodes[nid]["faction"] == "xiongnu" or state.tick < bb["target_cooldown_until"].get(nid, 0):
			continue
		var est_def: Dictionary = U.perceived_defenders_at(state, nid, "xiongnu", prof["rho"])
		var p_win: float = Combat.expected_p(state, total_avail_units, est_def, {"b_def": Combat.wall_mult(state, state.nodes[nid])})
		if p_win < prof["min_attack_probability"]:
			continue
		var v_strat: float = U.node_strategic_weight(state, nid) * 12.0 + Tribes.get_tribe_preference_bonus(state, nid)
		var u_t: float = prof["w_offense"] * v_strat * pow(p_win, 1.2) + (25.0 if nid == bb["committed_target_id"] else 0.0)
		scored_targets.append({"nid": nid, "utility": u_t, "p_win": p_win})
	var picked_target: Dictionary = U.softmax_select(state.rng, scored_targets, prof["staging_softmax_temp"])
	if picked_target.is_empty():
		return
	var target_nid: String = picked_target["nid"]
	# 2. 动态选择距目标最近且安全的集结点 (staging_xn)，彻底告别死板 yi_wu 集结！
	var rally_node: String = bb["staged_rally_node"]
	if rally_node == "" or state.nodes[rally_node]["faction"] != "xiongnu":
		var staging_cands: Array = []
		for sn in U.get_nodes_by_tag(state, "staging_xn"):
			if state.nodes[sn]["faction"] != "xiongnu":
				continue
			var days: float = Path.days_to(state, sn, target_nid, 1.5)
			var beacon_exposed: float = 12.0 if Supply.is_node_in_han_beacon_vision(state, sn) else 0.0
			staging_cands.append({"nid": sn, "utility": 60.0 - days * 0.8 - beacon_exposed})
		var picked_stage: Dictionary = U.softmax_select(state.rng, staging_cands, prof["staging_softmax_temp"])
		rally_node = picked_stage.get("nid", "youxian_wang")
		bb["staged_rally_node"] = rally_node
	# 3. Q2 集结兵力至 rally_node，Q3 激活对应季度战术卡并发起总攻
	if state.quarter() == 2:
		U.order_armies_to_rally(state, cmds, "xiongnu", rally_node, assigned)
	elif state.quarter() == 3:
		var card_id: String = _pick_best_tactic_card(state, target_nid, prof)
		if card_id != "":
			cmds.append(Cmd.make("play_tactic_card", "xiongnu", {"card_id": card_id, "target": target_nid}))
		U.launch_rallied_attack(state, cmds, "xiongnu", rally_node, target_nid, prof["siege_months"])
		bb["committed_target_id"] = target_nid
		bb["commitment_ttl"] = 2

func _pick_best_tactic_card(state, target_nid: String, prof: Dictionary) -> String:
	if not U.can_use_tactic_card_on_difficulty(state):
		return ""
	if U.node_has_tag(state, target_nid, "hexi_commandery"):
		return "scorched_autumn_raid" # 【焦土秋掠】：破农田与劫掠金翻倍
	elif Supply.is_high_flow_supply_node(state, target_nid):
		return "night_raid_strike"    # 【夜袭急击】：袭粮道与突袭加成
	return "feigned_retreat_lure"     # 【诈败诱敌】：野战诱击汉军主力
```

---

### 4.6 规则 `S08-R06`：18 城邦与 5 大国自主 AI 评分规则（City-States & Great Powers Autonomous AI）

西域 18 城邦与 5 大国并非静止的棋盘格子，而是在每季末（Tick `9, 18, ...`）由 `CityStateAI` 独立运行效用评估，制造“小国骑墙、大国待价而沽”的鲜活生态（对齐 S04 §4）：

#### 1. 18 城邦季度末自主行为效用矩阵
对每个未被直接军事吞并（`vassal_tier != "puppet"`）的城邦 $s$，读取其综合倾向 $\text{Tilt}_s \in [-100, +100]$、汉影响力 $I_s$、匈奴威吓 $X_s$、对汉怨恨 $R_{s,\text{han}}$、对匈怨恨 $R_{s,\text{xn}}$：

| 自主行为 ID | 触发前置条件 | 效用公式 $U_{\text{cs}}(s)$ | 触发阈值与结算效果 |
|---|---|---|---|
| **CS-1. 主动请为两属** (`request_dual_status`) | `overlord == "xiongnu"` 且 $I_s \ge 25$ 且 $R_{s,\text{xn}} \ge 30$ | $1.2 \cdot I_s + 1.5 \cdot R_{s,\text{xn}} - 0.8 \cdot X_s + \text{Awe}_{\text{han\_near}}$ | 当 $U_{\text{cs}} \ge 45.0$ 时触发：置 `is_dual = true`，对匈奴赋税减半，对汉开放粮市并解除禁商。 |
| **CS-2. 畏匈禁绝汉商** (`enact_trade_ban`) | `trade_banned == false` 且 $X_s \ge 60$ 且 $\text{Tilt}_s \le -20$ | $1.4 \cdot X_s - 1.2 \cdot I_s - \text{Awe}_{\text{han\_near}}$ | 当 $U_{\text{cs}} \ge 55.0$ 时触发：提前 1 季进入 `wavering_action = "ban_trade"` 预警，次季末若汉未救援则置 `trade_banned = true`。 |
| **CS-3. 苦匈横敛思叛** (`rebel_against_xn`) | `overlord == "xiongnu"` 且 $R_{s,\text{xn}} \ge 60$ 且同格无匈奴驻军 | $1.6 \cdot R_{s,\text{xn}} + 0.8 \cdot I_s - 1.0 \cdot X_s$ | 当 $U_{\text{cs}} \ge 62.0$ 时触发：驱逐匈奴征税小吏，本季拒绝缴纳僮仆岁币，并向汉使发出求援信。 |
| **CS-4. 怨汉闭籴密告** (`betray_han_supply`) | $R_{s,\text{han}} \ge 55$（因汉军强征/掠食或屯田挤压）且同格无汉重兵压制 | $1.5 \cdot R_{s,\text{han}} + 0.6 \cdot X_s - \text{Awe}_{\text{han\_at\_node}}$ | 当 $U_{\text{cs}} \ge 60.0$ 时触发：供粮姿态强制锁死为 `CLOSED`，并将途经该城的汉军精确兵力与余粮直接同步给匈奴感知层（持续 1 季）！ |

#### 2. 5 大国（乌孙 / 大宛 / 康居 / 大月氏 / 罽宾）自主响应规则
- **乌孙（`wusun`，王庭 `chi_gu`）**：
  - 当与汉缔结和亲（`married_han == true`）且 $I_{\text{wusun}} \ge 65$ 时，每逢汉军主力进攻 `cheshi_qian`、`yi_wu` 或 `youxian_wang` 且汉方下达 `request_allied_attack`，乌孙 AI 计算出兵效用 $U_{\text{wusun}} = 1.2 \cdot I_{\text{wusun}} - 0.8 \cdot X_{\text{wusun}} + 25.0 \cdot \mathbb{I}(\text{han\_army\_size} \ge 6000)$：若 $U_{\text{wusun}} \ge 50.0$，乌孙自 `yi_lie`（伊列）派出 `5,000` 精骑协同夹击匈奴西翼！
- **大宛（`dawan`，王城 `da_wan`）**：
  - 恃远傲慢偏置 `pride_bias = +25.0`。当汉使首次求取汗血马且 `yi_cheng` / `shu_le` 无汉军重兵（$\text{Awe}_{\text{han}} < 30$）时，大宛 AI 以 `80%` 权重触发拒马辱使（引发 `evt_dawan_horses_refused`）；唯有汉军兵临 `yu_cheng`（郁成）城下或已攻破郁成时，大宛贵族派系才会在「献良马三千降汉」与「死守贵山城」间切换为投降。
- **康居（`kangju`）**：
  - 当汉军深入葱岭以西围攻大宛且匈奴单于威望 $P \ge 50$ 时，康居 AI 评估是否派 `3,000` 游骑陈兵大宛北境声援：若汉军兵力 $< 10,000$ 且缺粮，康居出兵袭扰汉军粮尾；若汉军兵威 $\ge 15,000$，康居知难而退按兵不动。

---

### 4.7 规则 `S08-R07`：3×3 历史统帅性格矩阵（3×3 Commander Personality Matrix）

每位在位持节汉使与匈奴单于均绑定以下 6 套性格模板之一（存于 `data/ai_profiles.json -> personalities`），通过乘性权重全面塑形 AI 的战略风格：

#### 1. 汉使三性格 × 单于三性格效用权重总表

| 参数键名 (`data/ai_profiles.json`) | 汉·【拓边锐进】 `han_pioneer_hawk` | 汉·【持重营田】 `han_prudent_farmer` | 汉·【奇谋刺袅】 `han_audacious_schemer` | 匈·【雄猜严罚】 `xn_iron_tyrant` | 匈·【怀柔守成】 `xn_conciliatory_elder` | 匈·【贪利秋掠】 `xn_greedy_raider` |
|---|---|---|---|---|---|---|
| **代表历史人物** | 李广利、常惠、霍去病系 | 郑吉、赵充国系、张骞(晚) | 傅介子、赵破奴、冯奉世 | 伊稚斜、握衍朐鞮 | 乌维、虚闾权渠 | 乌师庐(儿单于)、呼衍骨 |
| **迷雾风险厌恶系数 $\rho$** | `-0.20` (激进低估敌军) | `+0.30` (审慎高估敌军) | `-0.10` (重机会窗口) | `+0.15` (多疑防叛) | `+0.25` (稳健保守) | `-0.20` (贪功冒进) |
| **最低进攻胜率门槛** | `0.55` | `0.68` | `0.58` | `0.56` | `0.65` | `0.52` |
| **远征/主攻权重 `w_offense`** | **`1.45`** | `0.85` | `1.15` | `1.25` | `0.85` | `1.35` |
| **屯田/补给建设 `w_logistics`** | `0.85` | **`1.50`** | `0.95` | — | — | — |
| **外交拉拢/册封 `w_diplomacy`** | `0.90` | **`1.30`** | `1.10` | `0.80` | **`1.35`** | `0.90` |
| **矫诏突袭/碰瓷 `w_schemer`** | `1.10` | `0.50` (极少矫诏) | **`1.55`** | — | — | — |
| **严令弹压/废立 `w_coercion`** | — | — | — | **`1.60`** | `0.60` | `1.00` |
| **分赏慷慨度 `w_generosity`** | — | — | — | `0.80` (克扣赏赐) | **`1.35`** (厚赏诸王) | `0.95` |
| **游骑劫粮/拔燧 `w_raid`** | — | — | — | `1.10` | `0.95` | **`1.55`** |
| **路径偏好 `path_b_bias`** | — | — | — | `0.90` (偏路径A破城) | **`1.30`** (偏路径B守成) | `1.05` (看哪里钱多) |

#### 2. 3×3 跨阵营性格博弈生态矩阵（非对称克制循环）

| 汉使性格 \ 单于性格 | 匈奴【雄猜严罚】(`xn_iron_tyrant`) | 匈奴【怀柔守成】(`xn_conciliatory_elder`) | 匈奴【贪利秋掠】(`xn_greedy_raider`) |
|---|---|---|---|
| **汉【拓边锐进】** (`han_pioneer_hawk`) | **硬碰硬惨烈决战**：双方在车师/居延高频正面碰撞，看汉粮道能否撑住高战损。 | **汉方略优**：锐进汉军趁乌维单于保守避战，快速抢占乌垒与车师咽喉。 | **匈奴略优**：贪利单于高频袭断锐进汉军漫长脆弱的补给线，令汉军前线断粮。 |
| **汉【持重营田】** (`han_prudent_farmer`) | **匈奴略优**：雄猜单于强压四部全力猛扑河西/轮台，持重汉使若推进过慢易被威服压制。 | **持久拉锯局**：双方稳扎稳打比拼内功，高频进入后期都护府维持 vs 威服竞速。 | **汉方大优（克制）**：持重汉使烽燧全满、城防坚固、粮仓充盈，贪利单于无处下嘴反因空手而归掉威望。 |
| **汉【奇谋刺袅】** (`han_audacious_schemer`) | **汉方大优（克制）**：雄猜单于严罚克扣导致日逐王/犁汙王高频动摇，奇谋汉使精准迎降+矫诏斩首破局！ | **匈奴略优（克制）**：怀柔单于把四部喂得忠心耿耿、北道驻防严密，奇谋汉使无机可乘且易因矫诏自损信任。 | **高波动对攻局**：双方互打对方的后方软肋（汉偷袭车师/税队，匈偷袭阳关粮道）。 |

---

### 4.8 规则 `S08-R08`：三档难度对 AI 行为的修正表（Difficulty Modifiers — Zero Cheating）

严格遵循 [`00_bible.md`](00_bible.md) L8 与 [`STATUS.md`](STATUS.md) `[R-05]`：**无论哪一档难度，AI 的初始金钱、季度拨款、粮食产量、征兵成本、行军速度、战斗攻击力乘数恒为 `1.00x`，绝无一分一毫数值作弊！** 三档难度仅通过解封 AI 的战术协同模块与调节决策锐度拉开挑战梯度：

| 修正维度 / JSON 键名 | 【轻车】（简单 `qingche`） | 【持节】（标准 `chijie`） | 【虽远必诛】（困难 `suiyuan`） |
|---|---|---|---|
| **AI 资源/产粮/战力作弊乘数** | **`1.00x`（零作弊）** | **`1.00x`（零作弊）** | **`1.00x`（零作弊）** |
| **AI 迷雾感知误差乘数** | `1.00x`（AI 恒读标准迷雾） | `1.00x`（与玩家完全对等） | `1.00x`（AI 不开全图透视，仅玩家迷雾误差 `1.25x`） |
| **战略目标 Softmax 温度 $\tau_{\text{main}}$** | `4.5`（偶有次优松散选择） | `1.8`（理性聚焦高价值目标） | `0.7`（极其冷静敏锐，刀刀直指边际功业最高点） |
| **集结/设伏 Softmax 温度 $\tau_{\text{tactic}}$** | `5.0` | `3.5` | `2.5`（兼顾最优性与防背板随机度） |
| **前瞻预演深度（Lookahead）** | 仅校验本季当步粮草 | 校验往返全程 18 旬粮食曲线 + 1 季威胁 | 校验往返粮食曲线 + 预判敌方下季支援可达范围 |
| **匈奴季度战术卡使用率** | 禁用战术卡（`0%`） | 当满足条件时 `60%` 概率出牌 | 满足条件时 `100%` 精准打出克制战术卡 |
| **匈奴出击前先遣拔亭燧（`raze_beacon`）** | 关闭（不主动拔燧） | 仅当主攻路线必经时触发 | 主动派轻骑优先拔除汉军关键视野亭燧致盲玩家 |
| **汉 AI 募使碰瓷与北道猎杀税队** | 关闭（仅派常规使团） | 正常启用（冷却 18 旬） | 积极启用（冷却 9 旬，且精准卡在匈奴主力南下时矫诏突袭） |
| **多路协同夹击（如汉+乌孙 / 匈奴双翼）** | 单路逐次进军 | 允许 2 路同季协同 | 精准计算行军天数实现同旬抵达合围（Time-on-Target） |


---

## 5. 命令（AI Command Vocabulary Mapping）

严格遵循 [`00_bible.md`](00_bible.md) L9：**S08 不定义任何“AI 专属特权命令”**。汉 AI、匈奴 AI 所生成的每一条指令均通过 `core/commands.gd::Cmd.make(cmd_id, faction, params)` 构造，并经过与玩家完全相同的 `Cmd.validate(state, cmd)` 校验与扣除资源流程。

| 命令 ID (`cmd_id`) | 权威定义 Spec | 调用方 AI | 核心参数 (`params`) | S08 触发子模块与决策条件 | 失败回退处理（Fallback） |
|---|---|---|---|---|---|
| `respond_edict` | S02 | `HanAI` | `{edict_id, action, reason_tag}` | `_court_and_edicts`：比较奉诏/讨价/推辞三项效用分，必选最高项 | 若讨价不满足前置条件，自动回退为 `accept` |
| `submit_memorial` | S02 | `HanAI` | `{type: "request_funds"\|"request_troops"\|"self_impeach"}` | `_court_and_edicts`：国库 `< 900` 或攻坚缺兵且 `trust >= 50` | 无在途槽位时跳过本季 |
| `forge_edict` | S02 | `HanAI` | `{target, self_impeach: true}` | `_expedition_and_special_ops`：无诏无罪状但发现高功业空虚窗口且 `trust >= trust_forge_min` | 若信任不足或处于轮台诏限制期，改派募使碰瓷 |
| `relocate_character` | S02 | `HanAI` | `{character_id, to_node}` | `_court_and_edicts`：阶段 I 驻 `dun_huang`，阶段 II 前推 `wu_lei` | 若目标城被围，维持原驻地 |
| `assign_commander` | S02/S05 | `HanAI` / `XiongnuAI` | `{army, character_id}` | 远征主力或迎降部王部队出击前，自动挂载同格空闲最高统率将领 | 无空闲具名将领时以无将默认统率(`2`)出征 |
| `distribute_rewards` | S03 | `XiongnuAI` | `{allocations: {zuoxian, youxian, rizhu, lihu}}` | `_distribute_rewards_and_tribes`：每季初执行防攀比嫉妒凸优化分赏 | 赏赐池为 `0` 时按全 `0` 提交 |
| `pacify_wavering_tribe` | S03 | `XiongnuAI` | `{tribe_id}` | 侦知 `wavering_detected == true` 且赏赐池 $\ge 400$ 时最高优先执行 | 钱不足时改调邻近右贤王/单于庭骑兵镇压 |
| `relieve_white_disaster` | S03 | `XiongnuAI` | `{tier}` | Q1 季初若上季发生白灾且赏赐池 $\ge 250$ 时最高优先赈灾 | 钱不足时触发 S03 降级档赈济 |
| `select_assembly_option` | S03 | `XiongnuAI` | `{season, option_id, target_node}` | `_handle_seasonal_assembly`：Q1/Q2/Q3 三次年会选项与蹛林靶标投票 | 默认回退至不耗钱的【平议牧界】 |
| `play_tactic_card` | S03 | `XiongnuAI` | `{card_id, target}` | `_dynamic_campaign_and_tactics`：Q3 总攻或游骑截粮前按目标标签选牌 | 冷却中或难度为「轻车」时不调用 |
| `dispatch_envoy` | S04 | `HanAI` | `{target, kind: "grand"\|"recruited", character_id, budget}` | `_diplomacy_utility`：按边际功业派遣精使团、募使团或碰瓷募使 | 无空闲具名正使时自动降级为 `recruited` |
| `grant_enfeoffment` | S04 | `HanAI` | `{state}` | `_diplomacy_utility`：当 $I \ge 30$ 且满足册封条件时立即执行抬升锚点 | 预算不足 `200` 时推迟至下季 |
| `make_vassal` | S04 | `HanAI` | `{state}` | `_diplomacy_utility`：当 $I \ge 60$ 且领先威吓时立即纳为属国 | — |
| `levy_vassal_troops` | S02/S04 | `HanAI` | `{target, max_troops}` | `_validate_food_and_dispatch`：持节者 2 跳内远征时征发属国协从兵 | 周围无属国时跳过 |
| `set_tax` | S03/S04 | `XiongnuAI` | `{state, level: 0..3}` | `_diplomacy_and_tongpu_taxes`：控制在季末怨恨不破 `max_resentment` 的最高档 | 僮仆都尉失位时跳过 |
| `enforce_trade_ban` | S03/S04 | `XiongnuAI` | `{state}` | 对咽喉城邦（`lou_lan` 等）在 $X \ge 55$ 时耗 `100` 钱强制锁死南道商税 | 钱不足时改派驻军提升威吓 |
| `install_prince` | S03/S04 | `XiongnuAI` | `{state}` | 当核心咽喉国倒向汉方且单于赏赐池 $\ge 600$ 时废立亲匈王子 | 冷却期内改用军事围攻 |
| `manage_supply_line` | S05 | `HanAI` | `{slot, from, to, priority, target_months}` | `_manage_auto_logistics`：维护 1–2 条自动补给线，秋收降级、战前加压 | — |
| `build_tuntian` | S05 | `HanAI` | `{node, level}` | `_economy`：在已控 `tuntian_prime` / `tuntian_eligible` 节点优先兴建/扩建屯田 | 受轮台诏限制时改在河西 `expand_farm` |
| `build_beacon` / `raze_beacon` | S05 | `HanAI` / `XiongnuAI` | `{node}` | 汉在 `beacon_priority` 节点修筑亭燧；匈奴游骑在设伏/南下前拔除亭燧 | — |
| `recruit` / `load` / `split` / `merge` / `set_plan` | S05 | 双方 AI | 沿用现有结构，新增 `source="convict"` 与 `role` | 防务征兵（含七科谪）、远征装载、游骑拆分与多步作战计划 | `simulate_food_curve == "red"` 时硬性拦截 `set_plan` |

---

## 6. 与其他系统的接口（System Interfaces）

### 6.1 S08 导出的接口（供其他系统调用）

| 导出函数 / 方法签名 | 调用方 Spec | 用途说明 |
|---|---|---|
| `HanAI.think(state: GameState) -> Array[Dictionary]` | `core/turn_manager.gd` / S09 | 汉方 AI 每季/每月下令入口，返回合法命令数组并更新 `state.ai_blackboard["han"]`。 |
| `XiongnuAI.think(state: GameState) -> Array[Dictionary]` | `core/turn_manager.gd` / S09 | 匈奴 AI 每季/每月下令入口，返回合法命令数组并更新 `state.ai_blackboard["xiongnu"]`。 |
| `CityStateAI.evaluate_quarter_end(state: GameState) -> Array[Dictionary]` | S04 (`Diplomacy`) | 每季末结算 18 城邦与 5 大国的自主行为（请为两属、禁商预警、倒戈闭籴、乌孙/康居协攻）。 |
| `AIUtils.evaluate_event_choice(state: GameState, faction: String, event_id: String, options: Array) -> String` | S06 (`EventEngine`) | 当 AI 阵营触发历史事件（如单于继承三选一、破城三选一、和亲请求）时，按性格权重返回最优 `option_id`。 |
| `AIUtils.get_nodes_by_tag(state: GameState, tag: String) -> Array[String]` | S01–S09 全局可用 | 根据 §3.2 语义标签字典返回匹配的节点 ID 数组，供全项目彻底消除硬编码节点名。 |
| `AIUtils.get_commander_personality_summary(state: GameState, faction: String) -> Dictionary` | S07 (`UI`) / S06 | 返回当前敌方在位统帅的性格 ID、本地化名称 key、3 条显著行为特征标签及本季主要战略意图摘要（供顶栏 Tooltip 与季末纪事使用）。 |

### 6.2 S08 导入的外部接口（已与 S01–S06 对齐）

| 来源 Spec | 导入接口 / 状态字段 | S08 使用方式与合规性保证 |
|---|---|---|
| **S01 胜利与剧本** | `Victory.calc_duhu_merit(state)`、`Victory.get_marginal_merit_map(state, faction)`、`Victory.evaluate_expiry_preview(state)` | 驱动汉 AI 三阶段状态机、目标边际功业评分及终局前 8 季落后冲刺修正（`desperation_mode`）。 |
| **S02 汉廷与诏令** | `Court.get_pending_edicts(state)`、`Court.preview_bargain_prob(...)`、`Court.is_target_authorized(...)`、`state.court.trust` | 驱动汉 AI 奉诏/讨价/推辞评分、主动上疏请款请兵及机会主义矫诏（`forge_edict`）决策。 |
| **S03 匈奴联盟** | `Tribes.get_visible_loyalty_range(state, tid, ai_faction)`、`Tribes.is_offering_surrender_to_han(...)`、`state.tribes.reward_pool` | **满足 `[S03→S08]` 接口需求**：双方 AI 严格只读模糊忠诚度区间，汉 AI 响应迎降动摇部王与截击僮仆税队。 |
| **S04 城邦与外交** | `Diplomacy.has_valid_crime(state, sid)`、`Diplomacy.get_supply_stance(...)`、`Diplomacy.estimate_envoy_survival(...)` | 驱动汉 AI 阶梯式使团派遣、募使碰瓷博罪状及出塞沿途供粮预判。 |
| **S05 后勤与迷雾** | `Fog.get_perceived_state(state, ai_faction)`、`Preview.compute_enemy_reach(...)`、`Preview.simulate_food_curve(...)` | **满足 `[S05→S08]` 接口需求**：彻底替换 `_logistics` 为 `SupplyLine`，威胁评估严格只读迷雾估计值，远征前拦截红灯断粮计划。 |
| **S06 事件与人物** | `Characters.pick_idle_envoy(state, faction)`、`Characters.pick_commander_at(state, node_id)` | 为精使团、远征军及迎降部队绑定在场具名人物。 |

---

## 7. AI 使用要点（与 S09 Python 纸面模拟器的同源映射协议）

为确保 [`S09_simulation_validation.md`](S09_simulation_validation.md) 在 W2 阶段验证新规则时与 Godot 端 S08 AI 保持数学同构，`design_sim/` 中的 5 种机器人策略直接映射为 `data/ai_profiles.json` 中的参数向量切片：

1. **策略同源映射表**：
   - `baseline`（标准均衡机器人）$\leftrightarrow$ 汉 `han_prudent_farmer` vs 匈 `xn_conciliatory_elder`（或按历史在位人物动态切换默认性格，标准难度 `chijie`）；
   - `aggressive`（激进猛攻机器人）$\leftrightarrow$ 汉 `han_pioneer_hawk`（$\rho = -0.20, w_{\text{offense}} = 1.45$）vs 匈 `xn_iron_tyrant`（路径 A 偏置，高频秋掠）；
   - `conservative`（保守筑垒机器人）$\leftrightarrow$ 汉 `han_prudent_farmer`（$\rho = +0.30, w_{\text{logistics}} = 1.50$）vs 匈 `xn_conciliatory_elder`（路径 B 偏置，优先保四部忠诚 $\ge 65$）；
   - `greedy`（功利奇谋机器人）$\leftrightarrow$ 汉 `han_audacious_schemer`（高频募使碰瓷 + 矫诏抢枢纽 + 截击税队）vs 匈 `xn_greedy_raider`（专袭粮道与弱防城邦）；
   - `lookahead_search`（前瞻搜索机器人）$\leftrightarrow$ 挂载「虽远必诛 (`suiyuan`)」难度修正参数（$\tau_{\text{main}} = 0.7$，启用 2 季前瞻与 100% 战术卡克制）。
2. **消除匈奴 `aggressive` 95% 胜率支配策略的数学闭环验证**：
   - 在 W2 新规则下，当匈奴 `aggressive` 企图复现旧版“无脑全军压河西”时：
     ① 河西四郡城防配合烽燧预警与自动补给线，使强攻胜率跌破 `0.45`；
     ② 强攻受挫每次扣除单于威望 `-6 ~ -10`，且因军费挤占分赏池导致 `rizhu`（日逐王）与 `lihu`（犁汙王）在 3–4 季内跌入 `wavering`（私通汉使）；
     ③ 汉 `han_audacious_schemer` / `baseline` 趁虚而入迎降日逐王（汉直接获 `+25` 功业并罢免僮仆都尉），令无脑猛攻河西的匈奴策略触发 `XN_SCATTER`（诸部离散）或丢失整个西域北道，从而将全矩阵单一策略最高胜率压回 `< 65%` 的健康非支配区间（满足圣经 L12）。

---

## 8. UI 需求与调试可视化（UI & Debug Visualization，供 S07 实现）

### 8.1 玩家可见：敌方统帅性格徽章与意图线索面板（文字线框）

玩家无需看懂底层效用公式，即可通过顶栏对手铭牌悬停框读懂 AI 统帅的为人与动向：

```text
+===================================================================================+
| 【敌酋性情与塞外风声】  在位单于：伊稚斜单于                      性格：【雄猜严罚】|
+-----------------------------------------------------------------------------------+
| ◆ 统帅风评：性多猜忌，赏罚酷烈；喜以重兵猛叩坚城，然帐下诸王常怀危惧。              |
| ◆ 行事倾向：                                                                      |
|   • [重锤叩关] 倾向集中右贤王主力南下河西或强攻咽喉重镇（攻城偏好 ▲▲）            |
|   • [刻薄寡恩] 常克扣西域属部岁赏，日逐、犁汙二王离心风险显著升高（可乘之机 ★）   |
|   • [疑兵可欺] 对烽燧盲区之大股汉军颇为忌惮（风险厌恶 +0.15）                      |
| --------------------------------------------------------------------------------- |
| ◆ 近季塞外风声（基于我方烽燧与属国耳目）：                                        |
|   • [40日前·阳关塞外] 望见胡骑游弋于白龙堆，似在窥探我阳关至楼兰粮道。            |
|   • [本季·焉耆传闻] 僮仆都尉敛赋严急，北道诸国怨声载道，日逐王帐下似有异动。      |
+===================================================================================+
```

### 8.2 开发者与平衡师专用：`F9` AI 效用黑板调试浮窗（`AIDebugOverlay`）

在开发模式或 CLI 试玩（`--debug-ai`）下，按 `F9` 可呼出实时效用拆解面板，彻底杜绝 AI“黑箱发呆”：

```text
+-----------------------------------------------------------------------------------+
| [DEV F9] AI UTILITY & BLACKBOARD INSPECTOR | Faction: [HAN] | Phase: II (Merit=64)|
| Personality: han_audacious_schemer (ρ=-0.10, τ=1.8) | Committed: cheshi_qian (1T) |
+-----------------------------------------------------------------------------------+
| TOP CANDIDATE ACTIONS (Quarter 14, Tick 117):                                     |
|  #1 [SELECTED] Expedition(cheshi_qian, forge=true) | U = +57.1                    |
|     ├─ V_strat: 72.0 (Merit +16 * 4.5) | P_win(perceived): 0.86 | w_p: 1.40       |
|     ├─ FoodCurve: GREEN (min_grain=+4,200 hu at tick +7) | RiskPen: -17.6 (Forge) |
|     └─ CommitBonus: +25.0 | CooldownPen: 0.0                                      |
|  #2 DispatchEnvoy(lou_lan, kind=recruited_bait)    | U = +31.4 [SELECTED #2]      |
|  #3 Expedition(da_wan, forge=false)                | U = -999.0 [REJECTED: RED]   |
|     └─ Reason: Preview.simulate_food_curve == RED (starves at gu_mo, deficit 18k) |
+-----------------------------------------------------------------------------------+
```

---

## 9. 玩家可见文本（Localization Strings）

所有玩家可见的 AI 性格名称、风评描述与季末战报归因文案均纳入本地化表（键名前缀 `ui.s08.` / `log.s08.`）：

| 本地化 Key | 中文源文本草稿 |
|---|---|
| `ui.s08.personality.han_pioneer_hawk.name` | 拓边锐进 |
| `ui.s08.personality.han_pioneer_hawk.desc` | 志在绝幕立功，敢于孤军远征重镇；然轻视转输，粮道易为敌骑所乘。 |
| `ui.s08.personality.han_prudent_farmer.name` | 持重营田 |
| `ui.s08.personality.han_prudent_farmer.desc` | 步步为营，崇尚修筑亭燧、广开屯田、以币帛怀柔诸国，非十全之胜不轻出塞。 |
| `ui.s08.personality.han_audacious_schemer.name` | 奇谋刺袅 |
| `ui.s08.personality.han_audacious_schemer.desc` | 善审时度势，喜遣奇兵袭取空虚咽喉、截击税使，必要时不惜持节矫诏以建奇功。 |
| `ui.s08.personality.xn_iron_tyrant.name` | 雄猜严罚 |
| `ui.s08.personality.xn_iron_tyrant.desc` | 威福自专，喜聚大军猛攻河西坚城；然待帐下诸王刻薄少恩，内部易生嫌隙。 |
| `ui.s08.personality.xn_conciliatory_elder.name` | 怀柔守成 |
| `ui.s08.personality.xn_conciliatory_elder.desc` | 厚赏诸部以固根本，稳守天山北道与僮仆都尉赋税，不轻与汉军主力决战。 |
| `ui.s08.personality.xn_greedy_raider.name` | 贪利秋掠 |
| `ui.s08.personality.xn_greedy_raider.desc` | 唯利是图，避实击虚；专喜秋高马肥之时分遣游骑劫掠粮道、拔除亭燧、搜刮属国。 |
| `log.s08.han_forged_surprise` | 汉使 {char_name} 见 {node} 守备空虚，恐请旨往返失期，遂持节矫制发兵五千疾袭 {node}！ |
| `log.s08.xn_shift_path_b` | 单于见河西亭障严密、城坚粮足，知不可力夺，遂引军西向，专意威服西域诸国以断汉路。 |
| `log.s08.xn_raze_beacon_blind` | 匈奴轻骑先期拔毁 {node} 烽燧，塞外尘烟断绝，汉军一时莫知胡骑主力所在！ |
| `log.s08.cs_betray_supply` | {state} 苦汉军征发之苛，闭城拒籴，更遣快骑阴通匈奴，尽泄汉军虚实！ |
| `log.s08.wusun_allied_strike` | 乌孙昆莫感汉和亲厚币之恩，遣精骑五千自伊列东出，与汉军合击匈奴右翼！ |

---

## 10. 边界情况与防死锁保护（Edge Cases & Anti-Deadlock Safeguards）

为保证 AI 在任何极端残局下均不崩溃、不卡死、不做出荒谬送死行为，强制内置以下 **12 条边界保护与熔断规则**：

1. **全图断粮红灯防死锁（All-Red Expedition Fallback）**：若汉 AI 对所有候选敌方节点调用 `Preview.simulate_food_curve` 均返回 `"red"`（无一可达），AI **严禁强行派兵送死**，自动将本季预算转投：① 提升 `SupplyLine` 优先级向 `dun_huang` / `lou_lan` 攒粮；② 在前沿节点执行 `build_tuntian`；③ 派遣不吃军粮的使团。
2. **连续攻城受挫冷却锁（Siege Ping-Pong Breaker）**：当 AI 对同一节点 `nid` 发起的围城或进攻连续 2 次未果撤退（`target_fail_counts[nid] >= 2`），立即写入 `target_cooldown_until[nid] = state.tick + 18`（强制冷却 2 季），期间对该目标效用扣 `-60.0`，迫使 AI 换向侧翼弱点。
3. **半途目标易主重规划（Mid-March Target Flip）**：当 AI 远征军在途（尚未抵达 `target_nid`）时，若目标城因外交翻盘或第三国介入已变为己方阵营/属国，在每旬 `PlanExecutor` 钩子中立即将 `siege` 步骤无缝替换为 `hold`（进驻休整）或 `return_to`，防止围攻自己人。
4. **持节汉使/单于在途暴毙或征还（Leader Death Mid-Turn）**：若汉持节者在季度中因病逝或槛车征还离任（由副使暂代），汉 AI 在副使转正或新使抵任前自动挂起需要持节特权的 `forge_edict` 与 `levy_vassal_troops`；若匈奴单于在 Q4 季末崩逝，立即先同步执行继承三选一更新 `personality_id`，再进入次年 Q1 决策。
5. **匈奴集结点失守动态迁移（Lost Staging Node Recovery）**：若 `blackboard.staged_rally_node`（如 `yi_wu`）在集结期间被汉军攻占，匈奴 AI 在当旬立即清空 `staged_rally_node` 并重选次近的己方 `staging_xn` 节点（如 `hu_jie` 或 `youxian_wang`），已出发部队自动重算路径。
6. **四部全员低忠破产保护（Zero-Pool Bankruptcy Guard）**：当匈奴 `reward_pool < 100` 且四部平均忠诚 $< 40$ 时，`solve_jealousy_safe_rewards` 严格保持四部分配比例相等（$r_1 = r_2 = r_3 = r_4$），使得即使因钱少掉忠诚，也**绝对不会额外触发 `-8` 的攀比嫉妒惩罚**。
7. **全盲迷雾下的保守先验兜底（Total Fog Blindness Prior）**：若己方边境烽燧全毁且无任何属国视野（`enemy_contacts` 为空），`perceived_defenders_at` 自动使用节点 `base_strategic_weight * 800` 作为先验守军下界，防止 AI 以为敌城“空无一人”而派 500 骑兵去撞长安或单于庭。
8. **河西本土一级危机强制召回（Homeland Emergency Recall）**：当汉方任一 `hexi_commandery` 节点被匈奴超过 `4,000` 兵力围攻且本地守军战力比 `< 0.7` 时，汉 AI 立即中断阶段 II 的西域外线远征预备，将敦煌/酒泉机动野战军回防河西。
9. **补给线吸干秋收熔断（Harvest Labor Starvation Breaker）**：每逢 Q3 秋收季（7–9 月），若河西四郡因 `SupplyLine` 征发民夫导致预计秋收减产超过 `25%` 且敦煌存粮已够驻军吃 5 个月，汉 AI 强制将 `SupplyLine` 优先级降为 `1`。
10. **存档与读档的随机数与黑板一致性（Deterministic Save/Load）**：`state.ai_blackboard` 与 `GameState.rng.state` 完整写入存档 JSON；同一存档读档后重新运行 `think(state)` 产生的命令序列与不读档连续运行 **100% 逐字节一致**。
11. **使团饱足度防刷钱死锁（Envoy Satiation Cap）**：当西域所有可达城邦的 `satiation >= 2` 时，汉 AI 停止派遣常规送礼使团，将结余资金自动转入河西扩田（`expand_farm`）或留作下季军市购粮备用金。
12. **单于亲征防送死阈值（Chanyu Personal Command Safety）**：除非处于终局绝地反击态（`desperation_mode == true`），否则当目标感知胜率 $< 0.65$ 时，匈奴 AI 严禁勾选 `chanyu_personal_command`（防止单于在低胜率攻坚战中阵亡触发继承崩盘）。

---

## 11. 调参旋钮与预期（Tuning Knobs & Expected Impact）

以下 8 个核心旋钮（均位于 `data/ai_profiles.json`）供 W2/W3 阶段在 Python 模拟器中进行拉丁超立方扫描调优：

| 旋钮 JSON 键名 | 默认值 | 可调范围 | 调高时的系统表现预期 | 调低时的系统表现预期 |
|---|---|---|---|---|
| `han_base.phase_merit_thresholds[0]` | `55` | `40..70` | 汉 AI 在阶段 I 停留更久，先拉拢更多南道小国再攻乌垒，前期更稳但主胜节奏变慢 | 汉 AI 过早跳过南道筑基直接强攻乌垒/车师，易因粮道不稳在天山受挫 |
| `han_base.trust_forge_min` | `52` | `40..70` | 汉 AI 极少矫诏，严格等长安诏令，减少 `HAN_RECALL` 风险但错失战机、到期率上升 | 汉 AI 高频矫诏奇袭，主胜率与 `HAN_RECALL` 政治崩盘率同步上升 |
| `xiongnu_base.path_switch_hysteresis` | `0.12` | `0.05..0.30` | 匈奴 AI 一旦选定路径 A 或 B 就极少换向，战略连贯性增强但容易被针对 | 匈奴 AI 在河西与西域之间频繁摇摆切换，机动诡谲但单一路线积累变慢 |
| `xiongnu_base.prestige_crisis_floor` | `28` | `20..40` | 匈奴 AI 稍有威望下滑即停止攻城转入保命安抚，极大降低 `XN_SCATTER` 离散率 | 匈奴 AI 威望濒危仍头铁强攻，增加戏剧性翻盘或加速诸部离散崩盘 |
| `global_utility.softmax_temperature_default` | `3.5` | `0.5..8.0` | AI 集结点与攻击目标高度随机发散，彻底无法背板，但偶有次优昏招 | AI 趋于确定性贪心最优解，算力压迫感极强，但重玩时路线趋同 |
| `global_utility.commitment_bonus` | `25.0` | `10.0..45.0` | AI 咬住一个目标不死不休，战役烈度高 | AI 极易根据每季微小情报变化中途改道 |
| `citystate_ai.dual_request_min_resent_xn` | `30` | `20..50` | 西域城邦很难主动请为两属，匈奴北道统治更稳固 | 匈奴稍一加税即引发大片城邦主动请为两属，汉方中期破局加快 |
| `global_utility.endgame_risk_tolerance_add` | `0.45` | `0.20..0.70` | 终局前 8 季落后方疯狂搏命（高频矫诏/单于亲征决战），大幅压低平庸到期率 | 落后方在最后 2 年依然按部就班，到期计分占比升高 |

---

## 12. 验收测试（Acceptance Tests — Given / When / Then）

以下 10 条断言可由 Python 纸面模拟器（`design_sim/`）或 Godot Headless 测试直接自动化校验：

1. **测试 S08-T01（零特权迷雾隔离断言）**：
   - **Given** 汉方在 `chang_an` 新招募一支 `10,000` 人大军，且 `chang_an`、`long_xi`、`wu_wei` 均不在匈奴任何传感器或属国视野内；
   - **When** 运行 `XiongnuAI.think(state)` 并检查 `AIUtils.perceived_enemy_threat_at(state, "wu_wei", "xiongnu", 90, 0.0)`；
   - **Then** 该新招汉军对匈奴 AI 的感知威胁贡献恒为 `0.0`，匈奴 AI 的决策输出与该汉军不存在时 **100% 相同**。
2. **测试 S08-T02（四部模糊忠诚读取断言）**：
   - **Given** 日逐王真实忠诚度 `loyalty = 39`、`status = "wavering"`，但 `wavering_detected == false` 且可见区间为 `[25, 55]`；
   - **When** 运行 `XiongnuAI.think(state)`；
   - **Then** 匈奴 AI 不得生成 `pacify_wavering_tribe` 命令，且其读取的忠诚度估计值严格由 `[25, 55]` 区间推导。
3. **测试 S08-T03（零硬编码节点名静态扫描断言）**：
   - **Given** 扫描重构后的 `ai/han_ai.gd`、`ai/xiongnu_ai.gd`、`ai/citystate_ai.gd`、`ai/ai_utils.gd` 源码；
   - **When** 正则检索硬编码常量数组 `const HEXI`、`const PRIORITY` 或写死的 `"yi_wu"` 集结赋值；
   - **Then** 匹配数为 `0`，所有节点筛选均通过 `AIUtils.get_nodes_by_tag` 完成。
4. **测试 S08-T04（远征断粮红灯硬拦截断言）**：
   - **Given** 汉 AI 在 `dun_huang` 有一支 `8,000` 人野战军，但本地存粮与民夫不足，使得直攻 `da_wan` 的 `Preview.simulate_food_curve` 返回 `summary_light == "red"`；
   - **When** 运行 `HanAI.think(state)`；
   - **Then** 返回的命令列表中**绝不包含**以 `da_wan` 为终点的 `set_plan` 命令（自动改打近处跳板或留驻攒粮）。
5. **测试 S08-T05（匈奴防嫉妒分赏极差断言）**：
   - **Given** 匈奴单于赏赐池有 `600` 钱，四部期望分赏合计 `1,000` 钱；
   - **When** 运行 `XiongnuAI._distribute_rewards_and_tribes`；
   - **Then** 生成的 `distribute_rewards` 命令中，四部满足比极差 $\max_i r_i - \min_j r_j \le 0.50$，季末结算不触发攀比嫉妒扣忠。
6. **测试 S08-T06（匈奴集结点与伏击道非背板多样性断言）**：
   - **Given** 使用 50 个不同随机种子运行第 2–3 季的 `XiongnuAI.think(state)`；
   - **When** 统计匈奴主军选择的集结点 `staged_rally_node` 与游骑选择的 `ambush` 路段；
   - **Then** 集结点分布在至少 3 个不同 `staging_xn` 节点（单一节点占比 $\le 65\%$），伏击路段分布在至少 3 条不同边。
7. **测试 S08-T07（汉 AI 机会主义矫诏突袭断言）**：
   - **Given** 汉 AI 性格为 `han_audacious_schemer`，朝廷信任 `trust = 64`，`dun_huang` 有闲置精锐 `5,000` 人，而高边际功业节点 `cheshi_qian` 感知敌军为 `0` 且汉无讨伐诏书与罪状；
   - **When** 运行 `HanAI.think(state)`；
   - **Then** 命令列表中包含 `forge_edict(target="cheshi_qian", self_impeach=true)` 及配套进军计划。
8. **测试 S08-T08（ハン AI 9 旬迎降动摇部王断言）**：
   - **Given** 日逐王触发向汉请降事件（`is_offering_surrender_to_han == true`），且汉在 `wu_lei` 或 `dun_huang` 有 $\ge 3,000$ 闲置部队；
   - **When** 运行 `HanAI.think(state)`；
   - **Then** 汉 AI 将迎降任务评为最高效用，生成绑定具名将使并前往迎降节点的行军指令。
9. **测试 S08-T09（三档难度零资源作弊断言）**：
   - **Given** 分别在 `qingche`、`chijie`、`suiyuan` 三档难度下初始化相同种子的剧本②；
   - **When** 检查 AI 方的初始金钱、每季拨款、农田产粮、征兵单价与单位基础战力；
   - **Then** 三档难度下上述数值 **100% 恒等**，仅 `difficulty_modifiers` 中的行为参数不同。
10. **测试 S08-T10（L12 200 局蒙特卡洛全局平衡与无支配策略断言）**：
    - **Given** 在 S09 模拟器中加载 S01–S08 全套规则，运行 200 局标准难度 AI 对 AI 及 5×5 策略矩阵；
    - **When** 汇总胜率与支配策略指标；
    - **Then** 汉主胜率落在 `[20%, 35%]`、匈奴主胜率落在 `[20%, 35%]`、到期计分率 `<= 50%`、终局签名 `>= 15` 种且单一签名 `<= 20%`，且 5×5 矩阵中无任何策略平均胜率 `> 70%`（`has_dominant_strategy == false`）。

---

## 13. 未决问题（Open Questions）

本 spec 涉及的所有跨系统边界均已对齐 [`STATUS.md`](STATUS.md) 已裁决项 `[R-01]` 至 `[R-05]`（含季制历法对齐、人物 `0–100` 统率与 `command_tier` 映射、四部通用 ID、9 旬迎降将领修正、三档难度零作弊原则），**当前无未决冲突项**。
