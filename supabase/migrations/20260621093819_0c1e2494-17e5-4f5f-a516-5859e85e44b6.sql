-- Allow either the buyer OR a member of the seller org to create a conversation.
-- Previously only buyers could insert, which broke the seller-side "Message buyer" action
-- on the order page when no conversation existed yet.
DROP POLICY IF EXISTS "Buyer creates conversation" ON public.conversations;
CREATE POLICY "Participants create conversation"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    buyer_id = auth.uid()
    OR public.is_org_member(auth.uid(), seller_org_id)
  );

-- Admin moderation workflow uses 'investigating' but the old CHECK constraint rejected it.
ALTER TABLE public.lot_reports
  DROP CONSTRAINT IF EXISTS lot_reports_status_check;
ALTER TABLE public.lot_reports
  ADD CONSTRAINT lot_reports_status_check
  CHECK (status = ANY (ARRAY['open','investigating','reviewed','resolved','dismissed']));
