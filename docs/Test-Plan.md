# Full Test Plan

**Goal:** prove (or disprove) that the app does what `Requirements.md` says, under the failure conditions it claims to survive.
**Mindset:** "complete" is a claim until every test below has a recorded result. Try to break it. A test that cannot fail proves nothing.

---

## 0. How to Use This Plan

### 0.1 Roles
| Person | Job |
|---|---|
| **Asad** | Runs the manual tests, logs every result, files bugs |
| **Saim** | Runs API, database and concurrency tests; triages and fixes bugs |
| **Ameen** | Retests UI bugs, runs responsive/browser checks |

### 0.2 Result codes
`P` pass, `F` fail, `B` blocked (cannot run because something else is broken), `N/A` not applicable. **Never leave a cell blank.** Write the date, tester, and build/commit hash at the top of each run.

### 0.3 Severity
| Level | Meaning | Example |
|---|---|---|
| **S1 Blocker** | Data loss, duplicates, wrong data, crash, cannot run | Retried edit applied twice |
| **S2 Major** | Required feature broken or misleading | Conflict not detected |
| **S3 Minor** | Works but wrong/ugly, has a workaround | Wrong toast wording |
| **S4 Cosmetic** | Polish | Misaligned icon |

**Release rule:** zero S1, zero S2 open. S3 acceptable if listed in known issues.

### 0.4 Environments
| Env | Used for |
|---|---|
| **Local fresh clone** (`docker compose up`) | What judges will run. The most important environment. |
| **Oracle deployment** (HTTPS hostname) | Live link, HTTPS, offline/PWA behavior |
| **Fallback deployment** | Failover check |

### 0.5 Required test data (from seed)
- 3 campuses (call them Campus 1, 2, 3), 12+ students, 3 faculty, 2 admins
- Demo accounts: `student`, `faculty`, `admin` (fill actual logins below)
- One record primed for the conflict story, one near-duplicate pair, one record with 8+ history entries

| Account | Email | Password | Campus |
|---|---|---|---|
| Student | | | |
| Faculty | | | |
| Admin | | | |

### 0.5.1 Test tools
- Two browsers or one browser plus a private window (two "devices")
- Browser DevTools: Network tab (Offline, throttling), Application tab (IndexedDB, Service Workers, Cache Storage), Console
- `curl` or an API client for direct server tests
- Database access (`docker exec` into Postgres, or a SQL client) for invariant queries
- A phone on the same network for mobile checks

---

## 1. Pre-Flight: Verify the "Complete" Claim

Before testing behavior, check the claim itself.

| ID | Check | How | Expected | Result |
|---|---|---|---|---|
| PF-1 | Feature coverage audit | For every FR in Requirements section 6, ask antigravity to point to the file and the test that implements it. Fill a table: FR, file, test | Every **Must** FR has code and a test | |
| PF-2 | Unfinished work scan | Search the repo for `TODO`, `FIXME`, `HACK`, `mock`, `stub`, `fake`, `hardcoded`, `lorem`, `placeholder` | Nothing in production paths. Any hit is explained | |
| PF-3 | Mocked data scan | Check that pages read from the real API, not static arrays | No hard-coded records in UI code | |
| PF-4 | Fresh clone builds | New folder, `git clone`, follow the run guide **exactly** | Starts with zero manual steps | |
| PF-5 | Automated tests run | `npm test` (or documented command) | All pass, and the count is not suspiciously low | |
| PF-6 | Tests are real | Open 3 random tests. Break the code under test on purpose | The test fails when the code is broken | |
| PF-7 | Lint/type check | Run type check and lint | No errors | |
| PF-8 | Console clean | Run the app, open DevTools Console, click through | No red errors, no unhandled promise rejections | |
| PF-9 | Dependency sanity | Review `package.json` for unknown or unrequested packages | Every dependency has a purpose | |
| PF-10 | Secrets scan | Search repo and history for keys, passwords, tokens, IPs | None found | |

---

## 2. Smoke Test (10 minutes, run after every build)

If any smoke test fails, stop and fix before doing anything else.

| ID | Test | Expected | Result |
|---|---|---|---|
| SM-1 | App loads at the URL | Login page appears, no console errors | |
| SM-2 | Health endpoint | `GET /health` returns OK and DB check passes | |
| SM-3 | Login as each role | Lands on the right Home for that role | |
| SM-4 | Open a record | Fields load with correct data | |
| SM-5 | Edit one field online | Saves, badge goes to Synced | |
| SM-6 | Open that record's History | New entry appears with who/what/when | |
| SM-7 | Go offline, edit, reconnect | Edit syncs, no duplicate | |
| SM-8 | Run integrity check (admin) | All checks pass | |
| SM-9 | Reset demo data | Returns to seeded state | |
| SM-10 | Sign out | Returns to login; protected pages blocked | |

---

## 3. Authentication and Roles

### 3.1 Login/logout
| ID | Test | Steps | Expected | Result |
|---|---|---|---|---|
| AU-1 | Valid login (each role) | Sign in with each demo account | Success, correct role and campus shown in the user menu | |
| AU-2 | Wrong password | Enter a wrong password | "Email or password is incorrect." Does not say which | |
| AU-3 | Unknown email | Enter a non-existent email | Same message as AU-2 | |
| AU-4 | Empty fields | Submit blank | Inline required messages | |
| AU-5 | Session persists | Log in, refresh | Still signed in | |
| AU-6 | Logout | Click sign out | Session ended; back button does not reveal data | |
| AU-7 | Logout with pending edits | Make an offline edit, sign out | Warning dialog about unsent changes; changes stay on device | |
| AU-8 | Expired session | Delete or expire the cookie, then act | Clear message; unsent changes preserved | |
| AU-9 | Direct URL while signed out | Open a record URL | Redirect to login, then return after sign in | |
| AU-10 | Cookie flags | DevTools, Application, Cookies | httpOnly, Secure (on HTTPS), SameSite set | |
| AU-11 | Token not in localStorage | Application, Local Storage | No token stored there | |

### 3.2 Permission matrix (test every cell)
For each row, attempt the action **through the UI** and **directly through the API** (the API is the real test). The server must refuse unauthorized actions.

