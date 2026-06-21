import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

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

export default function AdminOverview() {
  const [k, setK] = useState<any>(null);

  useEffect(() => { (async () => {
    const [lots, orders, payments, reports, stuck, members, badges] = await Promise.all([
      supabase.from('lots').select('id, status'),
      supabase.from('orders').select('id, status, pickup_status, pickup_code, created_at, amount, buyer_id'),
      supabase.from('payments').select('id, status, manual_payout_status, base_amount, buyer_fee, seller_fee, seller_payout'),
      supabase.from('lot_reports').select('id, status'),
      (supabase as any).from('admin_stuck_orders').select('order_id, stuck_reason').not('stuck_reason','is',null),
      supabase.from('org_members').select('user_id, role'),
      supabase.from('seller_badges').select('id'),
    ]);
    const L = lots.data ?? []; const O = orders.data ?? []; const P = payments.data ?? [];
    const R = reports.data ?? []; const S = stuck.data ?? []; const M = members.data ?? [];

    const expiredAuctionBacklog = L.filter((l:any)=>l.status==='active').length; // placeholder; close-cron now active
    const sellerUserIds = new Set(M.filter((m:any)=>['owner','admin','member'].includes(m.role)).map((m:any)=>m.user_id));
    const buyerUserIds = new Set(O.map((o:any)=>o.buyer_id));

    setK({
      activeLots: L.filter((l:any)=>l.status==='active').length,
      reservedLots: L.filter((l:any)=>l.status==='reserved').length,
      soldLots: L.filter((l:any)=>l.status==='sold').length,
      paidPendingPickup: O.filter((o:any)=>['paid','ready_for_pickup'].includes(o.status)).length,
      completedOrders: O.filter((o:any)=>o.status==='collected').length,
      issueOrders: R.filter((r:any)=>r.status==='open' || r.status==='investigating').length,
      pendingPayouts: P.filter((p:any)=>p.status==='succeeded' && p.manual_payout_status==='manual_payout_pending').length,
      payoutsOnHold: P.filter((p:any)=>p.manual_payout_status==='manual_payout_on_hold').length,
      failedPayments: P.filter((p:any)=>['failed','cancelled','expired'].includes(p.status)).length,
      unresolvedReports: R.filter((r:any)=>r.status==='open' || r.status==='investigating').length,
      activeSellers: sellerUserIds.size,
      activeBuyers: buyerUserIds.size,
      stuckOrders: S.length,
      ordersMissingPickupCode: O.filter((o:any)=>['paid','ready_for_pickup'].includes(o.status) && !o.pickup_code).length,
      stuckPendingPayment: O.filter((o:any)=>o.status==='pending_payment' && new Date(o.created_at).getTime() < Date.now() - 30*60*1000).length,
      foundingBadges: (badges.data ?? []).length,
      gmv: P.filter((p:any)=>p.status==='succeeded').reduce((s:number,p:any)=>s+Number(p.base_amount||0),0),
      buyerFees: P.filter((p:any)=>p.status==='succeeded').reduce((s:number,p:any)=>s+Number(p.buyer_fee||0),0),
      sellerFees: P.filter((p:any)=>p.status==='succeeded').reduce((s:number,p:any)=>s+Number(p.seller_fee||0),0),
      sellerNetTotal: P.filter((p:any)=>p.status==='succeeded').reduce((s:number,p:any)=>s+Number(p.seller_payout||0),0),
      payoutsPaid: P.filter((p:any)=>p.manual_payout_status==='manual_payout_paid').reduce((s:number,p:any)=>s+Number(p.seller_payout||0),0),
    });
  })(); }, []);

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