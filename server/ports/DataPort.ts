// server/ports/DataPort.ts
// The boundary between the engine and the world. Everything external sits behind
// an interface with a Mock impl, so the whole app boots with MOCK=1 and zero
// secrets (Billy-Zimba posture: mock-first, ports/adapters).
//
// A real adapter (e.g. PipelineDataAdapter that shells the CLIP v3 pipeline, or a
// PostgresDataAdapter) implements this same interface and drops in with no change
// to the server or the domain layer.

import type { DetectionRecord } from "../../shared/types";

export interface DataPort {
  /** identifier for /healthz and logging */
  readonly name: string;
  /** raw detections; the domain layer derives all rollups/bands from these */
  getDetections(): Promise<DetectionRecord[]>;
  /** market label, e.g. "Lusaka, Zambia" */
  market(): string;
  /** report as-of date (ISO) */
  asOf(): string;
}
