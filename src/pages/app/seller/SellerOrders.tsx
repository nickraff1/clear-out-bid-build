import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DollarSign, FileText, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/app/EmptyState';
import { orderStatusLabel, orderStatusTone } from '@/lib/order-status';
import type { Order, Lot, ClearanceEvent, Profile } from '@/types/database';
import { format, parseISO } from 'date-fns';

type OrderWithDetails = Order & {
  lot: Lot;
  event: ClearanceEvent;
  buyer: Profile;
};

export default function SellerOrders() {
  const { primaryOrg } = useAuth();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (primaryOrg) {
      fetchOrders();
    } else {
      setLoading(false);
    }
  }, [primaryOrg]);

  const fetchOrders = async () => {
    try {
      // Get events for this org first
      const { data: events } = await supabase
        .from('clearance_events')
        .select('id')
        .eq('org_id', primaryOrg!.id);

      if (events && events.length > 0) {
        const eventIds = events.map(e => e.id);
        
        const { data } = await supabase
          .from('orders')
          .select('*, lot:lots(*), event:clearance_events(*), buyer:profiles(*)')
          .in('event_id', eventIds)
          .order('created_at', { ascending: false });

        if (data) {
          setOrders(data as OrderWithDetails[]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = orderStatusTone;
  const formatStatus = orderStatusLabel;

  const totalRevenue = orders
    .filter(o => ['paid', 'ready_for_pickup', 'collected'].includes(o.status))
    .reduce((sum, o) => sum + o.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sales</h1>
          <p className="text-muted-foreground">Track orders and revenue from your lots</p>
        </div>
        <div className="dashboard-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-xl font-bold">${totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      {orders.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No sales yet"
          description="Orders will appear here when buyers purchase your listings."
        />
      ) : (
        <div className="dashboard-card p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lot</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(order => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link 
                      to={`/lot/${order.lot_id}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {order.lot?.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {order.buyer?.full_name ?? 'Unknown'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {order.event?.title}
                  </TableCell>
                  <TableCell className="font-medium">
                    ${order.amount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(parseISO(order.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(order.status)}>
                      {formatStatus(order.status)}
                    </Badge>
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
