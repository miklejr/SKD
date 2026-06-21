// components/Header.tsx
// Компонент навигации сайта - шапка с логотипом и ссылками

'use client';

import Link from 'next/link';
import { Briefcase, LayoutGrid, Home } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Логотип / название сайта */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#2563EB] rounded-lg flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-[#1E293B]">InvestGuide</span>
          </Link>

          {/* Навигационные ссылки */}
          <nav className="flex items-center gap-4 sm:gap-6">
            {/* Ссылка на главную страницу */}
            <Link
              href="/"
              className="flex items-center gap-2 text-zinc-600 hover:text-[#2563EB] transition-colors font-medium"
            >
              <Home className="w-5 h-5" />
              <span className="hidden sm:inline">Главная</span>
            </Link>

            {/* Ссылка на каталог ETF */}
            <Link
              href="/catalog"
              className="flex items-center gap-2 text-zinc-600 hover:text-[#2563EB] transition-colors font-medium"
            >
              <LayoutGrid className="w-5 h-5" />
              <span className="hidden sm:inline">Каталог</span>
            </Link>

            {/* Ссылка на портфели */}
            <Link
              href="/portfolios"
              className="flex items-center gap-2 text-zinc-600 hover:text-[#2563EB] transition-colors font-medium"
            >
              <Briefcase className="w-5 h-5" />
              <span className="hidden sm:inline">Мои портфели</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
