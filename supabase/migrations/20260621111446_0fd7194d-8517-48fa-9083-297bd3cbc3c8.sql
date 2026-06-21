
-- Allow buyers (and their org members) to view lots/events for orders they own,
-- so post-purchase pages can display lot title, event details, etc.

CREATE POLICY "Buyers can view lots they have orders for"
  ON public.lots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.lot_id = lots.id
        AND (
          o.buyer_id = auth.uid()
          OR (o.buyer_org_id IS NOT NULL AND public.is_org_member(auth.uid(), o.buyer_org_id))
        )
    )
  );

CREATE POLICY "Buyers can view events they have orders for"
  ON public.clearance_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.event_id = clearance_events.id
        AND (
          o.buyer_id = auth.uid()
          OR (o.buyer_org_id IS NOT NULL AND public.is_org_member(auth.uid(), o.buyer_org_id))
        )
    )
  );

-- Allow viewing lot_media for those same lots.
CREATE POLICY "Buyers can view media for ordered lots"
  ON public.lot_media
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.lot_id = lot_media.lot_id
        AND (
          o.buyer_id = auth.uid()
          OR (o.buyer_org_id IS NOT NULL AND public.is_org_member(auth.uid(), o.buyer_org_id))
        )
    )
  );
