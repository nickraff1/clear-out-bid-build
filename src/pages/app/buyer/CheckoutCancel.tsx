import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { XCircle } from "lucide-react";

export default function CheckoutCancel() {
  return (
    <div className="container max-w-xl mx-auto py-16 px-4">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-3">
            <XCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle>Checkout cancelled</CardTitle>
          <CardDescription>Your order is still pending payment. You can pay any time from your orders.</CardDescription>
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