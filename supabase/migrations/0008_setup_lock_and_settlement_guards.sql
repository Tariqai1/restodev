-- Prevent concurrent first-admin provisioning.
create table if not exists platform_setup_lock (
  id boolean primary key default true check (id),
  claimed_at timestamptz not null default now()
);

alter table platform_setup_lock enable row level security;

create policy "service role manages setup lock"
  on platform_setup_lock for all
  to service_role
  using (true)
  with check (true);

-- Payment ledger rows must be unique for a bill and payment attempt.
create unique index if not exists idx_payment_transactions_bill_reference
  on payment_transactions (bill_id, reference_number)
  where reference_number is not null;

create table if not exists vouchers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  issued_table_id uuid references restaurant_tables(id) on delete set null,
  code text not null,
  reward_title text not null,
  reward_subtitle text not null,
  discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  min_order_value numeric(10,2) not null default 0 check (min_order_value >= 0),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'issued' check (status in ('issued', 'redeemed', 'expired')),
  redeemed_at timestamptz,
  redeemed_by uuid references staff_users(id),
  redeemed_order_id uuid references orders(id) on delete set null,
  unique (restaurant_id, code)
);

create unique index if not exists idx_one_issued_voucher_per_table
  on vouchers (restaurant_id, issued_table_id)
  where status = 'issued' and issued_table_id is not null;

alter table vouchers enable row level security;
create policy "service role manages vouchers"
  on vouchers for all to service_role using (true) with check (true);

alter table orders add column if not exists voucher_id uuid references vouchers(id);
alter table orders add column if not exists discount_amount numeric(10,2) not null default 0;
alter table bills add column if not exists voucher_id uuid references vouchers(id);
alter table bills add column if not exists discount_amount numeric(10,2) not null default 0;

create or replace function redeem_voucher_atomic(
  p_code text,
  p_order_id uuid,
  p_restaurant_id uuid,
  p_staff_id uuid
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_voucher vouchers%rowtype;
  v_order orders%rowtype;
  v_subtotal numeric(10,2);
  v_discount numeric(10,2);
begin
  select * into v_order from orders where id = p_order_id and restaurant_id = p_restaurant_id and status = 'open' for update;
  if v_order.id is null then raise exception 'Open order not found'; end if;

  select * into v_voucher from vouchers where restaurant_id = p_restaurant_id and code = upper(trim(p_code)) for update;
  if v_voucher.id is null then raise exception 'Voucher not found'; end if;
  if v_voucher.status <> 'issued' then raise exception 'Voucher has already been redeemed'; end if;
  if v_voucher.expires_at <= now() then
    update vouchers set status = 'expired' where id = v_voucher.id;
    raise exception 'Voucher has expired';
  end if;

  select coalesce(sum(qty * unit_price), 0)::numeric(10,2) into v_subtotal from order_items where order_id = p_order_id;
  if v_subtotal < v_voucher.min_order_value then raise exception 'Minimum order value is ₹% ', v_voucher.min_order_value; end if;
  v_discount := least(v_voucher.discount_amount, v_subtotal);

  update vouchers set status = 'redeemed', redeemed_at = now(), redeemed_by = p_staff_id, redeemed_order_id = p_order_id where id = v_voucher.id;
  update orders set voucher_id = v_voucher.id, discount_amount = v_discount where id = p_order_id;

  return jsonb_build_object('voucher_id', v_voucher.id, 'discount_amount', v_discount, 'subtotal', v_subtotal);
end;
$$;

revoke all on function redeem_voucher_atomic(text, uuid, uuid, uuid) from public;
grant execute on function redeem_voucher_atomic(text, uuid, uuid, uuid) to service_role;

create or replace function settle_order_atomic(
  p_order_id uuid,
  p_payment_mode text,
  p_recorded_by uuid,
  p_extra_table_numbers text[] default '{}'
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_bill bills%rowtype;
  v_subtotal numeric(10,2);
  v_discount numeric(10,2);
  v_tax numeric(10,2);
  v_total numeric(10,2);
  v_mode text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));
  select * into v_order from orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Order not found'; end if;

  select coalesce(sum(qty * unit_price), 0)::numeric(10,2) into v_subtotal
  from order_items where order_id = p_order_id;
  v_discount := least(greatest(coalesce(v_order.discount_amount, 0), 0), v_subtotal);
  v_tax := round((v_subtotal - v_discount) * 0.05, 2);
  v_total := round(v_subtotal - v_discount + v_tax, 2);
  v_mode := case when p_payment_mode in ('cash', 'upi', 'card') then p_payment_mode else 'cash' end;

  insert into bills (order_id, voucher_id, subtotal, discount_amount, tax_amount, cgst_amount, sgst_amount, total, payment_mode, payment_status, paid_at)
  values (p_order_id, v_order.voucher_id, v_subtotal, v_discount, v_tax, round(v_tax / 2, 2), round(v_tax / 2, 2), v_total, v_mode, 'unpaid', null)
  on conflict (order_id) do nothing;
  select * into v_bill from bills where order_id = p_order_id for update;

  insert into payment_transactions (bill_id, amount, mode, type, reference_number, recorded_by)
  select v_bill.id, v_total, v_mode, 'payment', 'settle:' || p_order_id::text, p_recorded_by
  where not exists (select 1 from payment_transactions where bill_id = v_bill.id and reference_number = 'settle:' || p_order_id::text);

  if v_order.status = 'open' then
    update orders set status = 'closed', closed_at = now() where id = p_order_id;
  end if;
  update restaurant_tables set status = 'payment_pending' where id = v_order.table_id and status <> 'empty';
  update restaurant_tables set status = 'empty' where id = v_order.table_id and status = 'payment_pending';
  if coalesce(array_length(p_extra_table_numbers, 1), 0) > 0 then
    update restaurant_tables set status = 'payment_pending' where restaurant_id = v_order.restaurant_id and table_number = any(p_extra_table_numbers) and status <> 'empty';
    update restaurant_tables set status = 'empty' where restaurant_id = v_order.restaurant_id and table_number = any(p_extra_table_numbers) and status = 'payment_pending';
  end if;

  return jsonb_build_object('bill_id', v_bill.id, 'order_id', p_order_id, 'subtotal', v_subtotal, 'discount_amount', v_discount, 'tax_amount', v_tax, 'total', v_total, 'payment_mode', v_mode, 'payment_status', 'paid');
end;
$$;

revoke all on function settle_order_atomic(uuid, text, uuid, text[]) from public;
grant execute on function settle_order_atomic(uuid, text, uuid, text[]) to service_role;