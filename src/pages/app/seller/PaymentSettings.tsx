import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  CreditCard,
  ExternalLink,
  Check,
  AlertCircle,
  DollarSign,
  Building2,
  Loader2,
  RefreshCw,
} from 'lucide-react';

type StripeAccountStatus = {
  stripe_account_id: string | null;
  charges_enabled: boolean | null;
  payouts_enabled: boolean | null;
  details_submitted: boolean | null;
  account_status: string | null;
  connect_readiness_status: string | null;
  capability_card_payments: string | null;
  capability_transfers: string | null;
  disabled_reason: string | null;
  requirements_currently_due: string[] | null;
  requirements_past_due: string[] | null;
  requirements_pending_verification: string[] | null;
  last_synced_at: string | null;
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
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!primaryOrg?.id) { setLoading(false); return; }
    setLoading(true);
    // Pull fresh status from Stripe first so the UI reflects onboarding
    // completion even before any webhook lands. Ignore errors — we still
    // fall through to the DB read below.
    try {
      await supabase.functions.invoke('stripe-connect-refresh', {
        body: { org_id: primaryOrg.id },
      });
    } catch (e) {
      console.warn('stripe-connect-refresh failed', e);
    }
    const { data } = await supabase
      .from('seller_stripe_accounts')
      .select(`
        stripe_account_id, charges_enabled, payouts_enabled, details_submitted,
        account_status, connect_readiness_status, capability_card_payments,
        capability_transfers, disabled_reason, requirements_currently_due,
        requirements_past_due, requirements_pending_verification, last_synced_at
      `)
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
      const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', {
        body: {
          org_id: primaryOrg.id,
          return_url: window.location.href,
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

  const handleRefresh = async () => {
    if (!primaryOrg?.id) return;
    setIsRefreshing(true);
    try {
      await supabase.functions.invoke('stripe-connect-refresh', {
        body: { org_id: primaryOrg.id },
      });
      await load();
      toast({ title: 'Stripe status refreshed' });
    } catch (e) {
      toast({
        title: 'Could not refresh Stripe',
        description: (e as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const stripeConnected = state.kind !== 'not_connected';
  const account = state.kind === 'not_connected' ? null : state.account;
  const readiness = account?.connect_readiness_status ?? (state.kind === 'active' ? 'ready' : state.kind);
  const payoutsReady = readiness === 'ready';
  const dueItems = [
    ...(account?.requirements_past_due ?? []),
    ...(account?.requirements_currently_due ?? []),
  ];
  const pendingItems = account?.requirements_pending_verification ?? [];
  const badgeVariant: 'default' | 'secondary' | 'destructive' = payoutsReady
    ? 'default'
    : ['action_required', 'payments_paused', 'payouts_paused', 'restricted'].includes(readiness) ? 'destructive' : 'secondary';
  const badgeLabel = state.kind === 'not_connected' ? 'Not connected'
    : readiness === 'ready' ? 'Ready for payouts'
    : readiness === 'review_pending' ? 'Stripe review pending'
    : readiness === 'payments_paused' ? 'Payments paused'
    : readiness === 'payouts_paused' ? 'Payouts paused'
    : readiness === 'action_required' ? 'Action required'
    : 'Payout setup incomplete';

  const readinessCopy = payoutsReady
    ? 'Stripe has enabled payments and payouts for this seller account.'
    : readiness === 'review_pending'
      ? 'Stripe is reviewing your submitted information. We will refresh this status automatically, and you can check again here.'
      : dueItems.length > 0
        ? 'Stripe needs more information before Offcutt can send automatic payouts.'
        : 'Continue Stripe onboarding to finish verifying your account and enable payouts.';

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
                <div className="space-y-3">
                  <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${payoutsReady ? 'bg-primary/10' : 'bg-warning/10'}`}>
                      {payoutsReady ? <Check className="h-6 w-6 text-primary" /> : <AlertCircle className="h-6 w-6 text-warning" />}
                    </div>
                    <div>
                      <p className="font-medium">{badgeLabel}</p>
                      <p className="text-sm text-muted-foreground">{readinessCopy}</p>
                    </div>
                  </div>

                  {account?.disabled_reason && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Stripe has restricted this account</AlertTitle>
                      <AlertDescription>{account.disabled_reason}</AlertDescription>
                    </Alert>
                  )}

                  {dueItems.length > 0 && (
                    <div className="rounded-lg border p-4">
                      <h4 className="font-medium mb-2">Action required in Stripe</h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {dueItems.slice(0, 8).map((item) => <li key={item}>• {item.replaceAll('_', ' ')}</li>)}
                      </ul>
                    </div>
                  )}

                  {pendingItems.length > 0 && (
                    <div className="rounded-lg border p-4">
                      <h4 className="font-medium mb-2">Submitted for review</h4>
                      <p className="text-sm text-muted-foreground">
                        {pendingItems.length} Stripe requirement{pendingItems.length === 1 ? '' : 's'} are pending verification.
                      </p>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      variant={payoutsReady ? 'outline' : 'default'}
                      onClick={handleConnect}
                      disabled={isConnecting}
                    >
                      {isConnecting ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecting…</>
                      ) : (
                        <><ExternalLink className="h-4 w-4 mr-2" />{payoutsReady ? 'Manage Stripe Profile' : 'Continue Stripe Setup'}</>
                      )}
                    </Button>
                    <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
                      {isRefreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      Refresh status
                    </Button>
                  </div>

                  <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <div>Payments: {account?.charges_enabled ? 'Enabled' : 'Not enabled'}</div>
                    <div>Payouts: {account?.payouts_enabled ? 'Enabled' : 'Not enabled'}</div>
                    <div>Card payments capability: {account?.capability_card_payments ?? 'unknown'}</div>
                    <div>Transfers capability: {account?.capability_transfers ?? 'unknown'}</div>
                    <div className="sm:col-span-2">Stripe account: {account?.stripe_account_id ?? '—'}</div>
                    <div className="sm:col-span-2">Last checked: {account?.last_synced_at ? new Date(account.last_synced_at).toLocaleString() : 'Not yet synced'}</div>
                  </div>
                </div>
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
