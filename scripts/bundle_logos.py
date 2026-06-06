#!/usr/bin/env python3
"""Copy one logo per detected brand from Drive brand_logos/ into public/logos/."""
import os, re, shutil, json

APP = "/Users/tpmulenga/Library/CloudStorage/GoogleDrive-travis.mulenga@gmail.com/My Drive/TEST Folder_OOH Model_mvp/Brand Recogn App/brand_logos"
OUT = "/Users/tpmulenga/Desktop/BrandCog.ai (BrandRecog.io)/mvp/public/logos"
os.makedirs(OUT, exist_ok=True)

BRANDS = ["MultiChoice Group","GOtv Zambia","SuperSport","Netflix","MTN","MoMo from MTN","Airtel",
  "Zamtel","TECNO","Melon Mobile","BolaBet","SportyBet","Betlion","1XBet","CastleBet",
  "Gal Sport Betting","BetPawa","Hollywood Bets - SA","BongoBongo","Betway","FNB","Absa",
  "Preference Capital","Hippo.co.za","Coca-Cola","Woolworths SA","Spar","Debonairs","Nandos",
  "Bp South Africa","Puma Energy","Yango"]

def slug(b): return re.sub(r"[^a-z0-9]+","-", b.lower()).strip("-")
IMG = (".svg",".png",".jpg",".jpeg",".webp")
PREF = (".svg",".png")  # prefer vector/transparent

def find_logo(folder):
    best=None
    for root,_,files in os.walk(folder):
        for f in sorted(files):
            ext=os.path.splitext(f)[1].lower()
            if ext in IMG and not f.startswith("."):
                path=os.path.join(root,f)
                try:
                    if os.path.getsize(path)<10: continue
                except OSError: continue
                if ext in PREF: return path          # take preferred immediately
                if best is None: best=path
    return best

manifest={}; ok=0; miss=[]
for b in BRANDS:
    folder=os.path.join(APP,b)
    if not os.path.isdir(folder): miss.append(b); continue
    src=find_logo(folder)
    if not src: miss.append(b); continue
    ext=os.path.splitext(src)[1].lower()
    dst=os.path.join(OUT, slug(b)+ext)
    try:
        shutil.copyfile(src,dst); manifest[b]=slug(b)+ext; ok+=1
    except Exception as e:
        miss.append(f"{b} ({e})")

with open(os.path.join(OUT,"manifest.json"),"w") as fh: json.dump(manifest,fh,indent=1)
print(f"copied {ok}/{len(BRANDS)} logos")
if miss: print("missing:", miss)
