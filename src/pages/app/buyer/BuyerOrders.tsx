import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowUpRight, CreditCard, Filter, Loader2, MapPin, Search, ShoppingCart } from 'lucide-react';
import type { Order, Lot, ClearanceEvent } from '@/types/database';
import { format, parseISO } from 'date-fns';
import { LeaveReviewDialog } from '@/components/reviews/LeaveReviewDialog';

type OrderWithDetails = Order & {
  lot: Lot & { event?: { org_id: string; created_by: string } };
  event: ClearanceEvent;
  has_review?: boolean;
};

export default function BuyerOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('*, lot:lots(*, event:clearance_events(org_id, created_by)), event:clearance_events(*)')
        .eq('buyer_id', user!.id)
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'info' | 'muted' | 'destructive'> = {
      pending_payment: 'warning',
      paid: 'success',
      ready_for_pickup: 'info',
      collected: 'success',
      cancelled: 'destructive',
      disputed: 'warning',
    };
    return variants[status] ?? 'muted';
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.lot?.title.toLowerCase().includes(searchQuery.toLowerCase());
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
        <div className="text-center py-16 dashboard-card">
          <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {orders.length === 0 ? 'No orders yet' : 'No matching orders'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {orders.length === 0 
              ? 'Your purchases will appear here.'
              : 'Try adjusting your search or filter criteria.'
            }
          </p>
          {orders.length === 0 && (
            <Button asChild>
              <Link to="/marketplace">Browse Marketplace</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="dashboard-card p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Pickup Location</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map(order => (
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
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {order.event?.suburb}, {order.event?.state}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">
                    ${order.amount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(parseISO(order.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadge(order.status)}>
                      {formatStatus(order.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 justify-end">
                      {order.status === 'pending_payment' && (
                        <Button size="sm" asChild>
                          <Link to={`/app/buyer/checkout/${order.id}`}>
                            <CreditCard className="h-4 w-4 mr-1" />Pay
                          </Link>
                        </Button>
                      )}
                      {order.status === 'collected' && !order.has_review && order.lot?.event?.created_by && (
                        <LeaveReviewDialog
                          orderId={order.id}
                          revieweeId={order.lot.event.created_by}
                          revieweeOrgId={order.lot.event.org_id}
                          reviewerRole="buyer"
                          onReviewed={fetchOrders}
                        />
                      )}
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/app/orders/${order.id}`}>
                          View <ArrowUpRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    </div>
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
