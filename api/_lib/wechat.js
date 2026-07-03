// Server-side WeChat OAuth helpers (Vercel functions only — never ship to the browser).
// Session strategy: WeChat identity -> native Supabase auth user (synthetic email)
// -> admin generateLink(magiclink) -> client verifyOtp({ type:'magiclink', token_hash }).
// This keeps WeChat users as first-class auth.users rows so RLS and FKs just work.

export async function exchangeWeChatCode(opts) {
  var f = opts.fetchImpl || fetch;
  var url =
    'https://api.weixin.qq.com/sns/oauth2/access_token' +
    '?appid=' + encodeURIComponent(opts.appId) +
    '&secret=' + encodeURIComponent(opts.secret) +
    '&code=' + encodeURIComponent(opts.code) +
    '&grant_type=authorization_code';
  var data = await (await f(url)).json();
  // WeChat returns errors with HTTP 200; errcode is the only reliable signal.
  if (data && data.errcode) {
    throw new Error('WeChat token exchange failed: ' + data.errcode + ' ' + (data.errmsg || ''));
  }
  return data;
}

export async function fetchWeChatUserInfo(opts) {
  var f = opts.fetchImpl || fetch;
  var url =
    'https://api.weixin.qq.com/sns/userinfo' +
    '?access_token=' + encodeURIComponent(opts.accessToken) +
    '&openid=' + encodeURIComponent(opts.openid) +
    '&lang=zh_CN';
  var data = await (await f(url)).json();
  if (data && data.errcode) {
    throw new Error('WeChat userinfo failed: ' + data.errcode + ' ' + (data.errmsg || ''));
  }
  return data;
}

export async function ensureWeChatUser(opts) {
  var admin = opts.admin;
  var wxid = opts.unionid || opts.openid;

  var existingRes = await admin
    .from('wechat_identities')
    .select('user_id')
    .eq('openid', opts.openid)
    .maybeSingle();
  var existing = existingRes && existingRes.data;
  if (existing && existing.user_id) {
    return { userId: existing.user_id, email: null };
  }

  var email = 'wx_' + wxid + '@' + opts.emailDomain;
  var created = await admin.auth.admin.createUser({
    email: email,
    email_confirm: true,
    user_metadata: {
      wechat_openid: opts.openid,
      wechat_unionid: opts.unionid || null,
      nickname: opts.nickname || null,
      avatar: opts.avatar || null,
    },
  });
  if (created.error) {
    throw new Error('Supabase createUser failed: ' + created.error.message);
  }
  var userId = created.data.user.id;

  await admin.from('wechat_identities').upsert(
    {
      openid: opts.openid,
      unionid: opts.unionid || null,
      user_id: userId,
      profile: { nickname: opts.nickname || null, avatar: opts.avatar || null },
    },
    { onConflict: 'openid' },
  );

  return { userId: userId, email: email };
}

export async function mintMagicToken(opts) {
  var res = await opts.admin.auth.admin.generateLink({
    type: 'magiclink',
    email: opts.email,
  });
  if (res.error) throw new Error('generateLink failed: ' + res.error.message);
  return res.data.properties.hashed_token;
}
