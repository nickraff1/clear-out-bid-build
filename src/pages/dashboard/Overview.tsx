import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  ShoppingCart, 
  Calendar, 
  TrendingUp,
  ArrowRight,
  Plus,
  Gavel
} from 'lucide-react';
import type { Order, Lot, ClearanceEvent } from '@/types/database';

export default function DashboardOverview() {
  const { user, isSeller, isAdmin, profile, primaryOrg } = useAuth();
  const [stats, setStats] = useState({
    activeOrders: 0,
    watchlistCount: 0,
    activeEvents: 0,
    activeLots: 0,
    totalSales: 0
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchRecentOrders();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      // Orders count
      const { count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('buyer_id', user!.id)
        .in('status', ['pending_payment', 'paid', 'ready_for_pickup']);

      // Watchlist count
      const { count: watchlistCount } = await supabase
        .from('watchlist')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id);

      // For sellers
      let eventsCount = 0;
      let lotsCount = 0;
      let totalSales = 0;

      if (primaryOrg) {
        const { count: ec } = await supabase
          .from('clearance_events')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', primaryOrg.id)
          .in('status', ['draft', 'active']);
        eventsCount = ec ?? 0;

        const { count: lc } = await supabase
          .from('lots')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');
        lotsCount = lc ?? 0;
      }

      setStats({
        activeOrders: ordersCount ?? 0,
        watchlistCount: watchlistCount ?? 0,
        activeEvents: eventsCount,
        activeLots: lotsCount,
        totalSales
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchRecentOrders = async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('*, lot:lots(title)')
        .eq('buyer_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) {
        setRecentOrders(data as unknown as Order[]);
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
      cancelled: 'destructive'
    };
    return variants[status] ?? 'default';
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-1">
          Welcome back, {profile?.full_name?.split(' ')[0] ?? 'there'}!
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening with your account.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Link to="/marketplace" className="dashboard-card hover:border-primary/20 transition-all">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Gavel className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Browse Lots</p>
              <p className="text-sm text-muted-foreground">Find materials</p>
            </div>
          </div>
        </Link>

        {isSeller && (
          <Link to="/dashboard/events/new" className="dashboard-card hover:border-primary/20 transition-all">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">New Event</p>
                <p className="text-sm text-muted-foreground">Start clearing</p>
              </div>
            </div>
          </Link>
        )}

        <Link to="/dashboard/orders" className="dashboard-card hover:border-primary/20 transition-all">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">My Orders</p>
              <p className="text-sm text-muted-foreground">{stats.activeOrders} active</p>
            </div>
          </div>
        </Link>

        <Link to="/dashboard/watchlist" className="dashboard-card hover:border-primary/20 transition-all">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Watchlist</p>
              <p className="text-sm text-muted-foreground">{stats.watchlistCount} items</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Stats Cards (Seller) */}
      {isSeller && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="stats-card">
            <p className="text-sm text-muted-foreground">Active Events</p>
            <p className="text-2xl font-bold">{stats.activeEvents}</p>
          </div>
          <div className="stats-card">
            <p className="text-sm text-muted-foreground">Active Lots</p>
            <p className="text-2xl font-bold">{stats.activeLots}</p>
          </div>
          <div className="stats-card">
            <p className="text-sm text-muted-foreground">Total Sales</p>
            <p className="text-2xl font-bold">${stats.totalSales.toLocaleString()}</p>
          </div>
          <div className="stats-card">
            <p className="text-sm text-muted-foreground">Sell-Through</p>
            <p className="text-2xl font-bold">0%</p>
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="dashboard-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Orders</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/orders">
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground mb-4">No orders yet</p>
            <Button asChild>
              <Link to="/marketplace">Browse Marketplace</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {recentOrders.map(order => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div>
                  <p className="font-medium text-sm">{(order as any).lot?.title ?? 'Order'}</p>
                  <p className="text-xs text-muted-foreground">
                    ${order.amount.toLocaleString()}
                  </p>
                </div>
                <Badge variant={getStatusBadge(order.status)}>
                  {formatStatus(order.status)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
