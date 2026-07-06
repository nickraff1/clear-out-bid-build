import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Loader2, RefreshCw, Send } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, parseISO } from "date-fns";

const STATUSES = ["manual_payout_pending", "manual_payout_paid", "manual_payout_failed", "manual_payout_on_hold"] as const;
const LABEL: Record<string, string> = {
  manual_payout_pending: "Pending",
  manual_payout_paid: "Paid",
  manual_payout_failed: "Failed",
  manual_payout_on_hold: "On hold",
};
const VARIANT: Record<string, "warning" | "success" | "destructive" | "muted"> = {
  manual_payout_pending: "warning",
  manual_payout_paid: "success",
  manual_payout_failed: "destructive",
  manual_payout_on_hold: "muted",
};

type PayoutRow = {
  id: string;
  base_amount: number;
  buyer_fee: number;
  seller_fee: number;
  seller_payout: number;
  amount_charged: number;
  status: string;
  manual_payout_status: string;
  manual_payout_paid_at: string | null;
  manual_payout_reference: string | null;
  admin_notes: string | null;
  environment: string;
  created_at: string;
  stripe_transfer_id: string | null;
  refunded_amount: number | null;
  refund_status: string | null;
  _has_issue: boolean;
  _connect?: ConnectAccount | null;
  order?: {
    id: string;
    status: string;
    pickup_status: string | null;
    buyer?: { full_name: string | null; email: string | null } | null;
    lot?: {
      title: string | null;
      event?: { org_id: string; organization?: { name: string | null } | null } | null;
    } | null;
  } | null;
};

type ReportOrderRef = { order_id: string | null };
type ConnectAccount = {
  org_id: string;
  stripe_account_id: string | null;
  connect_readiness_status: string | null;
  payouts_enabled: boolean | null;
  capability_transfers: string | null;
  disabled_reason: string | null;
  requirements_currently_due: string[] | null;
  requirements_past_due: string[] | null;
  last_synced_at: string | null;
};

// NOTE: do NOT destructure supabase.rpc — it loses `this` binding and throws
// "Cannot read properties of undefined (reading 'rest')" from supabase-js.
// Always call `supabase.rpc(...)` inline.
type SetPayoutArgs = { _payment_id: string; _status: string; _reference: string | null; _note: string | null };
const callSetPayoutStatus = (args: SetPayoutArgs) =>
  (supabase.rpc as unknown as (fn: string, args: SetPayoutArgs) => Promise<{ error: { message: string } | null }>)
    .call(supabase, "admin_set_payout_status", args);

const readinessLabel: Record<string, string> = {
  ready: "Ready",
  payout_setup_incomplete: "Setup incomplete",
  review_pending: "Review pending",
  action_required: "Action required",
  payments_paused: "Payments paused",
  payouts_paused: "Payouts paused",
  not_started: "Not started",
};

const readinessVariant = (status?: string | null): "success" | "warning" | "destructive" | "muted" => {
  if (status === "ready") return "success";
  if (status === "review_pending" || status === "payout_setup_incomplete") return "warning";
  if (status === "not_started" || !status) return "muted";
  return "destructive";
};

const connectBlockReason = (account?: ConnectAccount | null) => {
  if (!account?.stripe_account_id) return "No Stripe Connect account";
  if (account.connect_readiness_status === "ready") return null;
  if (account.disabled_reason) return account.disabled_reason;
  const pastDue = account.requirements_past_due ?? [];
  if (pastDue.length) return `${pastDue.length} past-due Stripe requirement${pastDue.length === 1 ? "" : "s"}`;
  const current = account.requirements_currently_due ?? [];
  if (current.length) return `${current.length} Stripe requirement${current.length === 1 ? "" : "s"} due`;
  if (!account.payouts_enabled) return "Payouts not enabled";
  if (account.capability_transfers !== "active") return "Transfers not active";
  return "Stripe not payout-ready";
};

