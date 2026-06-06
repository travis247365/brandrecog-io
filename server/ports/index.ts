// server/ports/index.ts
// Adapter selection. MOCK=1 (the default for the demo) -> MockDataAdapter.
// A real adapter would be wired here behind the same DataPort interface.

import type { DataPort } from "./DataPort";
import { MockDataAdapter } from "./MockDataAdapter";

export function makeDataPort(): DataPort {
  const mock = process.env.MOCK !== "0"; // mock-first: on unless explicitly disabled
  if (mock) return new MockDataAdapter();
  // Future: return new PipelineDataAdapter() / new PostgresDataAdapter()
  return new MockDataAdapter();
}

export type { DataPort };
