-- 3.4.0: account deletion, payment history, refund handling, payment-order rate limit.
-- Run after 202611220004. Back up the project before applying.

-- 1) Keep financial records (without personal link) when an account is deleted.
do $$
declare t text;
begin
  foreach t in array array['cn_payment_orders','intl_payment_orders','billing_payments'] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I alter column user_id drop not null', t);
      execute format('alter table public.%I drop constraint if exists %I', t, t||'_user_id_fkey');
      execute format('alter table public.%I add constraint %I foreign key (user_id) references auth.users(id) on delete set null', t, t||'_user_id_fkey');
    end if;
  end loop;
end $$;

-- 2) In-app account deletion (required by Google Play / App Store for apps with sign-up).
create or replace function public.delete_my_account() returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  delete from auth.users where id = v_uid; -- cascades to profiles, tasks, memories, friends, messages
  return true;
end; $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 3) Payment history for the signed-in user (both channels).
create or replace function public.my_payment_orders()
returns table(order_no text, channel text, payment_method text, amount_minor integer, currency text, status text, created_at timestamptz, paid_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select o.order_no, 'cn', o.payment_method, o.amount_fen, 'CNY', o.status, o.created_at, o.paid_at
    from public.cn_payment_orders o where o.user_id = auth.uid()
  union all
  select i.order_no, 'intl', i.payment_method, i.amount_minor, i.currency, i.status, i.created_at, i.paid_at
    from public.intl_payment_orders i where i.user_id = auth.uid()
  order by created_at desc limit 50;
$$;
revoke all on function public.my_payment_orders() from public, anon;
grant execute on function public.my_payment_orders() to authenticated;

-- 4) Refund handling: mark refunded and take back the days that order granted.
create or replace function public.refund_wallet_order(p_channel text, p_order_no text, p_days integer default 30)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_status text;
begin
  if p_channel not in ('cn','intl') or p_days < 1 or p_days > 90 then raise exception 'Invalid parameters'; end if;
  if p_channel = 'cn' then
    select user_id, status into v_user, v_status from public.cn_payment_orders where order_no = p_order_no for update;
  else
    select user_id, status into v_user, v_status from public.intl_payment_orders where order_no = p_order_no for update;
  end if;
  if not found then raise exception 'Order not found'; end if;
  if v_status = 'refunded' then return false; end if;
  if v_status <> 'paid' then raise exception 'Only paid orders can be refunded'; end if;
  if p_channel = 'cn' then
    update public.cn_payment_orders set status = 'refunded' where order_no = p_order_no;
  else
    update public.intl_payment_orders set status = 'refunded' where order_no = p_order_no;
  end if;
  if v_user is not null then
    update public.profiles set
      current_period_end = greatest(now(), current_period_end - make_interval(days => p_days)),
      subscription_status = case when current_period_end - make_interval(days => p_days) <= now() then 'canceled' else subscription_status end,
      plan = case when current_period_end - make_interval(days => p_days) <= now() then 'free' else plan end,
      updated_at = now()
    where id = v_user;
  end if;
  return true;
end; $$;
revoke all on function public.refund_wallet_order(text,text,integer) from public, anon, authenticated;
grant execute on function public.refund_wallet_order(text,text,integer) to service_role;

-- 5) Rate limit: at most 5 unpaid orders per user per hour (called by the create-* functions).
create or replace function public.recent_pending_orders(p_user uuid) returns integer
language sql security definer set search_path = '' stable as $$
  select (select count(*) from public.cn_payment_orders where user_id = p_user and status = 'pending' and created_at > now() - interval '1 hour')
       + (select count(*) from public.intl_payment_orders where user_id = p_user and status = 'pending' and created_at > now() - interval '1 hour');
$$;
revoke all on function public.recent_pending_orders(uuid) from public, anon, authenticated;
grant execute on function public.recent_pending_orders(uuid) to service_role;
