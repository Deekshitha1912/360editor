-- db/026_add_credit_ledger.sql
--
-- Adds an auditable history of every credit grant/spend/refund. Until now,
-- `credits` only held running totals (total_credits/used_credits/
-- available_credits) with no record of WHY any of them changed -- which is
-- exactly what made one real account end up with 5 credits used against
-- only 2 traceable Razorpay payments, with no way to see where the other 3
-- went.
--
-- credit_ledger is append-only -- one row per grant/spend/refund, in order,
-- with `balance_after` letting you read the running available_credits total
-- straight off the table without recomputing anything from `credits`.
--
-- This migration ALSO replaces grant_credits/consume_credit/refund_credit
-- with equivalent logic plus a ledger insert. Their original bodies were
-- never checked into this repo (created directly in the Supabase SQL
-- editor), so there is no prior version to diff against here -- the
-- replacements below are reverse-engineered from every known call site
-- (lib/credits.js, app/api/payments/verify, app/api/webhooks/razorpay) and
-- from a real account's observed numbers (grant_credits: available_credits
-- and total_credits both go up by p_credits, used_credits untouched;
-- consume_credit: used_credits +1, available_credits -1, only if available
-- was > 0; refund_credit: reverses exactly one consume). Sanity-check a
-- grant/consume/refund against a real balance after applying this, the same
-- way any other hand-applied migration in this project should be
-- spot-checked.
--
-- Idempotent -- apply by hand against dev, then production Supabase, same as
-- every prior migration in this file (no migration runner exists).

create table if not exists public.credit_ledger (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    delta integer not null,           -- positive = granted/refunded, negative = spent
    reason text not null,             -- 'purchase' | 'manual_grant' | 'project_create' | 'project_create_refund' | 'export_zip' | 'export_zip_refund' | 'renew' | 'renew_refund'
    reference_id text,                -- payment id / project id this entry relates to, if any
    balance_after integer not null,   -- available_credits immediately after this entry
    created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_id_created_at_idx
    on public.credit_ledger (user_id, created_at desc);

alter table public.credit_ledger enable row level security;

-- A user can read their own history; every write happens only through the
-- SECURITY DEFINER functions below (or a service-role/admin caller, which
-- bypasses RLS entirely as usual) -- no direct insert/update/delete policy
-- is needed or granted.
drop policy if exists "credit_ledger_select_own" on public.credit_ledger;
create policy "credit_ledger_select_own" on public.credit_ledger
    for select using (auth.uid() = user_id);

-- grant_credits — adds credits (a purchase, or a manual top-up), now with a
-- reason/reference so a grant's origin is traceable. p_reason/p_reference_id
-- default so existing callers that only pass (p_user_id, p_credits) keep
-- working unchanged until they're updated to pass them.
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
        set total_credits     = total_credits + p_credits,
            available_credits = available_credits + p_credits,
            updated_at        = now()
        where user_id = p_user_id
        returning available_credits into v_available;

    if not found then
        insert into public.credits (user_id, total_credits, used_credits, available_credits)
        values (p_user_id, p_credits, 0, p_credits)
        returning available_credits into v_available;
    end if;

    insert into public.credit_ledger (user_id, delta, reason, reference_id, balance_after)
    values (p_user_id, p_credits, p_reason, p_reference_id, v_available);
end;
$$;

-- consume_credit — spends exactly one credit, atomically, only if available
-- (the where clause below IS the atomicity: one UPDATE statement, row-
-- locked, so two concurrent callers can't both succeed off a stale read).
-- Returns true if a credit was spent, false if the user had none — same
-- contract lib/credits.js's consumeCredit() already documents.
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
        set used_credits      = used_credits + 1,
            available_credits = available_credits - 1,
            updated_at        = now()
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

-- refund_credit — reverses one consume_credit (project creation, or an
-- export-zip/renew step, failed after the credit was already spent). Only
-- ever undoes `used_credits`, never touches `total_credits` — a refund is
-- not the same as un-granting a purchase.
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
        set used_credits      = greatest(0, used_credits - 1),
            available_credits = available_credits + 1,
            updated_at        = now()
        where user_id = p_user_id
        returning available_credits into v_available;

    insert into public.credit_ledger (user_id, delta, reason, reference_id, balance_after)
    values (p_user_id, 1, coalesce(p_reason, 'refund'), p_reference_id, v_available);
end;
$$;
