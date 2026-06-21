import { LegalPage } from './LegalPage';

export default function RefundsAndDisputes() {
  return (
    <LegalPage title="Refunds and disputes">
      <p>
        Offcutt is a marketplace for surplus and used construction materials. Items are sold "as
        described" by the seller. This page explains when refunds apply and how to raise a
        dispute.
      </p>

      <h2>Before payment</h2>
      <p>
        You can cancel a pending order at any time before payment is completed by leaving the
        checkout. If you do not pay within the reservation window, the listing is automatically
        released back to the marketplace.
      </p>

      <h2>After payment, before pickup</h2>
      <ul>
        <li>If the seller cancels, you receive a full refund of the item price and the buyer service fee.</li>
        <li>If you change your mind, contact the seller first. Refunds at this stage are at the seller's discretion.</li>
        <li>If the seller does not respond within 5 business days, contact Offcutt support.</li>
      </ul>

      <h2>At pickup</h2>
      <p>
        Inspect the item before confirming collection. If the item is not as described, do{' '}
        <strong>not</strong> confirm pickup. Open a report on the order page and contact Offcutt
        support. Once you confirm pickup, the sale is considered complete.
      </p>

      <h2>Eligible reasons for a refund or dispute</h2>
      <ul>
        <li>Item not as described in title, photos, dimensions, or condition.</li>
        <li>Suspected hazardous, contaminated, or asbestos-containing material.</li>
        <li>Seller did not show up or could not provide the item at the agreed pickup time.</li>
        <li>Item was misrepresented in quantity.</li>
        <li>Payment or payout issue caused by the platform.</li>
      </ul>

      <h2>Not eligible</h2>
      <ul>
        <li>Change of mind after pickup is confirmed.</li>
        <li>Damage caused during buyer transport.</li>
        <li>Items inspected and accepted at pickup.</li>
      </ul>

      <h2>How to raise a dispute</h2>
      <ol className="list-decimal pl-6 space-y-1">
        <li>Open the order page and use the "Report an issue" action.</li>
        <li>Choose the most accurate reason and provide details and photos.</li>
        <li>Offcutt will review the report and contact both parties.</li>
        <li>Most disputes are resolved within 5 business days.</li>
      </ol>

      <h2>Seller payouts</h2>
      <p>
        Seller payouts are released after pickup is confirmed. If a dispute is open, payouts are
        held until the issue is resolved.
      </p>

      <h2>Contact</h2>
      <p>
        For any refund or dispute question, email{' '}
        <a href="mailto:support@offcutt.com.au">support@offcutt.com.au</a> with your order
        reference.
      </p>
    </LegalPage>
  );
}