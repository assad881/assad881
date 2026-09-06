-- ============================================================
-- كسّارة إكسبرس — مخطط قاعدة البيانات (PostgreSQL / Supabase)
-- المبادئ: معرّفات UUID، تواريخ إنشاء وتعديل، منشئ كل سجل،
-- حالة سجل (status_flag) بدل الحذف النهائي، وقيود مرجعية كاملة.
-- ============================================================
create extension if not exists "pgcrypto";

-- أعمدة مشتركة: id, created_at, updated_at, created_by, status_flag
create or replace function kx_touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create type kx_role            as enum ('customer','supplier','transporter','driver','ops','admin');
create type kx_account_status  as enum ('active','pending','suspended');
create type kx_customer_type   as enum ('individual','contractor','company');
create type kx_record_flag     as enum ('active','archived','deleted');
create type kx_order_status    as enum (
  'draft','under_review','awaiting_supplier','awaiting_carrier','ready_for_payment',
  'awaiting_transfer_verification','paid','preparing','loading','in_transit','arrived',
  'delivered','cancelled','disputed','refunded_partial','refunded_full');
create type kx_trip_status     as enum (
  'assigned','heading_plant','at_plant','loading','loaded','en_route','at_site','delivered','cancelled');
create type kx_payment_method  as enum ('card','bank_transfer','deposit','credit_terms');
create type kx_payment_status  as enum ('pending_verification','captured','rejected','voided');
create type kx_party_type      as enum ('supplier','transporter');
-- وحدة البيع: المتر المكعب هو الأساس في قائمة أسعار الكسارة
create type kx_unit            as enum ('m3','ton','truck');
create type kx_discount_type   as enum ('percent','fixed');

-- ---------- المستخدمون ----------
create table users (
  id            uuid primary key default gen_random_uuid(),
  auth_uid      uuid unique,                       -- الربط مع auth.users في Supabase
  name          text not null,
  phone         text not null unique check (phone ~ '^968[0-9]{8}$'),
  -- ar | en | ur | hi | bn — لغة واجهة المستخدم المحفوظة في حسابه
  email         text,
  role          kx_role not null default 'customer',
  account_status kx_account_status not null default 'active',
  lang          text not null default 'ar',
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  status_flag   kx_record_flag not null default 'active'
);

create table customer_profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete restrict,
  name            text not null,
  phone           text not null,
  customer_type   kx_customer_type not null default 'individual',
  company_name    text, cr_number text, vat_number text,
  lang            text not null default 'ar',
  -- اعتماد الإدارة لعرض الأسعار الخاصة لهذا العميل
  special_pricing_approved boolean not null default false,
  credit_approved boolean not null default false,
  credit_limit    numeric(12,3) not null default 0 check (credit_limit >= 0),
  credit_used     numeric(12,3) not null default 0 check (credit_used  >= 0),
  total_orders    integer not null default 0,
  total_spent     numeric(14,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active',
  constraint credit_within_limit check (credit_used <= credit_limit)
);

-- ---------- المواقع والمناطق ----------
create table delivery_zones (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, name text not null,
  wilayat text not null, governorate text not null,
  radius_km numeric(6,1), center jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customer_profiles(id) on delete restrict,
  zone_id uuid not null references delivery_zones(id),
  label text not null, address text not null,
  coords jsonb, contact_name text, contact_phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);
create index on locations (customer_id);

-- ---------- المواد ----------
create table material_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, name text not null, name_en text, icon text, sort integer default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);

create table materials (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references material_categories(id),
  sku  text not null unique,                  -- المعرّف الثابت؛ لا يُستخدم الاسم المترجم معرّفًا
  name text not null,                         -- الاسم العربي (اللغة الأساسية)
  name_i18n jsonb not null default '{}'::jsonb,   -- {ar,en,ur,hi,bn} من الجدول المعتمد
  size text,                                  -- المقاس منفصل عن الاسم لتقليل أخطاء الترجمة
  description text,
  unit kx_unit not null default 'm3', density numeric(5,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);

-- ---------- الموردون وأسعارهم ----------
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  code text not null unique, name text not null,
  cr_number text, phone text, address text,
  wilayat text, governorate text, location jsonb,
  name_en text,
  loading_capacity_per_day integer, unit kx_unit not null default 'm3',
  working_hours text,
  rating numeric(2,1) default 0,
  is_approved boolean not null default false, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);