| ID | Action | Student (own) | Student (other) | Faculty (own campus) | Faculty (other campus) | Admin |
|---|---|---|---|---|---|---|
| PM-1 | View record | Allow | Deny | Allow | Deny | Allow |
| PM-2 | Edit phone/email/address/emergency contact | Allow | Deny | Deny | Deny | Allow |
| PM-3 | Edit attendance, remarks | Deny | Deny | Allow | Deny | Allow |
| PM-4 | Edit name, program, campus, semester, status | Deny | Deny | Deny | Deny | Allow |
| PM-5 | Edit reg no / CNIC | Deny | Deny | Deny | Deny | Allow |
| PM-6 | View history | Own only | Deny | Allow | Deny | Allow |
| PM-7 | Restore a value | Deny | Deny | Deny | Deny | Allow |
| PM-8 | Resolve conflicts | Own edits | Deny | Own edits | Deny | Any |
| PM-9 | Run integrity check | Deny | Deny | Deny | Deny | Allow |
| PM-10 | Use `/demo/*` endpoints | Deny | Deny | Deny | Deny | Allow only if demo mode is on |
| PM-11 | Search/list all records | Deny | n/a | Own campus only | n/a | All |

| ID | Test | Expected | Result |
|---|---|---|---|
| PM-12 | Forge a request: student sends an edit to `program` via API | Rejected with a permission reason; nothing changed; no history row | |
| PM-13 | Student requests another student's record by ID | Denied; response does not reveal whether it exists | |
| PM-14 | Faculty edits a student on another campus via API | Denied | |
| PM-15 | Tamper with the role claim (edit the cookie/token) | Rejected; invalid signature | |
| PM-16 | Disable demo mode, call `/demo/reset` as admin | Refused (404/403) | |
| PM-17 | Navigation hides links the role can't use | Student sees no admin links | |
| PM-18 | Locked fields show a lock and tooltip | Tooltip explains who can change it | |

---

## 4. Validation (every field)

Test each field **three ways**: in the UI (offline, device-side), in the UI online, and **directly against the API** (server-side). The server must reject everything the rules forbid, even if the client allows it.

| ID | Field | Valid examples | Invalid examples to try | Expected |
|---|---|---|---|---|
| VA-1 | Registration number | `CS-2026-0147` | empty, `abc`, `CS-2026`, lowercase if format forbids, 100 chars, spaces, SQL text (`' OR 1=1 --`) | Rejected with the rule; valid accepted |
| VA-2 | CNIC | 13 digits | 12 digits, 14 digits, letters, symbols, grouped incorrectly | Rejected |
| VA-3 | Full name | `Ayesha Khan` | empty, 1 char, 81+ chars, only spaces, emoji only | Rejected per rule; Urdu characters accepted if supported |
| VA-4 | Program | one from the list | value not in list, empty | Rejected |
| VA-5 | Campus | one from the list | not in list | Rejected |
| VA-6 | Semester | 1 to 8 | 0, 9, -1, 3.5, `abc`, empty | Rejected |
| VA-7 | Status | Active / On leave / Graduated | other text | Rejected |
| VA-8 | Phone | `0300 1234567` and unspaced variants | letters, too short/long, wrong prefix, `+92` formats if not supported | Rejected with an example format |
| VA-9 | Email | `name@domain.com` | missing `@`, spaces, no domain, 300 chars | Rejected |
| VA-10 | Address | 5 to 200 chars | 4 chars, 201 chars, only spaces | Rejected |
| VA-11 | Emergency contact | name and valid phone | missing either part, invalid phone | Rejected |
| VA-12 | Attendance % | 0 to 100 | -1, 101, `abc`, 50.555 if decimals not allowed | Rejected |
| VA-13 | Faculty remarks | empty (optional), up to 500 chars | 501 chars | Rejected at 501 |
| VA-14 | Cross-field rule | Set Graduated with semester 8 | Graduated with semester 5 | **Server rejects**, even if the client allowed it |
| VA-15 | Whitespace handling | `  Ali  ` | leading/trailing spaces | Trimmed or rejected consistently |
| VA-16 | Special characters | Names with apostrophes, hyphens, Urdu text | `<script>alert(1)</script>` | Stored safely; displayed as text, never executed |
| VA-17 | Very long input | n/a | 10,000-char payload | Rejected cleanly, no crash |

| ID | Behavior | Expected | Result |
|---|---|---|---|
| VA-18 | Validate on blur | Error appears after leaving the field, not on every keystroke | |
| VA-19 | Error wording | States the rule plus an example, no jargon | |
| VA-20 | Input preserved | After a rejection, the user's text is still in the field | |
| VA-21 | Client OK, server rejects | Make the device allow it (bypass the client check), push it | Server rejects; field shows the reason; edit kept in outbox/recovery | |
| VA-22 | Error summary | Several invalid fields show a summary or each inline | |

---

## 5. Core Edit Flow (online)

| ID | Test | Steps | Expected | Result |
|---|---|---|---|---|
| ED-1 | Edit one field | Change phone, save | Instant local save, badge Pending then Synced | |
| ED-2 | Edit several fields | Change phone and address | Each field has its own badge and history entry | |
| ED-3 | Save with no change | Re-enter the same value | No new history entry (or a clear no-op) | |
| ED-4 | Refresh after save | Reload the page | Value persists | |
| ED-5 | Other user sees it | Edit as admin; open as student in another browser | Student view updates (live or on refresh) | |
| ED-6 | Version increments | Check the record version/field version after edit | Increased by exactly 1 | |
| ED-7 | Rapid edits to one field | Change a field 5 times quickly | Final value correct; history shows each accepted change or a defined coalescing | |
| ED-8 | Edit then immediately navigate away | Save and leave the page | Edit not lost | |
| ED-9 | Large record | Record with long remarks and many history entries | Loads and edits without lag | |
| ED-10 | Create a new student (admin) | Fill all required fields | Record created, history shows a Create entry | |
| ED-11 | Soft delete / deactivate | Set record inactive | Record marked inactive; history retained; not hard-deleted | |

---

## 6. Offline Capture

| ID | Test | Steps | Expected | Result |
|---|---|---|---|---|
| OF-1 | Go offline | DevTools, Network, Offline | Pill shows Offline; banner appears | |
| OF-2 | Edit offline | Change a field | Saved locally; badge "Saved on this device"; no error | |
| OF-3 | Pending count | Make 3 offline edits | Counter shows 3 | |
| OF-4 | Persist across refresh | Refresh while offline | Edits still pending; app still loads | |
| OF-5 | Persist across browser close | Close and reopen the browser, still offline | Edits still pending | |
| OF-6 | Order preserved | Edit A, then B, then A again offline; reconnect | Applied in the same order | |
| OF-7 | Reconnect auto-sync | Turn the network back on | Pending edits send automatically without a click | |
| OF-8 | Browse cached records offline | Open previously viewed records offline | Display cached data with a "saved on this device" notice | |
| OF-9 | Open an unvisited record offline | Try a record never loaded | Clear message, no crash | |
| OF-10 | Create a record offline | Create a student offline | Saved locally with a client UUID; syncs on reconnect | |
| OF-11 | Cold start offline (cached) | Close everything, go offline, open the app | App shell loads, data from cache | |
| OF-12 | Cold start offline (never loaded) | Fresh browser profile, offline, open the app | Dedicated offline fallback page | |
| OF-13 | Flaky network | Toggle offline/online repeatedly during sync | No duplicates, no lost edits | |
| OF-14 | Long offline period | Stay offline for 10+ minutes with many edits | Everything still queued | |
| OF-15 | Login while offline with an existing session | Reload offline | Stays signed in | |

