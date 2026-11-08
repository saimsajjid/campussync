# CampusSync: Requirements & Expected Behavior

**Event:** Build for Campus 2026 (Timetablr x GDGoC PAF-IAST)
**Team:** CrackHacks
**Challenge:** HS-0146 (Expert): *A University With Several Campuses: the same information is re-entered in multiple places*
**Document scope:** WHAT the system must do and HOW it must behave. This document deliberately says nothing about technology choices, visual design, or UX styling. Those are decided elsewhere and must not change anything stated here.

---

## 1. Purpose

Build a dependable shared workflow for students, faculty, and administrative staff of a university with several campuses. Today the same information is entered in multiple places and drifts out of sync. The system must make one shared record the single source of truth, remain usable with no internet connection, and stay **correct** after failures.

**The system is judged on one thing above all:** completing an end-to-end user journey under realistic failure conditions and proving that records remain correct.

---

## 2. Guiding Principles (Non-Negotiable)

1. **The server is the source of truth.** A client may be offline, stale, retrying, or wrong. The server decides what is true.
2. **No silent data loss.** No user edit may disappear without the user being told.
3. **No duplicates, ever.** Retrying an action any number of times must not create duplicate records or apply an edit twice.
4. **Everything is traceable.** Every change is recorded: who, what, when, from where, and what it replaced.
5. **Failures are expected, not exceptional.** Every feature must define what happens when the network drops, a request is lost, or two people edit at once.
6. **Correctness over features.** A small, provably correct system beats a large, fragile one.

---

## 3. Context

- A university with **several campuses**. Users at different campuses may work on the same records.
- Users have **unreliable connectivity** (travel, poor campus networks, power cuts).
- The same information is currently **re-entered in several places** and becomes inconsistent.

---

## 4. Users and Roles

| Role | Who | Primary goal |
|---|---|---|
| **Student** | Enrolled student | Keep own personal and course information accurate |
| **Faculty** | Teaching staff | Maintain academic data about their students/courses |
| **Admin** | Administrative staff (any campus) | Maintain official records, approve changes, resolve problems |

### 4.1 Permissions

| Capability | Student | Faculty | Admin |
|---|---|---|---|
| View own record | Yes | n/a | Yes |
| View records of students on their own campus | No | Yes | Yes (all campuses) |
| Edit personal/contact fields (phone, email, address, emergency contact) | Yes (own record) | No | Yes |
| Edit academic fields (attendance, remarks) | No | Yes (own campus) | Yes |
| Edit official fields (name, program, campus, semester, status, identity) | No | No | Yes |
| View full history of a record | Own record only | Records they can view | All |
| Restore a previous version | No | No | Yes |
| Resolve a conflict | On own edits | On own edits | Any |
| Run integrity check | No | No | Yes |
| Use failure simulator | Demo mode only | Demo mode only | Demo mode only |

**Design note:** students and admins can both edit personal/contact fields on purpose. That overlap is what produces realistic cross-campus conflicts in the demo. Faculty and admin overlap on academic fields for the same reason.

Permissions are enforced by the **server**, never trusted from the client.

---

## 5. Core Data

### 5.1 Primary entity: Student Record

One record per student, shared across all campuses and roles.

**Final field list (locked).** All fields are flat single values. No nested lists or sub-records, to keep conflict and history logic simple and provable.

