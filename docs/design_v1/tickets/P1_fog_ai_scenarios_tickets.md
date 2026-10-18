# 《西域·汉匈争霸》v1.0 原子工单分册 P1：迷雾、预演、零特权 AI、三大剧本与史官叙事（T13–T18）

> **权威基准**：本分册严格对齐 [`01_cross_review_and_registry.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/01_cross_review_and_registry.md) 与 [`S10_implementation_plan.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/S10_implementation_plan.md)。

---

## 工单 T13：`Pathfinding.courier_dijkstra` 与 `Fog` 五级迷雾、亭燧修拔及 `get_perceived_state`

### ① 目标与前置依赖
- **目标**：在 `core/pathfinding.gd` 中新增驿传最短路计算 `courier_dijkstra`；新建 `core/fog.gd`（类名 `Fog`），实现五级战争迷雾（`L0_UNKNOWN`..`L4_EXACT`）、亭燧修筑（`build_beacon`）与匈奴焚拔亭燧（`raze_beacon`）、确定性情报误差带采样，以及供 AI 与 UI 共用的零作弊感知视图接口 `Fog.get_perceived_state(state, faction)`。
- **前置依赖**：`T01`、`T02`、`T12`。

### ② 必读设计规范定位
- `docs/design_v1/01_cross_review_and_registry.md`：第 1 章 `[E-22]`、第 2.1 节 `state.intel_estimates`、第 2.2 节 `node.beacon_level`/`beacon_hp`/`fog_level`、第 3.1 节 `build_beacon`、第 3.2 节 `raze_beacon`、第 4.1 节 `Pathfinding.courier_dijkstra`、第 4.7 节 `core/fog.gd`。
- `docs/design_v1/S05_logistics_military_fog.md`：`S05-R05`（五级迷雾可见性规则、误差带、延迟）、`S05-R06`（修筑烽燧与焚拔亭障）。

### ③ 新建/修改文件精确路径
- **修改**：`core/pathfinding.gd`
- **新建**：`core/fog.gd`

### ④ 数据结构与 JSON 完整样板
```gdscript
# state.intel_estimates[faction][est_id] 结构（暴露给 AI/UI 时必须 erase("true_army_id")）：
{
	"est_id": "est_xn_1",
	"true_army_id": "xn_1",
	"last_seen_node": "yi_wu",
	"last_seen_tick": 9,
	"est_troops_min": 6400,
	"est_troops_max": 9600,
	"est_troops_mid": 8000,
	"confidence_level": 2,
	"is_ghost": false
}
```

### ⑤ 函数级实现说明书

#### 5.1 `core/pathfinding.gd` 扩展
1. **`static func courier_dijkstra(state: GameState, from_node: String, to_node: String, speed_mult: float) -> Dictionary`**
   - 以节点间道路基础天数 `edge_days / maxf(0.1, speed_mult)` 为边权，对敌方军团驻守节点施加 `+15.0` 日绕行惩罚，计算 `from_node` 至 `to_node` 的最短驿传路径。
   - 返回 `{"reachable": bool, "path": Array[String], "base_days": float, "effective_days": float}`。

#### 5.2 `core/fog.gd`（类名 `Fog`）
1. **`static func step_tick(state: GameState) -> void`**
   - 对 `"han"` 与 `"xiongnu"` 双方分别重算全图 42 个节点的可见性等级 `L0..L4`：
     - **L4 (`4`, 精确可见，误差 0%)**：己方控制节点、己方军队所在节点、己方在途使团所在节点、或有 `beacon_level >= 2` 且 `beacon_hp > 0` 的节点。
     - **L3 (`3`, 斥候/邻接视野，误差 $\pm 15\%$)**：距离己方军队/控制城池/使团 1 跳以内，或有 `beacon_level == 1` 的节点及其 1 跳邻接节点。
     - **L2 (`2`, 属国/通商耳目，误差 $\pm 30\%$，延迟 1 旬)**：己方 `vassal` / `tributary` 城邦节点，或距離 L3/L4 节点 1 跳以内节点。
     - **L1 (`1`, 传闻盲区，误差 $\pm 50\%$，延迟 2 旬)**：距离 L2 节点 1 跳以内节点。
     - **L0 (`0`, 完全未知)**：其余深处节点。
   - 遍历敌方所有野战军，根据所在节点的可见性等级更新 `state.intel_estimates[viewer_faction]`：
     - 若 `level >= 1`，用确定性伪随机哈希 `h = fmod(float(state.seed * 31 + state.tick * 17 + army_id.hash()), 200.0) / 100.0 - 1.0` 乘以对应等级误差率（`L4: 0.0, L3: 0.15, L2: 0.30, L1: 0.50`）以及难度迷雾系数 `difficulty_fog_mult`，生成 `est_troops_mid`、`est_troops_min`、`est_troops_max`。
     - 若敌军使用了 `TC01_feigned_retreat`（诈败诱敌），在目标邻接节点额外注入 1 条 `is_ghost = true` 的假军情估计。
