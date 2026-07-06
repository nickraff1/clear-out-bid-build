import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, MoreVertical, Award, BadgeCheck, Ban, ShieldCheck, Search, Building2, RefreshCw, ExternalLink, UserCog } from 'lucide-react';
import { EmptyState } from '@/components/app/EmptyState';
import { toast } from 'sonner';

const normalizeSellerName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\b(pty|ltd|limited|business|account|company|co)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const sellerRowScore = (org: any) =>
  (org.active_lots ?? 0) * 20 +
  (org.sold_lots ?? 0) * 30 +
  (org.open_reports ?? 0) * 10 +
  (org.pending_payout ?? 0) +
  (org.connect?.stripe_account_id ? 25 : 0) +
  (org.is_verified ? 10 : 0) +
  (org.is_founding ? 5 : 0) -
  (org.is_disabled ? 100 : 0);

const dedupeSellerOrgs = (orgs: any[]) => {
  const grouped = new Map<string, any[]>();

  for (const org of orgs) {
    const key = normalizeSellerName(org.name) || org.id;
    grouped.set(key, [...(grouped.get(key) ?? []), org]);
  }

  return Array.from(grouped.values())
    .map(group => {
      const sorted = [...group].sort((a, b) => {
        const scoreDiff = sellerRowScore(b) - sellerRowScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      });
      return {
        ...sorted[0],
        _duplicateCount: group.length,
        _duplicateOrgIds: sorted.slice(1).map(org => org.id),
      };
    })
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
};

