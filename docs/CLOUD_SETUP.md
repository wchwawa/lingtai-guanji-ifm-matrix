# 观己 · 云端架构说明（2026-07-03）

## 架构总览

```
浏览器（index.html 单文件 App，UI 未动）
 ├─ assets/vendor/supabase.js     ← 本地 vendor 的 supabase-js UMD（无 CDN）
 ├─ js/cloud/main.js              ← ESM 胶水层：包装 saveData/generateReport/go，不改内联代码
 │   ├─ js/cloud/config.js        ← SUPABASE_URL + anon key（公开凭证，RLS 兜底）
 │   ├─ js/cloud/auth-core.js     ← 纯函数：手机号规范化 / 微信授权 URL
 │   ├─ js/cloud/mapping.js       ← state ↔ 数据行 映射（保骨架/哨兵/竞态不变量）
 │   └─ js/cloud/sync.js          ← hydrate / push（依赖注入，可单测）
 ├─ Vercel（lingtai-guanji.vercel.app，静态 + api/ functions，region hnd1）
 │   ├─ api/health.js             ← 配置状态探针
 │   ├─ api/wechat/login.js       ← 302 → 微信 qrconnect（未配置时返回友好页）
 │   ├─ api/wechat/callback.js    ← code→openid→创建原生用户→magiclink token_hash
 │   └─ api/send-sms.js           ← Supabase Send SMS Hook → 阿里云短信
 └─ Supabase（yacbgtpivizpixaklwjx · ap-northeast-1 东京）
     ├─ auth.users + profiles（触发器自动建档）
     ├─ wizard_snapshots（每用户一行：问卷切片）
     ├─ health_records / reports（追加式，RLS 行级隔离）
     └─ wechat_identities（仅 service_role 可达）
```

## 三种登录现状

| 通道 | 状态 | 说明 |
|---|---|---|
| 邮箱（密码 + 魔法链接） | ✅ 可用 | 注册即登录（邮箱确认暂关，开启需先配自定义 SMTP——内置邮件仅 2 封/小时且只发团队成员） |
| 大陆手机号 OTP | ✅ 链路全通 | 测试号 138-0013-8000 / 验证码 123456（不发真实短信）；真实发送需阿里云企业资质签名报备后填 `ALIYUN_SMS_*` |
| 微信扫码 | 🟡 代码就绪、凭证待补 | 需微信开放平台**企业主体**资质（300 元）+ ICP 备案回调域名，审核约 7 个工作日；配好 `WECHAT_APP_ID/SECRET` 即自动生效 |

## 凭证补齐操作（拿到资质后）

```bash
# 阿里云短信
printf '%s' "$KEY_ID"  | vercel env add ALIYUN_SMS_ACCESS_KEY_ID production
printf '%s' "$SECRET"  | vercel env add ALIYUN_SMS_ACCESS_KEY_SECRET production
printf '%s' "观己"      | vercel env add ALIYUN_SMS_SIGN_NAME production
printf '%s' "SMS_xxx"  | vercel env add ALIYUN_SMS_TEMPLATE_CODE production
# 微信
printf '%s' "$APP_ID"     | vercel env add WECHAT_APP_ID production
printf '%s' "$APP_SECRET" | vercel env add WECHAT_APP_SECRET production
# 环境变量只对新部署生效
vercel deploy --prod --yes
```

## 测试

```bash
npm test          # 单元测试（纯逻辑，离线）
source .env && npm run test:e2e   # 对真实云端的验收（test OTP 全链路 + RLS）
```

## 已知边界（如实声明）

- `*.vercel.app` 与 `*.supabase.co` 在中国大陆可达性不稳定（前者基本被墙）。正式面向大陆用户需：绑定已备案自定义域名（Vercel 侧）+ Supabase Pro 档 custom domain，或迁移境内托管。当前部署定位为**内测/演示环境**。
- Supabase 免费档项目闲置 7 天会自动暂停，生产化前需升 Pro。
- 微信「网站应用」个人主体无法过审，这是平台硬门槛，非代码问题。
- 不登录时行为与原版完全一致（纯内存、导出 JSON 兜底），铁律（非诊断/非处方、IFM 模板不动、问卷逻辑不动）未受影响。
