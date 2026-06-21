import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function AdminOrders() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('orders')
      .select('id, amount, status, created_at, lot:lots(title), buyer:profiles!orders_buyer_id_fkey(email, full_name)')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => { setRows(data ?? []); setLoading(false); });
  }, []);

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-muted-foreground">{rows.length} orders total</p>
      </div>
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lot</TableHead>
              <TableHead>Buyer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(o => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.lot?.title ?? '—'}</TableCell>
                <TableCell>{o.buyer?.full_name ?? o.buyer?.email ?? '—'}</TableCell>
                <TableCell>${Number(o.amount).toLocaleString()}</TableCell>
                <TableCell><Badge variant="muted">{o.status}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{format(parseISO(o.created_at), 'MMM d, yyyy')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}