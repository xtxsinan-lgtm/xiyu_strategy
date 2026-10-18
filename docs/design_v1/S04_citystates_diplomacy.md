# S04 西域城邦与外交系统设计规范（City-States, Diplomacy & Trade）

> **所有权声明**：本规范（S04）拥有西域 18 城邦与 5 大国的外交关系状态（汉影响力、匈奴威吓、双边怨恨、汉军军威、政治倾向、王室派系、外交层级状态机）、城邦自主行为（请封、请属、禁商、逐使、叛离、两属）、汉方使团实体（精使/募使、预算分配、边际递减与贪墨）、罪状（Casus Belli）系统、讨伐战争与三种善后政策、南北丝路商道吞吐与楼兰禁商机制、五大国被动/事件规则，以及大军沿途供粮意愿中「城邦侧意愿与配额」公式。
> - 朝廷信任、诏令授权、矫诏判定与汉方岁入总账由 [S02_han_court.md](S02_han_court.md) 拥有；
> - 单于威望、僮仆都尉在位状态、匈奴征税命令与匈奴战术行动由 [S03_xiongnu_confederation.md](S03_xiongnu_confederation.md) 拥有；
> - 军队行军、粮道扣减、攻城结算、视野迷雾消费与「持节发诸国兵」的部队生成执行由 [S05_logistics_military_fog.md](S05_logistics_military_fog.md) 拥有。

---

## 1. 目的与支柱

### 1.1 服务的设计支柱
1. **万里粮道（支柱 1）**：外交不再是独立于军事之外的「送礼买分小游戏」，而是远征军生死攸关的**兵站前置锁**。李广利一征大宛「当道小国各坚城守，不肯给食，攻之不能下」，二征「兵多，所至小国莫不迎，出食给军」——城邦供粮意愿公式将**当地驻军威慑、汉影响力、匈奴威吓、未决罪状**与大军断粮風險直接咬合。
2. **将在外（支柱 2）**：废除旧版全图瞬间生效的按钮式 `gift`（200 钱买 8 点影响力），改为**在途使团实体（Mission）**。精使需具名历史人物随行，从敦煌经楼兰赴乌孙往返动辄百日（跨越 1–2 个季度）；募使虽免占具名人物槽，但素质低劣、沿途贪墨、极易激怒城邦导致被辱或被杀，反过来触发「杀汉使」合法讨伐罪状（Casus Belli）。
3. **帝国对联盟（支柱 3）**：汉与匈奴在西域争夺遵循截然不同的动力学——汉靠**使团预算、印绶册封、丝路通商与王室亲汉派**培植长期锚点，但面临距离衰减与边际递减；匈奴靠**骑兵驻防辐射、僮仆都尉赋税体制与破城立威**维持高压威吓，却会累积城邦对匈怨恨并诱发「两属」或「叛匈归汉」。
4. **人与史（支柱 4）**：楼兰首鼠两端「事两主」、车师五争、傅介子刺楼兰王立质子安归/尉屠耆、乌孙细君/解忧和亲、大宛匿汗血宝马杀使、轮台屠城震慑西域——全部由底层状态机与确定性公式自然涌现，而非死板脚本强推。

### 1.2 机制准入检验（圣经 L7：每个机制让哪个回合决策更难做）

| 机制编号与名称 | 影响的回合决策 | 为什么让决策更难做（两难张力） |
|---|---|---|
| **M1 使团实体与精使/募使双轨制**（`S04-R05`） | 汉方每季「派谁出使、走哪条道、拨多少预算」 | **精使**（如张骞、郑吉、傅介子）转化率 100%、低受辱率，但占用极稀缺的具名人物槽（全图仅 4–6 人），出使远国期间无法领兵或主持屯田；**募使**（郡县小吏/弛刑徒）不占人物槽、每年限招 3 批，但贪墨 30% 预算且在亲匈城邦有高概率被辱/被杀——你是在用募使低成本试探兼「碰瓷刷罪状」，还是派名臣稳扎稳打？ |
| **M2 影响力锚点衰减与边际递减**（`S04-R02` / `S04-R05`） | 汉方每季外交预算分配（集中砸一国 vs 分散铺开 vs 升级层级） | 旧版无限砸钱即可把全西域刷满 100；新版单国连续受赐触发**饱足度折损**（第 2/3/4 次仅 67%/50%/40%），且超过当前层级锚点（独立 10 / 册封 30 / 属国 45）的部分每月按 `2.5%` 衰减。不打通商路、不册封晋升层级，纯靠砸钱连 60 分属国线都摸不到。 |
| **M3 外交层级状态机与「两属」态**（`S04-R03` / `S04-R04`） | 汉匈双方对夹缝小国（楼兰、车师、龟兹）的容忍 vs 逼迫抉择 | 匈奴重税催生高怨恨时，匈奴属国会主动向汉请求**两属（Dual Allegiance）**——对汉开放粮市与丝路、提供情报视野，对匈纳税减半。汉方若满足于两属可省下讨伐兵力，但两属国不计入都护府硬控属国且战时随时倒戈；匈奴若强行下达「勒令专属」或洗劫，又可能直接把该国逼反倒向汉方。 |
| **M4 罪状（Casus Belli）与三种善后政策**（`S04-R06`） | 汉方何时对城邦开战、攻克后选「立新王 / 迫降 / 屠城」 | **无罪伐国**需矫诏、扣朝廷信任 12 点且令周边 2 跳城邦影响力暴跌 `-12`；**有罪讨伐**（杀使/劫商/叛盟）则免矫诏且得战功。破城时：**立新王**（需质子+300 钱）最为稳固且计入傀儡/属国；**迫降**省钱但保留亲匈暗流；**屠城**（如轮台）瞬间赋予周边 3 跳 `+25` 军威使沿途开门献粮，但本城荒废、全西域影响力 `-10`、宣帝朝更重扣信任 `-20`。 |
| **M5 丝路吞吐衰减与楼兰禁商滞回**（`S04-R07`） | 开局破局方向（先外交软化楼兰 vs 偏师奇袭楼兰 vs 绕道北伊吾） | 修复旧版「楼兰开局威吓 65 锁死全图商路归零」的死锁：外交禁商改为带滞回阈值的城邦行为，且禁商仅将下游商路吞吐打折至 `30%`（走私渗漏），唯有匈奴游骑驻军劫掠才会 `0%` 硬截断。汉方必须在「花钱安抚楼兰保商路 85%–100% 畅通」与「攒罪状一举拿捏楼兰咽喉」之间权衡。 |
| **M6 城邦供粮意愿分段函数**（`S04-R08`） | 远征出塞兵力规模编成与行军路线规划 | 兵少了（如贰师一征 6,000 骑对龟兹/姑墨），`兵力/当地防御力`比值不足，沿途城邦判定为 `CLOSED`（闭门拒守），大军未见敌面已饿毙过半；兵多了（如二征 30,000 兵），虽能震慑小国触发 `WELCOME`（迎军给食），但大军日耗粮翻 5 倍，小国存粮配额仅够喂饱大军 20%–40% 缺口，仍需后方屯田与粮道接力。 |

---

## 2. 玩家视角

### 2.1 玩家在何时、何处、做什么外交决策
在季度下令阶段（默认每季 1 次，9 旬/90 天），玩家通过以下三个界面层与本系统交互：
1. **大地图节点徽章与丝路流向线（常驻层）**：
   - 每个西域城邦节点旁显示：**外交层级角标**（独立/汉册封/汉属国/汉傀儡/匈奴属国/两属）、**倾向天平条**（`tilt` 从 `-100` 亲匈到 `+100` 亲汉）、**供粮姿态图标**（迎军给食🟢 / 高价开市🟡 / 闭门拒守🔴）、**动摇预警感叹号**（下季即将禁商/叛离）以及**罪状血印图标**（持有可讨伐罪状）。
   - 南北两道丝路以动态金色虚线绘制，线宽正比于当前区段吞吐率 `throughput`（`100%` 粗金线、`30%` 禁商暗细线、`0%` 兵燹红叉）。
2. **城邦外交详情抽屉（点击任意西域城邦/大国弹出）**：
   - 展示 `汉影响力 I` vs `匈奴威吓 X` 双柱对比、当前衰减锚点、王室派系占比（亲汉派/亲匈派/自保派）、对汉/对匈怨恨槽、有效罪状清单及剩余保质期。
   - 提供汉方操作按钮：**【派遣使团】**、**【颁赐印绶（册封）】**、**【纳为属国】**、**【宣示讨伐】**、**【籴买军粮】**、**【持节发兵】**；或匈奴方按钮：**【遣使威逼属国】**、**【勒令专属】**、**【强令禁商】**、**【加重僮仆赋税】**。
3. **季初文书案头（季初弹窗）**：
   - 集中呈递上一季末送达的**城邦主动请封/请属/请两属奏表**（限 2 季内批复）、**使团归朝/受辱/遇害急报**，以及攻克城邦后的**善后三选一竹简裁决**。

---

### 2.2 具体回合示例 A：破局通乌孙与车师「碰瓷」刷罪状（前 119 年春，T1→T2）

**【背景状态（前 119 年正月，T1 季初）】**
- 汉方国库可用资金：`4,500` 钱（初始 `3,000` + 首季拨款 `1,500`）。
- 具名汉使：**张骞**（位于敦煌 `dun_huang`，辞令 `eloquence = 92`，特性 `凿空者`：副使上限 +2）。
- 关键城邦初值：
  - **楼兰（`lou_lan`）**：`xn_tier = "vassal"`, `han_tier = "none"`, `I = 15`, `X = 55`, `xn_resentment = 15`, `han_resentment = 0`, `geo_bias = 0`, `pro_han = 20`, `pro_xn = 45`。因 `X = 55 < 60`（禁商触发线），楼兰开局**未禁商**，作为匈奴属国对过境汉商抽税（通过率 `t_out = 0.85`）。
  - **车师前（`cheshi_qian`）**：`xn_tier = "vassal"`, `han_tier = "none"`, `I = 5`, `X = 70`, `xn_resentment = 10`, `pro_han = 10`, `pro_xn = 60`, `trade_banned = true`（北道在此受阻，吞吐降至 `0.85 × 0.30 = 0.255`）。
  - **乌孙（`wusun`，大国 `m = 1.5`）**：`I = 15`, `X = 40`, `xn_resentment = 25`, `geo_bias = -10`。

**【T1 玩家下令】**
1. **指令 1（精使通乌孙）**：派正使 **张骞** 率**精使团（`elite`）**自敦煌出发，主目标 **乌孙（赤谷城 `chi_gu`）**，拨付总预算 `1,200` 钱（其中主使携 `800` 钱赴乌孙，设定抵达赤谷后分遣 2 支副使各携 `200` 钱赴大宛 `da_wan`、康居 `kang_ju`），另付精使团组建费 `150` 钱，合计扣款 `1,350` 钱。
2. **指令 2（募使试探楼兰与车师前）**：不派具名人物，花费组建费 `50` 钱 + 预算 `300` 钱（合计 `350` 钱，占用本年募使配额 `1/3`），派遣第 1 支**募使团（`recruited`）**自敦煌经楼兰（拨 `150` 钱）赴车师前（拨 `150` 钱）。

**【T1→T2 行军与结算数值推演】**
- **募使团第 49 天抵楼兰**（敦煌→玉门关 `4.0` 天 + 玉门关→楼兰 `44.37` 天 ≈ `48.4` 天，即 T1 第 5 旬末）：
  - 募使贪墨率 `30%`：楼兰分得名义预算 `150` 钱，实际有效预算 $B_{\text{eff}} = 150 \times (1 - 0.30) = 105$ 钱。
  - 楼兰受辱检定（依公式 `S04-R05`）：楼兰 $X - I = 55 - 15 = 40$，基础受辱率 $p_{\text{insult}} = \text{clamp}(0.08 + 0.005 \times 40 + 0.003 \times 0, 0.02, 0.75) = 0.28$。`GameState.rng` 掷出 `0.41 > 0.28`，**未受辱**。
  - 楼兰影响力增益：基础量 $\Delta I_0 = 20 \times (1 - e^{-105 / 600}) = 20 \times 0.1605 = 3.21$；募使品质系数 $q_{\text{rec}} = 0.65$；余量系数 $h = 1 - 15/120 = 0.875$；敌庭压制系数 $c = \text{clamp}(1 - (55 - 15)/120, 0.35, 1.0) = 0.667$；饱足系数 $s = 1.0$。最终 $\Delta I = 3.21 \times 0.65 \times 0.875 \times 0.667 = +1.22$，楼兰 `I` 升至 `16.2`。
- **募使团在楼兰休整 10 天后北上，第 111 天抵车师前**（楼兰→车师前沙漠道 `52.42` 天，跨入 **T2 第 3 旬**）：
  - 车师前有效预算 $B_{\text{eff}} = 105$ 钱，但车师前 `X = 70, I = 5`（$X - I = 65$）。
  - 受辱率 $p_{\text{insult}} = \text{clamp}(0.08 + 0.005 \times 65, 0.02, 0.75) = 0.405$（40.5%）。若触发受辱，进一步触发**杀使检定**：$p_{\text{kill}|\text{insult}} = \text{clamp}(0.05 + 0.004 \times (65 - 30), 0.0, 0.45) = 0.19$（19%）。
  - `GameState.rng` 先后掷中受辱与杀使！**车师前王庭纵兵劫杀汉募使，抢走全部礼金**。
  - **结算后果**：
    1. 车师前新增对汉罪状 `CrimeRecord(type="kill_envoy", weight=3, expires_season=T2+20)`，`crimes_against_han` 总权重 = `3`（$\ge 1$，激活合法讨伐权）；
    2. 汉方不掉具名人物，仅扣朝廷威严导致的微幅信任 `-2`（精使被杀则扣 `-6`），同时解锁对车师前的**免矫诏讨伐权**与攻克后 `+4.0` 战功奖励！
- **张骞精使团第 133 天抵乌孙赤谷城**（经楼兰、尉犁、乌垒、轮台、龟兹、姑墨、温宿翻山抵赤谷，共 `132.6` 天，于 **T2 第 5 旬**抵达）：
  - 精使无贪墨（$B_{\text{eff}} = 800$ 钱），张骞辞令 `92` 赋予品质系数 $q_{\text{elite}} = 1.0 + (92 - 70) \times 0.008 = 1.176$。
  - 基础增益 $\Delta I_0 = 20 \times (1 - e^{-800 / 600}) = 20 \times 0.7364 = 14.73$；余量系数 $h = 1 - 15/120 = 0.875$；敌庭压制 $c = \text{clamp}(1 - (40 - 15)/120, 0.35, 1.0) = 0.792$；大国修正 $\div 1.5$ 在册封/盟誓门槛体现，单次送礼对大国按 $1 / \sqrt{1.5} = 0.816$ 折算。
  - 乌孙一次性获得 $\Delta I = 14.73 \times 1.176 \times 0.875 \times 0.792 \times 0.816 = +9.80$ 点影响力（`I` 从 `15.0` 跃升至 `24.8`），并当场分遣副使前往大宛、康居！

---

### 2.3 具体回合示例 B：大军出塞供粮意愿与讨伐善后（贰师一征 vs 二征对照）

**【场景对照 1：小兵力孤军深入（复现前 104 年贰师一征「当道小国坚城守」）】**
- 汉将率 `6,000` 兵途经北道大邦 **龟兹（`qiu_ci`）**：
  - 龟兹人口 `pop = 81,000`（遊戲内缩放 `pop = 16,000`，城防 `defense = 2.2`），当地有效防卫力 $M_{\text{eff}} = 16,000 \times 0.12 \times (1 + 0.5 \times (2.2 - 1.0)) = 1,920 \times 1.6 = 3,072$。
  - 龟兹外交状态：独立（`han_tier = "none"`），`I = 18`, `X = 35`, `han_awe = 0`, `han_resentment = 5`, 无罪状。
  - 代入供粮意愿公式（`S04-R08`）：
    - 兵力威慑项 $W_{\text{force}} = \text{clamp}(30 \times \ln(1 + 6,000 / 3,072), 0, 60) = 30 \times \ln(2.953) = +32.49$；
    - 外交与威吓项 $0.45 \times I - 0.55 \times X + 0.40 \times A - 0.35 \times R_{\text{han}} = 8.10 - 19.25 + 0 - 1.75 = -12.90$；
    - 总意愿 $W_{\text{supply}} = 32.49 - 12.90 = \mathbf{19.59} < 20$（开市线）。
  - **结果**：龟兹判定为 **`CLOSED`（闭门拒守）**！汉军在龟兹境内 `0` 补给，若强行就食只能下令围攻龟兹（无罪攻城需矫诏且扣信任 `-12`）。

**【场景对照 2：重兵压境 + 轮台立威（复现前 102 年贰师二征「所至小国莫不迎」）】**
- 汉军集结 `18,000` 主力出塞，先攻破拒命小国 **轮台（`lun_tai`）** 并选择善后政策 **【屠城立威（`sack`）】**：
  - 轮台3跳内邻国（含龟兹、乌垒、尉犁、姑墨）瞬间获得汉军军威 `han_awe += 25`（但全西域 `han_influence -= 10`，朝廷信任 `-8`）。
  - 随后 `18,000` 汉军进抵 **龟兹（`qiu_ci`）**（此时龟兹 `I = 8`, `X = 35`, `han_awe = 25`, `han_resentment = 15`）：
    - 兵力威慑项 $W_{\text{force}} = 30 \times \ln(1 + 18,000 / 3,072) = 30 \times \ln(6.859) = +57.77$；
    - 外交与军威项 $0.45 \times 8 - 0.55 \times 35 + 0.40 \times 25 - 0.35 \times 15 = 3.60 - 19.25 + 10.00 - 5.25 = -10.90$；
    - 总意愿 $W_{\text{supply}} = 57.77 - 10.90 = \mathbf{46.87} \ge 45$（迎军线）！
  - **结果**：龟兹姿态跃升为 **`WELCOME`（迎军给食）**！龟兹每月从本地富余存粮中拨出 `30%`（上限 `4,500` 斛/月）按平价 `0.04` 钱/斛向汉军自动供粮，解救远征军于断粮边缘；但汉方也为屠轮台背负了全西域离心与朝廷弹劾的长期政治代价。

---

## 3. 状态变量

### 3.1 西域政权外交状态字典（`state.relations[state_id]`，共 23 国：18 城邦 + 5 大国）

> **向后兼容承诺**：完整保留现有代码与 S01/S02/S03/S05 直接读取的 `overlord`、`han_status`、`han_enfeoffed`、`hostage_sent_han`、`crimes_against_han` 字段，并由 S04 状态机自动维护其同步。