2. **`static func get_node_visibility(state: GameState, faction: String, node_id: String) -> int`**
   - 返回 `0..4`。
3. **`static func get_perceived_state(state: GameState, faction: String) -> Dictionary`**
   - 返回深拷贝感知字典：`{"visible_nodes": Dictionary, "enemy_estimates": Array[Dictionary], "tribe_loyalty_bands": Dictionary}`。
   - **安全过滤**：对 `enemy_estimates` 中每个字典执行 `.duplicate(true)` 并调用 `est.erase("true_army_id")`。
4. **`static func validate_build_beacon(state: GameState, cmd: Dictionary) -> String`** 与 **`apply_build_beacon(state: GameState, cmd: Dictionary) -> void`**
   - 校验节点受汉控制或有汉军驻扎，`beacon_level < 2`，金钱 `>= 150`（L1）或 `>= 250`（L2）。
   - 执行扣款，`node.beacon_level += 1`，`node.beacon_hp = 100.0`。
5. **`static func validate_raze_beacon(state: GameState, cmd: Dictionary) -> String`** 与 **`apply_raze_beacon(state: GameState, cmd: Dictionary) -> void`**
   - 校验匈奴军团位于 `cmd.node_id` 且该节点 `beacon_level > 0`。
   - 执行：`node.beacon_level = 0`，`node.beacon_hp = 0.0`，匈奴获得劫掠赏赐池 `+80`，立即调用 `Fog.step_tick(state)` 使汉方失去该节点烽燧视野。

### ⑥ 禁止事项（Guardrails）
- **严禁**在 `get_perceived_state` 返回给 AI 的字典中保留 `true_army_id` 或真实兵力字段（遵守圣经 `L8`/`L9` 零作弊铁律）。

