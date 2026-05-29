// app/signin/page.tsx
// Страница входа в систему

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignInPage() {
  const router = useRouter();
  
  // Состояние для полей формы
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Состояние загрузки
  const [loading, setLoading] = useState(false);
  
  // Состояние ошибки
  const [error, setError] = useState<string | null>(null);

  // Функция для обработки входа
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    
    // Сбрасываем ошибку
    setError(null);
    
    // Проверяем, что поля заполнены
    if (!email || !password) {
      setError('Заполните все поля');
      return;
    }

    try {
      setLoading(true);
      
      // GraphQL мутация для входа
      const mutation = `
        mutation {
          signIn(email: "${email}", password: "${password}") {
            token
            user {
              id
              email
            }
          }
        }
      `;
      
      // Выполняем запрос к GraphQL API
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: mutation }),
      });
      
      const result = await response.json();
      
      // Проверяем на ошибки
      if (result.errors) {
        setError(result.errors[0].message);
        return;
      }
      
      // Сохраняем токен в localStorage
      if (result.data?.signIn?.token) {
        localStorage.setItem('authToken', result.data.signIn.token);
        
        // Перенаправляем на страницу портфелей
        router.push('/portfolios');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-sm p-8 w-full max-w-md">
        {/* Заголовок */}
        <h1 className="text-3xl font-bold text-[#1E293B] mb-2 text-center">
          Вход в InvestGuide
        </h1>
        <p className="text-zinc-600 text-center mb-8">
          Введите свои данные для входа
        </p>

        {/* Форма */}
        <form onSubmit={handleSignIn} className="space-y-6">
          {/* Поле email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 bg-white text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-shadow"
              required
            />
          </div>

          {/* Поле пароль */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-2">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 bg-white text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-shadow"
              required
            />
          </div>

          {/* Ошибка */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Кнопка входа */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        {/* Ссылка на регистрацию */}
        <p className="text-center text-zinc-600 mt-6">
          Нет аккаунта?{' '}
          <Link href="/signup" className="text-[#2563EB] hover:text-[#1d4ed8] font-medium">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}
