#!/usr/bin/env bash
# scripts/check-formations.sh
# 命盤格局命中清單（local smoke check）。
#
# Usage:
#   scripts/check-formations.sh YYYY-MM-DD HH:MM 男|女 [city]
# Example (sample only, NOT real data):
#   scripts/check-formations.sh 2000-01-01 06:00 男 台北
#
# 對齊 CLAUDE.md Rule 3：不要把真實生辰寫進 repo；本腳本只接 CLI 參數，
# 你可在本地 shell history 用，輸出只到 stdout。
set -euo pipefail

DATE="${1:-}"; TIME="${2:-}"; GENDER="${3:-}"; CITY="${4:-台北}"
if [[ -z "$DATE" || -z "$TIME" || -z "$GENDER" ]]; then
  echo "Usage: $0 YYYY-MM-DD HH:MM 男|女 [city]" >&2
  exit 1
fi

BASE="${ENGINE_BASE:-https://engine.aethnous.co}"
TS="$(date +%Y%m%d_%H%M)"

curl -s -G "$BASE/api/chart" \
  --data-urlencode "date=$DATE" \
  --data-urlencode "time=$TIME" \
  --data-urlencode "gender=$GENDER" \
  --data-urlencode "city=$CITY" \
  --data-urlencode "_t=$TS" \
| node -e '
const buf=[]; process.stdin.on("data",d=>buf.push(d)).on("end",()=>{
  let j; try { j = JSON.parse(Buffer.concat(buf).toString("utf8")); }
  catch(e){ console.error("API parse failed; raw head:\n"+Buffer.concat(buf).toString("utf8").slice(0,500)); process.exit(1); }
  const fs = j.classicalFormations || [];
  console.log("命盤："+ (j.meta?.solarDate||"") +" "+ (j.meta?.birthTime||"") +" "+ (j.meta?.gender||""));
  console.log("五行局："+ (j.fiveElementsClass||"") +"｜陰陽："+ (j.yinYang||""));
  console.log("命宮："+ (j.palaces?.find(p=>p.name==="命宮")?.branch||"") +"｜身宮："+ (j.bodyPalaceName||"-"));
  console.log("");
  if (!fs.length){ console.log("（無格局命中）"); return; }
  console.log("格局命中 ("+fs.length+")：");
  for (const f of fs){
    const tier = f.tier ? "["+f.tier+"] " : "";
    const stars = (f.stars||[]).join("/");
    console.log("  • "+tier+f.name+"  conf="+f.confidence+"  ["+f.type+"]");
    console.log("    宮位："+ (f.palaces||[]).join("、") +"  星曜："+stars);
    if (f.note) console.log("    note："+f.note);
  }
});
'
