import { describe, it, expect } from 'vitest';
import {
  recordToRow,
  rowsToRecords,
  stateToSnapshot,
  mergeSnapshotIntoState,
  reportToRow,
  rowToReport,
} from '../../js/cloud/mapping.js';

// Mirrors the in-memory state skeleton built at index.html L1076-1091:
// nodeScores is a COMPLETE skeleton (every node id, every item index preset to 0),
// lifestyle uses -1 as the "unfilled" sentinel, atm arrays keep at least [''].
function freshState() {
  return {
    nodeScores: {
      assimilation: { 0: 0, 1: 0, 2: 0 },
      energy: { 0: 0, 1: 0 },
    },
    lifestyle: { sleep: -1, exercise: -1 },
    atm: { ant: [''], tri: [''], med: [''] },
    atmPick: { ant: {}, tri: {}, med: {} },
    basic: { nick: '', agesex: '', mainfeel: '', note: '' },
    redflags: { chest_pain: false, self_harm: false },
    data: {},
    records: [],
    submitted: false,
    lastReport: null,
  };
}

describe('recordToRow / rowsToRecords', () => {
  it('wraps a saved record into a row keyed by user with full payload fidelity', () => {
    const rec = { date: '2026-07-01', weight: '62.5', bmi: '21.3', hb: '', note: '早餐后' };
    const row = recordToRow(rec, 'user-1');
    expect(row.user_id).toBe('user-1');
    expect(row.record_date).toBe('2026-07-01');
    expect(row.payload).toEqual(rec);
  });

  it('preserves the "(未填日期)" placeholder and "—" bmi untouched', () => {
    const rec = { date: '(未填日期)', bmi: '—' };
    const row = recordToRow(rec, 'u');
    expect(row.record_date).toBe('(未填日期)');
    expect(row.payload.bmi).toBe('—');
  });

  it('rowsToRecords returns newest-first payloads matching unshift semantics', () => {
    const rows = [
      { id: 'a', created_at: '2026-07-01T00:00:00Z', payload: { date: '2026-06-30' } },
      { id: 'b', created_at: '2026-07-02T00:00:00Z', payload: { date: '2026-07-02' } },
    ];
    const recs = rowsToRecords(rows);
    expect(recs[0].date).toBe('2026-07-02');
    expect(recs[1].date).toBe('2026-06-30');
    // cloud id is carried so future syncs can dedupe
    expect(recs[0].cloud_id).toBe('b');
  });
});

describe('stateToSnapshot', () => {
  it('captures the wizard-related slices under snake_case columns', () => {
    const s = freshState();
    s.nodeScores.energy[1] = 2;
    s.lifestyle.sleep = 3;
    s.basic.nick = '李';
    s.submitted = true;
    const snap = stateToSnapshot(s);
    expect(snap.node_scores.energy[1]).toBe(2);
    expect(snap.lifestyle.sleep).toBe(3);
    expect(snap.basic.nick).toBe('李');
    expect(snap.submitted).toBe(true);
    expect(snap.atm).toEqual({ ant: [''], tri: [''], med: [''] });
    expect(snap.data_draft).toEqual({});
  });
});

describe('mergeSnapshotIntoState (field-level, invariant-preserving)', () => {
  it('merges cloud node scores into the existing skeleton without replacing it', () => {
    const s = freshState();
    const snap = { node_scores: { energy: { 0: 2 }, ghost_node: { 0: 2 } } };
    mergeSnapshotIntoState(snap, s);
    expect(s.nodeScores.energy[0]).toBe(2);
    expect(s.nodeScores.energy[1]).toBe(0); // untouched skeleton key survives
    expect(s.nodeScores.assimilation).toEqual({ 0: 0, 1: 0, 2: 0 });
    expect(s.nodeScores.ghost_node).toBeUndefined(); // unknown ids ignored
  });

  it('never overwrites a locally-toggled score (user input wins over late cloud data)', () => {
    const s = freshState();
    s.nodeScores.energy[0] = 2; // user toggled while cloud fetch was in flight
    mergeSnapshotIntoState({ node_scores: { energy: { 0: 0 } } }, s);
    expect(s.nodeScores.energy[0]).toBe(2);
  });

  it('respects the lifestyle -1 sentinel and local edits', () => {
    const s = freshState();
    s.lifestyle.exercise = 2; // local edit
    mergeSnapshotIntoState({ lifestyle: { sleep: 1, exercise: 0, bogus: 3 } }, s);
    expect(s.lifestyle.sleep).toBe(1);      // filled: local was -1 sentinel
    expect(s.lifestyle.exercise).toBe(2);   // kept: local edit wins
    expect(s.lifestyle.bogus).toBeUndefined();
  });

  it('keeps the atm "at least one empty string" invariant and fills only pristine slots', () => {
    const s = freshState();
    mergeSnapshotIntoState({ atm: { ant: ['童年过敏'], tri: [], med: null } }, s);
    expect(s.atm.ant).toEqual(['童年过敏']);
    expect(s.atm.tri).toEqual(['']);  // never leaves an empty array
    expect(s.atm.med).toEqual(['']);
  });

  it('fills basic fields only when local value is still pristine', () => {
    const s = freshState();
    s.basic.nick = '正在打字';
    mergeSnapshotIntoState({ basic: { nick: '云端名', mainfeel: '疲劳' } }, s);
    expect(s.basic.nick).toBe('正在打字');
    expect(s.basic.mainfeel).toBe('疲劳');
  });

  it('propagates redflags=true and submitted=true but never downgrades them', () => {
    const s = freshState();
    s.redflags.chest_pain = true;
    s.submitted = true;
    mergeSnapshotIntoState({ redflags: { chest_pain: false, self_harm: true }, submitted: false }, s);
    expect(s.redflags.chest_pain).toBe(true);
    expect(s.redflags.self_harm).toBe(true);
    expect(s.submitted).toBe(true);
  });

  it('tolerates a null/undefined snapshot without touching state', () => {
    const s = freshState();
    const before = JSON.stringify(s);
    mergeSnapshotIntoState(null, s);
    mergeSnapshotIntoState(undefined, s);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('report mapping', () => {
  const report = {
    generated: '本地离线规则引擎',
    engine: 'skill-v1-integrated-20260630',
    sections: { summary: { nick: '李' }, red_flags: { hits: [] } },
    trace: [{ rule: 'r1' }],
  };

  it('reportToRow stores the full report as payload with engine metadata', () => {
    const row = reportToRow(report, 'user-1');
    expect(row.user_id).toBe('user-1');
    expect(row.engine).toBe('skill-v1-integrated-20260630');
    expect(row.payload).toEqual(report);
  });

  it('rowToReport round-trips', () => {
    const row = reportToRow(report, 'user-1');
    expect(rowToReport({ ...row, id: 'x', created_at: 'now' })).toEqual(report);
  });
});
