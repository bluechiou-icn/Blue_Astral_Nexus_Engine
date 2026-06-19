# Sprint 4 Spec v4.1 — 祿忌交戰規格升級（取代 v4.0 §三 P2）

**版本**：v4.1（patch over v4.0）
**起草時間**：2026-06-19 Noon Taipei
**交付對象**：Raziel → Claude Code worker
**前提**：`ClaudeCode_20260617_4_Sprint4_Spec.md` v4.0 中 P2 為「祿忌交戰 severity 紅外框」；本檔將 P2 升級
**來源 brain dump**：`20260619_Noon_Blue_Sprint3.9_hotfix+S4_spec_update.md`（Blue 12 項中的 8, 9, 10）

---

## 〇、升級概要

| 面向 | v4.0 | v4.1 |
|---|---|---|
| 視覺呈現 | 宮格外框紅色雙線 | 宮格**外側**新增獨立金色閃爍格 |
| Severity 級數 | 3 級（critical/high/medium） | **6 級**（Level 1~6） |
| 提示資訊 | 簡略 / 部分簡稱 | 完整來源說明（含層次、干支、本盤/合盤） |
| LoE | 小 | 中（多了 6 級 mapping + source schema 升級） |

---

## 一、視覺呈現（取代 v4.0）

### 1.1 閃爍格規格
- 位置：**宮格外側**（不再用宮格自身外框）
- 配色：
  - 底色：金色 `#d4af37`
  - 外框：金色加深 `#b8941f`
  - 文字：紅字 `#dc2626`
- 動畫：閃爍頻率約 1.5s / cycle（CSS `@keyframes` 控制 opacity 0.6 ↔ 1.0）
- 內容（簡：閃爍格本身只顯示）：`祿忌交戰 Lv.4`
- 互動：
  - **滑鼠 hover** → 跳出完整提示訊息框（見 §三）
  - **點擊** → 同步跳出（mobile 友善）

### 1.2 移除項目
- v4.0 的 `renderPalace` 內紅色 / 橘色雙線分支 → 移除
- 改由新模組 `lujiConflictBadge.js` 渲染 overlay

---

## 二、Severity 6 級分類（取代 3 級）

| Level | 標籤 | 引擎判定原則（待 Cassian 對齊） |
|---|---|---|
| Level 1 | 輕微 | 單一祿/忌沖突，跨度 1 層（僅生年） |
| Level 2 | 輕度 | 單一祿/忌沖突，跨度 2 層（生年 + 大限 或 大限 + 流年） |
| Level 3 | 中度 | 雙重沖突（2 祿 vs 1 忌 / 1 祿 vs 2 忌），星曜亮度中或以下 |
| Level 4 | 偏重度 | 雙重沖突 + 星曜亮度高（廟、旺） |
| Level 5 | 重度 | 三重以上沖突（總祿+總忌 ≥ 4） |
| Level 6 | 嚴重度 | 三重以上 + 主星廟旺 + 牽動命/官/財/田任一三方 |

### 2.1 引擎側 schema 改動

| 改動 | 位置（推測） | 性質 |
|---|---|---|
| `severity: 'critical'/'high'/'medium'/'low'` → `severityLevel: 1-6` | `lib/palaceMutagens.js` | enum 擴充（保留舊欄位向下相容一個 Sprint） |
| 每條祿/忌的 `source` 升級為物件 | 同上 + `lib/synastry.js` | schema 升級（見 §三） |
| 合盤模式下交叉飛化的祿忌交戰偵測 | `/api/synastry` 回傳 + chart_compare 邏輯 | 新增 |

### 2.2 Raziel 行動項
- 與 Cassian 對齊 6 級判定的明確邊界（特別是 Level 3↔4 與 Level 5↔6 的臨界條件）
- 確認是否需新增 `triggersTrine: ['命','官','財','田']` 偵測（Level 6 必要條件）

---

## 三、提示訊息框內容（取代 v4.0 簡略版）

### 3.1 範例（Blue 田宅宮）
```
［祿忌交戰：Level 4 / 偏重度］
武曲星坐田宅宮  1祿 v.s. 2忌
─────────────────────────────
祿來源：
  • 生年祿（甲年）→ 武曲化祿
忌來源：
  • 大限忌（壬大限）→ 武曲化忌
  • 流年忌（壬寅）→ 武曲化忌
─────────────────────────────
宮位：田宅宮 / 己巳
命主：Blue（本盤）
```

