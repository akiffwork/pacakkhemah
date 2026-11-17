"use client";

import { useState } from "react";
import type { VendorSettings } from "@/lib/vendorSettings";
import { useVendorEditor } from "@/hooks/useVendorEditor";
import { PageHeader, Segments, Toast, useToast } from "@/components/ui/kit";
import StorefrontGroup from "@/components/settings/StorefrontGroup";
import SaveBar from "@/components/settings/SaveBar";
import UpdatesTab from "@/components/UpdatesTab";
import FoodPartnersTab from "@/components/FoodPartnersTab";
import OrderGuideTab from "@/components/vendor/OrderGuideTab";

type Section = "storefront" | "posts" | "food" | "guide";

/** Everything customers see on the shop page, in one place. */
export default function ShopPageTab({ vendorId, vendorData, initialSection }: {
  vendorId: string; vendorData: VendorSettings & { name?: string; slug?: string; [key: string]: unknown }; initialSection?: string | null;
}) {
  const [section, setSection] = useState<Section>(
    initialSection === "posts" || initialSection === "food" || initialSection === "guide" ? initialSection : "storefront");
  const [openSection, setOpenSection] = useState<string | null>(null);
  const { v, set, state, retry } = useVendorEditor(vendorId, vendorData);
  const { toast, show } = useToast();

  return (
    <div className="flex flex-col gap-4 pb-28">
      <PageHeader title="Shop page" subtitle="What customers see when they open your shop" />
      <Segments label="Shop page sections" value={section} onChange={setSection} items={[
        { key: "storefront", label: "Logo and About" },
        { key: "posts", label: "Posts" },
        { key: "food", label: "Food partners" },
        { key: "guide", label: "Order guide" },
      ]} />
      {section === "storefront" && (
        <>
          <StorefrontGroup vendorId={vendorId} v={v} set={set} openSection={openSection} setOpenSection={setOpenSection} toast={show} />
          <SaveBar state={state} retry={retry} />
        </>
      )}
      {section === "posts" && <UpdatesTab vendorId={vendorId} vendorName={String(vendorData.name || "")} vendorSlug={vendorData.slug} />}
      {section === "food" && <FoodPartnersTab vendorId={vendorId} />}
      {section === "guide" && <OrderGuideTab vendorId={vendorId} vendorSlug={vendorData.slug} />}
      <Toast toast={toast} />
    </div>
  );
}
