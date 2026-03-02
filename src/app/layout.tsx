import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#062c24",
};

export const metadata: Metadata = {
  title: {
    default: "Pacak Khemah — Sewa Gear Camping Malaysia",
    template: "%s | Pacak Khemah",
  },
  description:
    "Sewa peralatan camping dari vendor dipercayai di seluruh Malaysia. Khemah, kerusi, dapur, drone & lagi. Tempah melalui WhatsApp dalam beberapa minit.",
  keywords: [
    "sewa camping", "rental camping gear", "sewa khemah",
    "camping Malaysia", "outdoor gear rental", "pacak khemah",
    "sewa peralatan camping", "camping equipment hire",
    "khemah sewa Johor", "khemah sewa KL", "khemah sewa Selangor",
  ],
  authors: [{ name: "Pacak Khemah" }],
  creator: "Pacak Khemah",
  openGraph: {
    type: "website",
    locale: "ms_MY",
    siteName: "Pacak Khemah",
    title: "Pacak Khemah — Sewa Gear Camping Malaysia",
    description:
      "Sewa peralatan camping dari vendor dipercayai. Khemah, kerusi, dapur & lagi. Tempah melalui WhatsApp.",
    images: [
      {
        url: "/pacak-khemah.png",
        width: 512,
        height: 512,
        alt: "Pacak Khemah Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Pacak Khemah — Sewa Gear Camping Malaysia",
    description:
      "Sewa peralatan camping dari vendor dipercayai. Tempah melalui WhatsApp.",
    images: ["/pacak-khemah.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ms" className={inter.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}