| 名称 | 所属对象 | 类型 | 取值范围 | 初值 | JSON 键（`scenario_*.json` / `balance.json`） | 存档字段 |
|---|---|---|---|---|---|---|
| 宗主国（兼容导出） | `relations[sid]` | `String` | `""` / `"han"` / `"xiongnu"` | 见表 4.1 | `relations.<sid>.overlord` | `relations[sid].overlord` |
| 汉方层级 | `relations[sid]` | `String` | `"none"` / `"enfeoffed"` / `"vassal"` / `"puppet"` | 见表 4.1 | `relations.<sid>.han_tier` | `relations[sid].han_tier` |
| 匈奴层级 | `relations[sid]` | `String` | `"none"` / `"vassal"` | 见表 4.1 | `relations.<sid>.xn_tier` | `relations[sid].xn_tier` |
| 是否两属状态 | `relations[sid]` | `bool` | `true` / `false` | `false` | `relations.<sid>.is_dual` | `relations[sid].is_dual` |
| 汉印绶册封标记（供 S01） | `relations[sid]` | `bool` | `true` / `false` | `false` | `relations.<sid>.han_enfeoffed` | `relations[sid].han_enfeoffed` |
| 遣质入汉标记（供 S01） | `relations[sid]` | `bool` | `true` / `false` | `false` | `relations.<sid>.hostage_sent_han` | `relations[sid].hostage_sent_han` |
| 汉影响力 $I$ | `relations[sid]` | `float` | `0.0–100.0` | 见表 4.1 | `relations.<sid>.han_influence` | `relations[sid].han_influence` |
| 匈奴威吓 $X$ | `relations[sid]` | `float` | `0.0–100.0` | 见表 4.1 | `relations.<sid>.xn_intimidation` | `relations[sid].xn_intimidation` |
| 对匈怨恨 $R_{\text{xn}}$ | `relations[sid]` | `float` | `0.0–100.0` | 见表 4.1 | `relations.<sid>.xn_resentment` | `relations[sid].xn_resentment` |
| 对汉怨恨 $R_{\text{han}}$ | `relations[sid]` | `float` | `0.0–100.0` | `0.0` | `relations.<sid>.han_resentment` | `relations[sid].han_resentment` |
| 汉军军威 $A_{\text{han}}$ | `relations[sid]` | `float` | `0.0–100.0` | `0.0` | `relations.<sid>.han_awe` | `relations[sid].han_awe` |
| 综合政治倾向 $\text{Tilt}$ | `relations[sid]` | `float` | `-100.0–+100.0` | 派生计算 | `diplomacy.tilt_*`（系数） | `relations[sid].tilt` |
| 王室亲汉派势力 | `relations[sid]` | `float` | `0.0–100.0` | 见表 4.1 | `relations.<sid>.pro_han` | `relations[sid].pro_han` |
| 王室亲匈派势力 | `relations[sid]` | `float` | `0.0–100.0` | 见表 4.1 | `relations.<sid>.pro_xn` | `relations[sid].pro_xn` |
| 地缘距离偏置 | `relations[sid]` | `float` | `-25.0–+15.0` | 见表 4.1 | `relations.<sid>.geo_bias` | `relations[sid].geo_bias` |
| 汉使馈赠饱足计数 | `relations[sid]` | `int` | `0–10` | `0` | `diplomacy.satiation_decay_per_season` | `relations[sid].satiation` |
| 禁绝汉商标记 | `relations[sid]` | `bool` | `true` / `false` | 见表 4.1 | `relations.<sid>.trade_banned` | `relations[sid].trade_banned` |
| 禁商最短维持季数 | `relations[sid]` | `int` | `0–8` | `0` | `trade.ban_min_seasons` | `relations[sid].ban_lock_seasons` |
| 动摇拟执行行为 | `relations[sid]` | `String` | `""` / `"ban_trade"` / `"defect_han"` / `"rebel_xn"` / `"rebel_han"` / `"renounce_han"` | `""` | —（运行时） | `relations[sid].wavering_action` |
| 层级变更冷却季数 | `relations[sid]` | `int` | `0–8` | `0` | `diplomacy.tier_lock_seasons` | `relations[sid].tier_lock_seasons` |
| 逐使冷却季数 | `relations[sid]` | `int` | `0–8` | `0` | `diplomacy.expel_cooldown_seasons` | `relations[sid].expel_cooldown_seasons` |
| 屠城记忆剩余季数 | `relations[sid]` | `int` | `0–12` | `0` | `punitive.sack_memory_seasons` | `relations[sid].sacked_memory_seasons` |
| 对汉罪状列表 | `relations[sid]` | `Array[CrimeRecord]` | `0–10` 条 | `[]` | `relations.<sid>.crimes_against_han` | `relations[sid].crimes_against_han` |
| 对匈罪状列表 | `relations[sid]` | `Array[CrimeRecord]` | `0–10` 条 | `[]` | `relations.<sid>.crimes_against_xn` | `relations[sid].crimes_against_xn` |
| 当前讨伐战状态 | `relations[sid]` | `Dictionary` | 空或 `PunitiveWar` | `{}` | —（运行时） | `relations[sid].punitive_war` |
| 对汉供粮姿态（缓存） | `relations[sid]` | `String` | `"WELCOME"` / `"MARKET"` / `"CLOSED"` | 派生计算 | `supply_will.*` | `relations[sid].supply_stance` |
| 月度可供粮配额（斛） | `relations[sid]` | `int` | `0–50000` | 派生计算 | `supply_will.quota_ratio_*` | `relations[sid].supply_quota_monthly` |
| 乌孙和亲生效标记 | `relations[sid]` | `bool` | `true` / `false` | `false` | `great_power.wusun_marriage_active` | `relations[sid].marriage_han` |
| 大宛岁献天马标记 | `relations[sid]` | `bool` | `true` / `false` | `false` | `great_power.dawan_horse_tribute` | `relations[sid].horse_tribute_han` |

---

### 3.2 罪状实体（`CrimeRecord`）与讨伐战实体（`PunitiveWar`）

| 名称 | 所属对象 | 类型 | 取值范围 | 初值 | JSON 键（`balance.json`） | 存档字段 |
|---|---|---|---|---|---|---|
| 罪状唯一 ID | `CrimeRecord` | `String` | `"crime_1"` 等 | — | — | `id` |
| 罪状类型 | `CrimeRecord` | `String` | `"kill_envoy"` / `"insult_envoy"` / `"rob_caravan"` / `"submit_enemy"` / `"betray_vassal"` / `"kill_han_king"` / `"aid_enemy_war"` / `"refuse_vassal_supply"` / `"refuse_heavenly_horses"` | — | `grievance.types.<type>` | `type` |
| 罪状权重 | `CrimeRecord` | `int` | `1–4` | 依类型 | `grievance.types.<type>.weight` | `weight` |
| 发生Tick | `CrimeRecord` | `int` | `>= 0` | 当前 `tick` | — | `created_tick` |
| 过期绝对季度 | `CrimeRecord` | `int` | `>= 1` | `cur_season + duration` | `grievance.types.<type>.duration_seasons` | `expires_season` |
| 叙事简述参数 | `CrimeRecord` | `Dictionary` | 含使臣名/金额等 | `{}` | — | `context` |
| 讨伐发起方 | `PunitiveWar` | `String` | `"han"` / `"xiongnu"` | — | — | `attacker` |
| 师出有名档位 | `PunitiveWar` | `String` | `"justified"` / `"enemy_vassal"` / `"unjustified"` | — | `punitive.justification_*` | `justification` |
| 授权来源 | `PunitiveWar` | `String` | `"edict"` / `"crime_exempt"` / `"forged_edict"` | — | — | `authority` |
| 预设善后政策 | `PunitiveWar` | `String` | `"install_king"` / `"force_submit"` / `"sack"` | `"force_submit"` | `punitive.default_policy` | `policy` |
| 开战/最近交战季 | `PunitiveWar` | `int` | `>= 1` | 当前季 | `punitive.inactive_expire_seasons` | `last_active_season` |

---

### 3.3 在途/驻留使团实体（`state.missions[mission_id]`）

| 名称 | 所属对象 | 类型 | 取值范围 | 初值 | JSON 键（`balance.json`） | 存档字段 |
|---|---|---|---|---|---|---|
| 使团 ID | `Mission` | `String` | `"mis_1"` 等 | — | — | `id` |
| 所属势力 | `Mission` | `String` | `"han"`（EA 仅汉） | `"han"` | — | `faction` |
| 使团级别 | `Mission` | `String` | `"elite"`（精使）/ `"recruited"`（募使）/ `"deputy"`（副使） | — | `embassy.kinds.<kind>` | `kind` |
| 领队人物 ID | `Mission` | `String` | 具名人物 ID 或 `""`（募使/副使） | `""` | — | `character_id` |
| 当前所在节点 | `Mission` | `String` | 42 节点 ID 之一 | `"dun_huang"` | — | `current_node` |
| 路径节点队列 | `Mission` | `Array[String]` | 节点序列 | `[]` | — | `route_nodes` |
| 当前路段已行天数 | `Mission` | `float` | `0.0–200.0` | `0.0` | `embassy.travel_speed_mult` | `edge_days_progress` |
| 目标城邦清单 | `Mission` | `Array[Dictionary]` | `[{state_id, budget, objective, visited}]` | — | — | `targets` |
| 剩余总预算 | `Mission` | `int` | `0–5000` | 下令拨款额 | `embassy.budget_min` / `budget_max` | `remaining_budget` |
| 使团状态 | `Mission` | `String` | `"outbound"` / `"at_court"` / `"resident"` / `"returning"` / `"completed"` / `"destroyed"` | `"outbound"` | — | `status` |
| 王庭驻留剩余天数 | `Mission` | `int` | `0–90` | `0` | `embassy.court_stay_days` | `stay_days_left` |
| 可分遣副使剩余数 | `Mission` | `int` | `0–3` | 依正使属性 | `embassy.base_deputy_slots` | `deputy_slots_left` |

---

### 3.4 城邦外交请愿实体（`state.diplomatic_requests`）与全局计数器

| 名称 | 所属对象 | 类型 | 取值范围 | 初值 | JSON 键（`balance.json`） | 存档字段 |
|---|---|---|---|---|---|---|
| 外交请愿队列 | `GameState` | `Array[Dictionary]` | `[{id, state_id, req_type, created_season, expires_season}]` | `[]` | `diplomacy.request_expire_seasons` | `diplomatic_requests` |
| 本年已派募使批数 | `GameState` | `int` | `0–3` | `0` | `embassy.recruited_yearly_cap` | `recruited_missions_this_year` |
| 下一个使团自增序号 | `GameState` | `int` | `>= 1` | `1` | — | `next_mission_seq` |
| 下一个罪状自增序号 | `GameState` | `int` | `>= 1` | `1` | — | `next_crime_seq` |

---
## 4. 规则与公式

### 4.1 `S04-R01`：西域 18 城邦 + 5 大国初值与剧本差量表

#### 4.1.1 主剧本《漠北之后》（前 119 年）23 国外交初值全表
- **门槛乘数 $m$**：18 个西域城邦（`kind == "citystate"`，计入都护府胜利 `counts_for_victory = true`）统一 $m = 1.0$；5 个大国（`kind == "great"`，`counts_for_victory = false`）统一 $m = 1.5$（JSON 键：`diplomacy.great_threshold_mult = 1.5`，可调范围 `1.2–2.0`）。
- **当地有效防卫力 $M_{\text{eff}}$**：
  $$M_{\text{eff}}(s) = \max\left(300,\ \text{pop}(s) \times r_{\text{militia}}(s) \times \bigl(1 + k_{\text{wall}} \cdot (\text{defense}(s) - 1.0)\bigr) + G_{\text{hostile}}(s)\right)$$
  其中城邦民兵率 $r_{\text{militia}} = 0.12$（`local_militia_ratio`），大国 $r_{\text{militia}} = 0.18$（`great_militia_ratio`），城防折算系数 $k_{\text{wall}} = 0.50$（`supply_will.wall_defense_mult`），$G_{\text{hostile}}(s)$ 为驻扎于该节点的敌方正规军兵力。
- **楼兰开局微调（修复商路死锁）**：将楼兰开局 `xn_intimidation` 从旧版 `65` 下调至 **`55`**（略低于禁商触发线 `60`），`han_influence` 设为 `15`，`xn_resentment` 设为 `15`，使汉方开局南道畅通（经楼兰抽税后 `85%` 吞吐），若匈奴派兵进驻车师或楼兰则立即推高 $X \ge 60$ 触发禁商。

| 政权 ID (`sid`) | 中文名 | 类别 | 都城节点 | 游戏内人口 `pop` | 城防 `defense` | 有效防卫力 $M_{\text{eff}}$ | 初始 `han_tier` | 初始 `xn_tier` | 导出 `overlord` | 初始 $I$ | 初始 $X$ | 初始 $R_{\text{xn}}$ | 初始 `pro_han` | 初始 `pro_xn` | 地缘偏置 `geo_bias` | 初始 `trade_banned` |
|---|---|---|---|---:|---:|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|
| `lou_lan` | 楼兰 | 城邦 | `lou_lan` | 3,500 | 1.3 | 483 | `"none"` | `"vassal"` | `"xiongnu"` | 15 | 55 | 15 | 20 | 45 | `0` | `false` |
| `cheshi_qian` | 车师前 | 城邦 | `cheshi_qian` | 4,000 | 1.5 | 600 | `"none"` | `"vassal"` | `"xiongnu"` | 5 | 70 | 10 | 10 | 60 | `-12` | `true` |
| `cheshi_hou` | 车师后 | 城邦 | `cheshi_hou` | 3,000 | 1.4 | 432 | `"none"` | `"vassal"` | `"xiongnu"` | 5 | 75 | 8 | 8 | 65 | `-15` | `true` |
| `dong_qiemi` | 东且弥 | 城邦 | `dong_qiemi` | 2,000 | 1.2 | 300 | `"none"` | `"vassal"` | `"xiongnu"` | 0 | 72 | 10 | 5 | 65 | `-15` | `true` |
| `yan_qi` | 焉耆 | 城邦 | `yan_qi` | 10,000 | 1.8 | 1,680 | `"none"` | `"vassal"` | `"xiongnu"` | 5 | 70 | 20 | 12 | 55 | `-10` | `true` |
| `wei_li` | 尉犁 | 城邦 | `wei_li` | 3,500 | 1.3 | 483 | `"none"` | `"vassal"` | `"xiongnu"` | 8 | 65 | 18 | 15 | 50 | `-8` | `true` |
| `wu_lei` | 乌垒 | 城邦 | `wu_lei` | 2,500 | 1.3 | 345 | `"none"` | `"none"` | `""` | 10 | 50 | 12 | 20 | 40 | `-5` | `false` |
| `lun_tai` | 轮台 | 城邦 | `lun_tai` | 2,800 | 1.4 | 403 | `"none"` | `"none"` | `""` | 8 | 48 | 10 | 15 | 42 | `-5` | `false` |
| `qiu_ci` | 龟兹 | 城邦 | `qiu_ci` | 16,000 | 2.2 | 3,072 | `"none"` | `"none"` | `""` | 10 | 45 | 10 | 20 | 38 | `-5` | `false` |
| `gu_mo` | 姑墨 | 城邦 | `gu_mo` | 8,000 | 1.6 | 1,248 | `"none"` | `"none"` | `""` | 8 | 35 | 5 | 18 | 32 | `-3` | `false` |
| `wen_su` | 温宿 | 城邦 | `wen_su` | 5,000 | 1.5 | 750 | `"none"` | `"none"` | `""` | 8 | 35 | 5 | 18 | 32 | `-4` | `false` |
| `shu_le` | 疏勒 | 城邦 | `shu_le` | 7,000 | 1.7 | 1,134 | `"none"` | `"none"` | `""` | 12 | 20 | 0 | 25 | 20 | `+2` | `false` |
| `juan_du` | 捐毒 | 城邦 | `juan_du` | 2,000 | 1.3 | 300 | `"none"` | `"none"` | `""` | 10 | 15 | 0 | 22 | 18 | `+2` | `false` |
| `xiu_xun` | 休循 | 城邦 | `xiu_xun` | 2,000 | 1.3 | 300 | `"none"` | `"none"` | `""` | 10 | 15 | 0 | 22 | 18 | `+2` | `false` |
| `qie_mo` | 且末 | 城邦 | `qie_mo` | 2,500 | 1.2 | 330 | `"none"` | `"none"` | `""` | 15 | 25 | 5 | 28 | 22 | `+5` | `false` |
| `jing_jue` | 精绝 | 城邦 | `jing_jue` | 3,000 | 1.2 | 396 | `"none"` | `"none"` | `""` | 15 | 20 | 0 | 28 | 20 | `+5` | `false` |
| `yu_tian` | 于阗 | 城邦 | `yu_tian` | 11,000 | 1.8 | 1,848 | `"none"` | `"none"` | `""` | 15 | 15 | 0 | 30 | 18 | `+6` | `false` |
| `sha_che` | 莎车 | 城邦 | `sha_che` | 9,000 | 1.7 | 1,458 | `"none"` | `"none"` | `""` | 12 | 18 | 0 | 25 | 20 | `+4` | `false` |
| `wusun` | 乌孙 | 大国 | `chi_gu` | 35,000 | 2.0 | 9,450 | `"none"` | `"none"` | `""` | 15 | 40 | 25 | 25 | 35 | `-8` | `false` |
| `dawan` | 大宛 | 大国 | `da_wan` | 30,000 | 2.5 | 9,450 | `"none"` | `"none"` | `""` | 10 | 20 | 0 | 20 | 20 | `0` | `false` |
| `kangju` | 康居 | 大国 | `kang_ju` | 28,000 | 1.8 | 7,056 | `"none"` | `"none"` | `""` | 5 | 35 | 0 | 15 | 40 | `-10` | `false` |
| `dayuezhi` | 大月氏 | 大国 | `da_yuezhi` | 32,000 | 2.0 | 8,640 | `"none"` | `"none"` | `""` | 15 | 15 | 30 | 30 | 10 | `+5` | `false` |
| `jibin` | 罽宾 | 大国 | `ji_bin` | 25,000 | 2.2 | 7,200 | `"none"` | `"none"` | `""` | 5 | 5 | 0 | 10 | 10 | `0` | `false` |

#### 4.1.2 剧本①《楼兰姑师》（前 108 年）与剧本③《都护府》（前 68 年）差量覆盖
- **剧本①《楼兰姑师》（前 108 年）**：
  - `lou_lan`：开局 `I = 10, X = 68, trade_banned = true`，且预设携带 2 条对汉罪状 `CrimeRecord("kill_envoy", weight=3)` 与 `CrimeRecord("rob_caravan", weight=2)`（总罪状权重 `5`），汉方开局即可免矫诏直接发兵讨伐楼兰。
  - `cheshi_qian`（姑师）：开局 `I = 5, X = 75, trade_banned = true`，同样携带 `CrimeRecord("kill_envoy", weight=3)`。
  - `qie_mo`, `jing_jue`, `yu_tian`：开局已获汉印绶册封（`han_tier = "enfeoffed"`, `han_enfeoffed = true`, `I = 38`）。
