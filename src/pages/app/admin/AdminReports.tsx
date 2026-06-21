import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export default function AdminReports() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from('lot_reports')
      .select('id, reason, details, status, created_at, lot:lots(id, title), reporter:profiles!lot_reports_reporter_id_fkey(email, full_name)')
      .order('created_at', { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resolve = async (id: string, status: 'resolved' | 'dismissed') => {
    const { error } = await supabase.from('lot_reports').update({
      status, resolved_by: user!.id, resolved_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    toast({ title: `Report ${status}` });
    load();
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Listings flagged by the community</p>
      </div>
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Listing</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Reporter</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell><Link to={`/lot/${r.lot?.id}`} className="font-medium hover:text-primary">{r.lot?.title ?? '—'}</Link></TableCell>
                <TableCell>
                  <div className="font-medium">{r.reason}</div>
                  {r.details && <div className="text-sm text-muted-foreground">{r.details}</div>}
                </TableCell>
                <TableCell>{r.reporter?.full_name ?? r.reporter?.email ?? '—'}</TableCell>
                <TableCell><Badge variant={r.status === 'open' ? 'warning' : 'muted'}>{r.status}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{format(parseISO(r.created_at), 'MMM d')}</TableCell>
                <TableCell>
                  {r.status === 'open' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => resolve(r.id, 'resolved')}>Resolve</Button>
                      <Button size="sm" variant="ghost" onClick={() => resolve(r.id, 'dismissed')}>Dismiss</Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}