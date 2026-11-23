# 把效率云装成 iPhone 原生 App（免费方案，无需 Mac）

原理：GitHub 的云端 Mac 编译出**未签名**的 `.ipa`，再用 Sideloadly 在你的电脑上用**你自己的免费 Apple ID** 签名并装进 iPhone。

## 限制（请先了解）
- 免费 Apple ID 签名的 App **每 7 天失效一次**，需要把手机连电脑重新签名；同时最多 3 个这样的 App。
- 需要一台 **Windows 或 Mac 电脑**，不能只用手机完成。
- 这是自己使用/分享给少数朋友的办法，**不能上架 App Store**（上架需要 Mac、99 美元/年的开发者账号并年满 18 岁）。
- 不要把 Apple ID 密码发给任何人；建议用一个专门注册的 Apple ID，开启双重认证。

## 步骤
1. 仓库 Settings → Secrets 填 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`；Variables 填 `VITE_APP_URL`（你的网页地址）。
2. Actions → “iOS IPA (unsigned)” → Run workflow，等待约 10–15 分钟，下载 Artifact `efficiency-cloud-ipa`，解压得到 `EfficiencyCloud.ipa`。
3. 电脑安装 Sideloadly（sideloadly.io，Windows 需同时安装官网版 iTunes 和 iCloud）。
4. iPhone 用数据线连电脑，点“信任此电脑”。
5. 把 `.ipa` 拖进 Sideloadly，填 Apple ID，点 Start。
6. iPhone：设置 → 隐私与安全性 → 开发者模式 → 打开并重启。
7. 设置 → 通用 → VPN 与设备管理 → 点你的 Apple ID → 信任。
8. 从主屏幕打开“效率云”。

## 在 iOS 原生 App 里
- 不提供 Google / Apple 第三方登录，请用邮箱或手机号。
- 导出数据会复制到剪贴板。
- 验证邮件、重置密码链接会在 Safari 中打开，完成后回到 App 登录。
