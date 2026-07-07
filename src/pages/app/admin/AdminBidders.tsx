import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, MoreVertical, ShieldCheck, Ban, Award, Search, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Bidder = {
  user_id: string;
  status: string;
  risk_level: string;
  failed_payment_count: number;
  unpaid_auction_count: number;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
  auction_terms_accepted_at: string | null;
  restricted_reason: string | null;
  email?: string | null;
  full_name?: string | null;
};

const statusVariant: Record<string, any> = {
  verified_bidder: 'success',
  trusted_bidder: 'success',
  payment_method_added: 'info',
  auction_terms_accepted: 'info',
  email_verified: 'muted',
  unverified: 'muted',
  payment_method_required: 'warning',
  restricted: 'destructive',
  banned: 'destructive',
};

export default function AdminBidders() {
  const [rows, setRows] = useState<Bidder[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Bidder | null>(null);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [unpaidOrders, setUnpaidOrders] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [gatewayMode, setGatewayMode] = useState<string>('lovable_gateway_sandbox');
  const [recentBids, setRecentBids] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data: bv }, { data: profiles }, { data: settings }] = await Promise.all([
      supabase.from('bidder_verifications')
        .select('user_id, status, risk_level, failed_payment_count, unpaid_auction_count, payment_method_brand, payment_method_last4, auction_terms_accepted_at, restricted_reason')
        .order('failed_payment_count', { ascending: false }),
      supabase.from('profiles').select('id, email, full_name'),
      supabase.from('auction_deposit_settings').select('current_gateway_mode').eq('singleton', true).maybeSingle(),
    ]);
    const profMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    setRows((bv ?? []).map((b: any) => ({
      ...b,
      email: profMap.get(b.user_id)?.email ?? null,
      full_name: profMap.get(b.user_id)?.full_name ?? null,
    })));
    setGatewayMode(settings?.current_gateway_mode ?? 'lovable_gateway_sandbox');
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openDrawer = async (b: Bidder) => {
    setSelected(b);
    const [{ data: deps }, { data: orders }, { data: log }, { data: bids }] = await Promise.all([
      supabase.from('auction_deposits').select('*').eq('user_id', b.user_id)
        .order('created_at', { ascending: false }),
      supabase.from('orders').select('id, status, amount, lot_id, created_at')
        .eq('buyer_id', b.user_id)
        .in('status', ['cancelled', 'pending_payment']),
      supabase.from('bidder_audit_log').select('*').eq('user_id', b.user_id)
        .order('created_at', { ascending: false }).limit(20),
      supabase.from('bids')
        .select('id, amount, created_at, lot_id, lot:lots(title)')
        .eq('user_id', b.user_id)
        .order('created_at', { ascending: false })
        .limit(15),
    ]);
    setDeposits(deps ?? []);
    setUnpaidOrders(orders ?? []);
    setAuditLog(log ?? []);
    setRecentBids(bids ?? []);
  };

  const act = async (rpc: string, args: any, ok: string) => {
    const { error } = await (supabase.rpc as any)(rpc, args);
    if (error) return toast.error(error.message);
    toast.success(ok);
    load();
    if (selected) openDrawer(selected);
  };

  const sweep = async () => {
    const { data, error } = await (supabase.rpc as any)('sweep_defaulted_winners');
    if (error) return toast.error(error.message);
    const rows = data ?? [];
    const offered = rows.filter((row: any) => row.next_order_id).length;
    toast.success(`Sweep complete — ${rows.length} order(s) processed, ${offered} offered to next bidder`);
    load();
  };

  const filtered = rows
    .filter(r => statusFilter === 'all' ? true : r.status === statusFilter)
    .filter(r => !q
      || (r.email ?? '').toLowerCase().includes(q.toLowerCase())
      || (r.full_name ?? '').toLowerCase().includes(q.toLowerCase())
      || r.user_id.startsWith(q));

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Bidders &amp; Risk</h1>
          <p className="text-sm text-muted-foreground">
            Manage verification, deposits, and default behaviour.{' '}
            <Badge variant="muted" className="ml-1">Mode: {gatewayMode}</Badge>
          </p>
        </div>
        <Button variant="outline" onClick={sweep}>
          <AlertTriangle className="h-4 w-4 mr-2" /> Sweep defaulted winners
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by email, name, or ID" className="pl-8" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-border rounded-md bg-background px-3 py-2 text-sm">
            <option value="all">All statuses</option>
            <option value="verified_bidder">Verified</option>
            <option value="trusted_bidder">Trusted</option>
            <option value="payment_method_added">PM added</option>
            <option value="auction_terms_accepted">Terms accepted</option>
            <option value="payment_method_required">PM required</option>
            <option value="email_verified">Email verified</option>
            <option value="unverified">Unverified</option>
            <option value="restricted">Restricted</option>
            <option value="banned">Banned</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bidder</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Card</TableHead>
                <TableHead className="text-right">Failed pmts</TableHead>
                <TableHead className="text-right">Unpaid</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.user_id} className="cursor-pointer" onClick={() => openDrawer(r)}>
                  <TableCell>
                    <div className="font-medium">{r.full_name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{r.email ?? r.user_id.slice(0, 8)}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[r.status] ?? 'muted'}>{r.status.replace(/_/g, ' ')}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.payment_method_brand
                      ? <span className="capitalize">{r.payment_method_brand} ••{r.payment_method_last4}</span>
                      : <span className="text-muted-foreground">none</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.failed_payment_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.unpaid_auction_count}</TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => act('admin_set_bidder_status', { _user_id: r.user_id, _status: 'trusted_bidder' }, 'Marked trusted')}>
                          <Award className="h-4 w-4 mr-2" /> Mark trusted
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => act('admin_set_bidder_status', { _user_id: r.user_id, _status: 'verified_bidder' }, 'Set verified')}>
                          <ShieldCheck className="h-4 w-4 mr-2" /> Set verified
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          const reason = prompt('Restriction reason') || 'Manual restriction';
                          act('admin_set_bidder_status', { _user_id: r.user_id, _status: 'restricted', _reason: reason }, 'Restricted');
                        }}>
                          <AlertTriangle className="h-4 w-4 mr-2" /> Restrict
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          const reason = prompt('Ban reason') || 'Manual ban';
                          act('admin_set_bidder_status', { _user_id: r.user_id, _status: 'banned', _reason: reason }, 'Banned');
                        }}>
                          <Ban className="h-4 w-4 mr-2" /> Ban
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No bidders</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.full_name ?? selected.email ?? selected.user_id.slice(0, 8)}</DialogTitle>
                <DialogDescription>
                  Status: <Badge variant={statusVariant[selected.status] ?? 'muted'}>{selected.status.replace(/_/g, ' ')}</Badge>
                  {selected.restricted_reason && <span className="ml-2 text-destructive text-xs">{selected.restricted_reason}</span>}
                </DialogDescription>
              </DialogHeader>

              <section>
                <h3 className="text-sm font-semibold mb-2">Deposits &amp; default fees</h3>
                {deposits.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No deposit records.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deposits.map(d => (
                        <TableRow key={d.id}>
                          <TableCell className="text-xs">{d.purpose}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{d.status}</Badge></TableCell>
                          <TableCell className="text-right tabular-nums">${Number(d.amount).toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => act('mark_deposit_outcome', { _deposit_id: d.id, _outcome: 'released' }, 'Released')}>Mark released</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => act('mark_deposit_outcome', { _deposit_id: d.id, _outcome: 'refunded' }, 'Refunded')}>Mark refunded</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => act('mark_deposit_outcome', { _deposit_id: d.id, _outcome: 'applied_to_order' }, 'Applied')}>Mark applied</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => act('mark_deposit_outcome', { _deposit_id: d.id, _outcome: 'forfeited' }, 'Forfeited')}>Mark forfeited</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-2 mt-4">Unpaid / cancelled orders</h3>
                {unpaidOrders.length === 0 ? (
                  <p className="text-xs text-muted-foreground">None.</p>
                ) : (
                  <ul className="text-sm space-y-1">
                    {unpaidOrders.map(o => (
                      <li key={o.id} className="flex justify-between border-b border-border pb-1">
                        <span>
                          <Badge variant="outline" className="text-[10px] mr-2">{o.status}</Badge>
                          ${Number(o.amount).toFixed(2)}
                        </span>
                        <span className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => act('offer_to_next_bidder', { _lot_id: o.lot_id }, 'Offered to runner-up')}>
                            Offer to runner-up
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => {
                            const d = prompt('New auction end (ISO, e.g. 2026-07-04T18:00:00Z)');
                            if (d) act('relist_auction', { _lot_id: o.lot_id, _new_end: d }, 'Relisted');
                          }}>Relist</Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-2 mt-4">Audit log</h3>
                {auditLog.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No actions logged.</p>
                ) : (
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    {auditLog.map(l => (
                      <li key={l.id}>
                        <span className="font-mono">{new Date(l.created_at).toLocaleString()}</span>
                        {' · '}{l.action}{l.reason ? ` — ${l.reason}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-2 mt-4">Recent bids</h3>
                {recentBids.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No bids placed.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Listing</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>When</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentBids.map((b: any) => (
                        <TableRow key={b.id}>
                          <TableCell className="text-xs">{b.lot?.title ?? b.lot_id.slice(0, 8)}</TableCell>
                          <TableCell className="text-right tabular-nums">${Number(b.amount).toFixed(0)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(b.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Remove bid"
                              onClick={() => {
                                const reason = prompt('Reason for removing this bid?');
                                if (!reason) return;
                                if (!confirm('Remove this bid? This cannot be undone.')) return;
                                act('admin_remove_bid', { _bid_id: b.id, _reason: reason }, 'Bid removed');
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </section>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
