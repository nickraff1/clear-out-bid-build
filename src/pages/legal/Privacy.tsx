import { LegalPage } from './LegalPage';

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This page describes how Offcutt collects, uses, and protects your information. This page
        is maintained by Offcutt to answer common privacy questions about our marketplace and is
        not an independent certification.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Account information you provide (name, email, business details, phone).</li>
        <li>Listing details and photos uploaded by sellers.</li>
        <li>Order, payment, and pickup-coordination data.</li>
        <li>Messages exchanged between buyers and sellers on the platform.</li>
        <li>Basic device and usage information needed to operate the service.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run the marketplace, process payments, and coordinate pickups.</li>
        <li>To notify you about orders, messages, bids, and pickup status.</li>
        <li>To prevent fraud, abuse, and unsafe listings.</li>
        <li>To improve the platform and respond to support requests.</li>
      </ul>

      <h2>What we share</h2>
      <p>
        Buyer and seller contact details are shared with the other party only after a paid order
        is created, to allow pickup coordination. We use trusted service providers (payments,
        hosting, email) to operate the platform and only share the minimum data required.
      </p>
      <p>We do not sell your personal information.</p>

      <h2>Pickup address visibility</h2>
      <p>
        Full pickup addresses are hidden until a buyer has completed payment. Public listings show
        only the suburb and state.
      </p>

      <h2>Data retention</h2>
      <p>
        We keep account, order, and payout records for as long as your account is active and as
        required by Australian tax and record-keeping laws.
      </p>

      <h2>Your rights</h2>
      <p>
        You can request access to or deletion of your personal information by contacting{' '}
        <a href="mailto:support@offcutt.com.au">support@offcutt.com.au</a>. Some records (e.g.
        completed orders) may be retained for legal compliance.
      </p>

      <h2>Security</h2>
      <p>
        Offcutt uses industry-standard hosting, encrypted connections, and access controls. No
        online service can guarantee absolute security; report suspected security issues to{' '}
        <a href="mailto:security@offcutt.com.au">security@offcutt.com.au</a>.
      </p>
    </LegalPage>
  );
}