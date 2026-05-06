import { Metadata } from "next";
import ShopClient from "../../ShopClient";
import { buildItemMetadata, getGearItem, getVendorData, parseFirestoreDoc } from "../../_lib/metadata";

// ─────────────────────────────────────────────────────────────────────────────
// Metadata — item-specific OG tags served from a clean path URL (no ?item=)
// Path-based so social crawlers (Threads, etc.) can't strip the item identity.
// ─────────────────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; itemId: string }>;
}): Promise<Metadata> {
  const { slug, itemId } = await params;
  const [vendor, gear] = await Promise.all([getVendorData(slug), getGearItem(itemId)]);
  return buildItemMetadata({ itemId, vendor, gear });
}

// ─────────────────────────────────────────────────────────────────────────────
// Page — renders ShopClient with the specific item pre-opened
// ─────────────────────────────────────────────────────────────────────────────

export default async function ItemPage({
  params,
}: {
  params: Promise<{ slug: string; itemId: string }>;
}) {
  const { slug, itemId } = await params;
  const vendor = await getVendorData(slug);
  const initialVendor = vendor ? parseFirestoreDoc(vendor.doc) : null;
  const initialVendorId = vendor?.id || null;

  // ShopClient only needs slug; rewrap as Promise<{slug}>
  const slugParams = Promise.resolve({ slug });

  return (
    <ShopClient
      params={slugParams}
      initialVendor={initialVendor}
      initialVendorId={initialVendorId}
      initialItemId={itemId}
    />
  );
}
