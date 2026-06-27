import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Check } from 'lucide-react';

export default function ForSellers() {
  return (
    <Layout>
      <div className="container max-w-4xl py-12 space-y-10">
        <header className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold">Clear out surplus. Get paid.</h1>
          <p className="text-muted-foreground text-lg">
            Offcutt helps Sydney builders, fabricators and renovators turn leftover materials into cash —
            without the hassle of Gumtree negotiations or skip bin fees.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Button asChild size="lg"><Link to="/signup">Become a founding seller</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/how-it-works">How it works</Link></Button>
          </div>
        </header>

        <div className="grid md:grid-cols-3 gap-4">
          <Feature title="Free to list" body="No listing fees, no subscription. We take 10% commission only when an item actually sells." />
          <Feature title="Buyers prepay" body="No chasing payment. Buyers pay through Offcutt before collection and receive a pickup code." />
          <Feature title="Bulk upload" body="Got 50 items from a fitout? Upload them all at once with our spreadsheet importer." />
        </div>

        <Card>
          <CardContent className="p-6 space-y-3">
            <h2 className="text-xl font-semibold">Founding seller programme</h2>
            <p className="text-sm text-muted-foreground">
              We're hand-selecting the first sellers on Offcutt. Founding sellers get featured placement,
              direct onboarding support, and input into the product roadmap.
            </p>
            <ul className="space-y-2 text-sm">
              <Bullet>Dedicated onboarding call</Bullet>
              <Bullet>Featured "Founding seller" badge on every listing</Bullet>
              <Bullet>Priority support during closed beta</Bullet>
            </ul>
            <Button asChild className="mt-2"><Link to="/signup">Apply now</Link></Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardContent className="p-5 space-y-1">
        <div className="font-semibold">{title}</div>
        <p className="text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
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