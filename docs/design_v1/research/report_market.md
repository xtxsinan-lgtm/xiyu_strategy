# 历史向地图策略游戏成败分析报告 —— 为《西域·汉匈争霸》提供的市场参考

> **数据口径说明**
> - Steam 评价数、好评率、简中评价数/好评率：调用 Steam 官方 `appreviews` 接口实时抓取（`language=all` 与 `language=schinese`），快照时间 **2026-10-15**。
> - 历史峰值同时在线（All-time peak）与近 30 日均值：来自 SteamCharts（`https://steamcharts.com/app/<appid>`），同日快照。
> - 销量、事件时间线：来自 Wikipedia、Steam 官方公告（Steam News API）与媒体报道，均在文中给出 URL。
> - 由于 search_web 当日返回为空、Reddit/PC Gamer 拒绝抓取（403），玩家声音主要取自 **Steam 最有帮助评测**（英文与简中），这同样是最具代表性的“玩家共识”来源。凡凭行业常识补充、未能当日复核的说法，会标注“（行业常识，未复核）”。
> - “简中占比”= 简体中文评价数 / 全部评价数，用作国区玩家占比的近似代理（实际购买占比通常更低，因为中国玩家写评测意愿较高）。

---

## 一、各游戏简表

### 1.1 Paradox 大战略

| 游戏 | 类型/规模 | Steam 评价（总数/好评率） | 简中（数/好评率，占比） | 历史峰值 | 关键事实 | 成败关键点 |
|---|---|---|---|---|---|---|
| **Europa Universalis IV** (2013) | 大战略，大厂 | 152,966 / 77% | 14,861 / 80%（9.7%） | 47,844 | 售出 400 万+（2024.2）[W-EU4] | 13 年 DLC 长尾；“任何国家任何日期开局”的沙盒重玩性；DLC 价格堆叠是长期差评来源 |
| **Europa Universalis V** (2025.11.4) | 大战略，大厂 | 34,061 / **59% Mixed** | 3,946 / **44%**（11.6%） | 72,816（SteamDB 报 77k） | IGN 赞其模拟深度但指出平衡问题；RPS 称其“overwhelming”的复杂度使之比其他 P 社游戏更难入门 [W-EU5] | 首发峰值高（IP 号召力）但口碑崩：最高赞差评“等五年花 200 刀才是它发售时该有的样子”（1084 赞）[S-EU5]。之后 1.1–1.4 补丁 + 问卷 + Roadmap 补救 |
| **Crusader Kings III** (2020) | 角色驱动大战略 | 155,089 / 85% | 22,854 / 89%（14.7%） | 98,474 | 首月 100 万、2025.4 达 400 万；P 社首月销量纪录 [W-CK3] | **“故事生成器”**：以人物而非国家为单位，玩家自发写 AAR/做梗图，传播性最强的 P 社作品；教程与 UI 提示（嵌套 tooltip）大幅降低门槛 |
| **Crusader Kings II** (2012) | 同上 | 78,981 / 86% | 3,923 / 86% | — | 2019 年基础版免费 | 证明了人物系统 + 事件链 + DLC 长尾的可行性 |
| **Hearts of Iron IV** (2016) | 二战大战略 | 445,412 / 75% | 8,857 / 84% | 93,196（近 30 日峰值仍有 64,700） | Steam 上已售 700 万+（2025.11）[W-HOI4] | 题材（二战）+ **国策树（Focus Tree）把历史分叉做成可读的“剧本”** + 史上最强 mod 生态（Kaiserreich 等）；多人社群 |
| **Victoria 3** (2022) | 经济模拟大战略 | 66,684 / **65% Mixed** | 13,912 / 68%（20.9%） | 69,663 | 首月 50 万份 [N-V3a] | 首发叫好（Metacritic 好评、教程获 Destructoid 赞赏）但玩家认为“核心玩法不好玩”（4036 赞差评），战争被抽象成“前线”，缺乏操作感；1.5 后 Roadmap 修复，2025 年 DLC 带来部分回暖 [N-V3b] |
| **Imperator: Rome** (2019) | 古代大战略 | 27,786 / 64% Mixed | 3,046 / **46%**（11%） | 29,077（现约 300 人） | 发售时“玩家评分低于预期但销量超出预期”；2.0 “Marius”（2020，行业常识）大改后口碑回升，但 2021 年 5 月工作室拆分、开发中止；2022 年宣布不再更新 [W-IR][N-IR] | **失败典型**：发售时“mana 点数”（政治点）驱动一切、缺乏“这个时代独有的味道”、难度太低（最高赞差评：“最小部落第一局就统一不列颠”）、部落玩法空洞。2.0 证明可修复，但**首发口碑决定生死**；2023–2024 由前开发者自发做 2.0.4/2.0.5 维护补丁、开放 mod 工具，社区 mod（Invictus）延续生命 |

