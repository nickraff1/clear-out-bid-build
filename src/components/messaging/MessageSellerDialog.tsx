import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, MessageCircle } from 'lucide-react';

const QUICK_PROMPTS = [
  'Is this still available?',
  'Can I inspect it?',
  'Can you help load?',
  'What are the exact dimensions?',
  'Would you accept an offer?',
];

interface Props {
  lotId: string;
  lotTitle: string;
  sellerOrgId: string;
  trigger?: React.ReactNode;
}

export function MessageSellerDialog({ lotId, lotTitle, sellerOrgId, trigger }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async (text?: string) => {
    const content = (text ?? body).trim();
    if (!user) { navigate('/login'); return; }
    if (!content) { setError('Please enter a message.'); return; }
    setLoading(true);
    setError('');
    try {
      // Find or create conversation
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('buyer_id', user.id)
        .eq('seller_org_id', sellerOrgId)
        .eq('lot_id', lotId)
        .maybeSingle();

      let convId = existing?.id;
      if (!convId) {
        const { data: created, error: cErr } = await supabase
          .from('conversations')
          .insert({ buyer_id: user.id, seller_org_id: sellerOrgId, lot_id: lotId })
          .select('id').single();
        if (cErr) throw cErr;
        convId = created.id;
      }

      const { error: mErr } = await supabase.from('messages').insert({
        conversation_id: convId, sender_id: user.id, body: content,
      });
      if (mErr) throw mErr;

      setOpen(false);
      navigate(`/app/messages/${convId}`);
    } catch (e: any) {
      setError(e.message ?? 'Could not send message.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)} className="contents">
        {trigger ?? (
          <Button variant="outline" className="w-full">
            <MessageCircle className="h-4 w-4 mr-2" /> Message Seller
          </Button>
        )}
      </div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Message seller</DialogTitle>
          <DialogDescription className="truncate">About: {lotTitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {QUICK_PROMPTS.map(p => (
              <button
                key={p}
                onClick={() => setBody(p)}
                className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/70 transition-colors"
              >{p}</button>
            ))}
          </div>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message…"
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Pickup address is not shared in messages. It's released after purchase.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button onClick={() => handleSend()} disabled={loading || !body.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}