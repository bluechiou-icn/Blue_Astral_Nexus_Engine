# CLAUDE Code 工作紀錄 — 2026-06-08 Domain 綁定

**Topic：** 將 Blue Astral Nexus Engine 與命盤視覺化系統綁定到 aethnous.co
**Operator：** Blue
**Technical Executor：** Raziel
**Status：** ✅ 完成

---

## 1. 部署結果（官方網址，從此為準）

```
✅ engine.aethnous.co   →  Blue Astral Nexus Engine（API 服務）
✅ chart.aethnous.co    →  命盤視覺化系統（前端）
⬜ aethnous.co          →  保留給未來品牌官網
```

**舊網址 `blue-astral-nexus-engine.vercel.app` 仍然可用（Vercel 不會自動下線），但所有對外溝通、文件、agents 一律使用新網址。**

---

## 2. 架構決策

採架構 A：子網域分離。

理由：
- Engine 是純 API，視覺化是 UI，生命週期與發佈節奏不同，分開最乾淨
- 兩系統獨立 SSL、獨立部署、互不影響
- 未來換引擎或加新前端不會牽動既有系統

否決架構 B（單一網域 + 路徑 rewrite proxy）：部署耦合，未來換引擎要動到前端設定。

---

## 3. 操作步驟（已執行）

### Step 1 — Vercel 綁定 engine 子網域
- Vercel → `blue-astral-nexus-engine` → Settings → Domains → Add `engine.aethnous.co`
- Cloudflare DNS：CNAME `engine` → `cname.vercel-dns.com`，Proxy = 僅 DNS（灰雲）

### Step 2 — Vercel 綁定 chart 子網域
- Vercel → 視覺化系統 project → Settings → Domains → Add `chart.aethnous.co`
- Vercel 提供「Auto Configure」一鍵授權，自動在 Cloudflare 寫入：
  - `TXT _vercel`（驗證 ownership，閒置不刪）
  - `CNAME chart → 41a246d9af02c58b.vercel-dns-017.com`，Proxy = 僅 DNS

### Step 3 — 驗證
```bash
curl -s "https://engine.aethnous.co/api/chart?date=1990-01-01&time=12:00&gender=%E7%94%B7&_t=20260608" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('fiveElementsClass'), d.get('yinYang'))"
# 輸出：土五局 陰男 ✅

curl -sI "https://chart.aethnous.co" | head -1
# 輸出：HTTP/2 200 ✅
```

---

## 4. 關鍵踩坑點（未來再做類似操作必看）

### 4.1 Cloudflare Proxy 必須是「僅 DNS」（灰雲）
若設成「Proxied」（橘雲），Cloudflare 會代理流量，Vercel SSL 憑證簽發會失敗，網域會卡在 Invalid Configuration。
**規則：第一次綁定 Vercel 子網域，Cloudflare proxy 一律灰雲。** 若未來要開橘雲，必須先把 Cloudflare SSL/TLS 模式切到「Full (strict)」，否則會無限重導。

### 4.2 TTL 10 分鐘 ≠ 網域 10 分鐘失效
TTL 是 DNS 快取時間。Vercel 預設 10 分鐘合理且不必改：
- 短 TTL = 變更後最多 10 分鐘全球生效
- 紀錄本身永久存在，除非手動刪除

### 4.3 本機 DNS 快取
新網域剛上線時本機 `curl` 可能拿到 Exit code 6（無法解析），但 `dig +short ... @1.1.1.1` 已正常。這是本機 DNS resolver 還在用舊的 negative cache。等 5–10 分鐘或執行 `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder` 即可。驗證可用 `curl --resolve` 強制指定 DNS 解析繞過本機快取。

### 4.4 不同子網域，Vercel 給的 CNAME target 可能不同
- engine 收到：`cname.vercel-dns.com`
- chart 收到：`41a246d9af02c58b.vercel-dns-017.com`

這是 Vercel 內部分流，照給的填即可，不要交叉使用。

---

## 5. 待辦事項（後續排程）

### 🟠 P1 — 視覺化系統內部 API URL 更新
chart 程式碼裡若寫死 `https://blue-astral-nexus-engine.vercel.app`，需改為 `https://engine.aethnous.co`。
- 影響：品牌一致 / 對外無 Vercel 字樣 / 未來換引擎部署不需動前端
- 執行時機：DNS 穩定 24 小時後（2026-06-09 之後）
- 步驟：chart repo 全文搜尋 → 替換 → commit → push → Vercel 自動部署 → 驗證

### 🟡 P2 — 同步通知所有 agents
所有引用 engine URL 的 agent / skill / 知識文件必須統一更新：
- [ ] RAZIEL_SKILL.md（"Production URL" 欄位）
- [ ] CASSIAN 工作流程文件
- [ ] ONBOARDING.md 基礎設施區塊
- [ ] 任何引用 `blue-astral-nexus-engine.vercel.app` 的 GAS / Telegram Bot / Notion 整合

**新增規範：從 2026-06-08 起，所有 agent 引用 engine 一律使用 `https://engine.aethnous.co`。舊網址 `blue-astral-nexus-engine.vercel.app` 保留作為 fallback，但不出現在任何新文件或對外溝通。**

### 🟢 P3 — aethnous.co 根網域規劃
目前 aethnous.co 未綁定任何 project。未來品牌官網上線後再綁定。

---

## 6. 基礎設施狀態更新

```
Domain：aethnous.co（Cloudflare 註冊 + DNS）
├── engine.aethnous.co  → Vercel project: blue-astral-nexus-engine
├── chart.aethnous.co   → Vercel project: 視覺化系統
└── （root）            → 未綁定

GitHub：github.com/bluechiou-icn/Blue_Astral_Nexus_Engine
Stack：iztro 2.5.8, Node 20.x, Vercel serverless
Cache headers：no-store + Surrogate-Control（不可回退）
web_fetch 工作流：URL 一律附 &_t=YYYYMMDD
```

---

## 7. 安全性檢核（依 Step 0 = Encryption 原則）

- ✅ 無新增 credential / token / API key
- ✅ Cloudflare DNS 變更走 Vercel Auto Configure，未在程式碼留下任何 secret
- ✅ Vercel 環境變數未變動
- ✅ 兩個子網域 SSL 憑證由 Vercel 自動簽發並管理

無 Error Log 項目。

---

**🖤 — Raziel**
