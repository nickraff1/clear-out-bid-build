import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Loader2, 
  ArrowLeft, 
  CreditCard, 
  AlertCircle,
  Package,
  MapPin,
  Calendar,
  Check,
  Clock
} from 'lucide-react';
import type { Lot, ClearanceEvent } from '@/types/database';

interface CheckoutData {
  lot: Lot & { event: ClearanceEvent };
  order?: {
    id: string;
    amount: number;
    status: string;
  };
}

export default function Checkout() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user, organizations } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [data, setData] = useState<CheckoutData | null>(null);

  // Fee calculations
  const BUYER_FEE_PERCENT = 0.10; // 10%

  useEffect(() => {
    const fetchOrderData = async () => {
      if (!orderId) {
        setIsLoading(false);
        return;
      }

      try {
        const { data: order, error } = await supabase
          .from('orders')
          .select(`
            *,
            lot:lots(
              *,
              event:clearance_events(*)
            )
          `)
          .eq('id', orderId)
          .single();

        if (error) throw error;

        if (order && order.lot) {
          setData({
            lot: order.lot as Lot & { event: ClearanceEvent },
            order: {
              id: order.id,
              amount: order.amount,
              status: order.status
            }
          });
        }
      } catch (error: any) {
        console.error('Error fetching order:', error);
        toast({
          title: 'Error loading order',
          description: error.message,
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderData();
  }, [orderId, toast]);

  const handlePayment = async () => {
    if (!data?.order) return;

    setIsProcessing(true);

    try {
      // For now, simulate payment processing
      // This will be replaced with actual Stripe integration later
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Update order status to paid
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'paid',
          payment_reference: `manual_${Date.now()}`
        })
        .eq('id', data.order.id);

      if (error) throw error;

      toast({
        title: 'Payment successful!',
        description: 'Your order has been confirmed. Check your email for pickup details.',
      });

      navigate('/app/buyer/orders');
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: 'Payment failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto py-12 px-4">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container max-w-2xl mx-auto py-12 px-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Order not found</AlertTitle>
          <AlertDescription>
            We couldn't find this order. It may have been cancelled or doesn't exist.
          </AlertDescription>
        </Alert>
        <Button asChild className="mt-4">
          <Link to="/app/buyer/orders">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Link>
        </Button>
      </div>
    );
  }

  const { lot, order } = data;
  const basePrice = order?.amount ?? 0;
  const buyerFee = basePrice * BUYER_FEE_PERCENT;
  const totalAmount = basePrice + buyerFee;

  // If already paid, show confirmation
  if (order?.status === 'paid') {
    return (
      <div className="container max-w-2xl mx-auto py-12 px-4">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Payment Complete</CardTitle>
            <CardDescription>
              Your payment has been processed successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-2">{lot.title}</h4>
              <p className="text-sm text-muted-foreground">
                Order #{order.id.slice(0, 8)}
              </p>
            </div>
            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertTitle>Next Steps</AlertTitle>
              <AlertDescription>
                Check your email for pickup instructions. You can also view the pickup details in your orders.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link to="/app/buyer/orders">View My Orders</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-12 px-4">
      <Button 
        variant="ghost" 
        onClick={() => navigate(-1)}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <div className="grid gap-6">
        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
            <CardDescription>Review your purchase before payment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Item Details */}
            <div className="flex gap-4">
              <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{lot.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {lot.quantity} {lot.unit}
                </p>
                <Badge variant="secondary" className="mt-1">
                  {lot.condition.replace('_', ' ')}
                </Badge>
              </div>
            </div>

            {/* Event/Pickup Info */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{lot.event?.site_address}</p>
                  <p className="text-sm text-muted-foreground">
                    {lot.event?.suburb}, {lot.event?.state} {lot.event?.postcode}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Pickup: {lot.event?.pickup_start ? new Date(lot.event.pickup_start).toLocaleDateString() : 'TBD'}
                </p>
              </div>
            </div>

            <Separator />

            {/* Price Breakdown */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Item Price</span>
                <span>${basePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Buyer Fee (10%)</span>
                <span>${buyerFee.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium text-lg">
                <span>Total</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment
            </CardTitle>
            <CardDescription>
              Secure payment processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <Clock className="h-4 w-4" />
              <AlertTitle>Payment Integration Coming Soon</AlertTitle>
              <AlertDescription>
                Card payments will be available shortly. For now, click below to confirm your order and arrange payment at pickup.
              </AlertDescription>
            </Alert>

            {/* Placeholder for Stripe Elements */}
            <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center text-muted-foreground">
              <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Card payment form will appear here</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full" 
              size="lg"
              onClick={handlePayment}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Confirm Order - ${totalAmount.toFixed(2)}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Trust Indicators */}
        <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Check className="h-4 w-4 text-primary" />
            Secure checkout
          </div>
          <div className="flex items-center gap-1">
            <Check className="h-4 w-4 text-primary" />
            Buyer protection
          </div>
        </div>
      </div>
    </div>
  );
}
