import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Loader2, ShieldCheck, Plus } from 'lucide-react';
import { AddPaymentMethodDialog } from '@/components/bidder/AddPaymentMethodDialog';
import { getStripeEnvironment, type StripeEnv } from '@/lib/stripe';

type SavedCard = {
  stripe_payment_method_id: string | null;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
  payment_method_verified_at: string | null;
};

export default function BuyerPaymentMethods() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<SavedCard | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentEnvironment, setPaymentEnvironment] = useState<StripeEnv | null>(null);
  const [configError, setConfigError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let env: StripeEnv;
    try {
      env = getStripeEnvironment();
      setPaymentEnvironment(env);
      setConfigError('');
    } catch (err) {
      setConfigError((err as Error).message);
      setCard(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('bidder_payment_methods')
      .select('stripe_payment_method_id, payment_method_brand, payment_method_last4, payment_method_verified_at')
      .eq('user_id', user.id)
      .eq('environment', env)
      .eq('is_active', true)
      .maybeSingle();
    setCard((data as SavedCard | null) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const hasCard = !!card?.stripe_payment_method_id;

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Payment methods</h1>
        <p className="text-muted-foreground mt-1">
          Add a card so we can automatically charge you if you win an auction. You won't be charged unless you win.
        </p>
        {paymentEnvironment && (
          <Badge variant="outline" className="mt-3 capitalize">
            {paymentEnvironment} payments
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Saved card
          </CardTitle>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {hasCard ? 'Replace card' : 'Add card'}
          </Button>
        </CardHeader>
        <CardContent>
          {configError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {configError}
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : hasCard ? (
            <div className="flex items-center justify-between rounded-md border p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-14 rounded bg-muted flex items-center justify-center text-xs font-semibold uppercase">
                  {card?.payment_method_brand ?? 'Card'}
                </div>
                <div>
                  <p className="font-medium">•••• •••• •••• {card?.payment_method_last4 ?? '----'}</p>
                  <p className="text-xs text-muted-foreground">
                    On file since{' '}
                    {card?.payment_method_verified_at
                      ? new Date(card.payment_method_verified_at).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="h-3 w-3" /> Active
              </Badge>
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                No card on file. Add one to bid on auctions.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add payment method
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
        <ShieldCheck className="h-3.5 w-3.5" />
        Cards are stored securely with Stripe. Offcutt never sees your full card number.
      </p>

      <AddPaymentMethodDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={load}
      />
    </div>
  );
}