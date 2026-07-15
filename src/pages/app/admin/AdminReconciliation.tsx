import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertTriangle, CheckCircle2, Copy, Loader2, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ReconciliationRow = {
  payment_id: string;
  order_id: string;
  payment_created_at: string;
  environment: string;
  payment_status: string;
  payment_method: string | null;
  manual_payout_status: string;
  payout_processing_status: string;
  payout_attempt_count: number;
  payout_last_attempt_at: string | null;
  payout_last_error: string | null;
  payout_source_transaction_used: boolean;
  base_amount: number;
  buyer_fee: number;
  seller_fee: number;
  amount_charged: number;
  seller_payout: number;
  platform_fee_total: number;
  refunded_amount: number;
  refund_status: string | null;
  tax_calculation_status: string;
  buyer_fee_tax_amount: number | null;
  seller_fee_tax_amount: number | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_charge_amount: number | null;
  stripe_charge_currency: string | null;
  stripe_balance_transaction_id: string | null;
  stripe_charge_available_on: string | null;
  stripe_charge_settlement_status: string;
  stripe_transfer_id: string | null;
  stripe_transfer_created_at: string | null;
  seller_stripe_account_id: string | null;
  order_status: string;
  pickup_status: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  lot_title: string | null;
  seller_name: string | null;
  latest_event_type: string | null;
  latest_event_outcome: string | null;
  latest_error_code: string | null;
  latest_error_message: string | null;
  latest_event_at: string | null;
};

const money = (value: number | null | undefined) => `$${Number(value ?? 0).toFixed(2)}`;
const shortId = (value: string | null) => value ? `${value.slice(0, 12)}...` : "Not recorded";

function processingLabel(status: string) {
  if (status === "awaiting_stripe_settlement") return "Awaiting Stripe funds settlement";
  if (status === "transferred") return "Transfer created";
  if (status === "processing") return "Processing";
  if (status === "on_hold") return "On hold";
  if (status === "failed") return "Failed";
  return "Pending release";
}

function processingVariant(status: string): "success" | "warning" | "destructive" | "muted" {
  if (status === "transferred") return "success";
  if (status === "failed") return "destructive";
  if (["processing", "awaiting_stripe_settlement"].includes(status)) return "warning";
  return "muted";
}