| Field | Group | Validation rule | Unique | Editable by |
|---|---|---|---|---|
| Registration number | Identity | Required, fixed format (e.g. `CS-2026-0147`) | Yes | Admin |
| National ID (CNIC) | Identity | Required, 13 digits | Yes | Admin |
| Full name | Official | Required, 2-80 chars | No | Admin |
| Program | Official | Required, one of a fixed list (e.g. BS CS, BS SE, BS EE) | No | Admin |
| Campus | Official | Required, one of a fixed list (3 seeded campuses) | No | Admin |
| Semester | Official | Required, integer 1-8 | No | Admin |
| Enrollment status | Official | Required, one of: Active, On leave, Graduated | No | Admin |
| Phone | Personal/contact | Required, valid Pakistani mobile format | No | Student, Admin |
| Email | Personal/contact | Required, valid email format | No | Student, Admin |
| Address | Personal/contact | Required, 5-200 chars | No | Student, Admin |
| Emergency contact | Personal/contact | Required, name + valid phone | No | Student, Admin |
| Attendance (%) | Academic | Required, number 0-100 | No | Faculty, Admin |
| Faculty remarks | Academic | Optional, up to 500 chars | No | Faculty, Admin |
| System metadata | System | Record ID, version, created/updated time, last editor | n/a | System only |

**Cross-field rule (to showcase server validation):** a student whose status is *Graduated* must have semester 8; the server rejects any edit that breaks this, even if the device allowed it.

### 5.2 Record rules

- Every record has a **globally unique ID generated at creation time on the device**, so records created offline can never collide.
- Every record has a **version number** that increases by one with every accepted change.
- **Conflict and history tracking are per field**, not per record. Two edits to *different* fields of the same record are not a conflict.
- Records are **never hard-deleted**. "Delete" means mark inactive, with history preserved.

---

## 6. Functional Requirements

Priority: **M** = Must (project fails without it), **S** = Should, **C** = Could.

### FR-1 Authentication and Roles (M)
- FR-1.1 Users sign in and are identified as exactly one role.
- FR-1.2 Every request is authorized by role and ownership on the server.
- FR-1.3 A user can only see and change what their role permits.
- FR-1.4 For the demo, seeded accounts exist for each role and campus.

**Acceptance:** A student cannot read another student's record or edit an official field, even by sending the request manually.

### FR-2 View and Edit Records (M)
- FR-2.1 A user can open a record they are permitted to see.
- FR-2.2 A user can edit permitted fields and save.
- FR-2.3 Each field shows its **sync state**: *saved locally (pending)*, *synced*, *conflict*, or *rejected*.
- FR-2.4 The app works the same way whether online or offline. Saving always succeeds locally first.

### FR-3 Validation (M)
- FR-3.1 Every field has validation rules (format, required, length, allowed values, cross-field rules).
- FR-3.2 Validation runs immediately on the device for fast feedback.
- FR-3.3 The **server re-validates every change** regardless of what the device claims.
- FR-3.4 If the server rejects an edit that passed on the device, the user is told which field and why, and the edit is preserved so they can fix it. It is not lost.
- FR-3.5 Uniqueness rules (e.g., registration number) are enforced by the server.

**Acceptance:** Submitting an invalid phone number offline is flagged instantly. A forged invalid value sent directly to the server is rejected with a clear reason.

### FR-4 Offline-First Capture (M)
- FR-4.1 With no internet connection, a user can still open previously loaded records and make edits.
- FR-4.2 Every edit is stored on the device immediately and queued for delivery.
- FR-4.3 Queued edits survive closing the app, refreshing, or restarting the device.
- FR-4.4 Queued edits are delivered **in the order they were made**.
- FR-4.5 The user can always see: online/offline status, number of pending edits, and time of last successful sync.
- FR-4.6 New records can be created offline (see FR-6 for duplicate handling).

**Acceptance:** Edit while offline, close the app fully, reopen offline: the edit is still shown as pending. Reconnect: it syncs without user action.

### FR-5 Synchronization / Eventual Consistency (M)
- FR-5.1 When connectivity returns, pending edits are sent automatically.
- FR-5.2 The device also receives changes made by others since its last sync.
- FR-5.3 After sync completes, every device and the server show **identical data** for the same record (eventual consistency).
- FR-5.4 Each queued edit has a unique **operation ID**. The server records processed operation IDs.
- FR-5.5 Sending the same operation again (retry, double-click, lost response) is **recognized and not applied twice**. The server returns the original outcome.
- FR-5.6 A partially failed batch is safe: each edit is accepted, duplicate, conflicting, or rejected individually, and the rest proceed.
- FR-5.7 Failed deliveries retry automatically with increasing delay, and stop being retried only for permanent rejections.
- FR-5.8 Every accepted change is applied **atomically**: the new value, the history entry, and the operation-ID record are saved together, or none of them are.

