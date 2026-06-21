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
import { Loader2, Truck } from 'lucide-react';
import type { Order, Lot, ClearanceEvent, Profile } from '@/types/database';
import { format, parseISO } from 'date-fns';

type OrderWithDetails = Order & {
  lot: Lot;
  event: ClearanceEvent;
  buyer: Profile;
};

export default function SellerPickups() {
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
          .in('status', ['paid', 'ready_for_pickup', 'collected'])
          .order('created_at', { ascending: false });

        if (data) {
          setOrders(data as OrderWithDetails[]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'success' | 'info' | 'warning' | 'muted'> = {
      paid: 'success',
      ready_for_pickup: 'info',
      collected: 'muted',
    };
    return colors[status] ?? 'muted';
  };

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
      <div>
        <h1 className="text-2xl font-bold">Pickup Schedule</h1>
        <p className="text-muted-foreground">Manage buyer pickups for your events</p>
      </div>

      {/* Pickups Table */}
      {orders.length === 0 ? (
        <div className="text-center py-16 dashboard-card">
          <Truck className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No pickups scheduled</h3>
          <p className="text-muted-foreground mb-4">
            Pickups will appear here when buyers purchase your lots
          </p>
        </div>
      ) : (
        <div className="dashboard-card p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lot</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Action</TableHead>
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
                  <TableCell>
                    {order.buyer?.full_name ?? 'Unknown'}
                    {order.buyer?.phone && (
                      <p className="text-sm text-muted-foreground">{order.buyer.phone}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {order.event?.title}
                  </TableCell>
                  <TableCell className="font-medium">
                    ${order.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(order.status)}>
                      {order.status === 'ready_for_pickup'
                        ? 'Ready'
                        : order.status === 'collected'
                        ? 'Collected'
                        : order.status === 'paid'
                        ? 'Paid'
                        : order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/app/orders/${order.id}`}>Manage</Link>
                    </Button>
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
