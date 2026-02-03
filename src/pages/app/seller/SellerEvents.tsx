import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Calendar, 
  Plus, 
  Loader2, 
  MapPin, 
  Package, 
  MoreHorizontal, 
  Search,
  Filter,
  ArrowRight
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ClearanceEvent, Lot } from '@/types/database';
import { format, parseISO } from 'date-fns';

type EventWithLots = ClearanceEvent & {
  lots: Lot[];
};

export default function SellerEvents() {
  const { primaryOrg } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventWithLots[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

  const updateEventStatus = async (eventId: string, status: 'draft' | 'active' | 'completed' | 'cancelled') => {
    await supabase.from('clearance_events').update({ status }).eq('id', eventId);
    fetchEvents();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'muted' | 'success' | 'info' | 'destructive'> = {
      draft: 'muted',
      active: 'success',
      completed: 'info',
      cancelled: 'destructive'
    };
    return variants[status] ?? 'muted';
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.suburb.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || event.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!primaryOrg) {
    return (
      <div className="p-6 text-center py-16">
        <Calendar className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Organization</h2>
        <p className="text-muted-foreground mb-4">
          You need to create or join an organization to manage events.
        </p>
        <Button asChild>
          <Link to="/app/settings">Set Up Organization</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clearance Events</h1>
          <p className="text-muted-foreground">Manage your clearance events and their lots</p>
        </div>
        <Button asChild>
          <Link to="/app/seller/events/new">
            <Plus className="h-4 w-4 mr-2" />
            New Event
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {events.length === 0 ? 'No events yet' : 'No matching events'}
          </h2>
          <p className="text-muted-foreground mb-4">
            {events.length === 0 
              ? 'Create your first clearance event to start selling surplus materials.'
              : 'Try adjusting your search or filter criteria.'
            }
          </p>
          {events.length === 0 && (
            <Button asChild>
              <Link to="/app/seller/events/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Event
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map(event => {
            const soldLots = event.lots.filter(l => l.status === 'sold').length;
            const activeLots = event.lots.filter(l => l.status === 'active').length;
            const draftLots = event.lots.filter(l => l.status === 'draft').length;
            
            return (
              <div key={event.id} className="dashboard-card hover:border-primary/10 transition-colors">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Link 
                          to={`/app/seller/events/${event.id}`}
                          className="text-lg font-semibold hover:text-primary transition-colors"
                        >
                          {event.title}
                        </Link>
                        <Badge variant={getStatusBadge(event.status)}>
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
                          <DropdownMenuItem onClick={() => navigate(`/app/seller/events/${event.id}`)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/app/seller/events/${event.id}/edit`)}>
                            Edit Event
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/app/seller/lots/new?eventId=${event.id}`)}>
                            Add Lot
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {event.status === 'draft' && (
                            <DropdownMenuItem 
                              onClick={() => updateEventStatus(event.id, 'active')}
                              className="text-success"
                            >
                              Publish Event
                            </DropdownMenuItem>
                          )}
                          {event.status === 'active' && (
                            <DropdownMenuItem onClick={() => updateEventStatus(event.id, 'completed')}>
                              Complete Event
                            </DropdownMenuItem>
                          )}
                          {event.status !== 'cancelled' && (
                            <DropdownMenuItem 
                              onClick={() => updateEventStatus(event.id, 'cancelled')}
                              className="text-destructive"
                            >
                              Cancel Event
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="truncate">{event.suburb}, {event.state}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 shrink-0" />
                        <span>
                          {format(parseISO(event.pickup_start), 'MMM d')} - {format(parseISO(event.pickup_end), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 shrink-0" />
                        <span>
                          {event.lots.length} lots
                          {activeLots > 0 && <span className="text-success ml-1">({activeLots} live)</span>}
                          {soldLots > 0 && <span className="text-primary ml-1">({soldLots} sold)</span>}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/app/seller/lots/new?eventId=${event.id}`}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Lot
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/app/seller/events/${event.id}`}>
                          Manage <ArrowRight className="h-4 w-4 ml-1" />
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
