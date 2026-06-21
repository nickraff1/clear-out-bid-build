import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Upload, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type Row = {
  title: string;
  description?: string;
  category?: string;
  quantity?: string;
  unit?: string;
  condition?: string;
  pricing_type?: string;
  fixed_price?: string;
  start_price?: string;
  reserve_price?: string;
  error?: string;
};

const TEMPLATE = 'title,description,category,quantity,unit,condition,pricing_type,fixed_price,start_price,reserve_price\nReclaimed Oak Beams,2.4m oak beams from heritage renovation,Timber,12,pieces,good,fixed,450,,\nMarble Offcuts,Carrara marble offcuts ideal for benchtops,Stone,8,m2,unused,auction,,200,400\n';

function parseCSV(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    // simple CSV (no quoted commas)
    const values = line.split(',');
    const row: any = {};
    headers.forEach((h, i) => { row[h] = values[i]?.trim() ?? ''; });
    return row as Row;
  });
}

function validate(row: Row): string | null {
  if (!row.title) return 'Title required';
  if (!row.quantity || isNaN(Number(row.quantity))) return 'Quantity must be a number';
  if (row.pricing_type === 'fixed' && !row.fixed_price) return 'fixed_price required';
  if (row.pricing_type === 'auction' && !row.start_price) return 'start_price required';
  return null;
}

export default function BulkUpload() {
  const { user, primaryOrg } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [filename, setFilename] = useState('');
  const [publishing, setPublishing] = useState(false);

  const onFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCSV(text).map(r => ({ ...r, error: validate(r) ?? undefined }));
    setRows(parsed);
    setFilename(file.name);
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'offcutt-bulk-upload-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const publishAll = async () => {
    if (!user || !primaryOrg) return;
    const valid = rows.filter(r => !r.error);
    if (valid.length === 0) {
      toast({ title: 'No valid rows to publish', variant: 'destructive' });
      return;
    }
    setPublishing(true);
    try {
      // Find or create default event
      const { data: existing } = await supabase
        .from('clearance_events')
        .select('id')
        .eq('org_id', primaryOrg.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      let eventId = existing?.id;
      if (!eventId) {
        const now = new Date();
        const later = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 90);
        const { data: ev, error: evErr } = await supabase.from('clearance_events').insert({
          org_id: primaryOrg.id,
          created_by: user.id,
          title: 'Ongoing listings',
          site_address: primaryOrg.address ?? 'TBC',
          suburb: primaryOrg.suburb ?? 'TBC',
          state: primaryOrg.state ?? 'NSW',
          pickup_start: now.toISOString(),
          pickup_end: later.toISOString(),
          status: 'active',
        }).select('id').single();
        if (evErr) throw evErr;
        eventId = ev!.id;
      }

      const { data: importRec, error: impErr } = await (supabase.from('bulk_imports') as any).insert({
        seller_org_id: primaryOrg.id,
        created_by: user.id,
        filename,
        total_rows: valid.length,
        status: 'processing',
      }).select('id').single();
      if (impErr) throw impErr;

      const payload = valid.map(r => ({
        event_id: eventId!,
        title: r.title,
        description: r.description || null,
        quantity: Number(r.quantity),
        unit: r.unit || 'each',
        condition: (r.condition as any) || 'good',
        pricing_type: (r.pricing_type as any) || 'fixed',
        fixed_price: r.fixed_price ? Number(r.fixed_price) : null,
        start_price: r.start_price ? Number(r.start_price) : null,
        reserve_price: r.reserve_price ? Number(r.reserve_price) : null,
        status: 'draft' as const,
      }));

      const { error: lotErr } = await supabase.from('lots').insert(payload);
      if (lotErr) throw lotErr;

      await (supabase.from('bulk_imports') as any).update({
        status: 'completed', success_rows: valid.length,
      }).eq('id', importRec!.id);

      toast({ title: `Published ${valid.length} draft listings`, description: 'Review and activate from My Listings.' });
      setRows([]);
      setFilename('');
    } catch (e: any) {
      toast({ title: 'Bulk upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const validCount = rows.filter(r => !r.error).length;
  const errorCount = rows.length - validCount;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Bulk upload listings</h1>
        <p className="text-muted-foreground">Upload a CSV to create many lots at once.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Get the template</CardTitle>
          <CardDescription>Download, fill in your rows, then upload below.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Download CSV template
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Upload your file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="csv">CSV file</Label>
          <Input
            id="csv"
            type="file"
            accept=".csv,text/csv"
            onChange={e => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          {rows.length > 0 && (
            <div className="flex gap-2">
              <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1" /> {validCount} valid</Badge>
              {errorCount > 0 && <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> {errorCount} errors</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>3. Preview & publish</CardTitle>
            <CardDescription>Rows publish as drafts — activate from My Listings when ready.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.title || '—'}</TableCell>
                      <TableCell>{r.quantity} {r.unit}</TableCell>
                      <TableCell>{r.pricing_type}</TableCell>
                      <TableCell>${r.fixed_price || r.start_price || '—'}</TableCell>
                      <TableCell>
                        {r.error
                          ? <Badge variant="destructive">{r.error}</Badge>
                          : <Badge variant="success">Ready</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button onClick={publishAll} disabled={publishing || validCount === 0}>
              {publishing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Publish {validCount} listings
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}