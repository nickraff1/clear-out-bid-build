import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function AdminFees() {
  const { user } = useAuth();
  const [buyer, setBuyer] = useState("10");
  const [seller, setSeller] = useState("10");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("fee_settings").select("*").maybeSingle().then(({ data }) => {
      if (data) {
        setBuyer((Number(data.buyer_fee_pct) * 100).toString());
        setSeller((Number(data.seller_fee_pct) * 100).toString());
      }
      setLoading(false);
    });
  }, []);

  async function save() {
    setSaving(true);
    const buyerPct = Number(buyer) / 100;
    const sellerPct = Number(seller) / 100;
    if (!isFinite(buyerPct) || !isFinite(sellerPct) || buyerPct < 0 || sellerPct < 0 || buyerPct > 0.5 || sellerPct > 0.5) {
      toast({ title: "Invalid values", description: "Fees must be between 0 and 50%.", variant: "destructive" });
      setSaving(false);
      return;
    }
    const { data: existing } = await supabase.from("fee_settings").select("id").maybeSingle();
    const payload = { buyer_fee_pct: buyerPct, seller_fee_pct: sellerPct, updated_by: user?.id, updated_at: new Date().toISOString() };
    const { error } = existing
      ? await supabase.from("fee_settings").update(payload).eq("id", existing.id)
      : await supabase.from("fee_settings").insert(payload);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Saved", description: "Fee settings updated." });
    setSaving(false);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Platform fees</h1>
      <Card className="p-6 space-y-4">
        {loading ? <Loader2 className="animate-spin" /> : (
          <>
            <div className="space-y-2">
              <Label htmlFor="buyer">Buyer fee (%)</Label>
              <Input id="buyer" type="number" min="0" max="50" step="0.1" value={buyer} onChange={(e) => setBuyer(e.target.value)} />
              <p className="text-xs text-muted-foreground">Added to hammer price at checkout.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="seller">Seller commission (%)</Label>
              <Input id="seller" type="number" min="0" max="50" step="0.1" value={seller} onChange={(e) => setSeller(e.target.value)} />
              <p className="text-xs text-muted-foreground">Deducted from seller payout.</p>
            </div>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save fees</Button>
          </>
        )}
      </Card>
    </div>
  );
}