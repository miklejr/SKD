// app/portfolios/page.tsx
// Страница управления портфелями пользователя
// Отображает список портфелей и позволяет создавать новые

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FolderOpen, Plus, X } from 'lucide-react';

// Интерфейс для данных портфеля из GraphQL
interface Portfolio {
  id: string;
  name: string;
  totalValue: number;
  dailyChange: number;
  totalReturnPercent: number;
}

// Интерфейс для ответа GraphQL
interface GraphQLResponse {
  data?: {
    myPortfolios: Portfolio[];
  };
  errors?: Array<{
    message: string;
  }>;
}

export default function PortfoliosPage() {
  // Состояние для списка портфелей
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  
  // Состояние загрузки
  const [loading, setLoading] = useState(true);
  
  // Состояние ошибки
  const [error, setError] = useState<string | null>(null);
  
  // Состояние модального окна создания портфеля
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Состояние для названия нового портфеля
  const [newPortfolioName, setNewPortfolioName] = useState('');
  
  // Состояние загрузки при создании портфеля
  const [creating, setCreating] = useState(false);

  // Загружаем портфели при монтировании компонента
  useEffect(() => {
    async function fetchPortfolios() {
      try {
        setLoading(true);
        setError(null);
        
        // GraphQL запрос для получения всех портфелей
        const query = `
          query {
            myPortfolios {
              id
              name
              totalValue
              dailyChange
              totalReturnPercent
            }
          }
        `;
        
        // Выполняем fetch запрос к GraphQL API
        const response = await fetch('/api/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        });
        
        // Парсим ответ
        const result: GraphQLResponse = await response.json();
        
        // Проверяем на ошибки
        if (result.errors) {
          throw new Error(result.errors[0].message);
        }
        
        // Сохраняем данные в состояние
        if (result.data?.myPortfolios) {
          setPortfolios(result.data.myPortfolios);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      } finally {
        setLoading(false);
      }
    }
    
    fetchPortfolios();
  }, []);

  // Функция для создания нового портфеля
  async function handleCreatePortfolio() {
    // Проверяем, что название не пустое
    if (!newPortfolioName.trim()) {
      alert('Введите название портфеля');
      return;
    }

    try {
      setCreating(true);
      
      // GraphQL мутация для создания портфеля
      const mutation = `
        mutation {
          createPortfolio(name: "${newPortfolioName}") {
            id
            name
          }
        }
      `;
      
      // Выполняем fetch запрос к GraphQL API
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: mutation }),
      });
      
      // Парсим ответ
      const result: GraphQLResponse = await response.json();
      
      // Проверяем на ошибки
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      
      // Если создание успешно - обновляем список портфелей
      // Повторно загружаем портфели
      const query = `
        query {
          myPortfolios {
            id
            name
            totalValue
            dailyChange
            totalReturnPercent
          }
        }
      `;
      
      const portfoliosResponse = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      
      const portfoliosResult: GraphQLResponse = await portfoliosResponse.json();
      
      if (portfoliosResult.data?.myPortfolios) {
        setPortfolios(portfoliosResult.data.myPortfolios);
      }
      
      // Закрываем модальное окно и очищаем поле ввода
      setIsModalOpen(false);
      setNewPortfolioName('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось создать портфель');
    } finally {
      setCreating(false);
    }
  }

  // Форматируем число в рублевый формат с разделителями тысяч
  const formatRubles = (value: number): string => {
    return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
  };

  // Если данные загружаются - показываем скелетон
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Скелетон для заголовка и кнопки */}
          <div className="flex justify-between items-center mb-8">
            <div className="h-10 w-64 bg-zinc-200 rounded"></div>
            <div className="h-10 w-40 bg-zinc-200 rounded"></div>
          </div>
          
          {/* Скелетон для карточек */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm h-48">
                <div className="h-8 w-48 bg-zinc-200 rounded mb-4"></div>
                <div className="h-12 w-32 bg-zinc-200 rounded mb-2"></div>
                <div className="h-6 w-24 bg-zinc-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Если произошла ошибка - показываем сообщение об ошибке
  if (error) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-red-500 mb-4">Ошибка: {error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-[#2563EB] text-white px-6 py-2 rounded-lg hover:bg-[#1d4ed8] transition-colors"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Заголовок страницы и кнопка создания */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-[#1E293B] mb-2">
              Мои портфели
            </h1>
            <p className="text-lg text-zinc-600">
              Управляйте своими инвестициями
            </p>
          </div>
          
          {/* Кнопка создания портфеля */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Создать портфель
          </button>
        </div>

        {/* Если портфелей нет - показываем пустое состояние */}
        {portfolios.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
            <p className="text-lg text-zinc-600 mb-2">
              У вас пока нет портфелей
            </p>
            <p className="text-sm text-zinc-500 mb-6">
              Создайте первый, чтобы начать инвестировать
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
            >
              Создать портфель
            </button>
          </div>
        ) : (
          /* Сетка карточек портфелей */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {portfolios.map((portfolio) => (
              <Link
                key={portfolio.id}
                href={`/portfolios/${portfolio.id}`}
                className="block"
              >
                <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 p-6 h-full">
                  {/* Название портфеля */}
                  <h2 className="text-2xl font-bold text-[#1E293B] mb-4">
                    {portfolio.name}
                  </h2>
                  
                  {/* Общая стоимость портфеля */}
                  <div className="mb-2">
                    <p className="text-sm text-zinc-500 mb-1">Общая стоимость</p>
                    <p className="text-3xl font-bold text-[#1E293B]">
                      {formatRubles(portfolio.totalValue)}
                    </p>
                  </div>
                  
                  {/* Дневное изменение */}
                  <div className="mb-2">
                    <p className="text-sm text-zinc-500 mb-1">Изменение за день</p>
                    <p className={`text-lg font-medium ${
                      portfolio.dailyChange >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                    }`}>
                      {portfolio.dailyChange >= 0 ? '+' : ''}{formatRubles(portfolio.dailyChange)}
                    </p>
                  </div>
                  
                  {/* Общая доходность в процентах */}
                  <div>
                    <p className="text-sm text-zinc-500 mb-1">Общая доходность</p>
                    <p className={`text-lg font-medium ${
                      portfolio.totalReturnPercent >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                    }`}>
                      {portfolio.totalReturnPercent >= 0 ? '+' : ''}{portfolio.totalReturnPercent.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Модальное окно создания портфеля */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Заголовок модального окна */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-[#1E293B]">
                Новый портфель
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Поле ввода названия */}
            <div className="mb-6">
              <label htmlFor="portfolioName" className="block text-sm font-medium text-zinc-700 mb-2">
                Название портфеля
              </label>
              <input
                id="portfolioName"
                type="text"
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
                placeholder="Например: Мой первый портфель"
                className="w-full px-4 py-3 rounded-lg border border-zinc-300 bg-white text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-shadow"
                autoFocus
              />
            </div>
            
            {/* Кнопки действий */}
            <div className="flex gap-4">
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={creating}
                className="flex-1 px-4 py-3 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Отмена
              </button>
              <button
                onClick={handleCreatePortfolio}
                disabled={creating || !newPortfolioName.trim()}
                className="flex-1 bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
