ALTER TABLE public.seller_stripe_accounts
  ADD COLUMN IF NOT EXISTS disabled_reason text,
  ADD COLUMN IF NOT EXISTS capability_card_payments text,
  ADD COLUMN IF NOT EXISTS capability_transfers text,
  ADD COLUMN IF NOT EXISTS requirements_currently_due text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS requirements_past_due text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS requirements_eventually_due text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS requirements_pending_verification text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS future_requirements_currently_due text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS future_requirements_eventually_due text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS future_requirements_past_due text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS connect_readiness_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS stripe_environment text,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_onboarding_link_created_at timestamptz;

ALTER TABLE public.seller_stripe_accounts
  DROP CONSTRAINT IF EXISTS seller_stripe_accounts_connect_readiness_status_check;

ALTER TABLE public.seller_stripe_accounts
  ADD CONSTRAINT seller_stripe_accounts_connect_readiness_status_check
  CHECK (connect_readiness_status IN (
    'not_started',
    'ready',
    'payout_setup_incomplete',
    'review_pending',
    'action_required',
    'payments_paused',
    'payouts_paused'
  ));

CREATE INDEX IF NOT EXISTS idx_seller_stripe_accounts_connect_readiness
  ON public.seller_stripe_accounts(connect_readiness_status);

CREATE INDEX IF NOT EXISTS idx_seller_stripe_accounts_payout_ready
  ON public.seller_stripe_accounts(org_id, payouts_enabled, capability_transfers);

DROP VIEW IF EXISTS public.admin_seller_connect_readiness;

CREATE VIEW public.admin_seller_connect_readiness
WITH (security_invoker = true) AS
SELECT
  ssa.org_id,
  org.name AS organization_name,
  ssa.stripe_account_id,
  ssa.account_status,
  ssa.connect_readiness_status,
  ssa.charges_enabled,
  ssa.payouts_enabled,
  ssa.details_submitted,
  ssa.capability_card_payments,
  ssa.capability_transfers,
  ssa.disabled_reason,
  ssa.requirements_currently_due,
  ssa.requirements_past_due,
  ssa.requirements_pending_verification,
  ssa.last_synced_at,
  COALESCE(p.pending_payout_total, 0::numeric) AS pending_payout_total,
  COALESCE(p.pending_payout_count, 0::bigint) AS pending_payout_count
FROM public.seller_stripe_accounts ssa
JOIN public.organizations org ON org.id = ssa.org_id
LEFT JOIN (
  SELECT
    ce.org_id,
    sum(pay.seller_payout) FILTER (
      WHERE pay.status = 'succeeded'
        AND pay.manual_payout_status = 'manual_payout_pending'
        AND pay.stripe_transfer_id IS NULL
    ) AS pending_payout_total,
    count(*) FILTER (
      WHERE pay.status = 'succeeded'
        AND pay.manual_payout_status = 'manual_payout_pending'
        AND pay.stripe_transfer_id IS NULL
    ) AS pending_payout_count
  FROM public.payments pay
  JOIN public.orders ord ON ord.id = pay.order_id
  JOIN public.clearance_events ce ON ce.id = ord.event_id
  GROUP BY ce.org_id
) p ON p.org_id = ssa.org_id
WHERE public.is_admin(auth.uid());

GRANT SELECT ON public.admin_seller_connect_readiness TO authenticated;

NOTIFY pgrst, 'reload schema';