import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Daftar Sebagai Vendor — Sewa Gear Anda",
  description:
    "Sertai rangkaian sewa peralatan camping Pacak Khemah. Senaraikan gear anda, terima tempahan melalui WhatsApp & mula menjana pendapatan.",
  robots: { index: false, follow: false },
};

export default function RegisterVendorLayout({ children }: { children: React.ReactNode }) {
  return children;
}