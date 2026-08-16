create extension if not exists pgcrypto with schema extensions;

create table if not exists public.makerspace_bookings (
    id uuid primary key,
    class_slug text not null,
    session_date date not null,
    session_period text not null check (session_period in ('morning', 'evening')),
    customer_name text not null,
    customer_email text not null,
    quantity integer not null default 1 check (quantity between 1 and 3),
    status text not null default 'reserved' check (status in ('reserved', 'paid', 'cancelled')),
    created_at timestamptz not null default now()
);

create index if not exists makerspace_bookings_session_status_idx
    on public.makerspace_bookings (session_date, session_period, status);

create table if not exists public.makerspace_payments (
    id uuid primary key,
    booking_id uuid not null unique references public.makerspace_bookings(id) on delete cascade,
    reference text not null unique,
    provider text not null default 'paystack',
    environment text not null check (environment in ('test', 'live')),
    product_slug text not null,
    product_id bigint not null,
    product_code text not null,
    product_variant_id bigint not null,
    variant_option_id bigint not null,
    variant_value_id bigint not null,
    customer_email text not null,
    amount integer not null check (amount > 0),
    currency text not null default 'NGN',
    status text not null default 'pending' check (status in ('pending', 'unverified', 'success', 'failed')),
    provider_status text,
    provider_transaction_id text,
    paid_at timestamptz,
    verified_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists makerspace_payments_email_created_idx
    on public.makerspace_payments (customer_email, created_at desc);

alter table public.makerspace_bookings enable row level security;
alter table public.makerspace_payments enable row level security;

revoke all on table public.makerspace_bookings from anon, authenticated;
revoke all on table public.makerspace_payments from anon, authenticated;
grant select, insert, update on table public.makerspace_bookings to service_role;
grant select, insert, update on table public.makerspace_payments to service_role;

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
      and status in ('reserved', 'paid');

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
        status
    ) values (
        p_booking_id,
        p_class_slug,
        p_session_date,
        p_session_period,
        p_customer_name,
        lower(p_customer_email),
        p_quantity,
        'reserved'
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
