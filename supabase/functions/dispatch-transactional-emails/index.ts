import { createClient } from 'npm:@supabase/supabase-js@2'

const DEFAULT_BATCH_SIZE = 25
const SITE_NAME = 'Offcutt'
const ROOT_URL = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://offcutt.com.au'
const DEFAULT_FROM = Deno.env.get('EMAIL_FROM_ADDRESS') ?? 'Offcutt <no-reply@offcutt.com.au>'

type NotificationRow = {
  id: string
  user_id: string
  type: string
  title: string
  message: string | null
  link_url: string | null
  priority: string | null
  related_order_id: string | null
  related_lot_id: string | null
  related_conversation_id: string | null
  related_report_id: string | null
  data: Record<string, unknown> | null
  created_at: string
}

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
}

const NON_UNSUBSCRIBABLE_TYPES = new Set([
  'order_paid',
  'payment_successful',
  'payment_failed',
  'auction_won',
  'auction_payment_action_required',
  'auction_payment_deadline',
  'new_sale',
  'order_sold',
  'seller_buyer_charged_payout_timing',
  'pickup_proposed',
  'pickup_agreed',
  'ready_for_pickup',
  'pickup_reminder',
  'pickup_missed',
  'order_collected',
  'refund_requested',
  'refund_processed',
  'dispute_update',
  'report_received',
  'report_resolved',
  'payout_scheduled',
  'payout_processing',
  'payout_paid',
  'payout_failed',
  'payout_on_hold',
  'stripe_connect_action_required',
  'stripe_connect_onboarding_incomplete',
  'stripe_connect_payouts_paused',
])

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) return null

  try {
    const payload = parts[1]
      .replaceAll('-', '+')
      .replaceAll('_', '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')

    return JSON.parse(atob(payload)) as Record<string, unknown>
  } catch {
    return null
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function normalizeUrl(linkUrl: string | null): string {
  if (!linkUrl) return `${ROOT_URL}/app/notifications`
  if (linkUrl.startsWith('http://') || linkUrl.startsWith('https://')) return linkUrl
  return `${ROOT_URL}${linkUrl.startsWith('/') ? linkUrl : `/${linkUrl}`}`
}

function subjectFor(notification: NotificationRow): string {
  const title = notification.title?.trim() || 'Offcutt notification'
  return title.toLowerCase().includes('offcutt') ? title : `${title} - Offcutt`
}

function actionLabelFor(type: string): string {
  if (type.includes('message')) return 'Open message'
  if (type.includes('pickup')) return 'View pickup'
  if (type.includes('payout')) return 'View payout'
  if (type.includes('stripe_connect')) return 'Complete payout setup'
  if (type === 'auction_won') return 'Open winner guide'
  if (type === 'auction_payment_action_required' || type === 'auction_payment_deadline') return 'Resolve payment'
  if (type.includes('auction') || type === 'outbid') return 'View auction'
  if (type.includes('report') || type.includes('dispute')) return 'View issue'
  return 'Open Offcutt'
}

function emailIntroFor(type: string): string {
  if (type === 'new_message') return 'You received a new message on Offcutt:'
  if (type === 'auction_won') return 'Congratulations. Your winning order and collection guide are ready.'
  if (type === 'seller_buyer_charged_payout_timing') {
    return 'A buyer has been charged for your sale. Your payout is expected within 24-48 hours after collection and release checks pass.'
  }
  if (type === 'payout_paid') return 'Your seller payout has been marked paid.'
  if (type === 'payout_scheduled' || type === 'payout_processing') return 'Your seller payout is being prepared.'
  if (type.startsWith('stripe_connect')) return 'Your Stripe payout setup needs attention.'
  if (type === 'auction_ending_soon') return 'An auction you are watching or bidding on is ending soon.'
  return 'Here is an update from Offcutt:'
}

function renderEmail(notification: NotificationRow, profile: ProfileRow): { html: string; text: string } {
  const safeTitle = escapeHtml(notification.title || 'Offcutt notification')
  const safeMessage = escapeHtml(notification.message || '')
  const recipientName = profile.full_name?.trim() || 'there'
  const safeRecipientName = escapeHtml(recipientName)
  const actionUrl = normalizeUrl(notification.link_url)
  const safeActionUrl = escapeHtml(actionUrl)
  const actionLabel = escapeHtml(actionLabelFor(notification.type))
  const intro = escapeHtml(emailIntroFor(notification.type))

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#171717;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;border-bottom:1px solid #f0f0f0;">
                <div style="font-size:20px;font-weight:700;color:#ff6b1a;">Offcutt</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 16px;font-size:15px;color:#525866;">Hi ${safeRecipientName},</p>
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#171717;">${safeTitle}</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#525866;">${intro}</p>
                ${safeMessage ? `<div style="margin:18px 0;padding:16px;border-left:4px solid #ff6b1a;background:#fff7ed;border-radius:6px;font-size:15px;line-height:1.6;color:#2a2a2a;">${safeMessage}</div>` : ''}
                <p style="margin:22px 0 0;">
                  <a href="${safeActionUrl}" style="display:inline-block;background:#ff6b1a;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:6px;">${actionLabel}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px;background:#fafafa;border-top:1px solid #f0f0f0;font-size:12px;line-height:1.5;color:#6b7280;">
                This email relates to your Offcutt account or marketplace activity.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const text = [
    `${SITE_NAME}: ${notification.title}`,
    '',
    `Hi ${recipientName},`,
    '',
    emailIntroFor(notification.type),
    notification.message ? `\n${notification.message}` : '',
    '',
    `${actionLabelFor(notification.type)}: ${actionUrl}`,
  ].filter(Boolean).join('\n')

  return { html, text }
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const token = authHeader.slice('Bearer '.length).trim()
  const claims = parseJwtClaims(token)
  if (claims?.role !== 'service_role') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const scheduled = await supabase.rpc('create_scheduled_email_notifications')
  if (scheduled.error) {
    console.error('Could not create scheduled email notifications', scheduled.error)
  }

  const url = new URL(req.url)
  const batchSize = Math.min(
    Math.max(Number(url.searchParams.get('limit') ?? DEFAULT_BATCH_SIZE), 1),
    100,
  )

  const { data: notifications, error: notificationsError } = await supabase
    .from('notifications')
    .select('id,user_id,type,title,message,link_url,priority,related_order_id,related_lot_id,related_conversation_id,related_report_id,data,created_at')
    .eq('email_should_send', true)
    .is('email_queued_at', null)
    .is('email_sent_at', null)
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (notificationsError) {
    console.error('Could not load pending notification emails', notificationsError)
    return new Response(JSON.stringify({ error: 'Could not load notification emails' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rows = (notifications ?? []) as NotificationRow[]
  if (!rows.length) {
    return new Response(JSON.stringify({ queued: 0, scheduled: scheduled.data ?? null }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const userIds = Array.from(new Set(rows.map((row) => row.user_id)))
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id,email,full_name')
    .in('id', userIds)

  if (profilesError) {
    console.error('Could not load notification recipients', profilesError)
    return new Response(JSON.stringify({ error: 'Could not load recipients' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const profileRows = (profiles ?? []) as ProfileRow[]
  const profilesById = new Map(profileRows.map((profile) => [profile.id, profile]))
  const recipientEmails = profileRows
    .map((profile) => profile.email?.toLowerCase())
    .filter((email): email is string => Boolean(email))

  const { data: suppressed } = recipientEmails.length
    ? await supabase.from('suppressed_emails').select('email').in('email', recipientEmails)
    : { data: [] }
  const suppressedEmails = new Set((suppressed ?? []).map((row: { email: string }) => row.email.toLowerCase()))

  let queued = 0
  let skipped = 0
  const errors: Array<{ notification_id: string; error: string }> = []

  for (const notification of rows) {
    const profile = profilesById.get(notification.user_id)
    const email = profile?.email?.trim()
    const messageId = `notification-${notification.id}`

    if (!profile || !email) {
      skipped++
      await supabase.from('notifications').update({
        email_queued_at: new Date().toISOString(),
        email_error: 'Recipient email missing',
        email_message_id: messageId,
        email_template_name: 'transactional_notification',
      }).eq('id', notification.id)
      continue
    }

    if (
      suppressedEmails.has(email.toLowerCase()) &&
      !NON_UNSUBSCRIBABLE_TYPES.has(notification.type)
    ) {
      skipped++
      await supabase.from('notifications').update({
        email_queued_at: new Date().toISOString(),
        email_error: 'Recipient suppressed',
        email_message_id: messageId,
        email_template_name: 'transactional_notification',
      }).eq('id', notification.id)
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: `transactional_${notification.type}`,
        recipient_email: email,
        status: 'suppressed',
        metadata: { notification_id: notification.id, notification_type: notification.type },
      })
      continue
    }

    const { html, text } = renderEmail(notification, profile)

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: `transactional_${notification.type}`,
      recipient_email: email,
      status: 'pending',
      metadata: { notification_id: notification.id, notification_type: notification.type },
    })

    const { error: enqueueError } = await supabase.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        to: email,
        from: DEFAULT_FROM,
        subject: subjectFor(notification),
        html,
        text,
        label: `transactional_${notification.type}`,
        queued_at: new Date().toISOString(),
        notification_id: notification.id,
        notification_type: notification.type,
      },
    })

    if (enqueueError) {
      const message = enqueueError.message ?? 'Failed to enqueue email'
      errors.push({ notification_id: notification.id, error: message })
      await supabase.from('notifications').update({
        email_error: message,
        email_message_id: messageId,
        email_template_name: 'transactional_notification',
      }).eq('id', notification.id)
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: `transactional_${notification.type}`,
        recipient_email: email,
        status: 'failed',
        error_message: message,
        metadata: { notification_id: notification.id, notification_type: notification.type },
      })
      continue
    }

    const now = new Date().toISOString()
    await supabase.from('notifications').update({
      email_queued_at: now,
      email_error: null,
      email_message_id: messageId,
      email_template_name: 'transactional_notification',
    }).eq('id', notification.id)
    queued++
  }

  return new Response(
    JSON.stringify({
      queued,
      skipped,
      errors,
      scheduled: scheduled.data ?? null,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
