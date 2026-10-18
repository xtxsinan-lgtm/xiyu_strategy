# design_v1 进度与协作看板

> 规则：每个 agent 只改自己那一行的进度，并在下面各节**追加**条目（不要删除别人的条目）。条目格式：`- [Sxx→Syy] 内容（日期）`。

## 进度

| Spec | 负责 agent | 状态 | 已完成章节 | 备注 |
|---|---|---|---|---|
| 00 圣经 | 主 agent | ✅ v1 | 全部 | |
| 01 交叉审查与全局注册表 | W3 066bb2d5 | ✅ v1 完成 | 1–6（全部） | `01_cross_review_and_registry.md` 已落盘（统一 30 处跨文档接口与命名差异） |
| S01 胜利与剧本 | W1 fb9f4e20 | ✅ v1 完成 | 1–13（全部） | `S01_victory_scenarios.md` 已落盘 |
| S02 汉廷与诏令 | W1 9718896d | ✅ v1 完成 | 1–13（全部） | `S02_han_court.md` 已落盘 |
| S03 匈奴联盟 | W1 2d3910cd | ✅ v1 完成 | 1–13（全部） | `S03_xiongnu_confederation.md` 已落盘 |
| S04 城邦与外交 | W1 86d3a35f | ✅ v1 完成 | 1–13（全部） | `S04_citystates_diplomacy.md` 已落盘 |
| S05 后勤军事迷雾 | W1 e58c10ad | ✅ v1 完成 | 0–13（全部） | `S05_logistics_military_fog.md` 已落盘 |
| S06 事件人物叙事 | W2 5ce85203 | ✅ v1 完成 | 1–13（全部） | `S06_events_characters_narrative.md` 已落盘（25人花名册+40事件+纪事/附传） |
| S07 UX 与教学 | W2 316f3506 | ✅ v1 完成 | 1–13（全部） | `S07_ux_onboarding.md` 已落盘 |
| S08 AI | W2 378c00d2 | ✅ v1 完成 | 1–13（全部） | `S08_ai.md` 已落盘（42节点语义标签、零特权迷雾效用AI、3×3性格、难度修正） |
| S09 模拟验证 | W1/W2 主 agent | ✅ v1 完成 | 1–13（全部） | `design_sim/` 与 `S09_simulation_validation.md` 已落盘（W1 基线 + W2 新规则 200 局 L12 全达标 + 5×5 非支配矩阵 + 12 季试玩报告） |
| S10 实施计划 | W4 主 agent | ✅ v1 完成 | 1–6 + T01–T24（全部） | `S10_implementation_plan.md` 与 `tickets/P0A,P0B,P1,P2` 共 24 张原子工单全部落盘 |

## 接口需求（A 需要 B 提供）

