import type Stripe from "https://esm.sh/stripe@22.0.2";

type StripeAccount = Stripe.Account;

export async function findConnectAccountForOrg(stripe: Stripe, orgId: string, email?: string | null): Promise<StripeAccount | null> {
  let fallbackByEmail: StripeAccount | null = null;
  let startingAfter: string | undefined;

  for (let pageCount = 0; pageCount < 10; pageCount += 1) {
    const page = await stripe.accounts.list({ limit: 100, starting_after: startingAfter });

    for (const account of page.data) {
      if (account.metadata?.org_id === orgId) return account;

      // Use email only as a fallback. We do not immediately return it because a
      // user can own multiple orgs, while metadata is the reliable mapping.
      if (!fallbackByEmail && email && account.email?.toLowerCase() === email.toLowerCase()) {
        fallbackByEmail = account;
      }
    }

    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  return fallbackByEmail;
}
