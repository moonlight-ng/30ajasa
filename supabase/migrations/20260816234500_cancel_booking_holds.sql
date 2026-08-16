create or replace function public.cancel_makerspace_booking(
    p_booking_id uuid,
    p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    selected_booking_status text;
    selected_payment_status text;
begin
    select booking.status, payment.status
    into selected_booking_status, selected_payment_status
    from public.makerspace_bookings as booking
    join public.makerspace_payments as payment
      on payment.booking_id = booking.id
    where booking.id = p_booking_id
      and payment.reference = p_reference
    for update of booking, payment;

    if not found then
        return jsonb_build_object('ok', false, 'reason', 'not_found');
    end if;

    if selected_booking_status = 'cancelled' then
        return jsonb_build_object('ok', true, 'already_cancelled', true);
    end if;

    if selected_booking_status = 'paid' or selected_payment_status = 'success' then
        return jsonb_build_object('ok', false, 'reason', 'already_paid');
    end if;

    if selected_booking_status <> 'reserved'
       or selected_payment_status <> 'pending' then
        return jsonb_build_object('ok', false, 'reason', 'not_cancellable');
    end if;

    update public.makerspace_bookings
    set status = 'cancelled'
    where id = p_booking_id;

    update public.makerspace_payments
    set status = 'failed',
        provider_status = 'customer_cancelled_popup'
    where booking_id = p_booking_id
      and reference = p_reference;

    return jsonb_build_object('ok', true, 'already_cancelled', false);
end;
$$;

revoke all on function public.cancel_makerspace_booking(uuid, text)
from public, anon, authenticated;

grant execute on function public.cancel_makerspace_booking(uuid, text)
to service_role;
