// Stripe webhook handler. Public (no JWT).
// TODO: Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in Backend → Secrets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const whSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !whSecret) {
    return new Response("Stripe not configured", { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("No signature", { status: 400 });

  const body = await req.text();
  const Stripe = (await import("https://esm.sh/stripe@14.21.0?target=deno")).default;
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, whSecret);
  } catch (e) {
    return new Response(`Webhook error: ${e}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session: any = event.data.object;
        const orderId = session.metadata?.order_id;
        if (orderId) {
          await supabase.from("orders").update({ status: "paid" }).eq("id", orderId);
          await supabase.from("payments").update({
            status: "succeeded",
            stripe_payment_intent_id: session.payment_intent,
          }).eq("stripe_session_id", session.id);
        }
        break;
      }
      case "account.updated": {
        const acct: any = event.data.object;
        await supabase.from("seller_stripe_accounts").update({
          payouts_enabled: acct.payouts_enabled,
          details_submitted: acct.details_submitted,
          charges_enabled: acct.charges_enabled,
          account_status: acct.details_submitted ? "active" : "pending",
        }).eq("stripe_account_id", acct.id);
        break;
      }
      case "payment_intent.payment_failed": {
        const pi: any = event.data.object;
        await supabase.from("payments").update({
          status: "failed",
          error_message: pi.last_payment_error?.message ?? "Payment failed",
        }).eq("stripe_payment_intent_id", pi.id);
        break;
      }
    }
  } catch (e) {
    console.error("Webhook handler error", e);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});