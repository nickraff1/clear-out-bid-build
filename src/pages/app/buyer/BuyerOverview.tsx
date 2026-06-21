import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/app/StatsCard';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight,
  Clock,
  Gavel,
  Heart,
  Loader2,
  Package,
  ShoppingCart,
  TrendingUp,
  Truck,
  Bell
} from 'lucide-react';
import type { Bid, Order, Lot, ClearanceEvent } from '@/types/database';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { EmptyState } from '@/components/app/EmptyState';
import { orderStatusLabel, orderStatusTone } from '@/lib/order-status';

type BidWithLot = Bid & {
  lot: Lot & { event: ClearanceEvent };
};

export default function BuyerOverview() {
  const { user, profile, organizations } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeBids: 0,
    outbidCount: 0,
    wonAuctions: 0,
    pendingPickups: 0,
    watchlistCount: 0,
  });
  const [recentBids, setRecentBids] = useState<BidWithLot[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, organizations]);

  const fetchData = async () => {
    try {
      // Fetch bids
      const { data: bidsData } = await supabase
        .from('bids')
        .select('*, lot:lots(*, event:clearance_events(*))')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (bidsData) {
        setRecentBids(bidsData as BidWithLot[]);
        
        // Count active bids (on lots still in auction)
        const activeBids = bidsData.filter(b => 
          b.lot?.status === 'active' && b.lot?.pricing_type === 'auction'
        ).length;
        
        // Count outbid (where user's bid is not the highest)
        const outbidCount = bidsData.filter(b => 
          b.lot?.current_bid && b.lot.current_bid > b.amount && b.lot.status === 'active'
        ).length;

        setStats(prev => ({ ...prev, activeBids, outbidCount }));
      }

      // Fetch orders — include orders made by the user OR by any org they belong to.
      const orgIds = (organizations ?? []).map(o => o.org_id).filter(Boolean);
      const orFilter = orgIds.length > 0
        ? `buyer_id.eq.${user!.id},buyer_org_id.in.(${orgIds.join(',')})`
        : `buyer_id.eq.${user!.id}`;
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*, lot:lots(title)')
        .or(orFilter)
        .order('created_at', { ascending: false })
        .limit(5);

      if (ordersData) {
        setRecentOrders(ordersData as unknown as Order[]);
        
        const pendingPickups = ordersData.filter(o => 
          o.status === 'ready_for_pickup' || o.status === 'paid'
        ).length;
        
        const wonAuctions = ordersData.length;
        
        setStats(prev => ({ ...prev, pendingPickups, wonAuctions }));
      }

      // Fetch watchlist count
      const { count: watchlistCount } = await supabase
        .from('watchlist')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id);

      setStats(prev => ({ ...prev, watchlistCount: watchlistCount ?? 0 }));
    } catch (error) {
      console.error('Error fetching buyer data:', error);
    } finally {
      setLoading(false);
    }
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
        <h1 className="text-2xl font-bold">Welcome back, {profile?.full_name?.split(' ')[0]}!</h1>
        <p className="text-muted-foreground">Here's your buying activity at a glance.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Active Bids"
          value={stats.activeBids}
          icon={Gavel}
          variant="primary"
        />
        <StatsCard
          title="Outbid"
          value={stats.outbidCount}
          subtitle={stats.outbidCount > 0 ? "Need attention" : undefined}
          icon={Bell}
          variant={stats.outbidCount > 0 ? 'warning' : 'default'}
        />
        <StatsCard
          title="My Orders"
          value={stats.wonAuctions}
          icon={TrendingUp}
          variant="success"
        />
        <StatsCard
          title="Pending Pickups"
          value={stats.pendingPickups}
          icon={Truck}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Active Bids */}
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Your Active Bids</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/buyer/bids">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>

          {recentBids.length === 0 ? (
            <EmptyState
              icon={Gavel}
              compact
              title="No bids yet"
              description="Find an auction listing and place your first bid."
              action={
                <Button asChild size="sm">
                  <Link to="/marketplace">Browse marketplace</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {recentBids.slice(0, 4).map(bid => {
                const isWinning = bid.lot?.current_bid === bid.amount;
                const isOutbid = bid.lot?.current_bid && bid.lot.current_bid > bid.amount;
                const auctionEnded = bid.lot?.auction_end && new Date(bid.lot.auction_end) < new Date();
                
                return (
                  <Link
                    key={bid.id}
                    to={`/lot/${bid.lot_id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{bid.lot?.title}</p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                          Your bid: ${bid.amount.toLocaleString()}
                        </span>
                        {!auctionEnded && bid.lot?.auction_end && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(parseISO(bid.lot.auction_end), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant={isWinning ? 'success' : isOutbid ? 'warning' : 'muted'}>
                      {auctionEnded ? (isWinning ? 'Won' : 'Lost') : isWinning ? 'Winning' : isOutbid ? 'Outbid' : 'Active'}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Orders</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/buyer/orders">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>

          {recentOrders.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              compact
              title="No orders yet"
              description="Your purchases will show up here once you buy or win an auction."
              action={
                <Button asChild size="sm">
                  <Link to="/marketplace">Browse marketplace</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {recentOrders.map(order => (
                <Link
                  key={order.id}
                  to={
                    order.status === 'pending_payment'
                      ? `/app/buyer/checkout/${order.id}`
                      : `/app/orders/${order.id}`
                  }
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{(order as any).lot?.title}</p>
                    <p className="text-sm text-muted-foreground">
                      ${order.amount.toLocaleString()}
                      {order.status === 'pending_payment' && ' · Pay now to secure'}
                      {(order.status === 'paid' || order.status === 'ready_for_pickup') && ' · Arrange pickup'}
                    </p>
                  </div>
                  <Badge variant={orderStatusTone(order.status)}>
                    {orderStatusLabel(order.status)}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link 
          to="/marketplace" 
          className="dashboard-card hover:border-primary/20 transition-all flex items-center gap-3 p-4"
        >
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Marketplace</p>
            <p className="text-sm text-muted-foreground">Browse listings</p>
          </div>
        </Link>

        <Link 
          to="/app/buyer/bids" 
          className="dashboard-card hover:border-primary/20 transition-all flex items-center gap-3 p-4"
        >
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Gavel className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">My bids</p>
            <p className="text-sm text-muted-foreground">{stats.activeBids} active</p>
          </div>
        </Link>

        <Link 
          to="/app/buyer/watchlist" 
          className="dashboard-card hover:border-primary/20 transition-all flex items-center gap-3 p-4"
        >
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Heart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Watchlist</p>
            <p className="text-sm text-muted-foreground">{stats.watchlistCount} items</p>
          </div>
        </Link>

        <Link 
          to="/app/buyer/alerts" 
          className="dashboard-card hover:border-primary/20 transition-all flex items-center gap-3 p-4"
        >
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Alerts</p>
            <p className="text-sm text-muted-foreground">Set up notifications</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