- **剧本③《都护府》（前 68 年）**：
  - `lou_lan`（显示名「鄯善（楼兰）」）：已由傅介子刺王更立亲汉王尉屠耆，`han_tier = "puppet"`, `overlord = "han"`, `han_enfeoffed = true`, `hostage_sent_han = true`, `I = 75, X = 15, pro_han = 70`。
  - 南道诸国（`qie_mo`, `jing_jue`, `yu_tian`, `sha_che`, `shu_le`）及北道中段（`wu_lei`, `lun_tai`, `qiu_ci`）：开局 `han_tier = "vassal"` 或 `"enfeoffed"`，`I` 在 `50–68` 之间；`wusun` 已激活解忧公主和亲（`marriage_han = true, han_tier = "enfeoffed", I = 65`）。
  - 争夺焦点集中在 `cheshi_qian`, `cheshi_hou`, `yan_qi`, `wei_li`（日逐王与僮仆都尉最后控制的北道四国，`X = 65–75, R_xn = 45–55`）。

---

### 4.2 `S04-R02`：结算时序与每旬/每月/每季更新公式

#### 4.2.1 结算钩子与执行先后顺序
1. **每旬末（`TurnResolver.run_tick`，每 10 天）**：
   - `Diplomacy.tick_missions(state, 10.0)`：推进所有在途使团 `Mission` 沿边移动、判定匈奴野战军截获、执行抵达王庭宣谕与副使分遣、递减王庭驻留天数。
2. **每月月末（`TurnResolver.month_end`，每 3 旬，排在 `Economy.monthly` 与 `Siege.monthly` 之后、`Victory.monthly` 之前）**：
   - **Step M1**：计算匈奴驻军威吓辐射与汉军驻防军威辐射（见 `4.2.2`）；
   - **Step M2**：执行匈奴僮仆都尉月度赋税与怨恨累积（调用 S03 接口，见 `S04-R10`），以及汉军长期驻防怨恨累积；
   - **Step M3**：执行汉影响力 $I$ 的**层级锚点衰减**、匈奴威吓 $X$ 衰减、双边怨恨 $R_{\text{xn}} / R_{\text{han}}$ 衰减、汉军军威 $A_{\text{han}}$ 衰减；
   - **Step M4**：执行 `Trade.monthly(state)`（计算南北道吞吐率、汉方商路岁入、沿途城邦通商影响力增益，以及禁商城邦的劫商罪状检定，见 `S04-R07`）；
   - **Step M5**：执行常驻使团（`status == "resident"`）月度经费消耗与微幅影响力注入，随后调用 `Buffs.tick(state)`（含 `han_enfeoffed` 每月 `+0.5` 影响力）；
   - **Step M6**：重算全部 23 国的综合政治倾向 $\text{Tilt}$ 与对汉/对匈供粮意愿缓存（`supply_stance`, `supply_quota_monthly`）。
3. **每季季末（当 `Cal.is_season_end(state.tick)` 即第 3/6/9/12 月末，紧接 Step M6 之后）**：
   - **Step S1**：使团馈赠饱足计数衰减：`satiation = max(0, satiation - 1)`；
   - **Step S2**：王室派系（`pro_han`, `pro_xn`）季节漂移与归一化；
   - **Step S3**：清理已到期的罪状（`expires_season <= cur_season`）、已过期的外交请愿（`expires_season <= cur_season`）及满 4 季无交战的讨伐战状态；
   - **Step S4**：按确定性优先级评估 23 国的**城邦自主行为**（见 `S04-R04`：先结算上一季已挂起 `wavering_action` 的动作，再评估新一季的动摇/请封/逐使/禁商）；
   - **Step S5**：递减冷却计数器（`tier_lock_seasons`, `ban_lock_seasons`, `expel_cooldown_seasons`, `sacked_memory_seasons` 各 `-1`，下限 `0`）；若为每年第 4 季末（12 月末），重置 `state.recruited_missions_this_year = 0`。

#### 4.2.2 每月核心数值更新公式

1. **汉影响力 $I$ 的层级锚点衰减（防无限刷分）**：
   每个政权 $s$ 根据其当前外交层级拥有一个**自然均衡锚点 $I_{\text{anchor}}(s)$**（JSON 键：`diplomacy.anchor_*`）：
   $$I_{\text{anchor}}(s) = \begin{cases} 10.0, & \text{if } \text{han\_tier} == \text{"none"} \\ 25.0, & \text{if } \text{is\_dual} == \text{true} \\ 30.0, & \text{if } \text{han\_tier} == \text{"enfeoffed"} \\ 45.0, & \text{if } \text{han\_tier} == \text{"vassal"} \\ 60.0, & \text{if } \text{han\_tier} == \text{"puppet"} \end{cases}$$
   每月当 $I > I_{\text{anchor}}(s)$ 时，超出部分按月衰减率 $k_{\text{decay}} = 0.025$（可调范围 `0.015–0.050`，键 `diplomacy.influence_decay_rate`）回落；同时若已册封（`han_enfeoffed == true`），每月获固定印绶维系增益 $+0.50$（键 `diplomacy.enfeoff_monthly_gain`，替代旧版过高的 `+1.0/月`）：
   $$\Delta I_{\text{decay}}(s) = -\max\bigl(0.0,\ (I - I_{\text{anchor}}(s)) \times 0.025\bigr) + \mathbb{I}(\text{han\_enfeoffed}) \times 0.50$$

2. **匈奴威吓 $X$ 的驻军辐射与衰减**：
   - **驻军威吓辐射**：设匈奴在政权 $s$ 都城节点 0 跳（同格）与 1 跳（相邻节点）的军队总兵力为 $T_{\text{xn},0}$ 与 $T_{\text{xn},1}$，有效驻军比 $r_{\text{xn}} = (T_{\text{xn},0} + 0.4 \cdot T_{\text{xn},1}) / \max(500, \text{pop}(s))$。当 $r_{\text{xn}} > 0$ 时，每月产生威吓增量：
     $$\Delta X_{\text{presence}}(s) = \text{clamp}\bigl(25.0 \times r_{\text{xn}},\ 0.0,\ 12.0\bigr)$$
   - **月度自然衰减与僮仆都尉保底**：无匈奴驻军（$r_{\text{xn}} == 0$）时，$X$ 每月固定衰减 $d_X = 2.0$（键 `diplomacy.intimidation_decay_month`，可调 `1.0–4.0`）。但若该国为匈奴属国（`xn_tier == "vassal"`）且 S03 的**僮仆都尉在位（`state.tribes.tongpu_active == true`）**，则 $X$ 的衰减下限锁死在保底值 $X_{\text{floor}} = 30.0$（键 `diplomacy.tongpu_intimidation_floor`）：
     $$X_{t+1} = \begin{cases} \max(30.0,\ X_t - 2.0), & \text{if } r_{\text{xn}} == 0 \land \text{xn\_tier} == \text{"vassal"} \land \text{tongpu\_active} \\ \max(0.0,\ X_t - 2.0), & \text{if } r_{\text{xn}} == 0 \land \text{otherwise} \end{cases}$$

3. **汉军军威 $A_{\text{han}}$ 与双边怨恨 $R_{\text{han}}, R_{\text{xn}}$ 更新**：
   - **汉军军威 $A_{\text{han}}$**：当汉军驻扎于政权 $s$ 都城（0 跳兵力 $T_{\text{han},0}$）且非本国战斗状态时，每月获驻军军威 $\Delta A_{\text{presence}} = \text{clamp}(15.0 \times T_{\text{han},0} / \max(500, \text{pop}(s)),\ 0.0,\ 6.0)$；无汉军同格驻扎时，每月衰减 $d_A = 4.0$（键 `diplomacy.han_awe_decay_month`）。野战大捷（2 跳内歼敌 $\ge 1,500$）一次性 $+12$，攻占邻邦一次性 $+10$，屠城（3 跳内）一次性 $+25$。
   - **对汉怨恨 $R_{\text{han}}$**：
     - 汉军超额驻防扰民：若汉军在非汉直辖城邦同格驻军 $T_{\text{han},0} > 0.30 \times \text{pop}(s)$，每月 $R_{\text{han}} += \text{clamp}(4.0 \times (T_{\text{han},0}/\text{pop}(s) - 0.30), 0.5, 4.0)$；
     - 汉使过境供亿之劳：每有一支汉使团（精使或募使）途经或抵达非汉直辖城邦，当旬 $R_{\text{han}} += 1.0$（键 `diplomacy.envoy_transit_resentment`）；
     - 强征军粮/白条欠款（见 `S04-R08`）与持节发兵（每次 $+8.0$）；
     - 自然衰减：每月固定 $R_{\text{han}} = \max(0.0, R_{\text{han}} - 1.5)$（键 `diplomacy.han_resentment_decay_month`）。
   - **对匈怨恨 $R_{\text{xn}}$**：由匈奴征税（每次 $+3.0$ 至 $+6.0$，两属减半）、强征附庸骑兵（$+15.0$）、洗劫（$+35.0$）累积；每月自然衰减 $R_{\text{xn}} = \max(0.0, R_{\text{xn}} - 1.5)$（键 `diplomacy.xn_resentment_decay_month`）。

4. **王室派系（`pro_han`, `pro_xn`）每季漂移公式**：
   每季季末（Step S2），各政权王室内部亲汉派与亲匈派按当前外交格局缓慢消长（键 `diplomacy.faction_drift_*`）：
   $$\Delta \text{pro\_han} = 1.5 \cdot \mathbb{I}(\text{han\_tier} \neq \text{"none"}) + 0.04 \cdot (I - 30) - 0.06 \cdot R_{\text{han}}$$
   $$\Delta \text{pro\_xn} = 1.5 \cdot \mathbb{I}(\text{xn\_tier} == \text{"vassal"}) + 0.04 \cdot (X - 30) - 0.06 \cdot R_{\text{xn}}$$
   更新后钳制在 $[0, 95]$，若 $\text{pro\_han} + \text{pro\_xn} > 95$，则按比例缩放使二者之和等于 $95$（剩余 $\ge 5\%$ 为王室自保骑墙派）。

5. **综合政治倾向 $\text{Tilt}(s) \in [-100, +100]$（正值亲汉，负值亲匈）**：
   $$\text{Tilt}(s) = \text{clamp}\Bigl(1.0 \cdot (I - X) + 0.45 \cdot (R_{\text{xn}} - R_{\text{han}}) + 0.35 \cdot A_{\text{han}} + 0.30 \cdot (\text{pro\_han} - \text{pro\_xn}) + \text{geo\_bias}(s) - 5.0 \cdot W_{\text{crime,han}}(s),\ -100.0,\ +100.0\Bigr)$$
   其中 $W_{\text{crime,han}}(s) = \min(3, \sum c.\text{weight})$：背负对汉罪状的城邦因畏惧汉廷秋后算账，政治上反而心虚倒向匈奴（每点罪状权重令 $\text{Tilt} - 5.0$，最多 $-15.0$）。

---

### 4.3 `S04-R03`：外交层级状态机、滞回阈值与「两属」规则

#### 4.3.1 外交层级合法组合与向后兼容映射表
每个政权的状态由 `(han_tier, xn_tier, is_dual)` 唯一确定，禁止出现「既为汉属国又为匈奴属国」的非法态。每次层级变更时，立即同步刷新 `overlord` 与 `han_enfeoffed`：

| 状态代号 | `han_tier` | `xn_tier` | `is_dual` | 同步 `overlord` | 同步 `han_enfeoffed` | 适用对象 | 核心权益摘要 |
|---|---|---|---|---|---|---|---|
| **S0 独立国** | `"none"` | `"none"` | `false` | `""` | `false` | 城邦 / 大国 | 无宗主，商路正常通行（100%），供粮按意愿检定 |
| **S1 汉册封/通好** | `"enfeoffed"` | `"none"` | `false` | `""` | `true` | 城邦 / 大国 | 锚点升至 30，每月 $I+0.5$，供粮意愿 $+15$，大国最高至此档 |
| **S2 汉属国** | `"vassal"` | `"none"` | `false` | `"han"` | `true` | 仅 18 城邦 | 计入汉控制数，锚点 45，开放驻军/屯田/平价买粮/持节发兵 |
| **S3 汉傀儡王庭** | `"puppet"` | `"none"` | `false` | `"han"` | `true` | 仅 18 城邦 | 同汉属国，且锚点 60、王室 `pro_han >= 65`、4 季内免疫叛乱 |
| **S4 匈奴属国** | `"none"` | `"vassal"` | `false` | `"xiongnu"` | `false` | 仅 18 城邦 | 计入匈奴控制数，向匈奴纳岁币/供粮/出附庸骑兵，商路抽税（85%）或禁商（30%） |
| **S5 两属（事两主）** | `"enfeoffed"` | `"vassal"` | `true` | `"xiongnu"` | `true` | 仅 18 城邦 | **两边不得罪**：保留匈奴 `overlord`（计入匈奴控制数但岁币与征税怨恨减半），同时持汉印绶（计入 S01 `han_enfeoffed` 功业 +2）、**强制解除禁商**（商路 100% 畅通）、对汉供粮意愿 $+10$、向汉提供 1 跳视野，但汉军不可常驻屯田 |

#### 4.3.2 状态机完整迁移表（`T1`–`T14`，含滞回缓冲与 2 季防抖锁）
> **滞回与防抖原则**：凡使某方**晋升**层级的条件，其阈值必须比**跌落/剥夺**该层级的阈值高出至少 `15–20` 点（滞回带 Hysteresis）；且任何非军事攻占触发的层级跃迁生效后，置 `tier_lock_seasons = 2`（2 个季度内锁定，免疫城邦自主摇摆，防止每回合乒乓翻转）。

| 迁移 ID | 起始态 → 目标态 | 触发方式（命令或季末自主行为） | 数值前置条件（大国乘 $m=1.5$） | 资源消耗与即时效果 |
|---|---|---|---|---|
| **T1** | S0 独立 → S1 汉册封 | 汉命令 `grant_enfeoffment` 或批复城邦 `req_enfeoff` | $I \ge 30 m \land \text{Tilt} \ge 0$，且目标节点有汉使团在庭（`at_court`/`resident`）或同格有汉军 | 耗 `200` 钱；置 `han_tier="enfeoffed"`, `han_enfeoffed=true`, `tier_lock=2` |
| **T2** | S4 匈属国 → S5 两属 | 汉命令 `grant_enfeoffment` 或批复城邦 `req_dual` | $I \ge 28 \land R_{\text{xn}} \ge 25 \land \text{Tilt} \ge -15$，且有汉使团在庭 | 耗 `200` 钱；置 `han_tier="enfeoffed"`, `is_dual=true`, `trade_banned=false`, `tier_lock=2`；通知匈奴（单于威望 `-2`） |
| **T3** | S1 汉册封 / S5 两属 → S2 汉属国 | 汉命令 `incorporate_vassal` 或批复城邦 `req_vassal` | 仅限城邦；$I \ge 60 \land I - X \ge 15 \land \text{Tilt} \ge +20$，且有精使团或同格汉军 $\ge M_{\text{eff}}$ | 耗 `300` 钱；置 `han_tier="vassal"`, `xn_tier="none"`, `is_dual=false`, `overlord="han"`, `hostage_sent_han=true`；若原为 S5 则匈奴威望 `-4` 且获 `betray_vassal` 对匈罪状 |
| **T4** | S0 独立 → S4 匈属国 | 匈奴命令 `demand_vassal` | 仅限城邦；$X \ge 55 \land X - I \ge 15 \land \text{Tilt} \le -15$ | 耗匈奴行动/使者；置 `xn_tier="vassal"`, `overlord="xiongnu"`, `tier_lock=2` |
| **T5** | S1 汉册封 → S5 两属 | 匈奴命令 `demand_vassal`（当 $I \ge 40$ 时） | 仅限城邦；$X \ge 60 \land X - I \ge 10$ 且 $I \ge 40$ | 城邦不忍弃汉印，转为 `is_dual=true`, `xn_tier="vassal"`, `overlord="xiongnu"` |
| **T6** | S1 汉册封 → S4 匈属国 | 匈奴命令 `demand_vassal`（当 $I < 40$ 时） | 仅限城邦；$X \ge 60 \land X - I \ge 15$ 且 $I < 40$ | 城邦缴还汉印：`han_tier="none"`, `han_enfeoffed=false`, `xn_tier="vassal"`；汉获罪状 `submit_enemy(weight=2)` |
| **T7** | S2 汉属国 → S4 匈属国 | 匈奴命令 `demand_vassal` 或城邦季末 `defect_xn` | 命令需：$X \ge I + 25$ 且 1 跳内有匈奴军；自主行为需：$X - I \ge 25 \land \text{Tilt} \le -25$ 持续 2 季 | `han_tier="none"`, `xn_tier="vassal"`, `overlord="xiongnu"`；汉获重罪 `betray_vassal(weight=3)`，朝廷信任 `-5` |
| **T8** | S5 两属 → S4 匈属国 | 匈奴命令 `demand_exclusive` 或季末自主弃汉 | 命令需：$X \ge I + 10$ 且 1 跳内有匈奴军（或耗 `150` 钱威逼）；自主需：$\text{Tilt} \le -30$ | `han_tier="none"`, `is_dual=false`, `han_enfeoffed=false`, $R_{\text{xn}} += 12$；汉获罪状 `submit_enemy(weight=1)` |
| **T9** | S4 匈属国 → S0 独立（或 S1） | 城邦季末自主行为 `rebel_xn` | $\bigl(X < 35 \land R_{\text{xn}} \ge 45\bigr) \lor \bigl(\text{Tilt} \ge +15 \land R_{\text{xn}} \ge 35\bigr)$ 经 1 季动摇预警 | `xn_tier="none"`, `overlord=""`（若原为 S5 两属则直转 S1 汉册封）；匈奴单于威望 `-4` 且获对匈罪状 |
| **T10** | S2 汉属国 → S0 独立 | 城邦季末自主行为 `rebel_han` | $R_{\text{han}} \ge 55 \land \text{Tilt} \le -15 \land A_{\text{han}} < 25$ 经 1 季动摇预警 | `han_tier="none"`, `overlord=""`, `han_enfeoffed=false`；汉获重罪 `betray_vassal(weight=3)`，朝廷信任 `-5` |
| **T11** | S1 汉册封 → S0 独立 | 城邦季末自主行为 `renounce_han` | $X - I \ge 30 \land \text{Tilt} \le -25$ 经 1 季动摇预警 | `han_tier="none"`, `han_enfeoffed=false`；汉获罪状 `insult_envoy(weight=1)` |
| **T12** | 任意态 → S3 汉傀儡 | 汉军攻占城邦并选善后 `install_king` | 城邦被汉军围攻陷落，且汉方支付 `300` 钱立新王 | `han_tier="puppet"`, `xn_tier="none"`, `overlord="han"`, `hostage_sent_han=true`, `I=max(I,65)`, `X=0`, `pro_han=max(pro_han,70)`, `tier_lock=4` |
| **T13** | 任意态 → S2 汉属国 | 汉军攻占城邦并选善后 `force_submit` | 城邦被汉军围攻陷落，选迫降留原王 | `han_tier="vassal"`, `xn_tier="none"`, `overlord="han"`, `hostage_sent_han=true`, `I=max(I,45)`, `X=max(0,X-40)`, `tier_lock=2` |
| **T14** | 任意态 → S0 独立（荒废） | 汉军攻占城邦并选善后 `sack`（屠城） | 城邦被汉军围攻陷落，选屠城立威 | `han_tier="none"`, `xn_tier="none"`, `overlord=""`, `R_han=100`, `pro_han=0`, `sacked_memory_seasons=8`（8 季内不可册封/纳属，但汉军可直接驻军建屯田） |

