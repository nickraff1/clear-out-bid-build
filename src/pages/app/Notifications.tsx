import { Link, useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { BellOff, CheckCheck, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function NotificationsPage() {
  const { items, unread, loading, markRead, markAllRead } = useNotifications(200);
  const navigate = useNavigate();

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">{unread} unread of {items.length}</p>
        </div>
        {unread > 0 && (
          <Button variant="outline" onClick={markAllRead}><CheckCheck className="h-4 w-4 mr-2" />Mark all read</Button>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <BellOff className="h-10 w-10 mx-auto mb-2 opacity-50" />
          You have no notifications yet.
        </Card>
      ) : (
        <div className="border rounded-md divide-y bg-card">
          {items.map(n => (
            <button key={n.id}
              onClick={async () => { if (!n.read) await markRead(n.id); if (n.link_url) navigate(n.link_url); }}
              className={`w-full text-left px-4 py-3 hover:bg-accent flex items-start gap-3 ${n.read ? '' : 'bg-accent/30'}`}>
              <span className={`mt-2 h-2 w-2 rounded-full flex-shrink-0 ${n.read ? 'bg-transparent' : 'bg-primary'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium">{n.title}</div>
                  {n.priority === 'high' && <Badge variant="warning" className="text-[10px]">High</Badge>}
                  <Badge variant="muted" className="text-[10px]">{n.type}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">{n.message}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {format(parseISO(n.created_at), 'MMM d, yyyy · HH:mm')}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}