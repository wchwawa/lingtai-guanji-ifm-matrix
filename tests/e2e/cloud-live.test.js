// Live acceptance suite against the REAL hosted Supabase project.
// Runs only when SUPABASE_URL / SUPABASE_ANON_KEY are present in the environment
// (source .env first). Uses the config-declared test OTP number, so no SMS is sent.
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const TEST_PHONE = '+8613800138000';
const TEST_OTP = '123456';

describe.skipIf(!URL || !ANON)('live cloud acceptance (hosted Supabase)', () => {
  let client;
  let userId;

  beforeAll(async () => {
    client = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const send = await client.auth.signInWithOtp({ phone: TEST_PHONE });
    expect(send.error).toBeNull();
    const ver = await client.auth.verifyOtp({ phone: TEST_PHONE, token: TEST_OTP, type: 'sms' });
    expect(ver.error).toBeNull();
    userId = ver.data.user.id;
  }, 30000);

  it('signs in with a +86 phone number via OTP', () => {
    expect(userId).toBeTruthy();
  });

  it('auto-creates a profile row through the auth trigger', async () => {
    const { data, error } = await client.from('profiles').select('id').eq('id', userId).maybeSingle();
    expect(error).toBeNull();
    expect(data && data.id).toBe(userId);
  });

  it('inserts and reads back a health record under RLS', async () => {
    const payload = { date: '2026-07-03', weight: '60.5', bmi: '21.0', marker: 'e2e-' + Math.random().toString(36).slice(2) };
    const ins = await client
      .from('health_records')
      .insert({ user_id: userId, record_date: payload.date, payload })
      .select('id')
      .single();
    expect(ins.error).toBeNull();
    const sel = await client.from('health_records').select('payload').eq('id', ins.data.id).single();
    expect(sel.error).toBeNull();
    expect(sel.data.payload.weight).toBe('60.5');
    expect(sel.data.payload.marker).toBe(payload.marker);
  });

  it('upserts the per-user wizard snapshot', async () => {
    const up = await client
      .from('wizard_snapshots')
      .upsert({ user_id: userId, submitted: true, basic: { nick: 'e2e' } }, { onConflict: 'user_id' });
    expect(up.error).toBeNull();
    const sel = await client.from('wizard_snapshots').select('submitted, basic').eq('user_id', userId).single();
    expect(sel.error).toBeNull();
    expect(sel.data.submitted).toBe(true);
    expect(sel.data.basic.nick).toBe('e2e');
  });

  it('inserts and reads back a report row', async () => {
    const ins = await client
      .from('reports')
      .insert({ user_id: userId, engine: 'e2e-engine', payload: { sections: { summary: { nick: 'e2e' } } } })
      .select('id')
      .single();
    expect(ins.error).toBeNull();
    expect(ins.data.id).toBeTruthy();
  });

  it('hides every row from an unauthenticated client (RLS)', async () => {
    const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    for (const table of ['health_records', 'wizard_snapshots', 'reports', 'profiles']) {
      const { data } = await anon.from(table).select('*').limit(5);
      expect(data || []).toEqual([]);
    }
  });

  it('locks wechat_identities down even for authenticated users (service-role only)', async () => {
    const { data } = await client.from('wechat_identities').select('openid').limit(5);
    expect(data || []).toEqual([]);
  });

  it('registers an email/password user', async () => {
    const fresh = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const email = 'e2e-' + Date.now() + '@lingtai-guanji-e2e.dev';
    const r = await fresh.auth.signUp({ email, password: 'e2e-Passw0rd!' + Date.now() });
    expect(r.error).toBeNull();
    expect(r.data.user).toBeTruthy();
  });
});