create table supplier_prices (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete restrict,
  material_id uuid not null references materials(id) on delete restrict,
  customer_id uuid references customer_profiles(id),   -- NULL = ليس سعرًا تعاقديًا لعميل بعينه
  price_per_unit numeric(10,3) not null check (price_per_unit > 0),
  unit kx_unit not null default 'm3',
  currency char(3) not null default 'OMR',
  min_qty numeric(10,2) default 0,                     -- الحد الأدنى للتوصيل (شاحنة واحدة)
  max_qty numeric(10,2),
  available_per_day numeric(10,2) default 0,
  tiers jsonb not null default '[]'::jsonb,            -- [{min_qty, price_per_unit}]
  -- القائمة الرسمية: السعر من باب الكسارة، والنقل والضريبة بندان مستقلان
  includes_transport boolean not null default false,
  includes_vat       boolean not null default false,
  -- السعر الخاص لا يُعرض علنًا: يُستحق باعتماد العميل أو بكود مصرّح
  is_special boolean not null default false,
  unlock_code text,
  source text,
  valid_from timestamptz not null default now(),
  valid_to   timestamptz,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active',
  constraint valid_window check (valid_to is null or valid_to > valid_from),
  constraint qty_window   check (max_qty_tons is null or max_qty_tons >= min_qty_tons)
);
create index on supplier_prices (supplier_id, material_id, is_active);
-- سعر قائمة واحد ساري لكل (مورد، مادة) في وقت واحد
create unique index supplier_prices_one_active_list
  on supplier_prices (supplier_id, material_id)
  where customer_id is null and not is_special and is_active and valid_to is null;
-- سعر خاص عام واحد لكل (مورد، مادة)
create unique index supplier_prices_one_active_special
  on supplier_prices (supplier_id, material_id)
  where customer_id is null and is_special and is_active and valid_to is null;

-- سجل الأسعار: لا يُحدَّث ولا يُحذف
create table price_history (
  id uuid primary key default gen_random_uuid(),
  price_id uuid, supplier_id uuid not null, material_id uuid not null,
  old_price numeric(10,3), new_price numeric(10,3),
  action text not null, changed_by uuid, changed_by_name text,
  at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);

-- ---------- النقل ----------
create table transport_companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  code text not null unique, name text not null,
  cr_number text, phone text, wilayat text, governorate text,
  service_zones uuid[] default '{}',
  rating numeric(2,1) default 0,
  is_approved boolean not null default false, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);

create table truck_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, name text not null, name_en text,
  capacity_m3   numeric(6,2) not null check (capacity_m3 > 0),
  capacity_tons numeric(6,2) check (capacity_tons > 0),
  axles integer, is_active boolean not null default true, note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);

create table trucks (
  id uuid primary key default gen_random_uuid(),
  transporter_id uuid not null references transport_companies(id) on delete restrict,
  truck_type_id  uuid not null references truck_types(id),
  plate_no text not null, make text, year integer,
  capacity_m3   numeric(6,2) not null,
  capacity_tons numeric(6,2),
  is_available boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active',
  unique (transporter_id, plate_no)
);

create table drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  transporter_id uuid not null references transport_companies(id) on delete restrict,
  name text not null, phone text not null,
  license_no text, license_expiry timestamptz,
  default_truck_id uuid references trucks(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);

create table transport_rates (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references delivery_zones(id),
  truck_type_id uuid not null references truck_types(id),
  transporter_id uuid references transport_companies(id),  -- NULL = تعرفة المنصة
  price_per_trip numeric(10,3) not null check (price_per_trip >= 0),
  price_per_km   numeric(10,3) not null default 0,
  valid_from timestamptz not null default now(), valid_to timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);
create index on transport_rates (zone_id, truck_type_id, is_active);

