# CPU Audit Report: timekeeping-dtr

**Date:** 2026-11-26 · **Scope:** all server-side code at `f5b0b34` · **Code changed:** none

## TL;DR

Almost all of the ~8 min/day of Active CPU comes from **background polling**, not from expensive code.

The cause is `lib/context.tsx:1618-1629`. Every logged-in browser tab calls **11 API routes every 30 seconds**, for every role, all day. It keeps polling while the tab is hidden. On top of that, each time the user switches back to the tab there is another **12-call burst** (see finding #3).

Each call is cheap. I measured about 1.3 ms of server CPU per call locally (see "Method"). But one tab open for a workday makes about **9,000–12,000 calls**. At that rate, about 60–120k invocations a day account for the entire budget.

Four small client-side changes (Quick Wins, §5.4) should cut invocations by about 90%. That gets usage to **~0.5–1.5 min/day**, well under the 4 min/day target. They change no server code, no auth checks and no business logic.

No other CPU problems were found: no middleware, no crons, no bcrypt, no server-side PDF/Excel/image work, and no server-side payroll computation.

---

## Method (what was measured vs. modeled)

**Measured locally.** Production `next build` + `next start` (Next 15.5, Node 24, Apple Silicon), run in a scratch copy of the repo. A local mock Supabase stood in for the database, so no production data was touched. CPU is the server process's CPU time over hundreds of warm requests.

| Measurement | Server CPU (local) |
|---|---|
| Unauthenticated request → 401 (no DB calls). This is the fixed per-invocation overhead. | **0.65 ms/call** |
| One full 30 s poll cycle (11 routes, employee, 60 DTR rows) | **14.7 ms/cycle** (1.34 ms/call avg) |
| `GET /api/dtr` · `/api/users` · `/api/settings` · `/api/notifications` | 1.88 · 1.37 · 1.37 · 1.10 ms |
| Response pipeline (JSON parse → stringify → AES-GCM → base64 → JSON) for 20 / 200 / 1,000 DTR rows | 0.20 / 1.17 / 6.27 ms |
| `createClient()` (Supabase server client, built on every request) | 0.07 ms |

**Modeled.** I could not open the Vercel dashboard, so call volumes are estimates. Vercel's vCPUs are slower than a laptop core, and production adds TLS to Supabase and the platform wrapper. A 3–5× factor puts per-call Active CPU at about **4–7 ms**.

The observed 480 s/day divided by 4–7 ms is **≈ 70k–120k invocations/day**. That is about 55–100 browser-tab-hours a day, for example 7–10 staff with the app open through their shift. The punch-clock workflow and the new "Are you still working?" reminder both encourage that. **Polling alone explains the whole budget.**

**Please add from Vercel → timekeeping-dtr → Observability → Functions (sort by Active CPU):**

| # | Route | Invocations (30d) | Active CPU (30d) |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |

> **What confirms the diagnosis:** the 11 polled routes (`/api/users`, `/api/dtr`, `/api/pay-periods`, `/api/payments`, `/api/corrections`, `/api/reimbursements`, `/api/settings`, `/api/audit`, `/api/approvals`, `/api/wage-history`, `/api/notifications`) should show **nearly identical invocation counts**. `/api/users` should be a bit higher, because it is also called on every tab focus.

---

## 5.1 Stack summary

| Layer | What's used |
|---|---|
| Framework | Next.js 15.5 **App Router**, `output: 'standalone'`, React 19 |
| Rendering | `/` is **static** (prerendered `○`, served from the CDN at zero function CPU). The whole app is one client-side SPA (`AppProvider` + `TimekeepingApp`). |
| Server code | 16 Route Handlers under `app/api/**`, all `force-dynamic`. No Server Actions, no `getServerSideProps`. |
| DB / ORM | Supabase Postgres via `@supabase/supabase-js` 2.116, with a service-role client created per request (`lib/supabase/server.ts:25`). No ORM. |
| Auth | Supabase Auth. Each API request calls `auth.getUser(token)` and then `profiles.select('*')` (`lib/crypto-server.ts:75-146`). No bcrypt/argon2 in the app, because hashing is done by Supabase. |
| Data fetching | Hand-rolled `secureFetch` (`lib/crypto.ts:164`) with AES-GCM "encrypted" bodies, inside a 5.6k-line React context (`lib/context.tsx`). No SWR or React Query. |
| Middleware / crons | **None.** There is no `middleware.ts`/`proxy.ts` and no `vercel.json`. |
| Business logic | DTR/overtime/payroll computation runs **in the browser** (`lib/utils-dtr.ts`, `lib/context.tsx`). CSV export and payslips are client-side (`AdminReports.tsx:368`, `EmployeePayslipModal.tsx:84` uses `window.print()`). |
| Email | `nodemailer` is loaded with dynamic `import()` only when sending (`lib/email-service.ts:584`). |

## 5.2 Entry point inventory

The volume estimate assumes about 70 tab-hours/day (see Method). "Polled" means it is part of the 30 s cycle in `refreshAllRemoteData` (`lib/context.tsx:1579`).

| Route / function | Type | Est. calls/day | Est. CPU per call | Notes |
|---|---|---|---|---|
| `GET /api/users` | API (polled) | ~7,000–11,000 | low–med | Called twice per refresh trigger (`syncUserFromSupabase` at `context.tsx:657` and `refreshRemoteProfiles`). Calls `auth.admin.listUsers()` on **every** call for every role (`users/route.ts:36`). Admin calls also run reconciliation (`:103-163`). |
| `GET /api/dtr` | API (polled) | ~6,000–10,000 | low (employee) / **med, growing** (admin) | Admins get the **entire history** (`dtr/route.ts:23`) plus the whole `monthly_self_approvals` table (`:170`). Also runs the auto-close check (`:204`). |
| `GET /api/notifications` | API (polled) | ~6,000–10,000 | low | `limit(100)` |
| `GET /api/audit` | API (polled) | ~6,000–10,000 | low–med | 250 rows per call. Only the admin Audit tab displays it; employees never see it. |
| `GET /api/approvals` | API (polled) | ~6,000–10,000 | low | Same table `/api/dtr` already reads in the same cycle. |
| `GET /api/payments` | API (polled) | ~6,000–10,000 | low | |
| `GET /api/pay-periods` | API (polled) | ~6,000–10,000 | low | Changes a few times a month. |
| `GET /api/settings` | API (polled) | ~6,000–10,000 | low | Changes almost never. |
| `GET /api/corrections` | API (polled) | ~6,000–10,000 | low | |
| `GET /api/reimbursements` | API (polled) | ~6,000–10,000 | low | |
| `GET /api/wage-history` | API (polled) | ~6,000–10,000 | low | Admin-only. **Employees poll it and get a 403 every time.** |
| `POST/DELETE /api/dtr` | API (user action) | ~50–200 | low | Punch in/out, edits |
| `POST /api/audit`, `/api/notifications` | API (user action) | ~100–400 | low | Logged on each user action |
| `POST /api/payments`, `/pay-periods`, `/corrections`, `/reimbursements`, `/approvals`, `/settings`, `/wage-history`, `PATCH /api/users` | API (user action) | tens | low | |
| `POST /api/approvals/notify-admins`, `/remind-employees`, `/payments/send-receipt` | API (email) | a few | low (I/O-bound) | `remind-employees` sends emails one at a time in a loop. That is wall time, not CPU. |
| `POST /api/auth/register`, `/api/auth/reset-password` | API (auth) | a few | low | Password hashing happens inside Supabase, not Vercel. |
| `/` (page) | Static page | n/a | **zero** | Prerendered at build time |
| Middleware | n/a | n/a | n/a | None exists |
| Crons | n/a | n/a | n/a | None exist |

## 5.3 Findings (ranked by estimated impact)

| # | File:line | Problem | Why it burns CPU | Fix | Est. savings | Effort | Risk |
|---|---|---|---|---|---|---|---|
| 1 | `lib/context.tsx:1618-1629` | The poll runs in **hidden/background tabs**. There is no `document.visibilityState` check anywhere in the data layer. | A tab left open all shift keeps polling. Chrome slows hidden-tab timers to about once a minute after 5 min; other browsers keep the full 30 s rate. | Skip the tick when `document.hidden`. On `visibilitychange` → visible, run one refresh, throttled to at most once per 60 s. | **40–60%** of total | S | Low. Clocks, auto-close and "still working?" reminders are client-side timers and keep running. |
| 2 | `lib/context.tsx:1579-1597`, `:1627` | **11 collections every 30 s**, most of which rarely change (settings, pay periods, wage history, users, payments, audit). | 11 invocations per tick, each paying the fixed overhead (0.65 ms locally) plus an auth round trip and a profile query. | Split into tiers. **Fast** (while visible, every 120 s): `notifications` + `dtr`, plus `corrections`, `reimbursements`, `approvals` for admins. **Slow**: everything else on load, when the relevant tab opens, on the existing "Sync" buttons, and at most every 15 min. | **60–80%** of what's left after #1 | S–M | Low. Data can be up to 2 min stale; the user's own writes already update local state immediately. |
| 3 | `lib/context.tsx:1725-1728` together with auth-js `GoTrueClient.js:4165` | **A 12-call burst every time a tab regains focus.** supabase-js emits `SIGNED_IN` on every hidden→visible switch (`_onVisibilityChanged` → `_recoverAndRefresh`). The handler treats it as a fresh login and runs `syncUserFromSupabase` (`/api/users`) plus `refreshAllRemoteData` (11 calls). The event is also broadcast to the user's other tabs. | Staff who alt-tab 10–30 times an hour add about 120–360 invocations per hour per tab, on top of polling. | Refresh only when the signed-in **user id changes** (a real login), or when the last refresh was more than 60 s ago. Let the visibility handler from #1 handle refresh-on-return. | **10–25%** of total | S | Low |
| 4 | `lib/context.tsx:1499`, `:1545`; `app/api/audit/route.ts:21`; `app/api/wage-history/route.ts:10` | **Wasted calls.** Employees poll `/api/wage-history` (always a 403) and `/api/audit` (never displayed). Admins pull 250 audit rows every 30 s even when the Audit tab is closed. | 2 of every 11 employee calls do nothing useful. | Skip wage-history and audit for non-admins. Fetch audit logs only when the `admin_audit` tab is open. | ~18% of employee calls (folded into #2's estimate) | S | None |
| 5 | Every route: `lib/crypto-server.ts:75-146`, `lib/supabase/server.ts:25` | **Fan-out.** Each refresh is 11 separate invocations, and each one repeats auth (`getUser` + `profiles.select('*')`), client setup, and Next.js request overhead. | About half of per-call CPU is fixed overhead (0.65 of 1.34 ms locally). | Add one `GET /api/sync?tier=fast` (auth once, run the queries in parallel, return one encrypted payload) and have the poll call only that. Keep the existing routes for writes and on-demand reads. | **50–65%** of what's left after #1–#4 | M | Low–med. New endpoint, so its role filtering must match the existing routes exactly. |
| 6 | `app/api/dtr/route.ts:23`, `:169-171` | Admin `GET /api/dtr` returns **the entire DTR history** plus the **entire** `monthly_self_approvals` table on every call. | Payload grows every day, and the response pipeline is about 6 ms locally at 1,000 rows. **Correctness risk:** Supabase's API caps responses at 1,000 rows by default (the "Max rows" setting, worth checking for this project). Once the table grows past that, admins would silently lose the *oldest* entries from reports. | Poll with a window (current + previous pay period, or `updated_at > lastSync`) and load older history on demand. Filter approvals to the months returned. | Small now, **grows monthly**. It also guards against the truncation bug. | M | Med. AdminReports and AdminPayments must ask for older ranges explicitly. |
| 7 | `app/api/users/route.ts:34-42`, `:103-163` | `auth.admin.listUsers()` and the full reconciliation loop run on every call, for every role, including employees, who only need their own profile. | An extra Auth admin round trip plus parsing every auth user's JSON on about 10k calls a day. | Call `listUsers()` and reconcile only for admins, and only from the existing "Check for new registrations" button (`AdminUsers.tsx:425`). For employees, don't poll `/api/users` at all; their profile comes with the sign-in sync. | 5–10% of what's left | S | Low. New registrations show up when an admin clicks "Check" or reloads. |
| 8 | `lib/context.tsx:1685-1699` and `:1707-1728`, `:657` | **Duplicate work on page load.** `getSession().then` and the `INITIAL_SESSION` event both run sync-then-refresh-all. The `isRefreshingAllRef` guard only catches the overlap if the timing lines up. `/api/users` is also fetched twice: once in `syncUserFromSupabase`, then again in `refreshRemoteProfiles`. | Up to 23 invocations per page load instead of about 11. | Use one bootstrap path, triggered by the `INITIAL_SESSION` event only. Reuse the `/api/users` result from `syncUserFromSupabase` instead of fetching it again. | <5% | S | Low |
| 9 | `lib/crypto-server.ts:118-122`; `lib/supabase/server.ts:25` | `profiles.select('*')` on every authenticated call, and a new Supabase client on every request. | Small per call (client creation is 0.07 ms locally), but multiplied by tens of thousands of calls. | Select `id, role, first_name, last_name, employee_no, department` (whatever routes actually read from `auth.profile`), and keep a module-level client singleton. | <5% | S | Low |
| 10 | `lib/crypto-server.ts:9-37`, `lib/crypto.ts:7-10` | Every response is JSON-stringified, AES-GCM-encrypted and base64-encoded, then wrapped in JSON again. | Scales with payload: 0.2 ms at 20 rows, 6.3 ms at 1,000 rows (locally). | No change needed once #6 bounds payload size. FYI, the key ships in the browser bundle (`NEXT_PUBLIC_` with a hard-coded fallback), so this layer hides payloads in DevTools but provides no security beyond TLS. Whether to keep it is a product decision. | Small | n/a | n/a |
| 11 | Architecture | Polling at all | Every refresh is a Vercel invocation. | **Escape hatch:** use Supabase Realtime (`postgres_changes`) for `dtr_entries` and `notifications`, so the browser subscribes over WebSocket directly to Supabase and **no Vercel function runs** for updates. RLS policies already exist in `supabase/schema.sql`. Confirm they are applied in production and add the tables to the `supabase_realtime` publication. | Removes almost all remaining polling cost | M–L | **Med–high.** Data visibility depends on RLS being correct. Test each policy before rollout. |

**Checked and not a problem:**

- **Middleware:** none.
- **Crons:** none.
- **Password hashing:** Supabase does it, not Vercel.
- **Heavy libraries:** no PDF, Excel, Puppeteer, sharp or OCR on the server.
- **Date libraries:** no `moment`.
- **Payroll and overtime math:** runs in the browser, so nothing is recomputed on the server per view.
- **Bots:** `/` is static. Unauthenticated API calls are rejected before any DB work (0.65 ms locally).
- **Polling-adjacent loops:** the 1 s tickers (`Navbar.tsx:83`, `PunchClockCard.tsx:65`, `NavPunchOutModal.tsx:58`, `context.tsx:570`) and the "still working?" reminder are client-only and never reach the server.
- **N+1 loops:** `autoCloseStaleSessions` and `remind-employees` have them, but they run rarely and are I/O-bound.
- **Unused dependency:** `@google/genai` is never imported, so it doesn't affect CPU. It could be removed for tidiness.

## 5.4 Quick wins

Each is under 30 minutes, client-only (`lib/context.tsx`), with no business-logic change and no auth change. Ship each as its own commit, in this order.

**QW1: Pause polling in hidden tabs; refresh once on return (finding #1).**
```ts
// replaces the effect at lib/context.tsx:1618-1629
const POLL_MS = 30_000; // QW4 raises this to 120_000
const lastRefreshAtRef = React.useRef(0);
useEffect(() => {
  if (!session?.user?.id) return;
  const tick = (minGapMs: number) => {
    const token = sessionRef.current?.access_token;
    if (!token || document.visibilityState !== 'visible') return;
    if (Date.now() - lastRefreshAtRef.current < minGapMs) return;
    lastRefreshAtRef.current = Date.now();
    refreshAllRemoteDataRef.current(token);
  };
  const interval = setInterval(() => tick(0), POLL_MS);
  const onVisible = () => tick(60_000); // at most one catch-up refresh per minute
  document.addEventListener('visibilitychange', onVisible);
  return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
}, [session?.user?.id]);
```

**QW2: Stop treating tab focus as a new login (finding #3).** In the `onAuthStateChange` handler (`:1725`), call `syncUserFromSupabase` and `refreshAllRemoteData` only when `newSession.user.id` differs from the last user id synced (keep it in a ref), or for `USER_UPDATED`. The visibility handler from QW1 covers refresh-on-return.

**QW3: Skip calls the role can't use (finding #4).** In `refreshAllRemoteData`, include `refreshRemoteWageHistory` and `refreshRemoteAuditLogs` only for admin or system-admin users. Make the audit fetch run when the `admin_audit` tab mounts, not on every tick.

**QW4: Slower, tiered poll (finding #2).**
- Set `POLL_MS = 120_000`.
- The tick refreshes only the **fast tier**: `notifications` and `dtr`, plus `corrections`, `reimbursements` and `approvals` for admins.
- Everything else (`users`, `settings`, `pay-periods`, `payments`, `wage-history`) refreshes on load, on the existing Sync buttons, on the mount effects that already exist (`AdminPayments.tsx:78`, `EmployeePayments.tsx:45-59`), and on a 15-minute slow tick while visible.

> **Effect on auto-close:** the server-side auto-close (`dtr/route.ts:204`) runs lazily when a `GET /api/dtr` happens. With slower polling it may run a little later. That changes only the audit timestamp, not the hours recorded: `time_out` is always `time_in + MAX_SESSION_HOURS` (`lib/utils-dtr.ts:550`). The employee's own tab still closes the session on its client-side timer (`context.tsx:2125`).

## 5.5 Plan to stay under budget

Per tab-hour, today:
- **Visible:** about 1,320 polling calls, plus about 12 per tab switch.
- **Hidden:** about 660 (Chrome) or 1,320 (other browsers).

After QW1–QW4:
- **Visible:** about 75 (employee) to 175 (admin) calls.
- **Hidden:** 0.

User actions (punches, edits, approvals) add only about 1–3% of today's volume and barely change.

| Stage | Invocations/day (est.) | Active CPU/day (est.) |
|---|---|---|
| **Current** (observed) | ~70k–120k | **~8 min** |
| After QW1 + QW2 (visibility pause and focus fix) | ~30k–50k | ~3–4 min, already at the target |
| After QW1–QW4 (all quick wins) | ~6k–12k | **~0.5–1.5 min** |
| Plus #5–#9 (one `/api/sync` call per tick, bounded DTR window, slimmer `/api/users`, single bootstrap) | ~3k–6k | **~0.4–0.8 min** |
| Plus #11 (Realtime replaces polling) | ~1k–3k (writes and page loads only) | ~0.2–0.4 min |
| **Target** | | **< 4 min/day** ✅ after the quick wins |

The ranges come from the unknown mix of visible vs. hidden tab time. Even in the worst case, with every tab visible all day, QW1–QW4 still cut calls by about 85%.

## 5.6 Verification

**Before deploying, in the browser:** open DevTools → Network, filter `/api/`, and log in as an employee.

| Check | Today | After the quick wins |
|---|---|---|
| Requests in 5 min, tab visible | ~110 | ~3–5 |
| Requests in 5 min, tab hidden | 55–110 | 0 |
| Requests when you alt-tab back | 12 | 0–2, and at most one batch per minute |
| `/api/wage-history` and `/api/audit` as an employee | Every 30 s | Never |

Then repeat as an admin.

**After deploying, in Vercel → Observability → Functions (watch 2–3 days against the ~8 min/day baseline):**

| Fix | Route(s) to watch | Expected change |
|---|---|---|
| QW1 (hidden pause) | All 11 polled routes | Invocations drop 40–60%, most visibly overnight and at lunch |
| QW2 (focus fix) | `/api/users` | Its count falls back in line with the other polled routes |
| QW3 (role gating) | `/api/wage-history`, `/api/audit` | Down more than 90%; wage-history 403s should vanish from the logs |
| QW4 (tiering, 120 s) | `/api/settings`, `/api/pay-periods`, `/api/payments`, `/api/users` | Down more than 95%. `/api/dtr` and `/api/notifications` down about 75% more. |
| #5 (`/api/sync`) | New `/api/sync` replaces the fast-tier routes | Total invocations roughly halve again |
| #6 (DTR window) | `/api/dtr` | Active CPU per invocation stays flat as months pass, instead of growing |
| Overall | Project Active CPU | **< 2 min/day within 48 h of the quick wins** |

Rule 1 of the audit (old vs. new output must match) does not apply to the quick wins. They change *when* data is fetched, not how anything is computed. For #6, test that AdminReports and AdminPayments totals for past months are unchanged.

---

## Out of scope, but please don't ignore: security issues found during the scan

These are not CPU issues, but some are serious. Listed most urgent first. No secret values are reproduced here.

1. **A Supabase secret (service-role) key is hard-coded as a fallback in source:** `lib/supabase/server.ts:14-19`. It is in git history, and it grants full database access with no RLS. **Rotate it in the Supabase dashboard**, keep it only in Vercel env vars, and remove the literal. This is urgent if the GitHub repo is, or ever was, public.
2. **Password-reset link returned to the caller:** `app/api/auth/reset-password/route.ts:224-231`. If no Resend or SMTP mailer is configured in production, the endpoint returns a working recovery link to *any unauthenticated caller* who knows an email address. That allows account takeover. Confirm a mailer is configured in production and stop returning `action_link`.
3. **No admin check on `POST /api/pay-periods`:** `app/api/pay-periods/route.ts:55-64`. Any logged-in employee can upsert pay periods, for example to reopen a locked period.
4. **Forgeable audit entries:** `POST /api/audit` (`app/api/audit/route.ts:59-63`) accepts `actor_id`, `actor_name` and `actor_role` from the client.
5. **No ownership check on notification delete:** `DELETE /api/notifications` by `id` (`app/api/notifications/route.ts:109-111`) lets any user delete anyone's notification.
6. **Public encryption key:** the API "encryption" key is public (`lib/crypto.ts:7-10`). It should not be relied on as a security control (see finding #10).
