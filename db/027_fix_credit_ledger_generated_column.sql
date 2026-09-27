-- db/027_fix_credit_ledger_generated_column.sql
--
-- URGENT — fixes a bug introduced by db/026, which broke consume_credit/
-- refund_credit/grant_credits for EVERY user, not just one account. Apply
-- this immediately (dev, then production) to unbreak project creation,
-- ZIP export, and tour renewal.
--
-- `credits.available_credits` turned out to be a GENERATED column
-- (total_credits - used_credits, computed automatically) rather than a
-- plain stored one, which db/026 didn't account for. Its three functions
-- all tried to `set available_credits = ...` directly inside an UPDATE,
-- which Postgres rejects for a generated column ("column can only be
-- updated to DEFAULT") — every call has been erroring out since 026 was
-- applied, which lib/credits.js's consumeCredit() treats identically to
-- "no credits available" (it can't tell an RPC error from a real `false`),
-- so project creation/export/renew all failed for every user regardless of
-- their real balance.
--
-- This replaces the same three functions again, this time only ever
-- writing total_credits/used_credits and reading available_credits back via
-- RETURNING (fully valid for a generated column — only direct assignment is
-- disallowed). No other behavior changes from db/026's intent.
--
-- Idempotent -- apply by hand against dev, then production Supabase, same as
-- every prior migration in this file (no migration runner exists).

create or replace function public.grant_credits(
    p_user_id uuid,
    p_credits integer,
    p_reason text default 'purchase',
    p_reference_id text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_available integer;
begin
    update public.credits
        set total_credits = total_credits + p_credits,
            updated_at     = now()
        where user_id = p_user_id
        returning available_credits into v_available;

    if not found then
        insert into public.credits (user_id, total_credits, used_credits)
        values (p_user_id, p_credits, 0)
        returning available_credits into v_available;
    end if;

    insert into public.credit_ledger (user_id, delta, reason, reference_id, balance_after)
    values (p_user_id, p_credits, p_reason, p_reference_id, v_available);
end;
$$;

create or replace function public.consume_credit(
    p_user_id uuid,
    p_reason text default null,
    p_reference_id text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_available integer;
begin
    update public.credits
        set used_credits = used_credits + 1,
            updated_at   = now()
        where user_id = p_user_id and available_credits > 0
        returning available_credits into v_available;

    if not found then
        return false;
    end if;

    insert into public.credit_ledger (user_id, delta, reason, reference_id, balance_after)
    values (p_user_id, -1, coalesce(p_reason, 'consume'), p_reference_id, v_available);

    return true;
end;
$$;

create or replace function public.refund_credit(
    p_user_id uuid,
    p_reason text default null,
    p_reference_id text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_available integer;
begin
    update public.credits
        set used_credits = greatest(0, used_credits - 1),
            updated_at    = now()
        where user_id = p_user_id
        returning available_credits into v_available;

    insert into public.credit_ledger (user_id, delta, reason, reference_id, balance_after)
    values (p_user_id, 1, coalesce(p_reason, 'refund'), p_reference_id, v_available);
end;
$$;
