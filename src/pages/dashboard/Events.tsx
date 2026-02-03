import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Plus, Loader2, MapPin, Package, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ClearanceEvent, Lot } from '@/types/database';
import { format, parseISO } from 'date-fns';

type EventWithLots = ClearanceEvent & {
  lots: Lot[];
};

export default function EventsPage() {
  const { user, primaryOrg } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventWithLots[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (primaryOrg) {
      fetchEvents();
    } else {
      setLoading(false);
    }
  }, [primaryOrg]);

  const fetchEvents = async () => {
    try {
      const { data } = await supabase
        .from('clearance_events')
        .select('*, lots(*)')
        .eq('org_id', primaryOrg!.id)
        .order('created_at', { ascending: false });

      if (data) {
        setEvents(data as EventWithLots[]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'warning' | 'success' | 'info' | 'muted' | 'destructive' | 'default'> = {
      draft: 'muted',
      active: 'success',
      completed: 'info',
      cancelled: 'destructive'
    };
    return variants[status] ?? 'default';
  };

  const updateEventStatus = async (eventId: string, status: 'draft' | 'active' | 'completed' | 'cancelled') => {
    await supabase.from('clearance_events').update({ status }).eq('id', eventId);
    fetchEvents();
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
          <h2 className="text-xl font-semibold mb-2">No Organization</h2>
          <p className="text-muted-foreground mb-4">
            You need to create or join an organization to manage events.
          </p>
          <Button asChild>
            <Link to="/dashboard/organization">Set Up Organization</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Clearance Events</h1>
          <p className="text-muted-foreground">
            Manage your clearance events and lots
          </p>
        </div>
        <Button asChild>
          <Link to="/dashboard/events/new">
            <Plus className="h-4 w-4 mr-2" />
            New Event
          </Link>
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No events yet</h2>
          <p className="text-muted-foreground mb-4">
            Create your first clearance event to start selling surplus materials.
          </p>
          <Button asChild>
            <Link to="/dashboard/events/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map(event => {
            const soldLots = event.lots.filter(l => l.status === 'sold').length;
            const activeLots = event.lots.filter(l => l.status === 'active').length;
            
            return (
              <div key={event.id} className="dashboard-card">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <Link 
                          to={`/dashboard/events/${event.id}`}
                          className="text-lg font-semibold hover:text-primary"
                        >
                          {event.title}
                        </Link>
                        <Badge variant={getStatusBadge(event.status)} className="ml-2">
                          {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                        </Badge>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/dashboard/events/${event.id}`)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/dashboard/events/${event.id}/edit`)}>
                            Edit Event
                          </DropdownMenuItem>
                          {event.status === 'draft' && (
                            <DropdownMenuItem onClick={() => updateEventStatus(event.id, 'active')}>
                              Publish Event
                            </DropdownMenuItem>
                          )}
                          {event.status === 'active' && (
                            <DropdownMenuItem onClick={() => updateEventStatus(event.id, 'completed')}>
                              Complete Event
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span>{event.suburb}, {event.state}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {format(parseISO(event.pickup_start), 'MMM d')} - {format(parseISO(event.pickup_end), 'MMM d')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        <span>{event.lots.length} lots ({activeLots} active, {soldLots} sold)</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/dashboard/events/${event.id}/lots/new`}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Lot
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/dashboard/events/${event.id}`}>
                          Manage
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
