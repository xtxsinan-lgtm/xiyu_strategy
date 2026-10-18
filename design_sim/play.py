#!/usr/bin/env python3
"""文字交互试玩 CLI（S09 §6.4 LLM / 真人文字试玩界面）。

用法示例：
  python3 design_sim/play.py --side han --max-turns 5 --auto-test
  python3 design_sim/play.py --side han --max-turns 10 --seed 11001
"""
import argparse
import copy
import os
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from design_sim.ai import make_bot
from design_sim.engine import combat, commands, resolver, victory
from design_sim.engine.state import GameState, load_json
from design_sim.rulesets import attach_rules


def format_turn_observation(state, side):
    """生成当前决策回合的局势摘要文本（供真人或 LLM Agent 阅读决策）。"""
    sc = victory.score(state)
    lines = []
    lines.append("=" * 76)
    lines.append(
        "【回合 %d | %s（第 %d 季/月）】执政方：%s | 积分 汉 %d : 匈奴 %d"
        % (
            state.turn + 1,
            state.date_text(),
            state.tick // state.decision_ticks + 1,
            "汉（西域使者/都护）" if side == "han" else "匈奴（单于庭）",
            int(sc["han"]),
            int(sc["xiongnu"]),
        )
    )
    lines.append("-" * 76)
    han_m = state.factions["han"]["money"]
    xn_m = state.factions["xiongnu"]["money"]
    lines.append(
        "【国力与目标】汉金=%d | 匈奴金=%d | 汉属国=%d/%d | 匈奴属国=%d | 河西在汉=%d/4"
        % (
            han_m,
            xn_m,
            victory.han_vassals(state),
            int(state.bal["victory"]["han_required"]),
            victory.xn_vassals(state),
            4 - victory.hexi_held_by_xn(state),
        )
    )
    if side == "han":
        pool_str = ", ".join("%s:%d" % (k, v) for k, v in state.central.items())
        lines.append("【汉中央军池】" + pool_str)
        hexi_strs = []
        for nid in ("chang_an", "long_xi", "wu_wei", "zhang_ye", "jiu_quan", "dun_huang", "ju_yan"):
            n = state.nodes[nid]
            hexi_strs.append("%s(粮%.0fk,民%dk,田%d)" % (n["name"], n["grain"] / 1000.0, n["pop"] // 1000, n["farm_cap"]))
        lines.append("【河西走廊】" + " | ".join(hexi_strs))
    else:
        nom_strs = []
        for nid in ("youxian_wang", "chanyu_ting", "long_cheng", "yi_wu"):
            n = state.nodes[nid]
            nom_strs.append("%s(马%dk,民%dk,粮%.0fk)" % (n["name"], n["horses"] // 1000, n["pop"] // 1000, n["grain"] / 1000.0))
        lines.append("【草原王庭】" + " | ".join(nom_strs))

    # 重点城邦态势
    key_states = ["lou_lan", "cheshi_qian", "wu_lei", "yan_qi", "qiu_ci", "yu_tian", "shu_le", "wu_sun"]
    st_strs = []
    for sid in key_states:
        if sid in state.relations:
            r = state.relations[sid]
            ov = {"han": "汉", "xiongnu": "匈", "": "中"}[r["overlord"]]
            st_strs.append("%s[%s](汉%d/威%d/怨%d)" % (state.factions[sid]["name"], ov, int(r["han_influence"]), int(r["xn_intimidation"]), int(r["xn_resentment"])))
    lines.append("【西域诸国】" + " | ".join(st_strs))

    # 双方主力军队
    my_armies = [a for a in state.armies.values() if a["faction"] == side]
    en_armies = [a for a in state.armies.values() if a["faction"] != side and not a["is_convoy"]]
    my_desc = []
    for a in my_armies[:8]:
        loc = a["loc"].get("node", "%s→%s" % (a["loc"].get("from", ""), a["loc"].get("to", "")))
        if a["is_convoy"]:
            my_desc.append("%s@%s(夫%d,粮%.0fk,%s)" % (a["id"], loc, a["laborers"], a["grain"] / 1000.0, a["status"]))
        else:
            my_desc.append("%s@%s(兵%d,粮%.0fk,%s)" % (a["id"], loc, state.army_size(a), a["grain"] / 1000.0, a["status"]))
    lines.append("【己方部队(%d支)】%s" % (len(my_armies), " ; ".join(my_desc) if my_desc else "无"))

    en_desc = []
    for a in en_armies[:6]:
        loc = a["loc"].get("node", "%s→%s" % (a["loc"].get("from", ""), a["loc"].get("to", "")))
        en_desc.append("%s@%s(兵%d,%s)" % (a["id"], loc, state.army_size(a), a["status"]))
    lines.append("【敌方主力(%d支)】%s" % (len(en_armies), " ; ".join(en_desc) if en_desc else "无"))

    for rule in getattr(state, "rules", ()):
        extra = rule.describe_state(state, side)
        if extra:
            lines.extend(extra)
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="《西域·汉匈争霸》S09 文字交互试玩 CLI")
    parser.add_argument("--side", type=str, default="han", choices=["han", "xiongnu"], help="玩家执政方")
    parser.add_argument("--max-turns", type=int, default=5, help="试玩最大回合数")
    parser.add_argument("--seed", type=int, default=11001, help="随机种子")
    parser.add_argument("--decision-ticks", type=int, default=9, help="每回合旬数（9=季制，3=月制）")
    parser.add_argument("--ruleset", type=str, default="baseline", help="规则集")
    parser.add_argument("--opp-bot", type=str, default="baseline", help="对手 AI 策略")
    parser.add_argument("--auto-test", action="store_true", help="非交互自测模式（自动选择命令跑完 max-turns）")
    args = parser.parse_args()

    params = load_json("design_sim/params.json")
    params = copy.deepcopy(params)
    params["decision_ticks"] = args.decision_ticks

    state = GameState(params, seed=args.seed)
    attach_rules(state, args.ruleset)

    side = args.side
    opp = "xiongnu" if side == "han" else "han"
    advisor_ai = make_bot(side, "baseline", ruleset=args.ruleset)
    opp_ai = make_bot(opp, args.opp_bot, ruleset=args.ruleset)

    for _ in range(args.max_turns):
        if state.winner != "":
            break
        print(format_turn_observation(state, side))

        # 生成顾问推荐命令包与单条合法候选命令列表
        recommended = advisor_ai.think(state)
        legal_list = commands.enumerate_legal_commands(state, side)

        # 将顾问推荐中不在 legal_list 里的命令置顶并去重，保证每条好命令都有独立编号可选
        merged_cands = []
        seen_repr = set()
        for c in recommended + legal_list:
            r = repr(sorted(c.items()))
            if r not in seen_repr and commands.validate(state, c) == "":
                seen_repr.add(r)
                merged_cands.append(c)

        print("\n【可选合法命令列表】（输入编号如 `1,2,4` 下达多条命令，`a` 采纳顾问推荐组合，`0` 空过推进，`q` 退出）：")
        print("  [0] 不下达新命令，直接推进本回合")
        print("  [a] 一键采纳幕僚推荐组合（共 %d 条命令）" % len(recommended))
        for idx, c in enumerate(merged_cands, start=1):
            tag = " ★推荐" if c in recommended else ""
            print("  [%d] %s%s" % (idx, commands.describe(state, c), tag))

        chosen = []
        if args.auto_test:
            # 自测模式：优先选前 3 条合法命令（验证编号选择与命令执行闭环）
            pick_indices = list(range(1, min(4, len(merged_cands) + 1)))
            chosen = [merged_cands[i - 1] for i in pick_indices]
            print("\n> [auto-test] 自动选择编号: %s" % ",".join(str(i) for i in pick_indices))
        else:
            try:
                raw = input("\n请输入指令编号（可逗号分隔）> ").strip().lower()
            except EOFError:
                raw = "a"
            if raw in ("q", "quit", "exit"):
                print("已退出试玩。")
                break
            elif raw == "a":
                chosen = list(recommended)
            elif raw in ("", "0"):
                chosen = []
            else:
                for part in raw.split(","):
                    part = part.strip()
                    if part.isdigit():
                        k = int(part)
                        if 1 <= k <= len(merged_cands):
                            chosen.append(merged_cands[k - 1])

        opp_cmds = opp_ai.think(state)
        orders = {side: chosen, opp: opp_cmds}
        res = resolver.resolve(state, orders, capture_days=False)

        print("\n--- 本回合结算战报（下达 %d 条，生效 %d 条，被拒 %d 条）---" % (
            len(chosen),
            len([c for c in res["applied"] if c["faction"] == side]),
            len([r for r in res["rejected"] if r["cmd"]["faction"] == side]),
        ))
        for r in res["rejected"]:
            if r["cmd"]["faction"] == side:
                print("  [拒绝] %s -> %s" % (commands.describe(state, r["cmd"]), r["why"]))
        key_events = [e for e in res["events"] if e["kind"] in ("v1", "battle", "capture", "siege", "raid", "defect", "diplomacy", "economy", "starve", "victory")]
        for e in key_events[:12]:
            print("  · [%s] %s" % (e["date"], e["text"]))
        if len(key_events) > 12:
            print("  · ... 另有 %d 条事件已省略" % (len(key_events) - 12))
        print()

    print("=" * 76)
    sc = victory.score(state)
    print(
        "【试玩结束】当前进度：%s（共推进 %d 回合 / %d 个月）| 胜者：%s (%s) | 计分 汉 %d : 匈奴 %d"
        % (state.date_text(), state.turn, state.tick // 3, state.winner or "未决", state.win_reason or "进行中", int(sc["han"]), int(sc["xiongnu"]))
    )


if __name__ == "__main__":
    main()
