# Dev Brief Report — 2026.06.06
**Project:** Blue Astral Nexus Engine
**Repo:** https://github.com/bluechiou-icn/Blue_Astral_Nexus_Engine
**Engine:** https://blue-astral-nexus-engine.vercel.app

---

## Today's Commits (10 tasks completed)

| Hash | Type | Summary |
|------|------|---------|
| `0b15dc3` | feat | 干支年起訖顯示 + 虛歲改用立春界線 |
| `9610882` | feat | 大限四化 / 流年吉凶星 顯示於主星下方（含 Engine 表格） |
| `29a8227` | chore | 移除主星下方排的大限四化標籤，保留流年吉凶星 |
| `1eb790a` | fix  | 主/輔/凶星固定字級 + 小星縮字，宮位不再溢出 |
| `1249d86` | fix  | 命盤尺寸對齊父容器寬度，左邊不再被截切 |
| `0a734fd` | fix  | 空宮 / 借X宮 完整顯示 + 小限改用紅框直書 |
| `27f6135` | feat | 借星灰色虛線 + 三方四正互動高亮（動畫） |
| `384c7ee` | fix  | 借星四化字色與借星名同色 (#9a9a9a) |
| `17f67c1` | feat | index.html / chart.html 加入手機與平板 RWD |
| `b04dc87` | security | 統一輸入驗證 + 修正前端 XSS + 不外洩錯誤堆疊 |

---

## 1. 干支年起訖顯示 + 虛歲改用立春界線

**問題：** 原本虛歲用 `queryYear − birthYear + 1` 純西元年差，立春前出生的個案會多算一歲。

**修正：**
- 新增 `lichunDay(year)` 立春日近似公式（1900–2100，constant 4.4475）
- `birthGanZhiYear(isoDate)` 出生日對應的干支年（立春前算前一年）
- `chineseAge(birthDate, queryYear) = queryYear − birthGanZhiYear + 1`

**新顯示：**
- 輸入欄位下方即時 hint：`丙午年　2026/2/4〜2027/2/3`
- 命盤標題：`主流年　2026　丙午年　2026/2/4〜2027/2/3`
- 流年資訊列加上起訖日期

**驗證：** TEST 1987/5/19 → 2026 虛齡 40 ✓；1987/1/15（立春前） → 干支年 1986 → 虛齡 41 ✓

---

## 2. 大限四化 / 流年吉凶星（Engine + 視覺化）

**Engine（`api/flow.js`）：**
新增 `getFlowYearTransients(stem, branch)` 計算八吉凶星，依中州派標準表：
- 流祿（祿存表）、流羊（祿存+1）、流陀（祿存−1）
- 流馬（三合天馬）、流昌、流曲、流魁、流鉞（依流年天干）

API 回應加上 `flowYearTransients` 與 `flowYearTransientsByBranch`。

**視覺化：** 主星下方新增高度 18px 一排，字級 14px（主星 22px 的 50%）：
- 流祿（深綠）、流羊/流陀（紅）、流馬（棕）、流昌/流曲（紫）、流魁/流鉞（暗金）
- 過長時自動等比縮字

**移除：** 同排原本還有大限四化標籤（大祿太/大祿巨…），因星旁已有綠底徽章，重複顯示故刪除。

**驗證**（丙午 2026）：
- API 回傳：流祿巳、流羊午、流陀辰、流馬申、流昌申、流曲午、流魁亥、流鉞酉 — 全部符合標準表 ✓

---

## 3. 命盤排版四連修

| 問題 | 修正 |
|---|---|
| 多星宮位主星被截切（破軍只剩半） | 主/輔/凶 固定 22px、小星 16px、每星獨立欄寬、總寬超出時等比縮字 |
| 左邊宮位內容溢出 viewport | `setupCanvas` 改用 `canvas.parentElement.clientWidth`（扣到 body+chart-block 雙層 padding 32px） |
| 空宮只顯示「空 / 借遷」 | 「空宮 / 借X宮」完整 2/4 字，LEFT_RESERVE 50→58 |
| 小限只剩紅色「限」一字 | 改用 `drawVertRedBox('小限', slot)` 與來因宮/身宮同款直書紅框 |

**驗證：** 田宅宮 (乙巳) 武曲完整顯示、命宮(寅) / 父母宮(卯) 顯示 `空宮 / 借遷移宮` / `空宮 / 借疾厄宮`、福德宮顯示直書「小限」紅框 ✓

---

## 4. 借星灰色虛線 + 三方四正互動高亮 ⭐

**借星樣式：**
- 星名色 `CLR_MAJOR` (#1e3a8a) → `#9a9a9a` 灰
- 四化方塊：原本套用 src 色（紅/綠/藍），borrowed 時改為灰底 (#e8e8e8) + 2px 虛線外框 + 灰字 (#9a9a9a，與星名同色)

**三方四正互動（新功能）：**
- 點擊任一宮位 → 該宮 3px 金黃雙線高亮框 + 三條金黃動態虛線連到 `+6` (對宮) / `+4` (三合) / `+8` (三合)
- `requestAnimationFrame` 驅動 `lineDashOffset` 每幀 +0.6 → 螞蟻線往外流動
- 再次點同宮 / 點中央 / 切年 / Reset → 自動清除選取並停止動畫
- `dataset.trineBound` 防 listener 重複綁定

**例：** 點 流命 (午) → 連到 子(夫妻/流遷)、戌(財帛/流財)、寅(命宮/流官) ✓

---

## 5. RWD（Responsive Web Design）

**斷點：** `≤768px`（平板）、`≤480px`（手機）

**共通：**
- `input` / `select` 字級 16px（避免 iOS Safari 自動縮放放大版面）
- 多欄表單 (`row-2`/`row-3`) 改單欄堆疊
- body/panel padding 縮減

**`chart.html` 特殊處理：**
- `meta-bar` / `flow-bar` 改 `flex-wrap`，標籤自動換行
- `fy-limit` 在窄畫面改獨立行
- canvas 自動跟隨容器寬度（前述 setupCanvas 修正已就位）

**實測：** 375px → canvas 341px、768px → canvas 722px、1280+ → canvas 1000px (BASE 上限)。全程無水平捲動、12 宮完整呈現。

---

## 6. 安全性與精簡（Security & Refactor）

| 漏洞 | 嚴重度 | 修正 |
|---|---|---|
| `flow.js` / `synastry.js` 缺 date/time/gender 格式驗證 | 中 | 新增 `lib/validate.js` 共用模組 |
| `longitude` 未檢查範圍 | 低 | 限 -180–180 |
| `city` 長度未限制 | 低 | 上限 50 字 |
| 500 錯誤外洩 `err.message`（含 stack） | 中 | 改 `console.error` + 通用訊息 |
| **`index.html` XSS**：`clientData.name` / `city` 直接注入 `innerHTML` | **高** | 新增 `escapeHtml()` 包裹所有 user-supplied 欄位 |

**`chart.html` 已稽核無 XSS** — `S.name` 只用 canvas `fillText` 與下載檔名。

**精簡：** 抽出 `lib/validate.js` (61 行)，三個 API 各刪 8–12 行散落驗證，邏輯集中可測試；支援合盤 `[A]`/`[B]` tag 前綴避免重複。

**驗證 5 個邊界案例**：`date=BAD`、`year=9999`、`time=99:99`、`longitude=999` 全 400；正常請求 200 + 完整資料；`escapeHtml('<script>...')` → `&lt;script&gt;...` ✓

---

## 整體影響

- **正確性**：虛歲、立春界線、流年吉凶星全部對齊中州派標準
- **可讀性**：宮位字級分層 (22/16)、借星灰化、空宮全名、小限完整顯示
- **互動性**：三方四正動態高亮，從靜態圖示提升為互動命盤
- **可用性**：RWD 全面支援手機/平板，input 16px 防 iOS 自動縮放
- **安全性**：API 統一輸入驗證、前端 XSS 封堵、錯誤訊息不外洩

---

## 技術債 / 待辦

- `chart.html` 已破 1700 行，未來若加更多互動功能（例如點擊宮位顯示飛化、宮干飛宮等）建議拆成獨立 JS 模組
- `setupCanvas` 目前用 `parentElement.clientWidth`，未來若 `chart-block` 加入 sidebar 需重新評估
- API 尚未加 rate-limiting（仰賴 Vercel 平台層保護）；若上線正式版可考慮加 `@upstash/ratelimit`
- 立春日表為近似公式（常數 4.4475），對 1900–2100 邊界年（極端如 2099）可能有 ±1 天誤差，未來可改查表

---

## 部署狀態

- ✅ 所有 commits 已 push 到 `origin/main` (`bluechiou-icn/Blue_Astral_Nexus_Engine`)
- ⏳ Vercel 自動部署（依 Production 設定）
