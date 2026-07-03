// Aliyun SMS (dysmsapi, RPC API 2017-05-25) delivery for the Supabase "Send SMS" auth hook.
// Supabase keeps generating/verifying/rate-limiting OTPs; we only deliver the code.
import { createHmac } from 'node:crypto';

// Aliyun RPC percent-encoding: RFC3986 with space=%20, *=%2A, ~ kept literal.
export function aliyunSpecialEncode(v) {
  return encodeURIComponent(String(v))
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~')
    .replace(/[!'()]/g, function (c) {
      return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    });
}

export function signAliyunRequest(params, accessKeySecret) {
  var canonical = Object.keys(params)
    .sort()
    .map(function (k) {
      return aliyunSpecialEncode(k) + '=' + aliyunSpecialEncode(params[k]);
    })
    .join('&');
  var stringToSign = 'GET&' + aliyunSpecialEncode('/') + '&' + aliyunSpecialEncode(canonical);
  return createHmac('sha1', accessKeySecret + '&').update(stringToSign).digest('base64');
}

export function buildSendSmsUrl(opts) {
  var params = {
    AccessKeyId: opts.accessKeyId,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: opts.phoneNational,
    RegionId: 'cn-hangzhou',
    SignName: opts.signName,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: opts.nonce,
    SignatureVersion: '1.0',
    TemplateCode: opts.templateCode,
    TemplateParam: JSON.stringify({ code: opts.otp }),
    Timestamp: opts.timestamp,
    Version: '2017-05-25',
  };
  var signature = signAliyunRequest(params, opts.accessKeySecret);
  var qs = Object.keys(params)
    .map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    })
    .join('&');
  return 'https://dysmsapi.aliyuncs.com/?' + qs + '&Signature=' + encodeURIComponent(signature);
}

export function makeAliyunSender(env, fetchImpl) {
  var f = fetchImpl || fetch;
  return async function send(phoneNational, otp) {
    var url = buildSendSmsUrl({
      accessKeyId: env.ALIYUN_SMS_ACCESS_KEY_ID,
      accessKeySecret: env.ALIYUN_SMS_ACCESS_KEY_SECRET,
      signName: env.ALIYUN_SMS_SIGN_NAME,
      templateCode: env.ALIYUN_SMS_TEMPLATE_CODE,
      phoneNational: phoneNational,
      otp: otp,
      nonce: Math.random().toString(36).slice(2) + Date.now(),
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    });
    return (await f(url)).json();
  };
}

export async function handleSendSmsPayload(payload, deps) {
  var phone = payload && payload.user && payload.user.phone;
  if (!/^\+861[3-9]\d{9}$/.test(phone || '')) {
    throw new Error('Only mainland China (+86) mobile numbers are supported by this SMS channel: ' + phone);
  }
  var otp = payload.sms && payload.sms.otp;
  var res = await deps.sender(phone.slice(3), otp);
  if (res && res.Code && res.Code !== 'OK') {
    throw new Error('Aliyun SMS delivery failed: ' + res.Code + ' ' + (res.Message || ''));
  }
  return { ok: true };
}
