import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

export default function Pricing() {
  return (
    <Layout>
      <div className="container max-w-4xl py-12 space-y-10">
        <header className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">Simple, transparent pricing</h1>
          <p className="text-muted-foreground">
            No subscriptions. No listing fees. You only pay when something sells.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-semibold">For buyers</h2>
              <p className="text-4xl font-bold text-primary">10%</p>
              <p className="text-sm text-muted-foreground">Buyer service fee added at checkout.</p>
              <ul className="space-y-2 text-sm">
                <Bullet>Secure payment held until pickup is confirmed</Bullet>
                <Bullet>Pickup code protects you from paying for items you can't collect</Bullet>
                <Bullet>Dispute support from the Offcutt team</Bullet>
              </ul>
              <Button asChild className="w-full"><Link to="/marketplace">Browse marketplace</Link></Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-semibold">For sellers</h2>
              <p className="text-4xl font-bold text-primary">10%</p>
              <p className="text-sm text-muted-foreground">Commission on items that actually sell.</p>
              <ul className="space-y-2 text-sm">
                <Bullet>Free to list — pay nothing if nothing sells</Bullet>
                <Bullet>Buyers prepay before pickup — no chasing payment</Bullet>
                <Bullet>Bulk upload, auction or buy-now, and pickup coordination built in</Bullet>
              </ul>
              <Button asChild className="w-full" variant="secondary"><Link to="/for-sellers">Start selling</Link></Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-sm text-muted-foreground text-center">
          Questions on fees? Email <a href="mailto:support@offcutt.com.au" className="text-primary hover:underline">support@offcutt.com.au</a>.
        </div>
      </div>
    </Layout>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}