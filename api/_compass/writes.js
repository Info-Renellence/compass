// Everything Compass writes (POST /api/compass {op, ...}). Only admins get here (auth.js). Each write is for one active
// rep, touches only that rep's own accounts (contacts.owner_id), and runs in one transaction through asUser(), so the
// change_logs trigger records who acted and that it was Compass (source 'compass').
//
//   weekly_save         the agreed week: final picks, second-look decisions, the roleplay, the focus goal, commitments
//   weekly_commitments  the manager's commitments, changed on the done screen after the save
//   monthly_save        the month's skill, forecasts added to close the gap, My Fifty statuses, the committed forecast
const { asUser, db } = require('./db');
const { fail, clean, isUuid } = require('./http');
const T = require('./time');
const B = require('./book');
const R = require('./rules');
const Q = require('./reads');

const asObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const asList = (v) => (Array.isArray(v) ? v : []);

// The commitments as clean, distinct titles (at most 10).
function commitmentList(v) {
  const out = [];
  for (const t of asList(v)) {
    const s = clean(typeof t === 'object' && t ? t.text : t, 200);
    if (s && !out.includes(s)) out.push(s);
  }
  if (out.length > 10) throw fail(400, 'too_many');
  return out;
}

// The manager's commitments for a session: tasks assigned to the admin who runs it, no contact, tied to the session,
// due at the end of the week. Titles not in the list are removed (soft delete); new ones are added.
async function syncCommitments(tx, me, rep, sessionId, list, dueAt) {
  const have = await tx`select id, title from tasks where one_on_one_id = ${sessionId} and assignee_id <> ${rep.id} and deleted_at is null`;
  const drop = have.filter((t) => !list.includes(t.title)).map((t) => t.id);
  if (drop.length) await tx`update tasks set deleted_at = now() where id = any(${drop})`;
  for (const title of list.filter((t) => !have.some((h) => h.title === t))) {
    await tx`insert into tasks (assignee_id, created_by_id, title, kind, status, source, due_at, one_on_one_id)
      values (${me.id}, ${me.id}, ${title}, 'todo', 'open', 'one_on_one', ${dueAt}, ${sessionId})`;
  }
}

