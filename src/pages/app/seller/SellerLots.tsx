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
import { Filter, Loader2, Package, Search } from 'lucide-react';
import type { Lot, ClearanceEvent } from '@/types/database';
import { format, parseISO } from 'date-fns';

type LotWithEvent = Lot & {
  event: ClearanceEvent;
};

export default function SellerLots() {
  const { primaryOrg } = useAuth();
  const [lots, setLots] = useState<LotWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (primaryOrg) {
      fetchLots();
    } else {
      setLoading(false);
    }
  }, [primaryOrg]);

  const fetchLots = async () => {
    try {
      const { data } = await supabase
        .from('lots')
        .select('*, event:clearance_events(*)')
        .eq('event.org_id', primaryOrg!.id)
        .order('created_at', { ascending: false });

      if (data) {
        // Filter out lots where event is null (shouldn't happen but just in case)
        setLots(data.filter(l => l.event) as LotWithEvent[]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'muted' | 'success' | 'info' | 'destructive' | 'warning'> = {
      draft: 'muted',
      active: 'success',
      sold: 'success',
      unsold: 'warning',
      cancelled: 'destructive',
    };
    return colors[status] ?? 'muted';
  };

  const filteredLots = lots.filter(lot => {
    const matchesSearch = lot.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lot.status === statusFilter;
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">All Lots</h1>
          <p className="text-muted-foreground">Manage lots across all your events</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search lots..."
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
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="unsold">Unsold</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lots Table */}
      {filteredLots.length === 0 ? (
        <div className="text-center py-16 dashboard-card">
          <Package className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {lots.length === 0 ? 'No lots yet' : 'No matching lots'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {lots.length === 0 
              ? 'Create an event and add lots to start selling.'
              : 'Try adjusting your search or filter criteria.'
            }
          </p>
          {lots.length === 0 && (
            <Button asChild>
              <Link to="/app/seller/events/new">Create Event</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="dashboard-card p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lot</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLots.map(lot => (
                <TableRow key={lot.id}>
                  <TableCell>
                    <Link 
                      to={`/lot/${lot.id}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {lot.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      Qty: {lot.quantity} {lot.unit}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Link 
                      to={`/app/seller/events/${lot.event_id}`}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {lot.event?.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={lot.pricing_type === 'auction' ? 'auction' : 'fixed'}>
                      {lot.pricing_type === 'auction' ? 'Auction' : 'Fixed'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
