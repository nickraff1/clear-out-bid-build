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
import { Loader2 } from "lucide-react";
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

export default function AdminPayouts() {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<any>(null);
  const [draft, setDraft] = useState({ status: "manual_payout_pending", reference: "", notes: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("payments")
      .select(`
        id, base_amount, buyer_fee, seller_fee, seller_payout, amount_charged,
        status, manual_payout_status, manual_payout_paid_at, manual_payout_reference,
        admin_notes, environment, created_at,
        order:orders!payments_order_id_fkey(
          id, buyer:profiles!orders_buyer_id_fkey(full_name, email),
          lot:lots(title, event:clearance_events(org_id, organization:organizations(name)))
        )
      `)
      .eq("status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(500);
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = filter === "all" ? rows : rows.filter(r => r.manual_payout_status === filter);

  const openEdit = (row: any) => {
    setEditing(row);
    setDraft({
      status: row.manual_payout_status ?? "manual_payout_pending",
      reference: row.manual_payout_reference ?? "",
      notes: row.admin_notes ?? "",
    });
  };

  const save = async () => {
    if (!editing) return;
    const patch: any = {
      manual_payout_status: draft.status,
      manual_payout_reference: draft.reference || null,
      admin_notes: draft.notes || null,
      manual_payout_paid_at: draft.status === "manual_payout_paid" ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("payments").update(patch).eq("id", editing.id);
    if (error) {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Payout updated" });
      setEditing(null);
      load();
    }
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-4">
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
            <TableHead>Payout</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">{format(parseISO(r.created_at), "MMM d")}</TableCell>
                <TableCell className="font-medium max-w-[200px] truncate">{r.order?.lot?.title}</TableCell>
                <TableCell>{r.order?.buyer?.full_name ?? r.order?.buyer?.email ?? "—"}</TableCell>
                <TableCell>{r.order?.lot?.event?.organization?.name ?? "—"}</TableCell>
                <TableCell>${Number(r.base_amount).toFixed(2)}</TableCell>
                <TableCell>${Number(r.buyer_fee).toFixed(2)}</TableCell>
                <TableCell>${Number(r.seller_fee).toFixed(2)}</TableCell>
                <TableCell>${Number(r.amount_charged).toFixed(2)}</TableCell>
                <TableCell className="font-medium">${Number(r.seller_payout).toFixed(2)}</TableCell>
                <TableCell><Badge variant="success">{r.status}</Badge></TableCell>
                <TableCell><Badge variant={VARIANT[r.manual_payout_status]}>{LABEL[r.manual_payout_status]}</Badge></TableCell>
                <TableCell>
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
              <TableRow><TableCell colSpan={12} className="text-center py-10 text-muted-foreground">No payouts found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}