-- ---------- الطلبات ----------
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  customer_id uuid not null references customer_profiles(id) on delete restrict,
  site_id     uuid not null references locations(id),
  supplier_id uuid not null references suppliers(id),
  transporter_id uuid references transport_companies(id),
  zone_id  uuid not null references delivery_zones(id),
  truck_id uuid not null references truck_types(id),
  status kx_order_status not null default 'draft',
  scheduled_at timestamptz, delivered_at timestamptz, cancelled_at timestamptz,
  cancel_reason text, notes text,
  quantity numeric(10,2) not null check (quantity > 0),
  unit kx_unit not null default 'm3',   -- وحدة واحدة لكل طلب؛ لا تُخلط م³ مع الطن
  trips_planned integer not null check (trips_planned > 0),
  trips_done integer not null default 0,
  price_snapshot jsonb not null,                      -- لقطة السعر وقت الإنشاء
  material_cost numeric(12,3) not null,
  transport_cost numeric(12,3) not null,
  platform_fee  numeric(12,3) not null,
  discount      numeric(12,3) not null default 0,
  coupon_code   text,
  vat           numeric(12,3) not null default 0,
  waiting_fees  numeric(12,3) not null default 0,
  total         numeric(12,3) not null,
  amount_paid   numeric(12,3) not null default 0,
  amount_refunded numeric(12,3) not null default 0,
  delivery_otp  char(4),
  receipt_method text, receipt_signature text,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active',
  constraint paid_not_over_total   check (amount_paid <= total + 0.001),
  constraint refund_not_over_paid  check (amount_refunded <= amount_paid + 0.001)
);
create index on orders (customer_id, created_at desc);
create index on orders (supplier_id, status);
create index on orders (transporter_id, status);
create index on orders (status, created_at desc);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete restrict,
  material_id uuid not null references materials(id),
  material_sku text, material_name text not null,
  unit kx_unit not null default 'm3',
  order_by text not null default 'unit',      -- unit | truck (طريقة إدخال العميل)
  quantity numeric(10,2) not null,
  unit_price numeric(10,3) not null, line_total numeric(12,3) not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);

create table quotations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id), customer_id uuid not null references customer_profiles(id),
  payload jsonb not null, total numeric(12,3) not null,
  valid_until timestamptz, accepted boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);

-- ---------- المال ----------
create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete restrict,
  customer_id uuid not null references customer_profiles(id),
  method kx_payment_method not null,
  amount numeric(12,3) not null check (amount > 0),
  currency char(3) not null default 'OMR',
  status kx_payment_status not null,
  provider text, provider_ref text,
  card_last4 char(4),                                  -- لا تُخزَّن البطاقة إطلاقًا
  transfer_receipt text, transfer_bank text, transfer_ref text, verify_note text,
  idempotency_key text not null,                       -- يمنع تكرار الدفع
  paid_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active',
  unique (order_id, idempotency_key)
);

create table refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete restrict,
  customer_id uuid not null references customer_profiles(id),
  amount numeric(12,3) not null check (amount > 0),
  percent_applied numeric(4,3), reason text not null,
  approved_by uuid, approved_by_name text,
  status text not null default 'processed', processed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  order_id uuid not null unique references orders(id),
  order_no text not null, customer_id uuid not null references customer_profiles(id),
  issue_date timestamptz not null default now(),
  material_cost numeric(12,3), transport_cost numeric(12,3), platform_fee numeric(12,3),
  waiting_fees numeric(12,3) default 0, discount numeric(12,3) default 0,
  vat numeric(12,3), total numeric(12,3) not null, amount_paid numeric(12,3),
  currency char(3) not null default 'OMR', status text not null default 'issued',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);

create table settlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id), order_no text not null,
  party_type kx_party_type not null, party_id uuid not null,
  gross_amount numeric(12,3) not null, commission numeric(12,3) not null default 0,
  net_payable  numeric(12,3) not null,
  status text not null default 'pending', due_date timestamptz,
  paid_at timestamptz, payment_ref text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active',
  unique (order_id, party_type)
);

