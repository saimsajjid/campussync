# Design Spec: UI, UX, States, Notifications & Content

**Product name:** CampusSync  
**Companion docs:** `CampusSync-Requirements.md` (what the system does), `CampusSync-Architecture.md` (how it is built).  
**Scope of this document:** how the product looks, behaves, and *speaks*. Tokens have been locked in with production-grade values below.

**Rule for implementers:** never hard-code a color, font size, spacing value, radius, or duration inside a component. Always reference a token. If a token you need does not exist, add it to the token file and document it here.

---

## 1. Product Character

This is a **management tool** used by students, faculty, and administrators to keep records correct. It must feel:

- **Calm.** No visual noise, no urgency theater.
- **Trustworthy.** The user should never wonder whether their data is safe.
- **Precise.** Real values, real timestamps, real names. No vague copy.
- **Quiet and fast.** Motion confirms actions; it does not decorate.

It must **not** feel like a startup landing page, a marketing site, or a template.

---

## 2. Design Principles (in priority order)

1. **Data safety is always visible.** At any moment the user can tell: is this saved, is it synced, is anything wrong.
2. **Nothing is a dead end.** Every error, conflict, and failure state shows a next action.
3. **Honest status over pretty status.** Never show "synced" before the server confirmed it.
4. **One primary action per screen.** Make it obvious and put it in a consistent place.
5. **Plain language.** Write the way a competent colleague would explain it (see section 12).
6. **Consistency beats cleverness.** Same pattern for the same situation everywhere.
7. **Motion has a job.** Each animation communicates a state change, or it is removed.

---

## 3. Design Tokens (values to be filled in later)

All tokens are **semantic** (named by role, not by color). Implement as CSS custom properties.

### 3.1 Color roles

| Token | Role | Locked Value |
|---|---|---|
| `--color-bg` | Page background | `#F8FAFC` (slate-50) |
| `--color-surface` | Cards, panels, inputs | `#FFFFFF` (white) |
| `--color-surface-raised` | Popovers, dialogs, toasts | `#FFFFFF` (white, shadow-3) |
| `--color-surface-sunken` | Table headers, code/ID chips, disabled fields | `#F1F5F9` (slate-100) |
| `--color-border` | Default borders and dividers | `#E2E8F0` (slate-200) |
| `--color-border-strong` | Input borders, focused-adjacent elements | `#CBD5E1` (slate-300) |
| `--color-text` | Primary text | `#0F172A` (slate-900) |
| `--color-text-secondary` | Supporting text | `#475569` (slate-600) |
| `--color-text-muted` | Hints, placeholders, timestamps | `#64748B` (slate-500) |
| `--color-text-on-brand` | Text on brand-colored surfaces | `#FFFFFF` (white) |
| `--color-brand` | Primary actions, links, focus accents | `#2563EB` (blue-600) |
| `--color-brand-hover` | Hover state of brand | `#1D4ED8` (blue-700) |
| `--color-brand-active` | Active/pressed state of brand | `#1E40AF` (blue-800) |
| `--color-brand-subtle` | Tinted backgrounds for selected/active items | `#EFF6FF` (blue-50) |
| `--color-focus-ring` | Keyboard focus outline | `#3B82F6` (blue-500, 2px outline) |

### 3.2 Status color roles (each has `-fg`, `-bg`, `-border` variants)

| Token family | Meaning | Foreground (`-fg`) | Background (`-bg`) | Border (`-border`) |
|---|---|---|---|---|
| `--status-synced` | Confirmed by the server | `#047857` (emerald-700) | `#ECFDF5` (emerald-50) | `#A7F3D0` (emerald-200) |
| `--status-pending` | Saved locally, not yet confirmed | `#B45309` (amber-700) | `#FFFBEB` (amber-50) | `#FDE68A` (amber-200) |
| `--status-syncing` | Currently being sent | `#0369A1` (sky-700) | `#F0F9FF` (sky-50) | `#BAE6FD` (sky-200) |
| `--status-conflict` | Needs a human decision | `#B91C1C` (red-700) | `#FEF2F2` (red-50) | `#FECACA` (red-200) |
| `--status-rejected` | Server refused the change | `#9F1239` (rose-800) | `#FFF1F2` (rose-50) | `#FECDD3` (rose-200) |
| `--status-offline` | No connection | `#475569` (slate-600) | `#F8FAFC` (slate-50) | `#CBD5E1` (slate-300) |
| `--status-info` | Neutral information | `#1D4ED8` (blue-700) | `#EFF6FF` (blue-50) | `#BFDBFE` (blue-200) |

**Constraints & Verification:**
- High contrast: Text foreground on background exceeds WCAG AA (4.5:1).
- Distinct: Conflict (`#B91C1C` Red) vs Pending (`#B45309` Amber) are easily differentiated.
- Non-color cues: Every badge combines color with a distinctive SVG icon and text label.

