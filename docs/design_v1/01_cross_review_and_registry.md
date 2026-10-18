# 01 — W3 跨文档一致性审查与全局符号注册表（Cross-Review & Master Symbol Registry）

> **文档性质**：本文档是 `design_v1` 架构设计的 **W3 唯一权威字典（Single Source of Truth, SSOT）**。  
> **适用范围**：在 W4 编写 `S10_implementation_plan.md`、重构 `design_sim/` 纸面模拟器以及修改 Godot `core/*.gd` / `ai/*.gd` / `ui/*.gd` / `data/*.json` 时，**凡 `S01`–`S09` 各分册之间存在字段拼写、类型、初值、命令 ID、函数签名或结算时序差异的，一律以本文档定义的 Canonical 标准写法为准**。

---

## 第 1 章：W3 交叉审查结论与命名冲突勘误表（Cross-Review Errata）

通过对 [`00_bible.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/00_bible.md)、[`STATUS.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/STATUS.md)（含主策划拍板 `R-01`~`R-05`）以及 `S01`–`S09` 共 9 份设计规范与现有代码库（`core/*.gd`, `data/*.json`）的逐字段自动化扫描比对，共发现并裁决统一了 **30 处跨文档接口与命名差异（`[E-01]` ~ `[E-30]`）**，分为四大类：
- **A 类（状态变量与存档 Schema 冲突，`E-01` ~ `E-12`）**：12 处；
- **B 类（命令 ID 与参数字典冲突，`E-13` ~ `E-17`）**：5 处；
- **C 类（跨模块 API 函数签名冲突，`E-18` ~ `E-23`）**：6 处；
- **D 类（实体 ID、枚举与历法时序冲突，`E-24` ~ `E-30`）**：7 处。

### 1.1 A 类：状态变量与存档字段冲突勘误表（`E-01` ~ `E-12`）

| 勘误编号 | 冲突域 | 各分册原始写法差异 | 强制统一的 Canonical 标准写法与兼容规则 |
|---|---|---|---|
| **`[E-01]`** | 日逐王怨望值归属与键名 | • `S01` 剧本 JSON：`tribes_init.rizhu_grudge_initial`<br>• `S03`：`state.tribes.units["rizhu"].grievance` (`0..100`)<br>• `S06`：`state.events.rizhu_grievance` (`0..100`) | **唯一真源**：`state.tribes.units["rizhu"].grievance: int`（`0..100`）。<br>`EventEngine` 在解析 `events.rizhu_grievance` 与 `add_rizhu_grievance` 时直接读写 `state.tribes.units["rizhu"].grievance`；`ScenarioLoader` 同时兼容读取 `rizhu_grudge_initial` 与 `rizhu_grievance_init`。 |
| **`[E-02]`** | 汉武帝悔意值归属位置 | • `S02`：`state.court.emperor_regret: int` (`0..150`，阈值 `80`)<br>• `S06`：`state.events.emperor_regret: int` (`0..100`) | **唯一真源**：`state.court.emperor_regret: int`（范围 `0..150`，`>= 80` 触发轮台罪己诏）。<br>`state.events` 不再重复存储该字段；`S06` 的 `add_emperor_regret` 统一调用 `Court.apply_event_effect(state, "emperor_regret", val)`。 |
| **`[E-03]`** | 匈奴四部容器结构与键名 | • `S01` §6.3：`state.tribes.list`，且剧本②误写 `"hujie"`<br>• `S03` §3.2：`state.tribes.units: Dictionary`<br>• `S06` §3.3：`tribes.rizhu.status` | **唯一真源**（对齐 `R-04`）：`state.tribes.units: Dictionary`，固定包含 4 个主键：`["zuoxian", "youxian", "rizhu", "lihu"]`，严禁使用 `"hujie"` 作为部族 ID（呼揭节点上驻军归属 `"rizhu"` 或 `"lihu"`）。 |
| **`[E-04]`** | 诸部离散计数与继承危机标志 | • `S01`：`state.victory.xn_scatter_streak_quarters: int`、`state.tribes.in_succession_crisis: bool`<br>• `S03`：`state.tribes.scatter_consecutive_turns: int`、`state.tribes.succession_crisis_turns: int` | **唯一真源**：由 `S03` 维护 `state.tribes.scatter_consecutive_turns: int` (`0..4`) 与 `state.tribes.succession_crisis_turns: int` (`0..8`)；`S01` 在月末结算时读取 `state.tribes.scatter_consecutive_turns` 同步更新 `state.victory.xn_scatter_streak_quarters`，并以 `state.tribes.succession_crisis_turns > 0` 判定继承危机。 |
| **`[E-05]`** | 朝廷召还终态与矫诏先例量纲 | • `S01` 读取：`state.court.recall_active`、`recall_finalized`（`STATUS.md` 称 `han_recall_imprisoned`）、`unpardoned_forged_edict`、`precedent_resistance` (`0..100`)<br>• `S02` 定义：`state.court.precedent` (`0..10`)<br>• `S06` 将 `precedent` 当作 `0..100`（`+8/+12`，`>=45` 不封侯） | **Canonical 标准**：<br>1. `state.court.precedent: int` 为矫诏累计数（`0..10`，每次矫诏 `+1`），`state.court.precedent_resistance: int` 为封侯朝议阻力值（`0..100`，初值由剧本 `court_init.precedent_resistance` 给定，每次矫诏 `+10`，`S06` 的 `add_precedent` 直接修改 `precedent_resistance` 并按 `int(val/8)` 累加 `precedent`；当 `precedent >= 3` 或 `precedent_resistance >= 45` 时触发「功大不封」）；<br>2. 在 `state.court` 中显式维护 `recall_active: bool`、`recall_finalized: bool`（等价别名 `han_recall_imprisoned`）、`unpardoned_forged_edict: bool`。 |
| **`[E-06]`** | 朝廷风向字段名与枚举值 | • `S02`：`state.court.wind_id` $\in$ `{"wudi_early", "luntai", "huoguang", "xuandi"}`<br>• `S01`：`court_wind` $\in$ `{"expansionist", "balanced", "retrenchment"}`<br>• `S06`：`set_court_wind("expansion"\|"rest"\|"pragmatic")`<br>• `S07`：`state.court.wind` | **唯一真源**：`state.court.wind_id: String`，合法枚举固定为 **`"wudi_early" | "luntai" | "huoguang" | "xuandi"`**。<br>兼容映射：`"expansionist"/"expansion"` $\to$ `"wudi_early"`；`"retrenchment"/"rest"` $\to$ `"luntai"`；`"balanced"/"pragmatic"` $\to$ 按年份映射为 `"huoguang"`（`year < -73`）或 `"xuandi"`（`year >= -73`）。 |
| **`[E-07]`** | 伤亡与断粮饿死统计字典 | • 现有 `game_state.gd`：`{battles, han_casualties, xn_casualties, horses_captured, hexi_lost, han_vassals_peak, sieges_won}`<br>• `S05`：`{han_total_deaths, han_combat_deaths, han_starved_deaths, han_march_deaths, han_deserted, xn_total_deaths, xn_starved_deaths}` | **Canonical 标准**：`state.stats` 合并保留全部 14 个键，并强制维护恒等式：<br>`han_total_deaths == han_combat_deaths + han_starved_deaths + han_march_deaths`（且 `han_casualties` 实时同步等于 `han_total_deaths`，`xn_casualties` 同步等于 `xn_total_deaths`）。 |
| **`[E-08]`** | 节点屯田阶段字段名 | • `S01`：`node.tuntian_level` (`0..2`)、`node.tuntian_troops`<br>• `S05`：`node.tuntian_stage` (`0..2`)、`node.colonies` (`int`) | **唯一真源**：`node.tuntian_stage: int`（`0`=未测，`1`=已校猎测地，`2`=已开渠屯田）与 `node.colonies: int`（在耕屯田人数）。剧本 JSON 的 `tuntian_level` 在加载时自动写入 `node.tuntian_stage`。 |
| **`[E-09]`** | 军队统帅字段与军队 ID 类型 | • `S02`：`army.general_char_id: String`<br>• `S05`：`army.commander_id: String`<br>• `S01`：`army.commander`<br>• `S03`：将 `army_id` 标为 `int`（如 `104`），而现有代码与 `S02/S05` 为 `String` | **唯一真源**：<br>1. 军队统帅字段统一为 **`army.commander_id: String`**（无将领时为 `""`）；<br>2. 全项目 `army_id`（含 `state.armies` 键、`chanyu_army_id`、`tongpu_army_id`、`escort_army_id`）统一为 **`String` 类型**（未绑定时为 `""`）。 |
| **`[E-10]`** | 人物在场锁与绑定目标字段 | • `S02`：`char.locked_action` (`""\|"mission"\|"army"\|"tuntian"\|"in_transit"`)、`char.bound_entity_id`<br>• `S06`：`char.assigned_to`、`char.status` | **Canonical 标准**：`Character` 同时包含 `locked_action: String`（锁类型）与 `assigned_to: String`（绑定的军队 ID / 使团 ID / 节点 ID，替代 `bound_entity_id`）。当 `locked_action == ""` 且 `status == "active"` 时人物为空闲可指派态。 |
| **`[E-11]`** | 城邦对汉罪状字段类型 | • `S01`：`relation.crimes_against_han: int`（层数）<br>• `S02`：`state.crimes[state_id]`<br>• `S04`：`relation.crimes_against_han: Array[CrimeRecord]` | **唯一真源**：`state.relations[state_id].crimes_against_han: Array[Dictionary]`（元素为 `CrimeRecord` 字典）。剧本 JSON 中若配置整数（如 `crimes_against_han: 3`），由 `ScenarioLoader` 自动生成对应权重的 `CrimeRecord`；外部模块一律通过 `Diplomacy.has_valid_crime(state, sid)` 与 `Diplomacy.get_crime_score(state, sid)` 访问。 |
| **`[E-12]`** | 游戏结束标志与维持月数镜像 | • 现有代码：`state.winner != ""`<br>• `S01`：`state.victory.is_game_over: bool`、`state.victory.winner: String`<br>• `S06`：`state.game_over == true` | **Canonical 标准**：以 `state.victory.is_game_over: bool` 与 `state.victory.winner: String` 为真源，每次更新时同步回写顶层 `state.winner = state.victory.winner`、`state.win_reason = state.victory.end_type` 及 `state.victory_hold_months = state.victory.han_hold_months`。 |

---

### 1.2 B 类：命令 ID（Command `type`）与参数键名冲突勘误表（`E-13` ~ `E-17`）

| 勘误编号 | 所属系统 | 各分册命令命名差异 | 强制统一的 Canonical 命令 `type` 与参数契约 |
|---|---|---|---|
| **`[E-13]`** | **S02 汉廷奏请与矫诏** | • `S02`：`request_funds`、`request_troops`、`request_character`、`request_princess`、`forge_edict`<br>• `S07`：`petition_court`、`forged_edict_action`<br>• `S08`：`submit_memorial` (`{type: ...}`) | **Canonical 命令 ID**：严格采用 `S02` 拆分的 5 条原子命令：<br>`request_funds`、`request_troops`、`request_character`、`request_princess`、`forge_edict`。<br>（`commands.gd` 为 `submit_memorial` 提供根据 `c["memorial_type"]` 路由至上述 4 条请奏命令的兼容别名）。 |
| **`[E-14]`** | **S02/S06 人物调度与拜将** | • `S02`：`assign_general` (`{army_id, char_id}`)、`relocate_character` (`{char_id, target_node}`)<br>• `S06`：`assign_character` (`{char_id, target_type, target_id}`)<br>• `S08`：`assign_commander` (`{army, character_id}`)、`relocate_character` (`{character_id, to_node}`) | **Canonical 命令 ID**：<br>1. 军队拜将/卸任：**`assign_general`**，参数 `{"army_id": String, "char_id": String}`（兼容 `assign_commander`）；<br>2. 通用人物指派（含驻节点督屯）：**`assign_character`**，参数 `{"char_id": String, "target_type": "army"\|"mission"\|"node", "target_id": String}`；<br>3. 人物移驻：**`relocate_character`**，参数 `{"char_id": String, "target_node": String}`。 |
| **`[E-15]`** | **S03 匈奴王庭内政与战术卡** | • `S03`：`distribute_rewards` (`{alloc}`)、`summon_tribe_army`、`restrain_tribe`、`assembly_decision`、`select_tactic_card`<br>• `S07`：`levy_tribe`、`suppress_tribe`<br>• `S08`：`distribute_rewards` (`{allocations}`)、`select_assembly_option`、`play_tactic_card` | **Canonical 命令 ID**：严格采用 `S03` 定义：<br>• **`distribute_rewards`**（参数 `{"alloc": Dictionary}`，兼容 `allocations`）<br>• **`summon_tribe_army`**（兼容 `levy_tribe`）<br>• **`restrain_tribe`**（兼容 `suppress_tribe`）<br>• **`assembly_decision`**（兼容 `select_assembly_option`）<br>• **`select_tactic_card`**（兼容 `play_tactic_card`）。 |
| **`[E-16]`** | **S03/S04 汉匈外交指令** | • `S04`：`dispatch_embassy` (`kind: "elite"\|"recruited"`)、`grant_enfeoffment`、`incorporate_vassal`、`demand_vassal`、`demand_exclusive`、`enforce_trade_ban`<br>• `S03`：`demand_submission`、`set_tax_rate`<br>• `S07`：`send_envoy`、`enfeoff`、`vassalize`、`demand_dual`<br>• `S08`：`dispatch_envoy` (`kind: "grand"\|"recruited"`)、`make_vassal`、`set_tax` | **Canonical 命令 ID**：<br>• 汉遣使：**`dispatch_embassy`**，`kind` 枚举固定为 **`"elite" | "recruited"`**（兼容 `dispatch_envoy` / `send_envoy` 及 `"grand" -> "elite"`，保留旧 `gift` 自动转单目标募使）；<br>• 汉册封/纳属：**`grant_enfeoffment`**（兼容旧 `enfeoff`）、**`incorporate_vassal`**（兼容旧 `make_vassal`）；<br>• 匈奴要求臣服/核定税档：**`demand_vassal`**（兼容 `demand_submission`）、**`set_tax_rate`**（兼容旧 `set_tax`）。 |
| **`[E-17]`** | **S05 补给线、屯田与作战计划** | • `S05`：`create_supply_line`、`update_supply_line`、`delete_supply_line`、`survey_tuntian`、`found_colony`、`settle_convicts`<br>• `S02/S07/S08`：`build_tuntian`、`set_supply_line`、`manage_supply_line`、`submit_plan`（现有代码为 `set_plan`） | **Canonical 命令 ID**：<br>• 补给线：**`create_supply_line`**、**`update_supply_line`**、**`delete_supply_line`**（`manage_supply_line` 作为 AI/UI 便捷包装路由至 `create` 或 `update`）；<br>• 屯田：**`survey_tuntian`**（阶段 0→1）、**`found_colony`**（车队立屯 1→2）、**`settle_convicts`**（罪人兵落户 1→2），并提供 **`build_tuntian`** 组合别名；<br>• 军队计划：**`set_plan`**（提供 **`submit_plan`** 完全等价别名）。 |

---

### 1.3 C 类：跨模块 API 函数签名冲突勘误表（`E-18` ~ `E-23`）

| 勘误编号 | 模块文件 | 调用方与提供方签名差异 | 强制统一的 Canonical GDScript 函数签名 |
|---|---|---|---|
| **`[E-18]`** | `core/victory.gd` | • `S01`：`get_han_merit`、`get_xn_weifu`、`get_xn_weifu_breakdown`、`record_event_award(state, faction, award_key, value_override)`<br>• `S02`：`add_merit`、`on_han_court_recall_defeat`<br>• `S04/S06`：`record_event_award(state, key, amount)`（漏 `faction`）<br>• `S05`：`record_battle_milestone`<br>• `S07`：`get_xn_prestige_breakdown`、`get_historian_evaluation`<br>• `S08`：`calc_duhu_merit` | • `Victory.get_han_merit(state: GameState) -> int`（别名 `calc_duhu_merit`）<br>• `Victory.get_xn_weifu(state: GameState) -> int`<br>• `Victory.get_xn_weifu_breakdown(state: GameState) -> Dictionary`（别名 `get_xn_prestige_breakdown`）<br>• `Victory.record_event_award(state: GameState, faction: String, award_key: String, value_override: Variant = null) -> void`<br>• `Victory.record_battle_milestone(state: GameState, winner: String, killed: int, commander_id: String = "") -> void`<br>• `Victory.get_historian_evaluation(state: GameState) -> Dictionary` |
| **`[E-19]`** | `core/court.gd` | • `S02` 导出表未显式列出 `S04/S05/S06/S07/S08` 需求中的 `modify_trust`、`is_luntai_edict_active`、`spend_military_market`、`add_treasury`、`can_build_tuntian`、`preview_forged_edict_race`、`preview_bargain_prob` | 在 `core/court.gd` 中完整实现并导出全部 22 个静态函数（完整签名见第 4 章 §4.2）：含 `Court.modify_trust(state, delta, reason)`、`Court.is_luntai_edict_active(state) -> bool`、`Court.spend_military_market(state, cost, note) -> bool`、`Court.add_treasury(state, money, note) -> void`、`Court.can_build_tuntian(state, node_id) -> bool`。 |
| **`[E-20]`** | `core/tribes.gd` | • `S04`：`Tribes.add_loot_to_pool(state, money)`<br>• `S05/S06`：`Tribes.add_reward_pool(state, money)`<br>• `S07`：`Tribes.get_visible_loyalty_range(state, tribe_id)`（缺第 3 参数） | • `Tribes.add_reward_pool(state: GameState, delta_money: int, reason: String = "") -> void`（`add_loot_to_pool` 为其别名，内部强同步 `state.tribes.reward_pool` 与 `state.factions["xiongnu"].money`）<br>• `Tribes.get_visible_loyalty_range(state: GameState, tribe_id: String, viewer_faction: String = "xiongnu") -> Vector2i` |
| **`[E-21]`** | `core/diplomacy.gd` | • `S03`：`add_resentment`、`add_global_intimidation`<br>• `S04`：`add_tax_resentment`、`on_tongpu_deposed`<br>• `S06`：`add_crime`、`on_white_disaster_weaken` | • `Diplomacy.add_crime(state: GameState, state_id: String, crime_type: String, holder: String = "han", context: Dictionary = {}) -> void`<br>• `Diplomacy.add_tax_resentment(state: GameState, state_id: String, base_resentment: float) -> float`<br>• `Diplomacy.on_tongpu_deposed(state: GameState) -> void`<br>• `Diplomacy.on_white_disaster_weaken(state: GameState, delta_x: float = -15.0) -> void`（兼容 `add_global_intimidation`） |
| **`[E-22]`** | `core/pathfinding.gd` & `core/supply.gd` | • `S02/S03/S04` 用 `Pathfinding.*`，`S05/S08` 用 `Path.*`<br>• `S04/S06` 用 `Supply.add_horses(state, count)` 或 `(state, faction, count)`，`S05` 用 `HorsePool.add_horses` | • `core/pathfinding.gd` 统一类名 `Pathfinding`（兼容别名 `Path`）；<br>• 马匹增减统一签名：`Supply.add_horses(state: GameState, count: int, faction: String = "han", target_node: String = "") -> void`（`HorsePool.add_horses` 委托调用此函数）。 |
| **`[E-23]`** | `core/event_engine.gd` & `core/chronicle.gd` | • `S03`：`Events.trigger_event`<br>• `S04`：`Events.trigger`<br>• `S07`：`Events.get_pending_modal_events`、`Events.get_season_chronicle_text`<br>• `S06`：`EventEngine.trigger_immediate`、`Chronicle.get_season_entries` | • `core/event_engine.gd` 统一类名 `EventEngine`（兼容别名 `Events`）：`EventEngine.trigger_immediate(state: GameState, evt_id: String, ctx: Dictionary = {}) -> void`（兼容 `trigger` / `trigger_event`）、`EventEngine.get_pending_modal_events(state: GameState) -> Array[Dictionary]`；<br>• `core/chronicle.gd`：`Chronicle.get_season_entries(state: GameState, style: String = "classical") -> Array[String]`。 |

---

### 1.4 D 类：实体 ID、枚举与历法时序冲突勘误表（`E-24` ~ `E-30`）

