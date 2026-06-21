import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';

type Row = {
  id: string; email: string; full_name: string | null; created_at: string;
  roles: string[];
};

export default function AdminUsers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    const { data: roles } = await supabase.from('user_roles').select('user_id, role');
    const roleMap = new Map<string, string[]>();
    roles?.forEach(r => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });
    setRows((profiles ?? []).map(p => ({ ...p, roles: roleMap.get(p.id) ?? [] })));
    setLoading(false);
  };

  const filtered = rows.filter(r =>
    r.email.toLowerCase().includes(q.toLowerCase()) ||
    (r.full_name ?? '').toLowerCase().includes(q.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground">{rows.length} registered users</p>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or email" value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
      </div>
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.full_name ?? '—'}</TableCell>
                <TableCell>{r.email}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {r.roles.length === 0 && <span className="text-muted-foreground text-sm">—</span>}
                    {r.roles.map(role => <Badge key={role} variant="muted">{role}</Badge>)}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{format(parseISO(r.created_at), 'MMM d, yyyy')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}