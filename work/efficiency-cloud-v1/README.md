# 效率云 Efficiency Cloud 3.5.0

效率云是基于 Vite、Supabase 和 Capacitor 的任务管理应用。

## 免费使用
本应用完全免费，不含任何付费或支付功能。

## 独立效率云 ID

- 每个注册账户拥有独立、稳定的 `EC-...` 效率云 ID。
- 支持邮箱/密码注册登录、手机号 OTP、Google 与 Apple 第三方登录（需在 Supabase 配置提供商）。
- 支持忘记密码邮件和登录后的密码更新。
- 同一 Supabase Auth 用户在不同设备登录后访问同一账户数据；云 ID 只是账户标识，不是密码或 Apple ID。
- 邮箱/手机号验证、SMTP、OAuth 回调和密码策略需在 Supabase Authentication 中配置。

数据库迁移：`supabase/migrations/202611220002_efficiency_cloud_id.sql`。

## 云端回忆与好友聊天

- 回忆：每个账户独立保存标题、内容和日期，支持关键词搜索与删除。
- 好友：使用用户名发送申请，接收方接受后才建立好友关系。
- 聊天：好友之间支持纯文字消息，最近 100 条按时间展示并每 10 秒刷新。
- 数据访问由 Supabase RLS 限制；个人回忆不会公开给好友。
- 当前不包含端到端加密、举报/屏蔽、自动审核或文件传输；上线前应补齐安全运营流程。

部署新增迁移：`supabase/migrations/202611220001_memory_friends_chat.sql`。

## 开发

```bash
npm install
npm run dev
npm run build
```

## 部署

请先阅读 `DEPLOY-NOW.md`、`docs/PAYMENT-METHODS.md` 和 `docs/RELEASE-CHECKLIST.md`。数据库迁移、四个 Edge Functions 和服务端 Secrets 的配置顺序均列在部署文档中。

支付商户账户、KYC、合同及结算账户须由具备资格的家长/监护人或合法运营主体负责办理，不得借用身份或绕过平台审核。


## 安全加固 3.3.1

- 好友申请改为服务端受控 RPC；接收方不能通过直接更新记录修改申请双方身份。
- 好友申请增加 24 小时频率限制；聊天增加每分钟发送频率限制和空白消息校验。
- 支付创建函数移除通配符 CORS，改为只允许 `APP_URL` 与 `ADDITIONAL_ALLOWED_ORIGINS` 中配置的来源。
- 增加 CSP 等响应安全头。
- Service Worker 仅缓存静态应用资源，不缓存带查询参数或授权头的请求。

执行新增迁移：`supabase/migrations/202611220003_security_hardening.sql`。生产部署前请先在 staging 验证迁移与双账号权限测试。


## 账户恢复与邮箱安全提醒（3.3.2）
1. 应用数据库迁移 `202611220004_account_recovery_email_alerts.sql`。
2. 配置 Supabase Auth SMTP、Site URL 和密码恢复 Redirect URLs。
3. 配置 Resend 的 `RESEND_API_KEY` 与 `SECURITY_ALERT_FROM_EMAIL`（仅服务端）。
4. 执行 `supabase functions deploy security-email-alert`。
5. 在真实邮箱和两个独立测试账户上验收恢复及提醒流程。

密码重置邮件由 Supabase Auth 负责；新登录和密码变更安全提醒由 Edge Function 经 Resend 发送。未配置邮件服务前，不应宣称提醒已启用。


## 原创品牌与法律声明（3.3.3）
- 原创 SVG 品牌图标：`icon.svg`，用于网页及 PWA。
- 法律页面：`legal/company.html`、`legal/ip.html`、`legal/acceptable-use.html`。
- `legal/notices.html` 汇总公司登记、原创权利与第三方权利说明。
- 公司登记信息按用户提供的 New Mexico Certificate of Organization 和 Articles of Organization 摘录；创作归属是 Yize Chen 的本人声明，不代表律师意见或权利登记证明。
- 正式发布前需完成商标近似检索、开源许可证/字体/素材清单核验，并补充真实支持邮箱、隐私联系渠道及知识产权投诉渠道。


## 3.4.0
支付自动确认与支付记录、退款扣回、账户删除/导出/退出所有设备、完整法律页面，以及 Android APK 构建：见 `docs/ANDROID-APK.md`。