| 勘误编号 | 冲突项 | 各分册原始写法差异 | 强制统一的 Canonical 标准写法 |
|---|---|---|---|
| **`[E-24]`** | 西域大国政权 ID vs 首都节点 ID 混用 | • `scenario_mvp.json`：乌孙政权 ID 为 `"wusun"`、首都节点为 `"chi_gu"`；大宛政权 ID 为 `"dawan"`、首都节点为 `"da_wan"`；右贤王节点为 `"youxian_wang"`；车师前为 `"cheshi_qian"`。<br>• `S06` 误写节点/政权 ID：`"wu_sun"`、`"da_yuan"`、`"right_wise_court"`、`"che_shi_qian"`；`S02` 误写 `"qu_li"`。 | 严格遵守圣经 L3 与 `data/scenario_mvp.json`：<br>1. **节点 ID (`node_id`)**：乌孙王庭为 **`"chi_gu"`**，大宛王城为 **`"da_wan"`**，右贤王部为 **`"youxian_wang"`**，车师前为 **`"cheshi_qian"`**，轮台/渠犁为 **`"lun_tai"`**（对齐 `R-03`）；<br>2. **政权 ID (`state_id` in `relations`)**：乌孙为 **`"wusun"`**，大宛为 **`"dawan"`**，康居为 **`"kangju"`**，大月氏为 **`"dayuezhi"`**，罽宾为 **`"jibin"`**。<br>3. `Diplomacy.normalize_state_id(id)` 自动将 `"chi_gu"/"wu_sun"` 归一为 `"wusun"`，将 `"da_wan"/"da_yuan"` 归一为 `"dawan"`。 |
| **`[E-25]`** | 历史人物 ID 跨文档拼写差异 | • 虚闾权渠单于：`S01` 写 `"xn_xulvquanqu"`，`S06` 写 `"xn_xuluquanqu"`<br>• 四部王：`S03` 写 `"xn_youxian_xubu"` / `"xn_rizhu_huyan"` / `"xn_lihu_xiutu"`，`S06` 写 `"xn_xubu_she"` / `"xn_xiutu_yu"` / `"xn_huyan_gu"` / `"xn_lihu_wang"`<br>• `S01` 剧本引用 `"han_wang_hui"`、`"han_zhao_chongguo"`、`"xn_zhao_xin"` | 以 `S06` 人物主键命名规则为准：<br>• 虚闾权渠单于：**`"xn_xuluquanqu"`**<br>• 左贤王须卜奢：**`"xn_xubu_she"`**；右贤王休屠余：**`"xn_xiutu_yu"`**；前代日逐王呼衍骨：**`"xn_huyan_gu"`**；后代日逐王先贤掸：**`"xn_xianxianshan"`**；犁汙王蒲奴：**`"xn_lihu_wang"`**<br>• 王恢（`"han_wang_hui"`）、赵充国（`"han_zhao_chongguo"`）、赵信（`"xn_zhao_xin"`）收入 `data/characters.json` 的 `scenario_extras` 扩展池。 |
| **`[E-26]`** | 诏令模板 ID 命名格式 | • `S02` §4.3：`"ED01"` ~ `"ED15"`<br>• `S02` 正文示例：`"edict_open_loulan"`；`S06` `#08`：`"edict_conquer_dawan"` | `data/edicts.json` 主键统一为 **`"ED01"` ~ `"ED15"`**（`"edict_open_loulan"` $\to$ **`"ED01"`**，`"edict_conquer_dawan"` $\to$ **`"ED05"`**）。 |
| **`[E-27]`** | 事件 ID 与 `key_events_occurred` 标签 | • `S01` 写 `evt_white_disaster`、`evt_rizhu_surrender_offer`、`evt_wusun_joint_war`；`S03` 写 `evt_tribe_offers_surrender`；`S06` 定名为 `evt_white_disaster_collapse`、`evt_rizhu_offers_surrender`、`evt_five_generals_wusun`<br>• `key_events_occurred`：`S01` 用 8 个短标签，`S06` 写了长标签 | 1. **40 个事件 ID** 严格以 `S06` §4.6 为准（见本文第 5 章 §5.5）；<br>2. `state.victory.key_events_occurred` 严格使用 **`S01` 的 8 个标准短标签**：**`"rizhu"`, `"baizai"`, `"jiaozhao"`, `"chanyu_die"`, `"wind_shift"`, `"hexi_fall"`, `"wusun_war"`, `"king_slain"`**（`S06` 事件表中的 `key_event_tag` 统一映射为此 8 个短标签）。 |
| **`[E-28]`** | 罪状类型枚举（Crime Type） | • `S02`：`crime_killed_envoy`、`crime_robbed_envoy`<br>• `S01`：`raid_caravan`<br>• `S04`：9 种标准枚举；`S05`：`han_plunder` | 统一为 **10 种标准枚举**：`"kill_envoy"`、`"insult_envoy"`、`"rob_caravan"`、`"submit_enemy"`、`"betray_vassal"`、`"kill_han_king"`、`"aid_enemy_war"`、`"refuse_vassal_supply"`、`"refuse_heavenly_horses"`、`"han_plunder"`。 |
| **`[E-29]`** | 剧本开局月份与季度历法对齐 | • `S01` §4.6 将开局月设为 `month = 2`（2–4 月为 Q1）<br>• 主策划拍板 **`[R-01]`** 与 `S02/S03/S05` 均规定自 **1 月上旬（Tick 0）** 起算 | **严格执行 `[R-01]`**：所有剧本 `start` 统一为 `{"year": <Y>, "month": 1, "decade": 1}`（1 月上旬，Tick 0）。每年固定 4 季：**Q1（1–3月，Tick `0..8`）、Q2（4–6月，Tick `9..17`）、Q3（7–9月，Tick `18..26`）、Q4（10–12月，Tick `27..35`）**。 |
| **`[E-30]`** | 人物特性 Tag 词表完整性 | • `S06` §4.5(1)-(3) 在 25+4 名人物身上配置了 40 个不同的 `trait_*` ID，但 §4.5(4) 数值表仅列出了其中 24 个核心特性 | 在 `data/characters.json → trait_definitions` 中完整注册全部 **40 个特性 Tag**（其中 **24 个核心机制特性** + **16 个角色专属加成特性**，完整定义见本文第 5 章 §5.3）。 |

---

## 第 2 章：`GameState` 与实体字典权威 Schema 总表

### 2.1 `GameState` 顶层字段总表（`core/game_state.gd`）

> **序列化铁律**：所有标记 `入档 = 是` 的字段必须列入 `GameState.SAVE_KEYS`（存档头升级为 `XIYU_SAVE_3\n`，向后兼容读取 `XIYU_SAVE_2\n` 并用默认值补齐新字段）。

| 字段名 | GDScript 类型 | 默认值 / 初值 | 所属模块 | 入档 | 说明 |
|---|---|---|---|---|---|
| `bal` | `Dictionary` | `load_json("res://data/balance.json")` | 基线 | 否 | 全局平衡参数表（只读配置） |
| `units` | `Dictionary` | `load_json("res://data/units.json")` | S05 | 否 | 兵种属性表（含新增 `convict` 罪人兵） |
| `buff_defs` | `Dictionary` | `load_json("res://data/buffs.json")` | 基线 | 否 | Buff 模板定义表 |
| `ai_profiles` | `Dictionary` | `load_json("res://data/ai_profiles.json")` | S08 | 否 | AI 权重、性格、难度与 42 节点语义标签配置 |
| `court_cfg` | `Dictionary` | `load_json("res://data/court.json")` | S02 | 否 | 汉廷信任分档、风向、请奏参数配置 |
| `edicts_cfg` | `Dictionary` | `load_json("res://data/edicts.json")` | S02 | 否 | 15 道诏令模板配置 |
| `tribes_cfg` | `Dictionary` | `load_json("res://data/tribes.json")` | S03 | 否 | 匈奴四部、年会、战术卡配置 |
| `characters_cfg` | `Dictionary` | `load_json("res://data/characters.json")` | S06 | 否 | 史实人物、候补池与特性词表配置 |
| `events_cfg` | `Dictionary` | `load_json("res://data/events.json")` | S06 | 否 | 40 条叙事事件定义表 |
| `scenario_id` | `String` | `"scn_mobei_119bc"` | S01 | 是 | 当前剧本 ID（`"scn_loulan_108bc"` / `"scn_mobei_119bc"` / `"scn_protectorate_68bc"`） |
| `start_year` | `int` | `-119` | S01 | 是 | 剧本起始公元前年份（负数） |
| `start_month` | `int` | `1` | S01/R-01 | 是 | 剧本起始月份（固定为 `1` 正月） |
| `max_turns` | `int` | `120` | S01/R-01 | 是 | 剧本最大月数（`max_months`：剧本①`36` / 剧本②`120`或长局`180` / 剧本③`108`） |
| `decision_ticks` | `int` | `9` | S01/R-01 | 是 | 每次下令推进旬数：季制 `9`（默认），月制 `3` |
| `player_faction` | `String` | `"han"` | 基线 | 是 | 玩家扮演势力：`"han"` \| `"xiongnu"` |
| `difficulty_tier` | `String` | `"chijie"` | S01/S08 | 是 | 难度档位：`"qingche"`（轻车）/ `"chijie"`（持节）/ `"suiyuan"`（虽远必诛） |
| `tick` | `int` | `0` | 基线 | 是 | 全局旬计数（`0` 为起局第 1 年 1 月上旬） |
| `day_offset` | `int` | `0` | 基线 | 否 | 旬内日序 `0..9` |
| `turn` | `int` | `0` | 基线 | 是 | 决策回合计数（季制下即为已过季数 `season_idx`） |
| `rng` | `RandomNumberGenerator` | `RandomNumberGenerator.new()` | 基线 | 是 | 确定性随机数发生器（存盘 `rng_seed` + `rng_state`） |
| `factions` | `Dictionary` | `{id -> FactionDict}` | 基线 | 是 | 势力字典（`factions["han"].money`, `factions["xiongnu"].money` 等） |
| `nodes` | `Dictionary` | `{node_id -> NodeDict}` | 基线/S05 | 是 | 42 节点状态字典（结构见 §2.2） |
| `routes` | `Array[Dictionary]` | `[RouteDict, ...]` | 基线/S05 | 是 | 53 条古道路段数组（结构见 §2.3） |
| `adj` | `Dictionary` | `{node_id -> Array[int]}` | 基线 | 是 | 邻接路段索引表 |
| `trade_routes` | `Array[Dictionary]` | 剧本配置 | 基线/S04 | 是 | 南北道丝路商道定义 |
| `armies` | `Dictionary` | `{army_id -> ArmyDict}` | 基线/S03/S05 | 是 | 现存军队字典（结构见 §2.4） |
| `next_army_id` | `int` | `1` | 基线 | 是 | 军队自增序号 |
| `central` | `Dictionary` | `{"infantry":int, "crossbow":int, "cavalry":int, "convicts":int}` | 基线/S05 | 是 | 汉廷中央军兵源池（兼容别名 `han_central_pool`） |
| `han_horse_pool` | `int` | `6000`（依剧本） | S05 | 是 | 汉方国家马匹池存量（`0..han_horse_pool_cap`） |
| `han_horse_pool_cap` | `int` | `30000` | S05 | 是 | 国家马匹池上限 |
| `tianma_breed_bonus` | `bool` | `false` | S05 | 是 | 是否已获得大宛汗血天马良种加成 |
| `han_convict_pool` | `int` | `4000`（依剧本） | S05 | 是 | 汉方七科谪/弛刑徒可征池（`0..30000`） |
| `convicts_levied_year` | `int` | `0` | S05 | 是 | 本年已征发七科谪罪人兵累计人数（`>5000` 时商税 `×0.85`） |
| `convicts_ransomed_season` | `int` | `0` | S05 | 是 | 本季已赎免罪人累计人数（每季上限 `4000`） |
| `supply_lines` | `Dictionary` | `{line_id -> SupplyLineDict}` | S05 | 是 | 自动补给线字典（结构见 §2.5） |
| `next_supply_line_seq` | `int` | `1` | S05 | 是 | 补给线 ID 自增序号 |
| `tuntian_pressure` | `Dictionary` | `{state_id -> float(0..100)}` | S05 | 是 | 西域城邦对汉邻近屯田的戒心压迫值 |
| `intel_estimates` | `Dictionary` | `{"han": {}, "xiongnu": {}}` | S05 | 是 | 双方迷雾下的敌军估计记录字典（结构见 §2.5） |
| `pending_reports` | `Array[Dictionary]` | `[]` | S05 | 是 | 在途斥候/烽燧警报队列 |
| `node_intel` | `Dictionary` | `{"han": {}, "xiongnu": {}}` | S05 | 是 | 双方对非己方节点的最新情报快照 |
| `victory` | `Dictionary` | `VictoryStateDict` | S01 | 是 | 胜负、功业 $G$、威服 $W$、维持月数与评定状态（见 §2.6） |
| `court` | `Dictionary` | `CourtStateDict` | S02 | 是 | 汉廷信任、风向、在途文书、生效诏令状态（见 §2.7） |
| `tribes` | `Dictionary` | `TribesStateDict` | S03 | 是 | 匈奴单于威望、赏赐池、四部、僮仆都尉、战术卡（见 §2.8） |
| `relations` | `Dictionary` | `{state_id -> RelationDict}` | S04 | 是 | 23 国（18 城邦 + 5 大国）外交状态字典（见 §2.9） |
| `missions` | `Dictionary` | `{mission_id -> MissionDict}` | S04 | 是 | 在途/驻留汉使团实体字典（见 §2.9） |
| `diplomatic_requests` | `Array[Dictionary]` | `[]` | S04 | 是 | 城邦主动外交请愿队列 |
| `recruited_missions_this_year` | `int` | `0` | S04 | 是 | 本年已派募使团批数（上限 `3`） |
| `next_mission_seq` | `int` | `1` | S04 | 是 | 使团自增序号 |
| `next_crime_seq` | `int` | `1` | S04 | 是 | 罪状自增序号 |
| `characters` | `Dictionary` | `{char_id -> CharacterDict}` | S06 | 是 | 全图具名人物与候补人物字典（见 §2.10） |
| `event_state` | `Dictionary` | `EventEngineStateDict` | S06 | 是 | 叙事事件引擎持久化状态（见 §2.10；提供 `state.events_engine` 别名以区分回放帧事件流 `state.events`） |
| `chronicle` | `Dictionary` | `{"season_entries": [], "history_annals": []}` | S06 | 是 | 《汉书》体本季纪事与历年编年史归档 |
| `ai_blackboard` | `Dictionary` | `{"han": AIBlackboardDict, "xiongnu": AIBlackboardDict}` | S08 | 是 | 汉匈 AI 跨回合记忆黑板（见 §2.11） |
| `ui_meta` | `Dictionary` | `UIMetaDict` | S07 | 是 | 界面激活页签、图层掩码、教学进度存档（见 §2.11） |
| `buffs` | `Array[Dictionary]` | `[]` | 基线 | 是 | 激活中的通用定时 Buff 列表 |
| `log` | `Array[Dictionary]` | `[]` | 基线 | 是 | 全部历史战报日志 |
| `events` | `Array[Dictionary]` | `[]` | 基线 | 否 | 当前回合产生的即时回放事件流（供 WEGO 播放器消费） |
| `winner` | `String` | `""` | 基线/S01 | 是 | 获胜方镜像字段（同步自 `victory.winner`） |
| `win_reason` | `String` | `""` | 基线/S01 | 是 | 终局类型镜像字段（同步自 `victory.end_type`） |
| `stats` | `Dictionary` | 见下表 §2.1.1 | 基线/S05 | 是 | 全局战损、断粮饿死与战役统计 |

#### 2.1.1 `state.stats` 权威键结构（对齐 `[E-07]`）
```json
{
  "battles": 0,
  "sieges_won": 0,
  "horses_captured": 0,
  "hexi_lost": 0,
  "han_vassals_peak": 0,
  "han_total_deaths": 0,
  "han_combat_deaths": 0,
  "han_starved_deaths": 0,
  "han_march_deaths": 0,
  "han_deserted": 0,
  "han_casualties": 0,
  "xn_total_deaths": 0,
  "xn_starved_deaths": 0,
  "xn_casualties": 0
}
```

---

### 2.2 节点实体 Schema（`state.nodes[node_id]`，共 42 个节点）

| 字段名 | 类型 | 默认值 / 范围 | 所属模块 | 说明 |
|---|---|---|---|---|
| `id` | `String` | 42 个固定节点 ID | 基线 | 唯一节点标识符（如 `"dun_huang"`, `"lou_lan"`, `"chi_gu"`） |
| `name` | `String` | 中文显示名 | 基线/S01 | 节点显示名（剧本③中 `lun_tai` 显示为 `"轮台（渠犁）"`，`lou_lan` 显示为 `"鄯善（楼兰）"`） |
| `faction` | `String` | `"han"` / `"xiongnu"` / 政权 ID | 基线 | 节点直接占领/归属方 |
| `type` | `String` | `"source"` / `"city"` / `"pass"` / `"nomad"` | 基线 | 节点地形建筑类型 |
| `pos` | `Array[float]` | `[x, y]` | 基线 | 地图坐标 |
| `pop` | `int` | `0..500000` | 基线 | 当前人口/丁口 |
| `pop_cap` | `int` | `int(pop * 1.5)` | 基线 | 人口上限 |
| `grain` | `float` | `0.0..5000000.0` | 基线 | 节点主控方存粮（斛） |
| `depot` | `Dictionary` | `{faction_id: float}` | 基线 | 非节点主控方在该节点寄存的军粮（斛） |
| `horses` | `int` | `0..500000` | 基线/S05 | 节点蓄养战马数 |
| `walls` | `int` | `0..5` | 基线/S03 | 城防等级 |
| `wall_hp` / `wall_hp_max` | `float` | `walls * wall_hp_per_level` | 基线 | 当前城防耐久 / 最大耐久 |
| `farm_cap` / `farm_cap_base` | `int` | 依剧本 | 基线 | 农田/屯田劳力容量上限 |
| `farm_dev` | `float` | `0.0..1.5` | 基线 | 农田开发度（被焚掠时下降） |
| `levied_out` | `int` | `0..pop` | 基线/S05 | 当前在外服役的运粮民夫人数（秋收时从有效劳力中扣除） |
| `colonies` | `int` | `0..farm_cap` | 基线/S05 | 驻耕屯田卒/免刑徒人数（对齐 `[E-08]`） |
| `tuntian_stage` | `int` | `0` \| `1` \| `2` | S05 | `0`=未勘测，`1`=已校猎测地，`2`=已开渠立屯（对齐 `[E-08]`） |
| `tuntian_survey_days` | `int` | `0..30` | S05 | 校猎测地已累计天数（满 30 天升 `tuntian_stage = 1`） |
| `tuntian_founded_tick` | `int` | `-1..9999` | S05 | 首次立屯旬号（用于首年秋收产粮 `×0.5` 判定） |
| `has_well` | `bool` | `true` | S05 | 水源完好标志（1.0 断水围城预留） |
| `militia` | `Dictionary` | `{"infantry":int, "crossbow":int, "cavalry":int}` | 基线 | 城邦/大国本土自卫民兵 |
| `recruited` | `Dictionary` | `{}` | 基线 | 本节点已征募计数 |
| `under_siege_by` | `String` | `""` \| `"han"` \| `"xiongnu"` | 基线 | 当前围城方 |
| `starving` / `starve_streak` | `bool` / `int` | `false` / `0` | 基线 | 城内断粮标志与连续断粮月数 |
| `counts_for_victory` | `bool` | 依剧本 | 基线/S01 | 是否计入胜负核心城池 |
| `semantic_tags` | `Array[String]` | 见第 5 章 §5.6 | S08 | AI 与事件检索使用的节点语义标签集合 |
| `base_strategic_weight` | `float` | `1.2..5.0` | S08 | 节点基础战略价值权重 |

---

### 2.3 古道路段实体 Schema（`state.routes[route_idx]`，共 53 条边）

| 字段名 | 类型 | 默认值 / 范围 | 所属模块 | 说明 |
|---|---|---|---|---|
| `a` / `b` | `String` | 节点 ID | 基线 | 路段两端节点 ID |
| `terrain` | `String` | `"plains"` / `"oasis"` / `"steppe"` / `"desert"` / `"mountain"` / `"hazard"` | 基线 | 路段地形类型 |
| `days` | `float` | `2.0..45.0` | 基线 | 步兵/车队标准通行基准天数（来自 `route_calibration.json`） |
| `mounted_speed_cap` | `float` | `1.0..2.0` | 基线 | 骑兵在该路段的加速上限倍率 |
| `closed_in_winter` | `bool` | `terrain in ["mountain", "hazard"]` | 基线/R-01 | 冬季（11、12、1 月）是否大雪封山禁行 |
| `raided_by` | `String` | `""` \| `"han"` \| `"xiongnu"` | 基线 | 当前在该路段设伏劫掠的势力 |
| `beacon` | `Dictionary` | `{"level": 0, "hp": 0, "owner": "", "status": "none", "build_days_left": 0}` | S05 | 烽燧/亭障状态字典：`status` $\in$ `{"none", "building", "active", "destroyed"}` |