### 1.2 全面战争（Creative Assembly）

| 游戏 | Steam（总数/好评率） | 简中（数/好评/占比） | 历史峰值 | 关键事实 | 成败关键点 |
|---|---|---|---|---|---|
| **Rome II** (2013) | 94,636 / 84%（Emperor Edition） | 3,439 / 82% | 118,240 | 发售 bug/AI 灾难，CA 创意总监公开道歉；2014 年 Emperor Edition 修复 AI 与技术问题；截至 2014.3 欧美卖出 113 万份 [W-R2] | **长期修复可以翻盘**：免费大补丁 + 免费重制版本把“灾难”变成“系列常青” |
| **Rome Remastered** (2021) | 13,881 / 77% | 914 / 60% | 18,407 | — | 怀旧 IP 也需要真正的现代化 |
| **Shogun 2** (2011) | 69,468 / **91%** | 8,078 / 85% | — | — | 范围小（单一日本）、聚焦、平衡打磨好 → 系列口碑巅峰之一。**范围收窄≠失败** |
| **Attila** (2015) | 37,901 / 82% | 2,700 / 81% | 26,237 | — | 气氛（末日感、游牧民族/部落迁徙机制）独特；发售时被认为性能差，后被重新评价 |
| **Three Kingdoms** (2019) | 108,440 / 73% | **52,021 / 80%（占比 48%）** | **191,816** | 系列最快销售（一周 100 万），截至 2025.3 累计 **321 万**份；首周末 19.2 万同时在线，为当时 Steam 同时在线最高的策略游戏 [W-3K]；2021.5.27 CA 宣布“Moving on”，停止 DLC 与补丁，当日约 1,500 条差评 [N-3Ka][N-3Kb] | **中国题材的天花板证明**：近一半评测来自简中。人物（武将）驱动、演义/史实双模式、关系网络是亮点；败笔在于中后期内容少、天子/朝廷背景板化、mod 兼容性差（简中高赞差评）、DLC 节奏碎片化（“八王之乱”等选题争议），最终 2 年即“断供”，北方异族 DLC 期待落空 |
| **Troy** (2020) | 3,859 / 72% | 425 / 67% | 4,638（Steam 晚一年上架） | Epic 首日免费领取 **750 万**份 [W-Troy] | 免费大曝光≠长线社区；史实/神话的题材取舍让两边都不满 |
| **Pharaoh** (2023) | 5,431 / **63% Mixed** | 542 / 49% | **4,858**（系列最低级别） | 2023.12 原价 $59.99 降至 $39.99、对已购玩家部分退款、第一个派系包免费、削减 DLC；2024.7.25 免费大更新 **Dynasties**（地图扩至爱琴海/两河，168 个新据点、王朝系统）[W-Ph][N-Ph] | **失败典型**：小众时代（青铜崩溃）+ 3A 定价 + 派系/兵种少（高赞差评：“机制上最好之一，性价比最差之一”）。Dynasties 版本评价回到 77%（6,826 评，峰值 6,643），但难挽回首发 |
| **Warhammer III**（对照） | 150,592 / 72% | 24,000 / 61% | 166,519 | 近 30 日峰值仍达 102,170 | 奇幻 IP 的极端非对称（每族独特机制）是 TW 现今的主力收入；说明“非对称性”是重玩性的核心引擎 |
| Medieval II DE（对照） | 36,626 / **96%** | 812 / 88% | — | — | 老作品因 mod 生态常青 |

### 1.3 中国/东亚题材

