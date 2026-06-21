import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

type Msg = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
};

interface Props {
  orderId: string;
  buyerId: string;
  sellerOrgId?: string;
  lotId: string;
  paid: boolean;
}

export function OrderMessages({ orderId, buyerId, sellerOrgId, lotId, paid }: Props) {
  const { user } = useAuth();
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Resolve (or create) the conversation tied to this order/lot/buyer/seller.
  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!user || !sellerOrgId) { setLoading(false); return; }
      setLoading(true);
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('buyer_id', buyerId)
        .eq('seller_org_id', sellerOrgId)
        .eq('lot_id', lotId)
        .maybeSingle();
      let id = existing?.id;
      if (!id) {
        const { data: created, error } = await supabase
          .from('conversations')
          .insert({
            buyer_id: buyerId,
            seller_org_id: sellerOrgId,
            lot_id: lotId,
            order_id: orderId,
          })
          .select('id')
          .single();
        if (error) {
          console.error('[OrderMessages] could not create conversation', error);
          if (!cancelled) setLoading(false);
          return;
        }
        id = created?.id;
      }
      if (!id || cancelled) return;
      setConvId(id);
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, body, sender_id, created_at')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });
      if (!cancelled) {
        setMessages((msgs as Msg[]) ?? []);
        setLoading(false);
      }
    }
    resolve();
    return () => { cancelled = true; };
  }, [user, buyerId, sellerOrgId, lotId, orderId]);

  // Realtime subscription for new messages.
  useEffect(() => {
    if (!convId) return;
    const channel = supabase
      .channel(`order-messages-${convId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
        (payload) => {
          setMessages(prev =>
            prev.find(m => m.id === (payload.new as Msg).id) ? prev : [...prev, payload.new as Msg],
          );
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [convId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function send() {
    const content = body.trim();
    if (!content || !convId || !user) return;
    setSending(true);
    const { error } = await supabase.from('messages').insert({
      conversation_id: convId,
      sender_id: user.id,
      body: content,
    });
    setSending(false);
    if (error) {
      console.error('[OrderMessages] send failed', error);
      toast.error(error.message ?? 'Could not send message');
      return;
    }
    setBody('');
  }

  return (
    <div className="dashboard-card p-4 space-y-3">
      <h2 className="font-semibold flex items-center gap-2">
        <MessageSquare className="h-4 w-4" /> Messages
      </h2>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : !convId ? (
        <p className="text-sm text-muted-foreground">
          Messaging is unavailable for this order.
        </p>
      ) : (
        <>
          <div className="max-h-72 overflow-y-auto space-y-2 rounded-md bg-muted/30 p-3">
            {messages.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                {paid
                  ? 'Order confirmed. Use this chat to arrange pickup. The pickup address is shown above.'
                  : 'Say hello — pickup address is shared once payment is complete.'}
              </p>
            ) : (
              messages.map(m => {
                const mine = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        mine ? 'bg-primary text-primary-foreground' : 'bg-background border border-border'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className="text-[10px] mt-1 opacity-70">
                        {format(parseISO(m.created_at), 'PP p')}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>

          <div className="flex gap-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write a message…"
              rows={2}
              className="flex-1 resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button onClick={send} disabled={sending || !body.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}