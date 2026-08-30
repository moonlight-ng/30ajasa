alter table public.makerspace_bookings
    add column if not exists event_slug text;

update public.makerspace_bookings
set event_slug = class_slug
where event_slug is null;

alter table public.makerspace_bookings
    alter column event_slug set not null;

create index if not exists makerspace_bookings_event_status_idx
    on public.makerspace_bookings (event_slug, status);

alter table public.makerspace_payments
    add column if not exists event_slug text,
    add column if not exists subaccount_code text,
    alter column product_slug drop not null,
    alter column product_id drop not null,
    alter column product_code drop not null,
    alter column product_variant_id drop not null,
    alter column variant_option_id drop not null,
    alter column variant_value_id drop not null;

update public.makerspace_payments
set event_slug = product_slug
where event_slug is null;

drop function if exists public.reserve_makerspace_booking(
    uuid, uuid, text, text, date, text, text, text, integer, text,
    bigint, text, bigint, bigint, bigint, integer, text
);

create or replace function public.reserve_makerspace_booking(
    p_booking_id uuid,
    p_payment_id uuid,
    p_reference text,
    p_class_slug text,
    p_event_slug text,
    p_session_date date,
    p_session_period text,
    p_customer_name text,
    p_customer_email text,
    p_quantity integer,
    p_capacity integer,
    p_environment text,
    p_subaccount_code text,
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
    if p_quantity < 1 or p_capacity < 1 or p_quantity > p_capacity then
        return jsonb_build_object('ok', false, 'reason', 'invalid_quantity');
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_event_slug, 0));

    select coalesce(sum(quantity), 0)
    into reserved_places
    from public.makerspace_bookings
    where event_slug = p_event_slug
      and (
          status = 'paid'
          or (status = 'reserved' and expires_at > now())
      );

    if reserved_places + p_quantity > p_capacity then
        return jsonb_build_object('ok', false, 'reason', 'session_full');
    end if;

    insert into public.makerspace_bookings (
        id,
        class_slug,
        event_slug,
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
        p_event_slug,
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
        event_slug,
        subaccount_code,
        customer_email,
        amount,
        currency,
        status
    ) values (
        p_payment_id,
        p_booking_id,
        p_reference,
        p_environment,
        p_event_slug,
        p_subaccount_code,
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
    uuid, uuid, text, text, text, date, text, text, text, integer, integer,
    text, text, integer, text
) from public, anon, authenticated;

grant execute on function public.reserve_makerspace_booking(
    uuid, uuid, text, text, text, date, text, text, text, integer, integer,
    text, text, integer, text
) to service_role;
