// shared/version.ts
// Single source of truth for the app version. Bump by +0.0.1 per shipped change;
// keep CHANGELOG.md in step. Surfaced via /healthz and /api/config, shown in the UI.
export const VERSION = "1.2.07";
export const VERSION_LABEL = `mvp${VERSION}`;
