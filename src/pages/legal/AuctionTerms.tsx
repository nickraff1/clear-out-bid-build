import { LegalPage } from './LegalPage';

export default function AuctionTerms() {
  return (
    <LegalPage title="Auction Terms">
      <p className="font-medium text-foreground">
        Bids on Offcutt are legally binding.
      </p>
      <p>
        By placing a bid you confirm: "I understand that bids are binding. If I win, I
        must complete payment and pickup. If I fail to complete payment or pickup, Offcutt may
        charge or retain an auction commitment deposit/default fee according to the auction
        terms."
      </p>

      <h2>1. Bidding</h2>
      <ul>
        <li>You must be a verified bidder with a saved payment method to place a bid.</li>
        <li>Each bid is an irrevocable offer to buy the lot at the bid price.</li>
        <li>Bids in the final minute of an auction may extend the auction (soft close).</li>
      </ul>

      <h2>2. Auction commitment deposit</h2>
      <p>
        Higher-value lots may require a refundable deposit hold on your saved card before your
        bid is accepted. The current Offcutt ladder is:
      </p>
      <ul>
        <li>Up to $250 — no deposit</li>
        <li>$251 – $1,000 — $25</li>
        <li>$1,001 – $2,500 — $75</li>
        <li>$2,501 – $5,000 — $250</li>
        <li>$5,001 – $10,000 — $500</li>
        <li>Over $10,000 — $1,000</li>
      </ul>
      <p>
        Holds are released if you are outbid or the auction ends without your bid winning.
        If you win and do not complete payment, the deposit may be captured as a default fee.
      </p>

      <h2>3. Winning &amp; payment</h2>
      <ul>
        <li>If you win, an order is created automatically with a 10% buyer fee.</li>
        <li>You must complete payment within 24 hours of winning.</li>
        <li>Failure to pay forfeits the deposit and may restrict or ban your account.</li>
      </ul>

      <h2>4. Pickup obligations</h2>
      <p>
        You must collect the lot within the seller's published pickup window. See the
        <a href="/buyer-default-policy"> buyer default policy</a> for what happens otherwise.
      </p>

      <h2>5. Prohibited bidding</h2>
      <p>
        See <a href="/prohibited-bidding-policy">Prohibited bidding policy</a> for behaviour
        that will result in bid removal, restriction, or a permanent ban.
      </p>
    </LegalPage>
  );
}