---

### 4.4 `S04-R04`：城邦自主行为与一季动摇预警（Season-End AI Behaviors）

每季季末（Step S4），对每个政权 $s$ 按以下**严格优先级顺序（B1 → B6）**检定自主行为。每个政权每季最多触发 **1 项**行为：

1. **一季动摇预警机制（Wavering Warning）**：
   - 对于会破坏现有条约或封锁商路的负面突发行为（`rebel_xn`, `rebel_han`, `defect_xn`, `renounce_han`, `ban_trade`），当某季末首次满足条件时，**不当场执行**，而是将 `relations[s].wavering_action` 置为对应行为名，并在季初文书案头向汉匈双方发出明确预警（如「微臣闻车师王庭动摇，恐下季叛汉归匈」）。
   - 下一季季末复检时，若 `wavering_action` 非空且条件**依然满足**，则正式执行该状态迁移并清空 `wavering_action = ""`；若玩家在该季内通过派驻大军、使团厚赐或减免赋税使条件不再满足，则自动平息动摇（`wavering_action = ""`）。
2. **行为优先级与触发条件清单**：
   - **B1 叛离/脱属（`rebel_xn` / `rebel_han` / `defect_xn` / `renounce_han`）**：若 `tier_lock_seasons == 0`，按表 `4.3.2` 中 `T7, T9, T10, T11` 条件检定（含 1 季动摇预警）。
   - **B2 外交禁商与解禁滞回（`ban_trade` / `unban_trade`，仅限 18 城邦）**：
     - **触发禁商**：当 `trade_banned == false` 且 `is_dual == false` 且 `xn_tier == "vassal"`，若满足：
       $$X \ge 60.0 \quad \land \quad \text{Tilt} \le -20.0$$
       首次满足进入 `wavering_action = "ban_trade"` 预警；次季仍满足则置 `trade_banned = true`、`ban_lock_seasons = 2`（至少维持 2 季）。
     - **自动解禁（滞回）**：当 `trade_banned == true` 且 `ban_lock_seasons == 0` 时，一旦满足以下任一条件，立即在季末自动解禁（`trade_banned = false`，无需预警）：
       $$X \le 48.0 \quad \lor \quad \text{Tilt} \ge -8.0 \quad \lor \quad \text{xn\_tier} \neq \text{"vassal"} \quad \lor \quad \text{is\_dual} == \text{true}$$
   - **B3 驱逐汉使（`expel_envoy`）**：
     - 若该国当前有汉方常驻使团（`resident`）或王庭宣谕使团（`at_court`），且 `expel_cooldown_seasons == 0`，当满足 $\text{Tilt} \le -35.0 \land X - I \ge 30.0$ 时，城邦当场驱逐汉使：使团强制转为 `"returning"` 返程，汉影响力 $I -= 5.0$，置 `expel_cooldown_seasons = 4`，并产生 1 条对汉罪状 `insult_envoy(weight=1, duration=8)`。
   - **B4 主动请为两属（`req_dual`）**：
     - 若 `xn_tier == "vassal"` 且 `han_tier == "none"` 且 `tier_lock_seasons == 0`，当 $R_{\text{xn}} \ge 30.0 \land I \ge 25.0 \land \text{Tilt} \ge -12.0$ 时，城邦主动向汉方呈递《请受汉印两属奏表》（有效期 2 季）。汉方玩家在季初花费 `150` 钱（比主动册封省 50 钱）即可无需使团在场直接批复生效（走迁移 `T2`）。
   - **B5 主动请封印绶（`req_enfeoff`）**：
     - 若 `han_tier == "none"` 且 `xn_tier == "none"` 且 `tier_lock_seasons == 0`，当 $I \ge 28.0 m \land \text{Tilt} \ge +8.0$ 时，城邦主动遣使入关请封（有效期 2 季），汉方花费 `150` 钱即可直接批复（走迁移 `T1`）。
   - **B6 主动请为属国（`req_vassal`，仅限 18 城邦）**：
     - 若 `han_tier == "enfeoffed"`（含两属）且 `tier_lock_seasons == 0`，当 $I \ge 58.0 \land I - X \ge 18.0 \land \text{Tilt} \ge +25.0$ 时，城邦主动遣质子请内属（有效期 2 季），汉方花费 `200` 钱即可直接批复（走迁移 `T3`）。

---

### 4.5 `S04-R05`：汉方精使/募使、使团预算制與边际递减曲线

#### 4.5.1 精使（`elite`）与募使（`recruited`）双轨规则（回应 `Q-S02-04`）
1. **精使团（`elite`）**：
   - **人物强制绑定**：必须指定 1 名当前位于河西/敦煌或西域节点、处于空闲状态的汉方**具名人物**（`character_id != ""`，如张骞、郑吉、傅介子、常惠、冯奉世等）担任正使随行。出使期间该人物位置随 `Mission.current_node` 同步移动，不可同时领兵或主持其他行动。
   - **组建成本与容量**：固定组建费 `150` 钱（键 `embassy.elite_setup_cost`）；单次可携带总预算 `200–3,000` 钱，最多指定 `3` 个主途目标国，且抵达主目标后可根据正使能力分遣 `1–3` 支副使（`deputy`）。
   - **贪墨率为 0%**：拨付预算 `100%` 转化为有效礼金；且受正使辞令属性 `eloquence` 加成，极难被城邦羞辱。
2. **募使团（`recruited`）**：
   - **免占具名人物槽**：由汉廷征募的郡国小吏、商贾或弛刑徒充任（`character_id == ""`），**不占用 4–6 人的具名历史人物池**，解决汉方多线外交人手枯竭问题。
   - **年度配额与成本**：全汉方每年最多派遣 **`3` 批**募使（`embassy.recruited_yearly_cap = 3`）；固定组建费 `50` 钱（`embassy.recruited_setup_cost`）；单次预算 `100–800` 钱，最多指定 `2` 个顺路目标国，不可分遣副使，不可执行大国盟誓/求马或驻庭。
   - **沿途贪墨与素质折损**（《史记·大宛列传》「汉使率皆贫人子，私县官赍物，欲贱市以私其利」）：募使固定贪墨 **`30%`** 预算（`embassy.recruited_embezzle_rate = 0.30`），且基础外交品质系数仅为 $q_{\text{rec}} = 0.65$，在敌意城邦极易因言辞鄙倍引发受辱或杀使事件。

#### 4.5.2 使团行军速度与中途截获
- **行军速度**：使团按图上边 `routes[idx].days` 逐旬推进，移动速度乘数 `embassy.travel_speed_mult = 1.0`（即 1 旬推进 10 天路程；冬季经过 `"mountain"` 地形路段时，若该山路在冬季封山则驻留等待开春，或耗时 `×1.5`）。
- **王庭宣谕驻留**：使团抵达目标城邦节点后，转入 `"at_court"` 状态驻留 `10` 天（1 旬，`embassy.court_stay_days = 10`），在抵达当旬立即结算宣谕收益与受辱检定；驻留期满后前往下一目标或转入 `"returning"` 按最短安全路径返回敦煌。
- **匈奴野战军途中截获**：当使团途经某节点时，若该节点同格存在**匈奴正规野战军**（非城邦本地民兵），当旬触发截获检定，截获概率为：
  $$p_{\text{intercept}} = \text{clamp}\bigl(0.30 + 0.05 \times \mathbb{I}(\text{kind} == \text{"recruited"}),\ 0.10,\ 0.60\bigr)$$
  若被截获：使团剩余预算被匈奴全额缴获（拨入 S03 匈奴赏赐池），募使直接殉职销毁（`status = "destroyed"`），精使正使则转入「被匈奴扣留（苏武模式，交由 S06 处理）」或逃归（50% 概率）。

#### 4.5.3 使团礼金转化影响力公式（含三重边际递减）
当使团抵达目标国 $s$ 并投入名义礼金预算 $B$（钱）时：
1. **有效预算 $B_{\text{eff}}$**：
   $$B_{\text{eff}} = \begin{cases} B, & \text{if kind} \in \{\text{"elite"}, \text{"deputy"}\} \\ B \times (1 - 0.30), & \text{if kind} == \text{"recruited"} \end{cases}$$
2. **单次预算饱和曲线（第一重递减：防单次巨款秒刷）**：
   $$\Delta I_0(B_{\text{eff}}) = \Delta I_{\max} \times \left(1 - e^{-B_{\text{eff}} / B_{\text{scale}}}\right)$$
   其中单次理论上限 $\Delta I_{\max} = 20.0$（键 `embassy.gift_max_gain`，可调 `12.0–30.0`），预算特征尺度 $B_{\text{scale}} = 600.0$（键 `embassy.gift_budget_scale`，可调 `400–1000`）。例如：$B_{\text{eff}} = 300 \Rightarrow \Delta I_0 = 7.87$；$B_{\text{eff}} = 600 \Rightarrow \Delta I_0 = 12.64$；$B_{\text{eff}} = 1200 \Rightarrow \Delta I_0 = 17.29$。
3. **四项环境与递减修正乘数**：
   - **使团品质系数 $q$**：募使 $q = 0.65$；副使 $q = 0.80$；精使正使 $q = \text{clamp}(1.0 + (\text{eloquence} - 70) \times 0.008,\ 0.85,\ 1.25)$。
   - **高位余量折损 $h(I)$（第二重递减：越接近 100 越难涨）**：
     $$h(I) = \text{clamp}\left(1.0 - \frac{I}{120.0},\ 0.15,\ 1.0\right)$$
   - **短期连续受赐饱足折损 $f_{\text{sat}}(k)$（第三重递减：防单季密集使团轰炸）**：设该国当前饱足计数为 $k = \text{satiation}(s)$（每次使团宣谕后 $k \leftarrow k + 1$，每季末 $k \leftarrow \max(0, k - 1)$）：
     $$f_{\text{sat}}(k) = \frac{1}{1 + 0.5 \cdot k} \quad \bigl(k=0,1,2,3 \implies 1.00,\ 0.67,\ 0.50,\ 0.40\bigr)$$
   - **敌庭威吓压制与大国规模系数 $c(s)$**：
     $$c(s) = \text{clamp}\left(1.0 - \frac{\max(0.0, X - I)}{120.0},\ 0.35,\ 1.0\right) \times m(s)^{-0.5} \times \bigl(1 - 0.5 \cdot \mathbb{I}(\text{sacked\_memory\_seasons} > 0)\bigr)$$
4. **最终影响力增量**：
   $$\Delta I_{\text{final}} = \Delta I_0(B_{\text{eff}}) \times q \times h(I) \times f_{\text{sat}}(k) \times c(s)$$

#### 4.5.4 使团受辱与被杀（生出讨伐罪状）检定公式
使团在非汉属国（`han_tier not in ["vassal", "puppet"]`）宣谕时，若该国存在匈奴威吓高于汉影响力（$X > I$）或对汉怨恨（$R_{\text{han}} > 0$），则进行受辱与杀使两段式检定：
1. **第一段：受辱概率 $p_{\text{insult}}$**：
   $$p_{\text{insult}} = \text{clamp}\Bigl(\bigl(0.08 + 0.005 \cdot \max(0, X - I) + 0.003 \cdot R_{\text{han}}\bigr) \times \mu_{\text{kind}},\ 0.01,\ 0.75\Bigr)$$
   其中使团级别修正：募使 $\mu_{\text{rec}} = 1.0$，副使 $\mu_{\text{dep}} = 0.60$，精使正使 $\mu_{\text{elite}} = 0.25$（具名正使持天子节杖，城邦不敢轻辱）。
   - **受辱后果**：本次影响力增量 $\Delta I_{\text{final}}$ 减半（$\times 0.5$），且立即继续进行第二段「杀使检定」。
2. **第二段：受辱后升级为杀使的条件概率 $p_{\text{kill}|\text{insult}}$**：
   $$p_{\text{kill}|\text{insult}} = \text{clamp}\Bigl(\bigl(0.05 + 0.004 \cdot \max(0, X - I - 25) + 0.08 \cdot \mathbb{I}(W_{\text{crime,han}} > 0)\bigr) \times \kappa_{\text{kind}} \times \kappa_{\text{state}},\ 0.0,\ 0.50\Bigr)$$
   其中募使 $\kappa_{\text{rec}} = 1.0$，副使 $\kappa_{\text{dep}} = 0.50$，精使 $\kappa_{\text{elite}} = 0.15$（若正使具 `勇决` 特性且尝试刺杀/胁迫失败则另走事件检定）；政权性格修正：罽宾（`jibin`，「数剽杀汉使」）$\kappa_{\text{state}} = 2.0$，其余国 $\kappa_{\text{state}} = 1.0$。
   - **若掷中杀使**：本次 $\Delta I_{\text{final}} = 0$，该国后继预算被劫掠一空，使团销毁（若是精使则具名正使阵亡，触发 S06 死节抚恤事件），该国新增最高等级对汉罪状 **`CrimeRecord(type="kill_envoy", weight=3, duration=20)`**，汉朝廷信任扣减（募使被杀 `-2`，精使被杀 `-6`）。
   - **若仅受辱未杀使**：使团保全性命继续行程，该国新增对汉罪状 **`CrimeRecord(type="insult_envoy", weight=1, duration=8)`**，汉朝廷信任 `-1`。

---
### 4.6 `S04-R06`：罪状（Casus Belli）系统、师出有名判定与三种讨伐善后

#### 4.6.1 罪状类型字典（`balance.json → grievance.types`）
每个城邦/大国可同时持有多个对汉罪状（`crimes_against_han`）与对匈罪状（`crimes_against_xn`）。同一类型的罪状在未过期前若再次触发，**刷新其 `expires_season` 至最新期限**（不重复叠加同类权重），不同类型罪状的权重累加，总有效罪状分定义为：
$$W_{\text{crime,han}}(s) = \min\left(6,\ \sum_{c \in \text{crimes\_against\_han}(s)} c.\text{weight}\right)$$
对外导出判定函数 `Diplomacy.has_valid_crime(state, state_id) -> bool`：当且仅当 $W_{\text{crime,han}}(s) \ge 1$ 时返回 `true`（供 S02 判定是否免除矫诏罪责，供 S01 判定攻克后是否授予「讨伐有罪之国」`+4.0` 战功）。

| 罪状类型 ID (`type`) | 中文名 | 适用持有方 | 权重 `weight` | 保质期 `duration_seasons` | 触发条件与来源 |
|---|---|---|---:|---:|---|
| `kill_envoy` | 攻杀汉使 | 汉 | `3` | `20` 季（5 年） | 使团受辱检定升级为杀使（`4.5.4`）、剧本预设（楼兰/姑师）、大宛杀害车令等事件 |
| `kill_han_king` | 擅杀亲汉王/质子 | 汉 | `4` | `24` 季（6 年） | 匈奴或亲匈派发动政变刺杀汉方所立之王或归国质子（如渠犁/搜粟都尉相关事件、莎车万年事件） |
| `betray_vassal` | 举国叛盟 | 汉 / 匈 | `3` | `16` 季（4 年） | 原属国（`vassal`）通过 `T7, T9, T10` 叛离原宗主 |
| `rob_caravan` | 遮杀商贾/劫掠贡道 | 汉 | `2` | `12` 季（3 年） | 实施外交禁商（`trade_banned == true`）的城邦每月按概率触发劫商检定（见 `4.7.2`） |
| `submit_enemy` | 弃印从胡 / 背盟两属 | 汉 / 匈 | `2` | `12` 季（3 年） | 汉册封国缴还汉印投降匈奴（`T6`），或两属国在匈奴威逼下弃汉（`T8`，权重 `1`） |
| `aid_enemy_war` | 助敌攻战/资敌军粮 | 汉 / 匈 | `2` | `12` 季（3 年） | 城邦向敌军提供附庸骑兵（`levy_allies`），或两属国在 1 跳内发生汉匈野战时（25% 概率被指责暗通敌军） |
| `refuse_vassal_supply` | 属国拒供王师 | 汉 / 匈 | `2` | `8` 季（2 年） | 已处于 `vassal` 层级的属国在本国存粮充裕时对宗主大军强行拒供（见 `4.8.3`） |
| `refuse_heavenly_horses` | 匿善马不与 | 汉 | `2` | `16` 季（4 年） | 汉精使携千金赴大宛执行 `seek_horses` 被拒（触发大宛天马事件链，见 `4.9.3`） |
| `insult_envoy` | 慢辱天使/驱逐使臣 | 汉 | `1` | `8` 季（2 年） | 使团宣谕受辱未死（`4.5.4`）、城邦主动驱逐汉使（`B3`）或背弃汉印（`T11`） |

#### 4.6.2 宣示讨伐（`declare_punitive`）的三档名义与政治代价
当汉军对非直辖城邦/大国发起围城（`Siege`）、劫掠（`pillage`）或显式下达 `declare_punitive` 命令时，系统自动开启 `relations[s].punitive_war` 记录，并按以下三档判定**师出有名档位（`justification`）**：

