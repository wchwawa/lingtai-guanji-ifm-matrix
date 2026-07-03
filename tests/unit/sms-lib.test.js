import { describe, it, expect, vi } from 'vitest';
import {
  aliyunSpecialEncode,
  signAliyunRequest,
  buildSendSmsUrl,
  handleSendSmsPayload,
} from '../../api/_lib/sms.js';

describe('aliyunSpecialEncode', () => {
  it('percent-encodes per Aliyun RPC rules (space→%20, *→%2A, ~ stays)', () => {
    expect(aliyunSpecialEncode('a b*~')).toBe('a%20b%2A~');
    expect(aliyunSpecialEncode('中')).toBe(encodeURIComponent('中'));
  });
});

describe('signAliyunRequest', () => {
  const params = {
    AccessKeyId: 'testkey',
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: '13800138000',
    RegionId: 'cn-hangzhou',
    SignName: '观己',
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: 'fixed-nonce',
    SignatureVersion: '1.0',
    TemplateCode: 'SMS_123',
    TemplateParam: '{"code":"123456"}',
    Timestamp: '2026-07-03T00:00:00Z',
    Version: '2017-05-25',
  };

  it('is deterministic for identical input', () => {
    expect(signAliyunRequest(params, 'secret')).toBe(signAliyunRequest(params, 'secret'));
  });

  it('changes when the secret or any param changes', () => {
    const a = signAliyunRequest(params, 'secret');
    expect(signAliyunRequest(params, 'other')).not.toBe(a);
    expect(signAliyunRequest({ ...params, PhoneNumbers: '13900139000' }, 'secret')).not.toBe(a);
  });
});

describe('buildSendSmsUrl', () => {
  it('produces a dysmsapi URL containing signature and all params', () => {
    const url = buildSendSmsUrl({
      accessKeyId: 'AK',
      accessKeySecret: 'SK',
      signName: '观己',
      templateCode: 'SMS_123',
      phoneNational: '13800138000',
      otp: '654321',
      nonce: 'n1',
      timestamp: '2026-07-03T00:00:00Z',
    });
    expect(url.startsWith('https://dysmsapi.aliyuncs.com/?')).toBe(true);
    expect(url).toContain('Action=SendSms');
    expect(url).toContain('PhoneNumbers=13800138000');
    expect(url).toContain('Signature=');
    expect(url).toContain(encodeURIComponent('{"code":"654321"}'));
  });
});

describe('handleSendSmsPayload', () => {
  it('strips +86 and delegates to the sender', async () => {
    const sender = vi.fn(async () => ({ Code: 'OK' }));
    const r = await handleSendSmsPayload(
      { user: { phone: '+8613800138000' }, sms: { otp: '123456' } },
      { sender },
    );
    expect(sender).toHaveBeenCalledWith('13800138000', '123456');
    expect(r.ok).toBe(true);
  });

  it('rejects non-mainland numbers', async () => {
    const sender = vi.fn();
    await expect(handleSendSmsPayload(
      { user: { phone: '+15551234567' }, sms: { otp: '1' } },
      { sender },
    )).rejects.toThrow(/mainland/i);
    expect(sender).not.toHaveBeenCalled();
  });

  it('surfaces provider failures', async () => {
    const sender = vi.fn(async () => ({ Code: 'isv.BUSINESS_LIMIT_CONTROL', Message: 'limit' }));
    await expect(handleSendSmsPayload(
      { user: { phone: '+8613800138000' }, sms: { otp: '1' } },
      { sender },
    )).rejects.toThrow(/BUSINESS_LIMIT_CONTROL/);
  });
});
