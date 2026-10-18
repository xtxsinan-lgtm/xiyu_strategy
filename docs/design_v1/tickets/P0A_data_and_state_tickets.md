# P0A 工单分册：数据基座、全局状态与汉匈政治双核（T01–T06）

> **分册定位**：本分册包含 `T01`–`T06` 共 6 张 P0A 级核心基座工单，对应里程碑 **Gate M1**。  
> **权威依据**：所有字段名、JSON 键、函数签名与枚举值严格对齐 [`01_cross_review_and_registry.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/01_cross_review_and_registry.md)。

---

## 工单 T01：新增 JSON 数据文件与 `balance.json` / `units.json` 扩展

### ① 目标与前置依赖
- **目标**：一次性建立 `design_v1` 所需的全部新增 JSON 数据文件（`court.json`, `edicts.json`, `tribes.json`, `characters.json`, `events.json` 初版骨架），扩展 `balance.json`、`units.json` 与 `ai_profiles.json`，并创建双轨验证脚本 `tests/verify_tickets.py`。
- **前置依赖**：无（全工程第 1 张工单）。

### ② 必读设计规范定位
- [`01_cross_review_and_registry.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/01_cross_review_and_registry.md)：`§1.4`（`[E-24]`~`[E-30]` ID 规范）、`§5.1`（全项目 JSON 顶层键总表）、`§5.2`（25+7 名人物表）、`§5.3`（40 个特性 Tag）、`§5.4`（15 道诏令模板）、`§5.6`（16 个节点语义标签）。
- 各分册默认参数表：`S01 §3-§4`、`S02 §3-§4`、`S03 §3-§4`、`S04 §3-§4`、`S05 §3-§4`、`S06 §4.5`、`S08 §3.2`。

### ③ 新建/修改文件精确路径
- `[修改]` `data/balance.json`
- `[修改]` `data/units.json`
- `[修改]` `data/ai_profiles.json`
- `[新建]` `data/court.json`
- `[新建]` `data/edicts.json`
- `[新建]` `data/tribes.json`
- `[新建]` `data/characters.json`
- `[新建]` `data/events.json`
- `[新建]` `tests/verify_tickets.py`

### ④ 数据结构与 JSON 完整样板

#### 4.1 `data/units.json` 新增 `convict` 兵种（追加至顶层字典）
```json
  "convict": {
    "name": "七科谪弛刑徒",
    "faction": "han",
    "class": "foot",
    "cost_money": 15,
    "food_per_day": 0.022,
    "atk": 0.75,
    "def": 0.70,
    "speed": 1.0,
    "siege": 0.90,
    "desertion_daily_outside": 0.0015
  }
```

#### 4.2 `data/balance.json` 必须追加的顶层配置段
```json
  "victory": {
    "merit": {
      "target_threshold": 100, "hold_months_required": 12,
      "vassal_points": 5, "vassal_cap": 35,
      "enfeoff_points": 2, "enfeoff_cap": 12,
      "hub_nodes": ["lou_lan", "wu_lei", "cheshi_qian"], "hub_points_each": 5,
      "tuntian_grain_divisor": 2000.0, "tuntian_cap": 15,
      "suppress_max": 10, "great_power_cap": 12, "tongpu_deposed_bonus": 10,
      "event_pool_min": -20.0, "event_pool_max": 30.0, "event_pool_quarter_decay": 0.85,
      "permanent_cap": 40, "hexi_lost_penalty_each": 15, "petition_boost_value": 10, "petition_boost_seasons": 2
    },
    "weifu": {
      "target_threshold": 100, "hold_months_required": 12, "hexi_hold_months_required": 6,
      "hexi_points_each": 12, "vassal_points": 4, "vassal_cap": 36,
      "hub_points_each": 5, "tongpu_active_bonus": 10,
      "prestige_divisor": 5.0, "prestige_cap": 20,
      "event_pool_min": -20.0, "event_pool_max": 25.0, "event_pool_quarter_decay": 0.85,
      "sacred_lost_penalty": 20
    },
    "failure": { "xn_scatter_quarters_required": 2 },
    "expiry_scoring": {
      "merit_weight": 0.45, "weifu_weight": 0.45,
      "citystate_han_pts": 5.0, "citystate_xn_pts": 5.0, "citystate_dual_pts": 2.5,
      "hexi_node_pts": 8.0, "horses_per_1000": 1.2, "pop_ratio_weight": 10.0, "draw_margin": 3.0
    }
  },
  "embassy": {
    "kinds": ["elite", "recruited"], "travel_speed_mult": 1.6,
    "budget_min": 100, "budget_max": 600, "court_stay_days": 10, "recruited_yearly_cap": 3
  },
  "grievance": {
    "types": {
      "kill_envoy": {"weight": 3, "ttl_seasons": 12},
      "insult_envoy": {"weight": 1, "ttl_seasons": 6},
      "rob_caravan": {"weight": 2, "ttl_seasons": 8},
      "submit_enemy": {"weight": 2, "ttl_seasons": 8},
      "betray_vassal": {"weight": 3, "ttl_seasons": 12},
      "kill_han_king": {"weight": 3, "ttl_seasons": 16},
      "aid_enemy_war": {"weight": 2, "ttl_seasons": 8},
      "refuse_vassal_supply": {"weight": 1, "ttl_seasons": 6},
      "refuse_heavenly_horses": {"weight": 3, "ttl_seasons": 16},
      "han_plunder": {"weight": 2, "ttl_seasons": 8}
    }
  },
  "punitive": { "sack_memory_seasons": 8, "default_policy": "force_submit", "inactive_expire_seasons": 4 },
  "supply_will": { "quota_ratio_welcome": 0.25, "quota_ratio_market": 0.12, "price_welcome": 0.6, "price_market": 1.0 },
  "supply_line": { "default_priority": 2, "default_target_months": 6.0, "relay_reserve_months": 3.0, "default_max_laborers": 10000, "auto_pause_losses": 2, "max_lines_per_faction": 6 },
  "army_forage": { "default_policy": "auto", "thresholds": [75, 50, 30] },
  "horse_pool": { "initial_default": 6000, "cap": 30000, "annual_recovery_base": 800, "tianma_speed_bonus": 0.10, "dismount_as_infantry": true },
  "convict": { "initial_pool": 4000, "cap": 30000, "annual_inflow": 1500, "trade_penalty_threshold": 5000, "trade_tax_mult_penalty": 0.85, "ransom_money_per_1k": 150, "season_ransom_cap": 4000 },
  "tuntian": { "max_stage_ea": 2, "survey_days_needed": 30, "survey_cost_money": 200, "first_year_yield_mult": 0.5, "colony_cap_ratio": 0.6, "pressure_event_threshold": 60.0 },
  "fog": { "beacon_max_hp": 100, "beacon_build_days": 20, "beacon_build_cost_money": 120, "beacon_maint_per_month": 5, "difficulty_error_mult": {"qingche": 0.5, "chijie": 1.0, "suiyuan": 1.25} },
  "events": { "max_popups_per_season": 2, "major_quota_min": 1, "major_quota_max": 3, "major_cooldown_seasons": 4, "rizhu_window_ticks": 9 },
  "chronicle": { "max_entries_per_season": 6 }
```

