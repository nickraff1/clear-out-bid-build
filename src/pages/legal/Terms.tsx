import { LegalPage } from './LegalPage';

export default function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        Welcome to Offcutt. By using our platform you agree to these terms. Offcutt is a
        marketplace that connects sellers of surplus construction materials with buyers. Offcutt is
        not a party to any transaction between users.
      </p>

      <h2>1. Marketplace role</h2>
      <p>
        Offcutt provides the platform, payment processing, messaging, and pickup-coordination
        tools. Sellers are solely responsible for lawful ownership of items they list, the accuracy
        of descriptions and photos, the safety and condition of materials, and compliance with all
        applicable laws including building, environmental, and waste regulations.
      </p>

      <h2>2. Buyer responsibilities</h2>
      <ul>
        <li>Inspect items at pickup before confirming collection.</li>
        <li>Bring an appropriate vehicle, equipment, and help for loading.</li>
        <li>Pay in full through the Offcutt checkout — never pay sellers off-platform.</li>
        <li>Only confirm pickup once you have physically received the item.</li>
      </ul>

      <h2>3. Seller responsibilities</h2>
      <ul>
        <li>List only items you legally own and are entitled to sell.</li>
        <li>Describe items accurately, including dimensions, quantity, and condition.</li>
        <li>Do not list prohibited materials (see our <a href="/prohibited-materials">Prohibited materials</a> page).</li>
        <li>Provide accurate pickup details, access notes, and contact information.</li>
        <li>Honour confirmed pickup times and respond to buyer messages promptly.</li>
      </ul>

      <h2>4. Fees</h2>
      <p>
        Offcutt charges a 10% buyer service fee at checkout and a 10% seller commission on the
        item sale price. Fees are shown clearly before purchase and in seller payout summaries.
      </p>

      <h2>5. Prohibited conduct</h2>
      <ul>
        <li>Listing stolen, recalled, hazardous, or asbestos-containing materials.</li>
        <li>Misrepresenting items, prices, or pickup locations.</li>
        <li>Bidding on your own listings or coordinating to inflate prices.</li>
        <li>Harassment, threats, or unsafe behaviour at pickup.</li>
        <li>Bypassing the Offcutt payment system.</li>
      </ul>

      <h2>6. Account suspension</h2>
      <p>
        Offcutt may suspend or remove any account, listing, or transaction that breaches these
        terms, is reported by other users, or poses a safety or legal risk.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        Offcutt provides the platform on an "as is" basis. To the maximum extent permitted by
        Australian law, Offcutt is not liable for the condition, safety, quality, or legality of
        items listed by sellers, or for losses arising from interactions between users.
      </p>

      <h2>8. Governing law</h2>
      <p>
        These terms are governed by the laws of New South Wales, Australia. Any disputes will be
        resolved in NSW courts.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these terms from time to time. Continued use of the platform after changes
        means you accept the updated terms.
      </p>
    </LegalPage>
  );
}