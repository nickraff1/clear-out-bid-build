import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CreditCard, 
  ExternalLink, 
  Check, 
  AlertCircle,
  DollarSign,
  Building2,
  Clock,
  ArrowRight
} from 'lucide-react';

export default function PaymentSettings() {
  const { primaryOrg } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);

  // Placeholder - will be replaced with actual Stripe Connect status
  const stripeConnected = false;
  const payoutsEnabled = false;

  const handleConnectStripe = async () => {
    setIsConnecting(true);
    // This will be implemented when Stripe is enabled
    setTimeout(() => {
      setIsConnecting(false);
    }, 1000);
  };

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
              <Badge variant={stripeConnected ? 'default' : 'secondary'}>
                {stripeConnected ? 'Connected' : 'Not Connected'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {!stripeConnected ? (
              <div className="space-y-4">
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertTitle>Payment Setup Coming Soon</AlertTitle>
                  <AlertDescription>
                    We're setting up secure payment processing. You'll be able to connect your bank account and receive payments directly soon.
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
                  disabled={true}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Connect Payment Account (Coming Soon)
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Check className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Account Connected</p>
                    <p className="text-sm text-muted-foreground">
                      Payouts will be sent to your connected bank account
                    </p>
                  </div>
                </div>

                <Button variant="outline" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Manage Payment Account
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
