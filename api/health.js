export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: 'lingtai-guanji',
    supabase_configured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    wechat_configured: Boolean(process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET),
    sms_configured: Boolean(process.env.ALIYUN_SMS_ACCESS_KEY_ID && process.env.ALIYUN_SMS_ACCESS_KEY_SECRET),
    time: new Date().toISOString(),
  });
}
