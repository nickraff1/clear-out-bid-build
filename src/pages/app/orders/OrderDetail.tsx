import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  AlertCircle, ArrowLeft, Calendar, CheckCircle2, Clock, Copy,
  Loader2, Lock, MapPin, MessageCircle, Package, ShieldCheck, Truck, User,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { PickupSafetyReminder } from '@/components/safety/SafetyNotice';
import { LeaveReviewDialog } from '@/components/reviews/LeaveReviewDialog';

const REPORT_REASONS = [
  'Pickup issue',
  'Item not as described',
  'Buyer did not show',
  'Seller unavailable',
  'Payment / payout issue',
  'Other',
];

function PickupStatusBadge({ status }: { status: string }) {
  const labels: Record<string, { label: string; variant: any }> = {
    awaiting_arrangement: { label: 'Awaiting arrangement', variant: 'warning' },
    pickup_proposed: { label: 'Pickup proposed', variant: 'info' },
    pickup_confirmed: { label: 'Pickup confirmed', variant: 'info' },
    ready_for_pickup: { label: 'Ready for pickup', variant: 'success' },
    collected_pending_seller_confirmation: { label: 'Awaiting seller confirmation', variant: 'warning' },
    completed: { label: 'Completed', variant: 'success' },
    issue_reported: { label: 'Issue reported', variant: 'destructive' },
  };
  const m = labels[status] ?? { label: status, variant: 'muted' };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export default function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user, primaryOrg } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  // pickup proposal
  const [proposedAt, setProposedAt] = useState('');

  // collection confirm
  const [enteredCode, setEnteredCode] = useState('');

  // report dialog
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Pickup issue');
  const [reportDetails, setReportDetails] = useState('');

  useEffect(() => { if (orderId) load(); }, [orderId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        lot:lots(id, title, fixed_price, status, media:lot_media(url, is_primary)),
        event:clearance_events(
          id, org_id, created_by, title, site_address, suburb, state, postcode,
          pickup_start, pickup_end, access_notes, contact_name, contact_phone,
          organization:organizations(id, name)
        ),
        buyer:profiles!orders_buyer_id_fkey(id, full_name, email, phone)
      `)
      .eq('id', orderId)
      .maybeSingle();
    setOrder(data);
    if (data && user) {
      const { data: rev } = await supabase
        .from('reviews')
        .select('id')
        .eq('order_id', data.id)
        .eq('reviewer_id', user.id)
        .maybeSingle();
      setHasReviewed(!!rev);
    }
    setLoading(false);
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!order) return <div className="p-6">Order not found.</div>;

  const isBuyer = user?.id === order.buyer_id;
  const isSeller = !!primaryOrg && order.event?.org_id === primaryOrg.id;

  if (!isBuyer && !isSeller) {
    return <div className="p-6">You do not have access to this order.</div>;
  }

  const paid = ['paid', 'ready_for_pickup', 'collected'].includes(order.status);
  const completed = order.status === 'collected';

  // Pricing breakdown: amount already includes 10% buyer service fee.
  // Seller commission is 10% of the base item price.
  const total = Number(order.amount);
  const basePrice = Math.round((total / 1.10) * 100) / 100;
  const buyerFee = Math.round((total - basePrice) * 100) / 100;
  const sellerFee = Math.round(basePrice * 0.10 * 100) / 100;
  const sellerPayout = Math.round((basePrice - sellerFee) * 100) / 100;

  const primaryImage = order.lot?.media?.find((m: any) => m.is_primary)?.url ?? order.lot?.media?.[0]?.url;

  async function update(fields: Record<string, any>, successMsg: string) {
    setBusy(true);
    const { error } = await supabase.from('orders').update(fields as any).eq('id', order.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(successMsg);
    load();
  }

  async function notify(userId: string | undefined, type: string, title: string, message: string) {
    if (!userId) return;
    await supabase.from('notifications').insert({
      user_id: userId, type, title, message, data: { order_id: order.id },
    });
  }

  async function proposePickup() {
    if (!proposedAt) { toast.error('Pick a date/time'); return; }
    const when = new Date(proposedAt);
    if (when.getTime() < Date.now()) { toast.error('Pickup time must be in the future'); return; }
    await update(
      {
        proposed_pickup_at: when.toISOString(),
        proposed_pickup_by: user!.id,
        pickup_status: 'pickup_proposed',
      },
      'Pickup time proposed',
    );
  }

  async function acceptProposal() {
    await update(
      {
        agreed_pickup_at: order.proposed_pickup_at,
        pickup_status: 'pickup_confirmed',
      },
      'Pickup time confirmed',
    );
  }

  async function markReady() {
    await update(
      { status: 'ready_for_pickup', pickup_status: 'ready_for_pickup' },
      'Marked ready for pickup',
    );
    await notify(order.buyer_id, 'pickup_ready', 'Ready for pickup',
      `Your item "${order.lot?.title}" is ready for pickup.`);
  }

  async function buyerMarkCollected() {
    await update(
      {
        buyer_collected_at: new Date().toISOString(),
        pickup_status: 'collected_pending_seller_confirmation',
      },
      'Marked as collected. Awaiting seller confirmation.',
    );
  }

  async function sellerConfirmPickup() {
    if (enteredCode.trim().toUpperCase() !== (order.pickup_code ?? '').toUpperCase()) {
      toast.error('Pickup code does not match');
      return;
    }
    await update(
      {
        status: 'collected',
        pickup_status: 'completed',
        seller_confirmed_at: new Date().toISOString(),
      },
      'Pickup confirmed. Order complete.',
    );
    await notify(order.buyer_id, 'pickup_complete', 'Pickup complete',
      `Your pickup of "${order.lot?.title}" is confirmed. Please leave a review.`);
  }

  async function submitReport() {
    setBusy(true);
    const { error } = await supabase.from('lot_reports').insert({
      lot_id: order.lot_id,
      reporter_id: user!.id,
      reason: reportReason,
      details: reportDetails,
      status: 'open',
      order_id: order.id,
      reporter_role: isBuyer ? 'buyer' : 'seller',
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await update({ pickup_status: 'issue_reported' }, 'Issue reported. Admin will review.');
    setReportOpen(false);
    setReportDetails('');
  }

  async function openConversation() {
    const sellerOrgId = order.event?.org_id;
    if (!sellerOrgId) return;
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('buyer_id', order.buyer_id)
      .eq('seller_org_id', sellerOrgId)
      .eq('lot_id', order.lot_id)
      .maybeSingle();
    let id = existing?.id;
    if (!id) {
      const { data: created } = await supabase
        .from('conversations')
        .insert({
          buyer_id: order.buyer_id, seller_org_id: sellerOrgId,
          lot_id: order.lot_id, order_id: order.id,
        })
        .select('id').single();
      id = created?.id;
    }
    if (id) navigate(`/app/messages/${id}`);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 pl-0">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
          <h1 className="text-2xl font-bold">{order.lot?.title}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant={paid ? 'success' : 'warning'}>
              {order.status.replace(/_/g, ' ')}
            </Badge>
            <PickupStatusBadge status={order.pickup_status ?? 'awaiting_arrangement'} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openConversation}>
            <MessageCircle className="h-4 w-4 mr-2" />
            {isBuyer ? 'Message seller' : 'Message buyer'}
          </Button>
        </div>
      </div>

      {!paid && (
        <Alert variant="default" className="border-warning/30 bg-warning/10">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This order is awaiting payment. The pickup address is hidden until payment is confirmed.
            {isBuyer && (
              <Button size="sm" className="ml-3" asChild>
                <Link to={`/app/buyer/checkout/${order.id}`}>Pay now</Link>
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="md:col-span-2 space-y-6">
          {/* Item */}
          <div className="dashboard-card p-4 flex gap-4">
            <div className="w-28 h-28 bg-muted rounded overflow-hidden flex-shrink-0">
              {primaryImage
                ? <img src={primaryImage} alt="" className="w-full h-full object-cover" />
                : <Package className="w-full h-full p-6 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <Link to={`/lot/${order.lot_id}`} className="font-semibold hover:text-primary">
                {order.lot?.title}
              </Link>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <User className="h-3 w-3" />
                {isBuyer ? order.event?.organization?.name : (order.buyer?.full_name ?? order.buyer?.email)}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3" />
                {order.event?.suburb}, {order.event?.state}
              </p>
            </div>
          </div>

          {/* Pickup details */}
          <div className="dashboard-card p-4 space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Truck className="h-4 w-4" /> Pickup</h2>

            <PickupSafetyReminder />

            {paid ? (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Pickup address</p>
                  <p className="font-medium">{order.event?.site_address}, {order.event?.suburb} {order.event?.state} {order.event?.postcode}</p>
                </div>
                {order.event?.access_notes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Access / loading notes</p>
                    <p className="text-sm">{order.event.access_notes}</p>
                  </div>
                )}
                {order.event?.contact_name && (
                  <div className="text-sm text-muted-foreground">
                    Contact: {order.event.contact_name} {order.event.contact_phone && `· ${order.event.contact_phone}`}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Pickup address: <span className="italic">{order.event?.suburb}, {order.event?.state} — full address shown after payment</span>
              </p>
            )}

            <Separator />

            {/* Proposed / agreed time */}
            {order.agreed_pickup_at ? (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-success" />
                Agreed pickup: <strong>{format(parseISO(order.agreed_pickup_at), 'PPp')}</strong>
              </div>
            ) : order.proposed_pickup_at ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-warning" />
                  Proposed: <strong>{format(parseISO(order.proposed_pickup_at), 'PPp')}</strong>
                  {order.proposed_pickup_by === user?.id && <span className="text-muted-foreground">(by you)</span>}
                </div>
                {paid && order.proposed_pickup_by !== user?.id && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={acceptProposal} disabled={busy}>Accept proposed time</Button>
                    <Button size="sm" variant="outline" onClick={() => update({ pickup_status: 'awaiting_arrangement', proposed_pickup_at: null }, 'Proposal cleared — suggest another time')} disabled={busy}>
                      Suggest different time
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            {paid && !order.agreed_pickup_at && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Propose pickup time</label>
                <div className="flex gap-2">
                   <Input
                     type="datetime-local"
                     value={proposedAt}
                     onChange={(e) => setProposedAt(e.target.value)}
                     min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                   />
                  <Button onClick={proposePickup} disabled={busy || !proposedAt}>Propose</Button>
                </div>
              </div>
            )}
          </div>

          {/* Pickup code + collection actions */}
          {paid && (
            <div className="dashboard-card p-4 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Collection</h2>

              {isBuyer && order.pickup_code && (
                <div>
                  <p className="text-xs text-muted-foreground">Your pickup code — share with the seller on collection</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-2xl font-mono font-bold tracking-widest bg-muted px-3 py-1 rounded">{order.pickup_code}</code>
                    <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(order.pickup_code); toast.success('Code copied'); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {isBuyer && !completed && (
                <>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Inspect the item at pickup. Only mark as collected once you've received it and you're satisfied.
                    </AlertDescription>
                  </Alert>
                  <Button onClick={buyerMarkCollected} disabled={busy || order.pickup_status === 'collected_pending_seller_confirmation'}>
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Mark item collected
                  </Button>
                </>
              )}

              {isSeller && !completed && (
                <>
                  {order.status !== 'ready_for_pickup' && order.status !== 'collected' && (
                    <Button onClick={markReady} disabled={busy} variant="outline">
                      <Truck className="h-4 w-4 mr-2" /> Mark ready for pickup
                    </Button>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Enter buyer's pickup code to confirm collection</label>
                    <div className="flex gap-2">
                      <Input value={enteredCode} onChange={(e) => setEnteredCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={6} />
                      <Button onClick={sellerConfirmPickup} disabled={busy || !enteredCode}>Confirm pickup</Button>
                    </div>
                  </div>
                </>
              )}

              {completed && (
                <Alert className="border-success/30 bg-success/10">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertDescription className="flex items-center justify-between gap-3 flex-wrap">
                    <span>This order is complete.</span>
                    {!hasReviewed && (
                      <LeaveReviewDialog
                        orderId={order.id}
                        revieweeId={isBuyer ? (order.event?.created_by ?? '') : order.buyer_id}
                        revieweeOrgId={isBuyer ? order.event?.org_id : null}
                        reviewerRole={isBuyer ? 'buyer' : 'seller'}
                        triggerLabel={isBuyer ? 'Review seller' : 'Review buyer'}
                        onReviewed={() => setHasReviewed(true)}
                      />
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Report issue */}
          <Dialog open={reportOpen} onOpenChange={setReportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="text-destructive">Report an issue</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Report an issue</DialogTitle>
                <DialogDescription>Admin will review and contact both parties.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Select value={reportReason} onValueChange={setReportReason}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REPORT_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} placeholder="Describe what happened…" rows={4} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
                <Button onClick={submitReport} disabled={busy}>Submit report</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Right column - payment summary */}
        <div className="space-y-4">
          <div className="dashboard-card p-4 space-y-3">
            <h2 className="font-semibold">Payment</h2>
            {isBuyer ? (
              <>
                <Row label="Item price" value={`$${basePrice.toFixed(2)}`} />
                <Row label="Buyer service fee (10%)" value={`$${buyerFee.toFixed(2)}`} />
                <Separator />
                <Row label="Total paid" value={`$${total.toFixed(2)}`} bold />
              </>
            ) : (
              <>
                <Row label="Sold amount" value={`$${basePrice.toFixed(2)}`} />
                <Row label="Offcutt commission (10%)" value={`-$${sellerFee.toFixed(2)}`} />
                <Separator />
                <Row label="Net payout" value={`$${sellerPayout.toFixed(2)}`} bold />
                <Row label="Payout status" value="Manual — pending" />
                <p className="text-xs text-muted-foreground">Payouts are processed manually during the beta.</p>
              </>
            )}
          </div>

          {order.admin_notes && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription><strong>Admin note:</strong> {order.admin_notes}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? 'font-semibold' : ''}>{value}</span>
    </div>
  );
}