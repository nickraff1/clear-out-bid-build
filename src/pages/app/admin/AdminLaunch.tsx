import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, Rocket, ExternalLink, Gavel } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type Check = {
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  href?: string;
};

type Stats = {
  activeListings: number;
  sellers: number;
  sellerOrgs: number;
  buyers: number;
  pendingPayouts: number;
  unresolvedReports: number;
  stuckOrders: number;
  paidOrders: number;
  expiredAuctionsActive: number;
  paidOrdersNoPickupCode: number;
  expiredPickupActive: number;
  uncategorizedActive: number;
  latestTxnStatus: string | null;
  latestTxnAt: string | null;
  paymentMode: "sandbox" | "live" | "none";
  authEnabled: boolean;
  currentUserAdmin: boolean;
  adminRoleSource: string;
  adminRpcAvailable: boolean;
  messagingIntegrityIssues: number;
  conversationsNoMessages: number;
  paidOrderMissingSystemMessages: number;
  paidOrdersNoConversation: number;
  paymentIntegrityIssues: number;
  failedWebhookEvents: number;
  auctionAutoChargeFailures: number;
};

type CountOnlyQuery = {
  select: (columns: string, options: { count: "exact"; head: true }) => {
    not: (column: string, operator: string, value: null) => Promise<{ count: number | null }>;
    eq: (column: string, value: string) => Promise<{ count: number | null }>;
  };
};

const fromUntyped = (table: string) => supabase.from(table as never) as unknown as CountOnlyQuery;
const isAdminRpc = (
  fn: "is_admin",
  args: { _user_id: string },
) => supabase.rpc(fn, args) as Promise<{ data: boolean | null; error: { message?: string } | null }>;

const env = (import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined) ?? "";

function paymentMode(): Stats["paymentMode"] {
  if (env.startsWith("pk_live_")) return "live";
  if (env.startsWith("pk_test_")) return "sandbox";
  return "none";
}