### 3.3 Typography tokens

| Token | Spec | Family |
|---|---|---|
| `--font-ui` | Primary UI sans-serif, self-hosted WOFF2 | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` |
| `--font-mono` | Monospace, self-hosted WOFF2, for IDs, versions, diffs | `'JetBrains Mono', ui-monospace, SFMono-Regular, monospace` |
| Fonts are **self-hosted and cached in Service Worker for 100% offline use**. | | |

**Type scale** (rem; base 16 px):

| Token | Size / line height | Use |
|---|---|---|
| `--text-xs` | 0.75 / 1.0 | Badges, timestamps |
| `--text-sm` | 0.875 / 1.25 | Secondary text, table cells, helper text |
| `--text-base` | 1 / 1.5 | Body, inputs |
| `--text-lg` | 1.125 / 1.5 | Card titles |
| `--text-xl` | 1.25 / 1.75 | Section headings |
| `--text-2xl` | 1.5 / 2 | Page titles |
| `--text-3xl` | 1.875 / 2.25 | Login title only |

Weights: 400 body, 500 labels and buttons, 600 headings. Maximum of **three weights**. Numbers in tables and diffs use tabular figures.

### 3.4 Spacing, shape, elevation, motion

| Token group | Values |
|---|---|
| `--space-1..8` | 4, 8, 12, 16, 24, 32, 48, 64 px |
| `--radius-sm / md / lg / full` | 6, 10, 14, 999 px (adjust once, then keep) |
| `--shadow-1 / 2 / 3` | Three levels only. Subtle. Dialogs/toasts use 3. |
| `--dur-instant / fast / base / slow` | 80, 140, 220, 360 ms |
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` (entering) |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` (leaving) |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` (state changes) |

Use **one icon set** at **one stroke weight** across the whole product. No mixing icon libraries. No emoji as icons.

---

## 4. Status System (the heart of the UI)

Every record field and every queued change is in exactly one of these states.

| State | Icon (concept) | Label | Meaning | Where shown |
|---|---|---|---|---|
| **Synced** | check | Synced | Server has confirmed this value | Field badge (quiet), history, outbox |
| **Pending** | clock | Saved on this device | Stored locally, waiting to send | Field badge, outbox, counter |
| **Syncing** | rotating arrows | Syncing | Being sent now | Field badge, connection pill |
| **Conflict** | branching arrows / two-sided | Needs your decision | Same field changed elsewhere | Field badge, banner, conflict list |
| **Rejected** | circle with exclamation | Not saved | Server refused (validation/permission) | Field badge, inline message, outbox |
| **Offline** | cloud with slash | Offline | No connection | Connection pill, banner |

**Rules**
- **Synced badges are quiet** (small, low-contrast). Attention belongs to problems. Do not make a wall of green checks.
- A field **never shows Synced** until the server's response says `applied` or `duplicate`.
- Badge = icon + short label on desktop; icon with accessible label on narrow screens.
- Status changes are announced to screen readers (section 13).
- A field can have a state **and** a message (e.g., Rejected plus the reason). Always show the reason, not just the state.

---

## 5. Global Shell and Navigation

### 5.1 Persistent elements

| Element | Behavior |
|---|---|
| **Connection pill** (top bar, always visible) | States: Online, Offline, Syncing. Shows pending count and last-synced time on hover/tap: "Last synced 2:14 PM". |
| **Pending counter** | Number of unsent changes. Tapping opens the Sync Center. Hidden when 0. |
| **User menu** | Name, role, campus, sign out. Role is always visible so users know what they can do. |
| **Offline banner** | Appears under the top bar while offline: "You're offline. Changes are saved on this device and will sync later." Dismissible per session, but the pill stays. |
| **Conflict banner** | Appears when open conflicts exist: "2 fields need your decision." with a **Review** button. Persists until resolved. |
| **Demo mode strip** (demo only) | Thin bar: "Demo mode" with reset and simulator shortcuts. Never visible in a non-demo build. |

### 5.2 Navigation

| Viewport | Pattern |
|---|---|
| Mobile (under 768 px) | Bottom tab bar with 4 items: Home, Records (faculty/admin) or My Record (student), Sync, Account |
| Tablet and desktop | Left sidebar, collapsible, same items plus History shortcuts |

Navigation is **role-aware**: students never see links to pages they cannot use.

---

## 6. Pages

For every page: **purpose, roles, layout, content, actions, and all states** (loading, empty, error, offline) are defined. Nothing is left to improvisation.

### 6.1 Login

