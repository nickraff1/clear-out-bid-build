import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Package,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Star,
  Flag,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Lot, LotMedia, ClearanceEvent, Category, ComplianceTag, Bid, Organization } from '@/types/database';
import { LOT_CONDITIONS, getMinNextBid, getBidIncrement } from '@/lib/constants';
import { formatDistanceToNow, isPast, parseISO, format } from 'date-fns';
import { MessageSellerDialog } from '@/components/messaging/MessageSellerDialog';
import { ReportLotDialog } from '@/components/lots/ReportLotDialog';
import { ListingSafetyNotice } from '@/components/safety/SafetyNotice';
import { CountdownTimer } from '@/components/lots/CountdownTimer';
import { useBidEligibility, reasonCopy, acceptAuctionTerms } from '@/lib/bidder';
import { authorizeBidDeposit } from '@/lib/bidder';
import { AddPaymentMethodDialog } from '@/components/bidder/AddPaymentMethodDialog';
import { toast } from 'sonner';

type LotWithDetails = Lot & {
  media: LotMedia[];
  event: ClearanceEvent & { organization?: Organization };
  category: Category | null;
  compliance_tags: ComplianceTag[];
};

export default function LotDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, primaryOrg, refreshProfile } = useAuth();
  
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

  const { eligibility, refresh: refreshEligibility } = useBidEligibility(id);
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const [settingUpAccount, setSettingUpAccount] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [authorizingDeposit, setAuthorizingDeposit] = useState(false);

  const handleAuthorizeDeposit = async () => {
    if (!id) return;
    setAuthorizingDeposit(true);
    const { data, error } = await authorizeBidDeposit(id);
    setAuthorizingDeposit(false);
    if (error) { toast.error(error.message || 'Could not authorize deposit'); return; }
    if (data?.scaffolded) {
      toast.warning('Deposit could not be authorized by the sandbox gateway. Offcutt ops will follow up.');
      return;
    }
    if (!data?.ok) { toast.error(data?.error || 'Deposit authorization failed'); return; }
    toast.success(data?.reused ? 'Existing deposit covers this tier' : `Deposit of $${data.amount} authorized`);
    refreshEligibility();
  };

  const ensureBuyerAccount = async (): Promise<boolean> => {
    if (!user) { navigate('/login'); return false; }
    if (primaryOrg) return true;
    setSettingUpAccount(true);
    try {
      const orgName = profile?.full_name ? `${profile.full_name}'s Account` : 'My Account';
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: orgName, org_type: 'buyer', email: profile?.email || user.email, is_approved: true })
        .select()
        .single();
      if (orgError) throw orgError;
      const { error: memberError } = await supabase
        .from('org_members')
        .insert({ org_id: org.id, user_id: user.id, is_primary: true });
      if (memberError) throw memberError;
      // Only insert buyer role if user has no role yet
      const { data: existingRoles } = await supabase
        .from('user_roles').select('role').eq('user_id', user.id);
      if (!existingRoles || existingRoles.length === 0) {
        await supabase.from('user_roles').insert({ user_id: user.id, role: 'buyer_admin' });
      }
      localStorage.setItem(`onboarding_complete_${user.id}`, 'true');
      localStorage.setItem(`user_role_${user.id}`, 'buyer');
      await refreshProfile();
      toast.success('Bidding account ready');
      return true;
    } catch (e: any) {
      console.error('[Setup] Failed to create buyer account', e);
      toast.error(e?.message || 'Could not set up bidding account');
      return false;
    } finally {
      setSettingUpAccount(false);
    }
  };

  const handleAcceptTerms = async () => {
    if (!primaryOrg && !(await ensureBuyerAccount())) return;
    setAcceptingTerms(true);
    const { error } = await acceptAuctionTerms();
    setAcceptingTerms(false);
    if (error) { toast.error('Could not save terms acceptance'); return; }
    toast.success('Auction terms accepted');
    refreshEligibility();
  };

  useEffect(() => {
    if (id) {
      // Best-effort: release any expired reservations before fetching.
      supabase.rpc('release_expired_reservations').then(() => fetchLot());
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
    
    // Auto-create a personal bidding account if missing.
    if (!primaryOrg) {
      const ok = await ensureBuyerAccount();
      if (!ok) return;
      setBidError('Account ready — tap Place bid again to confirm.');
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

    // Create order with 5% buyer fee, then go to Stripe checkout
    try {
      const basePrice = lot.fixed_price!;
      const buyerFee = Math.round(basePrice * 0.10 * 100) / 100;
      const totalAmount = Math.round((basePrice + buyerFee) * 100) / 100;

      const { data: created, error } = await supabase.from('orders').insert({
        buyer_id: user.id,
        buyer_org_id: primaryOrg.id,
        lot_id: lot.id,
        event_id: lot.event_id,
        amount: totalAmount,
        status: 'pending_payment',
        notes: `Base price: $${basePrice.toFixed(2)}, Buyer fee (10%): $${buyerFee.toFixed(2)}`
      }).select('id').single();

      if (error) throw error;

      // Reserve the lot for 30 minutes while payment is in progress
      const reservedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await supabase
        .from('lots')
        .update({
          status: 'reserved',
          reserved_order_id: created!.id,
          reserved_until: reservedUntil,
        })
        .eq('id', lot.id);

      navigate(`/app/buyer/checkout/${created!.id}`);
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
          <h1 className="text-2xl font-bold mb-4">Listing not found</h1>
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
  const bidIncrement = getBidIncrement(currentPrice);
  const statusLabel = lot.status.charAt(0).toUpperCase() + lot.status.slice(1).replace(/_/g, ' ');

  // Stable anonymous alias per bidder per lot
  const bidderAlias = (bidderId: string, isYou: boolean) => {
    if (isYou) return 'You';
    const ids = Array.from(new Set(bids.map(b => b.user_id)));
    const idx = ids.indexOf(bidderId);
    return `Bidder #${(idx >= 0 ? idx : 0) + 1}`;
  };

  return (
    <>
    <Layout>
      <div className="container py-6 md:py-8">
        <Link to="/marketplace" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to marketplace
        </Link>

        {(lot.status === 'sold' || lot.status === 'reserved' || lot.status === 'cancelled') && (
          <div className="mt-4 p-4 rounded-lg border border-border bg-muted/40 text-sm flex items-center gap-3">
            <Package className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-base font-semibold">
                {lot.status === 'sold'
                  ? 'This item has been sold'
                  : lot.status === 'reserved'
                    ? 'Currently in checkout with another buyer'
                    : 'This item is no longer available'}
              </div>
              <div className="text-xs text-muted-foreground">
                {lot.status === 'reserved'
                  ? "Another buyer is in checkout. Check back if their payment doesn't complete."
                  : 'It is no longer available to buy or bid on.'}
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 mt-4">
          {/* PHOTOS + DESCRIPTION */}
          <div>
            <div className="relative aspect-[4/3] bg-secondary rounded-xl overflow-hidden">
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
                <div className="w-full h-full grid place-items-center text-muted-foreground text-3xl font-semibold">
                  {lot.category?.name ?? 'Surplus'}
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="grid grid-cols-5 gap-2 mt-3">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`aspect-square rounded-md overflow-hidden border transition-colors ${
                      idx === currentImageIndex ? 'border-primary' : 'border-border hover:border-muted-foreground/40'
                    }`}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Description + stats */}
            <div className="mt-6 space-y-4">
              <div>
                <h3 className="text-xl font-semibold mb-2">Description</h3>
                <p className="whitespace-pre-line text-foreground/90 text-sm leading-relaxed">
                  {lot.description || 'No description provided.'}
                </p>
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Stat label="Condition" value={condition?.label ?? '—'} />
                <Stat label="Quantity" value={`${lot.quantity} ${lot.unit}`} />
                <Stat label="Category" value={lot.category?.name ?? '—'} />
                <Stat label="Status" value={statusLabel} />
              </dl>

              {lot.compliance_tags && lot.compliance_tags.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Compliance</p>
                  <div className="flex flex-wrap gap-2">
                    {lot.compliance_tags.map(tag => (
                      <Badge key={tag.id} variant="outline">{tag.name}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Pickup */}
              {lot.event && (
                <div className="pt-2">
                  <h3 className="text-xl font-semibold mb-3">Pickup</h3>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{lot.event.suburb}, {lot.event.state} {lot.event.postcode}</p>
                        <p className="text-xs text-muted-foreground">Exact address shared after payment is confirmed.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Pickup window</p>
                        <p className="text-muted-foreground">
                          {format(parseISO(lot.event.pickup_start), 'PPP')} – {format(parseISO(lot.event.pickup_end), 'PPP')}
                        </p>
                      </div>
                    </div>
                    {lot.event.access_notes && (
                      <p className="text-muted-foreground">{lot.event.access_notes}</p>
                    )}
                  </div>
                  <div className="mt-3">
                    <ListingSafetyNotice />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SIDEBAR */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {lot.event?.suburb}, {lot.event?.state} · Pickup only
              </div>
              <h1 className="text-3xl font-bold mt-2 leading-tight">{lot.title}</h1>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant={isAuction ? 'auction' : 'fixed'}>
                  {isAuction ? <><Gavel className="h-3 w-3 mr-1" />Auction</> : 'Buy now'}
                </Badge>
                {condition && <Badge variant="success">{condition.label}</Badge>}
                {lot.category && <Badge variant="muted">{lot.category.name}</Badge>}
              </div>
            </div>

            {/* Price + action card */}
            <Card>
              <CardContent className="p-5 space-y-4">
                {isAuction ? (
                  <>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        {lot.current_bid ? 'Current bid' : 'Starting at'}
                      </div>
                      <div className="text-4xl font-bold text-primary tabular-nums">
                        ${currentPrice.toLocaleString()}
                      </div>
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground mt-1">
                        {lot.reserve_price ? (
                          <span className={reserveMet ? 'text-success' : ''}>
                            {reserveMet ? 'Reserve met' : 'Reserve not yet met'}
                          </span>
                        ) : (
                          <span className="text-success">No reserve</span>
                        )}
                        <span>· {lot.bid_count ?? 0} bid{(lot.bid_count ?? 0) === 1 ? '' : 's'}</span>
                        <span>· Increment ${bidIncrement.toLocaleString()}</span>
                      </div>
                    </div>

                    {!auctionEnded ? (
                      <div className="text-sm flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>Ends in</span>
                        <CountdownTimer endsAt={lot.auction_end} />
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Auction ended {lot.auction_end && formatDistanceToNow(parseISO(lot.auction_end), { addSuffix: true })}
                      </div>
                    )}

                    {!auctionEnded && lot.status === 'active' && !isOwnLot ? (
                      <form onSubmit={handleBid} className="space-y-2">
                        {user && !primaryOrg && (
                          <Alert className="border-primary/30 bg-primary/5">
                            <AlertCircle className="h-4 w-4 text-primary" />
                            <AlertDescription className="space-y-2">
                              <div className="font-medium">Verify your details to start bidding</div>
                              <div className="text-xs text-muted-foreground">
                                One tap — we'll set up your buyer account so you can place bids.
                              </div>
                              <Button type="button" size="sm" onClick={ensureBuyerAccount} disabled={settingUpAccount}>
                                {settingUpAccount ? 'Setting up…' : 'Set up buyer account'}
                              </Button>
                            </AlertDescription>
                          </Alert>
                        )}
                        {primaryOrg && eligibility && !eligibility.allowed && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="space-y-2">
                              <div className="font-medium">{reasonCopy(eligibility.reason).title}</div>
                              <div className="text-xs">{reasonCopy(eligibility.reason).body}</div>
                              {eligibility.reason === 'terms_acceptance_required' && (
                                <Button type="button" size="sm" variant="secondary"
                                  onClick={handleAcceptTerms} disabled={acceptingTerms}>
                                  {acceptingTerms ? 'Saving…' : 'Accept auction terms'}
                                </Button>
                              )}
                              {eligibility.reason === 'verification_required' && (
                                <Button type="button" size="sm" variant="secondary"
                                  onClick={handleAcceptTerms} disabled={acceptingTerms}>
                                  {acceptingTerms ? 'Saving…' : 'Verify & accept terms'}
                                </Button>
                              )}
                              {eligibility.reason === 'payment_method_required' && (
                                <Button type="button" size="sm" variant="secondary"
                                  onClick={() => setShowAddPayment(true)}>
                                  Add payment method
                                </Button>
                              )}
                              {eligibility.reason === 'deposit_required' && (
                                <Button type="button" size="sm" variant="secondary"
                                  onClick={handleAuthorizeDeposit} disabled={authorizingDeposit}>
                                  {authorizingDeposit
                                    ? 'Authorizing…'
                                    : `Authorize $${eligibility.required_deposit} deposit`}
                                </Button>
                              )}
                            </AlertDescription>
                          </Alert>
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
                            <AlertDescription className="text-success">Bid placed.</AlertDescription>
                          </Alert>
                        )}
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder={`Min $${minNextBid.toLocaleString()}`}
                            value={bidAmount}
                            onChange={(e) => setBidAmount(e.target.value)}
                            min={minNextBid}
                            step={bidIncrement}
                            className="flex-1"
                            disabled={bidLoading || (eligibility ? !eligibility.allowed : false)}
                          />
                          <Button type="submit" size="lg"
                            disabled={bidLoading || !primaryOrg || (eligibility ? !eligibility.allowed : false)}>
                            {bidLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Gavel className="h-4 w-4 mr-1.5" />Place bid</>}
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          By bidding you commit to buy if you win. Bids in the final 5 minutes may extend the auction (anti-snipe). 10% buyer fee added at checkout.{' '}
                          <Link to="/auction-terms" className="underline hover:text-primary">See auction terms</Link>.
                        </p>
                      </form>
                    ) : (
                      <Button className="w-full" size="lg" disabled>
                        {isOwnLot ? "You're the seller" : auctionEnded ? 'Auction ended' : `Not available — ${statusLabel}`}
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Buy now</div>
                      <div className="text-4xl font-bold text-primary tabular-nums">
                        ${(lot.fixed_price ?? 0).toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">+ 10% buyer fee at checkout</p>
                    </div>
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={handleBuyNow}
                      disabled={isOwnLot || lot.status !== 'active'}
                    >
                      {lot.status === 'active' ? `Buy now · $${((lot.fixed_price ?? 0) * 1.1).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `Not available — ${statusLabel}`}
                    </Button>
                  </>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={toggleWatchlist}>
                    <Heart className={`h-4 w-4 mr-2 ${isWatched ? 'fill-primary text-primary' : ''}`} />
                    {isWatched ? 'Saved' : 'Save'}
                  </Button>
                  {!isOwnLot && lot.event?.org_id ? (
                    <MessageSellerDialog
                      lotId={lot.id}
                      lotTitle={lot.title}
                      sellerOrgId={lot.event.org_id}
                    />
                  ) : (
                    <Button variant="outline" size="icon" className="w-full">
                      <Share2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground flex items-start gap-2 pt-2 border-t border-border">
                  <Package className="h-4 w-4 mt-0.5 shrink-0" />
                  Exact pickup address is shared after payment is confirmed.
                </p>
              </CardContent>
            </Card>

            {/* Seller card */}
            {lot.event?.organization && (
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">{lot.event.organization.name}</div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        {(lot.event.organization as any).is_verified && (
                          <span className="flex items-center gap-1 text-success">
                            <ShieldCheck className="h-4 w-4" />Verified
                          </span>
                        )}
                        {(lot.event.organization as any).is_founding && (
                          <span className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-primary" />Founding seller
                          </span>
                        )}
                      </div>
                    </div>
                    {(lot.event.organization as any).rating_count > 0 && (
                      <div className="text-right text-sm">
                        <div className="font-semibold">★ {Number((lot.event.organization as any).rating_avg ?? 0).toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground">{(lot.event.organization as any).rating_count} reviews</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Bid history */}
            {isAuction && (
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Gavel className="h-4 w-4" /> Bid history
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {bids.length} bid{bids.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {bids.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No bids yet — be the first.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {bids.map((b, idx) => {
                        const isYou = !!user && b.user_id === user.id;
                        return (
                          <li key={b.id} className="flex items-center justify-between py-2 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={isYou ? 'font-medium text-primary' : 'text-foreground/80'}>
                                {bidderAlias(b.user_id, isYou)}
                              </span>
                              {idx === 0 && !auctionEnded && (
                                <Badge variant="outline" className="text-[10px] border-success text-success">Winning</Badge>
                              )}
                              {idx === 0 && auctionEnded && (
                                <Badge variant="outline" className="text-[10px] border-success text-success">Won</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(parseISO(b.created_at), { addSuffix: true })}
                              </span>
                              <span className="font-semibold tabular-nums">${b.amount.toLocaleString()}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}

            {!isOwnLot && (
              <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                <span><ReportLotDialog lotId={lot.id} /></span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Layout>
      {/* Payment method dialog (rendered outside layout grid) */}
      <AddPaymentMethodDialog
        open={showAddPayment}
        onOpenChange={setShowAddPayment}
        onSaved={() => { refreshEligibility(); toast.success('Card saved. You can now place bids.'); }}
      />
      </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
