import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, MoreVertical, Award, BadgeCheck, Ban, ShieldCheck, Search, Building2 } from 'lucide-react';
import { EmptyState } from '@/components/app/EmptyState';
import { toast } from 'sonner';

export default function AdminSellers() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    const [{ data: orgList }, { data: events }, { data: lots }, { data: orders }, { data: payments }, { data: reports }] = await Promise.all([
      supabase.from('organizations').select('id, name, org_type, is_verified, is_founding, is_disabled, rating_avg, rating_count, created_at').order('created_at', { ascending: false }),
      supabase.from('clearance_events').select('id, org_id'),
      supabase.from('lots').select('id, event_id, status'),
      supabase.from('orders').select('id, event_id, status, amount'),
      supabase.from('payments').select('order_id, status, manual_payout_status, seller_payout'),
      supabase.from('lot_reports').select('id, lot_id, status'),
    ]);
    const eventOrg = new Map((events ?? []).map((e:any) => [e.id, e.org_id]));
    const lotOrg = new Map((lots ?? []).map((l:any) => [l.id, eventOrg.get(l.event_id)]));
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
      };
    });
    setOrgs(enriched);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const act = async (rpc: string, args: any, label: string) => {
    const { error } = await (supabase.rpc as any)(rpc, args);
    if (error) return toast.error(error.message);
    toast.success(label);
    load();
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
            <TableHead>Open issues</TableHead>
            <TableHead>Badges</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map(o => (
              <TableRow key={o.id} className={o.is_disabled ? 'opacity-60' : ''}>
                <TableCell className="font-medium">{o.name}</TableCell>
                <TableCell className="text-muted-foreground">{o.org_type}</TableCell>
                <TableCell>{o.active_lots}</TableCell>
                <TableCell>{o.sold_lots}</TableCell>
                <TableCell>${o.gmv.toFixed(2)}</TableCell>
                <TableCell>{o.pending_payout > 0 ? <Badge variant="warning">${o.pending_payout.toFixed(2)}</Badge> : '—'}</TableCell>
                <TableCell>{o.open_reports > 0 ? <Badge variant="destructive">{o.open_reports}</Badge> : '—'}</TableCell>
                <TableCell className="space-x-1">
                  {o.is_verified && <Badge variant="success" className="text-[10px]"><ShieldCheck className="h-3 w-3 mr-1" />verified</Badge>}
                  {o.is_founding && <Badge variant="warning" className="text-[10px]"><Award className="h-3 w-3 mr-1" />founding</Badge>}
                  {o.is_disabled && <Badge variant="destructive" className="text-[10px]">suspended</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => act('admin_set_org_verified', { _org_id: o.id, _verified: !o.is_verified }, o.is_verified ? 'Unverified' : 'Verified')}>
                        <BadgeCheck className="h-4 w-4 mr-2" />{o.is_verified ? 'Remove verification' : 'Verify seller'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => act('admin_set_org_founding', { _org_id: o.id, _founding: !o.is_founding }, o.is_founding ? 'Badge removed' : 'Founding badge added')}>
                        <Award className="h-4 w-4 mr-2" />{o.is_founding ? 'Remove founding badge' : 'Add founding badge'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => act('admin_set_org_disabled', { _org_id: o.id, _disabled: !o.is_disabled }, o.is_disabled ? 'Unsuspended' : 'Suspended')}>
                        <Ban className="h-4 w-4 mr-2" />{o.is_disabled ? 'Unsuspend' : 'Suspend seller'}
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