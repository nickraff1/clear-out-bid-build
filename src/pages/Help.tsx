import { Layout } from '@/components/layout/Layout';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';

const TOPICS = [
  { title: 'How buying works', body: 'Browse listings, place a bid or buy now, pay through Offcutt, then collect at the seller\'s site using your pickup code.', to: '/how-it-works' },
  { title: 'Pickup & safety', body: 'Pickups happen on private sites. Read our pickup safety guidance before collecting.', to: '/pickup-safety' },
  { title: 'Refunds & disputes', body: 'Items are sold as-is. If something is materially not as described, open a report from the order page.', to: '/refunds-and-disputes' },
  { title: 'Auction terms', body: 'Bids are binding. Understand deposits, default policy and anti-snipe extensions.', to: '/auction-terms' },
  { title: 'Prohibited materials', body: 'Asbestos, hazardous chemicals and contaminated materials are never permitted on Offcutt.', to: '/prohibited-materials' },
  { title: 'Pricing & fees', body: 'See the buyer and seller fee model.', to: '/pricing' },
];

export default function Help() {
  return (
    <Layout>
      <div className="container max-w-4xl py-12 space-y-8">
        <header>
          <h1 className="text-3xl font-bold mb-2">Help centre</h1>
          <p className="text-muted-foreground">
            Quick answers for buyers and sellers. Can't find what you need? Email{' '}
            <a href="mailto:support@offcutt.com.au" className="text-primary hover:underline">support@offcutt.com.au</a>.
          </p>
        </header>
        <div className="grid sm:grid-cols-2 gap-4">
          {TOPICS.map(t => (
            <Link key={t.to} to={t.to}>
              <Card className="h-full hover:border-primary transition-colors">
                <CardContent className="p-5 space-y-1">
                  <div className="font-semibold">{t.title}</div>
                  <p className="text-sm text-muted-foreground">{t.body}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}