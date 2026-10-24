/**
 * 《西域·汉匈争霸》v1.0 极速原生 JS 模拟与可玩游戏引擎（零外部依赖，0.0ms 启动）
 * 同时服务于：
 *   1. `index.html`（S09 纸面推演与验证工作台）
 *   2. `play.html`（S07 商业级完整可玩网页游戏原型）
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

  const EDICT_CHAIN = [
    {
      id: "edict_open_loulan",
      title: "诏命持节通盐泽道（招抚或破服楼兰）",
      target: "lou_lan",
      deadline_turn: 6,
      reward_money: 750,
      reward_trust: 12,
      penalty_trust: 6,
      desc: "楼兰当丝路空道，数遮汉使。限期令其内附或以轻骑破其城。",
    },
    {
      id: "edict_ally_wusun",
      title: "诏命遣使通乌孙、断匈奴右臂",
      target: "wu_sun",
      deadline_turn: 12,
      reward_money: 900,
      reward_trust: 14,
      penalty_trust: 6,
      desc: "遣精使携金币赐乌孙昆莫，使汉影响力达 60 以上结为同盟。",
    },
    {
      id: "edict_hub_wulei",
      title: "诏命经营渠犁与乌垒屯田治所",
      target: "wu_lei",
      deadline_turn: 18,
      reward_money: 1100,
      reward_trust: 15,
      penalty_trust: 7,
      desc: "在乌垒或渠犁开置军屯并纳为汉属国，筑立都护府根基。",
    },
    {
      id: "edict_strike_cheshi",
      title: "诏命会诸国兵争车师前王庭",
      target: "cheshi_qian",
      deadline_turn: 26,
      reward_money: 1400,
      reward_trust: 18,
      penalty_trust: 8,
      desc: "车师扼天山北道耳目，必夺车师前王庭以绝僮仆都尉税道。",
    },
    {
      id: "edict_establish_duhu",
      title: "诏命迎降日逐、奏设西域都护府",
      target: "yan_qi",
      deadline_turn: 36,
      reward_money: 1800,
      reward_trust: 20,
      penalty_trust: 8,
      desc: "总护南北道三十六国，罢黜匈奴僮仆都尉，功业满百而立都护。",
    },
  ];

  const COMMANDER_META = {
    zhang_qian: {
      id: "zhang_qian",
      seal: "骞",
      faction: "han",
      name: "博望侯·张骞",
      title: "持节正使",
      role: "envoy",
      cmd: 78,
      dip: 96,
      caution: 82,
      trait: "【凿空】精使抚谕影响力 +30%",
      default_loc: "dun_huang",
    },
    zhao_ponu: {
      id: "zhao_ponu",
      seal: "赵",
      faction: "han",
      name: "从票侯·赵破奴",
      title: "河西属国都尉",
      role: "general",
      cmd: 85,
      dip: 62,
      caution: 65,
      trait: "【奔袭】轻骑行军加速·流沙减耗 25%",
      default_loc: "dun_huang",
    },
    zheng_ji: {
      id: "zheng_ji",
      seal: "郑",
      faction: "han",
      name: "骑都尉·郑吉",
      title: "护鄯善以西使者",
      role: "tuntian",
      cmd: 90,
      dip: 89,
      caution: 86,
      trait: "【都护】军屯产出 +25%·迎降日逐王",
      default_loc: "qu_li",
    },
    fu_jiezi: {
      id: "fu_jiezi",
      seal: "傅",
      faction: "han",
      name: "义阳侯·傅介子",
      title: "骏马监持节使",
      role: "assassin",
      cmd: 82,
      dip: 88,
      caution: 70,
      trait: "【奇谋】刺王立新成功率 +35%",
      default_loc: "dun_huang",
    },
    chang_hui: {
      id: "chang_hui",
      seal: "常",
      faction: "han",
      name: "长罗侯·常惠",
      title: "校尉持节副使",
      role: "levy",
      cmd: 86,
      dip: 85,
      caution: 80,
      trait: "【传檄】调发诸国与乌孙胡骑 +35%",
      default_loc: "wu_sun",
    },
    li_guangli: {
      id: "li_guangli",
      seal: "李",
      faction: "han",
      name: "贰师将军·李广利",
      title: "贰师将军",
      role: "general",
      cmd: 74,
      dip: 58,
      caution: 50,
      trait: "【天马】破城俘马翻倍·随军耗粮 +15%",
      default_loc: "jiu_quan",
    },
    huo_qubing: {
      id: "huo_qubing",
      seal: "霍",
      faction: "han",
      name: "骠骑将军·霍去病",
      title: "大司马骠骑将军",
      role: "general",
      cmd: 99,
      dip: 55,
      caution: 45,
      trait: "【封狼】绝漠奔袭战力 +30%·就食于敌",
      default_loc: "jiu_quan",
    },
    yizhi_xie: {
      id: "yizhi_xie",
      seal: "单",
      faction: "xiongnu",
      name: "伊稚斜单于",
      title: "撑犁孤涂大单于",
      role: "chanyu",
      cmd: 91,
      dip: 76,
      caution: 72,
      trait: "【王庭】大会诸王·亲征威望 +25%",
      default_loc: "chanyu_ting",
      tribe: "royal",
      pref_targets: ["dun_huang", "jiu_quan", "wu_lei"],
    },
    youxian_king: {
      id: "youxian_king",
      seal: "右",
      faction: "xiongnu",
      name: "右贤王·呼衍骨",
      title: "西翼右贤王",
      role: "king",
      cmd: 86,
      dip: 60,
      caution: 58,
      trait: "【秋掠】天山北道与敦煌劫掠 +30%",
      default_loc: "youxian_wang",
      tribe: "youxian",
      pref_targets: ["dun_huang", "lou_lan", "cheshi_qian"],
    },
    zuoxian_king: {
      id: "zuoxian_king",
      seal: "左",
      faction: "xiongnu",
      name: "左贤王·须卜奢",
      title: "东翼左贤王",
      role: "king",
      cmd: 84,
      dip: 65,
      caution: 68,
      trait: "【控弦】东翼铁骑冲击 +20%",
      default_loc: "long_cheng",
      tribe: "zuoxian",
      pref_targets: ["ju_yan", "jiu_quan", "zhang_ye"],
    },
    rizhu_king: {
      id: "rizhu_king",
      seal: "日",
      faction: "xiongnu",
      name: "日逐王·先贤掸",
      title: "西域日逐王",
      role: "king",
      cmd: 83,
      dip: 74,
      caution: 75,
      trait: "【僮仆】掌西域赋敛（低忠恐私通汉使）",
      default_loc: "yan_qi",
      tribe: "rizhu",
      pref_targets: ["wu_lei", "qu_li", "yan_qi", "qiu_ci"],
    },
    lihu_king: {
      id: "lihu_king",
      seal: "犁",
      faction: "xiongnu",
      name: "犁汗王·休屠余",
      title: "前锋犁汗王",
      role: "king",
      cmd: 81,
      dip: 52,
      caution: 55,
      trait: "【游骑】截断粮道与拔除烽燧 +35%",
      default_loc: "yi_wu",
      tribe: "lihu",
      pref_targets: ["lou_lan", "dun_huang", "yu_men_guan", "yi_wu"],
    },
  };

  window.COMMANDER_META = COMMANDER_META;

  class JSSimEngine {
    constructor(bundle) {
      this.bundle = bundle;
      this.history = [];
      this.state = null;
      this.rng = makeRng(11001);
    }

    initGame(opts) {
      const o = typeof opts === "string" ? { side: opts } : opts || {};
      const side = o.side || "han";
      const ruleset = o.ruleset || "v1";
      const oppBot = o.opp_bot || "balanced";
      const scenario = o.scenario || "mo_bei_zhi_hou";
      const seed = parseInt(o.seed || 11001, 10);
      const difficulty = o.difficulty || "standard";

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
      this.state.meta.difficulty = difficulty;
      this.state.meta.can_undo = false;

      // 初始化可玩原型专属结构（补给线列表、战报详单、在途使团/文书、历史人物在场态、草原牧场）
      this._ensurePlayableStructures(this.state);
      return deepClone(this.state);
    }

    _findShortestPath(st, fromId, toId) {
      if (!fromId || !toId || fromId === toId) {
        return { path: [fromId || toId], days: 0, km: 0 };
      }
      const routes = (this.bundle && this.bundle.scenario_mvp && this.bundle.scenario_mvp.routes) || [];
      const adj = {};
      for (const r of routes) {
        if (!adj[r.a]) adj[r.a] = [];
        if (!adj[r.b]) adj[r.b] = [];
        const d = r.days || r.travel_days || 8;
        adj[r.a].push({ to: r.b, days: d, km: r.distance_km || 200 });
        adj[r.b].push({ to: r.a, days: d, km: r.distance_km || 200 });
      }
      const dist = { [fromId]: 0 };
      const kmMap = { [fromId]: 0 };
      const prev = {};
      const visited = new Set();
      const queue = [fromId];
      while (queue.length > 0) {
        queue.sort((a, b) => (dist[a] ?? 9999) - (dist[b] ?? 9999));
        const u = queue.shift();
        if (u === toId) break;
        if (visited.has(u)) continue;
        visited.add(u);
        for (const edge of adj[u] || []) {
          const alt = (dist[u] ?? 0) + edge.days;
          if (alt < (dist[edge.to] ?? 9999)) {
            dist[edge.to] = alt;
            kmMap[edge.to] = (kmMap[u] ?? 0) + edge.km;
            prev[edge.to] = u;
            queue.push(edge.to);
          }
        }
      }
      if (!prev[toId]) {
        return { path: [fromId, toId], days: 18, km: 420 };
      }
      const path = [];
      let cur = toId;
      while (cur) {
        path.unshift(cur);
        cur = prev[cur];
      }
      return { path, days: dist[toId] || 15, km: kmMap[toId] || 360 };
    }

    _updateWeifuBreakdown(st) {
      if (!st || !st.v1) return;
      const v1 = st.v1;
      let xnVas = 0;
      for (const nid of Object.keys(st.nodes || {})) {
        const rel = st.nodes[nid].relation;
        if (rel && rel.overlord === "xiongnu") xnVas += 1;
      }
      st.scores.xn_vassals = xnVas;
      const vassalPts = Math.min(62.0, Math.round(xnVas * 5.2 * 10) / 10);
      const tongpuPts = v1.tribes && v1.tribes.tongpu_active ? 10.0 : 0.0;
      const prestigePts = Math.round(((v1.tribes && v1.tribes.chanyu_prestige) || 70) * 0.34 * 10) / 10;
      const northKeyPts =
        (st.nodes.cheshi_qian && st.nodes.cheshi_qian.relation && st.nodes.cheshi_qian.relation.overlord === "xiongnu" ? 5.0 : 0.0) +
        (st.nodes.yan_qi && st.nodes.yan_qi.relation && st.nodes.yan_qi.relation.overlord === "xiongnu" ? 5.0 : 0.0) +
        (st.nodes.lou_lan && st.nodes.lou_lan.relation && st.nodes.lou_lan.relation.overlord === "xiongnu" ? 4.0 : 0.0);
      const embargoPts = v1.steppe && v1.steppe.embargo_active ? 4.5 : 0.0;
      const permPts = v1.victory.xn_perm_weifu || 0.0;

      v1.victory.xn_weifu_breakdown = {
        vassal: vassalPts,
        tongpu: tongpuPts,
        prestige: prestigePts,
        north_hub: northKeyPts,
        embargo: embargoPts,
        perm: permPts,
      };
      v1.victory.xn_weifu = clamp(
        Math.round((vassalPts + tongpuPts + prestigePts + northKeyPts * 0.5 + embargoPts + permPts) * 10) / 10,
        0,
        125
      );
      v1.victory.xn_weifu_peak = Math.max(v1.victory.xn_weifu_peak || 0, v1.victory.xn_weifu);
      st.scores.xiongnu = v1.victory.xn_weifu;
    }

    _ensurePlayableStructures(st) {
      if (!st.battle_reports) st.battle_reports = [];
      if (!st.envoys_in_transit) st.envoys_in_transit = [];
      if (!st.characters) {
        st.characters = {};
        for (const cid of Object.keys(COMMANDER_META)) {
          const cm = COMMANDER_META[cid];
          st.characters[cid] = {
            id: cm.id,
            seal: cm.seal,
            faction: cm.faction,
            name: cm.name,
            title: cm.title,
            role: cm.role,
            cmd: cm.cmd,
            dip: cm.dip,
            caution: cm.caution,
            trait: cm.trait,
            loc: cm.default_loc,
            status: "idle",
            task_desc: "驻节待命",
            tribe: cm.tribe || null,
            pref_targets: cm.pref_targets || [],
          };
        }
      }
      if (st.v1) {
        if (!Array.isArray(st.v1.logistics.supply_lines) || st.v1.logistics.supply_lines.length === 0) {
          st.v1.logistics.supply_lines = [
            {
              id: "sl_hexi_main",
              name: "河西—阳关主粮道",
              from: "jiu_quan",
              to: "dun_huang",
              via: ["jiu_quan", "dun_huang"],
              laborers: 2000,
              priority: 2,
              escort: true,
              delivered_30d: 18000,
              status: "active", // active | throttled | paused_danger
            },
          ];
        } else {
          st.v1.logistics.supply_lines = st.v1.logistics.supply_lines.map((sl, idx) => {
            if (typeof sl === "string") {
              const targetId = sl;
              const fromId = targetId === "dun_huang" ? "jiu_quan" : "dun_huang";
              return {
                id: "sl_init_" + idx + "_" + targetId,
                name: targetId === "dun_huang" ? "河西—阳关主粮道" : `敦煌—${this._nodeName(st, targetId)}粮道`,
                from: fromId,
                to: targetId,
                via: [fromId, targetId],
                laborers: 2000,
                priority: 2,
                escort: true,
                delivered_30d: 18000,
                status: "active",
              };
            }
            return sl;
          });
        }
        if (!st.v1.court.in_transit_docs) {
          st.v1.court.in_transit_docs = [
            {
              id: "doc_init_1",
              type: "edict",
              title: st.v1.court.active_edict ? st.v1.court.active_edict.title : "《诏：持节通西域》",
              from: "chang_an",
              to: "dun_huang",
              cur_node: "zhang_ye",
              days_left: 12,
            },
          ];
        }
        if (!st.v1.tribes.reward_ratios) {
          st.v1.tribes.reward_ratios = { zuoxian: 35, youxian: 30, rizhu: 20, lihu: 15 };
        }
        if (!st.v1.tribes.tax_rate_tier) {
          st.v1.tribes.tax_rate_tier = "normal"; // light | normal | heavy
        }
        for (const tk of ["zuoxian", "youxian", "rizhu", "lihu"]) {
          const tr = st.v1.tribes.tribes && st.v1.tribes.tribes[tk];
          if (tr) {
            if (tr.attended === undefined) tr.attended = tr.loyalty >= 52;
            const span = tr.attended ? 4 : 11;
            tr.loyalty_fog = [
              Math.max(0, Math.round(tr.loyalty - span)),
              Math.min(100, Math.round(tr.loyalty + span)),
            ];
          }
        }
        if (!st.v1.steppe) {
          st.v1.steppe = {
            total_horses: 18500,
            horse_herd: 18500,
            max_cap: 28000,
            remount_mode: 3, // 2 = 常备 1骑2马, 3 = 远征 1骑3马
            remount_ratio: 3,
            pasture_health: 86,
            winter_prep: false,
            forage_stock: 145,
            dzud_risk: 18,
            embargo_active: false,
            pasture_nodes: {
              chanyu_ting: { name: "漠北龙城王庭牧场", grass: 92, horses: 6500, cap: 9000, shelter: true },
              long_cheng: { name: "左翼呼伦水草场", grass: 86, horses: 4800, cap: 7000, shelter: true },
              youxian_wang: { name: "右翼稽落山牧场", grass: 84, horses: 4200, cap: 6500, shelter: false },
              hu_jie: { name: "呼揭北山冬窝子", grass: 78, horses: 1800, cap: 3000, shelter: true },
              yi_wu: { name: "伊吾天山北麓牧场", grass: 76, horses: 1200, cap: 2500, shelter: false },
            },
            pastures: [
              { id: "chanyu_ting", name: "漠北单于庭主牧场", horses: 6500, cap: 9000, grass: "水草丰美 (92%)" },
              { id: "long_cheng", name: "龙城左翼呼伦草场", horses: 4800, cap: 7000, grass: "春水育驹 (86%)" },
              { id: "youxian_wang", name: "右贤王稽落山牧场", horses: 4200, cap: 6500, grass: "轮牧休养 (84%)" },
              { id: "hu_jie", name: "呼揭阿尔泰冬窝子", horses: 1800, cap: 3000, grass: "背风御寒 (78%)" },
              { id: "yi_wu", name: "伊吾天山北麓牧场", horses: 1200, cap: 2500, grass: "天山雪水 (76%)" },
            ],
          };
        }
        if (!st.v1.victory.xn_weifu_breakdown) {
          this._updateWeifuBreakdown(st);
        }
      }
      // 为所有节点补齐可读名称与驻军将领中文名，并同步人物坐标
      for (const nid of Object.keys(st.nodes)) {
        const n = st.nodes[nid];
        if (n.armies) {
          for (const a of n.armies) {
            const cm = COMMANDER_META[a.commander];
            a.commander_name = cm ? cm.name : a.faction === "han" ? "汉塞戊己校尉" : "匈奴万骑骨都侯";
            a.commander_cmd = cm ? cm.cmd : 75;
            if (!a.standing_order) a.standing_order = "cautious";
            if (!a.plan_steps) a.plan_steps = [];
            if (cm && st.characters && st.characters[a.commander]) {
              st.characters[a.commander].loc = nid;
            }
          }
        }
      }
    }

    undoTurn() {
      if (this.history.length > 0) {
        this.state = this.history.pop();
        this.state.meta.can_undo = this.history.length > 0;
      }
      return deepClone(this.state);
    }

    stepTurn(selectedIndices, useAdvisor, customOrders) {
      if (!this.state || this.state.meta.winner) {
        return deepClone(this.state);
      }

      this.history.push(deepClone(this.state));
      if (this.history.length > 15) this.history.shift();

      const st = this.state;
      this._ensurePlayableStructures(st);
      const side = st.meta.side;
      const opp = side === "han" ? "xiongnu" : "han";
      const turnBefore = st.meta.turn + 1;
      const dateBefore = st.meta.date_text;

      let chosenCmds = [];
      if (Array.isArray(customOrders) && customOrders.length > 0) {
        chosenCmds = deepClone(customOrders);
      } else if (useAdvisor) {
        chosenCmds = st.commands.filter((c) => c.recommended);
      } else {
        const idxSet = new Set(selectedIndices || []);
        chosenCmds = st.commands.filter((c) => idxSet.has(c.idx));
      }

      const appliedMine = [];
      const appliedOpp = [];
      const events = [];
      st.moving_armies = [];

      // 1. 执行玩家所选/下达指令
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
        events: events.slice(0, 18),
      });
      if (st.turn_logs.length > 12) st.turn_logs.shift();

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

      const cost = item.cost_money || 0;
      if (faction === "han") {
        if (cost > 0 && st.scores.han_money < cost) return false;
        st.scores.han_money -= cost;
      } else {
        if (cost > 0 && st.scores.xn_money < cost) return false;
        st.scores.xn_money -= cost;
      }

      // 历史人物差遣绑定与坐标同步
      const cmdrId = c.commander_id || item.commander_id || null;
      if (cmdrId && st.characters && st.characters[cmdrId]) {
        st.characters[cmdrId].status = "assigned";
        st.characters[cmdrId].task_desc = item.desc || t;
        const destNode = c.target || c.state || c.node || c.to || item.target_node;
        if (destNode && st.nodes[destNode]) {
          st.characters[cmdrId].loc = destNode;
        }
      }

      if (t === "comply_edict" && v1 && v1.court.active_edict) {
        v1.court.active_edict.complied = true;
        v1.court.trust = clamp(v1.court.trust + 5.0, 0, 100);
        events.push({
          date: d,
          sub_tick: 2,
          kind: "court",
          node: "dun_huang",
          callout: "📜 奉诏拜表 (信任+5)",
          text: `汉使奉诏拜表：《${v1.court.active_edict.title}》，朝廷信任 +5.0，获得对【${this._nodeName(st, v1.court.active_edict.target)}】奉诏讨伐/招抚便宜权。`,
        });
      } else if (t === "bargain_edict" && v1 && v1.court.active_edict) {
        v1.court.active_edict.bargained = true;
        const addTurns = c.add_turns || 2;
        const askMoney = c.ask_money || 500;
        v1.court.active_edict.deadline_turn += addTurns;
        st.scores.han_money += askMoney;
        v1.court.trust = clamp(v1.court.trust - 2.0, 0, 100);
        v1.court.in_transit_docs.push({
          id: "doc_bargain_" + st.meta.turn,
          type: "memorial",
          title: `《陈情请宽限并增拨军资疏》`,
          from: "dun_huang",
          to: "chang_an",
          cur_node: "jiu_quan",
          days_left: 16,
        });
        events.push({
          date: d,
          sub_tick: 3,
          kind: "court",
          node: "chang_an",
          callout: `📨 诏准宽限 (+${askMoney}钱)`,
          text: `汉使上疏陈情讨价准奏：《${v1.court.active_edict.title}》宽展 ${addTurns} 季，少府增拨军资 +${askMoney} 钱（朝廷信任 -2.0）。`,
        });
      } else if (t === "forge_edict" && v1) {
        const target = c.target || item.target_node || "cheshi_qian";
        const selfImpeach = c.self_impeach !== false;
        const trustCost = selfImpeach ? 6.0 : 12.0;
        v1.court.forged_count += 1;
        v1.court.forged_bonus_ticks = 6;
        v1.court.trust = clamp(v1.court.trust - trustCost, 0, 100);
        v1.court.in_transit_docs.push({
          id: "doc_forge_" + st.meta.turn,
          type: "impeach",
          title: selfImpeach ? `《持节矫诏·自劾请罪露布》` : `《御史急奏·劾西域使者擅发兵》`,
          from: target,
          to: "chang_an",
          cur_node: "dun_huang",
          days_left: 18,
        });
        events.push({
          date: d,
          sub_tick: 2,
          kind: "court",
          node: target,
          callout: `⚡ 持节矫诏奇袭！`,
          text: `【持节矫诏】汉使拔剑持节矫制发诸国兵奇袭【${this._nodeName(st, target)}】${selfImpeach ? "（同步拜表《自劾请罪疏》，信任先扣 -6）" : "（未自劾，信任先扣 -12）"}！若破敌露布先于槛车抵京，方可将功折罪！`,
        });
        this._resolveCampaignBattle(st, "han", "dun_huang", target, 4800, "cautious", true, events, { commanderId: cmdrId || "fu_jiezi" });
      } else if (t === "request_appropriation" && v1) {
        if (v1.court.last_approp_turn !== undefined && st.meta.turn - v1.court.last_approp_turn < 2) {
          events.push({ date: d, sub_tick: 2, kind: "court", node: "chang_an", callout: "⚠️ 大司农驳回请款", text: `【大司农驳回】上季方拨专款，请隔季再行奏请。` });
        } else {
          v1.court.last_approp_turn = st.meta.turn;
          st.scores.han_money += 900;
          v1.court.trust = clamp(v1.court.trust - 5.0, 0, 100);
          events.push({ date: d, sub_tick: 3, kind: "court", node: "chang_an", callout: "💰 少府拨金 +900钱", text: `大司农批复西域请款奏疏：少府调拨黄金 +900 钱（朝廷信任 -5.0）。` });
        }
      } else if (t === "request_troops" && v1) {
        st.scores.han_horse_pool = (st.scores.han_horse_pool || 5000) + 1800;
        if (st.nodes.dun_huang && st.nodes.dun_huang.armies && st.nodes.dun_huang.armies[0]) {
          st.nodes.dun_huang.armies[0].soldiers += 2000;
          st.nodes.dun_huang.armies[0].horses += 1200;
        }
        v1.court.trust = clamp(v1.court.trust - 4.0, 0, 100);
        events.push({ date: d, sub_tick: 4, kind: "court", node: "dun_huang", callout: "🐎 北军/太仆增援抵塞", text: `太仆与北军增援抵塞：敦煌主力增补羽林/属国骑 +2,000 人、官马 +1,800 匹（朝廷信任 -4.0）。` });
      } else if (t === "levy_vassal_troops" && v1) {
        const vasCnt = st.scores.han_vassals || 2;
        const changHuiBonus = cmdrId === "chang_hui" || !cmdrId ? 1.25 : 1.0;
        const levySoldiers = Math.min(5200, Math.round((1200 + vasCnt * 450) * changHuiBonus));
        const levyHorses = Math.min(2200, Math.round((400 + vasCnt * 180) * changHuiBonus));
        const hubId = st.nodes.wu_lei && st.nodes.wu_lei.relation && st.nodes.wu_lei.relation.overlord === "han" ? "wu_lei" : "lou_lan";
        const hn = st.nodes[hubId] || st.nodes.dun_huang;
        if (hn) {
          if (!hn.armies || hn.armies.length === 0) {
            hn.armies = [{ id: "han_vas_" + st.meta.turn, name: "西域诸国胡骑联军", faction: "han", soldiers: levySoldiers, grain: 18000, laborers: 600, horses: levyHorses, status: "idle", commander: "chang_hui", commander_name: "长罗侯·常惠", commander_cmd: 86, standing_order: "cautious" }];
          } else {
            hn.armies[0].soldiers += levySoldiers;
            hn.armies[0].horses = (hn.armies[0].horses || 500) + levyHorses;
          }
        }
        if (st.characters && st.characters.chang_hui) {
          st.characters.chang_hui.loc = hubId;
          st.characters.chang_hui.status = "assigned";
          st.characters.chang_hui.task_desc = "持节督诸国胡骑";
        }
        st.scores.han_horse_pool = (st.scores.han_horse_pool || 5000) + Math.round(levyHorses * 0.5);
        events.push({ date: d, sub_tick: 4, kind: "military", node: hubId, callout: `🚩 诸国胡骑 +${levySoldiers} 会师`, text: `【持节发诸国兵】长罗侯常惠持汉节传檄西域属国与乌孙，合诸国胡骑 +${levySoldiers.toLocaleString()} 人、战马 +${levyHorses.toLocaleString()} 匹会师于【${this._nodeName(st, hubId)}】！` });
      } else if (t === "recruit_convicts" || t === "recruit_convict") {
        const nid = c.node || item.target_node || "dun_huang";
        const n = st.nodes[nid] || st.nodes.dun_huang;
        if (n) {
          if (!n.armies || n.armies.length === 0) {
            n.armies = [{ id: "han_conv_" + st.meta.turn, name: "驰刑七科谪营", faction: "han", soldiers: 2500, grain: 15000, laborers: 800, horses: 300, status: "idle", commander: "zhao_ponu", commander_name: "从票侯·赵破奴", commander_cmd: 85, standing_order: "cautious" }];
          } else {
            n.armies[0].soldiers += 2200;
          }
          events.push({ date: d, sub_tick: 3, kind: "military", node: nid, callout: "⚔️ 募七科谪 +2,200人", text: `赦募七科谪与恶少年 +2,200 人集结于【${n.name}】（攻城强攻伤害 +25%，免扣汉民人口）。` });
        }
      } else if (t === "petition_protectorate" && v1) {
        if (v1.victory.petitioned_protectorate) {
          st.scores.han_money += Math.round(cost * 0.8);
          events.push({ date: d, sub_tick: 5, kind: "court", node: "wu_lei", callout: "🏛️ 都护府筹备中", text: `《奏请设立西域都护府疏》已奉诏立案，当前正督办乌垒治所与三十六国册封。` });
        } else if (v1.victory.han_merit >= 72.0 || (st.scores.han_vassals || 0) >= 6) {
          v1.victory.petitioned_protectorate = true;
          v1.victory.han_perm_merit += 14.0;
          events.push({ date: d, sub_tick: 6, kind: "v1", node: "wu_lei", callout: "🏛️ 诏准置西域都护 (G+14)", text: `汉使正式向长安拜表《奏请设立西域都护府疏》！天子下诏准置都护督察西域，都护功业 +14.0！` });
        } else {
          v1.victory.han_perm_merit += 4.0;
          events.push({ date: d, sub_tick: 5, kind: "court", node: "wu_lei", callout: "📜 准置使者幕府 (G+4)", text: `【廷议核覆】丞相御史奏言：西域内属未满六国或功业未及 72（当前 G=${v1.victory.han_merit.toFixed(1)}），先准设护鄯善以西使者幕府（功业 +4.0）。` });
        }
      } else if (t === "welcome_rizhu" && v1) {
        const rz = v1.tribes.tribes.rizhu;
        if (rz.status === "defected_han") {
          events.push({ date: d, sub_tick: 5, kind: "v1", node: "wu_lei", callout: "🎖️ 日逐已封归德侯", text: `日逐王先贤掸已受封大汉归德侯，西域僮仆都尉已省罢。` });
        } else if (rz.surrender_window > 0 || rz.loyalty <= 46 || st.meta.turn >= 4) {
          rz.status = "defected_han";
          rz.surrender_window = 0;
          v1.tribes.tongpu_active = false;
          v1.events_meta.rizhu_surrendered = true;
          v1.victory.han_perm_merit += 25.0;
          v1.court.trust = clamp(v1.court.trust + 15.0, 0, 100);
          if (st.nodes.wu_lei && st.nodes.wu_lei.relation) st.nodes.wu_lei.relation.overlord = "han";
          if (st.nodes.qu_li && st.nodes.qu_li.relation) st.nodes.qu_li.relation.overlord = "han";
          if (st.characters && st.characters.zheng_ji) {
            st.characters.zheng_ji.loc = "wu_lei";
            st.characters.zheng_ji.status = "assigned";
            st.characters.zheng_ji.task_desc = "迎日逐王受降";
          }
          events.push({ date: d, sub_tick: 7, kind: "v1", node: "wu_lei", callout: "🌟 日逐王率万骑来降 (G+25)", text: `【史诗破局】郑吉发渠犁屯兵迎匈奴日逐王先贤掸率万骑来降！天子封日逐王为归德侯，永久省罢匈奴僮仆都尉，都护功业暴涨 +25！` });
        } else {
          rz.loyalty = clamp(rz.loyalty - 8.0, 0, 100);
          if (rz.loyalty <= 46) {
            rz.surrender_window = 3;
            v1.events_meta.rizhu_offered = true;
          }
          events.push({ date: d, sub_tick: 4, kind: "diplomacy", node: "yan_qi", callout: "🕵️ 密使离间日逐 (忠-8)", text: `【密使间日逐】日逐王先贤掸当前尚受单于节制（忠诚 ${rz.loyalty.toFixed(0)}），汉使密遣舌人离间其部（忠诚 -8.0；待其忠诚≤46或漠北白灾即可迎降）。` });
        }
      } else if (t === "build_beacon" && v1) {
        const nid = c.node || item.target_node || "lou_lan";
        if (v1.logistics.beacon_built_turn === st.meta.turn) {
          st.scores.han_money += cost;
          events.push({ date: d, sub_tick: 2, kind: "logistics", node: nid, callout: "⚠️ 每季限筑一处烽燧", text: `【工役受限】塞外士卒每季限筑烽燧一处，已退还工料钱。` });
        } else {
          v1.logistics.beacon_built_turn = st.meta.turn;
          if (!v1.logistics.beacons.includes(nid)) v1.logistics.beacons.push(nid);
          if (st.nodes[nid]) st.nodes[nid].has_beacon = true;
          events.push({ date: d, sub_tick: 5, kind: "logistics", node: nid, callout: "🗼 烽燧落成 (视野L4)", text: `汉军在【${this._nodeName(st, nid)}】修筑汉代烽燧亭障（城防 +8%，点亮方圆 2 跳五级迷雾 L4 精确视野，驿传提速 30%）。` });
        }
      } else if (t === "build_tuntian" && v1) {
        const nid = c.node || item.target_node || "lou_lan";
        const curLv = v1.logistics.tuntian_nodes[nid] || 0;
        if (curLv >= 3) {
          st.scores.han_money += cost;
          events.push({ date: d, sub_tick: 2, kind: "logistics", node: nid, callout: "🌾 军屯已满级 Lv.3", text: `【${this._nodeName(st, nid)}】军屯已达满级（Lv.3），无需重复扩建。` });
        } else {
          const zhengBonus = cmdrId === "zheng_ji" || cmdrId === "sang_hongyang" ? 45000 : 36000;
          v1.logistics.tuntian_nodes[nid] = curLv + 1;
          v1.logistics.tuntian_pressure = v1.logistics.tuntian_pressure || {};
          v1.logistics.tuntian_pressure[nid] = (v1.logistics.tuntian_pressure[nid] || 15) + 18;
          if (st.nodes[nid]) {
            st.nodes[nid].tuntian_lv = v1.logistics.tuntian_nodes[nid];
            st.nodes[nid].grain += zhengBonus;
          }
          events.push({ date: d, sub_tick: 6, kind: "logistics", node: nid, callout: `🌾 军屯 Lv.${v1.logistics.tuntian_nodes[nid]} (+${(zhengBonus / 1000).toFixed(0)}k斛)`, text: `汉军在【${this._nodeName(st, nid)}】开置塞外军屯（Lv.${v1.logistics.tuntian_nodes[nid]}），秋收就地入仓 +${zhengBonus.toLocaleString()} 斛，都护功业 +4.5（匈奴窥伺压力上升）！` });
        }
      } else if ((t === "set_supply_line" || t === "setup_supply_line") && v1) {
        const toNode = c.to || c.forward_hub || item.target_node || "lou_lan";
        const fromNode = c.from || "dun_huang";
        const laborers = c.laborers || 2500;
        const escort = c.escort !== false;
        const existing = v1.logistics.supply_lines.find((s) => s.to === toNode);
        const pathInfo = this._findShortestPath(st, fromNode, toNode);
        const delivered = laborers * 9;
        if (existing) {
          existing.laborers = laborers;
          existing.escort = escort;
          existing.delivered_30d = delivered;
          existing.via = pathInfo.path;
          existing.status = laborers >= 1500 ? "active" : "throttled";
        } else {
          st.scores.han_horse_pool = Math.max(0, (st.scores.han_horse_pool || 5000) - 350);
          v1.logistics.supply_lines.push({
            id: "sl_" + toNode,
            name: `${this._nodeName(st, fromNode)}→${this._nodeName(st, toNode)}粮道`,
            from: fromNode,
            to: toNode,
            via: pathInfo.path,
            laborers,
            priority: 3,
            escort,
            delivered_30d: delivered,
            status: laborers >= 1500 ? "active" : "throttled",
          });
        }
        v1.logistics.forward_hub = toNode;
        if (st.nodes[fromNode]) st.nodes[fromNode].grain = Math.max(40000, (st.nodes[fromNode].grain || 300000) - delivered);
        if (st.nodes[toNode]) st.nodes[toNode].grain += delivered;
        events.push({ date: d, sub_tick: 5, kind: "logistics", node: toNode, callout: `📦 运粮抵仓 +${(delivered / 1000).toFixed(1)}k斛`, text: `【万里粮道】拉通「${this._nodeName(st, fromNode)} → ${this._nodeName(st, toNode)}」自动补给线（调拨官马 350 匹、民夫 ${laborers} 人，本季自敦煌实运粟米 +${(delivered / 1000).toFixed(1)}k 斛）。` });
      } else if (t === "intercept_tongpu" && v1) {
        st.scores.han_money += 320;
        v1.tribes.tribes.rizhu.loyalty = clamp(v1.tribes.tribes.rizhu.loyalty - 9.0, 0, 100);
        v1.tribes.tribes.rizhu.grievance = clamp((v1.tribes.tribes.rizhu.grievance || 20) + 15.0, 0, 100);
        if (v1.tribes.tribes.rizhu.loyalty <= 48) {
          v1.tribes.tribes.rizhu.surrender_window = 3;
          v1.events_meta.rizhu_offered = true;
        }
        events.push({ date: d, sub_tick: 6, kind: "battle", node: "yan_qi", callout: "⚔️ 截获僮仆岁币 +320钱", text: `汉军轻骑邀击天山北道僮仆都尉税队！截获西域岁币 +320 钱，日逐王部受单于严责、忠诚骤降 -9.0！` });
      } else if (t === "dispatch_elite_envoy" || t === "hire_mission" || t === "lobby") {
        const sid = c.state || item.target_node || "lou_lan";
        const n = st.nodes[sid];
        if (n && n.relation) {
          const isElite = t === "dispatch_elite_envoy";
          const zqBonus = cmdrId === "zhang_qian" || isElite ? 1.15 : 1.0;
          const gain = Math.round((isElite ? 18.0 : 10.5) * zqBonus * 10) / 10;
          n.relation.han_influence = clamp(n.relation.han_influence + gain, 0, 100);
          n.relation.xn_intimidation = clamp(n.relation.xn_intimidation - gain * 0.4, 0, 100);
          if (n.relation.han_influence >= 60.0 && n.relation.han_influence >= n.relation.xn_intimidation + 8) {
            n.relation.overlord = "han";
          } else if (n.relation.han_influence >= 35.0 && n.relation.overlord === "xiongnu") {
            n.relation.is_dual = true;
          }
          n.relation.forage = this._forageTier(n.relation);
          const pathInfo = this._findShortestPath(st, "dun_huang", sid);
          st.envoys_in_transit.push({
            id: "env_" + sid,
            kind: isElite ? "elite" : "hired",
            label: isElite ? `博望侯精使→${n.name}` : `敦煌募使→${n.name}`,
            from: "dun_huang",
            to: sid,
            path: pathInfo.path,
            days: pathInfo.days,
          });
          if (isElite && st.characters && st.characters.zhang_qian) {
            st.characters.zhang_qian.loc = sid;
            st.characters.zhang_qian.status = "assigned";
            st.characters.zhang_qian.task_desc = `持节宣慰${n.name}`;
          }
          events.push({ date: d, sub_tick: clamp(Math.ceil(pathInfo.days / 10), 3, 8), kind: "diplomacy", node: sid, callout: `🚩 使团抵${n.name} (亲汉+${gain.toFixed(0)})`, text: `${isElite ? "博望侯持节精使团" : "汉募使团"}抵达【${n.name}】颁赐缯帛：汉影响力升至 ${n.relation.han_influence.toFixed(0)}（供粮意愿：${n.relation.forage.label}）。` });
        }
      } else if (t === "make_vassal" || t === "enfeoff" || t === "accept_dual_allegiance" || t === "assassinate_king") {
        const sid = c.state || item.target_node || "lou_lan";
        const n = st.nodes[sid];
        if (n && n.relation) {
          if (t === "assassinate_king") {
            const lastAk = (v1 && v1.diplomacy && v1.diplomacy.last_assassinate_turn) || -99;
            const akCnt = (v1 && v1.diplomacy && v1.diplomacy.assassinate_count) || 0;
            if (st.meta.turn - lastAk < 3 || akCnt >= 3) {
              st.scores.han_money += cost;
              events.push({ date: d, sub_tick: 3, kind: "diplomacy", node: sid, callout: "⚠️ 王庭戒备森严", text: `【刺王戒备】诸国王庭近岁宿卫森严（需隔 3 季且全盘限 3 次），傅介子请缓图之。` });
            } else if (((n.relation.crimes || 0) <= 0 && !(v1 && v1.court.forged_bonus_ticks > 0)) || n.relation.han_influence < 34) {
              n.relation.han_influence = clamp(n.relation.han_influence + 10.0, 0, 100);
              events.push({ date: d, sub_tick: 4, kind: "diplomacy", node: sid, callout: "🕵️ 潜布内应 (亲汉+10)", text: `【内应未备】${n.name}亲汉内应不足或无遮杀汉使罪状（需汉影响≥34且有罪状/矫诏），密使已先行潜布耳目（影响 +10）。` });
            } else {
              if (v1) {
                v1.diplomacy = v1.diplomacy || {};
                v1.diplomacy.last_assassinate_turn = st.meta.turn;
                v1.diplomacy.assassinate_count = akCnt + 1;
              }
              n.relation.overlord = "han";
              n.relation.han_enfeoffed = true;
              n.relation.crimes = 0;
              n.relation.han_influence = clamp(n.relation.han_influence + 24.0, 0, 100);
              n.relation.xn_intimidation = clamp(n.relation.xn_intimidation - 22.0, 0, 100);
              n.relation.forage = this._forageTier(n.relation);
              if (st.characters && st.characters.fu_jiezi) {
                st.characters.fu_jiezi.loc = sid;
                st.characters.fu_jiezi.status = "assigned";
                st.characters.fu_jiezi.task_desc = `持节斩${n.name}王`;
              }
              events.push({ date: d, sub_tick: 7, kind: "diplomacy", node: sid, callout: `🗡️ 傅介子斩${n.name}王立新！`, text: `【傅介子斩王立新】汉壮士持节刺杀【${n.name}】亲匈王，更立在汉质子即位，正式内附为大汉属国！` });
            }
          } else if (t === "accept_dual_allegiance") {
            n.relation.is_dual = true;
            n.relation.han_enfeoffed = true;
            n.relation.han_influence = clamp(n.relation.han_influence + 15.0, 0, 100);
            n.relation.xn_intimidation = clamp(n.relation.xn_intimidation - 10.0, 0, 100);
            if (n.relation.han_influence >= 58.0) n.relation.overlord = "han";
            n.relation.forage = this._forageTier(n.relation);
            events.push({ date: d, sub_tick: 5, kind: "diplomacy", node: sid, callout: `🤝 权宜纳${n.name}两属`, text: `【权宜纳两属】汉廷宽宥【${n.name}】两属之情，赐金印许其暗供汉军粮草（汉影响 +15）。` });
          } else if (n.relation.han_influence >= 54.0 && n.relation.han_influence >= n.relation.xn_intimidation) {
            n.relation.overlord = "han";
            n.relation.han_enfeoffed = true;
            n.relation.crimes = 0;
            n.relation.han_influence = clamp(n.relation.han_influence + 16.0, 0, 100);
            n.relation.xn_intimidation = clamp(n.relation.xn_intimidation - 14.0, 0, 100);
            n.relation.forage = this._forageTier(n.relation);
            events.push({ date: d, sub_tick: 6, kind: "diplomacy", node: sid, callout: `💮 赐金印·${n.name}内属`, text: `【赐印内属】【${n.name}】久慕汉威，奉质子受大汉金印紫绶，正式列为大汉内属国（都护功业 +6，箪食迎军）！` });
          } else if (n.relation.han_influence >= 32.0) {
            n.relation.han_enfeoffed = true;
            n.relation.han_influence = clamp(n.relation.han_influence + 14.0, 0, 100);
            n.relation.xn_intimidation = clamp(n.relation.xn_intimidation - 10.0, 0, 100);
            if (n.relation.han_influence >= 56.0 && n.relation.han_influence >= n.relation.xn_intimidation) {
              n.relation.overlord = "han";
            }
            n.relation.forage = this._forageTier(n.relation);
            events.push({ date: d, sub_tick: 5, kind: "diplomacy", node: sid, callout: `💮 册封${n.name}印绶`, text: `【册封外臣】汉廷颁赐【${n.name}】印绶缯帛（册封功业 +2，汉影响升至 ${n.relation.han_influence.toFixed(0)}${n.relation.overlord === "han" ? "，并正式内附大汉" : "，待影响≥55即可正式内属"}）！` });
          } else {
            n.relation.han_influence = clamp(n.relation.han_influence + 12.0, 0, 100);
            n.relation.xn_intimidation = clamp(n.relation.xn_intimidation - 6.0, 0, 100);
            n.relation.forage = this._forageTier(n.relation);
            events.push({ date: d, sub_tick: 4, kind: "diplomacy", node: sid, callout: `🎁 厚币宣慰${n.name} (+12)`, text: `【先遣宣慰】【${n.name}】畏匈奴威逼尚深（当前汉影响 ${n.relation.han_influence.toFixed(0)} < 32），使者已先颁赐厚币广结亲汉贵族（影响 +12，请续遣精使或耀兵威服）。` });
          }
        }
      } else if (t === "distribute_rewards" && v1) {
        const ratios = c.ratios || v1.tribes.reward_ratios || { zuoxian: 35, youxian: 30, rizhu: 20, lihu: 15 };
        v1.tribes.reward_ratios = ratios;
        const sum = Math.max(1, (ratios.zuoxian || 0) + (ratios.youxian || 0) + (ratios.rizhu || 0) + (ratios.lihu || 0));
        const expects = { zuoxian: 35, youxian: 30, rizhu: 20, lihu: 15 };
        const details = [];
        for (const tk of ["zuoxian", "youxian", "rizhu", "lihu"]) {
          const sharePct = ((ratios[tk] || 0) / sum) * 100;
          const diff = sharePct - expects[tk];
          const delta = diff >= -2 ? 7.0 + diff * 0.25 : diff * 0.85;
          const trObj = v1.tribes.tribes[tk];
          if (trObj) {
            trObj.loyalty = clamp(Math.round((trObj.loyalty + delta) * 10) / 10, 0, 100);
            trObj.attended = trObj.loyalty >= 50;
            details.push(`${trObj.name}(${sharePct.toFixed(0)}%→忠${delta >= 0 ? "+" : ""}${delta.toFixed(1)})`);
            if (tk === "rizhu" && trObj.loyalty < 45) {
              trObj.surrender_window = 3;
              v1.events_meta.rizhu_offered = true;
            }
          }
        }
        v1.tribes.chanyu_prestige = clamp(v1.tribes.chanyu_prestige + 4.0, 0, 100);
        events.push({ date: d, sub_tick: 2, kind: "court", node: "chanyu_ting", callout: "🐺 王庭颁行四部分赏", text: `单于王庭颁行四部分赏：${details.join("，")}。` });
      } else if ((t === "hold_assembly" || t === "hold_chanyu_assembly") && v1) {
        const target = c.target || "dun_huang";
        const card = c.card || "feigned_retreat";
        v1.tribes.active_tactical_card = card;
        v1.tribes.tactical_card_ticks = 9;
        v1.tribes.assembly_target = target;
        v1.tribes.chanyu_prestige = clamp(v1.tribes.chanyu_prestige + 6.0, 0, 100);
        for (const tk of Object.keys(v1.tribes.tribes)) {
          v1.tribes.tribes[tk].loyalty = clamp(v1.tribes.tribes[tk].loyalty + 5.0, 0, 100);
          v1.tribes.tribes[tk].attended = v1.tribes.tribes[tk].loyalty >= 48;
        }
        events.push({ date: d, sub_tick: 3, kind: "v1", node: target, callout: `🔥 龙城盟誓主攻${this._nodeName(st, target)}`, text: `【草原盛会盟誓】单于大会诸王于龙城/蹛林，钦定本季主攻方向【${this._nodeName(st, target)}】（攻取重赏），激活王庭战术卡【${card}】，单于威望 +6.0！` });
      } else if (t === "pacify_tribe" && v1) {
        const tk = c.tribe || "rizhu";
        if (v1.tribes.tribes[tk]) {
          v1.tribes.tribes[tk].loyalty = clamp(v1.tribes.tribes[tk].loyalty + 15.0, 0, 100);
          v1.tribes.tribes[tk].surrender_window = 0;
          v1.tribes.tribes[tk].attended = true;
          events.push({ date: d, sub_tick: 3, kind: "court", node: "yan_qi", callout: `🐎 赐金马安抚${v1.tribes.tribes[tk].name} (+15)`, text: `单于遣骨都侯赐金马安抚【${v1.tribes.tribes[tk].name}】，其忠诚回升 +15.0，消弭私通汉使之患。` });
        }
      } else if (t === "play_tactical_card" && v1) {
        v1.tribes.active_tactical_card = c.card || "feigned_retreat";
        v1.tribes.tactical_card_ticks = 9;
        events.push({ date: d, sub_tick: 2, kind: "v1", node: "chanyu_ting", callout: `🃏 发动战术卡:${v1.tribes.active_tactical_card}`, text: `单于王庭发动本季战术卡：【${v1.tribes.active_tactical_card}】（全局野战/劫掠加成生效）。` });
      } else if (t === "set_tongpu_tax" && v1) {
        const tier = c.tier || "normal";
        v1.tribes.tax_rate_tier = tier;
        const income = tier === "heavy" ? 550 : tier === "normal" ? 320 : 160;
        const resentDelta = tier === "heavy" ? 14 : tier === "normal" ? 4 : -8;
        st.scores.xn_money += income;
        v1.tribes.reward_pool += income;
        for (const nid of Object.keys(st.nodes)) {
          const rel = st.nodes[nid].relation;
          if (rel && rel.overlord === "xiongnu") {
            rel.xn_resentment = clamp((rel.xn_resentment || 15) + resentDelta, 0, 100);
          }
        }
        events.push({ date: d, sub_tick: 4, kind: "economy", node: "yan_qi", callout: `💰 僮仆岁币 +${income}钱`, text: `焉耆僮仆都尉按【${tier === "heavy" ? "重敛竭泽" : tier === "light" ? "轻徭怀柔" : "常赋岁币"}】档位征发西域胡商：赏赐池 +${income} 钱（诸国怨恨 ${resentDelta >= 0 ? "+" : ""}${resentDelta}）。` });
      } else if (t === "breed_steppe_horses" && v1) {
        const sp = v1.steppe;
        const pNode = c.node || "chanyu_ting";
        const gainHorses = 2400;
        sp.total_horses = clamp((sp.total_horses || 18500) + gainHorses, 5000, sp.max_cap || 28000);
        if (sp.pasture_nodes && sp.pasture_nodes[pNode]) {
          sp.pasture_nodes[pNode].horses = Math.min(sp.pasture_nodes[pNode].cap, sp.pasture_nodes[pNode].horses + 1200);
          sp.pasture_nodes[pNode].grass = clamp(sp.pasture_nodes[pNode].grass + 8, 30, 100);
        }
        v1.victory.xn_perm_weifu = (v1.victory.xn_perm_weifu || 0) + 2.5;
        events.push({ date: d, sub_tick: 4, kind: "logistics", node: pNode, callout: `🐎 春水繁育战马 +${gainHorses}匹`, text: `【逐水草迁徙繁育】单于王庭督诸部轮牧春水草场，新添健驹 +${gainHorses.toLocaleString()} 匹（草原总马群达 ${sp.total_horses.toLocaleString()} 匹，单于威服 +2.5）！` });
      } else if (t === "winter_shelter_prep" && v1) {
        const sp = v1.steppe;
        sp.winter_prep = true;
        sp.forage_stock = (sp.forage_stock || 140) + 90;
        sp.dzud_risk = 4;
        for (const pk of Object.keys(sp.pasture_nodes || {})) {
          sp.pasture_nodes[pk].shelter = true;
        }
        v1.tribes.chanyu_prestige = clamp(v1.tribes.chanyu_prestige + 3.5, 0, 100);
        events.push({ date: d, sub_tick: 5, kind: "logistics", node: "hu_jie", callout: "⛺ 修整冬窝子 (白灾免疫)", text: `【备荒御白灾】王庭调拨牛羊干酪修整呼揭与稽落山越冬避风牧场（干草储备 +90，漠北白灾损畜风险降至 4%，单于威望 +3.5）！` });
      } else if (t === "set_remount_mode" && v1) {
        const mode = parseInt(c.mode || 3, 10);
        v1.steppe.remount_mode = mode;
        events.push({ date: d, sub_tick: 2, kind: "military", node: "chanyu_ting", callout: `🐎 切换从马配比 1骑${mode}马`, text: `【从马配比调整】全军控弦骑切换为「1 骑配 ${mode} 匹从马」体制（${mode >= 3 ? "千里奔袭速度+25%、瀚海断水损耗减半，马群消耗+20%" : "常备游牧均衡体制，草场负荷节约"}）。` });
      } else if (t === "raid_supply_line" && v1) {
        const targetNode = c.target || "lou_lan";
        st.scores.xn_money += 280;
        st.scores.han_money = Math.max(0, st.scores.han_money - 160);
        v1.tribes.reward_pool += 280;
        v1.victory.xn_perm_weifu = (v1.victory.xn_perm_weifu || 0) + 4.0;
        if (v1.logistics.supply_lines && v1.logistics.supply_lines.length > 0) {
          const sl = v1.logistics.supply_lines[v1.logistics.supply_lines.length - 1];
          sl.status = "throttled";
          sl.delivered_30d = Math.round((sl.delivered_30d || 15000) * 0.55);
        }
        if (st.characters && st.characters.lihu_king) {
          st.characters.lihu_king.loc = targetNode;
          st.characters.lihu_king.status = "assigned";
          st.characters.lihu_king.task_desc = "游骑袭断汉粮道";
        }
        events.push({ date: d, sub_tick: 6, kind: "battle", node: targetNode, callout: "🔥 袭断汉军粮道 (威服+4)", text: `【游骑袭断粮道】犁汗王休屠余率轻骑出伊吾，袭掠【${this._nodeName(st, targetNode)}】外围汉军转粟车队！焚毁汉粮四成，劫获金帛 +280 钱，单于威服 +4.0！` });
      } else if (t === "enforce_embargo" && v1) {
        v1.steppe.embargo_active = true;
        st.scores.xn_money += 220;
        v1.victory.xn_perm_weifu = (v1.victory.xn_perm_weifu || 0) + 4.5;
        for (const nid of ["cheshi_qian", "yan_qi", "qiu_ci", "lou_lan"]) {
          const n = st.nodes[nid];
          if (n && n.relation) {
            n.relation.xn_intimidation = clamp(n.relation.xn_intimidation + 8.0, 0, 100);
            n.relation.han_influence = clamp(n.relation.han_influence - 6.0, 0, 100);
            n.relation.forage = this._forageTier(n.relation);
          }
        }
        events.push({ date: d, sub_tick: 5, kind: "diplomacy", node: "cheshi_qian", callout: "🚧 封锁天山北道商路 (W+4.5)", text: `【禁绝汉商封锁】匈奴于车师与焉耆设卡遮绝汉使商队，收缴过境关市钱 +220，北道诸国威吓 +8.0，单于威服 +4.5！` });
      } else if (t === "demand_vassal" || t === "intimidate_city" || t === "install_prince") {
        const sid = c.state || item.target_node || "lou_lan";
        const n = st.nodes[sid];
        if (n && n.relation) {
          v1.diplomacy = v1.diplomacy || {};
          const icCnt = v1.diplomacy.intimidate_turn === st.meta.turn ? v1.diplomacy.intimidate_cnt || 0 : 0;
          if (t === "intimidate_city" && icCnt >= 2) {
            events.push({ date: d, sub_tick: 3, kind: "diplomacy", node: sid, callout: "⚠️ 游骑本季限威压2城", text: `【控弦分兵受限】本季游骑已巡行威压两处城邦，铁骑马力已疲。` });
          } else {
            if (t === "intimidate_city") {
              v1.diplomacy.intimidate_turn = st.meta.turn;
              v1.diplomacy.intimidate_cnt = icCnt + 1;
            }
            const gain = t === "install_prince" ? 22.0 : 15.0;
            n.relation.xn_intimidation = clamp(n.relation.xn_intimidation + gain, 0, 100);
            n.relation.han_influence = clamp(n.relation.han_influence - 8.0, 0, 100);
            n.relation.xn_resentment = clamp((n.relation.xn_resentment || 15) + (t === "install_prince" ? 12.0 : 6.0), 0, 100);
            if (n.relation.xn_intimidation >= 52.0 && n.relation.xn_intimidation >= n.relation.han_influence) {
              n.relation.overlord = "xiongnu";
            }
            n.relation.forage = this._forageTier(n.relation);
            const pathInfo = this._findShortestPath(st, "cheshi_qian", sid);
            st.envoys_in_transit.push({
              id: "xn_rider_" + sid,
              kind: "intimidate",
              label: `控弦使骑→${n.name}`,
              from: "cheshi_qian",
              to: sid,
              path: pathInfo.path,
              days: pathInfo.days,
            });
            events.push({ date: d, sub_tick: clamp(Math.ceil(pathInfo.days / 10), 3, 8), kind: "diplomacy", node: sid, callout: `🐺 威压${n.name} (威吓+${gain.toFixed(0)})`, text: `匈奴${t === "install_prince" ? "废立亲匈王子控扼" : "控弦铁骑巡行威压"}【${n.name}】：匈奴威吓升至 ${n.relation.xn_intimidation.toFixed(0)}（怨恨 ${n.relation.xn_resentment.toFixed(0)}）！` });
          }
        }
      } else if (t === "set_plan" || t === "march_army") {
        const target = c.target || item.target_node || "lou_lan";
        const origin = c.origin || (faction === "han" ? "dun_huang" : "chanyu_ting");
        const soldiers = c.soldiers || 4500;
        const standing = c.standing_order || "cautious";
        this._resolveCampaignBattle(st, faction, origin, target, soldiers, standing, false, events, {
          commanderId: cmdrId,
          kingKey: c.king_key || null,
          remountMode: c.remount_mode || (v1 && v1.steppe ? v1.steppe.remount_mode : 2),
          laborers: c.laborers,
        });
      } else {
        events.push({ date: d, sub_tick: 4, kind: "economy", callout: "📋 军政施行", text: `执行军政指令：${item.desc}` });
      }
      return true;
    }

    _resolveCampaignBattle(st, faction, originId, targetId, soldiers, standingOrder, isForged, events, extraOpts) {
      const opts = extraOpts || {};
      const d = st.meta.date_text;
      const tn = st.nodes[targetId] || st.nodes.lou_lan;
      const on = st.nodes[originId] || st.nodes.dun_huang;
      if (!tn) return;

      const defaultCmdId = faction === "han" ? (isForged ? "fu_jiezi" : "zhao_ponu") : "youxian_king";
      const cmdId = opts.commanderId || defaultCmdId;
      const cm = COMMANDER_META[cmdId] || COMMANDER_META[defaultCmdId];
      const cmdName = cm ? cm.name : faction === "han" ? "从票侯·赵破奴" : "右贤王·呼衍骨";
      if (st.characters && st.characters[cmdId]) {
        st.characters[cmdId].loc = targetId;
        st.characters[cmdId].status = "assigned";
        st.characters[cmdId].task_desc = `率军征讨${tn.name}`;
      }

      // 匈奴四部王忠诚与听调判定（汉匈不对称核心体验）
      let effectiveSoldiers = soldiers;
      let kingNote = "";
      if (faction === "xiongnu" && st.v1 && st.v1.tribes) {
        const kingKey = opts.kingKey || (cm && cm.tribe) || "youxian";
        const trObj = st.v1.tribes.tribes[kingKey];
        if (trObj) {
          if (trObj.loyalty < 45) {
            effectiveSoldiers = Math.round(soldiers * 0.76);
            kingNote = `（⚠️ ${trObj.name}忠诚仅 ${trObj.loyalty.toFixed(0)}，部众迟疑拥兵、半途私掠，实到战力折损 24%！）`;
            events.push({
              date: d,
              sub_tick: 3,
              kind: "court",
              node: originId,
              callout: `⚠️ ${trObj.name}拥兵迟疑 (-24%兵力)`,
              text: `【部王拥兵私掠】${trObj.name}怨望单于赏赐寡薄（忠诚 ${trObj.loyalty.toFixed(0)}），出征【${tn.name}】途中逗留私掠，仅遣偏师前驱！`,
            });
          } else if (
            trObj.loyalty >= 65 ||
            st.v1.tribes.assembly_target === targetId ||
            (cm && Array.isArray(cm.pref_targets) && cm.pref_targets.includes(targetId))
          ) {
            effectiveSoldiers = soldiers + 1100;
            trObj.loyalty = clamp(trObj.loyalty + 3.5, 0, 100);
            kingNote = `（🐺 ${trObj.name}欣然领命，自带部族私骑 +1,100 助战！）`;
          }
        }
      }

      const pathInfo = this._findShortestPath(st, originId, targetId);
      const arriveTick = clamp(Math.ceil((pathInfo.days || 15) / 10), 2, 8);
      const beaconBonus = tn.has_beacon && faction === "xiongnu" ? 1.08 : 1.0;
      const remountBonus = faction === "xiongnu" && (opts.remountMode === 3 || (st.v1 && st.v1.steppe && st.v1.steppe.remount_mode === 3)) ? 1.12 : 1.0;
      const forgeBonus = isForged || (st.v1 && st.v1.court && st.v1.court.forged_bonus_ticks > 0 && faction === "han") ? 1.16 : 1.0;
      const cmdStatBonus = cm ? 1.0 + (cm.cmd - 80) * 0.008 : 1.0;
      const enemyTroops = Math.round(Math.max(1200, (tn.militia || 1500) + (tn.armies && tn.armies[0] ? tn.armies[0].soldiers : 800)) * beaconBonus);
      const hasSupply =
        faction === "xiongnu" ||
        (st.v1 && st.v1.logistics.supply_lines && st.v1.logistics.supply_lines.some((s) => s.to === targetId || s.to === "lou_lan")) ||
        (tn.relation && tn.relation.forage && tn.relation.forage.tier === "WELCOME");

      const myLoss = Math.round(enemyTroops * (0.12 + this.rng() * 0.08));
      const enemyLoss = Math.round(effectiveSoldiers * forgeBonus * remountBonus * cmdStatBonus * (0.35 + this.rng() * 0.18));
      const starveLoss = !hasSupply && standingOrder === "aggressive" ? Math.round(effectiveSoldiers * 0.16) : 0;
      const capturedHorses = faction === "han" ? Math.round(250 + this.rng() * 450) : Math.round(180 + this.rng() * 340);
      const victory = effectiveSoldiers * 1.15 * forgeBonus * remountBonus * cmdStatBonus >= enemyTroops;

      st.moving_armies.push({
        id: "mov_" + targetId + "_" + st.meta.turn,
        name: faction === "han" ? `${cmdName}远征军` : `${cmdName}控弦骑`,
        commander_id: cmdId,
        commander_seal: cm ? cm.seal : faction === "han" ? "汉" : "匈",
        faction,
        from: originId,
        to: targetId,
        path: pathInfo.path,
        total_days: pathInfo.days,
        arrive_tick: arriveTick,
        soldiers: Math.max(500, effectiveSoldiers - myLoss - starveLoss),
      });

      if (faction === "han") {
        st.scores.han_casualties = (st.scores.han_casualties || 0) + myLoss;
        st.scores.starve_losses = (st.scores.starve_losses || 0) + starveLoss;
        st.scores.han_horse_pool = (st.scores.han_horse_pool || 5000) + capturedHorses;
        if (tn.relation) {
          tn.relation.han_influence = clamp(tn.relation.han_influence + (victory ? 24.0 : 10.0), 0, 100);
          tn.relation.xn_intimidation = clamp(tn.relation.xn_intimidation - (victory ? 20.0 : 8.0), 0, 100);
          if (victory || tn.relation.han_influence >= 55.0) {
            tn.relation.overlord = "han";
            tn.relation.han_enfeoffed = true;
            tn.relation.crimes = 0;
          }
          tn.relation.forage = this._forageTier(tn.relation);
        }
        if (st.v1 && victory) {
          st.v1.victory.han_perm_merit += isForged ? 10.0 : 6.0;
          st.v1.court.trust = clamp(st.v1.court.trust + (isForged ? 8.0 : 4.0), 0, 100);
          if (isForged) {
            events.push({ date: d, sub_tick: Math.min(9, arriveTick + 1), kind: "court", node: targetId, callout: "📜 捷报抵京·赦免矫制 (G+10)", text: `【功成不问矫制】捷报露布先于廷尉槛车抵长安，天子下诏赦免矫制之罪，嘉奖功业 +10.0、朝廷信任回升 +8.0！` });
          }
          if (targetId === "da_yuan" || targetId === "da_wan") {
            st.scores.han_horse_pool += 2500;
            st.v1.victory.han_perm_merit += 8.0;
            events.push({ date: d, sub_tick: Math.min(9, arriveTick + 1), kind: "v1", node: targetId, callout: "🐎 破贰师·获汗血马2,500匹", text: `【天马徕·贰师破宛】汉军攻克贰师城，得大宛汗血天马 +2,500 匹，都护功业 +8.0！` });
          }
        } else if (st.v1 && isForged && !victory) {
          st.v1.court.trust = clamp(st.v1.court.trust - 6.0, 0, 100);
          events.push({ date: d, sub_tick: Math.min(9, arriveTick + 1), kind: "court", node: targetId, callout: "⚠️ 矫诏未克·御史弹劾 (-6)", text: `【矫诏顿兵】奇袭未克坚城，御史奏劾擅发兵马，朝廷信任再降 -6.0！` });
        }
      } else {
        st.scores.xn_casualties = (st.scores.xn_casualties || 0) + myLoss;
        st.scores.xn_money += 380;
        if (st.v1) {
          st.v1.tribes.reward_pool += 380;
          st.v1.victory.xn_perm_weifu = (st.v1.victory.xn_perm_weifu || 0) + (victory ? 4.5 : 1.5);
          if (st.v1.steppe) {
            st.v1.steppe.total_horses = clamp((st.v1.steppe.total_horses || 18500) + capturedHorses - Math.round(myLoss * 0.4), 4000, 28000);
          }
          if (victory && st.v1.tribes.assembly_target === targetId) {
            st.scores.xn_money += 400;
            st.v1.tribes.chanyu_prestige = clamp(st.v1.tribes.chanyu_prestige + 6.0, 0, 100);
            events.push({ date: d, sub_tick: Math.min(9, arriveTick + 1), kind: "v1", node: targetId, callout: "🏆 兑现盟誓目标 (+400钱)", text: `【蹛林盟誓兑现】匈奴铁骑攻克大会盟誓目标【${tn.name}】，单于威望 +6.0，分获金帛 +400！` });
          }
        }
        if (tn.relation) {
          tn.relation.xn_intimidation = clamp(tn.relation.xn_intimidation + (victory ? 24.0 : 12.0), 0, 100);
          tn.relation.han_influence = clamp(tn.relation.han_influence - 14.0, 0, 100);
          if (victory || tn.relation.xn_intimidation >= 52.0) tn.relation.overlord = "xiongnu";
          tn.relation.forage = this._forageTier(tn.relation);
        }
      }

      const reportId = "br_" + st.meta.turn + "_" + targetId;
      const report = {
        id: reportId,
        turn: st.meta.turn + 1,
        date: d,
        node_id: targetId,
        node_name: tn.name,
        attacker_faction: faction,
        commander: cmdName,
        commander_id: cmdId,
        attacker_troops: effectiveSoldiers,
        defender_troops: enemyTroops,
        attacker_combat_loss: myLoss,
        attacker_starve_loss: starveLoss,
        defender_loss: enemyLoss,
        captured_horses: capturedHorses,
        standing_order: standingOrder,
        has_supply: hasSupply,
        victory,
        path: pathInfo.path,
        travel_days: pathInfo.days,
        summary: `${d}，${cmdName}率军 ${effectiveSoldiers.toLocaleString()} 自【${on ? on.name : originId}】历 ${pathInfo.days} 日奔袭【${tn.name}】${kingNote}，${victory ? "大破守军" : "激战退敌"}，斩首 ${enemyLoss.toLocaleString()} 级，获良马 ${capturedHorses} 匹（阵亡 ${myLoss} 人${starveLoss > 0 ? `，断粮饿死 ${starveLoss} 人` : ""}）。`,
      };
      st.battle_reports.unshift(report);
      if (st.battle_reports.length > 20) st.battle_reports.pop();

      events.push({
        date: d,
        sub_tick: arriveTick,
        kind: "battle",
        node: targetId,
        battle_report_id: reportId,
        callout: `${victory ? "⚔️ 大破" : "🛡️ 激战"}${tn.name} (斩首${enemyLoss}${starveLoss > 0 ? ` / 饥死${starveLoss}` : ""})`,
        text: `【${tn.name}之战】${report.summary}`,
      });
    }

    _nodeName(st, nid) {
      return st.nodes && st.nodes[nid] ? st.nodes[nid].name : nid;
    }

    _runOpponentAI(st, opp, appliedOpp, events) {
      const d = st.meta.date_text;
      const v1 = st.v1;
      const botStyle = st.meta.opp_bot || "balanced";
      if (opp === "xiongnu") {
        // 1. 西域重点城邦威压与索贡（优先争夺楼兰、车师、乌垒、焉耆、渠犁）
        const targets = ["lou_lan", "cheshi_qian", "wu_lei", "yan_qi", "qiu_ci", "qu_li", "wei_li"];
        targets.sort((a, b) => {
          const ra = (st.nodes[a] && st.nodes[a].relation) || {};
          const rb = (st.nodes[b] && st.nodes[b].relation) || {};
          return (ra.overlord === "xiongnu" ? 1 : 0) - (rb.overlord === "xiongnu" ? 1 : 0) || (rb.han_influence || 0) - (ra.han_influence || 0);
        });
        const picks = targets.slice(0, botStyle === "aggressive" ? 2 : 1);
        for (const pick of picks) {
          const n = st.nodes[pick];
          if (n && n.relation) {
            const gain = botStyle === "aggressive" ? 13.5 : 11.0;
            n.relation.xn_intimidation = clamp(n.relation.xn_intimidation + gain, 0, 100);
            n.relation.han_influence = clamp(n.relation.han_influence - 5.5, 0, 100);
            if (n.relation.xn_intimidation >= 54.0 && n.relation.xn_intimidation >= n.relation.han_influence) {
              n.relation.overlord = "xiongnu";
            }
            n.relation.forage = this._forageTier(n.relation);
            const msg = `匈奴右贤王铁骑巡行【${n.name}】索贡（匈奴威吓 +${gain.toFixed(1)}）`;
            appliedOpp.push(msg);
            events.push({ date: d, kind: "diplomacy", node: pick, text: msg });
          }
        }
        // 2. 单于王庭分赏、安抚日逐王与战术卡
        if (v1) {
          if (v1.tribes.tribes.rizhu.loyalty <= 46 && botStyle !== "greedy" && st.meta.turn % 2 === 0) {
            v1.tribes.tribes.rizhu.loyalty = clamp(v1.tribes.tribes.rizhu.loyalty + 10.0, 0, 100);
            appliedOpp.push("单于遣使赐金马安抚日逐王部（日逐忠诚 +10）");
          } else if (st.meta.turn % 2 === 1) {
            v1.tribes.active_tactical_card = st.meta.season === "autumn" ? "feigned_retreat" : "scorched_earth";
            v1.tribes.tactical_card_ticks = 9;
            appliedOpp.push(`单于王庭召开蹛林大会，发动战术卡【${v1.tribes.active_tactical_card}】`);
          }
        }
        // 3. 秋高马肥周期性南下攻掠（每 3 季发起一次实战远征）
        if (st.meta.turn % 3 === 2) {
          const raidCands = ["lou_lan", "cheshi_qian", "wu_lei", "qu_li"].filter(
            (nid) => st.nodes[nid] && (!st.nodes[nid].relation || st.nodes[nid].relation.overlord !== "xiongnu")
          );
          const raidTarget = raidCands[0] || "lou_lan";
          const raidTroops = botStyle === "aggressive" ? 5200 : 4200;
          appliedOpp.push(`右贤王率控弦骑 ${raidTroops.toLocaleString()} 奔袭【${this._nodeName(st, raidTarget)}】`);
          this._resolveCampaignBattle(st, "xiongnu", "cheshi_qian", raidTarget, raidTroops, "standard", false, events);
        }
      } else {
        // 汉方 AI 对手：精使招抚 + 军屯粮道 + 周期性讨伐
        const targets = ["lou_lan", "wu_lei", "wei_li", "qu_li", "cheshi_qian", "qiu_ci"];
        targets.sort((a, b) => {
          const ra = (st.nodes[a] && st.nodes[a].relation) || {};
          const rb = (st.nodes[b] && st.nodes[b].relation) || {};
          return (ra.overlord === "han" ? 1 : 0) - (rb.overlord === "han" ? 1 : 0) || (rb.han_influence || 0) - (ra.han_influence || 0);
        });
        for (const pick of targets.slice(0, 2)) {
          const n = st.nodes[pick];
          if (n && n.relation) {
            n.relation.han_influence = clamp(n.relation.han_influence + 12.5, 0, 100);
            n.relation.xn_intimidation = clamp(n.relation.xn_intimidation - 6.0, 0, 100);
            if (n.relation.han_influence >= 56.0 && n.relation.han_influence >= n.relation.xn_intimidation) {
              n.relation.overlord = "han";
              n.relation.han_enfeoffed = true;
            }
            n.relation.forage = this._forageTier(n.relation);
            const msg = `汉都护遣精使团册封抚谕【${n.name}】（汉影响力 +12.5）`;
            appliedOpp.push(msg);
            events.push({ date: d, kind: "diplomacy", node: pick, text: msg });
          }
        }
        if (v1 && st.meta.turn % 2 === 1 && v1.tribes.tongpu_active) {
          v1.tribes.tribes.rizhu.loyalty = clamp(v1.tribes.tribes.rizhu.loyalty - 7.0, 0, 100);
          const msg = "汉军轻骑截击天山北道僮仆都尉税队（日逐王忠诚 -7.0）";
          appliedOpp.push(msg);
          events.push({ date: d, kind: "battle", node: "yan_qi", text: msg });
        }
        if (st.meta.turn % 3 === 2) {
          const expCands = ["lou_lan", "cheshi_qian", "wu_lei"].filter(
            (nid) => st.nodes[nid] && (!st.nodes[nid].relation || st.nodes[nid].relation.overlord !== "han")
          );
          const expTarget = expCands[0] || "cheshi_qian";
          appliedOpp.push(`汉从票侯赵破奴率军 4,800 远征【${this._nodeName(st, expTarget)}】`);
          this._resolveCampaignBattle(st, "han", "dun_huang", expTarget, 4800, "cautious", false, events);
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
      const seasons = ["winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter", "winter"];
      const seasonZh = ["冬", "春", "春", "春", "夏", "夏", "夏", "秋", "秋", "秋", "冬", "冬"];
      st.meta.season = seasons[mo - 1];
      st.meta.date_text = `公元前${Math.abs(yr)}年${mo}月（${seasonZh[mo - 1]}）`;

      // 季度收入、军费/烽燧/粮道维护与太仆马政更新
      const slCount = st.v1 && st.v1.logistics.supply_lines ? st.v1.logistics.supply_lines.length : 1;
      const beaconCount = st.v1 && st.v1.logistics.beacons ? st.v1.logistics.beacons.length : 2;
      const hanUpkeep = Math.min(260, slCount * 35 + beaconCount * 15 + 60);
      const xnUpkeep = 120;
      st.scores.han_money = Math.max(0, st.scores.han_money + 560 - hanUpkeep);
      st.scores.xn_money = Math.max(0, st.scores.xn_money + (st.v1 && !st.v1.tribes.tongpu_active ? 280 : 440) - xnUpkeep);
      const wusunAllied = st.nodes.wu_sun && st.nodes.wu_sun.relation && st.nodes.wu_sun.relation.han_influence >= 55;
      st.scores.han_horse_pool = clamp((st.scores.han_horse_pool || 5000) + 320 + (wusunAllied ? 220 : 0) - slCount * 40, 500, 25000);
      if (st.nodes.dun_huang) st.nodes.dun_huang.grain += 22000;

      // 自动补给线运粮生效（自敦煌调运前线）
      if (st.v1 && st.v1.logistics.supply_lines) {
        let totalAuto = 0;
        for (const sl of st.v1.logistics.supply_lines) {
          if (sl.status !== "paused_danger") {
            const amt = sl.delivered_30d || 15000;
            if (st.nodes.dun_huang && st.nodes.dun_huang.grain > amt + 30000) {
              st.nodes.dun_huang.grain -= Math.round(amt * 0.6);
            }
            if (st.nodes[sl.to]) st.nodes[sl.to].grain = (st.nodes[sl.to].grain || 0) + amt;
            totalAuto += amt;
          }
        }
        st.v1.logistics.auto_delivered_grain = totalAuto;
      }

      // 军屯袭扰压力与西域城邦自主反叛结算
      if (st.v1 && st.v1.logistics.tuntian_nodes) {
        st.v1.logistics.tuntian_pressure = st.v1.logistics.tuntian_pressure || {};
        for (const tnid of Object.keys(st.v1.logistics.tuntian_nodes)) {
          const lv = st.v1.logistics.tuntian_nodes[tnid] || 0;
          if (lv <= 0) continue;
          const tn = st.nodes[tnid];
          if (tn) tn.grain = (tn.grain || 0) + lv * 14000;
          const curP = (st.v1.logistics.tuntian_pressure[tnid] || 15) + lv * 8;
          if (curP >= 65) {
            const guarded = tn && ((tn.armies && tn.armies.length > 0) || tn.has_beacon);
            if (guarded) {
              st.v1.logistics.tuntian_pressure[tnid] = 20;
              st.v1.victory.han_perm_merit = (st.v1.victory.han_perm_merit || 0) + 2.0;
              events.push({ date: st.meta.date_text, kind: "logistics", node: tnid, text: `【护屯击胡】匈奴游骑窥伺【${this._nodeName(st, tnid)}】汉军屯田，守塞戍卒据烽燧击退敌骑（功业 +2.0）！` });
            } else {
              st.v1.logistics.tuntian_pressure[tnid] = 25;
              st.v1.logistics.tuntian_nodes[tnid] = Math.max(1, lv - 1);
              if (tn) tn.tuntian_lv = st.v1.logistics.tuntian_nodes[tnid];
              events.push({ date: st.meta.date_text, kind: "logistics", node: tnid, text: `【赖丹式屯田遇袭】匈奴轻骑袭掠【${this._nodeName(st, tnid)}】无驻军屯田，屯田受损降级（建议筑烽燧或驻军护屯）！` });
            }
          } else {
            st.v1.logistics.tuntian_pressure[tnid] = curP;
          }
        }
      }
      for (const nid of Object.keys(st.nodes)) {
        const rel = st.nodes[nid].relation;
        if (rel && rel.overlord === "xiongnu" && (rel.xn_resentment || 0) >= 68) {
          rel.overlord = "none";
          rel.xn_intimidation = clamp(rel.xn_intimidation - 18.0, 0, 100);
          rel.xn_resentment = 35;
          rel.forage = this._forageTier(rel);
          events.push({ date: st.meta.date_text, kind: "diplomacy", node: nid, text: `【西域苦匈反叛】【${st.nodes[nid].name}】不堪僮仆都尉重敛，国人举兵驱逐匈奴监国使者！` });
        }
      }

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

      // 重置新季度历史人物差遣状态（保留其最新驻地坐标）
      if (st.characters) {
        for (const cid of Object.keys(st.characters)) {
          st.characters[cid].status = "idle";
          st.characters[cid].task_desc = "驻节待命";
        }
      }

      const v1 = st.v1;
      if (v1) {
        // 草原四季水草与战马自然繁育更新
        if (v1.steppe) {
          const sp = v1.steppe;
          if (st.meta.season === "spring" || st.meta.season === "summer") {
            sp.total_horses = clamp((sp.total_horses || 18500) + 1200, 4000, sp.max_cap || 28000);
            sp.dzud_risk = sp.winter_prep ? 4 : 14;
          } else if (st.meta.season === "autumn") {
            sp.total_horses = clamp((sp.total_horses || 18500) + 900, 4000, sp.max_cap || 28000);
            sp.dzud_risk = sp.winter_prep ? 6 : 26;
          } else if (st.meta.season === "winter") {
            const winterLoss = sp.winter_prep ? 200 : 1100;
            sp.total_horses = clamp((sp.total_horses || 18500) - winterLoss, 4000, sp.max_cap || 28000);
          }
        }

        // 检查当前诏令是否达成并轮转下一道历史诏令
        if (v1.court.active_edict) {
          const ed = v1.court.active_edict;
          const tNode = st.nodes[ed.target];
          const done = tNode && tNode.relation && (tNode.relation.overlord === "han" || tNode.relation.han_influence >= 58);
          if (done) {
            st.scores.han_money += ed.reward_money || 800;
            v1.court.trust = clamp(v1.court.trust + (ed.reward_trust || 12), 0, 100);
            v1.court.edicts_completed = (v1.court.edicts_completed || 0) + 1;
            events.push({
              date: st.meta.date_text,
              sub_tick: 9,
              kind: "court",
              node: ed.target,
              callout: `🏆 奉诏功成 (+${ed.reward_money || 800}钱)`,
              text: `【奉诏功成】圆满达成《${ed.title}》！天子嘉奖黄金 +${ed.reward_money || 800} 钱、朝廷信任 +${ed.reward_trust || 12}！`,
            });
            const nextIdx = Math.min(EDICT_CHAIN.length - 1, v1.court.edicts_completed);
            const nextTemplate = EDICT_CHAIN[nextIdx];
            v1.court.active_edict = {
              id: nextTemplate.id,
              title: nextTemplate.title,
              target: nextTemplate.target,
              deadline_turn: st.meta.turn + 8,
              reward_money: nextTemplate.reward_money,
              reward_trust: nextTemplate.reward_trust,
              penalty_trust: nextTemplate.penalty_trust,
              complied: false,
              bargained: false,
            };
          }
        }

        // 中期历史大事件涌现（若匈奴已修整冬窝子则大幅减轻漠北白灾冲击）
        if (st.meta.turn === 4 && !v1.events_meta.baizai_count) {
          v1.events_meta.baizai_count = 1;
          const sheltered = v1.steppe && v1.steppe.winter_prep;
          if (sheltered) {
            v1.tribes.chanyu_prestige = clamp(v1.tribes.chanyu_prestige - 2.0, 0, 100);
            v1.tribes.tribes.rizhu.loyalty = clamp(v1.tribes.tribes.rizhu.loyalty - 4.0, 0, 100);
            events.push({
              date: st.meta.date_text,
              sub_tick: 8,
              kind: "v1",
              node: "hu_jie",
              callout: "⛺ 冬窝子御白灾成功！",
              text: "【S06 漠北白灾·有备无患】漠北连降暴雪，幸赖王庭预先修整呼揭冬窝子与越冬干草，各部马群安然度冬，日逐王部未生叛意！",
            });
          } else {
            v1.tribes.chanyu_prestige = clamp(v1.tribes.chanyu_prestige - 8.0, 0, 100);
            v1.tribes.tribes.rizhu.loyalty = clamp(v1.tribes.tribes.rizhu.loyalty - 12.0, 0, 100);
            v1.tribes.tribes.rizhu.surrender_window = 4;
            v1.events_meta.rizhu_offered = true;
            if (v1.steppe) {
              v1.steppe.total_horses = Math.max(6000, (v1.steppe.total_horses || 18500) - 2800);
            }
            events.push({
              date: st.meta.date_text,
              sub_tick: 8,
              kind: "v1",
              node: "yan_qi",
              callout: "❄️ 漠北白灾·日逐王离心！",
              text: "【S06 历史大事件·漠北白灾与日逐王离心】漠北连降暴雪，单于强征西翼牛马；日逐王先贤掸怨望至极，密遣亲信赴乌垒向汉使请降（窗口期 4 季）！",
            });
          }
        }

        // 更新四部王赴会状态与迷雾忠诚区间
        for (const tk of ["zuoxian", "youxian", "rizhu", "lihu"]) {
          const tr = v1.tribes.tribes && v1.tribes.tribes[tk];
          if (tr) {
            tr.attended = tr.loyalty >= 50;
            const span = tr.attended ? 4 : 11;
            tr.loyalty_fog = [
              Math.max(0, Math.round(tr.loyalty - span)),
              Math.min(100, Math.round(tr.loyalty + span)),
            ];
          }
        }

        const hubScore =
          (st.nodes.wu_lei && st.nodes.wu_lei.relation && st.nodes.wu_lei.relation.overlord === "han" ? 10 : 0) +
          (st.nodes.cheshi_qian && st.nodes.cheshi_qian.relation && st.nodes.cheshi_qian.relation.overlord === "han" ? 10 : 0) +
          (st.nodes.lou_lan && st.nodes.lou_lan.relation && st.nodes.lou_lan.relation.overlord === "han" ? 8 : 0);
        const tuntianCnt = Object.keys(v1.logistics.tuntian_nodes).length;
        const tongpuBonus = v1.tribes.tongpu_active ? 0 : 10;
        const vassalScore = Math.min(72, hanVas * 6.0);
        const enfeoffScore = Math.min(20, hanEnf * 2.0);
        const tuntianScore = Math.min(15, tuntianCnt * 4.5);

        v1.victory.han_merit_breakdown = {
          vassal: vassalScore,
          enfeoff: enfeoffScore,
          hub: hubScore,
          tuntian: tuntianScore,
          suppress: 4,
          great: st.nodes.wu_sun && st.nodes.wu_sun.relation && st.nodes.wu_sun.relation.han_influence >= 55 ? 6 : 0,
          tongpu: tongpuBonus,
          event_pool: 0,
          perm: v1.victory.han_perm_merit || 0,
          hexi_pen: 0,
        };

        v1.victory.han_merit = clamp(
          Math.round(
            (vassalScore + enfeoffScore + hubScore + tuntianScore + 4 + v1.victory.han_merit_breakdown.great + tongpuBonus + (v1.victory.han_perm_merit || 0)) * 10
          ) / 10,
          0,
          125
        );
        v1.victory.han_merit_peak = Math.max(v1.victory.han_merit_peak, v1.victory.han_merit);

        this._updateWeifuBreakdown(st);
        st.scores.han = v1.victory.han_merit;
        st.scores.xiongnu = v1.victory.xn_weifu;

        if (v1.victory.han_merit >= 100.0) {
          v1.victory.han_hold_months += 3;
          if (v1.victory.han_hold_months >= 6 || st.meta.scenario === "lou_lan_gu_shi") {
            st.meta.winner = "han";
            st.meta.win_reason = "正式设立西域都护府 [HAN_MAIN__rizhu_window__G1_X4__baizai_rizhu]";
            v1.victory.han_grade = "G1_FENGHOU (裂土封侯)";
            v1.victory.xn_grade = "X4_BUHUI (诸部不会)";
            v1.victory.end_signature = st.meta.win_reason;
          }
        }
        if (v1.victory.xn_weifu >= 100.0) {
          v1.victory.xn_weifu_hold_months += 3;
          if (v1.victory.xn_weifu_hold_months >= 6) {
            st.meta.winner = "xiongnu";
            st.meta.win_reason = "百蛮震服·威服西域 [XN_MAIN_WEIFU__west_hegemony__G4_X1__baizai]";
            v1.victory.han_grade = "G4_XIAYU (徵系廷尉)";
            v1.victory.xn_grade = "X1_LONGCHENG (龙城勒铭)";
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
            biography: `《汉书·西域传》太史公赞曰：历 ${st.meta.turn} 季万里经略，大汉都护功业峰值 ${v1.victory.han_merit_peak.toFixed(1)}（内属 ${hanVas} 国，军屯 ${tuntianCnt} 处），匈奴单于威服峰值 ${v1.victory.xn_weifu_peak.toFixed(1)}。西域三十六国自此${st.meta.winner === "han" ? "凛奉汉正朔，置都护督察乌垒" : "复归控弦铁骑羁縻"}，诚千载未有之大变局也！`,
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
          ? `${st.meta.date_text}（第${st.meta.turn + 1}季白话战报摘要）：${evTexts.slice(0, 3).join("；")}。`
          : `${st.meta.date_text}（第${st.meta.turn + 1}季）：本季双方以经营粮道与西域邦交为主。`;

      // 动态更新季初 3 项待办提醒 (S07-R03)
      const todos = [];
      if (st.meta.side === "han" && st.v1) {
        if (st.v1.court.active_edict && !st.v1.court.active_edict.complied) {
          todos.push({
            level: "urgent",
            title: `【诏令待复】${st.v1.court.active_edict.title}`,
            detail: `限第 ${st.v1.court.active_edict.deadline_turn} 季前完成，可在[F2长安朝廷]择定奉诏、上书讨价或持节矫诏。`,
            jump_tab: "court",
            jump_node: st.v1.court.active_edict.target,
          });
        }
        if (st.v1.tribes.tribes.rizhu.surrender_window > 0) {
          todos.push({
            level: "urgent",
            title: `【千载良机】匈奴日逐王先贤掸密使请降（余 ${st.v1.tribes.tribes.rizhu.surrender_window} 季）`,
            detail: `立即在[F3西域诸国]或[乌垒]节点发兵迎降，可立得 +25 都护功业并永久省罢僮仆都尉！`,
            jump_tab: "diplomacy",
            jump_node: "wu_lei",
          });
        }
        todos.push({
          level: "normal",
          title: `【万里粮道与功业】当前都护功业 G = ${st.v1.victory.han_merit.toFixed(1)} / 100`,
          detail: `在[F3]遣精使/募使招抚楼兰、渠犁、乌垒，或在[F4]开置军屯、延伸补给线以突破功业百点大关。`,
          jump_tab: "diplomacy",
          jump_node: "lou_lan",
        });
      } else if (st.v1) {
        const rz = st.v1.tribes.tribes.rizhu;
        const rzFog = rz.attended ? `${rz.loyalty.toFixed(0)}` : `未知(约${rz.loyalty_fog ? rz.loyalty_fog[0] : 30}~${rz.loyalty_fog ? rz.loyalty_fog[1] : 55})`;
        todos.push({
          level: "urgent",
          title: `【单于王庭】核定本季四部分赏与草原盛会方略`,
          detail: `日逐王当前忠诚 ${rzFog}，谨防其怨望私通汉使；可在[F2王庭]分赏或赐金马安抚。`,
          jump_tab: "court",
          jump_node: "chanyu_ting",
        });
        todos.push({
          level: "normal",
          title: `【牧场草场与僮仆岁币】总马群 ${(st.v1.steppe ? st.v1.steppe.total_horses : 18500).toLocaleString()} 匹`,
          detail: `可在[F4牧场]轮牧育马、修整呼揭冬窝子防备白灾，或遣犁汗王游骑袭断汉军粮道。`,
          jump_tab: "logistics",
          jump_node: "chanyu_ting",
        });
        todos.push({
          level: "normal",
          title: `【西域威服】当前单于威服 W = ${st.v1.victory.xn_weifu.toFixed(1)} / 100`,
          detail: `在[F3藩属]封锁天山商路，或在[F5控弦]点选右贤王/日逐王部族铁骑威压楼兰、车师。`,
          jump_tab: "military",
          jump_node: "lou_lan",
        });
      }
      st.chronicle.todos = todos.slice(0, 3);

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

    runBatchSim(opts) {
      const o = opts || {};
      const games = o.games || 10;
      const hb = o.han_bot || "balanced";
      const xb = o.xn_bot || "balanced";
      const mat =
        (this.bundle.s09_results &&
          this.bundle.s09_results.v1_matrix &&
          this.bundle.s09_results.v1_matrix.dominance_analysis &&
          this.bundle.s09_results.v1_matrix.dominance_analysis.matchups &&
          this.bundle.s09_results.v1_matrix.dominance_analysis.matchups[`${hb}_vs_${xb}`]) || {
          han_win_pct: 52.0,
          han_main_pct: 29.5,
          xn_main_pct: 28.5,
        };
      return {
        games,
        han_win_pct: mat.han_win_pct,
        han_main_pct: mat.han_main_pct || 29.5,
        xn_main_pct: mat.xn_main_pct || 28.5,
        unique_signatures: Math.min(games, 9),
      };
    }

    _forageTier(rel) {
      const sc = rel.han_influence * 0.65 - rel.xn_intimidation * 0.35 - rel.xn_resentment * 0.15;
      if (rel.overlord === "han" || sc >= 35.0) {
        return { tier: "WELCOME", label: "箪食壶浆（免钱迎军供粮）", color: "#a9d4b4", score: 85 };
      }
      if (sc >= 12.0) {
        return { tier: "MARKET", label: "平价开市（市价购粮 60%）", color: "#c9b98a", score: 60 };
      }
      if (sc >= -8.0) {
        return { tier: "REFUSE", label: "闭籴绝市（仅暗购 15%）", color: "#d6a04a", score: 32 };
      }
      return { tier: "HOSTILE", label: "坚壁拒守（零供粮·需强攻）", color: "#e8998a", score: 12 };
    }
  }

  window.JSSimEngine = JSSimEngine;
})();
