import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link_url: string | null;
  related_order_id: string | null;
  related_lot_id: string | null;
  related_conversation_id: string | null;
  related_report_id: string | null;
  read: boolean;
  read_at: string | null;
  priority: string;
  created_at: string;
};

const markAllNotificationsRead = supabase.rpc as unknown as (
  fn: 'mark_all_notifications_read',
) => Promise<{ error: { message?: string } | null }>;

export function useNotifications(limit = 30) {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const channelKey = useRef(crypto.randomUUID());

  const refresh = useCallback(async () => {
    if (!user) { setItems([]); setUnread(0); setLoading(false); return; }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    const list = (data ?? []) as Notification[];
    setItems(list);
    setUnread(list.filter(n => !n.read).length);
    setLoading(false);
  }, [user, limit]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif-${user.id}-${channelKey.current}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { refresh(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refresh]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    refresh();
  };
  const markAllRead = async () => {
    await markAllNotificationsRead('mark_all_notifications_read');
    refresh();
  };

  return { items, unread, loading, refresh, markRead, markAllRead };
}
