import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Clock, 
  MapPin, 
  Gavel, 
  Heart, 
  Share2, 
  AlertCircle, 
  Loader2,
  CheckCircle2,
  Tag,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Lot, LotMedia, ClearanceEvent, Category, ComplianceTag, Bid, Organization } from '@/types/database';
import { LOT_CONDITIONS, getMinNextBid, getBidIncrement } from '@/lib/constants';
import { formatDistanceToNow, isPast, parseISO, format } from 'date-fns';
import { MessageSellerDialog } from '@/components/messaging/MessageSellerDialog';

type LotWithDetails = Lot & {
  media: LotMedia[];
  event: ClearanceEvent & { organization?: Organization };
  category: Category | null;
  compliance_tags: ComplianceTag[];
};

export default function LotDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, primaryOrg } = useAuth();
  
  const [lot, setLot] = useState<LotWithDetails | null>(null);
  const [bids, setBids] = useState<(Bid & { profile?: { full_name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Bid form state
  const [bidAmount, setBidAmount] = useState('');
  const [bidLoading, setBidLoading] = useState(false);
  const [bidError, setBidError] = useState('');
  const [bidSuccess, setBidSuccess] = useState(false);
  
  // Watchlist state
  const [isWatched, setIsWatched] = useState(false);

  useEffect(() => {
    if (id) {
      fetchLot();
      fetchBids();
      if (user) {
        checkWatchlist();
      }
    }
  }, [id, user]);

  const fetchLot = async () => {
    try {
      const { data, error } = await supabase
        .from('lots')
        .select(`
          *,
          media:lot_media(*),
          event:clearance_events(
            id, org_id, created_by, title, description,
            site_address, suburb, state, postcode,
            pickup_start, pickup_end, status, created_at, updated_at,
            organization:organizations(id, name, suburb, state)
          ),
          category:categories(*)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      
      // Fetch compliance tags separately
      if (data) {
        const { data: tagData } = await supabase
          .from('lot_compliance_tags')
          .select('tag_id, compliance_tags(*)')
          .eq('lot_id', id);
        
        const lotWithTags = {
          ...data,
          compliance_tags: tagData?.map(t => t.compliance_tags as ComplianceTag) ?? []
        } as unknown as LotWithDetails;
        
        setLot(lotWithTags);
      }
    } catch (error) {
      console.error('Error fetching lot:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBids = async () => {
    const { data } = await supabase
      .from('bids')
      .select('*, profile:profiles(full_name)')
      .eq('lot_id', id)
      .order('amount', { ascending: false })
      .limit(10);
    
    if (data) {
      setBids(data as (Bid & { profile?: { full_name: string } })[]);
    }
  };

  const checkWatchlist = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('watchlist')
      .select('id')
      .eq('user_id', user.id)
      .eq('lot_id', id)
      .maybeSingle();
    
    setIsWatched(!!data);
  };

  const toggleWatchlist = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (isWatched) {
      await supabase.from('watchlist').delete().eq('user_id', user.id).eq('lot_id', id);
      setIsWatched(false);
    } else {
      await supabase.from('watchlist').insert({ user_id: user.id, lot_id: id });
      setIsWatched(true);
    }
  };

  const handleBid = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user is logged in
    if (!user) {
      navigate('/login');
      return;
    }
    
    // Check if user has completed onboarding
    if (!primaryOrg) {
      setBidError('Please complete your account setup first. Go to the Dashboard to set up your account.');
      return;
    }
    
    if (!lot) {
      setBidError('Lot not found');
      return;
    }

    setBidError('');
    setBidSuccess(false);
    
    const amount = parseFloat(bidAmount);
    const minBid = getMinNextBid(lot.current_bid ?? lot.start_price ?? 0);
    
    if (isNaN(amount) || amount < minBid) {
      setBidError(`Minimum bid is $${minBid.toLocaleString()}`);
      return;
    }

    setBidLoading(true);
    
    try {
      console.log('[Bid] Placing bid:', { lot_id: lot.id, amount, org_id: primaryOrg.id });
      
      // Use auction engine edge function for server-side validation
      const { data, error } = await supabase.functions.invoke('auction-engine', {
        body: {
          action: 'place-bid',
          lot_id: lot.id,
          amount,
          org_id: primaryOrg.id
        }
      });

      console.log('[Bid] Response:', { data, error });

      // Handle edge function invocation errors
      if (error) {
        console.error('[Bid] Edge function error:', error);
        setBidError(error.message || 'Failed to place bid. Please try again.');
        return;
      }
      
      // Handle application-level errors from the function
      if (data?.error) {
        console.log('[Bid] Application error:', data.error);
        setBidError(data.error);
        return;
      }

      // Success
      console.log('[Bid] Success:', data);
      setBidSuccess(true);
      setBidAmount('');
      
      // Refresh lot data
      fetchLot();
      fetchBids();
    } catch (error: any) {
      console.error('[Bid] Unexpected error:', error);
      setBidError('Network error. Please check your connection and try again.');
    } finally {
      setBidLoading(false);
    }
  };

  const handleBuyNow = async () => {
    if (!user || !primaryOrg || !lot) {
      navigate('/login');
      return;
    }

    // Create order with buyer fee (10%)
    try {
      const basePrice = lot.fixed_price!;
      const buyerFee = basePrice * 0.10; // 10% buyer fee
      const totalAmount = basePrice + buyerFee;

      const { error } = await supabase.from('orders').insert({
        buyer_id: user.id,
        buyer_org_id: primaryOrg.id,
        lot_id: lot.id,
        event_id: lot.event_id,
        amount: totalAmount, // Total including buyer fee
        status: 'pending_payment',
        notes: `Base price: $${basePrice.toFixed(2)}, Buyer fee (10%): $${buyerFee.toFixed(2)}`
      });

      if (error) throw error;

      // Update lot status
      await supabase.from('lots').update({ status: 'sold' }).eq('id', lot.id);

      navigate('/app/buyer/orders');
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!lot) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Lot not found</h1>
          <Button asChild>
            <Link to="/marketplace">Back to Marketplace</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const isAuction = lot.pricing_type === 'auction';
  const auctionEnded = isAuction && lot.auction_end ? isPast(parseISO(lot.auction_end)) : false;
  const condition = LOT_CONDITIONS.find(c => c.value === lot.condition);
  const currentPrice = isAuction ? (lot.current_bid ?? lot.start_price ?? 0) : (lot.fixed_price ?? 0);
  const minNextBid = getMinNextBid(currentPrice);
  const images = lot.media?.length > 0 ? lot.media.sort((a, b) => (a.is_primary ? -1 : b.is_primary ? 1 : a.sort_order - b.sort_order)) : [];
  const isOwnLot = !!primaryOrg && !!lot.event?.org_id && primaryOrg.id === lot.event.org_id;
  const reserveMet = !!lot.reserve_price && (lot.current_bid ?? 0) >= lot.reserve_price;

  return (
    <Layout>
      <div className="container py-6 md:py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <Button variant="ghost" size="sm" asChild className="gap-1 pl-0">
            <Link to="/marketplace">
              <ArrowLeft className="h-4 w-4" />
              Back to Marketplace
            </Link>
          </Button>
        </nav>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Images */}
          <div>
            <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden mb-4">
              {images.length > 0 ? (
                <>
                  <img
                    src={images[currentImageIndex].url}
                    alt={lot.title}
                    className="h-full w-full object-cover"
                  />
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentImageIndex(i => (i === 0 ? images.length - 1 : i - 1))}
                        className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </button>
                      <button
                        onClick={() => setCurrentImageIndex(i => (i === images.length - 1 ? 0 : i + 1))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
                      >
                        <ChevronRight className="h-6 w-6" />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Tag className="h-16 w-16 text-muted-foreground/40" />
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-colors ${
                      idx === currentImageIndex ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant={isAuction ? 'auction' : 'fixed'}>
                {isAuction ? (
                  <>
                    <Gavel className="h-3 w-3 mr-1" />
                    Auction
                  </>
                ) : (
                  'Buy Now'
                )}
              </Badge>
              {condition && (
                <Badge variant="success">{condition.label}</Badge>
              )}
              {lot.category && (
                <Badge variant="muted">{lot.category.name}</Badge>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              {lot.title}
            </h1>

            {/* Location & Event */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              {lot.event?.suburb && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {lot.event.suburb}, {lot.event.state}
                </span>
              )}
              {lot.event?.organization && (
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {lot.event.organization.name}
                </span>
              )}
            </div>

            {/* Price */}
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {isAuction ? (lot.current_bid ? 'Current Bid' : 'Starting Bid') : 'Price'}
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    ${currentPrice.toLocaleString()}
                  </p>
                </div>
                {isAuction && lot.bid_count > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {lot.bid_count} bid{lot.bid_count !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Auction Timer */}
              {isAuction && lot.auction_end && !auctionEnded && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>Ends {formatDistanceToNow(parseISO(lot.auction_end), { addSuffix: true })}</span>
                </div>
              )}
              
              {auctionEnded && (
                <p className="text-sm text-muted-foreground">Auction has ended</p>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-4 mb-6">
              {isAuction && !auctionEnded ? (
                <form onSubmit={handleBid} className="space-y-3">
                  {lot.reserve_price && (
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant={reserveMet ? 'success' : 'warning'}>
                        {reserveMet ? 'Reserve met' : 'Reserve not met'}
                      </Badge>
                    </div>
                  )}
                  {bidError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{bidError}</AlertDescription>
                    </Alert>
                  )}
                  {bidSuccess && (
                    <Alert className="border-success/20 bg-success/10">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <AlertDescription className="text-success">Bid placed successfully!</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder={`Min $${minNextBid.toLocaleString()}`}
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      min={minNextBid}
                      step={getBidIncrement(currentPrice)}
                      className="flex-1"
                      disabled={bidLoading || isOwnLot}
                    />
                    <Button type="submit" variant="hero" disabled={bidLoading || isOwnLot}>
                      {bidLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Place Bid'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isOwnLot
                      ? 'You cannot bid on your own listing.'
                      : `Bid increment: $${getBidIncrement(currentPrice)} • 10% buyer fee applies to winning bid`}
                  </p>
                </form>
              ) : !isAuction && lot.status === 'active' ? (
                <div className="space-y-2">
                  <Button variant="hero" size="lg" className="w-full" onClick={handleBuyNow} disabled={isOwnLot}>
                    Buy Now - ${((lot.fixed_price ?? 0) * 1.10).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    {isOwnLot ? 'This is your own listing.' : `Price $${(lot.fixed_price ?? 0).toLocaleString()} + 10% buyer fee`}
                  </p>
                </div>
              ) : null}

              {/* Message Seller */}
              {!isOwnLot && lot.event?.org_id && (
                <MessageSellerDialog
                  lotId={lot.id}
                  lotTitle={lot.title}
                  sellerOrgId={lot.event.org_id}
                />
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={toggleWatchlist}
                >
                  <Heart className={`h-4 w-4 ${isWatched ? 'fill-primary text-primary' : ''}`} />
                  {isWatched ? 'Watching' : 'Watch'}
                </Button>
                <Button variant="outline" size="icon">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Details */}
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Details</h2>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Quantity</p>
                  <p className="font-medium">{lot.quantity} {lot.unit}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Condition</p>
                  <p className="font-medium">{condition?.label}</p>
                </div>
                {lot.category && (
                  <div>
                    <p className="text-muted-foreground">Category</p>
                    <p className="font-medium">{lot.category.name}</p>
                  </div>
                )}
              </div>

              {lot.description && (
                <div>
                  <p className="text-muted-foreground text-sm mb-1">Description</p>
                  <p className="text-sm whitespace-pre-wrap">{lot.description}</p>
                </div>
              )}

              {lot.compliance_tags && lot.compliance_tags.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-sm mb-2">Compliance Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {lot.compliance_tags.map(tag => (
                      <Badge key={tag.id} variant="outline">{tag.name}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator className="my-6" />

            {/* Pickup Info */}
            {lot.event && (
              <div className="space-y-4">
                <h2 className="font-semibold text-lg">Pickup Information</h2>
                <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{lot.event.site_address}</p>
                      <p className="text-muted-foreground">{lot.event.suburb}, {lot.event.state} {lot.event.postcode}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Pickup Window</p>
                      <p className="text-muted-foreground">
                        {format(parseISO(lot.event.pickup_start), 'PPP')} - {format(parseISO(lot.event.pickup_end), 'PPP')}
                      </p>
                    </div>
                  </div>
                  {lot.event.access_notes && (
                    <p className="text-muted-foreground">{lot.event.access_notes}</p>
                  )}
                </div>
              </div>
            )}

            {/* Bid History */}
            {isAuction && bids.length > 0 && (
              <>
                <Separator className="my-6" />
                <div>
                  <h2 className="font-semibold text-lg mb-4">Bid History</h2>
                  <div className="space-y-2">
                    {bids.slice(0, 5).map((bid, idx) => (
                      <div
                        key={bid.id}
                        className={`flex justify-between items-center text-sm p-2 rounded ${idx === 0 ? 'bg-primary/10' : ''}`}
                      >
                        <span className="text-muted-foreground">
                          {bid.profile?.full_name ?? 'Anonymous'}
                        </span>
                        <span className={`font-medium ${idx === 0 ? 'text-primary' : ''}`}>
                          ${bid.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
