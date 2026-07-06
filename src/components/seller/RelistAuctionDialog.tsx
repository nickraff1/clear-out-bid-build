import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Loader2, RotateCw } from 'lucide-react';

export type RelistTarget = {
  id: string;
  title: string;
  start_price?: number | null;
  reserve_price?: number | null;
};

export function RelistAuctionDialog({
  lot,
  onClose,
  onDone,
}: {
  lot: RelistTarget | null;
  onClose: () => void;
  onDone?: () => void;
}) {
  const [end, setEnd] = useState('');
  const [start, setStart] = useState('');
  const [reserve, setReserve] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!lot) return;
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    setEnd(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setStart(lot.start_price != null ? String(lot.start_price) : '');
    setReserve(lot.reserve_price != null ? String(lot.reserve_price) : '');
  }, [lot]);

  const submit = async () => {
    if (!lot) return;
    if (!end) return toast({ title: 'Choose an end date', variant: 'destructive' });
    const endIso = new Date(end).toISOString();
    if (new Date(endIso).getTime() <= Date.now()) {
      return toast({ title: 'End date must be in the future', variant: 'destructive' });
    }
    setBusy(true);
    const { error } = await supabase.rpc('relist_auction_lot', {
      p_lot_id: lot.id,
      p_auction_end: endIso,
      p_start_price: start ? Number(start) : null,
      p_reserve_price: reserve ? Number(reserve) : null,
    });
    setBusy(false);
    if (error) return toast({ title: 'Relist failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Listing relisted', description: 'A fresh auction has been created.' });
    onDone?.();
    onClose();
  };

  return (
    <Dialog open={!!lot} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Relist auction</DialogTitle>
          <DialogDescription>
            Create a fresh auction for "{lot?.title}". Photos and compliance tags are copied. Bidding starts from zero.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="relist-end">New auction end</Label>
            <Input id="relist-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="relist-start">Start price ($)</Label>
              <Input id="relist-start" type="number" min="0" step="0.01" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relist-reserve">Reserve price ($)</Label>
              <Input id="relist-reserve" type="number" min="0" step="0.01" placeholder="Optional" value={reserve} onChange={(e) => setReserve(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCw className="h-4 w-4 mr-2" />}
            Relist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}