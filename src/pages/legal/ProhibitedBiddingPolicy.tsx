import { LegalPage } from './LegalPage';

export default function ProhibitedBiddingPolicy() {
  return (
    <LegalPage title="Prohibited Bidding Policy">
      <p>
        Fair, transparent auctions are critical to Offcutt. The following behaviour is
        prohibited and may result in bid removal, account restriction, ban, or referral to law
        enforcement.
      </p>

      <h2>1. Self-bidding</h2>
      <p>
        You may not bid on your own listings or coordinate with anyone associated with the
        seller account or organization.
      </p>

      <h2>2. Shill bidding</h2>
      <p>
        Bidding solely to inflate a lot's price without intention to purchase is prohibited.
        This includes coordinating with other accounts to drive up bids.
      </p>

      <h2>3. Throwaway / sniper accounts</h2>
      <p>
        Creating disposable accounts to place high last-second bids you do not intend to honour
        is prohibited. Verified bidder status, saved payment method, and auction commitment
        deposits exist to prevent this.
      </p>

      <h2>4. Off-platform payment</h2>
      <p>
        Offering to buy or sell outside of Offcutt checkout to avoid fees, taxes, or buyer
        protections is prohibited.
      </p>

      <h2>5. Bid retraction abuse</h2>
      <p>
        Once placed, a bid is binding. Repeated requests to retract bids will be treated as
        default behaviour under the <a href="/buyer-default-policy">buyer default policy</a>.
      </p>

      <h2>6. Enforcement</h2>
      <ul>
        <li>Admin may remove any suspicious bid and notify the affected parties.</li>
        <li>Repeat or severe violations result in permanent ban with deposit forfeit.</li>
        <li>All admin actions are recorded in the bidder audit log.</li>
      </ul>
    </LegalPage>
  );
}