### ⑦ 验收测试代码与一键验收命令
```gdscript
func test_T13_fog_and_beacons() -> void:
	var s := new_state(9)
	Fog.step_tick(s)
	var vis_ca := Fog.get_node_visibility(s, "han", "chang_an")
	var vis_cy := Fog.get_node_visibility(s, "han", "chanyu_ting")
	_assert(vis_ca == 4 and vis_cy <= 1, "T13: chang_an is L4 and chanyu_ting is L0/L1 for Han")
	var p_view := Fog.get_perceived_state(s, "han")
	for est in p_view["enemy_estimates"]:
		_assert(not est.has("true_army_id"), "T13: perceived state must strip true_army_id [E-22]")
	_assert(Fog.validate_build_beacon(s, {"node_id": "dun_huang", "target_level": 1}) == "", "T13: validate build_beacon")
	Fog.apply_build_beacon(s, {"node_id": "dun_huang", "target_level": 1})
	_assert(int(s.nodes["dun_huang"]["beacon_level"]) >= 1, "T13: beacon built at dun_huang")
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T13
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---

## 工单 T14：`Preview` 0–18 旬余粮折线图、不归点与敌军 30/60/90 日威胁圈

### ① 目标与前置依赖
- **目标**：新建 `core/preview.gd`（类名 `Preview`），提供零副作用（Zero-Side-Effect）的行军计划 0–18 旬余粮预测曲线、不归点（Point of No Return）计算、守军就地食城粮修正，以及基于 `Fog.get_perceived_state` 的敌军 30/60/90 日可达威胁圈推演。
- **前置依赖**：`T08`、`T09`、`T10`、`T13`。

### ② 必读设计规范定位
- `docs/design_v1/01_cross_review_and_registry.md`：第 4.8 节 `core/preview.gd`。
- `docs/design_v1/S05_logistics_military_fog.md`：`S05-R08`（计划预演逐旬粮食曲线与敌军可达威胁圈伪代码）。
- `docs/design_v1/S07_ux_onboarding.md`：`S07-R08`（计划编辑器余粮折线图与不归点红线 UI 契约）。

### ③ 新建/修改文件精确路径
- **新建**：`core/preview.gd`

### ④ 数据结构与返回值完整样板
```gdscript
# Preview.simulate_food_curve(state, army_id, steps, preset) 返回结构：
{
	"points": [
		{"tick_offset": 0, "node_id": "dun_huang", "grain_Start": 45000.0, "eaten": 4200.0, "foraged": 0.0, "depot_resupplied": 0.0, "grain_end": 40800.0, "forage_tier": "SELF_DEPOT"}
	],
	"starve_tick": -1,               # 若 18 旬内不会断粮则为 -1，否则为首次 grain_end <= 0 的旬偏移 0..18
	"point_of_no_return_tick": 6,    # 超过此旬后即便立即掉头返回最近粮仓也会在途中饿死
	"return_depot_node": "dun_huang",
	"uses_city_grain_as_garrison": false
}
```

### ⑤ 函数级实现说明书

#### 5.1 `core/preview.gd`（类名 `Preview`）
1. **`static func simulate_food_curve(state: GameState, army_id: String, steps: Array, preset: String) -> Dictionary`**
   - **只读隔离**：仅读取 `state.armies[str(army_id)]` 的初始位置、兵力、民夫、马匹与携粮，在局部轻量变量 `sim_node`, `sim_grain`, `sim_ticks` 上推演 `tick_offset = 0..18`（180 天，跨 2 季）。
   - **守军食城粮修正（`S05-R07`）**：若军队处于己方控制城池且 `preset == "garrison"`（或无移动计划），标记 `uses_city_grain_as_garrison = true`，每旬消耗计入城仓余量而非随军 `army.grain`（解决旧版携粮为 0 误报断粮的问题）。
   - **行军与沿途供粮推演**：每旬按 `steps` 推进节点位置：
     - 若位于己方粮仓节点（`state.is_supply_node`），自动补满至随军携带上限 `carry_cap`。
     - 若到达西域城邦节点，调用只读 `Diplomacy.get_forage_willingness(state, state_id, army_id)` 预估该城邦的供粮档位（`WELCOME`/`MARKET`/`REFUSE`/`HOSTILE`）并计入 `foraged`。
     - 计算从当前模拟节点返回最近己方粮仓所需的往返口粮 `grain_to_return`；当 `sim_grain < grain_to_return` 首次成立时，记录 `point_of_no_return_tick = tick_offset`。
     - 当 `sim_grain <= 0.0` 首次成立时，记录 `starve_tick = tick_offset`。
2. **`static func compute_threat_rings(state: GameState, viewer_faction: String) -> Dictionary`**
   - 调用 `Fog.get_perceived_state(state, viewer_faction)` 获取感知到的敌军估计列表 `enemy_estimates`。
   - 对每支感知到的敌军，从其 `last_seen_node` 出发运行 Dijkstra，计算 30 日（`ring_30d`）、60 日（`ring_60d`）、90 日（`ring_90d`）内可达的节点集合及最大预计威胁兵力 `est_troops_max`，返回：
     `{"ring_30d": Dictionary, "ring_60d": Dictionary, "ring_90d": Dictionary}`。

### ⑥ 禁止事项（Guardrails）
- **严禁**在 `Preview.simulate_food_curve` 或 `Preview.compute_threat_rings` 中修改 `state` 的任何字段或消耗 `state.rng` 随机数。

### ⑦ 验收测试代码与一键验收命令
```gdscript
func test_T14_preview_food_curve_and_threat_rings() -> void:
	var s := new_state(9)
	Fog.step_tick(s)
	var g0 := float(s.armies["han_1"]["grain"])
	var steps := [{"type": "move_to", "node": "lou_lan"}, {"type": "move_to", "node": "wu_lei"}]
	var curve := Preview.simulate_food_curve(s, "han_1", steps, "balanced")
	_assert(curve["points"].size() == 19, "T14: food curve simulates 0..18 ticks (19 points)")
	_assert(float(s.armies["han_1"]["grain"]) == g0, "T14: simulate_food_curve must not mutate state")
	var rings := Preview.compute_threat_rings(s, "han")
	_assert(rings.has("ring_30d") and rings.has("ring_60d") and rings.has("ring_90d"), "T14: threat rings 30/60/90d")
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T14
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---

## 工单 T15：`AIBlackboard` 与 42 节点语义标签、汉方三阶段功业效用 AI

### ① 目标与前置依赖
- **目标**：扩展 `data/ai_profiles.json`（含 42 节点语义标签字典 `node_tags`、3×3 性格权重表、三档难度修正表），升级 `ai/ai_utils.gd`（类名 `AIUtils`，实现 `AIBlackboard` 与零特权迷雾感知工具函数），并重构 `ai/han_ai.gd`（类名 `HanAI`），实现 S08 汉方三阶段功业效用 AI（含诏令应对、自动补给线管理、精使/募使派遣、断粮红灯硬拦截、迎降日逐王）。
- **前置依赖**：`T04`、`T05`、`T07`、`T09`、`T12`、`T13`、`T14`。

