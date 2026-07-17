import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/layout/Layout';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  Building2, 
  Users,
  Package,
  Gavel,
  DollarSign,
  Truck,
  CheckCircle2,
  Clock,
  Shield
} from 'lucide-react';
import { BRAND } from '@/lib/constants';

export default function HowItWorks() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="hero-gradient">
        <div className="container py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <Badge variant="muted" className="mb-4">
              Step-by-Step Guide
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              How {BRAND.name} Works
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              A streamlined marketplace connecting construction sellers clearing sites with buyers seeking quality surplus materials.
            </p>
          </div>
        </div>
      </section>

      {/* For Sellers Section */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="flex items-center gap-3 mb-12">
            <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center">
              <Building2 className="h-6 w-6 text-secondary-foreground" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">For Sellers</h2>
              <p className="text-muted-foreground">Clear your construction site in one streamlined process</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl">
            <div className="dashboard-card relative">
              <div className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">1</div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Create a Clearance Event</h3>
              <p className="text-muted-foreground mb-4">
                Set up your site clearance event with location details and pickup windows. Define when buyers can collect their purchases.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Site address and suburb
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Pickup date and time window
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Site access notes (forklift, dock, etc.)
                </li>
              </ul>
            </div>

            <div className="dashboard-card relative">
              <div className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">2</div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Gavel className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">List Your Lots</h3>
              <p className="text-muted-foreground mb-4">
                Add items with photos and details. Choose fixed pricing for quick sales or auctions to maximize value.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Upload photos of materials
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Set prices or auction parameters
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Add compliance tags if applicable
                </li>
              </ul>
            </div>

            <div className="dashboard-card relative">
              <div className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">3</div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Truck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">One-Hit Clear Out</h3>
              <p className="text-muted-foreground mb-4">
                Buyers collect during your scheduled pickup window. Confirm pickups and get paid—site cleared efficiently.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Coordinated pickup schedule
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Confirm collections in-app
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Get paid minus 10% seller fee
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8">
            <Button size="lg" variant="hero" asChild>
              <Link to="/app">
                Start Selling
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* For Buyers Section */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container">
          <div className="flex items-center gap-3 mb-12">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <Users className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">For Buyers</h2>
              <p className="text-muted-foreground">Find quality construction materials at great prices</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl">
            <div className="dashboard-card relative">
              <div className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">1</div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Browse & Search</h3>
              <p className="text-muted-foreground mb-4">
                Explore hundreds of lots across categories. Filter by location, material type, and condition.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Search by category
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Filter by suburb/location
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Save to watchlist
                </li>
              </ul>
            </div>

            <div className="dashboard-card relative">
              <div className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">2</div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Bid or Buy Now</h3>
              <p className="text-muted-foreground mb-4">
                Place bids on auctions or purchase fixed-price items instantly. Our anti-sniping protection ensures fair bidding.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Place secure bids
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Soft-close auction protection
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  10% buyer fee included
                </li>
              </ul>
            </div>

            <div className="dashboard-card relative">
              <div className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">3</div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Truck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Collect Your Items</h3>
              <p className="text-muted-foreground mb-4">
                Win an auction or complete purchase, then pick up during the seller's scheduled window.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Book pickup time slot
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Site access instructions
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Confirm collection
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8">
            <Button size="lg" variant="hero" asChild>
              <Link to="/marketplace">
                Browse Marketplace
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Fees Section */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Simple, Transparent Fees
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We charge a flat 10% fee to both buyers and sellers. No hidden costs, no subscription fees.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <div className="dashboard-card text-center">
              <div className="h-14 w-14 mx-auto mb-4 rounded-xl bg-secondary flex items-center justify-center">
                <Building2 className="h-7 w-7 text-secondary-foreground" />
              </div>
              <h3 className="text-2xl font-bold mb-2">10%</h3>
              <p className="text-lg font-medium mb-2">Seller Fee</p>
              <p className="text-sm text-muted-foreground">
                Deducted from your sale proceeds when items are collected
              </p>
            </div>

            <div className="dashboard-card text-center">
              <div className="h-14 w-14 mx-auto mb-4 rounded-xl bg-primary flex items-center justify-center">
                <Users className="h-7 w-7 text-primary-foreground" />
              </div>
              <h3 className="text-2xl font-bold mb-2">10%</h3>
              <p className="text-lg font-medium mb-2">Buyer Fee</p>
              <p className="text-sm text-muted-foreground">
                Added to your purchase price at checkout
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Why Trust {BRAND.name}?
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="h-14 w-14 mx-auto mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Verified Sellers</h3>
              <p className="text-sm text-muted-foreground">
                All sellers are verified Australian construction businesses with ABN registration
              </p>
            </div>

            <div className="text-center">
              <div className="h-14 w-14 mx-auto mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
                <Gavel className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Fair Auctions</h3>
              <p className="text-sm text-muted-foreground">
                Anti-sniping soft-close protection extends auctions if bids come in the final minute
              </p>
            </div>

            <div className="text-center">
              <div className="h-14 w-14 mx-auto mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
                <Clock className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Scheduled Pickups</h3>
              <p className="text-sm text-muted-foreground">
                Coordinated pickup windows make collection efficient for everyone involved
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
              Join hundreds of construction professionals already using {BRAND.name}.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="xl" variant="hero" asChild>
                <Link to="/signup">
                  Create Account
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" className="border-secondary/20 text-secondary hover:bg-secondary/10" asChild>
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
