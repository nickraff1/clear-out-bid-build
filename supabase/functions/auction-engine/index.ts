import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { chargeAuctionWinnerOrder } from '../_shared/auction-winner-charge.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Auction configuration
const AUCTION_CONFIG = {
  SOFT_CLOSE_THRESHOLD_SECONDS: 60, // If bid within last 60 seconds
  SOFT_CLOSE_EXTENSION_SECONDS: 120, // Extend by 2 minutes
  RATE_LIMIT_PER_MINUTE: 10, // Max bids per user per minute per lot
}

// Bid increment tiers
const BID_INCREMENTS = [
  { maxPrice: Infinity, increment: 1 },
]

function getMinimumIncrement(currentBid: number): number {
  for (const tier of BID_INCREMENTS) {
    if (currentBid < tier.maxPrice) {
      return tier.increment
    }
  }
  return 1
}

interface BidRequest {
  lot_id: string
  amount: number
  org_id: string
  environment?: 'sandbox' | 'live'
}

interface CloseAuctionRequest {
  lot_id: string
  environment?: 'sandbox' | 'live'
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Create admin client for server-side operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse action from request body
    const body = await req.json()
    const action = body.action || 'place-bid' // Default to place-bid for backwards compatibility

    console.log(`[AUCTION] Action: ${action}, User: ${user.id}`)