### ② 必读设计规范定位
- `docs/design_v1/01_cross_review_and_registry.md`：第 1 章 `[E-22]`、第 2.1 节 `state.ai_blackboard`、第 4.13 节 `ai/*.gd`、第 5.6 节（42 节点 16 个语义标签权威映射表）。
- `docs/design_v1/S08_ai.md`：`S08-R01`（零特权迷雾感知）、`S08-R02`（效用评分模型）、`S08-R03` 与 `S08-R04`（汉方三阶段 AI 伪代码与粮道红灯拦截）。

### ③ 新建/修改文件精确路径
- **修改**：`data/ai_profiles.json`
- **修改**：`ai/ai_utils.gd`
- **修改**：`ai/han_ai.gd`

### ④ 数据结构与 JSON 完整样板
在 `data/ai_profiles.json` 中新增：
1. `"node_tags"`：将 `01_cross_review_and_registry.md` 第 5.6 节的 16 个语义标签（`TAG_IMPERIAL_CAPITAL`, `TAG_HEXI_CORRIDOR`, `TAG_EAST_GATE_HUB`, `TAG_PROTECT_SEAT_CANDIDATE`, `TAG_NORTH_CHOKENODE`, `TAG_SOUTH_HUB`, `TAG_TARIM_CORE`, `TAG_TUNTIAN_PRIME`, `TAG_STEPPE_CORE`, `TAG_STEPPE_ASSEMBLY`, `TAG_XN_EAST_WING`, `TAG_XN_WEST_WING`, `TAG_TONGPU_SEAT`, `TAG_GRAND_ALLY_WUSUN`, `TAG_HORSE_SOURCE_DAWAN`, `TAG_OUTER_GREAT_POWER`）映射到全部 42 个节点。
2. `"personalities"`：汉方 3 种性格（`han_pioneer`, `han_methodical`, `han_schemer`）与匈奴 3 种性格（`xn_iron_tyrant`, `xn_conciliatory_elder`, `xn_greedy_raider`）的效用权重乘数。
3. `"difficulties"`：三档难度（`easy`, `normal`, `hard`）的搜索深度与战术协同参数（**零资源作弊**）。

### ⑤ 函数级实现说明书

#### 5.1 `ai/ai_utils.gd`（类名 `AIUtils`）
1. **`static func get_nodes_by_tag(state: GameState, tag: String) -> Array[String]`**
   - 从 `state.ai_profiles["node_tags"]` 查询具有指定语义标签的节点列表（彻底取代旧代码中硬编码的 `HEXI` / `PRIORITY` 常量）。
2. **`static func perceived_threat_at(state: GameState, viewer_faction: String, node_id: String, horizon_days: float) -> float`**
   - 调用 `Fog.get_perceived_state(state, viewer_faction)`，仅根据 `enemy_estimates` 的 `last_seen_node` 与 `est_troops_mid + risk_aversion * (est_troops_max - est_troops_mid)` 估算威胁，**严禁直读 `state.armies` 中的敌方军团**。

#### 5.2 `ai/han_ai.gd`（类名 `HanAI`）
1. **`static func plan_turn(state: GameState) -> Array[Dictionary]`**
   - 读取 `p_view := Fog.get_perceived_state(state, "han")` 与当前功业值 `G := float(state.victory.han_merit)`。
   - 确定当前战略阶段：
     - **Stage 1（`G < 35.0`，河西固本与破楼兰禁商）**：优先在 `TAG_HEXI_CORRIDOR` 扩建农田、建立敦煌→楼兰自动补给线、派精使/募使赴 `TAG_EAST_GATE_HUB`（楼兰/姑师）。
     - **Stage 2（`35.0 <= G < 75.0`，经营轮台乌垒与北道争锋）**：在 `TAG_TUNTIAN_PRIME` 勘测并升级军屯、修筑烽燧、派使团册封南道与北道诸国、破袭僮仆都尉在途税队。
     - **Stage 3（`G >= 75.0`，迎降日逐与总攻立都护）**：最高优先级响应 `EV02_rizhu_surrender_offer` 护送先贤掸受降（`+25` 功业并罢僮仆都尉），攻取或册封 `TAG_PROTECT_SEAT_CANDIDATE`（乌垒/车师前）。
   - **诏令应对决策**：若存在 `active_edict`，评估期限内达成率；若达成率 `< 0.35` 且信任 `>= 45`，调用 `bargain_edict`；否则调用 `comply_edict`。若在 Stage 2/3 发现高价值战机（如车师前空虚或日逐王请降）且无朝廷诏令授权，当 `trust >= 58` 时调用 `forge_edict(..., self_impeach = true)`。
   - **远征断粮红灯硬拦截（`S08-R04`）**：在生成任何野战军 `set_plan` 远征指令前，必须先调用 `Preview.simulate_food_curve(state, army_id, steps, preset)`；若返回的 `starve_tick != -1`（预计在 18 旬内发生断粮）且目标不在 `TAG_HEXI_CORRIDOR` 内，**强制拦截该远征指令**，改为先建立/扩容 `establish_supply_line` 或等待屯田秋收！

