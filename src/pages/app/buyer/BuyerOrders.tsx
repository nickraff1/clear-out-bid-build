import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/app/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowRight, CreditCard, Filter, Loader2, Search, ShoppingCart } from 'lucide-react';
import type { Order, Lot, ClearanceEvent } from '@/types/database';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { orderStatusLabel, orderStatusTone, pickupStatusLabel } from '@/lib/order-status';

type OrderWithDetails = Order & {
  lot: Lot & { event?: { org_id: string; created_by: string } };
  event: ClearanceEvent;
  has_review?: boolean;
  auction_payment_error?: string | null;
};

const money = (amount: number) => `$${amount.toFixed(2)}`;

export default function BuyerOrders() {
  const { user, organizations } = useAuth();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user, organizations]);

  const fetchOrders = async () => {
    try {
      const orgIds = (organizations ?? []).map(o => o.org_id).filter(Boolean);
      const orFilter = orgIds.length > 0
        ? `buyer_id.eq.${user!.id},buyer_org_id.in.(${orgIds.join(',')})`
        : `buyer_id.eq.${user!.id}`;
      const { data } = await supabase
        .from('orders')
        .select('*, lot:lots(*, event:clearance_events(org_id, created_by)), event:clearance_events(*)')
        .or(orFilter)
        .order('created_at', { ascending: false });

      if (data) {
        const ordersData = data as unknown as OrderWithDetails[];
        // Check existing reviews
        const orderIds = ordersData.map(o => o.id);
        if (orderIds.length > 0) {
          const { data: reviews } = await supabase
            .from('reviews')
            .select('order_id')
            .in('order_id', orderIds)
            .eq('reviewer_id', user!.id);
          const reviewed = new Set((reviews ?? []).map(r => r.order_id));
          ordersData.forEach(o => { o.has_review = reviewed.has(o.id); });
        }
        setOrders(ordersData);
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = orderStatusTone;
  const formatStatus = orderStatusLabel;

  const filteredOrders = orders.filter(order => {
    const title = order.lot?.title ?? '';
    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
        <h1 className="text-2xl font-bold">My Orders</h1>
        <p className="text-muted-foreground">Track your purchases and pickups</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending_payment">Pending Payment</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="ready_for_pickup">Ready for Pickup</SelectItem>
            <SelectItem value="collected">Collected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders Table */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={orders.length === 0 ? 'No orders yet' : 'No matching orders'}
          description={
            orders.length === 0
              ? 'When you win an auction or buy now, your order will show up here.'
              : 'Try adjusting your search or filter to see more results.'
          }
          action={
            orders.length === 0 ? (
              <Button asChild>
                <Link to="/marketplace">Browse marketplace</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Buying ({filteredOrders.length})
          </p>
          {filteredOrders.map(order => {
            const total = Number(order.amount ?? 0);
            const base = Math.round((total / 1.10) * 100) / 100;
            const fee = Math.round((total - base) * 100) / 100;
            const isAuctionOrder = order.lot?.pricing_type === 'auction';
            const auctionChargeNeedsAction = isAuctionOrder && !!order.auction_payment_error;
            const target =
              order.status === 'pending_payment' && (!isAuctionOrder || auctionChargeNeedsAction)
                ? `/app/buyer/checkout/${order.id}`
                : `/app/orders/${order.id}`;
            return (
              <div
                key={order.id}
                className="dashboard-card p-4 flex flex-col md:flex-row md:items-center gap-4"
              >
                <div className="md:w-48">
                  <p className="font-semibold">
                    {order.lot?.title ?? 'Order'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Buying · {formatDistanceToNow(parseISO(order.created_at), { addSuffix: true })}
                  </p>
                </div>

                <div className="flex-1 text-sm">
                  <p className="text-muted-foreground">
                    Item {money(base)} · Buyer fee {money(fee)}
                  </p>
                  <p className="font-semibold">Total {money(total)}</p>
                  {isAuctionOrder && order.status === 'pending_payment' && (
                    <p className={auctionChargeNeedsAction ? 'text-xs text-destructive mt-1' : 'text-xs text-muted-foreground mt-1'}>
                      {auctionChargeNeedsAction
                        ? 'Automatic auction charge needs attention. Pay now to secure the item.'
                        : 'Winning auction payment is being processed from your saved card.'}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  <Badge variant={getStatusBadge(order.status)}>
                    {formatStatus(order.status)}
                  </Badge>
                  {order.pickup_status && order.pickup_status !== 'completed' && (
                    <Badge variant="muted">
                      {pickupStatusLabel(order.pickup_status)}
                    </Badge>
                  )}
                </div>

                <Button asChild size="sm" className="md:w-auto">
                  <Link to={target}>
                    {order.status === 'pending_payment' ? (
                      <>
                        {isAuctionOrder && !auctionChargeNeedsAction ? (
                          <>View order <ArrowRight className="h-4 w-4 ml-1" /></>
                        ) : (
                          <><CreditCard className="h-4 w-4 mr-1" /> Pay now</>
                        )}
                      </>
                    ) : (
                      <>Manage <ArrowRight className="h-4 w-4 ml-1" /></>
                    )}
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
