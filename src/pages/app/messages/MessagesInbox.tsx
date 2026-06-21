import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, MessageSquare } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

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

export default function MessagesInbox() {
  const { user, primaryOrg } = useAuth();
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) load();
  }, [user, primaryOrg?.id]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id, buyer_id, seller_org_id, lot_id, last_message_at,
        lot:lots(id, title),
        seller_org:organizations(id, name),
        buyer:profiles!conversations_buyer_id_fkey(full_name, email)
      `)
      .order('last_message_at', { ascending: false });
    if (!error && data) setConvs(data as any);
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

      {convs.length === 0 ? (
        <div className="text-center py-16 dashboard-card">
          <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
          <p className="text-muted-foreground">Conversations from listings will appear here.</p>
        </div>
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