---

## 7. Sync Engine (push/pull)

| ID | Test | Steps | Expected | Result |
|---|---|---|---|---|
| SY-1 | Batch push | 5 offline edits, reconnect | One or more requests; each op gets its own result | |
| SY-2 | Per-op results | Mix valid, invalid, conflicting ops in one batch | Each handled individually; valid ones succeed regardless of others | |
| SY-3 | Pull after push | After syncing, check the cursor | Cursor advanced; no repeated downloads | |
| SY-4 | Pull others' changes | Admin edits on another device; student device syncs | Student receives the change | |
| SY-5 | Cursor survives restart | Sync, restart browser, sync again | No re-download of everything, no gaps | |
| SY-6 | Backoff on failure | Make the server unreachable | Retries with increasing delay, visible next-retry info | |
| SY-7 | No infinite hammering | Watch the Network tab during an outage | Requests slow down, not a tight loop | |
| SY-8 | Permanent rejection | Push an op the server will always reject | Stops retrying; appears in recovery with a reason | |
| SY-9 | Sync Now button | Click while online with pending edits | Triggers immediately | |
| SY-10 | Sync Now while offline | Click offline | Disabled with the reason | |
| SY-11 | Concurrent sync triggers | Click Sync Now repeatedly | No duplicate concurrent syncs; no duplicate ops | |
| SY-12 | Ordering across devices | Two devices edit different records; sync in both orders | Same end state either way | |
| SY-13 | Large queue | 100 queued edits | All delivered, in order, UI responsive | |
| SY-14 | Server restart mid-sync | Restart the API container during a push | Device retries; no loss, no duplicate | |
| SY-15 | Token expiry mid-sync | Expire the session during sync | Edits preserved; prompt to sign in; resume after | |

---

## 8. Idempotency (duplicate prevention at the operation level)

| ID | Test | Steps | Expected | Result |
|---|---|---|---|---|
| ID-1 | **Lost response after commit** | Simulator: "Lose next response"; edit and sync | Server committed; device retries; record changed **once**; history has **one** entry | |
| ID-2 | Lost request before server | Simulator: "Lose next request" | Retried; applied once | |
| ID-3 | Double-click save | Click Save twice fast | One change | |
| ID-4 | Same op sent twice via API | `curl` the same `opId` twice | Second returns the stored result with status `duplicate`; no new history row | |
| ID-5 | Same op, tampered payload | Reuse an `opId` with a different value | Server returns the original result and does **not** apply the new value (or rejects clearly). Behavior documented | |
| ID-6 | Replay after server restart | Send an old `opId` after restarting | Still recognized as duplicate | |
| ID-7 | Batch with a duplicate inside | Batch includes one already-processed op | That op is `duplicate`; others proceed | |
| ID-8 | Retry storm | Simulate 10 retries of the same op | Applied exactly once | |
| ID-9 | Concurrent identical ops | Fire the same `opId` simultaneously (two requests at the same time) | One applied, the other `duplicate`; no double write, no error 500 | |
| ID-10 | `processed_ops` content | Query the table after tests | One row per op; stored result matches what was returned | |

---

## 9. Versions, Conflicts, Auto-Merge

| ID | Test | Steps | Expected | Result |
|---|---|---|---|---|
| CF-1 | **Same field, two parties** | Student offline edits address; admin online edits address; student reconnects | Conflict created; student's edit **held, not applied, not lost** | |
| CF-2 | **Different fields, auto-merge** | Student offline edits phone+address; admin edits address+program | Phone and program applied automatically; **only address** is a conflict | |
| CF-3 | Server value stays authoritative during conflict | Check the record while the conflict is open | Shows the server value; usable | |
| CF-4 | Same value both sides | Both edit address to the identical value | No conflict (converged); history reflects it sensibly | |
| CF-5 | Conflict banner | Conflict exists | Persistent banner "N fields need your decision" with Review | |
| CF-6 | Field badge | Conflicted field | Conflict badge, icon plus label, not color alone | |
| CF-7 | Multiple conflicts at once | Create 3 conflicts on one record | All listed; each resolvable | |
| CF-8 | Conflicts on several records | Conflicts on 2 different records | Listed correctly per record | |
| CF-9 | Three-way: A, B, C editing the same field | Three devices edit the same field from the same base | First applies; others become conflicts; none silently lost | |
| CF-10 | Edit chain offline | Edit the same field 3 times offline, then conflict | Handled sensibly (final value conflicts, or each op is evaluated consistently). Behavior documented | |
| CF-11 | Version bookkeeping | After CF-2, inspect `field_versions` | Only changed fields incremented | |
| CF-12 | Conflict recorded in DB | Query `conflicts` | Row has base version, server value, incoming value, op ID, actor, status `open` | |
| CF-13 | Permission-blocked "conflict" | Student offline edits a field they lost permission for | Rejected for permission, not treated as a conflict | |

### 9.1 Resolution
| ID | Test | Steps | Expected | Result |
|---|---|---|---|---|
| CR-1 | See both values | Open Review | Your value, current value, who/when for each. **Nothing preselected** | |
| CR-2 | Keep mine | Choose and apply | New versioned change; history entry type "Resolved conflict" | |
| CR-3 | Keep current | Choose and apply | Record unchanged; conflict closed; history notes the decision | |
| CR-4 | Enter a different value | Custom value | Validated like a normal edit; applied | |
| CR-5 | Invalid custom value | Enter an invalid phone | Rejected with a reason; stays on the card | |
| CR-6 | Apply disabled until all decided | Leave one card undecided | Apply stays disabled | |
| CR-7 | Decide later | Click it | Conflict remains open; banner persists | |
| CR-8 | **Stale resolution** | While reviewing, another user changes the field again; click Apply | Notice "current value changed again"; card refreshes; **decision not applied blindly** | |
| CR-9 | Resolve by admin | Admin resolves a student's conflict | Allowed; recorded with admin as actor | |
| CR-10 | Resolve by an unauthorized user | Another student tries via API | Denied | |
| CR-11 | Resolve twice | Submit the same resolution twice | Applied once (idempotent) | |
| CR-12 | Offline resolution | Resolve while offline | Queued; applies on reconnect with correct stale check | |
| CR-13 | Success feedback | After applying | Toast "N conflicts resolved." and return to the record | |
| CR-14 | Conflict closes in DB | Query `conflicts` | Status resolved, with resolver and resolution | |

