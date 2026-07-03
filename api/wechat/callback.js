// Return leg of WeChat OAuth: code -> access_token/openid -> native Supabase user
// -> one-time magiclink token_hash handed to the SPA, which calls verifyOtp for a session.
import { createClient } from '@supabase/supabase-js';
import {
  exchangeWeChatCode,
  fetchWeChatUserInfo,
  ensureWeChatUser,
  mintMagicToken,
} from '../_lib/wechat.js';

function bounce(res, msg) {
  res.redirect(302, '/#wechat_error=' + encodeURIComponent(String(msg).slice(0, 160)));
}

export default async function handler(req, res) {
  try {
    var q = req.query || {};
    if (!q.code) return bounce(res, 'missing_code');
    var cookieState = (req.cookies && req.cookies.wx_oauth_state) || '';
    if (!q.state || q.state !== cookieState) return bounce(res, 'state_mismatch');

    var tok = await exchangeWeChatCode({
      code: q.code,
      appId: process.env.WECHAT_APP_ID,
      secret: process.env.WECHAT_APP_SECRET,
    });

    var nickname = null, avatar = null;
    try {
      var info = await fetchWeChatUserInfo({ accessToken: tok.access_token, openid: tok.openid });
      nickname = info.nickname || null;
      avatar = info.headimgurl || null;
    } catch (e) {
      // userinfo is best-effort; login must not fail because of it
    }

    var admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    var emailDomain = process.env.WECHAT_EMAIL_DOMAIN || 'wechat.guanji.invalid';
    var ensured = await ensureWeChatUser({
      admin: admin,
      openid: tok.openid,
      unionid: tok.unionid,
      nickname: nickname,
      avatar: avatar,
      emailDomain: emailDomain,
    });
    var email = ensured.email || 'wx_' + (tok.unionid || tok.openid) + '@' + emailDomain;
    var tokenHash = await mintMagicToken({ admin: admin, email: email });

    res.setHeader('Set-Cookie', 'wx_oauth_state=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0');
    res.redirect(302, '/#wechat_token_hash=' + encodeURIComponent(tokenHash));
  } catch (e) {
    bounce(res, (e && e.message) || 'wechat_login_failed');
  }
}
