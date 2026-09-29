-- ============================================================
-- Order Desk — Online (Delivery/Pickup) Ordering (0009)
-- Optional per-restaurant — dine-in QR ordering keeps working
-- exactly as before for restaurants that don't enable this.
-- ============================================================

-- ---------- Per-restaurant toggle + config ----------
alter table restaurants add column if not exists online_ordering_enabled boolean not null default false;
alter table restaurants add column if not exists slug text unique;

create table if not exists delivery_settings (
  restaurant_id uuid primary key references restaurants(id) on delete cascade,
  pickup_enabled boolean not null default true,
  delivery_enabled boolean not null default false,
  delivery_radius_km numeric(4,1) default 5,
  delivery_fee numeric(10,2) not null default 0,
  minimum_order_amount numeric(10,2) not null default 0,
  estimated_prep_minutes int not null default 25,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table delivery_settings enable row level security;

-- Drop previous policies if they exist to avoid duplicate errors
drop policy if exists "admin/owner can manage delivery settings" on delivery_settings;
create policy "admin/owner can manage delivery settings"
  on delivery_settings for all using (
    restaurant_id = current_restaurant_id()
    and current_staff_role() in ('admin','owner')
  );

drop policy if exists "staff can view delivery settings" on delivery_settings;
create policy "staff can view delivery settings"
  on delivery_settings for select using (restaurant_id = current_restaurant_id());

drop policy if exists "public can view delivery settings" on delivery_settings;
create policy "public can view delivery settings"
  on delivery_settings for select using (true);

-- ---------- orders: table_id becomes optional, order_type added ----------
alter table orders alter column table_id drop not null;
alter table orders add column if not exists order_type text not null default 'dine_in'
  check (order_type in ('dine_in','delivery','pickup'));
alter table orders add column if not exists customer_name text;
alter table orders add column if not exists customer_phone text;
alter table orders add column if not exists delivery_address text;
alter table orders add column if not exists scheduled_for timestamptz;

-- A dine-in order MUST have a table; an online order MUST NOT reuse a table.
create or replace function check_order_type_table_consistency()
returns trigger language plpgsql as $$
begin
  if new.order_type = 'dine_in' and new.table_id is null then
    raise exception 'dine_in orders must have a table_id';
  end if;
  if new.order_type in ('delivery','pickup') and new.table_id is not null then
    raise exception 'online orders (delivery/pickup) must not have a table_id';
  end if;
  if new.order_type in ('delivery','pickup') and (new.customer_name is null or new.customer_phone is null) then
    raise exception 'online orders require customer_name and customer_phone';
  end if;
  if new.order_type = 'delivery' and new.delivery_address is null then
    raise exception 'delivery orders require a delivery_address';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_order_type_table on orders;
create trigger trg_check_order_type_table
  before insert or update of order_type, table_id on orders
  for each row execute function check_order_type_table_consistency();
