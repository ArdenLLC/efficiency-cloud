# Security email alert function

Deploy with `supabase functions deploy security-email-alert`.

Required server-side secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `SECURITY_ALERT_FROM_EMAIL` (a verified sender on your Resend domain)
- `APP_URL` and optional `ADDITIONAL_ALLOWED_ORIGINS`

The function accepts only a valid Supabase user access token and two fixed event types. It fetches the recipient email from the verified Auth user, checks the user's notification preference, and claims a per-user/per-event hourly quota through a service-role-only SQL function. Never expose service-role or Resend secrets to the browser.