| 师出有名档位 | 判定条件 | 是否需诏令/矫诏（对接 S02） | 开战即时朝廷信任变化 | 周边 2 跳城邦即时冲击 |
|---|---|---|---|---|
| **第一档：有罪讨伐（`justified`）** | $W_{\text{crime,han}}(s) \ge 1$ 或持有朝廷针对该国的《讨伐诏令》 | **免矫诏**（合法便宜行事） | `0`（不扣信任） | 周边 2 跳城邦 $I - 2.0$, $A_{\text{han}} + 5.0$ |
| **第二档：征讨匈奴附庸（`enemy_vassal`）** | $W_{\text{crime,han}}(s) == 0$ 且 `xn_tier == "vassal"`（攻击敌方属国） | 若无诏令则视为**轻度擅兴**（需消耗持节便宜权或记 `0.5` 次矫诏） | 朝廷信任 `-4` | 周边 2 跳城邦 $I - 5.0$, $R_{\text{han}} + 5.0$, $A_{\text{han}} + 6.0$ |
| **第三档：无名兴师（`unjustified`）** | $W_{\text{crime,han}}(s) == 0$ 且 `xn_tier == "none"`（攻击无罪独立国/汉册封国） | **强制判定为矫诏（`forged_edict`）**！ | 朝廷信任 **`-12`** | 周边 2 跳城邦 $I - 12.0$, $R_{\text{han}} + 15.0$, 全西域 $\text{pro\_han} - 8.0$ |

> **交战期间状态**：一旦 `punitive_war` 开启，目标国对汉供粮姿态强制锁死为 `"CLOSED"`，$\text{Tilt}$ 额外 $-30.0$；若连续 `4` 个季度无汉军在该国都城 1 跳内交战或围城，则讨伐战自动烂尾终止（`punitive_war = {}`），汉朝廷信任 `-4`（「师老无功」）。

#### 4.6.3 攻克城邦后的三种善后政策（`install_king` / `force_submit` / `sack`）
当汉军围城攻克（`Siege` 陷落）或奇袭擒王成功时，清空该国全部 `crimes_against_han`，并根据玩家选定的善后政策执行以下效果（替代旧版单一自动归属）：

| 维度 | 政策 A：【更立亲汉新王（`install_king`）】<br>（典故：立尉屠耆王楼兰、立昧蔡王大宛） | 政策 B：【迫降留原王（`force_submit`）】<br>（典故：赵破奴虏楼兰王迫降） | 政策 C：【屠城立威（`sack`）】<br>（典故：李广利屠轮台） |
|---|---|---|---|
| **前置条件与金钱消耗** | 仅限 18 城邦；需耗国库 **`300` 钱**册立赏赐费 | 城邦或大国；耗 **`0` 钱** | 仅限 18 城邦；耗 **`0` 钱**，就地掠粮 |
| **本国层级变更** | 城邦转 **`S3 汉傀儡`（`han_tier="puppet"`, `overlord="han"`）**，锁 4 季 | 城邦转 **`S2 汉属国`（`han_tier="vassal"`, `overlord="han"`）**，锁 2 季；大国转 `S1 汉册封` | 转 **`S0 独立荒废`（`overlord=""`）**，挂 `sacked` 减产 Buff 12 个月，且 **8 季内不可册封/纳属**（但允许汉军直接驻防设屯田） |
| **本国数值重置** | $I = \max(I, 65)$, $X = 0$, $R_{\text{han}} = 10$, $\text{pro\_han} = \max(\text{pro\_han}, 70)$, $\text{pro\_xn} = 10$, `hostage_sent_han = true` | $I = \max(I, 45)$, $X = \max(0, X-40)$, $R_{\text{han}} += 15$, $\text{pro\_han} += 15$, `hostage_sent_han = true` | 人口 `pop ×= 0.55`，农田产出 `×0.5`（12个月），存粮 50% 被汉军直接缴获；$I = 0$, $R_{\text{han}} = 100$, $\text{pro\_han} = 0$, `sacked_memory_seasons = 8` |
| **周边邻国辐射效应** | 2 跳内邻国：$I += 8.0$, $A_{\text{han}} += 10.0$, $X -= 8.0$ | 2 跳内邻国：$I += 5.0$, $A_{\text{han}} += 12.0$, $X -= 5.0$ | **3 跳内邻国军威暴涨 $A_{\text{han}} += 25.0$**（令沿途小国因恐惧立刻开门迎军），但 **全西域 23 国 $I -= 10.0, R_{\text{han}} += 12.0$** |
| **汉廷信任与功业反馈** | 有罪讨伐：信任 `+5`，功业战功 `+4.0`；无罪：信任 `+0` | 有罪讨伐：信任 `+3`，功业战功 `+4.0`；无罪：信任 `-2` | 武帝朝（前 89 年轮台诏前）：信任 `-8`；轮台诏后或剧本③宣帝朝：信任 **`-20`**，且扣除都护府功业 `-5.0` |

---

### 4.7 `S04-R07`：丝路商道吞吐率、楼兰禁商滞回与劫商罪状

#### 4.7.1 南北丝路拓扑与逐节点吞吐率递推公式
保留现有 `scenario_mvp.json` 的两条丝路定义（均从敦煌 `dun_huang` 出发，咽喉首站均为 `lou_lan`）：
- **南道（`south_silk_road`）**：`lou_lan` → `qie_mo` → `jing_jue` → `yu_tian` → `sha_che` → `da_yuezhi`（6 个西域政权节点）。
- **北道（`north_silk_road`）**：`lou_lan` → `cheshi_qian` → `yan_qi` → `wei_li` → `wu_lei` → `lun_tai` → `qiu_ci` → `gu_mo` → `wen_su` → `shu_le` → `juan_du` → `xiu_xun` → `da_wan`（13 个西域政权节点）。

**【核心机制改动：用「吞吐衰减与走私渗漏」替代旧版「一国禁商整条路归零」】**
设商队进入某路线第 $k$ 个政权节点 $s_k$ 时的上游输入吞吐率为 $t_{\text{in}}(s_k) \in [0, 1]$（起点 $t_{\text{in}}(s_1) = 1.0$）。根据节点 $s_k$ 的当前状态，决定其**本节点贡献乘数 $\gamma(s_k)$** 与**向下游传递的穿透乘数 $\tau(s_k)$**：

| 节点 $s_k$ 当前状态（由高到低匹配） | 本节点贸易贡献乘数 $\gamma(s_k)$ | 下游穿透乘数 $\tau(s_k)$ | 历史与机制解释 |
|---|---:|---:|---|
| **C1 战火/匈奴正规军劫掠截断**：节点被匈奴直辖控制，或同格/相邻边存在执行 `raid_route` 的匈奴正规军，或正处于围城战中 | `0.00` | **`0.00`** | 匈奴铁骑当道遮断，商队寸步难行，下游彻底归零 |
| **C2 外交禁商（`trade_banned == true`）**：匈奴属国执行禁商令（无匈奴大军当道驻守） | `0.00` | **`0.30`** | 官道关闭，本城 `0` 收益；但胡商与汉贾改走大漠小径私通，**保留 `30%` 走私吞吐渗入下游**（键 `trade.ban_leak_throughput = 0.30`） |
| **C3 匈奴属国未禁商（`xn_tier == "vassal"` 且 `is_dual == false`）** | `0.50` | **`0.85`** | 城邦对过境汉商课以重税（通过率 `85%`，键 `trade.xn_vassal_pass_mult = 0.85`，本城贡献折半 `0.50`） |
| **C4 畅通节点（独立国 / 汉册封 / 汉属国 / 两属国 `is_dual == true`）** | `1.00`（大国终点且通好为 `1.50`） | **`1.00`** | 驿道畅通无阻，若为两属国则免除匈奴属国过境税 |

递推公式（当 $t_{\text{out}} < 0.05$ 时视为商路断绝，后续节点截断为 `0`）：
$$C(s_k) = b_{\text{node}} \times t_{\text{in}}(s_k) \times \gamma(s_k), \qquad t_{\text{out}}(s_k) = t_{\text{in}}(s_k) \times \tau(s_k)$$
- **防重复计费规则**：由于 `lou_lan` 同时出现在南北两道首站，每月结算时每个政权节点 $s$ 只取其在南北道中**较高的一条 $C(s)$** 计入汉方商路总收入（避免楼兰双倍计钱），但楼兰的 $\tau(\text{lou\_lan})$ 同时作用于南北两道的下游起点。
- **单节点基础月收益**：$b_{\text{node}} = 5.0$ 钱/月（键 `trade.base_money_per_state_month = 5.0`）；每当某节点实际贸易额 $C(s_k) \ge 2.0$ 钱/月时，该政权每月获得通商自然影响力增益：
  $$\Delta I_{\text{trade}}(s_k) = 0.60 \times \frac{C(s_k)}{b_{\text{node}}} \quad (\text{上限 } +0.60/\text{月，键 } \texttt{trade.influence\_per\_state\_month})$$

#### 4.7.2 前 119 年开局商路实算验证（对比旧版 0 钱死锁）
- **楼兰首站**：`xn_tier = "vassal"`, `trade_banned = false` $\implies t_{\text{in}} = 1.0, \gamma = 0.50, \tau = 0.85$。楼兰贡献 $5.0 \times 0.50 = 2.50$ 钱/月，下游输入吞吐 $t_{\text{out}} = 0.85$。
- **南道下游 5 国（且末、精绝、于阗、莎车、大月氏）**：全部处于 C4 畅通态（$\gamma = 1.0, \tau = 1.0$），每国月贡献 $5.0 \times 0.85 = 4.25$ 钱/月，5 国合计 $21.25$ 钱/月，且每国每月自然涨汉影响力 $+0.51$ 点！
- **北道下游**：经车师前（禁商 $\tau = 0.30 \implies t_{\text{out}} = 0.255$）与焉耆（禁商 $\tau = 0.30 \implies t_{\text{out}} = 0.0765$）双重封锁后，北道后段 9 个畅通城邦合计仅渗漏约 $5.0 \times 0.0765 \times 9 = 3.44$ 钱/月。
- **全图开局月总商路收入**：$2.50 + 21.25 + 3.44 = \mathbf{27.19}$ 钱/月（约 **`82` 钱/季**），彻底消除了旧版开局商路恒为 `0` 的死锁，同时清晰引导汉方玩家：「南道已通，北道被车师与焉耆卡死」！

#### 4.7.3 禁商城邦月度「遮杀汉商（`rob_caravan`）」罪状检定
凡处于 `trade_banned == true` 的城邦，只要上游输入吞吐 $t_{\text{in}}(s) \ge 0.20$（即仍有汉商尝试闯关走私），且该国过去 `4` 个季度内未触发过 `rob_caravan`，每月月末有概率发生纵兵劫掠商队事件：
$$p_{\text{rob}}(s) = \text{clamp}\bigl(0.04 + 0.002 \cdot (X - 50),\ 0.02,\ 0.15\bigr)$$
一旦掷中：汉方当月商路收入损失 `15` 钱，该城邦立刻生成 1 条对汉罪状 **`CrimeRecord(type="rob_caravan", weight=2, duration=12)`**，为汉方提供名正言顺的破交讨伐借口。

---

### 4.8 `S04-R08`：城邦供粮意愿（Supply Willingness）公式与 S05 接口

#### 4.8.1 汉军过境/驻扎时的城邦供粮意愿公式
当节点 $s$（非汉直辖郡县）同格或相邻边有汉军（合计兵力 $T_{\text{han}}$，若无汉军则按标准参考兵力 $T_{\text{ref}} = 3,000$ 预览）时，该城邦对汉军的**供粮意愿分 $W_{\text{supply}}(s, T_{\text{han}}) \in [-100, +100]$** 按以下公式实时计算（JSON 键前缀 `supply_will.*`）：

$$W_{\text{supply}}(s, T_{\text{han}}) = W_{\text{force}}(s, T_{\text{han}}) + W_{\text{diplo}}(s) + W_{\text{tier}}(s) - W_{\text{penalty}}(s)$$

各项定义与默认系数如下：
1. **大军兵威项 $W_{\text{force}}$（复现「兵多则小国迎，兵少则坚城守」）**：
   $$W_{\text{force}}(s, T_{\text{han}}) = \begin{cases} \text{clamp}\left(30.0 \times \ln\left(1.0 + \frac{T_{\text{han}}}{M_{\text{eff}}(s)}\right),\ 0.0,\ 60.0\right), & \text{if } T_{\text{han}} > 0 \\ 0.0, & \text{if } T_{\text{han}} == 0 \text{（纯文官籴粮）} \end{cases}$$
   其中系数 $a_{\text{force}} = 30.0$（键 `supply_will.force_log_coeff`，可调 `20.0–45.0`），上限 `60.0`（键 `supply_will.force_cap`）。
2. **影响力、威吓与军威项 $W_{\text{diplo}}$**：
   $$W_{\text{diplo}}(s) = 0.45 \cdot I(s) - 0.55 \cdot X(s) + 0.40 \cdot A_{\text{han}}(s) - 0.35 \cdot R_{\text{han}}(s)$$
3. **外交层级固定加值 $W_{\text{tier}}$**：
   $$W_{\text{tier}}(s) = \begin{cases} +35.0, & \text{if } \text{han\_tier} \in \{\text{"vassal"}, \text{"puppet"}\} \\ +15.0, & \text{if } \text{han\_tier} == \text{"enfeoffed"} \land \neg\text{is\_dual} \\ +10.0, & \text{if } \text{is\_dual} == \text{true} \\ -15.0, & \text{if } \text{xn\_tier} == \text{"vassal"} \land \neg\text{is\_dual} \\ 0.0, & \text{if } \text{independent} \end{cases}$$
4. **罪状心虚、匈奴驻军与本地缺粮惩罚项 $W_{\text{penalty}}$**：
   $$W_{\text{penalty}}(s) = \min\bigl(24.0,\ 8.0 \cdot W_{\text{crime,han}}(s)\bigr) + 30.0 \cdot \mathbb{I}(T_{\text{xn},0}(s) > 0) + 25.0 \cdot \mathbb{I}\bigl(\text{grain}(s) < \text{reserve}_{6\text{m}}(s)\bigr)$$
   其中 $\text{reserve}_{6\text{m}}(s)$ 为该城邦人口 6 个月的基本口粮安全线（见 `4.8.2`）。若正处于 `punitive_war` 交战中，则 $W_{\text{supply}}$ 强制锁死为 $-100.0$。

#### 4.8.2 三档供粮姿态、月度配额与粮价导出（供 S05 读取）
根据 $W_{\text{supply}}$ 划分为三档姿态，并计算该城邦每月愿意拿出的最大军粮配额 `supply_quota_monthly`（斛）：
- 设城邦当前存粮为 $G_{\text{stock}}(s)$，本地人口 6 个月保底口粮为 $G_{\text{safe}}(s) = \text{pop}(s) \times r_{\text{pop\_food}} \times 6$，则**可支配余粮** $G_{\text{surplus}}(s) = \max\bigl(0,\ G_{\text{stock}}(s) - G_{\text{safe}}(s)\bigr)$。

| 供粮姿态枚举 (`supply_stance`) | 意愿分阈值 | 月度供粮配额 `supply_quota_monthly` | 购粮单价（钱/斛） | 历史表现与 S05 补给行为 |
|---|---|---|---|---|
| **`WELCOME`（迎军给食）** | $W_{\text{supply}} \ge 45.0$ | $\min\bigl(4500,\ \lfloor 0.30 \times G_{\text{surplus}}(s) \rfloor\bigr)$<br>（若为汉属国/傀儡则上限提至 `8000`，比例 `0.50`） | **`0.04`** 钱/斛（汉属国优惠价 **`0.025`** 钱/斛） | 「牛羊酒食迎军」：过境汉军自动从配额中补给，允许执行 `buy_grain` |
| **`MARKET`（高价开市）** | $20.0 \le W_{\text{supply}} < 45.0$ | $\min\bigl(2000,\ \lfloor 0.15 \times G_{\text{surplus}}(s) \rfloor\bigr)$ | **`0.08`** 钱/斛（翻倍市价） | 「下者得食，贵市于军」：限量高价售粮，仅够小股部队或贴补大军两成消耗 |
| **`CLOSED`（闭门拒守）** | $W_{\text{supply}} < 20.0$ | **`0` 斛** | 拒不售粮 | 「当道小国各坚城守，不肯给食」：汉军无法买粮或自动就食，除非下令强征/攻城 |

#### 4.8.3 白条赊欠与强行征发（接口回调）
1. **国库不足时的白条赊欠**：当城邦处于 `WELCOME` 或 `MARKET` 为过境汉军自动供粮，但汉方国库 `money` 不足支付粮款时，每欠付 `1,000` 斛军粮（不足按比例），S05 调用 `Diplomacy.on_unpaid_supply(state, sid, unpaid_grain)`，令该国对汉怨恨 $R_{\text{han}} += 6.0$，汉影响力 $I -= 2.0$。
2. **对汉属国的强行征粮**：若某城邦已为汉属国（`han_tier == "vassal"`）却因高怨恨或匈奴驻军导致 $W_{\text{supply}} < 20.0$（`CLOSED`）且本地余粮 $G_{\text{surplus}} \ge 1,000$ 斛，则当季自动触发罪状 **`CrimeRecord(type="refuse_vassal_supply", weight=2, duration=8)`**。

#### 4.8.4 对称的匈奴侧供粮意愿公式（供 S03/S05 使用）
匈奴军队在非直辖城邦就食时，意愿分 $W_{\text{supply,xn}}(s, T_{\text{xn}}) = 30 \ln(1 + T_{\text{xn}}/M_{\text{eff}}) + 0.60 X - 0.40 I - 0.30 R_{\text{xn}} + 30 \cdot \mathbb{I}(\text{xn\_tier} == \text{"vassal"}) - 15 \cdot \mathbb{I}(\text{is\_dual})$，同样按 $\ge 45$（献粮，免钱但每次令 $R_{\text{xn}} += 4.0$）、$20–45$（半额献粮，$R_{\text{xn}} += 6.0$）、$< 20$（坚壁清野，需执行 `pillage` 洗劫方可得粮）三档结算。

---

### 4.9 `S04-R09`：五大国（乌孙/大宛/康居/大月氏/罽宾）专属规则

五大国（`kind == "great"`，门槛乘数 $m = 1.5$）不计入 18 城邦胜利分母，**不可被纳为汉属国或匈奴属国（`vassal`）**，其最高外交层级为 **`han_tier = "enfeoffed"`（在 UI 上对大国显示为「通好/同盟」而非「册封」）**，且不会主动派出正规军跨节点远征（仅以高额本土骑射民兵 $M_{\text{eff}} \approx 7,000–9,500$ 守城），但通过以下专属机制深刻影响全局战略：

1. **通用规则：大国岁献使团（Annual Tribute Envoy）**：
   - 凡处于 `han_tier == "enfeoffed"` 且 $I \ge 45.0, \text{Tilt} \ge +15.0$ 的大国，每年第 4 季末有 `40%` 概率向长安遣使奉献方物：汉朝廷信任 `+2`、国库 `+100` 钱、都护府功业值（S01）按大国通好计分。