function TraceId({ label, value }: { label: string; value: string | null }) {
  const { toast } = useToast();
  return (
    <div className="grid gap-1 sm:grid-cols-[150px_1fr] sm:items-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <code className="min-w-0 truncate text-xs">{value ?? "Not recorded"}</code>
        {value && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            title={`Copy ${label}`}
            onClick={async () => {
              await navigator.clipboard.writeText(value);
              toast({ title: `${label} copied` });
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AdminReconciliation() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [environment, setEnvironment] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<ReconciliationRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_payment_reconciliation")
      .select("*")
      .order("payment_created_at", { ascending: false })
      .limit(1000);
    if (error) {
      toast({ title: "Could not load reconciliation", description: error.message, variant: "destructive" });
      setRows([]);
    } else {
      setRows((data ?? []) as unknown as ReconciliationRow[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (environment !== "all" && row.environment !== environment) return false;
      if (status !== "all" && row.payout_processing_status !== status) return false;
      if (!needle) return true;
      return [
        row.order_id, row.payment_id, row.buyer_name, row.buyer_email,
        row.seller_name, row.lot_title, row.stripe_payment_intent_id,
        row.stripe_charge_id, row.stripe_transfer_id, row.seller_stripe_account_id,
      ].some((value) => value?.toLowerCase().includes(needle));
    });
  }, [environment, rows, search, status]);

  const totals = useMemo(() => filtered.reduce((sum, row) => ({
    charged: sum.charged + Number(row.amount_charged),
    fees: sum.fees + Number(row.platform_fee_total),
    payouts: sum.payouts + Number(row.seller_payout),
  }), { charged: 0, fees: 0, payouts: 0 }), [filtered]);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Transaction reconciliation</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Buyer charged</div><div className="text-xl font-semibold">{money(selected.amount_charged)}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Platform fees</div><div className="text-xl font-semibold">{money(selected.platform_fee_total)}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Seller transfer</div><div className="text-xl font-semibold">{money(selected.seller_payout)}</div></CardContent></Card>
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Stripe object chain</h3>
                <div className="rounded-md border p-3 space-y-1">
                  <TraceId label="Checkout session" value={selected.stripe_session_id} />
                  <TraceId label="PaymentIntent" value={selected.stripe_payment_intent_id} />
                  <TraceId label="Charge" value={selected.stripe_charge_id} />
                  <TraceId label="Balance transaction" value={selected.stripe_balance_transaction_id} />
                  <TraceId label="Transfer" value={selected.stripe_transfer_id} />
                  <TraceId label="Seller account" value={selected.seller_stripe_account_id} />
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Commercial breakdown</h3>
                <div className="grid gap-x-6 gap-y-2 rounded-md border p-3 text-sm sm:grid-cols-2">
                  <div className="flex justify-between"><span>Item price</span><strong>{money(selected.base_amount)}</strong></div>
                  <div className="flex justify-between"><span>Buyer fee</span><strong>{money(selected.buyer_fee)}</strong></div>
                  <div className="flex justify-between"><span>Seller fee</span><strong>{money(selected.seller_fee)}</strong></div>
                  <div className="flex justify-between"><span>Seller payout</span><strong>{money(selected.seller_payout)}</strong></div>
                  <div className="flex justify-between"><span>Refunded</span><strong>{money(selected.refunded_amount)}</strong></div>
                  <div className="flex justify-between"><span>Tax treatment</span><Badge variant={selected.tax_calculation_status === "calculated" ? "success" : "warning"}>{selected.tax_calculation_status.replaceAll("_", " ")}</Badge></div>
                </div>
                {selected.tax_calculation_status !== "calculated" && (
                  <p className="text-xs text-muted-foreground">GST/tax has not been configured in Offcutt, so no tax amount is inferred. Confirm the fee tax treatment with your accountant before using this ledger for BAS reporting.</p>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Operational state</h3>
                <div className="rounded-md border p-3 text-sm space-y-2">
                  <div className="flex justify-between gap-4"><span>Order</span><span>{selected.order_status}</span></div>
                  <div className="flex justify-between gap-4"><span>Pickup</span><span>{selected.pickup_status ?? "Not set"}</span></div>
                  <div className="flex justify-between gap-4"><span>Charge settlement</span><span>{selected.stripe_charge_settlement_status}</span></div>
                  <div className="flex justify-between gap-4"><span>Transfer mode</span><span>{selected.payout_source_transaction_used ? "Linked source transaction" : "Legacy balance transfer"}</span></div>
                  <div className="flex justify-between gap-4"><span>Attempts</span><span>{selected.payout_attempt_count}</span></div>
                  {selected.payout_last_error && <div className="rounded-md bg-destructive/10 p-2 text-destructive">{selected.payout_last_error}</div>}
                </div>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payment reconciliation</h1>
          <p className="text-muted-foreground">Trace each buyer charge through Offcutt fees and the seller Stripe transfer.</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Buyer charges</div><div className="text-xl font-bold">{money(totals.charged)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Platform fees</div><div className="text-xl font-bold">{money(totals.fees)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Seller payouts</div><div className="text-xl font-bold">{money(totals.payouts)}</div></CardContent></Card>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_180px_220px]">
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search buyer, seller, order or Stripe ID" /></div>
        <Select value={environment} onValueChange={setEnvironment}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All environments</SelectItem><SelectItem value="live">Live</SelectItem><SelectItem value="sandbox">Sandbox</SelectItem></SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All payout states</SelectItem><SelectItem value="pending">Pending release</SelectItem><SelectItem value="processing">Processing</SelectItem><SelectItem value="awaiting_stripe_settlement">Awaiting settlement</SelectItem><SelectItem value="transferred">Transfer created</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="on_hold">On hold</SelectItem></SelectContent></Select>
      </div>

      <div className="hidden overflow-x-auto rounded-md border md:block">
        <Table>
          <TableHeader><TableRow><TableHead>Date / order</TableHead><TableHead>Buyer</TableHead><TableHead>Seller / lot</TableHead><TableHead>Amounts</TableHead><TableHead>Stripe chain</TableHead><TableHead>Tax</TableHead><TableHead>Payout state</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow key={row.payment_id} className="cursor-pointer" onClick={() => setSelected(row)}>
                <TableCell><div>{format(parseISO(row.payment_created_at), "dd MMM yyyy")}</div><code className="text-xs text-muted-foreground">{row.order_id.slice(0, 8)}</code></TableCell>
                <TableCell><div>{row.buyer_name ?? "Unnamed buyer"}</div><div className="text-xs text-muted-foreground">{row.buyer_email}</div></TableCell>
                <TableCell><div>{row.seller_name ?? "Unknown seller"}</div><div className="max-w-[180px] truncate text-xs text-muted-foreground">{row.lot_title}</div></TableCell>
                <TableCell className="text-xs"><div>Charged {money(row.amount_charged)}</div><div>Fees {money(row.platform_fee_total)}</div><div>Payout {money(row.seller_payout)}</div></TableCell>
                <TableCell className="text-xs"><div>PI {shortId(row.stripe_payment_intent_id)}</div><div>CH {shortId(row.stripe_charge_id)}</div><div>TR {shortId(row.stripe_transfer_id)}</div></TableCell>
                <TableCell><Badge variant={row.tax_calculation_status === "calculated" ? "success" : "warning"}>{row.tax_calculation_status === "calculated" ? "Calculated" : "Not configured"}</Badge></TableCell>
                <TableCell><Badge variant={processingVariant(row.payout_processing_status)}>{processingLabel(row.payout_processing_status)}</Badge>{row.payout_last_error && <div className="mt-1 max-w-[220px] truncate text-xs text-destructive">{row.payout_last_error}</div>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {filtered.map((row) => (
          <button key={row.payment_id} type="button" onClick={() => setSelected(row)} className="w-full rounded-md border p-4 text-left">
            <div className="flex items-start justify-between gap-3"><div><div className="font-medium">{row.lot_title}</div><div className="text-xs text-muted-foreground">{row.seller_name} · {row.buyer_name ?? row.buyer_email}</div></div><Badge variant={processingVariant(row.payout_processing_status)}>{processingLabel(row.payout_processing_status)}</Badge></div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><span className="text-muted-foreground">Charged</span><div>{money(row.amount_charged)}</div></div><div><span className="text-muted-foreground">Fees</span><div>{money(row.platform_fee_total)}</div></div><div><span className="text-muted-foreground">Payout</span><div>{money(row.seller_payout)}</div></div></div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && <div className="rounded-md border py-12 text-center text-muted-foreground">No transactions match these filters.</div>}

      <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
        {rows.every((row) => row.tax_calculation_status === "calculated") ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />}
        <span>Accounting export is traceable to Stripe IDs, but tax remains explicitly unconfigured until Offcutt’s GST treatment is approved and implemented.</span>
      </div>
    </div>
  );
}
