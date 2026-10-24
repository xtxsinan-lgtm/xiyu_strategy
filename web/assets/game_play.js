/**
 * 《西域·汉匈争霸》v2.0 商业级网页可玩版主控制器
 * 对标 israel_political_simulation：高密度古籍案卷 UI + 矢量设色历史舆图 + 可锁定因果拆解与趋势折线
 * 驱动 `web/play.html`，与 `web/index.html` 共享底层数据包与模拟引擎。
 */
(function () {
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  const TONE_MAP = { "#a9d4b4": "#1f6f50", "#c9b98a": "#8a6524", "#d6a04a": "#b87314", "#e8998a": "#a33a2a" };
  function tone(c) {
    return TONE_MAP[String(c || "").toLowerCase()] || c;
  }

  const DRAWERS = {
    inspector: { seal: "城", title: "图籍 · 城塞与驻军", sub: "所选城邑户口、仓廪、古道邻接与守军编制", key: "F1" },
    court: {
      seal: "诏",
      title: "诏书 · 朝廷与因果网",
      sub: "天子诏令 · 国策方略杠杆 · 持节矫诏 · 朝局因果网",
      key: "F2",
      xn: { seal: "庭", title: "王庭 · 四部与因果网", sub: "单于庭四部分赏 · 龙城大会 · 僮仆赋敛 · 威服因果网" },
    },
    diplomacy: { seal: "节", title: "符节 · 西域诸国总览", sub: "都护四阶宏图 · 功业拆解 · 诸国向背矩阵", key: "F3" },
    logistics: { seal: "仓", title: "仓廪 · 粮道与军屯", sub: "粟米瀑布流账本 · 万里自动补给线 · 塞外军屯烽燧矩阵", key: "F4" },
    military: { seal: "符", title: "虎符 · 军令与远征", sub: "在编野战军团 · 分步远征拟令 · 0—18旬口粮不归点推演", key: "F5" },
    chronicle: { seal: "史", title: "史册 · 战报与编年纪事", sub: "战死与断粮饿死分列详单 · 太史公季度实录", key: "F6" },
  };

  const SPEED_STEPS = [
    { v: "220", label: "慢" },
    { v: "110", label: "快" },
    { v: "0", label: "瞬时" },
  ];

  const MAP_MODES = {
    political: { label: "疆域臣属", desc: "政治疆域、宗主归属与册封态势" },
    influence: { label: "汉匈倾侧", desc: "汉室教化影响力 vs 匈奴铁骑威吓对比热力" },
    supply: { label: "仓廪粮道", desc: "各国存粮、塞外军屯与万里自动补给线" },
    intel: { label: "烽燧视野", desc: "汉塞烽燧亭障、情报视野层级与讨伐罪状" },
    military: { label: "兵力态势", desc: "驻军兵力、城防等级与敌军 30/60/90 日威胁圈" },
  };

  function fitStage() {
    const stage = document.getElementById("stage");
    if (!stage) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const s = Math.min(W / 1920, H / 1080);
    stage.style.width = `${W / s}px`;
    stage.style.height = `${H / s}px`;
    stage.style.transform = `scale(${s})`;
    GAME.stageScale = s;
    if (GAME.state) {
      renderFrameBand();
      updateSpotlight();
    }
  }

  const BUNDLE = window.XIYU_BUNDLE;
  const engine = new window.JSSimEngine(BUNDLE);

  const TUTORIAL_LESSONS = [
    {
      idx: 1,
      title: "一 · 持节出塞",
      body: "你不是坐镇长安的天子，而是**持节出玉门关的汉使**。先看舆图中央锁钥【楼兰】：左上角「城塞速览卡」与右侧「所选」显示其向背，点击底部 `图籍` 展开卷宗。",
      btnText: "定位楼兰",
      spotSelector: '.desk-prop[data-panel="inspector"]',
      action: () => selectNodeAndPan("lou_lan", "inspector", true),
    },
    {
      idx: 2,
      title: "二 · 先通粮道",
      body: "军无辎重则亡。出塞之前先开 `仓廪 (F4)` 查阅粟米瀑布流账本，拉通 **敦煌 → 楼兰** 自动补给线，每旬自动转运粟米。",
      btnText: "拟令：敦煌 → 楼兰粮道",
      spotSelector: '.desk-prop[data-panel="logistics"]',
      action: () => {
        switchDockPanel("logistics");
        queueCustomOrder({
          type: "set_supply_line",
          desc: "【万里粮道】拉通「敦煌 → 楼兰」自动补给线 (配民夫 2,500 人)",
          cost_money: 180,
          target_node: "lou_lan",
          raw: { from: "dun_huang", to: "lou_lan", laborers: 2500, escort: true },
        });
      },
    },
    {
      idx: 3,
      title: "三 · 不归点与远征",
      body: "器物 `虎符 (F5)` 内含 **0—18旬口粮曲线**：若选「见利则进」又无粮道，过了**不归点**便会断粮饿死；选「谨慎保军」则触及返程线自动班师。",
      btnText: "拟令：赵破奴奔袭楼兰",
      spotSelector: '.desk-prop[data-panel="military"]',
      action: () => {
        switchDockPanel("military");
        queueCustomOrder({
          type: "set_plan",
          desc: "【千里奔袭】遣从票侯·赵破奴率精骑自敦煌进击【楼兰】(常备指令：谨慎保军)",
          cost_money: 200,
          target_node: "lou_lan",
          raw: { origin: "dun_huang", target: "lou_lan", soldiers: 5000, standing_order: "cautious" },
        });
      },
    },
    {
      idx: 4,
      title: "四 · 诸国与四阶宏图",
      body: "器物 `符节 (F3)` 顶部展示 **西域都护四阶宏图** 与功业 G 来源拆解。点击任意指标卡可弹出**因果拆解与趋势折线**。",
      btnText: "遣精使抚楼兰",
      spotSelector: '.desk-prop[data-panel="diplomacy"]',
      action: () => {
        switchDockPanel("diplomacy");
        queueCustomOrder({
          type: "dispatch_elite_envoy",
          desc: "【持节精使】遣博望侯·张骞率精使团赴【楼兰】颁赐金帛 (影响力+18)",
          cost_money: 300,
          target_node: "lou_lan",
          raw: { state: "lou_lan" },
        });
      },
    },
    {
      idx: 5,
      title: "五 · 诏令、因果网与用印",
      body: "器物 `诏书 (F2)` 内含 **朝局因果网**、国策方略档位与**持节矫诏**竞速推演。拟令完毕后，点击右下角朱印 **结束本季** 推演九旬。",
      btnText: "奉诏行事",
      spotSelector: "#btn-end-season",
      action: () => {
        switchDockPanel("court");
        queueCustomOrder({
          type: "comply_edict",
          desc: "【奉诏拜表】奉行天子当季诏书（朝廷信任 +5.0）",
          cost_money: 0,
          target_node: "lou_lan",
          raw: {},
        });
      },
    },
  ];

  const GAME = {
    state: null,
    selectedNodeId: "lou_lan",
    activePanel: "inspector",
    drawerOpen: false,
    inspectorCardClosed: false,
    stageScale: 1,
    queuedOrders: [],
    mapMode: "political", // political | influence | supply | intel | military
    layers: {
      supply: true,
      fog: true,
      threat: false,
      trade: true,
      zone: true,
      tokens: true,
      grid: true,
    },
    mapCam: { x: 0, y: 0, w: 1000, h: 620, dragging: false, startX: 0, startY: 0 },
    diploSort: { col: "gap", asc: true },
    diploFilter: "all", // all | hub | han | xn | swing
    logFilter: "all", // all | battle | court | diplomacy | logistics
    useClassical: true,
    autoPopupSummary: false,
    tutorialOpen: true,
    tutorialIdx: 0,
    replaying: false,
    forgedTarget: "cheshi_qian",
    forgedSelfImpeach: true,
    lastStatusMsg: "",
    // 国策档位状态（F2 杠杆行）
    policies: {
      courtLobby: 1, // 0: 谨守臣节 | 1: 结好内朝 | 2: 厚结外戚大将军
      frontierDoc: 1, // 0: 步步屯戍 | 1: 远交近攻 | 2: 雷霆犁庭
      hexiLevy: 1, // 0: 宽恤民力 | 1: 常制调发 | 2: 急征转输
      xnTongpu: 1, // 0: 怀柔轻赋 | 1: 常赋岁币 | 2: 重敛竭泽
      xnSteppe: 1, // 0: 休牧保马 | 1: 控弦巡边 | 2: 举国南牧
    },
    planDraft: {
      origin: "dun_huang",
      target: "lou_lan",
      soldiers: 5000,
      laborers: 2000,
      standingOrder: "cautious",
    },
    // 可锁定因果提示栈（最多锁定 3 张 + 1 张临时）
    lockedTooltips: [],
    transientTooltip: null,
    metricHistory: {}, // metricKey -> [number]
  };

  // ==================== 1. 初始化与历史序列记录 ====================
  function startNewCampaign(opts) {
    const o = opts || {};
    const side = o.side || "han";
    const scenario = o.scenario || "mo_bei_zhi_hou";
    const difficulty = o.difficulty || "standard";
    const oppBot = o.opp_bot || "balanced";
    const seed = o.seed || 11001;

    GAME.state = engine.initGame({
      side,
      scenario,
      ruleset: "v1",
      opp_bot: oppBot,
      difficulty,
      seed,
    });
    GAME.queuedOrders = [];
    GAME.selectedNodeId = side === "han" ? "lou_lan" : "dun_huang";
    GAME.inspectorCardClosed = false;
    GAME.planDraft.origin = side === "han" ? "dun_huang" : "chanyu_ting";
    GAME.planDraft.target = GAME.selectedNodeId;
    GAME.lockedTooltips = [];
    GAME.transientTooltip = null;
    GAME.metricHistory = {};
    recordMetricSnapshot();

    applyFactionChrome(side);
    renderCompassRose();
    refreshAllUI();
    saveToSlot("autosave");
  }

  function recordMetricSnapshot() {
    const st = GAME.state;
    if (!st || !st.v1) return;
    const v1 = st.v1;
    const push = (k, val) => {
      if (!GAME.metricHistory[k]) {
        // 初始化 6 个历史基准点以绘制饱满的趋势折线
        GAME.metricHistory[k] = [val - 2.5, val - 1.8, val - 1.2, val - 0.6, val - 0.2, val];
      } else {
        GAME.metricHistory[k].push(val);
        if (GAME.metricHistory[k].length > 24) GAME.metricHistory[k].shift();
      }
    };
    push("trust", Number(v1.court.trust || 68));
    push("han_money", Number(st.scores.han_money || 4500));
    push("han_merit", Number(v1.victory.han_merit || 0));
    push("han_vassals", Number(st.scores.han_vassals || 0));
    push("xn_prestige", Number(v1.tribes.chanyu_prestige || 62));
    push("xn_money", Number(st.scores.xn_money || 1000));
    push("xn_weifu", Number(v1.victory.xn_weifu || 45));
    push("rizhu_loyalty", Number((v1.tribes.tribes.rizhu && v1.tribes.tribes.rizhu.loyalty) || 58));
    const totalGrain = Object.values(st.nodes).reduce((s, n) => s + (n.grain || 0), 0) / 1000;
    push("total_grain", Math.round(totalGrain));
  }

  function applyFactionChrome(side) {
    document.body.className = side === "han" ? "faction-han" : "faction-xiongnu";
    const nm = document.getElementById("prop-court-name");
    const act = document.getElementById("prop-court-act");
    const icon = document.getElementById("prop-court-icon");
    const dtab = document.getElementById("dtab-court");
    if (nm) nm.textContent = side === "han" ? "诏书" : "王庭";
    if (act) act.textContent = side === "han" ? "朝廷与因果 · F2" : "王庭与四部 · F2";
    if (icon) icon.className = `prop-icon ${side === "han" ? "i-zhaoshu" : "i-wangting"}`;
    if (dtab) dtab.textContent = side === "han" ? "F2 诏书 · 朝廷因果" : "F2 王庭 · 四部因果";
  }

  function refreshAllUI() {
    if (!GAME.state) return;
    renderTopHUD();
    renderTutorialCard();
    renderStrategicMap();
    renderMapInspectorCard();
    renderCausalTooltips();
    renderFoodCurveDrawer();
    if (GAME.drawerOpen) renderActiveDockPanel();
    syncDrawerUI();
    renderOutliner();
    renderBottomOrderQueue();
    updateSpotlight();
  }

  // ==================== 1b. 可锁定因果拆解与趋势折线管理器 (CausalTooltipManager) ====================
  function explainMetricData(metricKey) {
    const st = GAME.state;
    const v1 = st.v1;
    const side = st.meta.side;
    const slCount = (v1.logistics.supply_lines || []).length;
    const ttCount = Object.keys(v1.logistics.tuntian_nodes || {}).length;
    const hanV = st.scores.han_vassals || 0;
    const xnV = st.scores.xn_vassals || 0;
    const ed = v1.court.active_edict;

    const specs = {
      trust: {
        title: "长安朝廷信任 (Court Trust)",
        val: `${v1.court.trust.toFixed(1)} / 100`,
        band: v1.court.trust >= 80 ? "便宜行事" : v1.court.trust >= 50 ? "正常委任" : v1.court.trust >= 25 ? "监军掣肘" : "面临槛车召还",
        warnAt: 25,
        contribs: [
          { src: ed && ed.complied ? "当季奉诏拜表" : "待办诏书未完结", delta: ed && ed.complied ? +5.0 : -1.5 },
          { src: `西域属国岁贡 (${hanV}国)`, delta: +(hanV * 0.45).toFixed(1) },
          { src: `内朝游说档位 (${["谨守臣节", "结好内朝", "厚结大将军"][GAME.policies.courtLobby]})`, delta: [-0.5, +1.2, +2.8][GAME.policies.courtLobby] },
          { src: "少府军资调拨与边功折算", delta: +0.8 },
          { src: "御史大夫廷议弹劾摩耗", delta: -1.2 },
        ],
      },
      han_money: {
        title: "少府西域专款与官马池",
        val: `${st.scores.han_money.toLocaleString()} 钱`,
        band: st.scores.han_money >= 3000 ? "军资充沛" : st.scores.han_money >= 1200 ? "收支紧平衡" : "库藏告急",
        warnAt: 1000,
        contribs: [
          { src: "大司农每季岁入拨付", delta: +650 },
          { src: `丝路商道畅通关税 (${hanV}属国)`, delta: +(120 + hanV * 35) },
          { src: `河西调发方略 (${["宽恤民力", "常制调发", "急征转输"][GAME.policies.hexiLevy]})`, delta: [-80, +0, +240][GAME.policies.hexiLevy] },
          { src: `万里粮道民夫津贴 (${slCount}条)`, delta: -(slCount * 95) },
          { src: "本季拟令预支军费", delta: -GAME.queuedOrders.reduce((s, o) => s + (o.cost_money || 0), 0) },
        ],
      },
      han_merit: {
        title: "西域都护功业 (Merit G)",
        val: `${v1.victory.han_merit.toFixed(1)} / 100`,
        band: v1.victory.han_merit >= 80 ? "功冠西域·可立都护" : v1.victory.han_merit >= 40 ? "威德渐著" : "初通大宛之道",
        warnAt: 20,
        contribs: [
          { src: `大汉内属国册封 (${hanV} × 6.0)`, delta: +(hanV * 6.0).toFixed(1) },
          { src: `塞外戊己军屯 (${ttCount}处 × 4.5)`, delta: +(ttCount * 4.5).toFixed(1) },
          { src: "乌垒·车师南北道锁钥控制", delta: +((v1.victory.han_merit_breakdown && v1.victory.han_merit_breakdown.hub) || 0) },
          { src: v1.tribes.tongpu_active ? "匈奴焉耆僮仆都尉压制" : "已罢黜匈奴僮仆都尉", delta: v1.tribes.tongpu_active ? -4.0 : +10.0 },
          { src: "历次破城斩级永久勋绩", delta: +(v1.victory.han_perm_merit || 2.0) },
        ],
      },
      han_vassals: {
        title: "汉室册封内属国数量",
        val: `${hanV} / 18 国`,
        band: hanV >= 11 ? "已达都护府门槛" : `距立都护尚差 ${Math.max(0, 11 - hanV)} 国`,
        warnAt: 4,
        contribs: [
          { src: "持节精使与募使金帛抚谕", delta: +2.4 },
          { src: "塞外军屯与汉军驻防威望", delta: +(ttCount * 0.8).toFixed(1) },
          { src: "丝路畅通互市红利 (+1.5/月)", delta: +1.5 },
          { src: "匈奴右贤王与日逐王游骑威吓", delta: -1.8 },
        ],
      },
      total_grain: {
        title: "西域与河西总仓廪粟米",
        val: `${Math.round(Object.values(st.nodes).reduce((s, n) => s + (n.grain || 0), 0) / 1000).toLocaleString()}k 石`,
        band: slCount >= 2 ? "粮道络绎·军食有继" : "仰赖就地屯田",
        warnAt: 400,
        contribs: [
          { src: "河西四郡与关中岁漕拨入", delta: +185 },
          { src: `塞外军屯秋收产出 (${ttCount}处)`, delta: +(ttCount * 42) },
          { src: `自动补给线转运净増 (${slCount}条)`, delta: +(slCount * 18) },
          { src: "各城守备与野战军日常坐食", delta: -140 },
          { src: "流沙古道民夫脚耗与风沙折损", delta: -(slCount * 6) },
        ],
      },
      xn_prestige: {
        title: "撑犁孤涂单于威望",
        val: `${v1.tribes.chanyu_prestige.toFixed(1)} / 100`,
        band: v1.tribes.chanyu_prestige >= 65 ? "诸部宾服" : v1.tribes.chanyu_prestige >= 40 ? "王庭稳固" : "诸王离心",
        warnAt: 35,
        contribs: [
          { src: "龙城与蹛林大会祭天盟誓", delta: +4.0 },
          { src: `西域服属国岁贡 (${xnV}国)`, delta: +(xnV * 0.6).toFixed(1) },
          { src: "四部分赏均平度修正", delta: +1.5 },
          { src: "汉军出塞北伐威慑折损", delta: -2.0 },
        ],
      },
      xn_money: {
        title: "单于王庭赏赐池金帛",
        val: `${st.scores.xn_money.toLocaleString()} 钱`,
        band: st.scores.xn_money >= 800 ? "可丰赏四部" : "赏赐拮据",
        warnAt: 300,
        contribs: [
          { src: `焉耆僮仆都尉征敛 (${["轻赋", "常赋", "重敛"][GAME.policies.xnTongpu]})`, delta: [180, 320, 550][GAME.policies.xnTongpu] },
          { src: "西域商道过境榷税与马畜互市", delta: +160 },
          { src: "四部诸王例行分赏支出", delta: -200 },
        ],
      },
      xn_weifu: {
        title: "匈奴西域威服指数 (Weifu W)",
        val: `${v1.victory.xn_weifu.toFixed(1)} / 100`,
        band: v1.victory.xn_weifu >= 75 ? "霸有西域" : "汉匈南北对峙",
        warnAt: 30,
        contribs: [
          { src: `西域服属国铁骑威压 (${xnV}国)`, delta: +(xnV * 6.5).toFixed(1) },
          { src: v1.tribes.tongpu_active ? "焉耆僮仆都尉驻节统辖" : "僮仆都尉已失", delta: v1.tribes.tongpu_active ? +12.0 : -10.0 },
          { src: "日逐王先贤掸部控弦巡行", delta: +4.5 },
          { src: "汉使持节赐印与军屯渗透", delta: -(hanV * 2.2).toFixed(1) },
        ],
      },
      rizhu_loyalty: {
        title: "日逐王先贤掸忠诚度",
        val: `${((v1.tribes.tribes.rizhu && v1.tribes.tribes.rizhu.loyalty) || 58).toFixed(0)} / 100`,
        band: ((v1.tribes.tribes.rizhu && v1.tribes.tribes.rizhu.loyalty) || 58) >= 55 ? "奉命守西域" : "密谋率众降汉",
        warnAt: 48,
        contribs: [
          { src: `王庭分赏份额 (${(v1.tribes.reward_ratios && v1.tribes.reward_ratios.rizhu) || 20}% vs 期望20%)`, delta: (((v1.tribes.reward_ratios && v1.tribes.reward_ratios.rizhu) || 20) - 20) * 0.8 },
          { src: "单于专使赐金安抚", delta: +3.0 },
          { src: "与单于庭宿怨及汉使郑吉招诱", delta: -2.5 },
        ],
      },
    };

    if (metricKey && metricKey.startsWith("node_")) {
      const nid = metricKey.replace(/^node_/, "");
      const n = st.nodes[nid] || st.nodes[GAME.selectedNodeId] || st.nodes.lou_lan;
      const rel = n.relation;
      return {
        title: `【${n.name}】向背与仓廪因果拆解`,
        val: rel ? `汉 ${rel.han_influence.toFixed(0)} : 匈 ${rel.xn_intimidation.toFixed(0)}` : `${((n.grain || 0) / 1000).toFixed(0)}k 石`,
        band: ownerLabel(n),
        warnAt: 50,
        series: [
          rel ? rel.han_influence - 6 : 50,
          rel ? rel.han_influence - 4 : 52,
          rel ? rel.han_influence - 2 : 55,
          rel ? rel.han_influence - 1 : 57,
          rel ? rel.han_influence : 60,
        ],
        contribs: [
          { src: "大汉持节使团金帛赐予", delta: +4.5 },
          { src: n.tuntian_lv ? `本地戊己军屯 (Lv.${n.tuntian_lv}) 庇护` : "尚未设立本地军屯", delta: n.tuntian_lv ? +3.2 : 0 },
          { src: n.has_beacon ? "汉塞烽燧亭障震慑" : "无烽燧视野覆盖", delta: n.has_beacon ? +1.8 : -0.5 },
          { src: "匈奴游骑秋掠与僮仆索贡", delta: rel ? -(rel.xn_intimidation * 0.06).toFixed(1) : -1.2 },
          { src: "对匈奴重敛积怨转化亲汉", delta: rel ? +(rel.xn_resentment * 0.05).toFixed(1) : +0.5 },
        ],
      };
    }

    const base = specs[metricKey] || (side === "han" ? specs.trust : specs.xn_prestige);
    return {
      ...base,
      series: GAME.metricHistory[metricKey] || [50, 52, 54, 53, 56, 58],
    };
  }

  function explainMetric(metricKey) {
    if (!metricKey) return;
    if (!GAME.lockedTooltips.includes(metricKey)) {
      GAME.transientTooltip = metricKey;
    }
    renderCausalTooltips();
  }

  function toggleLockTooltip(metricKey) {
    const idx = GAME.lockedTooltips.indexOf(metricKey);
    if (idx >= 0) {
      GAME.lockedTooltips.splice(idx, 1);
    } else {
      if (GAME.lockedTooltips.length >= 3) {
        showOrderToast("最多同时锁定 3 张因果拆解卡", true);
        return;
      }
      GAME.lockedTooltips.push(metricKey);
      if (GAME.transientTooltip === metricKey) GAME.transientTooltip = null;
    }
    renderCausalTooltips();
  }

  function closeTooltip(metricKey) {
    const idx = GAME.lockedTooltips.indexOf(metricKey);
    if (idx >= 0) GAME.lockedTooltips.splice(idx, 1);
    if (GAME.transientTooltip === metricKey) GAME.transientTooltip = null;
    renderCausalTooltips();
  }

  function buildSparklineSvg(series, warnAt) {
    const pts = Array.isArray(series) && series.length >= 2 ? series : [50, 52, 55, 58];
    let lo = Math.min(...pts);
    let hi = Math.max(...pts);
    if (warnAt !== undefined && warnAt > 0) {
      lo = Math.min(lo, warnAt * 0.85);
      hi = Math.max(hi, warnAt * 1.15);
    }
    if (Math.abs(hi - lo) < 0.001) hi = lo + 1;
    const W = 276, H = 40;
    const coords = pts.map((v, i) => {
      const x = (i / (pts.length - 1)) * (W - 8) + 4;
      const y = H - 4 - ((v - lo) / (hi - lo)) * (H - 10);
      return [x, y];
    });
    const poly = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const area = `${coords[0][0].toFixed(1)},${H - 2} ${poly} ${coords[coords.length - 1][0].toFixed(1)},${H - 2}`;
    const last = coords[coords.length - 1];
    let warnLine = "";
    if (warnAt !== undefined && warnAt >= lo && warnAt <= hi) {
      const wy = H - 4 - ((warnAt - lo) / (hi - lo)) * (H - 10);
      warnLine = `<line x1="2" y1="${wy.toFixed(1)}" x2="${W - 2}" y2="${wy.toFixed(1)}" stroke="#a33a2a" stroke-width="1" stroke-dasharray="3,2"/>`;
    }
    return `
      <svg class="causal-spark-svg" viewBox="0 0 ${W} ${H}">
        <polygon points="${area}" fill="rgba(26, 75, 140, 0.15)"/>
        ${warnLine}
        <polyline points="${poly}" fill="none" stroke="#1a4b8c" stroke-width="1.6"/>
        <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.8" fill="#1a4b8c"/>
      </svg>
    `;
  }

  function renderCausalTooltips() {
    const stack = document.getElementById("causal-tooltip-stack");
    if (!stack || !GAME.state) return;
    const allKeys = [...GAME.lockedTooltips];
    if (GAME.transientTooltip && !allKeys.includes(GAME.transientTooltip)) {
      allKeys.push(GAME.transientTooltip);
    }
    if (!allKeys.length) {
      stack.innerHTML = "";
      return;
    }
    stack.innerHTML = allKeys
      .map((key) => {
        const isLocked = GAME.lockedTooltips.includes(key);
        const lockIdx = GAME.lockedTooltips.indexOf(key) + 1;
        const info = explainMetricData(key);
        return `
          <div class="causal-card ${isLocked ? "locked" : ""}" data-causal-key="${key}">
            <div class="causal-head">
              <span class="causal-title">${info.title}</span>
              ${isLocked ? `<span class="causal-lock-tag">锁定 ${lockIdx}/3</span>` : ""}
              <button type="button" class="causal-btn" data-lock-tip="${key}">${isLocked ? "解锁" : "锁定"}</button>
              <button type="button" class="causal-btn" data-close-tip="${key}" title="关闭">×</button>
            </div>
            <div class="causal-val-row">
              <span class="causal-val-num">${info.val}</span>
              <span class="causal-val-band">${info.band}</span>
            </div>
            <div class="causal-contribs">
              ${(info.contribs || [])
                .map((c) => {
                  const d = Number(c.delta || 0);
                  const sign = d > 0 ? "+" : "";
                  const cls = d > 0 ? "pos" : d < 0 ? "neg" : "";
                  return `<div class="causal-contrib-row"><span class="c-src">${c.src}</span><span class="c-delta ${cls}">${sign}${d}</span></div>`;
                })
                .join("")}
            </div>
            <div class="causal-spark-wrap">
              <div class="causal-spark-hdr"><span>近期季度趋势 (Sparkline)</span><span>红虚线为警戒阈值</span></div>
              ${buildSparklineSvg(info.series, info.warnAt)}
            </div>
          </div>
        `;
      })
      .join("");

    stack.querySelectorAll("[data-lock-tip]").forEach((b) => {
      b.onclick = (e) => {
        e.stopPropagation();
        toggleLockTooltip(b.getAttribute("data-lock-tip"));
      };
    });
    stack.querySelectorAll("[data-close-tip]").forEach((b) => {
      b.onclick = (e) => {
        e.stopPropagation();
        closeTooltip(b.getAttribute("data-close-tip"));
      };
    });
  }

  // ==================== 2. 顶栏汉/匈非对称双模式 HUD（支持点击因果拆解） ====================
  function renderTopHUD() {
    const st = GAME.state;
    const side = st.meta.side;
    const v1 = st.v1;

    const sealEl = document.getElementById("hud-seal");
    const leaderEl = document.getElementById("hud-leader-title");
    const subEl = document.getElementById("hud-scenario-subtitle");
    const dateEl = document.getElementById("hud-date-badge");
    const ordCntEl = document.getElementById("hud-order-count-badge");

    const scenMap = {
      lou_lan_gu_shi: "《楼兰姑师》",
      mo_bei_zhi_hou: "《漠北之后》",
      du_hu_fu: "《西域都护府》",
    };

    if (side === "han") {
      sealEl.textContent = "汉";
      leaderEl.textContent = st.meta.scenario === "du_hu_fu" ? "骑都尉 · 郑吉" : "博望侯 · 张骞";
      subEl.textContent = `${scenMap[st.meta.scenario] || ""} · ${st.meta.scenario === "du_hu_fu" ? "护鄯善以西使者" : "持节正使"}`;
    } else {
      sealEl.textContent = "匈奴";
      leaderEl.textContent = v1.tribes.chanyu_name || "伊稚斜单于";
      subEl.textContent = `${scenMap[st.meta.scenario] || ""} · 撑犁孤涂大单于`;
    }
    dateEl.textContent = `${st.meta.date_text}`;
    const cartSub = document.getElementById("map-cartouche-sub");
    if (cartSub) cartSub.textContent = `${String(st.meta.date_text || "").replace(/\s.*$/, "")} · 道里据《汉书·西域传》`;
    const cartMode = document.getElementById("map-cartouche-mode");
    if (cartMode && MAP_MODES[GAME.mapMode]) {
      cartMode.textContent = `舆图视角：${MAP_MODES[GAME.mapMode].label}`;
    }

    const queuedCost = GAME.queuedOrders.reduce((acc, o) => acc + (o.cost_money || 0), 0);
    ordCntEl.textContent = `第 ${st.meta.turn + 1} / ${st.meta.max_turns} 季 · ${st.meta.side === "han" ? "汉" : "匈奴"}`;

    const pillsEl = document.getElementById("hud-asymmetric-pills");
    const bar = (pct, color) =>
      `<div class="mini-bar"><div class="mini-bar-fill" style="width:${clamp(pct, 0, 100)}%;background:${color};"></div></div>`;

    if (side === "han") {
      const trust = v1.court.trust;
      const trustTier = trust >= 80 ? "便宜行事" : trust >= 50 ? "正常委任" : trust >= 25 ? "监军掣肘" : "将被召还";
      const trustColor = trust >= 50 ? "var(--green)" : trust >= 25 ? "var(--amber)" : "var(--danger)";
      const trustTag = trust >= 50 ? "tag-green" : trust >= 25 ? "tag-gold" : "tag-red";
      const merit = v1.victory.han_merit;
      const ed = v1.court.active_edict;
      const availMoney = Math.max(0, st.scores.han_money - queuedCost);

      pillsEl.innerHTML = `
        <div class="metric" data-causal-metric="trust" data-jump-panel="court" title="点击查看「朝廷信任」因果拆解与趋势折线；双击打开诏书抽屉">
          <div class="metric-label">朝廷信任 <span class="tag ${trustTag}">${trustTier}</span></div>
          <div class="metric-value">${trust.toFixed(0)}<small>/ 100</small></div>
          ${bar(trust, trustColor)}
        </div>
        <div class="metric" data-causal-metric="han_money" data-jump-panel="logistics" title="点击查看「少府军资与官马」因果拆解与收支趋势">
          <div class="metric-label">库钱 · 官马</div>
          <div class="metric-value">${availMoney.toLocaleString()}<small>钱</small>&nbsp;${(st.scores.han_horse_pool || 5000).toLocaleString()}<small>匹</small></div>
        </div>
        <div class="metric" data-causal-metric="trust" data-jump-panel="court" title="${ed ? ed.title : "暂无诏书"}（点击查看诏令与信任因果）">
          <div class="metric-label">诏令 ${ed ? (ed.complied ? '<span class="tag tag-green">已奉诏</span>' : `<span class="tag tag-red">限第 ${ed.deadline_turn} 季</span>`) : ""}</div>
          <div class="metric-value serif">${ed ? ed.title : "暂无诏书"}</div>
        </div>
        <div class="metric" data-causal-metric="han_merit" data-jump-panel="diplomacy" title="点击查看「都护功业 G」因果来源拆解与趋势">
          <div class="metric-label">都护功业 G <span class="tag tag-gold">属国 ${st.scores.han_vassals} / 18</span></div>
          <div class="metric-value">${merit.toFixed(1)}<small>/ 100</small></div>
          ${bar(merit, "linear-gradient(90deg,#b8893c,#e9d39a)")}
        </div>
      `;
    } else {
      const prest = v1.tribes.chanyu_prestige;
      const weifu = v1.victory.xn_weifu;
      const tr = v1.tribes.tribes;
      const availMoney = Math.max(0, st.scores.xn_money - queuedCost);
      const lamp = (tObj) => (tObj.loyalty >= 65 ? "dot-green" : tObj.loyalty >= 48 ? "dot-amber" : "dot-red");
      const tribe = (label, tObj) => `<span><i class="dot ${lamp(tObj)}"></i>${label} <strong>${tObj.loyalty.toFixed(0)}</strong></span>`;

      pillsEl.innerHTML = `
        <div class="metric" data-causal-metric="xn_prestige" data-jump-panel="court" title="点击查看「单于威望」因果拆解与趋势">
          <div class="metric-label">单于威望</div>
          <div class="metric-value">${prest.toFixed(0)}<small>/ 100</small></div>
          ${bar(prest, "#a07a5e")}
        </div>
        <div class="metric" data-causal-metric="xn_money" data-jump-panel="court" title="点击查看「王庭赏赐池」收支因果拆解">
          <div class="metric-label">赏赐池</div>
          <div class="metric-value">${availMoney.toLocaleString()}<small>钱</small></div>
        </div>
        <div class="metric" data-causal-metric="rizhu_loyalty" data-jump-panel="court" title="点击查看「四部忠诚与日逐王向背」因果拆解">
          <div class="metric-label">四部忠诚</div>
          <div class="metric-value tribe-row">${tribe("左贤", tr.zuoxian)}${tribe("右贤", tr.youxian)}${tribe("日逐", tr.rizhu)}${tribe("犁汗", tr.lihu)}</div>
        </div>
        <div class="metric" data-causal-metric="xn_weifu" data-jump-panel="diplomacy" title="点击查看「匈奴威服 W」因果拆解">
          <div class="metric-label">威服 W <span class="tag tag-xn">服属 ${st.scores.xn_vassals} 国</span></div>
          <div class="metric-value">${weifu.toFixed(1)}<small>/ 100</small></div>
          ${bar(weifu, "linear-gradient(90deg,#6d4c3d,#cdb39c)")}
        </div>
      `;
    }

    pillsEl.querySelectorAll(".metric").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const metricKey = el.getAttribute("data-causal-metric");
        if (metricKey) explainMetric(metricKey);
      });
      el.addEventListener("dblclick", () => {
        const targetPanel = el.getAttribute("data-jump-panel");
        if (targetPanel) openDrawer(targetPanel);
      });
    });
  }

  // ==================== 3. 新手5课非阻塞式教学引导卡 + 聚光灯 ====================
  function renderTutorialCard() {
    const card = document.getElementById("tutorial-card");
    const toggleBtn = document.getElementById("btn-toggle-tutorial");
    if (toggleBtn) toggleBtn.classList.toggle("on", GAME.tutorialOpen);
    if (!GAME.tutorialOpen) {
      card.style.display = "none";
      updateSpotlight();
      return;
    }
    card.style.display = "block";
    const lesson = TUTORIAL_LESSONS[GAME.tutorialIdx] || TUTORIAL_LESSONS[0];
    document.getElementById("tut-title").textContent = `新手教学 ${GAME.tutorialIdx + 1}/${TUTORIAL_LESSONS.length} · ${lesson.title.replace(/^.\s·\s/, "")}`;
    document.getElementById("tut-body").innerHTML = lesson.body
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
    const actBar = document.getElementById("tut-action-bar");
    actBar.innerHTML = `<button class="btn btn-sm btn-gold" id="btn-tut-do-action">${lesson.btnText}</button>`;
    document.getElementById("btn-tut-do-action").addEventListener("click", () => {
      lesson.action();
    });
    updateSpotlight();
  }

  function updateSpotlight() {
    const spot = document.getElementById("onboarding-spotlight");
    const stage = document.getElementById("stage");
    if (!spot || !stage) return;
    if (!GAME.tutorialOpen || GAME.drawerOpen) {
      spot.classList.remove("show");
      return;
    }
    const lesson = TUTORIAL_LESSONS[GAME.tutorialIdx] || TUTORIAL_LESSONS[0];
    const targetEl = lesson.spotSelector ? document.querySelector(lesson.spotSelector) : null;
    if (!targetEl) {
      spot.classList.remove("show");
      return;
    }
    const sr = stage.getBoundingClientRect();
    const tr = targetEl.getBoundingClientRect();
    const scale = GAME.stageScale || 1;
    const x = (tr.left - sr.left) / scale - 4;
    const y = (tr.top - sr.top) / scale - 4;
    const w = tr.width / scale + 8;
    const h = tr.height / scale + 8;
    spot.style.left = `${x.toFixed(1)}px`;
    spot.style.top = `${y.toFixed(1)}px`;
    spot.style.width = `${w.toFixed(1)}px`;
    spot.style.height = `${h.toFixed(1)}px`;
    spot.classList.add("show");
  }

  // ==================== 3b. 舆图城塞速览卡 (On-Map RegionInspectorCard) ====================
  function renderMapInspectorCard() {
    const card = document.getElementById("map-inspector-card");
    if (!card || !GAME.state) return;
    if (GAME.drawerOpen || GAME.inspectorCardClosed || !GAME.selectedNodeId) {
      card.classList.remove("show");
      card.setAttribute("aria-hidden", "true");
      return;
    }
    const st = GAME.state;
    const side = st.meta.side;
    const n = st.nodes[GAME.selectedNodeId];
    if (!n) {
      card.classList.remove("show");
      return;
    }
    const rel = n.relation;
    const swatch = getGodotNodeColor(n.id, n);
    const troops = (n.armies || []).reduce((acc, a) => acc + (a.soldiers || 0), 0);
    card.classList.add("show");
    card.setAttribute("aria-hidden", "false");

    const bar = (lbl, val, col) => `
      <div class="mic-bar-row">
        <span style="color:var(--ink-2)">${lbl}</span>
        <div class="d-meter-track"><div class="d-meter-fill" style="width:${clamp(val, 0, 100)}%;background:${col};"></div></div>
        <span style="text-align:right;font-family:var(--font-mono);font-weight:700;">${val.toFixed(0)}</span>
      </div>
    `;

    card.innerHTML = `
      <div class="mic-head">
        <i class="mic-swatch" style="background:${swatch}"></i>
        <div>
          <span class="mic-title">${n.name}</span>
          <span class="mic-sub"> · ${ownerLabel(n)}</span>
        </div>
        <button type="button" class="mic-close" id="btn-mic-close" title="关闭速览卡">×</button>
      </div>
      <div class="mic-kpis">
        <div class="mic-kpi"><span class="k">人口</span><span class="v">${((n.pop || 0) / 1000).toFixed(1)}k</span></div>
        <div class="mic-kpi"><span class="k">储粮</span><span class="v">${((n.grain || 0) / 1000).toFixed(0)}k</span></div>
        <div class="mic-kpi"><span class="k">城防</span><span class="v">${n.type === "junction" ? "—" : `Lv.${n.walls || 1}`}</span></div>
        <div class="mic-kpi"><span class="k">驻军</span><span class="v">${troops ? `${(troops / 1000).toFixed(1)}k` : `${((n.militia || 800) / 1000).toFixed(1)}k`}</span></div>
      </div>
      ${
        rel
          ? `<div class="mic-bars">
              ${bar("汉影响", rel.han_influence, "#a33a2a")}
              ${bar("匈威吓", rel.xn_intimidation, "#6b4a33")}
              <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted);margin-top:3px;">
                <span>过境供粮：<strong style="color:${rel.forage ? tone(rel.forage.color) : "var(--ink)"}">${rel.forage ? rel.forage.label.split(/[（(]/)[0] : "平价开市"}</strong></span>
                <span style="cursor:pointer;color:var(--cobalt);font-weight:600;" id="btn-mic-causal">因果拆解 ▾</span>
              </div>
            </div>`
          : `<div style="font-size:11px;color:var(--muted);margin-bottom:6px;">直辖军镇要塞 · 屯田 Lv.${n.tuntian_lv || 0} · 烽燧 ${n.has_beacon ? "已筑" : "未筑"}</div>`
      }
      <div class="mic-actions">
        ${
          side === "han"
            ? `<button type="button" class="mic-btn" id="mic-act-1">遣精使 (300)</button>
               <button type="button" class="mic-btn" id="mic-act-2">开军屯 (220)</button>`
            : `<button type="button" class="mic-btn" id="mic-act-1">铁骑威压</button>
               <button type="button" class="mic-btn" id="mic-act-2">索取质子</button>`
        }
        <button type="button" class="mic-btn primary" id="mic-act-open">展开图籍 F1</button>
      </div>
    `;

    document.getElementById("btn-mic-close").onclick = (e) => {
      e.stopPropagation();
      GAME.inspectorCardClosed = true;
      renderMapInspectorCard();
    };
    const cBtn = document.getElementById("btn-mic-causal");
    if (cBtn) {
      cBtn.onclick = (e) => {
        e.stopPropagation();
        explainMetric(`node_${n.id}`);
      };
    }
    document.getElementById("mic-act-open").onclick = () => openDrawer("inspector");
    const b1 = document.getElementById("mic-act-1");
    const b2 = document.getElementById("mic-act-2");
    if (side === "han") {
      if (b1) b1.onclick = () => queueCustomOrder({ type: "dispatch_elite_envoy", desc: `【精使出塞】遣持节精使团赴【${n.name}】颁赐缯帛 (影响力+18)`, cost_money: 300, target_node: n.id, raw: { state: n.id } });
      if (b2) b2.onclick = () => queueCustomOrder({ type: "build_tuntian", desc: `【塞外军屯】在【${n.name}】开置戊己校尉屯田 (储粮+42k，功业+4.5)`, cost_money: 220, target_node: n.id, raw: { node: n.id } });
    } else {
      if (b1) b1.onclick = () => queueCustomOrder({ type: "intimidate_city", desc: `【控弦威压】遣游骑巡行威压【${n.name}】(匈奴威吓+16)`, cost_money: 0, target_node: n.id, raw: { state: n.id } });
      if (b2) b2.onclick = () => queueCustomOrder({ type: "demand_vassal", desc: `【索取质子】强令【${n.name}】遣质子入侍单于庭 (威服+7.5)`, cost_money: 120, target_node: n.id, raw: { state: n.id } });
    }
  }

  // ==================== 4. 72刻度古典方位罗盘 + 斑马纹图廓 + 矢量设色西域舆图 ====================
  function renderCompassRose() {
    const svg = document.getElementById("map-compass-svg");
    if (!svg) return;
    const R = 34;
    const parts = [];
    parts.push(`<circle r="${R + 3}" fill="rgba(246, 239, 224, 0.85)" stroke="#1e1c1a" stroke-width="1.2"/>`);
    parts.push(`<circle r="${R}" fill="none" stroke="#1e1c1a" stroke-width="0.8"/>`);
    parts.push(`<circle r="${R - 5}" fill="none" stroke="rgba(30, 28, 26, 0.45)" stroke-width="0.6"/>`);
    // 72 刻度线（每 5° 一小格，每 30° 一大格）
    for (let deg = 0; deg < 360; deg += 5) {
      const a = (deg * Math.PI) / 180;
      const major = deg % 30 === 0;
      const len = major ? 4.5 : 2.3;
      const x1 = Math.cos(a) * (R - len);
      const y1 = Math.sin(a) * (R - len);
      const x2 = Math.cos(a) * R;
      const y2 = Math.sin(a) * R;
      parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#1e1c1a" stroke-width="${major ? 0.9 : 0.45}"/>`);
    }
    // 八方指针
    for (let k = 0; k < 8; k++) {
      const ang = -Math.PI / 2 + (k * Math.PI) / 4;
      const len = k % 2 === 0 ? R - 5 : (R - 5) * 0.62;
      const w = k % 2 === 0 ? 4.8 : 2.8;
      const tipX = Math.cos(ang) * len;
      const tipY = Math.sin(ang) * len;
      const lX = Math.cos(ang - Math.PI / 2) * w;
      const lY = Math.sin(ang - Math.PI / 2) * w;
      const rX = Math.cos(ang + Math.PI / 2) * w;
      const rY = Math.sin(ang + Math.PI / 2) * w;
      const darkCol = k === 0 ? "#a33a2a" : "#1e1c1a";
      const lightCol = k === 0 ? "#d9b877" : "#f4eee1";
      parts.push(`<polygon points="0,0 ${lX.toFixed(1)},${lY.toFixed(1)} ${tipX.toFixed(1)},${tipY.toFixed(1)}" fill="${darkCol}"/>`);
      parts.push(`<polygon points="0,0 ${tipX.toFixed(1)},${tipY.toFixed(1)} ${rX.toFixed(1)},${rY.toFixed(1)}" fill="${lightCol}" stroke="#1e1c1a" stroke-width="0.45"/>`);
    }
    parts.push(`<circle r="2.6" fill="#d9b877" stroke="#1e1c1a" stroke-width="0.8"/>`);
    parts.push(`<text x="0" y="${-R - 5}" font-family="var(--font-title)" font-size="12" font-weight="700" fill="#a33a2a" text-anchor="middle">北</text>`);
    parts.push(`<text x="${R + 7}" y="4" font-family="var(--font-title)" font-size="10" fill="#1e1c1a" text-anchor="middle">东</text>`);
    parts.push(`<text x="0" y="${R + 12}" font-family="var(--font-title)" font-size="10" fill="#1e1c1a" text-anchor="middle">南</text>`);
    parts.push(`<text x="${-R - 7}" y="4" font-family="var(--font-title)" font-size="10" fill="#1e1c1a" text-anchor="middle">西</text>`);
    svg.innerHTML = parts.join("");
  }

  const GODOT_C_HAN = "#c0392b";
  const GODOT_C_XN = "#5d4037";
  const GODOT_C_HAN_V = "#e08a80";
  const GODOT_C_XN_V = "#a1887f";
  const GODOT_C_PASS = "#b8b8b8";
  const GODOT_STATE_COLORS = {
    dong_qiemi: "#d99032",
    cheshi_qian: "#287c8e",
    cheshi_hou: "#835cad",
    yan_qi: "#559b48",
    wei_li: "#c45c91",
    wu_lei: "#4668b5",
    lun_tai: "#9a9d30",
    qiu_ci: "#25977a",
    gu_mo: "#ba7037",
    wen_su: "#bd4770",
    shu_le: "#5a479b",
    sha_che: "#a47cba",
    yu_tian: "#e0b13e",
    jing_jue: "#679baa",
    qie_mo: "#a9b75c",
    lou_lan: "#d46b43",
    juan_du: "#4b7440",
    xiu_xun: "#8d5d78",
    dawan: "#3566cf",
    da_wan: "#3566cf",
    kangju: "#6d8a24",
    kang_ju: "#6d8a24",
    dayuezhi: "#a343b5",
    da_yuezhi: "#a343b5",
    jibin: "#367064",
    ji_bin: "#367064",
    wusun: "#26aaa3",
    wu_sun: "#26aaa3",
  };

  // 古典水系矢量数据（湖泊 + 河流）
  const HYDRO_LAKES = [
    { name: "盐泽 (蒲昌海)", cx: 632, cy: 392, rx: 22, ry: 12, rot: -12 },
    { name: "居延泽", cx: 836, cy: 282, rx: 14, ry: 8, rot: 15 },
    { name: "敦薨泽", cx: 554, cy: 344, rx: 12, ry: 7, rot: -8 },
    { name: "热海 (伊塞克湖)", cx: 232, cy: 212, rx: 24, ry: 10, rot: -10 },
    { name: "夷播海", cx: 212, cy: 112, rx: 38, ry: 13, rot: -18 },
  ];

  const HYDRO_RIVERS = [
    { name: "塔里木河 (计式水)", d: "M 236 353 Q 315 348, 395 362 T 545 375 T 618 390", lx: 430, ly: 360 },
    { name: "和田河 (于阗水)", d: "M 389 495 Q 392 430, 395 362", lx: 378, ly: 430 },
    { name: "叶尔羌河", d: "M 270 448 Q 305 398, 345 356", lx: 288, ly: 405 },
    { name: "弱水", d: "M 851 450 Q 832 375, 836 286", lx: 852, ly: 365 },
    { name: "疏勒河", d: "M 812 410 Q 755 385, 690 385", lx: 758, ly: 374 },
    { name: "伊犁水", d: "M 335 175 Q 285 152, 238 120", lx: 292, ly: 148 },
    { name: "药杀水", d: "M 167 297 Q 112 252, 52 215", lx: 105, ly: 248 },
    { name: "妫水 (阿姆河)", d: "M 185 450 Q 110 446, 35 425", lx: 112, ly: 440 },
  ];

  const MVP_NODE_META = {};
  if (BUNDLE.scenario_mvp && Array.isArray(BUNDLE.scenario_mvp.nodes)) {
    for (const mn of BUNDLE.scenario_mvp.nodes) {
      MVP_NODE_META[mn.id] = mn;
    }
  }

  function buildGodotRoutePoints(r, posMap, waypoints) {
    const pA = posMap[r.a || r.from];
    const pB = posMap[r.b || r.to];
    if (!pA || !pB) return [];
    const a = r.a || r.from;
    const b = r.b || r.to;
    const k1 = `${a}|${b}`;
    const k2 = `${b}|${a}`;
    let pts = [pA];
    if (waypoints[k1]) {
      pts = pts.concat(waypoints[k1]);
    } else if (waypoints[k2]) {
      pts = pts.concat([...waypoints[k2]].reverse());
    }
    pts.push(pB);
    return pts;
  }

  function buildGodotBezierPath(pts) {
    if (!pts || pts.length < 2) return "";
    const n = pts.length;
    const tangents = pts.map((_, i) => {
      if (i <= 0 || i >= n - 1) return [0, 0];
      return [(pts[i + 1][0] - pts[i - 1][0]) * 0.15, (pts[i + 1][1] - pts[i - 1][1]) * 0.15];
    });
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const c1x = pts[i][0] + tangents[i][0];
      const c1y = pts[i][1] + tangents[i][1];
      const c2x = pts[i + 1][0] - tangents[i + 1][0];
      const c2y = pts[i + 1][1] - tangents[i + 1][1];
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${pts[i + 1][0].toFixed(1)} ${pts[i + 1][1].toFixed(1)}`;
    }
    return d;
  }

  function sampleGodotRoutePoint(pts, t) {
    if (!pts || pts.length === 0) return [500, 310];
    if (pts.length === 1) return pts[0];
    const segCount = pts.length - 1;
    const scaled = clamp(t, 0, 1) * segCount;
    const idx = Math.min(Math.floor(scaled), segCount - 1);
    const localT = scaled - idx;
    return [
      pts[idx][0] + (pts[idx + 1][0] - pts[idx][0]) * localT,
      pts[idx][1] + (pts[idx + 1][1] - pts[idx][1]) * localT,
    ];
  }

  function getGodotNodeColor(nid, n) {
    const meta = MVP_NODE_META[nid] || {};
    const origFaction = meta.faction || n.faction || nid;
    const nodeType = meta.type || n.type || "city";
    const ctl = n.relation && n.relation.overlord ? n.relation.overlord : n.controller;

    if (origFaction === "han" && ctl === "han") return GODOT_C_HAN;
    if (origFaction === "xiongnu" && ctl === "xiongnu") return GODOT_C_XN;
    if (nodeType === "pass") return GODOT_C_PASS;
    if (nodeType === "junction") return "#8a7550";
    if (ctl === "han") return GODOT_C_HAN_V;
    if (ctl === "xiongnu") return GODOT_C_XN_V;
    if (GODOT_STATE_COLORS[origFaction]) return GODOT_STATE_COLORS[origFaction];
    if (GODOT_STATE_COLORS[nid]) return GODOT_STATE_COLORS[nid];
    return "#b89658";
  }

  // 根据五种专题视角 (mapMode) 计算政区多边形填色与是否叠加斜纹
  function getTerritoryStyle(nid, n) {
    const rel = n.relation;
    const ctl = rel && rel.overlord ? rel.overlord : n.controller;
    const mode = GAME.mapMode || "political";

    if (mode === "influence") {
      if (!rel) {
        return {
          fill: ctl === "han" ? "rgba(176, 52, 38, 0.34)" : "rgba(93, 64, 55, 0.34)",
          stroke: ctl === "han" ? "#a33a2a" : "#5d4037",
          hatch: false,
        };
      }
      const diff = (rel.han_influence || 0) - (rel.xn_intimidation || 0);
      if (diff >= 20) return { fill: "rgba(184, 58, 42, 0.34)", stroke: "#a33a2a", hatch: false };
      if (diff <= -20) return { fill: "rgba(93, 64, 55, 0.34)", stroke: "#5d4037", hatch: true };
      return { fill: "rgba(184, 130, 45, 0.28)", stroke: "#8a6524", hatch: true };
    }
    if (mode === "supply") {
      const g = n.grain || 0;
      const hasTuntian = (n.tuntian_lv || 0) > 0;
      if (hasTuntian) return { fill: "rgba(31, 111, 80, 0.36)", stroke: "#1f6f50", hatch: false };
      if (g >= 250000) return { fill: "rgba(62, 128, 95, 0.26)", stroke: "#2e6b4e", hatch: false };
      if (g < 100000) return { fill: "rgba(163, 58, 42, 0.24)", stroke: "#a33a2a", hatch: true };
      return { fill: "rgba(180, 140, 78, 0.20)", stroke: "#7a5e32", hatch: false };
    }
    if (mode === "intel") {
      if (n.has_beacon) return { fill: "rgba(26, 75, 140, 0.30)", stroke: "#1a4b8c", hatch: false };
      if (rel && rel.crimes > 0) return { fill: "rgba(163, 58, 42, 0.34)", stroke: "#a33a2a", hatch: true };
      return { fill: "rgba(110, 98, 83, 0.18)", stroke: "#6e6253", hatch: false };
    }
    if (mode === "military") {
      const troops = (n.armies || []).reduce((s, a) => s + (a.soldiers || 0), 0);
      if (n.under_siege_by) return { fill: "rgba(192, 32, 32, 0.38)", stroke: "#b01818", hatch: true };
      if (troops >= 4000) return { fill: ctl === "han" ? "rgba(176, 52, 38, 0.36)" : "rgba(93, 64, 55, 0.38)", stroke: "#1e1c1a", hatch: false };
      return { fill: "rgba(180, 155, 115, 0.18)", stroke: "#6e6253", hatch: false };
    }

    // 默认 political 视角
    const baseCol = getGodotNodeColor(nid, n);
    const contested = rel && Math.abs((rel.han_influence || 0) - (rel.xn_intimidation || 0)) <= 15;
    const isXnVassal = rel && rel.overlord === "xiongnu";
    return {
      fill: baseCol,
      fillOpacity: ctl === "han" || ctl === "xiongnu" ? 0.28 : 0.22,
      stroke: ctl === "han" ? "#8f2e20" : ctl === "xiongnu" ? "#4e3429" : "#4a3b28",
      hatch: !!(n.under_siege_by || contested || isXnVassal),
    };
  }

  // 为每个城邦/军镇生成古典平滑八边形疆域轮廓（裁剪相邻距离以防重叠）
  function buildTerritoryPolygon(nid, coords, allIds) {
    const c = coords[nid];
    if (!c) return "";
    const meta = MVP_NODE_META[nid] || {};
    if (meta.type === "junction" || meta.type === "pass") return "";
    const baseR = meta.type === "source" || meta.type === "nomad" ? 42 : 31;
    const pts = [];
    const M = 12;
    for (let k = 0; k < M; k++) {
      const ang = (k * Math.PI * 2) / M;
      const dirX = Math.cos(ang);
      const dirY = Math.sin(ang);
      let r = baseR * (k % 2 === 0 ? 1.0 : 0.92);
      for (const otherId of allIds) {
        if (otherId === nid) continue;
        const oMeta = MVP_NODE_META[otherId] || {};
        if (oMeta.type === "junction") continue;
        const o = coords[otherId];
        const dx = o.x - c.x;
        const dy = o.y - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1 || dist > baseR * 2.4) continue;
        const proj = (dx * dirX + dy * dirY) / dist;
        if (proj > 0.25) {
          const limit = (dist * 0.48) / proj;
          if (limit < r) r = Math.max(12, limit);
        }
      }
      pts.push(`${(c.x + dirX * r).toFixed(1)},${(c.y + dirY * r * 0.86).toFixed(1)}`);
    }
    return pts.join(" ");
  }

  function isTradeNodeOpen(st, nid) {
    const n = st.nodes[nid];
    if (!n) return false;
    const meta = MVP_NODE_META[nid] || {};
    if ((meta.faction === "xiongnu" || n.controller === "xiongnu") && !n.relation) return false;
    if (n.relation) {
      if (n.relation.embargo_han) return false;
      if (n.relation.overlord === "xiongnu" && (n.relation.xn_intimidation || 0) >= 60) return false;
    }
    return true;
  }

  const TERRAIN_NAMES = {
    road: "绿洲官道",
    steppe: "漠北草道",
    desert: "大碛流沙",
    mountain: "天山山道",
    hazard: "悬度险道",
  };

  function ownerLabel(n) {
    if (n.type === "junction") return "路口 · 无主";
    const rel = n.relation;
    if (rel) {
      if (rel.overlord === "han") return "汉内属国";
      if (rel.overlord === "xiongnu") return "匈奴属国";
      return rel.han_enfeoffed ? "受汉册封" : "独立城邦";
    }
    return n.controller === "han" ? "汉郡直辖" : n.controller === "xiongnu" ? "匈奴王庭" : "独立";
  }

  function applyMapCam() {
    const svg = document.getElementById("game-map-svg");
    if (svg) svg.setAttribute("viewBox", `${GAME.mapCam.x} ${GAME.mapCam.y} ${GAME.mapCam.w} ${GAME.mapCam.h}`);
    renderFrameBand();
  }

  const GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
  const ZHI = ["子", "丑", "寅", "卯", "辰", "巳"];
  const ROW_H = 620 / 6;
  function worldToViewport(wx, wy) {
    const vp = document.getElementById("map-viewport");
    const W = vp.clientWidth;
    const H = vp.clientHeight;
    const c = GAME.mapCam;
    const k = Math.min(W / c.w, H / c.h);
    const ox = (W - c.w * k) / 2;
    const oy = (H - c.h * k) / 2;
    return [ox + (wx - c.x) * k, oy + (wy - c.y) * k, k, W, H];
  }

  // 斑马纹经纬里数图廓（对标 IsraelMapCanvas._drawFrame）
  function renderFrameBand() {
    const svg = document.getElementById("map-frame-svg");
    const vp = document.getElementById("map-viewport");
    if (!svg || !vp) return;
    const desk = document.getElementById("map-desk");
    const DW = desk.clientWidth;
    const DH = desk.clientHeight;
    const IN = 6 + 2 + 22;
    const band0 = 8;
    const bandW = 21;
    const [, , , W, H] = worldToViewport(0, 0);
    const parts = [];

    // 内侧 4px 斑马纹交替刻度带 (Zebra Neatline)
    const zebraN = 36;
    const zStepX = (DW - band0 * 2 - bandW * 2) / zebraN;
    for (let k = 0; k < zebraN; k++) {
      const cls = k % 2 === 0 ? "fb-zebra-dark" : "fb-zebra-light";
      const zx = band0 + bandW + k * zStepX;
      parts.push(`<rect class="${cls}" x="${zx.toFixed(1)}" y="${band0 + bandW - 4}" width="${(zStepX + 0.4).toFixed(1)}" height="4"/>`);
      parts.push(`<rect class="${cls}" x="${zx.toFixed(1)}" y="${DH - band0 - bandW}" width="${(zStepX + 0.4).toFixed(1)}" height="4"/>`);
    }
    const zebraNY = 22;
    const zStepY = (DH - band0 * 2 - bandW * 2) / zebraNY;
    for (let k = 0; k < zebraNY; k++) {
      const cls = k % 2 === 0 ? "fb-zebra-dark" : "fb-zebra-light";
      const zy = band0 + bandW + k * zStepY;
      parts.push(`<rect class="${cls}" x="${band0 + bandW - 4}" y="${zy.toFixed(1)}" width="4" height="${(zStepY + 0.4).toFixed(1)}"/>`);
      parts.push(`<rect class="${cls}" x="${DW - band0 - bandW}" y="${zy.toFixed(1)}" width="4" height="${(zStepY + 0.4).toFixed(1)}"/>`);
    }

    // 横向：天干 + 西去长安里数
    for (let i = 0; i <= 10; i++) {
      const [x] = worldToViewport(i * 100, 0);
      if (x >= -1 && x <= W + 1) {
        const X = IN + x;
        parts.push(`<line class="fb-tick" x1="${X}" y1="${band0}" x2="${X}" y2="${band0 + bandW}"/><line class="fb-tick" x1="${X}" y1="${DH - band0 - bandW}" x2="${X}" y2="${DH - band0}"/>`);
      }
      if (i < 10) {
        const [cx] = worldToViewport(i * 100 + 50, 0);
        if (cx > 12 && cx < W - 12) {
          const X = IN + cx;
          const li = (9 - i) * 1200;
          parts.push(`<text class="fb-label" x="${X}" y="${band0 + bandW / 2 - 1}">${GAN[i]}</text><text class="fb-li-label" x="${X + 18}" y="${band0 + bandW / 2 - 1}">${li > 0 ? `西${li}里` : "京畿"}</text>`);
          parts.push(`<text class="fb-label" x="${X}" y="${DH - band0 - bandW / 2 + 1}">${GAN[i]}</text>`);
        }
      }
    }
    // 纵向：地支
    for (let j = 0; j <= 6; j++) {
      const [, y] = worldToViewport(0, j * ROW_H);
      if (y >= -1 && y <= H + 1) {
        const Y = IN + y;
        parts.push(`<line class="fb-tick" x1="${band0}" y1="${Y}" x2="${band0 + bandW}" y2="${Y}"/><line class="fb-tick" x1="${DW - band0 - bandW}" y1="${Y}" x2="${DW - band0}" y2="${Y}"/>`);
      }
      if (j < 6) {
        const [, cy] = worldToViewport(0, j * ROW_H + ROW_H / 2);
        if (cy > 10 && cy < H - 10) {
          const Y = IN + cy;
          parts.push(`<text class="fb-label" x="${band0 + bandW / 2 - 1}" y="${Y}">${ZHI[j]}</text><text class="fb-label" x="${DW - band0 - bandW / 2 + 1}" y="${Y}">${ZHI[j]}</text>`);
        }
      }
    }
    // 四角朱砂印记方块
    [[band0, band0], [DW - band0 - bandW, band0], [band0, DH - band0 - bandW], [DW - band0 - bandW, DH - band0 - bandW]].forEach(([x, y]) => {
      parts.push(`<rect class="fb-corner" x="${x + 0.5}" y="${y + 0.5}" width="${bandW - 1}" height="${bandW - 1}"/><rect class="fb-cell" x="${x + 5}" y="${y + 5}" width="${bandW - 10}" height="${bandW - 10}"/>`);
    });
    svg.setAttribute("viewBox", `0 0 ${DW} ${DH}`);
    svg.innerHTML = parts.join("");
  }

  function showMapTooltip(html, ev) {
    const tip = document.getElementById("godot-route-tooltip");
    const vp = document.getElementById("map-viewport");
    if (!tip || !vp) return;
    tip.innerHTML = html;
    tip.style.display = "block";
    if (ev) moveMapTooltip(ev);
  }

  function moveMapTooltip(ev) {
    const tip = document.getElementById("godot-route-tooltip");
    const vp = document.getElementById("map-viewport");
    if (!tip || !vp) return;
    const rect = vp.getBoundingClientRect();
    const scale = GAME.stageScale || 1;
    let x = (ev.clientX - rect.left) / scale + 14;
    let y = (ev.clientY - rect.top) / scale + 14;
    const w = tip.offsetWidth || 240;
    const h = tip.offsetHeight || 65;
    const maxW = rect.width / scale;
    const maxH = rect.height / scale;
    if (x + w > maxW - 8) x = (ev.clientX - rect.left) / scale - w - 14;
    if (y + h > maxH - 8) y = (ev.clientY - rect.top) / scale - h - 14;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }

  function hideMapTooltip() {
    const tip = document.getElementById("godot-route-tooltip");
    if (tip) tip.style.display = "none";
  }

  // 紧凑型古制军旗标牌（不遮挡相邻城名）
  function armyFlagSvg(x, anchorY, faction, cnt, nArmies, isConvoy, moving) {
    const posY = Math.max(18, anchorY - 17);
    const baseCol = faction === "han" ? "#a33a2a" : "#5d4037";
    const boxCol = isConvoy ? (faction === "han" ? "#b9844f" : "#9f8853") : baseCol;
    const txt = cnt >= 10000 ? `${(cnt / 10000).toFixed(1)}万` : cnt >= 1000 ? `${(cnt / 1000).toFixed(cnt % 1000 === 0 ? 0 : 1)}千` : `${cnt}`;
    const tag = faction === "han" ? (isConvoy ? "漕" : "汉") : "匈";
    return `
      <line x1="${x}" y1="${anchorY}" x2="${x}" y2="${posY + 7}" stroke="#2b2119" stroke-width="1"/>
      <circle cx="${x}" cy="${anchorY}" r="2.2" fill="${baseCol}" stroke="#fff3d0" stroke-width="0.6"/>
      <rect x="${x - 15}" y="${posY - 8}" width="30" height="15" rx="2" fill="${boxCol}" stroke="${moving ? "#ffe680" : "#f6efe0"}" stroke-width="${moving ? 1.3 : 0.9}" filter="url(#flagShadow)"/>
      <rect x="${x - 15}" y="${posY - 8}" width="9.5" height="15" rx="1" fill="rgba(0,0,0,0.22)"/>
      <text x="${x - 10.2}" y="${posY + 2.5}" fill="#f6efe0" font-size="8" font-weight="700" text-anchor="middle" style="font-family:var(--font-title)">${tag}</text>
      <text x="${x + 4.5}" y="${posY + 2.5}" fill="#fffaf0" font-size="8" font-weight="700" text-anchor="middle" style="font-family:var(--font-mono)">${txt}</text>
      ${nArmies > 1 ? `<circle cx="${x + 15}" cy="${posY - 8}" r="4.8" fill="#f5e7c3" stroke="${baseCol}" stroke-width="1"/><text x="${x + 15}" y="${posY - 5.4}" font-size="7" font-weight="700" fill="${baseCol}" text-anchor="middle">${nArmies}</text>` : ""}
    `;
  }

  function renderStrategicMap() {
    const st = GAME.state;
    const svg = document.getElementById("game-map-svg");
    const mapPres = BUNDLE.map_presentation || {};
    const posMap = mapPres.positions || {};
    const waypoints = mapPres.waypoints || {};
    const regions = mapPres.regions || [];
    const routes = (BUNDLE.scenario_mvp && BUNDLE.scenario_mvp.routes) || [];
    const tradeRoutes = (BUNDLE.scenario_mvp && BUNDLE.scenario_mvp.trade_routes) || [];

    applyMapCam();

    const coords = {};
    const nodeIds = Object.keys(st.nodes);
    nodeIds.forEach((nid) => {
      const p = posMap[nid] || (MVP_NODE_META[nid] && MVP_NODE_META[nid].pos) || [500, 310];
      coords[nid] = { x: p[0], y: p[1] };
    });

    const routeByPair = {};
    const routeCurveD = [];
    const routePtsList = [];
    routes.forEach((r, idx) => {
      const a = r.a || r.from;
      const b = r.b || r.to;
      routeByPair[`${a}|${b}`] = idx;
      routeByPair[`${b}|${a}`] = idx;
      const pts = buildGodotRoutePoints(r, posMap, waypoints);
      routePtsList.push(pts);
      routeCurveD.push(buildGodotBezierPath(pts));
    });

    const parts = [];

    parts.push(`
      <defs>
        <filter id="flagShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.1" flood-color="#1e1c1a" flood-opacity="0.42"/>
        </filter>
        <filter id="labelShadow" x="-10%" y="-30%" width="120%" height="160%">
          <feDropShadow dx="0" dy="0.8" stdDeviation="0.7" flood-color="#2a1d10" flood-opacity="0.28"/>
        </filter>
        <linearGradient id="fadeX" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#000"/><stop offset="0.03" stop-color="#fff"/><stop offset="0.97" stop-color="#fff"/><stop offset="1" stop-color="#000"/>
        </linearGradient>
        <linearGradient id="fadeY" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#000"/><stop offset="0.04" stop-color="#fff"/><stop offset="0.96" stop-color="#fff"/><stop offset="1" stop-color="#000"/>
        </linearGradient>
        <mask id="atlasFadeY" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="620">
          <rect x="0" y="0" width="1000" height="620" fill="url(#fadeY)"/>
        </mask>
        <mask id="atlasFade" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="620">
          <rect x="0" y="0" width="1000" height="620" fill="url(#fadeX)" mask="url(#atlasFadeY)"/>
        </mask>
        <pattern id="paperHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(75,55,28,0.08)" stroke-width="0.7"/>
        </pattern>
        <pattern id="map-hachure" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(30, 28, 26, 0.34)" stroke-width="1.3"/>
        </pattern>
      </defs>
      <rect x="-1200" y="-900" width="3400" height="2420" fill="#e5d7bb"/>
      <rect x="-1200" y="-900" width="3400" height="2420" fill="url(#paperHatch)"/>
      <image href="assets/art/western-regions-atlas-v2.png" x="0" y="0" width="1000" height="620" opacity="0.62" preserveAspectRatio="none" mask="url(#atlasFade)"/>
      <rect x="0" y="0" width="1000" height="620" fill="rgba(244, 234, 208, 0.42)" mask="url(#atlasFade)"/>
    `);

    // 1. 政区疆域多边形与斜纹层（对标 IsraelMapCanvas 区域多边形 + #map-hachure）
    if (GAME.layers.zone) {
      parts.push(`<g class="map-territories">`);
      for (const nid of nodeIds) {
        const n = st.nodes[nid];
        const polyPts = buildTerritoryPolygon(nid, coords, nodeIds);
        if (!polyPts) continue;
        const stStyle = getTerritoryStyle(nid, n);
        const fOp = stStyle.fillOpacity !== undefined ? stStyle.fillOpacity : 1.0;
        parts.push(
          `<polygon class="map-poly" data-poly-nid="${nid}" points="${polyPts}" fill="${stStyle.fill}" fill-opacity="${fOp}" stroke="${stStyle.stroke}" stroke-width="1.1" stroke-dasharray="3,2" stroke-linejoin="round"/>`
        );
        if (stStyle.hatch) {
          parts.push(`<polygon points="${polyPts}" fill="url(#map-hachure)" stroke="none" pointer-events="none"/>`);
        }
      }
      parts.push(`</g>`);
    }

    // 2. 古典水系层（大泽水纹 + 河流 + 水名斜体标注，对标 IsraelMapCanvas 水系）
    if (GAME.layers.grid) {
      parts.push(`<g class="map-hydrography" pointer-events="none">`);
      for (const rv of HYDRO_RIVERS) {
        parts.push(`<path d="${rv.d}" fill="none" stroke="rgba(246, 239, 224, 0.7)" stroke-width="2.6" stroke-linecap="round"/>`);
        parts.push(`<path d="${rv.d}" fill="none" stroke="#42687c" stroke-width="1.25" stroke-dasharray="6,1.5" stroke-linecap="round"/>`);
        parts.push(
          `<text x="${rv.lx}" y="${rv.ly}" font-family="var(--font-title)" font-size="9.5" font-style="italic" fill="#325568" stroke="rgba(246,239,224,0.88)" stroke-width="2.4" paint-order="stroke" text-anchor="middle">${rv.name}</text>`
        );
      }
      for (const lk of HYDRO_LAKES) {
        const tr = ` rotate(${lk.rot} ${lk.cx} ${lk.cy})`;
        parts.push(`<ellipse cx="${lk.cx}" cy="${lk.cy}" rx="${lk.rx}" ry="${lk.ry}" transform="${tr}" fill="#b7cbd2" fill-opacity="0.78" stroke="#36586a" stroke-width="1.1"/>`);
        parts.push(`<ellipse cx="${lk.cx}" cy="${lk.cy}" rx="${(lk.rx * 0.72).toFixed(1)}" ry="${(lk.ry * 0.68).toFixed(1)}" transform="${tr}" fill="none" stroke="#36586a" stroke-width="0.55" stroke-opacity="0.55"/>`);
        parts.push(`<ellipse cx="${lk.cx}" cy="${lk.cy}" rx="${(lk.rx * 0.42).toFixed(1)}" ry="${(lk.ry * 0.4).toFixed(1)}" transform="${tr}" fill="none" stroke="#36586a" stroke-width="0.45" stroke-opacity="0.38"/>`);
        parts.push(
          `<text x="${lk.cx}" y="${lk.cy + lk.ry + 9}" font-family="var(--font-title)" font-size="9.5" font-style="italic" fill="#2c4e60" stroke="rgba(246,239,224,0.9)" stroke-width="2.4" paint-order="stroke" text-anchor="middle">${lk.name}</text>`
        );
      }
      parts.push(`</g>`);
    }

    // 3. 计里画方干支经纬网
    if (GAME.layers.grid) {
      const g = [];
      for (let i = 1; i < 10; i++) g.push(`M${i * 100} 0V620`);
      for (let j = 1; j < 6; j++) g.push(`M0 ${(j * ROW_H).toFixed(1)}H1000`);
      parts.push(`<path d="${g.join("")}" fill="none" stroke="rgba(30,28,26,0.13)" stroke-width="0.75" stroke-dasharray="2 3" pointer-events="none"/>`);
    }

    // 4. 地理大区水印（layout.regions，宣纸描边防撞字）
    parts.push(`<g pointer-events="none">`);
    for (const reg of regions) {
      parts.push(
        `<text x="${reg[1][0]}" y="${reg[1][1]}" font-family="var(--font-title)" font-size="19" font-weight="700" letter-spacing="6" fill="rgba(68, 54, 34, 0.52)" stroke="rgba(246, 239, 224, 0.72)" stroke-width="3.2" paint-order="stroke">${reg[0]}</text>`
      );
    }
    parts.push(`</g>`);

    // 5. 商路金色高亮
    if (GAME.layers.trade) {
      for (const tr of tradeRoutes) {
        const openPrefix = [];
        for (const nid of tr.nodes || []) {
          if (isTradeNodeOpen(st, nid)) openPrefix.push(nid);
          else break;
        }
        for (let i = 1; i < openPrefix.length; i++) {
          const rIdx = routeByPair[`${openPrefix[i - 1]}|${openPrefix[i]}`];
          if (rIdx !== undefined && routeCurveD[rIdx]) {
            parts.push(`<path d="${routeCurveD[rIdx]}" fill="none" stroke="rgba(226, 172, 56, 0.82)" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>`);
          }
        }
      }
    }

    // 6. 古道（对齐 Godot `_road` 配色）
    const isWinter = st.meta.season === "winter";
    routes.forEach((r, idx) => {
      const d = routeCurveD[idx];
      if (!d) return;
      let col = "#6b4f2a";
      let dashed = false;
      if (r.terrain === "steppe") col = "#4e7c3e";
      else if (r.terrain === "desert") (col = "#a87628"), (dashed = true);
      else if (r.terrain === "mountain") (col = "#686868"), (dashed = true);
      else if (r.terrain === "hazard") (col = "#a33a2a"), (dashed = true);
      if (r.closed_in_winter && isWinter) col = "#a5a096";
      if (r.raided_by) col = "#d02020";

      if (dashed) {
        parts.push(`<path d="${d}" fill="none" stroke="rgba(250, 242, 222, 0.65)" stroke-width="3.0" stroke-linecap="round" pointer-events="none"/>`);
        parts.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="1.65" stroke-dasharray="7, 4" stroke-linecap="round" pointer-events="none"/>`);
      } else {
        parts.push(`<path d="${d}" fill="none" stroke="rgba(250, 242, 222, 0.88)" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>`);
        parts.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>`);
      }
      parts.push(`<path d="${d}" class="godot-route-hit" data-ridx="${idx}" fill="none" stroke="transparent" stroke-width="12" style="cursor:help;"/>`);
    });

    parts.push(
      `<path id="godot-route-hover-outer" d="" fill="none" stroke="#f5e7aa" stroke-width="5.5" stroke-linecap="round" pointer-events="none" style="display:none;"/>`,
      `<path id="godot-route-hover-inner" d="" fill="none" stroke="#704921" stroke-width="2.5" stroke-linecap="round" pointer-events="none" style="display:none;"/>`
    );

    // 7. 自动补给线
    if ((GAME.layers.supply || GAME.mapMode === "supply") && st.v1 && st.v1.logistics.supply_lines) {
      for (const rawSl of st.v1.logistics.supply_lines) {
        const sl = typeof rawSl === "string" ? { from: "jiu_quan", to: rawSl, status: "active" } : rawSl;
        const a = coords[sl.from];
        const b = coords[sl.to];
        if (!a || !b) continue;
        const col = sl.status === "active" ? "#1f6f50" : sl.status === "throttled" ? "#b87314" : "#a33a2a";
        const rIdx = routeByPair[`${sl.from}|${sl.to}`];
        const pathStr = rIdx !== undefined && routeCurveD[rIdx] ? routeCurveD[rIdx] : `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
        parts.push(`
          <path d="${pathStr}" fill="none" stroke="rgba(250,242,222,0.85)" stroke-width="5.6" stroke-linecap="round" pointer-events="none"/>
          <path d="${pathStr}" fill="none" stroke="${col}" stroke-width="3.2" stroke-linecap="round" class="supply-line-anim" pointer-events="none"/>
        `);
      }
    }

    // 8. 敌军 30/60/90 日威胁圈
    if (GAME.layers.threat || GAME.mapMode === "military") {
      const oppFaction = st.meta.side === "han" ? "xiongnu" : "han";
      for (const nid of nodeIds) {
        const n = st.nodes[nid];
        const hasOppArmy = (n.armies && n.armies.some((a) => a.faction === oppFaction && a.soldiers >= 1500)) || nid === "chanyu_ting" || nid === "cheshi_qian";
        if (hasOppArmy && n.controller === oppFaction) {
          const c = coords[nid];
          parts.push(`
            <circle cx="${c.x}" cy="${c.y}" r="44" fill="rgba(163, 58, 42, 0.09)" stroke="#a33a2a" stroke-width="1.1" pointer-events="none"/>
            <circle cx="${c.x}" cy="${c.y}" r="76" fill="none" stroke="#b87314" stroke-width="0.9" stroke-dasharray="5,4" pointer-events="none"/>
            <circle cx="${c.x}" cy="${c.y}" r="110" fill="none" stroke="#6b4f2a" stroke-width="0.75" stroke-dasharray="2,4" pointer-events="none"/>
          `);
        }
      }
    }

    // 9. 节点：圆盘 + 图标 + 绢本铭牌
    const badge = (x, y, ch, fill) =>
      `<g pointer-events="none"><circle cx="${x}" cy="${y}" r="5.8" fill="${fill}" stroke="#fff3d0" stroke-width="0.85"/><text x="${x}" y="${y + 2.7}" font-size="7.4" font-weight="700" fill="#fffaf0" text-anchor="middle">${ch}</text></g>`;

    for (const nid of nodeIds) {
      const n = st.nodes[nid];
      const meta = MVP_NODE_META[nid] || {};
      const c = coords[nid];
      const isSel = nid === GAME.selectedNodeId;
      const nodeType = meta.type || n.type || "city";
      let rad = 8.6;
      if (nodeType === "source") rad = 11.4;
      else if (nodeType === "pass") rad = 5.8;
      else if (nodeType === "junction") rad = 3.8;
      else if (nodeType === "nomad") rad = 9.6;

      const fillCol = getGodotNodeColor(nid, n);
      const iconHref = nodeType === "nomad" ? "assets/icons/nomad.svg" : "assets/icons/city.svg";
      const label = n.name || meta.name || nid;
      const fs = nodeType === "junction" ? 9.5 : 11.5;
      const boxW = label.length * (fs + 0.4) + 11;
      const boxH = 16;
      const boxX = c.x - boxW / 2;
      const boxY = c.y + rad + 2.5;

      parts.push(`
        <g class="map-node-g" data-nid="${nid}">
          ${isSel ? `<circle cx="${c.x}" cy="${c.y}" r="${rad + 4}" fill="none" stroke="#a33a2a" stroke-width="2" class="sel-pulse" style="--r0:${rad + 4}px;--r1:${rad + 16}px"/>` : ""}
          ${n.under_siege_by ? `<circle cx="${c.x}" cy="${c.y}" r="${rad + 5.5}" fill="none" stroke="#d02020" stroke-width="2.8"/>` : ""}
          ${isSel ? `<circle cx="${c.x}" cy="${c.y}" r="${rad + 3.5}" fill="none" stroke="#fffaf0" stroke-width="2.6"/>` : ""}
          <g class="node-disc">
            <circle cx="${c.x}" cy="${c.y + 1.8}" r="${rad + 1.8}" fill="rgba(30, 28, 26, 0.28)"/>
            <circle cx="${c.x}" cy="${c.y}" r="${rad + 1.4}" fill="#f2deb2"/>
            <circle cx="${c.x}" cy="${c.y}" r="${rad}" fill="${fillCol}" stroke="#1e1c1a" stroke-width="1.4"/>
            ${nodeType !== "pass" && nodeType !== "junction" ? `<image href="${iconHref}" x="${c.x - 5.5}" y="${c.y - 5.5}" width="11" height="11" pointer-events="none"/>` : ""}
          </g>
          <rect class="node-label-box" x="${boxX.toFixed(1)}" y="${boxY.toFixed(1)}" width="${boxW.toFixed(1)}" height="${boxH}" rx="2"
            fill="${isSel ? "rgba(252, 246, 232, 0.98)" : "rgba(246, 237, 214, 0.90)"}" stroke="${isSel ? "#a33a2a" : "rgba(30, 28, 26, 0.42)"}" stroke-width="${isSel ? 1.4 : 0.75}" filter="url(#labelShadow)"/>
          <text x="${c.x}" y="${(boxY + 12.1).toFixed(1)}" fill="#1e1c1a" font-size="${fs}" font-weight="${isSel ? 900 : 700}" text-anchor="middle" pointer-events="none">${label}</text>
          ${n.has_beacon && (GAME.layers.fog || GAME.mapMode === "intel") ? badge(c.x - rad - 3, c.y - rad + 1, "燧", "#1a4b8c") : ""}
          ${n.tuntian_lv > 0 ? badge(c.x + rad + 3, c.y - rad + 1, "屯", "#1f6f50") : ""}
          ${n.relation && n.relation.crimes > 0 ? badge(c.x + rad + 3, c.y + rad - 2, "罪", "#a33a2a") : ""}
        </g>
      `);
    }

    // 10. 紧凑型古制军旗标牌
    if (GAME.layers.tokens) {
      for (const nid of nodeIds) {
        const n = st.nodes[nid];
        if (!n.armies || n.armies.length === 0) continue;
        const p = coords[nid];
        const groups = {};
        for (const a of n.armies) {
          const cnt = (a.soldiers || 0) + (a.is_convoy ? a.laborers || 0 : 0);
          if (cnt <= 0) continue;
          const key = `${a.faction}|${a.is_convoy ? 1 : 0}`;
          if (!groups[key]) groups[key] = { faction: a.faction, convoy: !!a.is_convoy, cnt: 0, n: 0 };
          groups[key].cnt += cnt;
          groups[key].n += 1;
        }
        Object.values(groups).forEach((g, k) => {
          const ax = Math.min(980, p.x + 17 + k * 32);
          parts.push(`<g class="godot-army-marker" data-nid="${nid}" style="cursor:pointer;">${armyFlagSvg(ax, p.y - 3, g.faction, g.cnt, g.n, g.convoy, false)}</g>`);
        });
      }

      for (const ma of st.moving_armies || []) {
        const rIdx = routeByPair[`${ma.from}|${ma.to}`];
        let ax = 500;
        let ay = 310;
        if (rIdx !== undefined && routePtsList[rIdx]) {
          const r = routes[rIdx];
          const prog = (r.a || r.from) === ma.from ? ma.progress || 0.5 : 1.0 - (ma.progress || 0.5);
          const pt = sampleGodotRoutePoint(routePtsList[rIdx], prog);
          ax = pt[0];
          ay = pt[1];
        } else if (coords[ma.from] && coords[ma.to]) {
          ax = (coords[ma.from].x + coords[ma.to].x) * 0.5;
          ay = (coords[ma.from].y + coords[ma.to].y) * 0.5;
        }
        parts.push(`<g pointer-events="none">${armyFlagSvg(ax, ay, ma.faction, ma.soldiers || 0, 1, !!ma.is_convoy, true)}</g>`);
      }
    }

    svg.innerHTML = parts.join("");

    // 交互绑定：节点 / 军旗 / 政区多边形
    svg.querySelectorAll(".map-node-g, .godot-army-marker, .map-poly").forEach((g) => {
      const nid = g.getAttribute("data-nid") || g.getAttribute("data-poly-nid");
      g.addEventListener("click", (e) => {
        e.stopPropagation();
        if (GAME.mapCam.moved) return;
        GAME.inspectorCardClosed = false;
        selectNodeAndPan(nid);
      });
      if (!g.classList.contains("map-poly")) {
        g.addEventListener("mouseenter", (ev) => {
          const n = st.nodes[nid];
          if (!n) return;
          const rel = n.relation;
          const troops = (n.armies || []).reduce((s, a) => s + (a.soldiers || 0), 0);
          let html = `<div class="tt-title">${n.name} · ${ownerLabel(n)}</div><div>人口 ${(n.pop || 0).toLocaleString()} · 储粮 ${((n.grain || 0) / 1000).toFixed(0)}k 石 · 城防 Lv.${n.walls || 1}</div>`;
          if (rel) html += `<div class="tt-muted">汉影响 ${rel.han_influence.toFixed(0)} · 匈威吓 ${rel.xn_intimidation.toFixed(0)} · 对匈怨恨 ${rel.xn_resentment.toFixed(0)}${rel.forage ? ` · ${rel.forage.label}` : ""}</div>`;
          if (troops > 0) html += `<div class="tt-muted">野战驻军 ${troops.toLocaleString()} 人（点击城邑查看速览卡）</div>`;
          showMapTooltip(html, ev);
        });
        g.addEventListener("mousemove", moveMapTooltip);
        g.addEventListener("mouseleave", hideMapTooltip);
      }
    });

    // 古道悬停：显示里程、地形、天数与《汉书》考据方法
    const hoverOuter = document.getElementById("godot-route-hover-outer");
    const hoverInner = document.getElementById("godot-route-hover-inner");
    svg.querySelectorAll(".godot-route-hit").forEach((hitPath) => {
      hitPath.addEventListener("mouseenter", (ev) => {
        const rIdx = parseInt(hitPath.getAttribute("data-ridx"), 10);
        const r = routes[rIdx];
        const d = routeCurveD[rIdx];
        if (!r || !d) return;
        hoverOuter.setAttribute("d", d);
        hoverInner.setAttribute("d", d);
        hoverOuter.style.display = "";
        hoverInner.style.display = "";
        const aId = r.a || r.from;
        const bId = r.b || r.to;
        const nm = (id) => (st.nodes[id] && st.nodes[id].name) || (MVP_NODE_META[id] && MVP_NODE_META[id].name) || id;
        const km = r.distance_km ? `${Math.round(r.distance_km)} 公里 (约 ${Math.round(r.distance_km * 2.4)} 里)` : `约 ${Math.round(r.days * 22)} 公里`;
        let html = `<div class="tt-title">${nm(aId)} — ${nm(bId)}</div><div>${km} · ${TERRAIN_NAMES[r.terrain] || r.terrain} · 步兵约 ${Math.ceil(r.days)} 日</div>`;
        html += `<div class="tt-muted">行军倍率 ×${(r.time_mult || 1.0).toFixed(1)} · 粮耗倍率 ×${(r.attrition_mult || 1.0).toFixed(1)}</div>`;
        if (r.closed_in_winter) html += `<div class="tt-muted" style="color:var(--amber)">冬季大雪封山，无法通行</div>`;
        if (r.raided_by) html += `<div style="color:var(--han-light)">已遭游骑劫掠，商路中断</div>`;
        showMapTooltip(html, ev);
      });
      hitPath.addEventListener("mousemove", moveMapTooltip);
      hitPath.addEventListener("mouseleave", () => {
        hoverOuter.style.display = "none";
        hoverInner.style.display = "none";
        hideMapTooltip();
      });
    });
  }

  function selectNodeAndPan(nid, panelName, open) {
    GAME.selectedNodeId = nid;
    GAME.planDraft.target = nid;
    if (panelName && (open || GAME.drawerOpen)) {
      GAME.activePanel = panelName;
      GAME.drawerOpen = true;
    }
    renderStrategicMap();
    renderMapInspectorCard();
    renderFoodCurveDrawer();
    if (GAME.drawerOpen && ["inspector", "military", "diplomacy", "logistics"].includes(GAME.activePanel)) renderActiveDockPanel();
    syncDrawerUI();
    renderOutliner();
    if (open) focusNode(nid);
  }

  function focusNode(nid) {
    const p = (BUNDLE.map_presentation.positions || {})[nid];
    if (!p) return;
    const [x, y, , W, H] = worldToViewport(p[0], p[1]);
    const left = GAME.drawerOpen ? 980 : 60;
    if (x > left && x < W - 60 && y > 60 && y < H - 60) return;
    const c = GAME.mapCam;
    const k = Math.min(W / c.w, H / c.h);
    const targetX = GAME.drawerOpen ? (980 + W) / 2 : W / 2;
    c.x += (x - targetX) / k;
    c.y += (y - H / 2) / k;
    applyMapCam();
  }


  // ==================== 5. 底部 0–18旬粮食折线与「就食城仓」修正抽屉 ====================
  function renderFoodCurveDrawer() {
    const st = GAME.state;
    const targetNode = st.nodes[GAME.selectedNodeId] || st.nodes.lou_lan;
    const originNode = st.nodes[GAME.planDraft.origin] || st.nodes.dun_huang;

    const garBadge = document.getElementById("curve-garrison-badge");
    if (originNode && garBadge) {
      const garTroops = (originNode.armies || []).reduce((s, a) => s + (a.soldiers || 0), 0) || 5000;
      const monthsSupport = ((originNode.grain || 360000) / Math.max(100, garTroops * 3.0)).toFixed(1);
      garBadge.textContent = `${originNode.name}城仓可支 ${monthsSupport} 月`;
    }

    const soldiers = GAME.planDraft.soldiers || 5000;
    const laborers = GAME.planDraft.laborers || 2000;
    const standing = GAME.planDraft.standingOrder || "cautious";
    const carryCap = soldiers * 3.0 + laborers * 15.0;
    const eatPerTick = (soldiers * 1.0 + laborers * 0.8) * 0.9;

    const rel = targetNode && targetNode.relation;
    const forageTier = rel && rel.forage ? rel.forage.tier : targetNode && targetNode.controller === st.meta.side ? "WELCOME" : "HOSTILE";
    const forageGain = forageTier === "WELCOME" ? soldiers * 2.2 : forageTier === "MARKET" ? soldiers * 1.1 : 0;

    const oName = originNode ? originNode.name : "敦煌";
    const tName = targetNode ? targetNode.name : "楼兰";
    const titleEl = document.getElementById("curve-drawer-title");
    if (titleEl) {
      titleEl.innerHTML = `<b>远征粮秣预演</b>${oName} → ${tName} · ${soldiers.toLocaleString()} 兵 + ${laborers.toLocaleString()} 民夫`;
    }

    let g = carryCap;
    let pnrTick = -1;
    let starveTick = -1;
    const pts = [];
    for (let t = 0; t <= 18; t++) {
      pts.push({ t, g: Math.max(0, g) });
      const needReturn = Math.min(t, 6) * eatPerTick;
      if (pnrTick === -1 && g < needReturn) pnrTick = t;
      if (starveTick === -1 && g <= 0) starveTick = t;
      g -= eatPerTick;
      if (t === 5) g += forageGain;
      if (standing === "cautious" && g < eatPerTick * 2.5) {
        g = Math.max(eatPerTick * 1.5, g);
      }
    }

    const X0 = 34, X1 = 528, Y0 = 14, Y1 = 100;
    const xs = (t) => X0 + (t / 18) * (X1 - X0);
    const maxG = Math.max(1, carryCap * 1.1);
    const ys = (v) => Y1 - (v / maxG) * (Y1 - Y0);
    const starving = starveTick !== -1 && standing !== "cautious";
    const lineCol = starving ? "#a33a2a" : "#1f6f50";
    const polyPts = pts.map((p) => `${xs(p.t).toFixed(1)},${ys(p.g).toFixed(1)}`).join(" ");
    const areaPts = `${X0},${Y1} ${polyPts} ${X1},${Y1}`;

    const grid = [0.25, 0.5, 0.75, 1]
      .map((f) => {
        const y = ys((maxG * f) / 1.1);
        return `<line x1="${X0}" y1="${y.toFixed(1)}" x2="${X1}" y2="${y.toFixed(1)}" stroke="rgba(43,33,25,0.08)"/>
              <text x="${X0 - 5}" y="${(y + 3).toFixed(1)}" fill="#85745e" font-size="8.5" text-anchor="end">${((carryCap * f) / 1000).toFixed(0)}k</text>`;
      })
      .join("");

    const svgEl = document.getElementById("plan-food-curve-svg");
    if (svgEl) {
      svgEl.innerHTML = `
        <defs>
          <linearGradient id="foodArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${lineCol}" stop-opacity="0.32"/>
            <stop offset="100%" stop-color="${lineCol}" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        ${grid}
        <rect x="${xs(0)}" y="${Y0}" width="${xs(9) - xs(0)}" height="${Y1 - Y0}" fill="rgba(180,140,78,0.07)"/>
        <line x1="${X0}" y1="${Y1}" x2="${X1}" y2="${Y1}" stroke="#4e4033" stroke-width="1"/>
        <text x="${xs(0)}" y="116" fill="#85745e" font-size="9" text-anchor="start">出发</text>
        <text x="${xs(5)}" y="116" fill="#1f6f50" font-size="9" text-anchor="middle">第5旬 抵${tName}</text>
        <text x="${xs(9)}" y="116" fill="#8a6524" font-size="9" text-anchor="middle">本季末</text>
        <text x="${X1}" y="116" fill="#85745e" font-size="9" text-anchor="end">第18旬</text>
        ${
          pnrTick !== -1
            ? `<line x1="${xs(pnrTick)}" y1="${Y0 - 4}" x2="${xs(pnrTick)}" y2="${Y1}" stroke="#b9822d" stroke-dasharray="3,3" stroke-width="1.2"/>
          <rect x="${xs(pnrTick) - 30}" y="0" width="60" height="13" rx="6.5" fill="rgba(185,130,45,0.14)" stroke="#b9822d" stroke-width="0.8"/>
          <text x="${xs(pnrTick)}" y="9.5" fill="#7a5414" font-size="8.8" text-anchor="middle">不归点 · 第${pnrTick}旬</text>`
            : ""
        }
        ${
          starving
            ? `<line x1="${xs(starveTick)}" y1="${Y0}" x2="${xs(starveTick)}" y2="${Y1}" stroke="#a33a2a" stroke-width="1.6"/>
          <text x="${xs(starveTick) + 4}" y="${Y0 + 10}" fill="#a33a2a" font-size="9" font-weight="700">第${starveTick}旬断粮</text>`
            : ""
        }
        <polygon points="${areaPts}" fill="url(#foodArea)"/>
        <polyline fill="none" stroke="${lineCol}" stroke-width="2" stroke-linejoin="round" points="${polyPts}"/>
        ${pts
          .filter((p) => p.t % 3 === 0)
          .map((p) => `<circle cx="${xs(p.t).toFixed(1)}" cy="${ys(p.g).toFixed(1)}" r="2.4" fill="#fbf7ee" stroke="${lineCol}" stroke-width="1.4"/>`)
          .join("")}
      `;
    }

    const metaEl = document.getElementById("plan-food-curve-meta");
    if (metaEl) {
      metaEl.innerHTML = `
        <div class="curve-stats">
          <div class="curve-stat"><div class="k">随军粮</div><div class="v">${(carryCap / 1000).toFixed(1)}k <small style="color:var(--text-faint);font-weight:400">石</small></div></div>
          <div class="curve-stat"><div class="k">每旬消耗</div><div class="v">${(eatPerTick / 1000).toFixed(1)}k <small style="color:var(--text-faint);font-weight:400">石</small></div></div>
          <div class="curve-stat"><div class="k">${tName}供粮</div><div class="v" style="font-size:12.5px;color:${rel && rel.forage ? tone(rel.forage.color) : "var(--green-light)"}">${rel && rel.forage ? rel.forage.label.split(/[（(]/)[0] : "己方粮仓"}</div></div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <select id="sel-drawer-standing" style="flex:1;">
            <option value="cautious" ${standing === "cautious" ? "selected" : ""}>谨慎保军 · 粮尽前自动班师</option>
            <option value="standard" ${standing === "standard" ? "selected" : ""}>均衡推进 · 常规围城</option>
            <option value="aggressive" ${standing === "aggressive" ? "selected" : ""}>见利则进 · 强攻到底</option>
          </select>
          <button class="btn btn-han" id="btn-drawer-launch-campaign">远征${tName}</button>
        </div>
      `;

      document.getElementById("sel-drawer-standing").addEventListener("change", (e) => {
        GAME.planDraft.standingOrder = e.target.value;
        renderFoodCurveDrawer();
      });
      document.getElementById("btn-drawer-launch-campaign").addEventListener("click", () => {
        if (!targetNode) return;
        queueCustomOrder({
          type: "set_plan",
          desc: `【远征军令】自${originNode ? originNode.name : "帅帐"}发兵 ${soldiers.toLocaleString()} 进击【${targetNode.name}】(常备指令：${standing === "cautious" ? "谨慎保军" : standing === "aggressive" ? "见利则进" : "均衡推进"})`,
          cost_money: 180,
          target_node: targetNode.id,
          raw: {
            origin: originNode ? originNode.id : "dun_huang",
            target: targetNode.id,
            soldiers,
            standing_order: standing,
          },
        });
      });
    }
  }

  // ==================== 6. 案上器物 → 高密度卷宗抽屉 ====================
  function switchDockPanel(panelName) {
    openDrawer(panelName);
  }

  function openDrawer(panelName) {
    if (!DRAWERS[panelName]) return;
    GAME.activePanel = panelName;
    GAME.drawerOpen = true;
    renderActiveDockPanel();
    syncDrawerUI();
    renderMapInspectorCard();
    const scroller = document.querySelector("#drawer .drawer-scroll");
    if (scroller) scroller.scrollTop = 0;
  }

  function closeDrawer() {
    GAME.drawerOpen = false;
    syncDrawerUI();
    renderMapInspectorCard();
  }

  function toggleDrawer(panelName) {
    if (GAME.drawerOpen && GAME.activePanel === panelName) closeDrawer();
    else openDrawer(panelName);
  }

  function syncDrawerUI() {
    const drawer = document.getElementById("drawer");
    if (!drawer) return;
    const side = GAME.state ? GAME.state.meta.side : "han";
    const base = DRAWERS[GAME.activePanel] || DRAWERS.inspector;
    const meta = side === "xiongnu" && base.xn ? { ...base, ...base.xn } : base;
    drawer.classList.toggle("open", GAME.drawerOpen);
    drawer.setAttribute("aria-hidden", GAME.drawerOpen ? "false" : "true");
    document.getElementById("drawer-seal").textContent = meta.seal;
    document.getElementById("drawer-title").textContent = meta.title;
    document.getElementById("drawer-sub").textContent = meta.sub;
    document.getElementById("drawer-key").textContent = `${meta.key} · Esc 收起`;
    document.querySelectorAll(".desk-prop[data-panel]").forEach((b) => {
      b.classList.toggle("open", GAME.drawerOpen && b.getAttribute("data-panel") === GAME.activePanel);
    });
    document.querySelectorAll("#drawer-tabs .drawer-tab").forEach((t) => {
      t.classList.toggle("active", t.getAttribute("data-drawer-tab") === GAME.activePanel);
    });
    const curve = document.getElementById("plan-curve-drawer");
    if (curve) curve.classList.toggle("show", GAME.activePanel === "military");
    updateSpotlight();
  }

  function cycleReplaySpeed() {
    const sel = document.getElementById("sel-replay-speed");
    const i = SPEED_STEPS.findIndex((x) => x.v === sel.value);
    const next = SPEED_STEPS[(i + 1) % SPEED_STEPS.length];
    sel.value = next.v;
    syncSpeedProp();
    showOrderToast(`漏刻：九旬回放速度改为「${next.label}」`);
  }

  function syncSpeedProp() {
    const sel = document.getElementById("sel-replay-speed");
    if (!sel) return;
    const cur = SPEED_STEPS.find((x) => x.v === sel.value) || SPEED_STEPS[1];
    const el = document.getElementById("prop-speed-act");
    if (el) el.textContent = `回放：${cur.label} · 点击切换`;
  }

  // ==================== 6b. 军情栏：所选 / 急报 ====================
  function renderOutliner() {
    const st = GAME.state;
    if (!st) return;
    const n = st.nodes[GAME.selectedNodeId];
    const box = document.getElementById("outliner-selected");
    const kindEl = document.getElementById("ol-selected-kind");
    if (n && box) {
      const meta = MVP_NODE_META[n.id] || {};
      const rel = n.relation;
      const troops = (n.armies || []).reduce((acc, a) => acc + (a.soldiers || 0), 0);
      const typeName = { city: "城邦", nomad: "游牧", source: "郡治", pass: "关隘", junction: "路口" }[meta.type || n.type] || "城邑";
      if (kindEl) kindEl.textContent = typeName;
      const bar = (k, v, color) => `
        <div class="stat-bar-row"><span class="k">${k}</span>
          <div class="mini-bar"><div class="mini-bar-fill" style="width:${clamp(v, 0, 100)}%;background:${color};"></div></div>
          <span class="v">${v.toFixed(0)}</span></div>`;
      const ownerCls = rel ? (rel.overlord === "han" ? "badge-red" : rel.overlord === "xiongnu" ? "badge-blue" : "badge-gold") : n.controller === "han" ? "badge-red" : "badge-blue";
      box.innerHTML = `
        <div class="sel-card">
          <div class="sel-top">
            <i class="sel-swatch" style="background:${getGodotNodeColor(n.id, n)}"></i>
            <span class="sel-name">${n.name}</span>
            <span class="badge ${ownerCls} sel-kind">${ownerLabel(n)}</span>
          </div>
          <div class="sel-stats">
            <span>人口<b>${(n.pop || 0).toLocaleString()}</b></span>
            <span>储粮<b>${((n.grain || 0) / 1000).toFixed(0)}k 石</b></span>
            <span>驻军<b>${troops ? troops.toLocaleString() : "—"}</b></span>
            <span>城墙<b>${n.type === "junction" ? "无" : `${n.walls || 1} 级`}</b></span>
          </div>
          ${rel ? `<div class="sel-bars">${bar("汉影响", rel.han_influence, "var(--cinnabar)")}${bar("匈威吓", rel.xn_intimidation, "var(--xn)")}</div>` : ""}
          <div class="sel-actions">
            <button class="btn btn-sm" data-ol-open="inspector">图籍详情</button>
            <button class="btn btn-sm" data-ol-open="military">${st.meta.side === "han" ? "发兵于此" : "攻掠于此"}</button>
          </div>
        </div>`;
      box.querySelectorAll("[data-ol-open]").forEach((b) => (b.onclick = () => openDrawer(b.getAttribute("data-ol-open"))));
    }

    const alerts = [];
    for (const t of (st.chronicle && st.chronicle.todos) || []) {
      alerts.push({ level: t.level === "urgent" ? "urgent" : "", title: t.title.replace(/^【([^】]+)】/, "$1 · "), detail: t.detail.replace(/\[F\d([^\]]*)\]/g, "「$1」"), panel: t.jump_tab, node: t.jump_node });
    }
    for (const nd of Object.values(st.nodes)) {
      if (nd.under_siege_by) alerts.push({ level: "urgent", title: `${nd.name} 被围`, detail: "城下有敌，速遣援军或补给。", panel: "inspector", node: nd.id });
    }
    const contested = Object.values(st.nodes)
      .filter((nd) => nd.relation && !nd.relation.overlord && Math.abs(nd.relation.han_influence - nd.relation.xn_intimidation) <= 12)
      .slice(0, 3);
    for (const nd of contested) {
      alerts.push({ level: "calm", title: `${nd.name} · 两属之间`, detail: `汉影响 ${nd.relation.han_influence.toFixed(0)} · 匈威吓 ${nd.relation.xn_intimidation.toFixed(0)}，一使可定向背。`, panel: "diplomacy", node: nd.id });
    }
    const list = document.getElementById("outliner-alerts");
    const cntEl = document.getElementById("ol-alert-count");
    if (cntEl) cntEl.textContent = alerts.length ? `${alerts.length} 条` : "";
    if (list) {
      list.innerHTML = alerts.length
        ? alerts.map((a, i) => `<button class="alert-item ${a.level}" data-alert="${i}"><b>${a.title}</b>${a.detail}</button>`).join("")
        : `<div class="alert-empty">塞下烽燧平安，暂无急报。</div>`;
      list.querySelectorAll("[data-alert]").forEach((b) => {
        b.onclick = () => {
          const a = alerts[parseInt(b.getAttribute("data-alert"), 10)];
          if (a.node && st.nodes[a.node]) selectNodeAndPan(a.node, a.panel || "inspector", true);
          else if (a.panel) openDrawer(a.panel);
        };
      });
    }
  }

  function renderActiveDockPanel() {
    const body = document.getElementById("dock-panel-body");
    if (!body) return;
    const p = GAME.activePanel;
    if (p === "inspector") renderPanelInspector(body);
    else if (p === "court") renderPanelCourtOrTribes(body);
    else if (p === "diplomacy") renderPanelDiplomacy(body);
    else if (p === "logistics") renderPanelLogistics(body);
    else if (p === "military") renderPanelMilitary(body);
    else if (p === "chronicle") renderPanelChronicle(body);
    polishPanel(body);
    bindDrawerCausalClicks(body);
  }

  function bindDrawerCausalClicks(container) {
    container.querySelectorAll("[data-explain-key]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        explainMetric(el.getAttribute("data-explain-key"));
      });
    });
  }

  function polishPanel(root) {
    root.querySelectorAll(".card-head > span:first-child").forEach((el) => {
      if (el.querySelector("small, i")) return;
      let t = el.textContent.replace(/[【】]/g, " ").replace(/\s+/g, " ").trim();
      let note = "";
      const m = t.match(/^(.*?)\s*[（(]([^()（）]+)[)）]\s*$/);
      if (m) {
        t = m[1].trim();
        note = m[2].trim();
      }
      el.innerHTML = `${t}${note ? `<small class="head-note">${note}</small>` : ""}`;
    });
    root.querySelectorAll(".action-grid .btn:not(.act), .btn.act-auto").forEach((btn) => {
      const raw = btn.textContent.replace(/\s+/g, " ").trim();
      const m = raw.match(/^(.*?)\s*[（(]([^()（）]+)[)）]\s*$/);
      const title = (m ? m[1] : raw).replace(/[【】]/g, "");
      btn.classList.add("act");
      btn.innerHTML = `<span class="act-title">${title}</span>${m ? `<span class="act-meta">${m[2]}</span>` : ""}`;
    });
  }

  function showOrderToast(text, warn) {
    const el = document.getElementById("order-toast");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("warn", !!warn);
    el.classList.add("show");
    clearTimeout(showOrderToast._t);
    showOrderToast._t = setTimeout(() => el.classList.remove("show"), 1800);
  }

  // 通用高密度抽屉组件构建器（对标 israel_political_simulation D1-D7）
  function dMetricCard(label, val, sub, toneCls, explainKey) {
    const valTone = toneCls === "good" ? "tone-good" : toneCls === "warn" ? "tone-warn" : toneCls === "bad" ? "tone-bad" : "";
    const clickable = explainKey ? `clickable" data-explain-key="${explainKey}" title="点击查看因果拆解与趋势折线` : "";
    return `
      <div class="d-metric-card ${clickable}">
        <div class="d-metric-title">${label}</div>
        <div class="d-metric-val ${valTone}">${val}</div>
        ${sub ? `<div class="d-metric-sub">${sub}</div>` : ""}
      </div>
    `;
  }

  function dSecHdr(title, rightHtml) {
    return `<div class="d-sec-hdr"><span class="d-sec-title">${title}</span>${rightHtml ? `<span class="d-sec-sub">${rightHtml}</span>` : ""}</div>`;
  }

  function dWaterfallRow(label, valStr, pct, isPos) {
    const w = clamp(Math.abs(pct), 4, 100);
    return `
      <div class="d4-wf-row">
        <span class="d4-wf-lbl">${label}</span>
        <div class="d-meter-track"><div class="d-meter-fill ${isPos ? "fill-green" : "fill-red"}" style="width:${w}%"></div></div>
        <span class="d4-wf-val ${isPos ? "tone-good" : "tone-bad"}">${valStr}</span>
      </div>
    `;
  }

  // 因果网络 SVG 渲染器（对标 D5_Economy / D6_Religion 因果网，点击节点弹出因果拆解卡）
  function renderCausalGraphSvg(side, st) {
    const v1 = st.v1;
    const slCount = (v1.logistics.supply_lines || []).length;
    const ttCount = Object.keys(v1.logistics.tuntian_nodes || {}).length;
    if (side === "han") {
      const nodes = [
        { id: "trust", x: 92, y: 38, title: "朝廷信任", val: `${v1.court.trust.toFixed(0)}`, col: "#a33a2a" },
        { id: "han_money", x: 92, y: 125, title: "少府军资", val: `${st.scores.han_money}钱`, col: "#8a6524" },
        { id: "total_grain", x: 255, y: 38, title: "万里粮道", val: `${slCount}条运转`, col: "#1f6f50" },
        { id: "total_grain", x: 255, y: 125, title: "塞外军屯", val: `${ttCount}处屯田`, col: "#1f6f50" },
        { id: "han_vassals", x: 418, y: 38, title: "内属诸国", val: `${st.scores.han_vassals}国`, col: "#1a4b8c" },
        { id: "han_money", x: 418, y: 125, title: "丝路商税", val: `+${120 + st.scores.han_vassals * 35}`, col: "#b87314" },
        { id: "han_merit", x: 565, y: 82, title: "都护功业 G", val: `${v1.victory.han_merit.toFixed(1)}`, col: "#a33a2a" },
      ];
      const edges = [
        { a: 0, b: 1, lbl: "岁拨" },
        { a: 1, b: 2, lbl: "雇募民夫" },
        { a: 1, b: 3, lbl: "开置屯田" },
        { a: 2, b: 4, lbl: "远征护航" },
        { a: 3, b: 2, lbl: "就地供粟" },
        { a: 4, b: 5, lbl: "商路畅通" },
        { a: 5, b: 1, lbl: "商税回流" },
        { a: 4, b: 6, lbl: "+6.0/国" },
        { a: 3, b: 6, lbl: "+4.5/屯" },
        { a: 6, b: 0, lbl: "捷报奏闻" },
      ];
      return buildGraphSvgMarkup(nodes, edges);
    } else {
      const nodes = [
        { id: "xn_prestige", x: 92, y: 38, title: "单于威望", val: `${v1.tribes.chanyu_prestige.toFixed(0)}`, col: "#5d4037" },
        { id: "xn_money", x: 92, y: 125, title: "王庭赏赐池", val: `${st.scores.xn_money}钱`, col: "#b87314" },
        { id: "rizhu_loyalty", x: 255, y: 38, title: "日逐王忠诚", val: `${v1.tribes.tribes.rizhu.loyalty.toFixed(0)}`, col: "#1a4b8c" },
        { id: "xn_money", x: 255, y: 125, title: "僮仆都尉", val: v1.tribes.tongpu_active ? "在位征赋" : "已罢黜", col: "#1f6f50" },
        { id: "xn_weifu", x: 418, y: 38, title: "服属城邦", val: `${st.scores.xn_vassals}国`, col: "#5d4037" },
        { id: "xn_prestige", x: 418, y: 125, title: "秋高马肥劫掠", val: "断汉粮道", col: "#a33a2a" },
        { id: "xn_weifu", x: 565, y: 82, title: "匈奴威服 W", val: `${v1.victory.xn_weifu.toFixed(1)}`, col: "#5d4037" },
      ];
      const edges = [
        { a: 1, b: 2, lbl: "四部分赏" },
        { a: 2, b: 3, lbl: "驻节焉耆" },
        { a: 3, b: 1, lbl: "岁纳毡马" },
        { a: 0, b: 4, lbl: "控弦威压" },
        { a: 4, b: 6, lbl: "+6.5/国" },
        { a: 3, b: 6, lbl: "+12威服" },
        { a: 5, b: 6, lbl: "遮断汉使" },
      ];
      return buildGraphSvgMarkup(nodes, edges);
    }
  }

  function buildGraphSvgMarkup(nodes, edges) {
    const parts = [
      `<svg class="causal-graph-svg" viewBox="0 0 650 165" preserveAspectRatio="xMidYMid meet">`,
      `<defs>
        <marker id="cgArrowPos" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="#1f6f50"/>
        </marker>
      </defs>`,
    ];
    for (const e of edges) {
      const na = nodes[e.a];
      const nb = nodes[e.b];
      const dx = nb.x - na.x;
      const dy = nb.y - na.y;
      const len = Math.hypot(dx, dy) || 1;
      const x1 = na.x + (dx / len) * 44;
      const y1 = na.y + (dy / len) * 20;
      const x2 = nb.x - (dx / len) * 46;
      const y2 = nb.y - (dy / len) * 20;
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2 - 4;
      parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(31,111,80,0.55)" stroke-width="1.35" marker-end="url(#cgArrowPos)"/>`);
      parts.push(`<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" font-size="8.5" fill="#4f4334" text-anchor="middle">${e.lbl}</text>`);
    }
    for (const nd of nodes) {
      parts.push(`
        <g class="cg-node" data-explain-key="${nd.id}" style="cursor:pointer">
          <rect x="${nd.x - 44}" y="${nd.y - 20}" width="88" height="40" rx="3" fill="#fcf8ee" stroke="${nd.col}" stroke-width="1.4"/>
          <rect x="${nd.x - 44}" y="${nd.y - 20}" width="88" height="4" fill="${nd.col}"/>
          <text x="${nd.x}" y="${nd.y - 2}" font-family="var(--font-title)" font-size="10.5" font-weight="700" fill="#1e1c1a" text-anchor="middle">${nd.title}</text>
          <text x="${nd.x}" y="${nd.y + 13}" font-family="var(--font-mono)" font-size="11" font-weight="700" fill="${nd.col}" text-anchor="middle">${nd.val}</text>
        </g>
      `);
    }
    parts.push(`</svg>`);
    return `<div class="causal-graph-wrap">${parts.join("")}<div class="cg-legend" style="display:flex;justify-content:space-between;align-items:center;font-size:10.5px;color:var(--muted);padding:4px 8px 0;border-top:1px dashed rgba(30,28,26,0.18);margin-top:2px;"><span><i class="cg-dot" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#a33a2a;margin-right:4px;"></i>政治与功业</span><span><i class="cg-dot" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#1f6f50;margin-right:4px;"></i>粮道与军屯</span><span><i class="cg-dot" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#1a4b8c;margin-right:4px;"></i>邦交与向心</span><span>点击任意节点弹出因果拆解卡</span></div></div>`;
  }

  // ---- [F1] 图籍 · 城塞与驻军检视面板（高密度双栏布局） ----
  function renderPanelInspector(container) {
    const st = GAME.state;
    const side = st.meta.side;
    const n = st.nodes[GAME.selectedNodeId] || st.nodes.lou_lan;
    const rel = n.relation;
    const meta = MVP_NODE_META[n.id] || {};
    const swatch = getGodotNodeColor(n.id, n);
    const routes = (BUNDLE.scenario_mvp && BUNDLE.scenario_mvp.routes) || [];
    const adjRoutes = routes.filter((r) => (r.a || r.from) === n.id || (r.b || r.to) === n.id);
    const totalTroops = (n.armies || []).reduce((acc, a) => acc + (a.soldiers || 0), 0);

    const kpiRow = `
      <div class="d-kpi-grid-6">
        ${dMetricCard("编户人口", (n.pop || 0).toLocaleString(), "城郭丁口", "", `node_${n.id}`)}
        ${dMetricCard("仓廪储粮", `${((n.grain || 0) / 1000).toFixed(1)}k 石`, "本地存粟", "good", "total_grain")}
        ${dMetricCard("城防等级", n.type === "junction" ? "无城垣" : `Lv.${n.walls || 1}`, `守备 ${(n.militia || 800).toLocaleString()} 人`, "", `node_${n.id}`)}
        ${dMetricCard("驻扎野战军", `${totalTroops.toLocaleString()} 人`, `${(n.armies || []).length} 部驻军`, totalTroops > 0 ? "good" : "", `node_${n.id}`)}
        ${dMetricCard("塞外军屯", n.tuntian_lv ? `Lv.${n.tuntian_lv}` : "未设", n.tuntian_lv ? "每季+36k石" : "可开置戊己屯", n.tuntian_lv ? "good" : "warn", "total_grain")}
        ${dMetricCard("烽燧亭障", n.has_beacon ? "已筑烽燧" : "无烽燧", n.has_beacon ? "点亮L4精确视野" : "视野受限", n.has_beacon ? "info" : "", `node_${n.id}`)}
      </div>
    `;

    const statusBar = `
      <div class="d-status-bar">
        <span>当前宗主：<strong style="color:${n.controller === "han" ? "var(--han)" : n.controller === "xiongnu" ? "var(--xn)" : "var(--ink)"}">${ownerLabel(n)}</strong></span>
        <span>过境供粮：<strong style="color:${rel && rel.forage ? tone(rel.forage.color) : "var(--jade)"}">${rel && rel.forage ? rel.forage.label : "己方官仓直供"}</strong></span>
        <span>直通古道：<strong>${adjRoutes.length} 条干道</strong></span>
      </div>
    `;

    const statBar = (k, v, color) => `
      <div class="d-meter-row">
        <span style="color:var(--ink-2)">${k}</span>
        <div class="d-meter-track"><div class="d-meter-fill" style="width:${clamp(v, 0, 100)}%;background:${color};"></div></div>
        <span class="num" style="text-align:right;font-weight:700">${v.toFixed(0)}</span>
      </div>`;

    const leftCol = `
      <div class="d-card">
        ${dSecHdr(
          `<span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${swatch};border:1px solid #1e1c1a;margin-right:6px;"></i>【${n.name}】向背与供粮姿态</span>`,
          `<span style="cursor:pointer;color:var(--cobalt)" data-explain-key="node_${n.id}">因果拆解 ▾</span>`
        )}
        ${
          rel
            ? `
            ${statBar("大汉教化影响", rel.han_influence, "#a33a2a")}
            ${statBar("匈奴铁骑威吓", rel.xn_intimidation, "#6b4a33")}
            ${statBar("对匈奴苛敛怨恨", rel.xn_resentment, "#b87314")}
            ${rel.crimes > 0 ? `<div class="alert-line" style="margin-top:6px;">已有讨伐罪状（遮杀汉使 / 劫掠商队）——发兵讨伐不损朝廷信任。</div>` : ""}
          `
            : `<div style="font-size:12px;color:var(--ink-2);line-height:1.55;">此地为<strong>${n.controller === "han" ? "大汉直辖河西/西域军镇" : n.controller === "xiongnu" ? "匈奴单于王庭本部" : "丝路冲要路口"}</strong>，乃大军出塞与转运粮秣之根本枢要。</div>`
        }
      </div>

      <div class="d-card">
        ${dSecHdr("直通古道与邻邦形胜表", "《汉书·西域传》道里")}
        <table class="d-table">
          <thead><tr><th>邻接城塞</th><th>地形</th><th>考据里程</th><th>行程</th><th>粮耗</th></tr></thead>
          <tbody>
            ${
              adjRoutes
                .map((r) => {
                  const aId = r.a || r.from;
                  const bId = r.b || r.to;
                  const otherId = aId === n.id ? bId : aId;
                  const otherNode = st.nodes[otherId];
                  const otherName = (otherNode && otherNode.name) || otherId;
                  const km = r.distance_km ? `${Math.round(r.distance_km)}km` : `${Math.round(r.days * 22)}km`;
                  return `<tr>
                    <td><strong style="cursor:pointer;color:var(--crimson)" data-jump-adj="${otherId}">${otherName}</strong></td>
                    <td>${TERRAIN_NAMES[r.terrain] || r.terrain}</td>
                    <td class="num">${km}</td>
                    <td class="num">${Math.ceil(r.days)}日</td>
                    <td class="num">×${(r.attrition_mult || 1.0).toFixed(1)}</td>
                  </tr>`;
                })
                .join("") || `<tr><td colspan="5" style="color:var(--muted)">无直通干道</td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;

    const armiesHtml =
      n.armies && n.armies.length > 0
        ? `<table class="d-table">
            <thead><tr><th>番号 / 主将</th><th>阵营</th><th>兵力</th><th>战马</th><th>状态</th></tr></thead>
            <tbody>
              ${n.armies
                .map(
                  (a) => `<tr>
                    <td><strong>${a.name}</strong> · ${a.commander_name || "校尉"}</td>
                    <td><span class="badge ${a.faction === "han" ? "badge-red" : "badge-blue"}">${a.faction === "han" ? "汉" : "匈"}</span></td>
                    <td class="num">${(a.soldiers || 0).toLocaleString()}</td>
                    <td class="num">${(a.horses || 0).toLocaleString()}</td>
                    <td style="color:var(--jade);font-weight:600">就食城仓</td>
                  </tr>`
                )
                .join("")}
            </tbody>
          </table>`
        : `<div class="note">无野战军驻扎，地方城防乡兵 ${(n.militia || 800).toLocaleString()} 人守御。</div>`;

    const rightCol = `
      <div class="d-card">
        ${dSecHdr(`对【${n.name}】下达军政指令`, "点击加入底部本季军令")}
        ${
          side === "han"
            ? `
          <div class="action-grid">
            <button class="btn btn-gold act" id="act-elite-envoy"><span class="act-title">遣精使</span><span class="act-meta">300 钱 · 影响 +18</span></button>
            <button class="btn act" id="act-hire-envoy"><span class="act-title">遣募使</span><span class="act-meta">140 钱 · 影响 +10 · 或生事端</span></button>
            <button class="btn btn-emerald act" id="act-enfeoff"><span class="act-title">册封为属国</span><span class="act-meta">200 钱 · 都护功业 +6</span></button>
            <button class="btn act" id="act-assassinate-king"><span class="act-title">刺王更立</span><span class="act-meta">320 钱 · 傅介子奇谋</span></button>
            <button class="btn act" id="act-supply-to"><span class="act-title">拉通粮道</span><span class="act-meta">220 钱 · 配马350匹</span></button>
            <button class="btn act" id="act-build-tuntian"><span class="act-title">开置军屯</span><span class="act-meta">220 钱 · 功业 +4.5</span></button>
            <button class="btn act" id="act-build-beacon"><span class="act-title">修筑烽燧</span><span class="act-meta">150 钱 · 城防+8%</span></button>
            <button class="btn act" id="act-recruit-convicts"><span class="act-title">赦募七科谪</span><span class="act-meta">120 钱 · +2,200 兵</span></button>
            <button class="btn btn-han act span-2" id="act-attack-node"><span class="act-title">发兵讨伐【${n.name}】</span><span class="act-meta">180 钱 · 主力 5,000 人远征</span></button>
          </div>
        `
            : `
          <div class="action-grid">
            <button class="btn btn-blue act" id="act-xn-intimidate"><span class="act-title">遣骑威压</span><span class="act-meta">50 钱 · 威吓 +15</span></button>
            <button class="btn btn-gold act" id="act-xn-vassal"><span class="act-title">索取质子</span><span class="act-meta">120 钱 · 威服 +7.5</span></button>
            <button class="btn act" id="act-xn-install-prince"><span class="act-title">废立亲匈王</span><span class="act-meta">180 钱 · 强控王庭</span></button>
            <button class="btn act" id="act-xn-pacify"><span class="act-title">安抚日逐王</span><span class="act-meta">150 钱 · 忠诚 +15</span></button>
            <button class="btn btn-han act span-2" id="act-attack-node"><span class="act-title">控弦攻掠【${n.name}】</span><span class="act-meta">180 钱 · 铁骑 5,000 人南下</span></button>
          </div>
        `
        }
      </div>

      <div class="d-card">
        ${dSecHdr("本城驻扎军团与守备编制", `${(n.armies || []).length} 部`)}
        ${armiesHtml}
      </div>
    `;

    container.innerHTML = `
      <div class="d-compact-summary">
        <strong>【${n.name}】城塞图籍卷宗</strong> — 现属<strong>${ownerLabel(n)}</strong>。点击上方六维指标卡可调阅<strong>因果拆解与趋势折线</strong>；点击邻接城塞可直接移步检视。
      </div>
      ${kpiRow}
      ${statusBar}
      <div class="d-two-col">
        <div class="d-col">${leftCol}</div>
        <div class="d-col">${rightCol}</div>
      </div>
    `;

    container.querySelectorAll("[data-jump-adj]").forEach((el) => {
      el.onclick = () => selectNodeAndPan(el.getAttribute("data-jump-adj"), "inspector", true);
    });

    if (side === "han") {
      document.getElementById("act-elite-envoy").onclick = () =>
        queueCustomOrder({ type: "dispatch_elite_envoy", desc: `【精使出塞】遣持节精使团赴【${n.name}】颁赐缯帛 (影响力+18)`, cost_money: 300, target_node: n.id, raw: { state: n.id } });
      document.getElementById("act-hire-envoy").onclick = () =>
        queueCustomOrder({ type: "hire_mission", desc: `【募使通商】遣募使团携金赴【${n.name}】抚谕 (影响力+10.5)`, cost_money: 140, target_node: n.id, raw: { state: n.id } });
      document.getElementById("act-enfeoff").onclick = () =>
        queueCustomOrder({ type: "make_vassal", desc: `【册封属国】颁赐汉朝金印紫绶，纳【${n.name}】为内属国 (都护功业+6)`, cost_money: 200, target_node: n.id, raw: { state: n.id } });
      document.getElementById("act-assassinate-king").onclick = () =>
        queueCustomOrder({ type: "assassinate_king", desc: `【刺王立新】遣傅介子持节奇袭刺杀【${n.name}】亲匈王，更立亲汉质子`, cost_money: 320, target_node: n.id, raw: { state: n.id } });
      document.getElementById("act-supply-to").onclick = () =>
        queueCustomOrder({ type: "set_supply_line", desc: `【万里粮道】拉通「敦煌 → ${n.name}」自动补给线 (配官马350匹、民夫2,500人)`, cost_money: 220, target_node: n.id, raw: { from: "dun_huang", to: n.id, laborers: 2500, escort: true } });
      document.getElementById("act-build-tuntian").onclick = () =>
        queueCustomOrder({ type: "build_tuntian", desc: `【塞外军屯】在【${n.name}】开置戊己校尉屯田 (储粮+36k，功业+4.5)`, cost_money: 220, target_node: n.id, raw: { node: n.id } });
      document.getElementById("act-build-beacon").onclick = () =>
        queueCustomOrder({ type: "build_beacon", desc: `【烽燧亭障】在【${n.name}】修筑汉代烽燧 (城防+8%，点亮L4精确视野)`, cost_money: 150, target_node: n.id, raw: { node: n.id } });
      document.getElementById("act-recruit-convicts").onclick = () =>
        queueCustomOrder({ type: "recruit_convicts", desc: `【赦募罪兵】在【${n.name}】赦募七科谪与弛刑徒 +2,200 人`, cost_money: 120, target_node: n.id, raw: { node: n.id } });
    } else {
      document.getElementById("act-xn-intimidate").onclick = () =>
        queueCustomOrder({ type: "intimidate_city", desc: `【控弦威压】遣游骑巡行威压【${n.name}】(匈奴威吓+15)`, cost_money: 50, target_node: n.id, raw: { state: n.id } });
      document.getElementById("act-xn-vassal").onclick = () =>
        queueCustomOrder({ type: "demand_vassal", desc: `【索取质子】强令【${n.name}】遣质子入侍单于庭 (威服+7.5)`, cost_money: 120, target_node: n.id, raw: { state: n.id } });
      document.getElementById("act-xn-install-prince").onclick = () =>
        queueCustomOrder({ type: "install_prince", desc: `【废立王子】废黜【${n.name}】旧主，强立亲匈王子控扼王庭`, cost_money: 180, target_node: n.id, raw: { state: n.id } });
      document.getElementById("act-xn-pacify").onclick = () =>
        queueCustomOrder({ type: "pacify_tribe", desc: `【王庭抚藩】遣骨都侯赐金帛安抚日逐王先贤掸 (忠诚+15)`, cost_money: 150, target_node: "yan_qi", raw: { tribe: "rizhu" } });
    }

    document.getElementById("act-attack-node").onclick = () => {
      queueCustomOrder({
        type: "set_plan",
        desc: `【主力远征】遣主力大军 5,000 人奔袭讨伐【${n.name}】(常备指令：${GAME.planDraft.standingOrder === "cautious" ? "谨慎保军" : "均衡推进"})`,
        cost_money: 180,
        target_node: n.id,
        raw: { origin: side === "han" ? "dun_huang" : "chanyu_ting", target: n.id, soldiers: 5000, standing_order: GAME.planDraft.standingOrder },
      });
    };
  }

  // ---- [F2] 诏书 · 朝廷与因果网 / 王庭 · 四部与因果网（对标 D4_Policies + D5_Economy） ----
  function renderPanelCourtOrTribes(container) {
    const st = GAME.state;
    const v1 = st.v1;
    if (st.meta.side === "han") {
      const ed = v1.court.active_edict;
      const fNode = st.nodes[GAME.forgedTarget];
      const fName = fNode ? fNode.name : "车师前";
      const red = 126;
      const green = 98;
      const maxD = Math.max(red, green);
      const pol = GAME.policies;

      const kpiRow = `
        <div class="d-kpi-grid-6">
          ${dMetricCard("长安朝廷信任", `${v1.court.trust.toFixed(0)} / 100`, v1.court.trust >= 50 ? "正常委任" : "监军掣肘", v1.court.trust >= 50 ? "good" : "warn", "trust")}
          ${dMetricCard("当季天子诏书", ed ? ed.title : "无急诏", ed ? (ed.complied ? "已奉诏 ✓" : `限第 ${ed.deadline_turn} 季`) : "便宜经略", ed && !ed.complied ? "warn" : "good", "trust")}
          ${dMetricCard("少府西域专款", `${st.scores.han_money.toLocaleString()} 钱`, "大司农岁拨+商税", "good", "han_money")}
          ${dMetricCard("太仆官马池", `${(st.scores.han_horse_pool || 5000).toLocaleString()} 匹`, "轻骑与转运驮马", "info", "han_money")}
          ${dMetricCard("大汉内属国", `${st.scores.han_vassals} / 18 国`, "满 11 国可立都护", "good", "han_vassals")}
          ${dMetricCard("都护功业 G", `${v1.victory.han_merit.toFixed(1)} / 100`, "满 100 终局大捷", "good", "han_merit")}
        </div>
      `;

      const leftCol = `
        <div class="d-card">
          ${dSecHdr("长安当季诏令与奏请调度", ed ? (ed.complied ? "已奉诏" : `限第 ${ed.deadline_turn} 季`) : "朝议风向：武帝拓边")}
          ${
            ed
              ? `
            <div class="edict-scroll" style="margin-bottom:8px;">
              <div class="edict-title">
                <span>《${ed.title}》</span>
                <span class="badge ${ed.complied ? "badge-green" : "badge-red"}">${ed.complied ? "已奉诏" : `限第 ${ed.deadline_turn} 季`}</span>
              </div>
              <div class="edict-meta">目标城邦：<strong>${st.nodes[ed.target] ? st.nodes[ed.target].name : ed.target}</strong> · 恩赏：信任 +${ed.reward_trust || 10}、专款 +${ed.reward_money || 650} 钱 ｜ 违期：信任 −${ed.penalty_trust || 5}</div>
              ${ed.desc ? `<div class="edict-meta" style="color:var(--muted);margin-top:2px;">${ed.desc}</div>` : ""}
            </div>
            <div class="action-grid" style="margin-bottom:8px;">
              <button class="btn btn-gold" id="btn-court-comply">奉诏拜表 (信任+5)</button>
              <button class="btn" id="btn-court-bargain">上书陈情请宽期 (+2季/+500钱)</button>
            </div>
          `
              : `<div class="note" style="margin-bottom:8px;">当季尚无紧急诏令，可专心经营粮道与诸国册封。</div>`
          }
          <div class="action-grid">
            <button class="btn" id="btn-court-money">奏请少府专款 (+900钱 / 信任-5)</button>
            <button class="btn" id="btn-court-troops">请调北军与边骑 (+2,000兵/+1,800马)</button>
            <button class="btn btn-emerald span-2" id="btn-court-duhu">拜表《奏请设立西域都护府疏》(乌垒立府 · 功业+16)</button>
          </div>
        </div>

        <div class="d-card">
          ${dSecHdr("西域都护国策与方略杠杆", "离散三档即时生效")}
          <div class="d4-lever-list">
            <div class="d4-lever-row">
              <div><div class="d4-lever-name">内朝外戚游说力度</div><div class="d4-lever-meta">影响每季朝廷信任修正与御史弹劾缓冲</div></div>
              <div class="d4-tier-bar">
                <button type="button" class="d4-pol-btn ${pol.courtLobby === 0 ? "active" : ""}" data-pol-key="courtLobby" data-pol-val="0">谨守臣节</button>
                <button type="button" class="d4-pol-btn ${pol.courtLobby === 1 ? "active" : ""}" data-pol-key="courtLobby" data-pol-val="1">结好内朝</button>
                <button type="button" class="d4-pol-btn ${pol.courtLobby === 2 ? "active" : ""}" data-pol-key="courtLobby" data-pol-val="2">厚结大将军</button>
              </div>
            </div>
            <div class="d4-lever-row">
              <div><div class="d4-lever-name">塞外经略总方略</div><div class="d4-lever-meta">平衡戊己屯田产出与持节使团威望</div></div>
              <div class="d4-tier-bar">
                <button type="button" class="d4-pol-btn ${pol.frontierDoc === 0 ? "active" : ""}" data-pol-key="frontierDoc" data-pol-val="0">步步屯戍</button>
                <button type="button" class="d4-pol-btn ${pol.frontierDoc === 1 ? "active" : ""}" data-pol-key="frontierDoc" data-pol-val="1">远交近攻</button>
                <button type="button" class="d4-pol-btn ${pol.frontierDoc === 2 ? "active" : ""}" data-pol-key="frontierDoc" data-pol-val="2">雷霆犁庭</button>
              </div>
            </div>
            <div class="d4-lever-row">
              <div><div class="d4-lever-name">河西四郡调发规制</div><div class="d4-lever-meta">调节大司农专款补充与河西民力负荷</div></div>
              <div class="d4-tier-bar">
                <button type="button" class="d4-pol-btn ${pol.hexiLevy === 0 ? "active" : ""}" data-pol-key="hexiLevy" data-pol-val="0">宽恤民力</button>
                <button type="button" class="d4-pol-btn ${pol.hexiLevy === 1 ? "active" : ""}" data-pol-key="hexiLevy" data-pol-val="1">常制调发</button>
                <button type="button" class="d4-pol-btn ${pol.hexiLevy === 2 ? "active" : ""}" data-pol-key="hexiLevy" data-pol-val="2">急征转输</button>
              </div>
            </div>
          </div>
        </div>
      `;

      const rightCol = `
        <div class="d-card">
          ${dSecHdr("长安朝局与西域功业因果传导网", "点击图中节点弹出因果卡")}
          ${renderCausalGraphSvg("han", st)}
        </div>

        <div class="d-card">
          ${dSecHdr("持节矫诏 · 捷报与槛车竞速推演", "将在外君命有所不受")}
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px; font-size:12px;">
            <label>奇袭目标
              <select id="sel-forged-target" style="width:100%; margin-top:3px;">
                <option value="cheshi_qian" ${GAME.forgedTarget === "cheshi_qian" ? "selected" : ""}>车师前王庭 (北道锁钥)</option>
                <option value="lou_lan" ${GAME.forgedTarget === "lou_lan" ? "selected" : ""}>楼兰王城 (盐泽咽喉)</option>
                <option value="yan_qi" ${GAME.forgedTarget === "yan_qi" ? "selected" : ""}>焉耆 (匈奴僮仆都尉治所)</option>
                <option value="qiu_ci" ${GAME.forgedTarget === "qiu_ci" ? "selected" : ""}>龟兹 (北道大国)</option>
              </select>
            </label>
            <label class="chk-inline" style="flex-direction:row;align-self:end;padding-bottom:5px;">
              <input type="checkbox" id="chk-forged-impeach" ${GAME.forgedSelfImpeach ? "checked" : ""} /> 同时上《自劾疏》（信任仅 −6）
            </label>
          </div>
          <div class="race">
            <div class="race-row"><span style="color:var(--green-light)">捷报驰奏</span>
              <div class="mini-bar"><div class="mini-bar-fill" style="width:${(green / maxD) * 100}%;background:var(--green);"></div></div>
              <span style="text-align:right">${green} 日</span></div>
            <div class="race-row"><span style="color:var(--han-light)">槛车追捕</span>
              <div class="mini-bar"><div class="mini-bar-fill" style="width:${(red / maxD) * 100}%;background:var(--danger);"></div></div>
              <span style="text-align:right">${red} 日</span></div>
            <div class="race-verdict">捷报早到 ${red - green} 日——可望将功折罪，功业 +12。</div>
          </div>
          <button class="btn btn-han" id="btn-do-forge-edict" style="width:100%; margin-top:8px; padding:8px;">矫诏发兵 · 奇袭${fName}</button>
        </div>
      `;

      container.innerHTML = `
        <div class="d-compact-summary">
          <strong>长安朝堂与节度方略</strong> — 汉使万里悬军，内赖<strong>少府岁拨与朝廷信任</strong>，外仗<strong>持节矫诏与屯田护道</strong>。点击任意指标卡或因果网节点可实时推演连锁反应。
        </div>
        ${kpiRow}
        <div class="d-two-col">
          <div class="d-col">${leftCol}</div>
          <div class="d-col">${rightCol}</div>
        </div>
      `;

      container.querySelectorAll("[data-pol-key]").forEach((btn) => {
        btn.onclick = () => {
          const k = btn.getAttribute("data-pol-key");
          const v = parseInt(btn.getAttribute("data-pol-val"), 10);
          GAME.policies[k] = v;
          showOrderToast(`已调整国策档位：${btn.textContent}`);
          renderPanelCourtOrTribes(container);
          polishPanel(container);
          bindDrawerCausalClicks(container);
        };
      });

      if (ed) {
        document.getElementById("btn-court-comply").onclick = () =>
          queueCustomOrder({ type: "comply_edict", desc: `【奉诏行事】拜表奉行《${ed.title}》(信任+5)`, cost_money: 0, target_node: ed.target, raw: {} });
        document.getElementById("btn-court-bargain").onclick = () =>
          queueCustomOrder({ type: "bargain_edict", desc: `【上书讨价】陈情请宽展《${ed.title}》2季并增拨军资 +500 钱`, cost_money: 0, target_node: ed.target, raw: { add_turns: 2, ask_money: 500 } });
      }
      document.getElementById("btn-court-money").onclick = () =>
        queueCustomOrder({ type: "request_appropriation", desc: `【上疏请款】向大司农奏请调拨西域专款 (+900钱，信任-5)`, cost_money: 0, target_node: "chang_an", raw: {} });
      document.getElementById("btn-court-troops").onclick = () =>
        queueCustomOrder({ type: "request_troops", desc: `【请调兵马】向太仆与北军请调边骑 +2,000 人、官马 +1,800 匹`, cost_money: 0, target_node: "dun_huang", raw: {} });
      document.getElementById("btn-court-duhu").onclick = () =>
        queueCustomOrder({ type: "petition_protectorate", desc: `【奏立都护】正式拜表《奏请设立西域都护府疏》(功业+16)`, cost_money: 300, target_node: "wu_lei", raw: {} });

      document.getElementById("sel-forged-target").onchange = (e) => {
        GAME.forgedTarget = e.target.value;
        renderPanelCourtOrTribes(container);
        polishPanel(container);
        bindDrawerCausalClicks(container);
      };
      document.getElementById("chk-forged-impeach").onchange = (e) => {
        GAME.forgedSelfImpeach = e.target.checked;
      };
      document.getElementById("btn-do-forge-edict").onclick = () => {
        const tName = st.nodes[GAME.forgedTarget] ? st.nodes[GAME.forgedTarget].name : GAME.forgedTarget;
        queueCustomOrder({
          type: "forge_edict",
          desc: `【持节矫诏】未奉诏拔剑发兵奇袭【${tName}】(${GAME.forgedSelfImpeach ? "同步拜表自劾" : "便宜独断"} · 功业+12)`,
          cost_money: 150,
          target_node: GAME.forgedTarget,
          raw: { target: GAME.forgedTarget, self_impeach: GAME.forgedSelfImpeach },
        });
      };
    } else {
      // 匈奴单于王庭与四部分赏面板
      const ratios = v1.tribes.reward_ratios || { zuoxian: 35, youxian: 30, rizhu: 20, lihu: 15 };
      const tr = v1.tribes.tribes;
      const kpiRow = `
        <div class="d-kpi-grid-6">
          ${dMetricCard("撑犁单于威望", `${v1.tribes.chanyu_prestige.toFixed(0)} / 100`, "王庭号令权威", "good", "xn_prestige")}
          ${dMetricCard("王庭赏赐池", `${st.scores.xn_money.toLocaleString()} 钱`, "待分赏金帛", "warn", "xn_money")}
          ${dMetricCard("日逐王忠诚", `${tr.rizhu.loyalty.toFixed(0)} / 100`, tr.rizhu.loyalty >= 55 ? "奉命守西域" : "谨防率众降汉", tr.rizhu.loyalty >= 55 ? "good" : "bad", "rizhu_loyalty")}
          ${dMetricCard("焉耆僮仆都尉", v1.tribes.tongpu_active ? "驻节统辖" : "已被罢黜", "西域赋敛总枢", v1.tribes.tongpu_active ? "good" : "bad", "xn_weifu")}
          ${dMetricCard("服属城邦", `${st.scores.xn_vassals} 国`, "岁纳毡马粟米", "info", "xn_weifu")}
          ${dMetricCard("匈奴威服 W", `${v1.victory.xn_weifu.toFixed(1)} / 100`, "满 100 霸有西域", "good", "xn_weifu")}
        </div>
      `;

      container.innerHTML = `
        <div class="d-compact-summary">
          <strong>漠北单于王庭与四部会盟</strong> — 匈奴以马上得天下，赖<strong>战利分赏左贤、右贤、日逐、犁汗四部</strong>以维系向心；若日逐王份额低于期望 20% 将触发嫉妒并密谋降汉。
        </div>
        ${kpiRow}
        <div class="d-two-col">
          <div class="d-col">
            <div class="d-card">
              ${dSecHdr("四部王庭分赏配额", `赏赐池 ${v1.tribes.reward_pool} 钱`)}
              ${[
                ["zuoxian", "左贤王部 (东方诸部·期望35%)", tr.zuoxian.loyalty],
                ["youxian", "右贤王部 (西方诸部·期望30%)", tr.youxian.loyalty],
                ["rizhu", "日逐王部 (掌西域僮仆·期望20%)", tr.rizhu.loyalty],
                ["lihu", "犁汗王部 (南下前锋·期望15%)", tr.lihu.loyalty],
              ]
                .map(
                  ([k, label, loy]) => `
                <div style="margin-bottom:7px;">
                  <div style="display:flex; justify-content:space-between; font-size:12px;">
                    <span>${label} — 忠诚: <strong style="color:${loy >= 55 ? "var(--green-light)" : "var(--han-light)"}">${loy.toFixed(0)}</strong></span>
                    <strong id="lbl-share-${k}">${ratios[k]}%</strong>
                  </div>
                  <input type="range" min="0" max="70" value="${ratios[k]}" data-tribe-slider="${k}"/>
                </div>
              `
                )
                .join("")}
              <div class="action-grid" style="margin-top:8px;">
                <button class="btn" id="btn-xn-equalize">按期望份额一键配平</button>
                <button class="btn btn-gold" id="btn-xn-distribute">颁行本季四部分赏 (200钱)</button>
              </div>
            </div>
          </div>
          <div class="d-col">
            <div class="d-card">
              ${dSecHdr("漠北王庭与威服因果传导网", "点击图中节点弹出因果卡")}
              ${renderCausalGraphSvg("xiongnu", st)}
            </div>
            <div class="d-card">
              ${dSecHdr("龙城大会 · 王庭战术 · 僮仆都尉赋敛")}
              <div class="action-grid">
                <button class="btn btn-blue" id="btn-xn-assembly">召开龙城/蹛林大会盟誓 (+6威望)</button>
                <button class="btn btn-gold" id="btn-xn-pacify-rizhu">专使赐金安抚日逐王 (忠+15)</button>
                <button class="btn" id="btn-xn-card-retreat">战术卡：诈败诱敌 (伏击+30%)</button>
                <button class="btn" id="btn-xn-card-beacon">战术卡：拔除亭障 (盲汉视野)</button>
                <button class="btn" id="btn-xn-tax-normal">僮仆都尉：常赋岁币 (+320钱)</button>
                <button class="btn btn-han" id="btn-xn-tax-heavy">僮仆都尉：重敛竭泽 (+550钱)</button>
              </div>
            </div>
          </div>
        </div>
      `;

      container.querySelectorAll("[data-tribe-slider]").forEach((sl) => {
        sl.addEventListener("input", (e) => {
          const k = e.target.getAttribute("data-tribe-slider");
          v1.tribes.reward_ratios[k] = parseInt(e.target.value, 10);
          document.getElementById(`lbl-share-${k}`).textContent = `${e.target.value}%`;
        });
      });

      document.getElementById("btn-xn-equalize").onclick = () => {
        v1.tribes.reward_ratios = { zuoxian: 35, youxian: 30, rizhu: 20, lihu: 15 };
        renderPanelCourtOrTribes(container);
        polishPanel(container);
        bindDrawerCausalClicks(container);
      };
      document.getElementById("btn-xn-distribute").onclick = () =>
        queueCustomOrder({
          type: "distribute_rewards",
          desc: `【四部分赏】按 (${v1.tribes.reward_ratios.zuoxian}/${v1.tribes.reward_ratios.youxian}/${v1.tribes.reward_ratios.rizhu}/${v1.tribes.reward_ratios.lihu}) 颁赐王庭金帛`,
          cost_money: 200,
          target_node: "chanyu_ting",
          raw: { ratios: deepClone(v1.tribes.reward_ratios) },
        });
      document.getElementById("btn-xn-assembly").onclick = () =>
        queueCustomOrder({ type: "hold_assembly", desc: `【草原盛会】大会诸王于龙城/蹛林，钦定主攻敦煌 (威望+6，诸部忠+5)`, cost_money: 100, target_node: "dun_huang", raw: { target: "dun_huang", card: "feigned_retreat" } });
      document.getElementById("btn-xn-pacify-rizhu").onclick = () =>
        queueCustomOrder({ type: "pacify_tribe", desc: `【安抚日逐】遣骨都侯赐良马金帛安抚日逐王先贤掸 (忠诚+15)`, cost_money: 150, target_node: "yan_qi", raw: { tribe: "rizhu" } });
      document.getElementById("btn-xn-card-retreat").onclick = () =>
        queueCustomOrder({ type: "play_tactical_card", desc: `【王庭战术卡】激活「诈败诱敌」(本季诱敌断粮与伏击伤害+30%)`, cost_money: 0, target_node: "chanyu_ting", raw: { card: "诈败诱敌" } });
      document.getElementById("btn-xn-card-beacon").onclick = () =>
        queueCustomOrder({ type: "play_tactical_card", desc: `【王庭战术卡】激活「拔除亭障」(拆毁汉塞烽燧赏金翻倍)`, cost_money: 0, target_node: "dun_huang", raw: { card: "拔除亭障" } });
      document.getElementById("btn-xn-tax-normal").onclick = () =>
        queueCustomOrder({ type: "set_tongpu_tax", desc: `【僮仆征税】焉耆僮仆都尉按「常赋岁币」征发西域 (+320钱)`, cost_money: 0, target_node: "yan_qi", raw: { tier: "normal" } });
      document.getElementById("btn-xn-tax-heavy").onclick = () =>
        queueCustomOrder({ type: "set_tongpu_tax", desc: `【僮仆重敛】焉耆僮仆都尉按「重敛竭泽」强征西域 (+550钱，诸国怨恨+14)`, cost_money: 0, target_node: "yan_qi", raw: { tier: "heavy" } });
    }
  }

  // ---- [F3] 符节 · 西域诸国总览表与四阶宏图里程碑（对标 D1_Goals + D2） ----
  function renderPanelDiplomacy(container) {
    const st = GAME.state;
    const v1 = st.v1;
    const side = st.meta.side;
    const bd = v1.victory.han_merit_breakdown || {};
    const ttCount = Object.keys(v1.logistics.tuntian_nodes || {}).length;
    const merit = v1.victory.han_merit;

    const stages =
      side === "han"
        ? [
            { idx: "第一阶", title: "凿空立威", desc: "收复楼兰或精绝，内属国 ≥3 国", done: st.scores.han_vassals >= 3 },
            { idx: "第二阶", title: "屯田护道", desc: "塞外开置军屯 ≥3 处，保障北道或南道粮秣", done: ttCount >= 3 },
            { idx: "第三阶", title: "诸国纳质", desc: "大汉内属国 ≥11 国，迎降或击破僮仆都尉", done: st.scores.han_vassals >= 11 || !v1.tribes.tongpu_active },
            { idx: "第四阶", title: "都护立府", desc: "总功业 G ≥ 100，乌垒立西域都护府", done: merit >= 100 },
          ]
        : [
            { idx: "第一阶", title: "控弦南下", desc: "稳控车师与焉耆北道门户，服属 ≥5 国", done: st.scores.xn_vassals >= 5 },
            { idx: "第二阶", title: "僮仆重敛", desc: "护持焉耆僮仆都尉，充实王庭赏赐池", done: v1.tribes.tongpu_active && st.scores.xn_money >= 1200 },
            { idx: "第三阶", title: "遮断汉道", desc: "西域服属国 ≥10 国，威服 W ≥ 75", done: st.scores.xn_vassals >= 10 || v1.victory.xn_weifu >= 75 },
            { idx: "第四阶", title: "漠北独尊", desc: "匈奴威服 W ≥ 100，汉使绝迹西域", done: v1.victory.xn_weifu >= 100 },
          ];

    let activeAssigned = false;
    const msHtml = stages
      .map((m) => {
        let cls = "";
        if (m.done) cls = "done";
        else if (!activeAssigned) {
          cls = "active";
          activeAssigned = true;
        }
        return `
          <div class="d-ms-card ${cls}">
            <div class="d-ms-idx">${m.idx} · ${m.done ? "已达成 ✓" : cls === "active" ? "当前要务" : "后续宏图"}</div>
            <div class="d-ms-title">${m.title}</div>
            <div class="d-ms-desc">${m.desc}</div>
          </div>
        `;
      })
      .join("");

    const kpiRow = `
      <div class="d-kpi-grid-6">
        ${dMetricCard("都护功业 G", `${merit.toFixed(1)} / 100`, "满 100 可奏立都护府", "good", "han_merit")}
        ${dMetricCard("属国分项", `+${bd.vassal || st.scores.han_vassals * 6}`, `大汉内属 ${st.scores.han_vassals} 国`, "good", "han_vassals")}
        ${dMetricCard("册封印绶", `+${bd.enfeoff || 0}`, "金印紫绶册封", "info", "han_vassals")}
        ${dMetricCard("乌垒/车师枢纽", `+${bd.hub || 0}`, "南北道锁钥控制", "info", "han_merit")}
        ${dMetricCard("塞外军屯分项", `+${bd.tuntian || ttCount * 4.5}`, `已开军屯 ${ttCount} 处`, "good", "total_grain")}
        ${dMetricCard("罢黜僮仆都尉", v1.tribes.tongpu_active ? "+0 (尚存)" : "+10 (已罢)", v1.tribes.tongpu_active ? "迎降日逐王可永罢" : "匈奴赋敛已绝", v1.tribes.tongpu_active ? "warn" : "good", "rizhu_loyalty")}
      </div>
    `;

    const stateNodes = Object.values(st.nodes).filter((n) => n.relation);
    stateNodes.sort((a, b) => {
      const ra = a.relation;
      const rb = b.relation;
      if (GAME.diploSort.col === "han_inf") return rb.han_influence - ra.han_influence;
      if (GAME.diploSort.col === "xn_intim") return rb.xn_intimidation - ra.xn_intimidation;
      return Math.abs(55 - ra.han_influence) - Math.abs(55 - rb.han_influence);
    });

    const filteredNodes = stateNodes.filter((n) => {
      const r = n.relation;
      if (GAME.diploFilter === "han") return r.overlord === "han";
      if (GAME.diploFilter === "xn") return r.overlord === "xiongnu";
      if (GAME.diploFilter === "swing") return !r.overlord;
      return true;
    });

    const sortBtn = (id, col, label) => `<button id="${id}" class="d4-pol-btn ${GAME.diploSort.col === col ? "active" : ""}">${label}</button>`;

    container.innerHTML = `
      <div class="d-compact-summary">
        <strong>西域十八国符节总览与都护四阶宏图</strong> — 顶部四阶里程碑标示立府条件。点击任意指标卡可调阅<strong>功业 G 因果拆解</strong>，点击表内城郭可在舆图居中检视。
      </div>
      <div class="d-ms-grid">${msHtml}</div>
      ${kpiRow}
      ${
        side === "han"
          ? `
        <div class="d-card" style="margin-bottom:8px;">
          ${dSecHdr("西域都护破局大政", "关键战略决断")}
          <div class="action-grid" style="grid-template-columns:repeat(3,1fr);">
            <button class="btn btn-gold act" id="btn-diplo-welcome-rizhu"><span class="act-title">迎降日逐王先贤掸</span><span class="act-meta">功业 +25 · 永罢僮仆都尉</span></button>
            <button class="btn act" id="btn-diplo-raid-tongpu"><span class="act-title">邀击焉耆僮仆税队</span><span class="act-meta">+320 钱 · 日逐忠诚 −9</span></button>
            <button class="btn btn-emerald act" id="btn-diplo-levy-vassals"><span class="act-title">持节发诸国与乌孙兵</span><span class="act-meta">260 钱 · 征调胡骑会师</span></button>
          </div>
        </div>
      `
          : ""
      }
      <div class="d-subtabs" style="justify-content:space-between;align-items:center;">
        <div style="display:flex;gap:5px;">
          <button type="button" class="d-subtab ${GAME.diploFilter === "all" ? "active" : ""}" data-df="all">全部城邦 (${stateNodes.length})</button>
          <button type="button" class="d-subtab ${GAME.diploFilter === "han" ? "active" : ""}" data-df="han">汉内属 (${stateNodes.filter((n) => n.relation.overlord === "han").length})</button>
          <button type="button" class="d-subtab ${GAME.diploFilter === "xn" ? "active" : ""}" data-df="xn">匈奴属 (${stateNodes.filter((n) => n.relation.overlord === "xiongnu").length})</button>
          <button type="button" class="d-subtab ${GAME.diploFilter === "swing" ? "active" : ""}" data-df="swing">中立摇摆 (${stateNodes.filter((n) => !n.relation.overlord).length})</button>
        </div>
        <div class="d4-btn-group">
          ${sortBtn("sort-by-gap", "gap", "按临界排序")}${sortBtn("sort-by-han", "han_inf", "按汉影响")}${sortBtn("sort-by-xn", "xn_intim", "按匈威吓")}
        </div>
      </div>
      <div class="d-card" style="padding:0;">
        <table class="d-table">
          <thead>
            <tr><th>邦国</th><th>宗主归属</th><th style="text-align:right">亲汉度</th><th style="text-align:right">畏匈度</th><th style="text-align:right">怨匈度</th><th>过境供粮姿态</th><th style="text-align:right">仓廪储粮</th><th style="text-align:right">当季符节指令</th></tr>
          </thead>
          <tbody>
            ${filteredNodes
              .map((n) => {
                const r = n.relation;
                const ovBadge =
                  r.overlord === "han"
                    ? '<span class="badge badge-red">汉属</span>'
                    : r.overlord === "xiongnu"
                    ? '<span class="badge badge-blue">匈属</span>'
                    : '<span class="badge">独立</span>';
                return `
                <tr data-row-nid="${n.id}" class="${n.id === GAME.selectedNodeId ? "sel" : ""}" style="cursor:pointer">
                  <td><strong style="color:var(--crimson)">${n.name}</strong>${r.crimes > 0 ? ' <span class="badge badge-red" style="padding:0 4px;">罪</span>' : ""}</td>
                  <td>${ovBadge}</td>
                  <td class="num" style="color:var(--han-light);font-weight:700">${r.han_influence.toFixed(0)}</td>
                  <td class="num" style="color:var(--xn-light);font-weight:700">${r.xn_intimidation.toFixed(0)}</td>
                  <td class="num" style="color:${r.xn_resentment >= 30 ? "var(--cobalt)" : "var(--muted)"}">${r.xn_resentment.toFixed(0)}</td>
                  <td><span style="color:${r.forage ? tone(r.forage.color) : "var(--gold-light)"}; font-weight:600;">${r.forage ? r.forage.label.split(/[（(]/)[0] : "平价开市"}</span></td>
                  <td class="num">${((n.grain || 0) / 1000).toFixed(0)}k 石</td>
                  <td style="text-align:right">
                    ${
                      side === "han"
                        ? `<button class="d4-pol-btn" data-quick-envoy="${n.id}">精使(260)</button> <button class="d4-pol-btn" data-quick-vassal="${n.id}">册封(240)</button>`
                        : `<button class="d4-pol-btn" data-quick-intim="${n.id}">铁骑威压</button>`
                    }
                  </td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    if (side === "han") {
      document.getElementById("btn-diplo-welcome-rizhu").onclick = () =>
        queueCustomOrder({
          type: "welcome_rizhu",
          desc: "【史诗破局】郑吉发渠犁屯兵赴乌垒迎降匈奴日逐王先贤掸 (功业+25，永久罢僮仆都尉)",
          cost_money: 0,
          target_node: "wu_lei",
          raw: { faction: "han" },
        });
      document.getElementById("btn-diplo-raid-tongpu").onclick = () =>
        queueCustomOrder({
          type: "intercept_tongpu",
          desc: "【北道截击】遣轻骑邀击焉耆僮仆都尉税队 (获金+320，日逐王忠诚-9)",
          cost_money: 0,
          target_node: "yan_qi",
          raw: {},
        });
      document.getElementById("btn-diplo-levy-vassals").onclick = () =>
        queueCustomOrder({
          type: "levy_vassal_troops",
          desc: "【持节发诸国兵】长罗侯常惠持汉节征调西域属国与乌孙胡骑会师前线",
          cost_money: 260,
          target_node: "wu_lei",
          raw: {},
        });
    }

    container.querySelectorAll("[data-df]").forEach((btn) => {
      btn.onclick = () => {
        GAME.diploFilter = btn.getAttribute("data-df");
        renderPanelDiplomacy(container);
        polishPanel(container);
        bindDrawerCausalClicks(container);
      };
    });

    document.getElementById("sort-by-gap").onclick = () => {
      GAME.diploSort.col = "gap";
      renderPanelDiplomacy(container);
      polishPanel(container);
      bindDrawerCausalClicks(container);
    };
    document.getElementById("sort-by-han").onclick = () => {
      GAME.diploSort.col = "han_inf";
      renderPanelDiplomacy(container);
      polishPanel(container);
      bindDrawerCausalClicks(container);
    };
    document.getElementById("sort-by-xn").onclick = () => {
      GAME.diploSort.col = "xn_intim";
      renderPanelDiplomacy(container);
      polishPanel(container);
      bindDrawerCausalClicks(container);
    };

    container.querySelectorAll("[data-row-nid]").forEach((trEl) => {
      trEl.addEventListener("click", () => {
        const nid = trEl.getAttribute("data-row-nid");
        GAME.selectedNodeId = nid;
        GAME.planDraft.target = nid;
        renderStrategicMap();
        renderFoodCurveDrawer();
        renderOutliner();
        container.querySelectorAll("tr.sel").forEach((r) => r.classList.remove("sel"));
        trEl.classList.add("sel");
      });
    });

    container.querySelectorAll("[data-quick-envoy]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const nid = btn.getAttribute("data-quick-envoy");
        const nm = st.nodes[nid] ? st.nodes[nid].name : nid;
        queueCustomOrder({ type: "dispatch_elite_envoy", desc: `【精使抚谕】遣持节精使团赴【${nm}】(汉影响力+18)`, cost_money: 260, target_node: nid, raw: { state: nid } });
      });
    });
    container.querySelectorAll("[data-quick-vassal]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const nid = btn.getAttribute("data-quick-vassal");
        const nm = st.nodes[nid] ? st.nodes[nid].name : nid;
        queueCustomOrder({ type: "make_vassal", desc: `【赐印册封】册封【${nm}】为大汉内属国 (都护功业+6)`, cost_money: 240, target_node: nid, raw: { state: nid } });
      });
    });
    container.querySelectorAll("[data-quick-intim]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const nid = btn.getAttribute("data-quick-intim");
        const nm = st.nodes[nid] ? st.nodes[nid].name : nid;
        queueCustomOrder({ type: "intimidate_city", desc: `【控弦威压】遣铁骑巡行威压【${nm}】(匈奴威吓+16)`, cost_money: 0, target_node: nid, raw: { state: nid } });
      });
    });
  }


  // ---- [F4] 仓廪 · 万里粮道、粟米瀑布流账本与塞外军屯矩阵（对标 D5_Economy） ----
  function renderPanelLogistics(container) {
    const st = GAME.state;
    const v1 = st.v1;
    const rawSls = (v1 && v1.logistics.supply_lines) || [];
    const sls = rawSls.map((s) =>
      typeof s === "string"
        ? {
            name: `河西 → ${st.nodes[s] ? st.nodes[s].name : s} 主粮道`,
            from: "jiu_quan",
            to: s,
            laborers: 2000,
            delivered_30d: 18000,
            escort: true,
            status: "active",
          }
        : s
    );
    const ttNodes = (v1 && v1.logistics.tuntian_nodes) || {};
    const ttCount = Object.keys(ttNodes).length;
    const totalGrainK = Math.round(Object.values(st.nodes).reduce((s, n) => s + (n.grain || 0), 0) / 1000);
    const totalLab = sls.reduce((s, l) => s + (l.laborers || 0), 0);

    const hexiIn = 185;
    const tuntianIn = ttCount * 42;
    const convoyIn = sls.length * 18;
    const armyEat = 140;
    const desertLoss = sls.length * 6 + 12;
    const netGrainK = hexiIn + tuntianIn + convoyIn - armyEat - desertLoss;
    const maxRef = Math.max(240, hexiIn + tuntianIn + convoyIn);

    const kpiRow = `
      <div class="d-kpi-grid-6">
        ${dMetricCard("西域总仓廪", `${totalGrainK.toLocaleString()}k 石`, "河西与塞外存粟", "good", "total_grain")}
        ${dMetricCard("季度粟米净结余", `${netGrainK >= 0 ? "+" : ""}${netGrainK}k 石`, netGrainK >= 0 ? "军食充盈" : "仓廪吃紧", netGrainK >= 0 ? "good" : "bad", "total_grain")}
        ${dMetricCard("运转中补给线", `${sls.length} 条`, `征调民夫 ${totalLab.toLocaleString()} 人`, "info", "total_grain")}
        ${dMetricCard("塞外军屯点", `${ttCount} 处`, `每季产粟 +${tuntianIn}k 石`, "good", "total_grain")}
        ${dMetricCard("太仆官马池", `${(st.scores.han_horse_pool || 5000).toLocaleString()} 匹`, "驮运与轻骑战马", "info", "han_money")}
        ${dMetricCard("汉塞烽燧覆盖", `${Object.values(st.nodes).filter((n) => n.has_beacon).length} 座`, "防备匈奴截粮", "info", "han_merit")}
      </div>
    `;

    const leftCol = `
      <div class="d-card">
        ${dSecHdr("西域全境粟米收支瀑布流账本 (千石/季)", `<span style="cursor:pointer;color:var(--cobalt)" data-explain-key="total_grain">因果拆解 ▾</span>`)}
        <div class="d4-waterfall">
          ${dWaterfallRow("河西四郡与关中岁漕拨入", `+${hexiIn}k 石`, (hexiIn / maxRef) * 100, true)}
          ${dWaterfallRow(`塞外戊己军屯秋收产出 (${ttCount}处)`, `+${tuntianIn}k 石`, (tuntianIn / maxRef) * 100, true)}
          ${dWaterfallRow(`万里自动补给线前推净增 (${sls.length}条)`, `+${convoyIn}k 石`, (convoyIn / maxRef) * 100, true)}
          ${dWaterfallRow("各城守备与在编野战军坐食", `-${armyEat}k 石`, (armyEat / maxRef) * 100, false)}
          ${dWaterfallRow("白龙堆流沙脚耗与风沙摩耗", `-${desertLoss}k 石`, (desertLoss / maxRef) * 100, false)}
          <div style="display:flex;justify-content:space-between;padding-top:6px;border-top:1px solid var(--line-strong);font-size:12px;font-weight:700;">
            <span>本季粟米净收支平衡</span>
            <span class="num" style="color:${netGrainK >= 0 ? "var(--jade)" : "var(--crimson)"}">${netGrainK >= 0 ? "+" : ""}${netGrainK}k 石/季</span>
          </div>
        </div>
      </div>

      <div class="d-card">
        ${dSecHdr("万里自动补给线管理与新辟", `${sls.length} 条运转中`)}
        ${
          sls.length
            ? `<table class="d-table" style="margin-bottom:8px;">
                <thead><tr><th>粮道名称</th><th>民夫编制</th><th>月运抵量</th><th>护粮策略</th></tr></thead>
                <tbody>
                  ${sls
                    .map(
                      (s) => `<tr>
                        <td><strong style="color:var(--jade)">${s.name}</strong></td>
                        <td class="num">${s.laborers} 人</td>
                        <td class="num">+${((s.delivered_30d || 18000) / 1000).toFixed(1)}k 斛</td>
                        <td>${s.escort ? "军兵护送" : "遇敌即停"}</td>
                      </tr>`
                    )
                    .join("")}
                </tbody>
              </table>`
            : `<div class="note" style="margin-bottom:8px;">当前尚未开辟自动补给线，远征军出塞易越过不归点断粮。</div>`
        }
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
          <label style="font-size:12px; flex:1;">新粮道终点
            <select id="sel-sl-target" style="width:100%; margin-top:3px;">
              <option value="lou_lan">楼兰 (盐泽枢要)</option>
              <option value="qu_li">渠犁 (南北道交汇屯田区)</option>
              <option value="wu_lei">乌垒 (西域都护府治所)</option>
              <option value="cheshi_qian">车师前王庭 (北道前线)</option>
              <option value="lun_tai">轮台 (北道重镇)</option>
            </select>
          </label>
          <label style="font-size:12px; flex:1;">民夫配额 (<span id="lbl-sl-lab">2500</span>人)：
            <input type="range" id="rng-sl-lab" min="1000" max="5000" step="500" value="2500" style="margin-top:6px;"/>
          </label>
        </div>
        <button class="btn btn-gold" id="btn-create-sl" style="width:100%;">拉通敦煌 → 终点自动补给线（180 钱）</button>
      </div>
    `;

    const keyHubs = ["dun_huang", "lou_lan", "qu_li", "lun_tai", "wu_lei", "qiu_ci", "yan_qi", "cheshi_qian", "yu_tian", "shu_le"];
    const hubRows = keyHubs
      .map((nid) => {
        const nd = st.nodes[nid];
        if (!nd) return "";
        const tLv = nd.tuntian_lv || ttNodes[nid] || 0;
        return `
          <tr>
            <td><strong style="cursor:pointer;color:var(--crimson)" data-log-jump="${nid}">${nd.name}</strong></td>
            <td>${ownerLabel(nd)}</td>
            <td class="num">${((nd.grain || 0) / 1000).toFixed(0)}k 石</td>
            <td class="num" style="color:${tLv > 0 ? "var(--jade)" : "var(--muted)"};font-weight:700">${tLv > 0 ? `Lv.${tLv}` : "—"}</td>
            <td>${nd.has_beacon ? '<span style="color:var(--cobalt);font-weight:700">● 已筑</span>' : '<span style="color:var(--muted)">无</span>'}</td>
          </tr>
        `;
      })
      .join("");

    const rightCol = `
      <div class="d-card">
        ${dSecHdr("西域十镇军屯与烽燧亭障矩阵", "桑弘羊《轮台屯田诏》方略")}
        <table class="d-table" style="margin-bottom:8px;">
          <thead><tr><th>重镇要塞</th><th>当前宗主</th><th>仓廪储粮</th><th>戊己军屯</th><th>烽燧亭障</th></tr></thead>
          <tbody>${hubRows}</tbody>
        </table>
        <div class="action-grid">
          <button class="btn btn-emerald" id="btn-log-tuntian-loulan">开置【楼兰】军屯 (+42k粮/+4.5G)</button>
          <button class="btn btn-emerald" id="btn-log-tuntian-quli">开置【渠犁】军屯 (+42k粮/+4.5G)</button>
          <button class="btn btn-emerald" id="btn-log-tuntian-wulei">开置【乌垒】都护屯田 (+4.5G)</button>
          <button class="btn" id="btn-log-beacon-loulan">修筑【楼兰—渠犁】烽燧链 (150钱)</button>
        </div>
      </div>
    `;

    container.innerHTML = `
      <div class="d-compact-summary">
        <strong>河西转运与塞外屯田总账</strong> — 《孙子》云：「千里馈粮，士有饥色。」以<strong>塞外戊己军屯就地生粟</strong>结合<strong>万里自动补给线</strong>，方能支撑长驱天山南北。
      </div>
      ${kpiRow}
      <div class="d-two-col">
        <div class="d-col">${leftCol}</div>
        <div class="d-col">${rightCol}</div>
      </div>
    `;

    container.querySelectorAll("[data-log-jump]").forEach((el) => {
      el.onclick = () => selectNodeAndPan(el.getAttribute("data-log-jump"), "logistics", false);
    });

    document.getElementById("rng-sl-lab").oninput = (e) => {
      document.getElementById("lbl-sl-lab").textContent = e.target.value;
    };
    document.getElementById("btn-create-sl").onclick = () => {
      const toId = document.getElementById("sel-sl-target").value;
      const lab = parseInt(document.getElementById("rng-sl-lab").value, 10);
      const nm = st.nodes[toId] ? st.nodes[toId].name : toId;
      queueCustomOrder({
        type: "set_supply_line",
        desc: `【万里粮道】拉通「敦煌 → ${nm}」自动补给线 (民夫 ${lab} 人，月运 ${((lab * 9) / 1000).toFixed(1)}k 斛)`,
        cost_money: 180,
        target_node: toId,
        raw: { from: "dun_huang", to: toId, laborers: lab, escort: true },
      });
    };
    document.getElementById("btn-log-tuntian-loulan").onclick = () =>
      queueCustomOrder({ type: "build_tuntian", desc: "【塞外军屯】在【楼兰】扩建军屯 (储粮+42k，功业+4.5)", cost_money: 220, target_node: "lou_lan", raw: { node: "lou_lan" } });
    document.getElementById("btn-log-tuntian-quli").onclick = () =>
      queueCustomOrder({ type: "build_tuntian", desc: "【塞外军屯】在【渠犁】开置军屯 (储粮+42k，功业+4.5)", cost_money: 220, target_node: "qu_li", raw: { node: "qu_li" } });
    document.getElementById("btn-log-tuntian-wulei").onclick = () =>
      queueCustomOrder({ type: "build_tuntian", desc: "【都护军屯】在【乌垒】开置都护府治所军屯 (储粮+42k，功业+4.5)", cost_money: 220, target_node: "wu_lei", raw: { node: "wu_lei" } });
    document.getElementById("btn-log-beacon-loulan").onclick = () =>
      queueCustomOrder({ type: "build_beacon", desc: "【汉塞烽燧】在【楼兰】修筑烽燧亭障，点亮白龙堆至罗布泊精确视野", cost_money: 150, target_node: "lou_lan", raw: { node: "lou_lan" } });
  }

  // ---- [F5] 虎符 · 诸军节度与远征作战计划编辑器（对标 D7_MilitaryIntel） ----
  function renderPanelMilitary(container) {
    const st = GAME.state;
    const side = st.meta.side;
    const targetNode = st.nodes[GAME.planDraft.target] || st.nodes.lou_lan;

    const myArmies = [];
    const oppArmies = [];
    for (const [nid, nd] of Object.entries(st.nodes)) {
      for (const a of nd.armies || []) {
        if ((a.soldiers || 0) <= 0) continue;
        const item = { nid, loc: nd.name, name: a.name, cmd: a.commander_name || "校尉", s: a.soldiers, h: a.horses || 0 };
        if (a.faction === side) myArmies.push(item);
        else oppArmies.push(item);
      }
    }
    const myTotal = myArmies.reduce((s, a) => s + a.s, 0);
    const oppTotal = oppArmies.reduce((s, a) => s + a.s, 0);

    const kpiRow = `
      <div class="d-kpi-grid-6">
        ${dMetricCard("我方在编总兵力", `${myTotal.toLocaleString()} 人`, `${myArmies.length} 部驻外主力`, "good", "total_grain")}
        ${dMetricCard("已知敌军兵力", `${oppTotal.toLocaleString()} 人`, `${oppArmies.length} 部敌方军团`, "bad", "han_merit")}
        ${dMetricCard("拟征目标城塞", targetNode ? targetNode.name : "楼兰", targetNode ? ownerLabel(targetNode) : "", "info", `node_${targetNode ? targetNode.id : "lou_lan"}`)}
        ${dMetricCard("拟调战兵规模", `${GAME.planDraft.soldiers.toLocaleString()} 人`, `随军民夫 ${GAME.planDraft.laborers.toLocaleString()}`, "", "total_grain")}
        ${dMetricCard("常备行军指令", GAME.planDraft.standingOrder === "cautious" ? "谨慎保军" : GAME.planDraft.standingOrder === "aggressive" ? "见利则进" : "均衡推进", "与底部口粮折线联动", GAME.planDraft.standingOrder === "aggressive" ? "bad" : "good", "total_grain")}
        ${dMetricCard("本季已拟军令", `${GAME.queuedOrders.length} 道`, "Space 键结束本季推演", "info", "han_merit")}
      </div>
    `;

    const leftCol = `
      <div class="d-card">
        ${dSecHdr("虎符远征方略拟定台", "与底部 0–18 旬口粮不归点折线实时联动")}
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:12px; margin-bottom:8px;">
          <label>出发策源地
            <select id="mil-sel-origin" style="width:100%; margin-top:3px;">
              ${
                side === "han"
                  ? `<option value="dun_huang" ${GAME.planDraft.origin === "dun_huang" ? "selected" : ""}>敦煌大本营 (赵破奴军)</option>
                     <option value="jiu_quan" ${GAME.planDraft.origin === "jiu_quan" ? "selected" : ""}>酒泉军镇 (霍去病/李广利)</option>
                     <option value="wu_lei" ${GAME.planDraft.origin === "wu_lei" ? "selected" : ""}>乌垒前线都护营 (郑吉)</option>`
                  : `<option value="chanyu_ting" ${GAME.planDraft.origin === "chanyu_ting" ? "selected" : ""}>漠南单于庭 (伊稚斜亲军)</option>
                     <option value="cheshi_qian" ${GAME.planDraft.origin === "cheshi_qian" ? "selected" : ""}>车师前王庭 (右贤王/日逐王骑)</option>`
              }
            </select>
          </label>
          <label>进击目标（可在舆图直接点选）
            <select id="mil-sel-target" style="width:100%; margin-top:3px;">
              ${Object.values(st.nodes)
                .map((n) => `<option value="${n.id}" ${n.id === GAME.planDraft.target ? "selected" : ""}>${n.name}</option>`)
                .join("")}
            </select>
          </label>
          <label>战兵编制 (<strong id="lbl-mil-soldiers">${GAME.planDraft.soldiers}</strong>人)：
            <input type="range" id="rng-mil-soldiers" min="1500" max="12000" step="500" value="${GAME.planDraft.soldiers}" style="margin-top:5px;"/>
          </label>
          <label>随军民夫 (<strong id="lbl-mil-lab">${GAME.planDraft.laborers}</strong>人)：
            <input type="range" id="rng-mil-lab" min="500" max="6000" step="500" value="${GAME.planDraft.laborers}" style="margin-top:5px;"/>
          </label>
        </div>
        <div style="margin-bottom:8px;">
          <label style="font-size:12px;">将军常备指令 (Standing Order)
            <select id="mil-sel-standing" style="width:100%; margin-top:3px;">
              <option value="cautious" ${GAME.planDraft.standingOrder === "cautious" ? "selected" : ""}>谨慎保军 · 余粮触及返程线即自动班师</option>
              <option value="standard" ${GAME.planDraft.standingOrder === "standard" ? "selected" : ""}>均衡推进 · 常规行军围城</option>
              <option value="aggressive" ${GAME.planDraft.standingOrder === "aggressive" ? "selected" : ""}>见利则进 · 强攻到底，越不归点断粮则饿死</option>
            </select>
          </label>
        </div>
        <button class="btn btn-han" id="btn-mil-commit-plan" style="width:100%; padding:8px;">传檄 · 远征${targetNode ? targetNode.name : "目标"} (180 钱)</button>
      </div>

      <div class="d-card">
        ${dSecHdr("我方在编野战军团总表", `${myArmies.length} 部`)}
        <table class="d-table">
          <thead><tr><th>军团番号</th><th>主将</th><th>现驻防区</th><th style="text-align:right">兵力</th><th style="text-align:right">战马</th></tr></thead>
          <tbody>
            ${
              myArmies
                .map(
                  (a) => `<tr style="cursor:pointer" data-mil-jump="${a.nid}">
                    <td><strong>${a.name}</strong></td>
                    <td>${a.cmd}</td>
                    <td style="color:var(--crimson);font-weight:700">${a.loc}</td>
                    <td class="num">${a.s.toLocaleString()}</td>
                    <td class="num">${a.h.toLocaleString()}</td>
                  </tr>`
                )
                .join("") || `<tr><td colspan="5" style="color:var(--muted)">暂无野战军</td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;

    const waypoints =
      side === "han"
        ? ["dun_huang", "yu_men_guan", "lou_lan", targetNode && targetNode.id !== "lou_lan" ? targetNode.id : "qu_li"]
        : ["chanyu_ting", "cheshi_hou", "cheshi_qian", targetNode ? targetNode.id : "lou_lan"];
    const segRows = waypoints
      .map((nid, idx) => {
        const nd = st.nodes[nid];
        if (!nd) return "";
        const rel = nd.relation;
        const forageLbl = rel && rel.forage ? rel.forage.label.split(/[（(]/)[0] : "己方官仓直供";
        const forageCol = rel && rel.forage ? tone(rel.forage.color) : "var(--jade)";
        const lossRate = idx === 0 ? "0%" : rel && rel.forage && rel.forage.attrition_mult > 1.2 ? "4.6% / 旬" : "1.5% / 旬";
        return `<tr>
          <td>第 ${idx + 1} 站 · <strong>${nd.name}</strong></td>
          <td>${ownerLabel(nd)}</td>
          <td style="color:${forageCol};font-weight:700">${forageLbl}</td>
          <td class="num">${lossRate}</td>
        </tr>`;
      })
      .join("");

    const rightCol = `
      <div class="d-card">
        ${dSecHdr(`远征【${targetNode ? targetNode.name : "楼兰"}】沿途就食与损耗预演`, "闭门绝市将加剧非战斗减员")}
        <table class="d-table">
          <thead><tr><th>行军途经站</th><th>所属宗主</th><th>过境供粮姿态</th><th style="text-align:right">预计行军损耗</th></tr></thead>
          <tbody>${segRows}</tbody>
        </table>
      </div>

      <div class="d-card">
        ${dSecHdr("已知敌方主力动向与边塞威胁", `${oppArmies.length} 部`)}
        <table class="d-table">
          <thead><tr><th>敌方番号</th><th>统帅</th><th>驻地</th><th style="text-align:right">估计兵力</th></tr></thead>
          <tbody>
            ${
              oppArmies
                .slice(0, 6)
                .map(
                  (a) => `<tr style="cursor:pointer" data-mil-jump="${a.nid}">
                    <td><strong>${a.name}</strong></td>
                    <td>${a.cmd}</td>
                    <td style="color:var(--cobalt);font-weight:700">${a.loc}</td>
                    <td class="num">${a.s.toLocaleString()}</td>
                  </tr>`
                )
                .join("") || `<tr><td colspan="4" style="color:var(--muted)">斥候尚未探得敌方主力</td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = `
      <div class="d-compact-summary">
        <strong>虎符调兵与万里远征推演</strong> — 西域用兵，胜负七分在粮道、三分在锋镝。下方可拟定远征兵力与常备指令，并对照底栏<strong>0–18旬口粮曲线</strong>防范断粮饿死。
      </div>
      ${kpiRow}
      <div class="d-two-col">
        <div class="d-col">${leftCol}</div>
        <div class="d-col">${rightCol}</div>
      </div>
    `;

    container.querySelectorAll("[data-mil-jump]").forEach((el) => {
      el.onclick = () => selectNodeAndPan(el.getAttribute("data-mil-jump"), "military", false);
    });

    document.getElementById("mil-sel-origin").onchange = (e) => {
      GAME.planDraft.origin = e.target.value;
      renderFoodCurveDrawer();
    };
    document.getElementById("mil-sel-target").onchange = (e) => {
      GAME.planDraft.target = e.target.value;
      GAME.selectedNodeId = e.target.value;
      renderStrategicMap();
      renderFoodCurveDrawer();
      renderPanelMilitary(container);
      polishPanel(container);
      bindDrawerCausalClicks(container);
    };
    document.getElementById("rng-mil-soldiers").oninput = (e) => {
      GAME.planDraft.soldiers = parseInt(e.target.value, 10);
      document.getElementById("lbl-mil-soldiers").textContent = e.target.value;
      renderFoodCurveDrawer();
    };
    document.getElementById("rng-mil-lab").oninput = (e) => {
      GAME.planDraft.laborers = parseInt(e.target.value, 10);
      document.getElementById("lbl-mil-lab").textContent = e.target.value;
      renderFoodCurveDrawer();
    };
    document.getElementById("mil-sel-standing").onchange = (e) => {
      GAME.planDraft.standingOrder = e.target.value;
      renderFoodCurveDrawer();
    };
    document.getElementById("btn-mil-commit-plan").onclick = () => {
      const tNode = st.nodes[GAME.planDraft.target] || st.nodes.lou_lan;
      queueCustomOrder({
        type: "set_plan",
        desc: `【传檄远征】发兵 ${GAME.planDraft.soldiers.toLocaleString()} 人进击【${tNode.name}】(常备指令：${GAME.planDraft.standingOrder === "cautious" ? "谨慎保军" : GAME.planDraft.standingOrder === "aggressive" ? "见利则进" : "均衡推进"})`,
        cost_money: 180,
        target_node: tNode.id,
        raw: {
          origin: GAME.planDraft.origin,
          target: tNode.id,
          soldiers: GAME.planDraft.soldiers,
          standing_order: GAME.planDraft.standingOrder,
        },
      });
    };
  }

  // ---- [F6] 史册 · 太史竹帛战报流与断粮饿死单列面板 ----
  function renderPanelChronicle(container) {
    const st = GAME.state;
    const logs = [...(st.turn_logs || [])].reverse();
    const reports = st.battle_reports || [];
    const totalCombat = reports.reduce((s, r) => s + (r.attacker_combat_loss || 0) + (r.defender_loss || 0), 0);
    const totalStarve = st.scores.starve_losses || reports.reduce((s, r) => s + (r.attacker_starve_loss || 0), 0);

    const kpiRow = `
      <div class="d-kpi-grid-6">
        ${dMetricCard("当前纪年", st.meta.date_text.replace(/\s.*$/, ""), `第 ${st.meta.turn + 1} / ${st.meta.max_turns} 季`, "info", "han_merit")}
        ${dMetricCard("西域会战总计", `${reports.length} 役`, "点击详报查阅伤亡拆解", "", "han_merit")}
        ${dMetricCard("累计交锋阵亡", `${totalCombat.toLocaleString()} 人`, "两军白刃矢石伤亡", "bad", "total_grain")}
        ${dMetricCard("累计断粮饿死", `${totalStarve.toLocaleString()} 人`, "越过不归点非战斗减员", "warn", "total_grain")}
        ${dMetricCard("太史实录卷数", `${logs.length} 季`, "点击条目定位城邦", "", "han_merit")}
        ${dMetricCard("大局功业 G", `${st.v1.victory.han_merit.toFixed(1)} / 100`, `属国 ${st.scores.han_vassals} / 18`, "good", "han_merit")}
      </div>
    `;

    const leftCol = `
      <div class="d-card">
        ${dSecHdr("历次会战 · 阵亡与断粮饿死分列账本", `累计饿死 ${totalStarve} 人`)}
        ${
          reports.length === 0
            ? `<div style="font-size:12px; color:var(--text-muted); padding:6px 0;">尚无交战记录。下达远征军令并推进一季后，战报会出现在这里。</div>`
            : `<table class="d-table">
                <thead><tr><th>战役</th><th>主将</th><th>战果</th><th style="text-align:right">阵亡</th><th style="text-align:right">断粮饿死</th><th></th></tr></thead>
                <tbody>
                  ${reports
                    .slice(0, 8)
                    .map(
                      (br) => `<tr>
                        <td><strong>第${br.turn}季·${br.node_name}</strong></td>
                        <td>${br.commander}</td>
                        <td><span class="badge ${br.victory ? "badge-green" : "badge-red"}">${br.victory ? "大捷" : "激战"}</span></td>
                        <td class="num">${(br.attacker_combat_loss || 0).toLocaleString()}</td>
                        <td class="num" style="color:var(--crimson);font-weight:700">${(br.attacker_starve_loss || 0).toLocaleString()}</td>
                        <td style="text-align:right"><button class="d4-pol-btn" data-open-battle="${br.id}">详报</button></td>
                      </tr>`
                    )
                    .join("")}
                </tbody>
              </table>`
        }
      </div>

      <div class="d-card">
        ${dSecHdr("太史公西域大势评")}
        <div style="font-size:12px;color:var(--ink-2);line-height:1.6;font-style:italic;">
          「太史公曰：自张骞开外国道以尊贵其吏，汉室岁发使者十余辈，楼兰、姑师当道苦之。夫善用兵者，先筑亭障、广开轮台渠犁之屯，令士卒宿饱而后鸣镝西指，则三十六国莫不奉珍纳质矣。」
        </div>
      </div>
    `;

    const rightCol = `
      <div class="d-card">
        ${dSecHdr("太史公编年纪事长卷", "点击条目定位城邦")}
        <div style="max-height:380px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
          ${
            logs.length === 0
              ? `<div style="color:var(--text-muted); font-size:12px;">尚无纪事。拟定军令后点击右下角「结束本季」开始推演。</div>`
              : logs
                  .map(
                    (lg) => `
                <div class="log-turn">
                  <div class="log-turn-title">第 ${lg.turn} 季 · ${lg.date}</div>
                  ${(lg.events || [])
                    .map(
                      (ev) => `
                    <div class="log-ev" data-ev-node="${ev.node || ""}">
                      ${ev.text}
                    </div>
                  `
                    )
                    .join("")}
                </div>
              `
                  )
                  .join("")
          }
        </div>
      </div>
    `;

    container.innerHTML = `
      <div class="d-compact-summary">
        <strong>《太史公书·西域传》战报与编年实录</strong> — 每一役皆严格分列<strong>锋镝阵亡</strong>与<strong>越过不归点断粮饿死</strong>，还原《史记·大宛列传》「士卒物故大半，皆饥渴死」之历史考据。
      </div>
      ${kpiRow}
      <div class="d-two-col">
        <div class="d-col">${leftCol}</div>
        <div class="d-col">${rightCol}</div>
      </div>
    `;

    container.querySelectorAll("[data-open-battle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const bid = btn.getAttribute("data-open-battle");
        openBattleDetailModal(bid);
      });
    });

    container.querySelectorAll("[data-ev-node]").forEach((el) => {
      el.addEventListener("click", () => {
        const nid = el.getAttribute("data-ev-node");
        if (nid && st.nodes[nid]) {
          selectNodeAndPan(nid, "inspector", true);
        }
      });
    });
  }

  // ==================== 7. 底部本季已拟军令队列栏 ====================
  function queueCustomOrder(orderObj) {
    if (GAME.replaying) return;
    if (GAME.queuedOrders.some((o) => o.desc === orderObj.desc)) {
      showOrderToast("此令已在本季军令中", true);
      return;
    }
    showOrderToast(`已拟令：${orderObj.desc.replace(/^【[^】]*】/, "")}`);
    GAME.queuedOrders.push({
      id: "ord_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      ...orderObj,
    });
    renderTopHUD();
    renderBottomOrderQueue();
  }

  function renderBottomOrderQueue() {
    const bar = document.getElementById("dock-order-bar");
    if (!bar) return;
    const total = GAME.queuedOrders.reduce((acc, o) => acc + (o.cost_money || 0), 0);
    const sealSub = document.getElementById("seal-sub");
    if (sealSub) sealSub.textContent = GAME.queuedOrders.length ? `Space · 已拟 ${GAME.queuedOrders.length} 令` : "Space · 未拟令则幕僚代拟";
    if (GAME.queuedOrders.length === 0) {
      bar.innerHTML = `
        <div class="queue-head"><span class="title">本季军令</span><span style="color:var(--text-faint)">0 道</span></div>
        <div class="queue-empty">尚未拟令。从底部器物打开抽屉下令；直接用印则由幕僚代拟。</div>
      `;
      return;
    }

    bar.innerHTML = `
      <div class="queue-head">
        <span class="title">本季军令 · ${GAME.queuedOrders.length} 道</span>
        <span style="display:flex;gap:8px;align-items:center;">
          <span style="color:var(--text-muted)">合计 ${total.toLocaleString()} 钱</span>
          <button class="btn btn-xs btn-ghost" id="btn-clear-queue">清空</button>
        </span>
      </div>
      <div class="queue-list">
        ${GAME.queuedOrders
          .map(
            (o, i) => `
          <div class="queue-item" title="${o.desc.replace(/"/g, "&quot;")}">
            <span class="q-idx">${i + 1}</span>
            <span class="q-text">${o.desc}</span>
            ${o.cost_money ? `<span class="q-cost">${o.cost_money} 钱</span>` : ""}
            <button class="btn btn-xs btn-ghost" data-del-ord="${o.id}" title="撤回">×</button>
          </div>`
          )
          .join("")}
      </div>
    `;

    document.getElementById("btn-clear-queue").onclick = () => {
      GAME.queuedOrders = [];
      renderTopHUD();
      renderBottomOrderQueue();
    };
    bar.querySelectorAll("[data-del-ord]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const oid = btn.getAttribute("data-del-ord");
        GAME.queuedOrders = GAME.queuedOrders.filter((o) => o.id !== oid);
        renderTopHUD();
        renderBottomOrderQueue();
      });
    });
  }

  function fillAdvisorOrders() {
    const st = GAME.state;
    GAME.queuedOrders = [];
    const recs = (st.commands || []).filter((c) => c.recommended).slice(0, 3);
    for (const r of recs) {
      GAME.queuedOrders.push({
        id: "adv_" + r.idx,
        type: r.type,
        desc: r.desc,
        cost_money: r.cost_money || 0,
        target_node: r.target_node || "lou_lan",
        raw: r.raw || {},
      });
    }
    renderTopHUD();
    renderBottomOrderQueue();
  }

  // ==================== 8. 90日 (9旬) WEGO 动画回放与回合推进 ====================
  function advanceSeasonWithWEGOReplay() {
    if (GAME.replaying || !GAME.state) return;
    if (GAME.state.meta.winner) {
      openSeasonSummaryModal();
      return;
    }

    if (GAME.queuedOrders.length === 0) {
      fillAdvisorOrders();
    }

    const ordersToRun = deepClone(GAME.queuedOrders);
    const speedMs = parseInt(document.getElementById("sel-replay-speed").value || "110", 10);

    const nextState = engine.stepTurn([], false, ordersToRun);
    const latestLog = nextState.turn_logs[nextState.turn_logs.length - 1] || { events: [] };
    const evList = latestLog.events || [];

    if (speedMs <= 0) {
      GAME.state = nextState;
      GAME.queuedOrders = [];
      recordMetricSnapshot();
      refreshAllUI();
      saveToSlot("autosave");
      if (GAME.autoPopupSummary || GAME.state.meta.winner) openSeasonSummaryModal();
      return;
    }

    GAME.replaying = true;
    document.getElementById("btn-end-season").disabled = true;
    const bar = document.getElementById("wego-replay-bar");
    const tickLbl = document.getElementById("wego-replay-tick-label");
    const progFill = document.getElementById("wego-replay-progress");
    const toastEl = document.getElementById("wego-replay-event-toast");
    bar.style.display = "block";

    let curSubTick = 1;
    const timer = setInterval(() => {
      tickLbl.textContent = `第 ${curSubTick} / 9 旬 (${curSubTick * 10} 日)`;
      progFill.style.width = `${(curSubTick / 9) * 100}%`;
      const ev = evList[Math.min(evList.length - 1, Math.floor(((curSubTick - 1) / 9) * evList.length))];
      toastEl.textContent = ev ? ev.text : "塞下烽燧平安，转运司粟车络绎于道...";

      curSubTick += 1;
      if (curSubTick > 9) {
        clearInterval(timer);
        setTimeout(() => {
          bar.style.display = "none";
          GAME.replaying = false;
          document.getElementById("btn-end-season").disabled = false;
          GAME.state = nextState;
          GAME.queuedOrders = [];
          recordMetricSnapshot();
          refreshAllUI();
          saveToSlot("autosave");
          if (GAME.autoPopupSummary || GAME.state.meta.winner) {
            openSeasonSummaryModal();
          }
        }, 120);
      }
    }, speedMs);
  }

  // ==================== 9. 模态弹窗：季初太史纪事 / 战报详单 / 剧本与多槽存档 ====================
  function openSeasonSummaryModal() {
    const st = GAME.state;
    const modal = document.getElementById("modal-season-summary");
    document.getElementById("sum-modal-title").textContent = st.ending
      ? `终局 · ${st.ending.headline}`
      : `${st.meta.date_text} · 第 ${st.meta.turn + 1} 季纪事`;

    const chText = st.ending
      ? `${st.ending.biography}（汉评定：${st.ending.grade_han} | 匈奴评定：${st.ending.grade_xn}）`
      : GAME.useClassical
      ? st.chronicle.classical
      : st.chronicle.vernacular;
    document.getElementById("sum-modal-chronicle").textContent = String(chText || "").replace(/。{2,}/g, "。");

    const todosEl = document.getElementById("sum-modal-todos");
    todosEl.innerHTML = (st.chronicle.todos || [])
      .map(
        (t, idx) => `
      <div class="todo-card ${t.level === "urgent" ? "urgent" : ""}">
        <div>
          <div class="todo-title">${idx + 1}. ${t.title}</div>
          <div class="todo-detail">${t.detail}</div>
        </div>
        <button class="btn btn-sm" data-todo-panel="${t.jump_tab || "court"}" data-todo-node="${t.jump_node || "lou_lan"}">前往 ›</button>
      </div>
    `
      )
      .join("");

    todosEl.querySelectorAll("[data-todo-panel]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = btn.getAttribute("data-todo-panel");
        const nid = btn.getAttribute("data-todo-node");
        modal.classList.remove("open");
        selectNodeAndPan(nid, p, true);
      });
    });

    modal.classList.add("open");
  }

  function openBattleDetailModal(reportId) {
    const st = GAME.state;
    const br = (st.battle_reports || []).find((r) => r.id === reportId) || (st.battle_reports || [])[0];
    if (!br) return;
    const modal = document.getElementById("modal-battle-detail");
    document.getElementById("battle-modal-title").textContent = `第 ${br.turn} 季 · ${br.node_name}之战`;
    const row = (k, v, style) => `<div class="battle-row"><span class="k">${k}</span><strong style="${style || ""}">${v}</strong></div>`;
    document.getElementById("battle-modal-body").innerHTML = `
      <div class="chronicle-quote">${br.summary}</div>
      <div class="battle-grid">
        <div class="game-card">
          <div class="card-head"><span>攻方 · ${br.commander}</span></div>
          ${row("参战兵力", `${br.attacker_troops.toLocaleString()} 人`)}
          ${row("阵亡", `${br.attacker_combat_loss.toLocaleString()} 人`)}
          ${row("断粮饿死", `${br.attacker_starve_loss.toLocaleString()} 人`, "color:var(--han-light)")}
          ${row("常备指令", br.standing_order === "cautious" ? "谨慎保军" : "强攻")}
        </div>
        <div class="game-card">
          <div class="card-head"><span>守方 · ${br.node_name}</span></div>
          ${row("守城兵力", `${br.defender_troops.toLocaleString()} 人`)}
          ${row("斩首 / 溃散", `${br.defender_loss.toLocaleString()} 人`)}
          ${row("俘获马匹", `+${br.captured_horses} 匹`, "color:var(--green-light)")}
          ${row("结局", br.victory ? "城破" : "相持")}
        </div>
      </div>
    `;
    modal.classList.add("open");
  }

  // ==================== 10. 多槽位本地存档管理 (`localStorage`, S07-R13) ====================
  function saveToSlot(slotKey) {
    try {
      if (!GAME.state) return;
      const payload = {
        version: "v2.0.0",
        saved_at: new Date().toLocaleTimeString(),
        scenario: GAME.state.meta.scenario,
        side: GAME.state.meta.side,
        turn: GAME.state.meta.turn,
        date_text: GAME.state.meta.date_text,
        state: GAME.state,
      };
      localStorage.setItem("xiyu_save_" + slotKey, JSON.stringify(payload));
    } catch (e) {}
  }

  function loadFromSlot(slotKey) {
    try {
      const raw = localStorage.getItem("xiyu_save_" + slotKey);
      if (!raw) return false;
      const payload = JSON.parse(raw);
      if (payload && payload.state) {
        GAME.state = payload.state;
        engine.state = deepClone(payload.state);
        GAME.queuedOrders = [];
        recordMetricSnapshot();
        applyFactionChrome(GAME.state.meta.side);
        refreshAllUI();
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  function renderSaveSlotsUI() {
    const box = document.getElementById("save-slots-container");
    if (!box) return;
    const slots = [
      { key: "autosave", name: "自动存档" },
      { key: "slot1", name: "存档 一" },
      { key: "slot2", name: "存档 二" },
    ];
    box.innerHTML = slots
      .map((s) => {
        let info = "空";
        try {
          const raw = localStorage.getItem("xiyu_save_" + s.key);
          if (raw) {
            const p = JSON.parse(raw);
            info = `${p.side === "han" ? "汉" : "匈奴"} · ${p.date_text} · 第 ${p.turn + 1} 季 · ${p.saved_at}`;
          }
        } catch (e) {}
        return `
        <div class="save-slot">
          <div class="slot-name">${s.name}</div>
          <div class="slot-info">${info}</div>
          <div class="slot-btns">
            ${s.key === "autosave" ? "" : `<button class="btn btn-sm btn-gold" data-save-slot="${s.key}">存入</button>`}
            <button class="btn btn-sm" data-load-slot="${s.key}" ${info === "空" ? "disabled" : ""}>读取</button>
          </div>
        </div>
      `;
      })
      .join("");

    box.querySelectorAll("[data-save-slot]").forEach((btn) => {
      btn.addEventListener("click", () => {
        saveToSlot(btn.getAttribute("data-save-slot"));
        renderSaveSlotsUI();
      });
    });
    box.querySelectorAll("[data-load-slot]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (loadFromSlot(btn.getAttribute("data-load-slot"))) {
          document.getElementById("modal-scenario-menu").classList.remove("open");
        }
      });
    });
  }

  // ==================== 11. 事件绑定与键盘快捷键 (F1–F6 / Space / Tab / Esc) ====================
  function bindGameEvents() {
    // 案上器物与抽屉顶部页签：打开 / 切换抽屉
    document.querySelectorAll(".desk-prop[data-panel]").forEach((prop) => {
      prop.addEventListener("click", () => {
        const panel = prop.getAttribute("data-panel");
        if (panel === "speed") cycleReplaySpeed();
        else toggleDrawer(panel);
      });
    });
    document.querySelectorAll("#drawer-tabs .drawer-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const p = tab.getAttribute("data-drawer-tab");
        if (p) openDrawer(p);
      });
    });
    document.getElementById("btn-drawer-close").onclick = closeDrawer;

    // 舆图五种专题视角切换 (疆域臣属 / 汉匈倾侧 / 仓廪粮道 / 烽燧视野 / 兵力态势)
    document.querySelectorAll("#map-mode-pills .mode-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        const mode = pill.getAttribute("data-map-mode");
        if (!mode || !MAP_MODES[mode]) return;
        GAME.mapMode = mode;
        document.querySelectorAll("#map-mode-pills .mode-pill").forEach((p) => p.classList.toggle("active", p === pill));
        const cartMode = document.getElementById("map-cartouche-mode");
        if (cartMode) cartMode.textContent = `舆图视角：${MAP_MODES[mode].label}`;
        renderStrategicMap();
      });
    });

    // 图层浮层与点击空白处收起临时因果提示卡
    const layersBtn = document.getElementById("btn-layers");
    const layersPop = document.getElementById("layers-pop");
    const setLayersOpen = (open) => {
      layersPop.classList.toggle("open", open);
      layersBtn.setAttribute("aria-expanded", open ? "true" : "false");
    };
    layersBtn.onclick = (e) => {
      e.stopPropagation();
      setLayersOpen(!layersPop.classList.contains("open"));
    };
    layersPop.addEventListener("mousedown", (e) => e.stopPropagation());
    document.addEventListener("mousedown", (e) => {
      if (!e.target.closest("#map-layers")) setLayersOpen(false);
      if (
        GAME.transientTooltip &&
        !e.target.closest("#causal-tooltip-stack") &&
        !e.target.closest("[data-causal-metric]") &&
        !e.target.closest("[data-explain-key]")
      ) {
        GAME.transientTooltip = null;
        renderCausalTooltips();
      }
    });

    // 操作说明
    const helpModal = document.getElementById("modal-help");
    document.getElementById("btn-open-help").onclick = () => helpModal.classList.add("open");
    document.getElementById("btn-help-close").onclick = () => helpModal.classList.remove("open");

    // 顶栏图层开关
    const layerMap = {
      "chk-layer-supply": "supply",
      "chk-layer-fog": "fog",
      "chk-layer-threat": "threat",
      "chk-layer-trade": "trade",
      "chk-layer-zone": "zone",
      "chk-layer-tokens": "tokens",
      "chk-layer-grid": "grid",
    };
    Object.entries(layerMap).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", (e) => {
          GAME.layers[key] = e.target.checked;
          renderStrategicMap();
        });
      }
    });

    // 教学引导卡片控制
    document.getElementById("btn-toggle-tutorial").onclick = () => {
      GAME.tutorialOpen = !GAME.tutorialOpen;
      renderTutorialCard();
      document.getElementById("modal-help").classList.remove("open");
    };
    document.getElementById("btn-tut-prev").onclick = () => {
      GAME.tutorialIdx = (GAME.tutorialIdx - 1 + TUTORIAL_LESSONS.length) % TUTORIAL_LESSONS.length;
      renderTutorialCard();
    };
    document.getElementById("btn-tut-next").onclick = () => {
      GAME.tutorialIdx = (GAME.tutorialIdx + 1) % TUTORIAL_LESSONS.length;
      renderTutorialCard();
    };
    document.getElementById("btn-tut-close").onclick = () => {
      GAME.tutorialOpen = false;
      renderTutorialCard();
    };

    // 地图缩放与拖拽
    const vp = document.getElementById("map-viewport");
    const camScale = () => {
      const r = vp.getBoundingClientRect();
      return Math.max(GAME.mapCam.w / Math.max(1, r.width), GAME.mapCam.h / Math.max(1, r.height));
    };
    const clampCam = () => {
      const c = GAME.mapCam;
      c.x = clamp(c.x, -c.w * 0.25, 1000 - c.w * 0.75);
      c.y = clamp(c.y, -c.h * 0.25, 620 - c.h * 0.75);
    };
    const zoomAt = (factor, clientX, clientY) => {
      const c = GAME.mapCam;
      const nw = clamp(c.w * factor, 330, 1100);
      const f = nw / c.w;
      const r = vp.getBoundingClientRect();
      const k = camScale();
      const offX = (r.width - c.w / k) / 2;
      const offY = (r.height - c.h / k) / 2;
      const wx = c.x + ((clientX ?? r.left + r.width / 2) - r.left - offX) * k;
      const wy = c.y + ((clientY ?? r.top + r.height / 2) - r.top - offY) * k;
      c.x = wx - (wx - c.x) * f;
      c.y = wy - (wy - c.y) * f;
      c.w = nw;
      c.h = c.h * f;
      clampCam();
      applyMapCam();
    };
    document.getElementById("btn-zoom-in").onclick = () => zoomAt(0.8);
    document.getElementById("btn-zoom-out").onclick = () => zoomAt(1.25);
    document.getElementById("btn-zoom-reset").onclick = () => {
      GAME.mapCam = { x: 0, y: 0, w: 1000, h: 620, dragging: false, startX: 0, startY: 0 };
      applyMapCam();
    };
    document.getElementById("btn-focus-capital").onclick = () => {
      const cap = GAME.state.meta.side === "han" ? "dun_huang" : "chanyu_ting";
      const p = (BUNDLE.map_presentation.positions || {})[cap];
      if (p) {
        GAME.mapCam.w = 560;
        GAME.mapCam.h = 347;
        GAME.mapCam.x = p[0] - 280;
        GAME.mapCam.y = p[1] - 174;
        clampCam();
      }
      selectNodeAndPan(cap);
      applyMapCam();
    };

    const touches = new Map();
    let pinch = null;
    vp.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch") return;
      if (e.target.closest(".tutorial-floating-card, .map-hud-controls, .map-layers, .map-inspector-card, .causal-tooltip-stack")) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 1) {
        GAME.mapCam.dragging = true;
        GAME.mapCam.moved = false;
        GAME.mapCam.startX = e.clientX;
        GAME.mapCam.startY = e.clientY;
      } else if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
        GAME.mapCam.dragging = false;
        GAME.mapCam.moved = true;
      }
    });
    vp.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "touch" || !touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2 && pinch) {
        const [a, b] = [...touches.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 0 && pinch.d > 0) zoomAt(pinch.d / d, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinch.d = d;
      } else if (touches.size === 1 && GAME.mapCam.dragging) {
        const dxp = e.clientX - GAME.mapCam.startX;
        const dyp = e.clientY - GAME.mapCam.startY;
        if (!GAME.mapCam.moved && Math.abs(dxp) + Math.abs(dyp) < 6) return;
        GAME.mapCam.moved = true;
        const k = camScale();
        GAME.mapCam.x -= dxp * k;
        GAME.mapCam.y -= dyp * k;
        clampCam();
        GAME.mapCam.startX = e.clientX;
        GAME.mapCam.startY = e.clientY;
        applyMapCam();
      }
    });
    const endTouch = (e) => {
      if (e.pointerType !== "touch") return;
      touches.delete(e.pointerId);
      if (touches.size < 2) pinch = null;
      if (touches.size === 0) {
        GAME.mapCam.dragging = false;
        setTimeout(() => (GAME.mapCam.moved = false), 0);
      }
    };
    vp.addEventListener("pointerup", endTouch);
    vp.addEventListener("pointercancel", endTouch);

    vp.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        zoomAt(e.deltaY > 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
      },
      { passive: false }
    );
    vp.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || e.sourceCapabilities?.firesTouchEvents) return;
      if (e.target.closest(".tutorial-floating-card, .map-hud-controls, .map-layers, .map-cartouche, .map-inspector-card, .causal-tooltip-stack")) return;
      GAME.mapCam.dragging = true;
      GAME.mapCam.moved = false;
      GAME.mapCam.startX = e.clientX;
      GAME.mapCam.startY = e.clientY;
    });
    window.addEventListener("mousemove", (e) => {
      if (!GAME.mapCam.dragging) return;
      const dxp = e.clientX - GAME.mapCam.startX;
      const dyp = e.clientY - GAME.mapCam.startY;
      if (!GAME.mapCam.moved && Math.abs(dxp) + Math.abs(dyp) < 4) return;
      if (!GAME.mapCam.moved) {
        GAME.mapCam.moved = true;
        vp.classList.add("dragging");
        hideMapTooltip();
      }
      const k = camScale();
      GAME.mapCam.x -= dxp * k;
      GAME.mapCam.y -= dyp * k;
      clampCam();
      GAME.mapCam.startX = e.clientX;
      GAME.mapCam.startY = e.clientY;
      applyMapCam();
    });
    window.addEventListener("mouseup", () => {
      if (!GAME.mapCam.dragging) return;
      GAME.mapCam.dragging = false;
      vp.classList.remove("dragging");
      setTimeout(() => {
        GAME.mapCam.moved = false;
      }, 0);
    });

    // 剧本卡片选择
    document.querySelectorAll("#scenario-cards .scen-card").forEach((card) => {
      card.addEventListener("click", () => {
        document.querySelectorAll("#scenario-cards .scen-card").forEach((c) => c.classList.remove("active"));
        card.classList.add("active");
        document.getElementById("modal-sel-scenario").value = card.getAttribute("data-scen");
      });
    });

    // 顶栏按钮：幕僚代拟、悔棋、结束本季
    document.getElementById("btn-advisor-fill").onclick = fillAdvisorOrders;
    document.getElementById("btn-undo-season").onclick = () => {
      GAME.state = engine.undoTurn();
      GAME.queuedOrders = [];
      refreshAllUI();
    };
    document.getElementById("btn-end-season").onclick = advanceSeasonWithWEGOReplay;

    // 模态框控制
    document.getElementById("btn-open-chronicle-modal").onclick = openSeasonSummaryModal;
    document.getElementById("btn-sum-close").onclick = () => document.getElementById("modal-season-summary").classList.remove("open");
    document.getElementById("btn-sum-enter").onclick = () => document.getElementById("modal-season-summary").classList.remove("open");
    document.getElementById("btn-sum-advisor").onclick = () => {
      fillAdvisorOrders();
      document.getElementById("modal-season-summary").classList.remove("open");
    };
    document.getElementById("btn-sum-toggle-style").onclick = () => {
      GAME.useClassical = !GAME.useClassical;
      openSeasonSummaryModal();
    };
    document.getElementById("chk-auto-popup-summary").onchange = (e) => {
      GAME.autoPopupSummary = e.target.checked;
    };

    const openScenModal = () => {
      renderSaveSlotsUI();
      document.getElementById("modal-scenario-menu").classList.add("open");
    };
    document.getElementById("btn-open-scenario-modal").onclick = openScenModal;
    document.getElementById("btn-open-newgame-modal").onclick = openScenModal;
    document.getElementById("btn-open-save-modal").onclick = openScenModal;
    document.getElementById("btn-scen-close").onclick = () => document.getElementById("modal-scenario-menu").classList.remove("open");

    document.getElementById("btn-start-selected-scenario").onclick = () => {
      const sideRadio = document.querySelector("input[name='scen-side']:checked");
      const side = sideRadio ? sideRadio.value : "han";
      const scenario = document.getElementById("modal-sel-scenario").value;
      const difficulty = document.getElementById("modal-sel-difficulty").value;
      const oppBot = document.getElementById("modal-sel-bot").value;
      document.getElementById("modal-scenario-menu").classList.remove("open");
      startNewCampaign({ side, scenario, difficulty, opp_bot: oppBot, seed: 11001 });
    };

    document.getElementById("btn-battle-close").onclick = () => document.getElementById("modal-battle-detail").classList.remove("open");

    // 全局键盘快捷键（Esc 优先级：模态框 -> 因果提示卡 -> 图层浮层 -> 抽屉）
    window.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA")) return;
      const fMap = {
        F1: "inspector",
        F2: "court",
        F3: "diplomacy",
        F4: "logistics",
        F5: "military",
        F6: "chronicle",
        1: "inspector",
        2: "court",
        3: "diplomacy",
        4: "logistics",
        5: "military",
        6: "chronicle",
      };
      if (e.key === "Escape") {
        const openModal = document.querySelector(".modal-backdrop.open");
        if (openModal) openModal.classList.remove("open");
        else if (GAME.transientTooltip) {
          GAME.transientTooltip = null;
          renderCausalTooltips();
        } else if (GAME.lockedTooltips.length > 0) {
          GAME.lockedTooltips.pop();
          renderCausalTooltips();
        } else if (document.getElementById("layers-pop").classList.contains("open")) {
          document.getElementById("btn-layers").click();
        } else {
          closeDrawer();
        }
      } else if (fMap[e.key]) {
        e.preventDefault();
        toggleDrawer(fMap[e.key]);
      } else if (e.key === "?") {
        document.getElementById("modal-help").classList.add("open");
      } else if (e.key === "Tab") {
        e.preventDefault();
        openSeasonSummaryModal();
      } else if (e.key === " ") {
        e.preventDefault();
        advanceSeasonWithWEGOReplay();
      }
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    fitStage();
    window.addEventListener("resize", fitStage);
    bindGameEvents();
    syncSpeedProp();
    const qs = new URLSearchParams(location.search);
    startNewCampaign({
      side: qs.get("side") === "xiongnu" ? "xiongnu" : "han",
      scenario: qs.get("scenario") || "mo_bei_zhi_hou",
      difficulty: "standard",
      opp_bot: "balanced",
      seed: 11001,
    });
    if (qs.get("tutorial") === "0") {
      GAME.tutorialOpen = false;
      renderTutorialCard();
    }
    if (qs.get("mode") && MAP_MODES[qs.get("mode")]) {
      GAME.mapMode = qs.get("mode");
      document.querySelectorAll("#map-mode-pills .mode-pill").forEach((p) => p.classList.toggle("active", p.getAttribute("data-map-mode") === GAME.mapMode));
      renderStrategicMap();
    }
    if (qs.get("explain")) {
      explainMetric(qs.get("explain"));
    }
    const nTurns = parseInt(qs.get("turns") || "0", 10);
    if (nTurns > 0) {
      const sp = document.getElementById("sel-replay-speed");
      const prev = sp.value;
      sp.value = "0";
      for (let i = 0; i < Math.min(nTurns, 40); i++) advanceSeasonWithWEGOReplay();
      sp.value = prev;
    }
    if (qs.get("panel")) openDrawer(qs.get("panel"));
    if (qs.get("drawer") === "1") openDrawer("military");
    renderFrameBand();
    if (qs.get("modal") === "scenario") document.getElementById("btn-open-newgame-modal").click();
    if (qs.get("modal") === "summary") openSeasonSummaryModal();
  });
})();
