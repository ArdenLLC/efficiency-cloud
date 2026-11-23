# 效率云部署说明（含云端支付）

本版本已恢复网页端云端支付入口：支付宝、微信支付、境外银行卡和 PayPal。代码包含订单表、服务端创建订单入口及支付回调处理；**这不代表真实商户已开通，也不代表当前已能收款**。真实网关适配器、商户审核及密钥必须由符合平台资格的成年人监护人或合法运营主体负责。

## 1. 本地构建

```bash
npm install
cp .env.example .env.local
npm run build
```

`.env.local` 仅放前端 Supabase URL 和 anon/publishable key：
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

不要把任何支付 Token、Webhook Secret 或 Supabase service-role key 放入前端环境变量。

## 2. Supabase 数据库迁移

先备份数据库，并在 staging 环境验证。基础表结构应用后，按版本顺序执行尚未执行过的迁移：

1. `supabase/schema.sql`
2. `supabase/migrations/202611180001_wallet_payments.sql`
3. `supabase/migrations/202611190001_mainland_payments.sql`
4. `supabase/migrations/202611200001_remove_international_web_payments.sql`
5. `supabase/migrations/202611200002_add_international_payments.sql`
6. `supabase/migrations/202611220001_memory_friends_chat.sql`（若尚未执行）
7. `supabase/migrations/202611220002_efficiency_cloud_id.sql`（若尚未执行）
8. `supabase/migrations/202611220003_security_hardening.sql`

如果某条历史迁移已经在该数据库执行过，不要重复手动改写历史记录；以 Supabase migration history 为准，只补执行缺失的迁移。

## 3. 部署支付 Edge Functions

部署以下四个函数：

```bash
supabase functions deploy create-cn-payment
supabase functions deploy cn-payment-notify
supabase functions deploy create-intl-payment
supabase functions deploy intl-payment-notify
```

在 Supabase Edge Function Secrets 中配置（只配置实际已获批并完成联调的渠道）：

**公共服务端配置**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_URL`（生产站点的规范 HTTPS Origin）
- `ADDITIONAL_ALLOWED_ORIGINS`（可选，逗号分隔的额外 HTTPS 来源；仅加入你控制的域名）

**中国大陆支付**
- `CN_PAYMENT_GATEWAY_URL`
- `CN_PAYMENT_GATEWAY_TOKEN`
- `CN_PAYMENT_WEBHOOK_SECRET`
- `CN_PRO_PRICE_FEN`

**境外银行卡 / PayPal**
- `INTL_PAYMENT_GATEWAY_URL`
- `INTL_PAYMENT_GATEWAY_TOKEN`
- `INTL_PAYMENT_WEBHOOK_SECRET`
- `INTL_PRO_PRICE_MINOR`
- `INTL_PRO_CURRENCY`（三位 ISO 4217 币种代码，例如 USD）

境外结算目的地由支付服务商对商户主体、地区、业务类型及受益人审核决定。`merchant_default` 只使用服务商已批准的默认结算配置，不保证结算到个人支付宝或微信。

## 4. 网关适配器契约

本仓库使用统一适配器约定：
- 创建订单：`POST {GATEWAY_URL}/v1/orders`
- 成功响应：返回 HTTPS `payment_url`
- 异步通知：向对应 Supabase Function 发送标准化事件
- 请求头：`X-Payment-Signature: <unix_timestamp>.<hex_hmac_sha256>`
- HMAC 输入：`<timestamp>.<原始请求体>`，使用对应 Webhook Secret 和 SHA-256

通知至少应包含订单号、支付方式、金额、币种（境外）、状态和服务商交易号。必须根据服务商官方文档实现请求字段映射、签名验签、退款/撤销/拒付同步与沙箱测试；不能只把按钮显示出来就视为支付接通。

## 5. 客户端行为

网页端显示支付宝、微信、境外银行卡及 PayPal 选项。仅在服务端配置完整且网关创建订单成功后才跳转支付页。只有验签通过且订单号、支付方式、金额/币种匹配的回调才能授予 30 天 Pro 权益。

iOS / Android 原生应用的数字会员必须走适用应用商店的官方内购。当前 StoreKit / Google Play Billing 尚未接入，入口保持禁用；不得用网页支付替代原生内购。

## 6. 上线验收

在沙箱和生产切换前，测试成功、失败、重复通知、过期签名、伪造签名、金额/币种不匹配、重复交易号、退款、撤销及拒付。正式开放前须明确展示价格、币种、权益期限、续订方式、取消和退款规则。

支付商户/KYC、合同、结算账户和商店开发者账号必须由具备资格的家长/监护人或合法运营主体在知情授权下办理；不得借用身份、虚报年龄或绕过 KYC。未完成商户审核或网关联调的支付渠道必须保持不可收款状态。


## 云端回忆与好友聊天（2026-11-22）

部署新增迁移：`supabase/migrations/202611220001_memory_friends_chat.sql`。在部署前备份数据库，然后执行 `supabase db push`（或在 Supabase SQL Editor 中按迁移文件完整执行）。该迁移新增私有 memories、friendships、messages 表及 RLS 策略，并添加用户名好友申请与好友列表 RPC。

效率云 ID 还需执行 `supabase/migrations/202611220002_efficiency_cloud_id.sql`，为现有及新账户生成唯一 EC- 前缀标识。完成后检查 Authentication 的邮箱验证、SMTP、密码重置回调和 OAuth Provider 配置。

用户登录后可保存/搜索/删除自己的云端回忆；好友只能通过用户名发起申请，收件人接受后才可互发文字消息。请在上线前配置 Supabase Auth 邮件/短信验证、备份与滥用处理流程，并测试两个独立测试账号之间的申请、接受、拒绝、聊天和越权访问。聊天目前不含端到端加密、图片/文件、屏蔽/举报或自动内容审核，不应宣传为具备这些能力；不要存放密码、证件号、住址等敏感信息。


## 7. 安全加固 3.3.1

新增迁移：`supabase/migrations/202611220003_security_hardening.sql`。该迁移收紧 profiles 与 friendships 写权限，使用 `respond_friend_request` RPC 处理好友申请，并为好友申请和消息增加基础频率限制。部署后应检查 Supabase Auth 的邮箱验证、密码策略、MFA、OAuth 回调 allow-list 与 SMTP 设置。

支付 Edge Functions 的 CORS 现在只允许 `APP_URL` 和 `ADDITIONAL_ALLOWED_ORIGINS` 中的 Origin。配置不正确会导致浏览器调用被拒绝；不要使用 `*`，也不要把不受控制的域名加入白名单。

上线前必须在 staging 使用至少两个独立测试账户验证：用户 A 不能读写用户 B 的 tasks/memories/profile；普通客户端不能更改 Pro 权益或 cloud_id；非好友不能读写消息；接收者只能回应发给自己的待处理好友申请；超出频率限制的请求应被拒绝。当前归档未包含 `package-lock.json`：先在受控开发环境运行 `npm install` 生成并审查、提交 lockfile，之后 CI 才运行 `npm ci`、`npm audit`、`npm run build`，并对 Supabase RLS 与 Edge Functions 做人工安全审查。