2. **乌孙（`wusun`，都城赤谷 `chi_gu`）——和亲同盟与北翼夹击**：
   - **乌孙和亲触发条件**：当乌孙已达 `han_tier == "enfeoffed"` 且 $I \ge 50.0, \text{Tilt} \ge +15.0$ 时，汉方玩家可通过精使团下达专项使命（或响应 S06 乌孙求亲事件），花费 **`800` 钱**嫁妆费达成**【乌孙和亲】**（置 `relations["wusun"].marriage_han = true`）。
   - **和亲持续效果**：① 乌孙影响力衰减锚点从 `30.0` 永久提升至 **`50.0`**，每月额外获得 $I += 0.8, X -= 1.0, \text{pro\_han} += 0.5$；② 乌孙向汉方开放全境 `WELCOME` 平价军粮补给与 2 跳战略视野；③ **协同出骑助战**：当汉军在北道西段（龟兹、姑墨、温宿、车师后）或右贤王庭发起会战，或触发「前 71 年白灾三国乘弱」事件时，乌孙可应诏出动虚拟助战骑兵（直接削减匈奴右部/日逐王兵力 `2,000–4,000` 骑并扣减单于威望 `-8`，对接 S03/S06）。
3. **大宛（`dawan`，都城贵山/贰师 `da_wan`）——求汗血天马与贰师之战导火索**：
   - **遣使求马（`seek_horses`）**：汉方派**精使团**携至少 **`500` 钱**预算抵达 `da_wan` 并指定目标 `objective = "seek_horses"` 时，进行大宛献马检定：
     - **答应献马条件**：$I \ge 45.0 \land \text{Tilt} \ge +15.0 \land (I + A_{\text{han}} \ge 55.0)$。若满足：大宛收下千金，开启**【岁献天马】**（`horse_tribute_han = true`），汉方立即获得良马 `+600` 匹（汇入 S05 `state.han_horse_pool`）、朝廷信任 `+6`；此后只要保持 `han_tier == "enfeoffed"`，每年春季自动获大宛贡马 `+200` 匹。
     - **匿马拒献与杀使触发**：若未达上述条件，大宛贵族恃远傲慢（「汉兵安能至此」），**断然拒献天马**！汉方白损失 `500` 钱预算，朝廷信任 `-4`，且大宛当场生成专属罪状 **`CrimeRecord(type="refuse_heavenly_horses", weight=2, duration=16)`**；若此时大宛 $\text{Tilt} < 0$，更有 `50%` 概率触发「郁成遮杀汉使车令」事件，额外追加 `kill_envoy(weight=3)` 罪状并促发汉廷下达《征大宛贰师诏令》（对接 S02/S06）！
   - **攻克大宛的特殊结算**：若汉军攻陷 `da_wan`（或 `ershi_cheng` 围城迫降），无论选 `install_king`（立昧蔡）还是 `force_submit`，自动永久激活 `horse_tribute_han = true`，一次性缴获汗血马 `+30` 匹、中等良马 `+3,000` 匹，且全西域 18 城邦震恐（全图 $A_{\text{han}} += 20.0, I += 10.0$）。
4. **康居（`kangju`）、大月氏（`dayuezhi`）、罽宾（`jibin`）被动特性**：
   - **康居**：地处北草原侧翼，`geo_bias = -10`，初始亲匈（`pro_xn = 40`）。当匈奴派军靠近大宛/乌孙时，若康居 $\text{Tilt} \le -20$，康居为过境匈奴军提供免费粮草补给；汉方通好康居可切断匈奴西翼补给。
   - **大月氏**：南道丝路终点站，痛恨匈奴（初始 $R_{\text{xn}} = 30, \text{pro\_han} = 30$），永不成为匈奴附庸；一旦与汉达成 `enfeoffed` 通好，其商路终点贡献乘数跃升为 $\gamma = 1.50$（每月额外多产 `2.5` 钱商税）。
   - **罽宾**：悬度天险（`sha_che`→`ji_bin` 为 `hazard` 地形，耗时 `137.5` 天），杀使风险倍增（$\kappa_{\text{state}} = 2.0$），是高风险高回报的远方声望目标。

---

### 4.10 `S04-R10`：匈奴外交接口、僮仆都尉赋税联动与白灾瓦解冲击

1. **匈奴对城邦的 4 项专属外交/威压动作（命令定义见第 5 章，消耗与单于威望归 S03）**：
   - **威逼纳属（`demand_vassal`）**：当 $X \ge 55 \land X - I \ge 15$ 时将独立国或汉册封国强纳为匈奴属国（走迁移 `T4/T5/T6/T7`）。
   - **勒令弃汉专属（`demand_exclusive`）**：针对两属国（`is_dual == true`），当 $X \ge I + 10$ 时逼迫其缴还汉印转为纯匈奴属国（走迁移 `T8`），但激起该国 $R_{\text{xn}} += 12.0$。
   - **强令禁商（`enforce_trade_ban`）**：针对未禁商的匈奴属国（如开局楼兰），当 $X \ge 50$ 时匈奴可耗费 `100` 钱赏赐或 1 跳内驻军威慑，强制令该国立即置 `trade_banned = true, ban_lock_seasons = 2`（无需等待 $X \ge 60$ 自然触发），同时 $R_{\text{xn}} += 8.0$。
   - **征发附庸骑兵（`levy_vassal_cavalry`）**：从匈奴属国抽调本地民兵骑兵编入匈奴军，每次令该国 $R_{\text{xn}} += 15.0, X -= 5.0$（对接 S03）。
2. **僮仆都尉在位与罢黜联动（对接 S01 / S03）**：
   - 当 `state.tribes.tongpu_active == true`（默认在位，驻焉耆/尉犁一带）时：所有匈奴属国（`xn_tier == "vassal"`）的威吓自然衰减享有 $X_{\text{floor}} = 30.0$ 保底，且每月向匈奴缴纳僮仆赋税（纯属国每国每月令 $R_{\text{xn}} += 2.0$，两属国减半 $R_{\text{xn}} += 1.0$；若 S03 将赋税档位调为「重敛」，则月增怨恨翻倍为 $+4.0 / +2.0$）。
   - **日逐王降汉 / 罢僮仆都尉冲击**：一旦触发郑吉迎日逐王降汉或汉军攻占焉耆+车师前击溃僮仆都尉（S03 置 `tongpu_active = false`），S04 立即对全西域 23 国结算一次性崩塌冲击：
     $$\forall s:\quad X(s) \leftarrow \max\bigl(0.0,\ X(s) - 15.0\bigr), \quad \text{且解除 } X_{\text{floor}} = 30.0 \text{ 保底锁！}$$
3. **白灾瓦解链的外交传导（对接 S03 / S06）**：
   - 在「本始三年大雪（白灾）」持续的 `4` 个季度内，匈奴因本部畜产死伤无力西顾，所有西域城邦的匈奴威吓月衰减率从 `2.0/月` **翻倍至 `4.0/月`**，且 `rebel_xn`（叛匈独立）所需对匈怨恨阈值临时下调 `10` 点（从 `45` 降至 `35`），触发西域北道诸国连锁脱匈潮。

---
## 5. 命令

> **原则（圣经 L9）**：玩家与 AI 共用同一套命令验证与执行入口（`core/commands.gd`）。旧版无距离秒达的 `gift` 命令标记为 `@deprecated`（仅在底层保留自动转换为单目标募使的兼容跳板，新 UI 与新 AI 全面使用 `dispatch_embassy`）。

| 命令 ID | 适用方 | 参数 (`params`) | 前置条件 (`validate`) | 资源消耗 | 执行效果 (`apply`) | 失败返回码 (`error`) |
|---|---|---|---|---|---|---|
| `dispatch_embassy` | 汉 | `kind`: `"elite"` / `"recruited"`<br>`character_id`: `String`<br>`origin`: 节点 ID<br>`targets`: `Array[{state_id, budget, objective}]` | 1. `kind=="elite"` 时：`character_id` 必须为汉方空闲具名人物，且位于河西或西域已控节点；<br>2. `kind=="recruited"` 时：`state.recruited_missions_this_year < 3`，`targets.size() <= 2`，且目标 `objective` 仅限 `"gift"`；<br>3. 各目标 `budget >= 100`，总预算 $\sum B \in [100, 3000]$；<br>4. 目标国 `expel_cooldown_seasons == 0` 且未处于交战 | 组建费（精使 `150` / 募使 `50` 钱）+ 总预算 $\sum B$ 钱；若为募使则本年配额 `+1` | 生成在途 `Mission` 实体加入 `state.missions`；若为精使则锁定该具名人物状态为 `"on_mission"`；计算至首站最短路径 | `ERR_NO_CHARACTER`<br>`ERR_RECRUITED_CAP`<br>`ERR_INSUFFICIENT_FUNDS`<br>`ERR_EXPEL_COOLDOWN`<br>`ERR_AT_WAR` |
| `recall_embassy` | 汉 | `mission_id`: `String` | `state.missions` 存在该 ID，且 `status` 为 `"outbound"` / `"at_court"` / `"resident"` | `0` | 使团状态立即转为 `"returning"`，未消费的剩余预算 `remaining_budget` 在使团返抵敦煌时退还国库 `80%` | `ERR_INVALID_MISSION`<br>`ERR_ALREADY_RETURNING` |
| `grant_enfeoffment` | 汉 | `state_id`: `String`<br>` marry_wusun`: `bool`（可选，默认 `false`） | 1. `han_tier == "none"` 且 `tier_lock_seasons == 0`且 `sacked_memory_seasons == 0`；<br>2. 目标节点有汉使团在庭（`at_court`/`resident`）或同格有汉军；<br>3. 若 `xn_tier == "none"`：需 $I \ge 30 m \land \text{Tilt} \ge 0$（走 `T1`）；<br>4. 若 `xn_tier == "vassal"`（城邦）：需 $I \ge 28 \land R_{\text{xn}} \ge 25 \land \text{Tilt} \ge -15$（走 `T2` 两属）；<br>5. 若勾选 `marry_wusun`：需 `state_id == "wusun"` 且已 `enfeoffed`、$I \ge 50, \text{Tilt} \ge 15$ | 常规册封：`200` 钱；<br>乌孙和亲：额外 `800` 钱 | 执行状态迁移 `T1`（汉册封/大国通好）或 `T2`（两属，`is_dual=true, trade_banned=false`）；授予 `han_enfeoffed` Buff；若为乌孙和亲则置 `marriage_han = true` | `ERR_TIER_LOCKED`<br>`ERR_NO_ENVOY_AT_COURT`<br>`ERR_INFLUENCE_LOW`<br>`ERR_TILT_TOO_LOW`<br>`ERR_SACK_MEMORY` |
| `incorporate_vassal` | 汉 | `state_id`: `String` | 1. 仅限 18 城邦（`kind == "citystate"`）；<br>2. `han_tier == "enfeoffed"`（含两属），`tier_lock_seasons == 0`；<br>3. $I \ge 60.0 \land I - X \ge 15.0 \land \text{Tilt} \ge +20.0$；<br>4. 目标节点有汉**精使团**在庭或同格汉军兵力 $\ge M_{\text{eff}}(s)$ | `300` 钱 | 执行迁移 `T3`：`han_tier = "vassal"`, `xn_tier = "none"`, `is_dual = false`, `overlord = "han"`, `tier_lock_seasons = 2`；首次置 `hostage_sent_han = true` 时通知 S01 授战功 `+2.0` | `ERR_GREAT_POWER_IMMUNE`<br>`ERR_NOT_ENFEOFFED`<br>`ERR_THRESHOLD_NOT_MET`<br>`ERR_NO_ELITE_OR_ARMY` |
| `respond_diplomatic_request` | 汉 | `request_id`: `String`<br>`accept`: `bool` | `state.diplomatic_requests` 中存在未过期的该请求 | 若 `accept == true`：<br>`req_enfeoff` / `req_dual` 耗 `150` 钱；`req_vassal` 耗 `200` 钱；拒绝耗 `0` 钱 | 接受：免除「需使团在场」限制，直接执行对应迁移 `T1` / `T2` / `T3` 并移除请求；<br>拒绝：移除请求，目标国 $I -= 5.0, \text{Tilt} -= 8.0$ | `ERR_REQUEST_EXPIRED`<br>`ERR_INSUFFICIENT_FUNDS` |
| `declare_punitive` | 汉 | `state_id`: `String`<br>`policy`: `"install_king"` / `"force_submit"` / `"sack"` | 1. 目标国 `overlord != "han"` 且未处于 `punitive_war`；<br>2. 若无有效罪状（`!has_valid_crime`）且无讨伐诏令，需校验 S02 是否允许发起矫诏/擅兴 | 依名义档位扣朝廷信任：`justified` 扣 `0`、`enemy_vassal` 扣 `4`、`unjustified` 扣 `12`（记矫诏） | 创建 `relations[state_id].punitive_war` 记录；周边 2 跳城邦结算开战冲击（`4.6.2`）；解锁汉军对该国节点的围城/攻掠权限 | `ERR_ALREADY_VASSAL`<br>`ERR_FORGED_EDICT_BLOCKED` |
| `set_capture_policy` | 汉 | `state_id`: `String`<br>`policy`: `"install_king"` / `"force_submit"` / `"sack"` | 目标国正处于 `punitive_war` 或刚被汉军攻占等待善后裁决；选 `"install_king"` 需国库 $\ge 300$ 钱且目标为城邦 | `"install_king"` 在破城结算时扣 `300` 钱；其余 `0` 钱 | 更新预设政策或立即执行破城善后（`T12` 立新王 / `T13` 迫降 / `T14` 屠城立威，见 `4.6.3`） | `ERR_INSUFFICIENT_FUNDS`<br>`ERR_GREAT_POWER_NO_PUPPET` |
| `buy_grain` | 汉 | `state_id`: `String`<br>`amount`: `int`（斛） | 1. 目标城邦当前 `supply_stance` 为 `"WELCOME"` 或 `"MARKET"`；<br>2. `amount > 0` 且不超过该国当月剩余 `supply_quota_monthly`；<br>3. 目标节点同格有汉军或汉使团 | `cost = ceil(amount * price_per_hu)`（`WELCOME` 为 `0.04` 钱/斛，属国 `0.025`，`MARKET` 为 `0.08`） | 扣国库钱，从城邦节点 `grain` 划拨 `amount` 斛至同格汉军携粮或节点汉方粮仓，扣减当月剩余配额 | `ERR_SUPPLY_CLOSED`<br>`ERR_QUOTA_EXCEEDED`<br>`ERR_INSUFFICIENT_FUNDS` |
| `levy_vassal_troops` | 汉 | `holder_node`: 节点 ID<br>`target_states`: `Array[String]` | 1. 汉方持节者位于 `holder_node`（对接 S02）；<br>2. 每个 `sid` 距离 `holder_node` $\le 2$ 跳，且 `han_tier in ["vassal", "puppet", "enfeoffed"]`（不含两属），且 $I \ge 35, R_{\text{han}} \le 45$ | 每征调一国：该国 $I -= 10.0, R_{\text{han}} += 8.0$（无需花钱） | 每国抽调 $\lfloor 0.25 \times M_{\text{militia}}(s) \rfloor$（属国/傀儡）或 $\lfloor 0.15 \times M_{\text{militia}}(s) \rfloor$（册封国）汇入 `holder_node` 组建/补充汉附庸军（交 S05 生成） | `ERR_HOLDER_NOT_PRESENT`<br>`ERR_TOO_FAR`<br>`ERR_NOT_ELIGIBLE_ALLY` |
| `demand_vassal` | 匈奴 | `state_id`: `String` | 仅限 18 城邦；`xn_tier == "none"`；$X \ge 55 \land X - I \ge 15$（若夺取汉属国需 $X \ge I + 25$ 且 1 跳内有匈奴军） | 耗 `100` 钱赏赐或 1 跳内有匈奴军驻威 | 执行迁移 `T4` / `T5`（转两属）/ `T6` / `T7`，刷新 `overlord = "xiongnu"` | `ERR_INTIMIDATION_LOW`<br>`ERR_ARMY_REQUIRED` |
| `demand_exclusive` | 匈奴 | `state_id`: `String` | 目标城邦处于两属态（`is_dual == true`），且 $X \ge I + 10$，1 跳内有匈奴军或耗 `150` 钱 | `150` 钱（若 1 跳内有匈奴军则为 `50` 钱） | 执行迁移 `T8`：剥夺汉册封（`han_tier="none"`, `is_dual=false`），该国 $R_{\text{xn}} += 12.0$，汉获 `submit_enemy(weight=1)` 罪状 | `ERR_NOT_DUAL`<br>`ERR_INTIMIDATION_LOW` |
| `enforce_trade_ban` | 匈奴 | `state_id`: `String` | 目标为匈奴属国（`xn_tier == "vassal"`）且 `is_dual == false` 且 `trade_banned == false`，且 $X \ge 50.0$ | `100` 钱（若 1 跳内有匈奴军则为 `0` 钱） | 立即置 `trade_banned = true, ban_lock_seasons = 2`，该国 $R_{\text{xn}} += 8.0$ | `ERR_NOT_VASSAL`<br>`ERR_INTIMIDATION_LOW` |

---

## 6. 与其他系统的接口

### 6.1 S04 对外导出接口（Exports，供其他系统只读或调用）

