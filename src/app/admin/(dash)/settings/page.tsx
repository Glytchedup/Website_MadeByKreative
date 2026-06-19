import { prisma } from "@/lib/prisma";
import { tunables } from "@/lib/config";
import { saveSetting } from "../actions";

export const dynamic = "force-dynamic";

async function get(key: string, fallback = "") {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

function SettingForm({ label, k, value, help, type = "text", textarea = false }: { label: string; k: string; value: string; help?: string; type?: string; textarea?: boolean }) {
  return (
    <form action={saveSetting} className="card p-4">
      <input type="hidden" name="key" value={k} />
      <label className="block text-sm font-semibold">{label}</label>
      {help && <p className="mb-1 text-xs text-muted">{help}</p>}
      <div className="flex gap-2">
        {textarea ? (
          <textarea name="value" defaultValue={value} rows={4} className="flex-1 rounded border border-charcoal/20 px-2 py-1.5 text-sm" />
        ) : (
          <input name="value" type={type} defaultValue={value} className="flex-1 rounded border border-charcoal/20 px-2 py-1.5 text-sm" />
        )}
        <button className="btn-primary px-3 py-1.5 text-sm">Save</button>
      </div>
    </form>
  );
}

export default async function AdminSettings() {
  const [shippingCents, shippingPolicy, returnsPolicy, faq] = await Promise.all([
    get("shipping_flat_cents", "550"),
    get("policy_shipping", ""),
    get("policy_returns", ""),
    get("policy_faq", ""),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-muted">Edit shop policies and shipping. Etsy poll interval & low-stock threshold are set in <code>.env</code> (currently {tunables.pollIntervalSeconds()}s / ≤{tunables.lowStockThreshold()}).</p>

      <div className="mt-6 space-y-4">
        <SettingForm label="Flat shipping rate (cents)" k="shipping_flat_cents" value={shippingCents} type="number" help="e.g. 550 = $5.50. Shown at checkout. PLACEHOLDER, set your real rate." />
        <SettingForm label="Shipping policy" k="policy_shipping" value={shippingPolicy} textarea help="Shown on the Policies page." />
        <SettingForm label="Returns & exchanges policy" k="policy_returns" value={returnsPolicy} textarea />
        <SettingForm label="FAQ" k="policy_faq" value={faq} textarea />
      </div>
    </div>
  );
}
