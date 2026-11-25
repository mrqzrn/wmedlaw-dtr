import type { PayPeriod, DtrEntry } from './types';

/**
 * DTR and Timekeeping utility functions.
 * All hours are handled in decimal format (e.g. 1.50 = 1h 30m, 2.75 = 2h 45m).
 */

/**
 * Converts a time string "HH:mm" or ISO string into minutes from midnight
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  if (timeStr.includes('T')) {
    const d = new Date(timeStr);
    return d.getHours() * 60 + d.getMinutes();
  }
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Computes minutes worked between timeIn and timeOut.
 * Handles overnight shifts crossing midnight (e.g. 22:00 to 03:00 = 5 hours = 300 minutes).
 */
export function computeMinutesWorked(
  timeIn: string,
  timeOut: string,
  startDate?: string,
  endDate?: string
): number {
  if (startDate && endDate && startDate !== endDate) {
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const [sh, smin] = timeIn.split(':').map(Number);
    const startMs = new Date(sy, sm - 1, sd, sh, smin, 0).getTime();

    const [ey, em, ed] = endDate.split('-').map(Number);
    const [eh, emin] = timeOut.split(':').map(Number);
    const endMs = new Date(ey, em - 1, ed, eh, emin, 0).getTime();

    const diffMins = Math.round((endMs - startMs) / (60 * 1000));
    return Math.max(0, diffMins);
  }

  const inMins = timeStringToMinutes(timeIn);
  let outMins = timeStringToMinutes(timeOut);

  // If timeOut is numerically earlier than timeIn, it crossed midnight into next day
  if (outMins < inMins) {
    outMins += 24 * 60;
  }
  return Math.max(0, outMins - inMins);
}

/**
 * Computes elapsed seconds worked for real-time live tickers.
 */
export function computeSecondsWorked(
  startTime: string,
  startDate?: string,
  currentTime?: string,
  currentDate?: string,
  currentSeconds: number = 0,
  createdAt?: string
): number {
  if (!startTime) return 0;

  // If exact ISO timestamp is available, use millisecond precision
  if (createdAt) {
    const createdMs = new Date(createdAt).getTime();
    if (!isNaN(createdMs)) {
      const nowMs = Date.now();
      const diffSecs = Math.floor((nowMs - createdMs) / 1000);
      if (diffSecs >= 0) {
        return diffSecs;
      }
    }
  }

  if (startDate && currentDate && startDate !== currentDate) {
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const [sh, smin] = startTime.split(':').map(Number);
    const startMs = new Date(sy, sm - 1, sd, sh || 0, smin || 0, 0).getTime();

    const [cy, cm, cd] = currentDate.split('-').map(Number);
    let ch = 0;
    let cmin = 0;
    if (currentTime) {
      [ch, cmin] = currentTime.split(':').map(Number);
    }
    const curMs = new Date(cy, cm - 1, cd, ch || 0, cmin || 0, currentSeconds || 0).getTime();
    const diffSecs = Math.floor((curMs - startMs) / 1000);
    return Math.max(0, diffSecs);
  }

  const inMins = timeStringToMinutes(startTime);
  let curMins = currentTime ? timeStringToMinutes(currentTime) : inMins;
  if (curMins < inMins) {
    curMins += 24 * 60;
  }
  const totalSecs = (curMins - inMins) * 60 + currentSeconds;
  return Math.max(0, totalSecs);
}

/**
 * Formats total seconds into "HH:mm:ss" display format.
 */
export function formatElapsedDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '00:00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/**
 * Convert minutes to decimal hours rounded to 2 decimal places.
 * Raw seconds are dropped first.
 * e.g.
 * 15 min -> 0.25
 * 20 min -> 0.33
 * 30 min -> 0.50
 * 90 min -> 1.50
 * 165 min -> 2.75
 * 470 min -> 7.83
 */