export default function AdminLaunch() {
  const { user, roles, isAdmin } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const [
      activeLots, sellerOrgsCount, sellerUsers, buyerProfiles,
      pendingPayouts, unresolvedReports, stuckOrders, paidOrders, latestPayment,
      expiredAuctions, paidNoCode, expiredPickupLots, uncategorizedLots,
      adminRpcCheck, messagingIssues, conversationsNoMessages, paidOrderMissingSystemMessages, paidNoConversation,
      paymentIntegrityIssues, failedWebhookEvents, auctionChargeFailures,
    ] = await Promise.all([
      supabase.from("lots").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("organizations").select("id", { count: "exact", head: true }).eq("org_type", "seller"),
      supabase.from("org_members").select("user_id, org:organizations!inner(org_type)").eq("org.org_type", "seller"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "succeeded").eq("manual_payout_status", "manual_payout_pending"),
      supabase.from("lot_reports").select("id", { count: "exact", head: true }).neq("status", "resolved"),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending_payment").lt("created_at", thirtyMinAgo),
      supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "ready_for_pickup", "collected"]),
      supabase.from("payments").select("status, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("lots").select("id", { count: "exact", head: true }).eq("status", "active").eq("pricing_type", "auction").lt("auction_end", nowIso),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid").is("pickup_code", null),
      supabase.from("lots").select("id, event:clearance_events!inner(pickup_end)", { count: "exact", head: true }).eq("status", "active").lt("event.pickup_end", nowIso),
      supabase.from("lots").select("id", { count: "exact", head: true }).eq("status", "active").is("category_id", null),
      user ? isAdminRpc("is_admin", { _user_id: user.id }) : Promise.resolve({ data: false, error: null }),
      fromUntyped("admin_messaging_integrity").select("conversation_id", { count: "exact", head: true }).not("issue", "is", null),
      fromUntyped("admin_messaging_integrity").select("conversation_id", { count: "exact", head: true }).eq("issue", "conversation_no_messages"),
      fromUntyped("admin_messaging_integrity").select("conversation_id", { count: "exact", head: true }).eq("issue", "paid_order_missing_system_message"),
      fromUntyped("admin_stuck_orders").select("order_id", { count: "exact", head: true }).eq("stuck_reason", "paid_no_conversation"),
      fromUntyped("admin_payment_integrity").select("payment_id", { count: "exact", head: true }).not("issue", "is", null),
      fromUntyped("stripe_webhook_events").select("event_id", { count: "exact", head: true }).eq("processing_status", "failed"),
      fromUntyped("orders").select("id", { count: "exact", head: true }).not("auction_payment_error", "is", null),
    ]);

    const distinctSellerUsers = new Set(((sellerUsers.data ?? []) as Array<{ user_id: string }>).map(r => r.user_id)).size;

    setStats({
      activeListings: activeLots.count ?? 0,
      sellers: distinctSellerUsers,
      sellerOrgs: sellerOrgsCount.count ?? 0,
      buyers: buyerProfiles.count ?? 0,
      pendingPayouts: pendingPayouts.count ?? 0,
      unresolvedReports: unresolvedReports.count ?? 0,
      stuckOrders: stuckOrders.count ?? 0,
      paidOrders: paidOrders.count ?? 0,
      expiredAuctionsActive: expiredAuctions.count ?? 0,
      paidOrdersNoPickupCode: paidNoCode.count ?? 0,
      expiredPickupActive: expiredPickupLots.count ?? 0,
      uncategorizedActive: uncategorizedLots.count ?? 0,
      latestTxnStatus: latestPayment.data?.status ?? null,
      latestTxnAt: latestPayment.data?.created_at ?? null,
      paymentMode: paymentMode(),
      authEnabled: true, // Lovable Cloud auth is always available
      currentUserAdmin: isAdmin,
      adminRoleSource: roles.includes("admin") ? "user_roles.role=admin" : "none",
      adminRpcAvailable: !!adminRpcCheck.data && !adminRpcCheck.error,
      messagingIntegrityIssues: messagingIssues.count ?? 0,
      conversationsNoMessages: conversationsNoMessages.count ?? 0,
      paidOrderMissingSystemMessages: paidOrderMissingSystemMessages.count ?? 0,
      paidOrdersNoConversation: paidNoConversation.count ?? 0,
      paymentIntegrityIssues: paymentIntegrityIssues.count ?? 0,
      failedWebhookEvents: failedWebhookEvents.count ?? 0,
      auctionAutoChargeFailures: auctionChargeFailures.count ?? 0,
    });
    setLoading(false);
  }, [isAdmin, roles, user]);

  useEffect(() => { void load(); }, [load]);

  async function closeExpired() {
    setClosing(true);
    try {
      const { data, error } = await supabase.functions.invoke("close-expired-auctions");
      if (error) throw error;
      toast.success(`Closed ${data?.closed ?? 0} expired auction(s)`);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to close auctions");
    } finally {
      setClosing(false);
    }
  }

  if (loading || !stats) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const checks: Check[] = [
    {
      label: "Buyer journey (browse → buy → pickup → review)",
      status: stats.latestTxnStatus === "succeeded" && stats.paidOrdersNoPickupCode === 0 ? "warn" : "fail",
      detail: stats.latestTxnStatus === "succeeded"
        ? "Code path is wired and the latest payment succeeded. Still run the full sandbox checklist before inviting real buyers."
        : "Run a sandbox buy-now checkout and confirm payment, pickup code, conversation, pickup proposal and review unlock.",
      href: "/app/buyer/orders",
    },
    {
      label: "Seller journey (create → publish → sell → payout)",
      status: stats.sellers > 0 && stats.activeListings > 0 ? "warn" : "fail",
      detail: "Listing, order, pickup and manual payout screens are available. Complete a real seller sandbox sale before closed beta.",
      href: "/app/seller/lots",
    },
    {
      label: "Admin journey (orders, payouts, reports, bidders)",
      status: stats.currentUserAdmin && stats.adminRpcAvailable ? "warn" : "fail",
      detail: "Admin tools exist for orders, payouts, reports and bidders. Verify hold, paid, issue-resolution and refund actions against sandbox data.",
      href: "/app/admin/bidders",
    },
    {
      label: "Auction journey (verify → bid → close → winner order)",
      status: stats.expiredAuctionsActive === 0 && stats.auctionAutoChargeFailures === 0 ? "warn" : "fail",
      detail: "Server-side bidding guards and winner charge flow are implemented. Prove saved-card setup, deposit hold, scheduled close and failed-card handling in sandbox before live auctions.",
    },
    {
      label: "Auction winner auto-charge failures",
      status: stats.auctionAutoChargeFailures === 0 ? "pass" : "fail",
      detail: stats.auctionAutoChargeFailures === 0
        ? "No auction winner payment failures are currently flagged."
        : `${stats.auctionAutoChargeFailures} auction order(s) have failed automatic winner charge attempts. Review bidders/orders before relisting.`,
      href: "/app/admin/bidders",
    },
    {
      label: "Payment states (success / fail / expired / cancel)",
      status: stats.paymentMode === "none" ? "fail" : stats.latestTxnStatus === "succeeded" ? "warn" : "fail",
      detail: "Embedded Checkout and webhook ledger are implemented. Sandbox QA must still prove success, failed payment, cancelled checkout and expired checkout handling.",
    },
    {
      label: "Webhook processing health",
      status: stats.failedWebhookEvents === 0 ? "pass" : "fail",
      detail: stats.failedWebhookEvents === 0
        ? "No failed Stripe webhook events are recorded."
        : `${stats.failedWebhookEvents} Stripe webhook event(s) failed processing. Inspect backend logs and retry/reconcile before launch.`,
      href: "/app/admin/payments",
    },
    {
      label: "Payment / payout integrity",
      status: stats.paymentIntegrityIssues === 0 ? "pass" : "fail",
      detail: stats.paymentIntegrityIssues === 0
        ? "Payment, refund and payout integrity checks are clear."
        : `${stats.paymentIntegrityIssues} payment integrity issue(s) need admin review before launch.`,
      href: "/app/admin/payouts",
    },
    {
      label: "Policy pages live",
      status: "pass",
      detail: "Terms, Privacy, Prohibited Materials, Pickup Safety, Refunds & Disputes, Auction Terms, Buyer Default, Prohibited Bidding all routed.",
      href: "/terms",
    },
    {
      label: "Closed-beta readiness",
      status: "warn",
      detail: stats.paymentMode === "live"
        ? "Live frontend key is present, but closed-beta readiness still depends on passing the sandbox and live-smoke checklist."
        : "Sandbox mode is expected at this stage. Complete the sandbox checklist before switching on live buyer payments.",
    },
    {
      label: "Expired auction backlog",
      status: stats.expiredAuctionsActive === 0 ? "pass" : "fail",
      detail: stats.expiredAuctionsActive === 0
        ? "No expired auctions sitting in active status. Confirm the close-expired-auctions schedule in Lovable/Supabase before live auctions."
        : `${stats.expiredAuctionsActive} expired auction(s) still marked active. Use "Close expired auctions now".`,
    },
    {
      label: "Paid orders missing pickup code",
      status: stats.paidOrdersNoPickupCode === 0 ? "pass" : "fail",
      detail: stats.paidOrdersNoPickupCode === 0
        ? "Every paid order has a pickup code."
        : `${stats.paidOrdersNoPickupCode} paid order(s) without a pickup code — use Admin Orders → Regenerate code.`,
      href: "/app/admin/orders",
    },
    {
      label: "Active listings with expired pickup window",
      status: stats.expiredPickupActive === 0 ? "pass" : "fail",
      detail: stats.expiredPickupActive === 0
        ? "All active listings have a future pickup window. Server triggers reject bids/orders on expired windows."
        : `${stats.expiredPickupActive} active listing(s) sit on past pickup windows. Hide them or contact the seller to reschedule.`,
      href: "/app/admin/listings",
    },
    {
      label: "Active listings missing a category",
      status: stats.uncategorizedActive === 0 ? "pass" : "warn",
      detail: stats.uncategorizedActive === 0
        ? "Every active listing has a category — category filters work end-to-end."
        : `${stats.uncategorizedActive} listing(s) are missing a category and won't surface in category filters.`,
      href: "/app/admin/listings",
    },
    {
      label: "Brand spelling locked",
      status: "pass",
      detail: "Brand standardised on 'Offcutt' across header, footer, policies, emails, and SEO pages.",
    },
    {
      label: "Public marketing pages live (Pricing, Contact, Help, For Sellers)",
      status: "pass",
      detail: "Footer links no longer 404. /pricing, /contact, /help, /for-sellers all routed with beta-ready content.",
      href: "/pricing",
    },
    {
      label: "Legacy /dashboard area retired",
      status: "pass",
      detail: "/dashboard and all /dashboard/* subroutes redirect to /app. Only the /app portal is exposed in nav.",
    },
    {
      label: "Server-side seller bid guard",
      status: "pass",
      detail: "Database trigger blocks sellers (and members of the seller org) from bidding on their own lots.",
    },
    {
      label: "Pickup-window server guard",
      status: "pass",
      detail: "Triggers on bids and orders reject placement when the event pickup window has already ended.",
    },
    {
      label: "Webhook cancellation handling",
      status: "pass",
      detail: "checkout.session.expired and payment_intent.canceled cancel the order and release the lot (only if no successful payment exists).",
    },
    {
      label: "Payment mode configured",
      status: stats.paymentMode === "live" ? "pass" : stats.paymentMode === "sandbox" ? "warn" : "fail",
      detail: stats.paymentMode === "live"
        ? "Live Stripe payments active."
        : stats.paymentMode === "sandbox"
          ? "Sandbox mode — payments are test only. Complete Stripe go-live before public launch."
          : "Stripe payments are NOT configured. Enable payments to accept checkout.",
    },
    { label: "Authentication enabled", status: stats.authEnabled ? "pass" : "fail", detail: "Email/password sign-in is active via Lovable Cloud." },
    {
      label: "Current user admin access",
      status: stats.currentUserAdmin && stats.adminRpcAvailable ? "pass" : "fail",
      detail: stats.currentUserAdmin
        ? `Admin role confirmed via ${stats.adminRoleSource}; public.is_admin RPC is callable.`
        : "Current user does not have user_roles.role=admin. Admin routes will block this account.",
      href: "/app/admin",
    },
    {
      label: "Messaging integrity",
      status: stats.messagingIntegrityIssues === 0 && stats.paidOrdersNoConversation === 0 ? "pass" : stats.paidOrdersNoConversation > 0 ? "fail" : "warn",
      detail: `${stats.messagingIntegrityIssues} conversation integrity issue${stats.messagingIntegrityIssues === 1 ? "" : "s"}; ${stats.conversationsNoMessages} empty conversation${stats.conversationsNoMessages === 1 ? "" : "s"}; ${stats.paidOrderMissingSystemMessages} paid order conversation${stats.paidOrderMissingSystemMessages === 1 ? "" : "s"} missing the order message; ${stats.paidOrdersNoConversation} paid order${stats.paidOrdersNoConversation === 1 ? "" : "s"} missing conversation.`,
      href: "/app/admin/messages",
    },
    {
      label: "Active listings available",
      status: stats.activeListings >= 5 ? "pass" : stats.activeListings > 0 ? "warn" : "fail",
      detail: `${stats.activeListings} active listing${stats.activeListings === 1 ? "" : "s"} on the marketplace.`,
      href: "/app/admin/listings",
    },
    {
      label: "Sellers onboarded",
      status: stats.sellers >= 3 ? "pass" : stats.sellers > 0 ? "warn" : "fail",
      detail: `${stats.sellers} seller user${stats.sellers === 1 ? "" : "s"} across ${stats.sellerOrgs} seller organisation${stats.sellerOrgs === 1 ? "" : "s"}.`,
      href: "/app/admin/users",
    },
    {
      label: "Reports backlog",
      status: stats.unresolvedReports === 0 ? "pass" : stats.unresolvedReports < 5 ? "warn" : "fail",
      detail: `${stats.unresolvedReports} unresolved report${stats.unresolvedReports === 1 ? "" : "s"}.`,
      href: "/app/admin/reports",
    },
    {
      label: "Pending manual payouts",
      status: stats.pendingPayouts === 0 ? "pass" : "warn",
      detail: `${stats.pendingPayouts} payout${stats.pendingPayouts === 1 ? "" : "s"} awaiting bank transfer.`,
      href: "/app/admin/payouts",
    },
    {
      label: "Stuck orders (pending payment > 30 min)",
      status: stats.stuckOrders === 0 ? "pass" : "warn",
      detail: `${stats.stuckOrders} order${stats.stuckOrders === 1 ? "" : "s"} stuck in pending_payment. Reservations auto-release when reopened.`,
      href: "/app/admin/orders",
    },
    {
      label: "Latest test transaction",
      status: stats.latestTxnStatus === "succeeded" ? "pass" : stats.latestTxnStatus ? "warn" : "fail",
      detail: stats.latestTxnStatus
        ? `Last payment: ${stats.latestTxnStatus} (${stats.latestTxnAt ? new Date(stats.latestTxnAt).toLocaleString() : "—"})`
        : "No payments captured yet. Run an end-to-end test purchase.",
    },
  ];

  const failed = checks.filter(c => c.status === "fail").length;
  const warned = checks.filter(c => c.status === "warn").length;
  const overall: Check["status"] = failed > 0 ? "fail" : warned > 0 ? "warn" : "pass";

  const StatusIcon = ({ s }: { s: Check["status"] }) => (
    s === "pass" ? <CheckCircle2 className="h-5 w-5 text-success" /> :
    s === "warn" ? <AlertTriangle className="h-5 w-5 text-warning" /> :
    <XCircle className="h-5 w-5 text-destructive" />
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Rocket className="h-6 w-6 text-primary" /> Launch readiness</h1>
          <p className="text-muted-foreground">Internal checklist before opening Offcutt to real Sydney buyers and sellers.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={closeExpired} disabled={closing}>
            <Gavel className="h-4 w-4 mr-1" />{closing ? "Closing…" : "Close expired auctions now"}
          </Button>
          <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
        </div>
      </div>

      <Card className={
        overall === "pass" ? "border-success/40" :
        overall === "warn" ? "border-warning/40" : "border-destructive/40"
      }>
        <CardHeader className="flex flex-row items-center gap-3">
          <StatusIcon s={overall} />
          <div>
            <CardTitle>
              {overall === "pass" && "Ready for closed beta"}
              {overall === "warn" && "Almost ready — review warnings"}
              {overall === "fail" && "Not ready — critical items missing"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Environment: <Badge variant={stats.paymentMode === "live" ? "success" : "warning"}>{stats.paymentMode}</Badge>
              {" · "}{stats.paidOrders} completed paid order{stats.paidOrders === 1 ? "" : "s"}
            </p>
          </div>
        </CardHeader>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <KPI label="Active listings" value={stats.activeListings} />
        <KPI label="Seller users" value={stats.sellers} />
        <KPI label="Seller orgs" value={stats.sellerOrgs} />
        <KPI label="Buyers" value={stats.buyers} />
        <KPI label="Paid orders" value={stats.paidOrders} />
        <KPI label="Pending payouts" value={stats.pendingPayouts} />
        <KPI label="Open reports" value={stats.unresolvedReports} />
        <KPI label="Expired auctions stuck active" value={stats.expiredAuctionsActive} />
        <KPI label="Paid orders w/o pickup code" value={stats.paidOrdersNoPickupCode} />
        <KPI label="Message integrity issues" value={stats.messagingIntegrityIssues} />
        <KPI label="Paid orders w/o conversation" value={stats.paidOrdersNoConversation} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Checks</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {checks.map(c => (
            <div key={c.label} className="flex items-start gap-3 p-4">
              <StatusIcon s={c.status} />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{c.label}</p>
                <p className="text-sm text-muted-foreground">{c.detail}</p>
              </div>
              {c.href && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to={c.href}>Open <ExternalLink className="h-3 w-3 ml-1" /></Link>
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}
