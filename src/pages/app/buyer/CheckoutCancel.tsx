import { Link, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { XCircle } from "lucide-react";

export default function CheckoutCancel() {
  const [params] = useSearchParams();
  const orderId = params.get("order_id");

  useEffect(() => {
    if (!orderId) return;
    // Server-side cancel: auth-checked, atomic, releases lot reservation via trigger,
    // and refuses to cancel if a successful payment already landed.
    supabase.functions.invoke("cancel-pending-order", { body: { order_id: orderId } })
      .catch((e) => console.error("cancel-pending-order failed", e));
  }, [orderId]);

  return (
    <div className="container max-w-xl mx-auto py-16 px-4">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-3">
            <XCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle>Checkout cancelled</CardTitle>
          <CardDescription>No payment was taken. The listing is back on the marketplace.</CardDescription>
        </CardHeader>
        <CardContent />
        <CardFooter className="flex gap-2">
          <Button variant="outline" asChild className="flex-1"><Link to="/marketplace">Keep browsing</Link></Button>
          <Button asChild className="flex-1"><Link to="/app/buyer/orders">My orders</Link></Button>
        </CardFooter>
      </Card>
    </div>
  );
}