| 游戏 | 团队/定价 | Steam（总/好评） | 简中（数/好评/占比） | 历史峰值 | 成败关键点 |
|---|---|---|---|---|---|
| **白日升 Rise of the White Sun**（2023.9.21，英文名准确为 *Rise Of The White Sun*，appid 1189100）[S-WS] | **单人开发者 Maestro Cinetik（西方开发者）**，$24.99 | 775 / **86% Very Positive** | 559 / 86%（**72%**） | 257 | 军阀混战时代（1920s）中国沙盘大战略：鸦片、欠饷、哗变、军阀派系、共产党地下组织、帮会。玩家评价“未打磨、不直观，但是一人的爱之作”。2025–2026 持续推新剧本（北伐沙盒）与 DLC《Two Suns Under the Sky》（1931–33）[N-WS]。**小而美、高好评、低销量**：题材独特性 + 历史细节赢口碑，UI/教程拖累规模 |
| **横戈 Ancient Warfare: The Han Dynasty**（2023.9.26 EA，appid 1423330）[S-HG] | 不秋草游戏工作室（约 5 人，玩家称“夫妻档”），方块游戏发行，$16.99 | 2,105 / **67% Mixed** | 2,008 / 67%（**95%**） | 1,075 | **与本项目题材几乎重叠**：从玉门关出发、汉军远征西域驱逐匈奴，含“十三将士归玉门”（耿恭疏勒）剧情，大战略+RTS+RPG（套用全战三国框架）。2024 年范围扩张到“东汉十三州”、汉末群雄；2025.7 后近一年停更，玩家指控“拿横戈的钱做《三国疆场》”“赛博烂尾楼”；2026.7.21 发致歉信承诺修 bug 并“给游戏一个更体面的结局”[N-HG]。高赞好评建议：“没有建模就别学全战，往 P 社/模拟经营靠，汉军做朝廷支援+精兵稀少，匈奴做游牧战帮不能直接控城、靠掠夺” |
| **汉匈决战 Gloria Sinica: Han Xiongnu Wars**（2017，appid 688470） | 尚世轩工作室，$6.99 | 4,120 / 60% Mixed | 3,942 / 60%（96%） | 3,469 | 前身为骑砍知名 mod《汉匈全面战争》。差评：bug 多、为剧情限制自由沙盒、多人模式内购与私服问题、天灾等“反人类设置”。**教训：从 mod 到商业化时背离核心玩家期待** |
| **全战三国**（见上） | — | — | 52,021 / 80%（48%） | 191,816 | 中国题材最大规模商业成功 |
| **三国志14**（2020） | 光荣，$59.99 | 16,374 / 63% Mixed | 11,565 / 62%（71%） | 16,482 | 2021 年出货 50 万份 [W-RTK14]。“涂色”领土机制有新意；被批 DLC 拆卖、AI 与后期乏味 |
| **三国志8 Remake**（2024） | 光荣，$59.99 | 3,981 / **50%** | 1,472 / **39%** | 17,513 | 简中高赞差评：“重制了外表，内核还是老一套”“AI 立绘”“砍掉个性系统”。**IP 与美术不能代替玩法进化** |
| **信长之野望·新生**（2022） | 光荣 | 2,762 / 74% | 1,383 / 77% | 11,717 | 系列稳定盘，主力仍在日本主机市场 |
| **太吾绘卷**（2018 EA） | 螺舟工作室 | 70,442 / 65% Mixed | 67,507 / 65%（96%） | 72,196 | 国产独立爆款：武侠传承+生成式人物/世界，EA 期长期重制引发口碑分化（行业常识，未复核细节）。**“生成式故事 + 传承”是国区最能引爆的机制** |
| **部落与弯刀 Sands of Salzaar** | 小团队，$14.99 | 23,056 / 82% | 19,700 / 82%（85%） | 21,047 | 国产“骑砍 like”，低预算俯视角 + 沙盒征战 + 角色养成即可成功 |
| **三国赵云传（重制）**、**汉末霸业免费版** | — | 4,342 / 66%；43 / 44% | — | 8,551；— | 情怀 IP 与免费版不能弥补内容空洞 |

### 1.4 独立/中小团队历史与类历史策略