#### 4.3 `data/court.json`、`data/edicts.json`、`data/tribes.json` 完整样板
- **`data/court.json`**：
```json
{
  "trust": {
    "initial_by_scenario": {"scn_loulan_108bc": 65, "scn_mobei_119bc": 55, "scn_protectorate_68bc": 60},
    "bands": {
      "recall": {"min": 0, "max": 0, "stipend_mult": 0.0, "central_quota": 0},
      "harsh": {"min": 1, "max": 24, "stipend_mult": 0.60, "central_quota": 1000},
      "jianjun": {"min": 25, "max": 44, "stipend_mult": 0.85, "central_quota": 2000},
      "normal": {"min": 45, "max": 74, "stipend_mult": 1.00, "central_quota": 3500},
      "bianyi": {"min": 75, "max": 100, "stipend_mult": 1.15, "central_quota": 5000}
    },
    "hysteresis": 3,
    "idle_grace_seasons": 2,
    "idle_decay_per_season": 2,
    "allow_redeem_once": true,
    "redeem_cost_money": 1200,
    "redeem_deadline_ticks": 18
  },
  "winds": {
    "wudi_early": {"stipend_mult": 1.10, "expedition_weight": 1.5, "tuntian_weight": 0.8},
    "luntai": {"stipend_mult": 0.75, "expedition_weight": 0.0, "tuntian_weight": 1.6},
    "huoguang": {"stipend_mult": 0.90, "expedition_weight": 0.6, "tuntian_weight": 1.2},
    "xuandi": {"stipend_mult": 1.05, "expedition_weight": 1.1, "tuntian_weight": 1.3}
  },
  "regret": {"threshold_luntai": 80, "max": 150},
  "strain": {
    "initial_by_scenario": {"scn_loulan_108bc": 25, "scn_mobei_119bc": 10, "scn_protectorate_68bc": 15},
    "decay_per_season": 6
  },
  "precedent": {"max": 10, "resistance_per_forge": 10, "resistance_threshold": 45, "count_threshold": 3},
  "allocation": {"base_quarterly_stipend": 1250, "first_quarter_bonus": 1500},
  "requests": {
    "funds": {"tiers": [1000, 2000, 3500], "trust_cost": [2, 5, 9], "cooldown_seasons": 2, "deliberation_days": 20},
    "troops": {"tiers_men": [2000, 4000, 7000], "tiers_horses": [500, 1000, 2000], "trust_cost": [4, 8, 14], "cooldown_seasons": 3, "deliberation_days": 30},
    "general": {"trust_cost": 4, "cooldown_seasons": 3, "deliberation_days": 20},
    "princess": {"trust_cost": 6, "min_trust": 50, "min_wusun_influence": 35, "deliberation_days": 30}
  },
  "tribute": {"horse_annual_cap": 1000, "horse_batch": 200, "horse_trust_gain": 3, "treasure_annual_cap": 2, "treasure_cost": 400, "treasure_trust_gain": 3},
  "office": {"titles": ["envoy", "colonel", "protector"]},
  "jianjun": {"veto_prob_base": 0.45, "override_trust_cost": 8}
}
```
- **`data/edicts.json`**：严格按 `01_cross_review_and_registry.md §5.4` 写入 `"ED01"` ~ `"ED15"` 共 15 个模板对象，每个对象包含 `id`, `name_zh`, `demo`, `tag`, `deadline_seasons`, `mandatory`, `granted_auth`, `stipend_per_season`, `reward_trust`, `reward_merit`, `fail_trust_penalty`, `decline_trust_cost`, `bargain_bonus_money`, `bargain_extra_seasons`。
- **`data/tribes.json`**：严格按 `01_cross_review_and_registry.md §2.8 & §5.1` 写入 `chanyu`, `economy`, `tribes`（4 个固定键 `zuoxian`, `youxian`, `rizhu`, `lihu`，各自含 `name`, `seat_node`, `leader_id`, `personality`, `rank_mult`, `loyalty_init`, `grievance_init`, `preferred_targets`）、`assemblies`（`new_year`, `longcheng`, `dailin`）、`tongpu`（含 `tax_tiers` 0..3 档对应的 `money_mult` 与 `resentment_delta`: `[-6, 2, 5, 14]`）与 `tactics`（5 张战术卡：`card_feigned_retreat`, `card_night_ambush`, `card_scorched_earth`, `card_autumn_plunder`, `card_raze_beacons`）。
- **`data/characters.json`**：严格按 `01_cross_review_and_registry.md §5.2 & §5.3` 写入 `characters`（25 人）、`xiongnu_successors`（4 人）、`scenario_extras`（3 人）、`fallback_generator` 与 `trait_definitions`（40 个特性 Tag）。

### ⑤ 函数级实现说明书
本工单不修改 GDScript 业务逻辑，但必须编写 **`tests/verify_tickets.py`** 基础框架并实现 `verify_T01()`：
1. `verify_tickets.py` 使用 `argparse` 解析 `--ticket Txx`、`--all`、`--sim-200`。
2. `verify_T01()` 逐一加载 `data/balance.json`, `data/units.json`, `data/ai_profiles.json`, `data/court.json`, `data/edicts.json`, `data/tribes.json`, `data/characters.json`, `data/events.json`：
   - 断言 `"convict" in units`；
   - 断言 `edicts["edicts"]` 包含 `"ED01"`..`"ED15"`；
   - 断言 `tribes["tribes"]` 精确包含 `{"zuoxian", "youxian", "rizhu", "lihu"}`，且不含 `"hujie"`（对齐 `[E-03]`）；
   - 断言 `characters` 主表 25 人 + 扩展 7 人的 ID、初始节点（`"chi_gu"`, `"da_wan"`, `"youxian_wang"`, `"cheshi_qian"`）与 40 个 `trait_definitions` 全部齐全（对齐 `[E-24]`, `[E-25]`, `[E-30]`）；
   - 断言 `ai_profiles["node_semantics"]` 覆盖全部 42 个节点且包含 16 个标准语义标签（对齐 `§5.6`）。

### ⑥ 禁止事项（Guardrails）
- **严禁**删除 `data/balance.json`、`data/units.json`、`data/ai_profiles.json` 中任何现有键（确保旧代码零报错）。
- **严禁**在任何 JSON 文件中使用 `"wu_sun"`, `"da_yuan"`, `"right_wise_court"`, `"che_shi_qian"`, `"qu_li"`, `"hujie"` 等勘误表已废止的错误 ID。

### ⑦ 验收测试代码与一键验收命令
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T01
  ```

---

## 工单 T02：`GameState` 扩展字段、`XIYU_SAVE_3` 兼容存档与 `ScenarioLoader` Delta 合并

### ① 目标与前置依赖
- **目标**：在 `core/game_state.gd` 中补齐 `design_v1` 全部顶层状态字段、实现 `XIYU_SAVE_3` 存档序列化及 `XIYU_SAVE_2` 向后兼容自愈加载，并在 `core/scenario_loader.gd` 中支持 `base_scenario` + Delta 增量剧本合并加载。
- **前置依赖**：`T01`。

### ② 必读设计规范定位
- [`01_cross_review_and_registry.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/01_cross_review_and_registry.md)：`§1.1`（`[E-01]`~`[E-12]` 状态勘误）、`§2.1`~`§2.11`（`GameState` 与全部子实体 Schema 总表）、`§6.1`（`Init-1` 剧本加载职责）。

