import { ReactNode } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Link } from 'react-router-dom';

interface Props {
  title: string;
  updated?: string;
  children: ReactNode;
}

export function LegalPage({ title, updated = 'June 2026', children }: Props) {
  return (
    <Layout>
      <div className="container max-w-3xl py-12">
        <nav className="text-sm text-muted-foreground mb-4">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <span>{title}</span>
        </nav>
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {updated}</p>
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_p]:leading-relaxed">
          {children}
        </div>
        <div className="mt-12 pt-8 border-t border-border text-sm text-muted-foreground">
          <p>
            Questions? Contact{' '}
            <a className="text-primary hover:underline" href="mailto:support@offcutt.com.au">
              support@offcutt.com.au
            </a>
            .
          </p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
            <Link className="hover:text-foreground" to="/terms">Terms</Link>
            <Link className="hover:text-foreground" to="/privacy">Privacy</Link>
            <Link className="hover:text-foreground" to="/prohibited-materials">Prohibited materials</Link>
            <Link className="hover:text-foreground" to="/pickup-safety">Pickup safety</Link>
            <Link className="hover:text-foreground" to="/refunds-and-disputes">Refunds &amp; disputes</Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}