| 接口函数 / 状态字段 | 消费方 | 签名与返回值 | 用途说明 |
|---|---|---|---|
| `Diplomacy.has_valid_crime` | S01, S02, S05, S08 | `(state: GameState, state_id: String) -> bool` | 判断该国是否持有至少 1 条未过期的对汉罪状（$W_{\text{crime,han}} \ge 1$）。S02 据此免除讨伐矫诏罪责；S01 据此在破城时发放 `+4.0` 战功 |
| `Diplomacy.get_crime_score` | S02, S08 | `(state: GameState, state_id: String, holder := "han") -> int` | 返回总罪状权重（`0–6`），供 AI 评估讨伐优先级与 UI 展示 |
| `Diplomacy.levy_vassal_troops` | S02, S05 | `(state: GameState, holder_node: String, max_troops: int) -> Dictionary` | 供持节者「以节发 2 跳内诸国兵」调用：校验并返回可征发的诸国兵力明细 `{total_troops, by_state}`，扣除对应城邦 $I - 10, R_{\text{han}} + 8$ |
| `Diplomacy.get_supply_stance` / `get_forage_willingness` | S05, S07, S08 | `(state: GameState, state_id: String, army_or_troops) -> Dictionary / float` | 返回 `{stance, score, quota_monthly, price}`（`get_forage_willingness` 直接返回钳制在 `0..100` 的意愿分 $W$），供 S05 在每旬补给结算与行军粮道预演时调用 |
| `Diplomacy.apply_forage_feedback` / `on_unpaid_supply` | S05 | `(state: GameState, state_id: String, faction: String, delta_inf: float, delta_resent: float, crime_tag := "") -> void` | 接收 S05 献粮/平买/强征/掠食或白条赊欠后的影响力、怨恨增减与罪状回写（如匈奴或汉军强征掠食触发怨恨与罪状） |
| `Diplomacy.on_citystate_captured` | S05 (`Siege`) | `(state: GameState, state_id: String, attacker: String, policy: String) -> void` | 当城邦被围城攻陷时由 `Siege` 调用，执行 `install_king` / `force_submit` / `sack`（汉）或匈奴破城洗劫（`xn_sack`）的状态迁移与邻国辐射 |
| `Diplomacy.on_tongpu_deposed` | S01, S03 | `(state: GameState) -> void` | 当日逐王降汉或僮仆都尉被击溃罢黜时由 S03 调用，立即对全西域结算 $X - 15.0$ 并解除 $X_{\text{floor}} = 30$ 保底锁 |
| `Diplomacy.add_tax_resentment` | S03 | `(state: GameState, state_id: String, base_resentment: float) -> float` | 供 S03 僮仆都尉征税调用：若该国 `is_dual == true`，实收税金与怨恨自动乘 `0.5`，返回实际税率乘数 |
| `Diplomacy.get_allied_vision_nodes` | S05 | `(state: GameState, faction: String) -> Dictionary` | 导出外交视野源：汉属国/傀儡提供 2 跳视野，汉册封/两属国及在途使团提供 1 跳视野，乌孙和亲提供赤谷周边 2 跳视野 |
| `relations[sid]` 核心字段 | S01 | `overlord`, `han_enfeoffed`, `hostage_sent_han`, `han_tier`, `marriage_han` | 供 S01 直接汇总都护府功业值（属国每个 `+5`、印绶册封每个 `+2` 上限 12、乌孙和亲等）及判定剧本①/②/③胜利条件 |

### 6.2 S04 从其他系统导入接口（Imports）

| 来源系统 | 读取字段 / 调用接口 | 用途说明 |
|---|---|---|
| **S01 胜利与剧本** | `Victory.record_event_award(state, key, amount)` | 在首次纳质子（`+2.0`）、攻克有罪之国（`+4.0`）、屠城扣分（`-5.0`）时通知 S01 记入功业值 |
| **S02 汉廷与诏令** | `Court.modify_trust(state, delta, reason)`<br>`Court.check_war_authorization(state, state_id, has_crime)`<br>`Court.is_luntai_edict_active(state)` | 使团被杀/受辱、讨伐开战/烂尾、破城善后、大国岁献时增减朝廷信任；读取轮台诏是否已颁布以决定屠城信任惩罚（`-8` vs `-20`） |
| **S03 匈奴联盟** | `state.tribes.tongpu_active: bool`<br>`Tribes.modify_prestige(state, delta, reason)`<br>`Tribes.add_loot_to_pool(state, money)` | 判断匈奴属国是否享有 $X_{\text{floor}} = 30$ 保底；当匈奴属国叛离或转两属时扣减单于威望（`-4` / `-2`）；匈奴截获汉使团时将礼金汇入赏赐池 |
| **S05 后勤与军事** | `state.armies`（位置与兵力）<br>`Supply.add_horses(state, count)`<br>`Pathfinding.shortest_safe_route(...)` | 计算驻军威吓 $T_{\text{xn}}$、汉军军威 $T_{\text{han}}$ 与供粮意愿兵威项；大宛献马/破大宛时向国家马匹池注入天马与良马 |
| **S06 事件与人物** | `state.characters[cid]`（`eloquence`, `traits`, `status`, `location`）<br>`Events.trigger(state, event_id, context)` | 校验精使团正使在场与辞令加成；触发傅介子刺楼兰王、乌孙和亲、大宛匿马杀使、苏武扣留等叙事事件 |

### 6.3 S04 提出的接口需求（已登记至 `STATUS.md`）
- `[S04→S02]` 需 S02 提供 `Court.modify_trust(state, delta, reason)`、`Court.is_luntai_edict_active(state) -> bool`（轮台诏生效后屠城扣信任加倍至 `-20`），并确认募使团（`kind == "recruited"`）不占用具名人物槽。
- `[S04→S03]` 需 S03 维护 `state.tribes.tongpu_active: bool`，在日逐王降汉或僮仆都尉被消灭时调用 `Diplomacy.on_tongpu_deposed(state)`，并在计算西域岁币收入时对 `is_dual == true` 的两属城邦按 `50%` 计收。
- `[S04→S05]` 需 S05 在 `Siege` 攻陷城邦时调用 `Diplomacy.on_citystate_captured(state, sid, attacker, policy)`，在每旬大军就食与行军预演时调用 `Diplomacy.get_supply_stance(state, sid, troops)`，并接入 `Diplomacy.get_allied_vision_nodes` 作为外交视野源。
- `[S04→S06]` 需 S06 在人物属性中提供 `eloquence`（0–100，默认 70）与特性标签（如 `凿空者`、`勇决`），并承接 `evt_envoy_killed`、`evt_wusun_marriage`、`evt_dawan_horses_refused`、`evt_loulan_assassination` 四条外交核心事件链。

---

## 7. AI 使用要点（供 S08 细化效用函数）

1. **汉方 AI（`HanAI`）外交决策准则**：
   - **彻底弃用无脑刷钱**：汉 AI 根据各城邦当前 $I$ 与 $I_{\text{anchor}}$ 的差距以及饱足度 `satiation` 计算使团边际收益；当某国 `satiation >= 2` 时暂停派使，转投其他节点。
   - **阶梯式推进（先通商/册封抬锚点，再冲属国）**：对南道畅通国（且末、精绝、于阗）优先派募使或副使攒至 $I \ge 30$ 立即执行 `grant_enfeoffment` 将锚点抬至 `30`；对高价值枢纽（楼兰、龟兹、乌垒）集中精使团+驻军推上 $I \ge 60$ 纳为属国。
   - **募使「战略试探/刷罪状」逻辑**：当汉 AI 兵力充裕、渴望攻取咽喉要地（如楼兰、车师前）但缺乏合法罪状且朝廷信任不足以矫诏时，AI 会有意派遣低成本募使（`100` 钱）赴高威吓敌意城邦，博取 `insult_envoy` / `kill_envoy` 罪状以解锁免矫诏讨伐。
   - **出塞前供粮预检**：汉 AI 在制定远征计划（如征大宛、救车师）前，先沿途调用 `Diplomacy.get_supply_stance(state, node, planned_troops)`；若沿途超过 2 个枢纽城邦为 `CLOSED`，AI 会优先提高出征兵力规模（利用 $W_{\text{force}}$ 震慑开粮）或先派使团册封沿途小国，绝不盲目派小股部队深入饿死。
2. **匈奴 AI（`XiongnuAI`）外交决策准则**：
   - **锁死楼兰咽喉**：开局楼兰 $X = 55$ 未禁商，匈奴 AI 在前 2 季若评估汉方重走丝路，会优先派一支部队进驻车师前/伊吾辐射楼兰，或直接对楼兰下达 `enforce_trade_ban`（耗 `100` 钱）将南道打折至 `30%`。
   - **严防北道两属与叛离**：当某匈奴属国进入 `wavering_action == "rebel_xn"` 或转为 `is_dual == true` 时，匈奴 AI 会根据单于威望决定是派骑兵进驻镇压（执行 `demand_exclusive`），还是暂时下调僮仆赋税以平息 $R_{\text{xn}}$。

---

## 8. UI 需求（供 S07 细化线框与视觉）

### 8.1 大地图节点外交徽章与丝路可视化
1. **城邦名牌四元徽章**：
   - **左侧宗主盾徽**：汉红底金纹（`vassal`/`puppet`）、汉半框印绶（`enfeoffed`）、匈奴苍狼青铜徽（`xn_tier=="vassal"`）、**红青双色太极分裂徽（`is_dual` 两属）**、灰白无纹（独立）。
   - **下方双色倾向槽**：宽度 48px，左青（匈奴 $X$）右红（汉 $I$），中央游标指示 $\text{Tilt}$ 位置。
   - **右上状态角标**：🟢（迎军给食 `WELCOME`）、🟡（高价开市 `MARKET`）、🔴（闭门拒守 `CLOSED`）；若 `trade_banned == true` 叠加「禁商木牌」图标；若有未过期对汉罪状，叠加闪烁的**「罪」字朱砂印**；若 `wavering_action != ""` 叠加黄色感叹号「⚠️动摇」。
2. **在途使团棋子**：
   - 大地图路径边上绘制手持汉节的马车/骑使小棋子（精使为金节华盖，募使为素幡单骑），悬停显示：「张骞精使团 → 乌孙（距赤谷尚有 42 日，携金 800）」。

### 8.2 核心 Tooltip 拆解文案草稿（透明化公式，拒绝黑箱）
1. **综合倾向 $\text{Tilt}$ 悬停拆解 Tooltip**：
   ```text
   【楼兰 · 政治倾向：-18（偏匈奴）】
   ────────────────────────
   • 汉朝影响力 (+15) vs 匈奴威吓 (-55)： -40.0
   • 对匈奴怨恨 (+15) vs 对汉怨恨 (0)：   +6.8
   • 汉军驻防军威 (0)：                    +0.0
   • 王室派系（亲汉 20% vs 亲匈 45%）：   -7.5
   • 地缘位置偏置（东大门）：              +0.0
   • 对汉未决罪状（无）：                  +0.0
   ────────────────────────
   ▶ 距离【主动请为两属】还需：汉影响力 ≥ 25 且 对匈怨恨 ≥ 30
   ▶ 警告：若匈奴威吓升至 ≥ 60 且倾向 ≤ -20，下季将动摇【禁绝汉商】！
   ```
2. **城邦供粮意愿悬停拆解 Tooltip**：
   ```text
   【龟兹 · 大军供粮意愿：+46.9（🟢 迎军给食）】
   （按当前同格/预演汉军 18,000 人 vs 龟兹有效防卫力 3,072 计算）
   ────────────────────────
   • 大军兵威震慑（兵力比 5.86x）：       +57.8
   • 汉影响力 (+8) 与 汉军军威 (+25)：    +13.6
   • 匈奴威吓 (-35) 与 对汉怨恨 (-15)：   -24.5
   • 外交层级加值（独立国）：              +0.0
   • 罪状/缺粮惩罚：                       -0.0
   ────────────────────────
   ▶ 当前姿态：牛羊酒食迎军（月供粮配额上限 4,500 斛，平价 0.04 钱/斛）
   ▶ 若汉军兵力低于 6,500 人，意愿将跌破 20 并转为【🔴 闭门拒守】！
   ```

---
## 9. 玩家可见文本（本地化源表草稿 `zh_CN`）

> 所有字符串统一收录于 `data/localization/zh_CN.json`（英文同步于 `en_US.json`），代码中严禁硬编码中文字符串（圣经 L11）。

| 本地化 Key | 中文文本（源语言草稿） | 占位符说明 |
|---|---|---|
| `ui.diplo.tier.none` | `独立诸国` | — |
| `ui.diplo.tier.han_enfeoffed` | `汉赐印绶` | 城邦显示名 |
| `ui.diplo.tier.great_allied` | `通好同盟` | 大国 `enfeoffed` 专属显示名 |
| `ui.diplo.tier.han_vassal` | `大汉属国` | — |
| `ui.diplo.tier.han_puppet` | `亲汉王庭（立质子）` | — |
| `ui.diplo.tier.xn_vassal` | `匈奴属国（僮仆赋役）` | — |
| `ui.diplo.tier.dual` | `首鼠两属（事汉匈两主）` | — |
| `ui.diplo.supply.welcome` | `🟢 迎军给食（牛羊酒食出迎，月供上限 {quota} 斛，平价 {price} 钱/斛）` | `{quota}`, `{price}` |
| `ui.diplo.supply.market` | `🟡 高价开市（闭城仅开小市，月供上限 {quota} 斛，贵价 {price} 钱/斛）` | `{quota}`, `{price}` |
| `ui.diplo.supply.closed` | `🔴 坚城拒守（当道小国各坚城守，不肯给食）` | — |
| `ui.diplo.trade.status_open` | `丝路畅通（过境穿透 100%，月贡商税 {money} 钱）` | `{money}` |
| `ui.diplo.trade.status_taxed` | `胡属榷税（匈奴属国盘剥，过境穿透降至 85%）` | — |
| `ui.diplo.trade.status_banned` | `闭关禁商（明面断绝汉贾，仅余 30% 大漠走私渗漏）` | — |
| `ui.diplo.trade.status_raided` | `兵燹断道（匈奴游骑遮略，商路彻底断绝 0%）` | — |
| `ui.embassy.kind.elite` | `持节精使团（正使随行 · 零贪墨 · 可遣副使）` | — |
| `ui.embassy.kind.recruited` | `郡国募使团（免占名臣 · 贪墨三成 · 易招慢辱，本年余 {left}/3 批）` | `{left}` |
| `msg.embassy.arrived_gain` | `{date}：{envoy_name}率使团抵【{state}】宣谕天子威德，赐金帛折合 {budget} 钱，汉影响力 +{gain}（当前 {cur_inf}）。` | `{date}`, `{envoy_name}`, `{state}`, `{budget}`, `{gain}`, `{cur_inf}` |
| `msg.embassy.insulted` | `{date}：【{state}】王庭恃匈奴之威，慢辱汉使{envoy_name}，扣减礼金效用过半！我方获讨伐罪状【慢辱天使】。` | `{date}`, `{state}`, `{envoy_name}` |
| `msg.embassy.killed` | `{date}：急报！【{state}】纵兵攻杀汉使{envoy_name}，尽夺县官赍物 {budget} 钱！西域震动，我方获重罪状【攻杀汉使】（可免矫诏兴师讨伐）。` | `{date}`, `{state}`, `{envoy_name}`, `{budget}` |
| `msg.embassy.intercepted` | `{date}：我方赴【{state}】使团途经【{node}】时遭匈奴游骑截获，赍金 {budget} 钱尽入胡庭！` | `{date}`, `{state}`, `{node}`, `{budget}` |
| `crime.type.kill_envoy` | `攻杀汉使（权重 3 · 师出有名）` | — |
| `crime.type.kill_han_king` | `擅杀亲汉国主（权重 4 · 大逆不道）` | — |
| `crime.type.betray_vassal` | `举国背盟叛离（权重 3 · 师出有名）` | — |
| `crime.type.rob_caravan` | `遮杀汉商劫掠贡道（权重 2 · 师出有名）` | — |
| `crime.type.submit_enemy` | `弃毁汉印从胡（权重 2 · 师出有名）` | — |
| `crime.type.aid_enemy_war` | `资敌军粮助胡攻战（权重 2 · 师出有名）` | — |
| `crime.type.refuse_vassal_supply` | `属国拥粮拒供王师（权重 2 · 师出有名）` | — |
| `crime.type.refuse_heavenly_horses` | `匿汗血善马不与（权重 2 · 师出有名）` | — |
| `crime.type.insult_envoy` | `慢辱天使驱逐使臣（权重 1 · 师出有名）` | — |
| `msg.wavering.ban_trade` | `【西域风闻】探报【{state}】慑于匈奴威逼（威吓 {x}），王庭动摇，若下季末局势未变将正式【禁绝汉商】！` | `{state}`, `{x}` |
| `msg.wavering.rebel_xn` | `【西域风闻】【{state}】苦于匈奴僮仆重敛（怨恨 {r}），国人思变，下季末恐【叛匈自立】！` | `{state}`, `{r}` |
| `msg.wavering.rebel_han` | `【西域风闻】【{state}】怨汉军供亿烦费（怨恨 {r}），王室亲匈派抬头，下季末恐【背汉叛离】！` | `{state}`, `{r}` |
| `msg.request.dual` | `【外藩奏表】【{state}】王遣密使入关泣诉：「小国处汉匈之间，苦匈奴重敛，愿受大汉印绶，阴为内应，通商给食，唯求两属以全社稷。」（批复需 150 钱，限 2 季内裁决）` | `{state}` |
| `msg.request.enfeoff` | `【外藩奏表】【{state}】慕大汉威德，遣使奉献方物，请赐汉朝印绶以列藩臣。（批复需 150 钱）` | `{state}` |
| `msg.request.vassal` | `【外藩奏表】【{state}】举国倾心向化，愿遣王太子入侍长安，去胡号、内属大汉！（批复需 200 钱）` | `{state}` |
| `ui.punitive.policy.install_king` | `【更立亲汉新王】（耗 300 钱 · 扶植质子即位为汉傀儡国，亲汉派暴涨且 4 季锁死不叛，邻国归心）` | — |
| `ui.punitive.policy.force_submit` | `【迫降留用原王】（耗 0 钱 · 纳质子降为汉属国，省钱但原王心怀怨望，需驻军弹压）` | — |
| `ui.punitive.policy.sack` | `【屠城立威】（耗 0 钱 · 夺城中半数存粮，3 跳内小国军威 +25 望风献粮；但本城荒废、全西域离心 -10、朝廷严谴扣信任！）` | — |

---

## 10. 边界情况（Edge Cases）

1. **EC-01 精使团正使在途中因寿尽或事件死亡**：
   - 若 `Mission.kind == "elite"` 的正使在出使途中（`outbound`）或驻庭期间（`at_court`/`resident`）因高龄寿终或剧本事件身故：使团不立即消失，由随行假丞/副手接管降格为 `"deputy"`（品质系数从正使 $q$ 降为 `0.80`），继续完成当前首站宣谕后自动强制转入 `"returning"` 将遗骸与节杖护送归敦煌，剩余未访问的次级目标预算在归朝时 100% 退还国库。
2. **EC-02 使团在途期间，目标城邦被汉军或匈奴攻占**：
   - 若使团下一站目标 $s$ 在使团抵达前被**汉军攻克**并已成为汉属国/傀儡：使团抵达后自动将 `"gift"` 转为「宣劳安抚」，不触发受辱检定，全额结算影响力并消除该国 $R_{\text{han}} - 8.0$。
   - 若目标 $s$ 被**汉军屠城（`sack`）**或正处于汉军围城战中：使团在距离该城 1 跳处自动跳过该目标，将该站预算顺延并入下一目标（若无下一目标则直接折返敦煌退钱）。
   - 若目标 $s$ 在使团途中新沦为**匈奴直辖军事据点**（如伊吾/车师驻满匈奴军）：使团抵达前 1 跳自动感知危险，若为精使则停止前进转入 `"returning"` 保全名臣；若为募使则继续硬闯并按 `4.5.2` 触发高概率截获。