- [S02→S01] 需 S01 在失败条件中接入 `han_recall_imprisoned`（朝廷信任归零且《槛车召还令》送达持节者、未戴罪立功时汉方立即战败），并在史官 5 档评定与结局附传中读取 `state.court.precedent`（矫诏先例值）与持节者侯爵等级（列侯/关内侯/有功不侯）（2026-10-17）
- [S02→S04] 需 S04 提供 `Diplomacy.has_valid_crime(state, state_id) -> bool`（判断城邦是否持有杀使/劫使/叛盟等合法讨伐罪状，免除矫诏）及 `Diplomacy.levy_vassal_troops(state, holder_node, max_troops)`（供持节者“以节发 2 跳内诸国兵”调用）（2026-10-17）
- [S02→S05] 需 S05：① 在 `Pathfinding` 中支持 `courier_dijkstra`（河西置邮道 `relay_speed=4.0` 忽略 `mounted_speed_cap`，塞外单骑 `courier_speed=2.0`）；② 提供 `Supply.has_beacon_cover(state, route_idx) -> bool`（烽燧覆盖路段文书被截获率 `×0.35`）；③ 在 `recruit`、`submit_plan`、`build_tuntian` 中接入 `Court` 的季度中央军额度校验、出塞将领在场校验、未授权行动矫诏校验与轮台诏远距屯田限制钩子（2026-10-17）
- [S02→S06] 需 S06 在人物模型 `data/characters.json` 中提供 `eloquence`（辞令）、`caution`（谨慎）、`ambition_marquis`（封侯执念）、`role_tags` 字段，并收录张骞、赵破奴、李广利、傅介子、常惠、郑吉、冯奉世及监军（杜周/暴胜之）等持节继任与监军人物条目（2026-10-17）
- [S01→S02] 需 S02 导出 `state.court.trust`（0–100）、`recall_active`（在途召还令冻结立府维持期）、`recall_finalized` / `han_recall_imprisoned`（触发 `HAN_RECALL` 战败）、`unpardoned_forged_edict`（决定召还时判下狱还是族诛）及 `precedent` / `precedent_resistance`（决定汉主胜利是否触发“功大不封，仅赐爵关内侯”）（2026-10-17）
- [S01→S03] 需 S03 导出 `state.tribes.chanyu_prestige`（0–100）、四部列表 `loyalty` 与 `status`（`"normal"`/`"rebellious"`/`"defected_han"`，用于计算匈奴威服值 $W$ 及检定连续 2 季 `XN_SCATTER` 诸部离散失败）、`tongpu_active`（僮仆都尉是否在位运作）；当日逐王降汉时需置 `tongpu_active = false` 并调用 `Victory.on_rizhu_surrender(state)`（授汉 +15 永久勋与 +10 罢僮仆状态分），匈奴重夺焉耆/车师前执行复置僮仆都尉时置回 `true`（2026-10-17）
- [S01→S04] 需 S04 在 `relation` 中提供 `han_enfeoffed`（印绶册封，每国 +2 功业，上限 12）、`hostage_sent_han`（遣质子入侍，用于剧本①目标及首次质子战功 +2.0）、`crimes_against_han`（讨伐有罪之国战功 +4.0），且汉方傀儡政权统一设 `overlord == "han"`（2026-10-17）
- [S01→S05] 需 S05 导出西域节点的 `tuntian_level` / `tuntian_troops`（供 S01 汇总西域屯田存粮计算 $G_{\text{tuntian}}$，上限 15）、`state.han_horse_pool`（国家马匹池，供到期计分 `horses_per_1000 = 1.2` 使用）、`state.stats.han_total_deaths`（累计阵亡+饿死人数），并在野战大捷（歼敌 ≥2000）、全军覆没（≥3000）、阵斩名将时调用 `Victory.record_event_award(...)`（2026-10-17）
- [S01→S06] 需 S06 在剧本加载时读取 `scenarios/*.json` 的 `characters_init` 与 `scheduled_events`，执行 `S01-R12` 重大事件配额规则（T1–T5 保护期，T10–T32 保底 1–3 次重大事件，冷却间隔 ≥4 季），并在触发 8 类核心历史事件时向 `state.victory.key_events_occurred` 追加标签（2026-10-17）
- [S01→S09] 需 S09 纸面模拟器实现 `S01-R02`~`S01-R07` 全部公式，并校验 200 局指标：汉主胜 20–35%、匈奴双路径主胜 20–35%、到期 ≤50%、细粒度签名 `end_signature` ≥15 种且单一 ≤20%、粗粒度签名 `end_signature_coarse` ≥8 种、领先易手率 ≥40%、汉前 10 季均命令数 ≥3.0（2026-10-17）
- [S05→S02] 需 S02 提供 `Court.spend_military_market(state, cost, note)`（用于大军沿途平买/强征购粮、亭燧修筑与月维护费扣款）、`Court.add_treasury(state, money, note)`（用于七科谪赎罪入钱 `+150`/千人）、`Court.can_build_tuntian(state, node_id)`（校验轮台诏远距屯田限制），并在丝路商税结算中乘上 S05 导出的 `Convict.get_trade_tax_mult(state)`（当年发七科谪 `>5000` 人时商税 `×0.85`）（2026-10-17）
- [S05→S03] 需 S03 提供 `Tribes.add_reward_pool(state, money)`（匈奴军队执行 `raze_beacon` 拔除汉亭燧后向单于赏赐池注入 `+30` 钱），并在匈奴战术卡「拔亭障」中复用 `raze_beacon` 命令（2026-10-17）
- [S05→S04] 需 S04 提供 `Diplomacy.get_forage_willingness(state, state_id, army) -> float`（读取 S05 `Combat.calc_army_awe` 返回 `0..100` 供粮意愿 $W$）与 `Diplomacy.apply_forage_feedback(state, state_id, faction, delta_inf, delta_resent, crime_tag)`（接收献粮/平买/强征/掠食后的影响力、怨恨与「汉军掠食」罪状回写），并在城邦倾向公式中读取 `state.tuntian_pressure[state_id]`（2026-10-17）
- [S05→S06] 需 S06 提供 `Characters.get_commander_stats(state, char_id) -> {command: int, traits: Array, at_node: String}`（含 `0..10` 统率与 `trait_greedy`/`trait_ambusher`/`trait_stern`），并监听 S05 的 `tuntian_pressure >= 60` 触发「楼兰/龟兹袭杀屯田校尉（赖丹）」事件（2026-10-17）
- [S05→S08] 需 S08 在汉 AI 中以 `SupplyLine` 替代原 `_logistics` 单跳手工派车，在双方 AI 威胁评估中一律改调 `Fog.get_perceived_state` 与 `Preview.compute_enemy_reach`（严禁直接读 `state.armies`），并在汉 AI 远征出兵前调用 `Preview.simulate_food_curve` 拦截 `summary_light == "red"` 的必饿死计划（2026-10-17）
- [S04→S02] 需 S02 提供 `Court.modify_trust(state, delta, reason)`（用于使团被杀 `-2`/`-6`、受辱 `-1`、无名兴师 `-12`、破城善后及大国岁献 `+2`）、`Court.is_luntai_edict_active(state) -> bool`（轮台诏后屠城扣信任从 `-8` 加倍至 `-20`）；同时 S04 已确认 `Q-S02-04`：募使团（`kind == "recruited"`）免占 4–6 人具名人物槽（每年限 3 批），仅精使团强制绑定具名正使随行（2026-10-17）
- [S04→S03] 需 S03 维护 `state.tribes.tongpu_active: bool`（在位时匈奴属国威吓享 `X_floor = 30` 保底），在日逐王降汉或僮仆都尉被击溃时调用 `Diplomacy.on_tongpu_deposed(state)`（全西域 $X - 15$ 并解除保底），在匈奴截获汉使团时调用 `Tribes.add_loot_to_pool(state, money)`，并在征收僮仆赋税时对 `is_dual == true` 的两属城邦调用 `Diplomacy.add_tax_resentment` 按 `50%` 计收（2026-10-17）
- [S04→S05] 需 S05 在 `Siege` 攻陷城邦时调用 `Diplomacy.on_citystate_captured(state, sid, attacker, policy)`（执行立新王/迫降/屠城三选一），在每旬补给与行军预演时调用 `Diplomacy.get_supply_stance` / `get_forage_willingness` 与 `apply_forage_feedback`，在大宛献马/破大宛时调用 `Supply.add_horses(state, count)`，并接入 `Diplomacy.get_allied_vision_nodes` 作为属国/两属/在途使团视野源（2026-10-17）
- [S04→S06] 需 S06 在人物模型中提供 `eloquence`（0–100，默认 70）与 `凿空者`/`勇决` 特性，并承接 `evt_envoy_killed`（汉使死节）、`evt_wusun_marriage`（细君/解忧和亲）、`evt_dawan_horses_refused`（大宛匿马杀使）、`evt_loulan_assassination`（傅介子刺楼兰王）四条外交事件链（2026-10-17）
- [S03→S01] 已在 S03 中完整对齐 `S01→S03` 全部字段，需 S01 在季末 `Victory.check_end_conditions` 中读取 `state.tribes.scatter_consecutive_turns >= 2` 触发 `XN_SCATTER`（诸部离散）提前战败，并在日逐王降汉时接收 `Victory.on_rizhu_surrender(state)`（+15 永久勋 +10 罢僮仆状态分 = +25 功业）（2026-10-18）
- [S03→S04] 需 S04 在 `Diplomacy` 中接收 S03 四档岁币税率（0–3 档）对应的每季城邦怨恨增量（`-6 / +2 / +5 / +14`），支持 S03 新增外交动作 `intimidate_city`、`bribe_nobles`、`install_prince`、`marry_great_power`、`detain_han_envoy`，并在日逐王降汉或重度白灾瓦解时接收 `Diplomacy.on_tongpu_deposed(state)` / 全局威吓削减（2026-10-18）
- [S03→S05] 需 S05 在 `Combat`、`PlanExecutor` 与 `Supply` 中：① 战斗前调用 `Tribes.get_active_combat_modifiers(...)` 接入【诈败诱敌】【夜袭急击】及单于亲征 `+15%` 修正；② 执行 `burn` 时若激活【焦土秋掠】则农田破坏与劫掠金翻倍；③ 汉军入塞外草原/沙漠时若激活【远遁清野】则粮耗马损 `+35%`；④ 拦截击败 `command_owner == "tongpu"` 的税队护卫军时回调 `Tribes.on_tongpu_escort_defeated`（汉获 50% 在途税银并检定都尉阵亡）（2026-10-18）
- [S03→S06] 需 S06 在 `data/characters.json` 中收录历代单于（伊稚斜、乌维、乌师庐、虚闾权渠、握衍朐鞮）与四部首领（须卜奢、呼衍骨、先贤掸、休屠余）及僮仆都尉条目，并提供 `evt_chanyu_succession`（单于继承三选一）、`evt_tribe_offers_surrender`（部王请降）、`evt_white_disaster_collapse`（大雨雪瓦解）的叙事模板（2026-10-18）
- [S03→S08] 需 S08 在 `xiongnu_ai.gd` 与 `han_ai.gd` 中通过 `Tribes.get_visible_loyalty_range` 读取四部模糊忠诚度区间（严禁直读 `tribe.loyalty`），并在汉 AI 中新增北道截击僮仆都尉税队与 9 旬窗口出塞迎降动摇部王的效用评分（2026-10-18）
- [S08→S06] 需 S06 在 `data/characters.json` 中为每位持节汉使与匈奴单于配置 `ai_personality` 字段（映射至 S08 的 6 套性格 ID：`han_pioneer_hawk` / `han_prudent_farmer` / `han_audacious_schemer` 及 `xn_iron_tyrant` / `xn_conciliatory_elder` / `xn_greedy_raider`），并在 AI 触发历史事件时调用 `AIUtils.evaluate_event_choice`（2026-10-18）
- [S08→S07] 需 S07 在顶栏对手铭牌 Tooltip 中接入 `AIUtils.get_commander_personality_summary(state, faction)` 展示敌酋性格徽章与行事倾向，并在开发模式下支持 `F9` 呼出 `AIDebugOverlay` 黑板效用拆解面板（2026-10-18）
- [S08→S09] 需 S09 在 W2 新规则模拟中将 5 种机器人策略同源映射至 `data/ai_profiles.json` 性格与难度参数，并验证 `S08-T01`~`S08-T10`（含消除匈奴无脑猛攻支配策略）（2026-10-18）