---

### 2.4 军队实体 Schema（`state.armies[army_id]`）

| 字段名 | 类型 | 默认值 | 所属模块 | 说明 |
|---|---|---|---|---|
| `id` | `String` | `"han_1"`, `"xn_1"` 等 | 基线/E-09 | 唯一军队 ID（全项目强制 `String`） |
| `name` | `String` | `"敦煌戍卒"` 等 | 基线 | 军队显示番号 |
| `faction` | `String` | `"han"` \| `"xiongnu"` | 基线 | 所属阵营 |
| `units` | `Dictionary` | `{"infantry":int, "crossbow":int, "cavalry":int, "convict":int, ...}` | 基线/S05 | 兵种人数表（`S05` 新增汉罪人兵键 `"convict"`） |
| `horses` | `int` | `0..100000` | 基线/S05 | 随军战马与驮马数 |
| `dismounted_cav` | `int` | `0` | S05 | 因缺马而下马步战的骑兵人数 |
| `grain` | `float` | `0.0..500000.0` | 基线 | 随军携带军粮（斛） |
| `laborers` | `int` | `0..50000` | 基线 | 随军运粮民夫人数 |
| `loc` | `Dictionary` | `{"node": nid}` 或 `{"route": idx, "from": a, "to": b, "progress": float}` | 基线 | 当前位置（驻守节点或在途路段） |
| `plan` | `Dictionary` | `{"steps": [], "triggers": [], "engage": ["always", 0.0], "preset": "balanced", "step_ticks": 0}` | 基线 | WEGO 作战计划字典 |
| `commander_id` | `String` | `""` | S02/S05 | 绑定的统帅人物 ID（对齐 `[E-09]`，无将领时为 `""`） |
| `forage_policy` | `String` | `"auto"` | S05 | 沿途就食策略：`"auto"` / `"buy"` / `"requisition"` / `"plunder"` / `"none"` |
| `foraged_this_tick` | `Array[String]` | `[]` | S05 | 本旬已执行过沿途供粮的城邦节点 ID 列表 |
| `is_convoy` | `bool` | `false` | 基线/S05 | 是否为运粮车队 |
| `line_id` | `String` | `""` | S05 | 若为自动补给线车队，记录所属 `SupplyLine.id` |
| `leg_idx` | `int` | `-1` | S05 | 若为自动补给线车队，记录所属分段索引 |
| `starving` | `int` | `0` | 基线 | 连续断粮旬数/日数计数 |
| `starved_losses` | `int` | `0` | S05 | 本军建制内累计饿死人数（供战报单列展示） |
| `tribe_id` | `String` | `"chanyu"` | S03 | 匈奴军队所属部族：`"chanyu"` / `"zuoxian"` / `"youxian"` / `"rizhu"` / `"lihu"`（汉军为 `""`） |
| `command_owner` | `String` | `"chanyu"` | S03 | 匈奴军队当前指挥权：`"chanyu"`（玩家/单于直控）/ `"tribe"`（部王自主）/ `"tongpu"`（僮仆税队）；汉军恒为 `"han"` |
| `summon_seasons_left` | `int` | `-1` | S03 | 部族征调军剩余服役季数（`-1` 为本部常备军，`1..4` 为限期征调军） |
| `garrison` | `bool` | `false` | 基线 | 是否为不可移动的地方守备队 |
| `origin` / `prev_node` | `String` | 初始节点 ID | 基线 | 组建地与上一经过节点 |
| `init_size` | `int` | 初始兵力 | 基线 | 初始总兵力 |
| `status` | `String` | `"idle"` | 基线 | 运行状态标签 |
| `trace` / `path` | `Array` | `[]` | 基线 | 移动轨迹与寻路缓存 |

---

### 2.5 后勤补给线与迷雾情报实体 Schema（`S05`）

#### 2.5.1 `SupplyLine`（存于 `state.supply_lines[line_id]`）
| 字段名 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `id` | `String` | `"line_1"` | 补给线唯一 ID |
| `faction` | `String` | `"han"` | 所属势力（`"han"` / `"xiongnu"`） |
| `source` | `String` | `"chang_an"` 等 | 起点粮仓节点 ID |
| `terminus` | `String` | `"dun_huang"` 等 | 终点前线节点 ID |
| `priority` | `int` | `2` | 优先级：`1`（低）/ `2`（中）/ `3`（高） |
| `target_months` | `float` | `6.0` | 终点目标储备月数（`1.0..12.0`） |
| `reserve_months` | `float` | `3.0` | 中继站最低保留月数（`1.0..6.0`） |
| `max_laborers` | `int` | `10000` | 该线允许征调民夫上限（`0..50000`） |
| `escort_army_id` | `String` | `""` | 绑定护粮野战军 ID |
| `ignore_danger` | `bool` | `false` | 是否无视劫掠强行发车 |
| `status` | `String` | `"active"` | `"active"` / `"throttled"` / `"paused_danger"` / `"cut"` / `"orphan"` |
| `legs` | `Array[Dictionary]` | `[]` | 分段数组：`[{from, to, route_ids, assigned_laborers, desired_flow_month, delivered_30d}]` |
| `losses_30d` | `int` | `0` | 近 30 日被劫毁车队数（`>=2` 且 `!ignore_danger` 时自动置 `"paused_danger"`） |

#### 2.5.2 `IntelEstimate`（存于 `state.intel_estimates[viewer_faction][est_id]`）
| 字段名 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `est_id` | `String` | `"est_han_1"` | 观测记录唯一 ID |
| `true_army_id` | `String` | `"xn_1"` | **内部私有字段**：仅供 `Fog` 合并同源观测，`Fog.get_perceived_state` 导出时强制剥离 |
| `faction` | `String` | `"xiongnu"` | 被观测敌军所属阵营 |
| `loc` | `Dictionary` | `{"node": nid}` | 最后观测位置 |
| `heading_to` | `String` | `""` | 观测到的行军方向节点 ID |
| `level` | `int` | `2` | 情报精度等级：`1`（传闻 ±45%）/ `2`（斥候/烽燧 ±25%）/ `3`（接战/内应 ±10%）/ `4`（精确） |
| `est_size` / `size_min` / `size_max` | `int` | 估算值 | 兵力点估计值与上下界区间（受难度乘数 `0.5x / 1.0x / 1.25x` 调节） |
| `unit_class` | `String` | `"mounted"` | `"mounted"` / `"foot"` / `"mixed"` / `"convoy"` |
| `seen_day` / `reported_day` | `int` | 绝对日数 | 采样发生日与信使/烽火送达日 |
| `source_type` | `String` | `"beacon"` | `"garrison"` / `"beacon"` / `"scout"` / `"vassal"` / `"envoy"` / `"decoy"` |
| `is_decoy` / `departed` | `bool` | `false` | 是否为疑兵假情报 / 原驻地是否已拔营离去 |

---

### 2.6 胜负与功业系统状态 Schema（`state.victory`，归属 `S01`）

| 字段名 | 类型 | 初值 | 说明 |
|---|---|---|---|
| `victory_mode` | `String` | `"standard"` | `"standard"`（剧本②③功业/威服制）\| `"objectives"`（剧本①专项任务制） |
| `han_merit` | `int` | 依开局重算 | 汉都护府功业总值 $G \in [-60, 200]$ |
| `han_merit_breakdown` | `Dictionary` | `{}` | `{"vassal":int, "enfeoff":int, "hub":int, "tuntian":int, "suppress":int, "great":int, "tongpu":int, "event_pool":float, "permanent":int, "hexi_penalty":int, "petition_boost":int, "total":int}` |
| `han_merit_pool` | `float` | `0.0` | 汉可衰减事件战功池 $[-20.0, 30.0]$ |
| `han_permanent_merit` | `int` | `0` | 汉不衰减永久勋值 $[0, 40]$（兼容 `S06` 别名 `permanent_deed`） |
| `han_hold_months` / `han_hold_peak` | `int` | `0` | 汉立府维持月数 / 历史最高维持月数 $[0, 24]$ |
| `han_merit_peak` | `int` | `0` | 汉历史最高功业峰值 |
| `petition_boost_seasons` | `int` | `0` | `petition_establish_protectorate` 冲线临时 `+10` 功业剩余季数 |
| `xn_weifu` | `int` | 依开局重算 | 匈奴威服总值 $W \in [-40, 200]$ |
| `xn_weifu_breakdown` | `Dictionary` | `{}` | `{"hexi":int, "vassal":int, "hub":int, "tongpu":int, "prestige":int, "event_pool":float, "sacred_penalty":int, "total":int}` |
| `xn_weifu_pool` | `float` | `0.0` | 匈奴可衰减战功池 $[-20.0, 25.0]$ |
| `xn_hexi_hold_months` | `int` | `0` | 匈奴路径 A（全占河西四郡）维持月数 $[0, 12]$ |
| `xn_weifu_hold_months` | `int` | `0` | 匈奴路径 B（威服西域 $W \ge 100$）维持月数 $[0, 12]$ |
| `xn_weifu_peak` | `int` | `0` | 匈奴威服历史峰值 |
| `xn_scatter_streak_quarters` | `int` | `0` | 匈奴诸部离散连续季数（同步自 `state.tribes.scatter_consecutive_turns`） |
| `yearly_award_counts` | `Dictionary` | `{"han_battle":0, "xn_battle":0}` | 当年野战战功触发次数（岁末清零） |
| `milestones_fired` | `Dictionary` | `{"han_50":false,"han_80":false,"han_100":false,"xn_50":false,"xn_80":false,"xn_100":false}` | 里程碑播报标记 |
| `objective_progress` | `Dictionary` | `{}` | 剧本①专项任务进度 |
| `key_events_occurred` | `Array[String]` | `[]` | 已发生的核心历史事件短标签列表（限定 8 种标准短标签，见 `[E-27]`） |
| `lead_changes_count` / `prev_leader` | `int` / `String` | `0` / `""` | 领先方易手次数与上季领先方 |
| `baseline_han_pop` / `baseline_xn_pop` / `baseline_xn_horses` | `int` | 开局快照 | 用于到期连续计分的人口与蓄马基线 |
| `is_game_over` | `bool` | `false` | 对局是否已结束 |
| `winner` | `String` | `""` | `""` \| `"han"` \| `"xiongnu"` \| `"draw"` |
| `end_type` | `String` | `""` | `"HAN_MAIN"` \| `"XN_MAIN_HEXI"` \| `"XN_MAIN_WEIFU"` \| `"HAN_RECALL"` \| `"XN_SCATTER"` \| `"MUTUAL_COLLAPSE"` \| `"EXPIRY_HAN"` \| `"EXPIRY_XN"` \| `"EXPIRY_DRAW"` |
| `victory_path` | `String` | `""` | 主导路径标签 |
| `han_final_score` / `xn_final_score` | `float` | `0.0` | 终局综合得分 $[0.0, 120.0]$ |
| `han_grade` / `xn_grade` | `String` | `""` | 汉五档（`"G1_FENGHOU"`~`"G5_ZUZHU"`）/ 匈五档（`"X1_LONGCHENG"`~`"X5_SHENSI"`） |
| `end_signature` / `end_signature_coarse` | `String` | `""` | 细粒度终局签名 / 粗粒度终局签名 |

---

### 2.7 汉廷与诏令系统状态 Schema（`state.court`，归属 `S02`）

| 字段名 | 类型 | 初值（漠北/楼兰/都护） | 说明 |
|---|---|---|---|
| `trust` | `int` | `55 / 65 / 60` | 朝廷信任值 `0..100` |
| `trust_band` | `String` | `"normal"` | `"recall"` \| `"harsh"` \| `"jianjun"` \| `"normal"` \| `"bianyi"` |
| `band_seasons` / `idle_seasons` | `int` | `0` / `0` | 当前信任档位持续季数 / 连续无功季数 |
| `wind_id` | `String` | `"wudi_early" / "wudi_early" / "xuandi"` | 朝廷风向 ID：`"wudi_early"` \| `"luntai"` \| `"huoguang"` \| `"xuandi"`（对齐 `[E-06]`） |
| `wind_seasons` | `int` | `0` | 当前风向持续季数 |
| `emperor_regret` | `int` | `0 / 15 / 0` | 武帝悔意值 `0..150`（`>=80` 触发轮台罪己诏，对齐 `[E-02]`） |
| `luntai_decreed` | `bool` | `false` | 轮台罪己诏是否已颁布 |
| `expedition_lock_seasons` | `int` | `0` | 远征类诏令冻结剩余季数 |
| `treasury_strain` | `int` | `10 / 25 / 15` | 朝廷财匮度 `0..100` |
| `precedent` | `int` | `0 / 0 / 1` | 矫诏次数计数 `0..10`（对齐 `[E-05]`） |
| `precedent_resistance` | `int` | `35 / 20 / 15` | 封侯朝议阻力值 `0..100`（`>=45` 或 `precedent>=3` 触发功大不封，对齐 `[E-05]`） |
| `unpardoned_forged_edict` | `bool` | `false` | 是否有未赦免的矫诏案底（决定召还时下狱还是族诛，对齐 `[E-05]`） |
| `recall_active` | `bool` | `false` | 是否有《槛车召还令》在途或待决（为 `true` 时冻结 `han_hold_months`） |
| `recall_finalized` | `bool` | `false` | 召还令是否已送达且未戴罪立功（为 `true` 时触发 `HAN_RECALL` 战败） |
| `central_quota_remaining` | `int` | `3500` | 本季剩余可征调中央军人数额度 |
| `tribute_horses_year` / `tribute_treasure_year` | `int` | `0` / `0` | 本年已献天马数（上限 `1000`）/ 已献方物次数（上限 `2`） |
| `redeem_used` / `redeem_deadline_tick` | `bool` / `int` | `false` / `-1` | 戴罪立功是否已使用 / 戴罪立功截止 Tick |
| `office_title` | `String` | `"envoy" / "envoy" / "colonel"` | 持节官职：`"envoy"`（使者）\| `"colonel"`（校尉）\| `"protector"`（都护） |
| `holder_char_id` / `acting_holder_char_id` | `String` | `"han_zhang_qian"` 等 / `""` | 当前正式持节人物 ID / 代理持节人物 ID |
| `jianjun_char_id` | `String` | `""` | 在任监军御史人物 ID |
| `cd_request_funds` / `cd_request_troops` / `cd_request_general` | `int` | `0` | 请款 / 请兵 / 请将冷却剩余季数 |
| `princess_married` | `bool` | `false` | 是否已派出和亲公主 |
| `court_snapshot` | `Dictionary` | 开局真实状态拷贝 | 长安朝廷延迟认知快照 |
| `edict_cooldowns` | `Dictionary` | `{}` | `{template_id: int}` 诏令模板冷却表 |
| `documents` | `Array[Dictionary]` | `[]` | 在途与议处中文书实体数组（`Document` Schema 见 `S02 §3.2`） |
| `active_edicts` | `Array[Dictionary]` | `[]` | 诏令运行实例数组（`ActiveEdict` Schema 见 `S02 §3.3`） |

---

### 2.8 匈奴部族联盟状态 Schema（`state.tribes`，归属 `S03`）

| 字段名 | 类型 | 初值（剧本②） | 说明 |
|---|---|---|---|
| `chanyu_prestige` | `int` | `35`（①`55` / ③`40`） | 单于威望 `0..100` |
| `reward_pool` | `int` | `1000` | 单于赏赐池（与 `state.factions["xiongnu"].money` 强同步） |
| `chanyu_id` | `String` | `"xn_yizhixie"` | 在位单于人物 ID |
| `chanyu_age` / `chanyu_wounds` | `int` | `50` / `10` | 单于年龄 / 累计伤病值 `0..100` |
| `chanyu_in_field` / `chanyu_army_id` | `bool` / `String` | `false` / `""` | 单于是否亲征中 / 亲征所在军队 ID（`String`，对齐 `[E-09]`） |
| `designated_heir_id` / `promised_successor_id` | `String` | `"xn_wuwei"` / `""` | 册立储君人物 ID / 叔死弟袭承诺继位者 ID |
| `succession_crisis_turns` | `int` | `0` | 继承危机剩余季数 `0..8`（`>0` 时 `in_succession_crisis` 为真） |
| `last_reward_alloc` | `Dictionary` | `{"zuoxian":240,"youxian":360,"rizhu":160,"lihu":120}` | 上季分赏金额快照 |
| `autumn_target_node` | `String` | `""` | 秋季蹛林大会钦定主攻节点 ID |
| `longcheng_desecrated` | `bool` | `false` | 龙城本年是否被汉军攻陷或焚毁 |
| `tongpu_active` | `bool` | `true` | 僮仆都尉是否在位运作 |
| `tongpu_char_id` / `tongpu_army_id` | `String` | `"xn_tongpu_duwei"` / `"xn_tongpu_escort"` | 僮仆都尉人物 ID / 护卫军 ID（`String`） |
| `tongpu_cargo_money` | `int` | `0` | 僮仆都尉护卫军当前在途携带税银 |
| `tongpu_patrol_route` | `Array[String]` | `["yan_qi","wei_li","wu_lei","lun_tai","cheshi_qian"]` | 僮仆都尉巡行收税路线 |
| `tongpu_cooldown_turns` | `int` | `0` | 僮仆都尉被击溃后的复置冷却季数 |
| `white_collapse_turns` / `last_disaster_severity` | `int` / `String` | `0` / `"none"` | 白灾羁属瓦解剩余季数 / 上次白灾等级（`"none"`\|`"mild"`\|`"severe"`） |
| `scatter_consecutive_turns` | `int` | `0` | 连续满足诸部离散条件的季数（`>=2` 触发 `XN_SCATTER`） |
| `active_tactic_card` | `String` | `""` | 本季激活的战术卡 ID |
| `candidate_tactic_cards` | `Array[String]` | 3 张候选卡 | 本季可选的 3 张战术卡 ID |
| `tactic_cooldowns` | `Dictionary` | `{card_id: int}` | 5 张战术卡各自的剩余冷却季数 |
| `units` | `Dictionary` | `{tribe_id -> TribeUnitDict}` | **四大部领字典**，固定键：`"zuoxian"`, `"youxian"`, `"rizhu"`, `"lihu"`（对齐 `[E-03]`） |

> **四部对象 `state.tribes.units[tribe_id]` 字段**：`id: String`, `name: String`, `seat_node: String`, `leader_id: String`, `personality: String`, `rank_mult: float`, `loyalty: int (0..100)`, `loyalty_exact: bool`, `loyalty_estimated: int`, `status: String ("normal"|"rebellious"|"defected_han")`, `wavering_turns_left: int (0..9)`, `wavering_detected: bool`, `grievance: int (0..100)`, `missed_assemblies: int`, `season_reward_received: int`, `levied_riders: int`, `levied_seasons_count: int`, `restrained_this_season: bool`, `preferred_targets: Array[String]`。

---

### 2.9 城邦外交与使团状态 Schema（`state.relations` & `state.missions`，归属 `S04`）