| 游戏 | 团队 | Steam（总/好评） | 简中 | 峰值 | 成败关键点 |
|---|---|---|---|---|---|
| **Manor Lords**（2024 EA） | **单人起家** Greg Styczeń，Hooded Horse 发行，$39.99（快照为折扣价） | 92,670 / 84% | 9,405 / **53%** | **172,605** | 上线前 Steam 愿望单第一（300 万+），首周末 100 万份，2025.2 达 300 万、2026.8 达 **400 万** [W-ML][N-ML]。成功：写实中世纪视觉、GIF 级可传播画面、“有机”城建；风险：2025 年近 9 个月无更新，开发者公开“反思”。国区好评仅 53%（内容量不足） |
| **Against the Storm**（2021 EA） | Eremite Games（波兰小团队），Hooded Horse | 37,749 / **94%** | 5,833 / 92% | 12,832 | 2024.5 销量破 100 万 [W-AtS]。“Roguelite 城建”：**单局 1–2 小时 + 元进度**，彻底解决中后期乏味 |
| **Old World**（2020 EA，Epic 独占→2022 Steam） | Mohawk Games，Soren Johnson（文明4 主设计） | 6,970 / 83% | 446 / 71% | 3,565（Steam） | **订单（Orders）作为统一行动资源** + CK 式人物/事件 + 古代题材；7 个 DLC（含 Yuezhi 月氏），2025.1 宣布重要销量里程碑 [W-OW][N-OW] |
| **Shadow Empire**（2020） | Vic Reijkersz（VR Designs，几乎单人），Matrix 发行，$39.99 | 1,977 / 83% | 28 | 594 | 程序生成星球 + **后勤补给链** + 官僚人物/卡牌。Wargamer：“当代的半人马座阿尔法”；PC Gamer：复杂度不透明、“黑箱” [W-SE]。**硬核小众可盈利，但天花板低** |
| **Unity of Command II**（2019） | 2x2 Games | 2,224 / 80% | 417 / 79% | 611 | **补给即玩法**；有意“给二战的系统复杂度一个结构，但不让玩家被无数系统淹没”；GameSpot 批图标与教程 [W-UoC2] |
| **Ultimate General: Civil War**（2017） | Game-Labs（DarthMod 作者 Nick Thomadis 创立） | 8,623 / **89%** | 999 / 86% | 1,678 | 手绘地图 + 战役连续性（伤亡带入下一战）；从 *Gettysburg* 单战役小作起步，后被 Stillfront 以 3,250 万美元收购 [W-UG] |
| **Terra Invicta**（2022 EA → 2026.1 正式版） | Pavonis（Long War mod 团队），Hooded Horse | 9,986 / 80% | 955 / 66% | 9,826 | “可能是我玩过最密集的游戏”，但阴谋/阵营叙事驱动让复杂度可接受 [W-TI]。**复杂度可以卖，前提是有明确主线张力** |
| **Grand Tactician: The Civil War** | 小团队，$44.99 | 2,422 / 75% | 38 | 860 | 战略+即时战术，范围过大导致打磨不足 |
| **Field of Glory: Empires**（2019） | AGEOD/Slitherine，$39.99 | 870 / 82% | 41 | 466 | 古代（前 270 年起）帝国衰败机制有深度，但界面老旧、营销弱 → **好评但冷门** |
| **Hegemony III** | Longbow Games | 558 / 82% | 10 | — | 无缝地图 + 补给线，小众到几乎无声 |
| **Knights of Honor II: Sovereign**（2022） | Black Sea Games，THQ Nordic，$44.99 | 6,804 / 77% | 578 / 66% | 6,034 | 媒体称其为“文明与十字军之王之间易上手的桥梁” [W-KoH2]；AI 与后期乏味被诟病 |
| **Cossacks 3**（2016） | GSC，$19.99 | 16,237 / 82% | 129 | 5,533 | 老 IP 重制 + 完整 mod 支持 + 每 2 个月一个 DLC [W-C3] |
| **Diplomacy is Not an Option** | Door 407 | 12,780 / 86% | 2,199 / 82% | 5,939 | 幽默反讽 + 万人同屏的“可剪辑名场面” |
| **Mount & Blade II: Bannerlord** | TaleWorlds | 299,468 / 88% | 73,370 / 86%（24.5%） | 248,034 | 2020 年最大 Steam 首发；**“从小兵到君王”的个人化沙盒** + mod 生态；国区第二大市场 |
| **失败/冷门案例**：Grand Ages: Medieval | Gaming Minds/Kalypso | 1,978 / **48%** | 166 / 36% | 4,261（现 15） | 宣传大、深度浅、AI 与后期空洞 |
| Imperiums: Greek Wars | 独立 | 549 / 85% | — | **152** | 好评却无人知晓：题材与画面无辨识度、营销缺位 |
| Aggressors: Ancient Rome | 独立 | 282 / 82% | 3 | — | 同上；“硬核但丑”的天花板 |

---

## 二、成功共性规律（可操作）

### 规律 1：每回合都必须有“有代价的选择”，而且选择数要少
- Old World 用 **Orders（命令点）** 把所有行动统一到一个稀缺资源上：移动、建造、外交、事件都抢同一池子，每回合必然取舍。
- Unity of Command II 设计者明说要“给系统复杂度一个结构，而不是用无数系统淹没玩家”[W-UoC2]。
- Against the Storm 的每个决策（建筑蓝图三选一、贸易、风暴季）都在 1–2 小时一局里收束。
- **反例**：Imperator 1.0 的政治点（mana）对所有行动收费，却没有“这个时代独有”的取舍；Victoria 3 把战争抽象到无法操作，玩家觉得“核心玩法不好玩”。
- 操作建议：每回合 3–5 个“值得思考”的命令，每个命令至少与一个长期资源（后勤、影响力、威望）冲突。

### 规律 2：人物驱动 = 故事生成器 = 传播引擎
- CK3（400 万份、首月 100 万）、全战三国（武将关系网、321 万份）、太吾绘卷（7.2 万峰值）、Bannerlord 都靠 **具名人物 + 关系 + 事件**，产生“我的霍去病病死在祁连山”这种可复述的故事。
- 全战三国 Guardian 评测：“最伟大的故事是关于人，而不是帝国”[W-3K]。
- Imperator 的教训：有人物系统但人物只是数值，2.0 才补上家族/事件内容。
- 操作建议：每个节点/军团有带性格的主将；关键人物（卫青、霍去病、张骞、伊稚斜、浑邪王、乌孙昆莫、细君公主）有事件链；把**人物死亡、叛降、和亲**做成剧本分支点。

