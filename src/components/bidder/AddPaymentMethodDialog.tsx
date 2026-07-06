import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CreditCard, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getStripe } from '@/lib/stripe';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import type { StripeElementsOptions } from '@stripe/stripe-js';
import type { StripeEnv } from '@/lib/stripe';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

function PaymentForm({
  environment,
  onSaved,
  onClose,
}: {
  environment: StripeEnv;
  onSaved?: () => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError('');
    try {
      const { error: submitErr } = await elements.submit();
      if (submitErr) throw new Error(submitErr.message || 'Card details invalid');

      const { error: confirmErr, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      });
      if (confirmErr) throw new Error(confirmErr.message || 'Could not save card');
      if (!setupIntent || setupIntent.status !== 'succeeded') {
        throw new Error('Card setup did not complete');
      }

      const { data, error: fnErr } = await supabase.functions.invoke('confirm-bidder-payment-method', {
        body: { setup_intent_id: setupIntent.id, environment },
      });
      if (fnErr || data?.error) throw new Error(fnErr?.message || data?.error || 'Could not save card');

      onSaved?.();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        Your card is stored securely with Stripe. You won't be charged until you win an auction.
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || submitting}>
          {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><CreditCard className="h-4 w-4 mr-2" />Save card</>}
        </Button>
      </div>
    </form>
  );
}

export function AddPaymentMethodDialog({ open, onOpenChange, onSaved }: Props) {
  const [clientSecret, setClientSecret] = useState<string>('');
  const [paymentEnvironment, setPaymentEnvironment] = useState<StripeEnv | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [setupAttempt, setSetupAttempt] = useState(0);

  useEffect(() => {
    if (!open) {
      setClientSecret('');
      setPaymentEnvironment(null);
      setError('');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data, error: fnErr } = await supabase.functions.invoke('create-bidder-setup-intent', {
          body: {},
        });
        if (fnErr || data?.error) throw new Error(fnErr?.message || data?.error || 'Could not start card setup');
        if (!data?.client_secret) throw new Error('Card setup did not return a client secret');
        if (!cancelled) {
          setPaymentEnvironment(data.environment === 'live' ? 'live' : 'sandbox');
          setClientSecret(data.client_secret);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, setupAttempt]);

  const stripePromise = useMemo(() => getStripe(), []);
  const options: StripeElementsOptions | undefined = useMemo(
    () => (clientSecret ? { clientSecret, appearance: { theme: 'stripe' as const } } : undefined),
    [clientSecret],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Add a payment method</DialogTitle>
          <DialogDescription>
            Bids are legally binding. Save a card so we can charge it automatically if you win.
          </DialogDescription>
        </DialogHeader>
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && !loading && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button type="button" variant="outline" onClick={() => setSetupAttempt((n) => n + 1)}>
              Try again
            </Button>
          </div>
        )}
        {!loading && clientSecret && paymentEnvironment && options && (
          <Elements key={clientSecret} stripe={stripePromise} options={options}>
            <PaymentForm
              environment={paymentEnvironment}
              onSaved={onSaved}
              onClose={() => onOpenChange(false)}
            />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  );
}
