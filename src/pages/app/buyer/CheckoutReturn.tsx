import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Clock, Loader2, XCircle } from "lucide-react";

export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const orderId = params.get("order_id");
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState<"loading" | "paid" | "pending" | "failed">("loading");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!orderId) { setStatus("failed"); return; }
    let cancelled = false;
    const poll = async () => {
      const { data } = await supabase.from("orders").select("status").eq("id", orderId).maybeSingle();
      if (cancelled) return;
      if (data?.status === "paid" || data?.status === "ready_for_pickup" || data?.status === "collected") {
        setStatus("paid");
      } else if (attempts < 10) {
        setAttempts(a => a + 1);
        setTimeout(poll, 1500);
      } else {
        setStatus("pending");
      }
    };
    poll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  return (
    <div className="container max-w-xl mx-auto py-16 px-4">
      <Card>
        <CardHeader className="text-center">
          <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-3 ${
            status === "paid" ? "bg-primary/10" : status === "failed" ? "bg-destructive/10" : "bg-muted"
          }`}>
            {status === "loading" && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
            {status === "paid" && <Check className="h-8 w-8 text-primary" />}
            {status === "pending" && <Clock className="h-8 w-8 text-muted-foreground" />}
            {status === "failed" && <XCircle className="h-8 w-8 text-destructive" />}
          </div>
          <CardTitle>
            {status === "paid" && "Payment received"}
            {status === "loading" && "Confirming payment…"}
            {status === "pending" && "Payment is processing"}
            {status === "failed" && "Something went wrong"}
          </CardTitle>
          <CardDescription>
            {status === "paid" && "Thanks — the seller has been notified. Open your order to arrange pickup."}
            {status === "loading" && "This usually takes just a few seconds."}
            {status === "pending" && "We haven't received confirmation yet. You can open your order to check the latest status."}
            {status === "failed" && "We couldn't find your order. Please contact support."}
          </CardDescription>
        </CardHeader>
        {sessionId && (
          <CardContent>
            <p className="text-xs text-center text-muted-foreground">Reference: {sessionId.slice(0, 16)}…</p>
          </CardContent>
        )}
        <CardFooter className="flex flex-col sm:flex-row gap-2">
          {orderId && (status === "paid" || status === "pending") && (
            <Button asChild className="flex-1 w-full sm:w-auto">
              <Link to={`/app/orders/${orderId}`}>Open order & arrange pickup</Link>
            </Button>
          )}
          <Button asChild variant="outline" className="flex-1 w-full sm:w-auto">
            <Link to="/app/buyer/orders">View all orders</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}