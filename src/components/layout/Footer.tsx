import { Link } from 'react-router-dom';
import { BRAND } from '@/lib/constants';
import offcuttLogo from '@/assets/offcutt-logo.svg.asset.json';

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4" aria-label={BRAND.name}>
              <img src={offcuttLogo.url} alt={`${BRAND.name} logo`} className="h-8 w-auto" />
            </Link>
            <p className="text-sm text-muted-foreground">
              {BRAND.description}
            </p>
          </div>

          {/* Marketplace */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Marketplace</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/marketplace" className="text-sm text-muted-foreground hover:text-foreground">
                  Browse All
                </Link>
              </li>
              <li>
                <Link to="/marketplace?type=auction" className="text-sm text-muted-foreground hover:text-foreground">
                  Live Auctions
                </Link>
              </li>
              <li>
                <Link to="/marketplace?type=fixed" className="text-sm text-muted-foreground hover:text-foreground">
                  Buy Now
                </Link>
              </li>
              <li>
                <Link to="/marketplace" className="text-sm text-muted-foreground hover:text-foreground">
                  Categories
                </Link>
              </li>
            </ul>
          </div>

          {/* Sellers */}
          <div>
            <h4 className="font-semibold text-sm mb-3">For Sellers</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/for-sellers" className="text-sm text-muted-foreground hover:text-foreground">
                  Start Selling
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="text-sm text-muted-foreground hover:text-foreground">
                  How It Works
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Support</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/help" className="text-sm text-muted-foreground hover:text-foreground">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-sm text-muted-foreground hover:text-foreground">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/prohibited-materials" className="text-sm text-muted-foreground hover:text-foreground">
                  Prohibited Materials
                </Link>
              </li>
              <li>
                <Link to="/pickup-safety" className="text-sm text-muted-foreground hover:text-foreground">
                  Pickup Safety
                </Link>
              </li>
              <li>
                <Link to="/refunds-and-disputes" className="text-sm text-muted-foreground hover:text-foreground">
                  Refunds &amp; Disputes
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Made in Australia 🇦🇺
          </p>
        </div>
      </div>
    </footer>
  );
}
