# WMedlaw DTR & Timekeeping — Comprehensive User Manual & Operations Guide

Welcome to the **WMedlaw DTR & Timekeeping** application user manual. This system is a high-reliability, flexible, and tamper-resistant Daily Time Record (DTR) and payroll preparation platform designed for modern organizations.

> [!TIP]
> **Interactive Walkthrough Available**: Open [`interactive-user-guide.html`](file:///Users/dev/Desktop/Dev/timekeeping-dtr/interactive-user-guide.html) in any web browser (or navigate to `/interactive-guide.html` when running the web app) to access the interactive sandbox, punch clock simulator, visual admin adjudication flows, and live decimal hour calculator.

---

## Table of Contents

1. [System Overview & Architecture](#1-system-overview--architecture)
2. [User Roles & Permissions Matrix](#2-user-roles--permissions-matrix)
3. [Authentication, Onboarding & Account Security](#3-authentication-onboarding--account-security)
4. [Employee User Guide](#4-employee-user-guide)
   - 4.1 [Live Punch Clock Station](#41-live-punch-clock-station)
   - 4.2 [Manual DTR Filing](#42-manual-dtr-filing)
   - 4.3 [Reviewing DTR Records & Audit Histories](#43-reviewing-dtr-records--audit-histories)
   - 4.4 [Submitting DTR Correction Requests](#44-submitting-dtr-correction-requests)
   - 4.5 [Tracking Payment Status (Wage Privacy View)](#45-tracking-payment-status-wage-privacy-view)
   - 4.6 [Managing Profile & Contact Information](#46-managing-profile--contact-information)
5. [Administrator Guide](#5-administrator-guide)
   - 5.1 [Admin Dashboard & Operational Action Queues](#51-admin-dashboard--operational-action-queues)
   - 5.2 [Reviewing & Approving DTR Filings](#52-reviewing--approving-dtr-filings)
   - 5.3 [Bulk Approvals](#53-bulk-approvals)
   - 5.4 [Timesheet Adjustments & Closing Sessions on Behalf](#54-timesheet-adjustments--closing-sessions-on-behalf)
   - 5.5 [Adjudicating Extra Hours (Overtime Decisions)](#55-adjudicating-extra-hours-overtime-decisions)
   - 5.6 [Adjudicating Correction Requests](#56-adjudicating-correction-requests)
   - 5.7 [Employee & Wage Management](#57-employee--wage-management)
   - 5.8 [Approving New User Registrations](#58-approving-new-user-registrations)
   - 5.9 [Pay Period Processing & Payroll Generation](#59-pay-period-processing--payroll-generation)
   - 5.10 [Payment Settlement Management](#510-payment-settlement-management)
   - 5.11 [Operational Reports & CSV Exports](#511-operational-reports--csv-exports)
   - 5.12 [System Audit Log Inspection](#512-system-audit-log-inspection)
6. [System Administrator (Super Admin) Guide](#6-system-administrator-super-admin-guide)
   - 6.1 [Hidden Super Admin Architecture](#61-hidden-super-admin-architecture)
   - 6.2 [Administrator Account Governance & Clock-In Permissions](#62-administrator-account-governance--clock-in-permissions)
   - 6.3 [Setting & Modifying Administrator Wages](#63-setting--modifying-administrator-wages)
   - 6.4 [System-Wide Rules & Global Settings](#64-system-wide-rules--global-settings)
   - 6.5 [Emergency Period Unlocks & Reopening](#65-emergency-period-unlocks--reopening)
   - 6.6 [Payment Reversals](#66-payment-reversals)
   - 6.7 [Data Retention, Archiving & Safe Purging](#67-data-retention-archiving--safe-purging)
7. [Calculations, Logic & Business Rules](#7-calculations-logic--business-rules)
   - 7.1 [Decimal Hour Conversion Rules](#71-decimal-hour-conversion-rules)
   - 7.2 [Overnight Shifts (Midnight Crossing)](#72-overnight-shifts-midnight-crossing)
   - 7.3 [Interval Overlap Prevention](#73-interval-overlap-prevention)
   - 7.4 [Threshold Limiting Logic (Daily, Weekly, Monthly)](#74-threshold-limiting-logic-daily-weekly-monthly)
   - 7.5 [Tamper-Resistant Server Clock & Test Simulation](#75-tamper-resistant-server-clock--test-simulation)
8. [Troubleshooting & Frequently Asked Questions (FAQ)](#8-troubleshooting--frequently-asked-questions-faq)

---

## 1. System Overview & Architecture

**WMedlaw DTR & Timekeeping** provides reliable time tracking, approval automation, and payroll preparation.

```
+-----------------------------------------------------------------------------------+
|                                  WMedlaw DTR UI                                   |
|   +-----------------------+ +-----------------------+ +-----------------------+   |
|   |    Employee Portal    | |  Admin Operations     | |  System Admin Control |   |
|   |  - Live Punch Clock   | |  - DTR Filings Review | |  - Admin Wage Mgmt    |   |
|   |  - Manual DTR Filing  | |  - Extra Hours Queue  | |  - Global Rules       |   |
|   |  - Corrections Filing | |  - User Approvals     | |  - Period Unlocks     |   |
|   |  - Payment Tracking   | |  - Payroll Batches    | |  - Retention Purge    |   |
|   +-----------------------+ +-----------------------+ +-----------------------+   |
+------------------------------------------+----------------------------------------+
                                           |
                                           | (AES-256-GCM Encrypted Requests & Responses)
                                           v
+-----------------------------------------------------------------------------------+
|                           Next.js API Application Server                          |
|   - /api/auth/register    - /api/dtr                - /api/users                  |
|   - Authenticated JWT Handshake & Role Validation                                 |
|   - Tamper-Resistant Server Timestamp Synchronization                             |
+------------------------------------------+----------------------------------------+
                                           |
                                           | (PostgreSQL RLS Policies & Triggers)
                                           v
+-----------------------------------------------------------------------------------+
|                        Supabase Cloud Database & Storage                          |
|   - auth.users            - public.profiles         - public.dtr_entries          |
|   - public.pay_periods    - public.audit_logs       - public.correction_requests  |
+-----------------------------------------------------------------------------------+
```

### Core Architecture Highlights
* **Tamper-Resistant Server Clock**: The application enforces system-controlled server time for all punch timestamps, preventing client-side device manipulation.
* **End-to-End Cryptographic Security**: Sensitive payloads transferred between the client browser and the server are encrypted using AES-256-GCM.
* **Row-Level Security (RLS)**: Enforced directly inside PostgreSQL. Employees can only select and update their own records, while administrators have elevated operational access.
* **Wage Privacy Protection**: Hourly pay rates and gross financial amounts are strictly filtered out of the employee interface. Employees see only approved hours and settlement statuses.
* **Decimal Hours Accounting**: All work sessions are converted to 2-decimal-place numbers (e.g., $1\text{h } 30\text{m} = 1.50\text{h}$) to eliminate rounding discrepancies.

---

## 2. User Roles & Permissions Matrix

The platform implements a three-tier role-based access control (RBAC) model:

| Capability / Module | Employee | Administrator | System Administrator |
| :--- | :---: | :---: | :---: |
| **Clock In / Clock Out (Live Station)** | Yes (if enabled) | Yes (if enabled by SysAdmin) | Optional |
| **Cancel Accidental Punch** | Yes (own session) | Yes (own session) | Yes |
| **File Manual DTR Entries** | Yes | Yes (if clocks in) | Yes |
| **Edit Accomplishment Remarks** | Yes (unapproved only) | Yes | Yes |
| **File Time Correction Requests** | Yes | Yes | Yes |
| **View Own DTR Records & Audit Trail** | Yes | Yes | Yes |
| **View Own Wage / Gross Pay Amounts** | **No** (Masked) | Yes | Yes |
| **Review & Approve DTR Filings** | No | Yes | Yes |
| **Bulk Approve Clean DTR Entries** | No | Yes | Yes |
| **Adjust Employee DTR Times** | No | Yes (requires reason) | Yes (requires reason) |
| **Clock Out on Behalf of Employee** | No | Yes (requires reason) | Yes (requires reason) |
| **Adjudicate Extra Hours (Overtime Queue)** | No | Yes | Yes |
| **Adjudicate Correction Requests** | No | Yes | Yes |
| **Approve / Decline New User Registrations** | No | Yes | Yes |
| **Manage Employee Profiles & Wages** | No | Yes (Employees only) | Yes (Employees & Admins) |
| **View & Modify Admin Wages** | No | **No** (Conflict of Interest) | **Yes** (Exclusive) |
| **Close / Lock Pay Periods** | No | Yes | Yes |
| **Generate Payroll Batches** | No | Yes | Yes |
| **Update Payment Status (Paid / Hold / Cancel)** | No | Yes | Yes |
| **Reopen Locked Pay Periods** | No | **No** (Locked) | **Yes** (Requires reason) |
| **Reverse Paid Payments** | No | **No** (Locked) | **Yes** (Requires reason) |
| **Export Operational & Payroll CSV Reports** | No | Yes | Yes |
| **Inspect System Audit Logs** | No | Yes (Standard scope) | Yes (Full root scope) |
| **Configure Global System Settings & Overtime** | No | No | Yes |
| **Purge Archived Records (Data Retention)** | No | No | Yes (Requires confirmation) |

---

## 3. Authentication, Onboarding & Account Security

### 3.1 Account Registration
New users can sign up using either Email & Password or Google OAuth.

1. Navigate to the login portal.
2. Select **"Need an account? Sign up"**.
3. Enter your **First Name**, **Last Name**, **Work Email Address**, and a secure **Password** (minimum 6 characters).
4. Click **Create Account**.

> [!NOTE]
> **Automated Provisioning**: The server automatically registers your identity in Supabase Auth and provisions a profile in `public.profiles`. The designated system administrator (`marquez.ronrons@gmail.com`) is granted immediate active `system_admin` status. All other users enter the `pending_approval` state.

```
[ User Registers ] ──> [ Pending Approval Gate ] ──> [ Admin Reviews & Assigns Role/Wage ] ──> [ Active User ]
```

### 3.2 The Pending Approval Gate
When a non-admin registers, their account is placed on administrative hold to prevent unauthorized access:
* The user is greeted by the **Account Pending Approval** screen.
* The screen displays the user's name, email, and pending assignment status.
* Users can click **Check Approval Status** to check if an administrator has approved their account.

### 3.3 Signing In & "Remember Me"
1. Enter your registered email address and password.
2. Check **Remember Me** to store your email on the current device.
3. Click **Sign In**.

### 3.4 Password Recovery & Reset
1. On the Sign In screen, click **Forgot Password?**.
2. Enter your email address and click **Send Recovery Link**.
3. Open the link sent to your email to open the password recovery view.
4. Enter your new password and click **Update Password**.

### 3.5 Changing Password from the App
Any active user can change their password at any time:
1. Click the **Profile Dropdown** in the top navigation bar.
2. Select **Change Password**.
3. Enter your new password (minimum 6 characters) and click **Update Password**.

### 3.6 Suspended or Deactivated Accounts
If an administrator sets an account status to `inactive` or `locked`, the user is greeted by the **Account Deactivated or Suspended** screen. All punch, filing, and reporting actions are disabled. Contact management to restore access.

---

## 4. Employee User Guide

Employees can record working hours, track approvals, and monitor pay period settlement.

```
+---------------------------------------------------------------------------------------------------+
|  Top Navigation Bar                                                                               |
|  [ WMedlaw DTR ]  [▶ Punch In 09:50 / ■ Punch Out]  [ Server Clock: 2026-09-26 11:45 ]  [ User ]  |
+---------------------------------------------------------------------------------------------------+
|  Tabs: [ File DTR & Dashboard ] [ My DTR Records ] [ Correction Requests ]                        |
|        [ Payment Status (Hours Only) ] [ My Profile ]                                             |
+---------------------------------------------------------------------------------------------------+
```

### 4.1 Live Punch Clock Station & Quick Top Navigation Punch

Employees can punch in and punch out from either the **Top Navigation Bar** or the **Live Punch Clock Station** under **File DTR & Dashboard**.

#### Quick Top Navigation Punch In / Out:
* **One-Click Punch In**: Once logged in, an emerald **Punch In [HH:mm]** button is always accessible directly in the top header. Clicking it immediately starts your shift using the synchronized server clock, accompanied by a confirmation notification.
* **Punch Out from Any Screen**: While clocked in, the top navigation displays your active shift duration and a red **Punch Out** button. Clicking it opens a modal where you can document your deliverables and submit your clock-out from any page in the application.

#### Live Punch Clock Station (Dashboard):
Located on the main **File DTR & Dashboard** tab.

#### Clocking In:
1. Ensure the **Live Punch Clock** toggle is selected.
2. Review the live server date and time.
3. Click the green **Punch Clock In** button (or click **Punch In** in the top navigation).
4. Once clocked in:
   - A pulsing green indicator appears in the navigation bar showing your start time and elapsed duration.
   - The top navigation button updates to **Punch Out**.
   - A live session ticker counts elapsed time in seconds and decimal hours.
   - The system tracks your daily hours against your limit (e.g., 8.00h).

#### Cancelling an Accidental Clock-In:
If you clocked in by mistake:
1. In the open session card or via the top navigation Punch Out modal, click **Cancel Accidental Punch**.
2. A confirmation prompt appears asking for an optional reason.
3. Confirm cancellation. The open punch record is discarded without cluttering your record.

#### Clocking Out:
1. Click the red **Punch Out** button in the top navigation or locate the **Accomplishment Remarks** box on the dashboard station.
2. Enter a description of your completed tasks (minimum 10 characters required by company policy).
3. Click **Punch Clock Out**.
4. Your punch session closes, total decimal hours are calculated, and the entry is **automatically approved** (no admin approval required). If the shift exceeds regular hour limits, the excess time is flagged as `extra_hours_pending` and routed for administrator review.

---

### 4.2 Manual DTR Filing

If your workflow requires batch filing or retroactive entry:
1. Navigate to **File DTR & Dashboard**.
2. Select the **Manual DTR Filing** option.
3. Fill out the form fields:
   - **Work Date**: Date of the shift.
   - **Start Time (Time In)**: 24-hour time format (e.g., `08:00`).
   - **End Time (Time Out)**: 24-hour time format (e.g., `17:00`).
   - **Quick Presets**: Click standard presets (e.g., `08:00 – 17:00 (Standard Shift)` or `09:00 – 18:00 (Mid Shift)`) to populate times automatically.
   - **Accomplishments & Remarks**: Enter your completed work tasks (minimum 10 characters).
4. Review the **Calculated Duration Preview**:
   - The system shows total hours and confirms auto-approval status, or warns you if the session exceeds daily limits.
5. Click **Submit DTR Entry**. The entry is **automatically approved** immediately upon submission. Only extra hours (exceeding daily/monthly limits) will require administrator approval.

> [!WARNING]
> **Overlap Prevention**: You cannot file a time interval that overlaps with an existing entry on the same date. If an overlap occurs, the system flags the conflict and blocks submission.

---

### 4.3 Reviewing DTR Records & Audit Histories

To inspect past records:
1. Click the **My DTR Records** tab.
2. Use the filters to view entries by:
   - **Pay Period**: Filter by active, upcoming, or past pay periods.
   - **Status**: Filter by `Approved`, `Submitted`, `Adjusted`, `Extra Hours Pending`, or `Rejected`.
3. Each record displays:
   - Work Date, Time In, and Time Out.
   - Regular Hours vs. Extra Hours.
   - Total Payable Hours.
   - Status badge and accomplishment notes.

#### Editing Accomplishment Remarks:
You can update your remarks as long as the record remains in `submitted` or `adjusted` status:
1. Click the **Edit Remarks** (pencil) icon next to the record.
2. Update your notes and save.
3. Once approved or locked by an administrator, remarks cannot be edited.

#### Viewing Revision History:
If an administrator adjusted your time, an **Audit History** button appears on the record:
1. Click **View History**.
2. Inspect the before and after values, who adjusted the time, and the reason provided.

---

### 4.4 Submitting DTR Correction Requests

If you missed a punch, timed out incorrectly, or need a past session corrected:
1. Click the **Correction Requests** tab.
2. Click **+ New Correction Request**.
3. Select whether the correction applies to an **Existing Filed Session** or is a **New Unrecorded Session**.
4. Enter the **Work Date**, **Proposed Time In**, and **Proposed Time Out**.
5. Provide a detailed **Justification Reason** (minimum 5 characters).
6. Click **Submit Request**.

Your request is routed to the administrator queue. Once reviewed, you will see whether it was approved or rejected along with any review notes from the administrator.

---

### 4.5 Tracking Payment Status (Wage Privacy View)

The platform protects wage privacy: employees track approved hours, hours awaiting review, and payment settlement without peso amounts being visible.

1. Click the **Payment Status (Hours Only)** tab.
2. View your pay cycles:
   - **Pay Period Range**: Cycle start and end dates.
   - **Total Approved Hours**: Payable hours confirmed by management.
   - **Hours Awaiting Approval**: Logged hours currently pending review.
   - **Payment Status**: `Pending`, `Processing`, `Paid`, `On Hold`, or `Cancelled`.
   - **Scheduled / Paid Date**: Expected disbursement date.
3. Click **View Sessions** to view all individual work sessions associated with that pay cycle.

---

### 4.6 Managing Profile & Contact Information

1. Click the **My Profile** tab.
2. Review your read-only company details (Department, Employee ID, Official Email, Hire Date, and Pay Frequency).
3. Update your editable contact details:
   - **Contact Phone Number**
   - **Residential Address**
   - **Emergency Contact (Name & Phone Number)**
4. Click **Save Contact Information**.

---

## 5. Administrator Guide

Administrators oversee operations, adjudicate overtime exceptions, review corrections, manage staff profiles, and prepare payroll. Standard timelogs recorded via punch in/out and manual DTR filings within hour limits are **automatically approved**—administrator approval is strictly reserved for **Extra Hours** and **Correction Requests**.

```
+----------------------------------------------------------------------------------------------------+
| Administrator Navigation Bar                                                                       |
| [ Admin Overview ] [ DTR Filings & Approvals ] [ Extra Hours Queue ] [ Corrections Queue ]        |
| [ Employees & Wages ] [ Pay Periods & Payroll ] [ Reports & Exports ] [ Audit Log ]                |
+----------------------------------------------------------------------------------------------------+
```

---

### 5.1 Admin Dashboard & Operational Action Queues

The **Admin Overview** provides a dashboard of system operations:
* **Pending Registrations Banner**: Alerts you to newly signed-up staff requiring approval.
* **Extra Hours Pending**: Number of sessions that exceeded daily/weekly hour limits (requires administrative approval).
* **Pending Corrections**: Time adjustments submitted by employees (requires administrative approval).
* **Filings to Review**: Legacy or adjusted timesheets awaiting approval. Standard punch and manual filings are automatically approved by the system.
* **Recent Filings Stream**: Real-time log of the latest entries submitted across the team.

---

### 5.2 Reviewing & Approving DTR Filings

1. Navigate to **DTR Filings & Approvals**.
2. Filter entries using the filter bar:
   - **Employee**: View all staff or select a specific individual.
   - **Department**: Filter by organizational team.
   - **Pay Period**: Narrow to the current open pay cycle.
   - **Status**: Filter by `submitted`, `adjusted`, `approved`, etc.
3. For each entry, review the logged times, decimal hours, and accomplishment remarks.
4. Actions:
   - **Approve**: Click the green **Checkmark** button. Payable hours are confirmed and locked for payroll.
   - **Reject**: Click the red **X** button. A modal opens requiring a rejection reason. Rejected entries receive 0 payable hours.

> [!IMPORTANT]
> **Conflict of Interest Protection**: Administrators cannot approve their own DTR records. Another administrator or the system administrator must review administrative filings.

---

### 5.3 Bulk Approvals

To streamline daily timesheet processing:
1. In **DTR Filings & Approvals**, locate the **Bulk Approve** button in the header.
2. The button indicates how many clean entries are eligible (entries in `submitted` or `adjusted` status that have **zero extra hours**).
3. Click **Bulk Approve**. All eligible entries are approved in one action and logged in the audit trail.

---

### 5.4 Timesheet Adjustments & Closing Sessions on Behalf

#### Adjusting an Existing Entry:
If an employee recorded incorrect times:
1. Find the entry in **DTR Filings & Approvals** and click the **Adjust (Pencil)** icon.
2. Enter the corrected **Time In** and **Time Out**.
3. Enter a mandatory **Adjustment Reason** (minimum 5 characters).
4. Click **Save Adjustment**.
5. The entry status updates to `adjusted`, recalculated decimal hours take effect, and the change is recorded in the permanent revision history.

#### Timing Out on Behalf of an Employee:
If an employee left an open session overnight or forgot to clock out:
1. Filter the status to **Open Sessions**.
2. Click **Close Session on Behalf**.
3. Specify the appropriate **Time Out** and enter a required **Justification Reason**.
4. Click **Confirm Time Out**. The open punch is closed and logged.

---

### 5.5 Adjudicating Extra Hours (Overtime Decisions)

When an employee works beyond their daily (e.g., 8.00h), weekly (40.00h), or monthly thresholds, the excess time routes to the **Extra Hours Queue**.

```
Session: 10.50h Total
├── Regular Portion: 8.00h (Automatically approved as standard time)
└── Extra Portion:   2.50h (Routed to Extra Hours Queue)
                     ├── Option A: "Approve All" (10.50h payable)
                     ├── Option B: "Regular Only" (8.00h payable, 2.50h declined with note)
                     └── Option C: "Reject / Decline Session" (0.00h payable, whole entry rejected with note)
```

1. Navigate to **Extra Hours Queue**.
2. Review the session details:
   - Total hours, regular portion, and extra hours.
   - Daily/weekly limit exceeded and employee accomplishment remarks.
3. Select an adjudication decision:
   - **Approve All (Regular + Extra)**: Approves both regular and extra hours for payout.
   - **Approve Regular Only (Decline Extra)**: Opens a modal requiring a decline justification note. Only regular hours are payable; extra hours are declined.
   - **Reject / Decline Session**: Opens a modal requiring a rejection justification note. Rejects the entire session (0.00h payable) for erroneous or unauthorized filings.

---

### 5.6 Adjudicating Correction Requests

1. Navigate to **Corrections Queue**.
2. View pending requests displaying a side-by-side comparison:
   - **Original Recorded Session** vs. **Proposed Correction**.
   - Employee's stated reason.
3. Select an action:
   - **Approve Correction**: Updates the underlying DTR entry (or creates a new session) to match the proposed times.
   - **Reject Correction**: Requires an administrator explanation note returned to the employee.

---

### 5.7 Employee & Wage Management

Navigate to **Employees & Wages** to manage team members.

#### Creating an Account Directly:
1. Click **+ Add New User**.
2. Enter the user's name, email, employee number, position, department, and starting hourly wage.
3. Select their pay frequency (`Monthly` is the system standard).
4. Click **Create User**.

#### Setting or Adjusting Hourly Wages:
1. In the employee directory, click **Set Wage**.
2. Enter the new **Hourly Rate**, the **Effective Date**, and an **Audit Note** explaining the change.
3. Click **Update Wage Rate**.
4. The system closes the previous wage record and records the change in the employee's **Wage History**.

#### Updating Employee Position & Department:
1. Under **Employees & Wages**, select the employee profile from the Staff Directory.
2. In the management panel on the right, update the **Position / Job Title** or **Department**.
3. Press **Enter**, click outside the field, or click **Save**; the changes take effect immediately across all rosters, filings, and payroll exports.

#### Viewing & Managing Contact & Emergency Info:
1. Under **Employees & Wages**, select any employee profile.
2. In the right management card, administrators can review the employee's **Official Email**, **Contact Phone Number**, **Residential Address**, and highlighted **Emergency Contact Info**.
3. Administrators can use the quick **Call** shortcut or update details as needed (changes automatically persist).

#### Administrator "My Profile" Page:
Administrators and System Administrators have their own **My Profile** tab accessible from the top navigation bar, the user account menu in the top-right corner, and the mobile navigation drawer.

From their profile page, administrators can:
1. Update their **First Name** and **Last Name**.
2. Update their **Position / Job Title**.
3. Maintain their **Contact Phone Number**, **Residential Address**, and **Emergency Contact**.
4. Configure their **Bank or eWallet Payout Details**.
5. Trigger **Change Password**.

> [!CAUTION]
> **Admin Wage Protection**: Standard administrators **cannot** view, set, or modify their own hourly rate or the rates of other administrators. Administrator compensation is managed exclusively by the System Administrator.

#### Account Status & Password Resets:
* **Active / Inactive / Locked**: Toggle employee statuses to suspend or restore platform access.
* **Reset Password**: Click **Send Reset Link** to trigger a password reset email for the employee.

---

### 5.8 Approving New User Registrations

When new staff register via Google or email:
1. Go to **Employees & Wages** and switch to the **Pending Registrations** tab.
2. Click **Review & Approve** on the applicant card.
3. Fill out the assignment form:
   - **Role**: Assign `employee` or `admin`.
   - **Job Position & Department**.
   - **Hourly Pay Rate** and **Pay Frequency** (default: `Monthly`).
   - **Clock-In Privilege**: Check whether this account should be permitted to clock in.
4. Click **Confirm & Activate User**. The account is activated immediately.
5. If the registration is unauthorized, click **Decline** and provide a reason.

---

### 5.9 Pay Period Processing & Payroll Generation

1. Navigate to **Pay Periods & Payroll**.
2. Select the relevant pay period from the sidebar.
3. **Pre-Close Verification**:
   - Click **Run Pre-Close Check**.
   - The system verifies that there are zero unreviewed filings, zero pending extra hours, and zero open sessions.
4. **Closing the Period**:
   - Once all entries are resolved, click **Close Pay Period**.
   - The system calculates payable hours for all eligible staff and generates batch payment lines.
5. **Locking the Period**:
   - Once payment figures are reviewed, click **Lock Pay Period**.
   - Locking makes the period immutable to standard administrators. Only the System Administrator can reopen locked periods.

---

### 5.10 Payment Settlement Management

In the **Pay Periods & Payroll** tab, track disbursements:
* **Mark as Paid**:
  1. Click **Mark Paid** on a record.
  2. Select the **Payment Method** (`Bank Transfer`, `Direct Deposit`, `Check`, or `Cash`).
  3. Enter the mandatory **Reference / Transaction Number**.
  4. Confirm payment. The record updates to `Paid` with a timestamp.
* **Place On Hold**:
  1. Click **Hold**.
  2. Enter a mandatory reason (e.g., "Awaiting bank account update").
  3. The reason is visible to the employee on their status portal.
* **Cancel Payment**: Set status to cancelled with an audit reason.

---

### 5.11 Operational Reports & CSV Exports

Navigate to **Reports & Exports** to export reporting data to CSV:

| Report Type | Included Columns | Primary Use Case |
| :--- | :--- | :--- |
| **Hours by Employee** | Employee ID, Name, Department, Regular Hours, Extra Hours, Total Hours, Approved Hours | Departmental resource planning & productivity review |
| **Payroll Summary** | Period Range, Employee ID, Name, Approved Hours, Wage, Gross Pay, Payment Status, Method, Ref # | Direct accounting import and bank batch disbursement |
| **Extra Hours Report** | Date, Employee, Times, Regular, Extra, Limit Crossed, Extra Status, Review Note | Overtime compliance auditing and management oversight |
| **Accomplishments** | Date, Employee, Department, In/Out Times, Total Hours, Task Remarks | Performance evaluation and client billing backup |

To export: Select the report tab, filter by pay period, and click **Export CSV**.

---

### 5.12 System Audit Log Inspection

Navigate to **Audit Log** to inspect an immutable record of all system events:
* Track actions including `DTR_TIME_IN`, `DTR_TIME_OUT`, `DTR_ADJUSTED`, `WAGE_UPDATED`, `PERIOD_CLOSED`, and `PAYMENT_PAID`.
* Each entry logs the timestamp, actor, action code, and details including before/after values.
* Use the search bar to locate specific employees, actions, or entity IDs.

---

## 6. System Administrator (Super Admin) Guide

The **System Administrator** holds root governance privileges.

```
+----------------------------------------------------------------------------------------------------+
| System Administrator Navigation Bar                                                                |
| [ Admin View ] [ DTR Review ] [ System Admin Control Panel ] [ All Users ] [ Pay Periods ] [ Audit ]|
+----------------------------------------------------------------------------------------------------+
```

---

### 6.1 Hidden Super Admin Architecture
To prevent tampering and maintain executive privacy:
* The primary System Administrator account is flagged with `is_hidden = true`.
* The account is hidden from all user directories, employee drop-downs, and regular admin views.
* Only users with the `system_admin` role can see and access the **System Admin Control Panel**.

---

### 6.2 Administrator Account Governance & Clock-In Permissions
In the Control Panel under **Manage Admin Accounts & Wages**:
* View all company administrators.
* **Toggle Admin Clock-In**: Standard administrators are management-only by default. If an administrator also performs billable work, turn on **Clocks In & Paid**. This enables their punch station and assigns them to pay periods.
* Create new administrator accounts.

---

### 6.3 Setting & Modifying Administrator Wages
To avoid conflicts of interest, regular administrators cannot view or adjust administrative pay:
1. In the Control Panel, click **Set Admin Wage** on an administrator profile.
2. Enter the hourly rate, effective date, and administrative memo.
3. Save the rate. The compensation record is updated in the wage history.

---

### 6.4 System-Wide Rules & Global Settings
Navigate to **System-Wide Rules & Settings** in the Control Panel:
* **Work Week Calculation Type**: Set to `monday` (Monday through Sunday) or `month_based`.
* **Semi-Monthly Pay Date Rule**: Choose `16th_and_1st` (1st–15th paid on 16th; 16th–End paid on 1st) or `15th_and_end`.
* **Weekly / Monthly Pay Date Rules**: Set scheduled disbursement dates.
* **Weekend Pay Date Handling**: Configure whether pay dates falling on weekends roll to the `previous_business_day` or `next_business_day`.
* **Minimum Remarks Length**: Set the minimum character count for accomplishment notes (default: 10 characters).
* **Company-Wide Hour Thresholds**:
  - Daily limit (e.g., `8.00` hours)
  - Weekly limit (e.g., `40.00` hours)
  - Monthly limit (e.g., `160.00` hours)
* **Timezone & Currency**: Default: `Asia/Manila (UTC+8)` and `₱`.

---

### 6.5 Emergency Period Unlocks & Reopening
When a pay period is closed and locked, standard administrators cannot modify its records. If a retroactive correction is required:
1. Navigate to **Period Unlock & Payment Reversals**.
2. Select the locked pay period.
3. Enter a mandatory, permanent **Reopen Reason**.
4. Click **Reopen Pay Period**.
5. The period status reverts to `open`, and the action is logged in the system audit trail.

---

### 6.6 Payment Reversals
If a payment was marked as `Paid` in error or requires disbursement cancellation:
1. In **Period Unlock & Payment Reversals**, select the payment transaction.
2. Enter a mandatory **Reversal Reason**.
3. Click **Reverse Payment**.
4. The payment record status reverts to `Pending`, and the disbursement timestamp is cleared.

---

### 6.7 Data Retention, Archiving & Safe Purging
To comply with legal retention requirements:
1. Navigate to **Data Retention & Archiving**.
2. Review periods past the statutory retention window.
3. To purge an archived period:
   - Select the pay period.
   - Type **`PURGE`** in the confirmation box to confirm.
   - Click **Execute Retention Purge**.
   - Associated DTR records and payments are purged, and the period is marked as `purged`.

---

## 7. Calculations, Logic & Business Rules

### 7.1 Decimal Hour Conversion Rules

The system tracks all working durations in decimal hours rounded to two decimal places:

$$\text{Decimal Hours} = \text{round}\left(\frac{\text{Minutes Worked}}{60}, 2\right)$$

#### Conversion Reference Table:
| Minutes Worked | Decimal Hours | Formatted Dual Display |
| :---: | :---: | :---: |
| 15 min | **0.25** | `0.25 h (15m)` |
| 20 min | **0.33** | `0.33 h (20m)` |
| 30 min | **0.50** | `0.50 h (30m)` |
| 45 min | **0.75** | `0.75 h (45m)` |
| 60 min | **1.00** | `1.00 h (1h)` |
| 90 min | **1.50** | `1.50 h (1h 30m)` |
| 120 min | **2.00** | `2.00 h (2h)` |
| 165 min | **2.75** | `2.75 h (2h 45m)` |
| 480 min (8h) | **8.00** | `8.00 h (8h)` |
| 510 min (8.5h) | **8.50** | `8.50 h (8h 30m)` |

---

### 7.2 Overnight Shifts (Midnight Crossing)
When a shift starts in the evening and concludes the following morning (e.g., `22:00` to `03:00`):
* The system checks whether `time_out` is numerically earlier than `time_in`.
* If so, the calculation automatically adds $24\text{ hours} \times 60\text{ minutes} = 1440\text{ minutes}$ to the end time:
  $$\text{Minutes} = (03:00 + 24\text{h}) - 22:00 = 27:00 - 22:00 = 5\text{ hours} = 300\text{ minutes} \implies \mathbf{5.00\text{ h}}$$
* Overnight shifts are calculated without manual date math. Single shifts cannot exceed 24 hours.

---

### 7.3 Interval Overlap Prevention
To prevent accidental double-booking of hours:
* Every new punch or manual DTR filing is validated against the user's existing records on the same date:
  $$\text{Overlap Condition} = \max(\text{Start}_A, \text{Start}_B) < \min(\text{End}_A, \text{End}_B)$$
* Overlapping submissions are blocked immediately with an explanatory error.

---

### 7.4 Threshold Limiting Logic (Daily, Weekly, Monthly)

The platform evaluates hours sequentially:
1. When a session is submitted, the system queries all prior approved and submitted hours for the same day.
2. If $\text{Prior Hours} + \text{New Hours} > \text{Daily Limit}$ (e.g., 8.00h):
   - $\text{Regular Hours} = \max(0, \text{Daily Limit} - \text{Prior Hours})$
   - $\text{Extra Hours} = \text{New Hours} - \text{Regular Hours}$
3. If extra hours exist:
   - Session status is flagged as `extra_hours_pending`.
   - The session routes to the administrator's **Extra Hours Queue**.
   - Payable hours reflect only the regular portion until an administrator adjudicates the overtime.

---

### 7.5 Tamper-Resistant Server Clock & Test Simulation

#### Production Server Clock:
All punch actions evaluate the server timestamp. Local clock modifications on employee laptops, phones, or virtual machines are ignored.

#### Testing Simulation Modal:
For training, testing, or end-of-period verification:
1. Click the **Server Clock** button in the top navigation bar.
2. Select a target **Server Work Date** and **Server Time (HH:mm)**, or choose a preset (e.g., `Sep 16 (Pay Date)`).
3. Click **Apply Server Time**. The UI updates to simulate that moment in time.
4. Click **Use Real-time Clock** to restore live operation.

---

## 8. Troubleshooting & Frequently Asked Questions (FAQ)

### Q1: I tried to clock in or file DTR, but the system says "No hourly wage has been configured".
* **Cause**: To protect payroll accuracy, the system requires an active wage rate before work sessions can be recorded.
* **Resolution**: An administrator must go to **Employees & Wages**, select the user profile, and assign an hourly wage with an effective date.

### Q2: Why does my manual DTR entry say "Pay period covering date is CLOSED or LOCKED"?
* **Cause**: The pay cycle covering that date has been finalized by management. New time entries cannot be added to closed pay periods.
* **Resolution**: If an entry must be added retroactively, submit a **Correction Request** or contact the System Administrator to evaluate whether the period should be reopened.

### Q3: When registering, I received an "Email rate limit exceeded" notification.
* **Cause**: Supabase's default development email service allows 3–4 emails per hour.
* **Resolution**: The server-side registration endpoint automatically bypasses this limit by auto-confirming user accounts. If this warning persists, ensure custom SMTP is configured in the Supabase Dashboard under Authentication Settings.

### Q4: An employee clocked in and left for the day without clocking out. How do we fix this?
* **Resolution**: 
  1. Have an administrator navigate to **DTR Filings & Approvals**.
  2. Filter status by **Open Sessions**.
  3. Click **Close Session on Behalf**, specify their actual departure time, enter an audit reason, and submit.

### Q5: How do employees know if their extra hours were declined?
* **Resolution**: On the employee's **My DTR Records** tab, the entry displays the `Adjusted` or `Approved` status badge. Clicking the entry reveals the administrator's justification note explaining why overtime was declined.

### Q6: Can regular administrators see how much other administrators earn?
* **Resolution**: No. All administrator wages are hidden from regular administrators. Only the root System Administrator can see and adjust management compensation.

---

*WMedlaw DTR & Timekeeping — Operations Guide & User Manual (v1.0)*
