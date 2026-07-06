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
  event_id?: string;
  start_price?: number | null;
  reserve_price?: number | null;
};

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmt(iso: string | null | undefined) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

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
  const [pickupStart, setPickupStart] = useState('');
  const [pickupEnd, setPickupEnd] = useState('');
  const [pickupStartTouched, setPickupStartTouched] = useState(false);
  const [pickupEndTouched, setPickupEndTouched] = useState(false);
  const [start, setStart] = useState('');
  const [reserve, setReserve] = useState('');
  const [busy, setBusy] = useState(false);
  const [eventWindow, setEventWindow] = useState<{ pickup_start: string | null; pickup_end: string | null } | null>(null);

  useEffect(() => {
    if (!lot) return;
    const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    setEnd(toLocalInput(endDate));
    setPickupStart(toLocalInput(endDate));
    setPickupEnd(toLocalInput(new Date(endDate.getTime() + 3 * 24 * 60 * 60 * 1000)));
    setPickupStartTouched(false);
    setPickupEndTouched(false);
    setStart(lot.start_price != null ? String(lot.start_price) : '');
    setReserve(lot.reserve_price != null ? String(lot.reserve_price) : '');
    setEventWindow(null);
    if (lot.event_id) {
      supabase
        .from('clearance_events')
        .select('pickup_start, pickup_end')
        .eq('id', lot.event_id)
        .maybeSingle()
        .then(({ data }) => setEventWindow(data ?? null));
    }
  }, [lot]);

  // When auction end changes, auto-shift pickup fields the user hasn't manually touched.
  useEffect(() => {
    if (!end) return;
    const endDate = new Date(end);
    if (isNaN(endDate.getTime())) return;
    if (!pickupStartTouched) setPickupStart(toLocalInput(endDate));
    if (!pickupEndTouched) setPickupEnd(toLocalInput(new Date(endDate.getTime() + 3 * 24 * 60 * 60 * 1000)));
  }, [end, pickupStartTouched, pickupEndTouched]);

  const submit = async () => {
    if (!lot) return;
    if (!end) return toast({ title: 'Choose an end date', variant: 'destructive' });
    if (!pickupStart || !pickupEnd) return toast({ title: 'Choose a pickup window', variant: 'destructive' });
    const endIso = new Date(end).toISOString();
    const pickupStartIso = new Date(pickupStart).toISOString();
    const pickupEndIso = new Date(pickupEnd).toISOString();
    if (new Date(endIso).getTime() <= Date.now()) {
      return toast({ title: 'End date must be in the future', variant: 'destructive' });
    }
    if (new Date(pickupStartIso).getTime() < new Date(endIso).getTime()) {
      return toast({ title: 'Pickup must start on or after the auction end', variant: 'destructive' });
    }
    if (new Date(pickupEndIso).getTime() <= new Date(pickupStartIso).getTime()) {
      return toast({ title: 'Pickup end must be after pickup start', variant: 'destructive' });
    }
    setBusy(true);
    const { error } = await supabase.rpc('relist_auction_lot', {
      p_lot_id: lot.id,
      p_auction_end: endIso,
      p_pickup_start: pickupStartIso,
      p_pickup_end: pickupEndIso,
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
              <Label htmlFor="relist-pstart">Pickup window start</Label>
              <Input
                id="relist-pstart"
                type="datetime-local"
                value={pickupStart}
                onChange={(e) => { setPickupStart(e.target.value); setPickupStartTouched(true); }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relist-pend">Pickup window end</Label>
              <Input
                id="relist-pend"
                type="datetime-local"
                value={pickupEnd}
                onChange={(e) => { setPickupEnd(e.target.value); setPickupEndTouched(true); }}
              />
            </div>
          </div>
          {eventWindow && (
            <p className="text-xs text-muted-foreground">
              Current event pickup: {fmt(eventWindow.pickup_start)} → {fmt(eventWindow.pickup_end)}. Relisting will extend the event's window if needed and reactivate the event.
            </p>
          )}
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