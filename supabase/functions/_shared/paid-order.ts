import { createClient } from "npm:@supabase/supabase-js@2";

export const ORDER_CONFIRMED_MESSAGE =
  "Order confirmed. Please arrange pickup through this chat. Pickup details are available on the order page once payment is confirmed.";

type SupabaseAdmin = ReturnType<typeof createClient>;

type UpdatedOrder = {
  buyer_id: string;
  lot_id: string;
  lot?: { title?: string | null } | null;
  event?: { org_id?: string | null; created_by?: string | null } | null;
};

type ConversationRow = { id: string };

export async function completePaidOrder(
  sb: SupabaseAdmin,
  args: { orderId: string; paymentReference: string | null },
) {
  const { orderId, paymentReference } = args;

  const { data: codeRow } = await sb.rpc("generate_pickup_code");
  const pickupCode = (codeRow as unknown as string) ?? Math.random().toString(36).slice(2, 8).toUpperCase();

  const { data: updatedOrder } = await sb.from("orders").update({
    status: "paid",
    payment_reference: paymentReference,
    pickup_code: pickupCode,
    pickup_status: "awaiting_arrangement",
    auction_payment_error: null,
    updated_at: new Date().toISOString(),
  }).eq("id", orderId).eq("status", "pending_payment")
    .select("*, lot:lots(id, title, event_id), event:clearance_events(org_id, created_by)")
    .maybeSingle();

  if (!updatedOrder) return null;
  const order = updatedOrder as unknown as UpdatedOrder;

  await sb.from("lots").update({
    status: "sold",
    reserved_until: null,
  }).eq("id", order.lot_id);

  const buyerId = order.buyer_id;
  const lotId = order.lot_id;
  const sellerOrgId = order.event?.org_id ?? undefined;
  let conversationId: string | null = null;

  if (sellerOrgId) {
    const { data: conversation, error: conversationError } = await sb
      .from("conversations")
      .upsert(
        { buyer_id: buyerId, seller_org_id: sellerOrgId, lot_id: lotId, order_id: orderId },
        { onConflict: "order_id" },
      )
      .select("id")
      .single();

    if (conversationError) {
      console.error("Failed to create order conversation", conversationError);
    } else {
      conversationId = (conversation as unknown as ConversationRow | null)?.id ?? null;
    }

    if (conversationId) {
      const { data: existingSystemMessage } = await sb
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("is_system", true)
        .eq("body", ORDER_CONFIRMED_MESSAGE)
        .maybeSingle();

      if (!existingSystemMessage) {
        await sb.from("messages").insert({
          conversation_id: conversationId,
          sender_id: buyerId,
          is_system: true,
          body: ORDER_CONFIRMED_MESSAGE,
        });
      }
    }
  }

  const sellerCreator = order.event?.created_by ?? undefined;
  const lotTitle = order.lot?.title ?? "your lot";
  const notifications = [
    {
      user_id: buyerId,
      type: "order_paid",
      title: "Payment received",
      message: `Your payment for "${lotTitle}" was successful. The seller has been notified — arrange pickup from your order page.`,
      data: { order_id: orderId },
    },
  ];
  if (sellerCreator) {
    notifications.push({
      user_id: sellerCreator,
      type: "order_sold",
      title: "Item sold",
      message: `"${lotTitle}" has been paid for. Arrange pickup with the buyer and mark it ready when prepared.`,
      data: { order_id: orderId },
    });
  }
  await sb.from("notifications").insert(notifications);

  return order;
}
