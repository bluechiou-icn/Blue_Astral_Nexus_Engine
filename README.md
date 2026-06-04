# Blue Astral Nexus Engine

A professional Zi Wei Dou Shu (紫微斗數 / Purple Star Astrology) calculation API engine.
Extending the `iztro` library with advanced analytical capabilities
true solar time correction, and bidirectional synastry calculations.

**Live demo:** https://blue-astral-nexus-engine.vercel.app

## Core Capabilities

This engine wraps and significantly extends the foundational calculations of `iztro`. Key enhancements include:
- **Corrected Calculation Rules:** Fixes for traditional Zhan Yan school standards (e.g., 庚干四化).
- **Advanced Astrological Systems:** Bidirectional flying transformations (飛星).
- Fortune-Restriction conflict detection (祿忌交戰), and True Solar Time correction (真太陽時).
- **Multi-Chart Analysis:** Synastry (合盤) and flow year (流年) engines.

👉 **For a complete list of algorithm corrections and original domain contributions
Please see [ORIGINAL_CONTRIBUTIONS.md](./ORIGINAL_CONTRIBUTIONS.md).**

## Stack

- Node.js 20.x + Vercel Serverless Functions
- [iztro](https://github.com/SylarLong/iztro) ^2.5.8 (MIT)
- [@resvg/resvg-js](https://github.com/yisibl/resvg-js) for chart image rendering
- [lunar-typescript](https://github.com/6tail/lunar-typescript) (transitive) for 24-節氣 calculation

## Quick Reference

```
GET /api/chart?date=YYYY-MM-DD&time=HH:MM&gender=男|女[&city=台北]
GET /api/flow?date=...&year=YYYY[&city=...]
GET /api/synastry?date1=...&time1=...&gender1=...&date2=...&time2=...&gender2=...
```

## Stack

- Node.js 20.x + Vercel Serverless Functions
- [iztro](https://github.com/SylarLong/iztro) ^2.5.8 (MIT)
- [@resvg/resvg-js](https://github.com/yisibl/resvg-js) for chart image rendering
- [lunar-typescript](https://github.com/6tail/lunar-typescript) (transitive) for 24-節氣 calculation


## API Endpoints

All endpoints respond with JSON and disable caching
(`Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`).

### `GET /api/chart`

Generate a complete natal chart.

**Parameters:**

| Name | Required | Format | Description |
|------|----------|--------|-------------|
| `date` | ✓ | `YYYY-MM-DD` | Solar date of birth |
| `time` | ✓ | `HH:MM` | Clock time of birth (24-hour) |
| `gender` | ✓ | `男` \| `女` | Gender (zh-TW) |
| `city` | optional | string | Birth city (enables true solar time correction) |
| `longitude` | optional | number | Custom longitude (overrides city default) |

**Example:**

```
GET /api/chart?date=2000-01-01&time=06:00&gender=男&city=台北
```

**Response (key fields):**

```jsonc
{
  "meta": {
    "solarDate": "2000-01-01",
    "clockTime": "06:00",
    "trueSolarTime": "06:06",
    "trueSolarTimeOffsetMinutes": 6,
    "trueSolarTimeCrossedHour": false,
    "trueSolarTimeCrossedHourWarning": null,
    "city": "台北",
    "longitude": 121.5654,
    "gender": "男"
  },
  "fourPillars": { "raw": { "yearly": ["天干","地支"], "monthly": [...], "daily": [...], "hourly": [...] } },
  "lifeStars": {
    "mingZhu": "命主星",
    "shenZhu": "身主星",
    "yearBucketStart": "斗君地支",
    "yearBucketPalace": "斗君宮位"
  },
  "shichen": "卯時",
  "fiveElementsClass": "金四局",
  "yinYang": "陰男",
  "bodyPalace":     { "name": "...", "stemBranch": "..." },
  "originalPalace": { "name": "...", "stemBranch": "..." },
  "classicalFormations": [
    { "name": "格局名", "type": "auspicious|challenge|neutral",
      "palaces": [...], "stars": [...], "note": "...", "confidence": 0-100 }
  ],
  "baziQiyun": {
    "years": 0, "months": 0, "days": 0,
    "direction": "順排|逆排",
    "jieName": "立春",
    "jieTime": "ISO timestamp",
    "note": "..."
  },
  "yearMutagens": [...],
  "palaces":      [...12 palaces, ordered by 地支 (子丑寅卯…亥)...],
  "majorLimits":  [...12 decades]
}
```

> ⚠️ **`palaces` order is by branch, not by palace name.**
> Use `palaces.find(p => p.name === '命宮')` — never `palaces[0]`.

### `GET /api/flow`

Generate flow year (`流年`) analysis for a given year.

**Parameters:**

| Name | Required | Format | Description |
|------|----------|--------|-------------|
| `date` | ✓ | `YYYY-MM-DD` | Solar date of birth |
| `time` | ✓ | `HH:MM` | Clock time of birth |
| `gender` | ✓ | `男` \| `女` | Gender |
| `year` | ✓ | `YYYY` | Query year (1900–2100) |
| `city` | optional | string | Birth city |

**Response (key fields):**

```jsonc
{
  "flowYear": { "year": 2026, "stem": "丙", "branch": "午", "ganZhi": "丙午", "chineseAge": 40 },
  "flowYearLifePalace": { "name": "官祿", "branch": "午", "algorithm": "流年命宮 = 流年地支對應本命宮位" },
  "minorLimitPalace":   { "name": "...", "branch": "..." },
  "flowYearMutagens":   [...4 transformations],
  "currentMajorLimit":  { "palace": "...", "startYear": 2020, "endYear": 2029, "mutagens": [...] },
  "tripleStemOverlap":  { "isTripleOverlap": false, "isDoubleOverlap": true, "note": "..." },
  "luJiConflicts":      [
    { "palace": "...", "star": "...", "luSources": [...], "jiSources": [...],
      "severity": "critical|high|medium", "note": "..." }
  ],
  "hasLuJiConflict": true,
  "luJiConflictSummary": [{ "palace": "...", "star": "...", "severity": "...", "note": "..." }]
}
```

### `GET /api/synastry`

Two-chart synastry (合盤) analysis.

**Parameters:**

| Name | Required | Format | Description |
|------|----------|--------|-------------|
| `date1`, `time1`, `gender1` | ✓ | (same as `/api/chart`) | Subject A |
| `date2`, `time2`, `gender2` | ✓ | (same as `/api/chart`) | Subject B |
| `city1`, `city2` | optional | string | Birth cities |

**Response (key fields):**

```jsonc
{
  "chart1": { ...full chart, "_label": "A" },
  "chart2": { ...full chart, "_label": "B" },
  "synastry": {
    "chart1BirthYearToChart2":     [...A's birth-year mutations landing on B's chart],
    "chart2BirthYearToChart1":     [...B's birth-year mutations landing on A's chart],
    "chart1CurrentDecadeToChart2": [...A's current decade mutations on B],
    "chart2CurrentDecadeToChart1": [...B's current decade mutations on A],
    "resonances": [
      { "type": "...", "direction": "對稱|A→B|B→A", "branch|star": "...", "note": "..." }
    ],
    "chart1CurrentDecade": { "palace": "...", "stem": "...", "range": "YYYY-YYYY" },
    "chart2CurrentDecade": { "palace": "...", "stem": "...", "range": "YYYY-YYYY" }
  }
}
```

**Resonance types** (10 total, bidirectional symmetric):
- `雙身宮共振`, `雙來因宮共振` (symmetric)
- `A/B 身宮映 B/A 命宮`
- `A/B 來因宮映 B/A 命宮`
- `A/B 身宮映 B/A 來因宮`
- `A/B 生年祿入 B/A 田宅`

### `GET /chart.html`

HTML5 Canvas chart visualization page (no API; renders interactively).

Features: 4×4 palace grid, three-layer name overlay (flow/decade/natal),
multi-year chart generation (up to 2 extra years), PNG export.

## Architecture

```
chart-api.js                    Core engine (generateChart function)
├── 30-city longitude db        CITY_LONGITUDES, CITY_TIMEZONE_OFFSET
├── calcTrueSolarTime()         True solar time correction
├── calcBaziQiyun()             Eight Pillars start (lunar-typescript)
├── detectClassicalFormations() Pattern matching (8 formations)
└── BLUE_SI_HUA_TABLE           Corrected 四化表

utils.js                        timeToIndex, SHICHEN_NAMES

api/
├── chart.js                    GET /api/chart handler
├── flow.js                     GET /api/flow handler (includes detectLuJiConflict v2)
└── synastry.js                 GET /api/synastry handler (includes detectResonances)

public/
├── index.html                  Landing + form-based natal chart UI
├── chart.html                  Standalone canvas chart visualization
└── watermark.png               Crystibee brand asset
```

## True Solar Time

Formula: `trueSolarTime = clockTime + (longitude - standardMeridian) × 4 minutes`,
where `standardMeridian = timezone × 15°`.

Built-in 30 cities (Asia / North America / Europe). Custom longitude supported via
`?longitude=XXX.XX`. If post-correction time crosses a 時辰 (2-hour) boundary,
`trueSolarTimeCrossedHour: true` and a warning is included for rectification review.

## Local Development

```bash
git clone https://github.com/bluechiou-icn/Blue_Astral_Nexus_Engine.git
cd Blue_Astral_Nexus_Engine
npm install
npx vercel dev
```

CLI mode:

```bash
node chart-api.js YYYY-MM-DD HH:MM 男|女 [城市] [經度]

# Examples:
node chart-api.js 2000-01-01 06:00 男 台北
node chart-api.js 2000-01-01 06:00 男 "" 121.5654
```

## Deployment

```bash
npx vercel --prod    # Deploy to Vercel
git push origin main # Auto-deploys via Vercel GitHub integration
```

## Acknowledgments

This project builds on [iztro](https://github.com/SylarLong/iztro)
by SylarLong and contributors, which provides the foundational
solar/lunar date conversion and basic palace structure calculation.
iztro is licensed under MIT and made this project possible to start.

The calculation corrections, analytical algorithms, and the complete
interpretive layer in this repository were developed independently
through 15+ years of professional divination practice combined with
systematic verification against authoritative reference charts.
Several errors in iztro's default data tables have been identified
and corrected in this project (see LICENSE for details).

## License

This project is licensed under the **MIT License** — see [LICENSE](./LICENSE)
for details.

The underlying [iztro](https://github.com/SylarLong/iztro) library is also
MIT-licensed; this project would not exist without it. Many thanks to
SylarLong and the iztro contributors.

## Disclaimer

This engine provides computational results based on classical Zi Wei Dou Shu
algorithms. Astrological interpretation is a domain requiring human expertise
and judgment — the API output is reference data, not divination conclusions.
For professional readings, consult a qualified practitioner.
