# Original Contributions & Algorithmic Corrections

This project is built upon the foundational solar/lunar date conversion and basic palace structure calculation provided by [iztro](https://github.com/SylarLong/iztro). iztro made this project possible to start, and we are grateful to SylarLong and its contributors.

However, astrological calculation requires strict adherence to classical texts and extensive practical verification. The calculation corrections, analytical algorithms, and the complete interpretive layer in this repository were developed independently by Blue Chiou (Blue Engine) through extensive professional divination practice, combined with systematic verification against authoritative reference charts.

The following components represent the primary analytical value of this repository and are original research and implementations extending beyond the base library.

## 1. Calculation Corrections & Enhancements
These address specific documented errors or limitations found in standard open-source astrological libraries:

* **Complete Four-Transformations Table (BlueVersion):** Corrected based on traditional Zhan Yan school standards across all 10 heavenly stems. 
  * *Critical correction:* 庚-stem assigns 太陽祿 / 武曲權 / 天同科 / 天相忌, fixing default placeholder errors.
* **Minor Limit (小限) Algorithm:** Implemented verified starting positions and directional logic for all five elemental cycles (金/木/水/土/火) across yin/yang male/female configurations, replacing unverified starting points.
* **Eight Pillars Start (八字起運) Fix:** Corrected a traditional/simplified Chinese key mismatch bug for pre-1980 dates.
* **8-Tier Brightness System:** Extended the standard 6-tier system to a highly nuanced 8-tier grading (廟/旺/得/利/平/不利/陷/不) based on verified auxiliary star tables.
* **Empty Palace Borrowing (借星安宮):** Implemented correct opposite-palace star inheritance logic.

## 2. Advanced Analytical Systems
The following analytical engines were built from scratch to support professional-level destiny architecture:

* **Bidirectional Palace Flying Transformations (飛入/飛出):** Full outgoing and incoming mutation tracking for all 12 palaces.
* **Self-Transformation Detection (自化):** Tracks sources of self-mutations within palaces.
* **Fortune-Restriction Conflict Detection v2 (祿忌交戰):** Advanced logic detecting palace-stem flying sources with severity classification (critical/high/medium).
* **Triple-Stem Overlap Detection (三干疊加):** Alerts for the convergence of Birth year stem, Origin palace stem, and Decade stem.
* **True Solar Time Correction (真太陽時):** Integrated 30-city longitude database with automatic `timeIndex` recalculation and crossed-hour warnings.
* **Classical Formation Detection (格局偵測):** Pattern matching for auspicious/challenging chart structures with confidence scores.
* **Year Bucket Start (斗君):** Automated start position calculation for the flow year bucket.

## 3. Dedicated API Engines
* **Flow Year Analysis Engine (`/api/flow`):** Computes minor limit palaces, flow year transformations, and deep conflict detection tailored for annual forecasting.
* **Synastry Analysis Engine (`/api/synastry`):** Processes two-chart structural resonance. Evaluates bidirectional cross-chart flying transformations to map interpersonal dynamics and psychological triggers between individuals.

These original contributions are released under the same MIT License as the project as a whole.

```
