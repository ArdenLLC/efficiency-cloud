# Release Notes - 3.1.3 RC

- Restored international web checkout choices for eligible international cards and PayPal.
- Kept mainland Alipay and WeChat Pay checkout.
- Added separate international order creation and signed webhook processing paths.
- Added server-side price/currency configuration and explicit provider-default settlement profile.
- Clarified that actual payment acceptance and payout destination require a selected, approved provider and merchant onboarding.
- Apple StoreKit and Google Play Billing remain unintegrated and disabled.
- This is source-code integration scaffolding, not a production-ready live payment activation.


## 3.2.0 云端回忆与好友聊天
- 新增私有云端回忆记录、日期归档、关键词搜索与删除。
- 新增用户名、好友申请/接受/拒绝和好友列表。
- 新增好友确认后的纯文字一对一聊天。
- 新增数据库迁移、RLS 策略和部署/验收说明。
- 聊天暂不支持端到端加密、屏蔽举报及自动审核，尚需上线前安全验收。


## 3.3.0 独立效率云 ID
- 新增稳定且唯一的 EC- 前缀账户标识。
- 登录页明确以效率云 ID 作为独立账户入口，保留邮箱/密码、手机号 OTP、Google 与 Apple 可选登录。
- 新增忘记密码邮件、账户中心 ID 展示/复制及登录后更新密码。
- 新增 cloud_id 数据库迁移；实际注册、邮件投递及 OAuth 仍依赖 Supabase 项目配置。

## 3.3.1 安全加固
- 收紧个人资料与好友关系的客户端写权限。
- 好友申请改用受控 RPC，并增加频率限制。
- 聊天消息增加发送者校验、空白消息校验和发送频率限制。
- 支付创建 Edge Functions 改用受限 CORS Origin 白名单。
- 增加 CSP / COOP / CORP 安全响应头。
- Service Worker 仅缓存静态资源，不缓存任意同源请求。
- 新增 `supabase/migrations/202611220003_security_hardening.sql` 和静态复核说明。


## 3.3.2 — 账户恢复与邮箱提醒
- 完善密码恢复回调流程，支持通过邮件一次性链接返回账户并设置新密码。
- 增加新登录、密码变更邮箱安全提醒及用户可控开关。
- 新增服务端邮件发送 Edge Function、服务端限频和通知事件审计表。
- 邮件发送依赖 Supabase SMTP 与 Resend 服务端配置；未配置前不保证送达。


## 3.3.3 — 原创品牌与法律声明
- 设计全新效率云原创 SVG 图标，并应用于网页品牌标识及 PWA 图标。
- 优化页脚法律信息区域，增加公司登记、原创作品、禁止侵权与违法用途禁止声明入口。
- 新增公司与运营主体声明、原创作品与禁止侵权声明、违法行为禁止声明页面。
- 根据用户提供的 New Mexico 公司文件列明 Arden LLC 登记信息；Yize Chen 的独立创作内容以创作者声明形式呈现。
- 明确区分原创作品与第三方开源软件、SDK、字体、商标及云服务资产。


## 3.4.0 — 支付、账户、法律完善与 Android APK
- 支付：支付完成后自动确认订单（轮询 + 回到应用时刷新）；账户中心新增支付记录；退款回调自动扣回对应权益；每用户每小时最多 5 个未支付订单；订单在账户删除后去除个人关联保留。
- 账户：注册确认密码与密码强度（字母+数字，≥8 位）、邮箱格式校验、短信/重置邮件 60 秒冷却、友好错误提示、记录同意条款版本、退出所有设备、导出数据、应用内删除账户（`delete_my_account`）。
- 法律：重写服务条款与隐私政策；新增《支付、订阅与退款说明》《账户删除与数据权利》；待补信息用“【待填写】”标记，并由 `npm run check:release` 在 `RELEASE=1` 时强制拦截。
- Android：`capacitor.config.json`（替换需要 TypeScript 的 .ts 配置）、图标自动生成、版本号同步、关闭 allowBackup、`scripts/build-apk.*` 与 GitHub Actions 工作流。
- 新增迁移：`supabase/migrations/202611230001_account_payment_hardening.sql`。


## 3.5.0 — 免费版 + 聊天安全
- 移除全部付费/支付功能（界面、Edge Functions、支付法律页）；取消免费版任务数量上限。
- 好友聊天保持开启，新增屏蔽与举报（举报附最近 20 条聊天记录）；被屏蔽的双方不能再发好友申请或消息。
- 新增迁移 `202611240001_chat_safety_free_plan.sql`。


## 3.6.0 — 云端同步与回顾
- 新增“回顾：我做过什么”：按今天/7天/30天/自选日期查看已完成任务和回忆，并显示“往年的今天”。
- 任务记录完成时间；回忆支持编辑。
- 多设备实时同步（Supabase Realtime），并在回到前台、恢复网络、每 2 分钟自动刷新。
- 新增迁移 `202611250001_timeline_sync.sql`。

## 3.6.1 — iPhone / PWA
- 静态文件（法律页、Service Worker、manifest、图标）移入 `public/`，修复它们未被打包进网页的问题。
- 构建前自动生成 iPhone 主屏幕图标（apple-touch-icon）与 PWA PNG 图标。
- 增加 iOS 全屏、安全区适配，输入框 16px 防止 Safari 自动放大。
- 新增 `docs/IPHONE.md`。


## 3.7.0 — iOS 原生 App 构建
- 新增 GitHub Actions 工作流 `ios-ipa.yml`：在云端 Mac 上生成未签名 `.ipa`。
- 新增 iOS 图标生成脚本与 `docs/IPHONE-APP.md`（Sideloadly 免费签名安装说明）。
