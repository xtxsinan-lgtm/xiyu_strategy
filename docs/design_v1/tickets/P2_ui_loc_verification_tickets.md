# 《西域·汉匈争霸》v1.0 原子工单分册 P2：双语本地化、模块化 UI 重构与全量验收测试（T19–T24）

> **权威基准**：本分册严格对齐 [`01_cross_review_and_registry.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/01_cross_review_and_registry.md)、[`S07_ux_onboarding.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/S07_ux_onboarding.md) 与 [`S10_implementation_plan.md`](file:///Users/xtxsinan/.gemini/antigravity/scratch/xiyu_strategy/docs/design_v1/S10_implementation_plan.md)。

---

## 工单 T19：`Loc` 双语本地化框架与多槽位版本化存档

### ① 目标与前置依赖
- **目标**：新建 `core/loc.gd`（类名 `Loc`）与中英双语词表 `data/loc_zh.json`、`data/loc_en.json`，支持 `{param}` 占位符替换、文言/白话双模式切换与安全键值回退；并在 `core/save_manager.gd`（或 `core/game_state.gd`）中实现支持多槽位（Slot 1–5 + Autosave）及 `save_version = "v1.0.0"` 的版本化存档管理。
- **前置依赖**：`T01`、`T02`。

### ② 必读设计规范定位
- `docs/design_v1/01_cross_review_and_registry.md`：第 4.12 节 `core/loc.gd`、第 5.1 节 JSON 文件表。
- `docs/design_v1/S07_ux_onboarding.md`：`S07-R13`（中英双语本地化工程规范与多槽位带版本号存档界面）。

### ③ 新建/修改文件精确路径
- **新建**：
  - `core/loc.gd`
  - `data/loc_zh.json`
  - `data/loc_en.json`
- **修改**：`core/game_state.gd`（挂载多槽位存档读写辅助函数 `save_to_slot` / `load_from_slot`）

### ④ 数据结构与 JSON 完整样板
```json
// data/loc_zh.json 样板：
{
  "UI_TOP_MERIT": "都护功业：{val}/100（已维持 {months}/12 月）",
  "UI_TOP_TRUST": "朝廷信任：{val}/100【{tier}】",
  "UI_TOP_PRESTIGE": "单于威望：{val}/100",
  "UI_TOP_REWARD_POOL": "王庭赏赐池：{val} 金",
  "UI_FORAGE_WELCOME": "箪食壶浆（免钱供粮 100%）",
  "UI_FORAGE_MARKET": "平价开市（市价购粮 60%）",
  "UI_FORAGE_REFUSE": "闭籴绝市（仅高价暗购 15%）",
  "UI_FORAGE_HOSTILE": "坚壁清野（零供粮，可强征）"
}
```

### ⑤ 函数级实现说明书

#### 5.1 `core/loc.gd`（类名 `Loc`）
1. **`static var current_lang: String = "zh"`** 与 **`static var tables: Dictionary = {}`**
2. **`static func set_language(lang: String) -> void`**
   - 支持 `"zh"` 与 `"en"`；按需加载 `res://data/loc_zh.json` 与 `res://data/loc_en.json` 缓存于 `tables`。
3. **`static func t(key: String, params: Dictionary = {}) -> String`**
   - 从 `tables[current_lang]` 查找 `key`；若缺失则回退至 `tables["zh"]`，若仍缺失则返回 `key` 本身（绝不报错崩溃）。
   - 遍历 `params` 的键值对 `{k: v}`，将模板中的 `"{" + str(k) + "}"` 替换为 `str(v)`。

#### 5.2 多槽位版本化存档接口
1. **`func save_to_slot(slot_id: String) -> bool`**
   - 将 `to_save_dict()`（内含 `"save_version": "v1.0.0"`, `"saved_at_unix"`, `"scenario_id"`, `"turn"`, `"player_faction"`）写入 `user://saves/save_{slot_id}.json`。
2. **`func load_from_slot(slot_id: String) -> bool`**
   - 读取 `user://saves/save_{slot_id}.json` 并调用 `from_save_dict(data)`，兼容旧版缺失字段自动补默认值。

### ⑥ 禁止事项（Guardrails）
- **严禁**因 `loc_zh.json` 或 `loc_en.json` 缺少某个 key 而抛出异常或返回空字符串 `""`；未命中时必须原样返回 `key` 以便调试定位。

### ⑦ 验收测试代码与一键验收命令
```gdscript
func test_T19_localization_and_versioned_save() -> void:
	Loc.set_language("zh")
	var txt_zh := Loc.t("UI_TOP_MERIT", {"val": 85, "months": 6})
	_assert(txt_zh.find("85") != -1 and txt_zh.find("6") != -1, "T19: Loc.t zh parameter interpolation")
	Loc.set_language("en")
	var txt_en := Loc.t("UI_TOP_MERIT", {"val": 85, "months": 6})
	_assert(txt_en.find("85") != -1, "T19: Loc.t en parameter interpolation")
	_assert(Loc.t("NON_EXISTENT_KEY_123") == "NON_EXISTENT_KEY_123", "T19: fallback returns key itself")
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T19
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---

## 工单 T20：`UIRoot` 重构与顶栏汉/匈非对称双模式、季初纪事摘要弹窗

### ① 目标与前置依赖
- **目标**：将单体 `ui/main.gd` 拆分为协调器 `UIRoot` 与独立子面板架构（`ui/panels/`），实现汉/匈非对称双模式顶栏（`ui/panels/topbar_panel.gd`）与季初《本季纪事 + 待办 3 件事》回合摘要弹窗（`ui/panels/chronicle_modal.gd`，快捷键 `F1`）。
- **前置依赖**：`T04`、`T05`、`T06`、`T18`、`T19`。

### ② 必读设计规范定位
- `docs/design_v1/S07_ux_onboarding.md`：`S07-R01`（`ui/main.gd` 拆分为 6 个独立子面板的组件树规范）、`S07-R02`（顶栏汉/匈非对称双模式 ASCII 线框）、`S07-R03`（本季纪事 + 待办 3 件事弹窗线框）。

### ③ 新建/修改文件精确路径
- **新建**：
  - `ui/panels/topbar_panel.gd`（类名 `TopbarPanel`）
  - `ui/panels/chronicle_modal.gd`（类名 `ChronicleModal`）
- **修改**：`ui/main.gd`（作为 `UIRoot` 挂载子面板并响应 `F1`–`F6` 快捷键）

### ④ 数据结构与视图模型（ViewModel）完整样板
```gdscript
# TopbarPanel.build_viewmodel(state: GameState) -> Dictionary 样板（可无头测试）：
{
	"faction": "han",
	"date_label": "元狩四年春（前119年 Q1）",
	"money": 3500,
	"primary_gauge_label": "都护功业 18.0/100 (维持 0/12月)",
	"secondary_gauge_label": "朝廷信任 65.0/100【正常授节】",
	"special_pool_label": "天闲良马 4000 | 谪卒 3000 | 人物 3/6",
	"active_alert_count": 1
}
```

### ⑤ 函数级实现说明书

#### 5.1 `ui/panels/topbar_panel.gd`（类名 `TopbarPanel`）
1. **`static func build_viewmodel(state: GameState) -> Dictionary`**（纯数据静态函数，供无头测试与 UI 渲染共用）：
   - 当 `state.player_faction == "han"` 时：
     - 主进度槽展示 `state.victory.han_merit`（`/100.0`）与 `han_hold_months`（`/12`）；
     - 政治槽展示 `state.court.trust`、当前信任档位名称与朝廷风向 `state.court.wind`；
     - 战略池展示 `han_horse_pool`、`han_convict_pool` 与在野/在列汉使人物数 `active_count/6`。
   - 当 `state.player_faction == "xiongnu"` 时：
     - 主进度槽同时展示河西控制郡数 `hexi_held/4`（Path A）与西域威服值 `xn_weifu/100.0`（Path B）；
     - 政治槽展示单于威望 `state.tribes.prestige`、王庭赏赐池 `reward_pool` 与四部最低忠诚度预警；
     - 战略池展示僮仆都尉状态 `tongpu_active` 与战术卡冷却 `tactical_card_cooldown`。

#### 5.2 `ui/panels/chronicle_modal.gd`（类名 `ChronicleModal`）
1. **`static func build_viewmodel(state: GameState) -> Dictionary`**：
   - 读取 `state.chronicle.entries` 最新一季条目，根据 `state.chronicle.use_classical` 返回文言或白话正文，并列出最多 3 条带跳转节点 ID 的 `todo_items`。

### ⑥ 禁止事项（Guardrails）
- **严禁**在 `ui/panels/*.gd` 中直接修改 `state` 字段；所有玩家操作必须构造标准命令字典调用 `Commands.validate` 与队列提交。

### ⑦ 验收测试代码与一键验收命令
```gdscript
func test_T20_topbar_and_chronicle_viewmodel() -> void:
	var s := new_state(9)
	Characters.init_scenario(s, {})
	Victory.init_scenario(s, {})
	Court.init_scenario(s)
	Tribes.init_scenario(s)
	Chronicle.generate_quarter_chronicle(s)
	s.player_faction = "han"
	var vm_han := TopbarPanel.build_viewmodel(s)
	_assert(vm_han["faction"] == "han" and String(vm_han["primary_gauge_label"]).find("功业") != -1, "T20: Han asymmetric topbar")
	s.player_faction = "xiongnu"
	var vm_xn := TopbarPanel.build_viewmodel(s)
	_assert(vm_xn["faction"] == "xiongnu" and String(vm_xn["secondary_gauge_label"]).find("威望") != -1, "T20: Xiongnu asymmetric topbar")
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T20
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---

## 工单 T21：朝廷竹简诏令/矫诏生死时速环面板与匈奴单于王庭分赏/年会面板

### ① 目标与前置依赖
- **目标**：新建汉方专属「长安朝堂·竹简诏令与矫诏生死时速环」面板（`ui/panels/court_edict_panel.gd`，快捷键 `F2`）与匈奴专属「单于王庭·四部分赏与三次年会」面板（`ui/panels/tribal_court_panel.gd`，快捷键 `F2`）。
- **前置依赖**：`T05`、`T06`、`T20`。

### ② 必读设计规范定位
- `docs/design_v1/S07_ux_onboarding.md`：`S07-R04`（竹简封泥式诏令/奏疏与矫诏生死时速环 UI 线框）、`S07-R05`（匈奴单于王庭·四部分赏与三次年会 UI 线框）。

### ③ 新建/修改文件精确路径
- **新建**：
  - `ui/panels/court_edict_panel.gd`（类名 `CourtEdictPanel`）
  - `ui/panels/tribal_court_panel.gd`（类名 `TribalCourtPanel`）

### ④ 数据结构与视图模型完整样板
```gdscript
# CourtEdictPanel.build_viewmodel(state: GameState) -> Dictionary 样板：
{
	"trust": 65.0,
	"wind": "WU_EXPANSION",
	"active_edicts": [...],
	"in_transit_documents": [
		{"doc_id": "doc_1", "doc_type": "recall_order", "progress_ratio": 0.45, "eta_days": 22}
	],
	"forge_race_ring": {
		"is_active": true,
		"recall_eta_days": 22,
		"army_siege_eta_days": 14,
		"status_color": "GREEN_SAFE"
	}
}
```

### ⑤ 函数级实现说明书

#### 5.1 `ui/panels/court_edict_panel.gd`（类名 `CourtEdictPanel`）
1. **`static func build_viewmodel(state: GameState) -> Dictionary`**
   - 汇总 `state.court.active_edicts`（显示奉诏 `comply_edict`、上疏讨价 `bargain_edict` 的预计成功率与驿传往返天数、推辞 `refuse_edict` 按钮状态）。
   - **矫诏生死时速环（`forge_race_ring`）**：当玩家已执行 `forge_edict` 或在途存在 `"recall_order"` 文书时，对比召还令抵达玩家驻地的剩余天数 `recall_eta_days` 与主力军团抵达目标城池的预计天数 `army_siege_eta_days`，直观显示玩家能否在槛车召还令抵达前破城报捷（陈汤模式）。
   - 提供「上疏请款（`request_appropriation`）」、「上疏请兵（`request_troops`）」、「请尚公主（`request_princess`）」与「矫诏发兵并自劾（`forge_edict`）」四项操作入口。

#### 5.2 `ui/panels/tribal_court_panel.gd`（类名 `TribalCourtPanel`）
1. **`static func build_viewmodel(state: GameState) -> Dictionary`**
   - 展示四部王（`zuoxian`, `youxian`, `rizhu`, `lihu`）的模糊忠诚度区间 `Tribes.get_visible_loyalty_range`、应征折扣率、怨望值及当前分赏滑条比例 `ratios`。
   - **防嫉妒实时预览**：当玩家拖动四部分赏滑条时，实时计算 `max_ratio - min_ratio`；一旦 `> 0.15`，立即在被冷落部族旁高亮显示「嫉妒掉忠 `-4.0`」红字警告，并提供「一键防嫉妒均分」按钮。
   - 展示本季可用战术卡三选一（`TC01`–`TC05`）与正月/五月龙城/秋季蹛林年会召开按钮（`hold_assembly`）。

### ⑥ 禁止事项（Guardrails）
- **严禁**在 `TribalCourtPanel` 中向匈奴玩家直接展示部族忠诚度的精确小数（必须遵守 `S03-R03` 展示模糊区间如 `[52, 62]`，仅在部王亲自出席年会后短暂收窄误差）。

### ⑦ 验收测试代码与一键验收命令
```gdscript
func test_T21_court_and_tribal_panels() -> void:
	var s := new_state(9)
	Characters.init_scenario(s, {})
	Court.init_scenario(s)
	Tribes.init_scenario(s)
	var vm_court := CourtEdictPanel.build_viewmodel(s)
	_assert(vm_court.has("trust") and vm_court.has("forge_race_ring"), "T21: CourtEdictPanel viewmodel")
	var vm_tribal := TribalCourtPanel.build_viewmodel(s)
	_assert(vm_tribal["tribes"].size() == 4, "T21: TribalCourtPanel shows 4 tribes")
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T21
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---

## 工单 T22：18 国外交总览表、万里粮道可视化、计划预演余粮折线图与可点击史书战报

### ① 目标与前置依赖
- **目标**：新建「18 城邦 + 5 大国外交总览与功业拆解」面板（`ui/panels/diplomacy_ledger_panel.gd`，快捷键 `F3`）与「万里粮道管理 + 计划编辑器 0–18 旬余粮折线图 + 史书战报」面板（`ui/panels/logistics_preview_panel.gd`，快捷键 `F4`）。
- **前置依赖**：`T04`、`T07`、`T08`、`T09`、`T14`、`T20`。

### ② 必读设计规范定位
- `docs/design_v1/S07_ux_onboarding.md`：`S07-R06`（18 城邦外交总览排序表与都护府功业 $G$ 拆解线框）、`S07-R08`（计划编辑器逐旬粮食曲线 + 不归点红线）、`S07-R09`（史书式战报与「断粮饿死 X 人」单列规范）。

### ③ 新建/修改文件精确路径
- **新建**：
  - `ui/panels/diplomacy_ledger_panel.gd`（类名 `DiplomacyLedgerPanel`）
  - `ui/panels/logistics_preview_panel.gd`（类名 `LogisticsPreviewPanel`）

### ④ 数据结构与视图模型完整样板
```gdscript
# DiplomacyLedgerPanel.build_viewmodel(state: GameState) -> Dictionary 样板：
{
	"merit_breakdown": {
		"vassals": 36.0, "tributaries": 8.0, "key_hubs": 10.0, "tuntian": 9.0,
		"intim_suppressed": 6.0, "grand_allies": 5.0, "tongpu_abolished": 0.0,
		"combat_merit": 4.0, "permanent_deeds": 0.0, "hexi_penalty": 0.0, "total": 78.0
	},
	"city_rows": [
		{
			"state_id": "lou_lan", "tier": "vassal", "han_influence": 68.0, "xn_intimidation": 32.0,
			"forage_tier": "WELCOME", "has_crime": false, "can_dispatch_elite": true
		}
	]
}
```

### ⑤ 函数级实现说明书

#### 5.1 `ui/panels/diplomacy_ledger_panel.gd`（类名 `DiplomacyLedgerPanel`）
1. **`static func build_viewmodel(state: GameState, sort_by: String = "han_influence") -> Dictionary`**
   - 顶部展示 `Victory.compute_han_merit(state)` 的 10 项构成明细条与 `Victory.compute_xn_weifu(state)` 的 4 项构成明细条。
   - 表格列出 18 个计分城邦与 5 个大国，每行包含：当前外交层级（含 `is_dual` 两属标记）、汉影响力、匈奴威吓、对汉/对匈怨恨、当前主力军团过境时的预计供粮意愿档位（调用 `Diplomacy.get_forage_willingness`）、有效罪状徽章、以及一键派遣精使/募使（`dispatch_mission`）或匈奴威压/废立（`intimidate_city`/`install_prince`）按钮。

#### 5.2 `ui/panels/logistics_preview_panel.gd`（类名 `LogisticsPreviewPanel`）
1. **`static func build_plan_preview_vm(state: GameState, army_id: String, steps: Array, preset: String) -> Dictionary`**
   - 调用 `Preview.simulate_food_curve(state, army_id, steps, preset)`。
   - 生成 19 个旬节点的折线图坐标点序列、绿色安全区、黄色「不归点（`point_of_no_return_tick`）」警示竖线、红色「断粮饿死起点（`starve_tick`）」阻塞线，以及「守军就地食城粮」提示标签。
2. **`static func format_battle_report_entry(report: Dictionary) -> Dictionary`**
   - 将战斗与围城结算日志格式化为可点击定位 `node_id` 的战报卡，**强制将「战死伤亡（`combat_losses`）」与「断粮饿死（`starve_losses`）」分列显示**（解决审计报告指出的 70% 饿死混同于战死导致玩家困惑的痛点）。

### ⑥ 禁止事项（Guardrails）
- **严禁**把断粮减员人数混入战斗阵亡人数展示；战报卡片必须单独渲染 `饿死：{starve_losses} 人` 字段。

### ⑦ 验收测试代码与一键验收命令
```gdscript
func test_T22_diplomacy_ledger_and_logistics_preview_vm() -> void:
	var s := new_state(9)
	Characters.init_scenario(s, {})
	Victory.init_scenario(s, {})
	SupplyLines.init_scenario(s)
	var vm_dip := DiplomacyLedgerPanel.build_viewmodel(s)
	_assert(vm_dip["city_rows"].size() >= 18, "T22: DiplomacyLedgerPanel lists >= 18 city-states")
	var vm_prev := LogisticsPreviewPanel.build_plan_preview_vm(s, "han_1", [{"type": "move_to", "node": "lou_lan"}], "balanced")
	_assert(vm_prev.has("points") and vm_prev.has("point_of_no_return_tick"), "T22: LogisticsPreviewPanel food curve vm")
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T22
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---

## 工单 T23：CK3 式 3 层嵌套 Tooltip 与地图迷雾/威胁圈/驿骑渲染

### ① 目标与前置依赖
- **目标**：新建支持悬停锁定的 3 层嵌套 Tooltip 组件（`ui/panels/nested_tooltip.gd`），并在地图绘制层（`ui/map_view.gd` 或 `ui/main.gd` 地图画布）中实现补给线带宽/红字缺口、五级迷雾 `L0..L4`、敌军 30/60/90 日威胁圈、以及在途文书驿骑/使团/僮仆税队的动态图标渲染。
- **前置依赖**：`T05`、`T06`、`T09`、`T13`、`T14`、`T20`。

### ② 必读设计规范定位
- `docs/design_v1/S07_ux_onboarding.md`：`S07-R07`（地图可视化图层规范）、`S07-R10`（CK3 式 3 层嵌套 Tooltip 规范与全部核心公式展开模板）。

### ③ 新建/修改文件精确路径
- **新建**：`ui/panels/nested_tooltip.gd`（类名 `NestedTooltip`）
- **修改**：`ui/main.gd`（地图图层绘制钩子与图层开关快捷键）

### ④ 数据结构与公式展开样板
```gdscript
# NestedTooltip.build_formula_breakdown(state: GameState, topic_id: String, target_id: String) -> Dictionary 样板：
{
	"level": 1,
	"title": "楼兰·供粮意愿：平价开市 (评分 48.5)",
	"formula_lines": [
		{"label": "汉方影响力加成 (+0.6 × 52.0)", "val": "+31.2", "sub_topic": "INFLUENCE_DETAIL"},
		{"label": "大军威慑比加成", "val": "+18.0", "sub_topic": "ARMY_RATIO_DETAIL"},
		{"label": "匈奴威吓抵消 (-0.4 × 45.0)", "val": "-18.0", "sub_topic": "INTIMIDATION_DETAIL"}
	]
}
```

### ⑤ 函数级实现说明书

#### 5.1 `ui/panels/nested_tooltip.gd`（类名 `NestedTooltip`）
1. **`static func build_formula_breakdown(state: GameState, topic_id: String, target_id: String = "") -> Dictionary`**
   - 支持展开全部 8 大核心公式的逐项加减明细（绝不留黑箱数字）：
     - `"HAN_MERIT"`（都护府功业 $G$ 10 项明细）
     - `"XN_WEIFU"`（匈奴威服值 $W$ 4 项明细）
     - `"COURT_TRUST"`（朝廷信任每季增减与阈值效果）
     - `"TRIBE_LOYALTY"`（部族忠诚模糊区间与应征折扣/嫉妒修正）
     - `"FORAGE_WILLINGNESS"`（城邦供粮意愿四档评分构成）
     - `"BARGAIN_PROB"`（上疏讨价成功率公式）
     - `"SUPPLY_LINE_EFF"`（自动补给线送达率与损耗明细）
     - `"COMBAT_ODDS"`（交战战力对比、城防乘数與统率 `command_tier` 加成）
   - 支持最多 3 层嵌套（`level = 1..3`），悬停 `0.6` 秒或按中键锁定当前层以点击内嵌带下划线的名词链接进入下一层。

#### 5.2 地图 4 大战术图层渲染数据（`build_map_overlay_vm(state: GameState)`）
1. **粮道图层**：遍历 `state.supply_lines`，按 `actual_delivered_last_tick` 映射线宽 `2.0..8.0 px`；若 `status != "active"` 或效率 `< 0.5`，渲染红色虚线与缺口警示图标。
2. **迷雾与烽燧图层**：按 `Fog.get_node_visibility` 渲染 `L0..L4` 透明度遮罩，并在 `beacon_level >= 1` 的节点绘制烽火台徽标。
3. **威胁圈图层**：调用 `Preview.compute_threat_rings(state, state.player_faction)`，绘制 30 日（深红）、60 日（橙色）、90 日（浅黄）三层可达边界。
4. **在途实体图层**：根据 `progress_days / total_days` 在对应道路边上插值计算坐标，绘制在途诏令驿骑（竹简图标）、汉使团（节杖图标）、僮仆都尉税队（驼队图标）。

### ⑥ 禁止事项（Guardrails）
- **严禁**在地图在途实体图层中向玩家渲染处于 `L0`/`L1` 盲区且未经斥候发现的敌方军团或敌方内部文书。

### ⑦ 验收测试代码与一键验收命令
```gdscript
func test_T23_nested_tooltip_and_map_overlays() -> void:
	var s := new_state(9)
	Characters.init_scenario(s, {})
	Victory.init_scenario(s, {})
	Court.init_scenario(s)
	Tribes.init_scenario(s)
	SupplyLines.init_scenario(s)
	Fog.step_tick(s)
	for topic in ["HAN_MERIT", "XN_WEIFU", "COURT_TRUST", "FORAGE_WILLINGNESS"]:
		var tip := NestedTooltip.build_formula_breakdown(s, topic, "lou_lan")
		_assert(tip.has("formula_lines") and tip["formula_lines"].size() >= 2, "T23: NestedTooltip breakdown for " + topic)
```
- **一键验收命令**：
  ```bash
  python3 tests/verify_tickets.py --ticket T23
  godot --headless --path . --script res://tests/run_tests.gd
  ```

---

## 工单 T24：全量回归测试套件、200 局 L12 自动验收脚本与发布检查清单

### ① 目标与前置依赖
- **目标**：编写 `tests/verify_tickets.py`（支持 `--ticket T01..T24` 或 `--all` 的 Python 静态契约、JSON Schema、跨模块签名与 `design_sim` 200 局 L12 门禁一键校验器），并在 `tests/run_tests.gd` 中汇总 `test_T01` 至 `test_T23` 全部单元测试与 3 大剧本冒烟测试。
- **前置依赖**：`T01`–`T23` 全部工单。

### ② 必读设计规范定位
- `docs/design_v1/00_bible.md`：第 1 节 `L12`（量化平衡与非支配策略硬指标）、第 6 节（验证方法）。
- `docs/design_v1/01_cross_review_and_registry.md`：第 1–6 章全部契约。
- `docs/design_v1/S09_simulation_validation.md`：第 9–13 章（200 局 `v1` 模拟验证门禁与 5×5 策略矩阵门禁）。

### ③ 新建/修改文件精确路径
- **新建**：`tests/verify_tickets.py`
- **修改**：`tests/run_tests.gd`

### ④ 自动验收门禁指标（L12 Gatekeeper）
`tests/verify_tickets.py --all` 必须自动执行以下 5 大检查并全部返回 `PASS (exit code 0)`：
1. **JSON Schema 与引用完整性检查**：校验 `data/*.json` 与 `data/scenarios/*.json` 的全部键值、25+7 名人物 ID、15 条诏令 ID、40 条事件 ID、42 节点语义标签 100% 合法闭合。
2. **GDScript 静态符号与 API 签名检查**：扫描 `core/*.gd`、`ai/*.gd`、`ui/panels/*.gd`，确认 `01_cross_review_and_registry.md` 第 3 章（21 条新命令）与第 4 章（所有导出静态函数）无一遗漏、无循环依赖。
3. **`turn_resolver.gd` 32 步调用顺序检查**：确认 Phase 0 至 Phase 6 的模块调用顺序与第 6 章完全一致。
4. **零作弊迷雾隔离检查**：扫描 `ai/han_ai.gd` 与 `ai/xiongnu_ai.gd`，确认不存在任何绕过 `Fog.get_perceived_state` 直读敌军真值的违规代码。
5. **L12 200 局平衡与 5×5 策略矩阵回归检查**：调用 `design_sim/run.py` 验证：
   - 汉主胜利率 $\in [20\%, 35\%]$
   - 匈奴主胜利率 $\in [20\%, 35\%]$
   - 到期计分率 $\le 50\%$
   - 终局四段式签名数 $\ge 15$ 且单一最大占比 $\le 20\%$
   - 季制汉前 10 回合有意义命令数 $\ge 3.0$
   - 5×5 策略矩阵 `has_dominant_strategy == False`

### ⑤ 函数级实现说明书
1. 在 `tests/run_tests.gd` 的 `_init()` 中依次调用 `test_T01_json_schemas_and_balance()` 至 `test_T23_nested_tooltip_and_map_overlays()`，最后运行 3 大剧本（`lou_lan_gu_shi`, `mo_bei_zhi_hou`, `du_hu_fu`）各推进 4 季的无头冒烟测试，确认零报错、零命令拒绝（`rejected == 0`）、存档读档 `to_save_dict -> from_save_dict` 幂等。

### ⑥ 禁止事项（Guardrails）
- **严禁**跳过任何一项失败断言或用硬编码假数据伪造测试通过。

### ⑦ 验收测试命令
```bash
python3 tests/verify_tickets.py --all
python3 design_sim/run.py --games 200 --seed 11001 --decision-ticks 9 --ruleset v1 --out design_sim/out_v1_q.json
python3 design_sim/run.py --games 40 --seed 11001 --decision-ticks 9 --ruleset v1 --matrix --matrix-games 8 --out design_sim/out_v1_matrix_q.json
godot --headless --path . --script res://tests/run_tests.gd
```

---
*—— `P2_ui_loc_verification_tickets.md`（工单 T19–T24，全套 24 张工单完） ——*
