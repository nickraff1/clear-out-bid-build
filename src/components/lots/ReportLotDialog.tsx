import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Flag, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const REASONS = [
  'Item not as described',
  'Suspected hazardous material',
  'Suspected asbestos or contamination',
  'Stolen or ownership concern',
  'Unsafe pickup location or conditions',
  'Misleading description or photos',
  'Seller unavailable or non-responsive',
  'Buyer did not show',
  'Payment or payout issue',
  'Pickup issue',
  'Prohibited bidding / shill bidding',
  'Suspected fraud or scam',
  'Duplicate listing',
  'Inappropriate content',
  'Other',
];

export function ReportLotDialog({ lotId }: { lotId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) {
      toast({ title: 'Please sign in to report a listing' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('lot_reports').insert({
      lot_id: lotId,
      reporter_id: user.id,
      reason,
      details: details.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Could not submit report', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Report submitted', description: 'Our team will review this listing shortly.' });
    setOpen(false);
    setDetails('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Flag className="h-4 w-4 mr-1" /> Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this listing</DialogTitle>
          <DialogDescription>
            Reports are reviewed by our moderation team. Hazardous, contaminated, or
            asbestos-containing materials are never permitted on Offcutt.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Reason</Label>
            <RadioGroup
              value={reason}
              onValueChange={setReason}
              className="max-h-72 overflow-y-auto rounded-md border border-border p-2"
            >
              {REASONS.map(r => (
                <label
                  key={r}
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                >
                  <RadioGroupItem value={r} id={`reason-${r}`} className="mt-0.5" />
                  <span>{r}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label>Details (optional)</Label>
            <Textarea value={details} onChange={e => setDetails(e.target.value)} rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving} variant="destructive">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}