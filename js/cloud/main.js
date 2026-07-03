// Cloud glue layer (2026-07-03). Runs AFTER the classic inline script (ES module timing),
// so window.state / window.go / window.saveData are guaranteed to exist.
// Design rules: never touch existing UI rendering; wrap globals instead of editing them;
// stay a no-op when js/cloud/config.js is unconfigured (original pure-local behavior).
import { CLOUD_CONFIG } from './config.js';
import { normalizeMainlandPhone } from './auth-core.js';
import { createCloudSync } from './sync.js';

function $(id) { return document.getElementById(id); }
function note(msg) { if (typeof window.flash === 'function') window.flash(msg); }

var sb = null;
function client() {
  if (sb) return sb;
  if (!window.supabase || !CLOUD_CONFIG.url || !CLOUD_CONFIG.anonKey) return null;
  sb = window.supabase.createClient(CLOUD_CONFIG.url, CLOUD_CONFIG.anonKey);
  return sb;
}

var currentUser = null;

var VIEW_RENDERERS = {
  wizard: 'renderWizard', data: 'renderData', trend: 'renderTrend',
  matrix: 'renderMatrix', report: 'renderReportView', ai: 'renderAi', pro: 'renderPro',
};

function repaintActive() {
  var active = document.querySelector('section.view.active');
  if (!active) return;
  var name = active.id.replace(/^view-/, '');
  var fn = VIEW_RENDERERS[name] && window[VIEW_RENDERERS[name]];
  if (typeof fn === 'function') fn();
  if (name === 'report' && typeof window.requestIfmTemplateFit === 'function') {
    window.requestIfmTemplateFit();
  }
}

var sync = createCloudSync({
  client: { from: function (t) { return client().from(t); } },
  getState: function () { return window.state; },
  repaint: repaintActive,
});

function updateAccountUI() {
  var guest = $('authGuest'), panel = $('authUser'), btn = $('accountBtn');
  var who = $('authWho'), avatar = $('authAvatar'), body = $('accStatusBody');
  if (currentUser) {
    var meta = currentUser.user_metadata || {};
    var name = String(meta.nickname || currentUser.email || currentUser.phone || currentUser.id.slice(0, 8));
    if (guest) guest.style.display = 'none';
    if (panel) panel.style.display = 'block';
    if (who) who.textContent = name;
    var initial = name.replace(/^\+?86/, '').charAt(0).toUpperCase();
    if (avatar) avatar.textContent = (!initial || /\d/.test(initial)) ? '观' : initial;
    if (body) body.textContent = '问卷、健康数据档案与报告将自动同步到你的云端空间（按账户隔离）。';
    if (btn) btn.textContent = name.length > 12 ? name.slice(0, 12) + '…' : name;
  } else {
    if (guest) guest.style.display = 'block';
    if (panel) panel.style.display = 'none';
    if (btn) btn.textContent = '登录';
  }
}

async function afterSignIn() {
  try {
    await sync.uploadLocalRecords(currentUser.id);
    await sync.hydrate(currentUser.id);
    note('已连接云端，数据已同步');
  } catch (e) {
    console.warn('[cloud] sync after sign-in failed:', e);
    note('云端同步失败，数据仍保留在本页内');
  }
}

var snapTimer = null;
function schedulePushSnapshot() {
  if (!currentUser || !client()) return;
  clearTimeout(snapTimer);
  snapTimer = setTimeout(function () {
    sync.pushSnapshot(currentUser.id).catch(function (e) { console.warn('[cloud] snapshot push failed:', e); });
  }, 800);
}

/* ── wrap existing globals (no inline edits) ── */
var origSaveData = window.saveData;
window.saveData = function () {
  var before = window.state.records.length;
  origSaveData.apply(this, arguments);
  if (currentUser && window.state.records.length > before) {
    var rec = window.state.records[0];
    sync.pushRecord(rec, currentUser.id)
      .then(function () { note('已保存并同步云端'); })
      .catch(function (e) { console.warn('[cloud] record push failed:', e); note('云端同步失败，本条记录仍在本页内'); });
    schedulePushSnapshot();
  }
};

var origGenerateReport = window.generateReport;
window.generateReport = function () {
  origGenerateReport.apply(this, arguments);
  if (currentUser && window.state.lastReport) {
    sync.pushReport(currentUser.id).catch(function (e) { console.warn('[cloud] report push failed:', e); });
    schedulePushSnapshot();
  }
};

