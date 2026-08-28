import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

// Get the base URL for Open Graph images
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://partner.extrahand.in';

export const metadata: Metadata = {
  title: "ExtraHand - Partner Onboarding Platform",
  description: "Partner Onboarding Platform for ExtraHand",
  openGraph: {
    title: "ExtraHand - Partner Onboarding Platform",
    description: "Partner Onboarding Platform for ExtraHand",
    url: baseUrl,
    siteName: "ExtraHand",
    images: [
      {
        url: `${baseUrl}/logo.png`,
        width: 512,
        height: 512,
        alt: "ExtraHand Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "ExtraHand - Partner Onboarding Platform",
    description: "Partner Onboarding Platform for ExtraHand",
    images: [`${baseUrl}/logo.png`],
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
