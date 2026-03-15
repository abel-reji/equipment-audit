# Rotating Equipment Audit

Rotating Equipment Audit is a mobile-first field capture app for logging rotating equipment by customer and site, with offline drafts, queued sync, private photo storage, and lightweight reporting.

## What it does

- Email magic-link sign-in with Supabase Auth
- Customer and site management
- Customer-first asset capture
- Optional photo capture or phone photo upload
- Optional geotag capture from the phone
- Asset enrichment for:
  - equipment model and serial
  - driver details
  - coupling details
- Asset detail editing after capture
- Private photo storage in Supabase Storage
- CSV export by customer or site
- Offline draft persistence with queued sync

## Current product shape

The app is optimized for this workflow:

1. Create or select a customer.
2. Create or open a site.
3. Add assets under that site from phone or desktop.
4. Save quickly in sequence without leaving the new-asset flow.
5. Reopen assets later for cleanup, enrichment, photo review, and reporting.

Recent sites are now intended to become account-level across devices through a shared `last_used_at` site field in Supabase. Recent assets on the home page are built from a merged local/server view.

## Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Dexie / IndexedDB for local cache, drafts, and sync queue
- Supabase Auth
- Supabase Postgres with RLS
- Supabase Storage for private asset photos

## Key screens

- `Home`
  Recent sites, recent assets, and quick launch actions
- `Customers`
  Create, edit, and delete customers
- `Sites`
  Create, browse, and open site context
- `Site Detail`
  View site context, inspect saved assets, and jump into new asset capture
- `New Asset`
  Rapid asset entry with optional photos, geotag, driver fields, and coupling fields
- `Asset Detail`
  Edit asset details, manage photos, capture location, and delete the asset
- `Reports`
  Download CSV exports by customer or site
- `More`
  Secondary navigation hub for reports and future maps work

## Data model highlights

- `accounts`
  Maps authenticated users to app tenancy
- `customers`
  Top-level account/customer records
- `sites`
  Site context under a customer, including shared `last_used_at`
- `assets`
  Core asset records
- `asset_drivers`
  Driver enrichment fields
- `asset_couplings`
  Coupling enrichment fields
- `asset_photos`
  Private photo metadata linked to Supabase Storage

## Local setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local`.
3. Set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Apply the Supabase SQL migrations in order:
   - [20260314131500_init.sql](/C:/Users/abel/OneDrive/Documents/plant-audit/supabase/migrations/20260314131500_init.sql)
   - [20260314170000_asset_enrichment.sql](/C:/Users/abel/OneDrive/Documents/plant-audit/supabase/migrations/20260314170000_asset_enrichment.sql)
   - [20260314183000_asset_geotagging.sql](/C:/Users/abel/OneDrive/Documents/plant-audit/supabase/migrations/20260314183000_asset_geotagging.sql)
   - [20260314194500_asset_driver_serial.sql](/C:/Users/abel/OneDrive/Documents/plant-audit/supabase/migrations/20260314194500_asset_driver_serial.sql)
   - [20260314224500_site_last_used_at.sql](/C:/Users/abel/OneDrive/Documents/plant-audit/supabase/migrations/20260314224500_site_last_used_at.sql)
5. Run `npm install`.
6. Run `npm run dev`.

## Supabase configuration

For deployed magic-link sign-in, configure:

- `Site URL`
  Your deployed base URL
- Redirect URLs
  Include:
  - `http://localhost:3000/auth/callback`
  - your deployed callback URL, for example `https://equipment-audit.vercel.app/auth/callback`

Photos are stored in the private `asset-photos` bucket created by the initial migration.

## Offline and sync behavior

- Drafts are stored locally in IndexedDB.
- Assets can be saved without photos.
- Photos upload later when connectivity is available.
- Local edits are queued and synced when the app is online.
- Sync state is shown in the UI through status pills.

Important nuance:

- `Updated` timestamps are intended to represent record modification time, not sync time.
- Site recents use `last_used_at`, not `updated_at`.

## Reporting

The first reporting slice is CSV export.

Exports are available by:

- customer
- site

The CSV currently includes:

- customer and site context
- core asset fields
- status and service/application
- geotag fields
- driver fields
- coupling fields
- capture and update timestamps

## Current limitations

- Search is no longer a primary navigation item and is not the main workflow.
- Maps page is a placeholder only.
- Reports currently export CSV only, not XLSX.
- No document upload workflow yet.
- No OCR or AI extraction yet.
- No role-based multi-user admin beyond account isolation.

## Recommended next features

- Open geotagged assets in Apple Maps / Google Maps
- Duplicate asset from an existing record
- Richer report outputs
- XLSX export if presentation-ready spreadsheets become necessary
- Optional OCR for equipment tag photos