var origGo = window.go;
window.go = function (v) {
  origGo.apply(this, arguments);
  if (v === 'account') updateAccountUI();
  schedulePushSnapshot(); // navigation acts as a questionnaire checkpoint
};

/* ── auth actions used by the account view ── */
function guard() {
  if (!client()) { note('云端服务未配置，登录暂不可用'); return false; }
  return true;
}

window.cloudAuth = {
  signUpEmail: async function () {
    if (!guard()) return;
    var email = ($('accEmail').value || '').trim();
    var password = $('accPassword').value || '';
    if (!email || password.length < 6) { note('请输入邮箱和至少 6 位的密码'); return; }
    var r = await client().auth.signUp({ email: email, password: password });
    if (r.error) { note('注册失败：' + r.error.message); return; }
    note(r.data.session ? '注册成功，已登录' : '注册成功，请到邮箱点击确认链接后登录');
  },
  signInEmail: async function () {
    if (!guard()) return;
    var email = ($('accEmail').value || '').trim();
    var password = $('accPassword').value || '';
    var r = await client().auth.signInWithPassword({ email: email, password: password });
    if (r.error) { note('登录失败：' + r.error.message); return; }
    note('登录成功');
  },
  sendMagicLink: async function () {
    if (!guard()) return;
    var email = ($('accEmail').value || '').trim();
    if (!email) { note('请先填写邮箱'); return; }
    var r = await client().auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: location.origin + location.pathname },
    });
    if (r.error) { note('发送失败：' + r.error.message); return; }
    note('登录链接已发送到邮箱，请查收');
  },
  sendPhoneOtp: async function () {
    if (!guard()) return;
    var phone = normalizeMainlandPhone($('accPhone').value || '');
    if (!phone) { note('请输入有效的中国大陆手机号'); return; }
    var r = await client().auth.signInWithOtp({ phone: phone });
    if (r.error) { note('验证码发送失败：' + r.error.message); return; }
    note('验证码已发送');
  },
  verifyPhoneOtp: async function () {
    if (!guard()) return;
    var phone = normalizeMainlandPhone($('accPhone').value || '');
    var token = ($('accOtp').value || '').trim();
    if (!phone || !token) { note('请填写手机号与验证码'); return; }
    var r = await client().auth.verifyOtp({ phone: phone, token: token, type: 'sms' });
    if (r.error) { note('验证失败：' + r.error.message); return; }
    note('登录成功');
  },
  signInWeChat: function () {
    // 服务端 OAuth 链路已就绪（api/wechat/*）；微信网站应用需企业资质与备案域名，
    // 凭证配置前按产品要求仅提示，不跳转。
    note('微信登录暂未开通，敬请期待');
  },
  signOut: async function () {
    if (!guard()) return;
    await client().auth.signOut();
    note('已退出登录（本页内数据保留，刷新后清空）');
  },
  syncNow: async function () {
    if (!guard() || !currentUser) return;
    try {
      await sync.pushSnapshot(currentUser.id);
      await sync.uploadLocalRecords(currentUser.id);
      await sync.pushReport(currentUser.id);
      note('已同步到云端');
    } catch (e) {
      note('同步失败：' + (e.message || e));
    }
  },
};

/* ── boot ── */
(async function boot() {
  updateAccountUI();
  var c = client();
  if (!c) return;

  var h = location.hash || '';
  var mTok = h.match(/wechat_token_hash=([^&]+)/);
  var mErr = h.match(/wechat_error=([^&]+)/);
  if (mTok || mErr) history.replaceState(null, '', location.pathname + location.search);
  if (mErr) note('微信登录失败：' + decodeURIComponent(mErr[1]));

  c.auth.onAuthStateChange(function (event, session) {
    var prevId = currentUser && currentUser.id;
    currentUser = (session && session.user) || null;
    updateAccountUI();
    if (currentUser && currentUser.id !== prevId) afterSignIn();
  });

  if (mTok) {
    try {
      var r = await c.auth.verifyOtp({ type: 'magiclink', token_hash: decodeURIComponent(mTok[1]) });
      if (r.error) throw r.error;
      note('微信登录成功');
    } catch (e) {
      note('微信登录失败：' + (e.message || e));
    }
  }
})();