---

## 10. Duplicate Records

| ID | Test | Steps | Expected | Result |
|---|---|---|---|---|
| DR-1 | Duplicate reg number online | Create a student with an existing reg number | Blocked; `duplicate_record`; shows the existing record | |
| DR-2 | Duplicate CNIC online | Same with CNIC | Blocked | |
| DR-3 | **Two devices create the same student offline** | Both create the same reg number; both sync | One record exists; second flagged for resolution; nothing silently merged or dropped | |
| DR-4 | Choose "Open existing record" | Use the action | Navigates to the existing record | |
| DR-5 | Choose "Cancel creation" | Use the action | Local pending creation removed; history note if specified | |
| DR-6 | Case/format variants | `cs-2026-0147` vs `CS-2026-0147`, CNIC with/without dashes | Treated as duplicates (or documented otherwise) | |
| DR-7 | DB-level uniqueness | Insert a duplicate directly in SQL | Database refuses | |
| DR-8 | Race: simultaneous creates | Two creates fired at the same instant | One succeeds; one is `duplicate_record`; no 500 | |
| DR-9 | Near-duplicate seed pair | Open the seeded pair | Behaves as designed for the demo | |

---

## 11. History and Restore

| ID | Test | Steps | Expected | Result |
|---|---|---|---|---|
| HI-1 | Entry content | Check any entry | Field, old to new, who, role, campus, device, exact time, type tag | |
| HI-2 | Order | View a long history | Newest first, grouped by day | |
| HI-3 | Entry types | Create, edit, resolve, restore | Each has the right tag | |
| HI-4 | Filters | By field, type, person, date | Correct results | |
| HI-5 | Empty value display | A change from/to empty | Shows "(empty)", not blank | |
| HI-6 | Long value | Very long remarks | Truncated with Show full value | |
| HI-7 | Append-only (UI) | Look for any edit/delete control on entries | None exists | |
| HI-8 | **Append-only (DB)** | Try `UPDATE history ...` and `DELETE FROM history ...` | Blocked by the database | |
| HI-9 | History permissions | Student views own and another's history | Own allowed; other denied | |
| HI-10 | Restore a field | Admin restores an earlier value | **New** history entry type Restore; old entries untouched | |
| HI-11 | Restore dialog | Open Restore | States the consequence; default focus on Cancel | |
| HI-12 | Restore validation | Restore a value that is now invalid | Rejected with reason | |
| HI-13 | Restore conflicts | Restore while someone else changed the field | Follows normal conflict rules | |
| HI-14 | Restore whole record | If supported | All fields return to the chosen point via new entries | |
| HI-15 | Non-admin restore | Student/faculty via UI and API | Denied | |
| HI-16 | Timestamps | Compare displayed time with actual local time | Correct local time, exact time on hover | |
| HI-17 | Offline history view | View history offline | Cached, with a "may be missing recent changes" notice | |

---

## 12. Integrity Checker

| ID | Test | Steps | Expected | Result |
|---|---|---|---|---|
| IC-1 | Clean pass | Run on seeded data | All checks pass, results appear in sequence | |
| IC-2 | Pass after the full demo journey | Run after the 10-step journey | All pass | |
| IC-3 | Pass after chaos test | Run after section 19 | All pass | |
| IC-4 | **Detects duplicate unique value** | Manually corrupt: set two records to the same reg number (disable the constraint in a test DB) | Check fails with the offending rows | |
| IC-5 | **Detects replay mismatch** | Change a student value directly in SQL, bypassing history | Replay check fails | |
| IC-6 | **Detects version mismatch** | Change a version number directly | Version check fails | |
| IC-7 | **Detects orphan history** | Insert a history row for a missing student | Check fails | |
| IC-8 | **Detects double-applied op** | Insert two history rows with the same `op_id` | Check fails | |
| IC-9 | Detects lost/orphaned processed op | Remove the matching history/outcome | Check fails | |
| IC-10 | Fail display | After a failure | "N checks failed", failing rows expanded, Copy details works | |
| IC-11 | Repeatability | Run it five times | Same result each time | |
| IC-12 | Non-admin access | Student/faculty via UI and API | Denied | |
| IC-13 | Performance | Run on demo data | Completes within a few seconds | |
| IC-14 | Read-only | Confirm the checker changes no data | Row counts and versions unchanged after running | |

> **Important:** IC-4 to IC-9 prove the checker can fail. A checker that always says "pass" is worthless. Restore the database afterwards (`reset-demo`).

---

## 13. Live Updates (SSE)

| ID | Test | Steps | Expected | Result |
|---|---|---|---|---|
| LU-1 | Live change | Admin edits; student device open on the same record | Student sees a notice or update without refreshing | |
| LU-2 | Unsaved edit protection | Student mid-edit when the change arrives | Non-blocking notice; the typed value is not overwritten | |
| LU-3 | Reconnect after network drop | Drop and restore the connection | SSE reconnects; missed changes pulled | |
| LU-4 | Multiple tabs | Two tabs, same user | Both update; no duplicate toasts | |
| LU-5 | Role scoping | A faculty at campus A shouldn't be notified about campus B records | No leakage | |
| LU-6 | Cleanup | Navigate away | No lingering connections (check Network tab) | |
| LU-7 | Through the proxy | Test on the HTTPS deployment | Stream stays open, not buffered or cut | |

---

## 14. Failure Simulator and Demo Controls

| ID | Test | Expected | Result |
|---|---|---|---|
| FS-1 | Offline toggle | Same as real offline | |
| FS-2 | Slow connection | Pending states visible; nothing breaks | |
| FS-3 | Lose next response | Server commits, reply dropped (verified in DB), device retries safely | |
| FS-4 | Lose next request | Server did **not** receive it (verified in DB), retry works | |
| FS-5 | Second device / split view | Two labeled device views each with its own outbox and pill | |
| FS-6 | Device isolation | Edit on Device A doesn't appear on Device B until sync | |
| FS-7 | Inject remote edit | Scripted edit appears as another user/campus | |
| FS-8 | Reset demo data | Everything back to seed in under 3 seconds | |
| FS-9 | Reset confirmation | Confirm dialog shown | |
| FS-10 | Reset clears local state | Device outboxes and caches also reset (or documented) | |
| FS-11 | Demo mode off | No strip, no controls, `/demo/*` refused | |
| FS-12 | Controls self-explanatory | Each has a one-line description | |
| FS-13 | Repeatability | Run the same scenario 5 times | Same result | |
| FS-14 | Shortcuts | Keyboard shortcuts work and don't clash with browser shortcuts | |

