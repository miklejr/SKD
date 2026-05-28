import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

// Подключаем шрифт Inter из Google Fonts
// Inter - популярный современный шрифт от Google
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap", // Оптимизация загрузки шрифта
});

export const metadata: Metadata = {
  title: "InvestGuide",
  description: "Отслеживайте популярные ETF с реальными данными через GraphQL API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {/* Шапка сайта с навигацией */}
        <Header />
        
        {/* Основной контент страницы */}
        <main className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
