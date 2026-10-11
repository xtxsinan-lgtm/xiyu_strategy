# 西域策略

汉匈争夺西域的节点图策略游戏（Godot 4 + GDScript）。设计见 [`docs/design_doc.md`](docs/design_doc.md)。

## 目录
- `core/`：规则内核（日历、状态、寻路），无界面依赖
- `data/`：数据驱动配置（`scenario_mvp.json` 剧本、`balance.json` 数值、`units.json` 兵种、`buffs.json`、`ai_profiles.json`）
- `tests/check_data.py`：数据一致性检查，`python3 tests/check_data.py`
- `docs/`：设计文档

## 状态
数据层与状态加载完成；回合推进、战斗、外交、AI、界面尚未实现（见设计文档 §10）。
