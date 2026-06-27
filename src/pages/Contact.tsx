import { Layout } from '@/components/layout/Layout';
import { Mail, MessageSquare, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function Contact() {
  return (
    <Layout>
      <div className="container max-w-3xl py-12 space-y-8">
        <header>
          <h1 className="text-3xl font-bold mb-2">Contact Offcutt</h1>
          <p className="text-muted-foreground">
            We're a small team based in Sydney. Email is the fastest way to reach us during closed beta.
          </p>
        </header>
        <Card>
          <CardContent className="p-6 space-y-4">
            <Row icon={Mail} title="General support" body={<a href="mailto:support@offcutt.com.au" className="text-primary hover:underline">support@offcutt.com.au</a>} />
            <Row icon={ShieldAlert} title="Trust & safety / report a listing" body={<a href="mailto:safety@offcutt.com.au" className="text-primary hover:underline">safety@offcutt.com.au</a>} />
            <Row icon={MessageSquare} title="Sellers & partnerships" body={<a href="mailto:sellers@offcutt.com.au" className="text-primary hover:underline">sellers@offcutt.com.au</a>} />
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground">
          For order-specific issues, use the message thread inside the order page so we have full context.
        </p>
      </div>
    </Layout>
  );
}

function Row({ icon: Icon, title, body }: { icon: any; title: string; body: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-primary mt-0.5" />
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-sm">{body}</div>
      </div>
    </div>
  );
}