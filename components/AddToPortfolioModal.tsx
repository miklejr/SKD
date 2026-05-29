// components/AddToPortfolioModal.tsx
// Модальное окно для добавления ETF в портфель

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchGraphQL } from '@/lib/api';

// Интерфейс для портфеля
interface Portfolio {
  id: string;
  name: string;
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

// Пропсы компонента
interface AddToPortfolioModalProps {
  etfId: string;          // ID ETF для добавления
  etfSymbol: string;      // Символ ETF (для отображения)
  isOpen: boolean;        // Открыто ли модальное окно
  onClose: () => void;    // Функция закрытия модального окна
}

export default function AddToPortfolioModal({ etfId, etfSymbol, isOpen, onClose }: AddToPortfolioModalProps) {
  // Состояние для списка портфелей
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  
  // Состояние для выбранного портфеля
  const [selectedPortfolioId, setSelectedPortfolioId] = useState('');
  
  // Состояние для количества
  const [quantity, setQuantity] = useState('1');
  
  // Состояния загрузки и ошибки
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Состояние загрузки при добавлении
  const [adding, setAdding] = useState(false);

  // Загружаем список портфелей при открытии модального окна
  useEffect(() => {
    async function fetchPortfolios() {
      if (!isOpen) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // GraphQL запрос для получения всех портфелей
        const query = `
          query {
            myPortfolios {
              id
              name
            }
          }
        `;
        
        // Выполняем GraphQL запрос через хелпер (автоматически добавляет токен)
        const result: GraphQLResponse = await fetchGraphQL(query);
        
        // Проверяем на ошибки
        if (result.errors) {
          throw new Error(result.errors[0].message);
        }
        
        // Сохраняем данные в состояние
        if (result.data?.myPortfolios) {
          setPortfolios(result.data.myPortfolios);
          // Выбираем первый портфель по умолчанию
          if (result.data.myPortfolios.length > 0) {
            setSelectedPortfolioId(result.data.myPortfolios[0].id);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      } finally {
        setLoading(false);
      }
    }
    
    fetchPortfolios();
  }, [isOpen]);

  // Функция для добавления ETF в портфель
  async function handleAdd() {
    // Проверяем, что портфель выбран
    if (!selectedPortfolioId) {
      alert('Выберите портфель');
      return;
    }
    
    // Проверяем валидность количества
    const quantityNum = parseFloat(quantity);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      alert('Введите корректное количество');
      return;
    }

    try {
      setAdding(true);
      
      // GraphQL мутация для добавления позиции
      const mutation = `
        mutation {
          addPortfolioItem(portfolioId: "${selectedPortfolioId}", etfId: "${etfId}", quantity: ${quantityNum}) {
            etf {
              symbol
            }
            quantity
          }
        }
      `;
      
      // Выполняем GraphQL мутацию через хелпер (автоматически добавляет токен)
      const result: GraphQLResponse = await fetchGraphQL(mutation);
      
      // Проверяем на ошибки
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      
      // Если добавление успешно - закрываем модальное окно и показываем уведомление
      onClose();
      alert(`${etfSymbol} добавлен в портфель (${quantityNum} шт.)`);
      
      // Сбрасываем состояние
      setQuantity('1');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось добавить в портфель');
    } finally {
      setAdding(false);
    }
  }

  // Если модальное окно закрыто - не рендерим ничего
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
        {/* Заголовок модального окна */}
        <h2 className="text-2xl font-bold text-[#1E293B] mb-6">
          Добавить в портфель
        </h2>
        
        {/* Индикатор загрузки */}
        {loading ? (
          <div className="text-center py-8">
            <p className="text-zinc-600">Загрузка...</p>
          </div>
        ) : error ? (
          /* Сообщение об ошибке */
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">Ошибка: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#2563EB] text-white px-4 py-2 rounded-lg hover:bg-[#1d4ed8] transition-colors"
            >
              Попробовать снова
            </button>
          </div>
        ) : portfolios.length === 0 ? (
          /* Если портфелей нет */
          <div className="text-center py-8">
            <p className="text-lg text-zinc-600 mb-4">
              У вас пока нет портфелей
            </p>
            <p className="text-sm text-zinc-500 mb-6">
              Создайте первый, чтобы начать инвестировать
            </p>
            <Link
              href="/portfolios"
              onClick={onClose}
              className="inline-block bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Создать портфель
            </Link>
          </div>
        ) : (
          /* Форма добавления в портфель */
          <div>
            {/* Информация о добавляемом ETF */}
            <div className="mb-6 p-4 bg-[#F8FAFC] rounded-lg">
              <p className="text-sm text-zinc-500 mb-1">Добавляемый ETF</p>
              <p className="text-lg font-bold text-[#1E293B]">{etfSymbol}</p>
            </div>
            
            {/* Выпадающий список портфелей */}
            <div className="mb-4">
              <label htmlFor="portfolioSelect" className="block text-sm font-medium text-zinc-700 mb-2">
                Портфель
              </label>
              <select
                id="portfolioSelect"
                value={selectedPortfolioId}
                onChange={(e) => setSelectedPortfolioId(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-zinc-300 bg-white text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-shadow"
              >
                {portfolios.map((portfolio) => (
                  <option key={portfolio.id} value={portfolio.id}>
                    {portfolio.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Поле количества */}
            <div className="mb-6">
              <label htmlFor="quantityInput" className="block text-sm font-medium text-zinc-700 mb-2">
                Количество
              </label>
              <input
                id="quantityInput"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="0.01"
                step="0.01"
                className="w-full px-4 py-3 rounded-lg border border-zinc-300 bg-white text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-shadow"
              />
            </div>
            
            {/* Кнопки действий */}
            <div className="flex gap-4">
              <button
                onClick={onClose}
                disabled={adding}
                className="flex-1 px-4 py-3 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Отмена
              </button>
              <button
                onClick={handleAdd}
                disabled={adding}
                className="flex-1 bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? 'Добавление...' : 'Добавить'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