- **Roles:** all.
- **Purpose:** get the user in quickly.
- **Layout:** single centered card on the page background. Product name (text or logo) above the form. Nothing else.
- **Content:** email field, password field, **Sign in** button.
- **Demo accounts:** in demo mode, show a compact "Demo accounts" list (Student, Faculty, Admin) where one click fills the credentials. Label each with the role and campus.
- **States:**
  - Submitting: button shows a spinner and "Signing in", fields disabled.
  - Wrong credentials: inline message under the form: "Email or password is incorrect." Do not say which one.
  - Offline: "You're offline. Sign in needs a connection the first time." If a valid session exists, skip login and go straight to the app.
- **Avoid:** hero images, marketing copy, social sign-in buttons, "Welcome back!" greetings.

### 6.2 Dashboard (Home)

- **Roles:** all (content differs by role).
- **Purpose:** show data safety at a glance and give a fast route to records.
- **Layout:** page title, a status summary row, then role-specific content.
- **Status summary row** (always first): three compact tiles: Connection (Online/Offline), Pending changes (count), Needs attention (conflicts plus rejected count). Each tile is a link to the relevant place.
- **Student content:** their own record summary card (name, registration number, program, campus, semester, status) with an **Open my record** button; recent activity list (last 5 changes to their record).
- **Faculty/Admin content:** search box (by name or registration number), campus filter (admin only), a results table of records (name, registration number, program, campus, status, last updated, sync state), recent activity across their scope.
- **States:**
  - Loading: skeleton rows matching the final layout (no spinner-only screens).
  - Empty search: "No records match 'xyz'." with a **Clear search** button.
  - First load offline with no cache: dedicated offline page (6.9).
  - Data from cache while offline: normal view plus the offline banner. Show "Showing data saved on this device" near the table header.

### 6.3 Record (view and edit)

- **Roles:** per permission table in the requirements.
- **Purpose:** view and change fields with full clarity about what is saved.
- **Layout:** header (name, registration number, status chip, last updated), then field groups as sections: Identity, Official details, Contact, Academic. A sticky action area on mobile.
- **Each field row contains:** label, value or input, status badge, and a helper/error line. Read-only fields (no permission) show a small lock icon with tooltip "Only admins can change this."
- **Editing behavior:**
  - Edit in place per field, or a section-level edit mode on mobile. Either way, **saving a field always succeeds locally first** and the badge moves to Saved on this device.
  - Validate on blur and on submit. Show the rule that failed, not a generic error.
  - **Never discard what the user typed** when validation fails or the server rejects it.
  - A **History** button in the header opens the history page for this record.
- **Field-level states:** idle, editing, invalid, pending, syncing, synced, conflict, rejected, locked.
- **Conflict state on a field:** badge plus inline line: "Changed elsewhere too." and a **Review** link.
- **Rejected state on a field:** badge plus the reason and two actions: **Edit** and **Discard change**.
- **Page states:**
  - Loading: skeleton fields.
  - Record not found or no access: "You don't have access to this record." with a **Back to home** button. Never reveal whether a record exists to someone without access.
  - Record changed while viewing (live update): a non-blocking notice at the top: "This record was updated by someone else." with **Show changes**. Never overwrite an unsaved edit silently.

### 6.4 Conflict Resolution

- **Roles:** the person who made the conflicting edit; admins for any.
- **Purpose:** let a non-technical person decide, calmly and correctly.
- **Layout:** page title "Review changes" and the record name. One **card per conflicting field**. Desktop: two columns (Yours / Current) inside each card. Mobile: stacked.
- **Each card shows:**
  - Field name.
  - **Your change:** value, plus "Made on this device, 1:58 PM" (or who and where).
  - **Current value:** value, plus "Changed by Admin, North Campus, 2:03 PM".
  - Three choices: **Keep mine**, **Keep current**, **Enter a different value** (reveals an input with the same validation as the field).
  - For long text, a word-level highlight of what differs.
- **Page actions:** **Apply decisions** (disabled until every card has a choice). A secondary **Decide later**.
- **States:**
  - Submitting: button spinner "Applying".
  - **Stale:** if the record changed again while deciding, show an inline notice on the affected card: "The current value changed again. Review the update." and refresh that card. Never apply a decision against data the user has not seen.
  - Success: toast "2 conflicts resolved." and return to the record.
  - Nothing to resolve: "No open conflicts." with a **Back to home** button.
- **Rule:** the user must always be able to see both values **before** choosing. Never preselect a choice.

### 6.5 History