## 待裁决（与圣经冲突或需要拍板）

- [Q-S02-01] 信任档位对季度拨款的乘数（`0.60x..1.15x`）：S02 假设此乘数属于局内表现反馈（对玩家与 AI 同等生效），而三档难度下的基准拨款恒为 `1,250` 钱/季不变，符合圣经 L8（难度不靠资源作弊）（2026-10-17）
- [Q-S02-02] 漠北剧本开局月份（1 月冬 vs 2 月春）：S02 已在 Tick 0 立即发放首季拨款 `+1,500` 钱（T1 可支配 `4,500` 钱），且 1 月冬月封山可作为玩家对开局诏令上书讨价的 `+10%` 客观理由加分项；若 S01 改为 2 月开局，S02 公式无需修改即可兼容（2026-10-17）
- [Q-S02-03] 监军御史与后期候补继任者：当 EA 25 名历史人物池中的御史/使臣因年代或阵亡耗尽时，是否允许使用史书风官号+姓氏生成候补人物（如“侍御史·杜延年”“中郎将·辛武贤”）？（2026-10-17）
- [Q-S02-04] 汉方小额送礼（募使）是否免占 4–6 人具名人物槽：S02 假设仅精使团（册封/盟誓/奇袭/通大国）强制需具名正使在场随行，小额常规赏赐由郡县小吏募使执行，请与 S04 最终确认（2026-10-17）
- [Q-S01-01] 主沙盒剧本《漠北之后》标准时长：S01 设定为 **40 季（10 年 / 120 月，前 119—前 109）**，对齐圣经 L5「2–4 小时」目标并消除旧版 240 月后半程垃圾时间（同时保留可选 60 季长局开关）（2026-10-17）
- [Q-S01-02] 政治崩盘结局（`HAN_RECALL` 槛车征还 / `XN_SCATTER` 诸部离散）在 L12 胜率统计中的归口：S01 将其作为独立于「主胜利（各 20–35%）」与「到期计分（≤50%）」之外的第 3 类结局（目标合计占比 10–15%），既不挤占主胜利配额，也不计入到期计分（2026-10-17）
- [Q-S01-03] 剧本③《都护府》中“渠犁”与“鄯善/伊循”节点复用：遵守圣经 L3 不新增节点，在剧本③中将 `lun_tai` 显示名映射为“轮台（渠犁）”承载郑吉初始屯田，将 `lou_lan` 显示名映射为“鄯善（楼兰）”承载伊循屯田（2026-10-17）
- [Q-S05-01] 大军供粮意愿 $W$ 与执行分档的所有权切分：S04 负责计算意愿 $W \in [0, 100]$，S05 负责 $75/50/30$ 四档执行（献粮/平买/强征/掠食）并回写影响力/怨恨/「汉军掠食」罪状（2026-10-17）
- [Q-S05-02] 将领统率量纲与特性标签：S05 假设 `character.command` 为 `0..10` 整数（无将默认 `2`，战力乘数 `1 + 0.03*(cmd-3)`），并读取 `trait_greedy`/`trait_ambusher`/`trait_stern`（2026-10-17）
- [Q-S05-03] 七科谪罪人兵招募地点：允许在长安及河西四郡直辖城直接招募 `convict`（免去长安步行 88 天至敦煌的拖沓），当年发谪 `>5000` 人时丝路商税 `×0.85`（2026-10-17）
- [Q-S05-04] 补给线单段民夫双向征调：当段起点 `from` 可征民夫不足时，允许合并调用段终点 `to` 的闲置可征民夫额（回程空车协运）（2026-10-17）
- [Q-S05-05] 难度分档对迷雾的作用方式：AI 恒读标准 `1.0x` 误差估计值；玩家在「轻车」误差 `×0.5`，在「虽远必诛」误差 `×1.25` 且隐藏区间上下界只显示单点估计（2026-10-17）
- [Q-S04-01] 两属城邦（`is_dual == true`）在计分中的权重：S04 设定两属国同时置 `overlord = "xiongnu"`（纳半税）与 `han_enfeoffed = true`（为汉提供 `+2` 印绶功业并解除禁商），请确认是否需在到期计分中为 `is_dual` 单独设权重（2026-10-17）
- [Q-S04-02] 被汉军「屠城（`sack`）」后的荒废城邦节点（`sacked_memory_seasons = 8` 期间 `overlord == ""`）是否允许汉军同格直接执行 `build_tuntian`（复现李广利屠轮台后设轮台/渠犁屯田）（2026-10-17）
- [Q-S04-03] 匈奴外交威压指令（`demand_vassal` / `demand_exclusive` / `enforce_trade_ban`）依托西域腹地的僮仆都尉即时结算，不另设匈奴在途使团棋子，以保持汉匈不对称体验（2026-10-17）
- [Q-S03-01] 季制回合切分与旧版历法冬季月份对齐：S03 假设季制下 Q1（1–3 月）季初对应正月诸长小会、Q2（4–6 月）对应五月龙城大会、Q3（7–9 月）对应秋季蹛林大会、Q4（10–12 月）季末（12 月下旬）结算冬季白灾与单于年度寿元检定（2026-10-18）
- [Q-S03-02] 剧本②（前 119 年）四部建制与具名首领考据容差：为保证三剧本共用 `zuoxian / youxian / rizhu / lihu` 四部结构，前 119 年日逐王命名为世家姓氏“呼衍骨”（剧本③切换为历史真名“先贤掸”），伊吾前锋部设定为历史上有据可查的“犁汙王部”（2026-10-18）
- [Q-S03-03] 汉军迎降动摇部王（`wavering`）时将领在场修正：9 旬窗口内 ≥3,000 汉军抵近即可触发迎降；若有持节使臣/名将随军则 100% 接收 50% 丁口无哗变，若无具名将领随行则承受 25% 哗变损耗（2026-10-18）
- [Q-S03-04] 匈奴「废立亲匈王子」（`install_prince`）与 S04 罪状耦合：耗 450 钱将目标城邦翻转为 `overlord = "xiongnu"` 时自动为汉方生成合法讨伐罪状 `crimes_against_han`（同城邦冷却 8 季）（2026-10-18）