### ③ 新建/修改文件精确路径
- `[修改]` [`core/game_state.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/core/game_state.gd)
- `[修改]` [`core/scenario_loader.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/core/scenario_loader.gd)
- `[修改]` [`tests/run_tests.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/tests/run_tests.gd)
- `[修改]` `tests/verify_tickets.py`（注册 `verify_T02`）

### ④ 数据结构与 JSON 完整样板
在 `core/game_state.gd` 中必须声明并初始化以下全部顶层成员变量（与 `01_cross_review_and_registry.md §2.1` 100% 对齐）：
```gdscript
const SAVE_HEADER := "XIYU_SAVE_3\n"
const LEGACY_HEADERS := ["XIYU_SAVE_2\n", "XIYU_SAVE_1\n"]

# 只读配置字典（不入档）
var bal: Dictionary = {}
var units: Dictionary = {}
var buff_defs: Dictionary = {}
var ai_profiles: Dictionary = {}
var court_cfg: Dictionary = {}
var edicts_cfg: Dictionary = {}
var tribes_cfg: Dictionary = {}
var characters_cfg: Dictionary = {}
var events_cfg: Dictionary = {}

# 新增顶层持久化字段（必须加入 SAVE_KEYS）
var scenario_id: String = "scn_mobei_119bc"
var difficulty_tier: String = "chijie"
var han_horse_pool: int = 6000
var han_horse_pool_cap: int = 30000
var tianma_breed_bonus: bool = false
var han_convict_pool: int = 4000
var convicts_levied_year: int = 0
var convicts_ransomed_season: int = 0
var supply_lines: Dictionary = {}
var next_supply_line_seq: int = 1
var tuntian_pressure: Dictionary = {}
var intel_estimates: Dictionary = {"han": {}, "xiongnu": {}}
var pending_reports: Array = []
var node_intel: Dictionary = {"han": {}, "xiongnu": {}}
var victory: Dictionary = {}
var court: Dictionary = {}
var tribes: Dictionary = {}
var missions: Dictionary = {}
var diplomatic_requests: Array = []
var recruited_missions_this_year: int = 0
var next_mission_seq: int = 1
var next_crime_seq: int = 1
var characters: Dictionary = {}
var event_state: Dictionary = {}
var chronicle: Dictionary = {"season_entries": [], "history_annals": []}
var ai_blackboard: Dictionary = {"han": {}, "xiongnu": {}}
var ui_meta: Dictionary = {}
```

### ⑤ 函数级实现说明书

#### 5.1 `core/game_state.gd` 新增/修改函数
1. `func ensure_v1_defaults() -> void`：
   - 补齐 `stats` 的 14 个键（`battles`, `sieges_won`, `horses_captured`, `hexi_lost`, `han_vassals_peak`, `han_total_deaths`, `han_combat_deaths`, `han_starved_deaths`, `han_march_deaths`, `han_deserted`, `han_casualties`, `xn_total_deaths`, `xn_starved_deaths`, `xn_casualties`），并执行 `sync_invariants()`。
   - 若 `victory.is_empty()`，初始化 `01_cross_review_and_registry.md §2.6` 全部默认键。
   - 若 `court.is_empty()`，初始化 `§2.7` 全部默认键（含 `trust: 55`, `trust_band: "normal"`, `wind_id: "wudi_early"`, `emperor_regret: 0`, `precedent: 0`, `precedent_resistance: 35`, `recall_active: false`, `recall_finalized: false`, `unpardoned_forged_edict: false`, `documents: []`, `active_edicts: []`）。
   - 若 `tribes.is_empty()`，初始化 `§2.8` 全部默认键（含 `chanyu_prestige: 35`, `reward_pool: 1000`, `tongpu_active: true`, `scatter_consecutive_turns: 0`, `succession_crisis_turns: 0`, `units: {}`）。
   - 若 `event_state.is_empty()`，初始化 `§2.10.2` 全部默认键。
   - 遍历 `nodes`：补齐 `levied_out: 0`, `colonies: 0`, `tuntian_stage: 0`, `tuntian_survey_days: 0`, `tuntian_founded_tick: -1`, `has_well: true`, `semantic_tags: []`, `base_strategic_weight: 2.0`。
   - 遍历 `routes`：补齐 `beacon: {"level": 0, "hp": 0, "owner": "", "status": "none", "build_days_left": 0}`。
   - 遍历 `armies`：将 `army.id` 强转为 `String`（`[E-09]`），补齐 `commander_id: ""`, `dismounted_cav: 0`, `forage_policy: "auto"`, `foraged_this_tick: []`, `line_id: ""`, `leg_idx: -1`, `starved_losses: 0`, `tribe_id: ("chanyu" if army.faction == "xiongnu" else "")`, `command_owner: ("chanyu" if army.faction == "xiongnu" else "han")`, `summon_seasons_left: -1`。
   - 遍历 `relations`：补齐 `han_tier`, `xn_tier`, `is_dual`, `han_enfeoffed`, `hostage_sent_han`, `han_influence`, `xn_intimidation`, `xn_resentment`, `han_resentment`, `han_awe`, `tilt`, `satiation`, `trade_banned`, `ban_lock_seasons`, `wavering_action`, `tier_lock_seasons`, `expel_cooldown_seasons`, `sacked_memory_seasons`, `crimes_against_han: []`, `crimes_against_xn: []`, `punitive_war: {}`, `supply_stance: "MARKET"`, `supply_quota_monthly: 0`, `marriage_han: false`, `horse_tribute_han: false`, `xn_tax: 2`, `tax_seasons_uncollected: 1`。
2. `func sync_invariants() -> void`：
   - 强制执行 `S10 §5.1` 的三条恒等式（`stats` 伤亡同步、`victory.winner -> state.winner` 镜像同步）。
3. `func load_from_string(s: String) -> bool`：
   - 支持 `SAVE_HEADER` (`XIYU_SAVE_3\n`) 及 `LEGACY_HEADERS` (`XIYU_SAVE_2\n`, `XIYU_SAVE_1\n`)，反序列化后调用 `ensure_v1_defaults()`，保证旧存档 100% 无损升级。

#### 5.2 `core/scenario_loader.gd` Delta 合并加载
1. 在 `load_StaticConfigs(state: GameState)` 中加载新增的 `court.json`, `edicts.json`, `tribes.json`, `characters.json`, `events.json` 到 `state.*_cfg`。
2. 在 `load_scenario(state, scenario_path, seed_val, decision_ticks_override)` 中：
   - 若读取的 JSON 含 `"base_scenario"` 字段（如 `"res://data/scenario_mvp.json"`），先加载 `base_scenario`，再将当前剧本 JSON 的 `nodes_override`、`factions_override`、`relations_override`、`armies_override`、`court_init`、`tribes_init`、`characters_init`、`scheduled_events` 深度合并进 `state`。
   - 对齐 `[E-01]`：兼容读取 `tribes_init.rizhu_grudge_initial` 与 `rizhu_grievance_init` 写入 `state.tribes.units["rizhu"].grievance`。
   - 对齐 `[E-08]`：若 `nodes_override` 含 `tuntian_level`，自动写入 `node.tuntian_stage`；若含 `tuntian_troops`，写入 `node.colonies`。
   - 对齐 `[E-11]`：若 `relations_override[sid].crimes_against_han` 为整数 `N > 0`，自动生成一条 `{"id": "crime_init_" + sid, "type": "kill_envoy", "weight": N, "created_tick": 0, "expires_season": 12, "context": {}}`。
   - 从 `state.ai_profiles.get("node_semantics", {})` 为 42 个节点挂载 `node.semantic_tags` 与 `node.base_strategic_weight`。
   - 最后调用 `state.ensure_v1_defaults()`。

### ⑥ 禁止事项（Guardrails）
- **严禁**破坏现有 `ScenarioLoader.load_scenario(state)` 默认无参调用（默认仍加载 `res://data/scenario_mvp.json` 并通过全部现有测试）。
- **严禁**把 `bal`, `units`, `court_cfg` 等静态只读配置表塞进 `SAVE_KEYS` 导致存档膨胀。

### ⑦ 验收测试代码与一键验收命令
在 `tests/run_tests.gd` 中追加并在 `_init()` 调用 `test_T02_state_and_save_compat()`：
```gdscript
func test_T02_state_and_save_compat() -> void:
	var s := new_state(9)
	_assert(s.court_cfg.has("trust"), "T02: court_cfg loaded")
	_assert(s.edicts_cfg.get("edicts", {}).size() == 15, "T02: 15 edicts loaded")
	_assert(s.nodes["dun_huang"].has("tuntian_stage"), "T02: node tuntian_stage initialized")
	_assert(s.nodes["dun_huang"].get("semantic_tags", []).has("hexi_commandery"), "T02: semantic_tags mounted")
	_assert(s.routes[0].has("beacon"), "T02: route beacon initialized")
	s.stats["han_combat_deaths"] = 120
	s.stats["han_starved_deaths"] = 80
	s.sync_invariants()
	_assert(s.stats["han_total_deaths"] == 200 and s.stats["han_casualties"] == 200, "T02: stats invariant [E-07]")
	var blob := s.save_to_string()
	_assert(blob.begins_with("XIYU_SAVE_3\n"), "T02: save header v3")
	var legacy_blob := blob.replace("XIYU_SAVE_3\n", "XIYU_SAVE_2\n")
	var s2 := GameState.new()
	ScenarioLoader.load_scenario(s2)
	_assert(s2.load_from_string(legacy_blob), "T02: load legacy v2 header")
	_assert(s2.stats["han_total_deaths"] == 200, "T02: roundtrip stats preserved")
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T02
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---

## 工单 T03：`Characters` 人物模块与 25+7 人花名册加载

### ① 目标与前置依赖
- **目标**：新建 `core/characters.gd`（类名 `Characters`），实现 EA 25 名史实人物与 7 名世系/剧本扩展人物加载、在场上限与行动锁（`locked_action`/`assigned_to`）、统帅属性导出（`command_tier = round(command/10.0)`）、使臣修正导出、战败命运检定、年度寿元检定及史书风候补人物生成。
- **前置依赖**：`T02`。

### ② 必读设计规范定位
- [`01_cross_review_and_registry.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/01_cross_review_and_registry.md)：`§1.1 [E-09], [E-10]`、`§1.2 [E-14]`、`§1.4 [E-25], [E-30]`、`§2.10.1`（`state.characters[char_id]` Schema）、`§3.1`（`assign_character`, `rotate_reserve_character`）、`§4.6`（`Characters` 11 个静态函数签名）、`§5.2`（25+7 名人物表）、`§5.3`（40 个特性表）。
- [`STATUS.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/STATUS.md)：`[R-02]` 人物属性量纲统一（`0..100` 存储，`command_tier = round(command/10.0)`）。

### ③ 新建/修改文件精确路径
- `[新建]` `core/characters.gd`
- `[修改]` [`core/scenario_loader.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/core/scenario_loader.gd)（在 `load_scenario` 末尾调用 `Characters.init_scenario(state, data)`）
- `[修改]` [`tests/run_tests.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/tests/run_tests.gd)
- `[修改]` `tests/verify_tickets.py`（注册 `verify_T03`）

### ④ 数据结构与 JSON 完整样板
`state.characters[char_id]` 单个运行时对象结构（对齐 `§2.10.1`）：
```json
{
  "id": "han_zheng_ji",
  "name_zh": "郑吉",
  "courtesy_title": "安远侯·护鄯善以西校尉",
  "faction": "han",
  "home_state": "",
  "role_tags": ["holder", "general", "envoy", "tuntian"],
  "birth_year": -105,
  "appear_year": -72,
  "death_year": -49,
  "health": 100,
  "status": "active",
  "at_node": "lun_tai",
  "locked_action": "",
  "assigned_to": "",
  "command": 86,
  "valor": 74,
  "eloquence": 82,
  "caution": 82,
  "ambition_marquis": 75,
  "resentment": 0,
  "marquis_tier": 0,
  "is_jie_holder": true,
  "deputy_has_jie": false,
  "traits": ["trait_tuntian_master", "trait_welcomer"],
  "ai_personality": "han_prudent_farmer",
  "is_generated": false,
  "deeds_log": []
}
```

### ⑤ 函数级实现说明书
在 `core/characters.gd` 中声明 `class_name Characters`，并实现以下全部静态函数：

1. `static func init_scenario(state: GameState, scn_data: Dictionary = {}) -> void`：
   - 清空 `state.characters`。将 `state.characters_cfg` 中的 `characters`、`xiongnu_successors`、`scenario_extras` 合并遍历。
   - 根据 `state.start_year` 判断初始 `status`：若 `appear_year <= state.start_year and state.start_year < death_year` 则设为 `"active"`，若 `state.start_year < appear_year` 设为 `"unborn"`，否则 `"dead"`。
   - 应用 `scn_data.get("characters_init", {})` 覆盖（如强制激活剧本指定人物、设置 `at_node`、`is_jie_holder`、绑定军队 `assigned_to`）。
   - 若汉方尚无 `is_jie_holder == true` 的 `"active"` 人物，按剧本默认赋予 `han_zhang_qian`（前 119）、`han_zhao_ponu`（前 108）或 `han_zheng_ji`（前 68），并同步 `state.court["holder_char_id"]`。

2. `static func get_char(state: GameState, char_id: String) -> Dictionary`：
   - 兼容别名 `"xn_xulvquanqu" -> "xn_xuluquanqu"`、`"xn_lihu_xiutu" -> "xn_lihu_wang"`（`[E-25]`），返回 `state.characters.get(norm_id, {})`。

3. `static func get_active_holder(state: GameState) -> Dictionary`：
   - 优先返回 `state.court.get("holder_char_id", "")` 对应的 `"active"` 人物；若为空或已故，返回 `acting_holder_char_id` 对应人物。

4. `static func get_roster(state: GameState, faction: String) -> Array[Dictionary]`：
   - 返回 `state.characters.values()` 中满足 `c.faction == faction and c.status in ["active", "in_transit"]` 的人物数组。

5. `static func get_commander_stats(state: GameState, char_id: String) -> Dictionary`（对齐 `[R-02]`, `§4.6`）：
   - 若 `char_id == ""` 或人物不存在/非激活，返回默认字典：
     `{"command": 20, "command_tier": 2, "valor": 20, "caution": 50, "traits": [], "at_node": ""}`。
   - 否则计算 `var tier: int = int(round(float(c.get("command", 50)) / 10.0))`，返回：
     `{"command": int(c.command), "command_tier": clampi(tier, 0, 10), "valor": int(c.valor), "caution": int(c.caution), "traits": c.get("traits", []).duplicate(), "at_node": str(c.get("at_node", ""))}`。

6. `static func get_envoy_modifiers(state: GameState, char_id: String) -> Dictionary`：
   - 读取人物 `eloquence`（默认 60）与 `traits`；检查张骞是否曾出使以判定 `bowang_credit_bonus`（若人物自身含 `trait_bowang_credit` 或 `state.event_state.get("chain_flags", {}).get("bowang_credit_active", false)` 则为 `0.08`，否则 `0.0`）。
   - 返回 `{"eloquence": elo, "has_pioneer": ("trait_pioneer" in traits), "has_resolute": ("trait_resolute" in traits), "bowang_credit_bonus": bonus}`。

7. `static func pick_idle_envoy(state: GameState, faction: String = "han") -> String` 与 `static func pick_commander_at(state: GameState, node_id: String, faction: String = "han") -> String`：
   - 从 `get_roster(state, faction)` 中筛选 `c.status == "active" and c.locked_action == ""` 的人物（`pick_commander_at` 额外要求 `c.at_node == node_id` 且 `"general" in c.role_tags`），按 `eloquence` 或 `command` 降序返回最高者的 `id`（无则返回 `""`）。

8. `static func validate_assign(state: GameState, cmd: Dictionary) -> String` 与 `static func apply_assign(state: GameState, cmd: Dictionary) -> void`：
   - 校验人物 `status == "active"`、未锁定或解锁原目标、且所在节点与目标一致；通过后更新 `c.locked_action = target_type`（`"army"` / `"mission"` / `"node"`）、`c.assigned_to = str(target_id)`，若 `target_type == "army"` 则同步更新 `state.armies[str(target_id)].commander_id = char_id`。

9. `static func validate_rotate(state: GameState, cmd: Dictionary) -> String` 与 `static func apply_rotate(state: GameState, cmd: Dictionary) -> void`：
   - 校验被轮换人物在长安或河西且 `locked_action == ""`，执行在场/候补切换。

10. `static func generate_fallback_character(state: GameState, role: String, faction: String = "han") -> Dictionary`（对齐 `[R-02]`）：
    - 使用 `state.rng` 从 `characters_cfg.fallback_generator` 中抽取官号+汉代姓氏（或匈奴氏族），生成 `command/valor/eloquence/caution` 在 `50..72` 之间的候补人物并写入 `state.characters`。

11. `static func roll_battle_fate(state: GameState, char_id: String, is_loser: bool, is_wiped: bool) -> void` 与 `static func year_end_mortality_check(state: GameState) -> void`：
    - 战败或全军覆没时按 `state.rng` 检定负伤（`health -= 25`）、阵亡或被俘（李广迷道、赵破奴没胡等可触发对应事件钩子）。
    - 岁末遍历 `state.characters`：若 `current_year >= appear_year and c.status == "unborn"` 则激活登场；若 `c.traits` 含 `"trait_yellow_swan"` 则 `health -= 18`；超过 `death_year` 后按超龄年数递增病逝概率，死亡时释放其锁定的军队/使团并若为持节者或单于则通知 `Court` / `Tribes` 触发继任。

### ⑥ 禁止事项（Guardrails）
- **严禁**将人物四维能力直接存为 `0..10` 小整数；必须存 `0..100` 并通过 `get_commander_stats` 导出 `command_tier`（`[R-02]`）。
- **严禁**让同一个人物同时绑定两个 `assigned_to` 实体（绑定新军队前必须先清理旧军队的 `commander_id`）。

### ⑦ 验收测试代码与一键验收命令
在 `tests/run_tests.gd` 中追加 `test_T03_characters_module()`：
```gdscript
func test_T03_characters_module() -> void:
	var s := new_state(9)
	Characters.init_scenario(s, {})
	_assert(s.characters.has("han_zhang_qian"), "T03: Zhang Qian loaded")
	_assert(s.characters.has("xn_xianxianshan"), "T03: Xianxianshan loaded")
	var st := Characters.get_commander_stats(s, "han_zheng_ji")
	_assert(st["command"] == 86 and st["command_tier"] == 9, "T03: Zheng Ji command_tier == 9 [R-02]")
	var empty_st := Characters.get_commander_stats(s, "")
	_assert(empty_st["command_tier"] == 2, "T03: default command_tier == 2")
	var fb := Characters.generate_fallback_character(s, "envoy", "han")
	_assert(fb["is_generated"] == true and s.characters.has(fb["id"]), "T03: fallback generator works")
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T03
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---

## 工单 T04：`Victory` 都护府功业值 $G$、双路径胜利、连续计分与史官五档评定

### ① 目标与前置依赖
- **目标**：重写 `core/victory.gd`（类名 `Victory`），完整实现 `S01` 的汉都护府功业值 $G$（10 项分项汇总）、匈奴威服值 $W$（7 项分项汇总）、双路径主胜利维持期、政治崩盘提前战败（`HAN_RECALL` / `XN_SCATTER`）、到期连续计分、史官五档评定、终局签名生成及 AI 边际功业查询图。
- **前置依赖**：`T02`。

### ② 必读设计规范定位
- [`01_cross_review_and_registry.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/01_cross_review_and_registry.md)：`§1.1 [E-04], [E-05], [E-08], [E-12]`、`§1.3 [E-18]`、`§1.4 [E-27]`、`§2.6`（`state.victory` Schema）、`§3.1`（`petition_establish_protectorate`, `concede_scenario`）、`§4.1`（`Victory` 全部 14 个静态函数签名）、`§6.6 ME-5`。
- [`STATUS.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/STATUS.md)：`[R-03]` 胜利与计分归口（两属国印绶 `+2`、到期计分汉匈各 `+2.5`、政治崩盘单列）。
- `docs/design_v1/S01_victory_scenarios.md`：`S01-R01`~`S01-R11`。

### ③ 新建/修改文件精确路径
- `[修改]` [`core/victory.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/core/victory.gd)
- `[修改]` [`tests/run_tests.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/tests/run_tests.gd)
- `[修改]` `tests/verify_tickets.py`（注册 `verify_T04`）

### ④ 数据结构与 JSON 完整样板
`Victory.get_han_merit_breakdown(state)` 与 `Victory.get_xn_weifu_breakdown(state)` 返回字典严格对齐 `§4.1`：
```gdscript
# 汉功业拆解字典键：
# {"vassal":int, "enfeoff":int, "hub":int, "tuntian":int, "suppress":int, "great":int, "tongpu":int, "event_pool":float, "permanent":int, "hexi_penalty":int, "petition_boost":int, "total":int}
# 匈威服拆解字典键：
# {"hexi":int, "vassal":int, "hub":int, "tongpu":int, "prestige":int, "event_pool":float, "sacred_penalty":int, "total":int}
```

### ⑤ 函数级实现说明书
在 `core/victory.gd` 中实现以下全部静态函数（保留旧版兼容辅助函数，新增/升级核心接口）：

1. `static func get_han_merit_breakdown(state: GameState) -> Dictionary` 与 `static func get_han_merit(state: GameState) -> int`（及别名 `calc_duhu_merit`）：
   - **属国分 `vassal`**：遍历 18 城邦，若 `rel.overlord == "han" and not rel.is_dual`（含 `"vassal"` 与 `"puppet"`），每国 `+5`，上限 `35`。
   - **印绶分 `enfeoff`**：遍历 18 城邦，若 `rel.han_enfeoffed == true`（含两属国 `is_dual == true`，对齐 `[R-03]`），每国 `+2`，上限 `12`。
   - **枢纽分 `hub`**：`["lou_lan", "wu_lei", "cheshi_qian"]` 中，节点 `faction == "han"` 或其对应政权 `overlord == "han"`，每个 `+5`（上限 `15`）。
   - **屯田分 `tuntian`**：统计西域绿洲节点（非汉朝本土/河西）满足 `node.tuntian_stage >= 1 or node.colonies > 0` 的存粮总和 `western_grain` 与立屯点数 `active_tuntian_nodes`，`tuntian = clampi(int(floor(western_grain / 2000.0)) + active_tuntian_nodes * 2, 0, 15)`。
   - **破胡抑威分 `suppress`**：计算 18 城邦平均匈奴威吓 `avg_x`，`suppress = clampi(int(round((55.0 - avg_x) * 0.25)), 0, 10)`。
   - **大国交好分 `great`**：遍历 5 大国（`"wusun"`, `"dawan"`, `"kangju"`, `"dayuezhi"`, `"jibin"`），若 `rel.marriage_han or rel.horse_tribute_han or rel.overlord == "han"` 则 `+4`，若 `rel.han_influence >= 60` 则 `+2`，上限 `12`。
   - **罢僮仆分 `tongpu`**：若 `not state.tribes.get("tongpu_active", true)` 则 `+10`，否则 `0`。
   - **事件池与永久勋**：`event_pool = clampf(float(state.victory.get("han_merit_pool", 0.0)), -20.0, 30.0)`；`permanent = clampi(int(state.victory.get("han_permanent_merit", 0)), 0, 40)`。
   - **河西失守罚分 `hexi_penalty`**：统计 `["wu_wei", "zhang_ye", "jiu_quan", "dun_huang"]` 中 `node.faction != "han"` 的个数 $\times 15$。
   - **奉表冲线加值 `petition_boost`**：若 `state.victory.get("petition_boost_seasons", 0) > 0` 则为 `10`，否则 `0`。
   - `total = clampi(vassal + enfeoff + hub + tuntian + suppress + great + tongpu + int(round(event_pool)) + permanent + petition_boost - hexi_penalty, -60, 200)`。同步写入 `state.victory["han_merit"]` 与 `state.victory["han_merit_breakdown"]`。

2. `static func get_xn_weifu_breakdown(state: GameState) -> Dictionary`（别名 `get_xn_prestige_breakdown`）与 `static func get_xn_weifu(state: GameState) -> int`：
   - **`hexi`**：河西四郡中 `node.faction == "xiongnu"` 每个 `+12`（上限 `48`）。
   - **`vassal`**：18 城邦中 `rel.overlord == "xiongnu"`（非两属 `+4`，两属 `is_dual` `+2`），上限 `36`。
   - **`hub`**：三大枢纽由匈奴直控或独占宗主，每个 `+5`（上限 `15`）。
   - **`tongpu`**：`state.tribes.get("tongpu_active", true)` 为真且日逐部未叛则 `+10`，否则 `0`。
   - **`prestige`**：`clampi(int(floor(float(state.tribes.get("chanyu_prestige", 35)) / 5.0)), 0, 20)`。
   - **`event_pool`**：`clampf(float(state.victory.get("xn_weifu_pool", 0.0)), -20.0, 25.0)`。
   - **`sacred_penalty`**：`["chanyu_ting", "long_cheng", "youxian_wang"]` 中被汉占领或 `longcheng_desecrated` 每个扣 `20`。
   - `total = clampi(hexi + vassal + hub + tongpu + prestige + int(round(event_pool)) - sacred_penalty, -40, 200)`。

3. `static func record_event_award(state: GameState, faction: String, award_key: String, value_override: Variant = null) -> void` 与 `static func record_battle_milestone(state: GameState, winner: String, killed: int, commander_id: String = "") -> void`：
   - 根据 `award_key`（如 `"battle_major_win": +6.0`, `"disaster_loss": -6.0`, `"first_hostage": +2.0`, `"punish_guilty_state": +4.0`, `"rizhu_surrender": +15` 永久勋）向 `han_merit_pool` / `xn_weifu_pool` 或 `han_permanent_merit` 累加分数。
   - `on_rizhu_surrender(state)`：置 `state.tribes["tongpu_active"] = false`，给 `han_permanent_merit += 15`，向 `key_events_occurred` 追加 `"rizhu"`。
   - `on_han_court_recall_defeat(state)`：置 `state.court["recall_finalized"] = true` 并立即触发 `HAN_RECALL` 终局裁决。

4. `static func monthly(state: GameState) -> void`（严格按 `§6.6 ME-5` 六步执行）：
   - **Step 1**：若为季末（`state.tick % 9 == 8`），`han_merit_pool *= 0.85`、`xn_weifu_pool *= 0.85`，递减 `petition_boost_seasons`；若为 12 月末，清零 `yearly_award_counts`。
   - **Step 2**：调用 `get_han_merit(state)` 与 `get_xn_weifu(state)`，更新历史峰值与 `lead_changes_count`。
   - **Step 3（维持月数）**：
     - 汉方：若 `state.court.get("recall_active", false)` 为真，**冻结** `han_hold_months` 不增不减；否则若 $G \ge 100$ 且河西四郡全属汉且 ` wu_lei` 或 `lun_tai` 受汉控制，则 `han_hold_months += 1`，否则 `han_hold_months = maxi(0, han_hold_months - 1)`。
     - 匈奴路径 A（河西）：若河西四郡全属匈奴则 `xn_hexi_hold_months += 1`，否则重置为 `0`。
     - 匈奴路径 B（威服）：若 $W \ge 100$ 且 `state.tribes.get("succession_crisis_turns", 0) <= 0` 则 `xn_weifu_hold_months += 1`，否则 `maxi(0, xn_weifu_hold_months - 1)`。
   - **Step 4（政治崩盘失败检定）**：
     - 读取 `han_collapse = bool(state.court.get("recall_finalized", false))`；
     - 同步 `state.victory["xn_scatter_streak_quarters"] = int(state.tribes.get("scatter_consecutive_turns", 0))`，`xn_collapse = (state.victory["xn_scatter_streak_quarters"] >= 2)`；
     - 若两者皆真 $\to$ `MUTUAL_COLLAPSE`（`"draw"`）；若仅 `han_collapse` $\to$ `HAN_RECALL`（`winner = "xiongnu"`）；若仅 `xn_collapse` $\to$ `XN_SCATTER`（`winner = "han"`）。
   - **Step 5（主胜利检定）**：
     - 若 `victory_mode == "objectives"`（剧本①）：检查 3 项专项任务（楼兰或姑师臣服、玉门至轮台驿道贯通、至少 1 处屯田 Stage $\ge 1$），全满足则 `HAN_MAIN`；
     - 否则：若 `han_hold_months >= 12` $\to$ `HAN_MAIN`（`winner = "han"`）；若 `xn_hexi_hold_months >= 6` $\to$ `XN_MAIN_HEXI`（`winner = "xiongnu"`）；若 `xn_weifu_hold_months >= 12` $\to$ `XN_MAIN_WEIFU`（`winner = "xiongnu"`）。
   - **Step 6（到期连续计分与史官评定）**：
     - 当 `state.months_elapsed() >= state.max_turns` 且未分胜负时，调用 `evaluate_expiry_preview(state)` 计算连续得分（含两属国各 `+2.5`、国家马匹池 `han_horse_pool / 1000.0 * 1.2`、人口保有率），分差 $< 3.0$ 判 `EXPIRY_DRAW`，否则判 `EXPIRY_HAN` 或 `EXPIRY_XN`。
     - 一旦结束，调用 `_finalize_game_over(state, end_type, winner)` 生成五档评定（`G1_FENGHOU`..`G5_ZUZHU`；注意 `[E-05]`：若 `HAN_MAIN` 但 `court.precedent >= 3` 或 `court.precedent_resistance >= 45`，降级为 `G2_GUANNEIHOU`「功大不封，赐爵关内侯」；若 `HAN_RECALL` 且 `unpardoned_forged_edict == true` 则判 `G5_ZUZHU`，否则 `G4_XIAYU`）、细粒度签名 `end_signature` 与粗粒度签名 `end_signature_coarse`，并调用 `state.sync_invariants()`。

5. `static func get_marginal_merit_map(state: GameState, faction: String) -> Dictionary`：
   - 返回每个城邦/节点若被当前阵营攻克或纳属可带来的边际功业/威服增量（如三大枢纽 `+10.0`、河西四郡 `+15.0`、普通城邦 `+5.0`），供 `S08` AI 决策直接叠加。

### ⑥ 禁止事项（Guardrails）
- **严禁**把 `HAN_RECALL` 或 `XN_SCATTER` 的 `end_type` 写成 `"EXPIRY_*"`（必须严格区分主胜利、政治崩盘、到期计分三类结局，对齐 `[R-03]`）。
- **严禁**修改 `state.victory.winner` 后忘记同步顶层 `state.winner` 与 `state.win_reason`（`[E-12]`）。

### ⑦ 验收测试代码与一键验收命令
在 `tests/run_tests.gd` 中追加 `test_T04_victory_and_grades()`：
```gdscript
func test_T04_victory_and_grades() -> void:
	var s := new_state(9)
	Victory.init_scenario(s, {})
	var g0 := Victory.get_han_merit(s)
	var w0 := Victory.get_xn_weifu(s)
	_assert(g0 >= -60 and g0 <= 200 and w0 >= -40 and w0 <= 200, "T04: merit/weifu in valid range")
	Victory.on_rizhu_surrender(s)
	var g1 := Victory.get_han_merit(s)
	_assert(g1 >= g0 + 20, "T04: Rizhu surrender grants +15 permanent +10 tongpu bonus")
	s.court["precedent"] = 3
	s.victory["han_hold_months"] = 12
	Victory.monthly(s)
	_assert(s.victory["is_game_over"] and s.winner == "han", "T04: Han main victory triggered")
	_assert(s.victory["han_grade"] == "G2_GUANNEIHOU", "T04: precedent >= 3 downgrades to Guannei Marquis [E-05]")
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T04
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---

## 工单 T05：`Court` & `Documents` 朝廷信任、首季拨款、文书驿传实体与 15 诏令/矫诏自劾

### ① 目标与前置依赖
- **目标**：新建 `core/documents.gd`（类名 `Documents`）与 `core/court.gd`（类名 `Court`），实现汉廷信任五档与迟滞、四朝风向、武帝悔意与轮台诏、首季/每季拨款、文书沿古道驿传实体、15 道诏令生成/响应/讨价还价、矫诏与自劾生死时速环、四类奏请、岁献及监军御史机制。
- **前置依赖**：`T03`, `T04`。

### ② 必读设计规范定位
- [`01_cross_review_and_registry.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/01_cross_review_and_registry.md)：`§1.1 [E-02], [E-05], [E-06]`、`§1.2 [E-13], [E-14]`、`§1.3 [E-19]`、`§1.4 [E-26]`、`§2.7`（`state.court` Schema）、`§3.2`（13 条汉廷命令）、`§4.2`（`Court` 26 个 + `Documents` 2 个静态函数签名）、`§5.4`（15 道诏令模板）。
- `docs/design_v1/S02_han_court.md`：`S02-R01`~`S02-R11`。

