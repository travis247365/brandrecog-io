// server/ports/MockDataAdapter.ts
// Mock-first data source. Reads the bundled SYNTHETIC Lusaka sample and maps it
// into typed DetectionRecords, computing the v2 value band and brand origin.
// No real personal data, ever — this is labelled "sample" downstream.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DataPort } from "./DataPort";
import type { DetectionRecord } from "../../shared/types";
import { sectorForBrand, originForBrand } from "../domain/sectors";
import { decayedValueBand, freshness } from "../domain/decay";

interface RawRecord {
  File: string;
  "Detected Brand": string;
  Confidence: number;
  Sector?: string;
  Latitude?: number;
  Longitude?: number;
  "Site Name"?: string;
  Suburb?: string;
  City?: string;
  "First Seen"?: string;
  "Days Live"?: number;
  Freshness?: number;
  "Base Rate"?: number;
  "Est. Daily Traffic"?: number;
  "Estimated Reach"?: number;
  "Creative Change Flag"?: boolean;
}

interface RawFile {
  records: RawRecord[];
  meta?: { as_of?: string };
}

const DATA_PATH = process.env.SAMPLE_DATA_PATH
  ?? resolve(process.cwd(), "server/data/campaign.sample.json");

export class MockDataAdapter implements DataPort {
  readonly name = "mock";
  private raw: RawFile;

  constructor() {
    this.raw = JSON.parse(readFileSync(DATA_PATH, "utf8")) as RawFile;
  }

  market(): string {
    return "Lusaka, Zambia";
  }

  asOf(): string {
    return this.raw.meta?.as_of ?? new Date().toISOString().slice(0, 10);
  }

  async getDetections(): Promise<DetectionRecord[]> {
    return this.raw.records.map((r): DetectionRecord => {
      const brand = r["Detected Brand"];
      const sector = r.Sector ?? sectorForBrand(brand);
      const daysLive = r["Days Live"] ?? 0;
      const baseRate = r["Base Rate"];
      return {
        file: r.File,
        brand,
        confidence: r.Confidence,
        sector,
        origin: originForBrand(brand),
        lat: r.Latitude,
        lon: r.Longitude,
        siteName: r["Site Name"],
        suburb: r.Suburb,
        city: r.City,
        firstSeen: r["First Seen"],
        daysLive,
        freshness: r.Freshness ?? freshness(daysLive, sector),
        baseRate,
        valueBand: decayedValueBand(baseRate, daysLive, sector),
        dailyTraffic: r["Est. Daily Traffic"],
        mgo: r["Estimated Reach"] ?? 0,
        creativeChange: Boolean(r["Creative Change Flag"]),
      };
    });
  }
}