- **Roles:** per permission table.
- **Purpose:** an auditable timeline of everything that happened to a record.
- **Layout:** record header, a filter row (field, type, person, date range), then a vertical timeline, newest first.
- **Each entry shows:** field name, old value to new value, who (name and role), campus, device label, exact date and time, and a **type tag**: Created, Edited, Resolved conflict, Restored. Entries produced by a conflict resolution link to the decision.
- **Actions (admin only):** **Restore this value** on any entry. Opens a confirm dialog (section 8.4).
- **States:**
  - Loading: skeleton entries.
  - Empty: "No changes yet." (for a brand new record).
  - Offline: show cached history with a notice "History may be missing recent changes while you're offline."
  - Long history: group by day; load older entries on demand.
- **Values formatting:** long values truncate with **Show full value**. Empty values display as "(empty)", in muted text, never as blank.

### 6.6 Sync Center

- **Roles:** all (limited sections per role).
- **Purpose:** transparency and recovery. This is where trust is earned.
- **Sections (top to bottom):**
  1. **Connection:** status, last successful sync, a **Sync now** button.
  2. **Outbox:** every unsent change as a list. Each item: record name, field, new value, created time, state (Pending / Syncing / Rejected / Conflict), and actions: **Retry**, **Edit**, **Discard** (with confirm).
  3. **Needs attention:** rejected items and open conflicts, with reasons and a path forward.
  4. **Integrity check** (admin): a **Run check** button and the results list (section 6.6.2).
  5. **Demo controls** (demo mode only): see 6.6.3.
- **States:**
  - Empty outbox: "Everything is saved to the server." with last sync time. No illustration needed.
  - Offline: outbox visible, **Sync now** disabled with the reason "Offline".
  - Retrying: show attempt count and next retry time on the affected item.

#### 6.6.2 Integrity check results
- Run shows each check as a row that resolves in sequence: spinner, then pass or fail, each with a one-line plain description.
- Pass: "All 7 checks passed" at the top, with a timestamp.
- Fail: "2 checks failed", failing rows expanded with the offending record IDs and a **Copy details** button.
- This is the **proof moment** of the product. It gets the most polished animation (section 10).

#### 6.6.3 Demo controls (demo mode only)
- **Network:** Online/Offline toggle, Slow connection toggle, **Lose next response** (server saves, reply is dropped), **Lose next request**.
- **Devices:** a switcher between Device A and Device B (separate local data), or a **split view** showing both side by side on wide screens, each labeled (for example "Student, this phone" and "Admin, North Campus").
- **Actions:** **Inject remote edit** (scripted change from another campus), **Reset demo data**.
- Every control states in one line what it does. Destructive ones (Reset) require confirmation.

### 6.7 Duplicate Record Resolution

- **Trigger:** creating or syncing a student whose registration number or national ID already exists.
- **Presentation:** a full page on mobile, a wide dialog on desktop.
- **Content:** "A record with this registration number already exists." Show both records side by side with matching fields highlighted.
- **Actions:** **Open existing record** (primary), **Cancel creation**. No silent merging.

### 6.8 Access Denied and 404

- Short, factual, with a way out. Example: "This page doesn't exist." / "You don't have access to this page." plus **Back to home**. No jokes, no illustrations.

### 6.9 Offline Fallback

- Shown only when the app is opened offline **and** nothing is cached yet.
- Content: "You're offline and nothing has been saved on this device yet. Connect once to load your data, then it will work offline." plus a **Try again** button.

### 6.10 Admin: Restore Dialog (component, not a page)
- Described in 8.4.

---

## 7. Components (with required states)

| Component | Required states and notes |
|---|---|
| **Button** | Variants: primary, secondary, quiet, destructive. States: default, hover, active, focus, disabled, loading (spinner plus label change, width stays fixed). One primary per view. Minimum 44 px tap target. |
| **Text input** | Default, focus, filled, invalid (message below), disabled, read-only (lock), loading (while validating server-side). Labels above inputs, always visible (no placeholder-as-label). |
| **Select / radio / segmented** | Same state set as inputs. Fixed lists (program, campus, status) use selects. |
| **Field row** | Label, value/input, status badge, helper/error line. The unit the whole record page is built from. |
| **Status badge** | One per status in section 4. Icon plus label. Compact variant (icon only with accessible name). |
| **Connection pill** | Online, Offline, Syncing. Compact. Opens a small popover with details. |
| **Banner** | Persistent, in-flow, full width of content. Variants: info, warning (offline), attention (conflicts). Has an optional action button. |
| **Toast** | See section 8. |
| **Dialog** | Title, one-paragraph body, two actions max. Focus trapped, Esc closes (unless destructive and in flight). |
| **Diff card** | Used on conflict page: two value panels with metadata and highlights. |
| **Timeline entry** | Used on history: type tag, field, old to new, who, when. |
| **Outbox item** | Used in Sync Center: record, field, value, state, actions. |
| **Table** | Sticky header, sortable columns where useful, row hover, keyboard navigable rows. Collapses to stacked cards on mobile. |
| **Skeleton** | Matches the shape of the final content. Used for loading over 300 ms. Never show a skeleton for under 300 ms (avoid flicker). |
| **Empty state** | One line of explanation plus one action if useful. No illustrations required. |
| **Tooltip** | For truncated text, locks, icon-only buttons. Also available on keyboard focus. |
| **Integrity check list** | Rows that animate from pending to pass/fail, with a summary header. |

