import { Link, useNavigate } from 'react-router-dom';
import { Notification, useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell, CheckCheck } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

export function NotificationsBell() {
  const { items, unread, markRead, markAllRead } = useNotifications(20);
  const navigate = useNavigate();

  const open = async (n: Notification) => {
    if (!n.read) await markRead(n.id);
    if (n.link_url) navigate(n.link_url);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="font-semibold text-sm">Notifications</div>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={markAllRead}>
                <CheckCheck className="h-3 w-3 mr-1" /> Mark all read
              </Button>
            )}
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          )}
          {items.map(n => (
            <button
              key={n.id}
              onClick={() => open(n)}
              className={`w-full text-left px-3 py-2 border-b hover:bg-accent flex gap-2 ${n.read ? '' : 'bg-accent/40'}`}
            >
              <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${n.read ? 'bg-transparent' : 'bg-primary'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm truncate">{n.title}</div>
                  {n.priority === 'high' && <Badge variant="warning" className="text-[10px]">!</Badge>}
                </div>
                <div className="text-xs text-muted-foreground line-clamp-2">{n.message}</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="p-2 border-t">
          <Button asChild variant="ghost" size="sm" className="w-full text-xs">
            <Link to="/app/notifications">View all</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