export default function AdminPayouts() {
  const { toast } = useToast();
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<PayoutRow | null>(null);
  const [draft, setDraft] = useState({ status: "manual_payout_pending", reference: "", notes: "" });
  const [confirmTransfer, setConfirmTransfer] = useState<PayoutRow | null>(null);
  const [refundDialog, setRefundDialog] = useState<{ row: PayoutRow | null; amount: string; notes: string }>({ row: null, amount: "", notes: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("payments")
      .select(`
        id, base_amount, buyer_fee, seller_fee, seller_payout, amount_charged,
        status, manual_payout_status, manual_payout_paid_at, manual_payout_reference,
        admin_notes, environment, created_at, stripe_transfer_id, refunded_amount, refund_status,
        order:orders!payments_order_id_fkey(
          id, status, pickup_status,
          buyer:profiles!orders_buyer_id_fkey(full_name, email),
          lot:lots(title, event:clearance_events(org_id, organization:organizations(name)))
        )
      `)
      .eq("status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(500);
    // attach open issue flag
    const payoutRows = (data ?? []) as unknown as Omit<PayoutRow, "_has_issue">[];
    const ordIds = payoutRows.map((r) => r.order?.id).filter((id): id is string => Boolean(id));
    let issueSet = new Set<string>();
    if (ordIds.length) {
      const { data: rep } = await supabase.from('lot_reports')
        .select('order_id').in('order_id', ordIds)
        .in('status', ['open','investigating']);
      issueSet = new Set(((rep ?? []) as ReportOrderRef[]).map((r) => r.order_id).filter((id): id is string => Boolean(id)));
    }
    const orgIds = [...new Set(payoutRows.map((r) => r.order?.lot?.event?.org_id).filter((id): id is string => Boolean(id)))];
    let connectByOrg = new Map<string, ConnectAccount>();
    if (orgIds.length) {
      const { data: accounts } = await supabase
        .from("seller_stripe_accounts")
        .select(`
          org_id, stripe_account_id, connect_readiness_status, payouts_enabled,
          capability_transfers, disabled_reason, requirements_currently_due,
          requirements_past_due, last_synced_at
        `)
        .in("org_id", orgIds);
      connectByOrg = new Map(((accounts ?? []) as ConnectAccount[]).map((account) => [account.org_id, account]));
    }
    setRows(payoutRows.map((r) => ({
      ...r,
      _has_issue: issueSet.has(r.order?.id ?? ""),
      _connect: connectByOrg.get(r.order?.lot?.event?.org_id ?? "") ?? null,
    })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = filter === "all" ? rows : rows.filter(r => r.manual_payout_status === filter);

  const openEdit = (row: PayoutRow) => {
    setEditing(row);
    setDraft({
      status: row.manual_payout_status ?? "manual_payout_pending",
      reference: row.manual_payout_reference ?? "",
      notes: row.admin_notes ?? "",
    });
  };

  const performSave = async () => {
    if (!editing) return;
    const { error } = await callSetPayoutStatus({
      _payment_id: editing.id,
      _status: draft.status,
      _reference: draft.reference || null,
      _note: draft.notes || null,
    });
    if (error) {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Payout updated" });
      setEditing(null);
      load();
    }
  };

  const save = async () => {
    if (!editing) return;
    if (draft.status === 'manual_payout_paid') {
      if (editing.status !== 'succeeded') {
        return toast({ title: 'Blocked', description: 'Payment is not in succeeded state.', variant: 'destructive' });
      }
      if (editing.order?.status && ['cancelled','refunded'].includes(editing.order.status)) {
        return toast({ title: 'Blocked', description: `Order is ${editing.order.status}.`, variant: 'destructive' });
      }
    }
    await performSave();
  };

  const autoTransfer = async (row: PayoutRow) => {
    const { data, error } = await supabase.functions.invoke("admin-create-seller-transfer", {
      body: { payment_id: row.id, note: "Admin-triggered seller transfer" },
    });
    if (error || data?.error) {
      toast({
        title: "Transfer blocked",
        description: error?.message || data?.error || "Could not create seller transfer",
        variant: "destructive",
      });
    } else {
      toast({ title: "Seller transfer created", description: data?.transfer_id });
      load();
    }
    setConfirmTransfer(null);
  };

  const submitRefund = async () => {
    const row = refundDialog.row;
    if (!row) return;
    const remaining = Number(row.amount_charged) - Number(row.refunded_amount ?? 0);
    const amount = Number(refundDialog.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
      return toast({ title: "Invalid refund amount", variant: "destructive" });
    }
    const notes = refundDialog.notes || "Admin refund";
    const { data, error } = await supabase.functions.invoke("admin-refund-payment", {
      body: { payment_id: row.id, amount, reason: "requested_by_customer", notes },
    });
    if (error || data?.error) {
      toast({
        title: "Refund failed",
        description: error?.message || data?.error || "Could not refund payment",
        variant: "destructive",
      });
    } else {
      toast({ title: "Refund processed", description: data?.refund_id });
      setRefundDialog({ row: null, amount: "", notes: "" });
      load();
    }
  };

  const openRefund = (row: PayoutRow) => {
    const remaining = Number(row.amount_charged) - Number(row.refunded_amount ?? 0);
    setRefundDialog({ row, amount: remaining.toFixed(2), notes: "" });
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-4">
      <AlertDialog open={!!confirmTransfer} onOpenChange={(o) => !o && setConfirmTransfer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trigger automatic Stripe transfer?</AlertDialogTitle>
            <AlertDialogDescription>
              Only proceed in sandbox/staging unless live payouts are explicitly approved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmTransfer && autoTransfer(confirmTransfer)}>Send transfer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!refundDialog.row} onOpenChange={(o) => !o && setRefundDialog({ row: null, amount: "", notes: "" })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Refund payment</DialogTitle></DialogHeader>
          {refundDialog.row && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Max refundable: ${(Number(refundDialog.row.amount_charged) - Number(refundDialog.row.refunded_amount ?? 0)).toFixed(2)} AUD
              </p>
              <Input type="number" step="0.01" placeholder="Refund amount (AUD)"
                value={refundDialog.amount}
                onChange={(e) => setRefundDialog(d => ({ ...d, amount: e.target.value }))} />
              <Textarea placeholder="Refund reason / admin note"
                value={refundDialog.notes}
                onChange={(e) => setRefundDialog(d => ({ ...d, notes: e.target.value }))} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog({ row: null, amount: "", notes: "" })}>Cancel</Button>
            <Button onClick={submitRefund}>Process refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Payouts</h1>
          <p className="text-muted-foreground">Manual seller payouts (beta) — review paid orders and mark when payouts are sent.</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-md border border-warning/40 bg-warning/10 text-sm p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
        <span><strong>Automated payouts are live.</strong> When an order is marked collected, the platform automatically transfers 90% of the sale to the seller's Stripe balance. Use the Transfer button below only to retry a payout that failed or was missed (e.g. seller onboarded late).</span>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Lot</TableHead>
            <TableHead>Buyer</TableHead>
            <TableHead>Seller</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Buyer fee</TableHead>
            <TableHead>Seller fee</TableHead>
            <TableHead>Buyer paid</TableHead>
            <TableHead>Net payout</TableHead>
            <TableHead>Stripe</TableHead>
            <TableHead>Seller Connect</TableHead>
            <TableHead>Refunded</TableHead>
            <TableHead>Payout</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map(r => (
              <TableRow key={r.id} className={r._has_issue ? 'bg-destructive/5' : ''}>
                <TableCell className="text-muted-foreground">{format(parseISO(r.created_at), "MMM d")}</TableCell>
                <TableCell className="font-medium max-w-[200px] truncate">
                  {r.order?.lot?.title}
                  {r._has_issue && <Badge variant="destructive" className="ml-2 text-[10px]">issue</Badge>}
                  {r.order?.status !== 'collected' && <Badge variant="warning" className="ml-2 text-[10px]">not collected</Badge>}
                </TableCell>
                <TableCell>{r.order?.buyer?.full_name ?? r.order?.buyer?.email ?? "—"}</TableCell>
                <TableCell>{r.order?.lot?.event?.organization?.name ?? "—"}</TableCell>
                <TableCell>${Number(r.base_amount).toFixed(2)}</TableCell>
                <TableCell>${Number(r.buyer_fee).toFixed(2)}</TableCell>
                <TableCell>${Number(r.seller_fee).toFixed(2)}</TableCell>
                <TableCell>${Number(r.amount_charged).toFixed(2)}</TableCell>
                <TableCell className="font-medium">${Number(r.seller_payout).toFixed(2)}</TableCell>
                <TableCell><Badge variant="success">{r.status}</Badge></TableCell>
                <TableCell>
                  <div className="space-y-1 min-w-[150px]">
                    <Badge variant={readinessVariant(r._connect?.connect_readiness_status)}>
                      {readinessLabel[r._connect?.connect_readiness_status ?? "not_started"] ?? "Unknown"}
                    </Badge>
                    {connectBlockReason(r._connect) && (
                      <div className="text-xs text-muted-foreground">{connectBlockReason(r._connect)}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {Number(r.refunded_amount ?? 0) > 0
                    ? <Badge variant={r.refund_status === "succeeded" ? "success" : "warning"}>${Number(r.refunded_amount).toFixed(2)}</Badge>
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell><Badge variant={VARIANT[r.manual_payout_status]}>{LABEL[r.manual_payout_status]}</Badge></TableCell>
                <TableCell className="space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmTransfer(r)}
                    disabled={!!r.stripe_transfer_id || r.manual_payout_status === "manual_payout_paid" || !!connectBlockReason(r._connect)}
                  >
                    <Send className="h-3.5 w-3.5 mr-1" />Transfer
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openRefund(r)} disabled={r.manual_payout_status === "manual_payout_paid"}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />Refund
                  </Button>
                  <Dialog open={editing?.id === r.id} onOpenChange={(o) => !o && setEditing(null)}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Update</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Update payout</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <Select value={draft.status} onValueChange={(v) => setDraft(d => ({ ...d, status: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUSES.map(s => <SelectItem key={s} value={s}>{LABEL[s]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {draft.status === "manual_payout_paid" && (r._has_issue || r.order?.status !== "collected") && (
                          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
                            <div className="font-medium">Review before marking paid</div>
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                              {r._has_issue && <li>This order has an open issue.</li>}
                              {r.order?.status !== "collected" && <li>Pickup is not yet confirmed as collected.</li>}
                            </ul>
                          </div>
                        )}
                        <Input placeholder="Payout reference (e.g. bank transfer ID)" value={draft.reference} onChange={e => setDraft(d => ({ ...d, reference: e.target.value }))} />
                        <Textarea placeholder="Admin notes" value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                        <Button onClick={save}>Save</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-10 text-muted-foreground">
                  No payouts match this filter yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
