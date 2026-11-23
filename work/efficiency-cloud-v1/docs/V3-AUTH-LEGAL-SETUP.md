# V3 登录、原创 UI 与法律文档配置指南

## 本版新增
- 原创效率云品牌图标（SVG）、统一登录卡片与移动端布局。
- 邮箱密码登录/注册。
- 手机短信验证码登录/注册（Supabase OTP）。
- Google OAuth 与 Sign in with Apple 按钮。
- 服务条款、隐私政策、免责声明、法律声明独立页面。
- 登录区和工作台页脚提供法律文件入口。

## 必须完成的 Supabase 设置
1. 在 Authentication → URL Configuration 设置正式 Site URL，并加入本地/正式站点 Redirect URLs。
2. 在 Authentication → Providers 启用 Email、Phone、Google、Apple。
3. 邮箱注册建议启用邮箱验证；配置 SMTP 发信服务，避免依赖默认测试邮件额度。
4. Phone provider 需要配置合规的 SMS 服务商、发送者、国家/地区允许列表和防滥用限制。短信费用由服务商收取。
5. Google：在 Google Cloud Console 创建 OAuth 客户端，按 Supabase 页面给出的 Callback URL 配置授权重定向 URI，再将 Client ID/Secret 填入 Supabase。
6. Apple：在 Apple Developer 配置 Sign in with Apple 的 App ID / Services ID / Team ID / Key，并按 Supabase 当前说明配置回调域名与密钥。Apple 开发者账户和域名验证由账户持有人完成。
7. OAuth Redirect URL 必须与部署域名一致；上线前在 iOS Safari、Android Chrome 和桌面浏览器分别测试回调。

## 重要安全说明
- 前端只使用 Supabase publishable/anon key；绝不能把 service_role、OAuth client secret、SMS API secret 或任何支付服务商密钥 放入 VITE_ 环境变量。
- 启用 CAPTCHA、速率限制、邮件/短信发送限制和异常登录监测。
- 电话号码必须使用 E.164 格式，例如 +14155552671。
- Google / Apple 按钮只有在 Supabase Provider 配置完成后才可用；按钮存在不代表已经获得 Apple/Google 授权。
- Apple/Google OAuth 账号合并策略需先评估账户接管风险，不要仅凭相同邮箱自动合并身份。
- 手机 OTP 默认由 Supabase 的 signInWithOtp 创建/登录账户；若产品需要独立“注册”和“登录”流程，应在服务端增加验证后的账户状态/邀请规则。

## 法律文件上线前必填
请由实际运营主体补全主体名称、联系邮箱/地址、适用法律、管辖地、数据保存期限、第三方处理商清单、退款/取消规则、最低年龄和数据主体权利流程，并请目标市场律师审阅。模板不是法律意见，也不保证满足任何特定国家/地区的法律。

## 建议验收
- 邮箱注册、验证邮件、登录、退出、密码重置（本版尚未添加 UI）。
- 手机 OTP 发送/验证、无效码、重发频率限制和费用控制。
- Google/Apple OAuth 成功、取消、错误回调与移动端深链。
- 隐私政策与条款在注册前可访问；同意动作需与正式条款流程匹配。
- 不同账户之间无法读取/修改彼此任务；验证 Supabase RLS。


## 3.3 效率云 ID 账户
- 执行 `supabase/migrations/202611220002_efficiency_cloud_id.sql`，为每个 profiles 账户分配稳定且唯一的 `EC-...` 标识。
- 邮箱注册建议启用确认邮件，并配置正式 SMTP；在 Authentication → URL Configuration 中加入所有实际站点回调地址（建议按 Supabase 要求使用精确 URL 或受控通配符，例如 `https://your-domain.example/**`；不要放开任意域名）。
- 测试忘记密码邮件、密码更新、邮箱未验证、过期链接、不同设备登录及退出登录。
- 效率云 ID 是本产品内部标识，不是 Apple ID；Apple 登录只是可选身份提供商。不要把云 ID 当作秘密或密码。
- 当前不提供自建密码存储；密码哈希、会话、刷新令牌与身份验证由 Supabase Auth 管理。


## 3.3.1 账户恢复与邮箱安全提醒
- 执行 `supabase/migrations/202611220004_account_recovery_email_alerts.sql`。
- 在 Supabase Auth → URL Configuration 将正式站点 `/?recovery=1` 对应的站点域名加入 Redirect URLs；密码重置邮件由 Supabase Auth 发出，必须配置正式 SMTP 和邮件模板。
- 部署 Edge Function：`supabase functions deploy security-email-alert`。
- 为 Edge Function 设置服务端密钥：`RESEND_API_KEY`、`SECURITY_ALERT_FROM_EMAIL`，以及既有 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`APP_URL`。这些密钥绝不能放入 `VITE_` 环境变量或前端代码。
- Resend 发件域名需完成验证；邮件服务未配置时，密码重置仍由 Supabase Auth SMTP 发送，但新登录/密码变更提醒不会送达。若使用 Capacitor 原生壳，还需将实际使用的 `capacitor://localhost`（以及确有需要的本地开发 Origin）加入 `ADDITIONAL_ALLOWED_ORIGINS`。
- 用户可在账户中心关闭“新登录和密码变更提醒”。服务端每个事件类型每小时最多发送 3 封，避免邮件轰炸。
- 密码恢复：用户输入注册邮箱请求重置；通过邮件中的一次性链接回到 `/?recovery=1`；验证成功后在账户中心设置新密码。过期或已使用链接应重新发起恢复。
- 安全提醒只覆盖应用能够确认的登录事件和应用内密码变更；不保证识别所有 OAuth 提供商侧变化、后台管理员操作或第三方会话活动。
- 验收：测试已验证邮箱、未验证邮箱、无效/过期恢复链接、密码更新成功/失败、通知开关、Resend 发送失败、速率限制和账户之间邮件隔离。
