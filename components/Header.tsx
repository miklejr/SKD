// components/Header.tsx
// Компонент навигации сайта - шапка с логотипом и ссылками

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Briefcase, LayoutGrid, Home, LogOut, LogIn, UserPlus } from 'lucide-react';

export default function Header() {
  const router = useRouter();
  
  // Состояние для токена авторизации
  const [token, setToken] = useState<string | null>(null);
  
  // Состояние для email пользователя (извлекаем из токена при необходимости)
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // При монтировании компонента проверяем токен в localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    setToken(storedToken);
    
    // TODO: Можно декодировать JWT токен для получения email
    // Для простоты пока не декодируем
  }, []);

  // Функция для выхода из системы
  function handleSignOut() {
    // Удаляем токен из localStorage
    localStorage.removeItem('authToken');
    
    // Обновляем состояние
    setToken(null);
    setUserEmail(null);
    
    // Перенаправляем на главную страницу
    router.push('/');
  }

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

            {/* Разделитель */}
            <div className="hidden sm:block w-px h-6 bg-zinc-200"></div>

            {/* Кнопки авторизации */}
            {token ? (
              // Пользователь авторизован - показываем email и кнопку выхода
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-600 hidden sm:inline">
                  {userEmail || 'Авторизован'}
                </span>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 text-zinc-600 hover:text-red-500 transition-colors font-medium"
                  title="Выйти"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="hidden sm:inline">Выйти</span>
                </button>
              </div>
            ) : (
              // Пользователь не авторизован - показываем кнопки входа и регистрации
              <div className="flex items-center gap-2">
                <Link
                  href="/signin"
                  className="flex items-center gap-2 text-zinc-600 hover:text-[#2563EB] transition-colors font-medium"
                >
                  <LogIn className="w-5 h-5" />
                  <span className="hidden sm:inline">Войти</span>
                </Link>
                <Link
                  href="/signup"
                  className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Регистрация</span>
                </Link>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
