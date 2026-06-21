import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { EmptyState } from '@/components/app/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Bell, Loader2, Plus, Trash2, X } from 'lucide-react';
import { DEFAULT_CATEGORIES, AUSTRALIAN_STATES } from '@/lib/constants';
import type { SavedSearch } from '@/types/database';

export default function BuyerAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [newAlert, setNewAlert] = useState({
    name: '',
    categories: [] as string[],
    states: [] as string[],
    keywords: '',
    notify_email: true,
  });

  useEffect(() => {
    if (user) {
      fetchAlerts();
    }
  }, [user]);

  const fetchAlerts = async () => {
    try {
      const { data } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (data) {
        setAlerts(data as SavedSearch[]);
      }
    } finally {
      setLoading(false);
    }
  };

  const createAlert = async () => {
    if (!newAlert.name.trim() || !user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.from('saved_searches').insert({
        user_id: user.id,
        name: newAlert.name,
        filters: {
          categories: newAlert.categories,
          states: newAlert.states,
          keywords: newAlert.keywords,
        },
        notify_email: newAlert.notify_email,
      });

      if (!error) {
        setDialogOpen(false);
        setNewAlert({
          name: '',
          categories: [],
          states: [],
          keywords: '',
          notify_email: true,
        });
        fetchAlerts();
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteAlert = async (id: string) => {
    await supabase.from('saved_searches').delete().eq('id', id);
    setAlerts(alerts.filter(a => a.id !== id));
  };

  const toggleCategory = (slug: string) => {
    setNewAlert(prev => ({
      ...prev,
      categories: prev.categories.includes(slug)
        ? prev.categories.filter(c => c !== slug)
        : [...prev.categories, slug]
    }));
  };

  const toggleState = (value: string) => {
    setNewAlert(prev => ({
      ...prev,
      states: prev.states.includes(value)
        ? prev.states.filter(s => s !== value)
        : [...prev.states, value]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alerts</h1>
          <p className="text-muted-foreground">Get notified when matching lots are listed</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Alert
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Alert</DialogTitle>
              <DialogDescription>
                Get notified when new lots match your criteria
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Alert Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Fire Rated Doors in Sydney"
                  value={newAlert.name}
                  onChange={(e) => setNewAlert(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Categories</Label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_CATEGORIES.slice(0, 8).map(cat => (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => toggleCategory(cat.slug)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        newAlert.categories.includes(cat.slug)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>States</Label>
                <div className="flex flex-wrap gap-2">
                  {AUSTRALIAN_STATES.map(state => (
                    <button
                      key={state.value}
                      type="button"
                      onClick={() => toggleState(state.value)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        newAlert.states.includes(state.value)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {state.value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="keywords">Keywords</Label>
                <Input
                  id="keywords"
                  placeholder="e.g., oak, timber, unused"
                  value={newAlert.keywords}
                  onChange={(e) => setNewAlert(prev => ({ ...prev, keywords: e.target.value }))}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notify_email"
                  checked={newAlert.notify_email}
                  onCheckedChange={(checked) => 
                    setNewAlert(prev => ({ ...prev, notify_email: checked as boolean }))
                  }
                />
                <Label htmlFor="notify_email" className="font-normal">
                  Send email notifications for matching lots
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createAlert} disabled={saving || !newAlert.name.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Alert
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No alerts set up"
          description="Create an alert and we'll email you when new listings match your criteria."
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create alert
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {alerts.map(alert => {
            const filters = alert.filters as any;
            
            return (
              <Card key={alert.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Bell className="h-4 w-4 text-primary" />
                        {alert.name}
                      </CardTitle>
                      {alert.notify_email && (
                        <CardDescription>Email notifications enabled</CardDescription>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteAlert(alert.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {filters.categories?.map((cat: string) => (
                      <Badge key={cat} variant="muted">{cat}</Badge>
                    ))}
                    {filters.states?.map((state: string) => (
                      <Badge key={state} variant="outline">{state}</Badge>
                    ))}
                    {filters.keywords && (
                      <Badge variant="outline">"{filters.keywords}"</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
