alter table public.makerspace_bookings
    add column if not exists expires_at timestamptz;

update public.makerspace_bookings
set expires_at = created_at + interval '30 minutes'
where expires_at is null;

alter table public.makerspace_bookings
    alter column expires_at set default (now() + interval '30 minutes'),
    alter column expires_at set not null;

create or replace function public.reserve_makerspace_booking(
    p_booking_id uuid,
    p_payment_id uuid,
    p_reference text,
    p_class_slug text,
    p_session_date date,
    p_session_period text,
    p_customer_name text,
    p_customer_email text,
    p_quantity integer,
    p_environment text,
    p_product_id bigint,
    p_product_code text,
    p_product_variant_id bigint,
    p_variant_option_id bigint,
    p_variant_value_id bigint,
    p_amount integer,
    p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    reserved_places integer;
begin
    if p_quantity < 1 or p_quantity > 3 then
        return jsonb_build_object('ok', false, 'reason', 'invalid_quantity');
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended(p_session_date::text || ':' || p_session_period, 0)
    );

    select coalesce(sum(quantity), 0)
    into reserved_places
    from public.makerspace_bookings
    where session_date = p_session_date
      and session_period = p_session_period
      and (
          status = 'paid'
          or (status = 'reserved' and expires_at > now())
      );

    if reserved_places + p_quantity > 3 then
        return jsonb_build_object('ok', false, 'reason', 'session_full');
    end if;

    insert into public.makerspace_bookings (
        id,
        class_slug,
        session_date,
        session_period,
        customer_name,
        customer_email,
        quantity,
        status,
        expires_at
    ) values (
        p_booking_id,
        p_class_slug,
        p_session_date,
        p_session_period,
        p_customer_name,
        lower(p_customer_email),
        p_quantity,
        'reserved',
        now() + interval '30 minutes'
    );

    insert into public.makerspace_payments (
        id,
        booking_id,
        reference,
        environment,
        product_slug,
        product_id,
        product_code,
        product_variant_id,
        variant_option_id,
        variant_value_id,
        customer_email,
        amount,
        currency,
        status
    ) values (
        p_payment_id,
        p_booking_id,
        p_reference,
        p_environment,
        p_class_slug,
        p_product_id,
        p_product_code,
        p_product_variant_id,
        p_variant_option_id,
        p_variant_value_id,
        lower(p_customer_email),
        p_amount,
        p_currency,
        'pending'
    );

    return jsonb_build_object('ok', true);
exception
    when unique_violation then
        return jsonb_build_object('ok', false, 'reason', 'duplicate_reference');
end;
$$;

revoke all on function public.reserve_makerspace_booking(
    uuid, uuid, text, text, date, text, text, text, integer, text,
    bigint, text, bigint, bigint, bigint, integer, text
) from public, anon, authenticated;

grant execute on function public.reserve_makerspace_booking(
    uuid, uuid, text, text, date, text, text, text, integer, text,
    bigint, text, bigint, bigint, bigint, integer, text
) to service_role;