---

## 8. Notifications: Toasts, Banners, Inline, Dialogs

### 8.1 Which channel for which message

| Situation | Channel | Why |
|---|---|---|
| A single field sync completed | **Nothing** (badge changes) | The badge is the feedback. Toasting every field is noise. |
| A batch of changes finished syncing | Toast (success) | Reassurance after a gap, e.g. after reconnecting |
| User action completed, no page change (restored, resolved, discarded) | Toast (success) | Brief confirmation |
| Validation error on a field | **Inline** under the field | Needs to sit next to the problem |
| Server rejected a change | Inline on the field **and** a toast if the user is on another page | Reason must stay visible |
| Connection lost or regained | Pill plus banner; toast only on **regained** with pending items | Persistent state needs a persistent indicator |
| Conflicts exist | **Banner** (persistent) | Must not disappear |
| Destructive or irreversible action | **Dialog** (confirm) | Needs deliberate confirmation |
| Network error on an explicit user action | Toast (error) with **Retry** | Action may be repeated |
| Record changed under an open view | Inline notice at the top of the view | Context-specific |

**Rule of thumb:** *a toast announces something that happened; a banner reports something that is still true; inline text sits next to what it is about.*

### 8.2 Toast specification

| Property | Spec |
|---|---|
| Placement | Bottom center on mobile (above the tab bar); bottom right on desktop |
| Stack limit | Max 3 visible; extras queue |
| Duration | Success/info: 4 s. Error: 8 s, or until dismissed if it has an action. Hovering or focusing pauses the timer. |
| Dismiss | Always has a close button. Swipe to dismiss on touch. |
| Dedupe | Identical messages within 5 s collapse into one ("3 changes synced"), never three toasts. |
| Types | Success, Info, Warning, Error. Each has an icon and label, not color alone. |
| Content | One sentence, optional single action (**Retry**, **View**, **Undo**). Never two actions. |
| Accessibility | Rendered in an `aria-live` region: `polite` for success/info, `assertive` for error. Never steal focus. |
| Motion | Enter: slide and fade in, `--dur-base`. Exit: fade out, `--dur-fast`. Reduced motion: fade only. |
| Persistence | Toasts are **not** the system of record. Anything the user must not miss also exists in the Sync Center or as a banner. |

### 8.3 Toast message catalogue (use these, do not freestyle)

| Event | Type | Message |
|---|---|---|
| Back online with pending changes | Info | Back online. Syncing 3 changes. |
| Sync finished (batch) | Success | 3 changes synced. |
| Sync finished with issues | Warning | 2 changes synced. 1 needs your attention. [View] |
| Change rejected while elsewhere | Error | Address wasn't saved: it must be at least 5 characters. [View] |
| Conflict detected | Warning | Phone number changed elsewhere too. [Review] |
| Conflicts resolved | Success | 2 conflicts resolved. |
| Value restored | Success | Address restored to the value from 14 Nov, 10:42. |
| Change discarded | Success | Change discarded. [Undo] (Undo available for 8 s only if technically supported; otherwise omit.) |
| Duplicate blocked | Warning | A student with this registration number already exists. [Open record] |
| Retry failed | Error | Still can't reach the server. Will try again in 30 s. |
| Demo data reset | Success | Demo data reset. |
| Session expired | Error | You've been signed out. Sign in to continue. Unsent changes are kept on this device. |

### 8.4 Dialog specification

- Title states the action ("Restore Address?"). Body is one short paragraph stating the consequence. Two buttons: the action (named with a verb) and **Cancel**.
- Destructive actions use the destructive button style. The default focus is **Cancel**.
- Examples:
  - **Restore:** "Restore Address to the value from 14 Nov, 10:42? This adds a new entry to the history. Nothing is deleted."
  - **Discard change:** "Discard this change? It will be removed from this device. The history will note that it was discarded."
  - **Reset demo (demo mode):** "Reset all demo data? Every record returns to its starting state."
  - **Sign out with pending changes:** "You have 3 unsent changes. They stay on this device, but they won't sync until you sign in again."

---

## 9. Forms and Validation UX

