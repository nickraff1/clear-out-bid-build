
-- Delete the unconfirmed prior signup so a fresh signup triggers a new confirmation email.
-- Only deletes if the email is still unconfirmed, to protect against removing a real account.
DELETE FROM auth.users
WHERE email = 'nickraff1@gmail.com'
  AND email_confirmed_at IS NULL;
