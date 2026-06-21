import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, Package, ShoppingCart, DollarSign, Leaf } from 'lucide-react';

interface Stats {
  users: number;
  orgs: number;
  activeLots: number;
  orders: number;
  gmv: number;
  kgDiverted: number;
  savings: number;
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [u, o, l, ord] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('organizations').select('id', { count: 'exact', head: true }),
      supabase.from('lots').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('orders').select('amount, status'),
    ]);

    const ordersData = ord.data ?? [];
    const paidOrders = ordersData.filter(o => ['paid', 'ready_for_pickup', 'collected'].includes(o.status));
    const gmv = paidOrders.reduce((s, o) => s + Number(o.amount ?? 0), 0);
    // Rough sustainability estimates: 50kg diverted per order, ~30% savings vs retail
    const kgDiverted = paidOrders.length * 50;
    const savings = gmv * 0.30;

    setStats({
      users: u.count ?? 0,
      orgs: o.count ?? 0,
      activeLots: l.count ?? 0,
      orders: ordersData.length,
      gmv,
      kgDiverted,
      savings,
    });
  };

  if (!stats) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const cards = [
    { label: 'Users', value: stats.users.toLocaleString(), icon: Users },
    { label: 'Organizations', value: stats.orgs.toLocaleString(), icon: Users },
    { label: 'Active listings', value: stats.activeLots.toLocaleString(), icon: Package },
    { label: 'Orders', value: stats.orders.toLocaleString(), icon: ShoppingCart },
    { label: 'GMV', value: `$${stats.gmv.toLocaleString()}`, icon: DollarSign },
    { label: 'Est. kg diverted', value: `${stats.kgDiverted.toLocaleString()} kg`, icon: Leaf },
    { label: 'Est. buyer savings', value: `$${Math.round(stats.savings).toLocaleString()}`, icon: DollarSign },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin overview</h1>
        <p className="text-muted-foreground">Marketplace health and sustainability metrics</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cards.map(c => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}