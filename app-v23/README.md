# Onjang restaurant operations MVP

Korean owner-only restaurant dashboard. React + TypeScript frontend, Cloudflare Worker API, D1 persistence. The application is a private demonstration with sample records, not a production payroll or legal filing service.

## Local run

Use Node 24 or later.

1. npm ci
2. npm run build
3. npm run dev
4. Open http://127.0.0.1:5187

Local preview uses a SQLite file at work/preview.sqlite and a local-only owner identity. It listens only on loopback. Production uses Sites-provided identity and D1, never the local identity.

## Validation

- npm run check
- node scripts/check-model.mjs (after build)

## Architecture

- app/dashboard.tsx: eight functional views and forms
- lib/model.ts: validation, Korean calendar handling, sample data and payroll arithmetic
- app/worker.ts: authenticated API, request-origin checks and optimistic concurrency
- db/schema.ts and drizzle/: database schema and generated migrations
- scripts/portable-build.mjs: direct Rolldown/Tailwind build to dist/client and dist/server; this avoids subprocess pipe restrictions in the desktop environment
- scripts/preview.mjs: local-only server and SQLite adapter
- .openai/hosting.json: site identity and logical D1 binding

The starter's framework configuration remains available, but the active build uses the portable Worker entry point. Production deployment uploads dist, including the hosting manifest and generated migrations. No credentials are stored in source.

## Product limits

The QR opens an owner-only attendance rehearsal. Employee identities, employee invitation and location verification are not implemented. Payroll uses current hourly wage and completed attendance records, grouped by the shift's Korean start month; it does not split cross-month shifts. Statutory allowances, taxes and insurance require manual review and entry. No wage history, payroll lock, payroll statement delivery, e-signature, official filings, transfers, POS sync or external reservation sync is implemented. Contract content is a draft/notes field and external signature status is manually recorded. Starter sample records are persisted together with the first successful edit. No irreversible record deletion is exposed.

Concurrent edits use per-owner optimistic versions; conflicts require refreshing before retrying. The initial storage model is suitable for a small private MVP and capped to bound document size; separate normalized records and append-only audit events are needed for a larger commercial service.