#### 2.9.1 `state.relations[state_id]`（共 23 国：18 城邦 + 5 大国）
| 字段名 | 类型 | 初值 | 说明 |
|---|---|---|---|
| `state` | `String` | 政权 ID | 18 城邦 ID 或 5 大国 ID（`"wusun"`, `"dawan"`, `"kangju"`, `"dayuezhi"`, `"jibin"`，对齐 `[E-24]`） |
| `overlord` | `String` | `""` \| `"han"` \| `"xiongnu"` | 当前宗主国（两属国保持 `overlord = "xiongnu"` 且 `is_dual = true`） |
| `han_tier` | `String` | `"none"` \| `"enfeoffed"` \| `"vassal"` \| `"puppet"` | 汉方外交层级（向后兼容镜像 `han_status = han_tier`） |
| `xn_tier` | `String` | `"none"` \| `"vassal"` | 匈奴外交层级 |
| `is_dual` | `bool` | `false` | 是否处于汉匈「两属」状态 |
| `han_enfeoffed` / `hostage_sent_han` | `bool` | `false` / `false` | 是否获汉印绶册封（`+2` 功业）/ 是否已遣质子入侍汉廷 |
| `han_influence` / `xn_intimidation` | `float` | `0.0..100.0` | 汉影响力 $I$ / 匈奴威吓 $X$ |
| `xn_resentment` / `han_resentment` | `float` | `0.0..100.0` | 对匈奴怨恨 $R_{\text{xn}}$ / 对汉怨恨 $R_{\text{han}}$ |
| `han_awe` / `tilt` | `float` | `0.0..100.0` / `-100.0..100.0` | 汉军军威 $A_{\text{han}}$ / 综合政治倾向 $\text{Tilt}$ |
| `pro_han` / `pro_xn` / `geo_bias` | `float` | 依剧本 | 王室亲汉派权重 / 亲匈派权重 / 地缘距离偏置 |
| `satiation` | `int` | `0` | 汉使馈赠饱足计数 `0..10`（每季 `-1`） |
| `trade_banned` / `ban_lock_seasons` | `bool` / `int` | `false` / `0` | 是否禁绝汉商 / 禁商最短维持剩余季数 |
| `wavering_action` | `String` | `""` | 城邦一季动摇预警拟执行动作 |
| `tier_lock_seasons` / `expel_cooldown_seasons` / `sacked_memory_seasons` | `int` | `0` | 层级锁定季数 / 逐使冷却季数 / 屠城记忆季数 |
| `crimes_against_han` / `crimes_against_xn` | `Array[Dictionary]` | `[]` | `CrimeRecord` 数组：`[{id, type, weight, created_tick, expires_season, context}]`（对齐 `[E-11]`） |
| `punitive_war` | `Dictionary` | `{}` | 空或 `{attacker, justification, authority, policy, last_active_season}` |
| `supply_stance` / `supply_quota_monthly` | `String` / `int` | `"MARKET"` / `0` | 对汉供粮姿态（`"WELCOME"`\|`"MARKET"`\|`"CLOSED"`）/ 月度可供粮配额（斛） |
| `marriage_han` / `horse_tribute_han` | `bool` | `false` | 乌孙和亲生效标记 / 大宛岁献天马标记 |
| `xn_tax` / `tax_seasons_uncollected` | `int` | `2` / `1` | 匈奴岁币税档（`0..3`）/ 距上次僮仆都尉收税季数（`0..2`，来自 `S03`） |

#### 2.9.2 `state.missions[mission_id]`（在途/驻留汉使团实体）
字段：`id: String`, `faction: String ("han")`, `kind: String ("elite"|"recruited"|"deputy")`, `character_id: String`, `current_node: String`, `route_nodes: Array[String]`, `edge_days_progress: float`, `targets: Array[Dictionary] ([{state_id, budget, objective, visited}])`, `remaining_budget: int`, `status: String ("outbound"|"at_court"|"resident"|"returning"|"completed"|"destroyed")`, `stay_days_left: int`, `deputy_slots_left: int`。

---

### 2.10 人物与叙事事件状态 Schema（`state.characters` & `state.event_state`，归属 `S06`）

#### 2.10.1 `state.characters[char_id]`（对齐 `R-02`、`[E-10]`）
| 字段名 | 类型 | 初值 / 范围 | 说明 |
|---|---|---|---|
| `id` / `name_zh` / `courtesy_title` | `String` | 必填 | 唯一人物 ID / 中文姓名 / 官爵称号 |
| `faction` / `home_state` | `String` | `"han"`\|`"xiongnu"`\|`"citystate"` | 所属阵营 / 西域人物母国 ID |
| `role_tags` | `Array[String]` | 角色标签 | `"holder"`, `"general"`, `"envoy"`, `"tuntian"`, `"censor"`, `"chanyu"`, `"tribe_king"`, `"tongpu"`, `"king"`, `"princess"` |
| `birth_year` / `appear_year` / `death_year` | `int` | 公元前负数 | 生年 / 登场年 / 史实基准卒年 |
| `health` | `int` | `100` (`0..100`) | 健康值（`<=0` 病逝） |
| `status` | `String` | `"active"` 等 | `"unborn"` / `"active"` / `"in_transit"` / `"imprisoned"` / `"defected"` / `"dead"` |
| `at_node` | `String` | 节点 ID | 当前所在节点 ID |
| `locked_action` | `String` | `""` | `""` \| `"mission"` \| `"army"` \| `"tuntian"` \| `"in_transit"`（对齐 `[E-10]`） |
| `assigned_to` | `String` | `""` | 绑定的军队 ID / 使团 ID / 节点 ID（对齐 `[E-10]`） |
| `command` / `valor` / `eloquence` / `caution` | `int` | `0..100` | 四维能力值（`command_tier = int(round(command / 10.0))` 动态计算导出，对齐 `R-02`） |
| `ambition_marquis` / `resentment` | `int` | `0..100` | 封侯执念 / 个人怨望 |
| `marquis_tier` | `int` | `0..2` | `0`=无侯爵，`1`=关内侯，`2`=列侯 |
| `is_jie_holder` / `deputy_has_jie` | `bool` | `false` | 是否为正式持节主使 / 是否获分节予副使 |
| `traits` | `Array[String]` | 2 个特性 Tag | 人物特性 ID 数组（见第 5 章 §5.3） |
| `ai_personality` | `String` | 性格 ID | 当该人物担任主帅/单于时映射的 `S08` 性格 ID（对齐 `[S08→S06]`） |
| `is_generated` / `deeds_log` | `bool` / `Array[String]` | `false` / `[]` | 是否为候补池生成人物 / 生平功过日志（供终局附传拼装） |

#### 2.10.2 `state.event_state`（叙事事件引擎状态）
| 字段名 | 类型 | 初值 | 说明 |
|---|---|---|---|
| `fired_once` | `Array[String]` | `[]` | 已触发过的 `once == true` 事件 ID 列表 |
| `cooldowns` | `Dictionary` | `{evt_id: int}` | 事件剩余冷却季数 |
| `pending_queue` | `Array[Dictionary]` | `[]` | 当前待玩家/AI 抉择的季初弹窗事件队列（每季上限 2 条） |
| `scheduled_chain_events` | `Array[Dictionary]` | `[]` | `[{evt_id, due_season, ctx}]` 定时唤醒的后续事件链队列 |
| `chain_flags` | `Dictionary` | `{flag: Variant}` | 跨回合事件链布尔/数值标记 |
| `major_events_count` / `last_major_event_season` | `int` | `0` / `-10` | 本局已触发重大事件数 / 上次重大事件季号（对齐 `S01-R12`） |
| `rizhu_surrender_window` | `int` | `0` | 日逐王请降后汉军迎降剩余旬数（`0..12`） |

---

### 2.11 AI 记忆黑板与 UI 教学状态 Schema（`state.ai_blackboard` & `state.ui_meta`，归属 `S08` / `S07`）

- **`state.ai_blackboard[faction]`**（`faction` $\in$ `{"han", "xiongnu"}`）：
  `personality_id: String`, `strategic_phase: int (1..3)`, `active_grand_path: String ("path_a_hexi"|"path_b_weifu"|"stabilize_tribes")`, `committed_target_id: String`, `commitment_ttl: int (0..4)`, `target_fail_counts: Dictionary`, `target_cooldown_until: Dictionary`, `last_seen_enemy_main: Dictionary`, `supply_line_slots: Array[String]`, `bait_envoy_cooldown: Dictionary`, `last_reward_ratios: Dictionary`, `staged_rally_node: String`。
- **`state.ui_meta`**：
  `active_tab: String`, `map_layers: Dictionary`, `sel_node: String`, `sel_army: String`, `drafts: Dictionary`, `log_filter: Dictionary`, `diplo_sort: Dictionary`, `tutorial: {"active": bool, "lesson_idx": int, "step_idx": int, "seen_starvation_preview": bool}`。

---

## 第 3 章：全命令（Commands）权威签名注册表（`core/commands.gd`）

> **圣经 L9 铁律**：玩家 UI（`S07`）、汉匈 AI（`S08`）以及 CLI 文字试玩器（`S09`）100% 共用 `Commands.make(type, faction, params)`、`Commands.validate(state, cmd) -> String`（返回 `""` 表示合法，非空为错误码）与 `Commands.apply(state, cmd) -> void`。

### 3.1 胜负与叙事通用命令表（`S01` & `S06`，共 6 条）

| 命令 `type`（及兼容别名） | 适用势力 | 参数字典 Schema (`cmd`) | 校验委派函数 | 执行委派函数 | 标准失败返回码 |
|---|---|---|---|---|---|
| `petition_establish_protectorate` | `"han"` | `{"envoy_id": String}` | `Victory.validate_petition(state, cmd)` | `Victory.apply_petition(state, cmd)` | `ERR_WRONG_MODE`, `ERR_MERIT_OUT_OF_RANGE`, `ERR_LOW_TRUST`, `ERR_ENVOY_NOT_AT_HUB`, `ERR_INSUFFICIENT_MONEY`, `ERR_ON_COOLDOWN` |
| `concede_scenario` | `"han"` \| `"xiongnu"` | `{"reason": String = ""}` | `Victory.validate_concede(state, cmd)` | `Victory.apply_concede(state, cmd)` | `ERR_ALREADY_OVER`, `ERR_TOO_EARLY` |
| `resolve_event_option` | `"han"` \| `"xiongnu"` | `{"evt_id": String, "opt_id": String}` | `EventEngine.validate_option(state, cmd)` | `EventEngine.apply_option(state, cmd)` | `ERR_EVT_NOT_PENDING`, `ERR_OPT_INVALID`, `ERR_OPT_REQ_UNMET` |
| `assign_character` | `"han"` \| `"xiongnu"` | `{"char_id": String, "target_type": "army"\|"mission"\|"node", "target_id": String}` | `Characters.validate_assign(state, cmd)` | `Characters.apply_assign(state, cmd)` | `ERR_CHAR_NOT_ACTIVE`, `ERR_CHAR_NODE_MISMATCH`, `ERR_CHAR_ALREADY_BUSY` |
| `rotate_reserve_character` | `"han"` | `{"retire_char_id": String, "activate_char_id": String}` | `Characters.validate_rotate(state, cmd)` | `Characters.apply_rotate(state, cmd)` | `ERR_CHAR_IN_FIELD`, `ERR_ROTATE_LIMIT_REACHED` |
| `export_endgame_share_card` | `"han"` \| `"xiongnu"` | `{"format": "png_1080x1920"\|"markdown"}` | `BiographyGenerator.validate_export(state, cmd)` | `BiographyGenerator.apply_export(state, cmd)` | `ERR_GAME_NOT_OVER` |

---

### 3.2 汉廷与诏令专属命令表（`S02`，共 13 条）

| 命令 `type`（及兼容别名） | 适用势力 | 参数字典 Schema (`cmd`) | 校验委派函数 | 执行委派函数 | 标准失败返回码 |
|---|---|---|---|---|---|
| `respond_edict` | `"han"` | `{"instance_id": String, "action": "accept"\|"bargain"\|"decline", "ask_items": Array[String] = [], "reason_tags": Array[String] = []}`（兼容键 `edict_id`） | `Court.validate_respond_edict(state, cmd)` | `Court.apply_respond_edict(state, cmd)` | `ERR_EDICT_NOT_FOUND`, `ERR_EDICT_INVALID_STATE`, `ERR_EDICT_MANDATORY`, `ERR_BARGAIN_LIMIT_REACHED` |
| `forge_edict`<br>*(别名: `forged_edict_action`)* | `"han"` | `{"forge_type": "unauthorized_attack"\|"levy_hexi_troops"\|"levy_allied_troops", "target_id": String, "self_impeach": bool = true}`（兼容键 `target`） | `Court.validate_forge_edict(state, cmd)` | `Court.apply_forge_edict(state, cmd)` | `ERR_HOLDER_TOO_FAR`, `ERR_ALREADY_AUTHORIZED`, `ERR_NO_ALLIED_STATES_NEARBY`, `ERR_VETOED_BY_JIANJUN` |
| `request_funds`<br>*(兼容 `submit_memorial`)* | `"han"` | `{"tier": int(1\|2\|3)}`（对应 `1000 / 2000 / 3500` 钱） | `Court.validate_request_funds(state, cmd)` | `Court.apply_request_funds(state, cmd)` | `ERR_REQUEST_ON_COOLDOWN`, `ERR_MEMORIAL_IN_TRANSIT` |
| `request_troops`<br>*(兼容 `submit_memorial`)* | `"han"` | `{"tier": int(1\|2\|3)}`（对应 `2000 / 4000 / 7000` 人 + `500 / 1000 / 2000` 马） | `Court.validate_request_troops(state, cmd)` | `Court.apply_request_troops(state, cmd)` | `ERR_REQUEST_ON_COOLDOWN`, `ERR_BAND_FORBIDS_TROOP_REQ`, `ERR_MEMORIAL_IN_TRANSIT` |
| `request_character`<br>*(兼容 `submit_memorial`)* | `"han"` | `{"role_pref": "general"\|"envoy"\|"tuntian"}` | `Court.validate_request_character(state, cmd)` | `Court.apply_request_character(state, cmd)` | `ERR_CHAR_CAP_FULL`, `ERR_REQUEST_ON_COOLDOWN` |
| `request_princess`<br>*(兼容 `submit_memorial`)* | `"han"` | `{"target_state": String = "wusun"}` | `Court.validate_request_princess(state, cmd)` | `Court.apply_request_princess(state, cmd)` | `ERR_PRINCESS_ALREADY_SENT`, `ERR_WUSUN_INFLUENCE_LOW`, `ERR_TRUST_TOO_LOW` |
| `send_tribute` | `"han"` | `{"tribute_type": "horses"\|"treasure", "origin_node": String, "amount": int}` | `Court.validate_send_tribute(state, cmd)` | `Court.apply_send_tribute(state, cmd)` | `ERR_INSUFFICIENT_HORSES`, `ERR_INSUFFICIENT_MONEY`, `ERR_ANNUAL_TRIBUTE_CAP` |
| `relocate_character` | `"han"` | `{"char_id": String, "target_node": String}`（兼容键 `character_id`, `to_node`） | `Court.validate_relocate_character(state, cmd)` | `Court.apply_relocate_character(state, cmd)` | `ERR_CHAR_LOCKED`, `ERR_INVALID_TARGET_NODE` |
| `assign_general`<br>*(别名: `assign_commander`)* | `"han"` \| `"xiongnu"` | `{"army_id": String, "char_id": String}`（传 `""` 为卸任；兼容键 `army`, `character_id`） | `Court.validate_assign_general(state, cmd)` | `Court.apply_assign_general(state, cmd)` | `ERR_CHAR_NOT_AT_ARMY_NODE`, `ERR_CHAR_LOCKED`, `ERR_CANNOT_UNASSIGN_IN_FIELD` |
| `grant_deputy_jie` | `"han"` | `{"deputy_char_id": String, "grant": bool}` | `Court.validate_grant_deputy_jie(state, cmd)` | `Court.apply_grant_deputy_jie(state, cmd)` | `ERR_NOT_IN_BIANYI_BAND`, `ERR_DEPUTY_TOO_FAR` |
| `override_jianjun` | `"han"` | `{"blocked_cmd_id": String}` | `Court.validate_override_jianjun(state, cmd)` | `Court.apply_override_jianjun(state, cmd)` | `ERR_NO_PENDING_VETO` |
| `redeem_at_zero_trust` | `"han"` | `{"method": "pay_money"\|"accept_death_edict"}` | `Court.validate_redeem(state, cmd)` | `Court.apply_redeem(state, cmd)` | `ERR_REDEEM_NOT_AVAILABLE`, `ERR_INSUFFICIENT_MONEY` |
| `handle_rogue_general` | `"han"` | `{"char_id": String, "decision": "execute_by_law"\|"cover_up"}` | `Court.validate_handle_rogue(state, cmd)` | `Court.apply_handle_rogue(state, cmd)` | `ERR_NO_ROGUE_EVENT` |

---

### 3.3 匈奴王庭、部族与战术卡命令表（`S03`，共 16 条）

| 命令 `type`（及兼容别名） | 适用势力 | 参数字典 Schema (`cmd`) | 校验委派函数 | 执行委派函数 | 标准失败返回码 |
|---|---|---|---|---|---|
| `distribute_rewards` | `"xiongnu"` | `{"alloc": Dictionary}`（`{zuoxian:int, youxian:int, rizhu:int, lihu:int}`；兼容键 `allocations`） | `Tribes.validate_distribute_rewards(state, cmd)` | `Tribes.apply_distribute_rewards(state, cmd)` | `ERR_INSUFFICIENT_POOL`, `ERR_TRIBE_DEFECTED` |
| `summon_tribe_army`<br>*(别名: `levy_tribe`)* | `"xiongnu"` | `{"tribe_id": String, "riders": int}` | `Tribes.validate_summon_tribe_army(state, cmd)` | `Tribes.apply_summon_tribe_army(state, cmd)` | `ERR_LOW_LOYALTY`, `ERR_EXCEED_LEVY_CAP`, `ERR_NO_HORSES`, `ERR_INSUFFICIENT_POOL` |
| `release_tribe_army` | `"xiongnu"` | `{"army_id": String}` | `Tribes.validate_release_tribe_army(state, cmd)` | `Tribes.apply_release_tribe_army(state, cmd)` | `ERR_INVALID_ARMY` |
| `assembly_decision`<br>*(别名: `select_assembly_option`)* | `"xiongnu"` | `{"meeting_type": "new_year"\|"longcheng"\|"dailin", "option_id": String, "target_node": String = "", "extra_sacrifice": bool = false}` | `Tribes.validate_assembly_decision(state, cmd)` | `Tribes.apply_assembly_decision(state, cmd)` | `ERR_NOT_ASSEMBLY_SEASON`, `ERR_LONGCHENG_LOST`, `ERR_INSUFFICIENT_POOL` |
| `designate_heir` | `"xiongnu"` | `{"candidate_id": String, "is_lateral_promise": bool = false}` | `Tribes.validate_designate_heir(state, cmd)` | `Tribes.apply_designate_heir(state, cmd)` | `ERR_ONLY_NEW_YEAR`, `ERR_INVALID_CANDIDATE` |
| `restrain_tribe`<br>*(别名: `suppress_tribe`)* | `"xiongnu"` | `{"tribe_id": String}` | `Tribes.validate_restrain_tribe(state, cmd)` | `Tribes.apply_restrain_tribe(state, cmd)` | `ERR_PRESTIGE_TOO_LOW`, `ERR_INSUFFICIENT_POOL` |
| `pacify_wavering_tribe` | `"xiongnu"` | `{"tribe_id": String}` | `Tribes.validate_pacify_wavering(state, cmd)` | `Tribes.apply_pacify_wavering(state, cmd)` | `ERR_NOT_WAVERING`, `ERR_INSUFFICIENT_POOL` |
| `replace_tribe_leader` | `"xiongnu"` | `{"tribe_id": String, "new_leader_id": String}` | `Tribes.validate_replace_leader(state, cmd)` | `Tribes.apply_replace_leader(state, cmd)` | `ERR_NEED_GARRISON_OR_PRESTIGE`, `ERR_INSUFFICIENT_POOL` |
| `reappoint_tongpu_duwei` | `"xiongnu"` | `{"base_node": "yan_qi"\|"cheshi_qian", "escort_riders": int = 1500}` | `Tribes.validate_reappoint_tongpu(state, cmd)` | `Tribes.apply_reappoint_tongpu(state, cmd)` | `ERR_COOLDOWN_ACTIVE`, `ERR_RIZHU_DEFECTED`, `ERR_BASE_LOST` |
| `set_tongpu_route` | `"xiongnu"` | `{"route_nodes": Array[String]}` | `Tribes.validate_set_tongpu_route(state, cmd)` | `Tribes.apply_set_tongpu_route(state, cmd)` | `ERR_TONGPU_INACTIVE`, `ERR_INVALID_NODES` |
| `slaughter_horses_for_grain` | `"xiongnu"` | `{"node_id": String, "horses_count": int}` | `Tribes.validate_slaughter_horses(state, cmd)` | `Tribes.apply_slaughter_horses(state, cmd)` | `ERR_NOT_ENOUGH_HORSES` |
| `relieve_white_disaster` | `"xiongnu"` | `{"relief_tier": "mild"\|"severe"}`（兼容键 `tier`） | `Tribes.validate_relieve_disaster(state, cmd)` | `Tribes.apply_relieve_disaster(state, cmd)` | `ERR_NO_DISASTER`, `ERR_INSUFFICIENT_POOL` |
| `select_tactic_card`<br>*(别名: `play_tactic_card`)* | `"xiongnu"` | `{"card_id": String, "target_route_or_node": Variant = ""}`（兼容键 `target`） | `Tribes.validate_select_tactic(state, cmd)` | `Tribes.apply_select_tactic(state, cmd)` | `ERR_CARD_NOT_AVAILABLE`, `ERR_PRECONDITION_FAILED` |
| `toggle_chanyu_personal_command` | `"xiongnu"` | `{"army_id": String, "enable": bool}` | `Tribes.validate_personal_command(state, cmd)` | `Tribes.apply_personal_command(state, cmd)` | `ERR_NOT_CHANYU_ARMY` |
| `recruit_nomad` | `"xiongnu"` | `{"node_id": String, "count": int}` | `Tribes.validate_recruit_nomad(state, cmd)` | `Tribes.apply_recruit_nomad(state, cmd)` | `ERR_MUST_USE_TRIBE_SUMMON`, `ERR_NO_HORSES` |
| `fortify_stock_city` | `"xiongnu"` | `{"node_id": "zhaoxin_cheng"\|"fanfuren_cheng"}` | `Tribes.validate_fortify_stock(state, cmd)` | `Tribes.apply_fortify_stock(state, cmd)` | `ERR_MAX_WALLS`, `ERR_INSUFFICIENT_POOL` |

