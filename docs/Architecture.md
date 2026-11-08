# CampusSync: Architecture & Decision Log

**Companion to:** `CampusSync-Requirements.md` (the WHAT). This document is the HOW: structure, technology, protocols, and the reasoning behind every major choice.
**Rule:** if this document and the requirements ever conflict, the requirements win.

---

## 1. Architecture at a Glance

```
 BROWSER (installable PWA)                      ORACLE SERVER (ARM64, shared box)
┌─────────────────────────────┐                ┌─────────────────────────────────────┐
│ UI pages                    │                │ Traefik (existing, owns 80/443)     │
│    │                        │                │    │  routes campussync host        │
│ Sync engine                 │  push / pull   │    ▼                                │
│  • outbox sender            │ ─────────────► │ campussync-app container            │
│  • retry + backoff          │ ◄───────────── │  • Fastify API                      │
│  • cursor tracking          │  SSE (live)    │  • serves the built PWA files       │
│    │                        │ ◄───────────── │  • auth, validation, apply-edit     │
│ Local DB (IndexedDB)        │                │  • conflicts, history, restore      │
│  • record cache             │                │  • integrity checker                │
│  • outbox queue             │                │    │                                │
│  • sync cursor              │                │ campussync-db container             │
│ Service worker              │                │  • Postgres 16 (private network)    │
│  • caches app shell         │                └─────────────────────────────────────┘
└─────────────────────────────┘
```

**Three jobs, cleanly split:**
1. **Client:** works with no internet, queues edits, shows honest status.
2. **Server:** the only authority on what is true. Validates, versions, detects conflicts, records history.
3. **Postgres:** durable storage and the transaction guarantees that make correctness provable.

---

## 2. Decision Log

Every row is a decision already made. Revisit only with a concrete reason.