### ⑥ 禁止事项（Guardrails）
- **严禁**在 `ai/han_ai.gd` 中直接遍历 `state.armies` 获取 `"xiongnu"` 军队的真实节点与兵力，所有敌情判断必须经过 `Fog.get_perceived_state(state, "han")` 或 `AIUtils.perceived_threat_at`。

### ⑦ 验收测试代码与一键验收命令
```gdscript
func test_T15_han_ai_zero_cheat_and_food_interlock() -> void:
	var s := new_state(9)
	Characters.init_scenario(s, {})
	Victory.init_scenario(s, {})
	Court.init_scenario(s)
	Tribes.init_scenario(s)
	SupplyLines.init_scenario(s)
	Tuntian.init_scenario(s)
	EventEngine.init_scenario(s)
	Fog.step_tick(s)
	var cmds := HanAI.plan_turn(s)
	_assert(cmds.size() >= 2, "T15: HanAI generates >= 2 meaningful commands on Q1")
	for c in cmds:
		_assert(Commands.validate(s, c) == "", "T15: every HanAI command must pass Commands.validate: " + str(c))
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T15
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---

## 工单 T16：匈奴防崩盘分赏与双路径效用 AI、城邦自主 AI 与 3×3 性格/三档难度

### ① 目标与前置依赖
- **目标**：重构 `ai/xiongnu_ai.gd`（类名 `XiongnuAI`），实现 S08 匈奴防嫉妒分赏 AI、三次年会决策、季度战术卡选择、动态多集结点（根除旧版 `yi_wu` 背板）以及河西四郡（Path A）vs 西域威服（Path B）双路径效用切换；并在 `core/diplomacy.gd` 中挂载 18 城邦与 5 大国的自主 AI 评分逻辑。
- **前置依赖**：`T04`、`T06`、`T07`、`T12`、`T13`、`T15`。

### ② 必读设计规范定位
- `docs/design_v1/01_cross_review_and_registry.md`：第 4.13 节 `ai/xiongnu_ai.gd`、第 5.6 节（节点语义标签）。
- `docs/design_v1/S08_ai.md`：`S08-R05`（匈奴 AI 全套决策伪代码）、`S08-R06`（18 城邦与 5 大国自主 AI 评分规则）、`S08-R07`（3×3 性格矩阵）、`S08-R08`（三档难度零作弊修正表）。

### ③ 新建/修改文件精确路径
- **修改**：`ai/xiongnu_ai.gd`
- **修改**：`core/diplomacy.gd`（补充 `step_citystate_autonomous_ai(state)`）

### ④ 数据结构与关键算法样板
```gdscript
# 匈奴四部分赏最优解（防嫉妒惩罚 S03-R04 + S08-R05）：
# 对每个非叛降部族 i，基础权重 w_i = max(0.10, (65.0 - est_loyalty_mid[i]) / 100.0 + power_weight[i])
# 归一化后 clamp 到 [0.15, 0.35] 区间，确保 max_ratio - min_ratio <= 0.15（零嫉妒惩罚！）
```

### ⑤ 函数级实现说明书

#### 5.1 `ai/xiongnu_ai.gd`（类名 `XiongnuAI`）
1. **`static func plan_turn(state: GameState) -> Array[Dictionary]`**
   - 读取零特权迷雾感知视图 `p_view := Fog.get_perceived_state(state, "xiongnu")` 与四部可见忠诚区间 `Tribes.get_visible_loyalty_range(state, t_id)`。
   - **Step 1（四部分赏防崩盘博弈）**：
     - 若存在忠诚区间下限 `< 42.0` 的部族（尤其是 `"rizhu"`），或当前季度需例行分赏且 `reward_pool >= 400`，计算防嫉妒分赏比例 `ratios`（控制极差 `<= 0.15` 避免触发其他三部嫉妒掉忠），生成 `distribute_rewards` 命令。
   - **Step 2（三次年会决策）**：
     - 若 `state.month() in [1, 5, 9]`，根据当前 `reward_pool` 与战略路径（Path A 攻河西 vs Path B 威服西域）选择 `hold_assembly` 主题（`oath_sacrifice` / `grand_feast` / `hexi_raid` / `west_submission` / `levy_horses`）。
   - **Step 3（季度战术卡三选一）**：
     - 若 `state.tribes.tactical_card_cooldown == 0`：
       - 若感知到汉军在西域深处远征，优先打出 `TC03_burn_tuntian`（焚田断粮）或 `TC01_feigned_retreat`（诈败诱敌）；
       - 若汉方 `beacon_level >= 1` 节点数 `>= 3`，打出 `TC02_raze_beacons`（拔除亭燧）；
       - 若处于秋高马肥季（Q3）主攻河西，打出 `TC05_autumn_raid`（秋高马肥）。
   - **Step 4（双路径切换与西域威压）**：
     - 比较 Path A 效用（感知到的 `TAG_HEXI_CORRIDOR` 防御薄弱度）与 Path B 效用（当前 `xn_weifu / 100.0` 进度）：
       - 对 `TAG_EAST_GATE_HUB` 与 `TAG_NORTH_CHOKENODE` 城邦执行 `demand_vassal`、`intimidate_city`、`install_prince`；
       - 根据各属国 `xn_resentment` 动态调节 `set_tongpu_tax`（怨恨 `< 42` 时设中税 `2`，怨恨 `>= 55` 时降为轻税 `1` 防叛离）。
   - **Step 5（动态随机加权集结点，破除 `yi_wu` 背板）**：
     - 候选集结点从 `AIUtils.get_nodes_by_tag(state, "TAG_XN_WEST_WING")` 与 `"TAG_XN_EAST_WING"`（如 `youxian_wang`, `yi_wu`, `pu_lei`, `jin_man`）中按距离目标与安全度加权随机抽取（使用 `state.rng`），彻底消除固定集结于伊吾的背板模式。

### ⑥ 禁止事项（Guardrails）
- **严禁**在 `ai/xiongnu_ai.gd` 中硬编码只集结于 `"yi_wu"`，或直接读取 `state.tribes.tribes[id].loyalty` 的精确浮点数（必须读 `Tribes.get_visible_loyalty_range` 的区间）。

### ⑦ 验收测试代码与一键验收命令
```gdscript
func test_T16_xiongnu_ai_and_non_dominant() -> void:
	var s := new_state(9)
	Characters.init_scenario(s, {})
	Victory.init_scenario(s, {})
	Court.init_scenario(s)
	Tribes.init_scenario(s)
	SupplyLines.init_scenario(s)
	Tuntian.init_scenario(s)
	EventEngine.init_scenario(s)
	Fog.step_tick(s)
	var cmds := XiongnuAI.plan_turn(s)
	_assert(cmds.size() >= 1, "T16: XiongnuAI generates valid commands on Q1")
	for c in cmds:
		_assert(Commands.validate(s, c) == "", "T16: every XiongnuAI command must pass Commands.validate: " + str(c))
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T16
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---