---

### 3.4 城邦与大国外交命令表（`S03` & `S04`，共 18 条）

| 命令 `type`（及兼容别名） | 适用势力 | 参数字典 Schema (`cmd`) | 校验委派函数 | 执行委派函数 | 标准失败返回码 |
|---|---|---|---|---|---|
| `dispatch_embassy`<br>*(别名: `dispatch_envoy`, `send_envoy`, 兼容旧 `gift`)* | `"han"` | `{"kind": "elite"\|"recruited", "character_id": String = "", "origin": String = "dun_huang", "targets": Array[Dictionary]}`（兼容单目标简写 `{"target": sid, "budget": int}`） | `Diplomacy.validate_dispatch_embassy(state, cmd)` | `Diplomacy.apply_dispatch_embassy(state, cmd)` | `ERR_NO_CHARACTER`, `ERR_RECRUITED_CAP`, `ERR_INSUFFICIENT_FUNDS`, `ERR_EXPEL_COOLDOWN`, `ERR_AT_WAR` |
| `recall_embassy` | `"han"` | `{"mission_id": String}` | `Diplomacy.validate_recall_embassy(state, cmd)` | `Diplomacy.apply_recall_embassy(state, cmd)` | `ERR_INVALID_MISSION`, `ERR_ALREADY_RETURNING` |
| `grant_enfeoffment`<br>*(别名: `enfeoff`, `demand_dual`)* | `"han"` | `{"state_id": String, "marry_wusun": bool = false}`（兼容键 `state`） | `Diplomacy.validate_grant_enfeoffment(state, cmd)` | `Diplomacy.apply_grant_enfeoffment(state, cmd)` | `ERR_TIER_LOCKED`, `ERR_NO_ENVOY_AT_COURT`, `ERR_INFLUENCE_LOW`, `ERR_TILT_TOO_LOW`, `ERR_SACK_MEMORY` |
| `incorporate_vassal`<br>*(别名: `make_vassal`, `vassalize`)* | `"han"` | `{"state_id": String}`（兼容键 `state`） | `Diplomacy.validate_incorporate_vassal(state, cmd)` | `Diplomacy.apply_incorporate_vassal(state, cmd)` | `ERR_GREAT_POWER_IMMUNE`, `ERR_NOT_ENFEOFFED`, `ERR_THRESHOLD_NOT_MET`, `ERR_NO_ELITE_OR_ARMY` |
| `respond_diplomatic_request` | `"han"` | `{"request_id": String, "accept": bool}` | `Diplomacy.validate_respond_request(state, cmd)` | `Diplomacy.apply_respond_request(state, cmd)` | `ERR_REQUEST_EXPIRED`, `ERR_INSUFFICIENT_FUNDS` |
| `declare_punitive` | `"han"` | `{"state_id": String, "policy": "install_king"\|"force_submit"\|"sack" = "force_submit"}` | `Diplomacy.validate_declare_punitive(state, cmd)` | `Diplomacy.apply_declare_punitive(state, cmd)` | `ERR_ALREADY_VASSAL`, `ERR_FORGED_EDICT_BLOCKED` |
| `set_capture_policy` | `"han"` | `{"state_id": String, "policy": "install_king"\|"force_submit"\|"sack"}` | `Diplomacy.validate_set_capture_policy(state, cmd)` | `Diplomacy.apply_set_capture_policy(state, cmd)` | `ERR_INSUFFICIENT_FUNDS`, `ERR_GREAT_POWER_NO_PUPPET` |
| `buy_grain` | `"han"` | `{"state_id": String, "amount": int}`（兼容键 `state`） | `Diplomacy.validate_buy_grain(state, cmd)` | `Diplomacy.apply_buy_grain(state, cmd)` | `ERR_SUPPLY_CLOSED`, `ERR_QUOTA_EXCEEDED`, `ERR_INSUFFICIENT_FUNDS` |
| `levy_vassal_troops` | `"han"` | `{"holder_node": String, "target_states": Array[String] = [], "max_troops": int = 5000}` | `Diplomacy.validate_levy_vassal_troops(state, cmd)` | `Diplomacy.apply_levy_vassal_troops(state, cmd)` | `ERR_HOLDER_NOT_PRESENT`, `ERR_TOO_FAR`, `ERR_NOT_ELIGIBLE_ALLY` |
| `demand_vassal`<br>*(别名: `demand_submission`)* | `"xiongnu"` | `{"state_id": String}`（兼容键 `state`） | `Diplomacy.validate_demand_vassal(state, cmd)` | `Diplomacy.apply_demand_vassal(state, cmd)` | `ERR_INTIMIDATION_LOW`, `ERR_ARMY_REQUIRED`, `ERR_INSUFFICIENT_POOL` |
| `demand_exclusive` | `"xiongnu"` | `{"state_id": String}` | `Diplomacy.validate_demand_exclusive(state, cmd)` | `Diplomacy.apply_demand_exclusive(state, cmd)` | `ERR_NOT_DUAL`, `ERR_INTIMIDATION_LOW` |
| `enforce_trade_ban` | `"xiongnu"` | `{"state_id": String}`（兼容键 `state`） | `Diplomacy.validate_enforce_trade_ban(state, cmd)` | `Diplomacy.apply_enforce_trade_ban(state, cmd)` | `ERR_NOT_VASSAL`, `ERR_INTIMIDATION_LOW` |
| `set_tax_rate`<br>*(别名: `set_tax`)* | `"xiongnu"` | `{"state_id": String, "level": int(0..3)}`（兼容键 `state`, `tax`） | `Diplomacy.validate_set_tax_rate(state, cmd)` | `Diplomacy.apply_set_tax_rate(state, cmd)` | `ERR_NOT_VASSAL` |
| `intimidate_city` | `"xiongnu"` | `{"state_id": String}` | `Diplomacy.validate_intimidate_city(state, cmd)` | `Diplomacy.apply_intimidate_city(state, cmd)` | `ERR_NO_NEARBY_CAVALRY`, `ERR_INSUFFICIENT_POOL` |
| `bribe_nobles` | `"xiongnu"` | `{"state_id": String}` | `Diplomacy.validate_bribe_nobles(state, cmd)` | `Diplomacy.apply_bribe_nobles(state, cmd)` | `ERR_OCCUPIED_BY_HAN`, `ERR_INSUFFICIENT_POOL` |
| `levy_vassal_infantry` | `"xiongnu"` | `{"state_id": String, "pay_appease": bool = false}` | `Diplomacy.validate_levy_vassal_infantry(state, cmd)` | `Diplomacy.apply_levy_vassal_infantry(state, cmd)` | `ERR_NOT_VASSAL`, `ERR_RESENTMENT_TOO_HIGH` |
| `install_prince` | `"xiongnu"` | `{"state_id": String}`（兼容键 `state`） | `Diplomacy.validate_install_prince(state, cmd)` | `Diplomacy.apply_install_prince(state, cmd)` | `ERR_ARMY_REQUIRED`, `ERR_INTIMIDATION_LOW`, `ERR_INSUFFICIENT_POOL`, `ERR_ON_COOLDOWN` |
| `marry_great_power` | `"xiongnu"` | `{"state_id": "wusun"\|"kangju"\|"dayuezhi"}` | `Diplomacy.validate_marry_great_power(state, cmd)` | `Diplomacy.apply_marry_great_power(state, cmd)` | `ERR_PRESTIGE_TOO_LOW`, `ERR_ON_COOLDOWN`, `ERR_INSUFFICIENT_POOL` |
| `detain_han_envoy` | `"xiongnu"` | `{"mission_id": String, "state_id": String}` | `Diplomacy.validate_detain_envoy(state, cmd)` | `Diplomacy.apply_detain_envoy(state, cmd)` | `ERR_ENVOY_NOT_IN_VASSAL` |

---

### 3.5 后勤、军事、马政与烽燧命令表（`S05` & 基线保留，共 19 条）

| 命令 `type`（及兼容别名） | 适用势力 | 参数字典 Schema (`cmd`) | 校验委派函数 | 执行委派函数 | 标准失败返回码 |
|---|---|---|---|---|---|
| `create_supply_line`<br>*(兼容 `set_supply_line`, `manage_supply_line`)* | `"han"` \| `"xiongnu"` | `{"source": String, "terminus": String, "priority": int = 2, "target_months": float = 6.0, "max_laborers": int = 10000}`（兼容键 `from`, `to`） | `SupplyLines.validate_create(state, cmd)` | `SupplyLines.apply_create(state, cmd)` | `ERR_INVALID_SOURCE`, `ERR_NO_VALID_PATH`, `ERR_DUPLICATE_LINE`, `ERR_MAX_LINES_REACHED` |
| `update_supply_line`<br>*(兼容 `manage_supply_line`)* | `"han"` \| `"xiongnu"` | `{"line_id": String, "priority": int, "target_months": float, "max_laborers": int, "escort_army_id": String = "", "ignore_danger": bool = false}` | `SupplyLines.validate_update(state, cmd)` | `SupplyLines.apply_update(state, cmd)` | `ERR_LINE_NOT_FOUND`, `ERR_INVALID_ESCORT_ARMY` |
| `delete_supply_line` | `"han"` \| `"xiongnu"` | `{"line_id": String}` | `SupplyLines.validate_delete(state, cmd)` | `SupplyLines.apply_delete(state, cmd)` | `ERR_LINE_NOT_FOUND` |
| `set_forage_policy` | `"han"` \| `"xiongnu"` | `{"army_id": String, "policy": "auto"\|"buy"\|"requisition"\|"plunder"\|"none"}` | `Supply.validate_forage_policy(state, cmd)` | `Supply.apply_forage_policy(state, cmd)` | `ERR_ARMY_NOT_FOUND`, `ERR_INVALID_POLICY` |
| `requisition_horses` | `"han"` | `{"node_id": String, "amount": int, "target_army_id": String = ""}` | `Supply.validate_requisition_horses(state, cmd)` | `Supply.apply_requisition_horses(state, cmd)` | `ERR_NOT_HAN_CITY`, `ERR_INSUFFICIENT_NODE_HORSES` |
| `survey_tuntian`<br>*(兼容 `build_tuntian` 阶段 0→1)* | `"han"` | `{"node_id": String}`（兼容键 `node`） | `Tuntian.validate_survey(state, cmd)` | `Tuntian.apply_survey(state, cmd)` | `ERR_ALREADY_SURVEYED`, `ERR_NEED_300_CAVALRY`, `ERR_LUNTAI_EDICT_FORBIDS_DISTANT_TUNTIAN`, `ERR_TUNTIAN_NEEDS_OFFICER`, `ERR_INSUFFICIENT_MONEY` |
| `found_colony`<br>*(兼容 `build_tuntian` 阶段 1→2)* | `"han"` | `{"army_id": String}` | `Tuntian.validate_found_colony(state, cmd)` | `Tuntian.apply_found_colony(state, cmd)` | `ERR_TUNTIAN_NOT_SURVEYED`, `ERR_COLONY_CAP_FULL` |
| `settle_convicts` | `"han"` | `{"army_id": String, "count": int}` | `Tuntian.validate_settle_convicts(state, cmd)` | `Tuntian.apply_settle_convicts(state, cmd)` | `ERR_TUNTIAN_NOT_SURVEYED`, `ERR_NO_CONVICTS_IN_ARMY`, `ERR_COLONY_CAP_FULL` |
| `ransom_convicts` | `"han"` | `{"amount": int}` | `Supply.validate_ransom_convicts(state, cmd)` | `Supply.apply_ransom_convicts(state, cmd)` | `ERR_INSUFFICIENT_CONVICTS`, `ERR_SEASON_RANSOM_CAP` |
| `build_beacon` | `"han"` | `{"route_idx": int}` | `Fog.validate_build_beacon(state, cmd)` | `Fog.apply_build_beacon(state, cmd)` | `ERR_ROUTE_NOT_CONNECTED`, `ERR_ENEMY_ON_ROUTE`, `ERR_INSUFFICIENT_MONEY_OR_LABOR` |
| `raze_beacon` | `"xiongnu"` | `{"army_id": String, "route_idx": int}` | `Fog.validate_raze_beacon(state, cmd)` | `Fog.apply_raze_beacon(state, cmd)` | `ERR_NO_BEACON_ON_ROUTE`, `ERR_ARMY_TOO_SMALL` |
| `set_plan`<br>*(别名: `submit_plan`)* | `"han"` \| `"xiongnu"` | `{"army": String, "steps": Array[Dictionary], "preset": String = "balanced", "engage": Array = [], "triggers": Array = []}` | `Commands._v_set_plan(state, cmd)`（含 `Court` 将领在场/授权/监军钩子与 `S03` `command_owner=="chanyu"` 钩子） | `Commands._a_set_plan(state, cmd)` | `ERR_ARMY_NEEDS_GENERAL`, `ERR_ACTION_UNAUTHORIZED_NEED_FORGE`, `WARN_JIANJUN_VETO_PENDING`, `ERR_NOT_CHANYU_COMMAND` |
| `recruit` | `"han"` \| `"xiongnu"` | `{"node": String, "source": "central"\|"tuntian"\|"hu"\|"convict"\|"nomad"\|"vassal", "units": Dictionary, "into": String = "", "commander_id": String = ""}` | `Commands._v_recruit(state, cmd)`（含 `Court` 中央军季度额度、`han_horse_pool`、`han_convict_pool` 校验） | `Commands._a_recruit(state, cmd)` | `ERR_CENTRAL_QUOTA_EXCEEDED`, `ERR_INSUFFICIENT_HORSES`, `ERR_INSUFFICIENT_CONVICTS`, `ERR_MUST_USE_TRIBE_SUMMON` |
| `load` / `load_grain` | `"han"` \| `"xiongnu"` | `{"army": String, "grain": float = 0, "horses": int = 0, "laborers": int = 0}` | `Commands._v_load(state, cmd)` | `Commands._a_load(state, cmd)` | `ERR_INSUFFICIENT_STOCK` |
| `split` | `"han"` \| `"xiongnu"` | `{"army": String, "units": Dictionary, "grain": float = 0, "horses": int = 0, "laborers": int = 0}` | `Commands._v_split(state, cmd)` | `Commands._a_split(state, cmd)` | `ERR_INVALID_SPLIT` |
| `merge` | `"han"` \| `"xiongnu"` | `{"into": String, "from": String}` | `Commands._v_merge(state, cmd)` | `Commands._a_merge(state, cmd)` | `ERR_NOT_SAME_NODE` |
| `disband` | `"han"` \| `"xiongnu"` | `{"army": String}` | `Commands._v_disband(state, cmd)` | `Commands._a_disband(state, cmd)` | `ERR_INVALID_ARMY` |
| `expand_farm` | `"han"` | `{"node": String}` | `Commands._v_expand_farm(state, cmd)` | `Commands._a_expand_farm(state, cmd)` | `ERR_FARM_CAP_REACHED`, `ERR_INSUFFICIENT_MONEY` |
| `convoy` *(内部保留)* | `"han"` | `{"from": String, "to": String, "grain": float, "laborers": int, "loop": bool = true}` | `Commands._v_convoy(state, cmd)` | `Commands._a_convoy(state, cmd)` | 仅供 `SupplyLines` 内部自动派车与旧存档兼容调用 |

---

## 第 4 章：跨模块 API 函数签名权威契约表

### 4.1 `core/victory.gd`（类名：`Victory`，归属 `S01`）

```gdscript
# 1. 查询接口（只读）
static func get_han_merit(state: GameState) -> int
static func calc_duhu_merit(state: GameState) -> int # get_han_merit 兼容别名
static func get_han_merit_breakdown(state: GameState) -> Dictionary
# 返回: {"vassal":int, "enfeoff":int, "hub":int, "tuntian":int, "suppress":int, "great":int, "tongpu":int, "event_pool":float, "permanent":int, "hexi_penalty":int, "petition_boost":int, "total":int}

static func get_xn_weifu(state: GameState) -> int
static func get_xn_weifu_breakdown(state: GameState) -> Dictionary
static func get_xn_prestige_breakdown(state: GameState) -> Dictionary # get_xn_weifu_breakdown 兼容别名
# 返回: {"hexi":int, "vassal":int, "hub":int, "tongpu":int, "prestige":int, "event_pool":float, "sacred_penalty":int, "total":int}

static func get_marginal_merit_map(state: GameState, faction: String) -> Dictionary
# 返回: {node_or_action_id: float}，供 S08 AI 叠加边际功业/威服分

static func evaluate_expiry_preview(state: GameState) -> Dictionary
# 返回: {"han_score": float, "xn_score": float, "han_grade": String, "xn_grade": String, "leader": String}

static func get_historian_evaluation(state: GameState) -> Dictionary
# 返回: {"end_type": String, "winner": String, "han_score": float, "xn_score": float, "han_grade": String, "xn_grade": String, "end_signature": String, "end_signature_coarse": String}

# 2. 状态变更与结算钩子
static func init_scenario(state: GameState, scn_data: Dictionary) -> void
static func record_event_award(state: GameState, faction: String, award_key: String, value_override: Variant = null) -> void
static func record_battle_milestone(state: GameState, winner: String, killed: int, commander_id: String = "") -> void
static func on_rizhu_surrender(state: GameState) -> void
static func on_han_court_recall_defeat(state: GameState) -> void
static func monthly(state: GameState) -> void # 每月末结算 Step 1..6（含季末衰减、功业/威服重算、维持月数、提前失败/主胜利/到期裁决）
```

---

### 4.2 `core/court.gd` & `core/documents.gd`（类名：`Court`, `Documents`，归属 `S02`）

```gdscript
# === core/court.gd ===
# 1. 查询接口（只读）
static func get_trust(state: GameState) -> int
static func get_trust_band(state: GameState) -> String # "recall" | "harsh" | "jianjun" | "normal" | "bianyi"
static func get_wind_id(state: GameState) -> String    # "wudi_early" | "luntai" | "huoguang" | "xuandi"
static func get_office_title(state: GameState) -> String # "envoy" | "colonel" | "protector"
static func get_holder_node(state: GameState) -> String
static func get_pending_edicts(state: GameState) -> Array[Dictionary]
static func get_central_quota_remaining(state: GameState) -> int
static func is_luntai_edict_active(state: GameState) -> bool # wind_id == "luntai" or luntai_decreed
static func is_horse_relaxation_active(state: GameState) -> bool # wind_id == "luntai"
static func can_build_tuntian(state: GameState, node_id: String) -> bool
static func check_recruit_quota(state: GameState, count: int) -> bool
static func check_authorization(state: GameState, action_type: String, target_id: String) -> Dictionary
# 返回: {"authorized": bool, "via": "normal"|"edict"|"bianyi"|"forged"|"crime_exempt", "reason": String}
static func check_war_authorization(state: GameState, state_id: String, has_crime: bool) -> Dictionary
static func is_target_authorized(state: GameState, target_id: String) -> bool
static func validate_plan_authorization(state: GameState, army: Dictionary, plan: Dictionary) -> String # 返回 "" 或错误码
static func preview_bargain_prob(state: GameState, instance_id: String, reason_tags: Array = []) -> float
static func preview_forged_edict_race(state: GameState, target_node: String, army_id: String) -> Dictionary
# 返回: {"march_days": float, "impeach_roundtrip_days": float, "safe_window_days": float, "is_safe": bool}

# 2. 状态修改与生命周期钩子
static func init_scenario(state: GameState) -> void
static func modify_trust(state: GameState, delta: int, reason: String = "") -> void
static func add_treasury(state: GameState, money: int, note: String = "") -> void
static func spend_military_market(state: GameState, cost: int, note: String = "") -> bool
static func consume_central_quota(state: GameState, amount: int) -> void
static func notify_fact(state: GameState, fact_type: String, at_node: String, data: Dictionary = {}) -> void
static func spawn_edict(state: GameState, template_id: String, target_id: String = "") -> Dictionary
static func apply_event_effect(state: GameState, key: String, delta: Variant) -> void
static func step_day(state: GameState) -> void      # 每日推进文书移动 D1..D4
static func tick_end(state: GameState) -> void      # 每旬末汇总捷报/边报与诏令逾期检查
static func quarter_start(state: GameState) -> void # 每季初执行 Q1..Q6（衰减/分档/风向/拨款/新诏/上计簿）

# === core/documents.gd ===
static func estimate_courier_days(state: GameState, from_node: String, to_node: String, speed_mode: String = "courier") -> float
static func create_document(state: GameState, doc_type: String, subtype: String, origin: String, target: String, payload: Dictionary = {}) -> Dictionary
```

