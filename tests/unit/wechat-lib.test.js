import { describe, it, expect, vi } from 'vitest';
import {
  exchangeWeChatCode,
  fetchWeChatUserInfo,
  ensureWeChatUser,
  mintMagicToken,
} from '../../api/_lib/wechat.js';

function jsonFetch(payload) {
  return vi.fn(async () => ({ json: async () => payload }));
}

describe('exchangeWeChatCode', () => {
  it('calls the sns oauth2 endpoint with appid/secret/code and returns token data', async () => {
    const fetchImpl = jsonFetch({ access_token: 'AT', openid: 'OID', unionid: 'UID' });
    const tok = await exchangeWeChatCode({ code: 'C', appId: 'A', secret: 'S', fetchImpl });
    expect(tok).toEqual({ access_token: 'AT', openid: 'OID', unionid: 'UID' });
    const url = fetchImpl.mock.calls[0][0];
    expect(url.startsWith('https://api.weixin.qq.com/sns/oauth2/access_token?')).toBe(true);
    expect(url).toContain('appid=A');
    expect(url).toContain('secret=S');
    expect(url).toContain('code=C');
    expect(url).toContain('grant_type=authorization_code');
  });

  it('throws on WeChat error payloads (which come back with HTTP 200)', async () => {
    const fetchImpl = jsonFetch({ errcode: 40029, errmsg: 'invalid code' });
    await expect(exchangeWeChatCode({ code: 'bad', appId: 'A', secret: 'S', fetchImpl }))
      .rejects.toThrow(/40029/);
  });
});

describe('fetchWeChatUserInfo', () => {
  it('fetches sns/userinfo with token and openid', async () => {
    const fetchImpl = jsonFetch({ nickname: '圆', headimgurl: 'http://x/a.png' });
    const info = await fetchWeChatUserInfo({ accessToken: 'AT', openid: 'OID', fetchImpl });
    expect(info.nickname).toBe('圆');
    const url = fetchImpl.mock.calls[0][0];
    expect(url).toContain('access_token=AT');
    expect(url).toContain('openid=OID');
  });

  it('throws on error payloads', async () => {
    const fetchImpl = jsonFetch({ errcode: 40001, errmsg: 'invalid credential' });
    await expect(fetchWeChatUserInfo({ accessToken: 'x', openid: 'y', fetchImpl }))
      .rejects.toThrow(/40001/);
  });
});

function makeAdmin({ existingIdentity = null, createdUserId = 'new-user' } = {}) {
  const calls = { createUser: [], upserts: [] };
  return {
    calls,
    auth: {
      admin: {
        createUser: vi.fn(async (attrs) => {
          calls.createUser.push(attrs);
          return { data: { user: { id: createdUserId, email: attrs.email } }, error: null };
        }),
        generateLink: vi.fn(async () => ({
          data: { properties: { hashed_token: 'HASHED' } },
          error: null,
        })),
      },
    },
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({ data: existingIdentity, error: null }),
        upsert: async (row, opts) => { calls.upserts.push([table, row, opts]); return { data: null, error: null }; },
      };
    },
  };
}

describe('ensureWeChatUser', () => {
  it('returns the existing user when the wechat identity is already linked', async () => {
    const admin = makeAdmin({ existingIdentity: { user_id: 'u-existing' } });
    const r = await ensureWeChatUser({
      admin, openid: 'OID', unionid: 'UID',
      nickname: 'n', avatar: 'a', emailDomain: 'wechat.example.com',
    });
    expect(r.userId).toBe('u-existing');
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('creates a native auth user with a synthetic email and records the identity', async () => {
    const admin = makeAdmin({ existingIdentity: null, createdUserId: 'u-new' });
    const r = await ensureWeChatUser({
      admin, openid: 'OID', unionid: 'UID',
      nickname: '圆', avatar: 'http://x', emailDomain: 'wechat.example.com',
    });
    expect(r.userId).toBe('u-new');
    expect(r.email).toBe('wx_UID@wechat.example.com'); // unionid preferred over openid
    const attrs = admin.calls.createUser[0];
    expect(attrs.email_confirm).toBe(true);
    expect(attrs.user_metadata.wechat_unionid).toBe('UID');
    expect(attrs.user_metadata.nickname).toBe('圆');
    const [table, row] = admin.calls.upserts[0];
    expect(table).toBe('wechat_identities');
    expect(row.openid).toBe('OID');
    expect(row.user_id).toBe('u-new');
  });

  it('falls back to openid when unionid is absent', async () => {
    const admin = makeAdmin({ existingIdentity: null });
    const r = await ensureWeChatUser({
      admin, openid: 'OID', unionid: undefined,
      emailDomain: 'wechat.example.com',
    });
    expect(r.email).toBe('wx_OID@wechat.example.com');
  });
});

describe('mintMagicToken', () => {
  it('generates a magiclink and returns the hashed token for client-side verifyOtp', async () => {
    const admin = makeAdmin({});
    const token = await mintMagicToken({ admin, email: 'wx_x@wechat.example.com' });
    expect(token).toBe('HASHED');
    expect(admin.auth.admin.generateLink).toHaveBeenCalledWith({
      type: 'magiclink',
      email: 'wx_x@wechat.example.com',
    });
  });
});