**Acceptance:** Kill the connection after the server has saved an edit but before the device receives confirmation. The device retries. The record shows exactly **one** change, not two.

### FR-6 Duplicate Prevention (M)
- FR-6.1 Operation-level: no edit is ever applied twice (FR-5.5).
- FR-6.2 Record-level: two campuses creating the "same" student (same registration number or national ID) must not result in two records.
- FR-6.3 When a potential duplicate is detected, the user is informed and offered: link to the existing record, or cancel. Nothing is silently merged or silently dropped.
- FR-6.4 Records created offline on two devices for the same real-world student are detected as duplicates on sync and flagged for resolution.

**Acceptance:** Two devices offline each create a student with the same registration number. After both sync, there is one record plus a visible duplicate-resolution item.

### FR-7 Conflict Detection (M)
- FR-7.1 Every edit carries the record/field version it was based on.
- FR-7.2 If the server's current version differs from the version an edit was based on **and the same field was changed**, it is a **conflict**.
- FR-7.3 Edits to **different fields** of the same record, made from the same base version, are **merged automatically** with no user action.
- FR-7.4 A conflicting edit is **never applied silently and never discarded**. It is held and presented for resolution.
- FR-7.5 The record remains usable while a conflict is pending. The server's current value stays authoritative until resolved.

**Acceptance:** Student (offline) changes phone + address; admin (online) changes address + program. After sync, phone and program are updated automatically; only address is flagged as a conflict.

### FR-8 Conflict Resolution (M)
- FR-8.1 For each conflicting field, the user sees: their value, the other value, who changed it, and when.
- FR-8.2 The user can choose: keep mine, keep theirs, or enter a new value.
- FR-8.3 The chosen resolution is applied as a **new versioned change** and recorded in history, including that it was a conflict resolution.
- FR-8.4 If the record changes again while the user is resolving, the user is told and shown the updated state. A resolution is never applied against stale data blindly.
- FR-8.5 Role rules apply: an admin may resolve any conflict. Others resolve only conflicts on their own edits.

### FR-9 History and Audit (M)
- FR-9.1 Every accepted change creates a permanent history entry containing: record, field, old value, new value, who, role, campus/device, timestamp, operation ID, and type (edit, merge, conflict resolution, restore, create).
- FR-9.2 History is **append-only**. Entries cannot be edited or deleted by any role.
- FR-9.3 A user can view the history of any record they are allowed to see, in time order.
- FR-9.4 Replaying history from the start must reproduce the record's current state exactly (see invariants, section 8).

### FR-10 Restore / Recovery (M)
- FR-10.1 An admin can restore any field or the whole record to a previous point in its history.
- FR-10.2 Restore creates a **new** history entry. It never rewrites or removes the past.
- FR-10.3 Restore is subject to the same validation and conflict rules as any edit.
- FR-10.4 A user can see **stuck or failed operations** on their device with the reason, and can: retry, edit and resubmit, or discard (with confirmation and a history note that it was discarded by the user).
- FR-10.5 No failure state is a dead end. Every failure shows the user a way forward.

### FR-11 Integrity Verification (M)
- FR-11.1 An admin can run an integrity check on demand.
- FR-11.2 The check verifies at least:
  - no duplicate record IDs or duplicate unique identifiers
  - no operation ID applied more than once
  - every record's current state equals the replay of its history
  - every record's version equals its number of accepted changes
  - no history entry references a missing record
  - no pending operation is orphaned or silently lost
- FR-11.3 The result is a clear pass/fail per check, with details of any violation.

**This is the project's proof of correctness.** It must be runnable live during the demo.

### FR-12 Live Updates (S)
- FR-12.1 When another user's change is accepted, connected devices show it without a manual refresh.
- FR-12.2 If a device is viewing a record that changes underneath it, the user is told rather than overwritten.

