import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from '@/hooks/use-toast';

export default function AdminReports() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusF, setStatusF] = useState('all');

  const load = async () => {
    const { data } = await supabase
      .from('lot_reports')
      .select('id, reason, details, status, created_at, order_id, lot:lots(id, title, status), reporter:profiles!lot_reports_reporter_id_fkey(email, full_name)')
      .order('created_at', { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string, withNote = false) => {
    let note: string | null = null;
    if (withNote) {
      note = window.prompt('Add internal note (optional):') ?? null;
    }
    const { error } = await (supabase.rpc as any)('admin_resolve_report', { _report_id: id, _status: status, _note: note });
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    toast({ title: `Report ${status}` });
    load();
  };

  const suspendListing = async (lotId: string) => {
    if (!window.confirm('Suspend this listing? It will be removed from the public marketplace.')) return;
    const { error } = await supabase.from('lots').update({ status: 'paused' }).eq('id', lotId);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Listing suspended' });
    load();
  };

  const filtered = useMemo(() => statusF === 'all' ? rows : rows.filter(r => r.status === statusF), [rows, statusF]);

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports & issues</h1>
          <p className="text-muted-foreground">{filtered.length} of {rows.length} reports</p>
        </div>
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {['all','open','investigating','resolved','dismissed'].map(s =>
              <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Listing</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Reporter</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell><Link to={`/lot/${r.lot?.id}`} className="font-medium hover:text-primary">{r.lot?.title ?? '—'}</Link></TableCell>
                <TableCell>
                  <div className="font-medium">{r.reason}</div>
                  {r.details && <div className="text-sm text-muted-foreground">{r.details}</div>}
                </TableCell>
                <TableCell>{r.reporter?.full_name ?? r.reporter?.email ?? '—'}</TableCell>
                <TableCell>
                  {r.order_id ? <Link to={`/app/orders/${r.order_id}`} className="text-primary text-sm hover:underline">{r.order_id.slice(0,8)}</Link> : '—'}
                </TableCell>
                <TableCell><Badge variant={r.status === 'open' ? 'warning' : r.status === 'investigating' ? 'warning' : r.status === 'resolved' ? 'success' : 'muted'}>{r.status}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{format(parseISO(r.created_at), 'MMM d')}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {r.status === 'open' && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, 'investigating', true)}>Investigate</Button>}
                    {r.status !== 'resolved' && r.status !== 'dismissed' && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, 'resolved', true)}>Resolve</Button>}
                    {r.status !== 'dismissed' && r.status !== 'resolved' && <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, 'dismissed', true)}>Dismiss</Button>}
                    {r.lot?.id && r.lot.status !== 'paused' && <Button size="sm" variant="destructive" onClick={() => suspendListing(r.lot.id)}>Suspend listing</Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}