import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, DollarSign, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

const STATUS_LABEL: Record<string, string> = {
  manual_payout_pending: "Pending payout",
  manual_payout_paid: "Paid",
  manual_payout_failed: "Failed",
  manual_payout_on_hold: "On hold",
};
const STATUS_VARIANT: Record<string, "warning" | "success" | "destructive" | "muted"> = {
  manual_payout_pending: "warning",
  manual_payout_paid: "success",
  manual_payout_failed: "destructive",
  manual_payout_on_hold: "muted",
};

export default function SellerPayouts() {
  const { primaryOrg } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!primaryOrg) { setLoading(false); return; }
    (async () => {
      const { data: events } = await supabase.from("clearance_events").select("id").eq("org_id", primaryOrg.id);
      const ids = (events ?? []).map(e => e.id);
      if (ids.length === 0) { setLoading(false); return; }
      const { data } = await supabase
        .from("orders")
        .select("id, amount, status, created_at, lot:lots(title), payment:payments(base_amount, buyer_fee, seller_fee, seller_payout, status, manual_payout_status, manual_payout_paid_at)")
        .in("event_id", ids)
        .order("created_at", { ascending: false });
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [primaryOrg]);

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const paidRows = rows.filter(r => Array.isArray(r.payment) ? r.payment[0]?.status === "succeeded" : r.payment?.status === "succeeded");
  const totalSold = paidRows.reduce((s, r) => s + Number((Array.isArray(r.payment) ? r.payment[0] : r.payment)?.base_amount ?? 0), 0);
  const totalNet = paidRows.reduce((s, r) => s + Number((Array.isArray(r.payment) ? r.payment[0] : r.payment)?.seller_payout ?? 0), 0);
  const pendingNet = paidRows
    .filter(r => ((Array.isArray(r.payment) ? r.payment[0] : r.payment)?.manual_payout_status) === "manual_payout_pending")
    .reduce((s, r) => s + Number((Array.isArray(r.payment) ? r.payment[0] : r.payment)?.seller_payout ?? 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payouts</h1>
        <p className="text-muted-foreground">Track your sold items and net payouts. Payouts are sent manually by Offcutt during the beta.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-primary" />
          <div><p className="text-xs text-muted-foreground">Gross sold</p><p className="text-xl font-bold">${totalSold.toFixed(2)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <div><p className="text-xs text-muted-foreground">Total net payout</p><p className="text-xl font-bold">${totalNet.toFixed(2)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-warning" />
          <div><p className="text-xs text-muted-foreground">Awaiting payout</p><p className="text-xl font-bold">${pendingNet.toFixed(2)}</p></div>
        </CardContent></Card>
      </div>

      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Lot</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Sold</TableHead>
            <TableHead>Offcutt fee (5%)</TableHead>
            <TableHead>Net payout</TableHead>
            <TableHead>Payout status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {paidRows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />No paid orders yet
              </TableCell></TableRow>
            )}
            {paidRows.map(r => {
              const p = Array.isArray(r.payment) ? r.payment[0] : r.payment;
              const status = p?.manual_payout_status ?? "manual_payout_pending";
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.lot?.title}</TableCell>
                  <TableCell className="text-muted-foreground">{format(parseISO(r.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell>${Number(p?.base_amount ?? 0).toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground">${Number(p?.seller_fee ?? 0).toFixed(2)}</TableCell>
                  <TableCell className="font-medium">${Number(p?.seller_payout ?? 0).toFixed(2)}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}