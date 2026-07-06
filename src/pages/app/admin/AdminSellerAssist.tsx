import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Building2, CheckCircle2, ExternalLink, Gavel, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

type Org = {
  id: string;
  name: string;
  org_type: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  bio: string | null;
  is_verified: boolean | null;
  is_disabled: boolean | null;
};

type LotRow = {
  id: string;
  title: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  pricing_type: 'fixed' | 'auction';
  fixed_price: number | null;
  start_price: number | null;
  reserve_price: number | null;
  auction_end: string | null;
  status: string;
  bid_count: number | null;
  event_id: string;
  event?: { title: string | null; org_id: string } | null;
};

type OrderRow = {
  id: string;
  status: string;
  pickup_status: string | null;
  amount: number;
  created_at: string;
  lot?: { title: string | null } | null;
  buyer?: { full_name: string | null; email: string | null } | null;
};

type StripeAccount = {
  stripe_account_id: string | null;
  connect_readiness_status: string | null;
  charges_enabled: boolean | null;
  payouts_enabled: boolean | null;
  capability_transfers: string | null;
  disabled_reason: string | null;
  requirements_currently_due: string[] | null;
  requirements_past_due: string[] | null;
  last_synced_at: string | null;
};

type AuditLog = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const defaultListing = {
  title: '',
  description: '',
  category_id: '',
  quantity: '1',
  unit: 'each',
  condition: 'unused',
  pricing_type: 'fixed',
  fixed_price: '',
  start_price: '',
  reserve_price: '',
  auction_end: '',
  publish: false,
  admin_note: '',
};

const readinessLabel: Record<string, string> = {
  ready: 'Ready',
  payout_setup_incomplete: 'Setup incomplete',
  review_pending: 'Review pending',
  action_required: 'Action required',
  payments_paused: 'Payments paused',
  payouts_paused: 'Payouts paused',
  not_started: 'Not started',
};

const readinessVariant = (status?: string | null): 'success' | 'warning' | 'destructive' | 'muted' => {
  if (status === 'ready') return 'success';
  if (status === 'review_pending' || status === 'payout_setup_incomplete') return 'warning';
  if (status === 'not_started' || !status) return 'muted';
  return 'destructive';
};