---

### 4.3 `core/tribes.gd`（类名：`Tribes`，归属 `S03`）

```gdscript
# 1. 查询接口（只读）
static func get_visible_loyalty_range(state: GameState, tribe_id: String, viewer_faction: String = "xiongnu") -> Vector2i
# 返回: Vector2i(min_loyalty, max_loyalty)，遵守圣经 L9 迷雾隔离

static func preview_loyalty_delta(state: GameState, tribe_id: String, alloc_money: int) -> Dictionary
# 返回: {"expected_money": int, "delta_reward": int, "delta_jealousy": int, "delta_total": int}

static func get_active_combat_modifiers(state: GameState, army_a: Dictionary, army_b: Dictionary, route_or_node: String = "") -> Dictionary
# 返回: {"a_mult": float, "b_mult": float, "xn_feigned_retreat": bool, "xn_night_ambush": bool, "burn_mult": float, "scorched_earth_attrition_mult": float}

static func is_offering_surrender_to_han(state: GameState, tribe_id: String = "rizhu") -> bool
static func get_surrender_meet_node(state: GameState, tribe_id: String = "rizhu") -> String
static func get_tribe_preference_bonus(state: GameState, node_id: String) -> float

# 2. 状态修改与生命周期钩子
static func init_scenario(state: GameState, scn_data: Dictionary) -> void
static func add_reward_pool(state: GameState, delta_money: int, reason: String = "") -> void
static func add_loot_to_pool(state: GameState, money: int) -> void # add_reward_pool 别名
static func modify_prestige(state: GameState, delta: int, reason: String = "") -> void
static func on_tongpu_escort_defeated(state: GameState, han_army: Dictionary) -> void
static func quarter_start(state: GameState) -> void # 季初冷却递减、战术卡抽牌、三次年会触发
static func tick_end(state: GameState) -> void      # 每旬推进僮仆都尉巡行、迎降窗口、第 2 旬擅自出兵检定
static func quarter_end(state: GameState) -> void   # 季末牧产折钱、Q4 白灾与单于寿元检定、四部忠诚结算、XN_SCATTER 计数更新
```

---

### 4.4 `core/diplomacy.gd` & `core/trade.gd`（类名：`Diplomacy`, `Trade`，归属 `S04`）

```gdscript
# === core/diplomacy.gd ===
# 1. 查询接口（只读）
static func normalize_state_id(id_or_node: String) -> String
static func has_valid_crime(state: GameState, state_id: String) -> bool
static func get_crime_score(state: GameState, state_id: String, holder: String = "han") -> int
static func get_supply_stance(state: GameState, state_id: String, army_or_troops: Variant = null) -> Dictionary
# 返回: {"stance": "WELCOME"|"MARKET"|"CLOSED", "score": float, "quota_monthly": int, "price": float}
static func get_forage_willingness(state: GameState, state_id: String, army: Dictionary) -> float # 返回 0.0..100.0
static func get_forage_willingness_breakdown(state: GameState, state_id: String, army: Dictionary) -> Dictionary
static func get_tilt_breakdown(state: GameState, state_id: String) -> Dictionary
static func get_allied_vision_nodes(state: GameState, faction: String) -> Dictionary # 返回 {node_id: radius_hops}
static func can_enfeoff(state: GameState, state_id: String) -> bool
static func can_vassal(state: GameState, state_id: String) -> bool
static func estimate_envoy_survival(state: GameState, target_state: String, kind: String = "recruited") -> float
static func estimate_mission_success(state: GameState, target_state: String, budget: int) -> float

# 2. 状态修改与生命周期钩子
static func add_crime(state: GameState, state_id: String, crime_type: String, holder: String = "han", context: Dictionary = {}) -> void
static func add_tax_resentment(state: GameState, state_id: String, base_resentment: float) -> float
static func apply_forage_feedback(state: GameState, state_id: String, faction: String, delta_inf: float, delta_resent: float, crime_tag: String = "") -> void
static func on_unpaid_supply(state: GameState, state_id: String, faction: String, unpaid_grain: float) -> void
static func on_citystate_captured(state: GameState, state_id: String, attacker: String, policy: String = "force_submit") -> void
static func on_tongpu_deposed(state: GameState) -> void
static func on_white_disaster_weaken(state: GameState, delta_x: float = -15.0) -> void
static func levy_vassal_troops(state: GameState, holder_node: String, max_troops: int = 5000) -> Dictionary
static func tick_missions(state: GameState, days: float = 10.0) -> void
static func monthly(state: GameState) -> void     # 月末 Step M1..M6
static func quarter_end(state: GameState) -> void # 季末 Step S1..S5

# === core/trade.gd ===
static func monthly(state: GameState) -> void     # 结算丝路商税（乘以 Convict.get_trade_tax_mult）与禁商劫商罪状
```

---

### 4.5 `core/supply.gd`、`core/supply_lines.gd`、`core/tuntian.gd`、`core/fog.gd`、`core/preview.gd`、`core/pathfinding.gd`、`core/combat.gd`、`core/siege.gd`（归属 `S05`）

```gdscript
# === core/supply_lines.gd (SupplyLines) ===
static func dispatch_tick(state: GameState) -> void # 每旬 Day 0 逆推流量并自动派发/回收车队
static func month_end(state: GameState) -> void     # 更新 30 日滚动运量 delivered_30d
static func on_node_captured(state: GameState, node_id: String, new_owner: String) -> void

# === core/supply.gd (Supply / HorsePool / Convict) ===
static func step_day(state: GameState) -> void      # 每日扣军粮、地形损耗、战马损耗、罪人兵逃亡、断粮饿死单列
static func try_forage_on_arrival(state: GameState, army: Dictionary, node_id: String) -> void
static func add_horses(state: GameState, count: int, faction: String = "han", target_node: String = "") -> void
static func grant_tianma(state: GameState, count: int = 300) -> void
static func add_convict_pool(state: GameState, count: int) -> void
static func get_trade_tax_mult(state: GameState) -> float # convicts_levied_year > 5000 时返回 0.85，否则 1.0
static func has_beacon_cover(state: GameState, route_idx: int) -> bool
static func year_start(state: GameState) -> void    # 正月初恢复国家马匹池与罪人池，清零 convicts_levied_year

# === core/tuntian.gd (Tuntian) ===
static func step_day(state: GameState) -> void      # 每日推进校猎测地 30 日计时
static func month_end(state: GameState) -> void     # 更新邻国 tuntian_pressure
static func get_western_tuntian_stats(state: GameState) -> Dictionary # 返回 {"active_nodes": int, "total_grain": float}

# === core/fog.gd (Fog) ===
static func step_day(state: GameState) -> void      # 每日推进烽燧建造/拔除计时、投递到期情报、刷新传感器
static func month_end(state: GameState) -> void     # 扣减激活烽燧月维护费
static func get_perceived_state(state: GameState, faction: String) -> Dictionary
# 返回: {"estimates": Array[Dictionary], "node_intel": Dictionary}（强制剥离 true_army_id）
static func get_perceived_armies(state: GameState, faction: String) -> Array[Dictionary]
static func inject_false_intel(state: GameState, target_faction: String, fake_loc_node: String, fake_size: int) -> void
static func reveal_army(state: GameState, viewer_faction: String, army_id: String, level: int = 3) -> void

# === core/preview.gd (Preview) ===
static func simulate_food_curve(state: GameState, army_id: String, draft_plan: Dictionary, horizon_ticks: int = 18) -> Dictionary
# 返回: {"ticks": Array[Dictionary], "point_of_no_return_tick": int, "starve_tick": int, "summary_light": "green"|"yellow"|"red"}
static func compute_enemy_reach(state: GameState, est_or_army_id: String, viewer_faction: String) -> Dictionary
# 返回: {"reach_30d": Dictionary, "reach_60d": Dictionary, "reach_90d": Dictionary}

# === core/pathfinding.gd (Pathfinding / Path) ===
static func dijkstra(state: GameState, start_node: String, unit_class: String = "infantry", faction: String = "han") -> Dictionary
static func courier_dijkstra(state: GameState, from_id: String, ignore_closed: bool = true) -> Dictionary
static func days_to(state: GameState, from_id: String, to_id: String, unit_class: String = "cavalry") -> float
static func shortest_safe_route(state: GameState, from_id: String, to_id: String, faction: String) -> Array[String]

# === core/combat.gd (Combat) & core/siege.gd (Siege) ===
static func calc_army_awe(state: GameState, army: Dictionary) -> float
static func resolve_encounters(state: GameState) -> void # 每日遭遇战结算（接入 Characters 统率/特性与 Tribes 战术卡修正）
static func step_day(state: GameState) -> void           # Siege 每日围城推进
static func monthly(state: GameState) -> void            # Siege 月末守军消耗与城破检定（城破回调 Diplomacy.on_citystate_captured）
```

---

### 4.6 `core/characters.gd`、`core/event_engine.gd`、`core/chronicle.gd`、`core/biography_generator.gd`（归属 `S06`）

```gdscript
# === core/characters.gd (Characters) ===
static func init_scenario(state: GameState, scn_data: Dictionary) -> void
static func get_char(state: GameState, char_id: String) -> Dictionary
static func get_active_holder(state: GameState) -> Dictionary
static func get_roster(state: GameState, faction: String) -> Array[Dictionary]
static func get_commander_stats(state: GameState, char_id: String) -> Dictionary
# 返回: {"command": int(0..100), "command_tier": int(0..10), "valor": int, "caution": int, "traits": Array[String], "at_node": String}
# 当 char_id == "" 时返回默认: {"command": 20, "command_tier": 2, "valor": 20, "caution": 50, "traits": [], "at_node": ""}
static func get_envoy_modifiers(state: GameState, char_id: String) -> Dictionary
# 返回: {"eloquence": int, "has_pioneer": bool, "has_resolute": bool, "bowang_credit_bonus": float}
static func pick_idle_envoy(state: GameState, faction: String = "han") -> String
static func pick_commander_at(state: GameState, node_id: String, faction: String = "han") -> String
static func generate_fallback_character(state: GameState, role: String, faction: String = "han") -> Dictionary
static func roll_battle_fate(state: GameState, char_id: String, is_loser: bool, is_wiped: bool) -> void
static func year_end_mortality_check(state: GameState) -> void

# === core/event_engine.gd (EventEngine / Events) ===
static func init_scenario(state: GameState, scn_data: Dictionary) -> void
static func on_season_start(state: GameState) -> void
static func on_tick_end(state: GameState) -> void
static func trigger_immediate(state: GameState, evt_id: String, ctx: Dictionary = {}) -> void
static func eval_trigger(state: GameState, trigger_dict: Dictionary) -> bool
static func apply_effects(state: GameState, effects_array: Array) -> void
static func get_pending_modal_events(state: GameState) -> Array[Dictionary]

# === core/chronicle.gd (Chronicle) & core/biography_generator.gd (BiographyGenerator) ===
static func compile_season_annals(state: GameState) -> void
static func get_season_entries(state: GameState, style: String = "classical") -> Array[String]
static func build_endgame_bio(state: GameState) -> Dictionary
# 返回: {"title": String, "paragraphs": Array[String], "rating_stars": int, "rating_title": String, "share_card_data": Dictionary}
```

---

### 4.7 `ai/*.gd` & `ui/*.gd` 核心导出接口（归属 `S08` & `S07`）

```gdscript
# === ai/han_ai.gd (HanAI), ai/xiongnu_ai.gd (XiongnuAI), ai/citystate_ai.gd (CityStateAI), ai/ai_utils.gd (AIUtils) ===
static func HanAI.think(state: GameState) -> Array[Dictionary]
static func XiongnuAI.think(state: GameState) -> Array[Dictionary]
static func CityStateAI.evaluate_quarter_end(state: GameState) -> Array[Dictionary]
static func AIUtils.get_nodes_by_tag(state: GameState, tag: String) -> Array[String]
static func AIUtils.perceived_enemy_threat_at(state: GameState, viewer_faction: String, node_id: String, horizon_days: float = 30.0) -> float
static func AIUtils.evaluate_event_choice(state: GameState, faction: String, event_id: String, options: Array) -> String
static func AIUtils.get_commander_personality_summary(state: GameState, faction: String) -> Dictionary

# === ui/localization.gd (Loc), ui/tooltip_manager.gd (TooltipManager), ui/summary_advisor.gd (SummaryAdvisor), ui/tutorial_controller.gd (TutorialController), ui/share_card_exporter.gd (ShareCardExporter) ===
static func Loc.t(key: String, params: Dictionary = {}) -> String
static func TooltipManager.register_target(ctrl: Control, schema_id: String, ctx: Dictionary) -> void
static func SummaryAdvisor.get_top_3_todos(state: GameState, faction: String) -> Array[Dictionary]
static func TutorialController.on_ui_event(event_tag: String, payload: Dictionary) -> void
static func ShareCardExporter.export_ending_card(state: GameState, path: String) -> Error
```

---

## 第 5 章：JSON 数据文件与 ID 权威对照表

### 5.1 全项目 JSON 数据文件清单与顶层键结构

| 文件路径 | 状态 | 归属 Spec | 顶层 JSON 键结构（Top-Level Keys） |
|---|---|---|---|
| `data/balance.json` | 扩展 | S01, S04, S05, S06 | 保留现有键（`calendar`, `economy`, `farm`, `pop`, `combat`, `siege`, `supply`, `diplomacy`, `trade`, `presets`），新增/扩展：<br>• `victory`: `{merit, weifu, failure, expiry_scoring, grades}`<br>• `diplomacy`: `{anchor_*, influence_decay_rate, enfeoff_monthly_gain, intimidation_decay_month, tongpu_intimidation_floor, han_awe_decay_month, faction_drift_*, tilt_*, tier_lock_seasons, expel_cooldown_seasons}`<br>• `embassy`: `{kinds, travel_speed_mult, budget_min, budget_max, court_stay_days, recruited_yearly_cap}`<br>• `grievance`: `{types: {kill_envoy, insult_envoy, rob_caravan, ...}}`<br>• `punitive`: `{sack_memory_seasons, default_policy, inactive_expire_seasons}`<br>• `supply_will`: `{quota_ratio_*, price_*}`<br>• `supply_line`: `{default_priority, default_target_months, relay_reserve_months, default_max_laborers, auto_pause_losses}`<br>• `army_forage`: `{default_policy, thresholds: [75, 50, 30]}`<br>• `horse_pool`: `{initial_default, cap, tianma_speed_bonus, dismount_as_infantry}`<br>• `convict`: `{initial_pool, trade_penalty_threshold, ransom_money_per_1k, season_ransom_cap}`<br>• `tuntian`: `{max_stage_ea, survey_days_needed, first_year_yield_mult, colony_cap_ratio, pressure_event_threshold}`<br>• `fog`: `{beacon_max_hp, beacon_build_cost_per_day, beacon_maint_per_month, difficulty_error_mult}`<br>• `events`: `{max_popups_per_season, major_quota_min, major_quota_max, major_cooldown_seasons, rizhu_window_ticks}`<br>• `chronicle`: `{max_entries_per_season}` |
| `data/units.json` | 扩展 | S05 | 保留 `infantry`, `crossbow`, `cavalry`, `hu_cavalry`, `nomad_archers`, `vassal_infantry`；新增汉罪人兵 **`convict`**（`cost_money: 15`, `food_per_day: 0.022`, `atk: 0.75`, `def: 0.70`, `desertion_daily_outside: 0.0015`） |
| `data/court.json` | **新建** | S02 | `{"trust": {initial_by_scenario, bands, hysteresis, idle_grace_seasons, allow_redeem_once, redeem_deadline_seasons}, "winds": {wudi_early, luntai, huoguang, xuandi}, "regret": {threshold_luntai}, "strain": {initial_by_scenario, decay_per_season}, "precedent": {max, resistance_threshold}, "allocation": {base_quarterly_stipend, seasonal_quota_by_band}, "requests": {funds, troops, general, princess}, "tribute": {horse_annual_cap, treasure_annual_cap}, "office": {titles}, "jianjun": {veto_prob_base}}` |
| `data/edicts.json` | **新建** | S02 | `{"edicts": {"ED01": {...}, ..., "ED15": {...}}}`（15 道诏令模板字典，见 §5.4） |
| `data/tribes.json` | **新建** | S03 | `{"chanyu": {prestige_initial, initial_id, initial_age, initial_wounds, initial_heir_id}, "economy": {reward_pool_initial, default_distribution}, "tribes": {"zuoxian": {...}, "youxian": {...}, "rizhu": {...}, "lihu": {...}}, "assemblies": {new_year, longcheng, dailin}, "tongpu": {initial_active, initial_char_id, escort_army_id, default_patrol_nodes, tax_tiers}, "tactics": {cards: {...}, initial_hand, cooldowns_init}}` |
| `data/characters.json` | **新建** | S06 | `{"characters": [...25名主表...], "xiongnu_successors": [...4名世系扩展...], "scenario_extras": [...3名剧本辅助...], "fallback_generator": {han_titles, han_surnames, xn_titles, xn_clans}, "trait_definitions": {...40个特性...}}` |
| `data/events.json` | **新建** | S06 | `{"events": [...40条事件对象...]}`（见 §5.5） |
| `data/ai_profiles.json` | 重构 | S08 | `{"global_utility": {...}, "han_base": {...}, "xiongnu_base": {...}, "personalities": {"han_pioneer_hawk": {...}, "han_prudent_farmer": {...}, "han_audacious_schemer": {...}, "xn_iron_tyrant": {...}, "xn_conciliatory_elder": {...}, "xn_greedy_raider": {...}}, "difficulty_modifiers": {"qingche": {...}, "chijie": {...}, "suiyuan": {...}}, "citystate_ai": {...}, "node_semantics": {...42节点...}}` |
| `data/ui_config.json` | **新建** | S07 | `{"default_tab": "inspector", "map_layers_default": {...}, "tooltip_max_depth": 3, "color_palettes": {"standard": {...}, "deuteranopia": {...}, "protanopia": {...}, "high_contrast": {...}}, "tutorial_lessons": [...5课脚本...]}` |
| `data/scenarios/*.json` | **新建** | S01 | • `data/scenarios/scenario_01_loulan_108bc.json`（`id: "scn_loulan_108bc"`）<br>• `data/scenarios/scenario_02_mobei_119bc.json`（`id: "scn_mobei_119bc"`）<br>• `data/scenarios/scenario_03_protectorate_68bc.json`（`id: "scn_protectorate_68bc"`）<br>均基于 `data/scenario_mvp.json` 采用 Base + Delta 格式加载。 |

---

### 5.2 人物 ID 权威对照表（EA 25 名核心人物 + 7 名世系/剧本扩展人物）

> **对齐 `[E-24]`、`[E-25]` 与 `[S08→S06]`**：下表修正了 `S06` 中的节点/政权拼写（乌孙节点统一为 `"chi_gu"`、政权为 `"wusun"`；大宛节点为 `"da_wan"`、政权为 `"dawan"`；右贤王驻地为 `"youxian_wang"`），并为每位主帅/单于补齐了 `ai_personality` 映射。

