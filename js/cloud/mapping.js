// Pure mapping layer between the in-memory `state` of index.html and Supabase rows.
// Invariants it must preserve (see index.html L1076-1091):
//  - state.nodeScores is a COMPLETE skeleton {nodeId:{itemIdx:0|2}}; never replace wholesale.
//  - state.lifestyle uses -1 as the "unfilled" sentinel (values -1..3).
//  - state.atm arrays always keep at least one '' entry.
//  - Cloud data must never overwrite in-flight local edits (fill pristine fields only).

function deepCopy(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

export function recordToRow(rec, userId) {
  return {
    user_id: userId,
    record_date: rec && rec.date != null ? String(rec.date) : null,
    payload: deepCopy(rec),
  };
}

export function rowsToRecords(rows) {
  return (rows || [])
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((r) => Object.assign({}, r.payload, { cloud_id: r.id }));
}

export function stateToSnapshot(s) {
  return {
    node_scores: deepCopy(s.nodeScores),
    lifestyle: deepCopy(s.lifestyle),
    atm: deepCopy(s.atm),
    atm_pick: deepCopy(s.atmPick),
    basic: deepCopy(s.basic),
    redflags: deepCopy(s.redflags),
    data_draft: deepCopy(s.data),
    submitted: !!s.submitted,
  };
}

export function mergeSnapshotIntoState(snap, s) {
  if (!snap || typeof snap !== 'object') return;

  // node scores: merge into existing skeleton; unknown node ids / item indexes ignored;
  // a locally toggled score (non-zero) always wins over late cloud data.
  if (snap.node_scores && typeof snap.node_scores === 'object') {
    Object.keys(snap.node_scores).forEach(function (nodeId) {
      var local = s.nodeScores[nodeId];
      var cloud = snap.node_scores[nodeId];
      if (!local || !cloud || typeof cloud !== 'object') return;
      Object.keys(cloud).forEach(function (idx) {
        var v = cloud[idx];
        if (!(idx in local)) return;
        if (local[idx] !== 0) return;
        if (v === 0 || v === 2) local[idx] = v;
      });
    });
  }

  // lifestyle: only fill slots still at the -1 sentinel; keep -1 semantics intact.
  if (snap.lifestyle && typeof snap.lifestyle === 'object') {
    Object.keys(snap.lifestyle).forEach(function (k) {
      var v = snap.lifestyle[k];
      if (!(k in s.lifestyle)) return;
      if (s.lifestyle[k] !== -1) return;
      if (Number.isInteger(v) && v >= -1 && v <= 3) s.lifestyle[k] = v;
    });
  }

  // atm free-text arrays: fill only pristine ([''] or empty) slots; never leave an empty array.
  if (snap.atm && typeof snap.atm === 'object') {
    ['ant', 'tri', 'med'].forEach(function (k) {
      var cloud = snap.atm[k];
      var local = s.atm[k];
      if (!Array.isArray(local)) return;
      var pristine = local.length === 0 || (local.length === 1 && local[0] === '');
      if (!pristine) return;
      var vals = Array.isArray(cloud)
        ? cloud.filter(function (x) { return typeof x === 'string' && x !== ''; })
        : [];
      s.atm[k] = vals.length ? vals : [''];
    });
  }

  // atm option picks: additive only (true wins, never un-picks).
  if (snap.atm_pick && typeof snap.atm_pick === 'object') {
    ['ant', 'tri', 'med'].forEach(function (k) {
      var cloud = snap.atm_pick[k];
      if (!cloud || typeof cloud !== 'object' || !s.atmPick[k]) return;
      Object.keys(cloud).forEach(function (idx) {
        if (cloud[idx] === true) s.atmPick[k][idx] = true;
      });
    });
  }

  // basic: fill only fields the user hasn't typed into.
  if (snap.basic && typeof snap.basic === 'object') {
    Object.keys(s.basic).forEach(function (k) {
      var v = snap.basic[k];
      if (s.basic[k] === '' && typeof v === 'string' && v !== '') s.basic[k] = v;
    });
  }

  // redflags: safety-critical — only ever upgrade false -> true.
  if (snap.redflags && typeof snap.redflags === 'object') {
    Object.keys(snap.redflags).forEach(function (k) {
      if (k in s.redflags && snap.redflags[k] === true) s.redflags[k] = true;
    });
  }

  // data draft: fill keys the user hasn't touched.
  if (snap.data_draft && typeof snap.data_draft === 'object') {
    Object.keys(snap.data_draft).forEach(function (k) {
      var v = snap.data_draft[k];
      if ((s.data[k] === undefined || s.data[k] === '') && typeof v === 'string' && v !== '') {
        s.data[k] = v;
      }
    });
  }

  // submitted: never downgrade.
  s.submitted = !!s.submitted || snap.submitted === true;
}

export function reportToRow(report, userId) {
  return {
    user_id: userId,
    engine: report && report.engine ? String(report.engine) : null,
    payload: deepCopy(report),
  };
}

export function rowToReport(row) {
  return row ? deepCopy(row.payload) : null;
}