### 3.2 必須欄位（schema）

```ts
type LJConflictTooltip = {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  levelLabel: '輕微' | '輕度' | '中度' | '偏重度' | '重度' | '嚴重度';
  star: string;            // 全名，例 "武曲"
  palace: string;          // 全名，例 "田宅宮"
  palaceStemBranch: string;// 例 "己巳"
  luCount: number;
  jiCount: number;
  luSources: Array<{
    layer: 'birth' | 'decade' | 'year' | 'month' | 'day' | 'hour';
    layerLabel: '生年' | '大限' | '流年' | '流月' | '流日' | '流時';
    stemBranch: string;    // 例 "甲" 或 "壬寅"
    star: string;          // 化祿的星曜全名
    ownerSide: 'self' | 'partner';  // 合盤情境用
    ownerLabel?: string;   // 例 "Blue（本盤）" 或 "Sean（配偶盤）"
  }>;
  jiSources: Array<...>;   // 同 luSources schema
};
```

### 3.3 合盤情境特別注意
- 合盤模式下需偵測 **交叉飛化** 的祿忌交戰：
  - A 的生年祿打到 B 的某宮 + B 的大限忌打到同一宮位同一星
- 提示框需明確標示每條來源來自「本盤」還是「配偶盤」
- 命主標籤格式：`Blue（本盤）`、`Sean（配偶盤）`

### 3.4 設計目標（Blue 原話）
> 「要讓剛加入汎天派的命理師能夠明白」

→ 禁止簡稱、禁止內部 enum 字串，所有 layer / star / palace 都用人類可讀的全名

---

## 四、引擎側改動需求清單

| # | 模組 | 改動 | 依存 |
|---|---|---|---|
| E1 | `lib/palaceMutagens.js` | `severityLevel: 1-6` enum + 判定邏輯 | — |
| E2 | `lib/palaceMutagens.js` | `source` 物件化（layer + layerLabel + stemBranch + star + ownerSide） | — |
| E3 | `lib/synastry.js` | 交叉飛化祿忌交戰偵測 | E1, E2 |
| E4 | `/api/chart` 回傳 | `palaceMutagens[].conflicts[]` 帶新 schema | E1, E2 |
| E5 | `/api/synastry` 回傳 | 同上 + 增加 cross-chart conflict 陣列 | E3 |

---

## 五、前端改動需求清單

| # | 模組 | 改動 | 依存 |
|---|---|---|---|
| F1 | `chart-render.js` | 移除 v4.0 紅 / 橘外框邏輯 | — |
| F2 | `public/js/lujiConflictBadge.js`（新） | 渲染金色閃爍格 overlay + 動畫 | E4 |
| F3 | `public/js/lujiConflictTooltip.js`（新） | hover / click → tooltip 完整內容 | E4 |
| F4 | `synastry-render.js`（Sprint 4 P0 新建） | 合盤模式套用 F2, F3 | E5, F2, F3 |
| F5 | `public/css/aesthetic.css` | 新增金色閃爍 keyframes + tooltip 樣式 token | — |

---

## 六、與 v4.0 其他 P 的關係

- **P0 雙人合盤獨立頁** ：不變，但 `synastry-render.js` 渲染時要套用 F2, F3, F4
- **P1 三干疊加 banner** ：不變
- **P3 格局徽章** ：不變，但會吃到 Sprint 3.9 hotfix H3（格局文字全名 + 交互色）的規格
- **P4/P5** ：不變

---

## 七、驗收

1. ✅ 引擎回傳 `severityLevel` 為 1-6 整數，與 `levelLabel` 一致
2. ✅ 每個 source 都有 layer / layerLabel / stemBranch / star / ownerSide
3. ✅ Blue 田宅宮 smoke test：產生與 §三 範例一致的 tooltip
4. ✅ Blue × Sean 合盤 smoke test：能偵測並標記交叉飛化的祿忌交戰
5. ✅ 移除 v4.0 的紅 / 橘外框
6. ✅ 金色閃爍格在宮格外側正確渲染，hover / click 都能觸發 tooltip

---

## 八、回授給 v4.0 Spec

建議在 `ClaudeCode_20260617_4_Sprint4_Spec.md` v4.0 §三 開頭加一行 redirect：

> ⚠️ 本段（P2 祿忌交戰 severity 紅外框）已被 `20260619_Sprint4_Spec_v4.1_LJ_conflict_upgrade.md` 取代，請以 v4.1 為準。
