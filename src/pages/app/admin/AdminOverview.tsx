import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2 } from 'lucide-react';

type Tone = 'green' | 'amber' | 'red' | 'muted';
const toneClass: Record<Tone, string> = {
  green: 'border-success/40',
  amber: 'border-warning/40',
  red: 'border-destructive/40',
  muted: 'border-border',
};

function Tile({ label, value, tone = 'muted', sub, to }: { label: string; value: string|number; tone?: Tone; sub?: string; to?: string }) {
  const inner = (
    <Card className={`border ${toneClass[tone]} hover:border-primary/60 transition`}>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

type LotRow = { id: string; status: string | null };
type OrderRow = {
  id: string;
  status: string | null;
  pickup_status: string | null;
  pickup_code: string | null;
  created_at: string;
  amount: number | null;
  buyer_id: string | null;
};
type PaymentRow = {
  id: string;
  status: string | null;
  manual_payout_status: string | null;
  base_amount: number | null;
  buyer_fee: number | null;
  seller_fee: number | null;
  seller_payout: number | null;
};
type ReportRow = { id: string; status: string | null };
type MemberRow = { user_id: string | null; role: string | null };
type BadgeRow = { id: string };

type OverviewStats = {
  activeLots: number;
  reservedLots: number;
  soldLots: number;
  paidPendingPickup: number;
  completedOrders: number;
  issueOrders: number;
  pendingPayouts: number;
  payoutsOnHold: number;
  failedPayments: number;
  unresolvedReports: number;
  activeSellers: number;
  activeBuyers: number;
  stuckOrders: number;
  ordersMissingPickupCode: number;
  stuckPendingPayment: number;
  messagingIntegrityIssues: number;
  foundingBadges: number;
  gmv: number;
  buyerFees: number;
  sellerFees: number;
  sellerNetTotal: number;
  payoutsPaid: number;
};

type CountOnlyQuery = {
  select: (columns: string, options: { count: 'exact'; head: true }) => {
    not: (column: string, operator: string, value: null) => Promise<{ count: number | null; error: { message?: string } | null }>;
  };
};

const fromUntyped = (table: string) => supabase.from(table as never) as unknown as CountOnlyQuery;

export default function AdminOverview() {
  const [k, setK] = useState<OverviewStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [
      lots, orders, payments, reports, stuck, members, badges, messagingIssues,
    ] = await Promise.all([
      supabase.from('lots').select('id, status'),
      supabase.from('orders').select('id, status, pickup_status, pickup_code, created_at, amount, buyer_id'),
      supabase.from('payments').select('id, status, manual_payout_status, base_amount, buyer_fee, seller_fee, seller_payout'),
      supabase.from('lot_reports').select('id, status'),
      fromUntyped('admin_stuck_orders').select('order_id', { count: 'exact', head: true }).not('stuck_reason', 'is', null),
      supabase.from('org_members').select('user_id, role'),
      supabase.from('seller_badges').select('id'),
      fromUntyped('admin_messaging_integrity').select('conversation_id', { count: 'exact', head: true }).not('issue', 'is', null),
    ]);

    const firstError = lots.error ?? orders.error ?? payments.error ?? reports.error
      ?? stuck.error ?? members.error ?? badges.error ?? messagingIssues.error;

    if (firstError) {
      setError(firstError.message ?? 'Could not load admin overview.');
      setK(null);
      return;
    }

    const L = (lots.data ?? []) as LotRow[];
    const O = (orders.data ?? []) as OrderRow[];
    const P = (payments.data ?? []) as PaymentRow[];
    const R = (reports.data ?? []) as ReportRow[];
    const M = (members.data ?? []) as MemberRow[];

    const sellerUserIds = new Set(
      M.filter((m) => ['owner', 'admin', 'member'].includes(m.role ?? '') && m.user_id)
        .map((m) => m.user_id),
    );
    const buyerUserIds = new Set(O.map((o) => o.buyer_id).filter(Boolean));
    const succeededPayments = P.filter((p) => p.status === 'succeeded');

    setK({
      activeLots: L.filter((l) => l.status === 'active').length,
      reservedLots: L.filter((l) => l.status === 'reserved').length,
      soldLots: L.filter((l) => l.status === 'sold').length,
      paidPendingPickup: O.filter((o) => ['paid', 'ready_for_pickup'].includes(o.status ?? '')).length,
      completedOrders: O.filter((o) => o.status === 'collected').length,
      issueOrders: R.filter((r) => r.status === 'open' || r.status === 'investigating').length,
      pendingPayouts: P.filter((p) => p.status === 'succeeded' && p.manual_payout_status === 'manual_payout_pending').length,
      payoutsOnHold: P.filter((p) => p.manual_payout_status === 'manual_payout_on_hold').length,
      failedPayments: P.filter((p) => ['failed', 'cancelled', 'expired'].includes(p.status ?? '')).length,
      unresolvedReports: R.filter((r) => r.status === 'open' || r.status === 'investigating').length,
      activeSellers: sellerUserIds.size,
      activeBuyers: buyerUserIds.size,
      stuckOrders: stuck.count ?? 0,
      ordersMissingPickupCode: O.filter((o) => ['paid', 'ready_for_pickup'].includes(o.status ?? '') && !o.pickup_code).length,
      stuckPendingPayment: O.filter((o) => o.status === 'pending_payment' && new Date(o.created_at).getTime() < Date.now() - 30 * 60 * 1000).length,
      messagingIntegrityIssues: messagingIssues.count ?? 0,
      foundingBadges: ((badges.data ?? []) as BadgeRow[]).length,
      gmv: succeededPayments.reduce((sum, p) => sum + Number(p.base_amount || 0), 0),
      buyerFees: succeededPayments.reduce((sum, p) => sum + Number(p.buyer_fee || 0), 0),
      sellerFees: succeededPayments.reduce((sum, p) => sum + Number(p.seller_fee || 0), 0),
      sellerNetTotal: succeededPayments.reduce((sum, p) => sum + Number(p.seller_payout || 0), 0),
      payoutsPaid: P.filter((p) => p.manual_payout_status === 'manual_payout_paid')
        .reduce((sum, p) => sum + Number(p.seller_payout || 0), 0),
    });
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Could not load admin overview</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!k) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin overview</h1>
        <p className="text-muted-foreground">Operational health of the marketplace</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Needs attention</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Tile label="Stuck orders" value={k.stuckOrders} tone={k.stuckOrders ? 'red' : 'green'} to="/app/admin/orders" />
          <Tile label="Pending payouts" value={k.pendingPayouts} tone={k.pendingPayouts ? 'amber' : 'green'} to="/app/admin/payouts" />
          <Tile label="Payouts on hold" value={k.payoutsOnHold} tone={k.payoutsOnHold ? 'red' : 'green'} to="/app/admin/payouts" />
          <Tile label="Open reports" value={k.unresolvedReports} tone={k.unresolvedReports ? 'red' : 'green'} to="/app/admin/reports" />
          <Tile label="Missing pickup code" value={k.ordersMissingPickupCode} tone={k.ordersMissingPickupCode ? 'red' : 'green'} to="/app/admin/orders" />
          <Tile label="Issue-reported orders" value={k.issueOrders} tone={k.issueOrders ? 'red' : 'green'} to="/app/admin/reports" />
          <Tile label="Stuck pending payment" value={k.stuckPendingPayment} tone={k.stuckPendingPayment ? 'amber' : 'green'} to="/app/admin/orders" />
          <Tile label="Failed payments" value={k.failedPayments} tone={k.failedPayments ? 'amber' : 'green'} to="/app/admin/payouts" />
          <Tile label="Messaging issues" value={k.messagingIntegrityIssues} tone={k.messagingIntegrityIssues ? 'red' : 'green'} to="/app/admin/messages" />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Marketplace activity</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Tile label="Active listings" value={k.activeLots} to="/app/admin/listings" />
          <Tile label="Reserved" value={k.reservedLots} to="/app/admin/listings" />
          <Tile label="Sold" value={k.soldLots} to="/app/admin/listings" />
          <Tile label="Paid pending pickup" value={k.paidPendingPickup} to="/app/admin/orders" />
          <Tile label="Completed orders" value={k.completedOrders} to="/app/admin/orders" />
          <Tile label="Active sellers" value={k.activeSellers} to="/app/admin/sellers" />
          <Tile label="Active buyers" value={k.activeBuyers} to="/app/admin/users" />
          <Tile label="Founding badges" value={k.foundingBadges} to="/app/admin/sellers" />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Money</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Tile label="GMV (gross sales)" value={`$${k.gmv.toFixed(2)}`} />
          <Tile label="Buyer fees collected" value={`$${k.buyerFees.toFixed(2)}`} />
          <Tile label="Seller fees collected" value={`$${k.sellerFees.toFixed(2)}`} />
          <Tile label="Total platform revenue" value={`$${(k.buyerFees + k.sellerFees).toFixed(2)}`} tone="green" />
          <Tile label="Total seller net" value={`$${k.sellerNetTotal.toFixed(2)}`} />
          <Tile label="Payouts paid" value={`$${k.payoutsPaid.toFixed(2)}`} tone="green" />
          <Tile label="Payouts pending" value={`$${(k.sellerNetTotal - k.payoutsPaid).toFixed(2)}`} tone={k.sellerNetTotal - k.payoutsPaid > 0 ? 'amber' : 'green'} to="/app/admin/payouts" />
        </div>
      </section>

      <Card className="p-3 bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
        <span>Payouts are manual during beta. Pay sellers off-platform, then mark them paid here.</span>
        <Badge variant="muted">Beta</Badge>
      </Card>
    </div>
  );
}