export function minutesToDecimalHours(minutes: number): number {
  if (!minutes || minutes <= 0) return 0;
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * Format decimal hours to 2 decimal places (e.g. 1.5 -> "1.50")
 */
export function formatDecimalHours(hours: number | undefined | null): string {
  if (hours === undefined || hours === null || isNaN(hours)) return '0.00';
  return hours.toFixed(2);
}

/**
 * Format dual representation: e.g. "1.50 h (1h 30m)"
 */
export function formatHoursWithClock(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const clock = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  return `${formatDecimalHours(hours)} h (${clock})`;
}

/**
 * Month abbreviations with "Sept." as requested.
 */
const MONTH_NAMES = [
  'Jan.',
  'Feb.',
  'Mar.',
  'Apr.',
  'May',
  'Jun.',
  'Jul.',
  'Aug.',
  'Sept.',
  'Oct.',
  'Nov.',
  'Dec.',
];

/**
 * Formats a date string (YYYY-MM-DD or ISO timestamp or Date object)
 * into "Sept. 01, 2026" display format.
 */
export function formatDate(dateVal: string | Date | null | undefined): string {
  if (!dateVal) return '—';

  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (!trimmed || trimmed === '—' || trimmed === 'N/A' || trimmed === 'null' || trimmed === 'undefined') {
      return '—';
    }

    // Direct match for YYYY-MM-DD (e.g. "2026-09-01") - avoid timezone offset shifts
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-');
      const monthIdx = parseInt(m, 10) - 1;
      const monthName = MONTH_NAMES[monthIdx] || m;
      const padDay = d.padStart(2, '0');
      return `${monthName} ${padDay}, ${y}`;
    }

    // If it's an ISO timestamp with time (e.g. "2026-09-12T16:00:00Z")
    if (trimmed.includes('T')) {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        const year = parsed.getFullYear();
        const monthIdx = parsed.getMonth();
        const day = String(parsed.getDate()).padStart(2, '0');
        const monthName = MONTH_NAMES[monthIdx] || '';
        return `${monthName} ${day}, ${year}`;
      }
    }

    // Attempt Date parse for other formats
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const monthIdx = parsed.getMonth();
      const day = String(parsed.getDate()).padStart(2, '0');
      const monthName = MONTH_NAMES[monthIdx] || '';
      return `${monthName} ${day}, ${year}`;
    }

    return trimmed;
  }

  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    const year = dateVal.getFullYear();
    const monthIdx = dateVal.getMonth();
    const day = String(dateVal.getDate()).padStart(2, '0');
    const monthName = MONTH_NAMES[monthIdx] || '';
    return `${monthName} ${day}, ${year}`;
  }

  return '—';
}

/**
 * Formats a time string ("HH:mm", "HH:mm:ss", or ISO string)
 * into "01:00 PM" display format (or "01:00:00 PM" if includeSeconds is true).
 */
export function formatTime(
  timeVal: string | Date | null | undefined,
  includeSeconds = false
): string {
  if (!timeVal) return '—';

  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  let hasSeconds = false;

  if (timeVal instanceof Date) {
    if (isNaN(timeVal.getTime())) return '—';
    hours = timeVal.getHours();
    minutes = timeVal.getMinutes();
    seconds = timeVal.getSeconds();
    hasSeconds = true;
  } else if (typeof timeVal === 'string') {
    const trimmed = timeVal.trim();
    if (!trimmed || trimmed === '—' || trimmed === 'null' || trimmed === 'undefined') {
      return '—';
    }
    // If it already has AM or PM or is text like "Open", "In Progress"
    if (trimmed.includes('AM') || trimmed.includes('PM') || trimmed === 'Open' || trimmed === 'In Progress') {
      return trimmed;
    }

    // ISO timestamp e.g. "2026-09-12T16:00:00Z"
    if (trimmed.includes('T')) {
      const parsed = new Date(trimmed);
      if (isNaN(parsed.getTime())) return trimmed;
      hours = parsed.getHours();
      minutes = parsed.getMinutes();
      seconds = parsed.getSeconds();
      hasSeconds = true;
    } else {
      // Split "HH:mm" or "HH:mm:ss"
      const parts = trimmed.split(':').map(Number);
      if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) {
        return trimmed;
      }
      hours = parts[0];
      minutes = parts[1];
      if (parts.length >= 3 && !isNaN(parts[2])) {
        seconds = parts[2];
        hasSeconds = true;
      }
    }
  } else {
    return '—';
  }

  const hour12 = hours % 12 || 12;
  const padHour = String(hour12).padStart(2, '0');
  const padMin = String(minutes).padStart(2, '0');
  const meridian = hours >= 12 ? 'PM' : 'AM';

  if (includeSeconds) {
    const padSec = String(seconds).padStart(2, '0');
    return `${padHour}:${padMin}:${padSec} ${meridian}`;
  }

  return `${padHour}:${padMin} ${meridian}`;
}

