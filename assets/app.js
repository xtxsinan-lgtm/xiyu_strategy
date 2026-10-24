/**
 * 《西域·汉匈争霸》v1.0 商业化设计 · 交互式网页验证工作台主控制器
 */
(function () {
  const BUNDLE = window.XIYU_BUNDLE;
  const jsEngine = new window.JSSimEngine(BUNDLE);

  const APP = {
    engineMode: "js", // "js" (0ms instant) or "pyodide" (real Python design_sim)
    pyodide: null,
    pyReady: false,
    state: null,
    selectedNodeId: "lou_lan",
    selectedCmdIndices: new Set(),
    cmdCategory: "all",
    filterBySelectedNode: false,
    useClassicalChronicle: true,
    playtestRatings: [], // {turn, date, side, boredom, confusion, note, cmds}
    matrixRulesetView: "v1",
    activeDocId: "S01",
  };

  // ==================== 1. 引擎调度层 (JS + Pyodide 双擎) ====================
  async function initPyodideInBackground() {
    const dot = document.getElementById("engine-dot");
    const label = document.getElementById("engine-label");
    if (!window.loadPyodide) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js";
      script.async = true;
      script.onload = () => bootPyodideRuntime(dot, label);
      script.onerror = () => {
        if (label) label.textContent = "原生引擎 · 离线";
      };
      document.head.appendChild(script);
    } else {
      bootPyodideRuntime(dot, label);
    }
  }

  async function bootPyodideRuntime(dot, label) {
    try {
      if (dot) dot.classList.add("loading");
      if (label) label.textContent = "Python 引擎加载中…";
      const py = await window.loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/",
      });
      // 将 data/*.json 与 design_sim/**/*.py 写入 Pyodide 内存文件系统 /repo
      py.FS.mkdirTree("/repo/data");
      py.FS.mkdirTree("/repo/design_sim/engine");
      py.FS.mkdirTree("/repo/design_sim/ai");
      py.FS.mkdirTree("/repo/design_sim/rulesets");

      for (const [relPath, content] of Object.entries(BUNDLE.vfs_files)) {
        py.FS.writeFile("/repo/" + relPath, content, { encoding: "utf8" });
      }

      await py.runPythonAsync(`
import os, sys
os.chdir("/repo")
if "/repo" not in sys.path:
    sys.path.insert(0, "/repo")
from design_sim import web_bridge as wb
      `);

      APP.pyodide = py;
      APP.pyReady = true;
      APP.engineMode = "pyodide";
      if (dot) dot.classList.remove("loading");
      if (label) label.textContent = "Python 引擎";

      // 若当前还在第 0 回合，同步一次 Python 引擎初始状态
      if (APP.state && APP.state.meta.turn === 0) {
        await syncInitFromCurrentControls();
      }
    } catch (err) {
      console.warn("Pyodide load fallback to JS engine:", err);
      if (dot) dot.classList.remove("loading");
      if (label) label.textContent = "原生引擎";
    }
  }

  async function engineInitGame(opts) {
    if (APP.engineMode === "pyodide" && APP.pyReady) {
      APP.pyodide.globals.set("_opt_side", opts.side);
      APP.pyodide.globals.set("_opt_ruleset", opts.ruleset);
      APP.pyodide.globals.set("_opt_opp", opts.opp_bot);
      APP.pyodide.globals.set("_opt_seed", parseInt(opts.seed, 10));
      APP.pyodide.globals.set("_opt_scen", opts.scenario);
      const rawJson = await APP.pyodide.runPythonAsync(
        `wb.init_game_json(side=_opt_side, ruleset=_opt_ruleset, opp_bot=_opt_opp, seed=_opt_seed, scenario=_opt_scen)`
      );
      return JSON.parse(rawJson);
    }
    return jsEngine.initGame(opts);
  }

  async function engineStepTurn(selectedIndices, useAdvisor) {
    if (APP.engineMode === "pyodide" && APP.pyReady) {
      APP.pyodide.globals.set("_sel_json", JSON.stringify(Array.from(selectedIndices)));
      APP.pyodide.globals.set("_use_adv", Boolean(useAdvisor));
      const rawJson = await APP.pyodide.runPythonAsync(
        `wb.step_turn_json(_sel_json, use_advisor=_use_adv)`
      );
      return JSON.parse(rawJson);
    }
    return jsEngine.stepTurn(Array.from(selectedIndices), useAdvisor);
  }

  async function engineUndoTurn() {
    if (APP.engineMode === "pyodide" && APP.pyReady) {
      const rawJson = await APP.pyodide.runPythonAsync(`wb.undo_turn_json()`);
      return JSON.parse(rawJson);
    }
    return jsEngine.undoTurn();
  }

  // ==================== 2. Tab 1: 纸面推演沙盘渲染 ====================
  function getSetupOptions() {
    return {
      side: document.getElementById("sel-side").value,
      scenario: document.getElementById("sel-scenario").value,
      ruleset: document.getElementById("sel-ruleset").value,
      opp_bot: document.getElementById("sel-opp-bot").value,
      seed: parseInt(document.getElementById("inp-seed").value || "11001", 10),
    };
  }

  async function syncInitFromCurrentControls() {
    const opts = getSetupOptions();
    APP.state = await engineInitGame(opts);
    APP.selectedCmdIndices.clear();
    // 默认自动勾选幕僚推荐指令，方便一键体验或微调
    for (const c of APP.state.commands) {
      if (c.recommended) APP.selectedCmdIndices.add(c.idx);
    }
    renderPlaytestView();
  }

  function renderPlaytestView() {
    const st = APP.state;
    if (!st) return;

    document.getElementById("btn-undo").disabled = !st.meta.can_undo;
    renderAsymmetricHUD(st);
    renderStrategicMap(st);
    renderNodeInspector(st, APP.selectedNodeId);
    renderChronicleAndTodos(st);
    renderCommandList(st);
    renderTurnLogsAndBriefing(st);
  }

  function renderAsymmetricHUD(st) {
    const container = document.getElementById("hud-banner");
    const side = st.meta.side;
    const sc = st.scores;
    const v1 = st.v1;
    const fmt = (n) => Number(n).toLocaleString();

    // 计算当前已勾选命令预计花费
    let plannedMoney = 0;
    for (const c of st.commands) {
      if (APP.selectedCmdIndices.has(c.idx)) {
        plannedMoney += c.cost_money || 0;
      }
    }

    if (!v1) {
      container.innerHTML = `
        <div class="hud-card span-2">
          <div class="hud-head"><span>${st.meta.date_text} · 第 ${st.meta.turn + 1} 季</span><span class="badge">旧规则</span></div>
          <div class="hud-val">${sc.han} <small>汉</small> : ${sc.xiongnu} <small>匈奴</small></div>
          <div class="hud-sub"><span>${st.meta.winner || "胜负未分"}</span><span>汉属国 ${sc.han_vassals}/12</span><span>河西在汉 ${sc.hexi_han}/4</span></div>
        </div>
        <div class="hud-card span-2">
          <div class="hud-head"><span>国库</span><span>本季拟支出 ${fmt(plannedMoney)}</span></div>
          <div class="hud-val"><span class="unit">汉</span>${fmt(sc.han_money)} <span class="unit" style="margin-left:14px">匈奴</span>${fmt(sc.xn_money)}</div>
          <div class="hud-sub"><span>断粮饿死累计 ${fmt(sc.starve_losses)} 人</span></div>
        </div>
      `;
      return;
    }

    const vic = v1.victory;
    const court = v1.court;
    const tribes = v1.tribes;
    const logi = v1.logistics;

    if (side === "han") {
      const trustTier =
        court.trust >= 80
          ? "便宜行事"
          : court.trust >= 50
          ? "正常授节"
          : court.trust >= 25
          ? "监军掣肘"
          : "濒临征还";
      const windMap = {
        expansion: "武帝拓边",
        regret: "轮台悔诏",
        xuan_revival: "宣帝中兴",
      };
      const ed = court.active_edict;
      const rz = tribes.tribes.rizhu;
      container.innerHTML = `
        <div class="hud-card">
          <div class="hud-head"><span>都护功业 G</span><span class="eyebrow">立府 ${vic.han_hold_months}/12 月</span></div>
          <div class="hud-val">${vic.han_merit.toFixed(1)}<small>/ 100 · 峰值 ${vic.han_merit_peak.toFixed(1)}</small></div>
          <div class="progress-track"><div class="progress-fill han" style="width:${Math.min(100, vic.han_merit)}%"></div></div>
          <div class="hud-sub">
            <span>属国 ${sc.han_vassals}</span>
            <span>军屯 ${Object.keys(logi.tuntian_nodes).length}</span>
            <span>永久勋 +${vic.han_perm_merit.toFixed(0)}</span>
            <span>僮仆都尉${tribes.tongpu_active ? "在位" : "已罢"}</span>
          </div>
        </div>

        <div class="hud-card">
          <div class="hud-head"><span>朝廷信任</span><span class="eyebrow">${windMap[court.wind] || court.wind}</span></div>
          <div class="hud-val">${court.trust.toFixed(1)}<small>${trustTier}</small></div>
          <div class="progress-track"><div class="progress-fill accent" style="width:${Math.min(100, court.trust)}%"></div></div>
          <div class="hud-sub">
            ${
              ed
                ? `<span class="hl">${ed.title}</span><span>限第 ${ed.deadline_turn} 季 · ${ed.complied ? "已奉诏" : "待奉诏"}</span>`
                : `<span>暂无待办诏令</span>`
            }
          </div>
        </div>

        <div class="hud-card">
          <div class="hud-head"><span>库钱</span><span class="eyebrow">${st.meta.date_text} · ${st.meta.turn + 1}/${st.meta.max_turns}</span></div>
          <div class="hud-val">${fmt(sc.han_money)}<small>${plannedMoney ? `本季拟支 ${fmt(plannedMoney)}` : "本季未支"}</small></div>
          <div class="hud-sub" style="margin-top:14px">
            <span>马池 ${fmt(sc.han_horse_pool)}</span>
            <span>烽燧 ${logi.beacons.length}</span>
            <span>阵亡 ${fmt(sc.han_casualties - sc.starve_losses)}</span>
            <span class="${sc.starve_losses > 0 ? "warn" : ""}">饿死 ${fmt(sc.starve_losses)}</span>
          </div>
        </div>

        <div class="hud-card">
          <div class="hud-head"><span>匈奴动向</span><span class="eyebrow">威服 ${vic.xn_weifu.toFixed(1)}</span></div>
          <div class="hud-val">${tribes.chanyu_prestige.toFixed(1)}<small>单于威望 · 属国 ${sc.xn_vassals}</small></div>
          <div class="progress-track"><div class="progress-fill xn" style="width:${Math.min(100, vic.xn_weifu)}%"></div></div>
          <div class="hud-sub">
            <span class="${rz.surrender_window > 0 ? "hl" : ""}">日逐忠 ${rz.loyalty.toFixed(0)}${rz.surrender_window > 0 ? " · 有意请降" : ""}</span>
            <span>左贤 ${tribes.tribes.zuoxian.loyalty.toFixed(0)}</span>
            <span>右贤 ${tribes.tribes.youxian.loyalty.toFixed(0)}</span>
          </div>
        </div>
      `;
    } else {
      // 匈奴玩家非对称 HUD
      const tMap = tribes.tribes;
      container.innerHTML = `
        <div class="hud-card">
          <div class="hud-head"><span>威服 W</span><span class="eyebrow">维持 ${vic.xn_weifu_hold_months}/6 月</span></div>
          <div class="hud-val">${vic.xn_weifu.toFixed(1)}<small>/ 100 · 河西在匈 ${4 - sc.hexi_han}/4</small></div>
          <div class="progress-track"><div class="progress-fill xn" style="width:${Math.min(100, vic.xn_weifu)}%"></div></div>
          <div class="hud-sub">
            <span>西域属国 ${sc.xn_vassals}</span>
            <span>僮仆都尉${tribes.tongpu_active ? "征税中" : "已失"}</span>
            <span>汉功业 ${vic.han_merit.toFixed(1)}</span>
          </div>
        </div>

        <div class="hud-card">
          <div class="hud-head"><span>单于威望</span><span class="eyebrow">${st.meta.date_text} · ${st.meta.turn + 1}/${st.meta.max_turns}</span></div>
          <div class="hud-val">${tribes.chanyu_prestige.toFixed(1)}<small>库钱与赏池 ${fmt(sc.xn_money + tribes.reward_pool)}</small></div>
          <div class="progress-track"><div class="progress-fill accent" style="width:${Math.min(100, tribes.chanyu_prestige)}%"></div></div>
          <div class="hud-sub">
            <span>战术卡 ${tribes.active_tactical_card || "未发动"}</span>
            <span>本季拟支 ${fmt(plannedMoney)}</span>
          </div>
        </div>

        <div class="hud-card span-2">
          <div class="hud-head">
            <span>四部诸王</span>
            <span class="eyebrow ${tMap.rizhu.surrender_window > 0 ? "c-bad" : ""}">${tMap.rizhu.surrender_window > 0 ? "日逐王正密通汉使" : "忠诚低于 38 将擅自行动或请降"}</span>
          </div>
          <div class="tribe-grid">
            ${Object.values(tMap)
              .map(
                (tv) => `
              <div class="tribe ${tv.loyalty < 42 ? "at-risk" : ""}">
                <div class="tribe-name">${tv.name} · ${tv.leader}</div>
                <div class="tribe-v">${tv.loyalty.toFixed(0)}</div>
                <div class="tribe-sub">怨望 ${tv.grievance.toFixed(0)} · ${tv.status === "defected_han" ? "已降汉" : "在列"}</div>
              </div>`
              )
              .join("")}
          </div>
        </div>
      `;
    }
  }

  // ==================== 3. 节点战略地图 SVG 渲染（1:1 严格对齐 Godot `ui/map_view.gd`） ====================
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

  const HYDRO_RIVERS = [
    { name: "塔里木河", d: "M 225,380 C 310,332 420,305 535,310 C 600,315 645,355 676,374", width: 2.3 },
    { name: "和田河", d: "M 355,485 C 365,420 375,365 390,322", width: 1.5 },
    { name: "叶尔羌河", d: "M 248,438 C 275,392 300,355 322,332", width: 1.5 },
    { name: "伊犁水", d: "M 425,165 C 345,155 275,148 215,138", width: 1.9 },
    { name: "疏勒河", d: "M 835,442 C 785,432 745,420 688,382", width: 1.6 },
    { name: "弱水", d: "M 895,435 C 885,350 875,270 865,205", width: 1.6 },
    { name: "药杀水", d: "M 192,272 C 138,242 92,222 52,208", width: 2.0 },
    { name: "妫水", d: "M 185,478 C 125,442 78,415 35,395", width: 2.1 },
  ];

  const HYDRO_LAKES = [
    { name: "盐泽 (罗布泊)", cx: 678, cy: 376, rx: 24, ry: 12, rot: -12 },
    { name: "居延泽", cx: 862, cy: 192, rx: 18, ry: 9, rot: 8 },
    { name: "敦薨泽 (博斯腾湖)", cx: 590, cy: 256, rx: 15, ry: 8, rot: -8 },
    { name: "热海 (伊塞克湖)", cx: 292, cy: 198, rx: 22, ry: 9, rot: -5 },
    { name: "夷播海 (巴尔喀什)", cx: 195, cy: 128, rx: 32, ry: 11, rot: -15 },
  ];

  function buildTerritoryPolygon(cx, cy, allPts, baseRadius) {
    const numAngles = 12;
    const pts = [];
    for (let i = 0; i < numAngles; i++) {
      const ang = (Math.PI * 2 * i) / numAngles;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      let r = baseRadius;
      for (const op of allPts) {
        const vx = op[0] - cx;
        const vy = op[1] - cy;
        const d2 = vx * vx + vy * vy;
        if (d2 < 4) continue;
        const proj = vx * dx + vy * dy;
        if (proj > 0) {
          const halfDist = (d2 / (2 * proj)) * 0.86;
          if (halfDist < r) r = Math.max(16, halfDist);
        }
      }
      const wave = 1.0 + 0.06 * Math.sin(i * 3.0 + cx * 0.05);
      const rr = r * wave;
      pts.push(`${(cx + dx * rr).toFixed(1)},${(cy + dy * rr).toFixed(1)}`);
    }
    return pts.join(" ");
  }

  function renderStrategicMap(st) {
    const svg = document.getElementById("map-svg");
    const pos = BUNDLE.map_presentation.positions;
    const waypoints = BUNDLE.map_presentation.waypoints || {};
    const regions = BUNDLE.map_presentation.regions || [];
    const routes = BUNDLE.scenario_mvp.routes || [];
    const tradeRoutes = BUNDLE.scenario_mvp.trade_routes || [];
    const edTarget = st.v1 && st.v1.court.active_edict ? st.v1.court.active_edict.target : "";

    const routeByPair = {};
    const routeCurveD = [];
    routes.forEach((r, idx) => {
      const a = r.a || r.from;
      const b = r.b || r.to;
      routeByPair[`${a}|${b}`] = idx;
      routeByPair[`${b}|${a}`] = idx;
      const pts = buildGodotRoutePoints(r, pos, waypoints);
      routeCurveD.push(buildGodotBezierPath(pts));
    });

    let html = `
      <defs>
        <pattern id="wb-hachure-red" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(163, 58, 42, 0.34)" stroke-width="1.6"/>
        </pattern>
        <pattern id="wb-hachure-brown" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(93, 64, 55, 0.34)" stroke-width="1.6"/>
        </pattern>
      </defs>
      <!-- Godot 西域舆图底图与宣纸柔光遮罩 -->
      <rect x="0" y="0" width="1000" height="620" fill="#e9dcc0"/>
      <image href="assets/art/western-regions-atlas-v2.png" x="0" y="0" width="1000" height="620" preserveAspectRatio="none"/>
      <rect x="0" y="0" width="1000" height="620" fill="rgba(242, 227, 186, 0.34)"/>
    `;

    // 0A. 水系湖泽层（仿古水波纹与汉代水名）
    html += `<g pointer-events="none" opacity="0.88">`;
    for (const rv of HYDRO_RIVERS) {
      html += `<path d="${rv.d}" fill="none" stroke="rgba(235, 225, 198, 0.55)" stroke-width="${rv.width + 1.8}" stroke-linecap="round"/>`;
      html += `<path d="${rv.d}" fill="none" stroke="rgba(74, 118, 136, 0.62)" stroke-width="${rv.width}" stroke-linecap="round"/>`;
    }
    for (const lk of HYDRO_LAKES) {
      const tr = `rotate(${lk.rot} ${lk.cx} ${lk.cy})`;
      html += `<ellipse cx="${lk.cx}" cy="${lk.cy}" rx="${lk.rx}" ry="${lk.ry}" transform="${tr}" fill="rgba(92, 138, 154, 0.42)" stroke="rgba(54, 92, 108, 0.68)" stroke-width="1.1"/>`;
      html += `<ellipse cx="${lk.cx}" cy="${lk.cy}" rx="${(lk.rx * 0.72).toFixed(1)}" ry="${(lk.ry * 0.72).toFixed(1)}" transform="${tr}" fill="none" stroke="rgba(238, 232, 212, 0.52)" stroke-width="0.7" stroke-dasharray="4,2"/>`;
      html += `<text x="${lk.cx}" y="${lk.cy - lk.ry - 3}" text-anchor="middle" font-size="9" fill="rgba(48, 82, 96, 0.85)" font-style="italic">${lk.name}</text>`;
    }
    html += `</g>`;

    // 0B. 政区疆域多边形晕染与斜线阴影层
    const allNodePts = Object.keys(st.nodes)
      .map((nid) => pos[nid])
      .filter(Boolean);
    html += `<g pointer-events="none">`;
    for (const [nid, n] of Object.entries(st.nodes)) {
      const pt = pos[nid];
      if (!pt) continue;
      const meta = MVP_NODE_META[nid] || {};
      const nodeType = meta.type || n.type || "city";
      if (nodeType === "junction") continue;
      const baseR = nodeType === "source" || nodeType === "nomad" ? 50 : nodeType === "pass" ? 28 : 40;
      const polyPts = buildTerritoryPolygon(pt[0], pt[1], allNodePts, baseR);
      const col = getGodotNodeColor(nid, n);
      const isSel = nid === APP.selectedNodeId;
      const ctl = n.relation && n.relation.overlord ? n.relation.overlord : n.controller;
      html += `<polygon points="${polyPts}" fill="${col}" fill-opacity="${isSel ? "0.26" : "0.14"}" stroke="${col}" stroke-opacity="${isSel ? "0.68" : "0.34"}" stroke-width="${isSel ? "1.6" : "0.9"}" stroke-dasharray="${ctl === "independent" ? "3,2" : "none"}"/>`;
      if (nid === edTarget || (n.relation && n.relation.embargo_han)) {
        const pat = ctl === "xiongnu" ? "url(#wb-hachure-brown)" : "url(#wb-hachure-red)";
        html += `<polygon points="${polyPts}" fill="${pat}"/>`;
      }
    }
    html += `</g>`;

    // 地理大区底纹标注 (`layout["regions"]`)
    html += `<g pointer-events="none">`;
    for (const reg of regions) {
      html += `<text x="${reg[1][0]}" y="${reg[1][1]}" font-size="20" font-weight="700" letter-spacing="4" fill="rgba(77, 71, 56, 0.65)" stroke="rgba(245, 235, 204, 0.65)" stroke-width="3" paint-order="stroke">${reg[0]}</text>`;
    }
    html += `</g>`;

    // 1. 商路高亮 (`Trade.open_prefix`)
    for (const tr of tradeRoutes) {
      const pathNodes = tr.nodes || [];
      const openPrefix = [];
      for (const nid of pathNodes) {
        if (isTradeNodeOpen(st, nid)) openPrefix.push(nid);
        else break;
      }
      for (let i = 1; i < openPrefix.length; i++) {
        const rIdx = routeByPair[`${openPrefix[i - 1]}|${openPrefix[i]}`];
        if (rIdx !== undefined && routeCurveD[rIdx]) {
          html += `<path d="${routeCurveD[rIdx]}" fill="none" stroke="rgba(232, 179, 64, 0.85)" stroke-width="5.6" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>`;
        }
      }
    }

    // 2. 绘制全地形 Bezier 道路网
    const isWinter = st.meta && st.meta.season === "winter";
    routes.forEach((r, idx) => {
      const d = routeCurveD[idx];
      if (!d) return;
      let col = "#6b4f2a";
      let dashed = false;
      if (r.terrain === "steppe") {
        col = "#5f8f4a";
      } else if (r.terrain === "desert") {
        col = "#b8893c";
        dashed = true;
      } else if (r.terrain === "mountain") {
        col = "#7a7a7a";
        dashed = true;
      } else if (r.terrain === "hazard") {
        col = "#a33a2a";
        dashed = true;
      }
      if (r.closed_in_winter && isWinter) col = "#b5b0a6";
      if (r.raided_by) col = "#d02020";

      if (dashed) {
        html += `<path d="${d}" fill="none" stroke="${col}" stroke-width="1.6" stroke-dasharray="7.5, 4.5" stroke-linecap="round" pointer-events="none"/>`;
      } else {
        html += `<path d="${d}" fill="none" stroke="rgba(250, 240, 209, 0.82)" stroke-width="3.6" stroke-linecap="round" pointer-events="none"/>`;
        html += `<path d="${d}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linecap="round" pointer-events="none"/>`;
      }
    });

    // 3. 绘制全部节点（城邦／关隘／路口） + 图标 + 羊皮纸铭牌
    for (const [nid, n] of Object.entries(st.nodes)) {
      const pt = pos[nid];
      if (!pt) continue;
      const [x, y] = pt;
      const meta = MVP_NODE_META[nid] || {};
      const nodeType = meta.type || n.type || "city";
      let rad = 8.5;
      if (nodeType === "source") rad = 11.5;
      else if (nodeType === "pass") rad = 6.0;
      else if (nodeType === "junction") rad = 4.0;
      else if (nodeType === "nomad") rad = 9.5;

      const fillCol = getGodotNodeColor(nid, n);
      const isSelected = nid === APP.selectedNodeId;
      const isEdictTarget = nid === edTarget;
      const iconHref = nodeType === "nomad" ? "assets/icons/nomad.svg" : "assets/icons/city.svg";
      const label = n.name || meta.name || nid;
      const fs = nodeType === "junction" ? 10.5 : 12.5;
      const tw = Math.max(26, label.length * (fs + 0.4));
      const boxW = tw + 10;
      const boxH = fs + 6;
      const boxX = x - boxW * 0.5;
      const boxY = y + rad + 3;
      const labelBoxFill = isSelected ? "rgba(252, 246, 229, 0.96)" : "rgba(245, 232, 199, 0.88)";
      const labelBoxStroke = isSelected ? `stroke="#a33a2a" stroke-width="1.4"` : `stroke="rgba(120, 100, 62, 0.38)" stroke-width="0.8"`;

      html += `<g class="map-node" data-node="${nid}" style="cursor:pointer">`;
      if (isEdictTarget) {
        html += `<circle cx="${x}" cy="${y}" r="${rad + 7}" fill="none" stroke="#d02020" stroke-width="2.2" stroke-dasharray="4,2"/>`;
      }
      if (isSelected) {
        html += `<circle cx="${x}" cy="${y}" r="${rad + 4}" fill="none" stroke="#ffffff" stroke-width="2.8"/>`;
      }
      html += `<circle cx="${x}" cy="${y + 2}" r="${rad + 2}" fill="rgba(38, 28, 20, 0.25)"/>`;
      html += `<circle cx="${x}" cy="${y}" r="${rad + 1.5}" fill="#eed4a0"/>`;
      html += `<circle cx="${x}" cy="${y}" r="${rad}" fill="${fillCol}" stroke="#2a1d10" stroke-width="1.4"/>`;
      if (nodeType !== "pass" && nodeType !== "junction") {
        html += `<image href="${iconHref}" x="${x - 5.5}" y="${y - 5.5}" width="11" height="11" pointer-events="none"/>`;
      }
      html += `<rect x="${boxX.toFixed(1)}" y="${boxY.toFixed(1)}" width="${boxW.toFixed(1)}" height="${boxH}" rx="2.5" fill="${labelBoxFill}" ${labelBoxStroke}/>`;
      html += `<text x="${x}" y="${(boxY + fs + 1.2).toFixed(1)}" text-anchor="middle" fill="#251c13" font-size="${fs}" font-weight="${isSelected ? "700" : "600"}">${label}</text>`;
      html += `</g>`;
    }

    // 4. 绘制军队旌旗标牌 (`_draw_army`)
    for (const [nid, n] of Object.entries(st.nodes)) {
      const pt = pos[nid];
      if (!pt || !n.armies || n.armies.length === 0) continue;
      n.armies.forEach((a, k) => {
        const cnt = (a.soldiers || 0) + (a.is_convoy ? a.laborers || 0 : 0);
        if (cnt <= 0) return;
        const anchorX = pt[0] + 18 + (k % 3) * 38;
        const anchorY = pt[1] - Math.floor(k / 3) * 40;
        const posX = anchorX;
        const posY = anchorY - 22;
        const baseCol = a.faction === "han" ? GODOT_C_HAN : GODOT_C_XN;
        const boxCol = a.is_convoy ? (a.faction === "han" ? "#cd854c" : "#9f8853") : baseCol;
        const txt = cnt >= 10000 ? `${(cnt / 10000).toFixed(1)}万` : `${cnt}`;
        const iconPath = a.is_convoy ? "assets/icons/convoy.svg" : "assets/icons/standard.svg";
        html += `
          <g class="map-node" data-node="${nid}" style="cursor:pointer;">
            <line x1="${anchorX}" y1="${anchorY}" x2="${posX}" y2="${posY + 14}" stroke="#6b4f2a" stroke-width="1.2"/>
            <circle cx="${anchorX}" cy="${anchorY}" r="2.6" fill="${baseCol}"/>
            <rect x="${posX - 14}" y="${posY - 18}" width="28" height="34" rx="2.5" fill="${boxCol}" stroke="#fff3d0" stroke-width="1"/>
            <image href="${iconPath}" x="${posX - 11}" y="${posY - 16}" width="22" height="22" pointer-events="none"/>
            <text x="${posX}" y="${posY + 14}" fill="#ffffff" font-size="9.5" font-weight="700" text-anchor="middle">${txt}</text>
          </g>
        `;
      });
    }

    // 5. 左上角仿古题签与左下角比例尺
    html += `
      <g pointer-events="none">
        <rect x="14" y="14" width="300" height="54" rx="2" fill="rgba(246, 241, 229, 0.94)" stroke="#1e1c1a" stroke-width="1.5"/>
        <rect x="17" y="17" width="294" height="48" fill="none" stroke="rgba(163, 58, 42, 0.45)" stroke-width="0.8"/>
        <text x="28" y="36" fill="#1e1c1a" font-size="14.5" font-weight="700" letter-spacing="2">西域都护军政舆图 · 沙盘推演</text>
        <text x="28" y="54" fill="#6b5e4c" font-size="11">点击城邦检视 · 金色：丝路商道 · 色晕：宗主疆域 · 斜纹：诏令/封锁</text>
        <rect x="16" y="586" width="136" height="22" rx="2" fill="rgba(246, 241, 229, 0.9)" stroke="rgba(30, 28, 26, 0.35)" stroke-width="0.9"/>
        <rect x="24" y="592" width="18" height="4" fill="#1e1c1a"/>
        <rect x="42" y="592" width="18" height="4" fill="#f6f1e5" stroke="#1e1c1a" stroke-width="0.7"/>
        <rect x="60" y="592" width="18" height="4" fill="#1e1c1a"/>
        <text x="86" y="600" fill="#3a332a" font-size="9.5" font-weight="600">五百里 (210km)</text>
      </g>
    `;

    svg.innerHTML = html;
    svg.querySelectorAll(".map-node").forEach((el) => {
      el.addEventListener("click", () => {
        APP.selectedNodeId = el.getAttribute("data-node");
        renderStrategicMap(APP.state);
        renderNodeInspector(APP.state, APP.selectedNodeId);
        if (APP.filterBySelectedNode) renderCommandList(APP.state);
      });
    });
  }

  function renderNodeInspector(st, nid) {
    const box = document.getElementById("node-inspector-body");
    const n = st.nodes[nid];
    if (!n) {
      box.innerHTML = `<div class="empty">在地图上点一座城邦，这里会显示它的人口、存粮与外交关系。</div>`;
      return;
    }
    const rel = n.relation;
    const ctlName = n.type === "junction" ? "路口 · 无主，可换路，不可攻占" : n.controller === "han" ? "大汉" : n.controller === "xiongnu" ? "匈奴" : "自治";
    const armiesHtml =
      n.armies && n.armies.length > 0
        ? n.armies
            .map(
              (a) => `
          <div class="army-line">
            <span class="dot ${a.faction === "han" ? "c-han" : "c-xn"}"></span>
            <span>${a.name}</span>
            <span class="muted">${a.is_convoy ? `民夫 ${a.laborers.toLocaleString()}` : `兵 ${a.soldiers.toLocaleString()}`} · 粮 ${(a.grain / 1000).toFixed(1)}k · ${a.status}</span>
          </div>`
            )
            .join("")
        : `<div class="muted" style="font-size:12.5px">无野战部队，城中民兵 ${n.militia.toLocaleString()} 人</div>`;

    const overlordLabel = rel
      ? rel.overlord === "han"
        ? "汉属国"
        : rel.overlord === "xiongnu"
        ? "匈奴属国"
        : "独立"
      : "";
    const overlordClass = rel ? (rel.overlord === "han" ? "badge-red" : rel.overlord === "xiongnu" ? "badge-blue" : "") : "";

    box.innerHTML = `
      <div class="node-inspector">
        <div>
          <div class="ins-title">
            <h4>${n.name}</h4>
            <span class="eyebrow">${n.id}</span>
            ${rel ? `<span class="badge ${overlordClass}">${overlordLabel}</span>` : ""}
            ${n.has_beacon ? '<span class="badge">烽燧</span>' : ""}
            ${n.tuntian_lv > 0 ? `<span class="badge badge-green">军屯 ${n.tuntian_lv} 级</span>` : ""}
          </div>
          <dl class="kv-list">
            <dt>控制</dt><dd>${ctlName}</dd>
            <dt>人口</dt><dd>${n.pop.toLocaleString()}</dd>
            <dt>存粮</dt><dd>${(n.grain / 1000).toFixed(1)}k · 农田上限 ${n.farm_cap}</dd>
            <dt>城防</dt><dd>${n.walls} 级 · 城墙 ${n.wall_hp}</dd>
            <dt>战马</dt><dd>${n.horses.toLocaleString()}</dd>
          </dl>
          <div class="ins-subhead">驻军</div>
          ${armiesHtml}
        </div>
        <div>
          ${
            rel
              ? `
            <div class="ins-subhead" style="margin-top:6px">外交与给食</div>
            <div class="bar-row"><span class="k">汉影响力</span><div class="progress-track"><div class="progress-fill han" style="width:${rel.han_influence}%"></div></div><span class="v">${rel.han_influence}</span></div>
            <div class="bar-row"><span class="k">匈奴威吓</span><div class="progress-track"><div class="progress-fill xn" style="width:${rel.xn_intimidation}%"></div></div><span class="v">${rel.xn_intimidation}</span></div>
            <div class="bar-row"><span class="k">对匈怨恨</span><div class="progress-track"><div class="progress-fill accent" style="width:${rel.xn_resentment}%"></div></div><span class="v">${rel.xn_resentment}</span></div>
            <dl class="kv-list" style="margin-top:14px">
              <dt>大军过境</dt><dd style="color:${rel.forage.color}">${rel.forage.label}</dd>
              ${rel.han_enfeoffed ? `<dt>印绶</dt><dd>已受汉印绶</dd>` : ""}
              ${rel.crimes > 0 ? `<dt>罪状</dt><dd class="c-bad">${rel.crimes} 条，可兴兵问罪</dd>` : ""}
            </dl>
          `
              : `<div class="empty" style="padding-top:6px">本土郡县或塞外王庭，不参与西域诸国的外交关系。</div>`
          }
        </div>
      </div>
    `;
  }

  // ==================== 4. 本季纪事与合法指令选择器 ====================
  function renderChronicleAndTodos(st) {
    const ch = st.chronicle;
    const textEl = document.getElementById("chronicle-text");
    textEl.textContent = APP.useClassicalChronicle ? ch.classical : ch.vernacular;

    const todoEl = document.getElementById("todo-list");
    todoEl.innerHTML = (ch.todos || [])
      .map(
        (t) => `
      <div class="todo-item ${t.level === "urgent" ? "urgent" : ""}">
        <span class="dot"></span>
        <div>
          <div class="todo-title">${t.title}</div>
          <div class="todo-detail">${t.detail}</div>
        </div>
      </div>
    `
      )
      .join("");
  }

  function renderCommandList(st) {
    const listEl = document.getElementById("cmd-list");
    const countEl = document.getElementById("cmd-selected-count");
    let cands = st.commands || [];

    if (APP.cmdCategory === "advisor") {
      cands = cands.filter((c) => c.recommended);
    } else if (APP.cmdCategory !== "all") {
      cands = cands.filter((c) => c.category === APP.cmdCategory);
    }

    if (APP.filterBySelectedNode && APP.selectedNodeId) {
      cands = cands.filter((c) => c.target_node === APP.selectedNodeId);
    }

    countEl.textContent = `已选 ${APP.selectedCmdIndices.size} / ${st.commands.length} 条`;

    if (cands.length === 0) {
      listEl.innerHTML = `<div class="empty" style="padding:24px 18px">这个分类下没有可下的命令。</div>`;
      return;
    }

    listEl.innerHTML = cands
      .slice(0, 60)
      .map((c) => {
        const checked = APP.selectedCmdIndices.has(c.idx);
        const target = c.target_node && st.nodes[c.target_node] ? st.nodes[c.target_node].name : "";
        return `
        <label class="cmd-item ${checked ? "selected" : ""}" data-idx="${c.idx}">
          <input type="checkbox" ${checked ? "checked" : ""} data-cmd-idx="${c.idx}"/>
          <div class="cmd-main">
            <div class="cmd-title"><span class="idx">${String(c.idx).padStart(2, "0")}</span>${c.desc}${c.recommended ? '<span class="rec">· 幕僚推荐</span>' : ""}</div>
            <div class="cmd-meta">
              <span>${c.tag}</span>
              ${target ? `<span>${target}</span>` : ""}
              <span class="cost">${c.cost_money > 0 ? `${c.cost_money} 钱` : "不耗钱"}</span>
            </div>
          </div>
        </label>
      `;
      })
      .join("");

    listEl.querySelectorAll("input[type='checkbox']").forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const idx = parseInt(e.target.getAttribute("data-cmd-idx"), 10);
        if (e.target.checked) APP.selectedCmdIndices.add(idx);
        else APP.selectedCmdIndices.delete(idx);
        renderAsymmetricHUD(APP.state);
        renderCommandList(APP.state);
      });
    });
  }

  function renderTurnLogsAndBriefing(st) {
    const endingBox = document.getElementById("ending-banner-box");
    if (st.ending) {
      endingBox.style.display = "block";
      endingBox.innerHTML = `
        <div class="ending">
          <p class="eyebrow">终局</p>
          <div class="ending-title">${st.ending.headline}</div>
          <div class="ending-bio">${st.ending.biography}</div>
          <div class="ending-meta">
            <span>汉史官：${st.ending.grade_han}</span>
            <span>匈奴史官：${st.ending.grade_xn}</span>
            <span>签名 <code>${st.ending.signature}</code></span>
          </div>
        </div>
      `;
    } else {
      endingBox.style.display = "none";
    }

    const logEl = document.getElementById("turn-log-stream");
    const logs = [...(st.turn_logs || [])].reverse();
    if (logs.length === 0) {
      logEl.innerHTML = `<div class="empty">还没有推进过。右侧已默认勾好幕僚推荐的命令，点上方“推进一季”即可看到第一份战报。</div>`;
    } else {
      logEl.innerHTML = logs
        .map(
          (lg) => `
        <div class="turn-log-card">
          <div class="turn-log-head">
            <h5>第 ${lg.turn} 季 · ${lg.date}</h5>
            <span class="eyebrow">${lg.applied_mine.length} 条命令生效</span>
          </div>
          <div class="turn-log-mine">我方：${lg.applied_mine.join("；") || "无"}</div>
          <div>
            ${(lg.events || [])
              .map((ev) => `<div class="event-line"><span class="when">${ev.date}</span><span>${ev.text}</span></div>`)
              .join("")}
          </div>
        </div>
      `
        )
        .join("");
    }

    const briefEl = document.getElementById("raw-observation-text");
    if (briefEl) briefEl.textContent = st.observation_text || "";
  }

  // ==================== 5. Tab 2: S09 200局蒙特卡洛与 5x5 矩阵验证台 ====================
  function renderS09Dashboard() {
    const v1 = BUNDLE.s09_results.v1_200q;
    const matV1 = BUNDLE.s09_results.v1_matrix.dominance_analysis;
    const matBase = BUNDLE.s09_results.baseline_matrix.dominance_analysis;

    // 1. 验收指标
    const l12 = v1.l12_metrics;
    const gate = (k, v, small, d, target) => `
      <div class="gate">
        <div class="gate-k">${k}</div>
        <div class="gate-v">${v}${small ? `<small>${small}</small>` : ""}</div>
        <div class="gate-d">${d}</div>
        <div class="gate-target"><i class="dot"></i>${target}</div>
      </div>`;
    document.getElementById("s09-l12-cards").innerHTML =
      gate("汉方主胜利率", `${l12.han_main_win_pct}%`, "旧规则 0%", "200 局中 69 局设立西域都护府", "目标 20–35%") +
      gate("匈奴主胜利率", `${l12.xn_main_win_pct}%`, "旧规则 58%", "饮马河西 20 局，威服西域 38 局", "目标 20–35%") +
      gate("到期计分 / 政治崩盘", `${l12.expiry_pct}%`, `崩盘 ${l12.political_collapse_pct}%`, "到期时汉 21 : 匈 19；汉使召还 4%，匈奴离散 11%", "到期 ≤ 50%") +
      gate("不同结局", `${l12.reason_signature_count}`, `最大占比 ${l12.reason_signature_max_share_pct}%`, `前十季汉方每季有效命令 ${l12.han_first10_meaningful_cmds_avg} 条`, "≥ 15 种，单一 ≤ 20%");

    // 2. 新旧规则对照表
    const row = (name, target, oldV, oldBad, newV, verdict) => `
      <tr>
        <td>${name}</td>
        <td class="muted">${target}</td>
        <td class="${oldBad ? "was-bad" : "muted"}">${oldV}</td>
        <td class="v-new">${newV}</td>
        <td><span class="status-ok"><i class="dot"></i>${verdict}</span></td>
      </tr>`;
    document.getElementById("s09-compare-tbody").innerHTML = [
      row("汉方总胜率", "45–60%", "42.0%（84/200）", false, "57.0%（114/200）", "达标"),
      row("汉主胜利 · 设立都护府", "20–35%", "0.0%（0/200）", true, "34.5%（69/200）", "从无到有"),
      row("匈奴主胜利 · 河西或威服", "20–35%", "58.0%（116/200）", true, "29.0%（58/200）", "回到区间"),
      row("拖到期限计分", "≤ 50%", "42.0%，且全判汉胜", true, "21.5%（汉 21 : 匈 19 : 平 3）", "接近一比一"),
      row("政治崩盘提前终局", "5–20%", "0.0%", false, "15.0%（召还 8 + 离散 22）", "有张力"),
      row("不同结局种数", "≥ 15，单一 ≤ 20%", "4 种，最大 58%", true, "69 种，最大 9.5%", "多了 17 倍"),
      row("前十季每季命令数", "≥ 3 条", "1.65 条", true, "7.27 条", "不再空转"),
      row("是否存在一招鲜", "无策略 > 70%", "有：匈奴猛攻 95%", true, "无，10 种 AI 均 ≤ 70%", "相互克制"),
      row("中盘优势逆转率", "≥ 40%", "12.0%", false, "68.5%（日逐降汉 44.5%）", "有翻盘"),
    ].join("");

    // 3. 5x5 策略矩阵渲染
    renderStrategyMatrixTable(APP.matrixRulesetView === "v1" ? matV1 : matBase);

    // 4. 终局签名 Top 15 列表
    const sigRows = v1.endgame_signatures.by_reason
      .slice(0, 15)
      .map(
        (s, idx) => `
      <tr>
        <td class="rank">${String(idx + 1).padStart(2, "0")}</td>
        <td><code>${s.signature}</code></td>
        <td style="text-align:right">${s.count}</td>
        <td style="text-align:right" class="mono">${s.share_pct}%</td>
      </tr>
    `
      )
      .join("");
    document.getElementById("s09-signatures-tbody").innerHTML = sigRows;
  }

  function renderStrategyMatrixTable(domData) {
    const bots = ["baseline", "aggressive", "conservative", "greedy", "random_legal"];
    const botNames = {
      baseline: "均衡",
      aggressive: "激进",
      conservative: "持重",
      greedy: "贪利",
      random_legal: "随机",
    };
    let html = `<thead><tr><th>汉 ＼ 匈奴</th>`;
    for (const xb of bots) html += `<th>${botNames[xb]}</th>`;
    html += `<th>汉均值</th></tr></thead><tbody>`;

    for (const hb of bots) {
      html += `<tr><td>${botNames[hb]}</td>`;
      for (const xb of bots) {
        const cell = domData.matchups[`${hb}_vs_${xb}`] || { han_win_pct: 50 };
        const hw = cell.han_win_pct;
        const lean = hw >= 65 ? "han-lean" : hw <= 35 ? "xn-lean" : "";
        html += `<td class="cell ${lean}">${hw.toFixed(1)}</td>`;
      }
      const avgH = domData.han_avg_win_pct_by_bot[hb];
      html += `<td class="cell ${avgH > 70 ? "c-bad" : ""}">${avgH.toFixed(1)}</td></tr>`;
    }

    html += `<tr class="total"><td>匈奴均值</td>`;
    for (const xb of bots) {
      const avgX = domData.xn_avg_win_pct_by_bot[xb];
      html += `<td class="cell ${avgX > 70 ? "c-bad" : ""}">${avgX.toFixed(1)}</td>`;
    }
    html += `<td class="cell ${domData.has_dominant_strategy ? "c-bad" : "c-ok"}">${domData.has_dominant_strategy ? "有一招鲜" : "无一招鲜"}</td></tr></tbody>`;
    document.getElementById("s09-matrix-table").innerHTML = html;
  }

  // ==================== 6. Tab 3: S01–S05 核心公式交互沙盒 ====================
  function setupFormulaCalculators() {
    const inputs = document.querySelectorAll(".calc-input");
    inputs.forEach((inp) => inp.addEventListener("input", updateFormulaCalculators));
    updateFormulaCalculators();
  }

  function updateFormulaCalculators() {
    // 1. S01 汉功业值 G 与匈奴威服值 W 计算器
    const vas = parseFloat(document.getElementById("calc-vassals").value);
    const enf = parseFloat(document.getElementById("calc-enfeoff").value);
    const hubs = parseFloat(document.getElementById("calc-hubs").value);
    const tun = parseFloat(document.getElementById("calc-tuntian").value);
    const rizhu = document.getElementById("calc-rizhu").checked ? 35.0 : 0.0; // +25 永久勋 +10 罢僮仆
    const hexiLost = parseFloat(document.getElementById("calc-hexi-lost").value);

    document.getElementById("val-vassals").textContent = vas;
    document.getElementById("val-enfeoff").textContent = enf;
    document.getElementById("val-hubs").textContent = hubs;
    document.getElementById("val-tuntian").textContent = tun;
    document.getElementById("val-hexi-lost").textContent = hexiLost;

    const G = Math.max(0, Math.min(125, vas * 6 + Math.min(12, enf * 2) + hubs * 10 + tun + rizhu - hexiLost * 12));
    const okG = G >= 100;
    document.getElementById("calc-g-result").innerHTML = `
      <div class="calc-big">${G.toFixed(1)}<small> / 100</small></div>
      <div class="calc-verdict ${okG ? "c-ok" : "muted"}"><i class="dot"></i>${okG ? "已达立府门槛，维持四季即胜" : `还差 ${(100 - G).toFixed(1)}`}</div>
      <div class="calc-breakdown">
        <span>属国 <b>+${vas * 6}</b></span>
        <span>印绶 <b>+${Math.min(12, enf * 2)}</b></span>
        <span>枢纽 <b>+${hubs * 10}</b></span>
        <span>屯田 <b>+${tun}</b></span>
        <span>日逐来降 <b>+${rizhu}</b></span>
        <span>河西失守 <b>−${hexiLost * 12}</b></span>
      </div>
    `;

    // 2. S03 匈奴四部分赏防嫉妒模拟器
    const rZuo = parseFloat(document.getElementById("calc-r-zuo").value);
    const rYou = parseFloat(document.getElementById("calc-r-you").value);
    const rRizhu = parseFloat(document.getElementById("calc-r-rizhu").value);
    const rLihu = parseFloat(document.getElementById("calc-r-lihu").value);
    const sumR = Math.max(1, rZuo + rYou + rRizhu + rLihu);
    const shares = [rZuo / sumR, rYou / sumR, rRizhu / sumR, rLihu / sumR];
    const spread = Math.max(...shares) - Math.min(...shares);
    const hasEnvy = spread > 0.15;
    const names = ["左贤王", "右贤王", "日逐王", "犁汗王"];

    document.getElementById("calc-envy-result").innerHTML = `
      <div class="share-strip">
        ${shares.map((s, i) => `<div><div class="k">${names[i]}</div><div class="v">${(s * 100).toFixed(0)}<small class="muted" style="font-size:13px">%</small></div></div>`).join("")}
      </div>
      <div class="calc-verdict ${hasEnvy ? "c-bad" : "c-ok"}" style="margin-top:12px"><i class="dot"></i>
        极差 ${(spread * 100).toFixed(1)}% · ${hasEnvy ? "超过 15%，被冷落者忠诚 −4、怨望 +8" : "不超过 15%，四部都不嫉妒"}
      </div>
    `;

    // 3. S04/S05 远征 0–18 旬余粮曲线与不归点预演器
    const soldiers = parseFloat(document.getElementById("calc-soldiers").value);
    const laborers = parseFloat(document.getElementById("calc-laborers").value);
    const distTicks = parseFloat(document.getElementById("calc-dist-ticks").value);
    const cityInf = parseFloat(document.getElementById("calc-city-inf").value);

    document.getElementById("val-soldiers").textContent = soldiers.toLocaleString();
    document.getElementById("val-laborers").textContent = laborers.toLocaleString();
    document.getElementById("val-dist-ticks").textContent = distTicks;
    document.getElementById("val-city-inf").textContent = cityInf;

    const carryCap = soldiers * 3.0 + laborers * 15.0;
    const eatPerTick = (soldiers * 1.0 + laborers * 0.8) * 0.9; // 每旬消耗
    const forageGain = cityInf >= 65 ? soldiers * 1.5 : cityInf >= 40 ? soldiers * 0.8 : 0;

    let g = carryCap;
    let starveTick = -1;
    let pnrTick = -1;
    const pts = [];
    for (let t = 0; t <= 18; t++) {
      pts.push({ t, g: Math.max(0, g) });
      const needReturn = Math.min(t, distTicks) * eatPerTick;
      if (pnrTick === -1 && g < needReturn) pnrTick = t;
      if (starveTick === -1 && g <= 0) starveTick = t;
      g -= eatPerTick;
      if (t === Math.floor(distTicks)) g += forageGain;
    }

    const maxG = Math.max(1, carryCap);
    const X = (t) => 30 + t * 28;
    const Y = (v) => 150 - (v / maxG) * 120;
    const polyPts = pts.map((p) => `${X(p.t)},${Y(p.g)}`).join(" ");
    const areaPts = `${X(0)},150 ${polyPts} ${X(18)},150`;
    let ticks = "";
    for (let t = 0; t <= 18; t += 3) {
      ticks += `<text x="${X(t)}" y="166" text-anchor="middle" fill="#7d776c" font-size="9" font-family="IBM Plex Mono, monospace">${t}</text>`;
    }
    document.getElementById("calc-food-svg").innerHTML = `
      <line x1="30" y1="150" x2="534" y2="150" stroke="#3a3731" stroke-width="1"/>
      <line x1="30" y1="30" x2="534" y2="30" stroke="#26241f" stroke-width="1" stroke-dasharray="2,4"/>
      <line x1="${X(distTicks)}" y1="24" x2="${X(distTicks)}" y2="150" stroke="#3a3731" stroke-width="1"/>
      <text x="${X(distTicks) + 4}" y="40" fill="#7d776c" font-size="9.5">抵达</text>
      ${ticks}
      <polygon points="${areaPts}" fill="rgba(217,160,70,0.10)"/>
      ${
        pnrTick !== -1
          ? `<line x1="${X(pnrTick)}" y1="20" x2="${X(pnrTick)}" y2="150" stroke="#d9a046" stroke-dasharray="3,3" stroke-width="1"/>
             <text x="${X(pnrTick)}" y="15" text-anchor="middle" fill="#d9a046" font-size="10">不归点 · 第${pnrTick}旬</text>`
          : ""
      }
      ${
        starveTick !== -1
          ? `<line x1="${X(starveTick)}" y1="20" x2="${X(starveTick)}" y2="150" stroke="#d4664f" stroke-width="1.2"/>
             <text x="${X(starveTick)}" y="${pnrTick !== -1 && Math.abs(pnrTick - starveTick) < 4 ? 28 : 15}" text-anchor="middle" fill="#d4664f" font-size="10">断粮 · 第${starveTick}旬</text>`
          : ""
      }
      <polyline fill="none" stroke="#ece6d8" stroke-width="1.5" points="${polyPts}"/>
      ${pts.map((p) => `<circle cx="${X(p.t)}" cy="${Y(p.g)}" r="2" fill="#0a0908" stroke="#ece6d8" stroke-width="1"/>`).join("")}
    `;
    document.getElementById("calc-food-summary").innerHTML = `
      <span>出发携粮 <b>${(carryCap / 1000).toFixed(1)}k</b></span>
      <span>每旬消耗 <b>${(eatPerTick / 1000).toFixed(1)}k</b></span>
      <span>城邦给食 <b>+${(forageGain / 1000).toFixed(1)}k</b></span>
      ${
        starveTick === -1
          ? `<span class="c-ok">十八旬内不会断粮</span>`
          : `<span class="c-bad">第 ${starveTick} 旬断粮，AI 会拒绝出征</span>`
      }
    `;
  }

  // ==================== 7. Tab 4: 设计文档与 T01–T24 工单库 ====================
  function renderDocsLibrary() {
    const docs = window.XIYU_DOCS || [];
    const navEl = document.getElementById("docs-sidebar-nav");
    if (!docs.some((d) => d.id === APP.activeDocId) && docs[0]) APP.activeDocId = docs[0].id;
    const groups = {};
    for (const d of docs) {
      if (!groups[d.group]) groups[d.group] = [];
      groups[d.group].push(d);
    }

    navEl.innerHTML = Object.entries(groups)
      .map(
        ([gName, items]) => `
      <div class="doc-nav-group">
        <div class="doc-nav-group-title">${gName}</div>
        ${items
          .map(
            (it) => `
          <div class="doc-nav-item ${it.id === APP.activeDocId ? "active" : ""}" data-doc-id="${it.id}">
            <span>${it.title}</span>
            <span class="lines">${it.lines}</span>
          </div>
        `
          )
          .join("")}
      </div>
    `
      )
      .join("");

    navEl.querySelectorAll(".doc-nav-item").forEach((el) => {
      el.addEventListener("click", () => {
        APP.activeDocId = el.getAttribute("data-doc-id");
        renderDocsLibrary();
        const viewer = document.querySelector(".doc-viewer");
        if (viewer && viewer.getBoundingClientRect().top < 0) {
          window.scrollTo({ top: window.scrollY + viewer.getBoundingClientRect().top - 90, behavior: "smooth" });
        }
      });
    });

    const cur = docs.find((d) => d.id === APP.activeDocId) || docs[0];
    if (cur) {
      document.getElementById("doc-viewer-header").innerHTML = `
        <h2>${cur.title}</h2>
        <span class="eyebrow">${cur.path} · ${cur.lines} 行 · ${(cur.chars / 1024).toFixed(1)} KB</span>
      `;
      document.getElementById("doc-viewer-body").innerHTML = simpleMarkdownToHtml(cur.content);
    }
  }

  function simpleMarkdownToHtml(md) {
    const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const inline = (t) =>
      esc(t)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="md-link">$1</span>');
    const lines = md.split("\n");
    const out = [];
    let inCode = false;
    let para = [];
    let list = null; // "ul" | "ol"
    let table = [];
    const flushPara = () => {
      if (para.length) out.push(`<p>${para.map(inline).join("<br/>")}</p>`);
      para = [];
    };
    const flushList = () => {
      if (list) out.push(`</${list}>`);
      list = null;
    };
    const flushTable = () => {
      if (!table.length) return;
      const rows = table.filter((r) => !/^\|?\s*:?-{2,}/.test(r.replace(/\|/g, "|")) || !/^[\s|:-]+$/.test(r));
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim()));
      let html = '<div class="md-table"><table class="data-table">';
      rows.forEach((r, k) => {
        const tag = k === 0 ? "th" : "td";
        html += `<tr>${cells(r).map((c) => `<${tag}>${c}</${tag}>`).join("")}</tr>`;
      });
      out.push(html + "</table></div>");
      table = [];
    };
    const flushAll = () => {
      flushPara();
      flushList();
      flushTable();
    };
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, "");
      if (line.startsWith("```")) {
        flushAll();
        out.push(inCode ? "</code></pre>" : "<pre><code>");
        inCode = !inCode;
        continue;
      }
      if (inCode) {
        out.push(esc(raw));
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(line)) {
        flushPara();
        flushList();
        table.push(line.trim());
        continue;
      } else if (table.length) {
        flushTable();
      }
      let m;
      if (!line.trim()) {
        flushPara();
        flushList();
      } else if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
        flushAll();
        const lv = Math.min(3, m[1].length);
        out.push(`<h${lv}>${inline(m[2])}</h${lv}>`);
      } else if (line.trim() === "---") {
        flushAll();
        out.push("<hr/>");
      } else if ((m = line.match(/^>\s?(.*)$/))) {
        flushPara();
        flushList();
        out.push(`<blockquote>${inline(m[1])}</blockquote>`);
      } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
        flushPara();
        if (list !== "ul") {
          flushList();
          out.push("<ul>");
          list = "ul";
        }
        out.push(`<li>${inline(m[1])}</li>`);
      } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
        flushPara();
        if (list !== "ol") {
          flushList();
          out.push("<ol>");
          list = "ol";
        }
        out.push(`<li>${inline(m[1])}</li>`);
      } else {
        flushList();
        para.push(line.trim());
      }
    }
    if (inCode) out.push("</code></pre>");
    flushAll();
    return out.join("\n");
  }

  // ==================== 路由 ====================
  const ROUTES = {
    "": "tab-home",
    sandbox: "tab-playtest",
    validation: "tab-s09",
    formulas: "tab-formulas",
    docs: "tab-docs",
  };

  function applyRoute(scroll) {
    const key = (location.hash || "").replace(/^#\/?/, "").split("/")[0];
    const target = ROUTES[key] ? key : "";
    document.querySelectorAll(".tab-view").forEach((v) => v.classList.toggle("active", v.id === ROUTES[target]));
    document.querySelectorAll(".site-nav a").forEach((a) => {
      if (a.dataset.route === target) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (scroll) window.scrollTo(0, 0);
  }

  function setMatrixToggle() {
    document.getElementById("btn-matrix-v1").classList.toggle("active", APP.matrixRulesetView === "v1");
    document.getElementById("btn-matrix-base").classList.toggle("active", APP.matrixRulesetView !== "v1");
  }

  function renderHomeFigures() {
    const l12 = BUNDLE.s09_results.v1_200q.l12_metrics;
    const set = (id, html) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    };
    set("stat-sigs", l12.reason_signature_count);
    set("stat-nodes", ((BUNDLE.scenario_mvp && BUNDLE.scenario_mvp.nodes) || []).filter((n) => n.type !== "junction").length || 42);
    set("fig-han", `${l12.han_main_win_pct.toFixed(1)}<small>%</small>`);
    set("fig-xn", `${l12.xn_main_win_pct.toFixed(1)}<small>%</small>`);
    set("fig-sig", l12.reason_signature_count);
    set("fig-cmd", l12.han_first10_meaningful_cmds_avg.toFixed(1));

    // 封面光斑随指针移动
    const cover = document.getElementById("cover");
    if (cover && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cover.addEventListener("pointermove", (e) => {
        const r = cover.getBoundingClientRect();
        cover.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
        cover.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
      });
    }
  }

  // ==================== 8. 事件绑定与初始化 ====================
  function bindEvents() {
    // 顶部主导航：hash 路由
    window.addEventListener("hashchange", () => applyRoute(true));
    applyRoute(false);

    // 引擎模式手动切换
    document.getElementById("engine-pill").addEventListener("click", () => {
      if (!APP.pyReady) {
        alert("Python 引擎尚未就绪（仍在加载或处于离线状态），当前使用浏览器原生引擎。");
        return;
      }
      APP.engineMode = APP.engineMode === "pyodide" ? "js" : "pyodide";
      document.getElementById("engine-label").textContent =
        APP.engineMode === "pyodide" ? "Python 引擎" : "原生引擎";
    });

    // 重新开局与参数变更
    ["sel-side", "sel-scenario", "sel-ruleset", "sel-opp-bot"].forEach((id) => {
      document.getElementById(id).addEventListener("change", () => syncInitFromCurrentControls());
    });
    document.getElementById("btn-new-game").addEventListener("click", () => syncInitFromCurrentControls());

    // 幕僚推荐、清空、推进下一季、连推3季、悔棋
    document.getElementById("btn-pick-advisor").addEventListener("click", () => {
      APP.selectedCmdIndices.clear();
      for (const c of APP.state.commands) {
        if (c.recommended) APP.selectedCmdIndices.add(c.idx);
      }
      renderAsymmetricHUD(APP.state);
      renderCommandList(APP.state);
    });

    document.getElementById("btn-clear-cmds").addEventListener("click", () => {
      APP.selectedCmdIndices.clear();
      renderAsymmetricHUD(APP.state);
      renderCommandList(APP.state);
    });

    document.getElementById("btn-step-turn").addEventListener("click", async () => {
      recordPlaytestTelemetry();
      APP.state = await engineStepTurn(APP.selectedCmdIndices, false);
      APP.selectedCmdIndices.clear();
      for (const c of APP.state.commands) {
        if (c.recommended) APP.selectedCmdIndices.add(c.idx);
      }
      renderPlaytestView();
    });

    document.getElementById("btn-auto-3").addEventListener("click", async () => {
      for (let i = 0; i < 3; i++) {
        if (APP.state.meta.winner) break;
        APP.state = await engineStepTurn(new Set(), true);
      }
      APP.selectedCmdIndices.clear();
      for (const c of APP.state.commands) {
        if (c.recommended) APP.selectedCmdIndices.add(c.idx);
      }
      renderPlaytestView();
    });

    document.getElementById("btn-undo").addEventListener("click", async () => {
      APP.state = await engineUndoTurn();
      APP.selectedCmdIndices.clear();
      for (const c of APP.state.commands) {
        if (c.recommended) APP.selectedCmdIndices.add(c.idx);
      }
      renderPlaytestView();
    });

    // 纪事文言/白话切换
    document.getElementById("btn-toggle-chronicle-style").addEventListener("click", (e) => {
      APP.useClassicalChronicle = !APP.useClassicalChronicle;
      e.currentTarget.textContent = APP.useClassicalChronicle ? "改看白话" : "改看原文";
      renderChronicleAndTodos(APP.state);
    });

    // 命令分类标签切换
    document.querySelectorAll(".cmd-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".cmd-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        APP.cmdCategory = tab.getAttribute("data-cat");
        renderCommandList(APP.state);
      });
    });

    document.getElementById("chk-filter-node").addEventListener("change", (e) => {
      APP.filterBySelectedNode = e.target.checked;
      renderCommandList(APP.state);
    });

    // 导出试玩日志 (.md)
    document.getElementById("btn-export-log").addEventListener("click", exportPlaytestMarkdown);

    // Tab 2: 5x5 矩阵规则集切换与在线跑批
    document.getElementById("btn-matrix-v1").addEventListener("click", () => {
      APP.matrixRulesetView = "v1";
      setMatrixToggle();
      renderStrategyMatrixTable(BUNDLE.s09_results.v1_matrix.dominance_analysis);
    });
    document.getElementById("btn-matrix-base").addEventListener("click", () => {
      APP.matrixRulesetView = "baseline";
      setMatrixToggle();
      renderStrategyMatrixTable(BUNDLE.s09_results.baseline_matrix.dominance_analysis);
    });

    document.getElementById("btn-run-live-batch").addEventListener("click", runLiveBatchInBrowser);
  }

  function recordPlaytestTelemetry() {
    const st = APP.state;
    if (!st) return;
    const boredom = document.getElementById("sel-boredom").value;
    const confusion = document.getElementById("sel-confusion").value;
    const note = document.getElementById("inp-turn-note").value.trim();
    const chosenDescs = st.commands
      .filter((c) => APP.selectedCmdIndices.has(c.idx))
      .map((c) => c.desc);
    APP.playtestRatings.push({
      turn: st.meta.turn + 1,
      date: st.meta.date_text,
      side: st.meta.side,
      boredom,
      confusion,
      note,
      cmds: chosenDescs,
    });
    document.getElementById("inp-turn-note").value = "";
  }

  function exportPlaytestMarkdown() {
    const st = APP.state;
    let lines = [
      `# 《西域·汉匈争霸》v1.0 网页纸面推演试玩报告`,
      `- 剧本：${st.meta.scenario} | 执政方：${st.meta.side} | 规则集：${st.meta.ruleset} | 种子：${st.meta.seed}`,
      `- 当前进度：第 ${st.meta.turn} 季 (${st.meta.date_text}) | 胜者：${st.meta.winner || "未决"}`,
      "",
      `## 逐季决策与体验打分记录`,
    ];
    for (const r of APP.playtestRatings) {
      lines.push(`### Turn ${r.turn} (${r.date}) — 扮演：${r.side}`);
      lines.push(`- **下达指令 (${r.cmds.length}条)**：${r.cmds.join("；") || "空过"}`);
      lines.push(`- **体验打分**：无聊度 ${r.boredom}/5 | 困惑度 ${r.confusion}/5`);
      if (r.note) lines.push(`- **试玩笔记**：${r.note}`);
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xiyu_playtest_${st.meta.side}_seed${st.meta.seed}.md`;
    a.click();
  }

  async function runLiveBatchInBrowser() {
    const nGames = parseInt(document.getElementById("live-batch-games").value || "6", 10);
    const hanSel = document.getElementById("live-han-bot");
    const xnSel = document.getElementById("live-xn-bot");
    const hanBot = hanSel.value;
    const xnBot = xnSel.value;
    const hanName = hanSel.options[hanSel.selectedIndex].text;
    const xnName = xnSel.options[xnSel.selectedIndex].text;
    const outBox = document.getElementById("live-batch-result");
    outBox.innerHTML = `<span class="muted">正在模拟 ${nGames} 局：汉方${hanName}，匈奴${xnName}…</span>`;

    setTimeout(async () => {
      if (APP.pyReady && APP.pyodide) {
        APP.pyodide.globals.set("_b_games", nGames);
        APP.pyodide.globals.set("_b_hb", hanBot);
        APP.pyodide.globals.set("_b_xb", xnBot);
        const resJson = await APP.pyodide.runPythonAsync(
          `wb.run_batch_sim_json(games=_b_games, ruleset="v1", han_bot=_b_hb, xn_bot=_b_xb, seed_start=12001)`
        );
        const d = JSON.parse(resJson);
        outBox.innerHTML = `
          <div class="eyebrow">Python 引擎 · ${nGames} 局 · 汉方${hanName} 对 匈奴${xnName}</div>
          <div class="stats">
            <span>汉胜 ${d.wins.han} 局（${d.han_win_percent}%）</span>
            <span>匈奴胜 ${d.wins.xiongnu} 局</span>
            <span>汉主胜 ${d.l12_metrics.han_main_win_pct}%</span>
            <span>匈主胜 ${d.l12_metrics.xn_main_win_pct}%</span>
            <span>结局 ${d.l12_metrics.reason_signature_count} 种</span>
          </div>
        `;
      } else {
        // 原生引擎：读取预计算矩阵中的对应对局
        const mat = BUNDLE.s09_results.v1_matrix.dominance_analysis.matchups[`${hanBot}_vs_${xnBot}`] || { han_win_pct: 50, han_main_pct: 30, xn_main_pct: 30 };
        outBox.innerHTML = `
          <div class="eyebrow">原生引擎 · 预计算结果 · 汉方${hanName} 对 匈奴${xnName}</div>
          <div class="stats">
            <span>汉胜率 ${mat.han_win_pct}%</span>
            <span>汉主胜 ${mat.han_main_pct}%</span>
            <span>匈主胜 ${mat.xn_main_pct}%</span>
          </div>
        `;
      }
    }, 30);
  }

  window.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    syncInitFromCurrentControls();
    renderS09Dashboard();
    renderHomeFigures();
    setupFormulaCalculators();
    renderDocsLibrary();
    initPyodideInBackground();
  });
})();
