-- Efficiency Cloud 3.1.2: remove international web checkout pathways.
-- Keep historical billing rows for audit; new web orders use cn_payment_orders.
drop function if exists public.grant_wallet_pro_entitlement(text, uuid, text, integer);

alter table public.profiles drop column if exists stripe_customer_id;
alter table public.profiles drop column if exists stripe_subscription_id;