| ID | Decision | Alternatives considered | Why this one | Trade-off accepted |
|---|---|---|---|---|
| D1 | **Own server owns every write** | Firebase/Firestore-only | Firestore offline is last-write-wins: concurrent offline edits silently overwrite each other, which is the exact problem the challenge describes. We need versioning, idempotency, and custom conflict logic. | We write the sync logic ourselves |
| D2 | **Postgres 16** | Firestore, MongoDB, SQLite | The correctness story needs transactions, row locks, unique constraints, and SQL integrity queries. Duplicate prevention and the integrity checker become simple. | Slightly more setup than a NoSQL DB |
| D3 | **Node.js + TypeScript + Fastify** | FastAPI (Python), Express | One language across client and server lets us share validation schemas. Fastify is fast, light on RAM, and has built-in schema validation. | None significant |
| D4 | **Shared validation schemas (Zod) in one `shared/` package** | Separate rules on client and server | The same rules run on device and server, so they cannot drift. The server still re-validates (never trusts the client). | Needs a small monorepo |
| D5 | **React + Vite + TypeScript PWA** | Flutter web, native mobile | Judges open a link, nothing to install. Service workers give offline app loading. Vite builds are quick. | Not a native app |
| D6 | **IndexedDB via Dexie** for local storage | localStorage, SQLite-wasm | IndexedDB is the only built-in browser store that is large, async, and transactional. Dexie makes it usable. | Extra small dependency |
| D7 | **Outbox pattern** | Direct writes with retry-in-memory | Edits are saved to disk before any network call, so they survive refresh, crash, and restart (FR-4.3). | Slightly more client code |
| D8 | **Client-generated UUIDs for records and operations** | Server-generated IDs | Records created offline cannot collide, and every operation has a stable identity for idempotency. | IDs are not human-friendly (registration number is the human key) |
| D9 | **Idempotency via `processed_ops` table** | Hope retries are rare | The server remembers every operation ID and its result. A retry replays the stored answer. This is what makes "response lost after commit" safe. | One extra table write per edit |
| D10 | **Per-field versions, not per-record** | Per-record version only | Edits to different fields auto-merge (FR-7.3). Only true same-field clashes become conflicts. | Slightly more bookkeeping |
| D11 | **Ordering by server versions, never client clocks** | Timestamps / last-write-wins | Phone clocks are wrong and unsynchronized. Timestamps break conflict detection. Timestamps are display-only. | Conflict logic depends on the server |
| D12 | **Append-only `history` table; its ID is the sync cursor** | Mutable audit fields, separate change feed | One structure gives us audit trail, restore, replay-proof, and a pull cursor. | History grows (fine at demo scale) |
| D13 | **Conflicts are stored, never auto-resolved or discarded** | Auto last-writer-wins | Requirements forbid silent data loss (FR-7.4). Held conflicts keep both values until a human decides. | Needs a resolution flow |
| D14 | **Raw SQL with plain migration files, no heavy ORM** | Prisma, TypeORM | We need explicit control over transactions and row locking. ORMs hide exactly the part we must get right. | Write SQL by hand |
| D15 | **SSE for live updates** | WebSockets, polling | One-directional push is all we need. SSE is simpler and passes Traefik with no extra config. The push only says "something changed", and the client then pulls. | One-way only (enough) |
| D16 | **Same-origin httpOnly cookie carrying a JWT** | Bearer token in localStorage | Same container serves API and PWA, so no CORS. `EventSource` cannot send custom headers but does send cookies. httpOnly cookies are safer than localStorage tokens. | Must set cookie flags correctly |
| D17 | **One container serves API + built PWA** | Separate frontend container | Fewer moving parts on a shared server. | Frontend and API deploy together |
| D18 | **Docker Compose, isolated stack in `/home/ubuntu/campussync/`** | Run directly under pm2 | Matches the audited server, isolates our DB and volume, trivial teardown. | Needs ARM64-compatible images (all official ones are) |
| D19 | **Join Traefik via its Docker network + a dynamic config file** | Standalone Caddy; host port plus firewall rule | Ports 80/443 belong to Traefik. Adding a dynamic file needs no reload or restart and cannot disturb live apps. Network attach avoids opening a new host port. | Must verify the Traefik network name first |
| D20 | **Free HTTPS Domain: DuckDNS or Firebase+Cloud Run** | Purchasing custom domain, raw sslip.io | No paid domain needed for hackathon. Either (1) DuckDNS (`campussync.duckdns.org` -> VPS) keeps same-origin simplicity with automated Traefik Let's Encrypt SSL, or (2) Firebase Hosting (`campussync.web.app`) rewriting to Cloud Run / VPS. | Zero financial cost; works immediately |
| D21 | **Build images off the server** (GitHub Actions to GHCR, arm64) | Build on the box | The server has 0 swap and ~3.6 GiB free RAM, and shares production apps. A heavy build could starve them. | Needs a small CI workflow |
| D22 | **Hard resource limits on our containers** | No limits | Protects Audrio and the other live apps from a runaway process. | Must stay within limits |
| D23 | **Failure simulator is a client-side network wrapper plus server demo hooks, gated by a demo flag** | Real network tampering | Deterministic, repeatable, and safe. "Response lost" is simulated by letting the server truly commit and discarding the reply. | Demo-only code paths must be guarded |
| D24 | **Second device = separate local database namespace (device switcher), plus real second tab/browser works too** | Only real second devices | A judge can see two "devices" on one screen. | Slight extra client code |
| D25 | **Integrity checks are SQL queries run on demand** | Trust the code | Proof beats assertion. This is the demo's closing shot. | Must keep checks in sync with schema |
| D26 | **Batch push (many ops per request) with per-op results** | One request per op | Fewer round trips, and each op still gets its own accepted/duplicate/conflict/rejected result (FR-5.6). | Response format is richer |
| D27 | **Seeded users with simple JWT auth; no signup, SSO, or password reset** | Full auth system | Auth is not what is judged. Saves hours. | Not production-grade (out of scope) |
| D28 | **Monorepo with `shared/`, `server/`, `web/`, `scripts/`, `docs/`** | Separate repos | One place for contracts, one PR flow, shared types. | Single repo discipline needed |

---

## 3. Data Model (Postgres)

### 3.1 `users`
| Column | Notes |
|---|---|
| id (uuid, pk) | |
| email (unique) | login identity |
| password_hash | seeded accounts only |
| role | `student` / `faculty` / `admin` |
| campus | campus code (null for admin = all) |
| student_id (uuid, nullable) | links a student user to their record |

### 3.2 `students` (current state)
| Column | Notes |
|---|---|
| id (uuid, pk) | client-generated |
| reg_no (unique) | duplicate prevention |
| cnic (unique) | duplicate prevention |
| full_name, program, campus, semester, status | official fields |
| phone, email, address, emergency_contact | contact fields |
| attendance, remarks | academic fields |
| field_versions (jsonb) | `{ "phone": 3, "address": 5, ... }` |
| version (int) | total accepted changes |
| active (bool) | soft delete only |
| created_at, updated_at, last_editor_id | metadata |

