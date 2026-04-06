import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Booking Calender",
  description: "Urus jadual tempahan dan blok tarikh untuk peralatan sewa anda.",
  robots: { index: false, follow: false },
};

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return children;
}