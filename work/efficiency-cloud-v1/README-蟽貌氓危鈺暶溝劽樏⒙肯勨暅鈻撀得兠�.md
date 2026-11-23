# 效率云 3.1.1 · 发布候选版

本仓库为可构建的 Web/PWA 与 Capacitor 原生工程。它不是已上线服务、已签名安装包或商店审核通过版本。

## 快速开始

需要 Node.js 20+ 与 npm。复制 `.env.example` 为 `.env.local`，填写 Supabase 项目 URL 与 Publishable/anon key：

```bash
npm install
npm run dev
npm run build
```

## 当前支付设计

客户端仅提供支付宝与微信支付，不再包含银行卡、PayPal 或 Stripe Checkout。中国大陆网页版预留支付宝与微信支付，服务端入口为 `create-cn-payment`，异步回调为 `cn-payment-notify`。必须由项目方签约支付商户、部署网关适配器并配置 Edge Function Secrets 后才能真实收款。适配器协议、回调签名和上线验收见 `docs/PAYMENT-METHODS.md`。

原生 APP 数字权益需要接入 Apple / Google 对应官方内购并完成凭证校验、恢复购买和退款/撤销同步。当前没有声称已完成内购。

## 发布流程

请依次阅读：

1. `DEPLOY-NOW.md`
2. `docs/PAYMENT-METHODS.md`
3. `docs/RELEASE-CHECKLIST.md`

商户账号、Supabase 项目、域名、备案/经营资质、签名证书和应用商店开发者账号必须由具备资格的项目主体提供。未成年人不得自行签署支付服务协议或提交金融身份资料，应由家长/监护人或企业负责人办理。

## 原创与第三方依赖

本项目的产品名称展示、页面布局、业务文案与项目图标由项目工程提供；构建仍依赖 Capacitor、Supabase SDK、Vite 等第三方软件，必须遵循其各自许可证。正式发布前仍需逐项核验字体、图标、图片、品牌名称和素材授权，不应在未核验前作出“全部资源绝无第三方权利限制”的保证。
