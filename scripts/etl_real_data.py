#!/usr/bin/env python3
"""
etl_real_data.py — turn the real recognition export into a clean dataset for mvp1.2.05.
Source: Campaign_Ad_Brand_Matches_with_Metadata.xlsx (Google Drive, 876 brand detections).
GPS is absent in the export, so market is inferred per-brand (labelled inferred).
"""
import openpyxl, os, json, re
from collections import Counter, defaultdict

APP = "/Users/tpmulenga/Library/CloudStorage/GoogleDrive-travis.mulenga@gmail.com/My Drive/TEST Folder_OOH Model_mvp/Brand Recogn App"
SRC = os.path.join(APP, "Campaign_Ad_Brand_Matches_with_Metadata.xlsx")
OUT = "/Users/tpmulenga/Desktop/BrandCog.ai (BrandRecog.io)/mvp/server/data/campaign.real.json"

# ---- brand maps (from the 31 detected brands) -------------------------------
SECTOR = {
  "MultiChoice Group":"media","GOtv Zambia":"media","SuperSport":"media","Netflix":"media","DStv":"media",
  "MTN":"telecom","Airtel":"telecom","Zamtel":"telecom","TECNO":"telecom","Melon Mobile":"telecom",
  "MoMo from MTN":"mobile money",
  "BolaBet":"gaming","SportyBet":"gaming","Betlion":"gaming","1XBet":"gaming","CastleBet":"gaming",
  "Gal Sport Betting":"gaming","BetPawa":"gaming","Hollywood Bets - SA":"gaming","BongoBongo":"gaming","Betway":"gaming",
  "FNB":"finance","Absa":"finance","Preference Capital":"finance","Hippo.co.za":"finance",
  "Coca-Cola":"fmcg","Woolworths SA":"retail","Spar":"retail","Debonairs":"food","Nandos":"food",
  "Bp South Africa":"energy","Puma Energy":"energy","Yango":"mobility",
}
MARKET = {  # inferred from brand (GPS absent in export)
  "GOtv Zambia":"Zambia","Zamtel":"Zambia","BolaBet":"Zambia","Betlion":"Zambia","CastleBet":"Zambia",
  "Gal Sport Betting":"Zambia","BetPawa":"Zambia","BongoBongo":"Zambia","Preference Capital":"Zambia",
  "Bp South Africa":"South Africa","Woolworths SA":"South Africa","Hollywood Bets - SA":"South Africa",
  "Hippo.co.za":"South Africa","Melon Mobile":"South Africa","Spar":"South Africa","Debonairs":"South Africa",
  "Nandos":"South Africa","SuperSport":"South Africa","Dotsure.Co.Za":"South Africa",
  "MultiChoice Group":"Pan-African","MTN":"Pan-African","MoMo from MTN":"Pan-African","Airtel":"Pan-African",
  "Coca-Cola":"Pan-African","Netflix":"Pan-African","SportyBet":"Pan-African","1XBet":"Pan-African",
  "TECNO":"Pan-African","Betway":"Pan-African","Yango":"Pan-African","Puma Energy":"Pan-African",
  "FNB":"Pan-African","Absa":"Pan-African",
}
LOCAL = {  # for recognition-equity (locally-rooted vs multinational)
  "Zamtel","BolaBet","Betlion","CastleBet","Gal Sport Betting","BetPawa","BongoBongo",
  "Preference Capital","GOtv Zambia","Melon Mobile",
}

def base_name(fn):  # collapse "IMG_x 2.jpeg" -> "IMG_x.jpeg"
    return re.sub(r"\s+\d+(?=\.\w+$)", "", fn or "").strip()

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
ws = wb.worksheets[0]
rows = list(ws.iter_rows(min_row=2, values_only=True))
wb.close()

records=[]; seen=set(); dates=[]
for r in rows:
    f=r[0]; brand=(r[1] or "").strip();
    if not brand: continue
    try: conf=round(float(r[2]),4)
    except: conf=None
    dt=r[9] or r[4]  # Date Taken or Date Created
    if isinstance(dt,str) and dt[:4].isdigit(): dates.append(dt[:10].replace(":","-"))
    bn=base_name(f)
    distinct = bn not in seen
    seen.add(bn)
    sector=SECTOR.get(brand,"other")
    records.append({
        "file": f, "brand": brand, "confidence": conf,
        "sector": sector, "market": MARKET.get(brand,"Pan-African"),
        "origin": "local" if brand in LOCAL else "multinational",
        "distinct": distinct,
        "dateTaken": str(dt)[:10] if dt else None,
    })

as_of = max(dates) if dates else "2025-07-21"
out = {
    "market": "Zambia + South Africa",
    "asOf": as_of,
    "source": "Campaign_Ad_Brand_Matches_with_Metadata.xlsx — real CLIP recognition output (876 brand detections, 31 brands). GPS absent in export; market inferred per-brand.",
    "records": records,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT,"w") as fh: json.dump(out, fh, indent=1)
print("wrote", OUT)
print("records:", len(records), "| distinct placements:", sum(1 for r in records if r['distinct']))
print("brands:", len(set(r['brand'] for r in records)), "| asOf:", as_of)
bym=Counter(r['market'] for r in records); print("by market:", dict(bym))
bys=Counter(r['sector'] for r in records); print("by sector:", dict(bys))
