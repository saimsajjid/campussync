# Concepts Roadmap: Everything in This Project, Step by Step

Every concept, tool, and skill the project touches, from the smallest to the biggest, in the order you should meet them. Each row says **what it is**, **where we use it**, **how deep you need to go**, and a **self-check question** so you know you actually understand it.

---

## 0. How to use this document

### Depth levels
| Level | Meaning | What it looks like |
|---|---|---|
| **L1: Recognize** | You know what it is and when it appears | You can read antigravity's code and not be lost |
| **L2: Explain** | You can explain it to a teammate or a judge in plain words | You can answer "why did you do it this way?" |
| **L3: Build/Debug** | You can write it or fix it when it breaks | You can tell antigravity exactly what is wrong |

### Honest rule
You do **not** need L3 on everything. Antigravity writes most code. You need:
- **L3** on the sync core (sections 5 and 4's transaction parts), because that is the project and you must catch its mistakes.
- **L2** on most backend, frontend, and DevOps topics.
- **L1** on the rest.

### Who owns what
| Tag | Person |
|---|---|
| **[S]** | Saim (tech lead, backend, sync core) |
| **[A]** | Ameen (frontend pieces, helps build) |
| **[As]** | Asad (testing, demo script, pitch) |
| **[All]** | Everyone should know it |

### Priority tags
**MUST** = project fails without understanding it. **SHOULD** = needed for quality. **LATER** = only if time remains.

---

## 1. Web Foundations

| # | Topic | What it is | Where we use it | Depth | Self-check |
|---|---|---|---|---|---|
| 1.1 | Client vs server | The browser asks, the server answers | Whole architecture | L2 [All] MUST | Which side decides what is true, and why? |
| 1.2 | HTTP request/response | Method, URL, headers, body in; status, headers, body out | Every API call | L2 [S][A] MUST | What are the parts of a request? |
| 1.3 | HTTP methods | GET reads, POST creates/acts, PUT/PATCH changes, DELETE removes | Our endpoints | L2 [S][A] MUST | Why is `/sync/push` a POST? |
| 1.4 | Status codes | 200 ok, 201 created, 400 bad input, 401 not signed in, 403 not allowed, 404 missing, 409 conflict, 500 server bug | Returning results and errors | L2 [S][A] MUST | When do we return 409? Why not 400? |
| 1.5 | JSON | Text format for structured data | All request/response bodies | L2 [All] MUST | Write the JSON for one edit operation |
| 1.6 | REST-style endpoints | Resources as URLs (`/students/:id/history`) | API design | L2 [S] SHOULD | Design the URL to fetch a record's history |
| 1.7 | URLs, origins, ports | Scheme + host + port = an origin | Cookies, CORS, routing | L2 [S] SHOULD | What is "same-origin" and why does it simplify us? |
| 1.8 | Cookies | Small data the browser stores and sends back automatically | Login session | L2 [S][A] MUST | What do httpOnly, Secure, SameSite mean? |
| 1.9 | HTTPS/TLS | Encrypted HTTP, needs a certificate | Service workers require it | L2 [S] MUST | Why won't offline mode work on plain HTTP? |
| 1.10 | DNS | Names to IP addresses | `campussync` hostname to the Oracle IP | L2 [S] SHOULD | What is an A record? |
| 1.11 | Reverse proxy | A front door that forwards requests to the right app | Traefik in front of our container | L1 [S] SHOULD | What does Traefik do for us? |
| 1.12 | Server-Sent Events (SSE) | The server pushes messages over one long HTTP connection | "Something changed" live updates | L2 [S][A] SHOULD | Why SSE and not WebSockets? |

---

## 2. Programming Foundations

| # | Topic | What it is | Where we use it | Depth | Self-check |
|---|---|---|---|---|---|
| 2.1 | JavaScript basics | Variables, functions, objects, arrays, loops | Everywhere | L2 [S][A] MUST | Read a `.map().filter()` chain and explain it |
| 2.2 | TypeScript types | Types catch mistakes before running | All code | L2 [S][A] MUST | What does `type Op = {...}` give you? |
| 2.3 | Async: Promises, `async/await` | Code that waits (network, disk) without freezing | Every API call, DB call, IndexedDB call | L3 [S][A] MUST | What happens if you forget `await`? |
| 2.4 | Error handling | `try/catch`, rejected promises, error types | Sync retries, API errors | L3 [S] MUST | Where should a network error be caught? |
| 2.5 | Modules and imports | Splitting code into files | Monorepo | L1 [S][A] SHOULD | How does `server` import from `shared`? |
| 2.6 | npm and package.json | Installing and running libraries/scripts | Every package | L2 [S][A] SHOULD | What does `npm install` / `npm run dev` do? |
| 2.7 | Monorepo / workspaces | Several packages in one repo sharing code | `shared/`, `server/`, `web/` | L2 [S] SHOULD | Why is `shared/` its own package? |
| 2.8 | Environment variables | Config kept outside the code | DB URL, secrets, demo flag | L2 [S] MUST | Why must `.env` never be committed? |
| 2.9 | Pure functions | Same input gives same output, no side effects | Sync engine logic, validation | L2 [S] MUST | Why are pure functions easy to test? |
| 2.10 | State machines | A thing has named states and allowed transitions | Field status: pending to synced/conflict/rejected | L2 [S][A] MUST | Draw the states of one queued edit |

---

## 3. Backend (Node + Fastify)

| # | Topic | What it is | Where we use it | Depth | Self-check |
|---|---|---|---|---|---|
| 3.1 | Node.js | JavaScript on the server | The API | L1 [S] SHOULD | What is the difference between Node and the browser? |
| 3.2 | Fastify basics | A web framework: routes, handlers, plugins | All endpoints | L2 [S] MUST | How is one route defined? |
| 3.3 | Route handlers and hooks | Code that runs for a request; hooks run before/after | Auth check, logging | L2 [S] MUST | Where does the auth check live? |
| 3.4 | Input validation with Zod | Describe the allowed shape; reject the rest | Every request, every field | L3 [S] MUST | What happens to an invalid phone number sent directly? |
| 3.5 | Shared schemas | One validation definition used by client and server | `shared/` package | L2 [S][A] MUST | Why can't the client's validation be trusted alone? |
| 3.6 | Authentication vs authorization | Who are you vs what may you do | Login vs role checks | L3 [S] MUST | Student tries to edit `program`: which check stops it? |
| 3.7 | Password hashing (bcrypt/argon2) | Store a one-way hash, never the password | Seeded users | L1 [S] SHOULD | Why can't we store passwords as text? |
| 3.8 | JWT | A signed token proving identity | The session | L2 [S] MUST | Can a client forge a JWT? Why not? |
| 3.9 | Role and campus permissions | A permission map applied on the server | Requirements section 4.1 | L3 [S] MUST | Faculty at campus A edits a campus B student: result? |
| 3.10 | Consistent error format | Same JSON shape for every error | All endpoints | L2 [S][A] SHOULD | What fields does an error response have? |
| 3.11 | Logging | Recording what the server did | Debugging sync issues | L2 [S] SHOULD | What would you log for one push request? |
| 3.12 | Health endpoint | `/health` says "I'm alive and the DB works" | Docker healthcheck | L1 [S] SHOULD | Who calls `/health`? |
| 3.13 | Serving static files | The server also delivers the built frontend | One-container deploy | L1 [S] SHOULD | Why one container for API and frontend? |

---

## 4. Database (PostgreSQL)

| # | Topic | What it is | Where we use it | Depth | Self-check |
|---|---|---|---|---|---|
| 4.1 | Relational model | Data in tables, rows, columns | All storage | L2 [S] MUST | What are our 5 tables and what is each for? |
| 4.2 | Primary key | Unique identifier of a row | UUIDs on records | L2 [S] MUST | Why client-generated UUIDs? |
| 4.3 | Foreign key | A column pointing to another table's row | history to students | L2 [S] SHOULD | What breaks if a history row points to a missing student? |
| 4.4 | SQL basics | SELECT, INSERT, UPDATE, WHERE, JOIN, ORDER BY | Everything | L3 [S] MUST | Write: all history for one student, newest first |
| 4.5 | Unique constraints | The DB itself refuses duplicates | `reg_no`, `cnic` | L3 [S] MUST | How does the DB stop two campuses creating the same student? |
| 4.6 | Indexes | A lookup shortcut | Searches, history queries | L1 [S] LATER | Why index `student_id` on history? |
| 4.7 | JSONB columns | JSON stored inside a column | `field_versions`, `result` | L2 [S] SHOULD | When is JSONB better than extra columns? |
| 4.8 | Migrations | Versioned SQL files that build the schema | Setup, deploys | L2 [S] MUST | How does a fresh DB get the schema? |
| 4.9 | Seeding | Loading known demo data | Demo reset | L2 [S][As] MUST | What does `reset-demo.sh` actually do? |
| 4.10 | Parameterized queries | Pass values separately from SQL text | Every query | L3 [S] MUST | What is SQL injection and how do we avoid it? |
| 4.11 | **Transactions (ACID)** | A group of changes that all happen or none do | Apply-edit | **L3 [S] MUST** | What if the server crashes between writing history and writing the student row? |
| 4.12 | **Row locking** (`SELECT ... FOR UPDATE`) | Others wait while you change a row | Serializing concurrent edits | **L3 [S] MUST** | Two edits hit the same record at the same instant: what happens? |
| 4.13 | Isolation levels | How much concurrent transactions see of each other | Awareness | L1 [S] LATER | Why do we lock instead of relying on defaults? |
| 4.14 | Append-only enforcement | Triggers/rules that block UPDATE/DELETE | `history` table | L2 [S] SHOULD | How do we make history impossible to edit? |
| 4.15 | Auto-increment IDs (`bigserial`) | A counter that only goes up | History ID as sync cursor | L2 [S] MUST | Why is "give me everything after #1042" safe? |
| 4.16 | Soft delete | Mark inactive, never remove | Records | L2 [S] SHOULD | Why never hard-delete here? |
| 4.17 | Backup and restore | Dump the DB, load it back | Safety before demo | L2 [S] SHOULD | How do you restore if data gets corrupted? |

---

## 5. Sync and Distributed Concepts (the heart of the project)

Spend most of your learning time here. Everything else is plumbing.

| # | Topic | What it is | Where we use it | Depth | Self-check |
|---|---|---|---|---|---|
| 5.1 | Offline-first | The app works without internet; the network is an enhancement | Whole product | L3 [All] MUST | What happens to an edit made on a plane? |
| 5.2 | Source of truth | The one place whose answer wins | The server | L3 [All] MUST | Two devices disagree: who wins and why? |
| 5.3 | Optimistic UI | Show the result immediately, confirm later | Instant saves | L2 [S][A] MUST | What if the server later rejects it? |
| 5.4 | **Outbox pattern** | Save the intent to disk first, send it later | Offline queue | **L3 [S] MUST** | Why save before sending? |
| 5.5 | At-least-once delivery | A message may arrive more than once | Retries | L3 [S] MUST | Why can an edit be delivered twice? |
| 5.6 | Retries, exponential backoff, jitter | Wait longer after each failure, plus randomness | Sync loop | L2 [S] MUST | Why not retry instantly in a loop? |
| 5.7 | **Idempotency** | Doing it twice has the same effect as once | Duplicate prevention | **L3 [S] MUST** | Explain the "response lost after commit" scenario |
| 5.8 | Operation IDs | A unique ID per edit | `opId` + `processed_ops` | L3 [S] MUST | What does the server do when it sees an `opId` again? |
| 5.9 | **Optimistic concurrency (versions)** | An edit says "I'm based on version N"; mismatch means someone else changed it | Conflict detection | **L3 [S] MUST** | What does the server compare, and when does it return 409? |
| 5.10 | Per-field versions | Version tracked per field, not per record | Auto-merge | L3 [S] MUST | Why do edits to different fields not conflict? |
| 5.11 | Conflict detection | Same field changed from the same base by two parties | Conflicts table | L3 [S] MUST | Define a conflict in one sentence |
| 5.12 | 3-way merge | Compare base, mine, theirs; merge what doesn't overlap | Auto-merge | L2 [S] MUST | Phone + address vs address + program: what happens? |
| 5.13 | Conflict resolution | Mine / theirs / custom, decided by a human | Conflict page | L2 [S][A][As] MUST | Why must the user see both values first? |
| 5.14 | Stale resolution | The data changed again while the user decided | Resolve endpoint | L2 [S] SHOULD | Why can't we apply a decision blindly? |
| 5.15 | Race conditions | Results depend on timing | Concurrent edits | L2 [S] MUST | Give one example in our system |
| 5.16 | Why client clocks can't be trusted | Phone clocks are wrong or changed | Using versions, not timestamps | L2 [S] MUST | Why not "latest timestamp wins"? |
| 5.17 | Eventual consistency | Everyone converges to the same data after syncing | Requirement FR-5.3 | L3 [All] MUST | When is it OK for two devices to differ? |
| 5.18 | Cursor-based pull | "Give me changes after position N" | `/sync/pull` | L2 [S] MUST | What does the client store between syncs? |
| 5.19 | Audit log / append-only history | Record every change, never rewrite | `history` | L3 [S] MUST | How do we restore without erasing the past? |
| 5.20 | State from history (replay) | Current state equals the result of applying all changes | Integrity check | L2 [S] MUST | How do we prove the record equals its history? |
| 5.21 | Duplicate record detection | Same real-world thing created twice | `reg_no`, `cnic` | L2 [S] MUST | What if two campuses create "Ali Raza" offline? |
| 5.22 | Invariants | Rules that must always be true | Requirements section 8 | L3 [S][As] MUST | List all 7 |
| 5.23 | Integrity checking | Queries that prove the invariants hold | Admin check | L2 [S][As] MUST | Make the checker fail on purpose: how? |
| 5.24 | Failure modes | Ways things break: dropped request, lost response, crash, offline | Behavior matrix | L3 [S][As] MUST | Walk through all 17 matrix rows |

---

## 6. Frontend (React + Vite)

| # | Topic | What it is | Where we use it | Depth | Self-check |
|---|---|---|---|---|---|
| 6.1 | HTML and semantic elements | Page structure with meaning (`button`, `nav`, `table`) | Accessibility | L2 [A] MUST | Why `<button>` not a clickable `<div>`? |
| 6.2 | CSS basics, box model | Spacing, borders, sizing | All styling | L2 [A] MUST | Margin vs padding? |
| 6.3 | Flexbox and Grid | Layout systems | All pages | L2 [A] MUST | Build a two-column card layout |
| 6.4 | CSS custom properties | Variables like `--color-brand` | Design tokens | L2 [S][A] MUST | Why no hard-coded colors? |
| 6.5 | React components and props | Reusable UI pieces taking inputs | Every page | L2 [A] MUST | What is a prop? |
| 6.6 | State (`useState`) | Data that changes and re-renders | Forms, UI | L2 [A] MUST | What happens when state changes? |
| 6.7 | Effects (`useEffect`) | Run code after render, with cleanup | Subscriptions, listeners | L3 [A][S] MUST | Why clean up an SSE listener? |
| 6.8 | Custom hooks | Reusable logic packaged as a function | `useConnection`, `useOutbox` | L2 [A][S] SHOULD | What would `useFieldStatus` return? |
| 6.9 | Context | Share data without passing props everywhere | Auth, connection status | L2 [A] SHOULD | What belongs in context? |
| 6.10 | Routing | Different URLs show different pages | Six pages | L2 [A] MUST | How does `/records/:id` get its id? |
| 6.11 | Forms and controlled inputs | Input value lives in state | Record editing | L2 [A] MUST | How do you validate on blur? |
| 6.12 | Data fetching patterns | Loading, success, error states | All API use | L2 [A][S] MUST | What three states must every fetch handle? |
| 6.13 | Derived state | Compute it from other state instead of storing it | Field badges | L2 [S][A] SHOULD | Why derive "pending count" from the outbox? |
| 6.14 | Error boundaries | Catch UI crashes gracefully | Whole app | L1 [A] LATER | What shows if a page crashes? |
| 6.15 | Vite | Fast dev server and build tool | Frontend tooling | L1 [A] SHOULD | What does `npm run build` produce? |
| 6.16 | Environment-specific config | Dev vs demo vs production builds | Demo flag | L2 [S][A] SHOULD | How is demo mode switched on? |

---

## 7. Browser Offline Technology

| # | Topic | What it is | Where we use it | Depth | Self-check |
|---|---|---|---|---|---|
| 7.1 | **IndexedDB** | The browser's built-in database | Record cache, outbox, cursor | **L3 [S] MUST** | Why not localStorage? |
| 7.2 | Dexie | A friendly wrapper for IndexedDB | Local store | L2 [S][A] MUST | How do you add a row and read it back? |
| 7.3 | IndexedDB transactions | Grouped local changes that succeed or fail together | Outbox plus local record update | L2 [S] MUST | Why must "update field" and "add to outbox" be one transaction? |
| 7.4 | Service workers | A background script that intercepts requests | Offline app shell | L2 [S] MUST | What does it do when the network is gone? |
| 7.5 | Service worker lifecycle | install, waiting, activate, update | PWA updates | L2 [S] SHOULD | Why might users see an old version? |
| 7.6 | Cache API and strategies | cache-first, network-first, stale-while-revalidate | App shell, fonts | L2 [S] MUST | Which strategy for the app shell? For API calls? |
| 7.7 | Web app manifest | Metadata that makes it installable | PWA | L1 [S][A] SHOULD | What does the manifest contain? |
| 7.8 | PWA installability | HTTPS plus manifest plus service worker | Mobile demo | L1 [S] SHOULD | What is required to install it? |
| 7.9 | Online/offline detection | `navigator.onLine` and `online`/`offline` events | Connection pill | L2 [S] MUST | Why is `navigator.onLine` not fully reliable? |
| 7.10 | Failure detection by request | Real connectivity = whether requests succeed | Sync engine | L2 [S] MUST | How do you detect "connected but server unreachable"? |
| 7.11 | Storage persistence and limits | Browsers may evict data | Safety | L1 [S] LATER | What could clear local data? |
| 7.12 | Self-hosted fonts | Bundle fonts so they load offline | Typography | L2 [A] SHOULD | Why not use a font CDN? |

---

## 8. UI/UX Implementation

| # | Topic | What it is | Where we use it | Depth | Self-check |
|---|---|---|---|---|---|
| 8.1 | Design tokens | Named values for color, spacing, type, motion | Design-Spec section 3 | L2 [A][S] MUST | Where is the brand color defined? |
| 8.2 | Responsive design, mobile-first | Layout adapts to screen size | All pages | L2 [A] MUST | What changes at 768 px? |
| 8.3 | Status system | Same badge, same wording everywhere | Field states | L2 [All] MUST | What are the six states and their labels? |
| 8.4 | Loading, empty, error, offline states | Every screen needs all four | All pages | L2 [A][As] MUST | What does Home show first-load offline? |
| 8.5 | Skeleton screens | Placeholder shapes while loading | Lists, record page | L1 [A] SHOULD | When do we skip them? |
| 8.6 | Toasts vs banners vs inline vs dialogs | Right channel for each message | Notifications | L2 [A][As] MUST | Which channel for "conflicts exist"? |
| 8.7 | Form validation UX | Validate on blur, preserve input, explain errors | Record editing | L2 [A] MUST | What happens to the user's text when the server rejects it? |
| 8.8 | CSS transitions and animation | Motion on opacity/transform | The 10 approved animations | L2 [A] SHOULD | Why animate only transform and opacity? |
| 8.9 | `prefers-reduced-motion` | Respect users who disable motion | All animation | L1 [A] SHOULD | What do you do when it is on? |
| 8.10 | Accessibility basics | Contrast, focus, keyboard, labels | Every screen | L2 [A][As] SHOULD | Why can't color be the only status signal? |
| 8.11 | `aria-live` regions | Screen readers announce changes | Toasts, status | L1 [A] SHOULD | Polite vs assertive? |
| 8.12 | Microcopy and writing rules | Specific, short, no AI-sounding filler | All text | L2 [All] MUST | Rewrite "Oops! Something went wrong!" |
| 8.13 | Realistic seed data | Believable names, numbers, dates | Demo | L2 [As][S] SHOULD | Why not "User 1"? |

---

## 9. Testing and QA

| # | Topic | What it is | Where we use it | Depth | Self-check |
|---|---|---|---|---|---|
| 9.1 | Unit vs integration vs end-to-end | Small pieces vs whole-flow tests | Strategy | L2 [S][As] MUST | Which kind tests the apply-edit transaction? |
| 9.2 | Vitest | A test runner | Server and sync engine | L2 [S] MUST | How do you write one test case? |
| 9.3 | Testing against a real database | Tests use actual Postgres, not mocks | Apply-edit tests | L2 [S] MUST | Why do mocks hide transaction bugs? |
| 9.4 | Fake network for the client | A stand-in that fails on command | Sync engine tests | L2 [S] MUST | How do you simulate a lost response? |
| 9.5 | Test cases from the behavior matrix | One test per row | Requirements section 7 | L3 [S][As] MUST | Which rows can be automated? |
| 9.6 | Testing the checker itself | Corrupt data on purpose and confirm it fails | Integrity checker | L2 [S] MUST | How do you prove the checker can detect a problem? |
| 9.7 | Manual test checklist | Pass/fail log by a human | Final QA | L3 [As] MUST | Run all 17 rows and log results |
| 9.8 | Edge-case thinking | Empty, huge, duplicate, concurrent, reordered | All features | L2 [As][S] MUST | What if the same op arrives out of order? |
| 9.9 | Bug reports | Steps, expected, actual, evidence | Team workflow | L2 [As] SHOULD | Write one for a failed row |
| 9.10 | Browser end-to-end tests (Playwright) | Scripts that click through the app | Demo journey | L1 [S][As] LATER | Could one script run the demo? |

---

## 10. DevOps and Deployment

| # | Topic | What it is | Where we use it | Depth | Self-check |
|---|---|---|---|---|---|
| 10.1 | Linux command line | cd, ls, cat, grep, permissions, processes | The Oracle server | L2 [S] MUST | How do you see what is listening on a port? |
| 10.2 | SSH | Secure remote shell | Server access | L2 [S] MUST | Why use keys, not passwords? |
| 10.3 | Git basics | commit, branch, merge, push, pull | Version control | L3 [All] MUST | How do you undo your last commit safely? |
| 10.4 | Branching and pull requests | Isolated work, reviewed merges | Team flow | L2 [S][A] SHOULD | When do you merge to main? |
| 10.5 | Merge conflicts | Two people changed the same lines | Team flow | L2 [S][A] SHOULD | How do you resolve one? |
| 10.6 | `.gitignore` and secrets hygiene | Never commit `.env` or keys | Repo | L2 [All] MUST | What must never be in the repo? |
| 10.7 | Docker: image, container, volume, network | Packaged apps that run isolated | Deployment | L2 [S] MUST | Difference between an image and a container? |
| 10.8 | Dockerfile (multi-stage) | Recipe to build an image | Our app image | L2 [S] SHOULD | Why multi-stage? |
| 10.9 | Docker Compose | Define several containers in one file | App plus DB | L3 [S] MUST | What does `docker compose up` do? |
| 10.10 | Named volumes | Persistent storage for containers | Database data | L2 [S] MUST | What happens to data if the container is recreated? |
| 10.11 | ARM64 vs x86 | CPU architectures; images must match | The Oracle box is ARM | L2 [S] MUST | Why could an image fail to start? |
| 10.12 | Healthchecks and restart policies | Auto-detect and recover | Reliability | L2 [S] SHOULD | What does `unless-stopped` do? |
| 10.13 | Resource limits | Cap memory and CPU | Protect production apps | L2 [S] MUST | Why do we limit our containers? |
| 10.14 | Traefik routers/services/dynamic files | Route a hostname to a container | Ingress | L2 [S] MUST | How does a new hostname reach our app? |
| 10.15 | Let's Encrypt and certificate resolvers | Free auto HTTPS | Certificates | L1 [S] SHOULD | What can make issuance fail? |
| 10.16 | Firewalls (UFW and cloud security lists) | Two layers that can block ports | Server access | L2 [S] SHOULD | Which two places must allow a port? |
| 10.17 | GitHub Actions | Automated build on push | arm64 image build | L2 [S] SHOULD | What does the workflow produce? |
| 10.18 | Container registry (GHCR) | Storage for built images | Release flow | L1 [S] SHOULD | How does the server get the image? |
| 10.19 | Fallback deployment | A second host in case the first fails | Judging safety | L2 [S] SHOULD | What is the plan if the server is down? |
| 10.20 | Backups | Dump the DB on a schedule or before demo | Safety | L2 [S] SHOULD | What is your last-good copy? |
| 10.21 | Monitoring the shared box | Watch RAM and CPU | Not breaking Audrio | L1 [S] SHOULD | What command shows free memory? |

---

## 11. Security Basics

| # | Topic | What it is | Where we use it | Depth | Self-check |
|---|---|---|---|---|---|
| 11.1 | Never trust the client | The server re-checks everything | All endpoints | L3 [All] MUST | Why does the server re-validate? |
| 11.2 | SQL injection | Malicious input changes a query | Database code | L2 [S] MUST | How do parameterized queries prevent it? |
| 11.3 | XSS | Malicious script injected into a page | Rendering user text | L2 [A][S] SHOULD | Why does React escape text by default? |
| 11.4 | CSRF and SameSite cookies | Another site tricks your browser into sending requests | Cookie auth | L1 [S] SHOULD | What does SameSite do? |
| 11.5 | CORS | Which origins may call the API | Same-origin avoids most of it | L1 [S] SHOULD | Why don't we need much CORS config? |
| 11.6 | Secrets management | Keys and passwords stay out of code | `.env`, CI secrets | L2 [S] MUST | Where does the DB password live? |
| 11.7 | Rate limiting | Slow down repeated requests | Login | L1 [S] LATER | What does it protect? |
| 11.8 | Demo-only endpoints | Dangerous tools gated by a flag | `/demo/*` | L2 [S] MUST | What stops a judge from calling reset in production mode? |

---

## 12. Working Effectively with AI Agents (antigravity)

| # | Topic | What it is | Where we use it | Depth | Self-check |
|---|---|---|---|---|---|
| 12.1 | Writing a spec the agent can follow | Clear goals, constraints, non-goals | Requirements, Architecture, Design docs | L3 [S] MUST | What would you add to a vague task? |
| 12.2 | Small, verifiable tasks | One piece at a time with a done-check | Daily work | L3 [S] MUST | How do you know a task is done? |
| 12.3 | Reading and reviewing generated code | Catch wrong logic, not just syntax errors | The sync core | L3 [S] MUST | What do you look for in the apply-edit code? |
| 12.4 | Asking the agent to explain | "Walk me through this function" | Learning | L2 [S][A] MUST | Can you explain it back in your own words? |
| 12.5 | Test-first verification | Have tests prove it works | Everything critical | L2 [S] MUST | Which tests prove idempotency? |
| 12.6 | Spotting hallucinations | Made-up APIs, wrong package names, outdated syntax | Dependencies | L2 [S][A] SHOULD | How do you verify a library function exists? |
| 12.7 | Scope control | Refuse unrequested features | Whole project | L3 [S] MUST | What do you do when the agent adds extras? |
| 12.8 | Git checkpoints | Commit before every big agent change | Safety | L2 [S][A] MUST | How do you roll back a bad generation? |
| 12.9 | Read-only audits before changes | Inspect first, then act | The server | L2 [S] MUST | Why audit before deploying? |
| 12.10 | Giving the agent the right context | Docs, existing conventions, file locations | Every prompt | L2 [S] SHOULD | What context did the server audit need? |

---

## 13. Hackathon Delivery

| # | Topic | What it is | Where we use it | Depth | Self-check |
|---|---|---|---|---|---|
| 13.1 | Reading the rubric and the submission form | Know what is judged and what is submitted | Planning | L2 [All] MUST | List the four form fields |
| 13.2 | README structure | What it is, how to run, screenshots, docs links | The repo | L3 [S][As] MUST | Can a stranger run it from the README? |
| 13.3 | Run guide (40-4000 characters) | Exact setup, env vars, start command | Submission | L3 [S][As] MUST | Does the command work from a clean machine? |
| 13.4 | One-command local run | `docker compose up` with seed data and demo mode | Judges run it | L3 [S] MUST | Does it work with no manual steps? |
| 13.5 | Repo hygiene | Clean history, no secrets, docs in `/docs` | GitHub | L2 [S][As] SHOULD | Any leaked keys? |
| 13.6 | Problem story and pitch | A real person, a real pain, the fix | Video, Q&A | L3 [As] MUST | Say the problem in two sentences |
| 13.7 | Demo script | The 10-step journey, word for word | Video | L3 [As][S] MUST | Does it run the same every time? |
| 13.8 | Screen recording | OBS or Loom, clean window, good audio | Demo video | L2 [As] MUST | Is the audio clear? |
| 13.9 | Narration and pacing | Show first, explain briefly | Video | L2 [As] SHOULD | What is the first 15 seconds? |
| 13.10 | Q&A preparation | Likely judge questions with honest answers | Live Q&A | L2 [All] MUST | "How do you know it's correct?" |
| 13.11 | Time management | Day-by-day plan with a cut order | Whole week | L2 [S][As] MUST | What gets cut first? |
| 13.12 | Submission checklist | Public repo, public video, tested run guide, team selected | Final day | L3 [All] MUST | Open every link in a private window |

---

## 14. Glossary (quick reference)

| Term | Plain meaning |
|---|---|
| **Outbox** | The local to-do list of edits not yet confirmed by the server |
| **Operation (op)** | One edit packaged with its ID and base version |
| **opId** | The unique ID of an operation, used to detect duplicates |
| **Idempotent** | Safe to repeat; the second time changes nothing |
| **Base version** | The version an edit was made from |
| **Conflict** | Same field changed by two parties from the same base |
| **Auto-merge** | Combining edits to different fields without asking anyone |
| **Cursor** | A position in the history ("changes after #1042") |
| **Push / pull** | Send my changes / fetch others' changes |
| **Eventual consistency** | After syncing, everyone ends up with the same data |
| **Source of truth** | The one system whose answer is final |
| **Invariant** | A rule that must always hold |
| **Replay** | Rebuilding current state from the full history |
| **Soft delete** | Marking inactive instead of removing |
| **Service worker** | Background script that lets the app load offline |
| **PWA** | A web app that can be installed and work offline |
| **SSE** | Server pushes live messages to the browser |
| **Migration** | A versioned SQL file that changes the schema |
| **Seed** | Predefined demo data |
| **Reverse proxy** | A front door routing requests to the right container |
| **ARM64** | The server's CPU type; images must support it |

---

## 15. Learning Order (mapped to the 7 days)

The idea is **learn just before you build**. Do not study everything first.

| Day | Learn (just in time) | Build |
|---|---|---|
| **Sat 7** | 1.1 to 1.9, 2.1 to 2.8, 4.1 to 4.5, 4.8, 4.9, 10.3, 10.6, 10.7, 10.9, 12.1 to 12.3 | Repo, schema, migrations, seed data, local `docker compose up` |
| **Sun 8** | 3.2 to 3.9, 4.10 to 4.12, 5.7 to 5.11, 5.15, 5.16, 5.19, 11.1, 11.2 | Auth, apply-edit transaction, versions, conflicts, server tests |
| **Mon 9** | 2.9, 2.10, 5.1 to 5.6, 5.12, 5.17, 5.18, 7.1 to 7.3, 7.9, 7.10, 9.1 to 9.4 | Local store, outbox, sync engine with tests |
| **Tue 10** | 6.1 to 6.13, 8.1 to 8.7 | Record, conflict, history pages |
| **Wed 11** | 5.13, 5.14, 5.20 to 5.24, 4.14, 9.5, 9.6 | Idempotency end to end, restore, duplicate flow, integrity checker |
| **Thu 12** | 1.12, 7.4 to 7.8, 8.8 to 8.11, 10.8, 10.12 to 10.19 | Simulator, split view, SSE, service worker, deploy, polish |
| **Fri 13** | 9.7 to 9.10, 13.2 to 13.10 | Video, README, run guide, rehearsal, bug fixes only |
| **Sat 14** | 13.11, 13.12 | Submit in the morning |

### What to skip if time runs short (cut order)
Playwright (9.10), rate limiting (11.7), error boundaries (6.14), storage persistence (7.11), isolation levels (4.13), most of the animation list (keep the badge change and the integrity check).

### The five things you must understand before anything else
1. **Idempotency**: why a retry never duplicates (5.7, 5.8).
2. **Optimistic concurrency**: how versions detect conflicts (5.9, 5.10).
3. **Transactions plus row locks**: why all-or-nothing matters (4.11, 4.12).
4. **The outbox**: why edits are saved before they are sent (5.4).
5. **Eventual consistency and the integrity check**: how we prove it works (5.17, 5.23).

If you understand those five well enough to explain them to a judge, you are ahead of most teams.
