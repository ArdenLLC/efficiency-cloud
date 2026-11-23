# 在 iPhone（SE3）上使用效率云

iPhone 不能安装 APK。最简单的方式是把应用发布成网页，用 Safari“添加到主屏幕”，它会全屏运行、有自己的图标，用法和普通 App 一样。无需 Mac，无需 Apple 开发者账号。

## 一、发布网页（免费，约 15 分钟）
1. 把项目上传到 GitHub 仓库。
2. 注册 Cloudflare，进入 Workers & Pages → Create → Pages → Connect to Git，选这个仓库。
3. 构建设置：Build command 填 `npm run build`，Output directory 填 `dist`。
4. Environment variables 填：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`，Node 版本变量 `NODE_VERSION=22`。
5. 部署完成会得到网址，例如 `https://xxx.pages.dev`。回到第 4 步再加一个变量 `VITE_APP_URL` = 这个网址，然后重新部署一次。
6. Supabase → Authentication → URL Configuration：Site URL 填这个网址；Redirect URLs 加入 `这个网址` 和 `这个网址/?recovery=1`。
7. Supabase 里执行 `supabase/migrations` 的所有迁移。

## 二、装到 iPhone
1. 用 **Safari**（不要用微信或其他浏览器）打开你的网址。
2. 点底部“分享”按钮 → “添加到主屏幕” → 添加。
3. 以后从主屏幕图标打开。

## 注意
- 添加到主屏幕后，登录状态和 Safari 是分开的，需要在图标打开的 App 里重新登录一次。
- 验证邮件、重置密码的链接会在 Safari 里打开，设置完新密码后回到主屏幕 App 登录即可。
- 在中国大陆，`pages.dev` 偶尔访问较慢；如果打不开，可换 Netlify 或 Vercel，设置方法相同。
- iOS 不支持 Google / Apple 第三方登录以外的问题：网页版两者都可用，但需要在 Supabase 配置好提供商，否则请使用邮箱或手机号。
- 真正的 iOS 原生 App（App Store）需要 Mac、Xcode 和每年 99 美元的 Apple 开发者账号，且要年满 18 岁，现在不建议。
