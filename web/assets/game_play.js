/**
 * 《西域·汉匈争霸》v1.0 商业级网页可玩版主控制器
 * 驱动 `web/play.html`，与 `web/index.html` 共享底层数据包与模拟引擎。
 */
(function () {
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // 引擎给出的颜色按暗色底设计；在绢本浅色面板上换成同色相的深色墨。
  const TONE_MAP = { "#a9d4b4": "#3e6b5a", "#c9b98a": "#8a6524", "#d6a04a": "#9a6a1e", "#e8998a": "#a33a2a" };
  function tone(c) {
    return TONE_MAP[String(c || "").toLowerCase()] || c;
  }

  // 抽屉（器物）元数据：与 docs/ui_desk_spec.md §6 及 Godot ui/main.gd 同序同键。
  const DRAWERS = {
    inspector: { seal: "城", title: "城塞", sub: "所选城邑的户口、仓储、邦交与驻军", key: "F1" },
    court: { seal: "诏", title: "朝廷", sub: "长安诏令 · 请款请兵 · 持节矫诏", key: "F2", xn: { seal: "庭", title: "王庭", sub: "四部分赏 · 龙城大会 · 僮仆都尉" } },
    diplomacy: { seal: "节", title: "诸国", sub: "西域诸国总览与功业拆解", key: "F3" },
    logistics: { seal: "仓", title: "粮道", sub: "自动补给线 · 军屯 · 烽燧", key: "F4" },
    military: { seal: "符", title: "军令", sub: "远征计划与粮秣预演", key: "F5" },
    chronicle: { seal: "史", title: "史册", sub: "战报与编年纪事", key: "F6" },
  };
  const SPEED_STEPS = [
    { v: "220", label: "慢" },
    { v: "110", label: "快" },
    { v: "0", label: "瞬时" },
  ];

  // 1920×1080 逻辑舞台：等比缩放，多余方向扩展（同 Godot stretch canvas_items + aspect expand）。
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
    if (GAME.state) renderFrameBand();
  }

  const BUNDLE = window.XIYU_BUNDLE;
  const engine = new window.JSSimEngine(BUNDLE);

  const TUTORIAL_LESSONS = [
    {
      idx: 1,
      title: "一 · 持节出塞",
      body: "你不是坐镇长安的天子，而是**持节出玉门关的汉使**。先点选舆图中央的锁钥之国【楼兰】：右侧「所选」显示它受匈奴威吓的程度，底部器物 `图籍` 展开详情。",
      btnText: "定位楼兰",
      action: () => selectNodeAndPan("lou_lan", "inspector", true),
    },
    {
      idx: 2,
      title: "二 · 先通粮道",
      body: "军无辎重则亡。出塞之前先用器物 `仓廪` 拉通 **敦煌 → 楼兰** 的自动补给线，此后每旬自动转运，无需逐段运粮。",
      btnText: "拟令：敦煌 → 楼兰粮道",
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
      title: "三 · 不归点",
      body: "器物 `虎符` 的抽屉下方是 `远征粮秣预演`：若选「见利则进」又无粮道，过了**不归点**便会断粮饿死；选「谨慎保军」，余粮触及返程线即自动班师。",
      btnText: "拟令：赵破奴奔袭楼兰",
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
      title: "四 · 诸国与功业",
      body: "器物 `符节` 按亲汉程度排列西域诸国，顶部是**都护功业 G** 的来源拆解。G 满 100，即可奏立西域都护府。",
      btnText: "遣精使抚楼兰",
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
      title: "五 · 诏令与矫诏",
      body: "器物 `诏书` 里可奉诏、上书讨价，或冒险**矫诏发兵**——只要捷报先于槛车抵京，便可将功折罪。拟定军令后，按右下朱印 **结束本季** 观看九旬推演。",
      btnText: "奉诏行事",
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
    activePanel: "inspector", // inspector | court | diplomacy | logistics | military | chronicle
    drawerOpen: false,
    stageScale: 1,
    queuedOrders: [], // [{id, type, desc, cost_money, target_node, raw}]
    layers: {
      supply: true,
      fog: true,
      threat: false,
      trade: true,
      zone: false,
      tokens: true,
      grid: true,
    },
    mapCam: { x: 0, y: 0, w: 1000, h: 620, dragging: false, startX: 0, startY: 0 },
    diploSort: { col: "gap", asc: true },
    diploFilter: "all", // all | city18 | major5
    logFilter: "all", // all | battle | court | diplomacy | logistics
    useClassical: true,
    autoPopupSummary: false,
    tutorialOpen: true,
    tutorialIdx: 0,
    replaying: false,
    forgedTarget: "cheshi_qian",
    forgedSelfImpeach: true,
    planDraft: {
      origin: "dun_huang",
      target: "lou_lan",
      soldiers: 5000,
      laborers: 2000,
      standingOrder: "cautious",
    },
  };

  // ==================== 1. 初始化与开局控制 ====================
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
    GAME.planDraft.origin = side === "han" ? "dun_huang" : "chanyu_ting";
    GAME.planDraft.target = GAME.selectedNodeId;

    applyFactionChrome(side);

    refreshAllUI();
    saveToSlot("autosave");
  }

  function applyFactionChrome(side) {
    document.body.className = side === "han" ? "faction-han" : "faction-xiongnu";
    const nm = document.getElementById("prop-court-name");
    const act = document.getElementById("prop-court-act");
    const icon = document.getElementById("prop-court-icon");
    if (nm) nm.textContent = side === "han" ? "诏书" : "王庭";
    if (act) act.textContent = side === "han" ? "朝廷与诏令 · F2" : "王庭与四部 · F2";
    if (icon) icon.className = `prop-icon ${side === "han" ? "i-zhaoshu" : "i-wangting"}`;
    const prop = document.getElementById("prop-court");
    if (prop) prop.title = side === "han" ? "展开诏书：长安诏令、请款请兵与持节矫诏（F2）" : "入王庭：四部分赏、龙城大会与僮仆都尉（F2）";
  }

  function refreshAllUI() {
    if (!GAME.state) return;
    renderTopHUD();
    renderTutorialCard();
    renderStrategicMap();
    renderFoodCurveDrawer();
    if (GAME.drawerOpen) renderActiveDockPanel();
    syncDrawerUI();
    renderOutliner();
    renderBottomOrderQueue();
  }

  // ==================== 2. 顶栏汉/匈非对称双模式 HUD ====================
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
        <div class="metric" data-jump-panel="court" title="朝廷信任：决定你能否便宜行事；归零将被召还">
          <div class="metric-label">朝廷信任 <span class="tag ${trustTag}">${trustTier}</span></div>
          <div class="metric-value">${trust.toFixed(0)}<small>/ 100</small></div>
          ${bar(trust, trustColor)}
        </div>
        <div class="metric" data-jump-panel="logistics" title="少府拨款余额（已扣除本季拟令花费）与太仆官马">
          <div class="metric-label">库钱 · 官马</div>
          <div class="metric-value">${availMoney.toLocaleString()}<small>钱</small>&nbsp;${(st.scores.han_horse_pool || 5000).toLocaleString()}<small>匹</small></div>
        </div>
        <div class="metric" data-jump-panel="court" title="${ed ? ed.title : "暂无诏书"}">
          <div class="metric-label">诏令 ${ed ? (ed.complied ? '<span class="tag tag-green">已奉诏</span>' : `<span class="tag tag-red">限第 ${ed.deadline_turn} 季</span>`) : ""}</div>
          <div class="metric-value serif">${ed ? ed.title : "暂无诏书"}</div>
        </div>
        <div class="metric" data-jump-panel="diplomacy" title="都护功业 G 满 100 即可奏立西域都护府">
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
        <div class="metric" data-jump-panel="court" title="单于威望：过低将诸部离散">
          <div class="metric-label">单于威望</div>
          <div class="metric-value">${prest.toFixed(0)}<small>/ 100</small></div>
          ${bar(prest, "#a07a5e")}
        </div>
        <div class="metric" data-jump-panel="court" title="赏赐池余额（已扣除本季拟令花费）">
          <div class="metric-label">赏赐池</div>
          <div class="metric-value">${availMoney.toLocaleString()}<small>钱</small></div>
        </div>
        <div class="metric" data-jump-panel="court" title="四部忠诚：低于 48 有离心之虞">
          <div class="metric-label">四部忠诚</div>
          <div class="metric-value tribe-row">${tribe("左贤", tr.zuoxian)}${tribe("右贤", tr.youxian)}${tribe("日逐", tr.rizhu)}${tribe("犁汗", tr.lihu)}</div>
        </div>
        <div class="metric" data-jump-panel="diplomacy" title="威服 W 满 100 即霸有西域">
          <div class="metric-label">威服 W <span class="tag tag-xn">服属 ${st.scores.xn_vassals} 国</span></div>
          <div class="metric-value">${weifu.toFixed(1)}<small>/ 100</small></div>
          ${bar(weifu, "linear-gradient(90deg,#6d4c3d,#cdb39c)")}
        </div>
      `;
    }

    pillsEl.querySelectorAll(".metric").forEach((el) => {
      el.addEventListener("click", () => {
        const targetPanel = el.getAttribute("data-jump-panel");
        if (targetPanel) openDrawer(targetPanel);
      });
    });
  }

  // ==================== 3. 新手5课非阻塞式教学引导卡 ====================
  function renderTutorialCard() {
    const card = document.getElementById("tutorial-card");
    const toggleBtn = document.getElementById("btn-toggle-tutorial");
    if (toggleBtn) toggleBtn.classList.toggle("on", GAME.tutorialOpen);
    if (!GAME.tutorialOpen) {
      card.style.display = "none";
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
  }

  // ==================== 4. 西域42节点舆图渲染器（1:1 严格对齐 Godot `ui/map_view.gd`） ====================
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

  // 完全对齐 Godot `ui/map_view.gd` 的 `route_curve`: tangent = (pts[i+1] - pts[i-1]) * 0.15
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
    road: "官道",
    steppe: "草原道",
    desert: "沙碛",
    mountain: "山道",
    hazard: "险道",
  };

  function ownerLabel(n) {
    if (n.type === "junction") return "路口 · 无主";
    const rel = n.relation;
    if (rel) {
      if (rel.overlord === "han") return "汉属国";
      if (rel.overlord === "xiongnu") return "匈奴属国";
      return rel.han_enfeoffed ? "受汉册封" : "独立";
    }
    return n.controller === "han" ? "汉郡" : n.controller === "xiongnu" ? "匈奴" : "独立";
  }

  function applyMapCam() {
    const svg = document.getElementById("game-map-svg");
    if (svg) svg.setAttribute("viewBox", `${GAME.mapCam.x} ${GAME.mapCam.y} ${GAME.mapCam.w} ${GAME.mapCam.h}`);
    renderFrameBand();
  }

  // 画框带：天干（每 100 世界单位一列）/ 地支（620/6 一行）随镜头更新。示意图不按比例，故不用经纬度。
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
  function renderFrameBand() {
    const svg = document.getElementById("map-frame-svg");
    const vp = document.getElementById("map-viewport");
    if (!svg || !vp) return;
    const desk = document.getElementById("map-desk");
    const DW = desk.clientWidth;
    const DH = desk.clientHeight;
    const IN = 8 + 1 + 22; // 外线距边 8 + 线宽 + 框带 22 → 视口原点（舞台像素）
    const band0 = 9; // 框带外缘
    const bandW = 21;
    const [, , , W, H] = worldToViewport(0, 0);
    const parts = [];
    // 横向：天干
    for (let i = 0; i <= 10; i++) {
      const [x] = worldToViewport(i * 100, 0);
      if (x >= -1 && x <= W + 1) {
        const X = IN + x;
        parts.push(`<line class="fb-tick" x1="${X}" y1="${band0}" x2="${X}" y2="${band0 + bandW}"/><line class="fb-tick" x1="${X}" y1="${DH - band0 - bandW}" x2="${X}" y2="${DH - band0}"/>`);
      }
      if (i < 10) {
        const [cx] = worldToViewport(i * 100 + 50, 0);
        if (cx > 10 && cx < W - 10) {
          const X = IN + cx;
          parts.push(`<text class="fb-label" x="${X}" y="${band0 + bandW / 2}">${GAN[i]}</text><text class="fb-label" x="${X}" y="${DH - band0 - bandW / 2}">${GAN[i]}</text>`);
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
          parts.push(`<text class="fb-label" x="${band0 + bandW / 2}" y="${Y}">${ZHI[j]}</text><text class="fb-label" x="${DW - band0 - bandW / 2}" y="${Y}">${ZHI[j]}</text>`);
        }
      }
    }
    // 四角方块
    [[band0, band0], [DW - band0 - bandW, band0], [band0, DH - band0 - bandW], [DW - band0 - bandW, DH - band0 - bandW]].forEach(([x, y]) => {
      parts.push(`<rect class="fb-corner" x="${x + 0.5}" y="${y + 0.5}" width="${bandW - 1}" height="${bandW - 1}"/><rect class="fb-cell" x="${x + 6}" y="${y + 6}" width="${bandW - 12}" height="${bandW - 12}"/>`);
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
    let x = ev.clientX - rect.left + 14;
    let y = ev.clientY - rect.top + 14;
    const w = tip.offsetWidth || 220;
    const h = tip.offsetHeight || 60;
    if (x + w > rect.width - 8) x = ev.clientX - rect.left - w - 14;
    if (y + h > rect.height - 8) y = ev.clientY - rect.top - h - 14;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }

  function hideMapTooltip() {
    const tip = document.getElementById("godot-route-tooltip");
    if (tip) tip.style.display = "none";
  }

  function armyFlagSvg(x, anchorY, faction, cnt, nArmies, isConvoy, moving) {
    // 参照 Godot `_draw_army`：锚点 + 连线 + 旗牌 + 图标 + 人数（网页版略缩小以免遮挡相邻城名）
    const posY = Math.max(20, anchorY - 20);
    const baseCol = faction === "han" ? GODOT_C_HAN : GODOT_C_XN;
    const boxCol = isConvoy ? (faction === "han" ? "#b9844f" : "#9f8853") : baseCol;
    const txt = cnt >= 10000 ? `${(cnt / 10000).toFixed(1)}万` : cnt >= 1000 ? `${(cnt / 1000).toFixed(cnt % 1000 === 0 ? 0 : 1)}千` : `${cnt}`;
    const icon = isConvoy ? "assets/icons/convoy.svg" : "assets/icons/standard.svg";
    return `
      <line x1="${x}" y1="${anchorY}" x2="${x}" y2="${posY + 13}" stroke="#6b4f2a" stroke-width="1"/>
      <circle cx="${x}" cy="${anchorY}" r="2.3" fill="${baseCol}" stroke="#fff3d0" stroke-width="0.6"/>
      <rect x="${x - 12}" y="${posY - 16}" width="24" height="30" rx="2.5" fill="${boxCol}" stroke="${moving ? "#ffe680" : "#fff3d0"}" stroke-width="${moving ? 1.3 : 0.9}" filter="url(#flagShadow)"/>
      <image href="${icon}" x="${x - 9}" y="${posY - 15}" width="18" height="18" pointer-events="none"/>
      <text x="${x}" y="${posY + 11}" fill="#fffaf0" font-size="8.6" font-weight="700" text-anchor="middle" style="font-family:var(--font-sans)">${txt}</text>
      ${nArmies > 1 ? `<circle cx="${x + 12}" cy="${posY - 16}" r="5.5" fill="#f5e7c3" stroke="${baseCol}" stroke-width="1.1"/><text x="${x + 12}" y="${posY - 13.2}" font-size="7.5" font-weight="700" fill="${baseCol}" text-anchor="middle" style="font-family:var(--font-sans)">${nArmies}</text>` : ""}
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
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.2" flood-color="#2a1d10" flood-opacity="0.45"/>
        </filter>
        <filter id="labelShadow" x="-10%" y="-30%" width="120%" height="160%">
          <feDropShadow dx="0" dy="0.8" stdDeviation="0.8" flood-color="#3a2a14" flood-opacity="0.3"/>
        </filter>
        <linearGradient id="fadeX" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#000"/><stop offset="0.035" stop-color="#fff"/><stop offset="0.965" stop-color="#fff"/><stop offset="1" stop-color="#000"/>
        </linearGradient>
        <linearGradient id="fadeY" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#000"/><stop offset="0.05" stop-color="#fff"/><stop offset="0.95" stop-color="#fff"/><stop offset="1" stop-color="#000"/>
        </linearGradient>
        <mask id="atlasFadeY" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="620">
          <rect x="0" y="0" width="1000" height="620" fill="url(#fadeY)"/>
        </mask>
        <mask id="atlasFade" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="620">
          <rect x="0" y="0" width="1000" height="620" fill="url(#fadeX)" mask="url(#atlasFadeY)"/>
        </mask>
        <pattern id="paperHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(90,65,30,0.10)" stroke-width="0.8"/>
        </pattern>
      </defs>
      <rect x="-1200" y="-900" width="3400" height="2420" fill="#d9c8a3"/>
      <rect x="-1200" y="-900" width="3400" height="2420" fill="url(#paperHatch)"/>
      <image href="assets/art/western-regions-atlas-v2.png" x="0" y="0" width="1000" height="620" preserveAspectRatio="none" mask="url(#atlasFade)"/>
      <rect x="0" y="0" width="1000" height="620" fill="rgba(242, 227, 186, 0.30)" mask="url(#atlasFade)"/>
    `);

    // 干支方格（计里画方意象）
    if (GAME.layers.grid) {
      const g = [];
      for (let i = 1; i < 10; i++) g.push(`M${i * 100} 0V620`);
      for (let j = 1; j < 6; j++) g.push(`M0 ${(j * ROW_H).toFixed(1)}H1000`);
      parts.push(`<path d="${g.join("")}" fill="none" stroke="rgba(43,33,25,0.10)" stroke-width="0.8" stroke-dasharray="1 3" pointer-events="none"/>`);
    }

    // 地理大区水印（layout.regions）
    parts.push(`<g pointer-events="none">`);
    for (const reg of regions) {
      parts.push(
        `<text x="${reg[1][0]}" y="${reg[1][1]}" font-size="20" font-weight="700" letter-spacing="6" fill="rgba(77, 62, 40, 0.5)" stroke="rgba(245, 235, 204, 0.55)" stroke-width="3" paint-order="stroke">${reg[0]}</text>`
      );
    }
    parts.push(`</g>`);

    // 疆域底色（可选）
    if (GAME.layers.zone) {
      for (const nid of nodeIds) {
        const n = st.nodes[nid];
        const c = coords[nid];
        const ov = n.relation && n.relation.overlord ? n.relation.overlord : n.controller;
        const haloColor = ov === "han" ? "rgba(192, 57, 43, 0.16)" : ov === "xiongnu" ? "rgba(93, 64, 55, 0.18)" : "rgba(184, 137, 60, 0.08)";
        parts.push(`<circle cx="${c.x}" cy="${c.y}" r="24" fill="${haloColor}" pointer-events="none"/>`);
        if (n.controller === "xiongnu" && (st.meta.season === "autumn" || st.meta.season === "winter")) {
          parts.push(`<circle cx="${c.x}" cy="${c.y}" r="27" fill="none" stroke="#5d4037" stroke-width="1.2" stroke-dasharray="3,3" class="pulse-ring" pointer-events="none"/>`);
        }
      }
    }

    // 商路金色高亮（Trade.open_prefix）
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
            parts.push(`<path d="${routeCurveD[rIdx]}" fill="none" stroke="rgba(232, 179, 64, 0.85)" stroke-width="6.0" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>`);
          }
        }
      }
    }

    // 古道（对齐 Godot `_road` 配色）
    const isWinter = st.meta.season === "winter";
    routes.forEach((r, idx) => {
      const d = routeCurveD[idx];
      if (!d) return;
      let col = "#6b4f2a";
      let dashed = false;
      if (r.terrain === "steppe") col = "#5f8f4a";
      else if (r.terrain === "desert") (col = "#b8893c"), (dashed = true);
      else if (r.terrain === "mountain") (col = "#7a7a7a"), (dashed = true);
      else if (r.terrain === "hazard") (col = "#a33a2a"), (dashed = true);
      if (r.closed_in_winter && isWinter) col = "#b5b0a6";
      if (r.raided_by) col = "#d02020";

      if (dashed) {
        parts.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="1.6" stroke-dasharray="7.5, 4.5" stroke-linecap="round" pointer-events="none"/>`);
      } else {
        parts.push(`<path d="${d}" fill="none" stroke="rgba(250, 240, 209, 0.82)" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>`);
        parts.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>`);
      }
      parts.push(`<path d="${d}" class="godot-route-hit" data-ridx="${idx}" fill="none" stroke="transparent" stroke-width="12" style="cursor:help;"/>`);
    });

    parts.push(
      `<path id="godot-route-hover-outer" d="" fill="none" stroke="#f5e7aa" stroke-width="5.5" stroke-linecap="round" pointer-events="none" style="display:none;"/>`,
      `<path id="godot-route-hover-inner" d="" fill="none" stroke="#704921" stroke-width="2.5" stroke-linecap="round" pointer-events="none" style="display:none;"/>`
    );

    // 自动补给线（沿古道流动）
    if (GAME.layers.supply && st.v1 && st.v1.logistics.supply_lines) {
      for (const sl of st.v1.logistics.supply_lines) {
        const a = coords[sl.from];
        const b = coords[sl.to];
        if (!a || !b) continue;
        const col = sl.status === "active" ? "#2e7d4f" : sl.status === "throttled" ? "#b8893c" : "#c0392b";
        const rIdx = routeByPair[`${sl.from}|${sl.to}`];
        const pathStr = rIdx !== undefined && routeCurveD[rIdx] ? routeCurveD[rIdx] : `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
        parts.push(`
          <path d="${pathStr}" fill="none" stroke="rgba(250,240,209,0.8)" stroke-width="6" stroke-linecap="round" pointer-events="none"/>
          <path d="${pathStr}" fill="none" stroke="${col}" stroke-width="3.4" stroke-linecap="round" class="supply-line-anim" pointer-events="none"/>
        `);
      }
    }

    // 敌军 30/60/90 日威胁圈
    if (GAME.layers.threat) {
      const oppFaction = st.meta.side === "han" ? "xiongnu" : "han";
      for (const nid of nodeIds) {
        const n = st.nodes[nid];
        const hasOppArmy = (n.armies && n.armies.some((a) => a.faction === oppFaction && a.soldiers >= 1500)) || nid === "chanyu_ting" || nid === "cheshi_qian";
        if (hasOppArmy && n.controller === oppFaction) {
          const c = coords[nid];
          parts.push(`
            <circle cx="${c.x}" cy="${c.y}" r="45" fill="rgba(192, 57, 43, 0.10)" stroke="#c0392b" stroke-width="1.2" pointer-events="none"/>
            <circle cx="${c.x}" cy="${c.y}" r="80" fill="none" stroke="#b8893c" stroke-width="1" stroke-dasharray="5,4" pointer-events="none"/>
            <circle cx="${c.x}" cy="${c.y}" r="115" fill="none" stroke="#6b4f2a" stroke-width="0.8" stroke-dasharray="2,4" pointer-events="none"/>
          `);
        }
      }
    }

    // 节点：圆盘 + 图标 + 绢本铭牌（对齐 Godot `_label_box`）
    const badge = (x, y, ch, fill) =>
      `<g pointer-events="none"><circle cx="${x}" cy="${y}" r="6.2" fill="${fill}" stroke="#fff3d0" stroke-width="0.9"/><text x="${x}" y="${y + 2.9}" font-size="7.8" font-weight="700" fill="#fffaf0" text-anchor="middle">${ch}</text></g>`;

    for (const nid of nodeIds) {
      const n = st.nodes[nid];
      const meta = MVP_NODE_META[nid] || {};
      const c = coords[nid];
      const isSel = nid === GAME.selectedNodeId;
      const nodeType = meta.type || n.type || "city";
      let rad = 9.0;
      if (nodeType === "source") rad = 12.0;
      else if (nodeType === "pass") rad = 6.0;
      else if (nodeType === "junction") rad = 4.0;
      else if (nodeType === "nomad") rad = 10.0;

      const fillCol = getGodotNodeColor(nid, n);
      const iconHref = nodeType === "nomad" ? "assets/icons/nomad.svg" : "assets/icons/city.svg";
      const label = n.name || meta.name || nid;
      const fs = nodeType === "junction" ? 10 : 12;
      const boxW = label.length * (fs + 0.4) + 12;
      const boxH = 17;
      const boxX = c.x - boxW / 2;
      const boxY = c.y + rad + 3;

      parts.push(`
        <g class="map-node-g" data-nid="${nid}">
          ${isSel ? `<circle cx="${c.x}" cy="${c.y}" r="${rad + 4}" fill="none" stroke="#fffaf0" stroke-width="2" class="sel-pulse" style="--r0:${rad + 4}px;--r1:${rad + 16}px"/>` : ""}
          ${n.under_siege_by ? `<circle cx="${c.x}" cy="${c.y}" r="${rad + 6}" fill="none" stroke="#d02020" stroke-width="3.0"/>` : ""}
          ${isSel ? `<circle cx="${c.x}" cy="${c.y}" r="${rad + 4}" fill="none" stroke="#ffffff" stroke-width="3.0"/>` : ""}
          <g class="node-disc">
            <circle cx="${c.x}" cy="${c.y + 2}" r="${rad + 2}" fill="rgba(38, 28, 20, 0.25)"/>
            <circle cx="${c.x}" cy="${c.y}" r="${rad + 1.5}" fill="#eed4a0"/>
            <circle cx="${c.x}" cy="${c.y}" r="${rad}" fill="${fillCol}" stroke="#2a1d10" stroke-width="1.5"/>
            ${nodeType !== "pass" && nodeType !== "junction" ? `<image href="${iconHref}" x="${c.x - 6}" y="${c.y - 6}" width="12" height="12" pointer-events="none"/>` : ""}
          </g>
          <rect class="node-label-box" x="${boxX.toFixed(1)}" y="${boxY.toFixed(1)}" width="${boxW.toFixed(1)}" height="${boxH}" rx="3"
            fill="${isSel ? "rgba(250, 240, 212, 0.98)" : "rgba(245, 232, 199, 0.88)"}" stroke="${isSel ? "#9b742f" : "rgba(120, 100, 62, 0.3)"}" stroke-width="${isSel ? 1.3 : 0.7}" filter="url(#labelShadow)"/>
          <text x="${c.x}" y="${(boxY + 12.6).toFixed(1)}" fill="#251c13" font-size="${fs}" font-weight="${isSel ? 900 : 700}" text-anchor="middle" pointer-events="none">${label}</text>
          ${n.has_beacon && GAME.layers.fog ? badge(c.x - rad - 3, c.y - rad + 1, "燧", "#c4622d") : ""}
          ${n.tuntian_lv > 0 ? badge(c.x + rad + 3, c.y - rad + 1, "屯", "#4f7a3a") : ""}
          ${n.relation && n.relation.crimes > 0 ? badge(c.x + rad + 3, c.y + rad - 2, "罪", "#9e2a1e") : ""}
        </g>
      `);
    }

    // 军旗（每节点按阵营合并为一面旗牌，角标显示部队数）
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
          const ax = Math.min(986, p.x + 16 + k * 27);
          parts.push(`<g class="godot-army-marker" data-nid="${nid}" style="cursor:pointer;">${armyFlagSvg(ax, p.y, g.faction, g.cnt, g.n, g.convoy, false)}</g>`);
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

    // 节点 / 旗牌：点击选中，悬停显示概况
    svg.querySelectorAll(".map-node-g, .godot-army-marker").forEach((g) => {
      const nid = g.getAttribute("data-nid");
      g.addEventListener("click", (e) => {
        e.stopPropagation();
        if (GAME.mapCam.moved) return;
        selectNodeAndPan(nid);
      });
      g.addEventListener("mouseenter", (ev) => {
        const n = st.nodes[nid];
        if (!n) return;
        const rel = n.relation;
        const troops = (n.armies || []).reduce((s, a) => s + (a.soldiers || 0), 0);
        let html = `<div class="tt-title">${n.name}</div><div>${ownerLabel(n)} · 人口 ${(n.pop || 0).toLocaleString()} · 储粮 ${((n.grain || 0) / 1000).toFixed(0)}k 石</div>`;
        if (rel) html += `<div class="tt-muted">汉影响 ${rel.han_influence.toFixed(0)} · 匈威吓 ${rel.xn_intimidation.toFixed(0)}${rel.forage ? ` · ${rel.forage.label}` : ""}</div>`;
        if (troops > 0) html += `<div class="tt-muted">驻军 ${troops.toLocaleString()} 人</div>`;
        showMapTooltip(html, ev);
      });
      g.addEventListener("mousemove", moveMapTooltip);
      g.addEventListener("mouseleave", hideMapTooltip);
    });

    // 古道：悬停高亮 + 里程（对齐 Godot `_get_tooltip`）
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
        let html = `<div class="tt-title">${nm(aId)} — ${nm(bId)}</div><div>${TERRAIN_NAMES[r.terrain] || r.terrain} · 约 ${r.days} 日</div>`;
        html += `<div class="tt-muted">行军 ×${(r.time_mult || 1.0).toFixed(1)} · 损耗 ×${(r.attrition_mult || 1.0).toFixed(1)}</div>`;
        if (r.closed_in_winter) html += `<div class="tt-muted">冬季大雪封路</div>`;
        if (r.raided_by) html += `<div style="color:var(--han-light)">已遭劫掠，商路中断</div>`;
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

  // 选中城邑：只更新舆图与军情栏；已打开「图籍 / 虎符」抽屉时同步其内容。
  // panelName + open=true 时才主动展开抽屉（教学、急报、纪事待办等跳转）。
  function selectNodeAndPan(nid, panelName, open) {
    GAME.selectedNodeId = nid;
    GAME.planDraft.target = nid;
    if (panelName && (open || GAME.drawerOpen)) {
      GAME.activePanel = panelName;
      GAME.drawerOpen = true;
    }
    renderStrategicMap();
    renderFoodCurveDrawer();
    if (GAME.drawerOpen && ["inspector", "military", "diplomacy"].includes(GAME.activePanel)) renderActiveDockPanel();
    syncDrawerUI();
    renderOutliner();
    if (open) focusNode(nid);
  }

  // 若城邑不在可视范围内，平移镜头使其居中（不改变缩放）。
  function focusNode(nid) {
    const p = (BUNDLE.map_presentation.positions || {})[nid];
    if (!p) return;
    const [x, y, , W, H] = worldToViewport(p[0], p[1]);
    const left = GAME.drawerOpen ? 930 : 60;
    if (x > left && x < W - 60 && y > 60 && y < H - 60) return;
    const c = GAME.mapCam;
    const k = Math.min(W / c.w, H / c.h);
    const targetX = GAME.drawerOpen ? (930 + W) / 2 : W / 2;
    c.x += (x - targetX) / k;
    c.y += (y - H / 2) / k;
    applyMapCam();
  }

  // ==================== 5. 底部 0–18旬粮食折线与「就食城仓」修正抽屉 ====================
  function renderFoodCurveDrawer() {
    const st = GAME.state;
    const targetNode = st.nodes[GAME.selectedNodeId] || st.nodes.lou_lan;
    const originNode = st.nodes[GAME.planDraft.origin] || st.nodes.dun_huang;

    // S07-R08: 彻底修复守军「携粮0、可支0.0月」误导，常驻显示「就食城仓」
    const garBadge = document.getElementById("curve-garrison-badge");
    if (originNode) {
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
    document.getElementById("curve-drawer-title").innerHTML =
      `<b>远征粮秣预演</b>${oName} → ${tName} · ${soldiers.toLocaleString()} 兵 + ${laborers.toLocaleString()} 民夫`;

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
        g = Math.max(eatPerTick * 1.5, g); // 谨慎保军：自动班师就食
      }
    }

    const X0 = 34, X1 = 528, Y0 = 14, Y1 = 100;
    const xs = (t) => X0 + (t / 18) * (X1 - X0);
    const maxG = Math.max(1, carryCap * 1.1);
    const ys = (v) => Y1 - (v / maxG) * (Y1 - Y0);
    const starving = starveTick !== -1 && standing !== "cautious";
    const lineCol = starving ? "#a33a2a" : "#3e6b5a";
    const polyPts = pts.map((p) => `${xs(p.t).toFixed(1)},${ys(p.g).toFixed(1)}`).join(" ");
    const areaPts = `${X0},${Y1} ${polyPts} ${X1},${Y1}`;

    const grid = [0.25, 0.5, 0.75, 1].map((f) => {
      const y = ys(maxG * f / 1.1);
      return `<line x1="${X0}" y1="${y.toFixed(1)}" x2="${X1}" y2="${y.toFixed(1)}" stroke="rgba(43,33,25,0.08)"/>
              <text x="${X0 - 5}" y="${(y + 3).toFixed(1)}" fill="#85745e" font-size="8.5" text-anchor="end">${((carryCap * f) / 1000).toFixed(0)}k</text>`;
    }).join("");

    const svgEl = document.getElementById("plan-food-curve-svg");
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
      <text x="${xs(5)}" y="116" fill="#3e6b5a" font-size="9" text-anchor="middle">第5旬 抵${tName}</text>
      <text x="${xs(9)}" y="116" fill="#8a6524" font-size="9" text-anchor="middle">本季末</text>
      <text x="${X1}" y="116" fill="#85745e" font-size="9" text-anchor="end">第18旬</text>
      ${pnrTick !== -1 ? `<line x1="${xs(pnrTick)}" y1="${Y0 - 4}" x2="${xs(pnrTick)}" y2="${Y1}" stroke="#b9822d" stroke-dasharray="3,3" stroke-width="1.2"/>
        <rect x="${xs(pnrTick) - 30}" y="0" width="60" height="13" rx="6.5" fill="rgba(185,130,45,0.14)" stroke="#b9822d" stroke-width="0.8"/>
        <text x="${xs(pnrTick)}" y="9.5" fill="#7a5414" font-size="8.8" text-anchor="middle">不归点 · 第${pnrTick}旬</text>` : ""}
      ${starving ? `<line x1="${xs(starveTick)}" y1="${Y0}" x2="${xs(starveTick)}" y2="${Y1}" stroke="#a33a2a" stroke-width="1.6"/>
        <text x="${xs(starveTick) + 4}" y="${Y0 + 10}" fill="#a33a2a" font-size="9" font-weight="700">第${starveTick}旬断粮</text>` : ""}
      <polygon points="${areaPts}" fill="url(#foodArea)"/>
      <polyline fill="none" stroke="${lineCol}" stroke-width="2" stroke-linejoin="round" points="${polyPts}"/>
      ${pts.filter((p) => p.t % 3 === 0).map((p) => `<circle cx="${xs(p.t).toFixed(1)}" cy="${ys(p.g).toFixed(1)}" r="2.4" fill="#fbf7ee" stroke="${lineCol}" stroke-width="1.4"/>`).join("")}
    `;

    const metaEl = document.getElementById("plan-food-curve-meta");
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

  // ==================== 6. 案上器物 → 抽屉 ====================
  // 旧接口名保留：switchDockPanel = 打开指定抽屉。
  function switchDockPanel(panelName) {
    openDrawer(panelName);
  }

  function openDrawer(panelName) {
    if (!DRAWERS[panelName]) return;
    GAME.activePanel = panelName;
    GAME.drawerOpen = true;
    renderActiveDockPanel();
    syncDrawerUI();
    const scroller = document.querySelector("#drawer .drawer-scroll");
    if (scroller) scroller.scrollTop = 0;
  }

  function closeDrawer() {
    GAME.drawerOpen = false;
    syncDrawerUI();
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
    const curve = document.getElementById("plan-curve-drawer");
    if (curve) curve.classList.toggle("show", GAME.activePanel === "military");
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
      kindEl.textContent = typeName;
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

    // 急报：季初待办 + 临界城邦（汉影响与匈威吓胶着） + 被围
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
    document.getElementById("ol-alert-count").textContent = alerts.length ? `${alerts.length} 条` : "";
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

  function renderActiveDockPanel() {
    const body = document.getElementById("dock-panel-body");
    const p = GAME.activePanel;
    if (p === "inspector") renderPanelInspector(body);
    else if (p === "court") renderPanelCourtOrTribes(body);
    else if (p === "diplomacy") renderPanelDiplomacy(body);
    else if (p === "logistics") renderPanelLogistics(body);
    else if (p === "military") renderPanelMilitary(body);
    else if (p === "chronicle") renderPanelChronicle(body);
    polishPanel(body);
  }

  // 统一面板视觉：卡片标题去掉方括号、尾注收为小字；行动按钮拆成「标题 / 代价」两行
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

  // ---- [F1] 城塞与驻军检视面板 ----
  function renderPanelInspector(container) {
    const st = GAME.state;
    const side = st.meta.side;
    const n = st.nodes[GAME.selectedNodeId] || st.nodes.lou_lan;
    const rel = n.relation;
    const meta = MVP_NODE_META[n.id] || {};
    const swatch = getGodotNodeColor(n.id, n);

    const armiesHtml =
      n.armies && n.armies.length > 0
        ? n.armies
            .map(
              (a) => `
          <div class="sub-item">
            <div class="sub-title">
              <span>${a.name}<span style="color:var(--text-muted);font-weight:400;"> · ${a.commander_name || "校尉"}</span></span>
              <span class="badge ${a.faction === "han" ? "badge-red" : "badge-blue"}">${(a.soldiers || 0).toLocaleString()} 人</span>
            </div>
            <div class="sub-meta">战马 ${(a.horses || 0).toLocaleString()} 匹 · 统率 ${a.commander_cmd || 78} · <span style="color:var(--green-light)">就食城仓</span></div>
          </div>`
            )
            .join("")
        : `<div class="note">无野战军驻扎，地方守备 ${(n.militia || 0).toLocaleString()} 人。</div>`;

    const statRow = (k, v, color) => `
      <div class="stat-bar-row"><span class="k">${k}</span>
        <div class="mini-bar"><div class="mini-bar-fill" style="width:${clamp(v, 0, 100)}%;background:${color};"></div></div>
        <span class="v">${v.toFixed(0)}</span></div>`;

    container.innerHTML = `
      <div class="game-card bamboo">
        <div class="card-head">
          <span><i style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${swatch};border:1px solid #2a1d10;align-self:center;"></i>${n.name}<small class="head-note">${{ city: "城邦", nomad: "游牧", source: "郡治", pass: "关隘", junction: "路口" }[meta.type || n.type] || ""}</small></span>
          <span class="badge ${rel ? (rel.overlord === "han" ? "badge-red" : rel.overlord === "xiongnu" ? "badge-blue" : "badge-gold") : n.controller === "han" ? "badge-red" : "badge-blue"}">${ownerLabel(n)}</span>
        </div>
        <div class="kv-grid">
          <div class="kv"><span class="k">人口</span><span class="v">${(n.pop || 0).toLocaleString()}</span></div>
          <div class="kv"><span class="k">储粮</span><span class="v">${((n.grain || 0) / 1000).toFixed(1)}k <small style="color:var(--text-faint);font-weight:400">石</small></span></div>
          <div class="kv"><span class="k">城墙</span><span class="v">${n.type === "junction" ? "无" : `${n.walls || 1} 级`}</span></div>
          <div class="kv"><span class="k">烽燧 · 屯田</span><span class="v">${n.has_beacon ? "已筑" : "无"} · ${n.tuntian_lv ? n.tuntian_lv + " 级" : "无"}</span></div>
        </div>
        ${
          rel
            ? `
          <div class="divider"></div>
          ${statRow("汉影响", rel.han_influence, "var(--han)")}
          ${statRow("匈奴威吓", rel.xn_intimidation, "#a07a5e")}
          ${statRow("对匈怨恨", rel.xn_resentment, "var(--amber)")}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:12px;">
            <span style="color:var(--text-muted)">大军过境供粮意愿</span>
            <span class="badge" style="color:${rel.forage ? tone(rel.forage.color) : "var(--gold-light)"}">${rel.forage ? rel.forage.label : "平价开市"}</span>
          </div>
          ${rel.crimes > 0 ? `<div class="alert-line">已有讨伐罪状（遮杀汉使 / 劫掠商队）——发兵讨伐不损朝廷信任。</div>` : ""}
        `
            : ""
        }
      </div>

      <div class="game-card">
        <div class="card-head"><span>对${n.name}下令<small class="head-note">点击加入本季军令</small></span></div>
        ${
          side === "han"
            ? `
          <div class="action-grid">
            <button class="btn btn-gold act" id="act-elite-envoy"><span class="act-title">遣精使</span><span class="act-meta">300 钱 · 影响 +18</span></button>
            <button class="btn act" id="act-hire-envoy"><span class="act-title">遣募使</span><span class="act-meta">140 钱 · 影响 +10 · 或生事端</span></button>
            <button class="btn btn-emerald act" id="act-enfeoff"><span class="act-title">册封为属国</span><span class="act-meta">200 钱 · 需影响达标</span></button>
            <button class="btn act" id="act-assassinate-king"><span class="act-title">刺王更立</span><span class="act-meta">320 钱 · 傅介子奇谋</span></button>
            <button class="btn act" id="act-supply-to"><span class="act-title">拉通粮道</span><span class="act-meta">220 钱 · 配马350匹</span></button>
            <button class="btn act" id="act-build-tuntian"><span class="act-title">开置军屯</span><span class="act-meta">220 钱 · 功业 +4.5</span></button>
            <button class="btn act" id="act-build-beacon"><span class="act-title">修筑烽燧</span><span class="act-meta">150 钱 · 城防+8%</span></button>
            <button class="btn act" id="act-recruit-convicts"><span class="act-title">赦募七科谪</span><span class="act-meta">120 钱 · +2,200 兵</span></button>
            <button class="btn btn-han act span-2" id="act-attack-node"><span class="act-title">发兵讨伐</span><span class="act-meta">180 钱 · 主力 5,000</span></button>
          </div>
        `
            : `
          <div class="action-grid">
            <button class="btn btn-blue act" id="act-xn-intimidate"><span class="act-title">遣骑威压</span><span class="act-meta">50 钱 · 威吓 +15</span></button>
            <button class="btn btn-gold act" id="act-xn-vassal"><span class="act-title">索取质子</span><span class="act-meta">120 钱 · 威服 +7.5</span></button>
            <button class="btn act" id="act-xn-install-prince"><span class="act-title">废立亲匈王</span><span class="act-meta">180 钱 · 强控王庭</span></button>
            <button class="btn act" id="act-xn-pacify"><span class="act-title">安抚日逐王</span><span class="act-meta">150 钱 · 忠诚 +15</span></button>
            <button class="btn btn-han act span-2" id="act-attack-node"><span class="act-title">控弦攻掠</span><span class="act-meta">180 钱 · 铁骑 5,000</span></button>
          </div>
        `
        }
      </div>

      <div class="game-card">
        <div class="card-head"><span>驻军</span><span class="badge">${(n.armies || []).length} 部</span></div>
        ${armiesHtml}
      </div>
    `;

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

  // ---- [F2] 长安朝廷与竹简文书 / 单于王庭与四部分赏 ----
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
      container.innerHTML = `
        <div class="game-card bamboo">
          <div class="card-head">
            <span>长安诏令<small class="head-note">朝议风向：武帝拓边</small></span>
            <span class="badge badge-gold">信任 ${v1.court.trust.toFixed(0)}</span>
          </div>
          ${
            ed
              ? `
            <div class="edict-scroll">
              <div class="edict-title">
                <span>《${ed.title}》</span>
                <span class="badge ${ed.complied ? "badge-green" : "badge-red"}">${ed.complied ? "已奉诏" : `限第 ${ed.deadline_turn} 季`}</span>
              </div>
              <div class="edict-meta">目标：<strong>${st.nodes[ed.target] ? st.nodes[ed.target].name : ed.target}</strong> · 功成：钱 +${ed.reward_money}、信任 +${ed.reward_trust}</div>
              ${ed.desc ? `<div class="edict-meta" style="font-family:var(--font-serif);color:var(--text-muted);">${ed.desc}</div>` : ""}
            </div>
            <div class="action-grid">
              <button class="btn btn-gold act" id="btn-court-comply"><span class="act-title">奉诏行事</span><span class="act-meta">信任 +5</span></button>
              <button class="btn btn-blue act" id="btn-court-bargain"><span class="act-title">上书讨价</span><span class="act-meta">展期 2 季 · 请款 500</span></button>
            </div>
          `
              : `<div class="note">暂无待办诏书。</div>`
          }
          <div class="divider"></div>
          <div class="action-grid">
            <button class="btn act" id="btn-court-money"><span class="act-title">上疏请款</span><span class="act-meta">+900 钱 · 信任 −5</span></button>
            <button class="btn act" id="btn-court-troops"><span class="act-title">请调兵马</span><span class="act-meta">+2,000 兵 · +1,800 马</span></button>
            <button class="btn btn-emerald act span-2" id="btn-court-duhu"><span class="act-title">奏请设立西域都护府</span><span class="act-meta">300 钱 · 功业 +16</span></button>
          </div>
        </div>

        <div class="game-card">
          <div class="card-head">
            <span>持节矫诏<small class="head-note">将在外，君命有所不受</small></span>
            <span class="badge badge-red">高风险</span>
          </div>
          <p class="note" style="margin-bottom:10px;">不待诏书，径发诸国兵奇袭。若破城捷报先于廷尉槛车抵达长安，可将功折罪，甚至封侯。</p>
          <div class="form-grid" style="margin-bottom:10px;">
            <label>奇袭目标
              <select id="sel-forged-target">
                <option value="cheshi_qian" ${GAME.forgedTarget === "cheshi_qian" ? "selected" : ""}>车师前 · 距长安 58 日</option>
                <option value="lou_lan" ${GAME.forgedTarget === "lou_lan" ? "selected" : ""}>楼兰 · 距长安 42 日</option>
                <option value="qiu_ci" ${GAME.forgedTarget === "qiu_ci" ? "selected" : ""}>龟兹 · 距长安 64 日</option>
                <option value="da_yuan" ${GAME.forgedTarget === "da_yuan" ? "selected" : ""}>大宛 · 距长安 78 日</option>
              </select>
            </label>
            <label class="chk-inline" style="flex-direction:row;align-self:end;padding-bottom:5px;">
              <input type="checkbox" id="chk-forged-impeach" ${GAME.forgedSelfImpeach ? "checked" : ""} /> 同时上《自劾疏》（信任仅 −6）
            </label>
          </div>
          <div class="race">
            <div class="race-row"><span style="color:var(--green-light)">捷报</span>
              <div class="mini-bar"><div class="mini-bar-fill" style="width:${(green / maxD) * 100}%;background:var(--green);"></div></div>
              <span style="text-align:right">${green} 日</span></div>
            <div class="note" style="margin:-3px 0 7px 78px;font-size:11px;">急行 16 + 破城 24 + 露布驰报 58</div>
            <div class="race-row"><span style="color:var(--han-light)">槛车</span>
              <div class="mini-bar"><div class="mini-bar-fill" style="width:${(red / maxD) * 100}%;background:var(--danger);"></div></div>
              <span style="text-align:right">${red} 日</span></div>
            <div class="note" style="margin:-3px 0 4px 78px;font-size:11px;">监军密奏 58 + 廷议 10 + 槛车追抵 58</div>
            <div class="race-verdict">捷报早到 ${red - green} 日——可望将功折罪，功业 +12。</div>
          </div>
          <button class="btn btn-han" id="btn-do-forge-edict" style="width:100%; margin-top:10px; padding:8px;">矫诏发兵 · 奇袭${fName}</button>
        </div>
      `;

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
      container.innerHTML = `
        <div class="game-card bamboo">
          <div class="card-head">
            <span>四部分赏<small class="head-note">不患寡而患不均</small></span>
            <span class="badge badge-blue">赏赐池: ${v1.tribes.reward_pool} 钱</span>
          </div>
          <p style="font-size:11.5px; color:var(--text-muted); margin-bottom:8px;">
            拖动滑块调配单于赏赐池份额（若日逐王先贤掸份额低于期望 20%，将触发嫉妒惩罚并密谋降汉）：
          </p>
          ${[
            ["zuoxian", "左贤王部 (期望35%)", tr.zuoxian.loyalty],
            ["youxian", "右贤王部 (期望30%)", tr.youxian.loyalty],
            ["rizhu", "日逐王部 (掌西域·期望20%)", tr.rizhu.loyalty],
            ["lihu", "犁汗王部 (前锋·期望15%)", tr.lihu.loyalty],
          ]
            .map(
              ([k, label, loy]) => `
            <div style="margin-bottom:7px;">
              <div style="display:flex; justify-content:space-between; font-size:12px;">
                <span>${label} — 当前忠诚: <strong style="color:${loy >= 55 ? "var(--green-light)" : "var(--han-light)"}">${loy.toFixed(0)}</strong></span>
                <strong id="lbl-share-${k}">${ratios[k]}%</strong>
              </div>
              <input type="range" min="0" max="70" value="${ratios[k]}" data-tribe-slider="${k}"/>
            </div>
          `
            )
            .join("")}
          <div class="action-grid">
            <button class="btn" id="btn-xn-equalize">按期望份额一键配平</button>
            <button class="btn btn-gold" id="btn-xn-distribute">颁行本季四部分赏 (200钱)</button>
          </div>
        </div>

        <div class="game-card">
          <div class="card-head"><span>大会 · 战术 · 僮仆都尉</span></div>
          <div class="action-grid">
            <button class="btn btn-blue" id="btn-xn-assembly">召开龙城/蹛林大会盟誓 (+6威望)</button>
            <button class="btn btn-gold" id="btn-xn-pacify-rizhu">专使赐金安抚日逐王 (忠+15)</button>
            <button class="btn" id="btn-xn-card-retreat">战术卡：诈败诱敌 (伏击+30%)</button>
            <button class="btn" id="btn-xn-card-beacon">战术卡：拔除亭障 (盲汉视野)</button>
            <button class="btn" id="btn-xn-tax-normal">僮仆都尉：常赋岁币 (+320钱)</button>
            <button class="btn btn-han" id="btn-xn-tax-heavy">僮仆都尉：重敛竭泽 (+550钱)</button>
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

  // ---- [F3] 西域十八国总览表与都护府功业 G 拆解面板 ----
  function renderPanelDiplomacy(container) {
    const st = GAME.state;
    const v1 = st.v1;
    const side = st.meta.side;
    const bd = v1.victory.han_merit_breakdown || {};

    const stateNodes = Object.values(st.nodes).filter((n) => n.relation);
    stateNodes.sort((a, b) => {
      const ra = a.relation;
      const rb = b.relation;
      if (GAME.diploSort.col === "han_inf") return rb.han_influence - ra.han_influence;
      if (GAME.diploSort.col === "xn_intim") return rb.xn_intimidation - ra.xn_intimidation;
      return Math.abs(55 - ra.han_influence) - Math.abs(55 - rb.han_influence);
    });

    const merit = v1.victory.han_merit;
    const items = [
      ["属国", bd.vassal || st.scores.han_vassals * 6, "每国 +6"],
      ["册封", bd.enfeoff || 0, "每国 +2"],
      ["枢纽", bd.hub || 0, "乌垒 / 车师"],
      ["屯田", bd.tuntian || 0, "塞外军屯"],
      ["罢僮仆", v1.tribes.tongpu_active ? 0 : 10, "罢匈奴僮仆都尉"],
      ["勋绩", v1.victory.han_perm_merit || 0, "永久功业"],
    ];
    const sortBtn = (id, col, label) => `<button id="${id}" class="${GAME.diploSort.col === col ? "on" : ""}">${label}</button>`;
    container.innerHTML = `
      <div class="game-card bamboo">
        <div class="card-head">
          <span>${side === "han" ? "都护功业" : "西域形势"}<small class="head-note">${side === "han" ? "满 100 可奏立西域都护府" : "汉方功业进度"}</small></span>
          <span class="badge badge-gold">G ${merit.toFixed(1)} / 100</span>
        </div>
        <div class="mini-bar" style="width:100%;height:6px;margin-bottom:10px;"><div class="mini-bar-fill" style="width:${clamp(merit, 0, 100)}%;background:linear-gradient(90deg,#b8893c,#e9d39a);"></div></div>
        <div class="kv-grid" style="grid-template-columns:repeat(3,1fr);">
          ${items.map(([k, v, tip]) => `<div class="kv" title="${tip}"><span class="k">${k}</span><span class="v" style="color:${v > 0 ? "var(--gold-light)" : "var(--text-faint)"}">+${v}</span></div>`).join("")}
        </div>
        ${
          side === "han"
            ? `
          <div class="action-grid" style="margin-top:12px;">
            <button class="btn btn-gold act" id="btn-diplo-welcome-rizhu"><span class="act-title">迎降日逐王</span><span class="act-meta">功业 +25 · 永罢僮仆都尉</span></button>
            <button class="btn act" id="btn-diplo-raid-tongpu"><span class="act-title">邀击僮仆税队</span><span class="act-meta">+320 钱 · 日逐忠诚 −9</span></button>
            <button class="btn btn-emerald act span-2" id="btn-diplo-levy-vassals"><span class="act-title">持节发诸国兵</span><span class="act-meta">260 钱 · 征调西域属国与乌孙胡骑会师</span></button>
          </div>
        `
            : ""
        }
      </div>

      <div class="game-card" style="padding-bottom:6px;">
        <div class="card-head">
          <span>西域诸国<small class="head-note">${stateNodes.length} 国 · 点击行定位</small></span>
          <span class="seg">${sortBtn("sort-by-gap", "gap", "临界")}${sortBtn("sort-by-han", "han_inf", "汉影响")}${sortBtn("sort-by-xn", "xn_intim", "匈威吓")}</span>
        </div>
        <div style="max-height:420px; overflow-y:auto; margin:0 -4px;">
          <table class="diplo-table">
            <thead>
              <tr><th>国</th><th>宗主</th><th style="text-align:right">汉</th><th style="text-align:right">匈</th><th>供粮</th><th></th></tr>
            </thead>
            <tbody>
              ${stateNodes
                .map((n) => {
                  const r = n.relation;
                  const ovBadge =
                    r.overlord === "han"
                      ? '<span class="badge badge-red">汉属</span>'
                      : r.overlord === "xiongnu"
                      ? '<span class="badge badge-blue">匈属</span>'
                      : '<span class="badge">独立</span>';
                  return `
                  <tr data-row-nid="${n.id}" class="${n.id === GAME.selectedNodeId ? "sel" : ""}">
                    <td><strong style="color:var(--text-main)">${n.name}</strong>${r.crimes > 0 ? ' <span class="badge badge-red" style="padding:0 4px;">罪</span>' : ""}</td>
                    <td>${ovBadge}</td>
                    <td class="num" style="color:var(--han-light)">${r.han_influence.toFixed(0)}</td>
                    <td class="num" style="color:var(--xn-light)">${r.xn_intimidation.toFixed(0)}</td>
                    <td><span style="color:${r.forage ? tone(r.forage.color) : "var(--gold-light)"}; font-size:11px;">${r.forage ? r.forage.label.split(/[（(]/)[0].slice(0, 4) : "开市"}</span></td>
                    <td style="text-align:right">
                      ${
                        side === "han"
                          ? `<button class="btn" data-quick-envoy="${n.id}">遣使</button> <button class="btn btn-gold" data-quick-vassal="${n.id}">册封</button>`
                          : `<button class="btn btn-blue" data-quick-intim="${n.id}">威压</button>`
                      }
                    </td>
                  </tr>
                `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
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

    document.getElementById("sort-by-gap").onclick = () => {
      GAME.diploSort.col = "gap";
      renderPanelDiplomacy(container);
    };
    document.getElementById("sort-by-han").onclick = () => {
      GAME.diploSort.col = "han_inf";
      renderPanelDiplomacy(container);
    };
    document.getElementById("sort-by-xn").onclick = () => {
      GAME.diploSort.col = "xn_intim";
      renderPanelDiplomacy(container);
    };

    container.querySelectorAll("[data-row-nid]").forEach((trEl) => {
      trEl.addEventListener("click", () => {
        const nid = trEl.getAttribute("data-row-nid");
        GAME.selectedNodeId = nid;
        GAME.planDraft.target = nid;
        renderStrategicMap();
        renderFoodCurveDrawer();
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

  // ---- [F4] 万里粮道与转运屯田面板 ----
  function renderPanelLogistics(container) {
    const st = GAME.state;
    const v1 = st.v1;
    const sls = (v1 && v1.logistics.supply_lines) || [];

    container.innerHTML = `
      <div class="game-card bamboo">
        <div class="card-head">
          <span>自动补给线<small class="head-note">每旬自动从后方转运粟米</small></span>
          <span class="badge badge-green">${sls.length} 条运转中</span>
        </div>
        <p style="font-size:11.5px; color:var(--text-muted); margin-bottom:8px;">
          补给线建立后自动派车，无需逐段运粮。线宽代表运量，红色表示缺口。
        </p>
        ${sls
          .map(
            (s) => `
          <div class="sub-item">
            <div style="display:flex; justify-content:space-between; font-weight:700; color:var(--green-light);">
              <span>${s.name}</span>
              <span>月运量: ${((s.delivered_30d || 18000) / 1000).toFixed(1)}k 斛</span>
            </div>
            <div style="color:var(--text-muted); font-size:11px; margin-top:3px;">
              征发民夫: ${s.laborers} 人 | 护粮策略: ${s.escort ? "沿途军兵护送" : "遇敌即停"}
            </div>
          </div>
        `
          )
          .join("")}
        <div style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--border);">
          <div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">
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
          <button class="btn btn-gold" id="btn-create-sl" style="width:100%;">拉通敦煌 → 终点（180 钱）</button>
        </div>
      </div>

      <div class="game-card">
        <div class="card-head"><span>军屯与烽燧</span></div>
        <div style="font-size:12px; margin-bottom:8px;">
          已开置军屯节点：<strong>${Object.keys(v1.logistics.tuntian_nodes).map((k) => `${st.nodes[k] ? st.nodes[k].name : k}(Lv.${v1.logistics.tuntian_nodes[k]})`).join("、") || "敦煌"}</strong>
        </div>
        <div class="action-grid">
          <button class="btn btn-emerald" id="btn-log-tuntian-loulan">开置【楼兰】军屯 (+42k粮/+4.5G)</button>
          <button class="btn btn-emerald" id="btn-log-tuntian-quli">开置【渠犁】军屯 (+42k粮/+4.5G)</button>
          <button class="btn btn-emerald" id="btn-log-tuntian-wulei">开置【乌垒】都护屯田 (+4.5G)</button>
          <button class="btn" id="btn-log-beacon-loulan">修筑【楼兰—渠犁】烽燧链</button>
        </div>
      </div>
    `;

    document.getElementById("rng-sl-lab").oninput = (e) => {
      document.getElementById("lbl-sl-lab").textContent = e.target.value;
    };
    document.getElementById("btn-create-sl").onclick = () => {
      const toId = document.getElementById("sel-sl-target").value;
      const lab = parseInt(document.getElementById("rng-sl-lab").value, 10);
      const nm = st.nodes[toId] ? st.nodes[toId].name : toId;
      queueCustomOrder({
        type: "set_supply_line",
        desc: `【万里粮道】拉通「敦煌 → ${nm}」自动补给线 (民夫 ${lab} 人，月运 ${(lab * 9 / 1000).toFixed(1)}k 斛)`,
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

  // ---- [F5] 诸军节度与作战计划编辑器 ----
  function renderPanelMilitary(container) {
    const st = GAME.state;
    const side = st.meta.side;
    const targetNode = st.nodes[GAME.planDraft.target] || st.nodes.lou_lan;

    container.innerHTML = `
      <div class="game-card bamboo">
        <div class="card-head">
          <span>远征计划<small class="head-note">与下方粮秣预演联动</small></span>
          
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:12px; margin-bottom:8px;">
          <label>出发
            <select id="mil-sel-origin" style="width:100%; margin-top:3px;">
              ${
                side === "han"
                  ? `<option value="dun_huang">敦煌大本营 (赵破奴军)</option>
                     <option value="jiu_quan">酒泉军镇 (霍去病/李广利)</option>
                     <option value="wu_lei">乌垒前线都护营 (郑吉)</option>`
                  : `<option value="chanyu_ting">漠南单于庭 (伊稚斜亲军)</option>
                     <option value="cheshi_qian">车师前王庭 (右贤王/日逐王骑)</option>`
              }
            </select>
          </label>
          <label>目标（可在舆图点选）
            <select id="mil-sel-target" style="width:100%; margin-top:3px;">
              ${Object.values(st.nodes)
                .map((n) => `<option value="${n.id}" ${n.id === GAME.planDraft.target ? "selected" : ""}>${n.name}</option>`)
                .join("")}
            </select>
          </label>
          <label>战兵 (<strong id="lbl-mil-soldiers">${GAME.planDraft.soldiers}</strong>人)：
            <input type="range" id="rng-mil-soldiers" min="1500" max="12000" step="500" value="${GAME.planDraft.soldiers}" style="margin-top:5px;"/>
          </label>
          <label>民夫 (<strong id="lbl-mil-lab">${GAME.planDraft.laborers}</strong>人)：
            <input type="range" id="rng-mil-lab" min="500" max="6000" step="500" value="${GAME.planDraft.laborers}" style="margin-top:5px;"/>
          </label>
        </div>
        <div style="margin-bottom:8px;">
          <label style="font-size:12px;">常备指令
            <select id="mil-sel-standing" style="width:100%; margin-top:3px;">
              <option value="cautious" ${GAME.planDraft.standingOrder === "cautious" ? "selected" : ""}>谨慎保军 · 余粮触及返程线即班师</option>
              <option value="standard" ${GAME.planDraft.standingOrder === "standard" ? "selected" : ""}>均衡推进 · 常规行军围城</option>
              <option value="aggressive" ${GAME.planDraft.standingOrder === "aggressive" ? "selected" : ""}>见利则进 · 强攻到底，断粮则饿死</option>
            </select>
          </label>
        </div>
        <button class="btn btn-han" id="btn-mil-commit-plan" style="width:100%; padding:8px;">传檄 · 远征${targetNode ? targetNode.name : "目标"}</button>
      </div>
    `;

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

  // ---- [F6] 太史竹帛战报流与断粮饿死单列面板 ----
  function renderPanelChronicle(container) {
    const st = GAME.state;
    const logs = [...(st.turn_logs || [])].reverse();
    const reports = st.battle_reports || [];

    container.innerHTML = `
      <div class="game-card bamboo">
        <div class="card-head">
          <span>战报<small class="head-note">饿死与阵亡分列</small></span>
          <span class="badge badge-red">累计饿死: ${st.scores.starve_losses || 0} 人</span>
        </div>
        ${
          reports.length === 0
            ? `<div style="font-size:12px; color:var(--text-muted);">尚无交战记录。下达远征军令并推进一季后，战报会出现在这里。</div>`
            : reports
                .slice(0, 5)
                .map(
                  (br) => `
              <div class="report-item">
                <div>
                  <strong style="color:var(--gold-light);">【第${br.turn}季 · ${br.node_name}之战】</strong> ${br.commander} (${br.victory ? "大捷" : "激战"})
                  <div style="font-size:11px; color:var(--text-muted);">斩首 ${br.defender_loss} | 战死 ${br.attacker_combat_loss} | <span style="color:var(--han-light);">断粮饿死 ${br.attacker_starve_loss} 人</span></div>
                </div>
                <button class="btn btn-gold" data-open-battle="${br.id}" style="padding:3px 8px; font-size:11px;">详报</button>
              </div>
            `
                )
                .join("")
        }
      </div>

      <div class="game-card">
        <div class="card-head"><span>编年纪事<small class="head-note">点击条目定位城邦</small></span></div>
        <div style="max-height:320px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
          ${
            logs.length === 0
              ? `<div style="color:var(--text-muted); font-size:12px;">尚无纪事。拟定军令后点击右上角「结束本季」开始推演。</div>`
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
          selectNodeAndPan(nid, "inspector");
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

    // 若玩家未手动拟令，默认采用幕僚推荐的 3 条指令
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
        selectNodeAndPan(nid, p);
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
        version: "v1.0.0",
        saved_at: new Date().toLocaleTimeString(),
        scenario: GAME.state.meta.scenario,
        side: GAME.state.meta.side,
        turn: GAME.state.meta.turn,
        date_text: GAME.state.meta.date_text,
        state: GAME.state,
      };
      localStorage.setItem("xiyu_save_" + slotKey, JSON.stringify(payload));
    } catch (e) {
      // ignore storage quota errors in private mode
    }
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

  // ==================== 11. 事件绑定与键盘快捷键 (F1–F6 / Space / Tab) ====================
  function bindGameEvents() {
    // 案上器物：打开 / 收起抽屉；漏刻切换回放速度
    document.querySelectorAll(".desk-prop[data-panel]").forEach((prop) => {
      prop.addEventListener("click", () => {
        const panel = prop.getAttribute("data-panel");
        if (panel === "speed") cycleReplaySpeed();
        else toggleDrawer(panel);
      });
    });
    document.getElementById("btn-drawer-close").onclick = closeDrawer;

    // 图层浮层
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


    // 地图缩放与拖拽（拖拽只改 viewBox，不重绘）
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
      // 视口中心偏移（meet 模式下 SVG 内容居中）
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

    // 触屏：单指拖动、双指缩放（iPad）。鼠标仍走下面的 mousedown / wheel 逻辑。
    const touches = new Map();
    let pinch = null;
    vp.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch") return;
      if (e.target.closest(".tutorial-floating-card, .map-hud-controls, .map-layers")) return;
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
      if (e.target.closest(".tutorial-floating-card, .map-hud-controls, .map-layers, .map-cartouche")) return;
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
      // 让紧随其后的 click 事件能识别"刚刚拖拽过"
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

    // 全局键盘快捷键
    window.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA")) return;
      const fMap = { F1: "inspector", F2: "court", F3: "diplomacy", F4: "logistics", F5: "military", F6: "chronicle" };
      if (e.key === "Escape") {
        const openModal = document.querySelector(".modal-backdrop.open");
        if (openModal) openModal.classList.remove("open");
        else if (document.getElementById("layers-pop").classList.contains("open")) document.getElementById("btn-layers").click();
        else closeDrawer();
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
    startNewCampaign({ side: qs.get("side") === "xiongnu" ? "xiongnu" : "han", scenario: qs.get("scenario") || "mo_bei_zhi_hou", difficulty: "standard", opp_bot: "balanced", seed: 11001 });
    // 便于分享 / 截图的 URL 参数：?side=xiongnu&panel=court&modal=scenario|summary&tutorial=0&drawer=1
    if (qs.get("tutorial") === "0") {
      GAME.tutorialOpen = false;
      renderTutorialCard();
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
