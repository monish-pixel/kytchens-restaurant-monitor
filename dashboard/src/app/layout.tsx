import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kytchens Fleet Monitor",
  description: "Swiggy & Zomato status across all Kytchens locations",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
