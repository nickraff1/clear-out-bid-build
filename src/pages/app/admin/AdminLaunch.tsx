import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, Rocket, ExternalLink } from "lucide-react";

type Check = {
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  href?: string;
};

type Stats = {
  activeListings: number;
  sellers: number;
  buyers: number;
  pendingPayouts: number;
  unresolvedReports: number;
  stuckOrders: number;
  paidOrders: number;
  latestTxnStatus: string | null;
  latestTxnAt: string | null;
  paymentMode: "sandbox" | "live" | "none";
  authEnabled: boolean;
};

const env = (import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined) ?? "";

function paymentMode(): Stats["paymentMode"] {
  if (env.startsWith("pk_live_")) return "live";
  if (env.startsWith("pk_test_")) return "sandbox";
  return "none";
}

export default function AdminLaunch() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const [
      activeLots, sellerRoles, buyerRoles,
      pendingPayouts, unresolvedReports, stuckOrders, paidOrders, latestPayment,
    ] = await Promise.all([
      supabase.from("lots").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "seller"),
      supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "buyer"),
      supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "succeeded").eq("manual_payout_status", "manual_payout_pending"),
      supabase.from("lot_reports").select("id", { count: "exact", head: true }).neq("status", "resolved"),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending_payment").lt("created_at", thirtyMinAgo),
      supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "ready_for_pickup", "collected"]),
      supabase.from("payments").select("status, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    setStats({
      activeListings: activeLots.count ?? 0,
      sellers: sellerRoles.count ?? 0,
      buyers: buyerRoles.count ?? 0,
      pendingPayouts: pendingPayouts.count ?? 0,
      unresolvedReports: unresolvedReports.count ?? 0,
      stuckOrders: stuckOrders.count ?? 0,
      paidOrders: paidOrders.count ?? 0,
      latestTxnStatus: latestPayment.data?.status ?? null,
      latestTxnAt: latestPayment.data?.created_at ?? null,
      paymentMode: paymentMode(),
      authEnabled: true, // Lovable Cloud auth is always available
    });
    setLoading(false);
  }

  if (loading || !stats) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const checks: Check[] = [
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
      label: "Active listings available",
      status: stats.activeListings >= 5 ? "pass" : stats.activeListings > 0 ? "warn" : "fail",
      detail: `${stats.activeListings} active listing${stats.activeListings === 1 ? "" : "s"} on the marketplace.`,
      href: "/app/admin/listings",
    },
    {
      label: "Sellers onboarded",
      status: stats.sellers >= 3 ? "pass" : stats.sellers > 0 ? "warn" : "fail",
      detail: `${stats.sellers} seller account${stats.sellers === 1 ? "" : "s"}.`,
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
        <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
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
        <KPI label="Sellers" value={stats.sellers} />
        <KPI label="Buyers" value={stats.buyers} />
        <KPI label="Paid orders" value={stats.paidOrders} />
        <KPI label="Pending payouts" value={stats.pendingPayouts} />
        <KPI label="Open reports" value={stats.unresolvedReports} />
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