## 工单 T17：三大 EA 剧本 `data/scenarios/*.json` 与《楼兰姑师》5 课交互教学状态机

### ① 目标与前置依赖
- **目标**：创建 `data/scenarios/lou_lan_gu_shi.json`（前 108 年教学剧本，12 季）、`data/scenarios/mo_bei_zhi_hou.json`（前 119 年标准主剧本，40 季）、`data/scenarios/du_hu_fu.json`（前 68 年后期剧本，36 季），并在 `core/scenario_loader.gd`（或 `GameState`）中实现剧本 Delta 加载与《楼兰姑师》5 课交互教学检定逻辑。
- **前置依赖**：`T01`、`T02`、`T03`、`T04`、`T12`。

### ② 必读设计规范定位
- `docs/design_v1/01_cross_review_and_registry.md`：第 5.1.F 节（三大剧本 JSON Schema 与增量规则）。
- `docs/design_v1/S01_victory_scenarios.md`：`S01-R07` 至 `S01-R10`（三大剧本开局年份、回合数、节点/关系/军队/人物/资源 JSON 增量表、专属胜利阈值）。
- `docs/design_v1/S07_ux_onboarding.md`：`S07-R11`（《楼兰姑师》5 课逐步交互教学脚本）。

### ③ 新建/修改文件精确路径
- **新建**：
  - `data/scenarios/lou_lan_gu_shi.json`
  - `data/scenarios/mo_bei_zhi_hou.json`
  - `data/scenarios/du_hu_fu.json`
  - `core/tutorial_manager.gd`（类名 `TutorialManager`）
- **修改**：`core/game_state.gd`（支持 `load_scenario_by_id(scenario_id)`）

