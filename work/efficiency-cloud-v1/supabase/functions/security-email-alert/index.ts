import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeadersFor, isAllowedOrigin } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST' || !isAllowedOrigin(req)) return json({ error: 'Not allowed' }, 403);

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const resendKey = Deno.env.get('RESEND_API_KEY') || '';
  const fromEmail = Deno.env.get('SECURITY_ALERT_FROM_EMAIL') || '';
  if (!token || !supabaseUrl || !anonKey || !serviceKey || !resendKey || !fromEmail) return json({ error: 'Security email service is not configured' }, 503);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user || !userData.user.email || !userData.user.email_confirmed_at) return json({ error: 'Verified email and valid session required' }, 401);

  let body: { event?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const event = body.event;
  if (event !== 'new_sign_in' && event !== 'password_changed') return json({ error: 'Unsupported event' }, 400);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await admin.from('profiles').select('security_email_alerts').eq('id', userData.user.id).maybeSingle();
  if (profileError) return json({ error: 'Unable to read notification settings' }, 500);
  if (profile?.security_email_alerts === false) return json({ sent: false, reason: 'disabled' });

  const { data: claimed, error: claimError } = await admin.rpc('claim_security_email_alert', { p_user_id: userData.user.id, p_event: event });
  if (claimError) return json({ error: 'Unable to apply notification rate limit' }, 500);
  if (!claimed) return json({ sent: false, reason: 'rate_limited' });

  const isPassword = event === 'password_changed';
  const subject = isPassword ? '效率云账户密码已更新' : '检测到效率云账户新登录';
  const description = isPassword
    ? '你的效率云账户密码刚刚发生变更。如果这不是你本人操作，请立即使用账户恢复流程重置密码，并检查账户会话。'
    : '你的效率云账户刚刚完成一次新登录。如果这不是你本人操作，请立即修改密码并检查账户安全设置。';
  const now = new Date().toISOString();
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#172033"><h2>${subject}</h2><p>${description}</p><p>事件时间（UTC）：${now}</p><p>为保护账户安全，本邮件不包含密码、验证码或登录令牌。</p><p>如果你认为账户存在风险，请通过效率云官方网站打开账户中心。</p></div>`;
  const mail = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromEmail, to: [userData.user.email], subject, html }),
  });
  if (!mail.ok) {
    const details = await mail.text();
    console.error('Resend delivery failed', mail.status, details.slice(0, 500));
    return json({ error: 'Email delivery failed' }, 502);
  }
  return json({ sent: true });
});