3. **EC-03 同一旬内多支使团同时抵达同一城邦的确定性结算顺序**：
   - 若多支使团（例如 1 支精使 + 1 支副使）在同一旬（Tick）抵达同一城邦 $s$：按 `Mission.id` 字典序升序依次结算。第一支使团按当前 `satiation` 结算并令 `satiation += 1`；紧接着第二支使团立即吃到递增后的 `satiation` 折损，严格杜绝「同旬多使团卡 Bug 绕过饱足度折损」。
4. **EC-04 玩家下达 `grant_enfeoffment` / `incorporate_vassal` 时，使团恰好在同一回合期满返程**：
   - 由于玩家默认每季下令一次，而王庭驻留 `stay_days_left` 原为 10 天（1 旬），若使团在 T1 第 3 旬抵达、第 4 旬离开，玩家在 T2 季初下令时使团已不在王庭。
   - **修复规则**：当使团抵达某城邦宣谕后，若使团 discoveries 发现该国在本次宣谕后已满足 `grant_enfeoffment` 或 `incorporate_vassal` 的数值门槛，使团自动将 `stay_days_left` **延长至本季末 + 1 旬**（等候汉使大营季初指令），确保玩家在下一季初必定能点下【颁赐印绶】或【纳为属国】按钮！
5. **EC-05 汉军对驻有己方常驻使团（`resident`）的城邦宣战讨伐**：
   - 一旦汉方对城邦 $s$ 下达 `declare_punitive` 或发起围城，位于 $s$ 的汉方使团当即触发紧急撤离：若 $s$ 当前 $X \ge 60$，有 `35%` 概率使团被敌国扣押为人质（若为募使则直接遇害并追加 `kill_envoy` 罪状，若为精使则转入扣留状态需破城解救）；其余 `65%` 概率狼狈逃往相邻安全节点并转 `"returning"`。
6. **EC-06 对五大国（`kind == "great"`）尝试下达 `incorporate_vassal` 或破城选 `install_king` / `sack`**：
   - `Commands.validate` 硬性拦截对 `wusun, dawan, kangju, dayuezhi, jibin` 的 `incorporate_vassal` 命令（返回 `ERR_GREAT_POWER_IMMUNE`）。
   - 若汉军远征攻陷大国都城（如攻克大宛 `da_wan`），善后弹窗仅开放 **【盟誓迫降（`force_submit`）】** 一项（自动置为 `han_tier = "enfeoffed"`、激活岁献天马、清空敌意），禁止将大国变为汉直属 `vassal`/`puppet` 或屠灭大国都城。
7. **EC-07 城邦历经多次围城/屠城后人口极度萎缩时的防卫力与供粮安全线除零保护**：
   - 任何城邦人口 `pop` 下限锁死为 `500` 人；有效防卫力 $M_{\text{eff}}(s)$ 恒有保底值 `300`（见 `4.1.1`），防止 $T_{\text{han}} / M_{\text{eff}}$ 出现除零或无穷大。
8. **EC-08 同一节点上有两支汉军同时请求城邦供粮时的配额分配**：
   - `supply_quota_monthly` 是城邦 $s$ **每月对全体汉军的总供粮池**（月初重置）。当同格有多支汉军时，按各军当前缺粮比例（或 `army_id` 升序）依次从剩余池中支取，池空即止，绝不按军队支数成倍刷粮。
9. **EC-09 楼兰同时作为南北两道首站的商路计算与禁商联动**：
   - 楼兰（`lou_lan`）在 `scenario_mvp.json` 中同时位于 `south_silk_road[0]` 与 `north_silk_road[0]`。`Trade.monthly` 先计算楼兰的 $\gamma(\text{lou\_lan})$ 与 $\tau(\text{lou\_lan})$，楼兰本城商税 $C(\text{lou\_lan})$ **每月只加 1 次**，影响力 $\Delta I_{\text{trade}}(\text{lou\_lan})$ **每月只加 1 次**，而其下游穿透率 $t_{\text{out}}(\text{lou\_lan}) = \tau(\text{lou\_lan})$ 同时作为且末（南道第 2 站）和车师前（北道第 2 站）的输入 $t_{\text{in}}$。
10. **EC-10 匈奴对正处于 `wavering_action == "rebel_xn"` 的属国下达征兵或重税**：
    - 若某匈奴属国已挂出叛离预警，匈奴玩家/AI 仍强行对其执行 `levy_vassal_cavalry` 或 `enforce_trade_ban` 导致 $R_{\text{xn}} \ge 75.0$，则该国**不再等到季末**，当即触发紧急哗变（立即执行 `T9` 叛匈独立，拒绝交出骑兵，并向匈奴追加 `betray_vassal` 罪状）。
11. **EC-11 两属国（`is_dual == true`）境内同时进入汉军与匈奴军**：
    - 两属国对汉匈双方均非敌对，故汉匈两军可在两属国节点同格相遇并直接触发野战（城邦本地民兵两不相帮、闭城自守）；战后获胜方在该国自动获得 $+10$ 军威/威吓，战败方威望受损，且两属国有 `25%` 概率被战败方指责暗通敌军而生成 `aid_enemy_war(weight=2)` 罪状。
12. **EC-12 存档/读档（Save/Load）发生在使团半途或季末动摇预警期**：
    - `Mission` 实体的 `route_nodes`, `edge_days_progress`, `remaining_budget`, `stay_days_left` 以及 `relations[sid]` 的 `wavering_action`, `crimes_against_han` 全部作为纯 JSON 基本类型持久化进存档字典；读档后在同一 Tick 恢复寻路与倒计时，保证校验和 100% 确定性一致。

---

## 11. 调参旋钮与平衡预期（Tuning Knobs）

| 参数名称 | JSON 键（`data/balance.json`） | 默认值 | 建议可调范围 | 调高时的系统演化预期 | 调低时的系统演化预期 |
|---|---|---:|---|---|---|
| 影响力超锚点月衰减率 | `diplomacy.influence_decay_rate` | `0.025` | `0.015–0.050` | 汉方极难维持未册封远国的高影响力，必须步步为营先册封再图属国 | 汉方使团收益持久，容易在 5–6 年内平推全西域外交，汉主胜率上升 |
| 使团单次饱和上限 | `embassy.gift_max_gain` | `20.0` | `12.0–30.0` | 单支重金精使团即可大幅改写小国倾向，外交节奏加快 | 必须配合通商与军事胜利才能拉动倾向，纯外交流变慢 |
| 使团预算特征尺度 | `embassy.gift_budget_scale` | `600.0` | `400.0–1000.0` | 大额预算（1000+ 钱）的性价比下降，鼓励小额多批分散出使 | 鼓励集中国库巨款砸向单一关键大国（如乌孙） |
| 募使贪墨比例 | `embassy.recruited_embezzle_rate` | `0.30` | `0.15–0.50` | 募使买影响力的效率极差，基本沦为纯「碰瓷刷罪状」工具 | 募使性价比逼近精使，削弱具名历史使臣的不可替代性 |
| 募使受辱基础斜率 | `embassy.insult_diff_slope` | `0.005` | `0.002–0.010` | 亲匈城邦频繁羞辱/攻杀汉使，汉方极易获得合法讨伐罪状，战争频繁 | 罪状稀缺，汉方若想动武经常被迫选择矫诏或苦等事件 |
| 僮仆都尉威吓保底线 | `diplomacy.tongpu_intimidation_floor` | `30.0` | `20.0–45.0` | 在击溃僮仆都尉/迎降日逐王前，匈奴对北道属国的控制极难靠纯和平手段瓦解 | 汉方无需军事打击北道，仅靠砸钱就能把车师、焉耆和平演变过来 |
| 外交禁商走私渗漏率 | `trade.ban_leak_throughput` | `0.30` | `0.10–0.50` | 即使楼兰/车师禁商，汉方仍有保底商路微利与通商影响力渗透 | 禁商接近硬截断，汉方开局必须第一时间武力打通楼兰/车师 |
| 大军供粮兵威对数系数 | `supply_will.force_log_coeff` | `30.0` | `20.0–45.0` | 中等规模汉军（8,000 人）即可震慑沿途城邦开门献粮，远征难度降低 | 唯有倾国大军（20,000+）或极高外交影响力才能获得沿途供粮，后勤极严苛 |
| 屠城对邻国军威加成 | `punitive.sack_neighbor_awe` | `25.0` | `15.0–40.0` | 「屠轮台效应」显著，绝境中的远征军可通过屠一小城瞬间打开整条补给线 | 屠城的军事补给收益不足以抵消其 `-10` 全图影响力与 `-20` 朝廷信任惩罚 |

---

## 12. 验收测试（Acceptance Tests — Given / When / Then）

1. **AT-S04-01（开局楼兰未锁死南道商路）**：
   - **Given**：加载主剧本 `mvp_119bc` 初始状态（Tick 0），楼兰 `xn_intimidation == 55 < 60`，`trade_banned == false`。
   - **When**：推进至第 1 个月月末执行 `Trade.monthly(state)`。
   - **Then**：南道 5 国（且末至大月氏）输入吞吐率均为 `0.85`，全图当月汉方商路总收入在 `25–30` 钱之间（绝不为 `0`），且南道诸国 `han_influence` 均获得 `> 0.4` 的正向增长。
2. **AT-S04-02（使团边际递减与饱足度折损）**：
   - **Given**：且末当前 `han_influence == 20.0`, `xn_intimidation == 20.0`, `satiation == 0`。
   - **When**：同一季度内先后有两支同配置使团（各携有效预算 `600` 钱）抵达且末宣谕。
   - **Then**：第一支使团带来的影响力增量 $\Delta I_1$ 应大于 `8.0`，第二支使团因 `satiation == 1`（乘 `0.67`）与余量系数下降，其增量 $\Delta I_2$ 必须严格小于 $0.67 \times \Delta I_1$。
3. **AT-S04-03（影响力超锚点衰减防刷分）**：
   - **Given**：独立城邦于阗（`han_tier == "none"`，锚点 `10.0`）当前 `han_influence == 70.0`，切断商路且不派新使团。
   - **When**：连续推进 `12` 个月执行 `Diplomacy.monthly(state)`。
   - **Then**：于阗每月衰减 `(I - 10) * 0.025`，12 个月后 `han_influence` 必须回落至 `54.0–56.0` 区间；若将其册封为 `han_enfeoffed`（锚点 `30.0` 且月增 `+0.5`），则其自然均衡点应稳定在 `50.0` 附近。
4. **AT-S04-04（募使免占人物槽与 30% 贪墨）**：
   - **Given**：汉方所有具名人物均处于领兵或忙碌状态，`recruited_missions_this_year == 0`。
   - **When**：汉方下达 `dispatch_embassy(kind="recruited", character_id="", targets=[{state_id:"qie_mo", budget:300}])`。
   - **Then**：命令验证通过（不报 `ERR_NO_CHARACTER`），`recruited_missions_this_year` 变为 `1`，国库扣 `350` 钱；抵达且末结算时有效预算按 `210` 钱（扣除 30% 贪墨）代入公式。
5. **AT-S04-05（杀使生成罪状并解锁免矫诏讨伐）**：
   - **Given**：车师前 `crimes_against_han` 为空，`Diplomacy.has_valid_crime(state, "cheshi_qian") == false`。
   - **When**：汉募使在车师前宣谕触发杀使检定（或注入 `CrimeRecord(type="kill_envoy", weight=3)`）。
   - **Then**：`Diplomacy.has_valid_crime(state, "cheshi_qian")` 立即返回 `true`；此时下达 `declare_punitive(state_id="cheshi_qian")`，讨伐名义判定为 `"justified"`，朝廷信任扣减为 `0` 且不产生矫诏记录。
6. **AT-S04-06（城邦两属状态迁移与双向效应）**：
   - **Given**：楼兰为匈奴属国（`xn_tier == "vassal"`, `overlord == "xiongnu"`），`han_influence == 30`, `xn_resentment == 32`, `tilt == -5`, `trade_banned == true`，且有汉使团在庭。
   - **When**：汉方下达 `grant_enfeoffment(state_id="lou_lan")`。
   - **Then**：楼兰转入两属状态：`is_dual == true`, `han_tier == "enfeoffed"`, `han_enfeoffed == true`, `overlord` 仍为 `"xiongnu"`，`trade_banned` 强制置为 `false`（商路穿透恢复 `1.0`），且后续匈奴对楼兰征税的实收金额与怨恨增量减半（`×0.5`）。
7. **AT-S04-07（一季动摇预警与玩家反制平息）**：
   - **Given**：匈奴属国尉犁在 T1 季末满足叛匈条件（$X = 30 < 35 \land R_{\text{xn}} = 50 \ge 45$），首次检定后 `wavering_action` 置为 `"rebel_xn"`，`xn_tier` 仍保持 `"vassal"`。
   - **When**：匈奴在 T2 季内派 `3,000` 骑兵进驻尉犁，使 T2 季末尉犁 $X$ 升至 `52 >= 35`。
   - **Then**：T2 季末复检时尉犁叛匈条件不再满足，自动清空 `wavering_action = ""`，不发生叛离。
8. **AT-S04-08（贰师一征 vs 二征供粮意愿分段验证）**：
   - **Given**：龟兹 `pop = 16,000, defense = 2.2`（$M_{\text{eff}} = 3,072$），独立状态，`I = 15, X = 35, han_awe = 0, R_han = 5`。
   - **When**：先查询 `get_supply_stance(state, "qiu_ci", 5000)`（小军），再在邻近轮台执行屠城（令龟兹 `han_awe += 25, I -= 10, R_han += 12`）后查询 `get_supply_stance(state, "qiu_ci", 18000)`（大军）。
   - **Then**：`5,000` 汉军时返回 `stance == "CLOSED"`（配额 `0`）；屠轮台且 `18,000` 汉军压境时返回 `stance == "WELCOME"`（配额 `> 0`，单价 `0.04`）。
9. **AT-S04-09（破城三种善后政策分流验证）**：
   - **Given**：汉军围城攻陷楼兰，拥有 `kill_envoy` 罪状，国库 `1,000` 钱。
   - **When**：分别在三个平行分支中选择 `install_king`、`force_submit`、`sack`。
   - **Then**：
     - 选 `install_king`：扣 `300` 钱，楼兰 `han_tier == "puppet"`, `overlord == "han"`, `tier_lock_seasons == 4`；
     - 选 `force_submit`：扣 `0` 钱，楼兰 `han_tier == "vassal"`, `overlord == "han"`, `R_han` 比立新王高出 `20+`；
     - 选 `sack`：楼兰 `overlord == ""`, `sacked_memory_seasons == 8`，3 跳内邻国 `han_awe += 25`，全图 23 国 `han_influence -= 10`。
10. **AT-S04-10（大宛求汗血马成功与被拒生罪状）**：
    - **Given**：张骞精使团携 `600` 钱抵大宛（`da_wan`），执行 `objective = "seek_horses"`。
    - **When**：分支 A 大宛 `I = 25, Tilt = -5`；分支 B 大宛已通好且 `I = 55, Tilt = +25`。
    - **Then**：分支 A 拒献天马，大宛新增 `refuse_heavenly_horses(weight=2)` 罪状；分支 B 献马成功，`horse_tribute_han == true`，汉马匹池 `+600` 匹。
11. **AT-S04-11（日逐王降汉/罢僮仆都尉冲击验证）**：
    - **Given**：车师前、焉耆均为匈奴属国，`xn_intimidation` 分别为 `32.0` 与 `65.0`，`tongpu_active == true`。
    - **When**：调用 `Diplomacy.on_tongpu_deposed(state)` 并继续推进 3 个月（无匈奴驻军）。
    - **Then**：调用瞬间两国 $X$ 立即各减 `15.0`（车师前跌至 `17.0` 突破原 `30.0` 保底线，焉耆跌至 `50.0`），且后续每月继续按 `-2.0/月` 自由衰减。
12. **AT-S04-12（持节发诸国兵接口验证）**：
    - **Given**：汉持节者位于乌垒（`wu_lei`），2 跳内的轮台（汉属国，民兵 `336`）与尉犁（汉册封国，民兵 `420`）均满足 $I \ge 35, R_{\text{han}} \le 45$。
    - **When**：执行 `levy_vassal_troops(state, "wu_lei", 500)`。
    - **Then**：成功征得轮台 `84` 人 + 尉犁 `63` 人 = `147` 名附庸军，且两国各自扣除 `han_influence -= 10.0`、增加 `han_resentment += 8.0`。

---

## 13. 未决问题（Open Questions，已登记至 `STATUS.md`）

1. **[Q-S04-01] 汉方「两属（`is_dual`）」城邦在到期计分（S01 `S01-R05`）中的归属权重**：
   - **背景**：两属城邦名义上仍向匈奴纳半税（`overlord == "xiongnu"`），但同时受汉印绶册封（`han_enfeoffed == true`）且对汉完全开放商路与粮市。
   - **S04 当前设定（已对齐 S01）**：在 S01 都护府功业值中，两属城邦通过 `han_enfeoffed == true` 为汉方提供 `+2` 功业值（不计入汉属国 `+5`），同时在匈奴威服值 $W$ 中因其已受汉印而使匈奴对该城邦的控制得分减半（或计为动摇）。请主策划确认是否需要为 `is_dual` 单独设立计分项。
2. **[Q-S04-02] 被汉军「屠城（`sack`）」后的荒废城邦节点是否允许立即建立汉军屯田（对接 S05）**：
   - **背景**：史实中李广利前 102 年屠轮台后，汉廷于桑弘羊奏请下在轮台、渠犁直接设田官屯田（无本地城邦王室）。
   - **S04 当前设定**：被屠之城 `sacked_memory_seasons = 8` 期间仅禁止外交册封与纳属，但**允许汉军在同格直接执行 `build_tuntian`（将无主荒地转化为汉方军屯点）**。请与 S05 确认 `build_tuntian` 的节点控制权前置校验是否放行 `sacked_memory_seasons > 0` 的节点。
3. **[Q-S04-03] 匈奴是否需要「在途使者实体」还是保持即时威压指令（对接 S03）**：
   - **背景**：汉方已全面改为在途使团实体（`Mission`），而匈奴在西域驻有常设的「僮仆都尉」（驻焉耆/尉犁，地处西域腹地），其遣骑传令至各城邦仅需数日。
   - **S04 当前设定**：为凸显「帝国（万里遣使）vs 联盟（就近铁骑威压）」的不对称体验（支柱 3），匈奴的 `demand_vassal` / `demand_exclusive` / `enforce_trade_ban` 依托僮仆都尉与驻军辐射即时结算，无需再造一套同质化的匈奴使团棋子。请主策划与 S03 最终确认。