---

## 15. Behavior Matrix (Requirements section 7: all 17 rows)

| # | Scenario | Expected | Result | Evidence (screenshot/log) |
|---|---|---|---|---|
| BM-1 | Edit while offline | Saved locally, pending, no offline error | | |
| BM-2 | Restart with pending edits | Edits still queued | | |
| BM-3 | Connection returns | Auto-sync in order; becomes synced | | |
| BM-4 | Response lost after server saved | Retry; changed once; synced | | |
| BM-5 | Request lost before server | Retry; applied once | | |
| BM-6 | Double submit | Applied once | | |
| BM-7 | Two users edit the same field | Conflict; neither lost | | |
| BM-8 | Two users edit different fields | Both applied, no action | | |
| BM-9 | Passes device validation, fails server | Preserved, flagged with reason | | |
| BM-10 | Unauthorized edit | Rejected, nothing changed, user informed | | |
| BM-11 | Two campuses create the same student offline | One record plus duplicate item | | |
| BM-12 | Record changes mid-resolution | User told; not applied blindly | | |
| BM-13 | Admin restores a version | New entry; past untouched | | |
| BM-14 | Op permanently rejected | In recovery with reason; never dropped | | |
| BM-15 | Batch with one failure | Others succeed; failure reported | | |
| BM-16 | Server temporarily down | Device works offline, backoff retry, no loss | | |
| BM-17 | Integrity check after all of the above | All checks pass | | |

---

## 16. Invariants (prove with the database)

Run after the behavior matrix and after the chaos test. Adjust column names to the real schema; the **intent** must hold.

| ID | Invariant | Check | Expected | Result |
|---|---|---|---|---|
| IN-1 | Exactly-once | No `op_id` appears twice in `history` for the same field change | 0 rows | |
| IN-2 | Uniqueness | No duplicate `reg_no`, `cnic`, or `id` in `students` | 0 rows | |
| IN-3 | Replayability | Replaying history for each student reproduces its current values | 0 mismatches | |
| IN-4 | Version integrity | `students.version` equals the count of accepted history entries (per the documented definition) | 0 mismatches | |
| IN-5 | No lost edits | Every op the tests sent is in exactly one of: applied, conflict, rejected, duplicate (recorded) | Count matches | |
| IN-6 | Append-only | History rows unmodified (compare a snapshot before/after, or rely on blocking rules) | No change | |
| IN-7 | Convergence | After all devices sync with an empty outbox, device data equals server data | Identical | |

Example queries (adapt to the schema):
```sql
-- IN-1: duplicate op_id in history
SELECT op_id, field, COUNT(*) FROM history
GROUP BY op_id, field HAVING COUNT(*) > 1;

-- IN-2: duplicate unique values
SELECT reg_no, COUNT(*) FROM students GROUP BY reg_no HAVING COUNT(*) > 1;
SELECT cnic,   COUNT(*) FROM students GROUP BY cnic   HAVING COUNT(*) > 1;

-- Orphaned history
SELECT h.id FROM history h LEFT JOIN students s ON s.id = h.student_id
WHERE s.id IS NULL;

-- Processed ops with no recorded outcome
SELECT op_id FROM processed_ops WHERE result IS NULL;
```

---

## 17. API Tests (direct, with curl or an API client)

Use a cookie jar for sessions. Set `BASE` to the deployment URL.

```bash
BASE=http://localhost:3050
curl -c jar.txt -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"<password>"}' $BASE/auth/login
```

| ID | Endpoint | Test | Expected | Result |
|---|---|---|---|---|
| AP-1 | `POST /auth/login` | Valid / invalid credentials | 200 with cookie / 401 | |
| AP-2 | `GET /auth/me` | With and without a session | User info / 401 | |
| AP-3 | `GET /sync/snapshot` | Each role | Only permitted records plus a cursor | |
| AP-4 | `POST /sync/push` | Valid op | Result `applied` | |
| AP-5 | `POST /sync/push` | Same `opId` again | `duplicate`, same result | |
| AP-6 | `POST /sync/push` | Stale `baseVersion`, different value | `conflict` with the server value and version | |
| AP-7 | `POST /sync/push` | Invalid value | `rejected` with field and reason | |
| AP-8 | `POST /sync/push` | Unauthorized field | `rejected` (permission) | |
| AP-9 | `POST /sync/push` | New student with an existing reg number | `duplicate_record` plus the existing ID | |
| AP-10 | `POST /sync/push` | Batch of 10 mixed ops | 10 individual results, order preserved | |
| AP-11 | `POST /sync/push` | Malformed JSON | 400 with the standard error shape, no crash | |
| AP-12 | `POST /sync/push` | Missing required properties | 400 listing what's missing | |
| AP-13 | `POST /sync/push` | Wrong types (string for number) | 400 | |
| AP-14 | `POST /sync/push` | Empty batch | Handled cleanly | |
| AP-15 | `POST /sync/push` | Oversized batch (1000 ops) | Handled (limit with a clear error, or processed) without timeout/crash | |
| AP-16 | `GET /sync/pull?since=N` | Valid, `0`, a huge number, negative, non-numeric | Correct data / empty / 400 where invalid | |
| AP-17 | `GET /students/:id/history` | Allowed vs denied | 200 / 403 or 404 | |
| AP-18 | `GET /conflicts` | Each role | Only conflicts the user may see | |
| AP-19 | `POST /conflicts/:id/resolve` | Valid, stale, repeated, unauthorized | Applied / stale response / idempotent / denied | |
| AP-20 | `POST /students/:id/restore` | Admin vs others | Allowed / denied | |
| AP-21 | `GET /admin/integrity` | Admin vs others | Results / denied | |
| AP-22 | `GET /events` | With a session | Stream opens; heartbeat or events arrive | |
| AP-23 | Unknown route | `GET /nope` | 404 in the standard shape | |
| AP-24 | Wrong method | `DELETE /sync/push` | 404 or 405 | |
| AP-25 | Error shape | Check several failures | Same JSON shape everywhere; no stack traces leaked | |
| AP-26 | Status codes | Review all | Meaningful codes (400/401/403/404/409/5xx) used as defined | |
| AP-27 | Large-value inputs | 1 MB string in a field | Rejected cleanly | |

---

## 18. Database-Level Tests

