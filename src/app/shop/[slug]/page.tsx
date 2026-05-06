import { Metadata } from "next";
import ShopClient from "./ShopClient";
import { buildItemMetadata, buildVendorMetadata, getGearItem, getVendorData, parseFirestoreDoc } from "./_lib/metadata";

// ─────────────────────────────────────────────────────────────────────────────
// Metadata — supports both vendor page and old `?item=` deep links (back-compat)
// ─────────────────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { item: itemId } = await searchParams;

  const vendor = await getVendorData(slug);

  if (itemId) {
    const gear = await getGearItem(itemId);
    return buildItemMetadata({ itemId, vendor, gear });
  }

  return buildVendorMetadata(vendor);
}

// ─────────────────────────────────────────────────────────────────────────────
// Page — fetches vendor on the server and seeds ShopClient
// ─────────────────────────────────────────────────────────────────────────────

export default async function ShopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vendor = await getVendorData(slug);

  const initialVendor = vendor ? parseFirestoreDoc(vendor.doc) : null;
  const initialVendorId = vendor?.id || null;

  return (
    <ShopClient
      params={params}
      initialVendor={initialVendor}
      initialVendorId={initialVendorId}
    />
  );
}