### 规律 3：非对称性是重玩性的第一引擎
- Warhammer III 每族不同机制，近 30 日峰值仍超 10 万；HOI4 的国策树让每国像一个独立剧本。
- 横戈高赞建议也是同一思路：汉=朝廷支援、精兵稀少难补员；匈奴=不能直接控城、靠掠夺；西域城邦=重生产与外交。
- 操作建议：汉与匈奴不只是数值不同，而要**胜利条件、经济模型、信息结构都不同**（汉：屯田/驿站/补给线+朝议压力；匈奴：机动+劫掠+部落忠诚+季节牧场）。

### 规律 4：后勤要“可视化成玩法”，而不是记账
- Unity of Command（补给即胜负）、Shadow Empire（补给链）、Hegemony（补给半径）的口碑都来自“看得见的补给线”。
- Shadow Empire 被批“黑箱”，说明**可读性是后勤玩法的生死线**。
- 操作建议：补给在节点地图上用线宽/颜色实时显示；WEGO 结算回放时清晰标注“因断粮减员 X”。

### 规律 5：小范围、强聚焦、打磨到位 > 大地图大而全
- Shogun 2（91%）、Ultimate General: Gettysburg → Civil War、Unity of Command 都从一个战役/一个国家开始。
- Manor Lords 开发者在首发前一周公开降低期待：“不是全战的对手，也不是天国拯救”[W-ML]，反而保护了口碑。
- **反例**：横戈从西域扩张到“东汉十三州+汉末群雄”后停更；Grand Tactician、Grand Ages: Medieval 范围过大导致打磨不足。

### 规律 6：抢先体验（EA）+ 高频透明沟通 + 发行商背书
- Hooded Horse 系（Manor Lords、Against the Storm、Terra Invicta）都是：长期 EA、Discord 社区、Beta 分支、发行商 CEO 亲自发开发进度帖 [N-ML]。
- 白日升单人开发者也保持每 1–2 个月发更新/剧本，并公开年度定价与开发计划 [N-WS]。
- EU5 首发崩后靠 Tinto Talks 周更开发日志 + 官方问卷 + Roadmap 挽回 [N-EU5]。

### 规律 7：定价要与“内容量/打磨度”匹配
- Pharaoh 以 $59.99 卖小众时代 → 降价并部分退款；EU5 $59.99 首发高价被骂“半成品”；三国志8R $59.99 获 39% 简中好评。
- 成功独立游戏定价多在 $20–40，并在 EA 期间低于正式价。

### 规律 8：mod 支持是长尾的保险
- HOI4、EU4、M2TW（96%）、Bannerlord、Cossacks 3 的长尾都依靠 mod；Imperator 停更后仍靠 Jomini 工具与社区 mod（以及官方 2.0.4“增加 25 项 mod 工具”）延续生命 [N-IR]。
- 全战三国简中高赞差评专门批评 mod 冲突（startpos/CEO 只能加载一个）[S-3K]。
- 操作建议：Godot 下尽早把**剧本、人物、事件、节点数据外置为 JSON/资源文件**。

### 规律 9：可传播性——“截图/短视频能看懂”
- Manor Lords 的写实镜头、DINO 的万人同屏、CK3 的人物梗，都可以靠一张图或一个短视频传播。
- 节点地图策略在视觉上天然吃亏，需要靠**“战报/回放/史书式结算文本”**和**地图美术（古地图、绢本风格）**来补。

---

## 三、失败共性教训

1. **首发不完整 = 口碑永久折损**：Imperator（64%）、Victoria 3（65%）、EU5（59%）、Pharaoh（63%），后续补丁能改善近期评价，但总评与峰值无法恢复。Rome II 是少数翻盘案例，前提是 CA 的体量和长期免费修复。
2. **系统多而“时代味”少**：Imperator 1.0 被批“EU4 换皮 + mana”；三国志8R 被批“老内核换皮”。历史题材玩家买的是“这个时代的独特问题”。
3. **中后期乏味（snowball）**：Imperator“最小部落轻松统一”，3K/三国志14 的后期涂地乏味，Knights of Honor II 后期 AI 无力。没有内部危机、继承、叛乱、天灾等反滚雪球机制。
4. **AI 弱化了非对称和后勤的意义**：Rome II 首发 AI、Grand Ages: Medieval 被批 AI 空洞。非对称游戏的 AI 更难做，必须早投入。
5. **范围扩张与停更**：横戈（扩张到汉末→停更近一年→致歉）、全战三国（2 年断供，北方异族 DLC 落空引发约 1,500 条差评）、Imperator（团队重组后放弃）、Manor Lords（9 个月无更新）。**EA 游戏最怕“沉默”**。
6. **背离核心玩家期望**：汉匈决战把骑砍 mod 的自由沙盒限制为线性剧情、加入多人内购，60% 评价。
7. **定价/DLC 策略激怒玩家**：Pharaoh 降价退款；三国志14 DLC 拆卖；EU5“等五年花 200 刀”。
8. **教程与可读性不足**：Unity of Command II（图标/教程被 GameSpot 批）、Shadow Empire（黑箱）、白日升（“不直观、缺少解释”）——都好评但规模受限。
9. **好评但无人知晓**：Imperiums: Greek Wars（峰值 152）、Aggressors、Field of Glory: Empires（峰值 466）、Hegemony III——画面辨识度低、无社区运营、无主播内容，**“好玩”不足以自我传播**。
10. **国区特殊风险**：国区玩家评价更严苛（Manor Lords 总评 84% vs 简中 53%；EU5 59% vs 44%；Imperator 64% vs 46%），且对“水军”“跑路”“AI 立绘”极其敏感（横戈、三国志8R 的高赞差评）。