| ID | Test | Expected | Result |
|---|---|---|---|
| DB-1 | Fresh migration | Empty DB, run migrations | Schema created, no errors | |
| DB-2 | Re-run migrations | Run again | No-op, no errors | |
| DB-3 | Seed | Run seed | Expected counts (students, users, etc.) | |
| DB-4 | Unique constraints | Duplicate reg_no and cnic insert | Refused by the DB | |
| DB-5 | Foreign keys | Insert history with a missing student | Refused | |
| DB-6 | History protected | `UPDATE`/`DELETE` on `history` | Blocked | |
| DB-7 | **Transaction atomicity** | Force a failure after the history insert but before commit (test hook or failure injection) | Nothing persisted: no history, no `processed_ops`, no student change | |
| DB-8 | Row locking | Two concurrent transactions on one record | Serialized; versions consistent | |
| DB-9 | Backup and restore | Dump, wipe, restore | Data intact; integrity check passes | |
| DB-10 | Volume persistence | Recreate containers | Data survives | |
| DB-11 | Not exposed | Check published ports | DB has no host port | |
| DB-12 | Indexes/performance | Query history and students at demo scale | Fast | |

---

## 19. Concurrency and Chaos Test

| ID | Test | Expected | Result |
|---|---|---|---|
| CH-1 | Script runs | A script simulates 20 to 50 devices making random edits, going offline, dropping responses, reconnecting | Completes without crashing | |
| CH-2 | Parameters | Number of devices, operations, failure probability configurable | Documented | |
| CH-3 | Reproducibility | Same seed produces the same run | Same outcome | |
| CH-4 | Outcome | After the run: integrity check | **0 violations** | |
| CH-5 | Accounting | Operations sent equals applied + duplicate + conflict + rejected | Totals match | |
| CH-6 | No server errors | Check server logs | No 500s, no deadlocks | |
| CH-7 | Convergence | After all devices sync, all agree with the server | Identical | |
| CH-8 | Resource use | Watch server RAM/CPU on the shared box | Within the container limits | |
| CH-9 | Repeat | Run 5 times | 0 violations every time | |
| CH-10 | Report | Final summary printed | "0 violations, N operations, M conflicts handled" | |

---

## 20. UI States (every page)

For each page, confirm all four: **loading, empty, error, offline**, plus role differences.

| ID | Page | Test | Expected | Result |
|---|---|---|---|---|
| UI-1 | Login | Default, submitting, wrong credentials, offline | Per spec 6.1 | |
| UI-2 | Login | Demo accounts shown only in demo mode; one click fills | Works | |
| UI-3 | Home | Status tiles (connection, pending, attention) | Counts correct, each links correctly | |
| UI-4 | Home (student) | Own record card, recent activity | Correct | |
| UI-5 | Home (faculty/admin) | Search, campus filter (admin), table | Works; faculty limited to own campus | |
| UI-6 | Home | Skeleton on slow load, only after 300 ms | No flash for fast loads | |
| UI-7 | Home | Empty search | "No records match..." with Clear search | |
| UI-8 | Record | All states per field: idle, editing, invalid, pending, syncing, synced, conflict, rejected, locked | Each visible and distinct | |
| UI-9 | Record | No access / not found | Message does not reveal existence | |
| UI-10 | Record | Record updated by someone else while viewing | Notice with Show changes | |
| UI-11 | Conflict | Layout, both columns, stacked on mobile | Per spec 6.4 | |
| UI-12 | Conflict | No open conflicts | "No open conflicts." | |
| UI-13 | History | Timeline, filters, empty, offline | Per spec 6.5 | |
| UI-14 | Sync Center | Connection, outbox, needs-attention, integrity, demo controls | All sections present; role-limited | |
| UI-15 | Sync Center | Empty outbox | "Everything is saved to the server." | |
| UI-16 | Duplicate resolution | Side-by-side with highlighted matches | Correct actions | |
| UI-17 | 404 / access denied | Visit bad routes | Short factual message plus a way back | |
| UI-18 | Offline fallback | First load offline with no cache | Dedicated page | |
| UI-19 | Global shell | Connection pill, pending counter, role label, banners | Always correct and visible | |
| UI-20 | Navigation | Role-aware items; bottom bar on mobile; sidebar on desktop | Correct | |

---

## 21. Status Badges, Toasts, Banners, Dialogs

| ID | Test | Expected | Result |
|---|---|---|---|
| NT-1 | Every status shows icon **and** text | Synced, Pending, Syncing, Conflict, Rejected, Offline | |
| NT-2 | A field never shows Synced before server confirmation | Verify with a slowed network | |
| NT-3 | Synced badge is quiet | Not a wall of green | |
| NT-4 | No toast per field sync | Only batch results toast | |
| NT-5 | Toast catalogue | Trigger each event in spec 8.3 and compare wording | Exact wording | |
| NT-6 | Toast placement and stacking | Max 3 visible; extras queue | |
| NT-7 | Toast duration and pause | 4 s success, 8 s error; hover pauses | |
| NT-8 | Toast dedupe | Trigger the same event 3 times quickly | Collapses into one | |
| NT-9 | Toast dismiss | Close button; swipe on touch | |
| NT-10 | Toast actions | At most one action; it works (Retry, View, Review) | |
| NT-11 | Banners persistent | Offline and conflict banners stay while true | |
| NT-12 | Dialogs | Restore, Discard, Reset, Sign out with pending | Correct text; default focus on Cancel; Esc closes (where allowed) | |
| NT-13 | Right channel for each message | Use the table in spec 8.1 | |
| NT-14 | Live-region announcements | Screen reader/DevTools accessibility tree shows polite/assertive regions | |

---

## 22. Content and Copy Review

| ID | Test | How | Expected | Result |
|---|---|---|---|---|
| CP-1 | Banned phrase search | Grep the source and open every screen. Search for: seamless, effortless, empower, leverage, unlock, supercharge, elevate, streamline, robust, cutting-edge, game-changing, revolutionize, "Oops", "Whoops", "Uh-oh", "Something went wrong", "successfully" | None | |
| CP-2 | No exclamation marks | Grep strings | None in UI copy | |
| CP-3 | No emoji in UI | Visual scan | None | |
| CP-4 | Sentence case | Scan headings and buttons | Consistent | |
| CP-5 | Buttons are verbs | Scan all buttons | No bare "OK", "Submit", "Yes" | |
| CP-6 | Vocabulary consistency | record, change, synced, conflict, history, restore, discard, campus | One term per concept | |
| CP-7 | Error formula | Review each error | What happened, why, what next | |
| CP-8 | Dates and numbers | Check formats | `6 Nov 2026, 2:14 PM`; `0300 1234567`; correct plurals | |
| CP-9 | Placeholder content | Scan for Lorem, "John Doe", "Test", "User 1" | None | |
| CP-10 | Realistic seed data | Review the demo data | Believable names, numbers, dates | |

