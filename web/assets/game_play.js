/**
 * 《西域·汉匈争霸》v1.0 商业级网页可玩版主控制器 (S07 全规范实现)
 * 驱动 `web/play.html`，与 `web/index.html` (S09 验证工作台) 共享底层数据包与模拟引擎。
 */
(function () {
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  const BUNDLE = window.XIYU_BUNDLE;
  const engine = new window.JSSimEngine(BUNDLE);

  const TUTORIAL_LESSONS = [
    {
      idx: 1,
      title: "🎓 第 1/5 课：持节出塞与《太史纪事》",
      body: "欢迎来到前108年（或前119年）的西域沙盘！您扮演的不是全知全能的皇帝，而是**持节出玉门关的汉廷正使**。请先点击舆图中央的锁钥城邦【楼兰】，在右侧 `[F1 城塞检视]` 查看其匈奴威吓与罪状。",
      btnText: "👉 一键定位【楼兰】并检视",
      action: () => selectNodeAndPan("lou_lan", "inspector"),
    },
    {
      idx: 2,
      title: "🎓 第 2/5 课：拉通「敦煌→楼兰」万里自动补给线",
      body: "《孙子》云：军无辎重则亡。远征西域前必须先建粮道。请切至右侧 `[F4 粮道屯田]`（或点击下方快捷按钮），拉通【敦煌 → 楼兰】自动补给线，免去每季手工运粮之苦。",
      btnText: "🚚 一键拟令：拉通敦煌→楼兰粮道",
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
      title: "🎓 第 3/5 课：0–18旬余粮折线、不归点与轻骑奇袭",
      body: "观察舆图底部的**【0–18旬余粮折线与不归点预演器】**：大军出塞若选「见利则进」且粮道未通，过不归点后将断粮饿死；而选用 **🟢【谨慎保军 (cautious)】** 常备指令，余粮触及返程红线会自动班师（零饿死）！",
      btnText: "⚔️ 拟令：遣赵破奴军奔袭楼兰 (谨慎保军)",
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
      title: "🎓 第 4/5 课：西域十八国总览表与都护府功业 G",
      body: "切至右侧 `[F3 十八国表]`，可按「距晋升差值 / 汉影响力 / 供粮意愿」一键排序西域诸国，并查看顶部 **【都护府功业 G (满 100 立都护府)】** 的 9 项分项来源。",
      btnText: "🕊️ 打开 [F3 十八国总览] 并遣精使抚楼兰",
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
      title: "🎓 第 5/5 课：竹简诏书、上书讨价与「持节矫诏生死环」",
      body: "切至 `[F2 长安朝廷]`，您可对天子诏书择定【奉诏行事】、【上书讨价（宽限2季+请款500钱）】或观察**【持节矫诏·生死时速环】**（对比我军破敌露布回京 vs 廷尉槛车追责的时间差）！准备就绪后点击右上角 **【▶ 结束本季 (Space)】** 观看 90 日推演！",
      btnText: "📜 打开 [F2 长安朝廷] 并奉诏行事",
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
    queuedOrders: [], // [{id, type, desc, cost_money, target_node, raw}]
    layers: {
      supply: true,
      fog: true,
      threat: false,
      trade: true,
      zone: true,
      tokens: true,
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

    document.body.className = side === "han" ? "faction-han" : "faction-xiongnu";
    const f2Label = document.getElementById("tab-label-f2");
    if (f2Label) f2Label.textContent = side === "han" ? "📜 长安朝廷" : "🐺 单于王庭";

    refreshAllUI();
    saveToSlot("autosave");
  }

  function refreshAllUI() {
    if (!GAME.state) return;
    renderTopHUD();
    renderTutorialCard();
    renderStrategicMap();
    renderFoodCurveDrawer();
    renderActiveDockPanel();
    renderBottomOrderQueue();
  }

  // ==================== 2. 顶栏汉/匈非对称双模式 HUD (S07-R02) ====================
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
      lou_lan_gu_shi: "剧本①《楼兰姑师》(前108年·12季)",
      mo_bei_zhi_hou: "剧本②《漠北之后》(前119年·40季)",
      du_hu_fu: "剧本③《西域都护府》(前68年·36季)",
    };

    if (side === "han") {
      sealEl.textContent = "大汉";
      leaderEl.textContent = st.meta.scenario === "du_hu_fu" ? "骑都尉·郑吉 (持节护西域)" : "博望侯·张骞 (持节正使)";
    } else {
      sealEl.textContent = "匈奴";
      leaderEl.textContent = `${v1.tribes.chanyu_name || "伊稚斜单于"} (撑犁孤涂大单于)`;
    }
    subEl.textContent = `${scenMap[st.meta.scenario] || st.meta.scenario} · ${st.meta.date_text}`;
    dateEl.textContent = `${st.meta.date_text}（第 ${st.meta.turn + 1} / ${st.meta.max_turns} 季）`;

    const queuedCost = GAME.queuedOrders.reduce((acc, o) => acc + (o.cost_money || 0), 0);
    ordCntEl.textContent = `已拟 ${GAME.queuedOrders.length} 令 (耗金 ${queuedCost})`;

    const pillsEl = document.getElementById("hud-asymmetric-pills");
    if (side === "han") {
      const trust = v1.court.trust;
      const trustTier = trust >= 80 ? "便宜行事" : trust >= 50 ? "正常委任" : trust >= 25 ? "监军掣肘" : "面临槛车召还";
      const trustColor = trust >= 50 ? "#10b981" : trust >= 25 ? "#f59e0b" : "#ef4444";
      const merit = v1.victory.han_merit;
      const edTitle = v1.court.active_edict ? v1.court.active_edict.title : "无在途诏书";
      const availMoney = Math.max(0, st.scores.han_money - queuedCost);

      pillsEl.innerHTML = `
        <div class="hud-pill" data-jump-panel="court" title="点击打开 [F2 长安朝廷与竹简文书]">
          <span>🏛️ 朝廷信任: <strong>${trust.toFixed(0)}</strong>/100</span>
          <div class="mini-bar"><div class="mini-bar-fill" style="width:${trust}%;background:${trustColor};"></div></div>
          <span class="badge badge-gold">${trustTier}</span>
        </div>
        <div class="hud-pill" data-jump-panel="logistics" title="点击打开 [F4 万里粮道与太仆官马]">
          <span>💰 少府库银: <strong>${availMoney.toLocaleString()}</strong> 钱</span>
          <span>| 🐎 官马: <strong>${(st.scores.han_horse_pool || 5000).toLocaleString()}</strong></span>
        </div>
        <div class="hud-pill" data-jump-panel="court" title="点击批阅当前天子诏书">
          <span>📜 奉行诏书: <strong style="color:#fde68a;">${edTitle.slice(0, 14)}...</strong></span>
          ${v1.court.active_edict && v1.court.active_edict.complied ? '<span class="badge badge-green">已奉诏</span>' : '<span class="badge badge-red">待表态</span>'}
        </div>
        <div class="hud-pill" data-jump-panel="diplomacy" title="点击打开 [F3 西域十八国总览与都护府功业拆解]">
          <span>🏆 都护府功业 G: <strong>${merit.toFixed(1)}</strong>/100</span>
          <div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.min(100, merit)}%;background:linear-gradient(90deg,#f59e0b,#10b981);"></div></div>
          <span class="badge badge-green">属国 ${st.scores.han_vassals}/18</span>
        </div>
      `;
    } else {
      const prest = v1.tribes.chanyu_prestige;
      const weifu = v1.victory.xn_weifu;
      const tr = v1.tribes.tribes;
      const availMoney = Math.max(0, st.scores.xn_money - queuedCost);
      const lamp = (tObj) => (tObj.loyalty >= 65 ? "🟢" : tObj.loyalty >= 48 ? "🟡" : "🔴");

      pillsEl.innerHTML = `
        <div class="hud-pill" data-jump-panel="court" title="点击打开 [F2 单于王庭与四部分赏]">
          <span>🐺 单于威望: <strong>${prest.toFixed(0)}</strong>/100</span>
          <div class="mini-bar"><div class="mini-bar-fill" style="width:${prest}%;background:#0ea5e9;"></div></div>
          <span>赏赐池: <strong>${availMoney}</strong> 钱</span>
        </div>
        <div class="hud-pill" data-jump-panel="court" title="点击调配四大部族分赏比例与安抚">
          <span>四部忠诚:</span>
          <span>左贤${lamp(tr.zuoxian)}<strong>${tr.zuoxian.loyalty.toFixed(0)}</strong></span>
          <span>右贤${lamp(tr.youxian)}<strong>${tr.youxian.loyalty.toFixed(0)}</strong></span>
          <span>日逐${lamp(tr.rizhu)}<strong>${tr.rizhu.loyalty.toFixed(0)}</strong></span>
          <span>犁汗${lamp(tr.lihu)}<strong>${tr.lihu.loyalty.toFixed(0)}</strong></span>
        </div>
        <div class="hud-pill" data-jump-panel="court" title="点击切换焉耆僮仆都尉征税档位与王庭战术卡">
          <span>💰 僮仆都尉: <strong>${v1.tribes.tongpu_active ? "在位征税" : "已罢黜"}</strong></span>
          <span class="badge badge-blue">战术:${v1.tribes.active_tactical_card || "待选"}</span>
        </div>
        <div class="hud-pill" data-jump-panel="diplomacy" title="点击打开 [F3 西域威服总览]">
          <span>🏹 单于威服 W: <strong>${weifu.toFixed(1)}</strong>/100</span>
          <div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.min(100, weifu)}%;background:#0ea5e9;"></div></div>
          <span class="badge badge-blue">服属 ${st.scores.xn_vassals} 国</span>
        </div>
      `;
    }

    pillsEl.querySelectorAll(".hud-pill").forEach((el) => {
      el.addEventListener("click", () => {
        const targetPanel = el.getAttribute("data-jump-panel");
        if (targetPanel) switchDockPanel(targetPanel);
      });
    });
  }

  // ==================== 3. 新手5课非阻塞式教学引导卡 (S07-R11) ====================
  function renderTutorialCard() {
    const card = document.getElementById("tutorial-card");
    const toggleBtn = document.getElementById("btn-toggle-tutorial");
    if (toggleBtn) {
      toggleBtn.textContent = `🎓 5课交互教学引导: ${GAME.tutorialOpen ? "开" : "关"}`;
    }
    if (!GAME.tutorialOpen) {
      card.style.display = "none";
      return;
    }
    card.style.display = "block";
    const lesson = TUTORIAL_LESSONS[GAME.tutorialIdx] || TUTORIAL_LESSONS[0];
    document.getElementById("tut-title").textContent = lesson.title;
    document.getElementById("tut-body").innerHTML = lesson.body.replace(/\*\*([^*]+)\*\*/g, "<strong style='color:#fef08a'>$1</strong>");
    const actBar = document.getElementById("tut-action-bar");
    actBar.innerHTML = `<button class="btn btn-gold" id="btn-tut-do-action">${lesson.btnText}</button>`;
    document.getElementById("btn-tut-do-action").addEventListener("click", () => {
      lesson.action();
    });
  }

  // ==================== 4. 西域42节点6层动态战略舆图 (S07-R07) ====================
  function renderStrategicMap() {
    const st = GAME.state;
    const svg = document.getElementById("game-map-svg");
    const mapPres = BUNDLE.map_presentation || { nodes: {} };
    const routes = BUNDLE.scenario_mvp.routes || [];

    svg.setAttribute("viewBox", `${GAME.mapCam.x} ${GAME.mapCam.y} ${GAME.mapCam.w} ${GAME.mapCam.h}`);

    const coords = {};
    const nodeIds = Object.keys(st.nodes);
    nodeIds.forEach((nid, idx) => {
      const mp = mapPres.nodes && mapPres.nodes[nid];
      if (mp && mp.pos && mp.pos.length === 2) {
        coords[nid] = { x: mp.pos[0] * 0.62 + 30, y: mp.pos[1] * 0.62 + 25 };
      } else {
        coords[nid] = { x: 120 + (idx % 8) * 105, y: 90 + Math.floor(idx / 8) * 90 };
      }
    });

    let parts = [];

    // 地理分区古舆图底纹标题
    parts.push(`
      <g opacity="0.24" pointer-events="none" font-family="serif" font-weight="bold">
        <text x="720" y="485" fill="#f87171" font-size="22" letter-spacing="6">河 西 四 郡 · 玉 门 阳 关</text>
        <text x="310" y="340" fill="#fbbf24" font-size="24" letter-spacing="8">塔 里 木 · 西 域 南 北 道</text>
        <text x="580" y="105" fill="#38bdf8" font-size="24" letter-spacing="8">漠 南 单 于 庭 · 阴 山 瀚 海</text>
        <text x="70" y="210" fill="#a78bfa" font-size="20" letter-spacing="5">葱 岭 · 乌 孙 大 宛</text>
      </g>
    `);

    // Z5: 疆域底纹与秋季白灾预警环
    if (GAME.layers.zone) {
      for (const nid of nodeIds) {
        const n = st.nodes[nid];
        const c = coords[nid];
        const ov = n.relation ? n.relation.overlord : n.controller;
        const haloColor =
          ov === "han" ? "rgba(220,38,38,0.13)" : ov === "xiongnu" ? "rgba(14,165,233,0.13)" : "rgba(148,163,184,0.06)";
        parts.push(`<circle cx="${c.x}" cy="${c.y}" r="28" fill="${haloColor}" pointer-events="none"/>`);
        if (n.controller === "xiongnu" && (st.meta.season === "autumn" || st.meta.season === "winter")) {
          parts.push(
            `<circle cx="${c.x}" cy="${c.y}" r="31" fill="none" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="3,3" class="pulse-ring" pointer-events="none"/>`
          );
        }
      }
    }

    // Z4: 丝路商道与僮仆税道 + 基础路网
    for (const r of routes) {
      const a = coords[r.from] || coords[r.a];
      const b = coords[r.to] || coords[r.b];
      if (!a || !b) continue;
      const isTrade = GAME.layers.trade && (r.terrain === "oasis" || r.terrain === "corridor" || r.from === "dun_huang" || r.to === "lou_lan");
      const stroke = isTrade ? "rgba(251, 191, 36, 0.42)" : "rgba(100, 116, 139, 0.32)";
      const dash = isTrade ? 'stroke-dasharray="5,4"' : "";
      parts.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${stroke}" stroke-width="${isTrade ? 2.2 : 1.3}" ${dash} pointer-events="none"/>`);
    }

    // 匈奴焉耆僮仆都尉税道
    if (GAME.layers.trade && st.v1 && st.v1.tribes.tongpu_active && coords.yan_qi && coords.cheshi_qian) {
      const yq = coords.yan_qi;
      const cs = coords.cheshi_qian;
      parts.push(
        `<line x1="${yq.x}" y1="${yq.y}" x2="${cs.x}" y2="${cs.y}" stroke="#38bdf8" stroke-width="2.5" stroke-dasharray="4,4" pointer-events="none"/>`
      );
    }

    // Z1: 万里自动补给线流光带 (S05-R01 / S07-R07)
    if (GAME.layers.supply && st.v1 && st.v1.logistics.supply_lines) {
      for (const sl of st.v1.logistics.supply_lines) {
        const a = coords[sl.from];
        const b = coords[sl.to];
        if (!a || !b) continue;
        const col = sl.status === "active" ? "#10b981" : sl.status === "throttled" ? "#f59e0b" : "#ef4444";
        const width = clamp(2.5 + Math.log10(Math.max(100, sl.delivered_30d || 15000)), 3, 7);
        parts.push(`
          <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${col}" stroke-width="${width}" class="supply-line-anim" pointer-events="none"/>
          <text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 6}" fill="#6ee7b7" font-size="9.5" text-anchor="middle" font-weight="bold" pointer-events="none">
            🚚 粮道 ${((sl.delivered_30d || 15000) / 1000).toFixed(0)}k斛
          </text>
        `);
      }
    }

    // Z3: 敌军 30/60/90 日同心威胁圈 (S05-R08 / S07-R07)
    if (GAME.layers.threat) {
      const oppFaction = st.meta.side === "han" ? "xiongnu" : "han";
      for (const nid of nodeIds) {
        const n = st.nodes[nid];
        const hasOppArmy = (n.armies && n.armies.some((a) => a.faction === oppFaction && a.soldiers >= 1500)) || nid === "chanyu_ting" || nid === "cheshi_qian";
        if (hasOppArmy && n.controller === oppFaction) {
          const c = coords[nid];
          parts.push(`
            <circle cx="${c.x}" cy="${c.y}" r="48" fill="rgba(239,68,68,0.12)" stroke="#ef4444" stroke-width="1.2" pointer-events="none"/>
            <circle cx="${c.x}" cy="${c.y}" r="85" fill="none" stroke="#f59e0b" stroke-width="1" stroke-dasharray="5,4" pointer-events="none"/>
            <circle cx="${c.x}" cy="${c.y}" r="120" fill="none" stroke="#fde047" stroke-width="0.8" stroke-dasharray="2,4" pointer-events="none"/>
          `);
        }
      }
    }

    // 节点圆盘与名称、驻军、烽燧、屯田角标
    for (const nid of nodeIds) {
      const n = st.nodes[nid];
      const c = coords[nid];
      const isSel = nid === GAME.selectedNodeId;
      const rel = n.relation;

      let fill = "#64748b";
      let stroke = "#cbd5e1";
      if (n.controller === "han" && !rel) {
        fill = "#dc2626";
        stroke = "#fca5a5";
      } else if (n.controller === "xiongnu" && !rel) {
        fill = "#0284c7";
        stroke = "#7dd3fc";
      } else if (rel) {
        if (rel.overlord === "han") {
          fill = "#f59e0b";
          stroke = "#fef08a";
        } else if (rel.overlord === "xiongnu") {
          fill = "#0ea5e9";
          stroke = "#bae6fd";
        } else if (rel.han_enfeoffed) {
          fill = "#fbbf24";
          stroke = "#fef3c7";
        }
      }

      const rSize = isSel ? 12.5 : n.type === "city" ? 9 : 7;
      parts.push(`
        <g class="map-node-g" data-nid="${nid}" style="cursor:pointer;">
          ${isSel ? `<circle cx="${c.x}" cy="${c.y}" r="19" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-dasharray="4,2"/>` : ""}
          <circle cx="${c.x}" cy="${c.y}" r="${rSize}" fill="${fill}" stroke="${stroke}" stroke-width="${isSel ? 2.5 : 1.5}"/>
          <text x="${c.x}" y="${c.y + rSize + 11}" fill="${isSel ? "#fef08a" : "#e2e8f0"}" font-size="${isSel ? 11.5 : 10}" font-weight="${isSel ? "800" : "600"}" text-anchor="middle">${n.name}</text>
          ${n.has_beacon && GAME.layers.fog ? `<text x="${c.x - 13}" y="${c.y - 8}" font-size="10">🔥</text>` : ""}
          ${n.tuntian_lv > 0 ? `<text x="${c.x + 11}" y="${c.y - 8}" font-size="10">🌾</text>` : ""}
          ${rel && rel.crimes > 0 ? `<text x="${c.x + 12}" y="${c.y + 4}" font-size="10" title="有合法讨伐罪状">⚖️</text>` : ""}
        </g>
      `);

      // Z6: 驻军算筹标签
      if (GAME.layers.tokens && n.armies && n.armies.length > 0) {
        const totalTroops = n.armies.reduce((s, a) => s + (a.soldiers || 0), 0);
        if (totalTroops > 0) {
          const isHanArmy = n.armies[0].faction === "han";
          const tagBg = isHanArmy ? "#991b1b" : "#075985";
          parts.push(`
            <g pointer-events="none">
              <rect x="${c.x - 24}" y="${c.y - rSize - 17}" width="48" height="13" rx="3" fill="${tagBg}" stroke="#fbbf24" stroke-width="0.8"/>
              <text x="${c.x}" y="${c.y - rSize - 7.5}" fill="#fef3c7" font-size="8.8" font-weight="bold" text-anchor="middle">
                ${isHanArmy ? "汉" : "匈"} ${(totalTroops / 1000).toFixed(1)}k
              </text>
            </g>
          `);
        }
      }
    }

    // Z6: 行军中大军算筹与在途使团/驿骑
    if (GAME.layers.tokens) {
      for (const ma of st.moving_armies || []) {
        const a = coords[ma.from];
        const b = coords[ma.to];
        if (a && b) {
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          parts.push(`
            <g pointer-events="none">
              <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#ef4444" stroke-width="2.5" stroke-dasharray="6,3"/>
              <rect x="${mx - 34}" y="${my - 10}" width="68" height="16" rx="4" fill="#b91c1c" stroke="#fef08a" stroke-width="1.2"/>
              <text x="${mx}" y="${my + 1}" fill="#fff" font-size="9.5" font-weight="bold" text-anchor="middle">⚔️ ${(ma.soldiers / 1000).toFixed(1)}k 进军</text>
            </g>
          `);
        }
      }
    }

    svg.innerHTML = parts.join("");

    svg.querySelectorAll(".map-node-g").forEach((g) => {
      g.addEventListener("click", (e) => {
        e.stopPropagation();
        const nid = g.getAttribute("data-nid");
        GAME.selectedNodeId = nid;
        GAME.planDraft.target = nid;
        renderStrategicMap();
        renderFoodCurveDrawer();
        renderActiveDockPanel();
      });
    });
  }

  function selectNodeAndPan(nid, panelName) {
    GAME.selectedNodeId = nid;
    GAME.planDraft.target = nid;
    if (panelName) GAME.activePanel = panelName;
    document.querySelectorAll(".dock-tab").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-panel") === GAME.activePanel);
    });
    renderStrategicMap();
    renderFoodCurveDrawer();
    renderActiveDockPanel();
  }

  // ==================== 5. 底部 0–18旬粮食折线与「就食城仓」修正抽屉 (S07-R08) ====================
  function renderFoodCurveDrawer() {
    const st = GAME.state;
    const targetNode = st.nodes[GAME.selectedNodeId] || st.nodes.lou_lan;
    const originNode = st.nodes[GAME.planDraft.origin] || st.nodes.dun_huang;

    // S07-R08: 彻底修复守军「携粮0、可支0.0月」误导，常驻显示「就食城仓」
    const garBadge = document.getElementById("curve-garrison-badge");
    if (originNode) {
      const garTroops = (originNode.armies || []).reduce((s, a) => s + (a.soldiers || 0), 0) || 5000;
      const monthsSupport = ((originNode.grain || 360000) / Math.max(100, garTroops * 3.0)).toFixed(1);
      garBadge.textContent = `🟢 就食城仓 · ${originNode.name}城储可支 ${monthsSupport} 月 (出征自动装车)`;
    }

    const soldiers = GAME.planDraft.soldiers || 5000;
    const laborers = GAME.planDraft.laborers || 2000;
    const standing = GAME.planDraft.standingOrder || "cautious";
    const carryCap = soldiers * 3.0 + laborers * 15.0;
    const eatPerTick = (soldiers * 1.0 + laborers * 0.8) * 0.9;

    const rel = targetNode && targetNode.relation;
    const forageTier = rel && rel.forage ? rel.forage.tier : targetNode && targetNode.controller === st.meta.side ? "WELCOME" : "HOSTILE";
    const forageGain = forageTier === "WELCOME" ? soldiers * 2.2 : forageTier === "MARKET" ? soldiers * 1.1 : 0;

    document.getElementById("curve-drawer-title").textContent =
      `📈 【S05/S07-R08 远征 0–18 旬余粮折线 & 不归点预演】${originNode ? originNode.name : "敦煌"} ➔ ${targetNode ? targetNode.name : "楼兰"} (${soldiers.toLocaleString()}兵 + ${laborers.toLocaleString()}民夫)`;

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
        g = Math.max(eatPerTick * 1.5, g); // 谨慎保军自动班师就食
      }
    }

    const maxG = Math.max(1, carryCap * 1.1);
    const polyPts = pts.map((p) => `${28 + p.t * 27},${105 - (p.g / maxG) * 82}`).join(" ");

    const svgEl = document.getElementById("plan-food-curve-svg");
    svgEl.innerHTML = `
      <line x1="28" y1="105" x2="515" y2="105" stroke="#475569" stroke-width="1"/>
      <text x="28" y="119" fill="#94a3b8" font-size="9.5">0旬(出发)</text>
      <text x="${28 + 5 * 27}" y="119" fill="#6ee7b7" font-size="9.5" text-anchor="middle">5旬(抵${targetNode ? targetNode.name : "目标"})</text>
      <text x="${28 + 9 * 27}" y="119" fill="#fde68a" font-size="9.5" text-anchor="middle">9旬(本季末)</text>
      <text x="505" y="119" fill="#94a3b8" font-size="9.5" text-anchor="end">18旬</text>
      ${
        pnrTick !== -1
          ? `<line x1="${28 + pnrTick * 27}" y1="14" x2="${28 + pnrTick * 27}" y2="105" stroke="#f59e0b" stroke-dasharray="4,3" stroke-width="1.5"/>
             <text x="${28 + pnrTick * 27}" y="12" fill="#fde68a" font-size="9.5" text-anchor="middle">⚠️不归点 T${pnrTick}旬</text>`
          : ""
      }
      ${
        starveTick !== -1 && standing !== "cautious"
          ? `<line x1="${28 + starveTick * 27}" y1="14" x2="${28 + starveTick * 27}" y2="105" stroke="#ef4444" stroke-width="2"/>
             <text x="${28 + starveTick * 27}" y="24" fill="#fca5a5" font-size="9.5" font-weight="bold" text-anchor="middle">🔴T${starveTick}旬断粮饿死</text>`
          : ""
      }
      <polyline fill="none" stroke="${starveTick !== -1 && standing !== "cautious" ? "#ef4444" : "#10b981"}" stroke-width="2.5" points="${polyPts}"/>
      ${pts.map((p) => `<circle cx="${28 + p.t * 27}" cy="${105 - (p.g / maxG) * 82}" r="2.6" fill="#6ee7b7"/>`).join("")}
    `;

    const metaEl = document.getElementById("plan-food-curve-meta");
    metaEl.innerHTML = `
      <div>📦 出发满载随军粮：<strong>${(carryCap / 1000).toFixed(1)}k 斛</strong> | 旬耗：<strong>${(eatPerTick / 1000).toFixed(1)}k 斛/旬</strong> | 目标供粮意愿：<strong>${rel && rel.forage ? rel.forage.label : "己方粮仓"}</strong></div>
      <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
        <label>常备指令预设:
          <select id="sel-drawer-standing">
            <option value="cautious" ${standing === "cautious" ? "selected" : ""}>🟢 谨慎保军 (粮尽前自动班师·0饿死)</option>
            <option value="standard" ${standing === "standard" ? "selected" : ""}>🟡 均衡推进 (标准围城)</option>
            <option value="aggressive" ${standing === "aggressive" ? "selected" : ""}>🔴 见利则进 (破釜沉舟强攻)</option>
          </select>
        </label>
        <button class="btn btn-han" id="btn-drawer-launch-campaign">🚩 向【${targetNode ? targetNode.name : "楼兰"}】下达远征军令</button>
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

  // ==================== 6. 右侧 6 大独立子面板停靠坞 (S07-R01) ====================
  function switchDockPanel(panelName) {
    GAME.activePanel = panelName;
    document.querySelectorAll(".dock-tab").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-panel") === panelName);
    });
    renderActiveDockPanel();
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
  }

  // ---- [F1] 城塞与驻军检视面板 ----
  function renderPanelInspector(container) {
    const st = GAME.state;
    const side = st.meta.side;
    const n = st.nodes[GAME.selectedNodeId] || st.nodes.lou_lan;
    const rel = n.relation;

    const armiesHtml =
      n.armies && n.armies.length > 0
        ? n.armies
            .map(
              (a) => `
          <div style="background:#121723; border:1px solid var(--border); border-radius:5px; padding:7px 9px; margin-top:5px;">
            <div style="display:flex; justify-content:space-between; font-weight:700; color:#fef08a;">
              <span>⚔️ ${a.name} (${a.commander_name || "校尉"})</span>
              <span class="badge ${a.faction === "han" ? "badge-red" : "badge-blue"}">${(a.soldiers || 0).toLocaleString()} 人</span>
            </div>
            <div style="font-size:11.5px; color:var(--text-muted); margin-top:3px;">
              战马 ${(a.horses || 0).toLocaleString()} 匹 | 统率 ${a.commander_cmd || 78} | 粮草状态：<span style="color:#6ee7b7;">🟢 就食城仓</span>
            </div>
          </div>
        `
            )
            .join("")
        : `<div style="color:var(--text-muted); font-size:12px;">当前城塞无常驻野战军（地方守备民兵 ${(n.militia || 0).toLocaleString()} 人）</div>`;

    container.innerHTML = `
      <div class="game-card bamboo">
        <div class="card-head">
          <span>🏯 【${n.name}】城塞与邦交检视</span>
          <span class="badge badge-gold">ID: ${n.id}</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:12px;">
          <div>当前控制/宗主：<strong style="color:#fef08a;">${rel ? (rel.overlord === "han" ? "🔴 大汉属国" : rel.overlord === "xiongnu" ? "🐺 匈奴属国" : "⚪ 独立城邦") : n.controller === "han" ? "🔴 大汉郡县" : "🐺 匈奴王庭"}</strong></div>
          <div>城池储粮：<strong>${((n.grain || 0) / 1000).toFixed(1)}k 斛</strong></div>
          <div>编户人口：<strong>${(n.pop || 0).toLocaleString()} 人</strong></div>
          <div>城防/烽燧：<strong>墙 Lv.${n.walls || 1} | ${n.has_beacon ? "🔥已筑烽燧" : "无烽燧"} | 🌾屯 Lv.${n.tuntian_lv || 0}</strong></div>
        </div>
        ${
          rel
            ? `
          <div style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--border); font-size:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span>亲汉影响力 I: <strong style="color:#f87171;">${rel.han_influence.toFixed(1)}</strong></span>
              <span>匈奴威吓 X: <strong style="color:#38bdf8;">${rel.xn_intimidation.toFixed(1)}</strong></span>
              <span>对匈怨恨: <strong>${rel.xn_resentment.toFixed(0)}</strong></span>
            </div>
            <div>大军过境供粮意愿 (S04-R08)：<span class="badge" style="background:rgba(16,185,129,0.18); color:${rel.forage ? rel.forage.color : "#fde68a"};">${rel.forage ? rel.forage.label : "平价开市"}</span></div>
            ${rel.crimes > 0 ? `<div style="margin-top:4px; color:#fca5a5; font-weight:700;">⚖️ 已持有合法讨伐罪状（遮杀汉使/劫掠商队），发兵讨伐免扣朝廷信任！</div>` : ""}
          </div>
        `
            : ""
        }
      </div>

      <div class="game-card">
        <div class="card-head"><span>⚡ 对【${n.name}】直接下达军政指令（点击即加入本季军令队列）</span></div>
        ${
          side === "han"
            ? `
          <div class="action-grid">
            <button class="btn btn-gold" id="act-elite-envoy">🚩 派张骞精使团 (300钱 · 影+18)</button>
            <button class="btn" id="act-hire-envoy">🏇 遣敦煌募使团 (140钱 · 影+10)</button>
            <button class="btn btn-emerald" id="act-enfeoff">👑 赐金印册封属国 (260钱 · +6G)</button>
            <button class="btn btn-blue" id="act-supply-to">🚚 拉通至此城自动粮道 (180钱)</button>
            <button class="btn" id="act-build-tuntian">🌾 在此开置塞外军屯 (220钱 · +4.5G)</button>
            <button class="btn" id="act-build-beacon">🔥 修筑汉代烽燧亭障 (150钱)</button>
            <button class="btn btn-han" id="act-attack-node">⚔️ 遣主力远征/讨伐【${n.name}】</button>
            <button class="btn" id="act-recruit-convicts">⛓️ 赦募七科谪充军 (+2,200兵 · 120钱)</button>
          </div>
        `
            : `
          <div class="action-grid">
            <button class="btn btn-blue" id="act-xn-intimidate">🏹 遣骑巡行威压【${n.name}】(威吓+16)</button>
            <button class="btn btn-gold" id="act-xn-vassal">🐺 强令【${n.name}】纳质臣服 (120钱)</button>
            <button class="btn btn-han" id="act-attack-node">⚔️ 发控弦铁骑攻掠【${n.name}】</button>
            <button class="btn" id="act-xn-pacify">🍖 遣骨都侯安抚日逐王部 (150钱)</button>
          </div>
        `
        }
      </div>

      <div class="game-card">
        <div class="card-head"><span>🛡️ 【${n.name}】驻军与守将编制</span></div>
        ${armiesHtml}
      </div>
    `;

    if (side === "han") {
      document.getElementById("act-elite-envoy").onclick = () =>
        queueCustomOrder({ type: "dispatch_elite_envoy", desc: `【精使出塞】遣持节精使团赴【${n.name}】颁赐缯帛 (影响力+18)`, cost_money: 300, target_node: n.id, raw: { state: n.id } });
      document.getElementById("act-hire-envoy").onclick = () =>
        queueCustomOrder({ type: "hire_mission", desc: `【募使通商】遣募使团携金赴【${n.name}】抚谕 (影响力+10.5)`, cost_money: 140, target_node: n.id, raw: { state: n.id } });
      document.getElementById("act-enfeoff").onclick = () =>
        queueCustomOrder({ type: "make_vassal", desc: `【册封属国】颁赐汉朝金印紫绶，纳【${n.name}】为内属国 (都护功业+6)`, cost_money: 260, target_node: n.id, raw: { state: n.id } });
      document.getElementById("act-supply-to").onclick = () =>
        queueCustomOrder({ type: "set_supply_line", desc: `【万里粮道】拉通「敦煌 → ${n.name}」自动补给线 (配民夫 2,500 人)`, cost_money: 180, target_node: n.id, raw: { from: "dun_huang", to: n.id, laborers: 2500, escort: true } });
      document.getElementById("act-build-tuntian").onclick = () =>
        queueCustomOrder({ type: "build_tuntian", desc: `【塞外军屯】在【${n.name}】开置戊己校尉屯田 (储粮+42k，功业+4.5)`, cost_money: 220, target_node: n.id, raw: { node: n.id } });
      document.getElementById("act-build-beacon").onclick = () =>
        queueCustomOrder({ type: "build_beacon", desc: `【烽燧亭障】在【${n.name}】修筑汉代烽燧，点亮L4精确视野`, cost_money: 150, target_node: n.id, raw: { node: n.id } });
      document.getElementById("act-recruit-convicts").onclick = () =>
        queueCustomOrder({ type: "recruit_convicts", desc: `【赦募罪兵】在【${n.name}】赦募七科谪与弛刑徒 +2,200 人`, cost_money: 120, target_node: n.id, raw: { node: n.id } });
    } else {
      document.getElementById("act-xn-intimidate").onclick = () =>
        queueCustomOrder({ type: "intimidate_city", desc: `【控弦威压】遣游骑巡行威压【${n.name}】(匈奴威吓+16)`, cost_money: 0, target_node: n.id, raw: { state: n.id } });
      document.getElementById("act-xn-vassal").onclick = () =>
        queueCustomOrder({ type: "demand_vassal", desc: `【索取质子】强令【${n.name}】遣质子入侍单于庭 (威服+7.5)`, cost_money: 120, target_node: n.id, raw: { state: n.id } });
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

  // ---- [F2] 长安朝廷与竹简文书 / 单于王庭与四部分赏 (S07-R04 / S07-R05) ----
  function renderPanelCourtOrTribes(container) {
    const st = GAME.state;
    const v1 = st.v1;
    if (st.meta.side === "han") {
      const ed = v1.court.active_edict;
      container.innerHTML = `
        <div class="game-card bamboo">
          <div class="card-head">
            <span>📜 【长安朝廷 · 皇帝信玺竹简诏书】 (S02 / S07-R04)</span>
            <span class="badge badge-gold">风向：武帝·拓边开疆</span>
          </div>
          ${
            ed
              ? `
            <div style="background:rgba(15,12,8,0.65); border:1px solid #fbbf24; border-radius:6px; padding:10px; margin-bottom:8px;">
              <div style="display:flex; justify-content:space-between; font-family:var(--font-serif); font-weight:800; color:#fef08a; font-size:14px;">
                <span>🔴 [皇帝信玺] 《${ed.title}》</span>
                <span class="badge ${ed.complied ? "badge-green" : "badge-red"}">${ed.complied ? "已奉诏领命" : `限第 ${ed.deadline_turn} 季`}</span>
              </div>
              <div style="font-size:12px; color:#e2e8f0; margin-top:5px;">
                靶标节点：<strong>${ st.nodes[ed.target] ? st.nodes[ed.target].name : ed.target }</strong> | 功成嘉奖：<strong>少府金 +${ed.reward_money} 钱、朝廷信任 +${ed.reward_trust}</strong>
              </div>
              <div class="action-grid" style="margin-top:8px;">
                <button class="btn btn-gold" id="btn-court-comply">📜 奉诏拜表行事 (信任+5)</button>
                <button class="btn btn-blue" id="btn-court-bargain">✍️ 上书陈情讨价 (展期2季+请款500钱)</button>
              </div>
            </div>
          `
              : `<div>当前无待办诏书</div>`
          }
          <div class="action-grid">
            <button class="btn" id="btn-court-money">💰 向大司农上疏请款 (+900钱 / 信任-5)</button>
            <button class="btn" id="btn-court-troops">🐎 请调太仆官马与北军 (+2000兵/+1800马)</button>
            <button class="btn btn-emerald" id="btn-court-duhu" style="grid-column:span 2;">🏛️ 拜表《奏请设立西域都护府疏》(都护功业 +16.0)</button>
          </div>
        </div>

        <!-- S07-R04: 持节矫诏·生死时速环预演器 -->
        <div class="game-card">
          <div class="card-head">
            <span>🔥 【持节矫诏 · 生死时速环预演器】 (将在外，君命有所不受)</span>
            <span class="badge badge-red">S02-R08 核心机制</span>
          </div>
          <p style="font-size:11.5px; color:var(--text-muted); margin-bottom:8px;">
            未奉诏书強行发诸国兵奇袭敌城！若我军破城露布（绿线）先于廷尉槛车（红线）抵达长安，则<strong>【矫诏立功、赎罪封侯】</strong>！
          </p>
          <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
            <label style="font-size:12px;">矫诏奇袭目标：
              <select id="sel-forged-target">
                <option value="cheshi_qian" ${GAME.forgedTarget === "cheshi_qian" ? "selected" : ""}>车师前王庭 (北道耳目·距长安58日)</option>
                <option value="lou_lan" ${GAME.forgedTarget === "lou_lan" ? "selected" : ""}>楼兰王城 (盐泽锁钥·距长安42日)</option>
                <option value="qiu_ci" ${GAME.forgedTarget === "qiu_ci" ? "selected" : ""}>龟兹大城 (北道大国·距长安64日)</option>
                <option value="da_yuan" ${GAME.forgedTarget === "da_yuan" ? "selected" : ""}>大宛贰师城 (天马之国·距长安78日)</option>
              </select>
            </label>
            <label style="font-size:12px; cursor:pointer;">
              <input type="checkbox" id="chk-forged-impeach" ${GAME.forgedSelfImpeach ? "checked" : ""} /> 同步拜表《自劾请罪疏》(信任仅扣-6)
            </label>
          </div>
          <div style="background:#0c1018; border:1px solid var(--border); border-radius:6px; padding:9px; font-size:12px;">
            <div style="color:#fca5a5; margin-bottom:4px;">🏇 <strong>【红线 · 廷尉槛车追责线】预计总耗时：126 日 (12.6旬)</strong>（监军密奏58日 + 廷议10日 + 槛车追抵58日）</div>
            <div style="color:#6ee7b7; margin-bottom:4px;">⚔️ <strong>【绿线 · 我军破敌露布线】预计总耗时：98 日 (9.8旬)</strong>（急行军16日 + 破城24日 + 露布飞驰长安58日）</div>
            <div style="color:#fde68a; font-weight:700;">✅ 时差裁定：绿线比红线快 28 日！破城捷报将抢在槛车前抵京，立获 +12 永久功业！</div>
          </div>
          <button class="btn btn-han" id="btn-do-forge-edict" style="width:100%; margin-top:8px;">🗡️ 拔剑持节 · 矫诏发诸国兵奇袭【${st.nodes[GAME.forgedTarget] ? st.nodes[GAME.forgedTarget].name : "车师前"}】</button>
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
      // 匈奴单于王庭与四部分赏面板 (S03 / S07-R05)
      const ratios = v1.tribes.reward_ratios || { zuoxian: 35, youxian: 30, rizhu: 20, lihu: 15 };
      const tr = v1.tribes.tribes;
      container.innerHTML = `
        <div class="game-card bamboo">
          <div class="card-head">
            <span>🐺 【单于王庭 · 四部分赏与不患寡而患不均】 (S03-R04)</span>
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
                <span>${label} — 当前忠诚: <strong style="color:${loy >= 55 ? "#6ee7b7" : "#fca5a5"}">${loy.toFixed(0)}</strong></span>
                <strong id="lbl-share-${k}">${ratios[k]}%</strong>
              </div>
              <input type="range" min="0" max="70" value="${ratios[k]}" data-tribe-slider="${k}"/>
            </div>
          `
            )
            .join("")}
          <div class="action-grid">
            <button class="btn" id="btn-xn-equalize">⚖️ 按期望份额一键配平</button>
            <button class="btn btn-gold" id="btn-xn-distribute">🍖 颁行本季四部分赏 (200钱)</button>
          </div>
        </div>

        <div class="game-card">
          <div class="card-head"><span>🏹 【草原盛会 · 王庭战术卡 · 焉耆僮仆都尉】 (S03-R05/R07)</span></div>
          <div class="action-grid">
            <button class="btn btn-blue" id="btn-xn-assembly">🐺 召开龙城/蹛林大会盟誓 (+6威望)</button>
            <button class="btn btn-gold" id="btn-xn-pacify-rizhu">🕊️ 专使赐金安抚日逐王 (忠+15)</button>
            <button class="btn" id="btn-xn-card-retreat">🃏 战术卡：诈败诱敌 (伏击+30%)</button>
            <button class="btn" id="btn-xn-card-beacon">🃏 战术卡：拔除亭障 (盲汉视野)</button>
            <button class="btn" id="btn-xn-tax-normal">💰 僮仆都尉：常赋岁币 (+320钱)</button>
            <button class="btn btn-han" id="btn-xn-tax-heavy">🔥 僮仆都尉：重敛竭泽 (+550钱)</button>
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

  // ---- [F3] 西域十八国总览表与都护府功业 G 拆解面板 (S07-R06) ----
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

    container.innerHTML = `
      <div class="game-card bamboo">
        <div class="card-head">
          <span>🏆 【西域都护府功业 G = ${v1.victory.han_merit.toFixed(1)} / 100】九维分项拆解 (S01-R01)</span>
          <span class="badge badge-green">内属 ${st.scores.han_vassals} 国</span>
        </div>
        <div style="font-size:11.5px; display:grid; grid-template-columns:repeat(3, 1fr); gap:4px; color:#e2e8f0;">
          <div>属国(+6/国): <strong>+${bd.vassal || st.scores.han_vassals * 6}</strong></div>
          <div>册封(+2/国): <strong>+${bd.enfeoff || 0}</strong></div>
          <div>乌垒/车师枢纽: <strong>+${bd.hub || 0}</strong></div>
          <div>塞外屯田: <strong>+${bd.tuntian || 0}</strong></div>
          <div>罢僮仆都尉: <strong>+${v1.tribes.tongpu_active ? 0 : 10}</strong></div>
          <div>历史大勋: <strong>+${v1.victory.han_perm_merit || 0}</strong></div>
        </div>
        ${
          side === "han"
            ? `
          <div style="margin-top:8px; display:flex; gap:6px;">
            <button class="btn btn-gold" id="btn-diplo-welcome-rizhu" style="flex:1;">🏳️ 迎降匈奴日逐王先贤掸 (+25功业 &amp; 永久罢僮仆都尉)</button>
            <button class="btn" id="btn-diplo-raid-tongpu">🐎 邀击北道僮仆税队 (+320钱)</button>
          </div>
        `
            : ""
        }
      </div>

      <div class="game-card" style="padding:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <strong style="font-size:12.5px; color:#fef08a;">🕊️ 西域城邦与葱岭大国总览表 (点击表头排序 · 点击行定位)</strong>
          <div style="display:flex; gap:4px;">
            <button class="btn" id="sort-by-gap" style="padding:2px 6px; font-size:11px;">按晋升差值▲</button>
            <button class="btn" id="sort-by-han" style="padding:2px 6px; font-size:11px;">按汉影▼</button>
            <button class="btn" id="sort-by-xn" style="padding:2px 6px; font-size:11px;">按匈威▼</button>
          </div>
        </div>
        <div style="max-height:380px; overflow-y:auto;">
          <table class="diplo-table">
            <thead>
              <tr>
                <th>国名</th>
                <th>宗主</th>
                <th>汉影I</th>
                <th>匈威X</th>
                <th>供粮意愿</th>
                <th>快捷军政令</th>
              </tr>
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
                  <tr data-row-nid="${n.id}">
                    <td><strong>${n.name}</strong> ${r.crimes > 0 ? "⚖️" : ""}</td>
                    <td>${ovBadge}</td>
                    <td style="color:#fca5a5; font-weight:700;">${r.han_influence.toFixed(0)}</td>
                    <td style="color:#7dd3fc;">${r.xn_intimidation.toFixed(0)}</td>
                    <td><span style="color:${r.forage ? r.forage.color : "#fde68a"}; font-size:11px;">${r.forage ? r.forage.label.slice(0, 4) : "开市"}</span></td>
                    <td>
                      ${
                        side === "han"
                          ? `<button class="btn" data-quick-envoy="${n.id}" style="padding:1px 5px; font-size:10.5px;">遣使</button>
                             <button class="btn btn-gold" data-quick-vassal="${n.id}" style="padding:1px 5px; font-size:10.5px;">册封</button>`
                          : `<button class="btn btn-blue" data-quick-intim="${n.id}" style="padding:1px 5px; font-size:10.5px;">威压</button>`
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

  // ---- [F4] 万里粮道与转运屯田面板 (S05 / S07-R07) ----
  function renderPanelLogistics(container) {
    const st = GAME.state;
    const v1 = st.v1;
    const sls = (v1 && v1.logistics.supply_lines) || [];

    container.innerHTML = `
      <div class="game-card bamboo">
        <div class="card-head">
          <span>🚚 【万里粮道 · 自动补给线管理司】 (S05-R01)</span>
          <span class="badge badge-green">${sls.length} 条运转中</span>
        </div>
        <p style="font-size:11.5px; color:var(--text-muted); margin-bottom:8px;">
          建立自动补给线后，每旬自动从敦煌/酒泉派车向塞外前线转运粟米，彻底解放手工逐段运粮操作：
        </p>
        ${sls
          .map(
            (s) => `
          <div style="background:#101520; border:1px solid var(--border); border-radius:6px; padding:8px; margin-bottom:6px; font-size:12px;">
            <div style="display:flex; justify-content:space-between; font-weight:700; color:#6ee7b7;">
              <span>🟢 ${s.name}</span>
              <span>月运量: ${((s.delivered_30d || 18000) / 1000).toFixed(1)}k 斛</span>
            </div>
            <div style="color:var(--text-muted); font-size:11px; margin-top:3px;">
              征发民夫: ${s.laborers} 人 | 护粮策略: ${s.escort ? "🛡️ 沿途军兵护送" : "遇敌即停"}
            </div>
          </div>
        `
          )
          .join("")}
        <div style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--border);">
          <div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">
            <label style="font-size:12px; flex:1;">新增/延伸粮道终点：
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
          <button class="btn btn-gold" id="btn-create-sl" style="width:100%;">🚚 下达粮道令：拉通「敦煌 → 选定终点」自动补给线 (180钱)</button>
        </div>
      </div>

      <div class="game-card">
        <div class="card-head"><span>🌾 【塞外军屯 (Tuntian) &amp; 汉塞烽燧网络】 (S05-R04/R05)</span></div>
        <div style="font-size:12px; margin-bottom:8px;">
          已开置军屯节点：<strong>${Object.keys(v1.logistics.tuntian_nodes).map((k) => `${st.nodes[k] ? st.nodes[k].name : k}(Lv.${v1.logistics.tuntian_nodes[k]})`).join("、") || "敦煌"}</strong>
        </div>
        <div class="action-grid">
          <button class="btn btn-emerald" id="btn-log-tuntian-loulan">🌾 开置【楼兰】军屯 (+42k粮/+4.5G)</button>
          <button class="btn btn-emerald" id="btn-log-tuntian-quli">🌾 开置【渠犁】军屯 (+42k粮/+4.5G)</button>
          <button class="btn btn-emerald" id="btn-log-tuntian-wulei">🌾 开置【乌垒】都护屯田 (+4.5G)</button>
          <button class="btn" id="btn-log-beacon-loulan">🔥 修筑【楼兰—渠犁】烽燧链</button>
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

  // ---- [F5] 诸军节度与作战计划编辑器 (S05 / S07-R08) ----
  function renderPanelMilitary(container) {
    const st = GAME.state;
    const side = st.meta.side;
    const targetNode = st.nodes[GAME.planDraft.target] || st.nodes.lou_lan;

    container.innerHTML = `
      <div class="game-card bamboo">
        <div class="card-head">
          <span>⚔️ 【诸军节度 · 远征作战计划与常备指令编辑器】 (S07-R08)</span>
          <span class="badge badge-gold">联动底部余粮折线</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:12px; margin-bottom:8px;">
          <label>出发帅帐/军镇：
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
          <label>进军/讨伐目标城邦 (亦可直接点选左图)：
            <select id="mil-sel-target" style="width:100%; margin-top:3px;">
              ${Object.values(st.nodes)
                .map((n) => `<option value="${n.id}" ${n.id === GAME.planDraft.target ? "selected" : ""}>${n.name}</option>`)
                .join("")}
            </select>
          </label>
          <label>出征战兵人数 (<strong id="lbl-mil-soldiers">${GAME.planDraft.soldiers}</strong>人)：
            <input type="range" id="rng-mil-soldiers" min="1500" max="12000" step="500" value="${GAME.planDraft.soldiers}" style="margin-top:5px;"/>
          </label>
          <label>随军民夫配额 (<strong id="lbl-mil-lab">${GAME.planDraft.laborers}</strong>人)：
            <input type="range" id="rng-mil-lab" min="500" max="6000" step="500" value="${GAME.planDraft.laborers}" style="margin-top:5px;"/>
          </label>
        </div>
        <div style="margin-bottom:8px;">
          <label style="font-size:12px;">🧭 常备指令预设 (Standing Orders)：
            <select id="mil-sel-standing" style="width:100%; margin-top:3px;">
              <option value="cautious" ${GAME.planDraft.standingOrder === "cautious" ? "selected" : ""}>🟢 谨慎保军 (cautious)：随军余粮触及返程安全线×1.2时立即班师，保障0饿死</option>
              <option value="standard" ${GAME.planDraft.standingOrder === "standard" ? "selected" : ""}>🟡 均衡推进 (standard)：常规行军围城</option>
              <option value="aggressive" ${GAME.planDraft.standingOrder === "aggressive" ? "selected" : ""}>🔴 见利则进 (aggressive)：破釜沉舟强攻到底（若断粮将产生饿死伤亡）</option>
            </select>
          </label>
        </div>
        <button class="btn btn-han" id="btn-mil-commit-plan" style="width:100%; padding:8px;">🚩 传檄发令：将【远征 ${targetNode ? targetNode.name : "目标"}】加入本季军令队列</button>
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

  // ---- [F6] 太史竹帛战报流与断粮饿死单列面板 (S07-R09) ----
  function renderPanelChronicle(container) {
    const st = GAME.state;
    const logs = [...(st.turn_logs || [])].reverse();
    const reports = st.battle_reports || [];

    container.innerHTML = `
      <div class="game-card bamboo">
        <div class="card-head">
          <span>⚔️ 【交战伤亡与断粮饿死单列详报】 (S07-R09 点击查看三回合明细)</span>
          <span class="badge badge-red">累计饿死: ${st.scores.starve_losses || 0} 人</span>
        </div>
        ${
          reports.length === 0
            ? `<div style="font-size:12px; color:var(--text-muted);">尚无野战/攻城交战记录。在 [F1] 或 [F5] 下达远征军令并推进一季后，此处将生成可点击的史书战报卡。</div>`
            : reports
                .slice(0, 5)
                .map(
                  (br) => `
              <div style="background:#101520; border:1px solid var(--border); border-left:3px solid #ef4444; border-radius:5px; padding:7px 9px; margin-bottom:6px; font-size:12px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <strong style="color:#fef08a;">【第${br.turn}季 · ${br.node_name}之战】</strong> ${br.commander} (${br.victory ? "大捷" : "激战"})
                  <div style="font-size:11px; color:var(--text-muted);">斩首 ${br.defender_loss} | 战死 ${br.attacker_combat_loss} | <span style="color:#fca5a5;">断粮饿死 ${br.attacker_starve_loss} 人</span></div>
                </div>
                <button class="btn btn-gold" data-open-battle="${br.id}" style="padding:3px 8px; font-size:11px;">详报</button>
              </div>
            `
                )
                .join("")
        }
      </div>

      <div class="game-card">
        <div class="card-head"><span>📖 【太史竹帛 · 历季编年战报流】 (点击事件可定位城邦)</span></div>
        <div style="max-height:320px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
          ${
            logs.length === 0
              ? `<div style="color:var(--text-muted); font-size:12px;">当前处于第 1 季初，请拟定军令后点击右上角【▶ 结束本季】开始推演。</div>`
              : logs
                  .map(
                    (lg) => `
                <div style="background:#0f141e; border:1px solid var(--border); border-radius:6px; padding:8px 10px; font-size:12px;">
                  <div style="font-weight:700; color:#fde68a; margin-bottom:4px;">📅 第 ${lg.turn} 季 (${lg.date})</div>
                  ${(lg.events || [])
                    .map(
                      (ev) => `
                    <div style="padding:3px 0; border-bottom:1px dashed rgba(255,255,255,0.06); cursor:pointer;" data-ev-node="${ev.node || ""}">
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
    if (GAME.queuedOrders.some((o) => o.desc === orderObj.desc)) return;
    GAME.queuedOrders.push({
      id: "ord_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      ...orderObj,
    });
    renderTopHUD();
    renderBottomOrderQueue();
  }

  function renderBottomOrderQueue() {
    const bar = document.getElementById("dock-order-bar");
    if (GAME.queuedOrders.length === 0) {
      bar.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--text-muted);">
          <span>📋 本季军令队列为空（可在上方 [F1–F5] 下令，或点右侧幕僚代拟）</span>
          <button class="btn btn-gold" id="btn-queue-advisor" style="padding:3px 9px; font-size:11px;">⭐ 幕僚一键拟令</button>
        </div>
      `;
      document.getElementById("btn-queue-advisor").onclick = fillAdvisorOrders;
      return;
    }

    bar.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; font-size:12px;">
        <strong style="color:#fde68a;">📋 本季待发军令 (${GAME.queuedOrders.length} 道)：</strong>
        <button class="btn" id="btn-clear-queue" style="padding:2px 7px; font-size:11px;">清空重拟</button>
      </div>
      <div style="max-height:92px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;">
        ${GAME.queuedOrders
          .map(
            (o, i) => `
          <div style="display:flex; justify-content:space-between; align-items:center; background:#161d2b; padding:4px 8px; border-radius:4px; font-size:11.5px;">
            <span>${i + 1}. ${o.desc}</span>
            <button class="btn" data-del-ord="${o.id}" style="padding:1px 5px; font-size:10px;">撤回</button>
          </div>
        `
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

  // ==================== 8. 90日 (9旬) WEGO 动画回放与回合推进 (S07-R01) ====================
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
      ? `🏆 【终局太史公评定】${st.ending.headline}`
      : `🎋 【${st.meta.date_text} · 第 ${st.meta.turn + 1} 季】太史公本季纪事与待办要务`;

    const chText = st.ending
      ? `${st.ending.biography}（汉评定：${st.ending.grade_han} | 匈奴评定：${st.ending.grade_xn}）`
      : GAME.useClassical
      ? st.chronicle.classical
      : st.chronicle.vernacular;
    document.getElementById("sum-modal-chronicle").textContent = chText;

    const todosEl = document.getElementById("sum-modal-todos");
    todosEl.innerHTML = (st.chronicle.todos || [])
      .map(
        (t, idx) => `
      <div class="todo-card ${t.level === "urgent" ? "urgent" : ""}">
        <div>
          <div style="font-weight:700; color:#fef08a;">${idx + 1}. ${t.title}</div>
          <div style="font-size:12px; color:#cbd5e1; margin-top:2px;">${t.detail}</div>
        </div>
        <button class="btn btn-gold" data-todo-panel="${t.jump_tab || "court"}" data-todo-node="${t.jump_node || "lou_lan"}">立即前往 ▸</button>
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
    document.getElementById("battle-modal-title").textContent = `⚔️ 【第 ${br.turn} 季 · ${br.node_name}之战】兵种伤亡与粮道损耗详报`;
    document.getElementById("battle-modal-body").innerHTML = `
      <div class="chronicle-quote">${br.summary}</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:12.5px;">
        <div class="game-card">
          <div class="card-head"><span>🚩 攻方：${br.commander}</span></div>
          <div>参战总兵力：<strong>${br.attacker_troops.toLocaleString()} 人</strong></div>
          <div>交战阵亡人数：<strong>${br.attacker_combat_loss.toLocaleString()} 人</strong></div>
          <div style="color:#fca5a5; font-weight:700; margin-top:4px;">⚠️ 断粮饿死人数 (S07-R09单列)：${br.attacker_starve_loss.toLocaleString()} 人</div>
          <div>常备指令：<strong>${br.standing_order === "cautious" ? "🟢 谨慎保军 (保障0饿死)" : "🔴 强攻"}</strong></div>
        </div>
        <div class="game-card">
          <div class="card-head"><span>🏯 守方：${br.node_name}守军</span></div>
          <div>守城总兵力：<strong>${br.defender_troops.toLocaleString()} 人</strong></div>
          <div>被斩首/溃散：<strong>${br.defender_loss.toLocaleString()} 人</strong></div>
          <div style="color:#6ee7b7; margin-top:4px;">🐎 战利俘获良马：<strong>+${br.captured_horses} 匹</strong></div>
          <div>交战结局：<strong>${br.victory ? "🏆 攻克城塞·威震西域" : "⚔️ 激战相持"}</strong></div>
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
        document.body.className = GAME.state.meta.side === "han" ? "faction-han" : "faction-xiongnu";
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
      { key: "autosave", name: "🔄 自动存档槽 (Autosave)" },
      { key: "slot1", name: "📜 军机竹简存档槽 一" },
      { key: "slot2", name: "📜 军机竹简存档槽 二" },
    ];
    box.innerHTML = slots
      .map((s) => {
        let info = "空槽位";
        try {
          const raw = localStorage.getItem("xiyu_save_" + s.key);
          if (raw) {
            const p = JSON.parse(raw);
            info = `${p.side === "han" ? "大汉" : "匈奴"} · ${p.date_text} (第${p.turn + 1}季 · ${p.saved_at})`;
          }
        } catch (e) {}
        return `
        <div style="background:#101520; border:1px solid var(--border); border-radius:6px; padding:8px; font-size:12px;">
          <div style="font-weight:700; color:#fde68a; margin-bottom:4px;">${s.name}</div>
          <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px;">${info}</div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-gold" data-save-slot="${s.key}" style="flex:1;">存入</button>
            <button class="btn" data-load-slot="${s.key}" style="flex:1;">读取</button>
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
    // 右侧 6 个子面板切换
    document.querySelectorAll(".dock-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        switchDockPanel(tab.getAttribute("data-panel"));
      });
    });

    // 顶栏图层开关
    const layerMap = {
      "chk-layer-supply": "supply",
      "chk-layer-fog": "fog",
      "chk-layer-threat": "threat",
      "chk-layer-trade": "trade",
      "chk-layer-zone": "zone",
      "chk-layer-tokens": "tokens",
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

    // 底部余粮折线抽屉展开/收起
    document.getElementById("btn-toggle-curve-drawer").onclick = () => {
      document.getElementById("plan-curve-drawer").classList.toggle("collapsed");
    };

    // 地图缩放与拖拽
    document.getElementById("btn-zoom-in").onclick = () => {
      GAME.mapCam.w = Math.max(450, GAME.mapCam.w * 0.82);
      GAME.mapCam.h = Math.max(280, GAME.mapCam.h * 0.82);
      renderStrategicMap();
    };
    document.getElementById("btn-zoom-out").onclick = () => {
      GAME.mapCam.w = Math.min(1200, GAME.mapCam.w * 1.2);
      GAME.mapCam.h = Math.min(740, GAME.mapCam.h * 1.2);
      renderStrategicMap();
    };
    document.getElementById("btn-zoom-reset").onclick = () => {
      GAME.mapCam = { x: 0, y: 0, w: 1000, h: 620, dragging: false, startX: 0, startY: 0 };
      renderStrategicMap();
    };
    document.getElementById("btn-focus-capital").onclick = () => {
      const cap = GAME.state.meta.side === "han" ? "dun_huang" : "chanyu_ting";
      selectNodeAndPan(cap, "inspector");
    };

    const vp = document.getElementById("map-viewport");
    vp.addEventListener("mousedown", (e) => {
      if (e.target.closest(".tutorial-floating-card") || e.target.closest(".map-hud-controls")) return;
      GAME.mapCam.dragging = true;
      GAME.mapCam.startX = e.clientX;
      GAME.mapCam.startY = e.clientY;
    });
    window.addEventListener("mousemove", (e) => {
      if (!GAME.mapCam.dragging) return;
      const dx = (e.clientX - GAME.mapCam.startX) * (GAME.mapCam.w / 900);
      const dy = (e.clientY - GAME.mapCam.startY) * (GAME.mapCam.h / 560);
      GAME.mapCam.x = clamp(GAME.mapCam.x - dx, -250, 450);
      GAME.mapCam.y = clamp(GAME.mapCam.y - dy, -180, 320);
      GAME.mapCam.startX = e.clientX;
      GAME.mapCam.startY = e.clientY;
      renderStrategicMap();
    });
    window.addEventListener("mouseup", () => {
      GAME.mapCam.dragging = false;
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

    // 全局键盘快捷键 (S07-R01: F1–F6 切面板, Tab 开本季纪事, Space 推进下一季)
    window.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA")) return;
      const fMap = { F1: "inspector", F2: "court", F3: "diplomacy", F4: "logistics", F5: "military", F6: "chronicle" };
      if (fMap[e.key]) {
        e.preventDefault();
        switchDockPanel(fMap[e.key]);
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
    bindGameEvents();
    startNewCampaign({ side: "han", scenario: "mo_bei_zhi_hou", difficulty: "standard", opp_bot: "balanced", seed: 11001 });
  });
})();
