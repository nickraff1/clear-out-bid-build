import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Star, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Props {
  orderId: string;
  revieweeId: string;
  revieweeOrgId?: string | null;
  reviewerRole: 'buyer' | 'seller';
  triggerLabel?: string;
  onReviewed?: () => void;
}

export function LeaveReviewDialog({ orderId, revieweeId, revieweeOrgId, reviewerRole, triggerLabel = 'Leave review', onReviewed }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('reviews').insert({
      order_id: orderId,
      reviewer_id: user.id,
      reviewee_id: revieweeId,
      reviewee_org_id: revieweeOrgId ?? null,
      reviewer_role: reviewerRole,
      rating,
      comment: comment.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Could not submit review', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Review submitted', description: 'Thanks for your feedback!' });
    setOpen(false);
    onReviewed?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave a review</DialogTitle>
          <DialogDescription>Help others by sharing your experience.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                className="p-1"
              >
                <Star
                  className={`h-7 w-7 ${(hover || rating) >= n ? 'fill-primary text-primary' : 'text-muted-foreground'}`}
                />
              </button>
            ))}
          </div>
          <Textarea
            placeholder="What went well? What could improve?"
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}