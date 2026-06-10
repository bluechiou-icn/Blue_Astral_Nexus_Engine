# CLAUDE.md — Blue Astral Nexus Engine

Non-negotiable rules for every Claude session working in this repository.
Violations of Rule 1–3 are release blockers.

## 1. Cache headers（鐵律，嚴禁回退）

Every API response MUST keep both headers exactly as below. Two production
incidents (2026-05-22, 2026-05-25) served Blue's personal chart to all clients
because of CDN caching.

```javascript
res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
res.setHeader("Surrogate-Control", "no-store");
```

After every deploy: manually clear Vercel CDN cache
(Dashboard → project → Cache → Delete All CDN Cache).

## 2. Secrets（Step 0 = Encryption）

- Never hardcode tokens, API keys, or credentials. Use Vercel Environment Variables.
- Google OAuth Client ID is a public value and MAY appear in frontend code. Tokens may not be persisted to localStorage.

## 3. Personal birth data never enters git

- No real birth data in code, tests, comments, or docs. Example params: `2000-01-01 06:00`.
- Knowledge docs (`ClaudeCode_*.md`, `CLAUDE_Code_*.md`) live in Google Drive only and are gitignored. Do not commit them.

## 4. Blue's Version is the single authority（唯一權威）

- 四化表：`BLUE_SI_HUA_TABLE` in `chart-api.js` overrides iztro defaults. 庚干 = 太陽祿 武曲權 天同科 天相忌（天同科／天相忌，not 天同忌）.
- 亮度：8 tiers 廟旺得利平不利陷不, mapped by `BRIGHTNESS_RANK`. iztro's 6-tier output is never exposed directly.
- 宮名現代化：僕役 → 交友（`PALACE_MODERN_NAMES`）.
- Never "fix" these by reverting to iztro behavior.

## 5. Intellectual property boundary

This repo is public (MIT). The following must NEVER be committed here:
proprietary 判訣 / interpretation rule libraries (占驗派, 欽天細則, ÆTHNOUS new-school
rules, 潛能宮 theory). Engine math is public; interpretation IP is private storage only.

## 6. Architecture quick map

```
chart-api.js          core chart logic (Blue's Version 四化/亮度/借宮/自化/飛入飛出/格局)
api/chart.js          GET /api/chart?date&time&gender    本命盤
api/flow.js           GET /api/flow?date&time&gender&year 流年盤（大限/小限/流曜/三干疊加）
api/synastry.js       合盤
lib/validate.js       shared input validation (always use for new endpoints)
public/chart.html     命盤視覺化（Canvas）
public/js/            frontend modules (i18n / api / chart-render / chart-state)
```

Production: https://engine.aethnous.co (API), https://chart.aethnous.co (UI).
Legacy https://blue-astral-nexus-engine.vercel.app is fallback only; never use it in new code or docs.

## 7. Workflow

- Surgical changes only. Touch only what the task requires; no drive-by refactors.
- Engine internals compute in Traditional Chinese keys; translation happens only at the render layer (`public/js/i18n.js`).
- All API calls from Claude tools append `&_t=YYYYMMDD` (or `_HHMM`) to defeat session caching.
- Deploy: `git push origin main` → Vercel auto-deploy → verify with curl → clear CDN cache.

Standard verification example:

```bash
curl -s "https://engine.aethnous.co/api/chart?date=2000-01-01&time=06:00&gender=%E7%94%B7&_t=YYYYMMDD" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('fiveElementsClass'), d.get('yinYang'))"
```

- Every task ends with a verifiable success criterion stated before coding starts.
- New endpoints: validate inputs via `lib/validate.js`, return generic error messages (no stack traces), escape all user-supplied strings rendered to HTML.
