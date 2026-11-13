# CampusSync

Offline-first multi-campus student record synchronization system with deterministic conflict resolution and append-only audit history.

Live deployment: https://150.136.103.208.sslip.io

---

## The Problem

Universities operating multiple campuses face continuous data drift. When campus branches update student records locally or during network outages, changes fail to synchronize cleanly:

- A student updates their contact phone number at the Lahore campus admissions desk while offline.
- Simultaneously, a central administrator in Islamabad updates the student's residential address.
- In conventional systems with full-record overwrites or last-write-wins (LWW) timestamps, one of these edits silently overwrites the other.
- When network drops interrupt an update in flight, retrying the operation can cause duplicate entries or corrupt version counters.

CampusSync solves this by isolating mutations to individual fields, committing edits locally to an offline outbox before transmission, serializing writes with PostgreSQL row locks, detecting concurrent same-field conflicts, and maintaining an immutable append-only audit log.

---

## Features

- **Offline-First Outbox Pattern:** All student edits and registrations commit immediately to local browser storage (IndexedDB via Dexie) before network transmission. Edits survive tab reloads, browser restarts, and prolonged offline intervals.
- **Idempotent Retry-Safe Sync:** Every client operation carries a unique cryptographic `opId` recorded in a `processed_ops` registry. Network retries return the stored response without reapplying mutations.
- **Field-Level Conflict Detection:** Edits to non-colliding fields on the same student record auto-merge cleanly. Concurrent edits to the exact same field are held as open conflicts rather than discarded.
- **Interactive Conflict Resolution:** Dedicated resolution interface compares the client's proposed value against the server value with actor identity, device details, and timestamps.
- **Duplicate Record Prevention:** Natural keys (CNIC and Registration Number) are strictly checked against active records to prevent accidental duplicate student creations.
- **Append-Only Audit History:** Every mutation appends an immutable row to the audit ledger. Database trigger rules reject direct `UPDATE` or `DELETE` queries.
- **Admin Field Restore:** Administrators can restore any historical field state to create a new forward-moving audit entry without altering past history.
- **7-Invariant Integrity Suite:** On-demand verification engine validates key uniqueness, replayability, version monotonicity, and append-only trigger enforcement directly against PostgreSQL.
- **Network Failure Simulator:** In-app drawer to simulate offline modes, latency, and intermittent connection drops for demonstration purposes.
- **Role-Based Access Control:** Strict permission boundaries for Student, Faculty, and Admin roles.

---

## Screenshots

### Login Page
![CampusSync Login](docs/screenshots/login.png)

### Dashboard
![CampusSync Dashboard](docs/screenshots/dashboard.png)

### Students Directory
![CampusSync Students Directory](docs/screenshots/students.png)

### Record Edit Modal
![CampusSync Edit Modal](docs/screenshots/edit-modal.png)

### Conflict Resolution
![CampusSync Conflict Resolution](docs/screenshots/conflicts.png)

### Change History Ledger
![CampusSync Change History](docs/screenshots/history.png)

### Sync Center
![CampusSync Sync Center](docs/screenshots/sync-center.png)

### System Health & Integrity Checker
![CampusSync System Health](docs/screenshots/system-health.png)

### Network Failure Injection Drawer
![CampusSync Failure Injection Drawer](docs/screenshots/simulator.png)

---

## How It Works: Life of an Edit

Every student update follows a 6-step lifecycle:

```
[1. User Edits Field]
         │
         ▼
[2. IndexedDB Outbox] ──► Optimistic UI update ("Saved on this device")
         │
    (When Online)
         │
         ▼
[3. POST /sync/push]  ──► Server verifies opId idempotency & acquires row lock
         │
         ▼
[4. Single SQL Tx]    ──► Version check:
                          • Version match ──► Apply update to student row
                          • Version clash  ──► Hold in conflicts table
         │
         ▼
[5. Append History]   ──► Insert immutable audit row & increment field version
         │
         ▼
[6. SSE Broadcast]    ──► Clients receive cursor update, pull changes, mark "Synced"
```

1. **Outbox Commitment:** When a user modifies a field, the change is written immediately to browser IndexedDB storage (`db.outbox`). The UI updates optimistically with a "Saved on this device" status.
2. **Operation Fingerprinting:** The client assigns a unique UUID (`opId`) and attaches the local `baseVersion` of the field.
3. **Transmission and Lock Acquisition:** When network connectivity is active, the outbox worker sends operations in order via `POST /sync/push`. The server checks `processed_ops` for duplicates and acquires a PostgreSQL row lock (`SELECT ... FOR UPDATE`).
4. **Single Transaction Execution:** The server compares the incoming `baseVersion` with the server's current `field_versions[field]`. If they match, the field updates. If concurrent modifications happened to the same field, the incoming change is stored in `conflicts` as `open`.
5. **Append Audit Entry:** Within the same transaction, the change appends a new row to `history` with previous value, new value, actor identity, role, and campus. The global cursor increments.
6. **SSE Notification & Reconciliation:** The server broadcasts the new cursor over Server-Sent Events (SSE). Connected clients perform a background pull (`GET /sync/pull?since=<cursor>`), reconcile their local state, and update outbox badges to "Synced".

