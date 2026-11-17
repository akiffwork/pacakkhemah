"use client";

import { useEffect, useState } from "react";
import type { VendorSettings } from "@/lib/vendorSettings";
import { useVendorEditor } from "@/hooks/useVendorEditor";
import RulesGroup from "@/components/settings/RulesGroup";
import AccountGroup from "@/components/settings/AccountGroup";
import SaveBar from "@/components/settings/SaveBar";
import { PageHeader, Segments, Toast, useToast } from "@/components/ui/kit";

type Group = "rules" | "account";

type SettingsTabProps = {
  vendorId: string;
  vendorData: VendorSettings & { [key: string]: unknown };
  initialGroup?: Group;
  initialSection?: string | null;
  onRestartTour?: () => void;
  onNavigate?: (tab: string) => void;
};

/** How the shop works (Booking rules) and the vendor's private details (Account). */
export default function SettingsTab({ vendorId, vendorData, initialGroup, initialSection, onRestartTour, onNavigate }: SettingsTabProps) {
  const [group, setGroup] = useState<Group>(initialGroup || "rules");
  const [openSection, setOpenSection] = useState<string | null>(initialSection || null);
  const { v, set, state, retry } = useVendorEditor(vendorId, vendorData);
  const { toast, show } = useToast();

  useEffect(() => {
    if (!initialSection) return;
    const t = setTimeout(() => document.getElementById(`section-${initialSection}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    return () => clearTimeout(t);
  }, [initialSection]);

  const groupProps = { vendorId, v, set, openSection, setOpenSection, toast: show };

  return (
    <div className="flex flex-col gap-4 pb-28">
      <PageHeader title="Settings" subtitle="How your shop works, and your account" />
      <Segments label="Settings groups" value={group} onChange={g => { setGroup(g); setOpenSection(null); }}
        items={[{ key: "rules", label: "Booking rules" }, { key: "account", label: "Account" }]} />
      {group === "rules" && <RulesGroup {...groupProps} />}
      {group === "account" && <AccountGroup {...groupProps} onRestartTour={onRestartTour} onNavigate={onNavigate} />}
      <SaveBar state={state} retry={retry} />
      <Toast toast={toast} />
    </div>
  );
}
