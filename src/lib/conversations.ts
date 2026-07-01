import { supabase } from '@/integrations/supabase/client';

type RpcError = { message?: string } | null;
type EnsureConversationRpcArgs = {
  _buyer_id: string;
  _seller_org_id: string;
  _lot_id: string | null;
  _order_id: string | null;
};
type EnsureConversationArgs = {
  buyerId: string;
  sellerOrgId: string;
  lotId: string | null;
  orderId?: string | null;
};

export async function ensureConversation({
  buyerId,
  sellerOrgId,
  lotId,
  orderId = null,
}: EnsureConversationArgs) {
  const { data, error } = await supabase.rpc('ensure_conversation', {
    _buyer_id: buyerId,
    _seller_org_id: sellerOrgId,
    _lot_id: lotId,
    _order_id: orderId,
  } as EnsureConversationRpcArgs) as { data: string | null; error: RpcError };

  if (error) throw new Error(error.message ?? 'Could not create conversation.');
  if (!data) throw new Error('Could not create conversation.');

  return data;
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
