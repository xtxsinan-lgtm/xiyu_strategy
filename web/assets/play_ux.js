/**
 * 试玩版 UX 同源规则：胜利文案、阵营供粮口径、分赏预览、内部标识本地化。
 * 供 play.html / game_play.js / js_engine.js 共用，避免首页、剧本、局内、终局各说各话。
 */
(function () {
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  const HOLD_SEASONS_REQUIRED = 4; // 四季 = 12 月（每季 +3 月）
  const HOLD_MONTHS_REQUIRED = HOLD_SEASONS_REQUIRED * 3;
  const MERIT_WIN = 100;
  const WEIFU_WIN = 100;

  const ID_LABELS = {
    wu_sun: "乌孙",
    wu_lei: "乌垒",
    lou_lan: "楼兰",
    cheshi_qian: "车师前",
    cheshi_hou: "车师后",
    yan_qi: "焉耆",
    qu_li: "渠犁",
    dun_huang: "敦煌",
    feigned_retreat: "诈败诱敌",
    scorched_earth: "坚壁清野",
    beacon_blind: "拔除亭障",
    autumn_raid: "秋高马肥掠野",
    zuoxian: "左贤王部",
    youxian: "右贤王部",
    rizhu: "日逐王部",
    lihu: "犁汗王部",
    G1_FENGHOU: "裂土封侯",
    G2_CIJUE: "赐爵关内侯",
    G3_WUGONG: "无功",
    G4_XIAYU: "徵系廷尉",
    G5_ZUZHU: "族诛",
    X1_LONGCHENG: "龙城勒铭",
    X2_BAOHAN: "保有故地",
    X3_SHOUCHENG: "守成",
    X4_BUHUI: "诸部不会",
    X5_SHENSI: "部众离散",
  };

  const CRITICAL_ORDER_TYPES = new Set([
    "welcome_rizhu",
    "forge_edict",
    "assassinate_king",
    "petition_protectorate",
  ]);

  function localizeId(id) {
    if (id == null || id === "") return "";
    const s = String(id);
    if (ID_LABELS[s]) return ID_LABELS[s];
    // 终局签名里夹带的内部码：剥掉方括号段
    return s
      .replace(/\s*\[[^\]]*\]/g, "")
      .replace(/HAN_MAIN__\w+/g, "汉主胜利")
      .replace(/XN_MAIN_WEIFU__\w+/g, "匈奴威服胜利")
      .replace(/XN_MAIN_HEXI__\w+/g, "匈奴河西胜利")
      .replace(/__/g, " · ")
      .replace(/_/g, " ");
  }

  function scenarioTitle(id) {
    return (
      {
        lou_lan_gu_shi: "楼兰姑师",
        mo_bei_zhi_hou: "漠北之后",
        du_hu_fu: "西域都护府",
      }[id] || "漠北之后"
    );
  }

  function isShortScenario(scenario) {
    return scenario === "lou_lan_gu_shi";
  }

  /** 归一化四部分赏份额（拖动时即时预览最终结算份额） */
  function normalizeRewardShares(ratios) {
    const keys = ["zuoxian", "youxian", "rizhu", "lihu"];
    const raw = {};
    let sum = 0;
    for (const k of keys) {
      raw[k] = Math.max(0, Number((ratios && ratios[k]) || 0));
      sum += raw[k];
    }
    if (sum <= 0) {
      return { zuoxian: 35, youxian: 30, rizhu: 20, lihu: 15, sum: 100, normalized: true };
    }
    const out = { sum: Math.round(sum * 10) / 10, normalized: Math.abs(sum - 100) > 0.5 };
    let acc = 0;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (i === keys.length - 1) {
        out[k] = Math.round((100 - acc) * 10) / 10;
      } else {
        out[k] = Math.round(((raw[k] / sum) * 100) * 10) / 10;
        acc += out[k];
      }
    }
    return out;
  }

  /** 各部动态诉求（随战功/损失/出征任务变化） */
  function tribeDemands(st) {
    const base = { zuoxian: 35, youxian: 30, rizhu: 20, lihu: 15 };
    const demands = {
      zuoxian: { expect: 35, want: "money", label: "要钱：按例分红" },
      youxian: { expect: 30, want: "money", label: "要钱：西翼例赏" },
      rizhu: { expect: 20, want: "money", label: "要钱：僮仆岁币分成" },
      lihu: { expect: 15, want: "money", label: "要钱：南下前锋例赏" },
    };
    if (!st || !st.v1 || !st.v1.tribes) return demands;
    const tr = st.v1.tribes.tribes || {};
    const last = st.season_brief || {};
    const raids = (last.my_plans || []).concat(last.opp_moves || []);
    const fought = raids.some((t) => /奔袭|远征|攻|掠|战/.test(String(t)));
    if (fought || (st.battle_reports || []).some((b) => b.turn === (st.meta.turn || 0))) {
      demands.lihu = { expect: 22, want: "command", label: "要主攻权：南下前锋请增份额" };
      demands.youxian = { expect: 28, want: "rest", label: "要休整：西翼请减役增赏" };
      base.lihu = 22;
      base.youxian = 28;
      base.zuoxian = 30;
      base.rizhu = 20;
    }
    if (tr.rizhu && tr.rizhu.loyalty < 55) {
      demands.rizhu = { expect: 28, want: "money", label: "要钱：日逐王请厚赏安抚" };
      base.rizhu = 28;
      base.zuoxian = 30;
      base.youxian = 27;
      base.lihu = 15;
    }
    if (st.v1.tribes.assembly_target) {
      const tgt = st.v1.tribes.assembly_target;
      if (tgt === "dun_huang" || tgt === "zhang_ye") {
        demands.lihu = { expect: 24, want: "command", label: "要主攻权：会盟主攻河西" };
      }
    }
    for (const k of Object.keys(demands)) {
      demands[k].expect = base[k];
    }
    return demands;
  }

  function previewLoyaltyDeltas(ratios, st) {
    const norm = normalizeRewardShares(ratios);
    const demands = tribeDemands(st);
    const details = {};
    for (const k of ["zuoxian", "youxian", "rizhu", "lihu"]) {
      const expect = (demands[k] && demands[k].expect) || 20;
      const sharePct = norm[k];
      const diff = sharePct - expect;
      let delta = diff >= -2 ? 7.0 + diff * 0.25 : diff * 0.85;
      if (demands[k] && demands[k].want === "rest" && sharePct >= expect) delta += 2;
      if (demands[k] && demands[k].want === "command" && sharePct >= expect) delta += 3;
      details[k] = {
        share: sharePct,
        expect,
        want: demands[k],
        delta: Math.round(delta * 10) / 10,
      };
    }
    return { norm, details, demands };
  }

  /**
   * 按当前玩家阵营解释供粮姿态。
   * 汉看「亲汉供粮」；匈看「亲匈供粮 / 坚壁拒守」。
   */
  function forageForViewer(rel, viewerSide, node) {
    const ctrl = node && (node.controller || node.faction || node.owner);
    if (!rel) {
      if (ctrl === viewerSide) {
        return { tier: "OWN", label: "己方官仓直供", color: "#a9d4b4", score: 90 };
      }
      if (viewerSide === "xiongnu" && ctrl === "han") {
        return { tier: "HOSTILE", label: "汉塞坚壁拒守", color: "#e8998a", score: 12 };
      }
      if (viewerSide === "han" && ctrl === "xiongnu") {
        return { tier: "HOSTILE", label: "坚壁拒守（零供粮·需强攻）", color: "#e8998a", score: 12 };
      }
      return { tier: "UNKNOWN", label: "供粮未明", color: "#c9b98a", score: 40 };
    }
    if (ctrl === viewerSide) {
      return { tier: "OWN", label: "己方官仓直供", color: "#a9d4b4", score: 90 };
    }
    if (viewerSide === "xiongnu") {
      if (rel.overlord === "xiongnu") {
        return { tier: "WELCOME", label: "属部迎军（毡帐供饮）", color: "#a9d4b4", score: 85 };
      }
      if (rel.overlord === "han" || ctrl === "han") {
        return { tier: "HOSTILE", label: "汉塞坚壁拒守", color: "#e8998a", score: 12 };
      }
      const sc = rel.xn_intimidation * 0.65 - rel.han_influence * 0.35;
      if (sc >= 28) return { tier: "WELCOME", label: "畏威开市（可征粮）", color: "#a9d4b4", score: 70 };
      if (sc >= 8) return { tier: "MARKET", label: "勉强市易（半价）", color: "#c9b98a", score: 45 };
      if (sc >= -10) return { tier: "REFUSE", label: "闭门不纳", color: "#d6a04a", score: 28 };
      return { tier: "HOSTILE", label: "坚壁拒守（零供粮）", color: "#e8998a", score: 12 };
    }
    // 汉方：沿用引擎 forage，但己方郡治覆盖
    if (rel.forage) return rel.forage;
    const sc = rel.han_influence * 0.65 - rel.xn_intimidation * 0.35 - (rel.xn_resentment || 0) * 0.15;
    if (rel.overlord === "han" || sc >= 35.0) {
      return { tier: "WELCOME", label: "箪食壶浆（免钱迎军供粮）", color: "#a9d4b4", score: 85 };
    }
    if (sc >= 12.0) return { tier: "MARKET", label: "平价开市（市价购粮 60%）", color: "#c9b98a", score: 60 };
    if (sc >= -8.0) return { tier: "REFUSE", label: "闭籴绝市（仅暗购 15%）", color: "#d6a04a", score: 32 };
    return { tier: "HOSTILE", label: "坚壁拒守（零供粮·需强攻）", color: "#e8998a", score: 12 };
  }

  function moneyLedger(st, side) {
    if (side === "xiongnu") {
      const book = Number(st.scores.xn_money || 0);
      const pool = Number((st.v1 && st.v1.tribes && st.v1.tribes.reward_pool) || book);
      const reserved = Math.max(0, pool - book); // 旧档口径差异时展示
      return {
        book,
        reserved: 0,
        available: book,
        poolLabel: `账面 ${book.toLocaleString()} 钱 · 可分赏 ${book.toLocaleString()} 钱`,
      };
    }
    const book = Number(st.scores.han_money || 0);
    return {
      book,
      reserved: 0,
      available: book,
      poolLabel: `账面 ${book.toLocaleString()} 钱 · 可用 ${book.toLocaleString()} 钱`,
    };
  }

  function buildVictoryStatus(st) {
    const side = (st && st.meta && st.meta.side) || "han";
    const scenario = (st && st.meta && st.meta.scenario) || "mo_bei_zhi_hou";
    const short = isShortScenario(scenario);
    const v1 = st && st.v1;
    const merit = (v1 && v1.victory && v1.victory.han_merit) || 0;
    const weifu = (v1 && v1.victory && v1.victory.xn_weifu) || 0;
    const holdMonths = (v1 && v1.victory && v1.victory.han_hold_months) || 0;
    const holdSeasons = Math.floor(holdMonths / 3);
    const xnHold = (v1 && v1.victory && v1.victory.xn_weifu_hold_months) || 0;
    const xnHoldSeasons = Math.floor(xnHold / 3);
    const vassals = (st && st.scores && st.scores.han_vassals) || 0;
    const tongpuDown = v1 && v1.tribes && !v1.tribes.tongpu_active;
    const rizhuWindow = v1 && v1.tribes && v1.tribes.tribes && v1.tribes.tribes.rizhu && v1.tribes.tribes.rizhu.surrender_window > 0;
    const hexiHeld =
      st && st.nodes
        ? ["wu_wei", "zhang_ye", "jiu_quan", "dun_huang"].filter((id) => st.nodes[id] && st.nodes[id].faction === "xiongnu").length
        : 0;

    const routes = [];
    if (side === "han") {
      routes.push({
        id: "merit_hold",
        title: short ? "短剧本主路线：功业破百即胜" : "主路线：功业立府",
        summary: short
          ? `都护功业 G ≥ ${MERIT_WIN} 即可终局（短剧本无需维持四季）`
          : `都护功业 G ≥ ${MERIT_WIN}，并维持 ${HOLD_SEASONS_REQUIRED} 季（信任≥25）`,
        done: short ? merit >= MERIT_WIN : merit >= MERIT_WIN && holdSeasons >= HOLD_SEASONS_REQUIRED,
        progress: short
          ? `功业 ${merit.toFixed(1)} / ${MERIT_WIN}`
          : `功业 ${merit.toFixed(1)} / ${MERIT_WIN} · 已维持 ${holdSeasons} / ${HOLD_SEASONS_REQUIRED} 季`,
        checklist: [
          { label: `功业 G ≥ ${MERIT_WIN}`, done: merit >= MERIT_WIN, detail: `${merit.toFixed(1)}` },
          ...(short
            ? []
            : [{ label: `维持 ${HOLD_SEASONS_REQUIRED} 季`, done: holdSeasons >= HOLD_SEASONS_REQUIRED, detail: `${holdSeasons}/${HOLD_SEASONS_REQUIRED}` }]),
          { label: "属国经营（贡献功业，非单独胜条件）", done: vassals >= 11, detail: `${vassals} 国` },
        ],
      });
      routes.push({
        id: "event_rizhu",
        title: "事件路线：迎降日逐王",
        summary: "迎降成功 → 功业 +25、罢僮仆都尉；仍须走主路线破百" + (short ? "即胜" : "并维持"),
        done: tongpuDown,
        progress: tongpuDown ? "僮仆都尉已罢" : rizhuWindow ? "请降窗口开启——须你亲自下令迎降" : "待日逐离心或白灾窗口",
        checklist: [
          { label: "日逐请降窗口 / 离间成熟", done: !!(rizhuWindow || tongpuDown) },
          { label: "玩家下令迎降（幕僚不可代决）", done: tongpuDown },
          { label: "功业破百后的立府维持", done: short ? merit >= MERIT_WIN : merit >= MERIT_WIN && holdSeasons >= HOLD_SEASONS_REQUIRED },
        ],
      });
    } else {
      routes.push({
        id: "weifu_hold",
        title: "主路线：威服西域",
        summary: `单于威服 W ≥ ${WEIFU_WIN}，并维持 ${HOLD_SEASONS_REQUIRED} 季`,
        done: weifu >= WEIFU_WIN && xnHoldSeasons >= HOLD_SEASONS_REQUIRED,
        progress: `威服 ${weifu.toFixed(1)} / ${WEIFU_WIN} · 已维持 ${xnHoldSeasons} / ${HOLD_SEASONS_REQUIRED} 季`,
        checklist: [
          { label: `威服 W ≥ ${WEIFU_WIN}`, done: weifu >= WEIFU_WIN, detail: `${weifu.toFixed(1)}` },
          { label: `维持 ${HOLD_SEASONS_REQUIRED} 季`, done: xnHoldSeasons >= HOLD_SEASONS_REQUIRED, detail: `${xnHoldSeasons}/${HOLD_SEASONS_REQUIRED}` },
        ],
      });
      routes.push({
        id: "hexi",
        title: "并列路线：饮马河西",
        summary: "夺取河西四郡并维持两季",
        done: hexiHeld >= 4,
        progress: `河西在匈 ${hexiHeld} / 4 郡`,
        checklist: [
          { label: "河西四郡皆入匈奴", done: hexiHeld >= 4, detail: `${hexiHeld}/4` },
        ],
      });
    }

    const primary = routes[0];
    const blurbHome =
      side === "han"
        ? short
          ? `短剧本《楼兰姑师》：功业 G 达到 ${MERIT_WIN} 即可终局。迎降日逐是加分事件路线，不能跳过你的确认。`
          : `都护功业 G 达到 ${MERIT_WIN}，并维持 ${HOLD_SEASONS_REQUIRED} 季。属国、军屯、枢纽与迎降日逐都是功业来源，不是另一套隐藏胜条件。`
        : `威服 W 达到 ${WEIFU_WIN} 并维持 ${HOLD_SEASONS_REQUIRED} 季，或夺取河西四郡。`;

    const blurbInGame =
      side === "han"
        ? short
          ? `目标：G≥${MERIT_WIN} 即胜（短局）。当前 ${merit.toFixed(1)}。`
          : `目标：G≥${MERIT_WIN} 并维持 ${HOLD_SEASONS_REQUIRED} 季。当前 ${merit.toFixed(1)}，已维持 ${holdSeasons}/${HOLD_SEASONS_REQUIRED} 季。`
        : `目标：W≥${WEIFU_WIN} 维持 ${HOLD_SEASONS_REQUIRED} 季，或夺河西。当前 W ${weifu.toFixed(1)}，河西 ${hexiHeld}/4。`;

    const blurbEnd =
      side === "han"
        ? short
          ? `短剧本终局：功业达到 ${MERIT_WIN}。`
          : `正式设立西域都护府：功业满 ${MERIT_WIN} 并维持 ${HOLD_SEASONS_REQUIRED} 季。`
        : weifu >= WEIFU_WIN
        ? `威服西域：威服满 ${WEIFU_WIN} 并维持 ${HOLD_SEASONS_REQUIRED} 季。`
        : `饮马河西：河西四郡皆入匈奴。`;

    return {
      side,
      scenario,
      scenarioTitle: scenarioTitle(scenario),
      short,
      merit,
      weifu,
      holdSeasons,
      holdSeasonsRequired: HOLD_SEASONS_REQUIRED,
      holdMonthsRequired: HOLD_MONTHS_REQUIRED,
      xnHoldSeasons,
      vassals,
      hexiHeld,
      routes,
      primary,
      blurbHome,
      blurbInGame,
      blurbEnd,
      choiceGoalHan: short
        ? `短剧本：功业 G ≥ ${MERIT_WIN} 即胜`
        : `功业 G ≥ ${MERIT_WIN}，维持 ${HOLD_SEASONS_REQUIRED} 季`,
      choiceGoalXn: `威服 W ≥ ${WEIFU_WIN} 维持 ${HOLD_SEASONS_REQUIRED} 季，或夺河西`,
    };
  }

  function scrubInternalText(text) {
    if (!text) return "";
    let s = String(text);
    for (const [k, v] of Object.entries(ID_LABELS)) {
      s = s.split(k).join(v);
    }
    s = s.replace(/\s*\[[A-Z0-9_]+[^\]]*\]/g, "");
    s = s.replace(/HAN_MAIN__\w+/g, "");
    s = s.replace(/XN_MAIN_\w+/g, "");
    return s.replace(/\s{2,}/g, " ").trim();
  }

  function isCriticalOrder(type) {
    return CRITICAL_ORDER_TYPES.has(type);
  }

  window.XIYU_UX = {
    HOLD_SEASONS_REQUIRED,
    HOLD_MONTHS_REQUIRED,
    MERIT_WIN,
    WEIFU_WIN,
    ID_LABELS,
    CRITICAL_ORDER_TYPES,
    localizeId,
    scenarioTitle,
    isShortScenario,
    normalizeRewardShares,
    tribeDemands,
    previewLoyaltyDeltas,
    forageForViewer,
    moneyLedger,
    buildVictoryStatus,
    scrubInternalText,
    isCriticalOrder,
  };
})();
