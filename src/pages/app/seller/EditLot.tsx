import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { LOT_CONDITIONS } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';

export default function EditLot() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { primaryOrg } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(null);

  useEffect(() => { if (id) load(); }, [id]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('lots').select('*').eq('id', id!).maybeSingle();
    if (data) setForm(data);
    setLoading(false);
  };

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    const payload: any = {
      title: form.title,
      description: form.description,
      quantity: form.quantity,
      unit: form.unit,
      condition: form.condition,
      status: form.status,
    };
    if (form.pricing_type === 'fixed') {
      payload.fixed_price = parseFloat(form.fixed_price) || null;
    } else {
      payload.start_price = parseFloat(form.start_price) || null;
      payload.reserve_price = form.reserve_price ? parseFloat(form.reserve_price) : null;
      // If the user edited the datetime-local field, form.auction_end is a
      // local-time string like "2026-07-04T16:00". Convert to UTC ISO.
      // If unchanged, it's already an ISO string from the DB — normalize both.
      payload.auction_end = form.auction_end
        ? new Date(form.auction_end).toISOString()
        : null;
    }
    const { error } = await supabase.from('lots').update(payload).eq('id', id!);
    setSaving(false);
    if (error) toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Listing saved' }); navigate('/app/seller/lots'); }
  };

  if (loading || !form) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>
      <h1 className="text-2xl font-bold">Edit Listing</h1>

      <Card>
        <CardHeader><CardTitle className="text-lg">Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>Title</Label>
            <Input value={form.title ?? ''} onChange={e => update('title', e.target.value)} />
          </div>
          <div className="space-y-2"><Label>Description</Label>
            <Textarea value={form.description ?? ''} onChange={e => update('description', e.target.value)} rows={4} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Quantity</Label>
              <Input type="number" min={1} value={form.quantity ?? 1} onChange={e => update('quantity', parseInt(e.target.value) || 1)} />
            </div>
            <div className="space-y-2"><Label>Unit</Label>
              <Input value={form.unit ?? 'each'} onChange={e => update('unit', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2"><Label>Condition</Label>
            <Select value={form.condition} onValueChange={v => update('condition', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOT_CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Status</Label>
            <Select value={form.status} onValueChange={v => update('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft (unpublished)</SelectItem>
                <SelectItem value="active">Active (published)</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Pricing</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {form.pricing_type === 'fixed' ? (
            <div className="space-y-2"><Label>Buy Now Price ($)</Label>
              <Input type="number" step={0.01} value={form.fixed_price ?? ''} onChange={e => update('fixed_price', e.target.value)} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Starting Price ($)</Label>
                  <Input type="number" step={0.01} value={form.start_price ?? ''} onChange={e => update('start_price', e.target.value)} />
                </div>
                <div className="space-y-2"><Label>Reserve (optional)</Label>
                  <Input type="number" step={0.01} value={form.reserve_price ?? ''} onChange={e => update('reserve_price', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2"><Label>Auction Ends</Label>
                <Input type="datetime-local"
                  value={form.auction_end ? toLocalInputValue(form.auction_end) : ''}
                  onChange={e => update('auction_end', e.target.value)} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={() => navigate(-1)} disabled={saving}>Cancel</Button>
        <Button className="flex-1" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save Changes
        </Button>
      </div>
    </div>
  );
}