import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

type Msg = { id: string; body: string; sender_id: string; created_at: string; read_at: string | null };
type Conv = {
  id: string; buyer_id: string; seller_org_id: string; lot_id: string | null;
  lot: { id: string; title: string } | null;
  seller_org: { id: string; name: string } | null;
  buyer: { full_name: string | null; email: string } | null;
};

const QUICK_PROMPTS = [
  'Is this still available?',
  'Can I inspect it?',
  'Can you help load?',
  'What are the exact dimensions?',
  'Would you accept an offer?',
];

export default function MessageThread() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [conv, setConv] = useState<Conv | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    load();
    const channel = supabase
      .channel(`thread-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          setMessages(prev => prev.find(m => m.id === (payload.new as Msg).id) ? prev : [...prev, payload.new as Msg]);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from('conversations').select(`
        id, buyer_id, seller_org_id, lot_id,
        lot:lots(id, title),
        seller_org:organizations(id, name),
        buyer:profiles!conversations_buyer_id_fkey(full_name, email)
      `).eq('id', id!).maybeSingle(),
      supabase.from('messages').select('*').eq('conversation_id', id!).order('created_at', { ascending: true }),
    ]);
    if (c) setConv(c as any);
    if (m) {
      setMessages(m as Msg[]);
      // mark as read for messages not from me
      const unread = (m as Msg[]).filter(x => x.sender_id !== user?.id && !x.read_at).map(x => x.id);
      if (unread.length) await supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', unread);
    }
    setLoading(false);
  };

  const send = async (text?: string) => {
    const content = (text ?? body).trim();
    if (!content || !user || !id) return;
    setSending(true);
    const { error } = await supabase.from('messages').insert({
      conversation_id: id, sender_id: user.id, body: content,
    });
    if (error) {
      console.error('[MessageThread] send failed', error);
      toast.error(error.message ?? 'Could not send message');
    } else {
      setBody('');
      // Optimistic refresh in case realtime is delayed.
      load();
    }
    setSending(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!conv) {
    return <div className="p-6">Conversation not found.</div>;
  }

  const isBuyer = conv.buyer_id === user?.id;
  const counterpart = isBuyer ? conv.seller_org?.name : (conv.buyer?.full_name || conv.buyer?.email || 'Buyer');

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-3xl mx-auto">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button asChild variant="ghost" size="icon"><Link to="/app/messages"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div className="min-w-0">
            <p className="font-medium truncate">{counterpart}</p>
            {conv.lot && (
              <Link to={`/lot/${conv.lot.id}`} className="text-sm text-muted-foreground truncate hover:text-primary">
                {conv.lot.title}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Say hello — pickup address is shared only after purchase.</p>
        )}
        {messages.map(m => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`text-[10px] mt-1 opacity-70`}>{format(parseISO(m.created_at), 'PP p')}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-3 space-y-2">
        <div className="flex flex-wrap gap-1">
          {QUICK_PROMPTS.map(p => (
            <button
              key={p}
              onClick={() => send(p)}
              disabled={sending}
              className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/70 transition-colors"
            >{p}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type a message…"
            rows={2}
            className="flex-1 resize-none"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <Button onClick={() => send()} disabled={sending || !body.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}