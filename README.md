# Plant Audit

Mobile-first PWA for rotating equipment audits with offline draft persistence, queued photo uploads, and Supabase-backed auth/data/storage.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Dexie / IndexedDB for local drafts and sync queue
- Supabase Auth, Postgres, Storage, and RLS
- Vitest and Playwright test scaffolding

## Local setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local`.
3. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Apply the SQL migration in [supabase/migrations/20260314131500_init.sql](/C:/Users/abel/OneDrive/Documents/plant-audit/supabase/migrations/20260314131500_init.sql).
5. Run `npm install`.
6. Run `npm run dev`.

## Current scope

- Magic-link sign-in
- Private per-user tenancy through `accounts`
- Customer and site drafts with later sync
- Offline asset draft persistence in IndexedDB
- Queued photo upload to private Supabase Storage
- Home, site picker, new asset, asset detail, and search screens

## Implementation notes

- The sync queue is single-user and single-device by design for v1.
- Asset status stays `partial` until all queued photos are uploaded.
- Search intentionally covers customers and sites only in phase 1.
- Visit history, documents, opportunities, exports, and AI are deferred.

