# 360Editor

Build, brand, and export interactive **360° virtual tours** entirely in the browser. Upload equirectangular panoramas, link rooms together with directional arrow hotspots, drop a logo watermark on top, then export a **single self-contained HTML file** that runs anywhere — no server, no plugins, no dependencies.

Built with **Next.js 16 (App Router)**, **React 19**, **Supabase** (Postgres + Auth + Storage), **Tailwind CSS v4**, **shadcn/ui**, and **[Pannellum 2.5.6](https://pannellum.org/)** as the WebGL panorama viewer.

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
| Panorama viewer | Pannellum 2.5.6, loaded from jsDelivr CDN at runtime |
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
│       └── hotspots/route.js            # POST create hotspot
│           hotspots/[id]/route.js       # PATCH / DELETE hotspot
│
├── components/
│   ├── 360editor/
│   │   ├── dashboard/dashboard.js       # Dashboard client: project grid, create/delete, avatar menu
│   │   └── project/                     # THE EDITOR (split across focused files)
│   │       ├── middle.jsx               # Main editor component <ProjectClient> — the orchestrator
│   │       ├── editor_utils.js          # Pure helpers: projection math, flags reducer, Pannellum CSS
│   │       ├── editor_modals.jsx        # Spinner, CameraControls, Settings/Delete/HotspotDelete modals
│   │       ├── scene_panel.jsx          # LEFT panel — scene list, upload, reorder, active scene
│   │       ├── hotspot_panel.jsx        # RIGHT panel — arrow palette, hotspot size, logo size, list
│   │       ├── hotspot_overlay.jsx      # Floating hotspot editor popup (HotspotPopup)
│   │       ├── logo_overlay.jsx         # Draggable logo watermark overlay on the viewer
│   │       ├── preview.jsx              # Full-screen live preview modal (TourPreviewModal)
│   │       └── export.jsx               # buildTourHtml() — standalone HTML tour exporter
│   │
│   └── ui/                              # shadcn/ui primitives (button, dialog, input, dropdown, …)
│
├── lib/
│   ├── supabase-server.js       # Session-bound server client (publishable key, RLS ON)
│   ├── supabase-admin.js        # Service-role client (RLS BYPASSED — privileged ops only)
│   ├── supabase-middleware.js   # Edge/proxy client used by proxy.js
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
| **Middle** | `middle.jsx` | The live Pannellum 360° viewer + all interaction: hotspot placement, logo drag, sync loop. |
| **Right** | `hotspot_panel.jsx` | Arrow palette (drag to place), the common **Hotspot size** slider, **Logo size** slider, and the list of placed hotspots. |

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

`buildTourHtml(project, scenes, hotspots)` returns a **single HTML string** that boots Pannellum from CDN, embeds every scene + hotspot as inline config, renders arrow hotspots with hover labels at the project's common `hotspot_size`, and paints the logo watermark. The output is fully standalone — host it anywhere or email it as-is.

> JSON embedded into the inline `<script>` is escaped (`\u003c` / `\u003e`) so a scene name containing `</script>` can't break out — a stored-XSS guard.

---

## The editor internals (`middle.jsx`)

`<ProjectClient projectId>` is the orchestrator. It was split for readability — pure logic and dialogs now live beside it:

- **`editor_utils.js`** — `screenToPitchYaw` / `pitchYawToScreen` (Pannellum spherical projection), `roundTo2`, `clampPct`, the `flagsReducer` for busy states (`exporting`, `savingSettings`, `deleting`, `savingHotspot`), and the injected `PANNELLUM_STYLES`.
- **`editor_modals.jsx`** — `Spinner`, `CameraControls`, `SettingsModal` (logo upload + auto-rotate + intro toggle), `DeleteModal` (project), `HotspotDeleteModal` (per-hotspot confirmation).

Key behaviours inside `middle.jsx`:

- **Hotspot placement** uses correct spherical projection math so an arrow lands exactly where you drop it, at any view angle.
- A **`requestAnimationFrame` loop** keeps the on-screen placement pin/arrow tracked to the sphere in real time; it's paused (`previewOpenRef`) while the preview modal is open.
- Hotspots are synced to Pannellum **incrementally** (`addHotSpot`/`removeHotSpot`) rather than reinitialising the viewer; an arrow is re-rendered only when its size or label changes.
- **Hotspot size** is one project-level value (`projects.hotspot_size`) applied to every arrow, adjusted like logo size (live drag → save on release).
- Hovering an arrow reveals its **label tooltip**, both in the editor and in the exported tour.
- Deleting a hotspot opens a **styled confirmation modal** (no more instant delete).

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
| `logo_url` | nullable |
| `logo_x`, `logo_y` (real) | watermark position %, default 50 |
| `logo_size` (int) | default 160 |
| `hotspot_size` (int) | **common arrow size**, default 90 |
| `auto_rotate` (float) | deg/sec, default −3 |
| `show_intro` (bool) | default true |

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
| `/api/forgot-password` `/api/reset-password` | POST | Password reset flow |
| `/api/auth/callback` | GET | Exchange auth code for a session |
| `/api/profile` | GET | Current user's profile (falls back to auth email) |
| `/api/projects` | POST | Create a project |
| `/api/projects/[id]` | GET / PATCH / DELETE | Full project (project + scenes + hotspots) / settings / delete |
| `/api/projects/[id]/logo` | POST / DELETE | Upload / remove logo |
| `/api/scenes/upload-url` | POST | Signed direct-to-storage upload URL |
| `/api/scenes` | POST | Create scene row |
| `/api/scenes/[id]` | PATCH / DELETE | Update initial view / delete scene |
| `/api/hotspots` | POST | Create hotspot |
| `/api/hotspots/[id]` | PATCH / DELETE | Update / delete hotspot |

`PATCH /api/projects/[id]` accepts and clamps: `name`, `logo_url`, `show_intro`, `auto_rotate`, `logo_x`, `logo_y`, `logo_size`, `hotspot_size` (40–400).

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

- **Duplicate dashboard page:** both `app/360editor/page.js` (current — profile fetched via `/api/profile`) and `app/360editor/page.jsx` (older — fetches profiles inline) exist. Next.js treats these as a conflicting route; **delete `page.jsx`** and keep `page.js`.
- **Scene deletion & dangling hotspots:** deleting a scene should cascade to hotspots whose `target_scene_id` points at it (dead nav arrows) — ensure a DB foreign-key `on delete` rule or clean them up server-side.
- **Font fallbacks:** `login` / `signup` / `privacy` / `terms` reference the `Fraunces` display font without loading it on those pages; they fall back to Georgia. Add the Google Fonts `<link>` if you want consistent display type there.

---

Built for real client work — real-estate listings, wedding venues, showrooms — where the deliverable is a branded tour you can hand over and it just works.