### ④ 数据结构与 JSON 完整样板
```json
{
  "scenario_id": "lou_lan_gu_shi",
  "title_key": "SCEN_LOULAN_TITLE",
  "subtitle_key": "SCEN_LOULAN_SUB",
  "start_year_bc": 108,
  "start_month": 1,
  "decision_ticks": 9,
  "max_turns": 12,
  "base_scenario": "res://data/scenario_mvp.json",
  "victory_overrides": {
    "han_merit_threshold": 55.0,
    "han_hold_months_req": 3,
    "custom_goal": "subdue_loulan_and_gushi"
  },
  "tutorial_enabled": true,
  "factions_delta": {
    "han": {"money": 3200.0},
    "xiongnu": {"money": 1800.0}
  },
  "relations_delta": {
    "lou_lan": {"han_influence": 20.0, "xn_intimidation": 62.0, "crimes_against_han": [{"type": "CRIME_KILL_ENVOY", "severity": 40.0, "turns_left": 12}]}
  },
  "active_characters": ["zhao_ponu", "wang_hui", "chang_hui", "wushi_lu"]
}
```

### ⑤ 函数级实现说明书

#### 5.1 三大剧本关键配置（`S01-R07..R09`）
1. **`lou_lan_gu_shi.json`（元封三年·前 108 年，12 季）**：
   - 开局楼兰与车师前（姑师）自带 `CRIME_KILL_ENVOY` 罪状；赵破奴、王恢在敦煌统兵；目标为 12 季内令楼兰与车师前全部降服（`overlord == "han"`）或功业 `G >= 55.0`。
2. **`mo_bei_zhi_hou.json`（元狩四年·前 119 年，40 季）**：
   - 标准主沙盒剧本：张骞、霍去病在列，首季拨款后汉钱 `3500.0`（基础 `2000` + 首季拨款 `1500`），楼兰初始威吓 `55.0`；标准 `G >= 100.0` 维持 12 个月立都护府。
3. **`du_hu_fu.json`（地节二年·前 68 年，36 季）**：
   - 郑吉在渠犁/乌垒屯田（乌垒开局已为 `formal` 军屯），常惠在乌孙，日逐王先贤掸初始忠诚 `48.0`、怨望 `45.0`（极易触发 `EV01`/`EV02` 日逐王来降链），车师前为汉匈争夺焦点。

#### 5.2 `core/tutorial_manager.gd`（类名 `TutorialManager`）
1. 实现 5 课状态机（`lesson_idx = 1..5`，存于 `state.tutorial_step`）：
   - **第 1 课（节杖与驿传）**：引导查看竹简诏令《讨楼兰劫使诏》并点击「奉诏领命（`comply_edict`）」。
   - **第 2 课（万里粮道与不归点）**：引导玩家先试着直接拖动赵破奴军团去车师前，在计划编辑器中观察 `Preview.simulate_food_curve` 弹出的红色「断粮饿死 / 不归点」警告，随后引导建立 `dun_huang -> lou_lan` 自动补给线。
   - **第 3 课（精使与有罪讨伐）**：引导派遣王恢使团或赵破奴轻骑，利用楼兰已有 `CRIME_KILL_ENVOY` 罪状执行零信任损耗的有罪讨伐。
   - **第 4 课（城邦给食与善后三策）**：攻破楼兰后，演示 `settle_punitive_war` 选择「更立亲汉新王（`install_king`）」比「屠城威慑（`sack`）」的长期功业收益优势。
   - **第 5 课（烽燧预警与破姑师）**：引导在楼兰修筑烽燧（`build_beacon`）点亮北道迷雾，观察伊吾匈奴骑兵的 30/60/90 日威胁圈，合兵攻克车师前完成教学。

### ⑥ 禁止事项（Guardrails）
- **严禁**复制粘贴整份 `scenario_mvp.json` 到 `data/scenarios/*.json` 中；必须采用 `base_scenario` + `*_delta` 增量覆盖模式，保证地图节点与道路拓扑单一事实来源（SSOT）。