const OPS = {
  async weekly_save(me, b) {
    const sql = db();
    const rep = await Q.repFor(sql, b.repId);
    const plan = asObject(b.plan);
    const picks = new Map();
    for (const p of asList(plan.picks)) {
      const o = asObject(p);
      if (!isUuid(o.id) || !R.PICKS.includes(o.finalPick)) throw fail(400, 'bad_pick');
      picks.set(o.id, o.finalPick);
    }
    const looks = new Map();
    for (const l of asList(plan.secondLook)) {
      const o = asObject(l);
      if (!isUuid(o.id) || !(o.decision == null || ['keep', 'change'].includes(o.decision))) throw fail(400, 'bad_decision');
      looks.set(o.id, o.decision || null);
    }
    const focus = asObject(plan.focus);
    if (!R.GOALS.includes(focus.goal)) throw fail(400, 'bad_goal');
    const target = Number(focus.actionTarget);
    if (!Number.isInteger(target) || target < 1 || target > 15) throw fail(400, 'bad_target');
    const rp = asObject(plan.roleplay);
    if (rp.skill != null && !R.SKILLS.includes(rp.skill)) throw fail(400, 'bad_skill');
    if (rp.character != null && !R.CHARACTERS.includes(rp.character)) throw fail(400, 'bad_character');
    const list = commitmentList(plan.commitments);

    const x = await R.load(sql, rep);
    const c = x.cfg.compass;
    const wk = R.weekOf(x.today);
    if ([...picks.values()].filter((v) => v === 'visit').length > c.max_visits) throw fail(400, 'too_many_visits');

    const out = await asUser(me.id, async (tx) => {
      // Saves for one rep take turns, so two at once can't make two check-ins or two focus goals.
      await tx`select id from users where id = ${rep.id} for update`;
      let [checkin] = await tx`select id from checkins where rep_id = ${rep.id} and week_start_date = ${wk.mon}`;
      let rows;
      if (checkin) {
        rows = await tx`select * from account_picks where checkin_id = ${checkin.id}`;
      } else {
        // No Friday check-in this week: the week is sorted as the check-in would sort it (suggested picks, frozen now).
        [checkin] = await tx`insert into checkins (rep_id, week_start_date) values (${rep.id}, ${wk.mon}) returning id`;
        rows = R.derivePicks(x, await B.parkedUntil(tx, x.people.map((p) => p.id), { days: c.park_days, today: wk.mon }), wk.mon).map((a) => Object.assign(a, { checkin_id: checkin.id }));
        if (rows.length) {
          await tx`insert into account_picks ${tx(rows, 'checkin_id', 'contact_id', 'sort_group', 'suggested_pick', 'suggested_reason', 'rep_pick')}`;
        }
      }
      const known = new Set(rows.map((a) => a.contact_id));
      for (const id of picks.keys()) if (!known.has(id)) throw fail(400, 'not_in_week');
      for (const id of looks.keys()) if (!known.has(id)) throw fail(400, 'not_in_week');
      if (picks.size) {
        const ids = [...picks.keys()], vals = [...picks.values()];
        await tx`update account_picks ap set final_pick = v.pick::account_picks_pick
          from unnest(${ids}::uuid[], ${vals}::text[]) as v(cid, pick)
          where ap.checkin_id = ${checkin.id} and ap.contact_id = v.cid and ap.final_pick is distinct from v.pick::account_picks_pick`;
      }
      await tx`update account_picks set final_pick = rep_pick where checkin_id = ${checkin.id} and final_pick is null`;
      // Second look: the fact shown is kept with the decision (empty decision = not discussed).
      if (looks.size) {
        const facts = Object.fromEntries(R.secondLook(rows, x).map((l) => [l.contact_id, l.fact]));
        for (const [id, decision] of looks) {
          const fact = (rows.find((a) => a.contact_id === id) || {}).second_look_fact || facts[id] || null;
          if (!fact) continue;
          await tx`update account_picks set second_look_fact = ${fact}, second_look_decision = ${decision}
            where checkin_id = ${checkin.id} and contact_id = ${id}
              and (second_look_fact is distinct from ${fact} or second_look_decision is distinct from ${decision}::account_picks_second_look_decision)`;
        }
      }
      // The session itself.
      const [s] = await tx`insert into one_on_ones (kind, rep_id, held_by_id, session_date, checkin_id, focus_action_target_count, skill, roleplay_character, roleplay_done_at, completed_at)
        values ('weekly', ${rep.id}, ${me.id}, ${wk.mon}, ${checkin.id}, ${target}, ${rp.skill || null}, ${rp.character || null}, ${rp.done ? new Date() : null}, now())
        on conflict (rep_id, kind, session_date) do update set held_by_id = excluded.held_by_id, checkin_id = excluded.checkin_id,
          focus_action_target_count = excluded.focus_action_target_count, skill = excluded.skill, roleplay_character = excluded.roleplay_character,
          roleplay_done_at = case when ${!!rp.done} then coalesce(one_on_ones.roleplay_done_at, now()) else null end,
          completed_at = now(), deleted_at = null
        returning id`;
      // This week's focus: Edge's rule (writes.js focus_set): one goal per week, the latest wins. The week's earlier goal
      // tasks are soft-deleted and the new one is the rep's task (source one_on_one, title = the goal key, due at the end
      // of the week), tied to this session.
      await tx`update tasks set deleted_at = now() where assignee_id = ${rep.id} and source = 'one_on_one' and deleted_at is null
        and title = any(${R.GOALS}) and due_at >= ${wk.start} and due_at <= ${wk.end}`;
      const [t] = await tx`insert into tasks (assignee_id, created_by_id, title, kind, status, source, due_at, one_on_one_id)
        values (${rep.id}, ${me.id}, ${focus.goal}, 'todo', 'open', 'one_on_one', ${wk.end}, ${s.id}) returning id`;
      await syncCommitments(tx, me, rep, s.id, list, wk.end);
      return { id: s.id, checkinId: checkin.id, focusTaskId: t.id };
    });
    return Object.assign({ ok: true }, out);
  },

  async weekly_commitments(me, b) {
    const sql = db();
    const rep = await Q.repFor(sql, b.repId);
    const list = commitmentList(b.commitments);
    const wk = R.weekOf(T.ymd());
    const [s] = await sql`select id from one_on_ones where rep_id = ${rep.id} and kind = 'weekly' and session_date = ${wk.mon} and deleted_at is null`;
    if (!s) throw fail(409, 'save_first');
    await asUser(me.id, (tx) => syncCommitments(tx, me, rep, s.id, list, wk.end));
    return { ok: true, id: s.id };
  },

  async monthly_save(me, b) {
    const sql = db();
    const rep = await Q.repFor(sql, b.repId);
    const plan = asObject(b.plan);
    if (!R.SKILLS.includes(plan.skill)) throw fail(400, 'bad_skill');
    const added = [];
    for (const id of asList(plan.addedForecasts)) { if (!isUuid(id)) throw fail(400, 'bad_id'); if (!added.includes(id)) added.push(id); }
    const statuses = new Map();
    for (const f of asList(plan.fiftyStatus)) {
      const o = asObject(f);
      if (!isUuid(o.id) || !R.FIFTY_STATUSES.includes(o.status)) throw fail(400, 'bad_status');
      statuses.set(o.id, o.status);
    }
    const x = await R.load(sql, rep);
    const wk = R.weekOf(x.today);
    const M = R.plannedMonth(x.today);
    const gap = Object.fromEntries((await Q.gapRows(sql, x, M)).map((g) => [g.id, g]));
    const forecastIn = (id) => x.fcs.some((f) => f.contact_id === id && T.ymd(f.due_date).slice(0, 7) === M);
    for (const id of added) if (!gap[id] && !forecastIn(id)) throw fail(400, 'not_in_gap');
    for (const id of statuses.keys()) if (!x.byId[id] || x.byId[id].stage !== 'fifty') throw fail(400, 'not_in_fifty');

    const out = await asUser(me.id, async (tx) => {
      await tx`select id from users where id = ${rep.id} for update`;
      const [s] = await tx`insert into one_on_ones (kind, rep_id, held_by_id, session_date, skill, completed_at)
        values ('monthly', ${rep.id}, ${me.id}, ${wk.mon}, ${plan.skill}, now())
        on conflict (rep_id, kind, session_date) do update set held_by_id = excluded.held_by_id, skill = excluded.skill, completed_at = now(), deleted_at = null
        returning id`;
      // Forecasts that close the gap: normal forecasts (proposal option 2A), one per customer per month (Edge's rule).
      let made = 0;
      for (const id of added) {
        const g = gap[id];
        if (!g) continue;
        await tx`select id from contacts where id = ${id} for update`;
        const [ex] = await tx`select id from forecasts where contact_id = ${id} and deleted_at is null and to_char(due_date, 'YYYY-MM') = ${M}`;
        if (ex) continue;
        await tx`insert into forecasts (contact_id, rep_id, due_date, syringes, syringe_price, cannula_boxes, cannula_box_price, created_by_id)
          values (${id}, ${rep.id}, ${g.dueDate}, ${g.syringes}, ${R.SYRINGE_PRICE}, 0, ${R.CANNULA_PRICE}, ${me.id})`;
        made++;
      }
      // A status for every My Fifty account this month.
      for (const [id, status] of statuses) {
        await tx`insert into fifty_statuses (contact_id, month_start_date, status, one_on_one_id, set_by_id)
          values (${id}, ${R.monthStart(M)}, ${status}, ${s.id}, ${me.id})
          on conflict (contact_id, month_start_date) do update set status = excluded.status, one_on_one_id = excluded.one_on_one_id, set_by_id = excluded.set_by_id
          where fifty_statuses.status is distinct from excluded.status or fifty_statuses.one_on_one_id is distinct from excluded.one_on_one_id`;
      }
      // The committed forecast: what the rep's book has forecast for the month once the gap step is done.
      const ids = x.people.map((p) => p.id);
      const [sum] = ids.length ? await tx`select coalesce(sum(coalesce(syringes, 0) * coalesce(syringe_price, 0) + coalesce(cannula_boxes, 0) * coalesce(cannula_box_price, 0)
          + coalesce(needle_boxes, 0) * coalesce(needle_box_price, 0)), 0)::float8 as v, count(*)::int as n
        from forecasts where contact_id = any(${ids}) and deleted_at is null and to_char(due_date, 'YYYY-MM') = ${M}` : [{ v: 0, n: 0 }];
      await tx`insert into metric_snapshots (snapshot_date, rep_id, metric, metric_value, details)
        values (${R.monthStart(M)}, ${rep.id}, 'forecast_committed', ${sum.v}, ${JSON.stringify({ one_on_one_id: s.id, forecasts: sum.n })}::jsonb)
        on conflict (snapshot_date, rep_id, metric) do update set metric_value = excluded.metric_value, details = excluded.details`;
      return { id: s.id, forecastsAdded: made, committed: sum.v };
    });
    return Object.assign({ ok: true }, out);
  },
};

module.exports = { OPS };