---

## 23. Responsive, Browsers, PWA, Offline App Shell

| ID | Test | Expected | Result |
|---|---|---|---|
| RS-1 | Widths 360, 414, 768, 1024, 1280, 1920 px | No horizontal scroll; layout per spec | |
| RS-2 | Mobile: bottom tab bar; tables become cards | Correct | |
| RS-3 | Tap targets | At least 44 by 44 px | |
| RS-4 | Zoom 200% | Still usable | |
| RS-5 | Landscape on phone | Usable | |
| RS-6 | Split two-device view | Wide screens only; labeled frames | |
| BR-1 | Chrome (desktop) | Full pass | |
| BR-2 | Edge | Full pass | |
| BR-3 | Safari (desktop/iOS) | IndexedDB, service worker, cookies behave | |
| BR-4 | Android Chrome | Full pass, installable | |
| BR-5 | Firefox | Basic pass | |
| PW-1 | Manifest | Valid; name, icons, theme | |
| PW-2 | Service worker registered | Visible in DevTools; scope correct | |
| PW-3 | App shell offline | Load the app with the network off | Works | |
| PW-4 | Fonts offline | Fonts render offline (self-hosted and cached) | |
| PW-5 | Install | "Install app" on mobile/desktop works | |
| PW-6 | Update flow | Deploy a new build; open the app | New version picked up without stale-cache bugs | |
| PW-7 | Cache after logout | Check what stays cached for a shared device | No sensitive data exposed after sign-out (or documented) | |
| PW-8 | HTTPS requirement | Test over plain HTTP on a non-localhost host | Service worker doesn't register (expected); the HTTPS host works | |

---

## 24. Accessibility

| ID | Test | Expected | Result |
|---|---|---|---|
| AC-1 | Keyboard only | Complete login, edit, resolve a conflict, restore | No mouse needed | |
| AC-2 | Focus visible | Clear ring on every interactive element | |
| AC-3 | Focus order | Logical | |
| AC-4 | Dialog focus | Trapped inside; returns to the trigger on close | |
| AC-5 | Contrast | Check text and UI components with a contrast tool | 4.5:1 text, 3:1 large/UI | |
| AC-6 | Color not sole signal | Grayscale or color-blindness simulation | Statuses still distinguishable | |
| AC-7 | Labels | Every input has a visible label tied to it | |
| AC-8 | Error association | Errors programmatically linked to inputs | |
| AC-9 | Semantic elements | Real buttons, headings in order, tables with headers | |
| AC-10 | Screen reader pass | Status changes and toasts announced | |
| AC-11 | Reduced motion | OS setting on | Animations replaced by instant or fade | |
| AC-12 | Automated audit | Run Lighthouse or axe | No critical violations | |
| AC-13 | Text expansion and RTL values | Long text and Urdu values | Layout holds | |

---

## 25. Performance

| ID | Test | Expected | Result |
|---|---|---|---|
| PE-1 | Local save feel | Under about 100 ms perceived | |
| PE-2 | Sync of a small batch | A few seconds after connectivity returns | |
| PE-3 | First load on slow 4G (DevTools throttling) | Usable quickly; skeletons, not blank | |
| PE-4 | Large outbox (100 ops) | UI stays responsive | |
| PE-5 | Large history | Loads progressively | |
| PE-6 | No layout shift on badge changes | Space reserved | |
| PE-7 | Animation smoothness | No jank on a mid-range phone | |
| PE-8 | Bundle size | Reasonable; check the build output | |
| PE-9 | Memory | No growth after long use (leak check) | |
| PE-10 | Server resource use | Within limits during normal and chaos use | |

---

## 26. Security

| ID | Test | Expected | Result |
|---|---|---|---|
| SE-1 | SQL injection in every text field and query param (`' OR '1'='1`, `'; DROP TABLE students;--`) | Treated as data; nothing breaks | |
| SE-2 | XSS payloads in names, remarks, address (`<img src=x onerror=alert(1)>`) | Rendered as text; no script runs, including in history and conflict views | |
| SE-3 | Authorization on every endpoint | Checked server-side (section 3.2) | |
| SE-4 | IDOR: change IDs in URLs and payloads | Denied | |
| SE-5 | Cookie security | httpOnly, Secure, SameSite | |
| SE-6 | CSRF | A cross-site form post or fetch can't perform actions | |
| SE-7 | Error leakage | No stack traces, SQL, or file paths in responses | |
| SE-8 | Secrets | None in the repo, client bundle, or logs | |
| SE-9 | Demo endpoints | Disabled when demo mode is off | |
| SE-10 | Rate limiting on login (if present) | Repeated failures slowed | |
| SE-11 | HTTPS | Valid certificate; HTTP redirects to HTTPS | |
| SE-12 | Headers | Reasonable security headers present | |
| SE-13 | Database exposure | Not reachable from outside the host/network | |
| SE-14 | Dependency audit | `npm audit` shows no critical known vulnerabilities (or documented) | |

---

## 27. Deployment

### 27.1 Local (judge) run
| ID | Test | Expected | Result |
|---|---|---|---|
| DP-1 | **Fresh clone, on a machine that never ran the project** (Asad's or Ameen's laptop) | `docker compose up` works with only the run guide | |
| DP-2 | Works on Windows, Mac and Linux (at least two) | Same result | |
| DP-3 | Works on x86 and ARM | Images support both (or documented) | |
| DP-4 | `.env.example` complete | Copy to `.env` is enough | |
| DP-5 | Seed runs automatically | Demo accounts and data present | |
| DP-6 | Port conflicts | Documented port; clear failure if taken | |
| DP-7 | Stop and restart | Data persists; app comes back | |
| DP-8 | Teardown | `docker compose down -v` leaves a clean state | |
| DP-9 | Time to first run | Under about 5 minutes including image pulls | |
| DP-10 | Run guide accuracy | Every step and URL works as written; length 40 to 4000 characters | |

### 27.2 Oracle server
| ID | Test | Expected | Result |
|---|---|---|---|
| DP-11 | Hostname resolves | DNS A record correct | |
| DP-12 | HTTPS valid | Certificate issued; no warnings | |
| DP-13 | Routing | Traefik routes to our container; other apps unaffected | |
| DP-14 | Existing apps unaffected | Audrio and other live services still healthy | |
| DP-15 | Resource limits applied | `docker stats` shows limits and healthy usage | |
| DP-16 | Restart policy | Kill the container; it returns automatically | |
| DP-17 | Server reboot | Everything returns without manual steps | |
| DP-18 | Healthchecks | Marked healthy | |
| DP-19 | Service worker/offline on the live URL | Works over HTTPS | |
| DP-20 | SSE on the live URL | Works through the proxy | |
| DP-21 | Reset script on the server | `reset-demo.sh` works in seconds | |
| DP-22 | Backup script | Produces a usable dump | |
| DP-23 | Logs | Readable; no secrets | |

