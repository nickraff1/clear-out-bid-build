import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/app/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/app/StatsCard';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Package, 
  DollarSign, 
  Truck, 
  Plus, 
  ArrowRight,
  Clock,
  TrendingUp,
  Loader2
} from 'lucide-react';
import type { ClearanceEvent, Lot, Order } from '@/types/database';
import { format, parseISO, isToday, isThisWeek } from 'date-fns';
import { getEffectiveEventStatus } from '@/lib/event-lifecycle';

export default function SellerOverview() {
  const { user, profile, primaryOrg } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeEvents: 0,
    lotsLive: 0,
    soldLots: 0,
    upcomingPickups: 0,
    totalRevenue: 0,
    pendingPickups: 0,
  });
  const [recentEvents, setRecentEvents] = useState<(ClearanceEvent & { lots: Lot[] })[]>([]);
  const [upcomingPickups, setUpcomingPickups] = useState<Order[]>([]);

  useEffect(() => {
    if (primaryOrg) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [primaryOrg]);

  const fetchData = async () => {
    try {
      // Fetch events with lots
      const { data: eventsData } = await supabase
        .from('clearance_events')
        .select('*, lots(*)')
        .eq('org_id', primaryOrg!.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (eventsData) {
        setRecentEvents(eventsData as (ClearanceEvent & { lots: Lot[] })[]);
        
        // Calculate stats
        const activeEvents = eventsData.filter(e => getEffectiveEventStatus(e as ClearanceEvent) === 'active').length;
        let lotsLive = 0;
        let soldLots = 0;
        
        eventsData.forEach(event => {
          event.lots?.forEach(lot => {
            if (lot.status === 'active') lotsLive++;
            if (lot.status === 'sold') soldLots++;
          });
        });

        // Fetch orders for seller's events
        const { data: ordersData } = await supabase
          .from('orders')
          .select('*, lot:lots(*), event:clearance_events(*)')
          .in('event_id', eventsData.map(e => e.id))
          .in('status', ['paid', 'ready_for_pickup'])
          .order('created_at', { ascending: false })
          .limit(10);

        const totalRevenue = ordersData?.reduce((sum, o) => sum + o.amount, 0) ?? 0;
        const pendingPickups = ordersData?.filter(o => o.status === 'ready_for_pickup').length ?? 0;

        setStats({
          activeEvents,
          lotsLive,
          soldLots,
          upcomingPickups: pendingPickups,
          totalRevenue,
          pendingPickups,
        });

        if (ordersData) {
          setUpcomingPickups(ordersData as Order[]);
        }
      }
    } catch (error) {
      console.error('Error fetching seller data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'muted' | 'success' | 'info' | 'destructive' | 'warning'> = {
      draft: 'muted',
      active: 'success',
      completed: 'info',
      expired: 'warning',
      cancelled: 'destructive',
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

  if (!primaryOrg) {
    return (
      <div className="p-6">
        <div className="text-center py-16">
          <Package className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Set Up Your Organization</h2>
          <p className="text-muted-foreground mb-4">
            You need to create a seller organization to start listing items.
          </p>
          <Button asChild>
            <Link to="/app/settings">Set Up Organization</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {profile?.full_name?.split(' ')[0]}!</h1>
          <p className="text-muted-foreground">Here's your seller dashboard overview.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/app/seller/events/new">
              <Plus className="h-4 w-4 mr-2" />
              New Event
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Active Events"
          value={stats.activeEvents}
          icon={Calendar}
          variant="primary"
        />
        <StatsCard
          title="Lots Live"
          value={stats.lotsLive}
          icon={Package}
        />
        <StatsCard
          title="Sold Lots"
          value={stats.soldLots}
          icon={TrendingUp}
          variant="success"
        />
        <StatsCard
          title="Pending Pickups"
          value={stats.pendingPickups}
          subtitle="Need collection"
          icon={Truck}
          variant="warning"
        />
      </div>

      {/* Revenue Card */}
      <div className="dashboard-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-3xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
          </div>
          <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
            <DollarSign className="h-6 w-6 text-success" />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Events */}
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Events</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/seller/events">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>

          {recentEvents.length === 0 ? (
            <EmptyState
              icon={Calendar}
              compact
              title="No events yet"
              description="Group your listings under a clearance event with one pickup window."
              action={
                <Button asChild size="sm">
                  <Link to="/app/seller/events/new">Create event</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {recentEvents.slice(0, 4).map(event => {
                const effectiveStatus = getEffectiveEventStatus(event);
                return (
                <Link
                  key={event.id}
                  to={`/app/seller/events/${event.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{event.title}</p>
                      <Badge variant={getStatusColor(effectiveStatus)} className="shrink-0">
                        {effectiveStatus}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {event.suburb} • {event.lots?.length ?? 0} lots
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Pickups */}
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Upcoming Pickups</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/seller/pickups">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>

          {upcomingPickups.length === 0 ? (
            <EmptyState
              icon={Truck}
              compact
              title="No pickups scheduled"
              description="Pickups appear here as soon as a buyer pays for a listing."
            />
          ) : (
            <div className="space-y-3">
              {upcomingPickups.slice(0, 4).map(order => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{(order as any).lot?.title}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Pending pickup</span>
                    </div>
                  </div>
                  <Badge variant={order.status === 'ready_for_pickup' ? 'warning' : 'success'}>
                    {order.status === 'ready_for_pickup' ? 'Ready' : 'Paid'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link 
          to="/app/seller/events/new" 
          className="dashboard-card hover:border-primary/20 transition-all flex items-center gap-3 p-4"
        >
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Plus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">New Event</p>
            <p className="text-sm text-muted-foreground">Start clearing</p>
          </div>
        </Link>

        <Link 
          to="/app/seller/lots" 
          className="dashboard-card hover:border-primary/20 transition-all flex items-center gap-3 p-4"
        >
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Manage Lots</p>
            <p className="text-sm text-muted-foreground">{stats.lotsLive} active</p>
          </div>
        </Link>

        <Link 
          to="/app/seller/pickups" 
          className="dashboard-card hover:border-primary/20 transition-all flex items-center gap-3 p-4"
        >
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Pickups</p>
            <p className="text-sm text-muted-foreground">{stats.pendingPickups} pending</p>
          </div>
        </Link>

        <Link 
          to="/marketplace" 
          className="dashboard-card hover:border-primary/20 transition-all flex items-center gap-3 p-4"
        >
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Marketplace</p>
            <p className="text-sm text-muted-foreground">View listings</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
