# 360Editor

Build, brand, and export interactive **360° virtual tours** entirely in the browser. Upload equirectangular panoramas, link rooms together with directional arrow hotspots, mark polygon zones (available/booked/etc, with a detail card), drop a logo watermark on top, then export a **single self-contained HTML file** that runs anywhere — no server, no plugins, just a CDN fetch for the viewer library.

Built with **Next.js 16 (App Router)**, **React 19**, **Supabase** (Postgres + Auth + Storage), **Tailwind CSS v4**, **shadcn/ui**, and **[Photo Sphere Viewer](https://photo-sphere-viewer.js.org/) 5** (+ its Markers and Autorotate plugins) as the WebGL panorama viewer.

---

## Table of contents

1. [Tech stack](#tech-stack)
2. [Quick start](#quick-start)
3. [Environment variables](#environment-variables)
4. [Project structure — where is what](#project-structure--where-is-what)
5. [Architecture](#architecture)
6. [The editor internals (`middle.jsx`)](#the-editor-internals-middlejsx)
7. [Database schema](#database-schema)
8. [Storage buckets](#storage-buckets)
9. [API reference](#api-reference)
10. [Styling & design tokens](#styling--design-tokens)
11. [Deployment](#deployment)
12. [Known cleanup items](#known-cleanup-items)

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js `^16.2.7` (App Router), React `^19.2` |
| Language | JavaScript (JSX), path alias `@/*` → repo root |
| Auth / DB / Storage | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) |
| Panorama viewer | Photo Sphere Viewer 5 (`@photo-sphere-viewer/core` + `markers-plugin`, real npm deps) in the editor; same version loaded from jsDelivr CDN at runtime in the exported/published tour |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`), `tw-animate-css` |
| UI primitives | shadcn/ui on top of Radix UI, `lucide-react` icons |
| Utilities | `clsx` + `tailwind-merge` (`cn()`), `class-variance-authority` |

Fonts (**Inter** for UI, **Fraunces** for display headings) are loaded per-page via Google Fonts `<link>` tags, so the marketing and editor surfaces are visually self-contained.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Add your Supabase keys (see next section)
#    create .env.local in the repo root

# 3. Run the dev server
npm run dev
```

Open <http://localhost:3000>. Scripts:

```bash
npm run dev     # next dev
npm run build   # next build
npm run start   # next start (production)
```

---

## Environment variables

Create `.env.local` in the repo root:

```bash
# Public — safe in the browser, RLS-enforced (anon/publishable key)
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-anon-key>

# Private — SERVER ONLY, bypasses RLS. Never expose to the browser.
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

> On Vercel, add all three under **Settings → Environment Variables** for every environment (Production, Preview, Development), then redeploy **without build cache** — the publishable values are baked into the Edge proxy at build time.

---

## Project structure — where is what

```
360editor3.0/
├── proxy.js                     # Next.js 16 middleware (renamed middleware→proxy). Auth gate.
├── next.config.mjs              # Allows https://*.supabase.co images
├── jsconfig.json                # Path alias "@/*" → repo root
├── postcss.config.mjs           # Tailwind v4 via @tailwindcss/postcss
├── components.json              # shadcn/ui config
├── db/                          # SQL schema changes, applied by hand against Supabase (no migration
│                                 # runner in this repo) — see "Database schema" below
│
├── app/                         # App Router: pages + API routes
│   ├── layout.js                # Root layout, <html>/<body>, global metadata
│   ├── globals.css              # Tailwind base + design tokens + global button cursor/press rules
│   ├── page.js                  # PUBLIC LANDING PAGE (hero + live demo + editor showcase + steps)
│   │
│   ├── login/page.js            # Auth screens
│   ├── signup/page.js
│   ├── forgot_password/page.jsx
│   ├── reset_password/page.jsx
│   ├── privacy/page.jsx
│   ├── terms/page.jsx
│   │
│   ├── 360editor/
│   │   ├── page.js              # DASHBOARD (server component): auth check + projects fetch
│   │   └── project/[id]/page.jsx# EDITOR route — renders <ProjectClient/>
│   │
│   └── api/                     # Route handlers (server-only)
│       ├── auth/callback/route.js       # OAuth/email callback → exchange code for session
│       ├── login|signup|logout/route.js # Email/password auth
│       ├── forgot-password/route.js     # Send reset email
│       ├── reset-password/route.js      # Set new password
│       ├── profile/route.js             # GET current user's profile (used by dashboard + avatar)
│       ├── projects/route.js            # POST create project
│       ├── projects/[id]/route.js       # GET (project+scenes+hotspots) / PATCH settings / DELETE
│       ├── projects/[id]/logo/route.js  # POST upload logo / DELETE logo (bucket: scenes/logos/)
│       ├── scenes/route.js              # POST create scene row (after upload)
│       ├── scenes/[id]/route.js         # PATCH (initial view) / DELETE scene
│       ├── scenes/upload-url/route.js   # POST → returns a signed upload URL (bypasses body limit)
│       ├── hotspots/route.js            # POST create hotspot
│       │   hotspots/[id]/route.js       # PATCH / DELETE hotspot
│       └── polygons/route.js            # POST create polygon zone
│           polygons/[id]/route.js       # PATCH (status/label/detail) / DELETE zone
│
├── components/
│   ├── 360editor/
│   │   ├── dashboard/dashboard.js       # Dashboard client: project grid, create/delete, avatar menu
│   │   └── project/                     # THE EDITOR (split across focused files)
│   │       ├── middle.jsx               # Main editor component <ProjectClient> — the orchestrator
│   │       ├── editor_utils.js          # Pure helpers: roundTo2/clampPct, the flags reducer
│   │       ├── editor_modals.jsx        # Spinner, CameraControls, Settings/Delete/HotspotDelete modals
│   │       ├── scene_panel.jsx          # LEFT panel — scene list, upload, reorder, active scene
│   │       ├── hotspot_panel.jsx        # RIGHT panel — arrow palette, hotspot size, logo size, list
│   │       ├── hotspot_overlay.jsx      # Floating hotspot editor popup (HotspotPopup)
│   │       ├── overlay_panel.jsx        # Logos + cover-ups list panel (OverlayPanel)
│   │       ├── polygon_panel.jsx        # Polygon zones list panel + "Draw zone" (PolygonPanel)
│   │       ├── polygon_overlay.jsx      # Floating zone popup — new/view/edit (PolygonPopup)
│   │       ├── preview.jsx              # Full-screen live preview modal (TourPreviewModal)
│   │       └── export.jsx               # buildTourHtml() — standalone HTML tour exporter
│   │
│   └── ui/                              # shadcn/ui primitives (button, dialog, input, dropdown, …)
│
├── lib/
│   ├── supabase-server.js       # Session-bound server client (publishable key, RLS ON)
│   ├── supabase-admin.js        # Service-role client (RLS BYPASSED — privileged ops only)
│   ├── supabase-middleware.js   # Edge/proxy client used by proxy.js
│   ├── overlays.js              # Validate/normalize logos + cover-ups (projects.overlays/coverups)
│   ├── polygons.js              # Validate/normalize polygon zones; colorForStatus(), centroidOf()
│   └── utils.js                 # cn() = clsx + tailwind-merge
│
├── hooks/
│   └── use-mobile.js            # Viewport helper
│
└── public/                      # Static assets
```

### The three panels of the editor

The editor is a three-column layout, each column its own file:

| Position | File | Responsibility |
|---|---|---|
| **Left** | `scene_panel.jsx` | The list of scenes (rooms). Upload panoramas, pick the active scene, delete. |
| **Middle** | `middle.jsx` | The live Photo Sphere Viewer 360° viewer + all interaction: hotspot placement, overlay drag, polygon drawing, sync loop. |
| **Right** | `hotspot_panel.jsx` (directions), `overlay_panel.jsx` (logos/cover-ups), `polygon_panel.jsx` (zones) | Stacked panels: arrow palette + hotspot size, overlay list + save, and the polygon zone list + "Draw zone". |

---

## Architecture

### Auth & routing (`proxy.js`)

The middleware (named `proxy` in Next 16) runs on every non-asset request and gates access:

- `protectedRoutes = ['/360editor']` — not logged in → redirected to `/`.
- `authRoutes = ['/', '/login', '/signup']` — already logged in → redirected to `/360editor`.
- Cookies are carried across redirects so the session survives the hop.

### The three Supabase clients

Choosing the right client is the core security rule of this codebase:

| File | Key | RLS | Use it for |
|---|---|---|---|
| `lib/supabase-server.js` | Publishable (anon) | **Enforced** | Almost everything. Queries run **as the logged-in user**. |
| `lib/supabase-middleware.js` | Publishable (anon) | Enforced | Only inside `proxy.js` (edge, cookie-aware). |
| `lib/supabase-admin.js` | Service role | **Bypassed** | Privileged ops that can't run as the user (e.g. issuing signed upload URLs). Never sent to the browser, never used to skip ownership checks. |

### Request flow

1. Browser → Next.js route handler in `app/api/**`.
2. Handler creates a **session-bound** client (`supabase-server`) and runs the query as the user — RLS guarantees a user only ever touches their own rows.
3. For the few privileged operations, the handler uses `supabase-admin` **after** manually verifying ownership.

### Panorama upload flow (signed URLs)

Large panoramas would blow past the serverless request body limit, so uploads never pass through the API body:

1. Client asks `POST /api/scenes/upload-url` for a **signed upload URL** (admin client, ownership checked).
2. Client uploads the file **directly to Supabase Storage** using that URL.
3. Client calls `POST /api/scenes` to insert the scene row (path + public URL + default view angles).

### Logo flow

- `POST /api/projects/[id]/logo` uploads the image to the **`scenes`** bucket under a `logos/` path and stores `logo_url` on the project.
- Position (`logo_x`, `logo_y`) and `logo_size` are stored as percentages/pixels on the project and applied both in the editor and the exported tour.
- `DELETE` removes the file from storage **and** clears the column.

### Export flow (`export.jsx`)

`buildTourHtml({ project, scenes, hotspots, polygons })` returns a **single HTML string** that boots Photo Sphere Viewer and its Markers plugin from a CDN import map, embeds every scene's arrows/cover-ups/polygon zones as inline config, renders arrow hotspots with hover labels at the project's common `hotspot_size`, paints the logo watermark, and (if `auto_rotate` is non-zero) loads the Autorotate plugin too. The output is fully standalone — host it anywhere or email it as-is; it still needs a one-time internet fetch of the viewer library from jsDelivr.

This same file also builds the marketing landing page's procedural demo tour (`app/page.js`), using the identical CDN import-map pattern.

> JSON embedded into the inline `<script>` is escaped by `safeJson()` (`<` / `>`, plus the U+2028/U+2029 line/paragraph-separator control characters) so a scene name containing `</script>` -- or a raw line separator -- can not break the script out of its tag.

---

## The editor internals (`middle.jsx`)

`<ProjectClient projectId>` is the orchestrator. It was split for readability — pure logic and dialogs now live beside it:

- **`editor_utils.js`** — `roundTo2`, `clampPct`, the `flagsReducer` for busy states (`exporting`, `savingSettings`, `deleting`, `savingHotspot`). The spherical-projection math that used to live here (`screenToPitchYaw`/`pitchYawToScreen`) is gone — it only existed because Pannellum didn't expose that conversion; Photo Sphere Viewer does, via `viewer.dataHelper.viewerCoordsToSphericalCoords()` / `.sphericalCoordsToViewerCoords()`, called directly where `middle.jsx` needs them.
- **`editor_modals.jsx`** — `Spinner`, `CameraControls`, `SettingsModal` (auto-rotate + intro toggle), `DeleteModal` (project), `HotspotDeleteModal` (per-hotspot confirmation).

Key behaviours inside `middle.jsx`:

- **Hotspot placement** uses PSV's own coordinate-conversion methods so an arrow lands exactly where you drop it, at any view angle.
- A **`requestAnimationFrame` loop** keeps the on-screen placement pin, the selected cover-up, and any open polygon popup tracked to the sphere in real time; it's paused (`previewOpenRef`) while the preview modal is open.
- Arrows and cover-ups are rendered as real PSV **Markers plugin** markers, diffed by `mp.setMarkers()` on every relevant state change — no manual add/remove bookkeeping. PSV has no native marker-dragging, so whichever one is actively being edited (a hotspot mid-edit, the selected cover-up) is excluded from the marker list and swapped for a plain draggable React element instead — the same interaction either way.
- **Hotspot size** is one project-level value (`projects.hotspot_size`) applied to every arrow, adjusted like logo size (live drag → save on release).
- Hovering an arrow reveals its **label tooltip** (PSV's native marker tooltip), both in the editor and in the exported tour.
- Deleting a hotspot opens a **styled confirmation modal** (no more instant delete).
- **Polygon zones** (`polygon_panel.jsx` / `polygon_overlay.jsx`): click "Draw zone", click 3+ points on the panorama (a live dashed preview line grows with each click, same interaction pattern validated end-to-end before the viewer migration), then Finish opens a form for label/status/detail. Points are immutable once saved — the popup only edits status/label/detail afterward. Status drives fill color (`lib/polygons.js`'s `colorForStatus`); hovering an existing zone brightens it via `enter-marker`/`leave-marker` + `updateMarker()`.

---

## Database schema

Postgres tables in Supabase (RLS on, keyed to `auth.users`):

**`profiles`**
| column | notes |
|---|---|
| `id` (uuid, PK) | = `auth.users.id` |
| `email`, `first_name`, `last_name`, `role` | display + role |

**`projects`**
| column | notes |
|---|---|
| `id` (uuid, PK) | |
| `user_id` (uuid) | FK → `auth.users`, `on delete cascade` |
| `name`, `created_at`, `updated_at` | `updated_at` via trigger |
| `overlays` (jsonb array) | logos — screen-anchored; see `lib/overlays.js`. The old flat `logo_url`/`logo_x`/`logo_y`/`logo_size` columns were dropped once this shipped — `projectLogos()` still reads that legacy shape as a fallback so tours published before the migration keep rendering. |
| `coverups` (jsonb array) | sphere-anchored cover-ups; same file |
| `hotspot_size` (int) | **common arrow size**, default 90 |
| `auto_rotate` (float) | deg/sec, default −3 |
| `show_intro` (bool) | default true |
| `slug` (text, nullable) | public-tour URL segment; assigned once on first publish, frozen after |
| `published_at` (timestamptz, nullable) | null = never published / currently unpublished |
| `published_payload` (jsonb, nullable) | frozen snapshot (`{ v, project, scenes, hotspots, polygons }`) served by the public tour route (`app/[userId]/[slug]/route.js`), regenerated to HTML on every request rather than pre-baked. `v: 2` added `polygons`; readers treat it as `?? []` so tours published before this feature still render. |

**`scenes`**
| column | notes |
|---|---|
| `id`, `project_id`, `name` | |
| `storage_path`, `url` | file in the `scenes` bucket |
| `initial_yaw`, `initial_pitch`, `initial_hfov` | opening camera angle |
| `created_at` | ordering |

**`hotspots`**
| column | notes |
|---|---|
| `id`, `scene_id`, `project_id` | |
| `pitch`, `yaw` | position on the sphere |
| `arrow_type` | `up` / `left` / `up-left` / `up-right` |
| `label` | hover tooltip text |
| `target_scene_id` | the room this arrow navigates to |

**`polygons`** — added in `db/001_create_polygons.sql`
| column | notes |
|---|---|
| `id`, `scene_id`, `project_id` | always scene-scoped — no "every scene" concept, unlike logos/cover-ups |
| `points` (jsonb) | `[[yaw_deg, pitch_deg], ...]`, >= 3 pairs; immutable once created (reshaping isn't supported yet — delete and redraw) |
| `status` (text) | free-form; drives fill color via `lib/polygons.js`'s `colorForStatus()` — unrecognized statuses fall back to a default color rather than being rejected |
| `label`, `detail` (jsonb) | shown in the click-through detail card, in both the editor and the exported/published tour |
| `created_at`, `updated_at` | |

Own table rather than a `projects`-level JSON array (unlike logos/cover-ups) because status is expected to be toggled independently and often — a `PATCH /api/polygons/[id]` row update fits that far better than resaving a whole array on every status flip. Cascades on delete from both `scenes` and `projects` — stricter than `hotspots` (see "Known cleanup items"). **No migration runner exists in this repo** — apply `db/001_create_polygons.sql` (and any future numbered file in `db/`) by hand against Supabase, dev before production.

---

## Storage buckets

| Bucket | Contents | Access |
|---|---|---|
| `scenes` | Panorama images + logo files (under `logos/`) | Signed uploads; served via public URL |
| `hotspots` | Arrow sprites (`arrow_up.gif/.jpg`, `arrow_left…`, etc.) | Public |

---

## API reference

All routes live under `app/api/`. Unless noted, they use the session-bound client and enforce ownership via RLS.

| Route | Methods | Purpose |
|---|---|---|
| `/api/login` `/api/signup` `/api/logout` | POST | Email/password auth |
| `/api/forgot-password` `/api/reset-password` | POST | **Currently stubbed to 404** — the working implementation is commented out in each route file, ready to re-enable |
| `/api/auth/callback` | GET | Exchange auth code for a session |
| `/api/profile` | GET | Current user's profile (falls back to auth email) |
| `/api/projects` | POST | Create a project (spends one credit) |
| `/api/projects/[id]` | GET / PATCH / DELETE | Full project (project + scenes + hotspots + polygons) / settings+overlays / delete |
| `/api/projects/[id]/logo` | POST / DELETE | Legacy single-logo upload path — current editor uses `overlay-image` instead |
| `/api/projects/[id]/overlay-image` | POST / DELETE | Upload/remove the image file behind a logo or cover-up (doesn't touch the project row — the caller saves the URL into `overlays`/`coverups` separately) |
| `/api/projects/[id]/publish` | POST / DELETE | Freeze the current tour into `published_payload` at its permanent link / take it offline (slug kept) |
| `/api/scenes/upload-url` | POST | Signed direct-to-storage upload URL |
| `/api/scenes` | POST | Create scene row |
| `/api/scenes/[id]` | PATCH / DELETE | Update initial view / delete scene |
| `/api/hotspots` | POST | Create hotspot |
| `/api/hotspots/[id]` | PATCH / DELETE | Update / delete hotspot |
| `/api/polygons` | POST | Create a polygon zone |
| `/api/polygons/[id]` | PATCH / DELETE | Update status/label/detail (points are immutable) / delete zone |
| `/api/payments/create-order` `/api/payments/verify` | POST | Razorpay checkout — server looks up the real amount by plan key, client never sends a price |
| `/api/webhooks/razorpay` | POST | Server-to-server payment confirmation (credits are granted here even if the client never calls `/verify`) |

`PATCH /api/projects/[id]` accepts and clamps: `name`, `show_intro`, `auto_rotate`, `hotspot_size` (40-400), `overlays`, `coverups`.

---

## Styling & design tokens

Set in `app/globals.css` and reused across the app:

| Token | Value |
|---|---|
| Indigo (primary) | `#3730a3` (hover `#312e81`) |
| Cream (bg) | `#FAFAF7` |
| Ink (text) | `#1a1a18` |
| Muted | `#6b6b60` |
| Border | `#E2E2DA` |
| Lime accent | `#a3e635` |

`globals.css` also sets an app-wide affordance layer: **`cursor: pointer`** on all buttons/`role=button`/`summary`/`select`, **`cursor: not-allowed`** on disabled/busy controls, and an **instant press animation** (`:active` nudge) so clicks are acknowledged immediately even while a 1–3 s request is in flight. The shared `components/ui/button.jsx` carries `cursor-pointer` + `disabled:cursor-not-allowed` too.

---

## Deployment

Deploys cleanly to **Vercel**:

1. Push the repo and import it in Vercel.
2. Add the three env vars (see above) to all environments.
3. Deploy. If the Edge proxy behaves as if env vars are missing, **redeploy without build cache** — publishable values are baked in at build time.

`next.config.mjs` already whitelists `https://*.supabase.co` for images.

---

## Known cleanup items

- **Scene deletion & dangling hotspots:** deleting a scene should cascade to hotspots whose `target_scene_id` points at it (dead nav arrows) — ensure a DB foreign-key `on delete` rule or clean them up server-side. (`polygons` was deliberately built with `on delete cascade` from both `scenes` and `projects` from the start — don't loosen it to match this gap; fix `hotspots` instead.)
- **Font fallbacks:** `login` / `signup` / `privacy` / `terms` reference the `Fraunces` display font without loading it on those pages; they fall back to Georgia. Add the Google Fonts `<link>` if you want consistent display type there.
- **Polygon reshaping:** points are immutable once a zone is drawn — there's no drag-a-vertex editor yet. Delete and redraw is the only way to change a shape's outline today.
- **Exported-tour zone card position is fixed**, not anchored to the clicked shape's screen position (unlike the editor's popup) — the exported tour has no per-frame projection loop, so it opens in a fixed corner instead. Fine for now; revisit if it feels wrong in practice.

---

Built for real client work — real-estate listings, wedding venues, showrooms — where the deliverable is a branded tour you can hand over and it just works.