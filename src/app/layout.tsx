import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
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

  // PWA
  manifest: "/manifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pacak Khemah",
  },
  formatDetection: { telephone: false },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#062c24",
    "msapplication-tap-highlight": "no",
  },

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
        {/* PWA iOS icons */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
      </head>
      <body className={inter.className}>
        {children}

        {/* Google AdSense */}
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2429364031062979"
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />

        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-129EPBWVDH"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-129EPBWVDH');
          `}
        </Script>
      </body>
    </html>
  );
}