## 已裁决（主策划统一拍板，W2/W3/W4 均以此为准）

- **[R-01] 历法与季度对齐（合并 Q-S01-01, Q-S02-02, Q-S03-01）**：沿用现有 `calendar.gd` 自 1 月上旬（Tick 0）起算，季制（`decision_ticks=9`）每年固定 4 季：**Q1（1–3月，含正月岁首拨款与匈奴正月小会）、Q2（4–6月，含五月龙城大会）、Q3（7–9月，含秋收与秋季蹛林大会）、Q4（10–12月，含 11–1月山道封山与 12月下旬白灾/单于寿元检定）**。主沙盒剧本《漠北之后》标准局设为 **40 季（10 年，120 月）**，并提供可选 60 季（15 年）长局开关。
- **[R-02] 人物属性量纲统一（合并 Q-S02-03, Q-S02-04, Q-S05-02）**：S06 定义 `data/characters.json` 时，所有能力值（`command`, `valor`, `eloquence`, `caution`）统一存储为 `0–100` 整数（普通将使基准 `50–70`，名将/名使 `80–98`），并提供辅助属性 `command_tier = round(command / 10.0)`（`0..10`）供 S05 战力乘数 `1 + 0.03*(command_tier - 3)` 直接调用。精使团/册封/盟誓/矫诏必须绑定具名人物（汉方在场上限 4–6 人）；小额募使（`hire_mission`）免占具名槽。当史实人物因年代或阵亡耗尽时，允许从史书风候补池（官号+汉代常见姓氏）递补。
- **[R-03] 胜利与计分归口（合并 Q-S01-02, Q-S01-03, Q-S04-01）**：政治崩盘结局（`HAN_RECALL` / `XN_SCATTER`）在 L12 统计中单列为第 3 类结局（目标合计 5–15%），不计入到期计分；两属城邦（`is_dual == true`）在汉功业值中计 `+2`（印绶册封档），在到期计分中汉、匈各得半数城邦控制分（`+2.5`）；剧本③《都护府》复用 `lun_tai` 显示为“轮台（渠犁）”、`lou_lan` 显示为“鄯善（楼兰）”，不改节点拓扑。
- **[R-04] 汉匈外交与军事耦合（合并 Q-S03-02, Q-S03-03, Q-S03-04, Q-S04-02, Q-S04-03）**：三剧本共用 `zuoxian / youxian / rizhu / lihu` 四部 ID（按剧本切换首领姓名）；汉军在 9 旬窗口内迎降动摇部王时，有具名将使随行则 100% 接收无哗变，无将领则承受 25% 哗变损耗；匈奴 `install_prince` 翻转城邦自动给汉生成讨伐罪状；汉军屠城（`sack`）后的荒废节点允许直接执行 `build_tuntian`；匈奴外交威压依托僮仆都尉即时结算，不设匈奴使团棋子。
- **[R-05] 后勤、罪人兵与难度（合并 Q-S02-01, Q-S05-01, Q-S05-03, Q-S05-04, Q-S05-05）**：大军供粮意愿 $W \in [0,100]$ 由 S04 计算、S05 分四档（`75/50/30`）执行并回写；七科谪 `convict` 可在长安及河西四郡招募，年发谪 `>5,000` 时商税 `×0.85`；补给线单段支持合并调用终点闲置民夫协运；朝廷信任拨款乘数对玩家与 AI 同等生效；三档难度仅调节玩家迷雾误差（`0.5x / 1.0x / 1.25x`）、诏令宽限与 AI 战术卡积极度，绝不作弊加资源。


