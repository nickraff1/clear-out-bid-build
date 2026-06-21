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
import { Filter, Loader2, Package, Search, MoreVertical, Eye, EyeOff, Trash2, Pencil } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
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
    setLoading(true);
    try {
      const { data } = await supabase
        .from('lots')
        .select('*, event:clearance_events!inner(*)')
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

  const setLotStatus = async (lotId: string, status: 'active' | 'draft' | 'cancelled') => {
    const { error } = await supabase.from('lots').update({ status }).eq('id', lotId);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Listing updated', description: `Status: ${status}` });
      fetchLots();
    }
  };

  const deleteLot = async (lotId: string) => {
    if (!confirm('Delete this listing? This cannot be undone.')) return;
    const { error } = await supabase.from('lots').delete().eq('id', lotId);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Listing deleted' });
      fetchLots();
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
          <h1 className="text-2xl font-bold">My Listings</h1>
          <p className="text-muted-foreground">Manage all the items you're selling</p>
        </div>
        <Button asChild>
          <Link to="/app/seller/lots/new">+ New Listing</Link>
        </Button>
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
        <EmptyState
          icon={Package}
          title={lots.length === 0 ? 'No listings yet' : 'No matching listings'}
          description={
            lots.length === 0
              ? 'Add your first listing to start selling surplus materials.'
              : 'Try adjusting your search or filter to see more results.'
          }
          action={
            lots.length === 0 ? (
              <Button asChild>
                <Link to="/app/seller/lots/new">Create listing</Link>
              </Button>
            ) : null
          }
        />
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
                <TableHead className="w-10"></TableHead>
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
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {lot.status === 'draft' && (
                          <DropdownMenuItem onClick={() => setLotStatus(lot.id, 'active')}>
                            <Eye className="h-4 w-4 mr-2" /> Publish
                          </DropdownMenuItem>
                        )}
                        {lot.status === 'active' && (
                          <DropdownMenuItem onClick={() => setLotStatus(lot.id, 'draft')}>
                            <EyeOff className="h-4 w-4 mr-2" /> Unpublish
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild>
                          <Link to={`/app/seller/lots/${lot.id}/edit`}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => deleteLot(lot.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