/**
 * Formats an ISO string or Date into "Sept. 01, 2026 01:00 PM" display format.
 */
export function formatDateTime(val: string | Date | null | undefined, includeSeconds = false): string {
  if (!val) return '—';
  const datePart = formatDate(val);
  const timePart = formatTime(val, includeSeconds);
  if (datePart === '—' && timePart === '—') return '—';
  if (datePart === '—') return timePart;
  if (timePart === '—') return datePart;
  return `${datePart} ${timePart}`;
}

/**
 * Format clock time "HH:mm" to 12-hour display format e.g. "01:00 PM"
 */
export function formatTimeDisplay(timeStr: string | null): string {
  return formatTime(timeStr);
}

/**
 * Check if two time intervals on the same date overlap
 */
export function checkIntervalOverlap(
  startA: string,
  endA: string | null,
  startB: string,
  endB: string | null
): boolean {
  const inA = timeStringToMinutes(startA);
  const outA = endA ? timeStringToMinutes(endA) : 24 * 60; // open session extends to day end
  const inB = timeStringToMinutes(startB);
  const outB = endB ? timeStringToMinutes(endB) : 24 * 60;

  return Math.max(inA, inB) < Math.min(outA, outB);
}

/**
 * Currency formatter
 */
export function formatCurrency(amount: number, symbol = '₱'): string {
  return `${symbol}${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format "YYYY-MM" to readable "Month YYYY" (e.g. "2026-10" -> "October 2026")
 */
export function formatMonthYear(monthStr: string): string {
  if (!monthStr || !monthStr.includes('-')) return monthStr;
  const [yearStr, monthNumStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthNumStr, 10) - 1;
  if (isNaN(year) || isNaN(monthIndex)) return monthStr;
  const date = new Date(year, monthIndex, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Get date range for a month "YYYY-MM"
 */
export function getMonthDateRange(monthStr: string): { start: string; end: string } {
  if (!monthStr || !monthStr.includes('-')) {
    const today = new Date().toISOString().slice(0, 10);
    return { start: today, end: today };
  }
  const [yearStr, monthNumStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthNumStr, 10);
  const lastDay = new Date(year, monthNum, 0).getDate();
  const start = `${yearStr}-${monthNumStr.padStart(2, '0')}-01`;
  const end = `${yearStr}-${monthNumStr.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

/**
 * Get a list of recent YYYY-MM months including current month and prior months
 */
export function getRecentMonths(centerDateStr?: string, pastCount = 5, futureCount = 1): string[] {
  const base = centerDateStr ? new Date(centerDateStr) : new Date();
  const months: string[] = [];
  const currentYear = base.getFullYear();
  const currentMonth = base.getMonth();

  for (let offset = -pastCount; offset <= futureCount; offset++) {
    const d = new Date(currentYear, currentMonth + offset, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
  }
  return months;
}

/**
 * Calculate scheduled monthly pay date based on rule and weekend adjustment
 */
export function calculateMonthlyPayDate(
  year: number,
  month: number, // 1-12
  rule: '1st' | 'end_of_month' = '1st',
  weekendRule: 'previous_business_day' | 'next_business_day' = 'next_business_day'
): string {
  let targetYear = year;
  let targetMonth = month;
  let targetDay = 1;

  if (rule === 'end_of_month') {
    targetDay = new Date(year, month, 0).getDate();
  } else {
    // 1st of following month
    targetMonth = month + 1;
    if (targetMonth > 12) {
      targetMonth = 1;
      targetYear = year + 1;
    }
    targetDay = 1;
  }

  const d = new Date(targetYear, targetMonth - 1, targetDay);
  const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat

  if (dayOfWeek === 0) {
    // Sunday
    if (weekendRule === 'previous_business_day') {
      d.setDate(d.getDate() - 2); // Friday
    } else {
      d.setDate(d.getDate() + 1); // Monday
    }
  } else if (dayOfWeek === 6) {
    // Saturday
    if (weekendRule === 'previous_business_day') {
      d.setDate(d.getDate() - 1); // Friday
    } else {
      d.setDate(d.getDate() + 2); // Monday
    }
  }

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Creates a Monthly PayPeriod object for a given year & month
 */
export function createMonthlyPayPeriod(
  year: number,
  month: number, // 1-12
  rule: '1st' | 'end_of_month' = '1st',
  weekendRule: 'previous_business_day' | 'next_business_day' = 'next_business_day',
  status: 'open' | 'closed' | 'locked' = 'open'
): PayPeriod {
  const lastDay = new Date(year, month, 0).getDate();
  const yStr = String(year);
  const mStr = String(month).padStart(2, '0');
  const startDate = `${yStr}-${mStr}-01`;
  const endDate = `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`;
  const payDate = calculateMonthlyPayDate(year, month, rule, weekendRule);

  return {
    id: `pp-m-${yStr}-${mStr}`,
    frequency: 'monthly',
    start_date: startDate,
    end_date: endDate,
    pay_date: payDate,
    status,
  };
}

/**
 * Generate a standardized human-readable monthly DTR reference tag
 * Example: REF-DTR-202609-EMP80220
 */
export function generateMonthlyDtrRefTag(
  month: string,
  employeeNo?: string,
  userId?: string
): string {
  const cleanMonth = (month || '').replace(/[^0-9]/g, '');
  const cleanEmpNo = (employeeNo || userId?.slice(0, 8) || 'CERT')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  return `REF-DTR-${cleanMonth}-${cleanEmpNo}`;
}


// ============================================================================
// MAXIMUM SESSION DURATION / AUTO-CLOSE OF FORGOTTEN PUNCH-OUTS
// ============================================================================

/** A punch-in session is automatically closed once it reaches this many hours. */
export const MAX_SESSION_HOURS = 8;
export const MAX_SESSION_MINUTES = MAX_SESSION_HOURS * 60;
export const AUTO_CLOSE_REMARK_TAG = '[Auto-closed]';

function wallClockToMs(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.slice(0, 5).split(':').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1, h || 0, mi || 0);
}

/**
 * Minutes elapsed between a punch-in (date + HH:mm) and "now" (date + HH:mm), both in the same
 * wall-clock timezone. Never negative (a "now" earlier than the punch-in returns 0).
 */
export function minutesSincePunchIn(workDate: string, timeIn: string, nowDate: string, nowTime: string): number {
  if (!workDate || !timeIn || !nowDate || !nowTime) return 0;
  return Math.max(0, Math.round((wallClockToMs(nowDate, nowTime) - wallClockToMs(workDate, timeIn)) / 60000));
}

/** True when an open session has reached the maximum allowed duration. */
export function isSessionOverMaxDuration(
  entry: Pick<DtrEntry, 'work_date' | 'time_in' | 'time_out' | 'status'>,
  nowDate: string,
  nowTime: string
): boolean {
  if (entry.time_out || entry.status !== 'open') return false;
  return minutesSincePunchIn(entry.work_date, entry.time_in, nowDate, nowTime) >= MAX_SESSION_MINUTES;
}

/** Adds minutes to a wall-clock date/time and returns the new { date, time } (HH:mm). */
export function addMinutesToWallClock(date: string, time: string, minutes: number): { date: string; time: string } {
  const d = new Date(wallClockToMs(date, time) + minutes * 60000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

/**
 * Builds the closed version of a forgotten open session: time-out is set to exactly
 * MAX_SESSION_HOURS after time-in, hours are split into regular/extra using the same daily and
 * monthly limits as a normal punch-out, and the entry is flagged for administrator review
 * (never auto-approved, since the real time-out is unknown).
 *
 * Deterministic for the same input, so it is safe for both the browser and the server to apply it.
 */
export function buildAutoClosedEntry(
  entry: DtrEntry,
  opts: {
    dayLimit?: number | null;
    monthLimit?: number | null;
    priorDayHours?: number;
    priorMonthHours?: number;
    closedAtIso?: string;
  } = {}
): DtrEntry {
  const closedAt = opts.closedAtIso || new Date().toISOString();
  const out = addMinutesToWallClock(entry.work_date, entry.time_in, MAX_SESSION_MINUTES);
  const hours = MAX_SESSION_HOURS;
  const priorDay = opts.priorDayHours || 0;
  const priorMonth = opts.priorMonthHours || 0;

  let regular = hours;
  let extra = 0;
  let extraLimit: DtrEntry['extra_hours_limit'] = null;
  let extraNote = '';

  if (opts.dayLimit && priorDay + hours > opts.dayLimit) {
    regular = Math.min(hours, Math.max(0, opts.dayLimit - priorDay));
    extra = Math.round((hours - regular) * 100) / 100;
    if (extra > 0) {
      extraLimit = 'day';
      extraNote = `Crossed daily limit of ${opts.dayLimit.toFixed(2)}h by ${extra.toFixed(2)}h`;
    }
  }
  if (opts.monthLimit && priorMonth + regular > opts.monthLimit) {
    const allowed = Math.max(0, opts.monthLimit - priorMonth);
    if (allowed < regular) {
      regular = allowed;
      extra = Math.round((hours - regular) * 100) / 100;
      if (!extraLimit) {
        extraLimit = 'month';
        extraNote = `Crossed monthly limit of ${opts.monthLimit.toFixed(2)}h by ${extra.toFixed(2)}h`;
      } else {
        extraNote += `; also crossed monthly limit of ${opts.monthLimit.toFixed(2)}h`;
      }
    }
  }

  const reason = `No punch-out recorded. Session automatically closed after the ${MAX_SESSION_HOURS}-hour maximum. Actual time-out needs verification.`;
  const existingRemarks = (entry.remarks || '').trim();
  const remarks = existingRemarks.startsWith(AUTO_CLOSE_REMARK_TAG)
    ? existingRemarks
    : `${AUTO_CLOSE_REMARK_TAG} ${reason}${existingRemarks ? ` ${existingRemarks}` : ''}`;

  const revisionId = `rev-autoclose-${entry.id}`;
  const revisions = (entry.revisions || []).some((r) => r.id === revisionId)
    ? entry.revisions
    : [
        ...(entry.revisions || []),
        {
          id: revisionId,
          dtr_entry_id: entry.id,
          changed_by_name: 'System',
          display_actor: 'System (Auto-close)',
          field: 'time_out',
          old_value: '',
          new_value: out.time,
          reason,
          changed_at: closedAt,
        },
      ];

  return {
    ...entry,
    time_out: out.time,
    remarks,
    minutes_worked: MAX_SESSION_MINUTES,
    hours,
    regular_hours: regular,
    extra_hours: extra,
    extra_hours_status: extra > 0 ? 'pending' : 'none',
    extra_hours_limit: extraLimit,
    extra_hours_note: extraNote,
    payable_hours: regular,
    status: extra > 0 ? 'extra_hours_pending' : 'submitted',
    reviewed_by_name: undefined,
    reviewed_at: undefined,
    revisions,
    updated_at: closedAt,
  };
}

/** Current wall-clock date (YYYY-MM-DD) and time (HH:mm) in an IANA timezone, e.g. "Asia/Manila". */
export function nowInTimeZone(timeZone: string, at: Date = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

/** Extracts an IANA zone from a settings label like "Asia/Manila (UTC+8)"; falls back to Asia/Manila. */
export function resolveTimeZone(label?: string | null): string {
  const candidate = (label || '').trim().split(/\s+/)[0];
  if (candidate) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: candidate });
      return candidate;
    } catch {
      // invalid zone label
    }
  }
  return 'Asia/Manila';
}
