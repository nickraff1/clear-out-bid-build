import { LegalPage } from './LegalPage';

export default function PickupSafety() {
  return (
    <LegalPage title="Pickup safety">
      <p>
        Offcutt pickups happen on private sites, building sites, yards, and driveways. Both buyers
        and sellers are responsible for making pickups safe.
      </p>

      <h2>For buyers</h2>
      <ul>
        <li>Bring an appropriate vehicle and trailer for the size and weight of the material.</li>
        <li>Bring help if the item is heavy, awkward, or requires two people to load safely.</li>
        <li>Wear closed shoes, gloves, and high-vis if visiting an active site.</li>
        <li>Inspect the item in person before loading and before confirming collection.</li>
        <li>If the item is not as described, do not confirm pickup — message the seller and report the issue.</li>
        <li>Only share your pickup code with the seller once you physically have the item.</li>
      </ul>

      <h2>For sellers</h2>
      <ul>
        <li>Provide accurate site address, access notes, and a contact number.</li>
        <li>Ensure safe vehicle access, parking, and a clear loading area.</li>
        <li>Have the item ready, separated, and accessible at the agreed pickup time.</li>
        <li>Only confirm the pickup code once the buyer has loaded the item and left safely.</li>
        <li>Do not allow pickup of any item you suspect may be unsafe — cancel the order instead.</li>
      </ul>

      <h2>Asbestos and suspected hazards</h2>
      <p>
        If at pickup either party suspects the item may contain asbestos or other hazardous
        material, stop immediately, do not load, and report the listing through Offcutt. Refer to
        our <a href="/prohibited-materials">Prohibited materials</a> page.
      </p>

      <h2>Disputes at pickup</h2>
      <p>
        If something goes wrong, message the other party first through Offcutt. If you cannot
        resolve it, open a report on the order page or contact{' '}
        <a href="mailto:support@offcutt.com.au">support@offcutt.com.au</a>. Keep the pickup code
        and any photos as evidence.
      </p>

      <h2>Emergencies</h2>
      <p>
        In any emergency, call <strong>000</strong> immediately. Offcutt cannot dispatch emergency
        services.
      </p>
    </LegalPage>
  );
}