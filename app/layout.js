import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PrimaryNav from "./components/primary-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Transparency Tracker",
  description: "Follow Legislation and Dive into Democracy",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
        <PrimaryNav />
        {children}
      </body>
    </html>
  );
}
