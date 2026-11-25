import { createServerClient } from '@/lib/supabase/server';
import { createEncryptedResponse, parseEncryptedRequest, authenticateApiRequest } from '@/lib/crypto-server';
import { buildAutoClosedEntry, isSessionOverMaxDuration, nowInTimeZone, resolveTimeZone, MAX_SESSION_HOURS } from '@/lib/utils-dtr';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabaseServer = createServerClient();

    // 1. Enforce strict authentication check: reject unauthenticated requests
    const auth = await authenticateApiRequest(request, supabaseServer);
    if (auth.error || !auth.user) {
      return createEncryptedResponse(
        { error: 'Unauthorized: Authentication required to access DTR records.' },
        401
      );
    }

    // 2. Fetch DTR entries:
    // Administrators can view all DTR entries across the entire organization.
    // Employees can ONLY view their own personal DTR records.
    let query = supabaseServer.from('dtr_entries').select('*').order('created_at', { ascending: false });

    if (!auth.isAdmin) {
      query = query.eq('user_id', auth.user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Could not query dtr_entries:', error.message);
      return createEncryptedResponse({ error: error.message }, 400);
    }

    // Augment entries with self-approval data from monthly_self_approvals
    let entries = data || [];

    // Auto-seed previous month (September 2026) entries for employee if missing
    if (!auth.isAdmin && auth.user) {
      const hasSepEntries = entries.some((e: any) => e.work_date && e.work_date.startsWith('2026-09'));
      if (!hasSepEntries) {
        const uidShort = auth.user.id.slice(0, 8);
        const sepEntries = [
          {
            id: `dtr-${uidShort}-sep1`,
            user_id: auth.user.id,
            work_date: '2026-09-12',
            time_in: '08:05',
            time_out: '09:35',
            remarks: 'Closed 14 support tickets',
            minutes_worked: 90,
            hours: 1.5,
            regular_hours: 1.5,
            extra_hours: 0,
            extra_hours_status: 'none',
            payable_hours: 1.5,
            hourly_rate_snapshot: 300,
            status: 'approved',
            source: 'self',
            pay_period_id: 'pp-m-sep',
            reviewed_by_name: 'Alex Rivera',
            reviewed_at: '2026-09-13T10:15:00Z',
            revisions: [],
          },
          {
            id: `dtr-${uidShort}-sep2`,
            user_id: auth.user.id,
            work_date: '2026-09-12',
            time_in: '13:00',
            time_out: '15:45',
            remarks: 'Updated FAQ, trained new hire',
            minutes_worked: 165,
            hours: 2.75,
            regular_hours: 2.75,
            extra_hours: 0,
            extra_hours_status: 'none',
            payable_hours: 2.75,
            hourly_rate_snapshot: 300,
            status: 'adjusted',
            source: 'self',
            pay_period_id: 'pp-m-sep',
            reviewed_by_name: 'Alex Rivera',
            reviewed_at: '2026-09-13T10:18:00Z',
            revisions: [
              {
                id: `rev-${uidShort}-2-1`,
                dtr_entry_id: `dtr-${uidShort}-sep2`,
                changed_by_name: 'Alex Rivera',
                display_actor: 'Operations Admin (Alex Rivera)',
                field: 'time_out',
                old_value: '16:00',
                new_value: '15:45',
                reason: 'Adjusted end time to remove 15-min personal break confirmed via Slack chat',
                changed_at: '2026-09-13T10:18:00Z',
              },
            ],
          },
          {
            id: `dtr-${uidShort}-sep3`,
            user_id: auth.user.id,
            work_date: '2026-09-13',
            time_in: '09:00',
            time_out: '12:30',
            remarks: 'Resolved enterprise client authentication roadblock and drafted response',
            minutes_worked: 210,
            hours: 3.5,
            regular_hours: 3.5,
            extra_hours: 0,
            extra_hours_status: 'none',
            payable_hours: 3.5,
            hourly_rate_snapshot: 300,
            status: 'approved',
            source: 'self',
            pay_period_id: 'pp-m-sep',
            reviewed_by_name: 'Alex Rivera',
            reviewed_at: '2026-09-14T09:00:00Z',
            revisions: [],
          },
          {
            id: `dtr-${uidShort}-sep4`,
            user_id: auth.user.id,
            work_date: '2026-09-14',
            time_in: '10:00',
            time_out: '14:30',
            remarks: 'Assisted queue during shift surge, verified API status endpoints',
            minutes_worked: 270,
            hours: 4.5,
            regular_hours: 4.5,
            extra_hours: 0,
            extra_hours_status: 'none',
            payable_hours: 4.5,
            hourly_rate_snapshot: 300,
            status: 'submitted',
            source: 'self',
            pay_period_id: 'pp-m-sep',
            revisions: [],
          },
          {
            id: `dtr-${uidShort}-sep5`,
            user_id: auth.user.id,
            work_date: '2026-09-15',
            time_in: '19:30',
            time_out: '22:00',
            remarks: 'Working from home on urgent nighttime outage triage',
            minutes_worked: 150,
            hours: 2.5,
            regular_hours: 2.5,
            extra_hours: 0,
            extra_hours_status: 'none',
            payable_hours: 2.5,
            hourly_rate_snapshot: 300,
            status: 'submitted',
            source: 'self',
            pay_period_id: 'pp-m-sep',
            revisions: [],
          },
        ];
        try {
          // await supabaseServer.from('dtr_entries').upsert(sepEntries);
          // entries = [...entries, ...sepEntries];
        } catch (seedErr) {
          console.warn('Auto-seed previous DTR error:', seedErr);
        }
      }
    }

    try {
      const { data: approvals } = await supabaseServer
        .from('monthly_self_approvals')
        .select('*');
      if (approvals && approvals.length > 0) {
        const approvedMap = new Set(
          approvals.map((a: any) => `${a.user_id}:${a.month}`)
        );
        const approvalDateMap = new Map(
          approvals.map((a: any) => [`${a.user_id}:${a.month}`, a.submitted_at])
        );
        const approvalRefMap = new Map(
          approvals.map((a: any) => {
            const refMatch = a.employee_note?.match(/\[REF:(.*?)\]/);
            const ref = a.reference_no || (refMatch ? refMatch[1] : null);
            return [`${a.user_id}:${a.month}`, ref];
          })
        );
        entries = entries.map((e: any) => {
          const monthKey = `${e.user_id}:${(e.work_date || '').slice(0, 7)}`;
          const isApproved = Boolean(e.self_approved) || approvedMap.has(monthKey);
          return {
            ...e,
            self_approved: isApproved,
            self_approved_at: e.self_approved_at || approvalDateMap.get(monthKey) || null,
            self_approved_ref: e.self_approved_ref || approvalRefMap.get(monthKey) || null,
          };
        });
      }
    } catch {
      // ignore
    }

    // Auto-close forgotten punch-outs: any open session older than MAX_SESSION_HOURS is closed
    // at exactly time-in + MAX_SESSION_HOURS and flagged for admin review.
    try {
      entries = await autoCloseStaleSessions(supabaseServer, entries);
    } catch (autoCloseErr) {
      console.warn('Auto-close of stale DTR sessions failed:', autoCloseErr);
    }

    return createEncryptedResponse({
      success: true,
      entries,
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to fetch DTR entries' },
      500
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabaseServer = createServerClient();

    // Enforce authentication
    const auth = await authenticateApiRequest(request, supabaseServer);
    if (auth.error || !auth.user) {
      return createEncryptedResponse(
        { error: 'Unauthorized: Authentication required.' },
        401
      );
    }

    // Decrypt request payload
    const body = await parseEncryptedRequest<any>(request);

    // Helper to format an entry into a database payload
    const formatDtrPayload = (entry: any): any => {
      const extraHours = Number(entry.extra_hours) || 0;
      let status = entry.status || (entry.time_out ? 'approved' : 'open');
      let extraHoursStatus = entry.extra_hours_status || (extraHours > 0 ? 'pending' : 'none');
      let reviewedByName = entry.reviewed_by_name || null;
      let reviewedAt = entry.reviewed_at || null;
      let payableHours = Number(entry.payable_hours) || 0;

      // Enforcement for employee submissions:
      // - Punch in open session without time_out is 'open'
      // - Completed sessions with extra hours require approval: 'extra_hours_pending'
      // - Clean completed sessions without extra hours are automatically approved: 'approved'
      if (!auth.isAdmin) {
        if (!entry.time_out) {
          status = 'open';
          extraHoursStatus = 'none';
          payableHours = 0;
        } else if (extraHours > 0) {
          status = 'extra_hours_pending';
          extraHoursStatus = 'pending';
          payableHours = Number(entry.regular_hours) || 0;
        } else if (status !== 'rejected' && status !== 'locked') {
          status = 'approved';
          extraHoursStatus = 'none';
          payableHours = Number(entry.regular_hours) || Number(entry.hours) || 0;
          if (!reviewedByName) reviewedByName = 'System Auto-Approved';
          if (!reviewedAt) reviewedAt = new Date().toISOString();
        }
      }

      return {
        id: entry.id,
        user_id: entry.user_id,
        work_date: entry.work_date,
        time_in: entry.time_in,
        time_out: entry.time_out || null,
        remarks: entry.remarks || '',
        minutes_worked: Number(entry.minutes_worked) || 0,
        hours: Number(entry.hours) || 0,
        regular_hours: Number(entry.regular_hours) || 0,
        extra_hours: extraHours,
        extra_hours_status: extraHoursStatus,
        extra_hours_limit: entry.extra_hours_limit || null,
        extra_hours_note: entry.extra_hours_note || null,
        payable_hours: payableHours,
        hourly_rate_snapshot: Number(entry.hourly_rate_snapshot) || 0,
        status,
        source: entry.source || 'self',
        ip_in: entry.ip_in || null,
        ip_out: entry.ip_out || null,
        device_info: entry.device_info || null,
        pay_period_id: entry.pay_period_id || null,
        reviewed_by_name: reviewedByName,
        reviewed_at: reviewedAt,
        revisions: Array.isArray(entry.revisions) ? entry.revisions : [],
        self_approved: Boolean(entry.self_approved),
        self_approved_at: entry.self_approved_at || null,
        created_at: entry.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    };

    // Handle Bulk Sync / Approvals
    if (Array.isArray(body?.entries)) {
      const entriesList = body.entries;
      if (entriesList.length === 0) {
        return createEncryptedResponse({ success: true, count: 0, entries: [] });
      }

      // Authorization check: non-admins can only write entries for themselves
      if (!auth.isAdmin && entriesList.some((e: any) => e.user_id !== auth.user.id)) {
        return createEncryptedResponse(
          { error: 'Forbidden: You cannot create or modify DTR entries for other users.' },
          403
        );
      }

      const payloads = entriesList.map(formatDtrPayload);
      let { data, error } = await supabaseServer.from('dtr_entries').upsert(payloads).select();

      // Fallback if self_approved columns do not exist in table schema
      if (error && (error.message.includes('self_approved') || error.message.includes('column'))) {
        const fallbackPayloads = payloads.map((p: any) => {
          const copy = { ...p };
          delete copy.self_approved;
          delete copy.self_approved_at;
          return copy;
        });
        const retry = await supabaseServer.from('dtr_entries').upsert(fallbackPayloads).select();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        return createEncryptedResponse({ error: error.message }, 400);
      }

      return createEncryptedResponse({
        success: true,
        count: payloads.length,
        entries: data || entriesList,
      });
    }

    const entry = body.entry || body;

    if (!entry || !entry.id || !entry.user_id) {
      return createEncryptedResponse({ error: 'Valid entry with ID and user_id is required' }, 400);
    }

    // Authorization check: non-admins can only write entries for themselves
    if (!auth.isAdmin && entry.user_id !== auth.user.id) {
      return createEncryptedResponse(
        { error: 'Forbidden: You cannot create or modify DTR entries for other users.' },
        403
      );
    }

    // Strict Finalization Enforcement:
    // Non-admins CANNOT add or modify time entry if the month is finalized and confirmed!
    if (!auth.isAdmin && entry.work_date && !entry.self_approved) {
      const monthPrefix = entry.work_date.slice(0, 7);
      const { data: approval } = await supabaseServer
        .from('monthly_self_approvals')
        .select('id')
        .eq('user_id', entry.user_id)
        .eq('month', monthPrefix)
        .maybeSingle();

      if (approval) {
        return createEncryptedResponse(
          { error: `Cannot add or modify time entry: Month ${monthPrefix} has already been finalized and confirmed.` },
          403
        );
      }
    }

    const payload = formatDtrPayload(entry);

    let { data, error } = await supabaseServer.from('dtr_entries').upsert(payload).select().single();

    // If schema doesn't yet have self_approved columns in Supabase, retry without them
    if (error && (error.message.includes('self_approved') || error.message.includes('column'))) {
      delete payload.self_approved;
      delete payload.self_approved_at;
      const retry = await supabaseServer.from('dtr_entries').upsert(payload).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return createEncryptedResponse({ error: error.message }, 400);
    }

    return createEncryptedResponse({
      success: true,
      entry: data || entry,
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to sync DTR entry' },
      500
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabaseServer = createServerClient();

    // Enforce authentication
    const auth = await authenticateApiRequest(request, supabaseServer);
    if (auth.error || !auth.user) {
      return createEncryptedResponse(
        { error: 'Unauthorized: Authentication required.' },
        401
      );
    }

    // Decrypt request payload
    const body = await parseEncryptedRequest<any>(request);
    const id = body.id;

    if (!id) {
      return createEncryptedResponse({ error: 'Entry ID is required' }, 400);
    }

    // Authorization check: non-admins can only delete their own entries
    if (!auth.isAdmin) {
      const { data: existing } = await supabaseServer
        .from('dtr_entries')
        .select('user_id, work_date')
        .eq('id', id)
        .maybeSingle();

      if (existing && existing.user_id !== auth.user.id) {
        return createEncryptedResponse(
          { error: 'Forbidden: You cannot delete DTR entries of another user.' },
          403
        );
      }

      if (existing && existing.work_date) {
        const monthPrefix = existing.work_date.slice(0, 7);
        const { data: approval } = await supabaseServer
          .from('monthly_self_approvals')
          .select('id')
          .eq('user_id', auth.user.id)
          .eq('month', monthPrefix)
          .maybeSingle();

        if (approval) {
          return createEncryptedResponse(
            { error: `Cannot delete entry: Month ${monthPrefix} has already been finalized and confirmed.` },
            403
          );
        }
      }
    }

    const { error } = await supabaseServer.from('dtr_entries').delete().eq('id', id);

    if (error) {
      return createEncryptedResponse({ error: error.message }, 400);
    }

    return createEncryptedResponse({
      success: true,
      id,
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to delete DTR entry' },
      500
    );
  }
}

async function autoCloseStaleSessions(supabaseServer: any, entries: any[]): Promise<any[]> {
  const openEntries = entries.filter((e: any) => e.status === 'open' && !e.time_out);
  if (openEntries.length === 0) return entries;

  const { data: settingsRow } = await supabaseServer.from('system_settings').select('*').limit(1).maybeSingle();
  const now = nowInTimeZone(resolveTimeZone(settingsRow?.timezone));
  const stale = openEntries.filter((e: any) => isSessionOverMaxDuration(e, now.date, now.time));
  if (stale.length === 0) return entries;

  const companyMax = settingsRow?.company_max_hours || {};
  const userIds = Array.from(new Set(stale.map((e: any) => e.user_id)));
  const { data: profiles } = await supabaseServer
    .from('profiles')
    .select('id, first_name, last_name, max_hours_day, max_hours_month')
    .in('id', userIds);
  const profileMap = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));

  const closedAtIso = new Date().toISOString();
  const replacements = new Map<string, any>();

  for (const entry of stale) {
    const profile = profileMap.get(entry.user_id);
    const others = entries.filter(
      (e: any) => e.user_id === entry.user_id && e.id !== entry.id && e.status !== 'rejected'
    );
    const priorDayHours = others
      .filter((e: any) => e.work_date === entry.work_date)
      .reduce((sum: number, e: any) => sum + (Number(e.hours) || 0), 0);
    const priorMonthHours = others
      .filter((e: any) => (e.work_date || '').startsWith(entry.work_date.slice(0, 7)))
      .reduce((sum: number, e: any) => sum + (Number(e.hours) || 0), 0);

    const closed = buildAutoClosedEntry(
      { ...entry, revisions: Array.isArray(entry.revisions) ? entry.revisions : [] },
      {
        dayLimit: Number(profile?.max_hours_day) || Number(companyMax.day) || 8,
        monthLimit: Number(profile?.max_hours_month) || Number(companyMax.month) || 160,
        priorDayHours,
        priorMonthHours,
        closedAtIso,
      }
    );

    const payload = {
      time_out: closed.time_out,
      remarks: closed.remarks,
      minutes_worked: closed.minutes_worked,
      hours: closed.hours,
      regular_hours: closed.regular_hours,
      extra_hours: closed.extra_hours,
      extra_hours_status: closed.extra_hours_status,
      extra_hours_limit: closed.extra_hours_limit,
      extra_hours_note: closed.extra_hours_note,
      payable_hours: closed.payable_hours,
      status: closed.status,
      reviewed_by_name: null,
      reviewed_at: null,
      revisions: closed.revisions,
      updated_at: closedAtIso,
    };

    // Only close it if it is still open (the employee may have punched out meanwhile)
    const { data: updated, error } = await supabaseServer
      .from('dtr_entries')
      .update(payload)
      .eq('id', entry.id)
      .eq('status', 'open')
      .is('time_out', null)
      .select()
      .maybeSingle();

    if (error) {
      console.warn(`Could not auto-close DTR session ${entry.id}:`, error.message);
      continue;
    }
    if (!updated) continue; // already closed by someone else

    replacements.set(entry.id, { ...entry, ...updated });

    const name = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Employee';
    try {
      await supabaseServer.from('audit_logs').insert({
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        actor_id: 'system',
        actor_name: 'System',
        actor_role: 'system',
        action: 'DTR_AUTO_CLOSED',
        entity_type: 'dtr_entry',
        entity_id: entry.id,
        details: `${name}'s session from ${entry.work_date} ${entry.time_in} had no punch-out and was automatically closed at ${closed.time_out} after the ${MAX_SESSION_HOURS}-hour maximum. Flagged for admin review.`,
        is_system_scope: false,
        created_at: closedAtIso,
      });
    } catch {
      // audit failure should not block the response
    }
  }

  if (replacements.size === 0) return entries;
  return entries.map((e: any) => replacements.get(e.id) || e);
}
