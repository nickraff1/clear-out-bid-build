import { supabase } from '@/integrations/supabase/client';

type RpcError = { message?: string } | null;
type EnsureConversationArgs = {
  buyerId: string;
  sellerOrgId: string;
  lotId: string | null;
  orderId?: string | null;
};

const ensureConversationRpc = supabase.rpc as unknown as (
  fn: 'ensure_conversation',
  args: {
    _buyer_id: string;
    _seller_org_id: string;
    _lot_id: string | null;
    _order_id: string | null;
  },
) => Promise<{ data: string | null; error: RpcError }>;

export async function ensureConversation({
  buyerId,
  sellerOrgId,
  lotId,
  orderId = null,
}: EnsureConversationArgs) {
  const { data, error } = await ensureConversationRpc('ensure_conversation', {
    _buyer_id: buyerId,
    _seller_org_id: sellerOrgId,
    _lot_id: lotId,
    _order_id: orderId,
  });

  if (error) throw new Error(error.message ?? 'Could not create conversation.');
  if (!data) throw new Error('Could not create conversation.');

  return data;
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
