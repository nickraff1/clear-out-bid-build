# Resend Auth Email Transition

Offcutt uses a Supabase Auth email hook that renders branded React email templates,
queues messages in `auth_emails`, and dispatches them through
`process-email-queue`.

The sender has been changed from Lovable Emails to Resend while keeping the
existing queue, retry, TTL, logging, and template flow.

## Required Secrets

Add these as Lovable/Supabase function secrets:

- `RESEND_API_KEY`: Resend API key with send access.
- `EMAIL_FROM_ADDRESS`: `Offcutt <no-reply@offcutt.com.au>`.
- `SUPABASE_URL`: existing project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: existing service-role key.
- `LOVABLE_API_KEY`: keep this for the auth email hook signature and preview
  endpoint. It is no longer used as the outbound email provider.

## Resend Domain

Verify `offcutt.com.au` in Resend before switching live auth emails.

Required DNS is shown inside Resend, usually:

- DKIM records
- SPF / return-path record if provided
- DMARC record strongly recommended

The sender address should be:

```text
no-reply@offcutt.com.au
```

## Lovable Prompt

```text
Transition Offcutt auth email delivery from Lovable Emails to Resend.

The repository now sends queued auth emails from process-email-queue through the Resend API.

Please apply the latest GitHub changes and deploy:
- supabase/functions/auth-email-hook
- supabase/functions/process-email-queue

Add or confirm these function secrets:
- RESEND_API_KEY = the Resend API key I provide in the Lovable secrets UI
- EMAIL_FROM_ADDRESS = Offcutt <no-reply@offcutt.com.au>
- SUPABASE_URL = existing project URL
- SUPABASE_SERVICE_ROLE_KEY = existing service role key
- LOVABLE_API_KEY = keep existing value for auth hook signature verification

Do not commit or reveal any secret values.

Keep the existing auth-email-hook, auth_emails queue, process-email-queue, email_send_log, email_send_state, and pgmq queue infrastructure active.

Do not use Lovable Emails as the outbound provider for queued auth email sends.
Do not change payments, Stripe, auctions, payouts, RLS, order lifecycle, admin access, buyer flow, or seller flow.

After deployment, test:
1. Password reset email for a real test account.
2. Signup confirmation email for a disposable test account.
3. Resend shows the email as sent.
4. email_send_log shows sent status.
5. Reset link opens https://offcutt.com.au and allows password update.
```

## Manual QA

1. In Resend, confirm `offcutt.com.au` is verified.
2. In Lovable/Supabase secrets, add `RESEND_API_KEY`.
3. Add `EMAIL_FROM_ADDRESS`.
4. Deploy `auth-email-hook`.
5. Deploy `process-email-queue`.
6. Trigger password reset.
7. Run or wait for the email queue processor.
8. Confirm Resend activity shows the email.
9. Confirm `email_send_log.status = 'sent'`.
10. Confirm the reset link works end to end.

## Rollback

If Resend fails during cutover:

1. Restore the previous `process-email-queue` implementation that used
   Lovable Emails.
2. Redeploy `process-email-queue`.
3. Keep `auth-email-hook` active.
4. Inspect `email_send_log` and the DLQ before retrying failed messages.
