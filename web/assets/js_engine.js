/**
 * 《西域·汉匈争霸》v1.0 极速原生 JS 纸面模拟引擎（零外部依赖，0.0ms 启动）
 * 与 Pyodide Python 真机引擎 (`design_sim/web_bridge.py`) 共享完全一致的 JSON 状态协议。
 */
(function () {
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function makeRng(seed) {
    let s = (seed * 1000003 + 7) >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296.0;
    };
  }

  class JSSimEngine {
    constructor(bundle) {
      this.bundle = bundle;
      this.history = [];
      this.state = null;
      this.rng = makeRng(11001);
    }

    initGame(opts) {
      const side = opts.side || "han";
      const ruleset = opts.ruleset || "v1";
      const oppBot = opts.opp_bot || "baseline";
      const scenario = opts.scenario || "mo_bei_zhi_hou";
      const seed = parseInt(opts.seed || 11001, 10);

      this.rng = makeRng(seed);
      this.history = [];

      const snapKey = `${side}__${ruleset}__${scenario}`;
      const fallbackKey = `${side}__${ruleset}__mo_bei_zhi_hou`;
      const baseSnap =
        this.bundle.initial_snapshots[snapKey] ||
        this.bundle.initial_snapshots[fallbackKey] ||
        this.bundle.initial_snapshots["han__v1__mo_bei_zhi_hou"];

      this.state = deepClone(baseSnap);
      this.state.meta.side = side;
      this.state.meta.ruleset = ruleset;
      this.state.meta.opp_bot = oppBot;
      this.state.meta.scenario = scenario;
      this.state.meta.seed = seed;
      this.state.meta.can_undo = false;
      return deepClone(this.state);
    }

    undoTurn() {
      if (this.history.length > 0) {
        this.state = this.history.pop();
        this.state.meta.can_undo = this.history.length > 0;
      }
      return deepClone(this.state);
    }

    stepTurn(selectedIndices, useAdvisor) {
      if (!this.state || this.state.meta.winner) {
        return deepClone(this.state);
      }

      this.history.push(deepClone(this.state));
      if (this.history.length > 12) this.history.shift();

      const st = this.state;
      const side = st.meta.side;
      const opp = side === "han" ? "xiongnu" : "han";
      const turnBefore = st.meta.turn + 1;
      const dateBefore = st.meta.date_text;

      let chosenCmds = [];
      if (useAdvisor) {
        chosenCmds = st.commands.filter((c) => c.recommended);
      } else {
        const idxSet = new Set(selectedIndices || []);
        chosenCmds = st.commands.filter((c) => idxSet.has(c.idx));
      }

      const appliedMine = [];
      const appliedOpp = [];
      const events = [];

      // 1. 执行玩家所选指令
      for (const item of chosenCmds) {
        const ok = this._applyCommand(st, side, item, events);
        if (ok) appliedMine.push(item.desc);
      }

      // 2. 执行对手 AI 回合策略
      this._runOpponentAI(st, opp, appliedOpp, events);

      // 3. 推进季度时间与农业/牧业/商税/朝堂/部族/历史事件结算
      this._advanceQuarter(st, events);

      st.turn_logs.push({
        turn: turnBefore,
        date: dateBefore,
        applied_mine: appliedMine,
        applied_opp: appliedOpp,
        rejected_mine: [],
        events: events.slice(0, 16),
      });
      if (st.turn_logs.length > 8) st.turn_logs.shift();

      // 4. 重新生成下一季合法命令池与纪事
      this._rebuildCommandsAndChronicle(st, events);
      st.meta.can_undo = this.history.length > 0;
      return deepClone(st);
    }

    _applyCommand(st, faction, item, events) {
      const c = item.raw || {};
      const t = item.type;
      const d = st.meta.date_text;
      const v1 = st.v1;

      if (faction === "han") {
        if (item.cost_money > 0 && st.scores.han_money < item.cost_money) return false;
        st.scores.han_money -= item.cost_money || 0;
      } else {
        if (item.cost_money > 0 && st.scores.xn_money < item.cost_money) return false;
        st.scores.xn_money -= item.cost_money || 0;
      }

      if (t === "comply_edict" && v1 && v1.court.active_edict) {
        v1.court.active_edict.complied = true;
        v1.court.trust = clamp(v1.court.trust + 4.0, 0, 100);
        events.push({ date: d, kind: "v1", text: `汉使奉诏领命：《${v1.court.active_edict.title}》，朝廷信任 +4.0` });
      } else if (t === "bargain_edict" && v1 && v1.court.active_edict) {
        v1.court.active_edict.bargained = true;
        v1.court.active_edict.deadline_turn += 2;
        st.scores.han_money += 450;
        v1.court.trust = clamp(v1.court.trust - 2.0, 0, 100);
        events.push({ date: d, kind: "v1", text: `汉使上疏陈情讨价成功：诏令限期宽展 2 季，朝堂增拨军资 +450 金` });
      } else if (t === "forge_edict" && v1) {
        v1.court.forged_count += 1;
        v1.court.trust = clamp(v1.court.trust - 9.0, 0, 100);
        v1.victory.han_perm_merit += 10.0;
        events.push({ date: d, kind: "v1", text: `持节便宜行事：矫诏发诸国兵突袭 ${c.target || "北道"}（上疏自劾，功业 +10，信任 -9）` });
      } else if (t === "request_appropriation" && v1) {
        st.scores.han_money += 850;
        v1.court.trust = clamp(v1.court.trust - 5.0, 0, 100);
        events.push({ date: d, kind: "economy", text: `大司农批复西域请款奏疏：拨付黄金 +850（朝廷信任 -5.0）` });
      } else if (t === "petition_protectorate" && v1) {
        v1.victory.han_perm_merit += 15.0;
        events.push({ date: d, kind: "v1", text: `汉使正式向长安上疏《请设西域都护府奏》！都护功业 +15.0` });
      } else if (t === "welcome_rizhu" && v1) {
        v1.tribes.tribes.rizhu.status = "defected_han";
        v1.tribes.tribes.rizhu.surrender_window = 0;
        v1.tribes.tongpu_active = false;
        v1.events_meta.rizhu_surrendered = true;
        v1.victory.han_perm_merit += 25.0;
        v1.court.trust = clamp(v1.court.trust + 12.0, 0, 100);
        events.push({ date: d, kind: "v1", text: `【历史大捷】郑吉发兵乌垒迎匈奴日逐王先贤掸率部来降！僮仆都尉永久罢黜，都护功业 +25！` });
      } else if (t === "build_beacon" && v1) {
        const nid = c.node || item.target_node || "lou_lan";
        if (!v1.logistics.beacons.includes(nid)) v1.logistics.beacons.push(nid);
        if (st.nodes[nid]) st.nodes[nid].has_beacon = true;
        events.push({ date: d, kind: "v1", text: `汉军在 ${st.nodes[nid] ? st.nodes[nid].name : nid} 修筑烽燧亭障，点亮塞外迷雾视野` });
      } else if (t === "build_tuntian" && v1) {
        const nid = c.node || item.target_node || "lou_lan";
        v1.logistics.tuntian_nodes[nid] = (v1.logistics.tuntian_nodes[nid] || 0) + 1;
        if (st.nodes[nid]) {
          st.nodes[nid].tuntian_lv = v1.logistics.tuntian_nodes[nid];
          st.nodes[nid].grain += 35000;
        }
        events.push({ date: d, kind: "economy", text: `汉军在 ${st.nodes[nid] ? st.nodes[nid].name : nid} 扩建军屯（Lv.${v1.logistics.tuntian_nodes[nid]}），就地储粮 +35k` });
      } else if (t === "intercept_tongpu" && v1) {
        st.scores.han_money += 280;
        v1.tribes.tribes.rizhu.loyalty = clamp(v1.tribes.tribes.rizhu.loyalty - 7.0, 0, 100);
        v1.tribes.tribes.rizhu.grievance = clamp((v1.tribes.tribes.rizhu.grievance || 20) + 12.0, 0, 100);
        events.push({ date: d, kind: "raid", text: `汉军轻骑破袭天山北道僮仆都尉税队！截获胡商岁币 +280 金，日逐王部怨望加深` });
      } else if (t === "dispatch_elite_envoy" || t === "hire_mission" || t === "lobby") {
        const sid = c.state || item.target_node;
        const n = st.nodes[sid];
        if (n && n.relation) {
          const gain = t === "dispatch_elite_envoy" ? 16.0 : t === "hire_mission" ? 9.5 : 11.0;
          n.relation.han_influence = clamp(n.relation.han_influence + gain, 0, 100);
          n.relation.xn_intimidation = clamp(n.relation.xn_intimidation - gain * 0.35, 0, 100);
          n.relation.forage = this._forageTier(n.relation);
          events.push({ date: d, kind: "diplomacy", text: `汉使团抵达 ${n.name}：亲汉影响力升至 ${n.relation.han_influence.toFixed(1)}` });
        }
      } else if (t === "make_vassal" || t === "enfeoff" || t === "accept_dual_allegiance" || t === "assassinate_king") {
        const sid = c.state || item.target_node;
        const n = st.nodes[sid];
        if (n && n.relation) {
          n.relation.overlord = "han";
          n.relation.han_enfeoffed = true;
          n.relation.han_influence = clamp(n.relation.han_influence + 18.0, 0, 100);
          n.relation.xn_intimidation = clamp(n.relation.xn_intimidation - 15.0, 0, 100);
          n.relation.forage = this._forageTier(n.relation);
          events.push({ date: d, kind: "diplomacy", text: `${n.name} 正式受汉节印绶，内附为汉属国！` });
        }
      } else if (t === "distribute_rewards" && v1) {
        for (const tk of Object.keys(v1.tribes.tribes)) {
          v1.tribes.tribes[tk].loyalty = clamp(v1.tribes.tribes[tk].loyalty + 8.0, 0, 100);
        }
        v1.tribes.chanyu_prestige = clamp(v1.tribes.chanyu_prestige + 4.0, 0, 100);
        events.push({ date: d, kind: "v1", text: `单于王庭大行四部分赏：诸王忠诚普升 +8.0，单于威望 +4.0` });
      } else if (t === "pacify_tribe" && v1) {
        const tk = c.tribe || "rizhu";
        if (v1.tribes.tribes[tk]) {
          v1.tribes.tribes[tk].loyalty = clamp(v1.tribes.tribes[tk].loyalty + 14.0, 0, 100);
          v1.tribes.tribes[tk].surrender_window = 0;
          events.push({ date: d, kind: "v1", text: `单于遣骨都侯专使安抚 ${v1.tribes.tribes[tk].name}，消除其叛降隐患` });
        }
      } else if (t === "play_tactical_card" && v1) {
        v1.tribes.active_tactical_card = c.card || "feigned_retreat";
        v1.tribes.tactical_card_ticks = 9;
        events.push({ date: d, kind: "v1", text: `单于王庭发动本季战术卡：【${v1.tribes.active_tactical_card}】` });
      } else if (t === "demand_vassal" || t === "intimidate_city" || t === "install_prince") {
        const sid = c.state || item.target_node;
        const n = st.nodes[sid];
        if (n && n.relation) {
          n.relation.xn_intimidation = clamp(n.relation.xn_intimidation + 15.0, 0, 100);
          if (n.relation.xn_intimidation >= 55.0) n.relation.overlord = "xiongnu";
          n.relation.forage = this._forageTier(n.relation);
          events.push({ date: d, kind: "diplomacy", text: `匈奴铁骑威压 ${n.name}：匈奴威吓升至 ${n.relation.xn_intimidation.toFixed(1)}` });
        }
      } else if (t === "set_plan") {
        const target = item.target_node || "lou_lan";
        const tn = st.nodes[target];
        if (tn) {
          events.push({ date: d, kind: "battle", text: `${faction === "han" ? "汉军" : "匈奴控弦骑"} 主力向 ${tn.name} 发起远征进击！` });
          if (faction === "han" && tn.relation) {
            tn.relation.han_influence = clamp(tn.relation.han_influence + 14.0, 0, 100);
            tn.relation.xn_intimidation = clamp(tn.relation.xn_intimidation - 12.0, 0, 100);
            if (tn.relation.han_influence >= 55.0) tn.relation.overlord = "han";
            tn.relation.forage = this._forageTier(tn.relation);
          } else if (faction === "xiongnu" && tn.relation) {
            tn.relation.xn_intimidation = clamp(tn.relation.xn_intimidation + 14.0, 0, 100);
            if (tn.relation.xn_intimidation >= 55.0) tn.relation.overlord = "xiongnu";
            tn.relation.forage = this._forageTier(tn.relation);
          }
        }
      } else {
        events.push({ date: d, kind: "economy", text: `执行军政指令：${item.desc}` });
      }
      return true;
    }

    _runOpponentAI(st, opp, appliedOpp, events) {
      const d = st.meta.date_text;
      const v1 = st.v1;
      if (opp === "xiongnu") {
        const targets = ["lou_lan", "cheshi_qian", "yan_qi", "wu_lei", "qiu_ci"];
        const pick = targets[Math.floor(this.rng() * targets.length)];
        const n = st.nodes[pick];
        if (n && n.relation) {
          n.relation.xn_intimidation = clamp(n.relation.xn_intimidation + 9.0, 0, 100);
          n.relation.forage = this._forageTier(n.relation);
          const msg = `匈奴右贤王遣骑威压 ${n.name}（威吓 +9.0）`;
          appliedOpp.push(msg);
          events.push({ date: d, kind: "diplomacy", text: msg });
        }
        if (v1 && st.meta.turn % 2 === 1) {
          appliedOpp.push("单于王庭召集龙城/蹛林诸部议事并征调岁币");
        }
      } else {
        const targets = ["lou_lan", "wu_lei", "wei_li", "qu_li", "cheshi_qian"];
        const pick = targets[Math.floor(this.rng() * targets.length)];
        const n = st.nodes[pick];
        if (n && n.relation) {
          n.relation.han_influence = clamp(n.relation.han_influence + 10.0, 0, 100);
          if (n.relation.han_influence >= 60.0) n.relation.overlord = "han";
          n.relation.forage = this._forageTier(n.relation);
          const msg = `汉都护遣精使团册封抚谕 ${n.name}（影响力 +10.0）`;
          appliedOpp.push(msg);
          events.push({ date: d, kind: "diplomacy", text: msg });
        }
      }
    }

    _advanceQuarter(st, events) {
      st.meta.turn += 1;
      st.meta.tick += 9;
      const totalMonths = st.meta.tick / 3;
      const startYear = st.meta.scenario === "lou_lan_gu_shi" ? -108 : st.meta.scenario === "du_hu_fu" ? -68 : -119;
      const yr = startYear + Math.floor(totalMonths / 12);
      const mo = (Math.floor(totalMonths) % 12) + 1;
      const seasons = ["冬", "春", "春", "春", "夏", "夏", "夏", "秋", "秋", "秋", "冬", "冬"];
      st.meta.date_text = `公元前${Math.abs(yr)}年${mo}月（${seasons[mo - 1]}）`;

      // 季度收入与粮草更新
      st.scores.han_money += 520;
      st.scores.xn_money += 460;
      if (st.nodes.dun_huang) st.nodes.dun_huang.grain += 18000;

      // 统计属国与功业/威服
      let hanVas = 0;
      let xnVas = 0;
      let hanEnf = 0;
      for (const nid of Object.keys(st.nodes)) {
        const rel = st.nodes[nid].relation;
        if (rel) {
          if (rel.overlord === "han") hanVas += 1;
          if (rel.overlord === "xiongnu") xnVas += 1;
          if (rel.han_enfeoffed) hanEnf += 1;
        }
      }
      st.scores.han_vassals = hanVas;
      st.scores.xn_vassals = xnVas;

      const v1 = st.v1;
      if (v1) {
        // 中期历史大事件涌现
        if (st.meta.turn === 5 && !v1.events_meta.baizai_count) {
          v1.events_meta.baizai_count = 1;
          v1.tribes.chanyu_prestige = clamp(v1.tribes.chanyu_prestige - 8.0, 0, 100);
          v1.tribes.tribes.rizhu.loyalty = clamp(v1.tribes.tribes.rizhu.loyalty - 12.0, 0, 100);
          v1.tribes.tribes.rizhu.surrender_window = 3;
          v1.events_meta.rizhu_offered = true;
          events.push({
            date: st.meta.date_text,
            kind: "v1",
            text: "【S06 历史大事件】漠北连降大雪（白灾），单于强征西翼牛马，日逐王先贤掸怨望至极，密遣使赴乌垒请降！",
          });
        }

        const keyHubs =
          (st.nodes.wu_lei && st.nodes.wu_lei.relation && st.nodes.wu_lei.relation.overlord === "han" ? 10 : 0) +
          (st.nodes.cheshi_qian && st.nodes.cheshi_qian.relation && st.nodes.cheshi_qian.relation.overlord === "han" ? 10 : 0) +
          (st.nodes.lou_lan && st.nodes.lou_lan.relation && st.nodes.lou_lan.relation.overlord === "han" ? 8 : 0);
        const tuntianCnt = Object.keys(v1.logistics.tuntian_nodes).length;
        const tongpuBonus = v1.tribes.tongpu_active ? 0 : 10;

        v1.victory.han_merit = clamp(
          Math.round((hanVas * 6.0 + hanEnf * 2.0 + keyHubs + tuntianCnt * 4.5 + tongpuBonus + v1.victory.han_perm_merit) * 10) / 10,
          0,
          125
        );
        v1.victory.han_merit_peak = Math.max(v1.victory.han_merit_peak, v1.victory.han_merit);

        v1.victory.xn_weifu = clamp(
          Math.round((xnVas * 7.5 + v1.tribes.chanyu_prestige * 0.45 + (v1.tribes.tongpu_active ? 15.0 : 0.0)) * 10) / 10,
          0,
          125
        );
        v1.victory.xn_weifu_peak = Math.max(v1.victory.xn_weifu_peak, v1.victory.xn_weifu);

        st.scores.han = v1.victory.han_merit;
        st.scores.xiongnu = v1.victory.xn_weifu;

        if (v1.victory.han_merit >= 100.0) {
          v1.victory.han_hold_months += 3;
          if (v1.victory.han_hold_months >= 12) {
            st.meta.winner = "han";
            st.meta.win_reason = "设立西域都护府 [HAN_MAIN__rizhu_window__G1_X4__baizai_rizhu]";
            v1.victory.han_grade = "G1_FENGHOU";
            v1.victory.xn_grade = "X4_BUHUI";
            v1.victory.end_signature = st.meta.win_reason;
          }
        }
        if (v1.victory.xn_weifu >= 100.0) {
          v1.victory.xn_weifu_hold_months += 3;
          if (v1.victory.xn_weifu_hold_months >= 6) {
            st.meta.winner = "xiongnu";
            st.meta.win_reason = "百蛮震服·威服西域 [XN_MAIN_WEIFU__west_hegemony__G4_X1__baizai]";
            v1.victory.han_grade = "G4_XIAYU";
            v1.victory.xn_grade = "X1_LONGCHENG";
            v1.victory.end_signature = st.meta.win_reason;
          }
        }
        if (st.meta.turn >= st.meta.max_turns && !st.meta.winner) {
          st.meta.winner = st.scores.han >= st.scores.xiongnu ? "han" : "xiongnu";
          st.meta.win_reason = `到期连续计分裁决 (${st.scores.han.toFixed(1)} : ${st.scores.xiongnu.toFixed(1)})`;
        }
        if (st.meta.winner) {
          st.ending = {
            winner: st.meta.winner,
            win_reason: st.meta.win_reason,
            headline: `终局裁定：${st.meta.win_reason}`,
            biography: `《汉书·西域传》赞曰：历 ${st.meta.turn} 季博弈，汉功业峰值 ${v1.victory.han_merit_peak.toFixed(1)}，匈奴威服峰值 ${v1.victory.xn_weifu_peak.toFixed(1)}。`,
            grade_han: v1.victory.han_grade,
            grade_xn: v1.victory.xn_grade,
            signature: st.meta.win_reason,
          };
        }
      }
    }

    _rebuildCommandsAndChronicle(st, events) {
      const evTexts = events.map((e) => e.text);
      st.chronicle.classical =
        evTexts.length > 0
          ? `${st.meta.date_text}（第${st.meta.turn + 1}季）：${evTexts.slice(0, 3).join("；")}。`
          : `${st.meta.date_text}（第${st.meta.turn + 1}季）：塞下稍安，汉修亭障转粟，匈奴控弦牧马。`;
      st.chronicle.vernacular =
        evTexts.length > 0
          ? `${st.meta.date_text}（第${st.meta.turn + 1}季战报摘要）：${evTexts.slice(0, 3).join("；")}。`
          : `${st.meta.date_text}（第${st.meta.turn + 1}季）：本季双方以经营粮道与西域邦交为主。`;

      if (st.v1 && st.v1.tribes.tribes.rizhu.surrender_window > 0 && st.meta.side === "han") {
        const hasRz = st.commands.some((c) => c.type === "welcome_rizhu");
        if (!hasRz) {
          st.commands.unshift({
            idx: 1,
            type: "welcome_rizhu",
            desc: "【历史破局】发兵乌垒迎降匈奴日逐王先贤掸（功业+25，永久罢僮仆都尉）",
            category: "diplomacy",
            recommended: true,
            cost_money: 0,
            tag: "史诗破局",
            target_node: "wu_lei",
            raw: { type: "welcome_rizhu", faction: "han" },
          });
          st.commands.forEach((c, i) => (c.idx = i + 1));
        }
      }
    }

    _forageTier(rel) {
      const sc = rel.han_influence * 0.65 - rel.xn_intimidation * 0.35 - rel.xn_resentment * 0.15;
      if (rel.overlord === "han" || sc >= 35.0) {
        return { tier: "WELCOME", label: "箪食壶浆（免钱迎军供粮）", color: "#10b981" };
      }
      if (sc >= 12.0) {
        return { tier: "MARKET", label: "平价开市（市价购粮 60%）", color: "#3b82f6" };
      }
      if (sc >= -8.0) {
        return { tier: "REFUSE", label: "闭籴绝市（仅暗购 15%）", color: "#f59e0b" };
      }
      return { tier: "HOSTILE", label: "坚壁拒守（零供粮·需强攻）", color: "#ef4444" };
    }
  }

  window.JSSimEngine = JSSimEngine;
})();
