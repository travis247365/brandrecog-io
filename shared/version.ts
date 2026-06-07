// shared/version.ts
// Single source of truth for the app version. Bump by +0.0.1 per shipped change;
// keep CHANGELOG.md in step. Surfaced via /healthz and /api/config, shown in the UI.
export const VERSION = "2.1.0";
export const VERSION_LABEL = `v${VERSION}`;