1. Validate **on blur** and on submit, never on every keystroke (except for live character counters).
2. Messages name the rule and show an example when it helps: "Phone number must look like 0300 1234567."
3. Show errors **inline under the field**, with an icon, and link to them from a summary if a form has several.
4. **Never clear user input** on error. Never lose an edit because the server rejected it.
5. The same validation rules apply on the device and the server. If the server rejects something the device accepted, show the server's reason on the field and keep the change in the outbox.
6. Required fields are marked in the label text ("(required)"), not only with an asterisk.
7. Use native input types and input modes (numeric keypad for numbers, tel for phone, email keyboards).
8. Disable submit only when truly impossible to proceed; otherwise let the user submit and explain what is missing.
9. Dates and numbers follow the formats in section 12.5.

---

## 10. Motion and Animation

### 10.1 Rules
- Every animation answers: **what state changed?** If it does not communicate that, remove it.
- Animate **opacity and transform only** (no layout-thrashing properties). Target 60 fps on a mid-range phone.
- Respect `prefers-reduced-motion`: replace movement with instant changes or short fades. No exceptions.
- Never block interaction on an animation.
- The default is **no animation**. Add only the ones listed below.

### 10.2 Approved animations (this is the complete list)

| # | Moment | Motion | Duration |
|---|---|---|---|
| 1 | Field status change (Pending to Synced) | Badge cross-fades; checkmark draws in | `--dur-base` |
| 2 | Connection state change | Pill color and icon cross-fade; counter ticks | `--dur-base` |
| 3 | Syncing | Subtle rotating icon in pill and badges while active | continuous, stops on completion |
| 4 | Conflict appears | Banner slides down; the conflicting field gets a brief highlight | `--dur-base` |
| 5 | Conflict resolved | Chosen value moves into the field; badge changes to Synced | `--dur-slow` |
| 6 | New history entry | Fades and slides in from the top; brief highlight that fades out | `--dur-base` then 1.2 s highlight fade |
| 7 | Toasts, dialogs, popovers | Fade plus small translate | `--dur-base` in, `--dur-fast` out |
| 8 | Page transitions | Short fade only | `--dur-fast` |
| 9 | **Integrity check (hero moment)** | Rows resolve one by one (about 250 ms apart): spinner to check; on full pass, the summary header confirms with a brief scale-in and the product mark (or a check) settles | total under 3 s |
| 10 | Skeleton to content | Cross-fade | `--dur-fast` |

Anything not in this table does not animate. Implementation may use CSS transitions or a small animation library, as long as the rules above hold and bundle size stays small.

---

## 11. Responsive Layout and Accessibility

### 11.1 Breakpoints
| Name | Width | Layout |
|---|---|---|
| Mobile | under 768 px | Single column, bottom tab bar, stacked cards. **Design here first.** |
| Tablet | 768 to 1199 px | Sidebar collapsed to icons, two-column where useful |
| Desktop | 1200 px and up | Full sidebar, two-column conflict view, split two-device view in the Sync Center |

- Content max width about 1100 px, centered.
- No horizontal page scroll at any width. Tables become stacked cards on mobile.
- Tap targets at least 44 by 44 px.

### 11.2 Accessibility requirements
1. Contrast: AA for text (4.5:1), 3:1 for large text and UI components.
2. **Color is never the sole signal.** Status always has icon plus text.
3. Full keyboard operation: logical tab order, visible focus ring (`--color-focus-ring`, at least 2 px), no focus traps except in dialogs.
4. Semantic HTML: real buttons, links, headings in order, tables with headers, labels tied to inputs.
5. Live regions announce: status changes, toasts, connection changes, conflict arrival. Use `polite` unless an error needs `assertive`.
6. Icon-only controls have accessible names.
7. Respect reduced motion and browser zoom to 200% with no loss of function.
8. Form errors are programmatically associated with their inputs.
9. Layout tolerates text 30% longer than English (future translation) and right-to-left text in values (Urdu names). Do not assume text direction in value cells.

---

## 12. Content and Writing Guidelines

This section exists to stop the product from sounding like generic AI-generated software copy. **Every string in the product must follow it.**

### 12.1 Voice
- A competent, calm colleague explaining what happened and what to do next.
- **Specific over vague.** Name the field, the number, the person, the time.
- **Short.** One idea per sentence. Most messages are one or two sentences.
- **Neutral and warm, not cheerful.** No performed enthusiasm.
- Speak about the **system's state**, not about feelings.