### FR-13 Failure Simulation for Demo (M)
Because the success criterion is correctness under failure, the system must be able to **reproduce failures on demand**:
- FR-13.1 Force a device offline/online.
- FR-13.2 Simulate slow or lossy connection.
- FR-13.3 Simulate **response lost after the server committed** (the classic duplicate trap).
- FR-13.4 Simulate **request lost before reaching the server**.
- FR-13.5 Simulate a **second device/user** editing the same record concurrently.
- FR-13.6 Reset all demo data to a known clean state in one action.
- FR-13.7 Simulation controls must never be reachable in a normal production role flow. They are demo-mode only.

### FR-14 Notifications and Status Visibility (S)
- FR-14.1 The user is always able to tell whether their data is safe: pending, synced, conflicted, or failed.
- FR-14.2 Significant outcomes (conflict found, edit rejected, duplicate detected, sync complete) are communicated clearly, not silently.

### FR-15 Search and Lookup (C)
- FR-15.1 Faculty and admin can find a record by registration number or name.
- FR-15.2 Admin can filter by campus.

---

## 7. Expected Behavior Under Failure (Behavior Matrix)

This is the core specification. Each row must be true and demonstrable.

| # | Scenario | Expected behavior |
|---|---|---|
| 1 | User edits while offline | Edit saved locally, marked pending, no error shown for being offline |
| 2 | App closed/restarted with pending edits | Pending edits still present and still queued |
| 3 | Connection returns | Pending edits sent automatically, in original order, status moves to synced |
| 4 | Response lost after server saved the edit | Device retries; server recognizes the operation ID; record changed **once**; device shown as synced |
| 5 | Request lost before reaching server | Device retries; server applies it once |
| 6 | User double-submits the same action | Applied once |
| 7 | Two users edit the same field concurrently | Conflict raised; neither edit silently lost; resolution flow offered |
| 8 | Two users edit different fields concurrently | Both applied automatically; no user action |
| 9 | Edit passes device validation but fails server validation | Edit preserved and flagged with field and reason; user can fix and resubmit |
| 10 | Unauthorized edit attempted | Rejected by server; user informed; nothing changed |
| 11 | Two campuses create the same student offline | One record after sync plus a visible duplicate item for resolution |
| 12 | Record changed while user is mid-resolution | User told; shown updated state; resolution not applied blindly |
| 13 | Admin restores an earlier version | New history entry created; past untouched; record shows restored value |
| 14 | A queued operation is permanently rejected | Appears in recovery view with reason and options; never silently dropped |
| 15 | Batch of edits where one fails | The others still succeed; the failure is reported individually |
| 16 | Server temporarily unavailable | Device keeps working offline, retries with backoff, no data loss |
| 17 | Integrity check run after all the above | All checks pass |

---

## 8. Data Correctness Invariants

These must hold **at all times**, and the integrity check must be able to prove them:

1. **Exactly-once:** every operation ID is applied at most once.
2. **Uniqueness:** no two records share a record ID, registration number, or national ID.
3. **Replayability:** replaying a record's history from creation yields its current state.
4. **Version integrity:** a record's version equals its count of accepted changes.
5. **No lost edits:** every edit a user made is in exactly one of: applied, pending, conflicted, rejected-with-reason, or discarded-by-user (recorded). Never "vanished".
6. **Append-only history:** history entries are never modified or removed.
7. **Convergence:** once all devices have synced and no edits are pending, all devices and the server hold identical data.

---

## 9. Non-Functional Requirements

### 9.1 Reliability
- NFR-1 No failure in section 7 may result in data loss, duplication, or corruption.
- NFR-2 The system must recover from restart/crash of server or device without manual repair.

### 9.2 Performance (targets for a demo-sized dataset)
- NFR-3 Local save feels instant (under 100 ms perceived).
- NFR-4 A typical sync of a small batch completes within a few seconds of connectivity returning.
- NFR-5 Integrity check on demo data completes within a few seconds.

