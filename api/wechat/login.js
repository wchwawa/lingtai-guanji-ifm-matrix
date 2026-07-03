// Entry leg of WeChat OAuth: set a state cookie and 302 to the WeChat authorize page.
// mode=qr (default): Open-Platform website scan login; mode=mp: inside WeChat browser.
import { buildWeChatAuthorizeUrl, randomState } from '../../js/cloud/auth-core.js';

export default function handler(req, res) {
  var appId = process.env.WECHAT_APP_ID;
  var secret = process.env.WECHAT_APP_SECRET;
  if (!appId || !secret) {
    res.status(503).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<body style="font-family:-apple-system,PingFang SC,sans-serif;padding:44px 24px;color:#253047;max-width:560px;margin:0 auto">' +
      '<h3>微信登录暂未开通</h3>' +
      '<p style="color:#6F7482;line-height:1.8">服务端尚未配置微信开放平台凭证（WECHAT_APP_ID / WECHAT_APP_SECRET）。' +
      '微信「网站应用」需要企业主体资质认证与 ICP 备案的回调域名，凭证配置完成后此入口自动生效。' +
      '你可以先使用邮箱或手机号登录。</p>' +
      '<p><a href="../" style="color:#C59A5B">← 返回观己</a></p></body>'
    );
    return;
  }
  var state = randomState();
  var proto = req.headers['x-forwarded-proto'] || 'https';
  var host = req.headers['x-forwarded-host'] || req.headers.host;
  var redirectUri = proto + '://' + host + '/api/wechat/callback';
  res.setHeader(
    'Set-Cookie',
    'wx_oauth_state=' + state + '; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600'
  );
  var mode = req.query && req.query.mode === 'mp' ? 'mp' : 'qr';
  res.redirect(302, buildWeChatAuthorizeUrl({ appId: appId, redirectUri: redirectUri, state: state, mode: mode }));
}
