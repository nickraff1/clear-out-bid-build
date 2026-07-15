import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  Calendar, 
  CheckCircle, 
  Clock, 
  Loader2, 
  MapPin, 
  MoreHorizontal, 
  Package, 
  Plus, 
  Settings,
  Truck,
  User
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ClearanceEvent, Lot, Order } from '@/types/database';
import { format, parseISO } from 'date-fns';
import { RotateCw } from 'lucide-react';
import { RelistAuctionDialog, type RelistTarget } from '@/components/seller/RelistAuctionDialog';
import { canAddListingToEvent, getEffectiveEventStatus } from '@/lib/event-lifecycle';

type EventWithDetails = ClearanceEvent & {
  lots: Lot[];
};

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { primaryOrg } = useAuth();
  
  const [event, setEvent] = useState<EventWithDetails | null>(null);
  const [orders, setOrders] = useState<(Order & { lot: Lot; buyer: { full_name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [justCreated] = useState(searchParams.get('created') === 'true');
  const [relistLot, setRelistLot] = useState<RelistTarget | null>(null);

  useEffect(() => {
    if (id) {
      fetchEvent();
      fetchOrders();
    }
  }, [id]);

  const fetchEvent = async () => {
    try {
      const { data } = await supabase
        .from('clearance_events')
        .select('*, lots(*)')
        .eq('id', id)
        .single();

      if (data) {
        setEvent(data as EventWithDetails);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, lot:lots(*), buyer:profiles(full_name)')
      .eq('event_id', id)
      .order('created_at', { ascending: false });

    if (data) {
      setOrders(data as any);
    }
  };

  const updateEventStatus = async (status: 'draft' | 'active' | 'completed' | 'cancelled') => {
    await supabase.from('clearance_events').update({ status }).eq('id', id);
    fetchEvent();
  };

  const updateLotStatus = async (lotId: string, status: 'draft' | 'active' | 'sold' | 'unsold' | 'cancelled') => {
    await supabase.from('lots').update({ status }).eq('id', lotId);
    fetchEvent();
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'muted' | 'success' | 'info' | 'destructive' | 'warning'> = {
      draft: 'muted',
      active: 'success',
      completed: 'info',
      expired: 'warning',
      cancelled: 'destructive',
      sold: 'success',
      unsold: 'warning',
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

  if (!event) {
    return (
      <div className="p-6 text-center py-16">
        <h2 className="text-xl font-semibold mb-2">Event not found</h2>
        <Button asChild>
          <Link to="/app/seller/events">Back to Events</Link>
        </Button>
      </div>
    );
  }

  const draftLots = event.lots.filter(l => l.status === 'draft');
  const activeLots = event.lots.filter(l => l.status === 'active');
  const soldLots = event.lots.filter(l => l.status === 'sold');
  const expiredLots = event.lots.filter(l => l.status === 'unsold' || l.status === 'cancelled');
  const effectiveStatus = getEffectiveEventStatus(event);
  const canAddListing = canAddListingToEvent(event);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/seller/events')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Events
        </Button>

        {justCreated && (
          <Alert className="mb-4 border-success/20 bg-success/10">
            <CheckCircle className="h-4 w-4 text-success" />
            <AlertDescription className="text-success">
              Event created successfully! Now add some lots to get started.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{event.title}</h1>
              <Badge variant={getStatusColor(effectiveStatus)}>
                {effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)}
              </Badge>
            </div>
            
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {event.suburb}, {event.state}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(parseISO(event.pickup_start), 'MMM d')} - {format(parseISO(event.pickup_end), 'MMM d, yyyy')}
              </span>
              <span className="flex items-center gap-1">
                <Package className="h-4 w-4" />
                {event.lots.length} lots
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {canAddListing && (
              <Button asChild>
                <Link to={`/app/seller/lots/new?eventId=${event.id}`}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add listing
                </Link>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/app/seller/events/${id}/edit`)}>
                  Edit Event
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {canAddListing && event.status === 'draft' && (
                  <DropdownMenuItem 
                    onClick={() => updateEventStatus('active')}
                    className="text-success"
                  >
                    Publish Event
                  </DropdownMenuItem>
                )}
                {canAddListing && event.status === 'active' && (
                  <DropdownMenuItem onClick={() => updateEventStatus('completed')}>
                    Complete Event
                  </DropdownMenuItem>
                )}
                {event.status !== 'cancelled' && (
                  <DropdownMenuItem 
                    onClick={() => updateEventStatus('cancelled')}
                    className="text-destructive"
                  >
                    Cancel Event
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {!canAddListing && effectiveStatus === 'expired' && (
        <Alert className="border-warning/30 bg-warning/10">
          <Clock className="h-4 w-4 text-warning" />
          <AlertDescription>
            This event expired on {format(parseISO(event.pickup_end), 'MMM d, yyyy')}. New listings cannot be added. Existing listings keep their own sale and auction lifecycle.
          </AlertDescription>
        </Alert>
      )}

      {/* Event Details */}
      {event.description && (
        <div className="dashboard-card">
          <p className="text-sm text-muted-foreground mb-1">Description</p>
          <p>{event.description}</p>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="lots">
        <TabsList>
          <TabsTrigger value="lots">
            Listings ({event.lots.length})
          </TabsTrigger>
          <TabsTrigger value="pickups">
            Pickups ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="details">
            Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lots" className="mt-4">
          {event.lots.length === 0 ? (
            <div className="text-center py-16 dashboard-card">
              <Package className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No listings yet</h3>
              <p className="text-muted-foreground mb-4">
                {canAddListing ? 'Add your first listing to this event' : 'This event is closed to new listings'}
              </p>
              {canAddListing && (
                <Button asChild>
                  <Link to={`/app/seller/lots/new?eventId=${event.id}`}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add listing
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="dashboard-card p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Listing</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {event.lots.map(lot => (
                    <TableRow key={lot.id}>
                      <TableCell>
                        <Link 
                          to={`/lot/${lot.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {lot.title}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          Qty: {lot.quantity} {lot.unit}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {lot.pricing_type === 'auction' ? 'Auction' : 'Fixed'}
                      </TableCell>
                      <TableCell>
                        ${(lot.pricing_type === 'auction' 
                          ? (lot.current_bid ?? lot.start_price ?? 0)
                          : (lot.fixed_price ?? 0)
                        ).toLocaleString()}
                        {lot.pricing_type === 'auction' && lot.bid_count > 0 && (
                          <span className="text-sm text-muted-foreground ml-1">
                            ({lot.bid_count} bids)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(lot.status)}>
                          {lot.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/lot/${lot.id}`)}>
                              View Listing
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/app/seller/lots/${lot.id}/edit`)}>
                              Edit listing
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {canAddListing && lot.status === 'draft' && (
                              <DropdownMenuItem 
                                onClick={() => updateLotStatus(lot.id, 'active')}
                                className="text-success"
                              >
                                Publish listing
                              </DropdownMenuItem>
                            )}
                            {lot.status === 'active' && (
                              <DropdownMenuItem 
                                onClick={() => updateLotStatus(lot.id, 'cancelled')}
                                className="text-destructive"
                              >
                                Cancel listing
                              </DropdownMenuItem>
                            )}
                            {canAddListing && lot.pricing_type === 'auction' && (lot.status === 'unsold' || lot.status === 'cancelled') && (
                              <DropdownMenuItem onClick={() => setRelistLot({ id: lot.id, title: lot.title, event_id: lot.event_id, start_price: lot.start_price, reserve_price: lot.reserve_price })}>
                                <RotateCw className="h-4 w-4 mr-2" /> Relist auction
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pickups" className="mt-4">
          {orders.length === 0 ? (
            <div className="text-center py-16 dashboard-card">
              <Truck className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No pickups scheduled</h3>
              <p className="text-muted-foreground">
                Pickups will appear here when buyers purchase lots
              </p>
            </div>
          ) : (
            <div className="dashboard-card p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lot</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map(order => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.lot?.title}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {order.buyer?.full_name ?? 'Unknown'}
                      </TableCell>
                      <TableCell>${order.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(order.status)}>
                          {order.status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <div className="dashboard-card space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Site Address</p>
                <p className="font-medium">{event.site_address}</p>
                <p>{event.suburb}, {event.state} {event.postcode}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Pickup Window</p>
                <p className="font-medium">
                  {format(parseISO(event.pickup_start), 'EEE, MMM d, yyyy h:mm a')}
                </p>
                <p className="text-muted-foreground">
                  to {format(parseISO(event.pickup_end), 'EEE, MMM d, yyyy h:mm a')}
                </p>
              </div>
            </div>

            {event.access_notes && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Access Notes</p>
                <p className="whitespace-pre-wrap">{event.access_notes}</p>
              </div>
            )}

            {(event.contact_name || event.contact_phone || event.contact_email) && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Site Contact</p>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{event.contact_name}</span>
                  {event.contact_phone && (
                    <span className="text-muted-foreground">• {event.contact_phone}</span>
                  )}
                  {event.contact_email && (
                    <span className="text-muted-foreground">• {event.contact_email}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
      <RelistAuctionDialog
        lot={relistLot}
        onClose={() => setRelistLot(null)}
        onDone={() => { fetchEvent(); }}
      />
    </div>
  );
}
