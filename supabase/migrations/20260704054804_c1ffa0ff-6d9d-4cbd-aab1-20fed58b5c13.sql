
CREATE OR REPLACE FUNCTION public.trigger_auto_payout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.status = 'collected' AND OLD.status IS DISTINCT FROM 'collected' THEN
    PERFORM net.http_post(
      url := 'https://uiusztanyjwmccdabtvs.supabase.co/functions/v1/auto-payout-on-collected',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpdXN6dGFueWp3bWNjZGFidHZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTI4MzIsImV4cCI6MjA4NTYyODgzMn0.Yca7Ojjnl9r27r-5aMDAJ0NLN4kmL2Ev6ceIP7bWm-E',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpdXN6dGFueWp3bWNjZGFidHZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTI4MzIsImV4cCI6MjA4NTYyODgzMn0.Yca7Ojjnl9r27r-5aMDAJ0NLN4kmL2Ev6ceIP7bWm-E'
      ),
      body := jsonb_build_object('order_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;
