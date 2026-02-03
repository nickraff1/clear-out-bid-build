import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart, Loader2, MapPin, Calendar, ExternalLink } from 'lucide-react';
import type { Order, Lot, ClearanceEvent } from '@/types/database';
import { format, parseISO } from 'date-fns';

type OrderWithDetails = Order & {
  lot: Lot;
  event: ClearanceEvent;
};

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select(`
          *,
          lot:lots(*),
          event:clearance_events(*)
        `)
        .eq('buyer_id', user!.id)
        .order('created_at', { ascending: false });

      if (data) {
        setOrders(data as OrderWithDetails[]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'warning' | 'success' | 'info' | 'destructive'> = {
      pending_payment: 'warning',
      paid: 'success',
      ready_for_pickup: 'info',
      collected: 'success',
      cancelled: 'destructive',
      disputed: 'warning'
    };
    return variants[status] ?? 'default';
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const activeStatuses = ['pending_payment', 'paid', 'ready_for_pickup'];
  const completedStatuses = ['collected', 'cancelled', 'disputed'];

  const activeOrders = orders.filter(o => activeStatuses.includes(o.status));
  const completedOrders = orders.filter(o => completedStatuses.includes(o.status));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const OrderCard = ({ order }: { order: OrderWithDetails }) => (
    <div className="dashboard-card">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Info */}
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <Link to={`/lot/${order.lot_id}`} className="font-semibold hover:text-primary">
                {order.lot.title}
              </Link>
              <Badge variant={getStatusBadge(order.status)} className="ml-2">
                {formatStatus(order.status)}
              </Badge>
            </div>
            <p className="text-lg font-bold">${order.amount.toLocaleString()}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span>{order.event.suburb}, {order.event.state}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>
                Pickup: {format(parseISO(order.event.pickup_start), 'MMM d')} - {format(parseISO(order.event.pickup_end), 'MMM d')}
              </span>
            </div>
          </div>

          {order.status === 'pending_payment' && (
            <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <p className="text-sm font-medium text-warning">Payment Required</p>
              <p className="text-xs text-muted-foreground mt-1">
                Please complete payment to confirm your order. Payment details will be sent to your email.
              </p>
            </div>
          )}

          {order.status === 'ready_for_pickup' && (
            <div className="mt-4 p-3 rounded-lg bg-info/10 border border-info/20">
              <p className="text-sm font-medium text-info">Ready for Pickup</p>
              <p className="text-xs text-muted-foreground mt-1">
                Contact: {order.event.contact_name} • {order.event.contact_phone}
              </p>
              {order.event.access_notes && (
                <p className="text-xs text-muted-foreground mt-1">{order.event.access_notes}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-4 pt-4 border-t border-border">
        <Button variant="outline" size="sm" asChild>
          <Link to={`/lot/${order.lot_id}`}>
            <ExternalLink className="h-4 w-4 mr-1" />
            View Lot
          </Link>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Orders</h1>
        <p className="text-muted-foreground">
          Manage your purchases and pickups
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="active">
            Active ({activeOrders.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedOrders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {activeOrders.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <ShoppingCart className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No active orders</h2>
              <p className="text-muted-foreground mb-4">
                Win an auction or buy items to see them here.
              </p>
              <Button asChild>
                <Link to="/marketplace">Browse Marketplace</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {activeOrders.map(order => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed">
          {completedOrders.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No completed orders yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {completedOrders.map(order => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