### 3.3 `history` (append-only)
| Column | Notes |
|---|---|
| id (bigserial, pk) | **doubles as the sync cursor** |
| student_id | |
| field | field changed (or `*` for create) |
| old_value, new_value (jsonb) | |
| field_version_after (int) | |
| type | `create` / `edit` / `resolve` / `restore` |
| actor_id, actor_role, actor_campus, device_id | who and from where |
| op_id | the operation that caused it |
| created_at | display only |

Protected by database rules so rows cannot be updated or deleted.

### 3.4 `processed_ops`
| Column | Notes |
|---|---|
| op_id (uuid, pk) | |
| result (jsonb) | the exact response given, replayed on retry |
| created_at | |

### 3.5 `conflicts`
| Column | Notes |
|---|---|
| id (uuid, pk) | |
| student_id, field | |
| base_version | what the loser edited from |
| server_value, server_version | what the server holds |
| incoming_value | the held edit |
| incoming_op_id, actor_id, device_id | |
| status | `open` / `resolved` |
| resolved_by, resolution, resolved_at | |

---

## 4. The Apply-Edit Transaction (core of the system)

Every incoming operation passes through this single code path inside one database transaction. **Create, edit, resolve, and restore all use it.**

An operation looks like:
```
{ opId, studentId, field, newValue, baseVersion, deviceId, type }
```

**Steps:**
1. **Duplicate check:** if `opId` exists in `processed_ops`, return the stored result immediately. Nothing else runs.
2. **Lock** the student row (`SELECT ... FOR UPDATE`) so concurrent edits are serialized.
3. **Authorize:** does this role/campus/ownership allow editing this field on this record?
4. **Validate:** field format, allowed values, cross-field rules (e.g., Graduated requires semester 8), uniqueness.
5. **Compare versions:**
   - `baseVersion == current field version` leads to **apply**.
   - versions differ but `newValue` equals the current value leads to **no-op accepted** (already converged).
   - versions differ and values differ leads to **conflict**: store in `conflicts`, do not apply.
6. **If applying:** update the student row, bump field version and record version, insert the `history` row.
7. **Record the result** in `processed_ops`.
8. **Commit.** Everything happened or nothing did (FR-5.8).

**Possible per-operation results:**

| Result | Meaning |
|---|---|
| `applied` | Accepted and recorded |
| `duplicate` | This `opId` was already processed; original result returned |
| `conflict` | Held for resolution; includes server value and version |
| `rejected` | Validation or permission failure; includes field and reason |
| `duplicate_record` | Would create a second record with the same reg_no or CNIC; includes existing record ID |

After commit, the server notifies connected clients via SSE.

---

## 5. Sync Protocol

### 5.1 Endpoints

| Method and path | Purpose |
|---|---|
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | Session via httpOnly cookie |
| `GET /sync/snapshot` | Initial load: all visible records plus the current cursor |
| `POST /sync/push` | Send a batch of operations; returns one result per op |
| `GET /sync/pull?since=<cursor>` | Changes after the cursor, filtered by role and campus |
| `GET /events` | SSE stream: "changes available up to cursor N" |
| `GET /students/:id/history` | Full audit timeline |
| `GET /conflicts` | Open conflicts the user may resolve |
| `POST /conflicts/:id/resolve` | `{ choice: mine/theirs/custom, value, expectedServerVersion }` |
| `POST /students/:id/restore` | Admin: restore a field or whole record to a past point |
| `GET /admin/integrity` | Run integrity checks, return pass/fail per check |
| `POST /demo/reset` | Demo mode only: reset to seed state |
| `POST /demo/inject-edit` | Demo mode only: apply a scripted remote edit (deterministic "other campus") |
| `GET /health` | Liveness and DB check |

### 5.2 Client sync loop
1. Save edit to the **outbox** (IndexedDB) with a new `opId`, then update the local view optimistically.
2. When online, send outbox operations **in order** via `POST /sync/push`.
3. For each result: `applied` or `duplicate` removes the op from the outbox; `conflict` marks the field and keeps the incoming value visible; `rejected` marks the field with the reason and keeps the op for the user to fix; `duplicate_record` opens duplicate resolution.
4. Call `pull` with the stored cursor and merge changes into the local cache; update the cursor.
5. On network error: retry with exponential backoff and jitter.
6. SSE message triggers a pull immediately.