#### （1）EA 25 名史实人物主表（`data/characters.json → characters`）
| # | 权威 `char_id` | 姓名 | 阵营 / 母国 (`faction` / `home_state`) | 角色标签 (`role_tags`) | 初始节点 (`init_node`) | 四维 (`cmd`/`tier`, `val`, `elo`, `cau`) | 特性 Tag ×2 (`traits`) | 默认 AI 性格 (`ai_personality`) |
|---|---|---|---|---|---|---|---|---|
| 1 | `han_zhang_qian` | 张骞 | `"han"` / `""` | `["holder","envoy"]` | `"dun_huang"` | `68(7) / 62 / 96 / 84` | `["trait_pioneer", "trait_bowang_credit"]` | `"han_prudent_farmer"` |
| 2 | `han_zhao_ponu` | 赵破奴 | `"han"` / `""` | `["holder","general"]` | `"jiu_quan"` | `82(8) / 88 / 58 / 52` | `["trait_ambusher", "trait_light_raider"]` | `"han_pioneer_hawk"` |
| 3 | `han_li_guang` | 李广 | `"han"` / `""` | `["general"]` | `"dun_huang"` | `78(8) / 95 / 50 / 35` | `["trait_unlucky_path", "trait_flying_general"]` | `"han_pioneer_hawk"` |
| 4 | `han_lu_bode` | 路博德 | `"han"` / `""` | `["general","tuntian"]` | `"ju_yan"` | `80(8) / 75 / 64 / 78` | `["trait_crossbow_wall", "trait_shame_rear"]` | `"han_prudent_farmer"` |
| 5 | `han_li_guangli` | 李广利 | `"han"` / `""` | `["holder","general"]` | `"dun_huang"` | `72(7) / 70 / 55 / 42` | `["trait_greedy", "trait_imperial_inlaw"]` | `"han_pioneer_hawk"` |
| 6 | `han_xijun` | 刘细君 | `"han"` / `""` | `["princess","envoy"]` | `"chang_an"` | `30(3) / 25 / 85 / 76` | `["trait_yellow_swan", "trait_royal_bride"]` | `"han_prudent_farmer"` |
| 7 | `han_jieyou` | 刘解忧 | `"han"` / `""` | `["princess","envoy"]` | `"chi_gu"` | `55(6) / 48 / 92 / 85` | `["trait_wusun_matriarch", "trait_royal_bride"]` | `"han_audacious_schemer"` |
| 8 | `han_fu_jiezi` | 傅介子 | `"han"` / `""` | `["holder","envoy"]` | `"dun_huang"` | `66(7) / 89 / 86 / 28` | `["trait_resolute", "trait_forger"]` | `"han_audacious_schemer"` |
| 9 | `han_chang_hui` | 常惠 | `"han"` / `""` | `["holder","general","envoy"]` | `"dun_huang"` | `84(8) / 76 / 88 / 79` | `["trait_vassal_levy", "trait_veteran_envoy"]` | `"han_audacious_schemer"` |
| 10 | `han_zheng_ji` | 郑吉 | `"han"` / `""` | `["holder","general","envoy","tuntian"]` | `"lun_tai"` | `86(9) / 74 / 82 / 82` | `["trait_tuntian_master", "trait_welcomer"]` | `"han_prudent_farmer"` |
| 11 | `han_feng_fengshi` | 冯奉世 | `"han"` / `""` | `["holder","general","envoy"]` | `"dun_huang"` | `85(9) / 80 / 87 / 68` | `["trait_vassal_levy", "trait_forger"]` | `"han_audacious_schemer"` |
| 12 | `han_du_zhou` | 杜周 | `"han"` / `""` | `["censor"]` | `"chang_an"` | `52(5) / 40 / 78 / 90` | `["trait_harsh_censor", "trait_stern"]` | `"han_prudent_farmer"` |
| 13 | `han_bao_shengzhi` | 暴胜之 | `"han"` / `""` | `["censor"]` | `"chang_an"` | `60(6) / 55 / 80 / 86` | `["trait_harsh_censor", "trait_stern"]` | `"han_prudent_farmer"` |
| 14 | `xn_yizhixie` | 伊稚斜 | `"xiongnu"` / `""` | `["chanyu","general"]` | `"chanyu_ting"` | `88(9) / 86 / 65 / 72` | `["trait_strict_punisher", "trait_steppe_overlord"]` | `"xn_iron_tyrant"` |
| 15 | `xn_woyanqudi` | 握衍朐鞮 | `"xiongnu"` / `""` | `["chanyu","general"]` | `"chanyu_ting"` | `70(7) / 78 / 45 / 38` | `["trait_tyrant", "trait_strict_punisher"]` | `"xn_iron_tyrant"` |
| 16 | `xn_xubu_she` | 须卜奢（左贤王） | `"xiongnu"` / `""` | `["tribe_king","general"]` | `"long_cheng"` | `82(8) / 80 / 68 / 75` | `["trait_eastern_pillar", "trait_ambusher"]` | `"xn_conciliatory_elder"` |
| 17 | `xn_xiutu_yu` | 休屠余（右贤王） | `"xiongnu"` / `""` | `["tribe_king","general"]` | `"youxian_wang"` | `80(8) / 84 / 60 / 64` | `["trait_steppe_raider", "trait_greedy"]` | `"xn_greedy_raider"` |
| 18 | `xn_huyan_gu` | 呼衍骨（前日逐王） | `"xiongnu"` / `""` | `["tribe_king","general"]` | `"yan_qi"` | `78(8) / 76 / 66 / 70` | `["trait_tongpu_master", "trait_steppe_raider"]` | `"xn_conciliatory_elder"` |
| 19 | `xn_xianxianshan` | 先贤掸（日逐王） | `"xiongnu"` / `""` | `["tribe_king","general"]` | `"yan_qi"` | `84(8) / 78 / 74 / 76` | `["trait_resentful_prince", "trait_tongpu_master"]` | `"xn_conciliatory_elder"` |
| 20 | `xn_tongpu_duwei` | 呼衍都尉（僮仆都尉） | `"xiongnu"` / `""` | `["tongpu","general"]` | `"yan_qi"` | `74(7) / 72 / 62 / 68` | `["trait_tax_extortionist", "trait_stern"]` | `"xn_greedy_raider"` |
| 21 | `cs_liejiaomi` | 猎骄靡（乌孙昆莫） | `"citystate"` / `"wusun"` | `["king","general"]` | `"chi_gu"` | `80(8) / 78 / 74 / 85` | `["trait_dual_marriage", "trait_nomad_king"]` | `"xn_conciliatory_elder"` |
| 22 | `cs_wengguimi` | 翁归靡（乌孙肥王） | `"citystate"` / `"wusun"` | `["king","general"]` | `"chi_gu"` | `84(8) / 80 / 78 / 76` | `["trait_pro_han_allied", "trait_nomad_king"]` | `"han_prudent_farmer"` |
| 23 | `cs_angui` | 安归（楼兰王） | `"citystate"` / `"lou_lan"` | `["king"]` | `"lou_lan"` | `64(6) / 62 / 70 / 48` | `["trait_envoy_raider", "trait_two_faced"]` | `"xn_greedy_raider"` |
| 24 | `cs_mugua` | 毋寡（大宛王） | `"citystate"` / `"dawan"` | `["king"]` | `"da_wan"` | `74(7) / 70 / 55 / 45` | `["trait_hoard_horses", "trait_walled_defender"]` | `"han_prudent_farmer"` |
| 25 | `cs_laidan` | 赖丹（扜弥太子/校尉） | `"han"` / `"lun_tai"` | `["tuntian","general"]` | `"lun_tai"` | `68(7) / 65 / 72 / 50` | `["trait_foreign_colonizer", "trait_tuntian_master"]` | `"han_prudent_farmer"` |

#### （2）匈奴世系与剧本辅助扩展池（`xiongnu_successors` + `scenario_extras`，共 7 人）
- `xn_wuwei`（乌维单于，`cmd:76(8)`，`traits: ["trait_conservative_khan", "trait_steppe_overlord"]`，性格 `"xn_conciliatory_elder"`）
- `xn_wushilu`（儿单于乌师庐，`cmd:68(7)`，`traits: ["trait_young_bellicose", "trait_steppe_raider"]`，性格 `"xn_iron_tyrant"`）
- `xn_xuluquanqu`（虚闾权渠单于，`cmd:82(8)`，`traits: ["trait_steppe_overlord", "trait_conservative_khan"]`，性格 `"xn_conciliatory_elder"`，兼容别名 `xn_xulvquanqu`）
- `xn_lihu_wang`（犁汙王蒲奴，驻 `"yi_wu"`，`cmd:75(8)`，`traits: ["trait_ambusher", "trait_beacon_raider"]`，性格 `"xn_greedy_raider"`，兼容别名 `xn_lihu_xiutu`）
- `han_wang_hui`（王恢，剧本①②汉严正使臣/将校，驻 `"dun_huang"`，`cmd:70(7)` / `elo:78`，`traits: ["trait_veteran_envoy", "trait_cautious_official"]`，性格 `"han_pioneer_hawk"`）
- `han_zhao_chongguo`（赵充国，剧本③后将军，驻 `"jiu_quan"`，`cmd:90(9)` / `cau:92`，`traits: ["trait_tuntian_master", "trait_cautious_official"]`，性格 `"han_prudent_farmer"`）
- `xn_zhao_xin`（赵信，剧本②翕侯，驻 `"zhaoxin_cheng"`，`cmd:76(8)` / `elo:75`，`traits: ["trait_ambusher", "trait_two_faced"]`，性格 `"xn_greedy_raider"`）

---

### 5.3 人物特性 Tag 权威对照表（24 个核心机制特性 + 16 个角色专属特性）

#### （1）24 个跨系统核心机制特性（`S06 §4.5(4)`）
| # | 特性 ID | 中文名 | 绑定系统与核心数值效果 |
|---|---|---|---|
| 1 | `trait_greedy` | 贪功好利 | `S05/S02/S03`：强征/掠食怨恨 `×1.35`；破城私吞战利品致汉信任 `-3` 或匈奴赏赐池入账 `-25%` |
| 2 | `trait_ambusher` | 轻骑奇袭 | `S05`：`<=3,000` 纯骑兵行军速度 `+15%`，`ambush_road` 伏击率 `+25%`，首轮冲击 `+15%` |
| 3 | `trait_stern` | 治军严酷 | `S05/S04`：断粮哗变延后 1 旬，野战防御 `+8%`；每季非战斗减员 `+2%`，驻防城邦每季怨恨 `+2` |
| 4 | `trait_pioneer` | 凿空者 | `S04/S05`：精使团视野 `+1` 跳，首次抵大国额外 `+15` 汉影响力 |
| 5 | `trait_bowang_credit` | 博望遗信 | `S04`：张骞出使后，汉方所有精使团影响力游说收益永久 `+8%` |
| 6 | `trait_resolute` | 勇决刺王 | `S04/S06`：外交刺杀成功率 `+35%`，对有罪城邦威慑效果 `+25%` |
| 7 | `trait_forger` | 便宜矫制 | `S02`：矫诏行动战力/出使成功率 `+15%`，大捷后自劾豁免惩罚率 `+30%` |
| 8 | `trait_vassal_levy` | 以节发兵 | `S02/S04`：`levy_vassal_troops` 可征属国兵上限 `+40%`，属国怨恨减半 |
| 9 | `trait_tuntian_master` | 屯田校尉 | `S05`：驻守节点秋收屯田产粮 `+25%`，校猎测地耗时 `-10` 日 |
| 10 | `trait_welcomer` | 招降纳叛 | `S01/S03`：迎降动摇部王兵力门槛降至 `2,400`，额外多收 `+500` 归义胡骑 |
| 11 | `trait_harsh_censor` | 深文峻法 | `S02`：作为监军在场时败仗/矫诏扣信任 `×1.40`，请款审批通过率 `+15%` |
| 12 | `trait_light_raider` | 七百骑擒王 | `S04/S05`：`<=2,000` 轻骑攻守军 `<=1,500` 有罪小国可直接触发突袭擒王 |
| 13 | `trait_shame_rear` | 羞为后距 | `S02/S05`：主力统帅时守城与强弩战力 `+12%`；给高执念外戚当后援时 20% 概率行军 `-25%` |
| 14 | `trait_unlucky_path` | 数奇迷道 | `S05/S06`：沙漠/草原无向导迷路损耗率 `+20%`，关联 `evt_li_guang_lost` |
| 15 | `trait_strict_punisher` | 严罚军法 | `S03`：问罪战败部王恢复威望 `+8`，但该部忠诚 `-18`、日逐怨望 `+15` |
| 16 | `trait_tyrant` | 暴虐猜忌 | `S03`：在位期间每季四部忠诚额外 `-4`，日逐王怨望每季 `+8` |
| 17 | `trait_resentful_prince` | 怨望贵人 | `S03/S06`：单于威望 `<50` 或缺赏时怨望增速 `×1.5`，`>=70` 触发请降 |
| 18 | `trait_tongpu_master` | 统摄僮仆 | `S03/S04`：维持僮仆都尉运转与西域威吓保底 `X_floor=30` |
| 19 | `trait_pro_han_allied` | 愿发国兵 | `S04`：乌孙和亲期间协战出兵规模 `+50%` |
| 20 | `trait_hoard_horses` | 匿马拒汉 | `S04/S06`：常规求马必拒并触发 `evt_dawan_horses_refused` |
| 21 | `trait_foreign_colonizer` | 外籍校尉 | `S05/S06`：在轮台屯田时对龟兹 `tuntian_pressure` 每季额外 `+8` |
| 22 | `trait_yellow_swan` | 黄鹄之歌 | `S04/S06`：驻乌孙每季汉影响力 `+3`，每年 `health -18` |
| 23 | `trait_wusun_matriarch` | 三代国母 | `S04/S06`：驻乌孙汉影响力保底 `+15`，遇匈奴侵乌孙触发五将军助战链 |
| 24 | `trait_envoy_raider` | 遮杀汉使 | `S04`：匈奴威吓 `>50` 时截杀途经汉使概率 `+30%` |

#### （2）16 个角色专属加成特性（补齐花名册引用，对齐 `[E-30]`）
- `trait_flying_general`（飞将军：野战弓骑/弩兵射击伤害 `+10%`）
- `trait_crossbow_wall`（强弩列阵：对抗骑兵冲击时本军防御 `+12%`）
- `trait_imperial_inlaw`（椒房外戚：向朝廷请兵/请款基础获批率 `+20%`，但战败增加武帝悔意 `×1.3`）
- `trait_royal_bride`（汉家宗女：和亲在位期间每季为汉廷恢复信任 `+1`）
- `trait_veteran_envoy`（老练使臣：使团在途遭遇沙暴/游骑截击逃脱率 `+25%`）
- `trait_cautious_official`（持重奉法：统兵行军口粮损耗 `-8%`，拒绝参与未经授权的矫诏）
- `trait_steppe_overlord`（漠北霸主：单于亲征时全军士气与威望获取 `+15%`）
- `trait_eastern_pillar`（左翼柱石：左贤王部基础应征骑兵上限 `+15%`）
- `trait_steppe_raider`（秋高马肥：秋季 Q3 劫掠农田与商道所得钱粮 `+20%`）
- `trait_tax_extortionist`（箕敛重税：僮仆都尉征税实收金额 `+15%`，城邦怨恨额外 `+2`）
- `trait_conservative_khan`（守成休养：每季自然恢复牧区战马 `+80`，四部忠诚衰减减半）
- `trait_young_bellicose`（年少好杀：骑兵冲击 `+10%`，每年四部忠诚 `-5`、白灾损耗 `+20%`）
- `trait_beacon_raider`（拔燧好手：执行 `raze_beacon` 耗时从 5 日缩短为 3 日）
- `trait_dual_marriage`（昆莫两妻：乌孙同时接受汉匈联姻时外交倾向向中立回归速度 `+20%`）
- `trait_nomad_king`（行国大君：本国控弦骑兵自然恢复速度 `+15%`）
- `trait_two_faced`（首鼠两端：在汉匈之间切换宗主或请为两属的冷却期缩短 1 季）
- `trait_walled_defender`（凭城固守：都城围城战中城防耐久损耗 `-20%`）

---

### 5.4 诏令 ID 权威对照表（`data/edicts.json`，共 15 个模板）

| 模板 ID | 诏令名称 | Demo 子集 | 类别 `tag` | 基准期限 | 授予权限 (`granted_auth`) |
|---|---|---|---|---|---|
| `ED01` | 《诏：通楼兰道》 | ★ Demo | `expedition` | 6 季 | `["attack:lou_lan"]`（兼容别名 `edict_open_loulan`） |
| `ED02` | 《诏：击破姑师》 | ★ Demo | `expedition` | 6 季 | `["attack:cheshi_qian"]` |
| `ED03` | 《诏：厚币招乌孙》 | ★ Demo | `diplomacy` | 6 季 | `["mission:wusun"]` |
| `ED04` | 《诏：护送公主和亲》 | EA | `diplomacy` | 5 季 | `["escort:princess"]`（严诏不可推辞） |
| `ED05` | 《诏：求大宛善马》 | EA | `expedition` | 8 季 | `["attack:dawan", "levy_allied:any"]`（兼容别名 `edict_conquer_dawan`） |
| `ED06` | 《诏：邀击匈奴寇边》 | ★ Demo | `defense` | 4 季 | `["attack:xiongnu"]` |
| `ED07` | 《诏：兴屯渠犁轮台》 | ★ Demo | `tuntian` | 6 季 | `["tuntian:target"]`（生效期每季津贴 `+400` 钱） |
| `ED08` | 《诏：问罪杀使之国》 | ★ Demo | `punish` | 5 季 | `["attack:target", "enfeoff:target"]` |
| `ED09` | 《密诏：立奇功斩逆王》 | EA | `covert` | 4 季 | `["assassinate:target"]` |
| `ED10` | 《诏：固守河西勿生事》 | EA | `defense` | 4 季 | `[]`（严诏不可推辞，期间禁止塞外远征） |
| `ED11` | 《诏：册立亲汉质子》 | EA | `diplomacy` | 4 季 | `["enfeoff:target"]` |
| `ED12` | 《诏：受降匈奴来归者》 | EA | `diplomacy` | 4 季 | `["receive_defector"]` |
| `ED13` | 《诏：发兵救援乌孙》 | EA | `expedition` | 4 季 | `["attack:xiongnu", "levy_allied:wusun"]` |
| `ED14` | 《诏：经营车师争北道》 | EA | `tuntian` | 6 季 | `["attack:cheshi_qian", "tuntian:cheshi_qian"]` |
| `ED15` | 《大诏：督诸国兵绝幕击胡》 | EA | `expedition` | 6 季 | `["attack:xiongnu", "levy_allied:all"]` |

---

### 5.5 核心事件 ID 权威对照表（`data/events.json`，共 40 条）

> **对齐 `[E-27]`**：下表列出全部 40 条事件的权威 `evt_id`、是否计入 `S01-R12` 中期大事件配额（`is_major_quota`），以及触发后写入 `state.victory.key_events_occurred` 的 **8 种标准短标签**（`"rizhu"`, `"baizai"`, `"jiaozhao"`, `"chanyu_die"`, `"wind_shift"`, `"hexi_fall"`, `"wusun_war"`, `"king_slain"`）。