export default function AdminSellers() {
  const navigate = useNavigate();
  const { startAdminSellerAssist } = useAuth();
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    const [{ data: orgList }, { data: events }, { data: lots }, { data: orders }, { data: payments }, { data: reports }, { data: connectAccounts }] = await Promise.all([
      supabase.from('organizations').select('id, name, org_type, is_verified, is_founding, is_disabled, rating_avg, rating_count, created_at').in('org_type', ['seller', 'fabricator']).order('created_at', { ascending: false }),
      supabase.from('clearance_events').select('id, org_id'),
      supabase.from('lots').select('id, event_id, status'),
      supabase.from('orders').select('id, event_id, status, amount'),
      supabase.from('payments').select('order_id, status, manual_payout_status, seller_payout'),
      supabase.from('lot_reports').select('id, lot_id, status'),
      supabase.from('seller_stripe_accounts').select(`
        org_id, stripe_account_id, connect_readiness_status, charges_enabled,
        payouts_enabled, capability_transfers, disabled_reason,
        requirements_currently_due, requirements_past_due, last_synced_at
      `),
    ]);
    const eventOrg = new Map((events ?? []).map((e:any) => [e.id, e.org_id]));
    const lotOrg = new Map((lots ?? []).map((l:any) => [l.id, eventOrg.get(l.event_id)]));
    const connectByOrg = new Map((connectAccounts ?? []).map((a:any) => [a.org_id, a]));
    const enriched = (orgList ?? []).map((o:any) => {
      const orgLots = (lots ?? []).filter((l:any) => eventOrg.get(l.event_id) === o.id);
      const orgOrders = (orders ?? []).filter((ord:any) => eventOrg.get(ord.event_id) === o.id);
      const ordIds = new Set(orgOrders.map((x:any) => x.id));
      const orgPays = (payments ?? []).filter((p:any) => ordIds.has(p.order_id) && p.status === 'succeeded');
      const gmv = orgOrders.filter((x:any) => ['paid','ready_for_pickup','collected'].includes(x.status)).reduce((s:number,x:any) => s + Number(x.amount||0), 0);
      const pendingPayout = orgPays.filter((p:any) => p.manual_payout_status === 'manual_payout_pending').reduce((s:number,p:any) => s + Number(p.seller_payout||0), 0);
      const rep = (reports ?? []).filter((r:any) => lotOrg.get(r.lot_id) === o.id && (r.status === 'open' || r.status === 'investigating')).length;
      return {
        ...o,
        active_lots: orgLots.filter((l:any) => l.status === 'active').length,
        sold_lots: orgLots.filter((l:any) => l.status === 'sold').length,
        gmv, pending_payout: pendingPayout, open_reports: rep,
        connect: connectByOrg.get(o.id) ?? null,
      };
    });
    setOrgs(dedupeSellerOrgs(enriched));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const act = async (rpc: string, args: any, label: string) => {
    const { error } = await (supabase.rpc as any)(rpc, args);
    if (error) return toast.error(error.message);
    toast.success(label);
    load();
  };

  const assistSeller = async (orgId: string) => {
    const { error } = await startAdminSellerAssist(orgId);
    if (error) return toast.error(error.message);
    toast.success('Admin assist mode started');
    navigate('/app/seller/overview');
  };

  const refreshStripe = async (orgId: string) => {
    const { data, error } = await supabase.functions.invoke('stripe-connect-refresh', {
      body: { org_id: orgId },
    });
    if (error || data?.error) return toast.error(error?.message || data?.error || 'Could not refresh Stripe status');
    await (supabase.rpc as any)('admin_log_seller_assist', {
      _seller_org_id: orgId,
      _action: 'refresh_stripe_connect',
      _entity_type: 'seller_stripe_account',
      _entity_id: null,
      _metadata: { source: 'admin_sellers_table' },
      _target_user_id: null,
    });
    toast.success('Stripe status refreshed');
    load();
  };

  const sendOnboarding = async (orgId: string, hasStripeAccount: boolean) => {
    if (!hasStripeAccount) {
      toast.error('Ask this seller to start payout setup from their seller portal first.');
      return;
    }
    const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', {
      body: { org_id: orgId, return_url: window.location.href },
    });
    if (error || data?.error || !data?.url) return toast.error(error?.message || data?.error || 'Could not create onboarding link');
    await navigator.clipboard?.writeText(data.url as string).catch(() => undefined);
    await (supabase.rpc as any)('admin_log_seller_assist', {
      _seller_org_id: orgId,
      _action: 'generate_stripe_onboarding_link',
      _entity_type: 'seller_stripe_account',
      _entity_id: null,
      _metadata: { source: 'admin_sellers_table', account_id: data.account_id ?? null },
      _target_user_id: null,
    });
    window.open(data.url as string, '_blank', 'noopener,noreferrer');
    toast.success('Stripe onboarding link opened and copied');
    load();
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

  const connectReason = (connect: any) => {
    if (!connect?.stripe_account_id) return 'No connected account';
    if (connect.connect_readiness_status === 'ready') return 'Transfers active';
    if (connect.disabled_reason) return connect.disabled_reason;
    const pastDue = connect.requirements_past_due ?? [];
    if (pastDue.length) return `${pastDue.length} past-due requirement${pastDue.length === 1 ? '' : 's'}`;
    const due = connect.requirements_currently_due ?? [];
    if (due.length) return `${due.length} requirement${due.length === 1 ? '' : 's'} due`;
    if (!connect.payouts_enabled) return 'Payouts not enabled';
    if (connect.capability_transfers !== 'active') return 'Transfers not active';
    return 'Check Stripe';
  };

  const filtered = orgs.filter(o => !q || o.name.toLowerCase().includes(q.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Sellers</h1>
        <p className="text-muted-foreground">{filtered.length} of {orgs.length} organisations</p>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search organisation" value={q} onChange={e=>setQ(e.target.value)} />
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={orgs.length === 0 ? 'No seller organisations yet' : 'No matching organisations'}
          description={orgs.length === 0 ? 'Sellers will appear here when they create a business profile.' : 'Try a different search term.'}
        />
      ) : (
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Organisation</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>Sold</TableHead>
            <TableHead>GMV</TableHead>
            <TableHead>Pending payout</TableHead>
            <TableHead>Stripe Connect</TableHead>
            <TableHead>Open issues</TableHead>
            <TableHead>Badges</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map(o => (
              <TableRow
                key={o.id}
                className={`${o.is_disabled ? 'opacity-60' : ''} cursor-pointer`}
                onClick={() => assistSeller(o.id)}
              >
                <TableCell className="font-medium">
                  <button
                    type="button"
                    className="text-left hover:text-primary transition-colors"
                    onClick={(event) => {
                      event.stopPropagation();
                      assistSeller(o.id);
                    }}
                  >
                    {o.name}
                  </button>
                  {o._duplicateCount > 1 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {o._duplicateCount - 1} duplicate seller org{o._duplicateCount === 2 ? '' : 's'} hidden
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{o.org_type}</TableCell>
                <TableCell>{o.active_lots}</TableCell>
                <TableCell>{o.sold_lots}</TableCell>
                <TableCell>${o.gmv.toFixed(2)}</TableCell>
                <TableCell>{o.pending_payout > 0 ? <Badge variant="warning">${o.pending_payout.toFixed(2)}</Badge> : '—'}</TableCell>
                <TableCell>
                  <div className="space-y-1 min-w-[170px]">
                    <Badge variant={readinessVariant(o.connect?.connect_readiness_status)} className="text-[10px]">
                      {readinessLabel[o.connect?.connect_readiness_status ?? 'not_started'] ?? 'Unknown'}
                    </Badge>
                    <div className="text-xs text-muted-foreground">{connectReason(o.connect)}</div>
                  </div>
                </TableCell>
                <TableCell>{o.open_reports > 0 ? <Badge variant="destructive">{o.open_reports}</Badge> : '—'}</TableCell>
                <TableCell className="space-x-1">
                  {o.is_verified && <Badge variant="success" className="text-[10px]"><ShieldCheck className="h-3 w-3 mr-1" />verified</Badge>}
                  {o.is_founding && <Badge variant="warning" className="text-[10px]"><Award className="h-3 w-3 mr-1" />founding</Badge>}
                  {o.is_disabled && <Badge variant="destructive" className="text-[10px]">suspended</Badge>}
                </TableCell>
                <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => act('admin_set_org_verified', { _org_id: o.id, _verified: !o.is_verified }, o.is_verified ? 'Unverified' : 'Verified')}>
                        <BadgeCheck className="h-4 w-4 mr-2" />{o.is_verified ? 'Remove verification' : 'Verify seller'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => assistSeller(o.id)}>
                        <UserCog className="h-4 w-4 mr-2" />Assist seller
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => act('admin_set_org_founding', { _org_id: o.id, _founding: !o.is_founding }, o.is_founding ? 'Badge removed' : 'Founding badge added')}>
                        <Award className="h-4 w-4 mr-2" />{o.is_founding ? 'Remove founding badge' : 'Add founding badge'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => act('admin_set_org_disabled', { _org_id: o.id, _disabled: !o.is_disabled }, o.is_disabled ? 'Unsuspended' : 'Suspended')}>
                        <Ban className="h-4 w-4 mr-2" />{o.is_disabled ? 'Unsuspend' : 'Suspend seller'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => refreshStripe(o.id)}>
                        <RefreshCw className="h-4 w-4 mr-2" />Refresh Stripe status
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => sendOnboarding(o.id, Boolean(o.connect?.stripe_account_id))}>
                        <ExternalLink className="h-4 w-4 mr-2" />Open onboarding link
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      )}
    </div>
  );
}