### 5.3 Why "response lost after commit" is safe
```
Client sends op X  ──►  Server commits, stores X in processed_ops
Client never gets the reply
Client retries op X ──►  Server finds X in processed_ops, returns the same result
Result: the record changed exactly once.
```

### 5.4 Conflict resolution flow
1. Conflict stored; the field keeps the server value as authoritative.
2. The user sees both values, who changed each, and when.
3. User picks mine / theirs / custom. The client calls `resolve` with the server version it was shown.
4. If the server version has changed since (record moved again), the server returns a **stale** response with the new state, and the user decides again (FR-8.4).
5. Otherwise the resolution is applied through the standard apply-edit transaction as a `resolve` history entry.

### 5.5 Duplicate record flow
Creating a student whose `reg_no` or `cnic` already exists returns `duplicate_record` with the existing record's ID. The user may link to the existing record or cancel. Nothing merges silently.

---

## 6. Client Architecture

| Module | Responsibility | Notes |
|---|---|---|
| `outbox` | Persist, order, and remove pending operations | Pure logic, unit-testable without UI |
| `syncEngine` | Push, pull, retry, backoff, cursor, result handling | Pure logic, no UI imports |
| `localStore` (Dexie) | Cached records, outbox, cursor, device namespace | One database per device namespace |
| `networkLayer` | Single fetch wrapper used by everything | Where the simulator plugs in |
| `fieldState` | Derives per-field badge: pending / synced / conflict / rejected | Drives the UI |
| `validation` | Imports shared Zod schemas | Same rules as the server |
| `serviceWorker` | Caches the app shell so the app loads offline | Generated by the PWA plugin |
| `ui` | Pages and components | Depends on the modules above, never the reverse |

**Rule:** `outbox` and `syncEngine` contain no UI code. They are the riskiest part of the project, so they must be independently testable.

---

## 7. Failure Simulator Design

All failure injection happens in the `networkLayer` wrapper, so it works for every request.

| Mode | Behavior | Demonstrates |
|---|---|---|
| Offline | All requests fail immediately | Offline capture, outbox persistence |
| Slow | Adds fixed delay | Pending states, ordering |
| Drop request | Fails before sending | Retry safety |
| **Drop response** | Sends, server commits, reply discarded | **Idempotency (the key demo moment)** |
| Second device | Switches to a separate local namespace (or use a real second tab) | Concurrent edits |
| Inject remote edit | Server applies a scripted edit as another user/campus | Deterministic conflicts and auto-merge |
| Reset demo | Reseeds all data in one action | Repeatable demos |

All demo controls and `/demo/*` endpoints exist only when the server runs with the demo flag on, and require an admin session.

---

## 8. Integrity Checker

Runs as SQL queries; each returns pass/fail plus offending rows.

| Check | Proves invariant |
|---|---|
| No duplicate `id`, `reg_no`, or `cnic` among records | Uniqueness |
| No `op_id` appears in `history` more than once per field change | Exactly-once |
| Replay each record's history from creation and compare to current row | Replayability |
| `version` equals count of accepted history entries per record | Version integrity |
| No history row references a missing student | Referential integrity |
| Every `processed_ops` entry maps to a recorded outcome | No lost edits |
| History rows are unmodified (checksum or trigger audit) | Append-only |

---

## 9. Security Model

- Every endpoint checks role, campus, and ownership on the server (NFR-6).
- All traffic over HTTPS via Traefik (NFR-7).
- JWT in an httpOnly, Secure, SameSite cookie. Short expiry.
- Secrets live in a `.env` on the server, never committed (NFR-8).
- Database has no published host port; it is reachable only on the private compose network.
- History protected from update/delete at the database level.
- Demo endpoints are disabled unless the demo flag is set.

---

## 10. Deployment Architecture

**Server:** existing Oracle Cloud ARM64 box. **All images must be `linux/arm64`.**

**Layout:** `/home/ubuntu/campussync/`
- `docker-compose.yml`, `.env`, `scripts/`
- Containers: `campussync-app`, `campussync-db`
- Volume: `campussync_pgdata`
- Networks: private `campussync-net` plus the existing Traefik network (**name must be verified by reading the existing setup**)

