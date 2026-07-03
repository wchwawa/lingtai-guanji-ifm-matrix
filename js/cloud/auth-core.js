// Pure auth helpers shared by the browser module and the Vercel serverless functions.
// No supabase-js import here — keep this file dependency-free and unit-testable.

export function normalizeMainlandPhone(input) {
  if (typeof input !== 'string') return null;
  var d = input.replace(/[\s\-()]/g, '');
  if (d.slice(0, 3) === '+86') d = d.slice(3);
  else if (d.slice(0, 2) === '86' && d.length === 13) d = d.slice(2);
  if (!/^1[3-9]\d{9}$/.test(d)) return null;
  return '+86' + d;
}

export function isMainlandMobile(phone) {
  return typeof phone === 'string' && /^\+861[3-9]\d{9}$/.test(phone);
}

// WeChat OAuth entry URL.
// mode 'qr' (default): Open-Platform website app scan login (snsapi_login).
// mode 'mp': in-WeChat browser via Official Account web auth (snsapi_userinfo).
export function buildWeChatAuthorizeUrl(opts) {
  var o = opts || {};
  if (!o.appId || !o.redirectUri || !o.state) {
    throw new Error('buildWeChatAuthorizeUrl: appId, redirectUri and state are required');
  }
  var mp = o.mode === 'mp';
  var base = mp
    ? 'https://open.weixin.qq.com/connect/oauth2/authorize'
    : 'https://open.weixin.qq.com/connect/qrconnect';
  var scope = mp ? 'snsapi_userinfo' : 'snsapi_login';
  return (
    base +
    '?appid=' + encodeURIComponent(o.appId) +
    '&redirect_uri=' + encodeURIComponent(o.redirectUri) +
    '&response_type=code' +
    '&scope=' + scope +
    '&state=' + encodeURIComponent(o.state) +
    '#wechat_redirect'
  );
}

export function randomState() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID().replace(/-/g, '');
  }
  var out = '';
  while (out.length < 32) out += Math.random().toString(36).slice(2);
  return out.slice(0, 32);
}
