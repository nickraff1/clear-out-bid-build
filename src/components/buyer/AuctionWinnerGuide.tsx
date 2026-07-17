import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Check, CheckCircle2, Circle, CreditCard, Gavel, MapPin,
  MessageCircle, PackageCheck, ShieldCheck, Star, Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  getAuctionWinnerGuideState,
  type AuctionWinnerGuideInput,
  type WinnerGuideAction,
} from '@/lib/auction-winner-guide';

type Props = AuctionWinnerGuideInput & {
  orderId: string;
  userId: string;
  lotTitle: string;
  total: number;
  onAction: (action: WinnerGuideAction) => void;
};

const stepIcons = [CreditCard, MapPin, Truck, ShieldCheck, Star];

export function AuctionWinnerGuide({
  orderId,
  userId,
  lotTitle,
  total,
  onAction,
  ...input
}: Props) {
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const state = getAuctionWinnerGuideState(input);
  const seenKey = `auction_winner_guide_seen_${userId}_${orderId}`;
  const forceOpen = searchParams.get('guide') === '1';

  useEffect(() => {
    const hasSeenGuide = localStorage.getItem(seenKey) === 'true';
    if (forceOpen || !hasSeenGuide) setOpen(true);
  }, [forceOpen, seenKey]);

  const setGuideOpen = (next: boolean) => {
    setOpen(next);
    if (!next) localStorage.setItem(seenKey, 'true');
  };

  const runAction = () => {
    if (state.action) onAction(state.action);
    setGuideOpen(false);
  };

  const progress = (state.completedCount / state.steps.length) * 100;

  return (
    <>
      <section id="winner-guide" className="border border-primary/25 bg-primary/5 rounded-md p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex gap-3 min-w-0">
            <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Gavel className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase text-primary">Winning auction guide</p>
              <h2 className="font-semibold text-lg">{state.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{state.description}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="shrink-0">
            View all steps
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{state.completedCount} of {state.steps.length} steps complete</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="flex flex-wrap gap-2">
          {state.actionLabel && (
            <Button size="sm" onClick={runAction}>{state.actionLabel}</Button>
          )}
          {state.action !== 'message' && (
            <Button size="sm" variant="ghost" onClick={() => onAction('message')}>
              <MessageCircle className="h-4 w-4 mr-2" /> Message seller
            </Button>
          )}
        </div>
      </section>

      <Dialog open={open} onOpenChange={setGuideOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="h-12 w-12 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-2">
              <Gavel className="h-6 w-6" />
            </div>
            <DialogTitle className="text-2xl">You won {lotTitle}</DialogTitle>
            <DialogDescription>
              Your order total is ${total.toFixed(2)}. Follow these steps from payment through collection.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1" aria-label="Auction winner progress">
            {state.steps.map((step, index) => {
              const Icon = stepIcons[index];
              const StatusIcon = step.state === 'complete' ? CheckCircle2 : step.state === 'current' ? Circle : Circle;
              return (
                <div
                  key={step.title}
                  aria-current={step.state === 'current' ? 'step' : undefined}
                  className={cn(
                    'flex gap-3 py-3 border-b last:border-b-0',
                    step.state === 'upcoming' && 'opacity-55',
                  )}
                >
                  <div className={cn(
                    'h-9 w-9 rounded-md flex items-center justify-center shrink-0',
                    step.state === 'complete' && 'bg-success/10 text-success',
                    step.state === 'current' && 'bg-primary text-primary-foreground',
                    step.state === 'upcoming' && 'bg-muted text-muted-foreground',
                  )}>
                    {step.state === 'complete' ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{index + 1}. {step.title}</p>
                      <StatusIcon className={cn(
                        'h-3.5 w-3.5',
                        step.state === 'complete' && 'text-success fill-success',
                        step.state === 'current' && 'text-primary fill-primary',
                        step.state === 'upcoming' && 'text-muted-foreground',
                      )} />
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-muted/60 rounded-md p-3 text-sm flex gap-2">
            <PackageCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <p><strong>Collection safety:</strong> inspect the material first. Share the pickup code only after you have received the item.</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGuideOpen(false)}>Close</Button>
            {state.actionLabel && <Button onClick={runAction}>{state.actionLabel}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