create table commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id), order_no text not null,
  platform_fee numeric(12,3) not null,
  supplier_commission numeric(12,3) not null default 0,
  transporter_commission numeric(12,3) not null default 0,
  total_revenue numeric(12,3) not null,
  quantity numeric(10,2), unit kx_unit not null default 'm3',
  margin_per_unit numeric(10,3),
  recognized_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);

-- ---------- الرحلات ----------
create table trips (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete restrict,
  order_no text not null, seq integer not null,
  transporter_id uuid references transport_companies(id),
  driver_id uuid references drivers(id),
  truck_id  uuid references trucks(id),
  supplier_id uuid references suppliers(id),
  site_id uuid references locations(id),
  status kx_trip_status not null default 'assigned',
  unit kx_unit not null default 'm3',
  planned_qty numeric(10,2), actual_qty numeric(10,2),
  weight_ticket_id uuid,
  waiting_minutes integer not null default 0,
  waiting_fee numeric(10,3) not null default 0,
  waiting_approved boolean not null default false, waiting_note text,
  photos jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active',
  unique (order_id, seq)
);
create index on trips (driver_id, status);
create index on trips (transporter_id, status);

create table weight_tickets (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id), order_id uuid not null references orders(id),
  supplier_id uuid references suppliers(id),
  ticket_no text not null,
  unit kx_unit not null default 'm3',
  net_qty numeric(10,2) not null check (net_qty > 0),   -- الكمية الفعلية بوحدة الطلب
  -- الوزن القائم والفارغ اختياريان: يُملآن حين يوجد ميزان جسري
  gross_tons numeric(10,2), tare_tons numeric(10,2),
  image_url text, recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active',
  constraint gross_over_tare check (gross_tons is null or tare_tons is null
                                    or gross_tons > tare_tons)
);

-- ---------- التفاعل ----------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null, body text, link text,
  read boolean not null default false,
  channels_sent text[] default '{inapp}',
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);
create index on notifications (user_id, read, sent_at desc);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id),
  customer_id uuid not null references customer_profiles(id),
  supplier_id uuid references suppliers(id), transporter_id uuid references transport_companies(id),
  supplier_rating smallint check (supplier_rating between 1 and 5),
  transporter_rating smallint check (transporter_rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);

create table complaints (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customer_profiles(id), order_id uuid references orders(id),
  source text not null default 'customer_portal',
  name text, phone text, subject text not null, message text not null,
  status text not null default 'open', resolution text, resolved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);

create table coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, description text,
  discount_type kx_discount_type not null, discount_value numeric(10,3) not null check (discount_value > 0),
  max_discount numeric(10,3), min_order_value numeric(10,3) default 0,
  max_uses integer, used_count integer not null default 0,
  customer_id uuid references customer_profiles(id),
  valid_from timestamptz not null default now(), valid_to timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);

-- ---------- الرقابة والإعدادات ----------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null, entity text not null, entity_id uuid,
  actor_id uuid, actor_role text, actor_name text,
  details jsonb not null default '{}'::jsonb, ip text,
  at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);
create index on audit_logs (entity, entity_id);
create index on audit_logs (at desc);

create table settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, value jsonb not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);

create table otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null, code text not null,
  attempts integer not null default 0, used boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, status_flag kx_record_flag not null default 'active'
);
create index on otp_codes (phone, used, created_at desc);

-- محفّز تحديث updated_at على كل الجداول
do $$
declare t text;
begin
  for t in select table_name from information_schema.columns
           where table_schema = 'public' and column_name = 'updated_at'
  loop
    execute format('create trigger %I_touch before update on %I
                    for each row execute function kx_touch_updated_at()', t, t);
  end loop;
end $$;

-- منع الحذف النهائي للسجلات المالية والطلبات
create or replace function kx_block_delete() returns trigger as $$
begin raise exception 'الحذف النهائي غير مسموح على %, استخدم status_flag', tg_table_name; end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['orders','order_items','payments','refunds','invoices',
                           'settlements','commissions','trips','weight_tickets',
                           'price_history','audit_logs','quotations']
  loop
    execute format('create trigger %I_no_delete before delete on %I
                    for each row execute function kx_block_delete()', t, t);
  end loop;
end $$;
