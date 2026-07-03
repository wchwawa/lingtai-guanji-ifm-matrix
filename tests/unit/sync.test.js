import { describe, it, expect, vi } from 'vitest';
import { createCloudSync } from '../../js/cloud/sync.js';

// Minimal thenable query stub emulating the supabase-js chain surface used by sync.js.
function makeQuery(result) {
  const q = {
    calls: [],
    select(...a) { q.calls.push(['select', ...a]); return q; },
    eq(...a) { q.calls.push(['eq', ...a]); return q; },
    order(...a) { q.calls.push(['order', ...a]); return q; },
    limit(...a) { q.calls.push(['limit', ...a]); return q; },
    insert(...a) { q.calls.push(['insert', ...a]); return q; },
    upsert(...a) { q.calls.push(['upsert', ...a]); return q; },
    single() { q.calls.push(['single']); return Promise.resolve(result); },
    maybeSingle() { q.calls.push(['maybeSingle']); return Promise.resolve(result); },
    then(res, rej) { return Promise.resolve(result).then(res, rej); },
  };
  return q;
}

function makeClient(tableResults) {
  const log = [];
  return {
    log,
    queriesFor(table) { return log.filter((e) => e.table === table); },
    from(table) {
      const results = tableResults[table] || [];
      const result = results.length > 1 ? results.shift() : results[0] || { data: null, error: null };
      const q = makeQuery(result);
      log.push({ table, q });
      return q;
    },
  };
}

function freshState() {
  return {
    nodeScores: { energy: { 0: 0, 1: 0 } },
    lifestyle: { sleep: -1 },
    atm: { ant: [''], tri: [''], med: [''] },
    atmPick: { ant: {}, tri: {}, med: {} },
    basic: { nick: '', agesex: '', mainfeel: '', note: '' },
    redflags: { chest_pain: false },
    data: {},
    records: [],
    submitted: false,
    lastReport: null,
  };
}

describe('hydrate', () => {
  it('merges snapshot, loads records newest-first, restores latest report, repaints', async () => {
    const state = freshState();
    const client = makeClient({
      wizard_snapshots: [{ data: { node_scores: { energy: { 1: 2 } }, submitted: true }, error: null }],
      health_records: [{
        data: [
          { id: 'r2', created_at: '2026-07-02T00:00:00Z', payload: { date: '2026-07-02', weight: '61' } },
          { id: 'r1', created_at: '2026-07-01T00:00:00Z', payload: { date: '2026-07-01', weight: '62' } },
        ],
        error: null,
      }],
      reports: [{ data: [{ payload: { engine: 'v1', sections: {} } }], error: null }],
    });
    const repaint = vi.fn();
    const sync = createCloudSync({ client, getState: () => state, repaint });

    await sync.hydrate('u1');

    expect(state.nodeScores.energy[1]).toBe(2);
    expect(state.submitted).toBe(true);
    expect(state.records.map((r) => r.cloud_id)).toEqual(['r2', 'r1']);
    expect(state.records[0].weight).toBe('61');
    expect(state.lastReport.engine).toBe('v1');
    expect(repaint).toHaveBeenCalled();
  });

  it('does not clobber an existing local report and keeps local records when cloud is empty', async () => {
    const state = freshState();
    state.lastReport = { engine: 'local', sections: {} };
    state.records = [{ date: 'x' }];
    const client = makeClient({
      wizard_snapshots: [{ data: null, error: null }],
      health_records: [{ data: [], error: null }],
      reports: [{ data: [{ payload: { engine: 'cloud' } }], error: null }],
    });
    const sync = createCloudSync({ client, getState: () => state, repaint: () => {} });

    await sync.hydrate('u1');

    expect(state.lastReport.engine).toBe('local');
    expect(state.records).toEqual([{ date: 'x' }]);
  });
});

describe('pushRecord', () => {
  it('inserts a wrapped row and tags the in-memory record with the returned cloud id', async () => {
    const state = freshState();
    const rec = { date: '2026-07-03', weight: '60' };
    state.records = [rec];
    const client = makeClient({
      health_records: [{ data: { id: 'new-id' }, error: null }],
    });
    const sync = createCloudSync({ client, getState: () => state, repaint: () => {} });

    await sync.pushRecord(rec, 'u1');

    const q = client.queriesFor('health_records')[0].q;
    const insertCall = q.calls.find((c) => c[0] === 'insert');
    expect(insertCall[1].user_id).toBe('u1');
    expect(insertCall[1].payload.weight).toBe('60');
    expect(rec.cloud_id).toBe('new-id');
  });
});

describe('uploadLocalRecords', () => {
  it('uploads only records without cloud_id, oldest first to preserve ordering', async () => {
    const state = freshState();
    state.records = [
      { date: 'newest', cloud_id: undefined },
      { date: 'synced', cloud_id: 'already' },
      { date: 'oldest' },
    ];
    const inserted = [];
    const client = {
      from(table) {
        const q = makeQuery({ data: { id: 'id-' + inserted.length }, error: null });
        const origInsert = q.insert.bind(q);
        q.insert = (row) => { inserted.push(row.payload.date); return origInsert(row); };
        return q;
      },
    };
    const sync = createCloudSync({ client, getState: () => state, repaint: () => {} });

    await sync.uploadLocalRecords('u1');

    expect(inserted).toEqual(['oldest', 'newest']); // oldest first, synced one skipped
    expect(state.records[0].cloud_id).toBeDefined();
    expect(state.records[2].cloud_id).toBeDefined();
  });
});

describe('pushSnapshot / pushReport', () => {
  it('upserts the wizard snapshot keyed by user_id', async () => {
    const state = freshState();
    state.submitted = true;
    const client = makeClient({ wizard_snapshots: [{ data: null, error: null }] });
    const sync = createCloudSync({ client, getState: () => state, repaint: () => {} });

    await sync.pushSnapshot('u1');

    const q = client.queriesFor('wizard_snapshots')[0].q;
    const upsert = q.calls.find((c) => c[0] === 'upsert');
    expect(upsert[1].user_id).toBe('u1');
    expect(upsert[1].submitted).toBe(true);
    expect(upsert[2]).toEqual({ onConflict: 'user_id' });
  });

  it('inserts a report row with engine metadata', async () => {
    const state = freshState();
    state.lastReport = { engine: 'skill-v1', sections: {} };
    const client = makeClient({ reports: [{ data: null, error: null }] });
    const sync = createCloudSync({ client, getState: () => state, repaint: () => {} });

    await sync.pushReport('u1');

    const q = client.queriesFor('reports')[0].q;
    const insert = q.calls.find((c) => c[0] === 'insert');
    expect(insert[1].engine).toBe('skill-v1');
    expect(insert[1].user_id).toBe('u1');
  });

  it('is a no-op when there is no report', async () => {
    const state = freshState();
    const client = makeClient({});
    const sync = createCloudSync({ client, getState: () => state, repaint: () => {} });
    await sync.pushReport('u1');
    expect(client.log.length).toBe(0);
  });
});
