// Cloud sync orchestration. The supabase client is injected so the module is
// unit-testable and index.html stays in control of when sync happens.
import {
  mergeSnapshotIntoState,
  rowsToRecords,
  recordToRow,
  stateToSnapshot,
  reportToRow,
} from './mapping.js';

export function createCloudSync(deps) {
  var client = deps.client;
  var getState = deps.getState;
  var repaint = deps.repaint || function () {};

  async function hydrate(userId) {
    var state = getState();

    var snapRes = await client
      .from('wizard_snapshots').select('*').eq('user_id', userId).maybeSingle();
    mergeSnapshotIntoState(snapRes && snapRes.data, state);

    var rowsRes = await client
      .from('health_records')
      .select('id, created_at, payload')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    var rows = rowsRes && rowsRes.data;
    if (rows && rows.length) state.records = rowsToRecords(rows);

    var repRes = await client
      .from('reports')
      .select('payload')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    var reps = repRes && repRes.data;
    if (!state.lastReport && reps && reps[0] && reps[0].payload) {
      state.lastReport = reps[0].payload;
    }

    repaint();
  }

  async function pushRecord(rec, userId) {
    var res = await client
      .from('health_records')
      .insert(recordToRow(rec, userId))
      .select('id')
      .single();
    if (res && res.error) throw res.error;
    if (res && res.data && res.data.id) rec.cloud_id = res.data.id;
  }

  // Records without a cloud_id were created before login; upload oldest-first so
  // server-side created_at ordering matches the local newest-first array.
  async function uploadLocalRecords(userId) {
    var state = getState();
    for (var i = state.records.length - 1; i >= 0; i--) {
      var rec = state.records[i];
      if (rec.cloud_id) continue;
      await pushRecord(rec, userId);
    }
  }

  async function pushSnapshot(userId) {
    var state = getState();
    var row = Object.assign({ user_id: userId }, stateToSnapshot(state));
    var res = await client.from('wizard_snapshots').upsert(row, { onConflict: 'user_id' });
    if (res && res.error) throw res.error;
  }

  async function pushReport(userId) {
    var state = getState();
    if (!state.lastReport) return;
    var res = await client.from('reports').insert(reportToRow(state.lastReport, userId));
    if (res && res.error) throw res.error;
  }

  return {
    hydrate: hydrate,
    pushRecord: pushRecord,
    uploadLocalRecords: uploadLocalRecords,
    pushSnapshot: pushSnapshot,
    pushReport: pushReport,
  };
}