| # | 权威 `evt_id` | 事件标题 | 阵营 | 大事件配额 | 终局签名短标签 (`key_event_tag`) | 跨分册旧别名映射 |
|---|---|---|---|---|---|---|
| 01 | `evt_li_guang_lost` | 李将军迷道 | 汉 | 否 | `""` | — |
| 02 | `evt_zhang_qian_wusun` | 博望侯二使乌孙 | 汉 | 否 | `""` | — |
| 03 | `evt_wusun_marriage` | 乌孙求聘与昆莫两妻 | 汉 | **是** | `"wusun_war"` | — |
| 04 | `evt_wusun_levirate` | 从其国俗 | 汉 | 否 | `""` | — |
| 05 | `evt_envoy_killed` | 汉使受辱与死节 | 汉 | 否 | `""` | — |
| 06 | `evt_bound_horse_curse` | 缚马之书 | 汉匈 | 否 | `""` | — |
| 07 | `evt_heavenly_horses_arrive` | 天马来·作天马歌 | 汉 | 否 | `""` | — |
| 08 | `evt_dawan_horses_refused` | 宛王匿马杀使 | 汉 | **是** | `"king_slain"` | — |
| 09 | `evt_shouxiang_city_pact` | 受降城之约 | 汉 | **是** | `""` | — |
| 10 | `evt_family_implicated` | 家室在吏（巫蛊之祸） | 汉 | **是** | `"wind_shift"` | — |
| 11 | `evt_luntai_edict` | 轮台罪己诏 | 汉 | **是** | `"wind_shift"` | `evt_court_wind_shift` |
| 12 | `evt_hidden_mourning` | 匿丧矫令 | 匈 | **是** | `"chanyu_die"` | — |
| 13 | `evt_xianxianshan_passed_over` | 先贤掸不得代 | 匈 | 否 | `""` | — |
| 14 | `evt_dig_well_build_fort` | 穿井筑城之议 | 匈 | 否 | `""` | — |
| 15 | `evt_sacrifice_captive` | 祠兵与招降 | 匈 | 否 | `""` | — |
| 16 | `evt_resentful_ghost` | 冤魂作祟 | 匈 | 否 | `""` | — |
| 17 | `evt_loulan_plea_yixun` | 鄯善新王请屯伊循 | 汉 | 否 | `""` | — |
| 18 | `evt_laidan_killed` | 赖丹之死（龟兹杀校尉） | 汉 | **是** | `""` | `evt_trigger_tuntian_backlash` |
| 19 | `evt_forged_edict_self_impeach` | 矫制自劾 | 汉 | 否 | `"jiaozhao"` | — |
| 20 | `evt_white_disaster_collapse` | 塞外大雨雪（白灾瓦解） | 匈 | **是** | `"baizai"` | `evt_white_disaster` |
| 21 | `evt_five_chanyus_omen` | 诸王乖离·分裂之兆 | 匈 | **是** | `""` | — |
| 22 | `evt_tribute_submission_debate` | 称臣之议 | 匈 | 否 | `""` | — |
| 23 | `evt_white_horse_oath` | 刑白马之盟 | 汉 | 否 | `"jiaozhao"` | — |
| 24 | `evt_suiyuan_bizhu` | 犯强汉者，虽远必诛 | 汉 | **是** | `"jiaozhao"` | `evt_shache_rebellion` |
| 25 | `evt_loulan_assassination` | 傅介子刺楼兰王 | 汉 | **是** | `"king_slain"` | — |
| 26 | `evt_rizhu_estranged` | 日逐王不肯会蹛林 | 匈 | **是** | `""` | — |
| 27 | `evt_rizhu_offers_surrender` | 日逐王遣使请降 | 汉 | **是** | `"rizhu"` | `evt_rizhu_surrender_offer`, `evt_tribe_offers_surrender` |
| 28 | `evt_rizhu_surrender_complete` | 都护迎日逐·罢僮仆都尉 | 汉匈 | 否 | `"rizhu"` | — |
| 29 | `evt_chanyu_succession` | 单于庭大位更替 | 匈 | **是** | `"chanyu_die"` | — |
| 30 | `evt_five_generals_wusun` | 解忧上书·五将军助乌孙 | 汉 | **是** | `"wusun_war"` | `evt_wusun_joint_war` |
| 31 | `evt_su_wu_shepherd` | 苏武北海牧羊 | 汉匈 | 否 | `""` | — |
| 32 | `evt_jinche_chijie` | 冯嫽锦车持节 | 汉 | 否 | `""` | — |
| 33 | `evt_censor_inspection` | 绣衣直指巡边 | 汉 | 否 | `""` | — |
| 34 | `evt_convict_mutiny_merchant` | 七科谪怨哗与商路惊扰 | 汉 | 否 | `""` | — |
| 35 | `evt_beacon_neglected` | 亭卒猎兽·烽火乏 | 汉 | 否 | `""` | — |
| 36 | `evt_han_defector_metallurgy` | 汉降卒教铸兵刃 | 匈 | 否 | `""` | — |
| 37 | `evt_wowu_heavenly_horse` | 渥洼神马出敦煌 | 汉 | 否 | `""` | — |
| 38 | `evt_kangju_complaint` | 康居使者讼不平 | 汉 | 否 | `""` | — |
| 39 | `evt_tongpu_tax_revolt` | 西域小国苦僮仆重敛 | 汉匈 | 否 | `""` | — |
| 40 | `evt_qiuzi_heqin_ceremony` | 龟兹王绛宾慕汉仪 | 汉 | 否 | `""` | — |

---

### 5.6 节点语义标签权威对照表（16 个核心战术语义标签，`data/ai_profiles.json → node_semantics`）

> **遵守圣经 §5**：`ai/*.gd` 与 `core/*.gd` 严禁硬编码节点 ID，一律通过 `AIUtils.get_nodes_by_tag(state, tag)` 查询以下 **16 个核心语义标签**（完整 42 节点逐一挂载表见 `S08 §3.2`）：

| # | 核心语义标签 ID (`tag`) | 战略含义与 AI / 规则用途 | 匹配的节点 ID 集合（共覆盖全部 42 节点） |
|---|---|---|---|
| 1 | `han_capital` | 汉帝国中枢、无限粮源、奏疏/诏令收发原点 | `["chang_an"]` |
| 2 | `hexi_commandery` | 河西四郡核心城（汉失城扣功业 `-15`，匈奴路径 A 主胜目标） | `["wu_wei", "zhang_ye", "jiu_quan", "dun_huang"]` |
| 3 | `convict_recruit` | 允许招募七科谪罪人兵（`convict`）的汉直辖城（对齐 `R-05`） | `["chang_an", "wu_wei", "zhang_ye", "jiu_quan", "dun_huang"]` |
| 4 | `frontier_gate` | 汉西出西域的南北两关门户与驿传咽喉 | `["yumen_guan", "yang_guan"]` |
| 5 | `beacon_priority` | 汉 AI 最高优先级修筑烽燧、匈奴 AI 优先拔亭障的关键节点 | `["ju_yan", "yumen_guan", "yang_guan"]` |
| 6 | `xn_core` | 匈奴漠北王庭与圣地核心（失守触发威服重罚） | `["chanyu_ting", "long_cheng", "youxian_wang"]` |
| 7 | `staging_xn` | 匈奴南下叩塞或西进争霸的五大机动集结基地 | `["zhaoxin_cheng", "fanfuren_cheng", "youxian_wang", "hu_jie", "yi_wu"]` |
| 8 | `merit_hub` | 西域三大战略枢纽（汉功业 `$G_{hub}$` / 匈威服 `$W_{hub}$` 核心加分点） | `["lou_lan", "wu_lei", "cheshi_qian"]` |
| 9 | `duhu_seat_target` | 西域都护府预定治所（联名奉表请置都护目标点） | `["wu_lei"]` |
| 10 | `tongpu_seat` | 匈奴僮仆都尉默认治所与日逐王迎降核心点 | `["yan_qi"]` |
| 11 | `tuntian_prime` | 汉西域首选高产屯田核心基地（渠犁/伊循） | `["lun_tai", "lou_lan"]` |
| 12 | `tuntian_eligible` | 全部允许校猎立屯的西域绿洲城邦节点 | `["lou_lan", "qie_mo", "wei_li", "wu_lei", "lun_tai", "cheshi_qian"]` |
| 13 | `ambush_road` | 沙漠/戈壁险段，匈奴游骑高频设伏截粮点 | `["yang_guan", "yi_wu", "lou_lan", "jing_jue"]` |
| 14 | `citystate_north` | 天山南麓北道城邦群 | `["dong_qiemi", "cheshi_qian", "cheshi_hou", "yan_qi", "wei_li", "wu_lei", "lun_tai", "qiu_ci", "gu_mo", "wen_su", "shu_le"]` |
| 15 | `citystate_south` | 昆仑北麓南道与葱岭城邦群 | `["lou_lan", "qie_mo", "jing_jue", "yu_tian", "sha_che", "juan_du", "xiu_xun"]` |
| 16 | `great_power_capital` | 西域五大国王庭/都城节点 | `["chi_gu", "da_wan", "kang_ju", "da_yuezhi", "ji_bin"]` |

---

## 第 6 章：每旬 / 每月 / 每季 / 每年结算主循环（`core/turn_resolver.gd`）精确调用顺序表

> **架构铁律**：为彻底消除各子系统结算先后次序导致的数值竞态（Race Condition），`core/turn_resolver.gd` 必须严格按照下表定义的 **Phase 0 → Phase 6** 顺序单线程确定性执行，所有随机抽样统一消费 `state.rng`。

### 6.1 剧本载入初始化阶段（`Phase 0: Scenario Init`，`tick == 0` 下令前执行一次）

| 步骤序号 | 调用函数 | 所属模块 | 精确职责说明 |
|---|---|---|---|
| **Init-1** | `ScenarioLoader.load_scenario(state, path, seed, decision_ticks)` | `S01` | 读取 `data/scenario_mvp.json` 基线并合并 `scenarios/*.json` 增量补丁，初始化 `rng`、`factions`、`nodes`、`routes`、`relations`、`armies`、`central`、`han_horse_pool`、`han_convict_pool` |
| **Init-2** | `Characters.init_scenario(state, scn_data)` | `S06` | 初始化 `state.characters`（设置初始登场人物 `status="active"`、驻地 `at_node`、持节者 `is_jie_holder` 与军队初始 `commander_id`） |
| **Init-3** | `Court.init_scenario(state)` | `S02` | 初始化 `state.court`，立即发放首季朝廷拨款与首季中央军额度，生成开局自带诏令并置为 `"pending_response"` |
| **Init-4** | `Tribes.init_scenario(state, scn_data)` | `S03` | 初始化 `state.tribes`、四部 `units`、僮仆都尉护卫军及首季 3 张候选战术卡 |
| **Init-5** | `EventEngine.init_scenario(state, scn_data)` | `S06` | 载入 `scheduled_events`，执行 T1 季初开场叙事事件检定（如 `#01 李将军迷道`） |
| **Init-6** | `Fog.step_day(state)` | `S05` | 刷新 Tick 0 初始视野传感器与迷雾估计表 `intel_estimates` |
| **Init-7** | `Victory.init_scenario(state, scn_data)` | `S01` | 记录开局人口/马匹基线快照，计算初始功业 $G_0$ 与威服 $W_0$ |

---

### 6.2 季初准备阶段（`Phase 1: Quarter Start`，当 `state.tick % 9 == 0` 且 `state.tick > 0` 时，在玩家/AI 下令前执行）

| 步骤序号 | 调用函数 | 所属模块 | 精确职责说明 |
|---|---|---|---|
| **QS-1** | `Supply.year_start(state)` *(仅当 `state.month() == 1` 正月初)* | `S05` | 每年 Q1 岁首：恢复国家马匹池与七科谪罪人池，清零 `convicts_levied_year` |
| **QS-2** | `Court.quarter_start(state)` | `S02` | 依次执行：① 信任怠政衰减与财匮度衰减（`-6`）；② 更新 `trust_band` 与监军进退；③ 检定朝廷风向转换（`wudi_early / luntai / huoguang / xuandi`）；④ 发放本季朝廷拨款、诏书津贴并刷新 `central_quota_remaining`；⑤ 诏令生成器按 `court_snapshot` 签发新诏令；⑥ 从持节者节点发出本季《上计簿》 |
| **QS-3** | `Tribes.quarter_start(state)` | `S03` | 依次执行：① 递减战术卡冷却、白灾瓦解期、继承危机期、僮仆复置冷却；② 清空上季激活战术卡与弹压标记，抽取本季 3 张候选战术卡；③ 触发当季专属年会（Q1 正月诸长小会 / Q2 五月龙城大会 / Q3 秋季蹛林大会） |
| **QS-4** | `EventEngine.on_season_start(state)` | `S06` | 递减事件冷却，唤醒到期事件链，扫描 `season_start` 触发器（含监听 `tuntian_pressure >= 60` 触发 `evt_laidan_killed`），应用 `S01-R12` 大事件配额保底，将最多 2 条事件推入 `pending_queue` |
| **QS-5** | `SummaryAdvisor.get_top_3_todos(state, player_faction)` | `S07` | 汇总上一季《本季纪事》与本季待办 3 件事，向玩家弹出 `ModalSeasonSummary` 与待决事件卷轴 |

---

### 6.3 决策与即时命令结算阶段（`Phase 2: Order Submission & Validation`，玩家点击「结束本季」后执行）

| 步骤序号 | 调用函数 | 所属模块 | 精确职责说明 |
|---|---|---|---|
| **ORD-1** | `HanAI.think(state)` / `XiongnuAI.think(state)` | `S08` | 非玩家控制的阵营通过零特权迷雾接口生成本回合命令列表，合并入 `orders[faction]` |
| **ORD-2** | 计划类命令优先排序与洗牌 | ` TurnResolver` | 将 `orders` 展开：先执行事件响应命令 `resolve_event_option`，再执行 `set_plan`（含 `submit_plan`），最后用 `state.rng` 随机洗牌双方其余即时内政/外交/后勤命令 |
| **ORD-3** | `Commands.validate(state, cmd)` $\to$ `Commands.apply(state, cmd)` | `Commands` | 逐条校验并执行命令，扣减资源或生成在途文书/使团/补给线；失败命令记入 `rejected` 返回给 UI |

---

### 6.4 旬循环与每日子步阶段（`Phase 3: Tick & Daily Loop`，每个决策回合循环 `decision_ticks` 旬，每旬内循环 `day = 0..9`）

| 步骤序号 | 执行时机 | 调用函数 | 所属模块 | 精确职责说明 |
|---|---|---|---|---|
| **DAY-0** | 每旬首日 (`day == 0` 最前) | `SupplyLines.dispatch_tick(state)` | `S05` | 清空各军 `foraged_this_tick`；按优先级逆推各条 `SupplyLine` 流量需求，自动征调民夫派发或解散运粮车队 |
| **DAY-1** | 每日 (`day 0..9`) | `PlanExecutor.move_all(state, 1.0)` | `S05` | 推进所有军队按日移动 1 天；当军队抵达非己方补给点节点时立即回调 `Supply.try_forage_on_arrival(state, army, node_id)`（按 `S04` 意愿 $W$ 分 75/50/30 四档执行献粮/平买/强征/掠食并回写反馈） |
| **DAY-2** | 每日 (`day 0..9`) | `Court.step_day(state)` | `S02` | 推进所有在途文书 `Document` 沿古道移动 1 天（河西置邮 `4.0` / 塞外单骑 `2.0`），检定敌军截获，递减尚书台议处天数 `deliberation_days_left`，兑现当日抵京或抵持节者节点的文书效果 |
| **DAY-3** | 每日 (`day 0..9`) | `Combat.resolve_encounters(state)` | `S05/S03/S06` | 结算同节点/同路段野战遭遇（接入 `Characters.get_commander_stats` 统率/特性、`Tribes.get_active_combat_modifiers` 战术卡/单于亲征、缺马步战折算）；战后回调：`Victory.record_battle_milestone`、`Characters.roll_battle_fate`、若击败僮仆护卫军则回调 `Tribes.on_tongpu_escort_defeated` |
| **DAY-4** | 每日 (`day 0..9`) | `Siege.tick(state, 1.0)` | `S05/S04` | 推进每日围城消耗与强攻；若城破则回调 `Diplomacy.on_citystate_captured(state, sid, attacker, policy)` 与 `SupplyLines.on_node_captured` |
| **DAY-5** | 每日 (`day 0..9`) | `Supply.step_day(state)` | `S05` | 扣除军队日口粮、结算沙漠/严冬行军损耗、战马日损耗与下马骑兵折算、罪人兵塞外日逃亡，并将断粮饿死人数单列累加至 `army.starved_losses` 与 `state.stats.han_starved_deaths`；清空兵力归零的军队 |
| **DAY-6** | 每日 (`day 0..9`) | `Tuntian.step_day(state)` | `S05` | 累加正在校猎测地节点的 `tuntian_survey_days`（满 30 日升 `tuntian_stage = 1`） |
| **DAY-7** | 每日 (`day 0..9`) | `Fog.step_day(state)` | `S05` | 推进烽燧建造/拔除剩余天数，投递到期的斥候/烽火报告至 `intel_estimates`，扫描全图视野源生成新报告 |
| **DAY-8** | 每日 (`day 0..9`) | `PlanExecutor.check_triggers(state)` | `S05` | 检查军队计划触发器（`enemy_near` 严格只读本军即时视野与 `Fog.get_perceived_armies`） |

---

### 6.5 每旬末结算阶段（`Phase 4: Tick End`，每旬第 10 天 `day == 9` 日步走完后执行）

| 步骤序号 | 调用函数 | 所属模块 | 精确职责说明 |
|---|---|---|---|
| **TE-1** | `Diplomacy.tick_missions(state, 10.0)` | `S04` | 推进在途汉使团 `Mission` 移动 10 天、检定匈奴截获或安归遮杀、处理抵达王庭宣谕与副使分遣 |
| **TE-2** | `Tribes.tick_end(state)` | `S03` | 推进僮仆都尉护卫军巡行收税；递减部王降汉动摇窗口 `wavering_turns_left` 并检定汉军迎降或单于平叛；若为本季第 2 旬则检定低忠部族擅自出兵（`rogue_raid`） |
| **TE-3** | `Court.tick_end(state)` | `S02` | 汇总本旬发生的破敌、陷城、将亡、城邦臣服/杀使事件生成《捷报》或《边报》发往长安；检查生效中诏令是否达成目标或逾期 |
| **TE-4** | `EventEngine.on_tick_end(state)` | `S06` | 检查旬末即时事件窗口（如日逐王迎降达成唤醒 `evt_rizhu_surrender_complete`） |

---

### 6.6 每月末、每季末与每年末结算阶段（`Phase 5 & 6: Month / Quarter / Year End`，当 `day == 9 and Cal.is_month_end(state.tick)` 时按序执行）

| 步骤序号 | 触发条件 | 调用函数 | 所属模块 | 精确职责说明 |
|---|---|---|---|---|
| **ME-1** | 每月末 (`tick % 3 == 2`) | `Economy.monthly(state)` | 基线/S05 | 节点月度人口自然增减、守备恢复；**若 `state.month() == 8`（八月末），额外执行 `Economy.autumn_harvest(state)` 结算河西农田与西域屯田秋收** |
| **ME-2** | 每月末 (`tick % 3 == 2`) | `Siege.monthly(state)` | 基线/S05 | 围城月度守军粮耗与断粮饥荒判定 |
| **ME-3** | 每月末 (`tick % 3 == 2`) | `SupplyLines.month_end(state)`<br>`Tuntian.month_end(state)`<br>`Fog.month_end(state)` | `S05` | 更新补给线 30 日滚动运量、更新西域邻国 `tuntian_pressure`、扣除激活烽燧月维护费 |
| **ME-4** | 每月末 (`tick % 3 == 2`) | `Diplomacy.monthly(state)`<br>`Trade.monthly(state)`<br>`Buffs.tick(state)` | `S04`/基线 | 依次执行 `S04 §4.2` Step M1..M6：驻军威吓/军威辐射、僮仆月度税怨、影响力锚点衰减、丝路商道吞吐与商税（乘 `Convict.get_trade_tax_mult`）、常驻使团维护、重算 23 国 `tilt` 与 `supply_stance` |
| **QE-1** | **仅每季末** (`tick % 9 == 8`，即 3/6/9/12 月末) | `Diplomacy.quarter_end(state)`<br>`CityStateAI.evaluate_quarter_end(state)` | `S04/S08` | 执行 `S04 §4.2` Step S1..S5：饱足度衰减、王室派系漂移、清理过期罪状与请愿、执行 23 国季度末自主行为（请封/两属/禁商/倒戈）、递减外交冷却；若为 12 月末则清零 `recruited_missions_this_year` |
| **QE-2** | **仅每季末** (`tick % 9 == 8`) | `Tribes.quarter_end(state)` | `S03` | 发放单于本部牧产基础折钱；**若为 Q4 季末（12 月末），执行冬季白灾大雪检定（`S03-R09`）与单于年度寿元/伤病检定（`S03-R06`）**；结算四部季度忠诚度总更新与威望回归；更新 `scatter_consecutive_turns` |
| **QE-3** | **仅每年末** (`state.month() == 12` 末) | `Characters.year_end_mortality_check(state)` | `S06/S02` | 执行全图在场人物年度寿元与健康检定；清零 `tribute_horses_year`、`tribute_treasure_year`、`convicts_ransomed_season` |
| **QE-4** | **仅每季末** (`tick % 9 == 8`) | `Chronicle.compile_season_annals(state)` | `S06` | 汇总本季重大战事、诏令、外交、灾害生成 3–6 条《汉书》编年体纪事存入 `chronicle.season_entries` 并归档至 `history_annals` |
| **ME-5** | 每月末 (`tick % 3 == 2`，**排在所有月/季末逻辑最后**) | `Victory.monthly(state)` | `S01` | 严格执行 `S01-R01` Step 1..6：① 季末衰减事件池（12 月末清零 `yearly_award_counts`）；② 重算汉功业 $G$ 与匈威服 $W$ 并检查易手率 `lead_changes_count`；③ 更新双方维持月数 `han_hold_months` / `xn_hexi_hold_months` / `xn_weifu_hold_months`；④ 检定政治崩盘失败（`HAN_RECALL` / `XN_SCATTER` / `MUTUAL_COLLAPSE`）；⑤ 检定双方主胜利；⑥ 检定剧本到期连续计分与史官五档评定 |
