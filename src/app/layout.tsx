
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Order Desk - Restaurant Operations & QR Table Ordering",
  description: "Real-time table ordering, kitchen display system (KDS), and floor service management.",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
