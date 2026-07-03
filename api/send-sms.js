// Supabase Auth "Send SMS" hook endpoint. Supabase generates/verifies/rate-limits the OTP;
// this function only verifies the webhook signature and delivers the code via Aliyun SMS.
import { Webhook } from 'standardwebhooks';
import { handleSendSmsPayload, makeAliyunSender } from './_lib/sms.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  var hookSecret = process.env.SEND_SMS_HOOK_SECRET;
  if (!hookSecret) {
    return res.status(503).json({ error: 'sms_hook_not_configured' });
  }
  var payload;
  try {
    var raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    var wh = new Webhook(hookSecret.replace('v1,whsec_', ''));
    payload = wh.verify(raw, req.headers);
  } catch (e) {
    return res.status(401).json({ error: 'invalid_signature' });
  }
  if (!process.env.ALIYUN_SMS_ACCESS_KEY_ID || !process.env.ALIYUN_SMS_ACCESS_KEY_SECRET) {
    return res.status(503).json({
      error: 'aliyun_sms_not_configured',
      message: '短信通道未配置（需企业资质报备的阿里云短信签名与模板）；开发期请使用 test_otp 测试号码。',
    });
  }
  try {
    await handleSendSmsPayload(payload, { sender: makeAliyunSender(process.env) });
    return res.status(200).json({});
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
