import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getStripeEnvironment } from '@/lib/stripe';
import {
  CreditCard,
  ExternalLink,
  Check,
  AlertCircle,
  DollarSign,
  Building2,
  Loader2,
} from 'lucide-react';

type StripeAccountStatus = {
  stripe_account_id: string | null;
  charges_enabled: boolean | null;
  payouts_enabled: boolean | null;
  details_submitted: boolean | null;
  account_status: string | null;
};

type ConnectionState =
  | { kind: 'not_connected' }
  | { kind: 'pending'; account: StripeAccountStatus }
  | { kind: 'active'; account: StripeAccountStatus }
  | { kind: 'restricted'; account: StripeAccountStatus };

function classify(row: StripeAccountStatus | null): ConnectionState {
  if (!row?.stripe_account_id) return { kind: 'not_connected' };
  if (row.charges_enabled && row.payouts_enabled) return { kind: 'active', account: row };
  if (row.details_submitted && !row.payouts_enabled) return { kind: 'restricted', account: row };
  return { kind: 'pending', account: row };
}

export default function PaymentSettings() {
  const { primaryOrg } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<ConnectionState>({ kind: 'not_connected' });
  const [loading, setLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const load = useCallback(async () => {
    if (!primaryOrg?.id) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('seller_stripe_accounts')
      .select('stripe_account_id, charges_enabled, payouts_enabled, details_submitted, account_status')
      .eq('org_id', primaryOrg.id)
      .maybeSingle();
    setState(classify((data as StripeAccountStatus | null) ?? null));
    setLoading(false);
  }, [primaryOrg?.id]);

  useEffect(() => { load(); }, [load]);

  // Refresh when the user returns from Stripe.
  useEffect(() => {
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const handleConnect = async () => {
    if (!primaryOrg?.id) return;
    setIsConnecting(true);
    try {
      const environment = getStripeEnvironment();
      const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', {
        body: {
          org_id: primaryOrg.id,
          return_url: window.location.href,
          environment,
        },
      });
      if (error || !data?.url) {
        throw new Error(error?.message ?? data?.error ?? 'Could not start Stripe onboarding');
      }
      window.location.assign(data.url as string);
    } catch (e) {
      toast({
        title: 'Onboarding failed',
        description: (e as Error).message,
        variant: 'destructive',
      });
      setIsConnecting(false);
    }
  };

  const stripeConnected = state.kind !== 'not_connected';
  const payoutsReady = state.kind === 'active';
  const badgeVariant: 'default' | 'secondary' | 'destructive' = payoutsReady
    ? 'default'
    : state.kind === 'restricted' ? 'destructive' : 'secondary';
  const badgeLabel = state.kind === 'not_connected' ? 'Not connected'
    : state.kind === 'pending' ? 'Pending verification'
    : state.kind === 'restricted' ? 'Action required'
    : 'Ready';

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Payment Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage how you receive payments for your sales
        </p>
      </div>

      <div className="grid gap-6">
        {/* Connection Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Account
                </CardTitle>
                <CardDescription>
                  Connect your account to receive payments
                </CardDescription>
              </div>
              <Badge variant={badgeVariant}>{badgeLabel}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !stripeConnected ? (
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Connect your Stripe account</AlertTitle>
                  <AlertDescription>
                    Sellers on Offcutt receive payouts through Stripe Connect. You'll be asked for
                    your business details, bank account, and ID. Payouts arrive automatically after
                    each order is collected.
                  </AlertDescription>
                </Alert>

                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium mb-3">What you'll be able to do:</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Accept card payments from buyers
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Receive payouts to your bank account
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Track all your transactions in one place
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Automatic fee calculation and deduction
                    </li>
                  </ul>
                </div>

                <Button
                  className="w-full"
                  disabled={isConnecting || !primaryOrg?.id}
                  onClick={handleConnect}
                >
                  {isConnecting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecting…</>
                  ) : (
                    <><Building2 className="h-4 w-4 mr-2" />Connect Payment Account</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center ${payoutsReady ? 'bg-primary/10' : 'bg-warning/10'}`}>
                    {payoutsReady ? <Check className="h-6 w-6 text-primary" /> : <AlertCircle className="h-6 w-6 text-warning" />}
                  </div>
                  <div>
                    <p className="font-medium">
                      {payoutsReady ? 'Ready to receive payouts' : state.kind === 'restricted' ? 'Additional information needed' : 'Verification in progress'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {payoutsReady
                        ? 'Stripe will pay 90% of every completed sale into your connected bank account.'
                        : 'Continue Stripe onboarding to finish verifying your account and enable payouts.'}
                    </p>
                  </div>
                </div>

                <Button
                  variant={payoutsReady ? 'outline' : 'default'}
                  className="w-full"
                  onClick={handleConnect}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecting…</>
                  ) : (
                    <><ExternalLink className="h-4 w-4 mr-2" />{payoutsReady ? 'Manage Payment Account' : 'Continue Stripe Onboarding'}</>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fee Structure */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Fee Structure
            </CardTitle>
            <CardDescription>
              Understand how fees work on the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">Buyer Fee</Badge>
                    <span className="font-medium">10%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Added to the purchase price. Paid by the buyer.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">Seller Fee</Badge>
                    <span className="font-medium">10%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Deducted from the sale price. Paid by you.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-3">Example Transaction</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Item sells for</span>
                    <span>$100.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Buyer pays (+10% fee)</span>
                    <span>$110.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Seller fee (-10%)</span>
                    <span className="text-destructive">-$10.00</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-medium">
                    <span>You receive</span>
                    <span className="text-primary">$90.00</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payout History Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Payout History</CardTitle>
            <CardDescription>
              View your past payouts and pending balances
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No payouts yet</p>
              <p className="text-sm mt-1">
                Your payout history will appear here once you start making sales.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
