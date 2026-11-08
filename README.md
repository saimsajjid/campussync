# CampusSync

> **Offline-first dependable sync engine & shared workflow for multi-campus university records.**

---

## Overview

In multi-campus university environments, administrative information is frequently entered across multiple locations under unstable network conditions, leading to data drift, duplicate entries, and silent overwrites.

**CampusSync** delivers a resilient, offline-first shared workflow where the centralized server remains the authoritative single source of truth while clients can operate seamlessly with intermittent or zero connectivity.

---

## Key Capabilities

- **Offline-First Outbox Pattern:** Edits are committed immediately to local browser storage (IndexedDB via Dexie) before network transit, surviving app reloads, crashes, and network loss.
- **Provable Idempotency:** Every client operation carries a unique `opId` tracked in a `processed_ops` registry. Retries and replayed operations safely return stored responses without double-applying mutations.
- **Field-Level Versioning:** Divergent changes to non-conflicting fields auto-merge smoothly; concurrent edits to identical fields are preserved as explicit conflicts rather than silently discarded.
- **Append-Only History & Change Log:** All record modifications append an immutable audit row that also drives pull-based sync cursor replication.
- **Real-Time Sync Push (SSE):** Lightweight Server-Sent Events notify clients when updates land on the server, triggering background sync cursor pulls.
- **On-Demand Integrity Verification:** Automated SQL integrity suites verify zero duplicate registrations, consistent field versions, and full history auditability.
- **Built-in Failure Simulation:** Deterministic simulation hooks test dropped packets, timeout retransmissions, and multi-client edit races.

---

## System Architecture

```
 BROWSER (Installable PWA)                        SERVER ENVIRONMENT
┌─────────────────────────────┐                 ┌─────────────────────────────────────┐
│ UI Components               │                 │ Fastify API & Static Host           │
│    │                        │  Push / Pull    │  • Auth & Role-Based Access         │
│ Sync Engine                 │ ──────────────► │  • Schema Validation (Zod)          │
│  • Outbox Queue             │ ◄────────────── │  • Apply-Edit Transaction Engine    │
│  • Retry & Exponential Back │   SSE (Live)    │  • Conflict Holding Store           │
│  • Sync Cursor Tracker      │ ◄────────────── │  • Append-Only Audit History        │
│    │                        │                 │  • On-Demand Integrity Checker      │
│ Local Database (IndexedDB)  │                 │    │                                │
│  • Cached Student Records   │                 │ PostgreSQL 16                       │
│  • Pending Outbox Operations│                 │  • Strict Foreign Keys & ACID       │
│  • Sync Cursors & State     │                 │  • Row-Level Locks for Consistency  │
└─────────────────────────────┘                 └─────────────────────────────────────┘
```

---

## Tech Stack

- **Server:** Node.js, TypeScript, Fastify, PostgreSQL 16
- **Web App:** React 18, Vite, TypeScript, Tailwind CSS, Dexie.js (IndexedDB)
- **Shared Contracts:** Zod schemas and TypeScript types shared across client and server
- **Deployment:** Docker & Docker Compose

---

## Monorepo Layout

```
├── shared/         # Shared schemas (Zod), types, and permission models
├── server/         # Fastify API, migrations, seeds, integrity checks
├── web/            # Frontend application, offline sync engine, local store
├── scripts/        # Automation tools, reset scripts, chaos tests
├── docs/           # Documentation and run guides
├── .github/        # GitHub Actions workflows & PR templates
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Quick Start

### Prerequisites
- [Docker](https://www.docker.com/) & Docker Compose
- Node.js 20+ (for local development)

### 1. Clone & Configure
```bash
git clone https://github.com/saimsajjid/campussync.git
cd campussync
cp .env.example .env
```

### 2. Run with Docker Compose
```bash
docker compose up -d
```
The application will be accessible at:
- Web App & API: `http://localhost:3050`
- PostgreSQL: `localhost:5432`

---

## Demo Accounts

Pre-seeded accounts are provided for instant evaluation:

| Role | Email | Password | Scope |
|---|---|---|---|
| **Admin** | `admin@campussync.local` | `admin123` | Multi-campus read/write, conflict resolution, integrity checks |
| **Faculty** | `faculty.lahore@campussync.local` | `faculty123` | Campus-scoped student view & academic field updates |
| **Student** | `student.saim@campussync.local` | `student123` | Own record access, contact detail update submissions |

---

## Development & Git Workflow

- **Trunk-Based / PR Workflow:** `main` remains deployable at all times; all features land via short-lived topic branches and pull requests.
- **Conventional Commits:** `type(scope): summary` format (`feat`, `fix`, `test`, `chore`, `refactor`).
- **Secret Hygiene:** All credentials and secrets stay out of version control; `.env.example` serves as the single reference template.

---

## License

This project is licensed under the [MIT License](LICENSE).
