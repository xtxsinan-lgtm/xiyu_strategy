# P0B 工单分册：外交罪状、自动后勤、事件引擎与 32 步主循环（T07–T12）

> **分册定位**：本分册包含 `T07`–`T12` 共 6 张 P0B 级工单，对应里程碑 **Gate M2（可玩无界面垂直切片）**。  
> **权威依据**：所有字段名、JSON 键、函数签名与枚举值严格对齐 [`01_cross_review_and_registry.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/01_cross_review_and_registry.md)。

---

## 工单 T07：`Diplomacy` & `Trade` 软禁商渗漏、精使/募使预算制、10 类罪状与讨伐善后

### ① 目标与前置依赖
- **目标**：扩展重构 `core/diplomacy.gd`、`core/trade.gd` 与 `core/siege.gd`，实现 23 国（18 城邦 + 5 大国）影响力锚点衰减、精使/募使预算制与在途使团实体 `Mission`、10 类标准罪状、攻陷城邦三选一善后（立新王/迫降/屠城）、以节发属国兵、匈奴威压动作（含 `install_prince` 自动生罪）及软禁商 35% 渗漏与劫商生罪。
- **前置依赖**：`T05`, `T06`。

### ② 必读设计规范定位
- [`01_cross_review_and_registry.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/01_cross_review_and_registry.md)：`§1.1 [E-11]`、`§1.2 [E-16]`、`§1.3 [E-21]`、`§1.4 [E-24], [E-28]`、`§2.9`（`relations` & `missions` Schema）、`§3.4`（18 条外交命令）、`§4.4`（`Diplomacy` 21 个 + `Trade` 1 个静态函数签名）。
- [`STATUS.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/STATUS.md)：`[R-02]` 募使免占具名槽、`[R-04]` `install_prince` 生罪与屠城后允许屯田。
- `docs/design_v1/S04_citystates_diplomacy.md`：`S04-R01`~`S04-R12`。

### ③ 新建/修改文件精确路径
- `[修改]` [`core/diplomacy.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/core/diplomacy.gd)
- `[修改]` [`core/trade.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/core/trade.gd)
- `[修改]` [`core/siege.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/core/siege.gd)
- `[修改]` [`tests/run_tests.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/tests/run_tests.gd)
- `[修改]` `tests/verify_tickets.py`（注册 `verify_T07`）

### ④ 数据结构与 JSON 完整样板

#### 4.1 `Mission` 在途/驻留汉使团实体（存于 `state.missions[mission_id]`）
```json
{
  "id": "mis_1",
  "faction": "han",
  "kind": "elite",
  "character_id": "han_zhang_qian",
  "current_node": "dun_huang",
  "route_nodes": ["dun_huang", "yang_guan", "lou_lan"],
  "edge_days_progress": 0.0,
  "targets": [{"state_id": "lou_lan", "budget": 300, "objective": "persuade", "visited": false}],
  "remaining_budget": 300,
  "status": "outbound",
  "stay_days_left": 10,
  "deputy_slots_left": 2
}
```

#### 4.2 `CrimeRecord` 罪状实体（存于 `state.relations[state_id].crimes_against_han`）
```json
{
  "id": "crime_1",
  "type": "kill_envoy",
  "weight": 3,
  "created_tick": 18,
  "expires_season": 14,
  "context": {"envoy_name": "王恢", "node": "lou_lan"}
}
```

### ⑤ 函数级实现说明书

#### 5.1 `core/diplomacy.gd`（类名 `Diplomacy`）
1. **政权 ID 归一化（`[E-24]` 铁律）**：
   - `static func normalize_state_id(id_or_node: String) -> String`：
     - 映射表：`{"chi_gu": "wusun", "wu_sun": "wusun", "da_wan": "dawan", "da_yuan": "dawan", "kang_ju": "kangju", "da_yuezhi": "dayuezhi", "ji_bin": "jibin", "che_shi_qian": "cheshi_qian"}`，其余原样返回。
     - `Diplomacy` 所有对外接口的第一行必须执行 `state_id = normalize_state_id(state_id)`。

2. **罪状与视野查询接口**：
   - `static func add_crime(state: GameState, state_id: String, crime_type: String, holder: String = "han", context: Dictionary = {}) -> void`：
     - `crime_type` 限定为 10 种标准枚举（`[E-28]`）：`"kill_envoy"`, `"insult_envoy"`, `"rob_caravan"`, `"submit_enemy"`, `"betray_vassal"`, `"kill_han_king"`, `"aid_enemy_war"`, `"refuse_vassal_supply"`, `"refuse_heavenly_horses"`, `"han_plunder"`。
     - 从 `state.bal.grievance.types[crime_type]` 读取 `weight` 与 `ttl_seasons`，生成 `CrimeRecord` 追加至 `rel.crimes_against_han`（或 `crimes_against_xn`）。
   - `static func get_crime_score(state: GameState, state_id: String, holder: String = "han") -> int`：汇总未过期罪状的 `weight` 之和。
   - `static func has_valid_crime(state: GameState, state_id: String) -> bool`：返回 `get_crime_score(state, state_id, "han") >= 2`。
   - `static func get_allied_vision_nodes(state: GameState, faction: String) -> Dictionary`：
     - 返回 `{capital_node: radius_hops}`：对 `overlord == faction` 的属国给 `2` 跳视野，对 `is_dual == true` 或有汉使团在途/驻留的节点给 `1` 跳视野。

3. **使团派遣、移动与宣谕（`S04-R03`, `[R-02]`）**：
   - `validate_dispatch_embassy(state, cmd)` / `apply_dispatch_embassy(state, cmd)`：
     - 兼容别名 `dispatch_envoy` / `send_envoy` / 旧 `gift`（若 `cmd.type == "gift"`，自动包装为 `kind = "recruited"`, `budget = int(cmd.get("cost", 200))`）；兼容 `"grand" -> "elite"`（`[E-16]`）。
     - 若 `kind == "elite"`：必须指定 `character_id`（或通过 `Characters.pick_idle_envoy` 自动绑定空闲使臣），并将该人物 `locked_action = "mission"`, `assigned_to = mission_id`；
     - 若 `kind == "recruited"`：免占具名人物槽（`[R-02]`），但校验 `state.recruited_missions_this_year < 3`（超限返回 `ERR_RECRUITED_CAP`）并 `+1`；
     - 扣除总 `budget` 金钱，创建 `Mission` 实体存入 `state.missions[mission_id]`。
   - `static func tick_missions(state: GameState, days: float = 10.0) -> void`：
     - 每旬推进在途使团移动（速度为步兵基准 $\times 1.6$）；
     - 途经匈奴游骑设伏路段或匈奴威吓 $X > 50$ 且国王含 `trait_envoy_raider`（如楼兰王安归）的节点时，检定截杀/扣押（老练使臣 `trait_veteran_envoy` 逃脱率 `+25%`）：若被杀，调用 `add_crime(state, sid, "kill_envoy")`、`Court.modify_trust(state, -6 if kind == "elite" else -2, "envoy_killed")` 并触发 `evt_envoy_killed`；若被匈奴截获，调用 `Tribes.add_loot_to_pool(state, int(mis.remaining_budget * 0.7))`。
     - 抵达目标王庭后驻留 10 天宣谕：按 `budget`、使臣 `eloquence`、凿空者 `trait_pioneer`（首次抵大国额外 `+15`）、博望遗信 `+8%` 及城邦 `satiation` 边际递减公式增加 `rel.han_influence`（`satiation += 1`），完成后前往下一目标或置 `"returning"` 返程解锁人物。

4. **册封、纳属、讨伐与破城三选一善后（`S04-R05`~`R08`）**：
   - `grant_enfeoffment`（印绶册封，兼容 `enfeoff`）：要求 `han_influence >= 35` 且 `tilt >= 0` 且 `sacked_memory_seasons == 0`，置 `rel.han_enfeoffed = true`（若原为 `overlord == "xiongnu"` 则置 `is_dual = true` 两属状态）。
   - `incorporate_vassal`（纳入属国，兼容 `make_vassal`）：5 大国免疫（返回 `ERR_GREAT_POWER_IMMUNE`）；要求 `han_enfeoffed == true` 且 `han_influence - xn_intimidation >= 25`，置 `rel.overlord = "han"`, `rel.han_tier = "vassal"`, `rel.is_dual = false`, `rel.tier_lock_seasons = 4`。
   - `static func on_citystate_captured(state: GameState, state_id: String, attacker: String, policy: String = "force_submit") -> void`（由 `Siege` 城破时调用）：
     - 若 `attacker == "han"`：
       - 若战前无合法罪状（`not has_valid_crime`）且非匈奴独占死敌，扣汉廷信任 `Court.modify_trust(state, -12, "unprovoked_war")`；若有罪，调用 `Victory.record_event_award(state, "han", "punish_guilty_state", 4.0)` 并清空罪状；
       - **`policy == "install_king"`（更立亲汉新王）**：耗 300 钱，置 `overlord = "han"`, `han_tier = "puppet"`, `han_enfeoffed = true`, `hostage_sent_han = true`, `han_influence = 75`, `han_resentment = 10`；
       - **`policy == "force_submit"`（武装迫降）**：置 `overlord = "han"`, `han_tier = "vassal"`, `han_enfeoffed = true`, `han_influence = 50`, `han_resentment += 25`；
       - **`policy == "sack"`（屠城震慑，对齐 `[R-04]`）**：掠夺钱粮入军（若主将含 `trait_greedy` 私吞扣信任 `-3`），人口减半，置 `overlord = ""`, `sacked_memory_seasons = 8`（期间拒绝汉使，但允许汉军直接同格执行 `survey_tuntian / found_colony`），扣汉廷信任（轮台诏前 `-8`，轮台诏后 `-20`），周围 2 跳城邦 `han_awe += 20`、`han_resentment += 15`。

5. **以节发属国兵与匈奴外交动作（`S04-R09`, `[R-04]`）**：
   - `static func levy_vassal_troops(state: GameState, holder_node: String, max_troops: int = 5000) -> Dictionary`：
     - 扫描距离 `holder_node` 2 跳以内、`overlord == "han"` 或 `marriage_han == true` 的盟国（若持节者有 `trait_vassal_levy` 上限 `+40%`、怨恨减半；若乌孙肥王有 `trait_pro_han_allied` 乌孙出兵 `+50%`），抽调 `vassal_infantry` / `hu_cavalry` 组建或并入汉军。
   - 实现匈奴命令 `demand_vassal`, `demand_exclusive`, `enforce_trade_ban`, `set_tax_rate`, `intimidate_city`, `bribe_nobles`, `levy_vassal_infantry`, `install_prince`, `marry_great_power`, `detain_han_envoy`：
     - 其中 `install_prince`（废立亲匈王子）：耗 450 赏赐池将目标城邦置为 `overlord = "xiongnu"`, `is_dual = false`，并**自动调用 `add_crime(state, sid, "submit_enemy", "han")` 为汉方生成合法讨伐罪状**（对齐 `[R-04]`）。
   - `static func on_tongpu_deposed(state: GameState) -> void` 与 `static func on_white_disaster_weaken(state: GameState, delta_x: float = -15.0) -> void`：全西域 18 城邦 `xn_intimidation = maxf(0.0, xn_intimidation + delta_x)`。
   - `monthly(state)` 与 `quarter_end(state)`：按 `S04 §4.2` Step M1..M6（驻军威吓/军威辐射、僮仆保底 `X_floor = 30`、锚点衰减、重算 `tilt`）与 Step S1..S5（饱足度 `-1`、派系漂移、清理过期罪状、12 月末清零 `recruited_missions_this_year`）执行。

#### 5.2 `core/trade.gd` 软禁商渗漏与罪状联动
- 在 `Trade.monthly(state)` 中：
  - 若商道途经节点处于 `rel.trade_banned == true` 且非汉直控，**不再直接归零**，而是乘以软禁商渗漏率 `0.35`（`S04-R10`）；
  - 若途经节点被匈奴劫掠或城邦主动劫商，为该城邦调用 `Diplomacy.add_crime(state, sid, "rob_caravan", "han")`；
  - 最终汉方入账商税乘以 `Supply.get_trade_tax_mult(state)`（T10 七科谪超征修正）。

### ⑥ 禁止事项（Guardrails）
- **严禁**让 5 大国（`"wusun"`, `"dawan"`, `"kangju"`, `"dayuezhi"`, `"jibin"`）通过 `incorporate_vassal` 变成普通属国。
- **严禁**在 `Diplomacy` 内部直接使用未经 `normalize_state_id` 转换的节点名访问 `state.relations`。

### ⑦ 验收测试代码与一键验收命令
在 `tests/run_tests.gd` 中追加 `test_T07_diplomacy_and_crimes()`：
```gdscript
func test_T07_diplomacy_and_crimes() -> void:
	var s := new_state(9)
	Characters.init_scenario(s, {})
	Court.init_scenario(s)
	Tribes.init_scenario(s, {})
	_assert(Diplomacy.normalize_state_id("chi_gu") == "wusun" and Diplomacy.normalize_state_id("da_wan") == "dawan", "T07: normalize_state_id [E-24]")
	Diplomacy.add_crime(s, "lou_lan", "kill_envoy", "han")
	_assert(Diplomacy.has_valid_crime(s, "lou_lan"), "T07: kill_envoy grants valid crime")
	var err := Diplomacy.validate_dispatch_embassy(s, {"kind": "recruited", "targets": [{"state_id": "lou_lan", "budget": 200}]})
	_assert(err == "", "T07: validate recruited embassy without named char [R-02]")
	Diplomacy.apply_dispatch_embassy(s, {"kind": "recruited", "targets": [{"state_id": "lou_lan", "budget": 200}]})
	_assert(s.missions.size() == 1 and s.recruited_missions_this_year == 1, "T07: mission created")
	Diplomacy.on_citystate_captured(s, "lun_tai", "han", "sack")
	_assert(s.relations["lun_tai"]["sacked_memory_seasons"] == 8 and s.relations["lun_tai"]["overlord"] == "", "T07: sack sets memory 8 and clears overlord [R-04]")
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T07
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---

## 工单 T08：`Diplomacy.get_forage_willingness` 与 `Supply` 沿途四档给食闭环

### ① 目标与前置依赖
- **目标**：打通 `S04` 城邦供粮意愿公式 $W \in [0, 100]$ 与 `S05` 军队抵达城邦时的四档就食执行闭环（`>=75` 箪食壶浆免费献粮、`50..74` 闭门平买、`30..49` 勒兵强征、`<30` 坚壁拒供/劫掠就食），并回写影响力、怨恨与「汉军掠食 (`han_plunder`)」罪状。
- **前置依赖**：`T07`。

### ② 必读设计规范定位
- [`01_cross_review_and_registry.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/01_cross_review_and_registry.md)：`§2.4`（`army.forage_policy`, `army.foraged_this_tick`）、`§3.5`（`set_forage_policy`）、`§4.4`（`get_forage_willingness`, `get_forage_willingness_breakdown`, `apply_forage_feedback`）、`§4.5`（`Combat.calc_army_awe`, `Supply.try_forage_on_arrival`）、`§6.4 DAY-1`。
- [`STATUS.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/STATUS.md)：`[R-05]` 供粮意愿所有权切分（S04 算意愿 $W$，S05 分 `75/50/30` 四档执行并回写）。
- `docs/design_v1/S04_citystates_diplomacy.md`：`S04-R11`；`docs/design_v1/S05_logistics_military_fog.md`：`S05-R04`。

### ③ 新建/修改文件精确路径
- `[修改]` [`core/combat.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/core/combat.gd)
- `[修改]` [`core/diplomacy.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/core/diplomacy.gd)
- `[修改]` [`core/supply.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/core/supply.gd)
- `[修改]` [`core/plan_executor.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/core/plan_executor.gd)
- `[修改]` [`tests/run_tests.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/tests/run_tests.gd)
- `[修改]` `tests/verify_tickets.py`（注册 `verify_T08`）

### ④ 数据结构与 JSON 完整样板
`Diplomacy.get_forage_willingness_breakdown(state, state_id, army)` 返回结构：
```json
{
  "base": 35.0,
  "influence_term": 18.0,
  "army_awe_term": 22.0,
  "tier_bonus": 15.0,
  "enemy_fear_penalty": -12.0,
  "resentment_penalty": -8.0,
  "grain_scarcity_penalty": -5.0,
  "total": 65.0,
  "tier_name": "MARKET"
}
```

### ⑤ 函数级实现说明书

1. **`Combat.calc_army_awe(state: GameState, army: Dictionary) -> float`**（`core/combat.gd`）：
   - 计算军队总兵力 `troops = state.army_size(army)` 与骑兵占比 `cav_ratio`；
   - 读取统帅 `cmd_stats = Characters.get_commander_stats(state, str(army.get("commander_id", "")))`；
   - 公式：`awe = clampf(sqrt(float(troops) / 150.0) * 8.0 * (1.0 + 0.15 * cav_ratio) * (1.0 + 0.03 * float(cmd_stats.command_tier - 3)), 0.0, 45.0)`；若主将含 `"trait_resolute"` 且目标有罪则 `×1.25`。

2. **`Diplomacy.get_forage_willingness_breakdown(state, state_id, army)` 与 `get_forage_willingness(state, state_id, army) -> float`**（`core/diplomacy.gd`）：
   - `sid = normalize_state_id(state_id)`；若非有效政权，返回 `0.0`。
   - 读取 `rel = state.relations[sid]`、`node = state.nodes.get(state_id, {})`、`faction = army.get("faction", "han")`。
   - 对汉军（匈奴同理镜像）：
     - `base = 30.0`
     - `influence_term = float(rel.get("han_influence", 0.0)) * 0.45`
     - `army_awe_term = Combat.calc_army_awe(state, army)`
     - `tier_bonus = 25.0 if rel.get("overlord", "") == "han" else (12.0 if rel.get("han_enfeoffed", false) else (-15.0 if rel.get("overlord", "") == "xiongnu" else 0.0))`
     - `enemy_fear_penalty = -float(rel.get("xn_intimidation", 0.0)) * 0.35`
     - `resentment_penalty = -float(rel.get("han_resentment", 0.0)) * 0.50`
     - `grain_scarcity_penalty = -20.0 if float(node.get("grain", 0.0)) < 1500.0 else 0.0`
     - `total = clampf(base + influence_term + army_awe_term + tier_bonus + enemy_fear_penalty + resentment_penalty + grain_scarcity_penalty, 0.0, 100.0)`。
   - `apply_forage_feedback(state, state_id, faction, delta_inf, delta_resent, crime_tag = "")`：
     - 若主将含 `"trait_greedy"` 且 `delta_resent > 0`，`delta_resent *= 1.35`（对齐 `§5.3 #1`）；
     - 更新 `rel.han_influence`（或 `xn_intimidation`）与 `rel.han_resentment`（或 `xn_resentment`）；
     - 若 `crime_tag != ""`，调用 `add_crime(state, sid, crime_tag, ("xiongnu" if faction == "han" else "han"))`。

3. **`Supply.try_forage_on_arrival(state: GameState, army: Dictionary, node_id: String) -> void`**（`core/supply.gd`）：
   - 若 `army.get("is_convoy", false)` 或 `army.get("forage_policy", "auto") == "none"` 或 `node_id in army.get("foraged_this_tick", [])` 则直接返回。
   - 若 `node_id` 为己方直辖城，走常规己方仓库补粮；若为西域城邦/大国节点：
     - 将 `node_id` 记入 `army["foraged_this_tick"]`；
     - 计算军队缺口 `need_grain = maxf(0.0, army_carry_cap(state, army) - float(army.get("grain", 0.0)))`；若 `need_grain < 10.0` 返回。
     - 调用 `W = Diplomacy.get_forage_willingness(state, node_id, army)`，结合 `policy = army.get("forage_policy", "auto")` 按 **`75 / 50 / 30` 四档** 执行：
       1. **第 1 档（$W \ge 75$，箪食壶浆献粮）**：从节点存粮最多拨出 `min(need_grain, node.grain * 0.25)` 免费注入 `army.grain`，回调 `apply_forage_feedback(state, node_id, faction, +2.0, 0.0, "")`；
       2. **第 2 档（$50 \le W < 75$，牛酒平买）**：可购上限 `min(need_grain, node.grain * 0.15)`，单价 `0.8` 钱/斛，调用 `Court.spend_military_market`（匈奴扣赏赐池）扣款购粮，回调 `apply_forage_feedback(state, node_id, faction, +1.0, +2.0, "")`；
       3. **第 3 档（$30 \le W < 50$ 且 `policy in ["auto", "requisition", "plunder"]`，勒兵强征）**：强征 `min(need_grain * 0.7, node.grain * 0.12)`，支付半价 `0.4` 钱/斛，回调 `apply_forage_feedback(state, node_id, faction, -4.0, +12.0, "")`；
       4. **第 4 档（$W < 30$，闭城拒供）**：若 `policy == "plunder"`（破野掠食），强夺 `min(need_grain * 0.5, node.grain * 0.10)`，节点 `farm_dev = maxf(0.2, farm_dev - 0.1)`，回调 `apply_forage_feedback(state, node_id, faction, -10.0, +28.0, "han_plunder")` 并扣汉廷信任 `-3`；否则一粒不得（记录「城闭不给食」战报）。
   - 在 `PlanExecutor.move_all(state, days)` 中：每当军队完成路段移动踏入新节点 `to_node` 时，立即调用 `Supply.try_forage_on_arrival(state, army, to_node)`（`§6.4 DAY-1`）。

### ⑥ 禁止事项（Guardrails）
- **严禁**允许同一支军队在同一旬内反复进出同一节点刷献粮（必须检查 `node_id in army.foraged_this_tick`，且每旬 Day 0 清空 `foraged_this_tick`）。
- **严禁**让运粮车队（`army.is_convoy == true`）触发城邦强征或掠食。

### ⑦ 验收测试代码与一键验收命令
在 `tests/run_tests.gd` 中追加 `test_T08_forage_willingness_loop()`：
```gdscript
func test_T08_forage_willingness_loop() -> void:
	var s := new_state(9)
	Characters.init_scenario(s, {})
	Court.init_scenario(s)
	var a: Dictionary = s.armies["han_1"]
	a["commander_id"] = "han_zhao_ponu"
	a["grain"] = 50.0
	s.relations["lou_lan"]["han_influence"] = 85.0
	s.relations["lou_lan"]["xn_intimidation"] = 10.0
	s.relations["lou_lan"]["overlord"] = "han"
	var w_high := Diplomacy.get_forage_willingness(s, "lou_lan", a)
	_assert(w_high >= 75.0, "T08: high influence + awe yields W >= 75")
	var g_before := float(a["grain"])
	Supply.try_forage_on_arrival(s, a, "lou_lan")
	_assert(float(a["grain"]) > g_before, "T08: army received free grain at W >= 75")
	a["foraged_this_tick"] = []
	a["forage_policy"] = "plunder"
	s.relations["lou_lan"]["han_influence"] = 0.0
	s.relations["lou_lan"]["xn_intimidation"] = 90.0
	s.relations["lou_lan"]["overlord"] = "xiongnu"
	s.relations["lou_lan"]["han_resentment"] = 80.0
	var w_low := Diplomacy.get_forage_willingness(s, "lou_lan", a)
	_assert(w_low < 30.0, "T08: hostile city yields W < 30")
	Supply.try_forage_on_arrival(s, a, "lou_lan")
	_assert(s.relations["lou_lan"]["crimes_against_xn"].size() >= 1, "T08: plunder records han_plunder crime")
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T08
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---

## 工单 T09：`SupplyLines` 自动补给线拆段派车与 `Tuntian` 两段式屯田

### ① 目标与前置依赖
- **目标**：新建 `core/supply_lines.gd`（类名 `SupplyLines`）与 `core/tuntian.gd`（类名 `Tuntian`），并在 `core/economy.gd` 秋收中接入屯田产粮与外派民夫扣减，实现万里粮道自动拆段（`legs`）、每旬 Day 0 逆推流量派车、终点闲置民夫回程协运、30 日连劫自动暂停，以及 EA 两段式屯田（阶段 0→1 校猎测地 30 日，阶段 1→2 车队立屯或罪人兵落户）。
- **前置依赖**：`T05`, `T08`。

### ② 必读设计规范定位
- [`01_cross_review_and_registry.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/01_cross_review_and_registry.md)：`§1.1 [E-08]`、`§1.2 [E-17]`、`§2.2`（节点 `colonies`, `tuntian_stage`, `tuntian_survey_days`, `tuntian_founded_tick`, `levied_out`）、`§2.5.1`（`SupplyLine` Schema）、`§3.5`（`create_supply_line`, `update_supply_line`, `delete_supply_line`, `survey_tuntian`, `found_colony`, `settle_convicts`）、`§4.5`（`SupplyLines` & `Tuntian` 静态函数签名）、`§6.4 DAY-0, DAY-6`、`§6.6 ME-1, ME-3`。
- [`STATUS.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/STATUS.md)：`[R-04]` 屠城后允许直接屯田、`[R-05]` 补给线单段支持合并调用终点闲置民夫协运。
- `docs/design_v1/S05_logistics_military_fog.md`：`S05-R01`, `S05-R02`, `S05-R05`。

### ③ 新建/修改文件精确路径
- `[新建]` `core/supply_lines.gd`
- `[新建]` `core/tuntian.gd`
- `[修改]` [`core/economy.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/core/economy.gd)
- `[修改]` [`tests/run_tests.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/tests/run_tests.gd)
- `[修改]` `tests/verify_tickets.py`（注册 `verify_T09`）

### ④ 数据结构与 JSON 完整样板
`state.supply_lines[line_id]` 结构（对齐 `§2.5.1`）：
```json
{
  "id": "line_1",
  "faction": "han",
  "source": "jiu_quan",
  "terminus": "lou_lan",
  "priority": 2,
  "target_months": 6.0,
  "reserve_months": 3.0,
  "max_laborers": 10000,
  "escort_army_id": "",
  "ignore_danger": false,
  "status": "active",
  "legs": [
    {"from": "jiu_quan", "to": "dun_huang", "route_ids": [3], "assigned_laborers": 3200, "desired_flow_month": 1800.0, "delivered_30d": 1500.0},
    {"from": "dun_huang", "to": "yang_guan", "route_ids": [5], "assigned_laborers": 2400, "desired_flow_month": 1500.0, "delivered_30d": 1200.0},
    {"from": "yang_guan", "to": "lou_lan", "route_ids": [9], "assigned_laborers": 4000, "desired_flow_month": 1200.0, "delivered_30d": 900.0}
  ],
  "losses_30d": 0
}
```

### ⑤ 函数级实现说明书

#### 5.1 `core/supply_lines.gd`（类名 `SupplyLines`）
1. **创建、更新、删除命令委派（`[E-17]`）**：
   - `static func validate_create(state: GameState, cmd: Dictionary) -> String` / `apply_create(state: GameState, cmd: Dictionary) -> void`：
     - 兼容参数键 `source/from` 与 `terminus/to`；校验同阵营补给线数量 `< 6`（`ERR_MAX_LINES_REACHED`）、无重复起终点（`ERR_DUPLICATE_LINE`）；
     - 寻路拆段：求 `source` 到 `terminus` 的己方/盟友通行最短节点序列 `[n0, n1, ..., nk]`（无通路返回 `ERR_NO_VALID_PATH`），将相邻节点对 `(ni, ni+1)` 生成 `legs` 数组；
     - 生成 `id = "line_" + str(state.next_supply_line_seq)`（自增 `next_supply_line_seq`）存入 `state.supply_lines[id]`。
   - `validate_update` / `apply_update` 与 `validate_delete` / `apply_delete`：更新优先级/目标月数/护卫军/无视危险开关；删除补给线时自动回收该线在途或驻留的 `line_id` 车队并归还 `levied_out` 民夫。
2. **每旬首日自动逆推流量与派车 `static func dispatch_tick(state: GameState) -> void`（`§6.4 DAY-0`）**：
   - 第一步：清空全图所有军队的 `army["foraged_this_tick"] = []`。
   - 第二步：将 `state.supply_lines.values()` 按 `priority` 降序排序遍历：
     - 若 `line.losses_30d >= 2 and not line.ignore_danger`：置 `line.status = "paused_danger"`，跳过派车；
     - 从终点 `terminus` 逆向遍历 `legs`（`i = legs.size() - 1` down to `0`）：
       - 计算段终点 `to` 驻军月粮耗 `monthly_burn`（若无驻军则按基准 `300.0` 斛/月估算），目标存粮 `target_stock = monthly_burn * line.target_months`；
       - 当前缺口 `deficit = maxf(0.0, target_stock - get_faction_grain_at(state, line.faction, leg.to))`；
       - 加上下一段所需的过境流量與本段民夫往返途中口粮消耗，得到本段 `desired_flow_month`；
       - **双向征调民夫（对齐 `[R-05]`）**：优先从段起点 `leg.from` 征调可用民夫 `avail_from = maxi(0, int(node_from.pop * 0.15) - node_from.levied_out)`；若不足，合并调用段终点 `leg.to` 的闲置可征民夫额 `avail_to`（回程空车协运），总征调受 `line.max_laborers` 限制；
       - 若段起点存粮高于保留底线（`source` 免保留底线，中继站保留 `reserve_months`），自动生成或补充绑定 `line_id` 与 `leg_idx` 的循环运粮车队（`is_convoy = true`）。
3. **`static func month_end(state: GameState) -> void` 与 `static func on_node_captured(state: GameState, node_id: String, new_owner: String) -> void`**：
   - 月末滚动衰减 `losses_30d = maxi(0, losses_30d - 1)` 并刷新各段 `delivered_30d`；
   - 节点易手时检查途经该节点的敌方 `SupplyLine`，置 `status = "cut"`。

#### 5.2 `core/tuntian.gd`（类名 `Tuntian`）
1. **阶段 0→1：校猎测地 `survey_tuntian`（兼容 `build_tuntian`）**：
   - `validate_survey(state, cmd)`：
     - 目标 `node_id = str(cmd.get("node_id", cmd.get("node", "")))`；
     - 若 `node.tuntian_stage >= 1` 返回 `ERR_ALREADY_SURVEYED`；
     - 调用 `Court.can_build_tuntian(state, node_id)`，若轮台诏禁止远距屯田返回 `ERR_LUNTAI_EDICT_FORBIDS_DISTANT_TUNTIAN`；
     - 校验同节点有汉军骑兵 $\ge 300$（`ERR_NEED_300_CAVALRY`）、有具名将校/使臣在场或持节者同格（`ERR_TUNTIAN_NEEDS_OFFICER`）、且汉金钱 $\ge 200$（`ERR_INSUFFICIENT_MONEY`）；
     - 注意对齐 `[R-04]`：即使节点处于屠城荒废期（`sacked_memory_seasons > 0`），只要汉军驻守同格，完全允许执行 `survey_tuntian`！
   - `apply_survey(state, cmd)`：扣 200 钱，标记 `node["tuntian_surveying"] = true`；若在场人物含 `"trait_tuntian_master"`（如郑吉、路博德、赵充国、赖丹），初始赠送 `node.tuntian_survey_days = 10`（耗时从 30 日缩短为 20 日，对齐 `§5.3 #9`）。
2. **阶段 1→2：开渠立屯 `found_colony` 与罪人落户 `settle_convicts`**：
   - `validate_found_colony(state, cmd)` / `apply_found_colony(state, cmd)`：校验所在节点 `tuntian_stage >= 1` 且 `node.colonies < int(node.farm_cap * 0.6)`，将指定车队民夫或步卒转为 `node.colonies += add_cnt`，若原 `tuntian_stage == 1` 则升为 `2` 并记录 `node.tuntian_founded_tick = state.tick`。
   - `validate_settle_convicts(state, cmd)` / `apply_settle_convicts(state, cmd)`：从同格汉军的 `units["convict"]` 中拨出 `count` 人转为 `node.colonies += count`（免刑落户后不再发生塞外逃亡），升 `tuntian_stage = 2`。
3. **每日与月末钩子**：
   - `static func step_day(state: GameState) -> void`：对 `tuntian_surveying == true` 且有汉军驻守的节点 `tuntian_survey_days += 1`；满 `30` 日置 `tuntian_stage = 1`, `tuntian_surveying = false`。
   - `static func month_end(state: GameState) -> void`：遍历西域 `tuntian_stage == 2` 的节点，对相邻 1 跳内的非汉属城邦累加 `state.tuntian_pressure[sid] = clampf(pressure + 4.0 + (2.67 if foreign_colonizer else 0.0), 0.0, 100.0)`（若赖丹 `trait_foreign_colonizer` 在轮台屯田，每季对龟兹额外 `+8`，即每月 `+2.67`，对齐 `§5.3 #21`）。
   - `static func get_western_tuntian_stats(state: GameState) -> Dictionary`：汇总西域屯田节点数与存粮，返回 `{"active_nodes": cnt, "total_grain": grain_sum}`。

#### 5.3 `core/economy.gd` 秋收改造
- 在 `Economy.autumn_harvest(state)`（八月末触发）中：
  - 计算有效农业劳力时扣除 `node.get("levied_out", 0)`；
  - 对 `node.colonies > 0` 的屯田节点：屯田卒人均产粮为普通农夫的 `1.8` 倍；若为当年新建屯田（`state.tick - node.tuntian_founded_tick < 36`）乘以首年开荒折损 `0.5`；若有 `trait_tuntian_master` 人物驻守该节点，产粮额外 `×1.25`。

### ⑥ 禁止事项（Guardrails）
- **严禁**让 EA 屯田出现第 3 阶段（`max_stage_ea == 2`，遵守圣经 L6）。
- **严禁**在删除补给线或解散车队时忘记将 `node.levied_out` 减回，否则会导致河西人口永久锁死無法秋收。

### ⑦ 验收测试代码与一键验收命令
在 `tests/run_tests.gd` 中追加 `test_T09_supply_lines_and_tuntian()`：
```gdscript
func test_T09_supply_lines_and_tuntian() -> void:
	var s := new_state(9)
	Characters.init_scenario(s, {})
	Court.init_scenario(s)
	var err := SupplyLines.validate_create(s, {"source": "jiu_quan", "terminus": "dun_huang", "priority": 3, "target_months": 6.0, "max_laborers": 8000})
	_assert(err == "", "T09: validate create_supply_line")
	SupplyLines.apply_create(s, {"source": "jiu_quan", "terminus": "dun_huang", "priority": 3, "target_months": 6.0, "max_laborers": 8000})
	_assert(s.supply_lines.size() == 1, "T09: supply line created")
	SupplyLines.dispatch_tick(s)
	s.characters["han_zheng_ji"]["status"] = "active"
	s.characters["han_zheng_ji"]["at_node"] = "lou_lan"
	s.armies["han_1"]["loc"] = {"node": "lou_lan"}
	s.armies["han_1"]["units"]["cavalry"] = 500
	var s_err := Tuntian.validate_survey(s, {"node_id": "lou_lan"})
	_assert(s_err == "", "T09: validate survey_tuntian at lou_lan")
	Tuntian.apply_survey(s, {"node_id": "lou_lan"})
	for _d in range(20):
		Tuntian.step_day(s)
	_assert(s.nodes["lou_lan"]["tuntian_stage"] == 1, "T09: Zheng Ji trait_tuntian_master completes survey in 20 days")
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T09
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---

## 工单 T10：`Supply` 国家马匹池、缺马下马骑兵与七科谪罪人兵 `convict`

### ① 目标与前置依赖
- **目标**：扩展 `core/supply.gd`、`core/combat.gd` 与 `core/trade.gd`，实现汉方国家马匹池（`han_horse_pool`）、大宛天马良种加成（`tianma_breed_bonus`）、军马日损耗与缺马骑兵自动转为下马步战（`dismounted_cav`）、七科谪罪人兵（`convict`）在长安与河西四郡招募、塞外日逃亡、赎罪入钱（`ransom_convicts`）、年征超 5,000 人商税 `×0.85` 惩罚，以及断粮饿死人数单列统计。
- **前置依赖**：`T08`, `T09`。

### ② 必读设计规范定位
- [`01_cross_review_and_registry.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/01_cross_review_and_registry.md)：`§1.1 [E-07]`、`§1.3 [E-22]`、`§2.1`（`han_horse_pool`, `han_convict_pool`, `convicts_levied_year`, `convicts_ransomed_season`）、`§2.4`（`dismounted_cav`, `starved_losses`）、`§3.5`（`requisition_horses`, `ransom_convicts`, `recruit`）、`§4.5`（`Supply` 8 个函数签名）、`§5.6 #3`（`convict_recruit` 标签）。
- [`STATUS.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/STATUS.md)：`[R-05]` 七科谪可在长安及河西四郡招募，年发谪 `>5,000` 商税 `×0.85`。
- `docs/design_v1/S05_logistics_military_fog.md`：`S05-R03`, `S05-R08`。

### ③ 新建/修改文件精确路径
- `[修改]` [`core/supply.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/core/supply.gd)
- `[修改]` [`core/combat.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/core/combat.gd)
- `[修改]` [`core/trade.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/core/trade.gd)
- `[修改]` [`tests/run_tests.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/tests/run_tests.gd)
- `[修改]` `tests/verify_tickets.py`（注册 `verify_T10`）

### ④ 数据结构与 JSON 完整样板
断粮饿死与行军减员恒等式字段（`state.stats`，对齐 `[E-07]`）：
```gdscript
# 每次断粮饿死 delta_starved 人时：
army["starved_losses"] = int(army.get("starved_losses", 0)) + delta_starved
state.stats["han_starved_deaths"] += delta_starved
state.sync_invariants() # 自动维护 han_total_deaths == han_combat_deaths + han_starved_deaths + han_march_deaths
```

### ⑤ 函数级实现说明书

1. **国家马匹池与下马骑兵折算（`core/supply.gd` & `core/combat.gd`）**：
   - `static func add_horses(state: GameState, count: int, faction: String = "han", target_node: String = "") -> void`（对齐 `[E-22]`）：
     - 若 `target_node != ""` 且节点存在，增加 `state.nodes[target_node].horses += count`；
     - 否则若 `faction == "han"`，更新 `state.han_horse_pool = clampi(state.han_horse_pool + count, 0, state.han_horse_pool_cap)`；若 `faction == "xiongnu"`，加到 `"chanyu_ting"` 节点。
   - `static func grant_tianma(state: GameState, count: int = 300) -> void`：
     - 调用 `add_horses(state, count, "han")`，并置 `state.tianma_breed_bonus = true`（汉骑兵行军速度 `+10%`）。
   - `validate_requisition_horses(state, cmd)` / `apply_requisition_horses(state, cmd)`：从汉直辖城或 `han_horse_pool` 调拨战马补充至同节点汉军 `army.horses`。
   - **缺马下马步战同步 `_sync_dismounted_cavalry(army: Dictionary)`**：
     - 统计军队中骑兵总数 `mounted_men = int(army.units.get("cavalry", 0)) + int(army.units.get("hu_cavalry", 0)) + int(army.units.get("nomad_archers", 0))`；
     - 若 `army.horses < mounted_men`，则 `army["dismounted_cav"] = mounted_men - int(army.horses)`，否则 `0`。
     - 在 `Combat` 计算战力与 `PlanExecutor` 计算行军速度时：`dismounted_cav` 人数按步兵（`infantry`）的攻击、防御与移动速度 `1.0` 折算，不再享受骑兵冲锋与高速加成。

2. **七科谪罪人兵、赎罪与商税乘数（`core/supply.gd` & `core/trade.gd`）**：
   - `static func add_convict_pool(state: GameState, count: int) -> void`：更新 `state.han_convict_pool = clampi(state.han_convict_pool + count, 0, 30000)`。
   - `static func get_trade_tax_mult(state: GameState) -> float`：当 `state.convicts_levied_year > 5000` 时返回 `0.85`，否则返回 `1.0`（在 `Trade.monthly` 中乘算）。
   - `validate_ransom_convicts(state, cmd)` / `apply_ransom_convicts(state, cmd)`：
     - 校验 `amount > 0`、`state.han_convict_pool >= amount` 且 `state.convicts_ransomed_season + amount <= 4000`（超限返回 `ERR_SEASON_RANSOM_CAP`）；
     - 扣减 `han_convict_pool -= amount`，累加 `convicts_ransomed_season += amount`，按每千人 `+150` 钱调用 `Court.add_treasury(state, int(round(float(amount) * 0.15)), "ransom_convicts")`。

3. **每日补给、逃亡与饿死单列 `Supply.step_day(state: GameState)`（`§6.4 DAY-5`）**：
   - 遍历 `state.armies`：
     - 若汉军主将含 `trait_cautious_official` 口粮消耗 `-8%`；若深入塞外且匈奴激活【远遁清野】（`card_scorched_earth`），粮耗与马损 `×1.35`（`[S03→S05]`）；
     - 若所在位置非汉直辖城（塞外）且 `army.units.get("convict", 0) > 0`：每日逃亡 `desert = int(floor(float(convict_cnt) * 0.0015))`（若断粮则逃亡率 `×5`），累加 `state.stats["han_deserted"] += desert`；
     - 结算战马日损耗（沙漠/断粮时加剧）并调用 `_sync_dismounted_cavalry(army)`；
     - **断粮饿死单列**：当 `army.grain <= 0.0` 时，`army.starving += 1`（若主将含 `trait_stern` 治军严酷，首旬免哗变减员）；产生的饿死减员 `starved_cnt` 必须**单独累加至 `army["starved_losses"] += starved_cnt` 与 `state.stats["han_starved_deaths"] += starved_cnt`（或 `xn_starved_deaths`）**，随后调用 `state.sync_invariants()`。
   - `static func year_start(state: GameState) -> void`（`§6.2 QS-1`）：
     - 正月初恢复 `han_horse_pool`（`+800`，若 `tianma_breed_bonus` 则 `+1200`）与 `han_convict_pool`（`+1500`），并清零 `state.convicts_levied_year = 0`。

### ⑥ 禁止事项（Guardrails）
- **严禁**将饿死人数混入 `han_combat_deaths`；必须单列在 `han_starved_deaths` 与 `army.starved_losses` 中（供 S07 战报红色高亮展示）。
- **严禁**限制只能在长安招募 `convict`；必须在所有带 `"convict_recruit"` 语义标签的节点（长安 + 河西四郡）均允许招募（`[R-05]`）。

### ⑦ 验收测试代码与一键验收命令
在 `tests/run_tests.gd` 中追加 `test_T10_horses_and_convicts()`：
```gdscript
func test_T10_horses_and_convicts() -> void:
	var s := new_state(9)
	Characters.init_scenario(s, {})
	Court.init_scenario(s)
	var h0 := s.han_horse_pool
	Supply.grant_tianma(s, 300)
	_assert(s.han_horse_pool == h0 + 300 and s.tianma_breed_bonus, "T10: grant_tianma adds horses and sets bonus")
	var a: Dictionary = s.armies["han_1"]
	a["units"] = {"cavalry": 1000}
	a["horses"] = 400
	a["grain"] = 0.0
	Supply.step_day(s)
	_assert(int(a.get("dismounted_cav", 0)) >= 600, "T10: cavalry without horses dismounted")
	s.convicts_levied_year = 6000
	_assert( absf(Supply.get_trade_tax_mult(s) - 0.85) < 0.001, "T10: convict levy > 5000 reduces trade tax to 0.85 [R-05]")
	var m0 := float(s.factions["han"]["money"])
	_assert(Supply.validate_ransom_convicts(s, {"amount": 1000}) == "", "T10: validate ransom_convicts")
	Supply.apply_ransom_convicts(s, {"amount": 1000})
	_assert(float(s.factions["han"]["money"]) == m0 + 150.0, "T10: ransom 1000 convicts adds 150 money")
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T10
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---

## 工单 T11：`EventEngine` 18 谓词/28 原子效果、中期大事件保底配额与 40 条事件数据

### ① 目标与前置依赖
- **目标**：新建 `core/event_engine.gd`（类名 `EventEngine`），实现声明式事件触发谓词引擎（18 类谓词）、28 类原子效果（Effects）执行器、中期大事件保底配额（第 10–30 季内保底 1–3 个 `midgame_major` 事件）、延时链队列与玩家/AI 选项响应（`respond_event`），并补齐 `data/events.json` 的 EA 40 条事件完整数据。
- **前置依赖**：`T01`、`T02`、`T03`、`T04`、`T05`、`T06`、`T07`、`T10`。

### ② 必读设计规范定位
- `docs/design_v1/01_cross_review_and_registry.md`：第 1 章 `[E-28]`、第 2.1 节 `state.events`、第 3.3 节 `respond_event`、第 4.10 节 `core/event_engine.gd`、第 5.1.E 节、第 5.5 节（EA 40 条事件 ID 与分类对照表）。
- `docs/design_v1/S06_events_characters_narrative.md`：`S06-R01`（谓词 DSL 18 项）、`S06-R02`（Effect 原子词表 28 项）、`S06-R03`（中期大事件保底配额）、`S06-R06`（EA 40 条事件完整设计表）。

### ③ 新建/修改文件精确路径
- **新建**：`core/event_engine.gd`
- **修改**：`data/events.json`（填入第 5.5 节列出的 `EV01`–`EV40` 共 40 条事件完整定义）

### ④ 数据结构与 JSON 完整样板
```json
{
  "id": "EV01_rizhu_grievance",
  "title_key": "EV_EV01_TITLE",
  "desc_key": "EV_EV01_DESC",
  "category": "midgame_major",
  "target_faction": "both",
  "is_unique": true,
  "cooldown_quarters": 0,
  "weight": 100,
  "conditions": [
    {"pred": "quarter_range", "min": 8, "max": 38},
    {"pred": "tribe_loyalty_le", "tribe_id": "rizhu", "val": 55.0}
  ],
  "options": [
    {
      "id": "opt_a",
      "label_key": "EV_EV01_OPT_A",
      "ai_weight": 70,
      "effects": [
        {"op": "add_rizhu_grievance", "amount": 25.0},
        {"op": "add_tribe_loyalty", "tribe_id": "rizhu", "delta": -10.0},
        {"op": "queue_event", "event_id": "EV02_rizhu_surrender_offer", "delay_quarters": 2}
      ]
    },
    {
      "id": "opt_b",
      "label_key": "EV_EV01_OPT_B",
      "ai_weight": 30,
      "effects": [
        {"op": "add_reward_pool", "delta": -300},
        {"op": "add_tribe_loyalty", "tribe_id": "rizhu", "delta": 8.0}
      ]
    }
  ]
}
```

### ⑤ 函数级实现说明书

#### 5.1 `core/event_engine.gd`（类名 `EventEngine`）
1. **`static func init_scenario(state: GameState) -> void`**
   - 初始化 `state.events = {"fired_unique": {}, "cooldowns": {}, "pending_queue": [], "delayed_chain": [], "midgame_major_count": 0, "midgame_major_target": 2, "last_major_quarter": -99}`。
2. **`static func step_quarter_events(state: GameState) -> void`**
   - 递减 `state.events.cooldowns` 中所有大于 0 的冷却计数。
   - **处理延时事件链 `delayed_chain`**：遍历 `state.events.delayed_chain`，若 `state.current_quarter() >= int(item.trigger_quarter)`，将其移入 `pending_queue`（若目标阵营为 AI 则立即调用 `auto_resolve_for_ai`）。
   - **中期大事件保底配额检定（`S06-R03`）**：
     - 设 `q := state.current_quarter()`。若 `q >= 10 and q <= 30`：
       - 若 `(q >= 15 and state.events.midgame_major_count < 1)` 或 `(q >= 24 and state.events.midgame_major_count < 2)` 或 `(q - state.events.last_major_quarter >= 8 and state.events.midgame_major_count < state.events.midgame_major_target)`：
       - 调用 `force_trigger_midgame_major(state)`：从 `category == "midgame_major"` 且未触发过的事件中按权重抽取（若常规条件未满足则放宽数值阈值 20% 强制触发，优先抽取 `EV01_rizhu_grievance`、`EV06_baizai_blizzard`、`EV04_chanyu_death_crisis`、`EV10_wusun_marriage_request`、`EV16_luntai_regret_edict`）。
   - **常规事件抽取**：遍历 `data/events.json` 中满足 `eval_conditions(state, ev.conditions)` 的事件，按 `weight` 加权抽取最多 1 条加入 `pending_queue`。
3. **`static func eval_conditions(state: GameState, conds: Array) -> bool`**
   - 实现 18 类谓词：
     1. `"quarter_range"`: `q >= min and q <= max`
     2. `"year_le"`: `state.year <= val`（注意公元前年份用负数或绝对值比较，统一按 `state.turn` 换算）
     3. `"court_trust_ge"` / `"court_trust_le"`: 比较 `state.court.trust`
     4. `"court_wind_is"`: `state.court.wind == val`
     5. `"emperor_regret_ge"`: `state.court.emperor_regret >= val`
     6. `"chanyu_prestige_ge"` / `"chanyu_prestige_le"`: 比较 `state.tribes.prestige`
     7. `"tribe_loyalty_le"`: `float(state.tribes.tribes[tribe_id].loyalty) <= val`
     8. `"rizhu_grievance_ge"`: `float(state.tribes.rizhu_grievance) >= val`
     9. `"han_merit_ge"`: `float(state.victory.han_merit) >= val`
     10. `"node_controller_is"`: `state.controller(state.nodes[node_id]) == faction`
     11. `"state_tier_is"`: `state.relations[state_id].diplomatic_tier == tier`
     12. `"state_influence_ge"`: `float(state.relations[state_id].han_influence) >= val`
     13. `"state_intimidation_ge"`: `float(state.relations[state_id].xn_intimidation) >= val`
     14. `"character_alive"`: `Characters.is_alive(state, char_id)`
     15. `"character_at_region"`: 人物所在节点属于指定区域
     16. `"army_in_region"`: 指定阵营有野战军位于指定区域
     17. `"tuntian_grain_ge"`: `Supply.get_western_tuntian_grain(state) >= val`
     18. `"flag_set"`: `state.events.fired_unique.has(flag_id)`
4. **`static func apply_effects(state: GameState, effects: Array) -> void`**
   - 实现 28 类原子效果（严格调用对应模块 API）：
     - `"add_trust"` -> `Court.add_trust(state, amount, reason)`
     - `"add_emperor_regret"` -> `Court.add_emperor_regret(state, amount, reason)`
     - `"set_court_wind"` -> `state.court.wind = val`
     - `"add_han_money"` / `"add_xn_money"` -> 增减对应阵营 `money`（匈奴同步更新 `reward_pool`）
     - `"add_prestige"` -> `Tribes.add_prestige(state, delta, reason)`
     - `"add_reward_pool"` -> `Tribes.add_reward_pool(state, delta, reason)`
     - `"add_tribe_loyalty"` -> `Tribes.add_loyalty(state, tribe_id, delta, reason)`
     - `"add_rizhu_grievance"` -> `Tribes.add_rizhu_grievance(state, amount)`
     - `"trigger_rizhu_surrender"` -> `Tribes.trigger_rizhu_surrender(state)`
     - `"trigger_baizai"` -> `Tribes.trigger_baizai_collapse(state, severity)`
     - `"add_permanent_deed"` -> `Victory.add_permanent_deed(state, deed_id, points, title)`
     - `"add_influence"` -> `Diplomacy.add_influence(state, state_id, delta, reason)`
     - `"add_intimidation"` -> `Diplomacy.add_intimidation(state, state_id, delta)`
     - `"add_resentment"` -> `Diplomacy.add_resentment(state, state_id, faction, delta)`
     - `"set_diplomatic_tier"` -> 更新 `diplomatic_tier` 与 `overlord`
     - `"record_crime"` -> `Diplomacy.record_crime(state, state_id, crime_type, severity)`
     - `"grant_tianma"` -> `Supply.grant_tianma(state, horses)`
     - `"add_convict_pool"` -> `state.han_convict_pool += amount`
     - `"spawn_edict"` -> `Court.spawn_edict(state, edict_id, target)`
     - `"queue_event"` -> 加入 `state.events.delayed_chain`
     - `"kill_character"` / `"activate_character"` -> 更新人物状态
     - `"add_node_grain"` / `"damage_wall"` / `"set_flag"` / `"add_combat_merit"` / `"disable_tongpu"`
5. **`static func validate_respond_event(state: GameState, cmd: Dictionary) -> String`** 与 **`apply_respond_event(state: GameState, cmd: Dictionary) -> void`**
   - 校验 `cmd.event_id` 在 `state.events.pending_queue` 中且 `option_idx` 合法；执行对应选项的 `effects`，若事件 `category == "midgame_major"` 则 `state.events.midgame_major_count += 1` 且 `state.events.last_major_quarter = state.current_quarter()`，并从 `pending_queue` 移除。

### ⑥ 禁止事项（Guardrails）
- **严禁**在 `apply_effects` 中直接修改 `state.relations[id].overlord = "han"` 而不更新 `diplomatic_tier`；必须保持两者同步。
- **严禁**让 AI 阵营的事件留在 `pending_queue` 阻塞回合推进；非玩家操控阵营的事件必须在生成当季自动按 `ai_weight` 抽样结算。

### ⑦ 验收测试代码与一键验收命令
```gdscript
func test_T11_event_engine_and_quota() -> void:
	var s := new_state(9)
	Characters.init_scenario(s, {})
	Victory.init_scenario(s, {})
	Court.init_scenario(s)
	Tribes.init_scenario(s)
	EventEngine.init_scenario(s)
	s.turn = 16 # Q16, midgame quota check
	EventEngine.step_quarter_events(s)
	_assert(s.events["midgame_major_count"] >= 1 or s.events["pending_queue"].size() >= 1, "T11: midgame major event quota forces trigger by Q16")
	EventEngine.apply_effects(s, [{"op": "add_permanent_deed", "deed_id": "test_deed", "points": 8.0, "title": "测试勋绩"}])
	_assert(absf(float(s.victory["permanent_deeds"]) - 8.0) < 0.01, "T11: effect add_permanent_deed")
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T11
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---

## 工单 T12：`TurnResolver` 32 步标准结算主循环集成与 `Commands` 全新增命令挂载

### ① 目标与前置依赖
- **目标**：严格按照 `01_cross_review_and_registry.md` 第 3 章与第 6 章，在 `core/commands.gd` 中挂载全部 21 条新增命令的 `validate` 与 `apply` 路由，并在 `core/turn_resolver.gd` 中按 32 步标准时序（Phase 0 至 Phase 6）集成所有模块的逐日、逐旬、逐月、逐季、逐年结算钩子。
- **前置依赖**：`T01`–`T11` 全部 P0 工单。

### ② 必读设计规范定位
- `docs/design_v1/01_cross_review_and_registry.md`：第 3 章（全命令权威签名注册表 3.1/3.2/3.3）、第 6 章（`turn_resolver.gd` 32 步精确调用顺序表 6.1–6.7）。

### ③ 新建/修改文件精确路径
- **修改**：`core/commands.gd`
- **修改**：`core/turn_resolver.gd`

### ④ 数据结构与命令路由完整映射表
在 `core/commands.gd` 中新增以下 21 条命令的校验与执行分发（保留原有 13 条基线命令并向后兼容）：
- **汉方新增 12 条**：`comply_edict`, `bargain_edict`, `refuse_edict`, `forge_edict`, `request_appropriation`, `request_troops`, `request_princess`, `dispatch_mission`, `settle_punitive_war`, `establish_supply_line`, `cancel_supply_line`, `update_supply_line`, `survey_tuntian`, `upgrade_tuntian`, `build_beacon`, `ransom_convicts`（注：`supply_line` 三合一或独立 ID 均路由至 `SupplyLines`）。
- **匈奴新增 7 条**：`distribute_rewards`, `hold_assembly`, `play_tactical_card`, `set_tongpu_tax`, `intimidate_city`, `install_prince`, `raze_beacon`。
- **通用新增 2 条**：`assign_character`, `respond_event`。

### ⑤ 函数级实现说明书

#### 5.1 `core/commands.gd` 路由扩展
1. 在 `validate(state: GameState, cmd: Dictionary) -> String` 的 `match String(cmd.get("type", ""))` 中，按 `01_cross_review_and_registry.md` 第 3 章表格逐一调用对应模块的 `validate_xxx(state, cmd)`。
2. 在 `apply(state: GameState, cmd: Dictionary) -> void` 的 `match String(cmd.get("type", ""))` 中，逐一调用对应模块的 `apply_xxx(state, cmd)`，并在成功执行后向 `state.turn_log` 追加日志条目。

#### 5.2 `core/turn_resolver.gd` 32 步标准时序实现
将 `resolve_turn(state: GameState, han_cmds: Array, xn_cmds: Array) -> Dictionary` 改造为严格执行以下 7 个 Phase（共 32 步）：
1. **Phase 0（指令下达与预扣费，Step 01–04）**：
   - Step 01: `state.clear_turn_transient()`
   - Step 02: 依次校验并执行 `han_cmds`
   - Step 03: 依次校验并执行 `xn_cmds`
   - Step 04: 处理立即生效的 `respond_event`
2. **外层循环：`for tick_offset in range(state.decision_ticks):`（每旬 10 日）**：
   - **Phase 1（逐日推进 `for day_in_tick in range(10):`，Step 05–10）**：
     - Step 05: `Documents.step_day(state)`
     - Step 06: `Diplomacy.step_missions_day(state)`
     - Step 07: `Tribes.step_tax_convoys_day(state)`
     - Step 08: `PlanExecutor.step_armies_day(state)`（内部移动前触发 `Supply.execute_forage_on_arrival`）
     - Step 09: `Combat.resolve_encounters_day(state)` 與 `Siege.step_sieges_day(state)`
     - Step 10: `Supply.step_day(state)`（含断粮饿死写入 `han_starve_deaths` 与缺马下马骑兵）
   - **Phase 2（每旬末结算，Step 11–14）**：
     - Step 11: `SupplyLines.step_tick(state)`
     - Step 12: `Fog.step_tick(state)`
     - Step 13: `Diplomacy.step_tick(state)`
     - Step 14: `state.tick += 1`
   - **Phase 3（每月末结算 `if state.tick % 3 == 0:`，Step 15–19）**：
     - Step 15: `Trade.step_month(state)`（乘以软禁商渗漏率与 `Supply.get_trade_tax_mult(state)`）
     - Step 16: `Diplomacy.step_month(state)`
     - Step 17: `Tuntian.step_month(state)`
     - Step 18: `Victory.step_month(state)`（重算 `han_merit` 与 `xn_weifu`，更新维持月数并调用 `Victory.check_victory(state)`）
     - Step 19: 若 `state.winner != ""` 则立即跳出循环进入 Phase 6。
   - **Phase 4（每季末结算 `if state.tick % 9 == 0:`，Step 20–28）**：
     - Step 20: `Court.step_quarter(state)`
     - Step 21: `Tribes.step_quarter_start(state)` 与 `Tribes.step_quarter_end(state)`
     - Step 22: 若当前为 Q4（冬），执行 `Tribes.check_baizai(state)`
     - Step 23: `Diplomacy.step_quarter(state)`
     - Step 24: `EventEngine.step_quarter_events(state)`
     - Step 25: `Characters.step_quarter(state)`
     - Step 26: 若 `Chronicle` 已加载，调用 `Chronicle.generate_quarter_chronicle(state)`
     - Step 27: `Victory.check_victory(state)`
     - Step 28: 若 `state.winner != ""` 则立即跳出循环进入 Phase 6。
   - **Phase 5（每年末结算 `if state.tick % 36 == 0:`，Step 29–31）**：
     - Step 29: `Economy.step_year(state)`（秋收、马群繁衍、拨款、重置 `convicts_levied_year = 0`）
     - Step 30: `Characters.step_year_aging(state)`
     - Step 31: `Victory.check_expiry(state)`（若到达 `max_turns` 则执行连续变量计分与终局签名生成）
3. **Phase 6（终局归档，Step 32）**：
   - 若 `state.winner != ""`，确保 `Victory.build_end_signature(state)` 已写入 `state.victory.end_signature`。

### ⑥ 禁止事项（Guardrails）
- **严禁**颠倒 Step 05–10 与 Step 18–28 的顺序；一旦在 Phase 3 或 Phase 4 判定 `state.winner != ""`，必须立即终止后续 tick 推进，防止已获胜/崩盘后状态被覆盖。

### ⑦ 验收测试代码与一键验收命令
```gdscript
func test_T12_turn_resolver_full_quarter_cycle() -> void:
	var s := new_state(9)
	Characters.init_scenario(s, {})
	Victory.init_scenario(s, {})
	Court.init_scenario(s)
	Tribes.init_scenario(s)
	SupplyLines.init_scenario(s)
	Tuntian.init_scenario(s)
	EventEngine.init_scenario(s)
	var han_cmds := [
		{"type": "establish_supply_line", "faction": "han", "source": "dun_huang", "target": "lou_lan", "priority": 2, "laborer_quota": 2000},
		{"type": "dispatch_mission", "faction": "han", "mission_type": "elite", "target": "lou_lan", "budget": 300, "envoy_id": "zhang_qian"}
	]
	var xn_cmds := [
		{"type": "distribute_rewards", "faction": "xiongnu", "ratios": {"zuoxian": 0.25, "youxian": 0.25, "rizhu": 0.30, "lihu": 0.20}},
		{"type": "play_tactical_card", "faction": "xiongnu", "card_id": "TC01_feigned_retreat", "target": "lou_lan"}
	]
	TurnResolver.resolve_turn(s, han_cmds, xn_cmds)
	_assert(s.tick == 9, "T12: 1 quarter advances 9 ticks (90 days)")
	_assert(s.victory["han_merit"] > 0.0, "T12: Victory.step_month updated han_merit")
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T12
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---
*—— `P0B_diplomacy_logistics_events_tickets.md`（工单 T07–T12）完 ——*
