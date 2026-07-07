import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, AlertCircle, Loader2, Package, MapPin } from "lucide-react";

export default function Checkout() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    (async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, amount, status, auction_payment_error, lot:lots(title, quantity, unit, pricing_type), event:clearance_events(site_address, suburb, state, postcode, pickup_start)")
        .eq("id", orderId)
        .maybeSingle();
      if (error || !data) {
        setError("Order not found");
      } else {
        setOrder(data);
      }
      setLoading(false);
    })();
  }, [orderId]);

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const returnUrl = `${window.location.origin}/app/buyer/checkout/return?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`;
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: { order_id: orderId, return_url: returnUrl, environment: getStripeEnvironment() },
    });
    if (error || !data?.clientSecret) {
      throw new Error(error?.message || data?.error || "Failed to start checkout");
    }
    return data.clientSecret;
  }, [orderId]);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (error || !order) {
    return (
      <div className="container max-w-2xl mx-auto py-12 px-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Order not found</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button asChild className="mt-4"><Link to="/app/buyer/orders"><ArrowLeft className="h-4 w-4 mr-2" />Back to orders</Link></Button>
      </div>
    );
  }

  if (order.status !== "pending_payment") {
    return (
      <div className="container max-w-2xl mx-auto py-12 px-4 space-y-4">
        <Alert>
          <AlertTitle>Order status: {order.status}</AlertTitle>
          <AlertDescription>This order is no longer awaiting payment.</AlertDescription>
        </Alert>
        <Button asChild><Link to="/app/buyer/orders">View orders</Link></Button>
      </div>
    );
  }

  const total = Number(order.amount);
  const basePrice = Math.round((total / 1.10) * 100) / 100;
  const buyerFee = Math.round((total - basePrice) * 100) / 100;
  const isAuctionOrder = order.lot?.pricing_type === "auction";

  return (
    <div>
      <PaymentTestModeBanner />
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />Back
        </Button>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="h-fit">
          <CardHeader><CardTitle>Order summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
              {isAuctionOrder && (
                <Alert variant={order.auction_payment_error ? "destructive" : "default"}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    {order.auction_payment_error ? "Automatic auction payment needs attention" : "Auction payment is processing"}
                  </AlertTitle>
                  <AlertDescription>
                    {order.auction_payment_error
                      ? "Offcutt could not charge your saved card automatically. Complete payment here to secure the item."
                      : "Offcutt is attempting to charge your saved card automatically. If this remains pending, this page can be used as a manual fallback."}
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex gap-3">
                <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Package className="h-7 w-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{order.lot?.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {order.lot?.quantity} {order.lot?.unit}
                  </p>
                </div>
              </div>
              {order.event && (
                <div className="text-sm bg-muted/40 rounded-lg p-3 flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p>Pickup suburb</p>
                    <p className="text-muted-foreground">
                      {order.event.suburb}, {order.event.state} {order.event.postcode}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Exact pickup address is shown after payment is confirmed.
                    </p>
                  </div>
                </div>
              )}
              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Item price</span><span>${basePrice.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Buyer fee (10%)</span><span>${buyerFee.toFixed(2)}</span></div>
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold text-base"><span>Total</span><span>${total.toFixed(2)} AUD</span></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
            <CardContent>
              <div id="checkout" className="min-h-[500px]">
                <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
