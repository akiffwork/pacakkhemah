"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Order } from "@/lib/orderFlow";
import { PageHeader, Segments } from "@/components/ui/kit";
import SalesView from "@/components/performance/SalesView";
import InsightsTab, { type InsightsView } from "@/components/InsightsTab";

type Section = "sales" | InsightsView;

const SECTIONS: { key: Section; label: string }[] = [
  { key: "sales", label: "Sales" },
  { key: "customers", label: "Customers" },
  { key: "heatmap", label: "Busy days" },
  { key: "items", label: "Items" },
  { key: "forecast", label: "Forecast" },
  { key: "promos", label: "Promotion results" },
];

/** Sales and insights in one place (was Analytics and Insights). */
export default function PerformanceTab({ vendorId }: { vendorId: string }) {
  const [section, setSection] = useState<Section>("sales");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "orders"), where("vendorId", "==", vendorId)),
      snap => { setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)).filter(o => !o.deleted)); setLoading(false); },
      () => setLoading(false));
    return () => unsub();
  }, [vendorId]);

  return (
    <div className="flex flex-col gap-4 pb-24">
      <PageHeader title="Performance" subtitle="How your shop is doing, from the orders you record" />
      <Segments label="Performance sections" value={section} onChange={setSection} items={SECTIONS} />
      {section === "sales"
        ? (loading ? <div className="h-40 bg-white border border-slate-200 rounded-2xl animate-pulse" /> : <SalesView vendorId={vendorId} orders={orders} />)
        : <InsightsTab vendorId={vendorId} view={section} />}
    </div>
  );
}
