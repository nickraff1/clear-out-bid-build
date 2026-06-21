import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { LotCard } from '@/components/lots/LotCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, SlidersHorizontal, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Lot, LotMedia, ClearanceEvent, Category } from '@/types/database';
import { DEFAULT_CATEGORIES, AUSTRALIAN_STATES, LOT_CONDITIONS } from '@/lib/constants';

type LotWithDetails = Lot & {
  media?: LotMedia[];
  event?: ClearanceEvent;
  category?: Category | null;
};

export default function Marketplace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [lots, setLots] = useState<LotWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') ?? '');
  const [pricingType, setPricingType] = useState(searchParams.get('type') ?? '');
  const [stateFilter, setStateFilter] = useState(searchParams.get('state') ?? '');
  const [conditionFilter, setConditionFilter] = useState(searchParams.get('condition') ?? '');
  const [suburbFilter, setSuburbFilter] = useState(searchParams.get('suburb') ?? '');
  const [minPrice, setMinPrice] = useState(searchParams.get('min') ?? '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max') ?? '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') ?? 'newest');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLots();
  }, [categoryFilter, pricingType, stateFilter, conditionFilter, sortBy, minPrice, maxPrice]);

  const fetchLots = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('lots')
        .select(`
          *,
          media:lot_media(*),
          event:clearance_events(
            id, org_id, title, description,
            site_address, suburb, state, postcode,
            pickup_start, pickup_end, status
          ),
          category:categories(*)
        `)
        .eq('status', 'active');

      if (categoryFilter) {
        query = query.eq('category.slug', categoryFilter);
      }

      if (pricingType === 'auction' || pricingType === 'fixed') {
        query = query.eq('pricing_type', pricingType);
      }

      if (stateFilter) {
        query = query.eq('event.state', stateFilter);
      }

      if (suburbFilter.trim()) {
        query = query.ilike('event.suburb', `%${suburbFilter.trim()}%`);
      }

      if (conditionFilter) {
        query = query.eq('condition', conditionFilter as any);
      }

      const minP = parseFloat(minPrice);
      const maxP = parseFloat(maxPrice);
      if (!isNaN(minP)) {
        query = query.or(`fixed_price.gte.${minP},start_price.gte.${minP}`);
      }
      if (!isNaN(maxP)) {
        query = query.or(`fixed_price.lte.${maxP},start_price.lte.${maxP}`);
      }

      // Sorting
      switch (sortBy) {
        case 'price-low':
          query = query.order('fixed_price', { ascending: true, nullsFirst: false });
          break;
        case 'price-high':
          query = query.order('fixed_price', { ascending: false });
          break;
        case 'ending-soon':
          query = query.order('auction_end', { ascending: true, nullsFirst: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query.limit(50);

      if (error) {
        console.error('Error fetching lots:', error);
        setError('Could not load listings. Please try again.');
      } else {
        let filtered = (data as unknown as LotWithDetails[]) ?? [];
        if (search) {
          const searchLower = search.toLowerCase();
          filtered = filtered.filter(lot =>
            lot.title.toLowerCase().includes(searchLower) ||
            lot.description?.toLowerCase().includes(searchLower) ||
            lot.event?.suburb?.toLowerCase().includes(searchLower) ||
            lot.category?.name?.toLowerCase().includes(searchLower)
          );
        }
        setLots(filtered);
      }
    } catch (e) {
      console.error(e);
      setError('Something went wrong loading listings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (search) {
      params.set('q', search);
    } else {
      params.delete('q');
    }
    setSearchParams(params);
    fetchLots();
  };

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setPricingType('');
    setStateFilter('');
    setConditionFilter('');
    setSuburbFilter('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
    setSearchParams(new URLSearchParams());
  };

  const activeFiltersCount = [categoryFilter, pricingType, stateFilter, conditionFilter, suburbFilter, minPrice, maxPrice].filter(Boolean).length;

  return (
    <Layout>
      <div className="container py-6 md:py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Marketplace
          </h1>
          <p className="text-muted-foreground">
            Browse construction surplus from verified sellers across Australia
          </p>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search lots..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="sm:hidden"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="default" className="ml-2">{activeFiltersCount}</Badge>
              )}
            </Button>

            {/* Desktop Filters */}
            <div className="hidden sm:flex gap-2">
              <Select value={categoryFilter || 'all'} onValueChange={(v) => setCategoryFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {DEFAULT_CATEGORIES.map(cat => (
                    <SelectItem key={cat.slug} value={cat.slug}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={pricingType || 'all'} onValueChange={(v) => setPricingType(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Buy Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="auction">Auction</SelectItem>
                  <SelectItem value="fixed">Buy Now</SelectItem>
                </SelectContent>
              </Select>

              <Select value={stateFilter || 'all'} onValueChange={(v) => setStateFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {AUSTRALIAN_STATES.map(state => (
                    <SelectItem key={state.value} value={state.value}>{state.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="ending-soon">Ending Soon</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Secondary filter row (desktop) */}
        <div className="hidden sm:flex flex-wrap gap-2 mb-6">
          <Select value={conditionFilter || 'all'} onValueChange={(v) => setConditionFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Condition" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Condition</SelectItem>
              {LOT_CONDITIONS.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Suburb"
            value={suburbFilter}
            onChange={(e) => setSuburbFilter(e.target.value)}
            className="w-[160px]"
          />
          <Input
            type="number"
            placeholder="Min $"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-[110px]"
          />
          <Input
            type="number"
            placeholder="Max $"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-[110px]"
          />
        </div>

        {/* Mobile Filters Panel */}
        {showFilters && (
          <div className="sm:hidden mb-6 p-4 bg-muted/50 rounded-lg space-y-3">
            <Select value={categoryFilter || 'all'} onValueChange={(v) => setCategoryFilter(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {DEFAULT_CATEGORIES.map(cat => (
                  <SelectItem key={cat.slug} value={cat.slug}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={pricingType || 'all'} onValueChange={(v) => setPricingType(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Buy Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="auction">Auction</SelectItem>
                <SelectItem value="fixed">Buy Now</SelectItem>
              </SelectContent>
            </Select>

            <Select value={stateFilter || 'all'} onValueChange={(v) => setStateFilter(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {AUSTRALIAN_STATES.map(state => (
                  <SelectItem key={state.value} value={state.value}>{state.value}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="ending-soon">Ending Soon</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={conditionFilter || 'all'} onValueChange={(v) => setConditionFilter(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Condition</SelectItem>
                {LOT_CONDITIONS.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Suburb" value={suburbFilter} onChange={(e) => setSuburbFilter(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Min $" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
              <Input type="number" placeholder="Max $" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
            </div>

            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Active Filters */}
        {activeFiltersCount > 0 && (
          <div className="hidden sm:flex items-center gap-2 mb-6">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {categoryFilter && (
              <Badge variant="secondary" className="gap-1">
                {DEFAULT_CATEGORIES.find(c => c.slug === categoryFilter)?.name}
                <button onClick={() => setCategoryFilter('')}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {pricingType && (
              <Badge variant="secondary" className="gap-1">
                {pricingType === 'auction' ? 'Auction' : 'Buy Now'}
                <button onClick={() => setPricingType('')}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {stateFilter && (
              <Badge variant="secondary" className="gap-1">
                {stateFilter}
                <button onClick={() => setStateFilter('')}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear All
            </Button>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : lots.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No lots found</h2>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search or filters to find what you're looking for.
            </p>
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Showing {lots.length} lot{lots.length !== 1 ? 's' : ''}
            </p>
            <div className="marketplace-grid">
              {lots.map(lot => (
                <LotCard key={lot.id} lot={lot} />
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
