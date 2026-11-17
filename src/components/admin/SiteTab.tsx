"use client";

// Admin › Site: what customers see on the public pages.

import { useState } from "react";
import { PageHeader, Segments, Toast, useToast } from "@/components/ui/kit";
import ContentTab, { type ContentSection } from "./ContentTab";
import CampsitesTab from "./CampsitesTab";

type Section = ContentSection | "campsites";

const SECTIONS: { key: Section; label: string; hint: string }[] = [
  { key: "announcement", label: "Announcement", hint: "A banner at the top of the homepage" },
  { key: "homepage", label: "Homepage", hint: "The title, text and button at the top of the homepage" },
  { key: "about", label: "About", hint: "The About page" },
  { key: "faq", label: "FAQ", hint: "Questions on the FAQ page, in English and Malay" },
  { key: "testimonials", label: "Testimonials", hint: "Shown on the homepage until there are customer reviews" },
  { key: "events", label: "Events", hint: "Camping events on the homepage. Past events are removed automatically." },
  { key: "articles", label: "Guide articles", hint: "Articles in the camping guide" },
  { key: "campsites", label: "Campsites", hint: "The campsite directory" },
];

export default function SiteTab({ initialSection }: { initialSection?: string }) {
  const [section, setSection] = useState<Section>(SECTIONS.some(s => s.key === initialSection) ? initialSection as Section : "announcement");
  const { toast, show } = useToast();
  const meta = SECTIONS.find(s => s.key === section)!;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Site" subtitle="What customers see on the public pages" />
      <Segments label="Site sections" value={section} onChange={setSection} items={SECTIONS.map(s => ({ key: s.key, label: s.label }))} />
      <p className="text-[13px] text-slate-600 -mt-1">{meta.hint}</p>
      {/* Kept mounted so unsaved edits survive switching sections */}
      <div hidden={section === "campsites"}>
        <ContentTab section={section === "campsites" ? "announcement" : section} notify={show} />
      </div>
      {section === "campsites" && <CampsitesTab notify={show} />}
      <Toast toast={toast} />
    </div>
  );
}
