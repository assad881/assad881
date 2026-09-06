-- ============================================================
-- سياسات أمان الصفوف (Row Level Security)
-- كل طرف لا يرى إلا ما يخصّه؛ الإدارة ترى كل شيء.
-- ============================================================

-- دوال مساعدة تقرأ دور المستخدم الحالي من جدول users عبر auth.uid()
create or replace function kx_uid() returns uuid language sql stable as $$
  select id from users where auth_uid = auth.uid()
$$;
create or replace function kx_role() returns kx_role language sql stable as $$
  select role from users where auth_uid = auth.uid()
$$;
create or replace function kx_is_staff() returns boolean language sql stable as $$
  select coalesce(kx_role() in ('admin','ops'), false)
$$;
create or replace function kx_customer_id() returns uuid language sql stable as $$
  select id from customer_profiles where user_id = kx_uid()
$$;
create or replace function kx_supplier_id() returns uuid language sql stable as $$
  select id from suppliers where user_id = kx_uid()
$$;
create or replace function kx_transporter_id() returns uuid language sql stable as $$
  select id from transport_companies where user_id = kx_uid()
$$;
create or replace function kx_driver_id() returns uuid language sql stable as $$
  select id from drivers where user_id = kx_uid()
$$;

-- تفعيل RLS على كل الجداول
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop execute format('alter table %I enable row level security', t); end loop;
end $$;

-- ---------- مرجعية عامة: قراءة للجميع، كتابة للإدارة ----------
do $$
declare t text;
begin
  foreach t in array array['material_categories','materials','delivery_zones','truck_types']
  loop
    execute format('create policy %I_read on %I for select using (true)', t, t);
    execute format('create policy %I_write on %I for all using (kx_is_staff()) with check (kx_is_staff())', t, t);
  end loop;
end $$;

-- الموردون وشركات النقل: القائمة المعتمدة عامة، والتعديل للمالك أو الإدارة
create policy suppliers_read on suppliers for select using (is_approved or kx_is_staff() or user_id = kx_uid());
create policy suppliers_write on suppliers for all
  using (kx_is_staff() or user_id = kx_uid()) with check (kx_is_staff() or user_id = kx_uid());

create policy carriers_read on transport_companies for select using (is_approved or kx_is_staff() or user_id = kx_uid());
create policy carriers_write on transport_companies for all
  using (kx_is_staff() or user_id = kx_uid()) with check (kx_is_staff() or user_id = kx_uid());

-- ---------- المستخدمون ----------
create policy users_self on users for select using (auth_uid = auth.uid() or kx_is_staff());
create policy users_update_self on users for update using (auth_uid = auth.uid() or kx_is_staff());
create policy users_admin_all on users for all using (kx_is_staff()) with check (kx_is_staff());

create policy cprofiles_self on customer_profiles for select using (user_id = kx_uid() or kx_is_staff());
create policy cprofiles_update on customer_profiles for update
  using (user_id = kx_uid() or kx_is_staff()) with check (user_id = kx_uid() or kx_is_staff());
create policy cprofiles_insert on customer_profiles for insert with check (user_id = kx_uid() or kx_is_staff());

-- ---------- المواقع: للعميل صاحبها فقط (ولمن ينفّذ طلبًا إليها) ----------
create policy locations_owner on locations for all
  using (customer_id = kx_customer_id() or kx_is_staff())
  with check (customer_id = kx_customer_id() or kx_is_staff());
create policy locations_fulfillers on locations for select using (
  exists (select 1 from orders o where o.site_id = locations.id and (
      o.supplier_id = kx_supplier_id() or o.transporter_id = kx_transporter_id()
      or exists (select 1 from trips t where t.order_id = o.id and t.driver_id = kx_driver_id()))));

-- ---------- الأسعار: القائمة العامة مقروءة، والخاصة لصاحبها ----------
-- السعر الخاص لا يصل لعميل غير معتمد أصلًا من قاعدة البيانات، لا من الواجهة فقط
create policy prices_public_read on supplier_prices for select using (
  is_active and (
    kx_is_staff()
    or supplier_id = kx_supplier_id()
    or customer_id = kx_customer_id()
    or (customer_id is null and not is_special)
    or (customer_id is null and is_special and exists (
          select 1 from customer_profiles c
          where c.id = kx_customer_id() and c.special_pricing_approved))
  ));
create policy prices_owner_write on supplier_prices for all
  using (kx_is_staff() or supplier_id = kx_supplier_id())
  with check (kx_is_staff() or supplier_id = kx_supplier_id());

create policy rates_read on transport_rates for select using (true);
create policy rates_write on transport_rates for all
  using (kx_is_staff()) with check (kx_is_staff());

create policy price_history_read on price_history for select
  using (kx_is_staff() or supplier_id = kx_supplier_id());
create policy price_history_insert on price_history for insert with check (true);

-- ---------- الأسطول ----------
create policy trucks_owner on trucks for all
  using (kx_is_staff() or transporter_id = kx_transporter_id())
  with check (kx_is_staff() or transporter_id = kx_transporter_id());
create policy drivers_owner on drivers for all
  using (kx_is_staff() or transporter_id = kx_transporter_id() or user_id = kx_uid())
  with check (kx_is_staff() or transporter_id = kx_transporter_id());