### 12.2 Writing rules
1. **Say what happened, then what the user can do.** ("Address wasn't saved: it must be at least 5 characters. Edit it and try again.")
2. **Use real nouns.** "phone number", "registration number", "North Campus", not "item", "entry", "data", "information".
3. **Buttons are verbs naming the result:** "Restore value", "Apply decisions", "Discard change". Not "OK", "Submit", "Continue", "Yes".
4. **Sentence case everywhere** (headings, buttons, labels). No Title Case, no ALL CAPS except tiny labels if the design calls for it.
5. **No exclamation marks.** Ever.
6. **No emoji** in the interface.
7. **Plain words:** use "use" not "utilize", "start" not "initiate", "fix" not "remediate".
8. **Don't blame the user.** "That format isn't valid" beats "You entered an invalid format".
9. **Don't over-apologize.** Apologize only when the system clearly failed, once, briefly.
10. **No filler:** cut "please", "simply", "just", "kindly", "successfully", "currently" unless they carry meaning.
11. **Consistent terms:** pick one word per concept and use it everywhere (see 12.4).
12. **Numbers as numerals** ("3 changes"), with correct singular/plural ("1 change", "2 changes").
13. **No placeholder text in shipped screens.** No "Lorem ipsum", no "John Doe", no "Test".

### 12.3 Banned phrases and patterns (never ship these)

| Category | Do not use |
|---|---|
| Marketing filler | seamless, seamlessly, effortless, effortlessly, empower, leverage, unlock, supercharge, elevate, streamline, robust, cutting-edge, next-generation, game-changing, revolutionize, all-in-one, powerful, intuitive, magic, delight |
| AI-tell phrases | "In today's fast-paced world", "It's important to note", "Let's dive in", "delve", "navigate the complexities", "Whether you're a... or a...", "Say goodbye to...", "Take your X to the next level", "We've got you covered" |
| Fake friendliness | "Oops!", "Whoops!", "Uh-oh!", "Hooray!", "Awesome!", "Let's get started!", "You're all set!" (when nothing specific was completed), "Welcome back! 🎉" |
| Empty errors | "Something went wrong." with no detail, "An error occurred.", "Please try again later." as the only content |
| Hollow confirmation | "Success!" alone, "Done!" alone, "Operation completed successfully." |
| Robotic | "Your request has been processed.", "The operation could not be completed." |
| Hype and padding | Three-adjective strings ("fast, secure, and reliable"), taglines that fit any product, rhetorical questions as headings |
| Punctuation tics | Exclamation marks, em dashes used for drama, ellipses for suspense, ALL-CAPS emphasis |

### 12.4 Vocabulary (one term per concept)

