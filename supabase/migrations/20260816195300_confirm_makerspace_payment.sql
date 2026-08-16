create or replace function public.confirm_makerspace_payment(
    p_reference text,
    p_provider_status text,
    p_provider_transaction_id text,
    p_paid_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    selected_booking_id uuid;
begin
    update public.makerspace_payments
    set status = 'success',
        provider_status = p_provider_status,
        provider_transaction_id = p_provider_transaction_id,
        paid_at = coalesce(p_paid_at, now()),
        verified_at = now()
    where reference = p_reference
      and status in ('pending', 'unverified', 'success')
    returning booking_id into selected_booking_id;

    if selected_booking_id is null then
        return false;
    end if;

    update public.makerspace_bookings
    set status = 'paid'
    where id = selected_booking_id
      and status in ('reserved', 'paid');

    return true;
end;
$$;

revoke all on function public.confirm_makerspace_payment(
    text, text, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.confirm_makerspace_payment(
    text, text, text, timestamptz
) to service_role;
