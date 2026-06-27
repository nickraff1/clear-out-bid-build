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
import { ArrowUpRight, Clock, Filter, Gavel, Loader2, Search } from 'lucide-react';
import type { Bid, Lot, ClearanceEvent } from '@/types/database';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { EmptyState } from '@/components/app/EmptyState';

type BidWithLot = Bid & {
  lot: Lot & { event: ClearanceEvent };
};

export default function BuyerBids() {
  const { user } = useAuth();
  const [bids, setBids] = useState<BidWithLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (user) {
      fetchBids();
    }
  }, [user]);

  const fetchBids = async () => {
    try {
      const { data } = await supabase
        .from('bids')
        .select('*, lot:lots(*, event:clearance_events(*))')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (data) {
        setBids(data as BidWithLot[]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getBidStatus = (bid: BidWithLot) => {
    const lot = bid.lot;
    const auctionEnded = lot?.auction_end && new Date(lot.auction_end) < new Date();
    const isWinning = lot?.current_bid === bid.amount;
    
    if (auctionEnded) {
      return isWinning ? 'won' : 'lost';
    }
    if (lot?.status !== 'active') {
      return 'ended';
    }
    return isWinning ? 'winning' : 'outbid';
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'muted' | 'destructive'> = {
      winning: 'success',
      won: 'success',
      outbid: 'warning',
      lost: 'destructive',
      ended: 'muted',
    };
    return variants[status] ?? 'muted';
  };

  const filteredBids = bids.filter(bid => {
    const matchesSearch = bid.lot?.title.toLowerCase().includes(searchQuery.toLowerCase());
    const status = getBidStatus(bid);
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
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
        <h1 className="text-2xl font-bold">My Bids</h1>
        <p className="text-muted-foreground">Track all your auction bids</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bids..."
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
            <SelectItem value="winning">Winning</SelectItem>
            <SelectItem value="outbid">Outbid</SelectItem>
            <SelectItem value="won">Won</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bids Table */}
      {filteredBids.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title={bids.length === 0 ? 'No bids yet' : 'No matching bids'}
          description={
            bids.length === 0
              ? 'Place a bid on an auction listing to track it here.'
              : 'Try adjusting your search or filter to see more results.'
          }
          action={
            bids.length === 0 ? (
              <Button asChild>
                <Link to="/marketplace">Browse marketplace</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="dashboard-card p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Listing</TableHead>
                <TableHead>Your Bid</TableHead>
                <TableHead>Current Bid</TableHead>
                <TableHead>Time Left</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBids.map(bid => {
                const status = getBidStatus(bid);
                const auctionEnded = bid.lot?.auction_end && new Date(bid.lot.auction_end) < new Date();
                
                return (
                  <TableRow key={bid.id}>
                    <TableCell>
                      <Link 
                        to={`/lot/${bid.lot_id}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {bid.lot?.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {bid.lot?.event?.suburb}
                      </p>
                    </TableCell>
                    <TableCell className="font-medium">
                      ${bid.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      ${(bid.lot?.current_bid ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {auctionEnded ? (
                        <span className="text-muted-foreground">Ended</span>
                      ) : bid.lot?.auction_end ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(parseISO(bid.lot.auction_end), { addSuffix: true })}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadge(status)}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/lot/${bid.lot_id}`}>
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
