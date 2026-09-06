-- ============================================================
-- دوال المعاملات المالية — تُنفَّذ داخل معاملة واحدة على الخادم
-- تُستدعى من التطبيق عبر supabase.rpc()، فلا يمكن تجاوز القواعد من الواجهة.
-- ============================================================

-- تسجيل دفعة ونقل الطلب إلى «مدفوع» عند اكتمال السداد
create or replace function kx_record_payment(
  p_order_id uuid, p_method kx_payment_method, p_amount numeric,
  p_idempotency_key text, p_provider text default 'demo', p_provider_ref text default null,
  p_card_last4 char(4) default null, p_transfer_ref text default null
) returns payments language plpgsql security definer as $$
declare o orders; pay payments; new_paid numeric; st kx_payment_status;
begin
  select * into o from orders where id = p_order_id for update;   -- قفل الصف يمنع الدفع المزدوج
  if not found then raise exception 'الطلب غير موجود'; end if;
  if o.status not in ('ready_for_payment','awaiting_transfer_verification') then
    raise exception 'الطلب غير جاهز للدفع (الحالة: %)', o.status;
  end if;
  if p_amount <= 0 then raise exception 'مبلغ غير صالح'; end if;
  if p_amount > o.total - o.amount_paid + 0.001 then raise exception 'المبلغ يتجاوز المستحق'; end if;

  select * into pay from payments where order_id = p_order_id and idempotency_key = p_idempotency_key;
  if found then return pay; end if;                                -- منع تكرار الدفع

  st := case when p_method = 'bank_transfer' then 'pending_verification' else 'captured' end;

  insert into payments (order_id, customer_id, method, amount, status, provider, provider_ref,
                        card_last4, transfer_ref, idempotency_key, paid_at)
  values (p_order_id, o.customer_id, p_method, p_amount, st, p_provider, p_provider_ref,
          p_card_last4, p_transfer_ref, p_idempotency_key,
          case when st = 'captured' then now() else null end)
  returning * into pay;

  if st = 'captured' then
    new_paid := o.amount_paid + p_amount;
    update orders set amount_paid = new_paid,
                      status = case when new_paid >= total - 0.001 then 'paid'::kx_order_status else status end
    where id = p_order_id;
  else
    update orders set status = 'awaiting_transfer_verification' where id = p_order_id;
  end if;

  insert into audit_logs (action, entity, entity_id, actor_id, details)
  values ('payment.create', 'payments', pay.id, kx_uid(),
          jsonb_build_object('order', o.order_no, 'amount', p_amount, 'method', p_method));
  return pay;
end $$;

-- استرداد مبلغ حسب نسبة المرحلة
create or replace function kx_refund(p_order_id uuid, p_amount numeric, p_reason text, p_percent numeric)
returns refunds language plpgsql security definer as $$
declare o orders; r refunds; total_ref numeric;
begin
  if not kx_is_staff() then raise exception 'صلاحية الاسترداد للإدارة فقط'; end if;
  select * into o from orders where id = p_order_id for update;
  if o.amount_paid <= 0 then raise exception 'لا توجد مبالغ مدفوعة'; end if;
  if p_amount > o.amount_paid - o.amount_refunded + 0.001 then raise exception 'المبلغ يتجاوز القابل للاسترداد'; end if;

  insert into refunds (order_id, customer_id, amount, percent_applied, reason, approved_by, processed_at)
  values (p_order_id, o.customer_id, p_amount, p_percent, p_reason, kx_uid(), now())
  returning * into r;

  total_ref := o.amount_refunded + p_amount;
  update orders set amount_refunded = total_ref,
                    status = case when total_ref >= o.amount_paid - 0.001
                                  then 'refunded_full'::kx_order_status
                                  else 'refunded_partial'::kx_order_status end
  where id = p_order_id;

  insert into audit_logs (action, entity, entity_id, actor_id, details)
  values ('refund.create', 'refunds', r.id, kx_uid(),
          jsonb_build_object('order', o.order_no, 'amount', p_amount, 'reason', p_reason));
  return r;
end $$;

-- بناء التسويات والعمولة عند التسليم
create or replace function kx_build_settlements(p_order_id uuid)
returns void language plpgsql security definer as $$
declare o orders; snap jsonb; sup_comm numeric; car_comm numeric;
begin
  select * into o from orders where id = p_order_id;
  if exists (select 1 from settlements where order_id = p_order_id) then return; end if;
  snap := o.price_snapshot -> 'internal';
  sup_comm := coalesce((snap ->> 'supplier_commission')::numeric, 0);
  car_comm := coalesce((snap ->> 'transporter_commission')::numeric, 0);

  insert into settlements (order_id, order_no, party_type, party_id, gross_amount, commission, net_payable, due_date)
  values (o.id, o.order_no, 'supplier', o.supplier_id, o.material_cost, sup_comm,
          o.material_cost - sup_comm, now() + interval '14 days'),
         (o.id, o.order_no, 'transporter', o.transporter_id, o.transport_cost + o.waiting_fees, car_comm,
          o.transport_cost + o.waiting_fees - car_comm, now() + interval '14 days');

  insert into commissions (order_id, order_no, platform_fee, supplier_commission, transporter_commission,
                           total_revenue, tons, margin_per_ton)
  values (o.id, o.order_no, o.platform_fee, sup_comm, car_comm,
          o.platform_fee + sup_comm + car_comm, o.tons,
          (o.platform_fee + sup_comm + car_comm) / nullif(o.tons, 0));
end $$;

-- تأكيد الاستلام برمز OTP
create or replace function kx_confirm_receipt(p_order_id uuid, p_code text, p_signature text default null)
returns orders language plpgsql security definer as $$
declare o orders;
begin
  select * into o from orders where id = p_order_id for update;
  if o.customer_id <> kx_customer_id() and not kx_is_staff() then raise exception 'غير مصرّح'; end if;
  if o.status <> 'arrived' then raise exception 'لم تصل الشاحنة بعد'; end if;
  if p_signature is null and p_code is distinct from o.delivery_otp then
    raise exception 'رمز الاستلام غير صحيح';
  end if;
  update orders set status = 'delivered', delivered_at = now(),
                    receipt_method = case when p_signature is null then 'otp' else 'signature' end,
                    receipt_signature = p_signature
  where id = p_order_id returning * into o;
  perform kx_build_settlements(p_order_id);
  return o;
end $$;