---

## 四、对小团队/独立中国历史题材策略游戏的特别启示 Top 10

### 1. 市场是真实存在的，但国区占比极高，必须“双语双市场”设计
全战三国 48% 评价来自简中，太吾 96%、部落与弯刀 85%、横戈 95%、白日升 72%。中国题材的**第一市场一定是国区**，但仅靠国区天花板有限（横戈峰值 1,075，汉匈决战 3,469）。全战三国证明了“中国古代题材 + 西方易懂的系统”可以全球卖到 300 万份以上。**建议**：首发即完整中英双语，英文侧用“Han vs Xiongnu = Rome vs Parthia / Steppe empire”类比解释；商店页第一屏讲清楚“非对称：帝国 vs 草原”。

### 2. 你有一个直接的“前车之鉴竞品”：横戈——学它的题材热度，避开它的三个坑
横戈证明“汉匈西域”题材在国区能吸引关注（2,000+ 评价、耿恭“十三将士归玉门”剧情引发情感共鸣），但它踩了：① 套用全战三国框架却没有 3D 战场的预算；② 范围扩张到东汉十三州/汉末；③ 停更沉默近一年。**建议**：坚持节点地图 + WEGO 的“桌游化”定位（不跟全战比战场画面），范围锁定前 119–前 60 年（漠北之战→西域都护府设立）这一段，按剧本逐个打磨。

### 3. 核心循环用“命令稀缺 + 同时结算”制造每回合的两难
参考 Old World 的命令点与 Unity of Command 的补给结构：每回合给少量命令（如“调兵/屯田/遣使/威吓/劫掠”），WEGO 同时下令天然带来“猜对手”的心理博弈（Diplomacy 式）。**建议**：在结算后提供“战报 + 回放”，让玩家理解“为什么我输了”（可读性），这也是最好的短视频素材。

### 4. 把非对称性做到胜利条件和信息层面
汉：补给线、屯田、驿站、朝廷耐心值（国库/民力，朝议压力会召回将领）、外交（和亲、册封、质子）；匈奴：机动、季节牧场、劫掠获取补给、部落忠诚（单于威望不足则部落降汉——浑邪王降汉即是史实钩子）、信息迷雾优势。**建议**：两方的教程/首个剧本分别设计，像 Warhammer 一样让“换边再玩一遍”成为第二次购买理由。

### 5. 人物与事件链是低成本高回报的内容
CK3、全战三国、太吾都证明人物驱动叙事是中国玩家最买账的部分（三国题材的流量本质是“武将”）。汉匈时代人物极具戏剧性：卫青、霍去病（早逝）、李广（迷路自刎）、李陵（降匈）、苏武（牧羊）、张骞、细君/解忧公主、伊稚斜、军臣、日逐王。**建议**：用文字事件 + 立绘（**务必人工绘制**，避免“AI 立绘”舆情——三国志8R 前车之鉴）+ 史料引文，成本远低于 3D 战场。

### 6. 用“剧本制 + 局长可控”解决中后期乏味
Against the Storm 的 1–2 小时一局、Unity of Command 的战役关卡、Ultimate General 的战役连续性都避免了 4X 式后期涂地。**建议**：拆成 3–5 个历史剧本（河西之战/漠北之战/大宛之战/西域都护之争），每个 20–40 回合，含明确胜负与历史对照评分；外加一个随机化沙盒（随机人物属性、随机事件、随机城邦倾向）提供重玩性。

### 7. 发售策略：EA + 小定价 + 透明路线图，绝不沉默
参考 Hooded Horse 系与白日升：EA 期 \$15–20（国区 ¥38–58 区间），在商店页写明 Roadmap，固定节奏（如每 6–8 周）发更新日志。**建议**：如果需要休整，提前公告；“沉默半年”在国区会被直接定性为“跑路”（横戈的教训）。考虑与独立策略发行商（Hooded Horse、Slitherine/Matrix 等）接触以获得海外曝光。