-- ---------- الطلبات: كل طرف يرى طلباته فقط ----------
create policy orders_visibility on orders for select using (
  kx_is_staff()
  or customer_id = kx_customer_id()
  or supplier_id = kx_supplier_id()
  or transporter_id = kx_transporter_id()
  or exists (select 1 from trips t where t.order_id = orders.id and t.driver_id = kx_driver_id()));
create policy orders_customer_insert on orders for insert with check (customer_id = kx_customer_id());
-- التعديل يمر عبر دوال قاعدة البيانات (SECURITY DEFINER) وليس تحديثًا مباشرًا
create policy orders_staff_update on orders for update using (kx_is_staff()) with check (kx_is_staff());

create policy order_items_follow on order_items for select using (
  exists (select 1 from orders o where o.id = order_items.order_id));
create policy order_items_insert on order_items for insert with check (
  exists (select 1 from orders o where o.id = order_id and o.customer_id = kx_customer_id()));

create policy quotations_own on quotations for all
  using (kx_is_staff() or customer_id = kx_customer_id())
  with check (kx_is_staff() or customer_id = kx_customer_id());

-- ---------- المال: العميل يرى مدفوعاته، والإدارة كل شيء ----------
create policy payments_visibility on payments for select
  using (kx_is_staff() or customer_id = kx_customer_id());
create policy payments_insert on payments for insert
  with check (kx_is_staff() or customer_id = kx_customer_id());
create policy payments_staff_update on payments for update using (kx_is_staff()) with check (kx_is_staff());

create policy refunds_visibility on refunds for select
  using (kx_is_staff() or customer_id = kx_customer_id());
create policy refunds_staff_write on refunds for insert with check (kx_is_staff());

create policy invoices_visibility on invoices for select
  using (kx_is_staff() or customer_id = kx_customer_id());
create policy invoices_insert on invoices for insert with check (kx_is_staff());

-- التسويات: كل طرف يرى مستحقاته فقط
create policy settlements_visibility on settlements for select using (
  kx_is_staff()
  or (party_type = 'supplier'    and party_id = kx_supplier_id())
  or (party_type = 'transporter' and party_id = kx_transporter_id()));
create policy settlements_staff_write on settlements for all
  using (kx_is_staff()) with check (kx_is_staff());

-- العمولات: للإدارة وحدها (تكشف هامش المنصة)
create policy commissions_staff on commissions for all
  using (kx_is_staff()) with check (kx_is_staff());

-- ---------- الرحلات ----------
create policy trips_visibility on trips for select using (
  kx_is_staff()
  or transporter_id = kx_transporter_id()
  or driver_id = kx_driver_id()
  or supplier_id = kx_supplier_id()
  or exists (select 1 from orders o where o.id = trips.order_id and o.customer_id = kx_customer_id()));
create policy trips_update on trips for update using (
  kx_is_staff() or transporter_id = kx_transporter_id() or driver_id = kx_driver_id())
  with check (kx_is_staff() or transporter_id = kx_transporter_id() or driver_id = kx_driver_id());
create policy trips_insert on trips for insert with check (kx_is_staff() or transporter_id = kx_transporter_id());

create policy tickets_visibility on weight_tickets for select using (
  kx_is_staff() or supplier_id = kx_supplier_id()
  or exists (select 1 from orders o where o.id = weight_tickets.order_id
             and (o.customer_id = kx_customer_id() or o.transporter_id = kx_transporter_id())));
create policy tickets_insert on weight_tickets for insert
  with check (kx_is_staff() or supplier_id = kx_supplier_id());

-- ---------- التفاعل ----------
create policy notifications_own on notifications for select using (user_id = kx_uid() or kx_is_staff());
create policy notifications_update_own on notifications for update using (user_id = kx_uid());
create policy notifications_insert on notifications for insert with check (true);

create policy reviews_read on reviews for select using (
  kx_is_staff() or customer_id = kx_customer_id()
  or supplier_id = kx_supplier_id() or transporter_id = kx_transporter_id());
create policy reviews_insert on reviews for insert with check (customer_id = kx_customer_id());

create policy complaints_own on complaints for select
  using (kx_is_staff() or customer_id = kx_customer_id());
create policy complaints_insert on complaints for insert with check (true);
create policy complaints_staff_update on complaints for update using (kx_is_staff()) with check (kx_is_staff());

create policy coupons_read on coupons for select
  using (is_active and (customer_id is null or customer_id = kx_customer_id()) or kx_is_staff());
create policy coupons_write on coupons for all using (kx_is_staff()) with check (kx_is_staff());

-- ---------- الرقابة ----------
create policy audit_read_staff on audit_logs for select using (kx_is_staff());
create policy audit_insert_any on audit_logs for insert with check (true);   -- الكتابة فقط، بلا تعديل أو حذف

create policy settings_read on settings for select using (true);
create policy settings_write on settings for all using (kx_is_staff()) with check (kx_is_staff());

-- رموز التحقق: لا تُقرأ من العميل إطلاقًا (تُعالج في دالة خادم)
create policy otp_no_read on otp_codes for select using (kx_is_staff());
