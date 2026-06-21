import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Search, Package } from 'lucide-react';
import { EmptyState } from '@/components/app/EmptyState';
import { toast } from '@/hooks/use-toast';

export default function AdminListings() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase
      .from('lots')
      .select('id, title, status, pricing_type, fixed_price, current_bid, start_price, created_at, event:clearance_events(organization:organizations(name))')
      .order('created_at', { ascending: false })
      .limit(500);
    setRows(data ?? []);
    setLoading(false);
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('lots').update({ status: status as any }).eq('id', id);
    if (error) return toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Listing updated' });
    load();
  };

  const filtered = rows.filter(r => r.title.toLowerCase().includes(q.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">All listings</h1>
        <p className="text-muted-foreground">Moderate marketplace listings</p>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search listings" value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={rows.length === 0 ? 'No listings yet' : 'No matching listings'}
          description={
            rows.length === 0
              ? 'Listings will appear here as soon as sellers publish them.'
              : 'Try a different search term.'
          }
        />
      ) : (
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Seller</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link to={`/lot/${r.id}`} className="font-medium hover:text-primary">{r.title}</Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.event?.organization?.name ?? '—'}</TableCell>
                <TableCell><Badge variant={r.pricing_type === 'auction' ? 'auction' : 'fixed'}>{r.pricing_type === 'auction' ? 'Auction' : 'Buy now'}</Badge></TableCell>
                <TableCell>${(r.fixed_price ?? r.current_bid ?? r.start_price ?? 0).toLocaleString()}</TableCell>
                <TableCell><Badge variant="muted">{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</Badge></TableCell>
                <TableCell>
                  {r.status !== 'cancelled' ? (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setStatus(r.id, 'cancelled')}>
                      Take down
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, 'draft')}>Restore</Button>
                  )}
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