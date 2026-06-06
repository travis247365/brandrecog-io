#!/usr/bin/env python3
"""
etl_real_geo.py (v1.2.07) — upgrade the real dataset with MEASURED geo + snapshots.
Re-extracts EXIF GPS directly from the billboard images (the metadata export's GPS
columns were empty) and bundles resized snapshot thumbnails. Market is derived from
GPS where present (measured), else inferred per-brand.
"""
import openpyxl, os, re, json
from PIL import Image, ImageOps
from PIL.ExifTags import TAGS, GPSTAGS

APP = "/Users/tpmulenga/Library/CloudStorage/GoogleDrive-travis.mulenga@gmail.com/My Drive/TEST Folder_OOH Model_mvp/Brand Recogn App"
META = os.path.join(APP, "Campaign_Ad_Brand_Matches_with_Metadata.xlsx")
IMGDIR = os.path.join(APP, "ooh_images")
OUT = "/Users/tpmulenga/Desktop/BrandCog.ai (BrandRecog.io)/mvp/server/data/campaign.real.json"
SNAP = "/Users/tpmulenga/Desktop/BrandCog.ai (BrandRecog.io)/mvp/public/snapshots"
MAX_PROCESS = 320          # cap Drive downloads
THUMB = 260                # px wide
os.makedirs(SNAP, exist_ok=True)

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
MARKET_INF = {  # fallback when no GPS
  "GOtv Zambia":"Zambia","Zamtel":"Zambia","BolaBet":"Zambia","Betlion":"Zambia","CastleBet":"Zambia",
  "Gal Sport Betting":"Zambia","BetPawa":"Zambia","BongoBongo":"Zambia","Preference Capital":"Zambia",
  "Bp South Africa":"South Africa","Woolworths SA":"South Africa","Hollywood Bets - SA":"South Africa",
  "Hippo.co.za":"South Africa","Melon Mobile":"South Africa","Spar":"South Africa","Debonairs":"South Africa",
  "Nandos":"South Africa","SuperSport":"South Africa",
}
LOCAL = {"Zamtel","BolaBet","Betlion","CastleBet","Gal Sport Betting","BetPawa","BongoBongo",
         "Preference Capital","GOtv Zambia","Melon Mobile"}

def base_name(fn): return re.sub(r"\s+\d+(?=\.\w+$)", "", fn or "").strip()
def safe(fn): return re.sub(r"[^A-Za-z0-9]+","_", os.path.splitext(fn)[0]).strip("_") + ".jpg"

def gps_of(exif):
    g = exif.get("GPSInfo")
    if not g: return None
    gg = {GPSTAGS.get(k,k):v for k,v in g.items()}
    try:
        def deg(v): d,m,s=v; return float(d)+float(m)/60+float(s)/3600
        lat=deg(gg["GPSLatitude"]); lon=deg(gg["GPSLongitude"])
        if gg.get("GPSLatitudeRef")=="S": lat=-lat
        if gg.get("GPSLongitudeRef")=="W": lon=-lon
        return round(lat,5), round(lon,5)
    except Exception: return None

def market_from_gps(lat, lon):
    if -18<=lat<=-8 and 21<=lon<=34: return "Zambia"
    if -35<=lat<=-22 and 16<=lon<=33: return "South Africa"
    return None

def site_label(lat, lon):
    return f"{round(lat,3)}, {round(lon,3)}"

wb = openpyxl.load_workbook(META, read_only=True, data_only=True); ws = wb.worksheets[0]
rows = [r for r in ws.iter_rows(min_row=2, values_only=True) if (r[1] or "").strip()]
wb.close()

records=[]; processed=0; geocount=0; snapcount=0; dates=[]
seen_site_snap=set()
for r in rows:
    f=r[0]; brand=(r[1] or "").strip()
    try: conf=round(float(r[2]),4)
    except: conf=None
    dt=r[9] or r[4]
    if isinstance(dt,str) and dt[:4].isdigit(): dates.append(dt[:10].replace(":","-"))
    sector=SECTOR.get(brand,"other")
    rec={"file":f,"brand":brand,"confidence":conf,"sector":sector,
         "origin":"local" if brand in LOCAL else "multinational",
         "distinct": base_name(f) not in seen_site_snap,  # not used for dedupe here
         "dateTaken": str(dt)[:10] if dt else None,
         "market": MARKET_INF.get(brand,"Pan-African")}
    # try GPS + snapshot (capped)
    if processed < MAX_PROCESS:
        p=os.path.join(IMGDIR, f)
        if os.path.exists(p):
            processed+=1
            try:
                img=Image.open(p); raw=img._getexif() or {}
                exif={TAGS.get(k,k):v for k,v in raw.items()}
                g=gps_of(exif)
                if g:
                    lat,lon=g; mk=market_from_gps(lat,lon)
                    if mk:
                        rec["lat"]=lat; rec["lon"]=lon; rec["site"]=site_label(lat,lon); rec["market"]=mk
                        geocount+=1
                        # one snapshot per (site,brand)
                        key=(rec["site"],brand)
                        sname=safe(f)
                        if key not in seen_site_snap:
                            try:
                                im=ImageOps.exif_transpose(Image.open(p)).convert("RGB")
                                im.thumbnail((THUMB,THUMB))
                                im.save(os.path.join(SNAP,sname), "JPEG", quality=72)
                                rec["snapshot"]="/snapshots/"+sname; snapcount+=1
                                seen_site_snap.add(key)
                            except Exception: pass
            except Exception: pass
    records.append(rec)

# recompute distinct properly (distinct base image)
seen=set()
for rec in records:
    bn=base_name(rec["file"]); rec["distinct"]= bn not in seen; seen.add(bn)

as_of=max(dates) if dates else "2025-08-03"
out={"market":"Zambia + South Africa","asOf":as_of,
     "source":f"Real CLIP recognition ({len(records)} detections, 31 brands). EXIF GPS re-extracted from images ({geocount} geo-located across ZM+SA); market measured from GPS where present.",
     "records":records}
json.dump(out, open(OUT,"w"), indent=1)
print(f"records {len(records)} | processed {processed} | geo {geocount} | snapshots {snapcount}")
from collections import Counter
print("markets:", dict(Counter(r['market'] for r in records)))
print("geo markets:", dict(Counter(r['market'] for r in records if 'lat' in r)))
