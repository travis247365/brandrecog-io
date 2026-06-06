// server/ports/RealData.ts
// Loads the recognition datasets. Two tiers:
//   real  — business/verified accounts (campaign.real.json, 876 detections)
//   mock  — free-email / demo accounts (campaign.mock.json, synthetic Lusaka, geo)
// Cached after first read.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RealRecord } from "../../shared/types";

export interface RealFile {
  market: string;
  asOf: string;
  source: string;
  records: RealRecord[];
}

export type DatasetKind = "real" | "mock";

const PATHS: Record<DatasetKind, string> = {
  real: process.env.REAL_DATA_PATH ?? resolve(process.cwd(), "server/data/campaign.real.json"),
  mock: process.env.MOCK_DATA_PATH ?? resolve(process.cwd(), "server/data/campaign.mock.json"),
};

const cache: Partial<Record<DatasetKind, RealFile>> = {};

export function loadDataset(kind: DatasetKind): RealFile {
  if (!cache[kind]) cache[kind] = JSON.parse(readFileSync(PATHS[kind], "utf8")) as RealFile;
  return cache[kind] as RealFile;
}

export function loadReal(): RealFile { return loadDataset("real"); }