| Use | Instead of |
|---|---|
| record | profile, entry, file, item (for a student) |
| change | update, edit request, modification (for a pending/queued edit) |
| sync / synced | upload, push, flush |
| saved on this device | cached, queued, stored locally |
| conflict | clash, collision, mismatch |
| history | audit log, changelog (in the UI) |
| restore | revert, rollback |
| discard | delete, cancel (for a queued change) |
| campus | branch, location, site |
| registration number | roll number, ID (unless it's the national ID) |

### 12.5 Formats
- Dates: `6 Nov 2026`. Date and time: `6 Nov 2026, 2:14 PM`. Today: `Today, 2:14 PM`. Within the last minute: `Just now`. Show the exact timestamp on hover.
- Show times in the user's local time zone. Add the zone only when it differs from the viewing user's.
- Phone numbers display as `0300 1234567`. National ID displays with grouping, `12345-1234567-1`.
- Empty values display `(empty)`. Unknown people display `Unknown user`, never blank.
- Percentages: `87%`, no space.
- Counts and pluralization are always correct ("1 change", "2 changes").

### 12.6 Microcopy bank

| Situation | Write this | Not this |
|---|---|---|
| Saved offline | Saved on this device. Will sync when you're back online. | Your changes have been cached locally for later synchronization! |
| Offline banner | You're offline. Changes are saved on this device and will sync later. | Oops! Looks like you lost your connection. |
| Back online | Back online. Syncing 3 changes. | Welcome back! We're syncing your data. |
| Synced | Synced | Successfully synchronized! |
| Conflict | Phone number was also changed by Admin, North Campus. Choose which value to keep. | A conflict has occurred. Please resolve it. |
| Rejected | Address wasn't saved: it must be at least 5 characters. | Validation error. |
| Duplicate | A student with registration number CS-2026-0147 already exists. | Duplicate entry detected. |
| Server unreachable | Can't reach the server. Your changes are safe on this device. | Network error. Please try again later. |
| Stale decision | The current value changed again while you were deciding. Review the new value. | Conflict resolution failed. |
| Empty outbox | Everything is saved to the server. | You're all caught up! 🎉 |
| No search results | No records match "ahmed". | We couldn't find anything. Try adjusting your search. |
| Restore confirm | Restore Address to the value from 14 Nov, 10:42? This adds a new entry to the history. | Are you sure you want to revert? |
| Integrity pass | All 7 checks passed. | Your data is 100% healthy and secure! |
| Integrity fail | 2 checks failed. Details below. | Uh-oh, we found some issues. |
| Access denied | You don't have access to this record. | Forbidden. |
| Session ended | You've been signed out. Unsent changes are kept on this device. | Session expired. Please log in again. |

### 12.7 Error message formula
`[What happened, naming the field or thing]` + `[Why, if known]` + `[What to do next, if there is an action]`
Example: "Phone number wasn't saved. It must start with 03 and have 11 digits. Edit it and try again."

---

## 13. Visual "Anti-Slop" Rules

The look should read as **designed for this product**, not generated from a template.

**Do not:**
1. Use gradient text, neon glows, or decorative gradients behind content.
2. Apply glassmorphism/blur to ordinary cards.
3. Use random blobs, abstract shapes, or stock illustrations as filler.
4. Build screens from identical cards each with an icon in a colored circle and a title and a description (the classic three-feature grid).
5. Center everything. Management UIs are left-aligned and structured.
6. Use more than **one accent color** outside the status colors.
7. Stack heavy shadows or nested borders-plus-shadows-plus-backgrounds.
8. Use emoji as icons or bullets.
9. Mix icon styles or stroke weights.
10. Add fake social proof, fake stats, testimonials, "Trusted by" bars.
11. Use "Welcome to [Product]" hero sections.
12. Animate things that don't change state (floating, pulsing, bouncing decoration).
13. Use more than three font weights or more than two font families.
14. Add placeholders like Lorem ipsum, "John Doe", "User 1", "Test".

**Do:**
1. Rely on **spacing, alignment, and typography** for hierarchy, not decoration.
2. Use **real, realistic data**: Pakistani names, real-looking registration numbers (`CS-2026-0147`), three named campuses, varied programs, plausible timestamps and phone numbers.
3. Make dense data (tables, history) **scannable**: aligned columns, consistent row height, tabular numbers, muted metadata.
4. Keep density comfortable but efficient; this is a work tool.
5. Make states **visible and consistent**: same badge, same wording, same place on every screen.
6. Keep one consistent set of corner radii and elevation levels.
7. Spend polish effort on the **three hero surfaces:** the field status badges, the conflict page, and the integrity check. Everything else stays plain and correct.

---

## 14. Demo-Specific UI Requirements

- A **demo mode flag** reveals the demo strip and simulator controls. Without the flag, none of it renders.
- **Split view** (wide screens only) shows two labeled device frames side by side, each with its own connection pill, outbox count, and the same record, so a viewer can watch both sides during a conflict.
- **Seed data** includes at least: 12 students across 3 campuses, 3 faculty, 2 admins, one record primed for the conflict story, one near-duplicate for the duplicate story, and a record with a history of 8 or more entries.
- Every demo control has a one-line description and a keyboard shortcut for fast live presentation.
- A visible **Reset demo data** control returns everything to the starting state in under 3 seconds.

---

## 15. Performance and Polish Checklist

- First meaningful paint fast on a mid-range phone over slow 4G; the app shell loads offline.
- No layout shift when status badges change (reserve space).
- Skeletons only after 300 ms; no flash of loading for fast responses.
- Fonts self-hosted, subset, preloaded; no external font requests.
- Images: none required for core flows. Icons are SVG.
- Animations use compositor-friendly properties only.
- No console errors or warnings in a clean run of the demo journey.
- Works in current Chrome, Edge, and Safari; Android Chrome and iOS Safari as installed PWAs.

---

## 16. UI Definition of Done

A screen is done only when **all** are true:

1. It uses only design tokens (no hard-coded values).
2. All states exist and were seen: default, loading, empty, error, offline, and (where relevant) conflict, rejected, pending.
3. It works at mobile, tablet, and desktop widths with no horizontal scroll.
4. It is fully keyboard operable with visible focus.
5. Status is never conveyed by color alone.
6. Every string follows section 12 (no banned phrases, correct vocabulary, correct formats).
7. Animations match section 10 and respect reduced motion.
8. It contains no placeholder content.
9. Another team member can complete the task on it without explanation.

---

## 17. Decisions Finalized (Hackathon Execution)

All previously open design items have been resolved autonomously to maximize hackathon velocity:
- **Product Name & Logo:** Locked as **CampusSync** with an SVG geometric interlocking dual-node mark (representing distributed cross-campus synchronization).
- **Color Values:** Standardized on Slate/Indigo base (`#0F172A`, `#F8FAFC`, `#2563EB`) with WCAG-compliant status families documented in Section 3.1 & 3.2.
- **Font Families:** **Inter** for UI text and **JetBrains Mono** for IDs/versions/audit diffs (both bundled locally as WOFF2 for offline PWA operation).
- **Icon Set:** **Lucide Icons** at consistent 1.75px stroke width.
- **Radii & Shadows:** `--radius-sm`: 6px, `--radius-md`: 10px, `--radius-lg`: 14px; `--shadow-1` (subtle border shadow), `--shadow-2` (cards), `--shadow-3` (dialogs/toasts).
