import { LegalPage } from './LegalPage';
import { AlertTriangle } from 'lucide-react';

export default function ProhibitedMaterials() {
  return (
    <LegalPage title="Prohibited materials">
      <div className="not-prose flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 mb-6">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-destructive">Do not list any of the items below.</p>
          <p className="text-muted-foreground mt-1">
            Listings that breach this policy are removed immediately and the seller account may be
            suspended. Sellers are legally responsible for what they list.
          </p>
        </div>
      </div>

      <p>
        Offcutt is a marketplace for safe, reusable construction surplus. The following materials
        and items must never be listed:
      </p>

      <h2>Hazardous and contaminated materials</h2>
      <ul>
        <li>Asbestos or any material suspected to contain asbestos (including fibro, vermiculite, old vinyl tiles, certain insulation and roofing).</li>
        <li>Lead-based paint, lead flashing, or items with flaking lead paint.</li>
        <li>Materials contaminated with mould, sewage, fuel, chemicals, or unknown residues.</li>
        <li>Hazardous waste, including solvents, paints, sealants, adhesives, or pool chemicals that are opened or unlabelled.</li>
        <li>Synthetic mineral fibre (SMF) insulation that is loose, damaged, or showing fibre release.</li>
      </ul>

      <h2>Unsafe or non-compliant items</h2>
      <ul>
        <li>Recalled products of any kind.</li>
        <li>Unsafe or non-compliant electrical items, switchboards, or wiring.</li>
        <li>Unsafe gas appliances, fittings, or LPG cylinders.</li>
        <li>Plumbing items that have carried non-potable or contaminated water without disclosure.</li>
        <li>Structural items with hidden damage, rot, or compromised integrity.</li>
      </ul>

      <h2>Legal restrictions</h2>
      <ul>
        <li>Stolen goods or items without clear ownership.</li>
        <li>Items requiring a licence to sell or transport that the seller does not hold.</li>
        <li>Firearms, ammunition, explosives, or weapons.</li>
        <li>Anything illegal to sell under Australian Commonwealth, State, or local law.</li>
      </ul>

      <h2>If you're not sure</h2>
      <p>
        If you suspect a material may contain asbestos or another hazard, do not list it. Contact
        a licensed removalist or your local council. When in doubt, leave it out.
      </p>

      <h2>Reporting</h2>
      <p>
        Anyone can report a listing using the "Report" button on the listing page. Reports are
        reviewed by the Offcutt moderation team.
      </p>
    </LegalPage>
  );
}