### 8. AI 必须在早期投入，并善用“规则化 AI + 剧本脚本”
小团队做不了通用强 AI，但节点地图 + WEGO 状态空间小，适合**基于效用评分的 AI + 剧本历史倾向脚本**（例如匈奴 AI 在秋季倾向劫掠）。Imperator“太简单”与 Grand Ages 的空洞 AI 都是差评主因。**建议**：从第一个可玩版本起就做 AI vs AI 自动对局测试与胜率统计。

### 9. Mod/数据外置与多人：长尾与社群的保险
HOI4/EU4/骑砍的长尾全靠 mod；全战三国 mod 冲突被高赞差评点名。WEGO 天然适合异步多人（Play-by-Email 式），可作为社群黏合剂。**建议**：人物、事件、节点、兵种全部数据驱动并开放；多人优先做“双人汉匈对战 + 异步回合”，成本低、主播友好（两名主播对抗）。

### 10. 视觉与传播：用“古地图美学 + 史书式战报”建立辨识度
节点地图游戏最大的风险是“好评但无人知晓”（Field of Glory: Empires、Imperiums、Hegemony III）。白日升画面朴素依然 86% 好评，但峰值只有 257。**建议**：统一绢本/简牍/汉画像石美术风格；每局结束生成“《史记》体”战报（可一键分享图片）；在 B 站做“历史对照”内容（如“如果霍去病没有早逝”），这是 HOI4 与 CK3 在国内破圈的主要路径。商店页避开空泛宣传，强调“真实后勤、非对称、同时下令”三个可验证卖点；**切勿“水军式”铺量宣传**，国区玩家对此极其反感（横戈高赞差评 600 赞即批评“铺天盖地的夸赞”）。

---

## 附：引用来源

**Steam 商店页（评价数据来源，appreviews API 同 appid）**
- [S-EU5] https://store.steampowered.com/app/3450310 （EU5 差评引文）
- EU4 https://store.steampowered.com/app/236850 ；CK3 https://store.steampowered.com/app/1158310 ；CK2 https://store.steampowered.com/app/203770 ；HOI4 https://store.steampowered.com/app/394360 ；Victoria 3 https://store.steampowered.com/app/529340 ；Imperator https://store.steampowered.com/app/859580
- 3K [S-3K] https://store.steampowered.com/app/779340 ；Rome II https://store.steampowered.com/app/214950 ；Rome Remastered https://store.steampowered.com/app/885970 ；Troy https://store.steampowered.com/app/1099410 ；Pharaoh https://store.steampowered.com/app/1937780 ；Pharaoh Dynasties https://store.steampowered.com/app/2951630 ；Attila https://store.steampowered.com/app/325610 ；Shogun 2 https://store.steampowered.com/app/201270 ；WH3 https://store.steampowered.com/app/1142710 ；Medieval II DE https://store.steampowered.com/app/4700
- [S-WS] 白日升 https://store.steampowered.com/app/1189100 ；[S-HG] 横戈 https://store.steampowered.com/app/1423330 ；汉匈决战 https://store.steampowered.com/app/688470 ；太吾绘卷 https://store.steampowered.com/app/838350 ；部落与弯刀 https://store.steampowered.com/app/1094520 ；三国志14 https://store.steampowered.com/app/872410 ；三国志8R https://store.steampowered.com/app/2288150 ；信长之野望·新生 https://store.steampowered.com/app/1336980 ；三国赵云传 https://store.steampowered.com/app/2201710
- Manor Lords https://store.steampowered.com/app/1363080 ；Against the Storm https://store.steampowered.com/app/1336490 ；Old World https://store.steampowered.com/app/597180 ；Shadow Empire https://store.steampowered.com/app/1154840 ；Unity of Command II https://store.steampowered.com/app/809230 ；Ultimate General: Civil War https://store.steampowered.com/app/502520 ；Terra Invicta https://store.steampowered.com/app/1176470 ；Grand Tactician https://store.steampowered.com/app/654890 ；Field of Glory: Empires https://store.steampowered.com/app/1011390 ；Hegemony III https://store.steampowered.com/app/308173 ；Knights of Honor II https://store.steampowered.com/app/736820 ；Cossacks 3 https://store.steampowered.com/app/333420 ；DINO https://store.steampowered.com/app/1272320 ；Bannerlord https://store.steampowered.com/app/261550 ；Grand Ages: Medieval https://store.steampowered.com/app/310470 ；Imperiums https://store.steampowered.com/app/1183470 ；Aggressors https://store.steampowered.com/app/783210