### ⑦ 验收测试代码与一键验收命令
```gdscript
func test_T17_three_scenarios_and_tutorial() -> void:
	for scen_id in ["lou_lan_gu_shi", "mo_bei_zhi_hou", "du_hu_fu"]:
		var s := GameState.new()
		s.load_scenario_by_id(scen_id)
		_assert(s.nodes.size() == 42, "T17: scenario " + scen_id + " loads 42 nodes")
		_assert(s.max_turns in [12, 40, 36], "T17: scenario " + scen_id + " max_turns valid")
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T17
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---

## 工单 T18：`Chronicle` 本季纪事文言/白话生成器与终局《汉书》附传拼装器

### ① 目标与前置依赖
- **目标**：新建 `core/chronicle.gd`（类名 `Chronicle`），实现每季末自动汇总战事、外交、诏令、天灾、人物动向的《本季纪事》（支持史书文言与现代白话双语模板切换），以及终局自动生成《汉书·西域传/匈奴传》体裁的本局人物附传与战报摘要数据。
- **前置依赖**：`T03`、`T04`、`T11`、`T12`。

### ② 必读设计规范定位
- `docs/design_v1/01_cross_review_and_registry.md`：第 2.1 节 `state.chronicle`、第 4.11 节 `core/chronicle.gd`。
- `docs/design_v1/S06_events_characters_narrative.md`：`S06-R07`（本季纪事编年体模板系统）、`S06-R08`（终局《汉书/匈奴列传》附传拼装模板）。

### ③ 新建/修改文件精确路径
- **新建**：`core/chronicle.gd`

### ④ 数据结构与返回完整样板
```gdscript
# Chronicle.generate_quarter_chronicle(state) 生成并存入 state.chronicle.entries 末尾的字典：
{
	"turn": 4,
	"date_str": "元狩五年春（前118年 Q1）",
	"classical_text": "元狩五年春，博望侯张骞持节使乌孙。楼兰王迫于匈奴，闭关绝汉道。汉修敦煌亭燧。",
	"vernacular_text": "前118年春季：张骞率精使团出使乌孙；楼兰受匈奴威逼封锁商路；汉军在敦煌修筑烽燧。",
	"todo_items": [
		{"priority": "HIGH", "text": "诏令《通乌孙断匈奴右臂诏》剩余 7 季，请尽快推进乌孙亲汉度"},
		{"priority": "WARN", "text": "敦煌→楼兰补给线民夫配额不足，下季远征恐有断粮之虞"}
	]
}
```

### ⑤ 函数级实现说明书

#### 5.1 `core/chronicle.gd`（类名 `Chronicle`）
1. **`static func generate_quarter_chronicle(state: GameState) -> Dictionary`**
   - 从 `state.turn_log`、`state.court`、`state.tribes`、`state.victory` 提取本季发生的重大事件（最多精选 4 条：战役胜负/围城陷落、城邦册封/叛离、诏令下达/矫诏、部族动摇/白灾），套用文言模板与白话模板生成 `classical_text` 与 `vernacular_text`。
   - 同时扫描当前紧急风险（逾期诏令 `< 3` 季、断粮警告、部族忠诚 `< 35`、河西受威胁），生成最多 3 条「本季待办提醒（`todo_items`）」供季初弹窗展示（对接 `S07-R03`）。
   - 追加至 `state.chronicle.entries` 并返回。
2. **`static func generate_ending_biography(state: GameState) -> Dictionary`**
   - 根据 `state.victory` 的 `winner`、`end_type`、`han_grade`、`xn_grade`、`end_signature` 以及 `state.stats`（斩首、饿死、功业峰值、历任持节使臣/单于、最大勋绩），分四段拼装史书附传：
     - `header_section`：纪年与使臣/单于生平总纲；
     - `deeds_section`：本局三大关键转折与勋绩/败绩实录（含饿死人数与粮道评价）；
     - `izan_comment`：「太史公曰 / 赞曰」史官五档盖棺评语（对应 `G1..G5` 或 `X1..X5`）；
     - `share_card_meta`：供 UI 生成 1080×1920 竖版战报卡的字段摘要。

### ⑥ 禁止事项（Guardrails）
- **严禁**因 `turn_log` 为空而返回空字符串；若当季无大战，必须生成反映农牧收成、塞下无事或使者往来的兜底编年条目。

### ⑦ 验收测试代码与一键验收命令
```gdscript
func test_T18_chronicle_and_ending_biography() -> void:
	var s := new_state(9)
	Characters.init_scenario(s, {})
	Victory.init_scenario(s, {})
	Court.init_scenario(s)
	Tribes.init_scenario(s)
	var entry := Chronicle.generate_quarter_chronicle(s)
	_assert(String(entry.get("classical_text", "")).length() > 5, "T18: quarter chronicle classical_text non-empty")
	_assert(String(entry.get("vernacular_text", "")).length() > 5, "T18: quarter chronicle vernacular_text non-empty")
	Victory.check_expiry(s)
	var bio := Chronicle.generate_ending_biography(s)
	_assert(String(bio.get("izan_comment", "")).length() > 10, "T18: ending biography contains historian comment")
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T18
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---
*—— `P1_fog_ai_scenarios_tickets.md`（工单 T13–T18）完 ——*