    // Route to different actions
    if (req.method === 'POST') {
      if (action === 'place-bid') {
        return await handlePlaceBid(body, supabaseAdmin, user.id)
      } else if (action === 'close-auction') {
        return await handleCloseAuction(body, supabaseAdmin, user.id)
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    console.error('Auction engine error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: 'Internal server error', details: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function handlePlaceBid(body: BidRequest, supabase: any, userId: string) {
  const { lot_id, amount, org_id } = body
  const environment = body.environment === 'live' ? 'live' : 'sandbox'

  console.log(`[AUCTION] Bid request: user=${userId}, lot=${lot_id}, amount=${amount}`)

  // Validate input
  if (!lot_id || !amount || !org_id) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // 0. Server-side eligibility gate — single source of truth.
  const { data: eligibility, error: eligErr } = await supabase
    .rpc('can_user_bid_for_environment', {
      _user_id: userId,
      _lot_id: lot_id,
      _environment: environment,
    })
    .maybeSingle()

  if (eligErr) {
    console.error('[AUCTION] can_user_bid error', eligErr)
    return new Response(JSON.stringify({ error: 'Eligibility check failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
  if (!eligibility?.allowed) {
    const map: Record<string, string> = {
      lot_not_found: 'Lot not found.',
      not_an_auction: 'This lot is not an auction.',
      auction_not_active: 'This auction is not active.',
      auction_ended: 'This auction has ended.',
      verification_required: 'Please complete bidder verification before bidding.',
      terms_acceptance_required: 'Please accept the auction terms before bidding.',
      account_restricted: 'Your bidding privileges are currently restricted. Contact support.',
      account_banned: 'This account is not permitted to bid.',
      unpaid_previous_auction: 'You have an unpaid auction win. Resolve it before bidding again.',
    }
    return new Response(JSON.stringify({
      error: map[eligibility?.reason as string] || 'You are not eligible to bid right now.',
      reason: eligibility?.reason,
      verification_required: true,
    }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // 1. Check rate limiting
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString()
  const { count: recentBidsCount } = await supabase
    .from('bids')
    .select('*', { count: 'exact', head: true })
    .eq('lot_id', lot_id)
    .eq('user_id', userId)
    .gte('created_at', oneMinuteAgo)

  if (recentBidsCount && recentBidsCount >= AUCTION_CONFIG.RATE_LIMIT_PER_MINUTE) {
    console.log(`[AUCTION] Rate limit exceeded for user ${userId}`)
    return new Response(JSON.stringify({ 
      error: 'Rate limit exceeded. Please wait before placing another bid.' 
    }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // 2. Get lot details
  const { data: lot, error: lotError } = await supabase
    .from('lots')
    .select('*, event:clearance_events(*)')
    .eq('id', lot_id)
    .single()

  if (lotError || !lot) {
    console.log(`[AUCTION] Lot not found: ${lot_id}`)
    return new Response(JSON.stringify({ error: 'Lot not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // 3. Validate lot is an active auction
  if (lot.pricing_type !== 'auction') {
    return new Response(JSON.stringify({ error: 'This lot is not an auction' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (lot.status !== 'active') {
    return new Response(JSON.stringify({ error: 'This auction is not active' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const now = new Date()
  const auctionEnd = new Date(lot.auction_end)
  
  // Check if auction has ended (without soft close consideration)
  if (now > auctionEnd) {
    return new Response(JSON.stringify({ error: 'This auction has ended' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // 4. Validate bid amount
  const currentPrice = lot.current_bid || lot.start_price || 0
  const minimumIncrement = getMinimumIncrement(currentPrice)
  const minimumBid = currentPrice + minimumIncrement

  if (amount < minimumBid) {
    return new Response(JSON.stringify({ 
      error: `Bid must be at least $${minimumBid.toFixed(2)}. Minimum increment is $${minimumIncrement}.`
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // 5. Check soft close - extend if bid in final 60 seconds
  const secondsRemaining = (auctionEnd.getTime() - now.getTime()) / 1000
  let newAuctionEnd = lot.auction_end
  let softCloseExtended = false

  if (secondsRemaining <= AUCTION_CONFIG.SOFT_CLOSE_THRESHOLD_SECONDS) {
    const extendedEnd = new Date(now.getTime() + (AUCTION_CONFIG.SOFT_CLOSE_EXTENSION_SECONDS * 1000))
    newAuctionEnd = extendedEnd.toISOString()
    softCloseExtended = true
    console.log(`[AUCTION] Soft close triggered, extending to ${newAuctionEnd}`)
  }

  // 6. Mark previous winning bid as not winning
  await supabase
    .from('bids')
    .update({ is_winning: false })
    .eq('lot_id', lot_id)
    .eq('is_winning', true)

  // 7. Insert new bid
  const { data: newBid, error: bidError } = await supabase
    .from('bids')
    .insert({
      lot_id,
      user_id: userId,
      org_id,
      amount,
      is_winning: true,
      payment_environment: environment,
    })
    .select()
    .single()

  if (bidError) {
    console.error('[AUCTION] Error inserting bid:', bidError)
    const dbMessage = bidError.message || bidError.details || 'Failed to place bid'
    const isPickupWindowError = /pickup_window_expired|pickup window/i.test(dbMessage)
    return new Response(JSON.stringify({
      error: isPickupWindowError
        ? 'This bid was blocked by an expired parent event pickup window. The listing is active, but the database still needs the event-date gate migration applied.'
        : dbMessage,
      details: dbMessage,
    }), {
      status: isPickupWindowError ? 409 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // 8. Update lot with new current bid and bid count
  const updateData: any = {
    current_bid: amount,
    bid_count: (lot.bid_count || 0) + 1
  }
  
  if (softCloseExtended) {
    updateData.auction_end = newAuctionEnd
  }

  await supabase
    .from('lots')
    .update(updateData)
    .eq('id', lot_id)

  // 9. Record bid event in audit log
  await supabase
    .from('bid_events')
    .insert({
      bid_id: newBid.id,
      lot_id,
      user_id: userId,
      org_id,
      amount,
      event_type: 'bid_placed',
      metadata: {
        soft_close_extended: softCloseExtended,
        new_auction_end: softCloseExtended ? newAuctionEnd : null,
        previous_bid: currentPrice,
        payment_environment: environment,
      }
    })

  console.log(`[AUCTION] Bid placed successfully: bid_id=${newBid.id}`)

  return new Response(JSON.stringify({ 
    success: true, 
    bid: newBid,
    soft_close_extended: softCloseExtended,
    new_auction_end: softCloseExtended ? newAuctionEnd : null
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function handleCloseAuction(body: CloseAuctionRequest, supabase: any, userId: string) {
  const { lot_id } = body

  console.log(`[AUCTION] Close auction request: lot=${lot_id}`)

  // Get lot details
  const { data: lot, error: lotError } = await supabase
    .from('lots')
    .select('*, event:clearance_events(*)')
    .eq('id', lot_id)
    .single()

  if (lotError || !lot) {
    return new Response(JSON.stringify({ error: 'Lot not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Check if auction has ended
  const now = new Date()
  const auctionEnd = new Date(lot.auction_end)
  
  if (now < auctionEnd) {
    return new Response(JSON.stringify({ error: 'Auction has not ended yet' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Get winning bid
  const { data: winningBid } = await supabase
    .from('bids')
    .select('*, bidder:profiles(*)')
    .eq('lot_id', lot_id)
    .eq('is_winning', true)
    .single()

  if (!winningBid) {
    // No bids - mark as unsold
    await supabase
      .from('lots')
      .update({ status: 'unsold' })
      .eq('id', lot_id)

    console.log(`[AUCTION] Lot ${lot_id} ended with no bids - marked unsold`)

    return new Response(JSON.stringify({ 
      success: true, 
      result: 'unsold',
      message: 'Auction ended with no bids'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Check reserve price
  if (lot.reserve_price && winningBid.amount < lot.reserve_price) {
    await supabase
      .from('lots')
      .update({ status: 'unsold' })
      .eq('id', lot_id)

    console.log(`[AUCTION] Lot ${lot_id} reserve not met - marked unsold`)

    return new Response(JSON.stringify({ 
      success: true, 
      result: 'reserve_not_met',
      message: 'Reserve price was not met'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Create order for winner (with 10% buyer fee)
  const baseAmount = winningBid.amount
  const buyerFee = Math.round(baseAmount * 0.10 * 100) / 100
  const totalAmount = Math.round((baseAmount + buyerFee) * 100) / 100

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      lot_id,
      event_id: lot.event_id,
      buyer_id: winningBid.user_id,
      buyer_org_id: winningBid.org_id,
      amount: totalAmount, // Total including 10% buyer fee
      status: 'pending_payment',
      auction_payment_environment: winningBid.payment_environment ?? 'sandbox',
      notes: `Winning bid: $${baseAmount.toFixed(2)}, Buyer fee (10%): $${buyerFee.toFixed(2)}`
    })
    .select()
    .single()

  if (orderError) {
    console.error('[AUCTION] Error creating order:', orderError)
    return new Response(JSON.stringify({ error: 'Failed to create order' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const reservedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  // Reserve the lot for the winner. The paid-order path marks it sold only
  // after the saved-card auction charge succeeds.
  await supabase
    .from('lots')
    .update({
      status: 'reserved',
      reserved_order_id: order.id,
      reserved_until: reservedUntil,
      winning_bidder_id: winningBid.user_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lot_id)

  // Record bid event
  await supabase
    .from('bid_events')
    .insert({
      bid_id: winningBid.id,
      lot_id,
      user_id: winningBid.user_id,
      org_id: winningBid.org_id,
      amount: winningBid.amount,
      event_type: 'auction_won',
      metadata: { order_id: order.id }
    })

  // Notify winner
  await supabase
    .from('notifications')
    .insert({
      user_id: winningBid.user_id,
      type: 'auction_won',
      title: 'You won an auction!',
      message: `Congratulations! You won "${lot.title}" for $${totalAmount.toFixed(2)}. Offcutt is charging your saved card automatically.`,
      data: { lot_id, order_id: order.id, amount: totalAmount, base_amount: baseAmount, buyer_fee: buyerFee }
    })

  const chargeResult = await chargeAuctionWinnerOrder(supabase, {
    orderId: order.id,
    env: body.environment === 'live' ? 'live' : (winningBid.payment_environment ?? 'sandbox'),
  })

  console.log(`[AUCTION] Lot ${lot_id} closed for ${winningBid.user_id} at $${winningBid.amount}`, chargeResult)

  return new Response(JSON.stringify({ 
    success: true, 
    result: 'sold',
    order,
    charge_result: chargeResult,
    winner: {
      user_id: winningBid.user_id,
      amount: winningBid.amount
    }
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
