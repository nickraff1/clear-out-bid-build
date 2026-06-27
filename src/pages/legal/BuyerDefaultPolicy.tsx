import { LegalPage } from './LegalPage';

export default function BuyerDefaultPolicy() {
  return (
    <LegalPage title="Buyer Default Policy">
      <p>
        Bids on Offcutt are legally binding. This policy explains what happens if a
        winning bidder does not complete payment or pickup.
      </p>

      <h2>1. Unpaid winning bid</h2>
      <ul>
        <li>Winners must pay within 24 hours of the auction closing.</li>
        <li>After 24 hours the order is auto-cancelled and the lot is released.</li>
        <li>Any held auction commitment deposit is captured as a default fee.</li>
        <li>The unpaid count on your account is incremented and recorded in your audit log.</li>
      </ul>

      <h2>2. Account restrictions</h2>
      <ul>
        <li>One unpaid win — warning &amp; deposit forfeit.</li>
        <li>Two unpaid wins — account automatically restricted from bidding.</li>
        <li>Repeated default, fraud, or shill-bidding behaviour — permanent ban.</li>
      </ul>

      <h2>3. What happens to the lot</h2>
      <p>
        Offcutt may, at its discretion, offer the lot to the next highest bidder at their last
        bid price, or relist it as a new auction.
      </p>

      <h2>4. Pickup default</h2>
      <p>
        If you pay but do not collect within the seller's published pickup window, the seller
        may treat the item as abandoned. Refunds in this case are at the seller's discretion
        and Offcutt's <a href="/refunds-and-disputes">refunds and disputes</a> policy applies.
      </p>

      <h2>5. Appeals</h2>
      <p>
        If you believe an account restriction was applied in error, contact Offcutt support
        from the verified email on the account.
      </p>
    </LegalPage>
  );
}