export default function AdminSellerAssist() {
  const { sellerOrgId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [org, setOrg] = useState<Org | null>(null);
  const [lots, setLots] = useState<LotRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [stripe, setStripe] = useState<StripeAccount | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [listingForm, setListingForm] = useState(defaultListing);
  const [editingLot, setEditingLot] = useState<LotRow | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    quantity: '1',
    unit: 'each',
    fixed_price: '',
    start_price: '',
    reserve_price: '',
    auction_end: '',
    status: 'draft',
    admin_note: '',
  });

  const logAssist = async (action: string, entityType?: string, entityId?: string, metadata: Record<string, unknown> = {}) => {
    if (!sellerOrgId) return;
    const { error } = await (supabase.rpc as any)('admin_log_seller_assist', {
      _seller_org_id: sellerOrgId,
      _action: action,
      _entity_type: entityType ?? null,
      _entity_id: entityId ?? null,
      _metadata: metadata,
    });
    if (error) console.warn('admin assist audit log failed', error);
  };

  const load = async () => {
    if (!sellerOrgId) return;
    setLoading(true);
    const [{ data: orgData }, { data: catData }, { data: lotData }, { data: orderData }, { data: stripeData }, { data: logData }] = await Promise.all([
      supabase.from('organizations').select('id, name, org_type, email, phone, website, bio, is_verified, is_disabled').eq('id', sellerOrgId).maybeSingle(),
      supabase.from('categories').select('id, name').order('name'),
      supabase.from('lots').select('id, title, description, quantity, unit, pricing_type, fixed_price, start_price, reserve_price, auction_end, status, bid_count, event_id, event:clearance_events!inner(title, org_id)').eq('event.org_id', sellerOrgId).order('created_at', { ascending: false }),
      supabase.from('orders').select('id, status, pickup_status, amount, created_at, lot:lots(title), buyer:profiles!orders_buyer_id_fkey(full_name, email), event:clearance_events!inner(org_id)').eq('event.org_id', sellerOrgId).order('created_at', { ascending: false }).limit(25),
      supabase.from('seller_stripe_accounts').select('stripe_account_id, connect_readiness_status, charges_enabled, payouts_enabled, capability_transfers, disabled_reason, requirements_currently_due, requirements_past_due, last_synced_at').eq('org_id', sellerOrgId).maybeSingle(),
      supabase.from('admin_seller_assist_audit_logs').select('id, action, entity_type, entity_id, metadata, created_at').eq('seller_org_id', sellerOrgId).order('created_at', { ascending: false }).limit(25),
    ]);
    setOrg(orgData as Org | null);
    setCategories((catData ?? []) as { id: string; name: string }[]);
    setLots((lotData ?? []) as unknown as LotRow[]);
    setOrders((orderData ?? []) as unknown as OrderRow[]);
    setStripe((stripeData as StripeAccount | null) ?? null);
    setLogs((logData ?? []) as AuditLog[]);
    setLoading(false);
  };

  useEffect(() => {
    void load().then(() => logAssist('enter_assist_mode', 'organization', sellerOrgId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerOrgId]);

  const checklist = useMemo(() => {
    const due = [...(stripe?.requirements_past_due ?? []), ...(stripe?.requirements_currently_due ?? [])];
    return [
      { label: 'Organisation selected', ok: Boolean(org) },
      { label: 'Has listings', ok: lots.length > 0 },
      { label: 'Stripe account connected', ok: Boolean(stripe?.stripe_account_id) },
      { label: 'Payout ready', ok: stripe?.connect_readiness_status === 'ready' },
      { label: 'No Stripe requirements due', ok: due.length === 0 },
      { label: 'Has active orders', ok: orders.some((o) => ['paid', 'ready_for_pickup', 'collected'].includes(o.status)) },
    ];
  }, [org, lots, orders, stripe]);

  const createListing = async () => {
    if (!sellerOrgId) return;
    setSaving(true);
    const { data, error } = await (supabase.rpc as any)('admin_create_assisted_listing', {
      _seller_org_id: sellerOrgId,
      _title: listingForm.title,
      _description: listingForm.description || null,
      _category_id: listingForm.category_id || null,
      _quantity: Number(listingForm.quantity),
      _unit: listingForm.unit,
      _condition: listingForm.condition,
      _pricing_type: listingForm.pricing_type,
      _fixed_price: listingForm.fixed_price ? Number(listingForm.fixed_price) : null,
      _start_price: listingForm.start_price ? Number(listingForm.start_price) : null,
      _reserve_price: listingForm.reserve_price ? Number(listingForm.reserve_price) : null,
      _auction_end: listingForm.auction_end ? new Date(listingForm.auction_end).toISOString() : null,
      _publish: listingForm.publish,
      _admin_note: listingForm.admin_note || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Assisted listing created');
    setListingForm(defaultListing);
    await load();
    if (data) navigate(`/lot/${data}`);
  };

  const openEdit = (lot: LotRow) => {
    setEditingLot(lot);
    setEditForm({
      title: lot.title,
      description: lot.description ?? '',
      quantity: String(lot.quantity ?? 1),
      unit: lot.unit ?? 'each',
      fixed_price: lot.fixed_price ? String(lot.fixed_price) : '',
      start_price: lot.start_price ? String(lot.start_price) : '',
      reserve_price: lot.reserve_price ? String(lot.reserve_price) : '',
      auction_end: lot.auction_end ? lot.auction_end.slice(0, 16) : '',
      status: lot.status,
      admin_note: '',
    });
  };

  const updateListing = async () => {
    if (!sellerOrgId || !editingLot) return;
    setSaving(true);
    const { error } = await (supabase.rpc as any)('admin_update_assisted_listing', {
      _seller_org_id: sellerOrgId,
      _lot_id: editingLot.id,
      _title: editForm.title,
      _description: editForm.description || null,
      _quantity: Number(editForm.quantity),
      _unit: editForm.unit,
      _fixed_price: editForm.fixed_price ? Number(editForm.fixed_price) : null,
      _start_price: editForm.start_price ? Number(editForm.start_price) : null,
      _reserve_price: editForm.reserve_price ? Number(editForm.reserve_price) : null,
      _auction_end: editForm.auction_end ? new Date(editForm.auction_end).toISOString() : null,
      _status: editForm.status,
      _admin_note: editForm.admin_note || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Listing updated');
    setEditingLot(null);
    await load();
  };

  const refreshStripe = async () => {
    if (!sellerOrgId) return;
    const { data, error } = await supabase.functions.invoke('stripe-connect-refresh', { body: { org_id: sellerOrgId } });
    if (error || data?.error) return toast.error(error?.message || data?.error || 'Could not refresh Stripe status');
    await logAssist('refresh_stripe_connect', 'seller_stripe_account', undefined, { refreshed: true });
    toast.success('Stripe status refreshed');
    await load();
  };

  const openOnboarding = async () => {
    if (!sellerOrgId) return;
    if (!stripe?.stripe_account_id) {
      toast.error('Ask the seller to start payout setup first, or refresh Stripe status to reattach an existing account.');
      return;
    }
    const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', {
      body: { org_id: sellerOrgId, return_url: window.location.href },
    });
    if (error || data?.error || !data?.url) return toast.error(error?.message || data?.error || 'Could not create onboarding link');
    await navigator.clipboard?.writeText(data.url as string).catch(() => undefined);
    await logAssist('generate_stripe_onboarding_link', 'seller_stripe_account', undefined, { account_id: data.account_id ?? null });
    window.open(data.url as string, '_blank', 'noopener,noreferrer');
    toast.success('Stripe onboarding link opened and copied');
    await load();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!org) {
    return (
      <div className="p-6">
        <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Seller not found</AlertTitle><AlertDescription>This seller organisation could not be loaded.</AlertDescription></Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Alert className="border-warning/50 bg-warning/10">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Admin assist mode</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>You are acting on behalf of {org.name}. Actions are admin-authorised and audit logged.</span>
          <Button variant="outline" size="sm" onClick={() => navigate('/app/admin/sellers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />Exit assist mode
          </Button>
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="text-muted-foreground">Seller organisation assist workspace</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshStripe}><RefreshCw className="h-4 w-4 mr-2" />Refresh Stripe</Button>
          <Button variant="outline" onClick={openOnboarding}><ExternalLink className="h-4 w-4 mr-2" />Stripe link</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Seller details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Email: {org.email ?? 'Not set'}</div>
            <div>Phone: {org.phone ?? 'Not set'}</div>
            <div>Website: {org.website ?? 'Not set'}</div>
            <div>Status: {org.is_disabled ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="success">Active</Badge>}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Payout readiness</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Badge variant={readinessVariant(stripe?.connect_readiness_status)}>
              {readinessLabel[stripe?.connect_readiness_status ?? 'not_started'] ?? 'Unknown'}
            </Badge>
            <div>Account: {stripe?.stripe_account_id ?? 'Not connected'}</div>
            <div>Charges: {stripe?.charges_enabled ? 'Enabled' : 'Not enabled'}</div>
            <div>Payouts: {stripe?.payouts_enabled ? 'Enabled' : 'Not enabled'}</div>
            {stripe?.disabled_reason && <div className="text-destructive">{stripe.disabled_reason}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Setup checklist</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {checklist.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className={item.ok ? 'h-4 w-4 text-success' : 'h-4 w-4 text-muted-foreground'} />
                <span>{item.label}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create assisted listing</CardTitle>
          <CardDescription>Creates a listing under this seller organisation. Photos can be added later through the seller flow.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><Label>Title</Label><Input value={listingForm.title} onChange={(e) => setListingForm({ ...listingForm, title: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Description</Label><Textarea value={listingForm.description} onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })} /></div>
          <div><Label>Category</Label><Select value={listingForm.category_id} onValueChange={(v) => setListingForm({ ...listingForm, category_id: v })}><SelectTrigger><SelectValue placeholder="Optional category" /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Pricing</Label><Select value={listingForm.pricing_type} onValueChange={(v) => setListingForm({ ...listingForm, pricing_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Fixed</SelectItem><SelectItem value="auction">Auction</SelectItem></SelectContent></Select></div>
          <div><Label>Quantity</Label><Input type="number" value={listingForm.quantity} onChange={(e) => setListingForm({ ...listingForm, quantity: e.target.value })} /></div>
          <div><Label>Unit</Label><Input value={listingForm.unit} onChange={(e) => setListingForm({ ...listingForm, unit: e.target.value })} /></div>
          {listingForm.pricing_type === 'fixed' ? (
            <div><Label>Fixed price</Label><Input type="number" value={listingForm.fixed_price} onChange={(e) => setListingForm({ ...listingForm, fixed_price: e.target.value })} /></div>
          ) : (
            <>
              <div><Label>Start price</Label><Input type="number" value={listingForm.start_price} onChange={(e) => setListingForm({ ...listingForm, start_price: e.target.value })} /></div>
              <div><Label>Reserve price</Label><Input type="number" value={listingForm.reserve_price} onChange={(e) => setListingForm({ ...listingForm, reserve_price: e.target.value })} /></div>
              <div><Label>Auction end</Label><Input type="datetime-local" value={listingForm.auction_end} onChange={(e) => setListingForm({ ...listingForm, auction_end: e.target.value })} /></div>
            </>
          )}
          <div className="md:col-span-2"><Label>Admin note</Label><Input value={listingForm.admin_note} onChange={(e) => setListingForm({ ...listingForm, admin_note: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={listingForm.publish} onCheckedChange={(v) => setListingForm({ ...listingForm, publish: Boolean(v) })} /> Publish immediately</label>
          <div className="md:col-span-2"><Button onClick={createListing} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create listing</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Listings</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Price</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {lots.map((lot) => (
                <TableRow key={lot.id}>
                  <TableCell><Link className="font-medium hover:text-primary" to={`/lot/${lot.id}`}>{lot.title}</Link></TableCell>
                  <TableCell>{lot.pricing_type === 'auction' ? <Badge variant="auction"><Gavel className="h-3 w-3 mr-1" />Auction</Badge> : <Badge variant="fixed">Fixed</Badge>}</TableCell>
                  <TableCell>${Number(lot.pricing_type === 'auction' ? lot.start_price ?? 0 : lot.fixed_price ?? 0).toFixed(2)}</TableCell>
                  <TableCell><Badge variant={lot.status === 'active' ? 'success' : lot.status === 'sold' ? 'success' : lot.status === 'draft' ? 'muted' : 'warning'}>{lot.status}</Badge></TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => openEdit(lot)}>Edit</Button></TableCell>
                </TableRow>
              ))}
              {lots.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No listings yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent orders</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Lot</TableHead><TableHead>Buyer</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>{order.lot?.title ?? 'Unknown'}</TableCell>
                  <TableCell>{order.buyer?.full_name ?? order.buyer?.email ?? 'Unknown'}</TableCell>
                  <TableCell>${Number(order.amount).toFixed(2)}</TableCell>
                  <TableCell><Badge variant="outline">{order.status}</Badge></TableCell>
                  <TableCell>{format(parseISO(order.created_at), 'MMM d, yyyy')}</TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No orders yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Assist audit trail</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="rounded-md border p-3 text-sm">
              <div className="font-medium">{log.action}</div>
              <div className="text-muted-foreground">{format(parseISO(log.created_at), 'MMM d, yyyy h:mm a')} {log.entity_type ? `· ${log.entity_type}` : ''}</div>
            </div>
          ))}
          {logs.length === 0 && <p className="text-sm text-muted-foreground">No audit events yet.</p>}
        </CardContent>
      </Card>

      <Dialog open={!!editingLot} onOpenChange={(open) => !open && setEditingLot(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit assisted listing</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Title</Label><Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Quantity</Label><Input type="number" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} /></div>
              <div><Label>Unit</Label><Input value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} /></div>
            </div>
            {editingLot?.pricing_type === 'fixed' ? (
              <div><Label>Fixed price</Label><Input type="number" value={editForm.fixed_price} onChange={(e) => setEditForm({ ...editForm, fixed_price: e.target.value })} /></div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <div><Label>Start price</Label><Input type="number" value={editForm.start_price} onChange={(e) => setEditForm({ ...editForm, start_price: e.target.value })} /></div>
                <div><Label>Reserve</Label><Input type="number" value={editForm.reserve_price} onChange={(e) => setEditForm({ ...editForm, reserve_price: e.target.value })} /></div>
                <div><Label>Auction end</Label><Input type="datetime-local" value={editForm.auction_end} onChange={(e) => setEditForm({ ...editForm, auction_end: e.target.value })} /></div>
              </div>
            )}
            <div><Label>Status</Label><Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem><SelectItem value="unsold">Unsold</SelectItem></SelectContent></Select></div>
            <div><Label>Admin note</Label><Input value={editForm.admin_note} onChange={(e) => setEditForm({ ...editForm, admin_note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLot(null)}>Cancel</Button>
            <Button onClick={updateListing} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