---

## Correctness & Invariants

CampusSync enforces 7 strict SQL invariants verified by the built-in integrity suite:

1. **Identifier Uniqueness (`inv-uniqueness`):** No two records share a primary ID, Registration Number, or CNIC.
2. **Exactly-Once Execution (`inv-exactly-once`):** Every operation ID (`opId`) is applied at most once per field change.
3. **History Replay Verification (`inv-replayability`):** Replaying all history rows from record creation yields the exact current state of each student record.
4. **Version Monotonicity (`inv-version-integrity`):** The record version number strictly equals the count of accepted history entries.
5. **Referential Integrity (`inv-referential-integrity`):** No history or conflict record references a missing or orphaned student.
6. **No Silent Data Loss (`inv-no-lost-edits`):** Every user submission is tracked as either applied, conflicted, or rejected.
7. **Append-Only Ledger Enforcement (`inv-append-only`):** Database triggers prevent `UPDATE` and `DELETE` on the `history` table, verified by attempting mutations in a rolled-back transaction.

### Proving Invariant Failure on Corrupted Data
The test suite in `scripts/integrity-negative-suite.ts` deliberately injects corrupt data (duplicate natural keys, skipped version numbers, orphaned records) into an isolated test database and confirms that the integrity suite flags each failure. It then resets the database to clean seed state.

---

## Run It (Judges Guide)

### Prerequisites
- Docker and Docker Compose installed
- Git

### Exact Commands to Start
```bash
git clone https://github.com/saimsajjid/campussync.git
cd campussync
docker compose up -d
```

Access the application in your browser:
- Application URL: `http://localhost:3050`
- PostgreSQL Port: `localhost:5432`

> [!NOTE]
> **Demo Secrets Notice:** The fallback environment variables in `docker-compose.yml` (`JWT_SECRET`, `COOKIE_SECRET`, database passwords) are provided for evaluation convenience. In production environments, override them via secure `.env` variables.

### Demo Accounts
Pre-seeded demo accounts with password `password123`:

| Role | Email | Password | Scope |
|---|---|---|---|
| **Central Admin** | `admin@campussync.local` | `password123` | Full multi-campus read/write, conflict resolution, integrity checks |
| **Regional Admin** | `admin.regional@campussync.local` | `password123` | Multi-campus administrative access |
| **Faculty Lahore** | `faculty.lahore@campussync.local` | `password123` | Lahore campus student access, attendance and academic fields |
| **Faculty Islamabad** | `faculty.islamabad@campussync.local` | `password123` | Islamabad campus student access |
| **Faculty Abbottabad**| `faculty.abbottabad@campussync.local` | `password123` | Abbottabad campus student access |
| **Student** | `student@campussync.local` | `password123` | Personal profile view, contact details submissions |

### Resetting Demo Data
To reset the database back to clean seed data:
1. Log in as Central Admin.
2. In the top navigation bar or failure injection drawer, click **Reset Demo State** (or make an authenticated `POST /demo/reset` request).

### 5-Step Evaluation Tour
1. **Overview Dashboard:** Log in as Central Admin (`admin@campussync.local` / `password123`). Review the campus summary metrics, outbox status (0 pending), and student directory.
2. **Make an Edit:** Go to **Students**, click Edit on student "Ali Raza" (Lahore Campus), update the residential address, and click Save. Notice the instant local update and clean "Synced" badge.
3. **Simulate Offline Sync:** Open the **Failure injection** drawer from the top right, select "Offline", and edit the student's phone number. Notice the badge shows "Saved on this device" and the header outbox counter increments. Reload the page to confirm the pending edit survives in IndexedDB. Switch back to "Online", and watch the edit sync to the server.
4. **Resolve a Conflict:** Navigate to **Conflicts** (`/conflicts`). Inspect the side-by-side comparison showing actor identities, devices, and timestamps. Select a resolution choice and click Apply.
5. **Verify Audit Trail & System Health:** Open **History** (`/history`) to inspect the immutable timeline grouped by date with restore capabilities. Next, visit **System health** (`/integrity`) and click "Run health check". Observe all 7 checks evaluate to confirm zero data corruption.

