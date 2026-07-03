import { describe, it, expect } from 'vitest';
import {
  normalizeMainlandPhone,
  isMainlandMobile,
  buildWeChatAuthorizeUrl,
  randomState,
} from '../../js/cloud/auth-core.js';

describe('normalizeMainlandPhone', () => {
  it('adds +86 to a bare 11-digit mainland mobile', () => {
    expect(normalizeMainlandPhone('13812345678')).toBe('+8613812345678');
  });
  it('keeps an already-prefixed number', () => {
    expect(normalizeMainlandPhone('+8613812345678')).toBe('+8613812345678');
  });
  it('accepts 86-prefixed without plus and strips separators/whitespace', () => {
    expect(normalizeMainlandPhone('86 138-1234-5678')).toBe('+8613812345678');
    expect(normalizeMainlandPhone(' 138 1234 5678 ')).toBe('+8613812345678');
  });
  it('rejects malformed input with null', () => {
    expect(normalizeMainlandPhone('12812345678')).toBeNull(); // 12x is not a mobile prefix
    expect(normalizeMainlandPhone('1381234567')).toBeNull();  // 10 digits
    expect(normalizeMainlandPhone('138123456789')).toBeNull(); // 12 digits
    expect(normalizeMainlandPhone('+15551234567')).toBeNull(); // non-mainland
    expect(normalizeMainlandPhone('')).toBeNull();
    expect(normalizeMainlandPhone(null)).toBeNull();
  });
});

describe('isMainlandMobile', () => {
  it('validates 1[3-9] prefixes only', () => {
    expect(isMainlandMobile('+8613912345678')).toBe(true);
    expect(isMainlandMobile('+8619912345678')).toBe(true);
    expect(isMainlandMobile('+8612912345678')).toBe(false);
    expect(isMainlandMobile('+8613912345')).toBe(false);
  });
});

describe('buildWeChatAuthorizeUrl', () => {
  it('builds a website qr-connect URL (snsapi_login) with encoded redirect and fragment', () => {
    const url = buildWeChatAuthorizeUrl({
      appId: 'wx_app_id',
      redirectUri: 'https://example.com/api/wechat/callback',
      state: 'abc123',
    });
    expect(url.startsWith('https://open.weixin.qq.com/connect/qrconnect?')).toBe(true);
    expect(url).toContain('appid=wx_app_id');
    expect(url).toContain('redirect_uri=' + encodeURIComponent('https://example.com/api/wechat/callback'));
    expect(url).toContain('response_type=code');
    expect(url).toContain('scope=snsapi_login');
    expect(url).toContain('state=abc123');
    expect(url.endsWith('#wechat_redirect')).toBe(true);
  });

  it('switches to in-wechat oauth2/authorize with snsapi_userinfo when mode is "mp"', () => {
    const url = buildWeChatAuthorizeUrl({
      appId: 'wx',
      redirectUri: 'https://e.com/cb',
      state: 's',
      mode: 'mp',
    });
    expect(url.startsWith('https://open.weixin.qq.com/connect/oauth2/authorize?')).toBe(true);
    expect(url).toContain('scope=snsapi_userinfo');
    expect(url.endsWith('#wechat_redirect')).toBe(true);
  });

  it('throws when required params are missing', () => {
    expect(() => buildWeChatAuthorizeUrl({ redirectUri: 'x', state: 's' })).toThrow();
    expect(() => buildWeChatAuthorizeUrl({ appId: 'a', state: 's' })).toThrow();
  });
});

describe('randomState', () => {
  it('produces url-safe, collision-resistant tokens', () => {
    const a = randomState();
    const b = randomState();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(16);
    expect(/^[A-Za-z0-9_-]+$/.test(a)).toBe(true);
  });
});
