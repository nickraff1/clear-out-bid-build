import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, MessageSquare } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { EmptyState } from '@/components/app/EmptyState';
import { Button } from '@/components/ui/button';

type ConvRow = {
  id: string;
  buyer_id: string;
  seller_org_id: string;
  lot_id: string | null;
  last_message_at: string;
  lot: { id: string; title: string } | null;
  seller_org: { id: string; name: string } | null;
  buyer: { full_name: string | null; email: string } | null;
};

type ConvQueryRow = Omit<ConvRow, 'buyer'>;
type BuyerProfile = { id: string; full_name: string | null; email: string | null };

export default function MessagesInbox() {
  const { user, primaryOrg } = useAuth();
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      void load();
    } else {
      setConvs([]);
      setLoading(false);
    }
  }, [user, primaryOrg?.id]);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id, buyer_id, seller_org_id, lot_id, last_message_at,
        lot:lots(id, title),
        seller_org:organizations(id, name)
      `)
      .order('last_message_at', { ascending: false });
    if (error) {
      console.error('[MessagesInbox] load failed', error);
      setError(error.message ?? 'Could not load messages.');
      setConvs([]);
    } else {
      const conversationRows = (data ?? []) as ConvQueryRow[];
      const buyerIds = Array.from(new Set(conversationRows.map(c => c.buyer_id).filter(Boolean)));
      let buyersById = new Map<string, BuyerProfile>();

      if (buyerIds.length) {
        const { data: buyerRows, error: buyerError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', buyerIds);

        if (buyerError) {
          console.error('[MessagesInbox] buyer profile load failed', buyerError);
        } else {
          buyersById = new Map(((buyerRows ?? []) as BuyerProfile[]).map(profile => [profile.id, profile]));
        }
      }

      setConvs(conversationRows.map(c => ({
        ...c,
        buyer: buyersById.get(c.buyer_id) ?? null,
      })));
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-muted-foreground">Conversations with buyers and sellers</p>
      </div>

      {error ? (
        <div className="dashboard-card space-y-3">
          <p className="font-medium text-destructive">Could not load messages</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>Try again</Button>
        </div>
      ) : convs.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No messages yet"
          description="Conversations will appear here when buyers or sellers contact you about a listing or order."
        />
      ) : (
        <div className="dashboard-card divide-y divide-border p-0">
          {convs.map(c => {
            const isBuyer = c.buyer_id === user?.id;
            const counterpart = isBuyer ? c.seller_org?.name : (c.buyer?.full_name || c.buyer?.email || 'Buyer');
            return (
              <Link
                key={c.id}
                to={`/app/messages/${c.id}`}
                className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{counterpart}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {c.lot?.title ?? 'General enquiry'}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-3">
                  {formatDistanceToNow(parseISO(c.last_message_at), { addSuffix: true })}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