### 9.3 Security
- NFR-6 All authorization is enforced server-side.
- NFR-7 All traffic is encrypted in transit.
- NFR-8 Credentials and secrets are never exposed to clients or stored in source control.
- NFR-9 Users cannot read or modify data outside their role's permissions.

### 9.3 Availability for Judging
- NFR-10 The system is reachable by judges through a public link for the whole judging period.
- NFR-11 A fallback deployment exists in case the primary becomes unavailable.
- NFR-12 No installation is required for judges to use it.

### 9.4 Demo Readiness
- NFR-13 Seed data covers multiple campuses, all three roles, and pre-arranged conflict and duplicate scenarios.
- NFR-14 One action resets the system to the seeded state in seconds.
- NFR-15 The full demo journey (section 10) can be run repeatedly with the same result.

### 9.5 Usability (behavioral, not visual)
- NFR-16 A user is never left unsure whether their data is saved.
- NFR-17 Every error states what happened and what the user can do next.
- NFR-18 Conflict resolution is understandable by a non-technical administrator.

---

## 10. The Demonstration Journey

The system must support this single end-to-end story, repeatably:

1. **Setup:** a student record exists with data across fields. A student device and an admin device (different campus) both hold the record.
2. **Offline edit:** the student goes offline and edits phone and address. Both show as *pending*.
3. **Concurrent edit:** the admin, online at another campus, edits address and program. These are accepted immediately.
4. **Lost response:** the student reconnects; the server saves the edit but the response is lost. The device retries. **No duplicate is created.**
5. **Auto-merge:** phone and program changes are both present with no user action.
6. **Conflict:** the address (changed by both) is flagged. The student sees both values and resolves it.
7. **Duplicate prevention:** a second campus tries to create the same student; the system blocks the duplicate and offers to link.
8. **History:** the record's timeline shows every step: who, what, when, including the resolution.
9. **Recovery:** an admin restores an earlier value; a new history entry appears.
10. **Proof:** the admin runs the integrity check. **All checks pass.**

---

## 11. Priorities and Cut Order

If time runs short, cut from the bottom. Never cut a Must.

**Must (the project):** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-13, all section 8 invariants, the section 10 journey.

**Should:** FR-12 (live updates), FR-14 (rich notifications), NFR-11 (fallback deployment).

**Could (cut first):** FR-15 (search/filter), extra record fields, multiple record types.

**Build order (thin slice first):** edit and save, then version check and conflict, then offline queue and idempotency, then history and restore, then integrity check, then simulator, then polish.

---

## 12. Out of Scope

- Entities beyond the student record (fees, timetables, exams, grades, library)
- Payments, messaging, file/document uploads
- Real integration with existing university systems
- Production-grade identity (SSO, password recovery, MFA)
- Multi-language support, accessibility certification, analytics
- Mobile-native app stores or installers

---

## 13. Definition of Done

The project is done when:

1. Every Must requirement passes its acceptance criteria.
2. All 17 rows of the behavior matrix (section 7) are demonstrated and pass.
3. All 7 invariants (section 8) hold, proven by the live integrity check.
4. The section 10 journey runs end to end, repeatedly, from a clean reset.
5. The system is reachable by judges through a public link.
6. A teammate who did not build it can run the demo from a written script.

---

## 14. Decisions Made and Open Items

**Decided (hackathon scope, optimized for demo strength, not real-world completeness):**
- Single entity: the student record, with the locked field list in section 5
- Flat fields only, no nested data
- Permissions as in section 4.1, with deliberate role overlap to create natural conflicts
- Faculty scope is by campus, not by course
- No student "change request" workflow
- Identity validation uses Pakistani formats (CNIC, mobile numbers) for local realism

**Open (only the team can check these):**
- Build window and submission deadline (event WhatsApp group)
- Whether the submission requires a video, repository link, or live demo link
- Any judging rubric published by organizers
