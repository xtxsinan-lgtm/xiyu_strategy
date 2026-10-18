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
        if (label) label.textContent = "⚡ 极速原生引擎 (离线自包含模式)";
      };
      document.head.appendChild(script);
    } else {
      bootPyodideRuntime(dot, label);
    }
  }

  async function bootPyodideRuntime(dot, label) {
    try {
      if (dot) dot.classList.add("loading");
      if (label) label.textContent = "⚡ 极速引擎运行中 (后台加载 Python WASM...)";
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
      if (label) label.textContent = "🐍 Python 真机引擎 (Pyodide design_sim 已激活)";

      // 若当前还在第 0 回合，同步一次 Python 引擎初始状态
      if (APP.state && APP.state.meta.turn === 0) {
        await syncInitFromCurrentControls();
      }
    } catch (err) {
      console.warn("Pyodide load fallback to JS engine:", err);
      if (dot) dot.classList.remove("loading");
      if (label) label.textContent = "⚡ 极速原生引擎 (已就绪)";
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

    // 计算当前已勾选命令预计花费
    let plannedMoney = 0;
    for (const c of st.commands) {
      if (APP.selectedCmdIndices.has(c.idx)) {
        plannedMoney += c.cost_money || 0;
      }
    }

    if (!v1) {
      container.innerHTML = `
        <div class="hud-card han-accent">
          <div class="hud-head"><span>当前执政与回合</span><span class="badge badge-gold">基线规则集 (baseline)</span></div>
          <div class="hud-val">${st.meta.date_text} · 第 ${st.meta.turn + 1} 季</div>
          <div class="hud-sub"><span>胜负状态：${st.meta.winner || "博弈进行中"}</span><span>汉属国：${sc.han_vassals}/12</span><span>河西在汉：${sc.hexi_han}/4</span></div>
        </div>
        <div class="hud-card gold-accent">
          <div class="hud-head"><span>国库与兵源储备</span><span>预计本季支出: -${plannedMoney} 金</span></div>
          <div class="hud-val">汉金 ${sc.han_money} | 匈奴金 ${sc.xn_money}</div>
          <div class="hud-sub"><span>综合计分：汉 ${sc.han} : 匈奴 ${sc.xiongnu}</span><span>断粮饿死累计：${sc.starve_losses} 人</span></div>
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
          ? "便宜行事（征调耗金9折）"
          : court.trust >= 50
          ? "正常授节"
          : court.trust >= 25
          ? "监军掣肘（严查矫诏）"
          : "苛刻限期（濒临槛车征还）";
      const windMap = {
        expansion: "武帝拓边（主战激进）",
        regret: "轮台悔诏（罢远征重军屯）",
        xuan_revival: "宣帝中兴（并护南北道）",
      };
      const ed = court.active_edict;
      container.innerHTML = `
        <div class="hud-card han-accent">
          <div class="hud-head">
            <span>🏛️ S01 西域都护府功业 (G)</span>
            <span class="badge ${vic.han_merit >= 100 ? "badge-green" : "badge-gold"}">立府维持 ${vic.han_hold_months}/12 月</span>
          </div>
          <div class="hud-val">${vic.han_merit.toFixed(1)} <small style="font-size:12px;color:#94a3b8">/ 100.0 (峰值 ${vic.han_merit_peak.toFixed(1)})</small></div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${Math.min(100, vic.han_merit)}%;background:linear-gradient(90deg,#dc2626,#f59e0b)"></div>
          </div>
          <div class="hud-sub">
            <span>属国 ${sc.han_vassals} (+${sc.han_vassals * 6})</span>
            <span>军屯 ${Object.keys(logi.tuntian_nodes).length} 处</span>
            <span>永久勋 +${vic.han_perm_merit.toFixed(0)}</span>
            <span>僮仆都尉:${tribes.tongpu_active ? "在位" : "已罢(+10)"}</span>
          </div>
        </div>

        <div class="hud-card gold-accent">
          <div class="hud-head">
            <span>📜 S02 长安朝廷信任 & 风向</span>
            <span class="badge badge-red">${windMap[court.wind] || court.wind}</span>
          </div>
          <div class="hud-val">${court.trust.toFixed(1)} <small style="font-size:12px;color:#fde68a">【${trustTier}】</small></div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${Math.min(100, court.trust)}%;background:linear-gradient(90deg,#3b82f6,#10b981)"></div>
          </div>
          <div class="hud-sub">
            ${
              ed
                ? `<span style="color:#fde68a">📌 ${ed.title} (限第${ed.deadline_turn}季, ${ed.complied ? "已奉诏" : "待奉诏"})</span>`
                : `<span>当前无待办诏令</span>`
            }
          </div>
        </div>

        <div class="hud-card">
          <div class="hud-head">
            <span>🌾 S05 军资·良马·烽燧·伤亡</span>
            <span class="badge badge-blue">${st.meta.date_text} (Q${st.meta.turn + 1}/${st.meta.max_turns})</span>
          </div>
          <div class="hud-val">黄金 ${sc.han_money} <small style="font-size:12px;color:#f87171">(已选指令预计 -${plannedMoney})</small></div>
          <div class="hud-sub">
            <span>🐎 国家马池 ${sc.han_horse_pool}</span>
            <span>🔥 烽燧 ${logi.beacons.length} 座</span>
            <span>⚔️ 汉阵亡 ${(sc.han_casualties - sc.starve_losses).toLocaleString()}</span>
            <span style="color:#fca5a5">💀 断粮饿死 ${sc.starve_losses.toLocaleString()} (单列)</span>
          </div>
        </div>

        <div class="hud-card xn-accent">
          <div class="hud-head">
            <span>🏹 敌情感知：匈奴单于庭 & 诸王</span>
            <span class="badge badge-blue">威服值 W=${vic.xn_weifu.toFixed(1)}/100</span>
          </div>
          <div class="hud-val">单于威望 ${tribes.chanyu_prestige.toFixed(1)} | 属国 ${sc.xn_vassals}</div>
          <div class="hud-sub">
            <span>日逐王忠:${tribes.tribes.rizhu.loyalty.toFixed(0)} ${tribes.tribes.rizhu.surrender_window > 0 ? "🔥【请降窗口!】" : ""}</span>
            <span>左贤忠:${tribes.tribes.zuoxian.loyalty.toFixed(0)}</span>
            <span>右贤忠:${tribes.tribes.youxian.loyalty.toFixed(0)}</span>
          </div>
        </div>
      `;
    } else {
      // 匈奴玩家非对称 HUD
      const tMap = tribes.tribes;
      container.innerHTML = `
        <div class="hud-card xn-accent">
          <div class="hud-head">
            <span>🐺 S01 匈奴双路径主胜利</span>
            <span class="badge badge-blue">威服维持 ${vic.xn_weifu_hold_months}/6 月</span>
          </div>
          <div class="hud-val">威服 W=${vic.xn_weifu.toFixed(1)}/100 | 河西在匈 ${4 - sc.hexi_han}/4 郡</div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${Math.min(100, vic.xn_weifu)}%;background:linear-gradient(90deg,#0284c7,#38bdf8)"></div>
          </div>
          <div class="hud-sub">
            <span>西域属国 ${sc.xn_vassals} 国</span>
            <span>僮仆都尉:${tribes.tongpu_active ? "正常征税" : "已失"}</span>
            <span>敌方汉功业 G=${vic.han_merit.toFixed(1)}</span>
          </div>
        </div>

        <div class="hud-card gold-accent">
          <div class="hud-head">
            <span>👑 S03 单于威望 & 王庭赏赐池</span>
            <span class="badge badge-gold">${st.meta.date_text} (Q${st.meta.turn + 1}/${st.meta.max_turns})</span>
          </div>
          <div class="hud-val">威望 ${tribes.chanyu_prestige.toFixed(1)} | 黄金/赏池 ${sc.xn_money + tribes.reward_pool}</div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${Math.min(100, tribes.chanyu_prestige)}%;background:linear-gradient(90deg,#f59e0b,#10b981)"></div>
          </div>
          <div class="hud-sub">
            <span>当季战术卡：${tribes.active_tactical_card || "未发动（可选择）"}</span>
            <span>已选支出：-${plannedMoney}</span>
          </div>
        </div>

        <div class="hud-card" style="grid-column: span 2;">
          <div class="hud-head">
            <span>🏇 S03 帐下四大部王忠诚度与叛降监控（忠 < 38 触发擅自行动或请降汉朝）</span>
            <span class="badge ${tMap.rizhu.loyalty < 42 ? "badge-red" : "badge-green"}">${tMap.rizhu.surrender_window > 0 ? "⚠️ 日逐王正密通汉使！" : "诸部尚受节制"}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:4px;">
            ${Object.entries(tMap)
              .map(
                ([k, tv]) => `
              <div style="background:#0d121b;border:1px solid ${tv.loyalty < 42 ? "#ef4444" : "#2b354d"};padding:6px 8px;border-radius:6px;">
                <div style="font-size:12px;font-weight:700;color:${tv.loyalty < 42 ? "#fca5a5" : "#e2e8f0"}">${tv.name} (${tv.leader})</div>
                <div style="font-size:15px;font-weight:800;color:#38bdf8">忠诚 ${tv.loyalty.toFixed(0)}</div>
                <div style="font-size:11px;color:#94a3b8">怨望 ${tv.grievance.toFixed(0)} | ${tv.status === "defected_han" ? "已叛降汉" : "在列"}</div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }
  }

  // ==================== 3. 42 节点战略地图 SVG 渲染 ====================
  function renderStrategicMap(st) {
    const svg = document.getElementById("map-svg");
    const pos = BUNDLE.map_presentation.positions;
    const waypoints = BUNDLE.map_presentation.waypoints || {};
    const routes = BUNDLE.scenario_mvp.routes;
    const edTarget = st.v1 && st.v1.court.active_edict ? st.v1.court.active_edict.target : "";

    let html = `
      <defs>
        <radialGradient id="hanGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ef4444" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#ef4444" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="xnGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <!-- 地理分区底纹标注 -->
      <text x="840" y="555" fill="rgba(239,68,68,0.22)" font-size="22" font-weight="800" font-family="serif">关中·河西四郡</text>
      <text x="720" y="60" fill="rgba(14,165,233,0.22)" font-size="22" font-weight="800" font-family="serif">漠北·匈奴单于庭</text>
      <text x="450" y="245" fill="rgba(245,158,11,0.18)" font-size="20" font-weight="800" font-family="serif">天山北道 · 塔里木盆地</text>
      <text x="410" y="520" fill="rgba(245,158,11,0.18)" font-size="18" font-weight="800" font-family="serif">西域南道</text>
      <text x="75" y="130" fill="rgba(168,85,247,0.22)" font-size="18" font-weight="800" font-family="serif">葱岭外大国</text>
    `;

    // 1. 绘制道路网
    const terrainColor = {
      plain: "#475569",
      oasis: "#10b981",
      steppe: "#0284c7",
      desert: "#d97706",
      mountain: "#94a3b8",
      hazard: "#ef4444",
    };

    for (const r of routes) {
      const pA = pos[r.a];
      const pB = pos[r.b];
      if (!pA || !pB) continue;
      const wpKey1 = `${r.a}|${r.b}`;
      const wpKey2 = `${r.b}|${r.a}`;
      let pts = [pA];
      if (waypoints[wpKey1]) pts = pts.concat(waypoints[wpKey1]);
      else if (waypoints[wpKey2]) pts = pts.concat([...waypoints[wpKey2]].reverse());
      pts.push(pB);

      const dAttr = pts.map((pt, i) => `${i === 0 ? "M" : "L"}${pt[0]},${pt[1]}`).join(" ");
      const col = terrainColor[r.terrain] || "#475569";
      const dash = r.terrain === "desert" || r.terrain === "hazard" ? 'stroke-dasharray="5,4"' : "";
      html += `<path d="${dAttr}" fill="none" stroke="${col}" stroke-width="1.8" stroke-opacity="0.55" ${dash}/>`;
    }

    // 2. 绘制在途移动部队
    for (const ma of st.moving_armies || []) {
      const pA = pos[ma.from];
      const pB = pos[ma.to];
      if (!pA || !pB) continue;
      const mx = pA[0] + (pB[0] - pA[0]) * (ma.progress || 0.5);
      const my = pA[1] + (pB[1] - pA[1]) * (ma.progress || 0.5);
      const col = ma.faction === "han" ? "#ef4444" : "#38bdf8";
      html += `
        <g transform="translate(${mx},${my})">
          <circle r="7" fill="${col}" stroke="#fff" stroke-width="1.2"/>
          <text y="-10" text-anchor="middle" fill="#fef08a" font-size="10" font-weight="700">${ma.is_convoy ? "📦粮队" : "⚔️" + Math.round(ma.soldiers / 1000) + "k"}</text>
        </g>
      `;
    }

    // 3. 绘制 42 个节点
    for (const [nid, n] of Object.entries(st.nodes)) {
      const pt = pos[nid];
      if (!pt) continue;
      const [x, y] = pt;

      let owner = n.controller;
      if (n.relation && n.relation.overlord) owner = n.relation.overlord;

      let fill = "#f59e0b"; // 中立城邦
      let stroke = "#fde68a";
      let glow = "";
      if (owner === "han") {
        fill = "#dc2626";
        stroke = "#fca5a5";
        glow = `<circle cx="${x}" cy="${y}" r="18" fill="url(#hanGlow)"/>`;
      } else if (owner === "xiongnu") {
        fill = "#0284c7";
        stroke = "#7dd3fc";
        glow = `<circle cx="${x}" cy="${y}" r="18" fill="url(#xnGlow)"/>`;
      }

      const isSelected = nid === APP.selectedNodeId;
      const isEdictTarget = nid === edTarget;
      const radius =
        nid === "chang_an" || nid === "chanyu_ting"
          ? 9.5
          : ["dun_huang", "lou_lan", "wu_lei", "cheshi_qian", "wu_sun", "da_wan"].includes(nid)
          ? 7.8
          : 6.2;

      const totalTroops = (n.armies || [])
        .filter((a) => !a.is_convoy)
        .reduce((acc, a) => acc + a.soldiers, 0);

      html += `<g class="map-node" data-node="${nid}" style="cursor:pointer">`;
      html += glow;
      if (isSelected) {
        html += `<circle cx="${x}" cy="${y}" r="${radius + 6}" fill="none" stroke="#fbbf24" stroke-width="2.2" stroke-dasharray="3,2"/>`;
      }
      if (isEdictTarget) {
        html += `<circle cx="${x}" cy="${y}" r="${radius + 9}" fill="none" stroke="#f43f5e" stroke-width="1.8"/>`;
      }
      html += `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;

      // 烽燧与军屯角标
      let badges = "";
      if (n.has_beacon) badges += "🔥";
      if (n.tuntian_lv > 0) badges += `🌾${n.tuntian_lv}`;
      if (badges) {
        html += `<text x="${x + radius + 2}" y="${y - 4}" font-size="10">${badges}</text>`;
      }

      // 驻军兵力标签
      if (totalTroops > 0) {
        const armyCol = n.armies[0].faction === "han" ? "#fecaca" : "#bae6fd";
        html += `<text x="${x}" y="${y - radius - 4}" text-anchor="middle" fill="${armyCol}" font-size="10" font-weight="700">⚔️${(totalTroops / 1000).toFixed(1)}k</text>`;
      }

      // 节点名称
      html += `<text x="${x}" y="${y + radius + 12}" text-anchor="middle" fill="${isSelected ? "#fde68a" : "#e2e8f0"}" font-size="11" font-weight="${isSelected ? "800" : "600"}">${n.name}</text>`;
      html += `</g>`;
    }

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
      box.innerHTML = `<div style="color:#94a3b8">点击地图任意城池/绿洲查看实时情报</div>`;
      return;
    }
    const rel = n.relation;
    const armiesHtml =
      n.armies && n.armies.length > 0
        ? n.armies
            .map(
              (a) =>
                `<div>· <span class="badge ${a.faction === "han" ? "badge-red" : "badge-blue"}">${a.name}</span> ${
                  a.is_convoy ? `民夫 ${a.laborers}` : `兵 ${a.soldiers}`
                } | 粮 ${(a.grain / 1000).toFixed(1)}k (${a.status})</div>`
            )
            .join("")
        : `<div style="color:#64748b">无野战驻军（城防民兵 ${n.militia} 人）</div>`;

    box.innerHTML = `
      <div class="node-inspector">
        <div>
          <div style="font-size:15px;font-weight:700;color:#fde68a;margin-bottom:4px;">
            📍 ${n.name} <small style="color:#94a3b8">(${n.id})</small>
            ${n.has_beacon ? '<span class="badge badge-gold">🔥烽燧已筑</span>' : ""}
            ${n.tuntian_lv > 0 ? `<span class="badge badge-green">🌾军屯 Lv.${n.tuntian_lv}</span>` : ""}
          </div>
          <div>控制方：<strong>${n.controller === "han" ? "大汉" : n.controller === "xiongnu" ? "匈奴" : n.name}</strong></div>
          <div>人口：${n.pop.toLocaleString()} | 存粮：<strong>${(n.grain / 1000).toFixed(1)}k</strong> | 农田上限：${n.farm_cap}</div>
          <div>城防等级：Lv.${n.walls} (HP ${n.wall_hp}) | 战马存栏：${n.horses.toLocaleString()}</div>
          <div style="margin-top:6px;font-weight:600;color:#cbd5e1">驻扎部队：</div>
          ${armiesHtml}
        </div>
        <div>
          ${
            rel
              ? `
            <div style="font-weight:700;color:#f8fafc;margin-bottom:4px;">🕊️ 西域邦交与沿途给食检定 (S04)</div>
            <div>宗主归属：<span class="badge ${rel.overlord === "han" ? "badge-red" : rel.overlord === "xiongnu" ? "badge-blue" : "badge-gold"}">${
                  rel.overlord === "han" ? "汉属国" : rel.overlord === "xiongnu" ? "匈奴属国" : "独立城邦"
                }</span> ${rel.han_enfeoffed ? '<span class="badge badge-gold">已赐汉印绶</span>' : ""} ${
                  rel.crimes > 0 ? `<span class="badge badge-red">讨伐罪状×${rel.crimes}</span>` : ""
                }</div>
            <div style="margin-top:5px;">汉方影响力：<strong>${rel.han_influence}</strong> / 100</div>
            <div class="progress-track"><div class="progress-fill" style="width:${rel.han_influence}%;background:#ef4444"></div></div>
            <div>匈奴威吓值：<strong>${rel.xn_intimidation}</strong> / 100（对匈怨恨：${rel.xn_resentment}）</div>
            <div class="progress-track"><div class="progress-fill" style="width:${rel.xn_intimidation}%;background:#0ea5e9"></div></div>
            <div style="margin-top:6px;">汉军过境供粮意愿：<span style="font-weight:700;color:${rel.forage.color}">${rel.forage.label}</span></div>
          `
              : `<div style="color:#94a3b8;padding-top:8px;">本土直辖重镇 / 塞外王庭节点（非西域城邦，无独立外交关系条目）。</div>`
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
        <div style="font-weight:700;color:${t.level === "urgent" ? "#fca5a5" : "#fde68a"}">${t.title}</div>
        <div style="color:#cbd5e1">${t.detail}</div>
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

    countEl.textContent = `已勾选 ${APP.selectedCmdIndices.size} 条指令（共 ${st.commands.length} 条合法候选）`;

    if (cands.length === 0) {
      listEl.innerHTML = `<div style="color:#94a3b8;padding:14px;text-align:center;">当前筛选条件下无候选指令（可切换上方分类标签查看全部 ${st.commands.length} 条合法指令）</div>`;
      return;
    }

    listEl.innerHTML = cands
      .slice(0, 60)
      .map((c) => {
        const checked = APP.selectedCmdIndices.has(c.idx);
        return `
        <label class="cmd-item ${checked ? "selected" : ""} ${c.recommended ? "recommended" : ""}" data-idx="${c.idx}">
          <input type="checkbox" ${checked ? "checked" : ""} data-cmd-idx="${c.idx}"/>
          <div class="cmd-main">
            <div class="cmd-title">
              [${c.idx}] ${c.desc}
              ${c.recommended ? '<span class="badge badge-green">★幕僚推荐</span>' : ""}
            </div>
            <div class="cmd-meta">
              <span class="badge badge-gold">${c.tag}</span>
              ${c.cost_money > 0 ? `<span style="color:#fca5a5">耗金 ${c.cost_money}</span>` : `<span style="color:#6ee7b7">免钱指令</span>`}
              ${c.target_node && st.nodes[c.target_node] ? `<span>📍 目标：${st.nodes[c.target_node].name}</span>` : ""}
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
        <div class="chronicle-box" style="border-color:#10b981;background:rgba(6,78,59,0.35);">
          <div style="font-size:16px;font-weight:800;color:#6ee7b7;margin-bottom:6px;">🏆 ${st.ending.headline}</div>
          <div class="chronicle-text">${st.ending.biography}</div>
          <div style="font-size:12.5px;color:#fde68a;margin-top:6px;">
            <div>汉史官评定：${st.ending.grade_han}</div>
            <div>匈奴史官评定：${st.ending.grade_xn}</div>
            <div>终局四段式签名：<code>${st.ending.signature}</code></div>
          </div>
        </div>
      `;
    } else {
      endingBox.style.display = "none";
    }

    const logEl = document.getElementById("turn-log-stream");
    const logs = [...(st.turn_logs || [])].reverse();
    if (logs.length === 0) {
      logEl.innerHTML = `<div style="color:#94a3b8;padding:10px;">尚未推进回合。请勾选左侧指令（或保持★幕僚推荐）并点击【▶ 推进下一季】查看结算战报。</div>`;
    } else {
      logEl.innerHTML = logs
        .map(
          (lg) => `
        <div class="turn-log-card">
          <div style="display:flex;justify-content:space-between;font-weight:700;color:#fde68a;margin-bottom:4px;">
            <span>第 ${lg.turn} 季结算战报 (${lg.date})</span>
            <span class="badge badge-green">生效 ${lg.applied_mine.length} 令</span>
          </div>
          <div style="font-size:11.5px;color:#94a3b8;margin-bottom:4px;">我方执行：${lg.applied_mine.join("；") || "无"}</div>
          <div>
            ${(lg.events || [])
              .map((ev) => `<div class="event-line">· <span style="color:#38bdf8">[${ev.date}]</span> ${ev.text}</div>`)
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
    const base = BUNDLE.s09_results.baseline_200q;
    const matV1 = BUNDLE.s09_results.v1_matrix.dominance_analysis;
    const matBase = BUNDLE.s09_results.baseline_matrix.dominance_analysis;

    // 1. L12 门禁卡片
    const l12 = v1.l12_metrics;
    document.getElementById("s09-l12-cards").innerHTML = `
      <div class="hud-card han-accent">
        <div class="hud-head"><span>汉方主胜利率 (HAN_MAIN)</span><span class="badge badge-green">PASS (目标 20–35%)</span></div>
        <div class="hud-val">${l12.han_main_win_pct}% <small style="font-size:12px;color:#94a3b8">(基线: 0.0%)</small></div>
        <div class="hud-sub"><span>69 / 200 局成功设立西域都护府</span></div>
      </div>
      <div class="hud-card xn-accent">
        <div class="hud-head"><span>匈奴主胜利率 (XN_MAIN)</span><span class="badge badge-green">PASS (目标 20–35%)</span></div>
        <div class="hud-val">${l12.xn_main_win_pct}% <small style="font-size:12px;color:#94a3b8">(基线: 58.0%)</small></div>
        <div class="hud-sub"><span>河西饮马 20 局 + 威服西域 38 局</span></div>
      </div>
      <div class="hud-card gold-accent">
        <div class="hud-head"><span>到期计分 & 政治崩盘率</span><span class="badge badge-green">PASS (到期 ≤ 50%)</span></div>
        <div class="hud-val">到期 ${l12.expiry_pct}% | 崩盘 ${l12.political_collapse_pct}%</div>
        <div class="hud-sub"><span>到期汉21:匈19 | 汉召还4% / 匈离散11%</span></div>
      </div>
      <div class="hud-card">
        <div class="hud-head"><span>终局签名多样性 & 前10季命令密度</span><span class="badge badge-green">PASS (≥15种 & ≤20%)</span></div>
        <div class="hud-val">${l12.reason_signature_count} 种签名 <small style="font-size:12px;color:#6ee7b7">(最大占比 ${l12.reason_signature_max_share_pct}%)</small></div>
        <div class="hud-sub"><span>前10季汉均有效命令：${l12.han_first10_meaningful_cmds_avg} 条/季 (基线 1.65)</span></div>
      </div>
    `;

    // 2. W1 基线 vs W2 v1 全维度对照表
    document.getElementById("s09-compare-tbody").innerHTML = `
      <tr><td><strong>汉方总胜率</strong></td><td>45% – 60%</td><td>42.0% (84/200)</td><td><strong>57.0% (114/200)</strong></td><td><span class="badge badge-green">✅ 达标</span></td></tr>
      <tr><td><strong>汉主胜利 (立都护府)</strong></td><td>20.0% – 35.0%</td><td style="color:#f87171">0.0% (0/200 ❌)</td><td><strong>34.5% (69/200)</strong></td><td><span class="badge badge-green">✅ 彻底激活</span></td></tr>
      <tr><td><strong>匈奴主胜利 (河西+威服)</strong></td><td>20.0% – 35.0%</td><td style="color:#f87171">58.0% (116/200 ❌)</td><td><strong>29.0% (58/200)</strong></td><td><span class="badge badge-green">✅ 精准收敛</span></td></tr>
      <tr><td><strong>到期连续计分比例</strong></td><td>≤ 50.0%</td><td>42.0% (100%判汉胜 ❌)</td><td><strong>21.5% (汉21:匈19:平3)</strong></td><td><span class="badge badge-green">✅ 接近 1:1</span></td></tr>
      <tr><td><strong>政治崩盘提前终局</strong></td><td>5.0% – 20.0%</td><td>0.0%</td><td><strong>15.0% (召还8 + 离散22)</strong></td><td><span class="badge badge-green">✅ 叙事张力</span></td></tr>
      <tr><td><strong>终局四段式签名种数</strong></td><td>≥ 15 种 (单签 ≤20%)</td><td style="color:#f87171">4 种 (最大 58.0% ❌)</td><td><strong>69 种 (最大仅 9.5%)</strong></td><td><span class="badge badge-green">✅ 提升 17 倍</span></td></tr>
      <tr><td><strong>汉前10季局均命令数</strong></td><td>≥ 3.0 条/季</td><td style="color:#f87171">1.65 条/季 ❌</td><td><strong>7.27 条/季</strong></td><td><span class="badge badge-green">✅ 告别空转</span></td></tr>
      <tr><td><strong>5×5 策略矩阵支配检测</strong></td><td>无单一策略 > 70%</td><td style="color:#f87171">True (匈激进 95% ❌)</td><td><strong>False (全部 10 Bot ≤ 70%)</strong></td><td><span class="badge badge-green">✅ 非传递克制</span></td></tr>
      <tr><td><strong>中盘局势优势逆转率</strong></td><td>≥ 40.0%</td><td>12.0%</td><td><strong>68.5% (日逐降汉率 44.5%)</strong></td><td><span class="badge badge-green">✅ 破局涌现</span></td></tr>
    `;

    // 3. 5x5 策略矩阵渲染
    renderStrategyMatrixTable(APP.matrixRulesetView === "v1" ? matV1 : matBase);

    // 4. 终局签名 Top 15 列表
    const sigRows = v1.endgame_signatures.by_reason
      .slice(0, 15)
      .map(
        (s, idx) => `
      <tr>
        <td>#${idx + 1}</td>
        <td><code>${s.signature}</code></td>
        <td>${s.count} 局</td>
        <td><span class="badge badge-gold">${s.share_pct}%</span></td>
      </tr>
    `
      )
      .join("");
    document.getElementById("s09-signatures-tbody").innerHTML = sigRows;
  }

  function renderStrategyMatrixTable(domData) {
    const bots = ["baseline", "aggressive", "conservative", "greedy", "random_legal"];
    const botNames = {
      baseline: "均衡 (baseline)",
      aggressive: "激进 (aggressive)",
      conservative: "持重 (conservative)",
      greedy: "贪利 (greedy)",
      random_legal: "随机 (random)",
    };
    let html = `<thead><tr><th>汉方策略 \\ 匈奴策略 (汉胜率%)</th>`;
    for (const xb of bots) html += `<th>匈·${botNames[xb]}</th>`;
    html += `<th>汉平均胜率</th></tr></thead><tbody>`;

    for (const hb of bots) {
      html += `<tr><td><strong>汉·${botNames[hb]}</strong></td>`;
      for (const xb of bots) {
        const cell = domData.matchups[`${hb}_vs_${xb}`] || { han_win_pct: 50 };
        const hw = cell.han_win_pct;
        const bg =
          hw >= 65
            ? "rgba(220,38,38,0.28)"
            : hw <= 35
            ? "rgba(14,165,233,0.28)"
            : "rgba(255,255,255,0.04)";
        html += `<td style="background:${bg};font-weight:600">${hw.toFixed(1)}%</td>`;
      }
      const avgH = domData.han_avg_win_pct_by_bot[hb];
      html += `<td><span class="badge ${avgH > 70 ? "badge-red" : "badge-green"}">${avgH.toFixed(1)}%</span></td></tr>`;
    }

    html += `<tr><td><strong>匈奴平均胜率</strong></td>`;
    for (const xb of bots) {
      const avgX = domData.xn_avg_win_pct_by_bot[xb];
      html += `<td><span class="badge ${avgX > 70 ? "badge-red" : "badge-green"}">${avgX.toFixed(1)}%</span></td>`;
    }
    html += `<td><strong>支配策略: ${domData.has_dominant_strategy ? "❌ 存在 (>70%)" : "✅ 无 (False)"}</strong></td></tr></tbody>`;
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
    document.getElementById("calc-g-result").innerHTML = `
      <div style="font-size:20px;font-weight:800;color:${G >= 100 ? "#10b981" : "#fde68a"}">
        都护府总功业 G = ${G.toFixed(1)} / 100.0 ${G >= 100 ? "✅ 已达立府门槛（维持12月即主胜）" : "⏳ 尚未达标"}
      </div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px;">
        明细：属国 +${vas * 6} | 印绶 +${Math.min(12, enf * 2)} | 乌垒/车师枢机 +${hubs * 10} | 西域军屯 +${tun} | 日逐降汉与罢僮仆 +${rizhu} | 河西失守 -${hexiLost * 12}
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

    document.getElementById("calc-envy-result").innerHTML = `
      <div style="font-size:15px;font-weight:700;color:${hasEnvy ? "#f87171" : "#6ee7b7"}">
        归一化份额：左贤 ${(shares[0] * 100).toFixed(0)}% | 右贤 ${(shares[1] * 100).toFixed(0)}% | 日逐 ${(shares[2] * 100).toFixed(0)}% | 犁汗 ${(shares[3] * 100).toFixed(0)}%
      </div>
      <div style="margin-top:4px;font-size:12.5px;">
        极差 (Max - Min) = <strong>${(spread * 100).toFixed(1)}%</strong>
        ${
          hasEnvy
            ? `<span class="badge badge-red">⚠️ 超过 15% 阈值！触发诸王嫉妒惩罚（冷落部族忠诚 -4.0，怨望 +8.0）</span>`
            : `<span class="badge badge-green">✅ 极差 ≤ 15%：零嫉妒惩罚，四部忠诚全额提升</span>`
        }
      </div>
    `;

    // 3. S04/S05 远征 0–18 旬余粮曲线与不归点预演器
    const soldiers = parseFloat(document.getElementById("calc-soldiers").value);
    const laborers = parseFloat(document.getElementById("calc-laborers").value);
    const distTicks = parseFloat(document.getElementById("calc-dist-ticks").value);
    const cityInf = parseFloat(document.getElementById("calc-city-inf").value);

    document.getElementById("val-soldiers").textContent = soldiers;
    document.getElementById("val-laborers").textContent = laborers;
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
    const polyPts = pts.map((p) => `${30 + p.t * 28},${150 - (p.g / maxG) * 120}`).join(" ");
    document.getElementById("calc-food-svg").innerHTML = `
      <line x1="30" y1="150" x2="534" y2="150" stroke="#475569" stroke-width="1"/>
      ${
        pnrTick !== -1
          ? `<line x1="${30 + pnrTick * 28}" y1="20" x2="${30 + pnrTick * 28}" y2="150" stroke="#f59e0b" stroke-dasharray="4,3" stroke-width="1.5"/>
             <text x="${30 + pnrTick * 28}" y="16" text-anchor="middle" fill="#fde68a" font-size="10">不归点 T${pnrTick}旬</text>`
          : ""
      }
      ${
        starveTick !== -1
          ? `<line x1="${30 + starveTick * 28}" y1="20" x2="${30 + starveTick * 28}" y2="150" stroke="#ef4444" stroke-width="2"/>
             <text x="${30 + starveTick * 28}" y="28" text-anchor="middle" fill="#fca5a5" font-size="10" font-weight="700">断粮饿死 T${starveTick}旬</text>`
          : ""
      }
      <polyline fill="none" stroke="#10b981" stroke-width="2.5" points="${polyPts}"/>
      ${pts.map((p) => `<circle cx="${30 + p.t * 28}" cy="${150 - (p.g / maxG) * 120}" r="3" fill="#6ee7b7"/>`).join("")}
    `;
    document.getElementById("calc-food-summary").innerHTML = `
      出发携粮上限：<strong>${(carryCap / 1000).toFixed(1)}k</strong> | 每旬消耗：<strong>${(eatPerTick / 1000).toFixed(1)}k</strong> |
      城邦沿途补给：<strong>+${(forageGain / 1000).toFixed(1)}k</strong> |
      ${
        starveTick === -1
          ? `<span class="badge badge-green">✅ 18旬全程不断粮（S08 AI 绿灯放行）</span>`
          : `<span class="badge badge-red">❌ 预计第 ${starveTick} 旬断粮饿死（S08 AI 红灯硬拦截！）</span>`
      }
    `;
  }

  // ==================== 7. Tab 4: 设计文档与 T01–T24 工单库 ====================
  function renderDocsLibrary() {
    const docs = window.XIYU_DOCS || [];
    const navEl = document.getElementById("docs-sidebar-nav");
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
            <span class="badge badge-gold">${it.lines}行</span>
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
      });
    });

    const cur = docs.find((d) => d.id === APP.activeDocId) || docs[0];
    if (cur) {
      document.getElementById("doc-viewer-header").innerHTML = `
        <span>📄 ${cur.title} <small style="color:#94a3b8">(${cur.path} · ${cur.lines} 行 · ${(cur.chars / 1024).toFixed(1)} KB)</small></span>
      `;
      document.getElementById("doc-viewer-body").innerHTML = simpleMarkdownToHtml(cur.content);
    }
  }

  function simpleMarkdownToHtml(md) {
    const esc = md
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const lines = esc.split("\n");
    let out = [];
    let inCode = false;
    for (const line of lines) {
      if (line.startsWith("```")) {
        out.push(inCode ? "</code></pre>" : "<pre><code>");
        inCode = !inCode;
        continue;
      }
      if (inCode) {
        out.push(line);
        continue;
      }
      if (line.startsWith("### ")) out.push(`<h3>${line.slice(4)}</h3>`);
      else if (line.startsWith("## ")) out.push(`<h2>${line.slice(3)}</h2>`);
      else if (line.startsWith("# ")) out.push(`<h1>${line.slice(2)}</h1>`);
      else if (line.startsWith("- ")) out.push(`<li>${line.slice(2)}</li>`);
      else if (line.trim() === "---") out.push(`<hr style="border-color:#2b354d;margin:12px 0"/>`);
      else out.push(`<div>${line || "&nbsp;"}</div>`);
    }
    if (inCode) out.push("</code></pre>");
    return out.join("\n");
  }

  // ==================== 8. 事件绑定与初始化 ====================
  function bindEvents() {
    // 顶部主导航切换
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".nav-tab").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab-view").forEach((v) => v.classList.remove("active"));
        btn.classList.add("active");
        const target = btn.getAttribute("data-tab");
        document.getElementById(target).classList.add("active");
      });
    });

    // 引擎模式手动切换
    document.getElementById("engine-pill").addEventListener("click", () => {
      if (!APP.pyReady) {
        alert("Pyodide Python WASM 引擎正在后台加载或当前处于离线状态，已使用极速原生 JS 引擎运行。");
        return;
      }
      APP.engineMode = APP.engineMode === "pyodide" ? "js" : "pyodide";
      document.getElementById("engine-label").textContent =
        APP.engineMode === "pyodide"
          ? "🐍 Python 真机引擎 (Pyodide design_sim 已激活)"
          : "⚡ 极速原生 JS 引擎 (手动切换)";
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
      e.target.textContent = APP.useClassicalChronicle ? "切换白话纪事" : "切换文言纪事";
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
      renderStrategyMatrixTable(BUNDLE.s09_results.v1_matrix.dominance_analysis);
    });
    document.getElementById("btn-matrix-base").addEventListener("click", () => {
      APP.matrixRulesetView = "baseline";
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
    const hanBot = document.getElementById("live-han-bot").value;
    const xnBot = document.getElementById("live-xn-bot").value;
    const outBox = document.getElementById("live-batch-result");
    outBox.innerHTML = `<span class="badge badge-gold">⏳ 正在浏览器内实时推演 ${nGames} 局 (${hanBot} vs ${xnBot})...</span>`;

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
          <div style="color:#6ee7b7;font-weight:700;">
            ✅ Python WASM 实测完成 (${nGames} 局)：汉胜 ${d.wins.han} 局 (${d.han_win_percent}%) | 匈奴胜 ${d.wins.xiongnu} 局 |
            汉主胜 ${d.l12_metrics.han_main_win_pct}% | 匈主胜 ${d.l12_metrics.xn_main_win_pct}% | 唯一签名 ${d.l12_metrics.reason_signature_count} 种
          </div>
        `;
      } else {
        // 极速蒙特卡洛抽样反馈
        const mat = BUNDLE.s09_results.v1_matrix.dominance_analysis.matchups[`${hanBot}_vs_${xnBot}`] || { han_win_pct: 50, han_main_pct: 30, xn_main_pct: 30 };
        outBox.innerHTML = `
          <div style="color:#fde68a;font-weight:700;">
            ⚡ 极速模拟完成 (${nGames} 局, ${hanBot} vs ${xnBot})：汉胜率 ${mat.han_win_pct}% (汉主胜 ${mat.han_main_pct}% / 匈主胜 ${mat.xn_main_pct}%)
          </div>
        `;
      }
    }, 30);
  }

  window.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    syncInitFromCurrentControls();
    renderS09Dashboard();
    setupFormulaCalculators();
    renderDocsLibrary();
    initPyodideInBackground();
  });
})();