**峰值数据**：https://steamcharts.com/app/<appid>（如 https://steamcharts.com/app/779340 、https://steamcharts.com/app/3450310 、https://steamcharts.com/app/1423330 ）

**Wikipedia**
- [W-IR] https://en.wikipedia.org/wiki/Imperator:_Rome
- [W-3K] https://en.wikipedia.org/wiki/Total_War:_Three_Kingdoms （一周百万：https://www.pcgamer.com/total-war-three-kingdoms-sold-a-million-copies-in-a-week/ ）
- [W-Ph] https://en.wikipedia.org/wiki/Total_War:_Pharaoh
- [W-Troy] https://en.wikipedia.org/wiki/Total_War_Saga:_Troy
- [W-R2] https://en.wikipedia.org/wiki/Total_War:_Rome_II
- [W-CK3] https://en.wikipedia.org/wiki/Crusader_Kings_III
- [W-EU4] https://en.wikipedia.org/wiki/Europa_Universalis_IV ；[W-EU5] https://en.wikipedia.org/wiki/Europa_Universalis_V ；[W-HOI4] https://en.wikipedia.org/wiki/Hearts_of_Iron_IV
- [W-ML] https://en.wikipedia.org/wiki/Manor_Lords ；[W-AtS] https://en.wikipedia.org/wiki/Against_the_Storm_(video_game) ；[W-OW] https://en.wikipedia.org/wiki/Old_World_(video_game)
- [W-SE] https://en.wikipedia.org/wiki/Shadow_Empire ；[W-UoC2] https://en.wikipedia.org/wiki/Unity_of_Command_II ；[W-UG] https://en.wikipedia.org/wiki/Ultimate_General:_Civil_War ；[W-TI] https://en.wikipedia.org/wiki/Terra_Invicta
- [W-RTK14] https://en.wikipedia.org/wiki/Romance_of_the_Three_Kingdoms_XIV ；[W-C3] https://en.wikipedia.org/wiki/Cossacks_3 ；[W-KoH2] https://en.wikipedia.org/wiki/Knights_of_Honor_II:_Sovereign ；Bannerlord https://en.wikipedia.org/wiki/Mount_%26_Blade_II:_Bannerlord

**官方公告/新闻（Steam News）**
- [N-3Ka] CA “Moving on from Total War: THREE KINGDOMS”（2021.5.27）：https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/4069544815356399742
- [N-3Kb] Strategy Gamer “Three Kingdoms is getting review bombed after devs terminate support”：https://steamstore-a.akamaihd.net/news/externalpost/Strategy%20Gamer/4069544815360694487
- [N-IR] Imperator 2.0.4 Augustus（2024.4.25）：https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/5759616966663772076 ；RPS“PDS 拆分为三个工作室，无一开发 Imperator”（2021.5）：https://steamstore-a.akamaihd.net/news/externalpost/Rock,%20Paper,%20Shotgun/4074045878080800161
- [N-Ph] Pharaoh DYNASTIES 上线（2024.7.25）：https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/5963413094348379936
- [N-V3a] Victoria 3 首月 50 万（PCGamesN/GamingOnLinux，2022.11.29/12.1，见 Steam News appid 529340）；[N-V3b] Dev Diary #102 “What’s next after 1.5”（2023.12.7）及 PCGamesN “New Victoria 3 DLC sparks major comeback”（2025.6.30）
- [N-EU5] SteamDB “Europa Universalis V peaks at 77k players”（2025.11.4）；“The Future of EU5 – Grand Voyage Roadmap”（2026.5.4）；“Update 1.3 – Official Community Feedback Survey”（2026.7.21）（均见 Steam News appid 3450310）
- [N-ML] PC Gamer “Manor Lords celebrates 4 million copies sold”（2026.8.27）；PC Gamer “Manor Lords gets its first update since January…rethinking what went wrong”（2025.10.5）（Steam News appid 1363080）
- [N-OW] GamingOnLinux “Old World Wrath of Gods… big sales milestone”（2025.1.31）：https://www.gamingonlinux.com/2025/01/calamities-are-coming-to-old-world-in-the-wrath-of-gods-dlc-plus-they-hit-a-big-sales-milestone/
- [N-HG] 横戈 “V0.9.0.3 Update & A Letter to the Community”（2026.7.21）：https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1838407329268554 ；V0.7.7.3（2024.7.1，宣布地图扩展至东汉十三州）与 V0.7.9.2（2024.7.25，新增汉末历史线/凉州）公告（Steam News appid 1423330）
- [N-WS] 白日升 “2026 Long-Term Development and Pricing”（2025.12.18）、“Northern Expedition Sandbox”（2026.3.19）、“What's next?”（2026.9.6，DLC《Two Suns Under the Sky》）（Steam News appid 1189100）
