import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/layout/Layout';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  Package, 
  Clock, 
  Truck, 
  Shield, 
  Users,
  Gavel,
  Building2,
  CheckCircle2
} from 'lucide-react';
import { BRAND, DEFAULT_CATEGORIES } from '@/lib/constants';

export default function Index() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="hero-gradient">
        <div className="container py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <Badge variant="muted" className="mb-4">
              🇦🇺 Australia's Construction Surplus Marketplace
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Buy & Sell Construction{' '}
              <span className="text-gradient-orange">Surplus</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              {BRAND.description} One-hit clearance events for builders, 
              quality materials at great prices for buyers.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="xl" variant="hero" asChild>
                <Link to="/marketplace">
                  Browse Marketplace
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button size="xl" variant="hero-outline" asChild>
                <Link to="/for-sellers">
                  Start Selling
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-border bg-muted/30">
        <div className="container py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-foreground">500+</p>
              <p className="text-sm text-muted-foreground mt-1">Active Lots</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-foreground">150+</p>
              <p className="text-sm text-muted-foreground mt-1">Verified Sellers</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-foreground">$2M+</p>
              <p className="text-sm text-muted-foreground mt-1">Materials Sold</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-foreground">98%</p>
              <p className="text-sm text-muted-foreground mt-1">Satisfaction Rate</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              How {BRAND.name} Works
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A streamlined process for both sellers clearing sites and buyers finding quality materials
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* For Sellers */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-secondary-foreground" />
                </div>
                <h3 className="text-xl font-semibold">For Sellers</h3>
              </div>
              
              <div className="space-y-4 stagger-children">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">1</div>
                  <div>
                    <h4 className="font-medium mb-1">Create a Clearance Event</h4>
                    <p className="text-sm text-muted-foreground">Set your site location and pickup window</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">2</div>
                  <div>
                    <h4 className="font-medium mb-1">List Your Lots</h4>
                    <p className="text-sm text-muted-foreground">Add items with photos - auction or fixed price</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">3</div>
                  <div>
                    <h4 className="font-medium mb-1">One-Hit Clear Out</h4>
                    <p className="text-sm text-muted-foreground">Buyers collect during your scheduled window</p>
                  </div>
                </div>
              </div>
            </div>

            {/* For Buyers */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold">For Buyers</h3>
              </div>
              
              <div className="space-y-4 stagger-children">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">1</div>
                  <div>
                    <h4 className="font-medium mb-1">Browse & Search</h4>
                    <p className="text-sm text-muted-foreground">Filter by category, location, and price</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">2</div>
                  <div>
                    <h4 className="font-medium mb-1">Bid or Buy Now</h4>
                    <p className="text-sm text-muted-foreground">Win auctions or purchase at fixed prices</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">3</div>
                  <div>
                    <h4 className="font-medium mb-1">Collect Your Items</h4>
                    <p className="text-sm text-muted-foreground">Pick up during the seller's window</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Browse by Category
            </h2>
            <p className="text-muted-foreground">
              Find quality surplus materials across all construction categories
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {DEFAULT_CATEGORIES.slice(0, 12).map((category) => (
              <Link
                key={category.slug}
                to={`/marketplace?category=${category.slug}`}
                className="dashboard-card hover:border-primary/20 transition-all text-center group"
              >
                <div className="h-12 w-12 mx-auto mb-3 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Package className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm font-medium">{category.name}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Why Choose {BRAND.name}?
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="dashboard-card text-center">
              <div className="h-14 w-14 mx-auto mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
                <Gavel className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Fair Auctions</h3>
              <p className="text-sm text-muted-foreground">
                Transparent bidding with anti-sniping protection ensures fair outcomes for everyone
              </p>
            </div>

            <div className="dashboard-card text-center">
              <div className="h-14 w-14 mx-auto mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Verified Quality</h3>
              <p className="text-sm text-muted-foreground">
                All items listed with condition ratings and compliance documentation
              </p>
            </div>

            <div className="dashboard-card text-center">
              <div className="h-14 w-14 mx-auto mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
                <Truck className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Easy Pickup</h3>
              <p className="text-sm text-muted-foreground">
                Coordinated pickup slots make collection simple for buyers and sellers
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-secondary">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-secondary-foreground mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-secondary-foreground/80 mb-8">
              Join hundreds of builders and buyers already using {BRAND.name} to buy and sell construction surplus.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="xl" variant="hero" asChild>
                <Link to="/signup">
                  Create Account
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" className="border-secondary-foreground/20 text-secondary-foreground hover:bg-secondary-foreground/10" asChild>
                <Link to="/marketplace">
                  Browse Marketplace
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