### ③ 新建/修改文件精确路径
- `[新建]` `core/documents.gd`
- `[新建]` `core/court.gd`
- `[修改]` [`tests/run_tests.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/tests/run_tests.gd)
- `[修改]` `tests/verify_tickets.py`（注册 `verify_T05`）

### ④ 数据结构与 JSON 完整样板

#### 4.1 `Document` 在途文书实体（存于 `state.court.documents`）
```json
{
  "id": "doc_1",
  "doc_type": "edict",
  "subtype": "ED01",
  "origin": "chang_an",
  "target": "dun_huang",
  "current_node": "wu_wei",
  "route_nodes": ["chang_an", "wu_wei", "zhang_ye", "jiu_quan", "dun_huang"],
  "edge_idx": 1,
  "edge_days_progress": 2.0,
  "speed_mode": "courier",
  "status": "in_transit",
  "deliberation_days_left": 0,
  "payload": {"template_id": "ED01", "target_id": "lou_lan"},
  "created_tick": 0
}
```

#### 4.2 `ActiveEdict` 诏令运行实例（存于 `state.court.active_edicts`）
```json
{
  "instance_id": "ed_inst_1",
  "template_id": "ED01",
  "name_zh": "《诏：通楼兰道》",
  "tag": "expedition",
  "target_id": "lou_lan",
  "state": "pending_response",
  "mandatory": false,
  "seasons_left": 6,
  "bargained": false,
  "granted_auth": ["attack:lou_lan"],
  "stipend_per_season": 0,
  "reward_trust": 8,
  "reward_merit": 5,
  "fail_trust_penalty": -12
}
```

### ⑤ 函数级实现说明书

#### 5.1 `core/documents.gd`（类名 `Documents`）
1. `static func estimate_courier_days(state: GameState, from_node: String, to_node: String, speed_mode: String = "courier") -> float`：
   - 若 `from_node == to_node` 返回 `0.0`。
   - 调用 `Pathfinding.courier_dijkstra(state, from_node, true)`（若 `T13` 尚未合入，回退使用 BFS 最短路遍历路段：若路段两端皆属 `han_capital / hexi_commandery / frontier_gate` 则速度倍率 `4.0`，否则 `2.0`，单段耗时 `maxf(1.0, route.days / speed_mult)`）。
2. `static func create_document(state: GameState, doc_type: String, subtype: String, origin: String, target: String, payload: Dictionary = {}) -> Dictionary`：
   - 生成唯一 `id = "doc_" + str(state.court.get("next_doc_seq", 1))` 并自增序号，计算 `route_nodes` 最短路径，压入 `state.court.documents` 并返回该字典。

#### 5.2 `core/court.gd`（类名 `Court`）
必须完整实现 `01_cross_review_and_registry.md §4.2` 列出的全部 26 个静态函数 + 命令校验/执行委派函数：
1. **基础查询与授权检查**：
   - `get_trust(state) -> int`、`get_trust_band(state) -> String`、`get_wind_id(state) -> String`、`get_office_title(state) -> String`、`get_holder_node(state) -> String`、`get_pending_edicts(state) -> Array[Dictionary]`、`get_central_quota_remaining(state) -> int`。
   - `is_luntai_edict_active(state) -> bool`：返回 `state.court.get("wind_id", "") == "luntai" or bool(state.court.get("luntai_decreed", false))`。
   - `is_horse_relaxation_active(state) -> bool`：返回 `is_luntai_edict_active(state)`。
   - `can_build_tuntian(state, node_id) -> bool`：若 `is_luntai_edict_active(state)` 为真，仅允许在 `"lun_tai"`, `"lou_lan"`, `"wu_lei"` 及河西/关门立屯，拒绝更西侧的疏勒/大宛等远距节点（`ERR_LUNTAI_EDICT_FORBIDS_DISTANT_TUNTIAN`）。
   - `check_recruit_quota(state, count) -> bool` 與 `consume_central_quota(state, amount) -> void`：校验并扣减 `state.court["central_quota_remaining"]`。
   - `check_authorization(state, action_type, target_id) -> Dictionary` 与 `check_war_authorization(state, state_id, has_crime) -> Dictionary`：
     - 若 `get_trust_band(state) == "bianyi"` 返回 `{"authorized": true, "via": "bianyi", "reason": ""}`；
     - 若 `has_crime == true` 返回 `{"authorized": true, "via": "crime_exempt", "reason": ""}`；
     - 若 `active_edicts` 中存在 `state == "active"` 且 `granted_auth` 匹配 `action_type + ":" + target_id` 或 `"attack:any"`，返回 `{"authorized": true, "via": "edict", "reason": ""}`；
     - 若已通过 `forge_edict` 对该 `target_id` 矫诏，返回 `{"authorized": true, "via": "forged", "reason": ""}`；
     - 否则返回 `{"authorized": false, "via": "none", "reason": "ERR_ACTION_UNAUTHORIZED_NEED_FORGE"}`。
   - `validate_plan_authorization(state, army, plan) -> String`：
     - 当汉军计划离开河西/玉门/阳关进入西域或漠北作战时：若 `army.get("commander_id", "") == ""` 且非运粮车队，返回 `"ERR_ARMY_NEEDS_GENERAL"`；若目标为未授权且无罪城邦，返回 `"ERR_ACTION_UNAUTHORIZED_NEED_FORGE"`。

2. **讨价还价与矫诏生死时速环预览**：
   - `preview_bargain_prob(state, instance_id, reason_tags = []) -> float`：
     - 基础率 `0.35 + (get_trust(state) - 50) * 0.01`；若持节者 `eloquence >= 80` 加 `+0.15`；若 `reason_tags` 含客观理由（如 `"winter_pass_closed"`, `"grain_shortage"`）每项 `+0.10`；扣除 `treasury_strain * 0.004`，限制在 `[0.10, 0.90]`。
   - `preview_forged_edict_race(state, target_node, army_id) -> Dictionary`（`S02-R06`）：
     - 计算军队从当前节点行军攻取 `target_node` 的预计天数 `march_days`；
     - 计算自劾奏章从持节者节点送达长安 + 尚书台议处 `20` 天 + 廷尉槛车使从长安追抵 `target_node` 的总天数 `impeach_roundtrip_days`；
     - `safe_window_days = impeach_roundtrip_days - march_days`，`is_safe = (safe_window_days >= 10.0)`，返回完整预览字典供 UI 生死时速环渲染。

3. **状态变更与生命周期钩子**：
   - `init_scenario(state)`（对齐 `[Q-S02-02]`）：
     - 按 `state.scenario_id` 初始化 `trust`（65/55/60）、`treasury_strain`（25/10/15）、`wind_id`（前68年为 `"xuandi"`，其余 `"wudi_early"`）。
     - **Tick 0 首季拨款**：立即向 `state.factions["han"].money` 注入 `first_quarter_bonus (1500)` 钱，设置 `central_quota_remaining = 3500`，并签发剧本初始诏令（剧本①②签发 `"ED01"`，剧本③签发 `"ED14"`）置为 `"pending_response"`。
   - `modify_trust(state, delta, reason)`：修改 `state.court["trust"] = clampi(trust + delta, 0, 100)`，更新 `trust_band`（含 `±3` 迟滞缓冲）；若 `trust == 0` 且尚未发出召还令，置 `recall_active = true` 并从长安发出 `doc_type = "recall"` 的《槛车召还令》。
   - `add_treasury(state, money, note)` 与 `spend_military_market(state, cost, note) -> bool`：增减 `state.factions["han"].money`。
   - `apply_event_effect(state, key, delta)`（对齐 `[E-02], [E-05], [E-06]`）：
     - 若 `key == "emperor_regret"`：累加 `state.court["emperor_regret"] = clampi(regret + int(delta), 0, 150)`；当 `>= 80` 且 `!luntai_decreed` 时置 `luntai_decreed = true`、`wind_id = "luntai"`。
     - 若 `key == "precedent"`：累加 `precedent_resistance = clampi(res + int(delta), 0, 100)` 并累加 `precedent = clampi(precedent + maxi(1, int(delta) / 8), 0, 10)`。
     - 若 `key == "wind_id"`：按 `[E-06]` 兼容映射设置 `state.court["wind_id"]`。
   - `step_day(state)`：每日推进 `state.court.documents`；当 `deliberation_days_left > 0` 时递减议处天数；当文书送达目标节点时兑现效果（如请款到账、请兵注入 `state.central` 与 `han_horse_pool`、召还令送达持节者触发戴罪立功窗口或直接置 `recall_finalized = true`）。
   - `tick_end(state)`：检查 `active_edicts` 是否达成目标（如攻占目标城或纳属），达成则发放 `reward_trust` 与 `Victory.record_event_award`；逾期则扣 `fail_trust_penalty`。
   - `quarter_start(state)`：执行 `S02` 季初六步（怠政衰减、财匮衰减 `-6`、风向检定、发放本季拨款 `1250 * band_mult * wind_mult`、签发新诏令、发出《上计簿》刷新 `court_snapshot`）。

4. **13 条命令的 `validate_*` 与 `apply_*` 函数**：
   - 按 `01_cross_review_and_registry.md §3.2` 逐一实现 `respond_edict`, `forge_edict`, `request_funds`, `request_troops`, `request_character`, `request_princess`, `send_tribute`, `relocate_character`, `assign_general`, `grant_deputy_jie`, `override_jianjun`, `redeem_at_zero_trust`, `handle_rogue_general`。
   - 特别注意 `forge_edict`：每次矫诏 `precedent += 1`、`precedent_resistance += 10`；若 `self_impeach == false` 则置 `unpardoned_forged_edict = true`。

### ⑥ 禁止事项（Guardrails）
- **严禁**让长安朝廷直接读取前线实时状态签发诏令；必须读取上一季《上计簿》送达后更新的 `state.court["court_snapshot"]`（体现“将在外”时差支柱）。
- **严禁**在三档难度下修改 `base_quarterly_stipend = 1250`（遵守圣经 L8 难度不靠资源作弊）。

### ⑦ 验收测试代码与一键验收命令
在 `tests/run_tests.gd` 中追加 `test_T05_court_and_documents()`：
```gdscript
func test_T05_court_and_documents() -> void:
	var s := new_state(9)
	Characters.init_scenario(s, {})
	Court.init_scenario(s)
	_assert(Court.get_trust(s) == 55, "T05: initial trust 55 for mobei")
	_assert(Court.get_pending_edicts(s).size() >= 1, "T05: initial edict spawned")
	var ed_id: String = Court.get_pending_edicts(s)[0]["instance_id"]
	_assert(Court.validate_respond_edict(s, {"instance_id": ed_id, "action": "accept"}) == "", "T05: validate accept edict")
	Court.apply_respond_edict(s, {"instance_id": ed_id, "action": "accept"})
	_assert(Court.is_target_authorized(s, "lou_lan"), "T05: lou_lan authorized after accepting ED01")
	var race := Court.preview_forged_edict_race(s, "jing_jue", "")
	_assert(race.has("march_days") and race.has("impeach_roundtrip_days"), "T05: forged edict race preview")
	Court.apply_event_effect(s, "emperor_regret", 85)
	_assert(Court.is_luntai_edict_active(s) and not Court.can_build_tuntian(s, "shu_le"), "T05: Luntai edict blocks distant tuntian")
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T05
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---

## 工单 T06：`Tribes` 单于威望、赏赐池、四部忠诚、三次年会、僮仆都尉税队与日逐王降汉链

### ① 目标与前置依赖
- **目标**：新建 `core/tribes.gd`（类名 `Tribes`）并在 `core/combat.gd` 中挂载匈奴战术卡与僮仆护卫军击溃钩子，完整实现单于威望、赏赐池与阵营金钱强同步、四部（`zuoxian / youxian / rizhu / lihu`）忠诚与嫉妒公式、三次年会、单于继承危机、冬季白灾瓦解链、僮仆都尉巡行收税、日逐王请降链及 5 张战术卡。
- **前置依赖**：`T03`, `T04`。

### ② 必读设计规范定位
- [`01_cross_review_and_registry.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/01_cross_review_and_registry.md)：`§1.1 [E-01], [E-03], [E-04], [E-09]`、`§1.2 [E-15]`、`§1.3 [E-20]`、`§2.8`（`state.tribes` Schema）、`§3.3`（16 条匈奴命令）、`§4.3`（`Tribes` 15 个静态函数签名）。
- [`STATUS.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/STATUS.md)：`[R-01]` 季度历法对齐、`[R-04]` 四部 ID 与迎降哗变规则。
- `docs/design_v1/S03_xiongnu_confederation.md`：`S03-R01`~`S03-R12`。

### ③ 新建/修改文件精确路径
- `[新建]` `core/tribes.gd`
- `[修改]` [`core/combat.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/core/combat.gd)（接入 `Tribes.get_active_combat_modifiers` 与 `Tribes.on_tongpu_escort_defeated`）
- `[修改]` [`tests/run_tests.gd`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/tests/run_tests.gd)
- `[修改]` `tests/verify_tickets.py`（注册 `verify_T06`）

### ④ 数据结构与 JSON 完整样板
`state.tribes.units[tribe_id]` 单个部族对象结构（固定 4 键 `"zuoxian"`, `"youxian"`, `"rizhu"`, `"lihu"`，对齐 `[E-03]`）：
```json
{
  "id": "rizhu",
  "name": "日逐王部",
  "seat_node": "yan_qi",
  "leader_id": "xn_huyan_gu",
  "personality": "pragmatic",
  "rank_mult": 0.9,
  "loyalty": 62,
  "loyalty_exact": false,
  "loyalty_estimated": 60,
  "status": "normal",
  "wavering_turns_left": 0,
  "wavering_detected": false,
  "grievance": 15,
  "missed_assemblies": 0,
  "season_reward_received": 0,
  "levied_riders": 0,
  "levied_seasons_count": 0,
  "restrained_this_season": false,
  "preferred_targets": ["yan_qi", "lun_tai", "cheshi_qian"]
}
```

### ⑤ 函数级实现说明书
在 `core/tribes.gd` 中声明 `class_name Tribes`，并实现以下全部静态函数：

1. **赏赐池强同步与威望管理（`[E-20]`）**：
   - `static func add_reward_pool(state: GameState, delta_money: int, reason: String = "") -> void`（及别名 `add_loot_to_pool(state, money)`）：
     - 同步更新 `state.tribes["reward_pool"] = maxi(0, int(state.tribes.get("reward_pool", 0)) + delta_money)`；
     - 强制同步 `state.factions["xiongnu"]["money"] = float(state.tribes["reward_pool"])`。
   - `static func modify_prestige(state: GameState, delta: int, reason: String = "") -> void`：
     - 更新 `state.tribes["chanyu_prestige"] = clampi(prestige + delta, 0, 100)`。

2. **迷雾下的四部忠诚模糊区间与分赏预览（`S03-R02`, `[S03→S08]`）**：
   - `static func get_visible_loyalty_range(state: GameState, tribe_id: String, viewer_faction: String = "xiongnu") -> Vector2i`：
     - 读取 `u = state.tribes.units[tribe_id]`；若 `u.loyalty_exact == true`（如刚开完龙城/蹛林大会当季），返回 `Vector2i(u.loyalty, u.loyalty)`；
     - 否则根据 `viewer_faction`（匈奴玩家/AI 误差半宽 `half_w = 8`，汉方误差半宽 `15`）围绕 `u.loyalty_estimated` 返回 `Vector2i(clampi(est - half_w, 0, 100), clampi(est + half_w, 0, 100))`。
   - `static func preview_loyalty_delta(state: GameState, tribe_id: String, alloc_money: int) -> Dictionary`：
     - 计算该部期望赏赐 `expected = int(round(200.0 * u.rank_mult))`；
     - 若 `alloc_money >= expected`，`delta_reward = clampi(int(round(float(alloc_money - expected) / 25.0)) + 4, 2, 18)`；否则 `delta_reward = -clampi(int(round(float(expected - alloc_money) / 20.0)) + 3, 3, 20)`；
     - 计算嫉妒项 `delta_jealousy`（若其他部所得比例显著高于本部座次则扣 `-2..-6`），返回 `{"expected_money": expected, "delta_reward": delta_reward, "delta_jealousy": delta_jealousy, "delta_total": delta_reward + delta_jealousy}`。

3. **战斗修正与僮仆都尉税队护卫军回调（`[S03→S05]`）**：
   - `static func get_active_combat_modifiers(state: GameState, army_a: Dictionary, army_b: Dictionary, route_or_node: String = "") -> Dictionary`：
     - 读取 `card = state.tribes.get("active_tactic_card", "")` 与单于亲征状态 `chanyu_in_field`；
     - 若匈奴参战且单于亲征，赋予匈奴战力 `+15%`（若单于有 `trait_steppe_overlord` 再 `+15%`）；
     - 若激活 `"card_feigned_retreat"` 则置 `xn_feigned_retreat = true`（草原/荒漠首轮诱敌 `+20%`）；若激活 `"card_night_ambush"` 则置 `xn_night_ambush = true`；若激活 `"card_autumn_plunder"` 则 `burn_mult = 2.0`；若激活 `"card_scorched_earth"` 则 `scorched_earth_attrition_mult = 1.35`。
   - `static func on_tongpu_escort_defeated(state: GameState, han_army: Dictionary) -> void`：
     - 汉方缴获 `int(state.tribes.get("tongpu_cargo_money", 0) * 0.5)` 注入 `state.factions["han"].money`；
     - 置 `state.tribes["tongpu_active"] = false`、`tongpu_cooldown_turns = 4`、单于威望 `-10`、日逐王怨望 `+15`；若 `Diplomacy` 已存在则调用 `Diplomacy.on_tongpu_deposed(state)`。

4. **季初、旬末、季末生命周期钩子**：
   - `quarter_start(state)`：递减冷却；抽取 3 张候选战术卡存入 `candidate_tactic_cards`；按 `state.month()` 触发正月小会（1月）、五月龙城大会（4月）、秋季蹛林大会（7月）待决状态。
   - `tick_end(state)`：
     - 推进僮仆都尉护卫军沿 `tongpu_patrol_route` 巡行收税（对 `overlord == "xiongnu"` 城邦按 `xn_tax` 0..3 档收取税银存入 `tongpu_cargo_money`，两属城邦按 `50%` 计收；返抵 `yan_qi` 时注入 `add_reward_pool`）；
     - 若部族处于 `wavering_turns_left > 0`（如日逐王请降窗口），递减旬数并检查 `yan_qi` 或 `wu_lei` 是否有 $\ge 3000$（郑吉 `trait_welcomer` 为 $\ge 2400$）汉军抵近：若有，触发迎降成功（对齐 `[R-04]`：有具名将使则 100% 接收，无将领则承受 25% 哗变损耗），将该部置为 `"defected_han"` 并调用 `Victory.on_rizhu_surrender(state)`；
     - 若为本季第 2 旬（`state.tick % 9 == 1`），对 `loyalty < 45` 且未被弹压的部族检定擅自出兵劫掠（`command_owner = "tribe"`）。
   - `quarter_end(state)`：
     - 结算单于本部牧产基础折钱 `+450`；
     - 若为 Q4 季末（`state.month() == 12`）：检定冬季白灾（`mild` 或 `severe`，重度白灾损耗 15% 战马、置 `white_collapse_turns = 2`）与单于年度寿元/继承危机（新单于继位时若非指定储君或违背叔死弟袭承诺，置 `succession_crisis_turns = 4`、日逐王 `grievance += 35`）；
     - 结算四部季度忠诚度变化，当 `rizhu.grievance >= 70` 或 `rizhu.loyalty < 30` 时开启 `wavering_turns_left = 9` 请降窗口；
     - 统计 `loyalty < 25` 或 `status != "normal"` 的部族数：若 $\ge 3$ 部，则 `scatter_consecutive_turns += 1`，否则清零（供 `Victory.monthly` 判定连续 2 季 `XN_SCATTER` 战败，对齐 `[E-04]`）。

5. **16 条匈奴专属命令的 `validate_*` 与 `apply_*` 函数**：
   - 按 `01_cross_review_and_registry.md §3.3` 逐一实现 `distribute_rewards`（兼容键 `alloc` 与 `allocations`）、`summon_tribe_army`、`release_tribe_army`、`assembly_decision`、`designate_heir`、`restrain_tribe`、`pacify_wavering_tribe`、`replace_tribe_leader`、`reappoint_tongpu_duwei`、`set_tongpu_route`、`slaughter_horses_for_grain`、`relieve_white_disaster`、`select_tactic_card`、`toggle_chanyu_personal_command`、`recruit_nomad`、`fortify_stock_city`。

### ⑥ 禁止事项（Guardrails）
- **严禁**在 `state.tribes.units` 中出现 `"hujie"` 键；四部 ID 永远固定为 `"zuoxian"`, `"youxian"`, `"rizhu"`, `"lihu"`（`[E-03]`）。
- **严禁**直接修改 `state.tribes.reward_pool` 而不调用 `Tribes.add_reward_pool` 同步 `state.factions["xiongnu"].money`（`[E-20]`）。

### ⑦ 验收测试代码与一键验收命令
在 `tests/run_tests.gd` 中追加 `test_T06_tribes_and_confederation()`：
```gdscript
func test_T06_tribes_and_confederation() -> void:
	var s := new_state(9)
	Characters.init_scenario(s, {})
	Tribes.init_scenario(s, {})
	_assert(s.tribes["units"].keys().size() == 4 and not s.tribes["units"].has("hujie"), "T06: exact 4 tribes [E-03]")
	Tribes.add_reward_pool(s, 500, "test_loot")
	_assert(s.tribes["reward_pool"] == int(s.factions["xiongnu"]["money"]), "T06: reward_pool synced with money [E-20]")
	var rng_vec := Tribes.get_visible_loyalty_range(s, "rizhu", "xiongnu")
	_assert(rng_vec.x <= rng_vec.y and rng_vec.x >= 0 and rng_vec.y <= 100, "T06: visible loyalty range valid")
	var err := Tribes.validate_distribute_rewards(s, {"alloc": {"zuoxian": 200, "youxian": 200, "rizhu": 200, "lihu": 100}})
	_assert(err == "", "T06: validate distribute_rewards")
	Tribes.apply_distribute_rewards(s, {"alloc": {"zuoxian": 200, "youxian": 200, "rizhu": 200, "lihu": 100}})
	_assert(s.tribes["units"]["rizhu"]["season_reward_received"] == 200, "T06: reward distributed to rizhu")
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T06
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---

*—— P0A 工单分册（`T01`–`T06`）完，全部通过后进入 Gate M1 门禁验收 ——*
