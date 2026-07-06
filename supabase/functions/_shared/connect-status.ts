export type ConnectReadinessStatus =
  | "not_started"
  | "ready"
  | "payout_setup_incomplete"
  | "review_pending"
  | "action_required"
  | "payments_paused"
  | "payouts_paused";

type Requirements = {
  currently_due?: string[] | null;
  past_due?: string[] | null;
  eventually_due?: string[] | null;
  pending_verification?: string[] | null;
  disabled_reason?: string | null;
};

type StripeAccountLike = {
  id: string;
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
  capabilities?: {
    card_payments?: string | null;
    transfers?: string | null;
  } | null;
  requirements?: Requirements | null;
  future_requirements?: Requirements | null;
};

const arr = (values?: string[] | null): string[] => Array.isArray(values) ? values : [];

export function summarizeConnectAccount(account: StripeAccountLike) {
  const chargesEnabled = account.charges_enabled === true;
  const payoutsEnabled = account.payouts_enabled === true;
  const detailsSubmitted = account.details_submitted === true;
  const capabilityCardPayments = account.capabilities?.card_payments ?? null;
  const capabilityTransfers = account.capabilities?.transfers ?? null;
  const requirements = account.requirements ?? {};
  const futureRequirements = account.future_requirements ?? {};
  const currentlyDue = arr(requirements.currently_due);
  const pastDue = arr(requirements.past_due);
  const eventuallyDue = arr(requirements.eventually_due);
  const pendingVerification = arr(requirements.pending_verification);
  const futureCurrentlyDue = arr(futureRequirements.currently_due);
  const futureEventuallyDue = arr(futureRequirements.eventually_due);
  const futurePastDue = arr(futureRequirements.past_due);
  const disabledReason = requirements.disabled_reason ?? null;

  let readiness: ConnectReadinessStatus = "payout_setup_incomplete";
  if (chargesEnabled && payoutsEnabled && capabilityTransfers === "active" && !disabledReason && pastDue.length === 0) {
    readiness = "ready";
  } else if (disabledReason || pastDue.length > 0 || futurePastDue.length > 0) {
    if (!chargesEnabled) readiness = "payments_paused";
    else if (!payoutsEnabled || capabilityTransfers !== "active") readiness = "payouts_paused";
    else readiness = "action_required";
  } else if (pendingVerification.length > 0) {
    readiness = "review_pending";
  } else if (!detailsSubmitted || currentlyDue.length > 0 || eventuallyDue.length > 0 || futureCurrentlyDue.length > 0) {
    readiness = "payout_setup_incomplete";
  } else if (!payoutsEnabled || capabilityTransfers !== "active") {
    readiness = "review_pending";
  }

  const accountStatus = readiness === "ready"
    ? "active"
    : readiness === "review_pending"
      ? "pending_review"
      : readiness === "payout_setup_incomplete"
        ? "pending"
        : "restricted";

  return {
    charges_enabled: chargesEnabled,
    payouts_enabled: payoutsEnabled,
    details_submitted: detailsSubmitted,
    onboarding_complete: detailsSubmitted,
    account_status: accountStatus,
    connect_readiness_status: readiness,
    capability_card_payments: capabilityCardPayments,
    capability_transfers: capabilityTransfers,
    disabled_reason: disabledReason,
    requirements_currently_due: currentlyDue,
    requirements_past_due: pastDue,
    requirements_eventually_due: eventuallyDue,
    requirements_pending_verification: pendingVerification,
    future_requirements_currently_due: futureCurrentlyDue,
    future_requirements_eventually_due: futureEventuallyDue,
    future_requirements_past_due: futurePastDue,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function explainConnectBlock(account: {
  stripe_account_id?: string | null;
  connect_readiness_status?: string | null;
  payouts_enabled?: boolean | null;
  capability_transfers?: string | null;
  disabled_reason?: string | null;
  requirements_currently_due?: string[] | null;
  requirements_past_due?: string[] | null;
}) {
  if (!account.stripe_account_id) return "Seller has no Stripe Connect account";
  if (account.connect_readiness_status === "ready") return null;
  if (account.disabled_reason) return `Stripe Connect is restricted: ${account.disabled_reason}`;
  const pastDue = arr(account.requirements_past_due);
  if (pastDue.length) return `Seller has ${pastDue.length} past-due Stripe requirement${pastDue.length === 1 ? "" : "s"}`;
  const current = arr(account.requirements_currently_due);
  if (current.length) return `Seller must complete ${current.length} Stripe requirement${current.length === 1 ? "" : "s"}`;
  if (!account.payouts_enabled) return "Seller Stripe payouts are not enabled";
  if (account.capability_transfers !== "active") return "Seller Stripe transfers capability is not active";
  return "Seller Stripe account is not payout-ready";
}