### 27.3 Fallback
| ID | Test | Expected | Result |
|---|---|---|---|
| DP-24 | Fallback deployment live | Works with the same demo data | |
| DP-25 | Failover drill | Stop the primary; switch to the fallback quickly | |

---

## 28. Demo Journey Rehearsal (Requirements section 10)

Run the full journey **three times from a clean reset**. All three runs must give the same result.

| Step | Action | Expected | Run 1 | Run 2 | Run 3 |
|---|---|---|---|---|---|
| 1 | Setup: record exists on student and admin devices | Both show the same data | | | |
| 2 | Student offline: edit phone and address | Both fields Pending | | | |
| 3 | Admin online (other campus): edit address and program | Accepted immediately | | | |
| 4 | Student reconnects with "Lose next response" on | Server saved; retry; **no duplicate** | | | |
| 5 | Auto-merge | Phone and program both present, no action needed | | | |
| 6 | Conflict on address | Both values shown; student resolves | | | |
| 7 | Second campus creates the same student | Blocked; offered to open the existing record | | | |
| 8 | History | Timeline shows every step with actor and time | | | |
| 9 | Admin restores an earlier value | New history entry | | | |
| 10 | Integrity check | **All checks pass** | | | |

Also record: total time for the journey, any hesitation or confusing moment, any visual glitch.

---

## 29. Regression and Release Gates

| ID | Gate | When | Result |
|---|---|---|---|
| RG-1 | Smoke test (section 2) | After every merge to `main` | |
| RG-2 | Automated test suite | Every PR | |
| RG-3 | Behavior matrix (section 15) | Daily after the core works, and at freeze | |
| RG-4 | Invariants (section 16) | After the matrix and after chaos | |
| RG-5 | Chaos test (section 19) | Before every tag | |
| RG-6 | Demo journey ×3 (section 28) | Before freeze and on submission morning | |
| RG-7 | Fresh clone run (section 27.1) | Before submission, on someone else's machine | |
| RG-8 | Repo and submission checklist (section 30) | Submission morning | |

**When a bug is fixed:** re-run the failing test, then the smoke test, then the related section. Add a regression test so it cannot return.

---

## 30. Repo and Submission Readiness

| ID | Check | Result |
|---|---|---|
| SB-1 | Repo is public (verify in a private window) | |
| SB-2 | README: problem, screenshots or GIF, features, tech, run guide, demo accounts, scaling and limits, doc links | |
| SB-3 | `/docs` contains Requirements, Architecture, Design-Spec, demo script, test results | |
| SB-4 | No secrets in the repo or history | |
| SB-5 | `.env.example` present | |
| SB-6 | Tag `v1.0-submission` on the final commit | |
| SB-7 | Demo video public; opens in a private window; clear audio; follows the journey | |
| SB-8 | Run guide pasted in the form: 40 to 4000 characters, tested | |
| SB-9 | Team name selected correctly on the form | |
| SB-10 | All links open without a login | |
| SB-11 | Submitted early, with confirmation saved | |

---

## 31. Bug Report Template

```
ID:            BUG-###
Title:         <short, specific>
Severity:      S1 / S2 / S3 / S4
Found in test: <test ID>
Build/commit:  <hash>
Environment:   <local / Oracle / browser / device>
Steps:
  1.
  2.
  3.
Expected:
Actual:
Evidence:      <screenshot, video, console log, server log, DB rows>
Reproducible:  Always / Sometimes / Once
Notes:
```

### Bug log
| ID | Title | Severity | Test | Status | Owner | Fixed in |
|---|---|---|---|---|---|---|
| | | | | | | |

---

## 32. Results Summary (fill after each run)

| Field | Value |
|---|---|
| Date / time | |
| Build / commit | |
| Tester(s) | |
| Environment | |

| Section | Total | Pass | Fail | Blocked | N/A |
|---|---|---|---|---|---|
| 1 Pre-flight | | | | | |
| 2 Smoke | | | | | |
| 3 Auth and roles | | | | | |
| 4 Validation | | | | | |
| 5 Core edit | | | | | |
| 6 Offline | | | | | |
| 7 Sync engine | | | | | |
| 8 Idempotency | | | | | |
| 9 Conflicts | | | | | |
| 10 Duplicates | | | | | |
| 11 History and restore | | | | | |
| 12 Integrity checker | | | | | |
| 13 Live updates | | | | | |
| 14 Simulator | | | | | |
| 15 Behavior matrix | | | | | |
| 16 Invariants | | | | | |
| 17 API | | | | | |
| 18 Database | | | | | |
| 19 Chaos | | | | | |
| 20 UI states | | | | | |
| 21 Notifications | | | | | |
| 22 Copy | | | | | |
| 23 Responsive/PWA | | | | | |
| 24 Accessibility | | | | | |
| 25 Performance | | | | | |
| 26 Security | | | | | |
| 27 Deployment | | | | | |
| 28 Demo journey | | | | | |
| 30 Submission | | | | | |

### Exit criteria (ready to submit only when all are true)
- [ ] Zero open S1 and S2 bugs
- [ ] All 17 behavior matrix rows pass
- [ ] All 7 invariants hold
- [ ] Integrity checker passes **and** is proven able to fail (IC-4 to IC-9)
- [ ] Chaos test: 0 violations across 5 runs
- [ ] Demo journey passes 3 times in a row from a clean reset
- [ ] Fresh clone run works on a machine that never ran the project
- [ ] No secrets in the repo or history
- [ ] Video, run guide and repo link tested in a private window

### Suggested execution order (about 1 day of focused testing)
1. Section 1 (pre-flight) then Section 2 (smoke)
2. Sections 3 to 5 (auth, validation, core edit)
3. Sections 6 to 8 (offline, sync, idempotency): the highest-risk area
4. Sections 9 to 11 (conflicts, duplicates, history)
5. Sections 12, 15, 16, 19 (integrity, matrix, invariants, chaos)
6. Sections 17, 18, 26 (API, database, security)
7. Sections 13, 14, 20 to 25 (live updates, simulator, UI, copy, responsive, accessibility, performance)
8. Section 27 (deployment), then Section 28 (demo ×3), then Section 30 (submission)
