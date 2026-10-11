# 西域策略

汉匈争夺西域的节点图策略游戏（Godot 4 + GDScript）。设计见 [`docs/design_doc.md`](docs/design_doc.md)。

## 目录
- `core/`：规则内核，无界面依赖：`game_state`（状态）、`sim`（回合推进/胜负）、`warfare`（行军/接战/围城）、`combat`、`economy`、`diplomacy`、`actions`（玩家行动）、`buffs`
- `data/`：数据驱动配置（`scenario_mvp.json` 剧本、`balance.json` 数值、`units.json` 兵种、`buffs.json`、`ai_profiles.json`）
- `tests/check_data.py`：数据一致性检查，`python3 tests/check_data.py`
- `tests/sim_test.gd`：规则内核测试，`godot --headless --path . -s tests/sim_test.gd`（Godot 4.3+，退出码 0 为通过）
- `docs/`：设计文档

## 状态
数据层、回合推进、经济、行军与战斗、外交行动、Buff、胜负判定已实现；人物、朝廷信任、征召、AI、界面尚未实现（见设计文档 §10）。