---

## Running Test Suites

Run test suites locally against the test stack:

### 1. Sync Engine Unit Tests
```bash
npm test
```
Tests the pure offline sync engine: outbox queueing, optimistic local cache updates, retry backoff calculation, and batch serialization (19 unit tests).

### 2. Shared Validation Tests
```bash
cd shared && npm test
```
Tests Pakistani CNIC formatting (`35201-XXXXXXX-X`), registration number patterns, semester boundaries, attendance limits, and role permission matrices.

### 3. Comprehensive End-to-End Test Plan Suite
```bash
TEST_BASE_URL=http://localhost:3050 npx tsx scripts/test-plan-suite.ts
```
Covers 50+ end-to-end integration test cases: authentication, RBAC boundaries, outbox pushes, cursor pulls, idempotent replays, same-field conflicts, disjoint-field auto-merges, duplicate CNIC blocking, and demo gating.

### 4. Integrity Negative Suite
```bash
TEST_BASE_URL=http://localhost:3050 DATABASE_URL="postgres://campussync:change-me@localhost:5432/campussync" npx tsx scripts/integrity-negative-suite.ts
```
Verifies that all 7 integrity checks accurately detect deliberately injected database corruption, then restores clean state.

### 5. Append-Only Trigger Mutation Verification
```bash
DATABASE_URL="postgres://campussync:change-me@localhost:5432/campussync" npx tsx scripts/test-append-negative.ts
```
Confirms that PostgreSQL database triggers reject direct SQL `UPDATE` and `DELETE` commands on the `history` table.

### 6. Contended Chaos Runner
```bash
BASE_URL=http://localhost:3050 npx tsx scripts/contended-chaos-runner.ts
```
Simulates 12 concurrent workers issuing 500+ operations with intentional same-field collisions under dropped packets and network delays.

---

## Tech Stack

- **Fastify (Node.js 20):** REST API and Server-Sent Events (SSE) server.
- **PostgreSQL 16:** Relational storage with row-level locks, JSONB column versioning, and immutable audit triggers.
- **React 18 & Vite:** Single-page frontend and installable Progressive Web App (PWA).
- **TypeScript:** Strict static typing shared across server, client, and validation schemas.
- **Dexie.js:** IndexedDB wrapper handling local outbox queue and client-side record cache.
- **Tailwind CSS:** Utility styling using design tokens for color contrast and spacing.
- **Docker & Docker Compose:** Container orchestration for local development and production runtime.

---

## Scaling and Limits

### Current Implementation Capacity
- Handles hundreds of concurrent campus transactions per second on a single Node.js instance.
- Optimistic browser outbox handles unlimited offline edits per client tab.
- Central PostgreSQL database acts as single source of truth with strict serializability via row locks.

### Requirements for Multi-Campus Production Deployment
- **API Horizontal Scaling:** Multiple Fastify API instances behind a load balancer with Redis Pub/Sub backplane for distributed SSE dispatching.
- **Database Connection Pooling:** Deployment of PgBouncer to manage high-volume concurrent client pools.
- **Table Partitioning:** Range-partitioning of `history` and `processed_ops` tables by academic year or campus to maintain fast index traversal.
- **Identity Provider Integration:** SAML 2.0 / OAuth2 / OIDC single sign-on integration replacing demo password hashes.
- **Read Replicas:** Read replicas at campus locations for local reporting queries.

### Out of Scope
- Multi-master decentralized database replication between campus data centers.
- Peer-to-peer browser-to-browser mesh synchronization without central authority.

---

## Known Limitations

1. **Audit Actor Storage:** The `history.actor_id` column currently stores user display names or role tags rather than foreign key user UUIDs.
2. **Demo Mode Active in Staging:** `DEMO_MODE=true` is enabled on the live demo server, which exposes the failure injection drawer and sample data buttons.
3. **Demo Reset Scope:** The `POST /demo/reset` endpoint is restricted to administrators, but is active whenever demo mode is enabled.
4. **PWA Service Worker Scope:** Offline asset caching requires HTTPS or localhost; HTTP access outside localhost disables service worker features.

---

## Project Documentation Links

- [Requirements Specification (docs/Requirements.md)](docs/Requirements.md)
- [System Architecture (docs/Architecture.md)](docs/Architecture.md)
- [UI & Interaction Design Spec (docs/Design-Spec.md)](docs/Design-Spec.md)
- [Verification & Test Plan (docs/Test-Plan.md)](docs/Test-Plan.md)

---

## Live Demo

- **URL:** https://150.136.103.208.sslip.io
- **Admin Login:** `admin@campussync.local` / `password123`
