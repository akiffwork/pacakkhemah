"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type Discount, type GearItem, discountState } from "@/lib/inventory";
import { PageHeader, Segments, Toast, useToast } from "@/components/ui/kit";
import DiscountsList from "@/components/promotions/DiscountsList";
import ReferralCodes from "@/components/promotions/ReferralCodes";
import LoyaltyEditor from "@/components/promotions/LoyaltyEditor";

type Section = "discounts" | "referrals" | "loyalty";

/** Every way a customer can pay less, in one place. */
export default function PromotionsTab({ vendorId, vendorName, initialSection }: { vendorId: string; vendorName: string; initialSection?: string | null }) {
  const [section, setSection] = useState<Section>(initialSection === "referrals" || initialSection === "loyalty" ? initialSection : "discounts");
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [gear, setGear] = useState<GearItem[]>([]);
  const { toast, show } = useToast();

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "vendors", vendorId, "discounts"),
      snap => setDiscounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Discount)).filter(d => !d.deleted)), () => {});
    const u2 = onSnapshot(query(collection(db, "gear"), where("vendorId", "==", vendorId)),
      snap => setGear(snap.docs.map(d => ({ id: d.id, ...d.data() } as GearItem)).filter(g => !g.deleted)), () => {});
    return () => { u1(); u2(); };
  }, [vendorId]);

  const active = discounts.filter(d => discountState(d).state === "active").length;

  return (
    <div className="flex flex-col gap-4 pb-24">
      <PageHeader title="Promotions" subtitle="Discounts, referral codes and loyalty rewards" />
      <Segments label="Promotion types" value={section} onChange={setSection} items={[
        { key: "discounts", label: active ? `Discounts · ${active} active` : "Discounts" },
        { key: "referrals", label: "Referral codes" },
        { key: "loyalty", label: "Loyalty" },
      ]} />
      {section === "discounts" && <DiscountsList vendorId={vendorId} discounts={discounts} gear={gear} onToast={show} />}
      {section === "referrals" && <ReferralCodes vendorId={vendorId} vendorName={vendorName} existingPromoCodes={discounts.filter(d => d.type === "promo_code").map(d => d.code || "")} onToast={show} />}
      {section === "loyalty" && <LoyaltyEditor vendorId={vendorId} gear={gear} />}
      <Toast toast={toast} />
    </div>
  );
}