**Ingress & Domain Strategy (Zero-Cost Hackathon Setup):**
- **Primary Option (Fastest):** `campussync.duckdns.org` pointing to `150.136.103.208`. Free, takes 30s at duckdns.org, automated Traefik Let's Encrypt SSL. Serves both Fastify API and PWA from one container (no CORS/cookie issues).
- **Secondary / GDGoC Showcase Option:** Firebase Hosting (`campussync.web.app`) with Google Cloud Run backend or proxy rewrite, utilizing Supabase/Neon PostgreSQL.
- A new Traefik dynamic file modeled **exactly** on the existing working `slate-vault` file (entrypoint names, cert resolver).

**Limits and safety:**
- Memory and CPU limits on both containers (suggested: app 1 GB, db 1 GB, about 1 CPU total)
- `restart: unless-stopped`, plus healthchecks on both
- Never touch existing containers (coolify, appwrite, umami, mediastack) or their data
- Never modify host firewall unless unavoidable; if so, document the exact change

**Build and release:**
- GitHub Actions builds the arm64 image and pushes to GHCR; the server pulls it
- No heavy builds on the server (0 swap, shared RAM)

**Operations:**
- `scripts/reset-demo.sh` wipes and reseeds in seconds
- `scripts/backup.sh` dumps the database
- **Fallback deployment** on a second platform, ready before judging

---

## 11. Repository Structure

```
campussync/
├── shared/        # Zod schemas, types, field rules, permission map
├── server/        # Fastify API, migrations, seed, integrity checks
├── web/           # React PWA, sync engine, local store, UI
├── scripts/       # reset-demo.sh, backup.sh, deploy helpers
├── docs/          # Requirements, Architecture, Demo script, Test checklist
└── .github/       # CI workflow (build + push arm64 image)
```

---

## 12. Testing Strategy

| Layer | What is tested | How |
|---|---|---|
| Apply-edit transaction | All results: applied, duplicate, conflict, rejected, duplicate_record | Automated tests against a real Postgres |
| Behavior matrix (Requirements section 7) | Rows 4-9, 11-15 as server-side scenarios | Automated where possible |
| Sync engine | Outbox ordering, retry, cursor, result handling | Unit tests with a fake network |
| Integrity checker | Passes on clean data; **fails on deliberately corrupted data** | Automated (prove the checker can detect problems) |
| Full demo journey | All 10 steps | Manual rehearsal following a written script |
| Human test pass | All 17 matrix rows plus invariants, pass/fail log | Asad's checklist |

---

## 13. Build Order (thin slice first)

1. Repo, shared schemas, DB migrations, seed data
2. Auth and role checks
3. Apply-edit transaction with versioning (edit, validate, history)
4. Conflict detection and storage
5. Client local store, outbox, sync engine, network wrapper
6. Pages calling the sync engine (edit, conflict, history)
7. Idempotency end to end (drop-response test passing)
8. Restore, duplicate-record flow, integrity checker
9. Failure simulator, demo reset, SSE live updates
10. Deploy to the server and set up the fallback
11. Polish, rehearse the demo, write the demo script

Deploy a working stub to the public URL **early** (after step 2), not at the end.

---

## 14. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Sync engine bugs (most complex part) | Demo fails | Keep it UI-free and heavily tested; build it before polish |
| Shared server overload hurts live apps | Production outage for Audrio etc. | Resource limits, no on-box builds |
| Traefik network name or config differs from assumptions | Site unreachable | Read the existing working config first; copy it exactly |
| DNS not set up for the hostname | No HTTPS, no offline mode | Set the A record today; keep sslip.io as backup |
| Let's Encrypt issuance fails | No HTTPS | Own domain; do not retry in a loop |
| Server goes down during judging | Disqualifying | Fallback deployment, healthchecks, auto-restart |
| Scope creep | Core unfinished | Requirements cut order; Must items only until complete |
| Team capacity (one strong developer) | Bottleneck | Antigravity does the typing; written specs let others work in parallel |

---

## 15. Assumptions and Items to Verify

- The Traefik Docker network name on the server (read it, do not guess)
- The exact entrypoint and cert resolver names in Traefik's config
- Free DNS setup: DuckDNS subdomain (`campussync.duckdns.org` -> `150.136.103.208`) or Firebase Hosting domain
- Build window and submission requirements (event WhatsApp group)
- That all chosen images publish `linux/arm64` variants (official Node and Postgres alpine images do)
