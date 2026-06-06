#!/usr/bin/env python3
"""Convert the synthetic Lusaka sample (v1 dashboard_data.json) into the mock
dataset for free-email demo accounts — RealRecord shape, geo retained for the map."""
import json, os

SRC = "/Users/tpmulenga/Desktop/BrandCog.ai (BrandRecog.io)/mvp/server/data/campaign.sample.json"
OUT = "/Users/tpmulenga/Desktop/BrandCog.ai (BrandRecog.io)/mvp/server/data/campaign.mock.json"

LOCAL = {"Zamtel", "Zanaco", "Trade Kings", "MosiLager"}

raw = json.load(open(SRC))
records = []
for r in raw["records"]:
    brand = r.get("Detected Brand")
    if not brand:
        continue
    rec = {
        "file": r.get("File"),
        "brand": brand,
        "confidence": r.get("Confidence"),
        "sector": r.get("Sector") or "other",
        "market": "Zambia",
        "origin": "local" if brand in LOCAL else "multinational",
        "distinct": True,
        "dateTaken": r.get("First Seen"),
    }
    if r.get("Latitude") is not None and r.get("Longitude") is not None:
        rec["lat"] = r["Latitude"]; rec["lon"] = r["Longitude"]
        rec["site"] = r.get("Site Name")
    records.append(rec)

out = {
    "market": "Zambia (Lusaka)",
    "asOf": raw.get("meta", {}).get("as_of", "2026-06-05"),
    "source": "Synthetic Lusaka sample (MOCK) — demo dataset for free-email accounts.",
    "records": records,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, "w"), indent=1)
print("wrote", OUT, "| records:", len(records),
      "| with geo:", sum(1 for r in records if "lat" in r),
      "| brands:", len(set(r["brand"] for r in records)))
