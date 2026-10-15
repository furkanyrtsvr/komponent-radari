import { normalizeMpn, normalize } from "./domain";
import type { Product } from "./domain";
export function parseBomRows(
  rows: Record<string, unknown>[],
  products: Product[],
) {
  if (rows.length > 200) throw new Error("BOM en fazla 200 satır olabilir.");
  const items: { productId: string; quantity: number }[] = [],
    unmatched: { mpn: string; quantity: number }[] = [];
  for (const [i, row] of rows.entries()) {
    const mpn = String(
      row.MPN ?? row.mpn ?? row.Value ?? row.value ?? "",
    ).trim();
    const quantity = Number(
      row.Quantity ?? row.quantity ?? row.Qty ?? row.Adet,
    );
    if (
      !mpn ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 100000
    )
      throw new Error(
        `BOM satır ${i + 2}: MPN ve 1–100000 arası tam sayı Quantity gerekli.`,
      );
    const maker = String(
      row.Manufacturer ?? row.manufacturer ?? row.Brand ?? row.Marka ?? "",
    ).trim();
    const matches = products.filter(
      (p) =>
        p.mpn &&
        normalizeMpn(p.mpn) === normalizeMpn(mpn) &&
        (!maker || normalize(p.manufacturer) === normalize(maker)),
    );
    const p = matches.length === 1 ? matches[0] : undefined;
    if (p) items.push({ productId: p.id, quantity });
    else unmatched.push({ mpn, quantity });
  }
  return { items, unmatched };
}
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
