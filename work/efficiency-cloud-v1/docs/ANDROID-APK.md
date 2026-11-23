# 生成 Android APK（效率云 3.4.0）

## 前置
Node 20+、JDK 21、Android SDK（或直接用 GitHub Actions，无需本地安装）。

## 一、配置
1. 复制 `.env.example` 为 `.env.local`，填写 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_APP_URL`（已部署的网页地址，**APK 必填**）。
2. 若启用邮箱安全提醒函数，其 `ADDITIONAL_ALLOWED_ORIGINS` 须包含 `https://localhost`（Android WebView 的来源）。
3. 依次执行 `supabase/migrations` 中的所有迁移（最新两个：`202611230001`、`202611240001`，后者包含屏蔽/举报）。
4. 在 Supabase Auth → URL Configuration 的 Redirect URLs 加入 `VITE_APP_URL` 及 `VITE_APP_URL/?recovery=1`。

## 二、本地构建
```bash
bash scripts/build-apk.sh debug      # 可直接安装的调试签名 APK
bash scripts/build-apk.sh release    # 需先设置 ANDROID_KEYSTORE_PATH / _PASSWORD / ANDROID_KEY_ALIAS / ANDROID_KEY_PASSWORD
```
Windows：`powershell -File scripts/build-apk.ps1 debug`。产物：`android/app/build/outputs/apk/`。

生成签名密钥（只做一次，务必备份，丢失后无法更新同一应用）：
```bash
keytool -genkeypair -v -keystore efficiency-cloud.jks -alias efficiencycloud -keyalg RSA -keysize 2048 -validity 10000
```

## 三、GitHub Actions 构建
仓库 Settings → Secrets：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`；Variables：`VITE_APP_URL`（及可选 `VITE_NATIVE_WEB_PAYMENTS`）。若要签名发布包，再加 `ANDROID_KEYSTORE_BASE64`（`base64 -w0 efficiency-cloud.jks`）、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD`。在 Actions 页运行 “Android APK”，从 Artifacts 下载。

## 四、发布前
- `RELEASE=1 npm run check:release` 须通过（所有法律页“待填写”已补全）。
- 提交 Google Play 时，“账户删除”网址填 `VITE_APP_URL/legal/account-deletion.html`，隐私政策填 `…/legal/privacy.html`。
- Android 端不提供 Google/Apple 第三方登录（需要深度链接，未实现），请使用邮箱或手机号。


## 处理举报
用户举报保存在 Supabase 的 `user_reports` 表（含最近 20 条聊天记录），请定期在 Dashboard → Table Editor 查看，并把处理结果更新到 `status` 列。
