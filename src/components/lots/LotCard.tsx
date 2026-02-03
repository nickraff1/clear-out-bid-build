import { Link } from 'react-router-dom';
import { Clock, MapPin, Gavel, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Lot, LotMedia, ClearanceEvent, Category } from '@/types/database';
import { formatDistanceToNow, isPast, parseISO } from 'date-fns';
import { LOT_CONDITIONS } from '@/lib/constants';

interface LotCardProps {
  lot: Lot & {
    media?: LotMedia[];
    event?: ClearanceEvent;
    category?: Category | null;
  };
}

export function LotCard({ lot }: LotCardProps) {
  const primaryImage = lot.media?.find(m => m.is_primary)?.url ?? lot.media?.[0]?.url;
  const condition = LOT_CONDITIONS.find(c => c.value === lot.condition);
  
  const isAuction = lot.pricing_type === 'auction';
  const auctionEnded = isAuction && lot.auction_end ? isPast(parseISO(lot.auction_end)) : false;
  
  const displayPrice = isAuction 
    ? (lot.current_bid ?? lot.start_price ?? 0)
    : (lot.fixed_price ?? 0);

  const timeRemaining = lot.auction_end && !auctionEnded
    ? formatDistanceToNow(parseISO(lot.auction_end), { addSuffix: true })
    : null;

  return (
    <Link to={`/lot/${lot.id}`} className="block">
      <article className="lot-card group">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {primaryImage ? (
            <img
              src={primaryImage}
              alt={lot.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Tag className="h-12 w-12 text-muted-foreground/40" />
            </div>
          )}
          
          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
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
              <Badge variant="success">
                {condition.label}
              </Badge>
            )}
          </div>

          {/* Auction Timer */}
          {isAuction && timeRemaining && !auctionEnded && (
            <div className="absolute bottom-3 right-3">
              <div className="flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-md px-2 py-1 text-xs font-medium">
                <Clock className="h-3 w-3 text-primary" />
                <span className="auction-timer">{timeRemaining}</span>
              </div>
            </div>
          )}

          {auctionEnded && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <span className="text-lg font-semibold text-muted-foreground">Auction Ended</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Category & Location */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            {lot.category && (
              <span className="truncate">{lot.category.name}</span>
            )}
            {lot.event?.suburb && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3" />
                  {lot.event.suburb}
                </span>
              </>
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
            {lot.title}
          </h3>

          {/* Quantity */}
          {lot.quantity > 1 && (
            <p className="text-sm text-muted-foreground mb-3">
              Qty: {lot.quantity} {lot.unit}
            </p>
          )}

          {/* Price */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
                {isAuction ? (lot.current_bid ? 'Current Bid' : 'Starting Bid') : 'Price'}
              </p>
              <p className="text-xl font-bold text-foreground">
                ${displayPrice.toLocaleString()}
              </p>
            </div>
            {isAuction && lot.bid_count > 0 && (
              <p className="text-sm text-muted-foreground">
                {lot.bid_count} bid{lot.bid_count !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
