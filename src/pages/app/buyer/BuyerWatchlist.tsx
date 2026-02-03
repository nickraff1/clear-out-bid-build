import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { LotCard } from '@/components/lots/LotCard';
import { Heart, Loader2, Trash2 } from 'lucide-react';
import type { Watchlist, Lot, LotMedia, ClearanceEvent, Category } from '@/types/database';

type WatchlistItem = Watchlist & {
  lot: Lot & {
    media?: LotMedia[];
    event?: ClearanceEvent;
    category?: Category | null;
  };
};

export default function BuyerWatchlist() {
  const { user } = useAuth();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchWatchlist();
    }
  }, [user]);

  const fetchWatchlist = async () => {
    try {
      const { data } = await supabase
        .from('watchlist')
        .select(`
          *,
          lot:lots(
            *,
            media:lot_media(*),
            event:clearance_events(*),
            category:categories(*)
          )
        `)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (data) {
        setItems(data as WatchlistItem[]);
      }
    } finally {
      setLoading(false);
    }
  };

  const removeFromWatchlist = async (id: string) => {
    await supabase.from('watchlist').delete().eq('id', id);
    setItems(items.filter(i => i.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Watchlist</h1>
        <p className="text-muted-foreground">
          Items you're keeping an eye on
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Heart className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Your watchlist is empty</h2>
          <p className="text-muted-foreground mb-4">
            Browse the marketplace and add items you're interested in.
          </p>
          <Button asChild>
            <Link to="/marketplace">Browse Marketplace</Link>
          </Button>
        </div>
      ) : (
        <div className="marketplace-grid">
          {items.map(item => (
            <div key={item.id} className="relative">
              <LotCard lot={item.lot} />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  removeFromWatchlist(item.id);
                }}
                className="absolute top-3 right-3 h-8 w-8 rounded-full bg-background/80 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors z-10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
