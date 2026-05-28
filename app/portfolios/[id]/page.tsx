// app/portfolios/[id]/page.tsx
// Детальная страница портфеля с графиками, таблицей позиций и управлением активами

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, PieChart } from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale, Filler } from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';

// Регистрируем необходимые элементы Chart.js
ChartJS.register(ArcElement, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale, Filler);

// Интерфейс для ETF
interface ETF {
  id: string;
  symbol: string;
  name: string;
}

// Интерфейс для позиции портфеля
interface PortfolioItem {
  itemId: string;  // Уникальный идентификатор позиции
  etf: ETF;
  quantity: number;
  buyPrice: number;
  currentValue: number;
  change: number;
  changePercent: number;
}

// Интерфейс для портфеля
interface Portfolio {
  id: string;
  name: string;
  totalValue: number;
  dailyChange: number;
  totalReturnPercent: number;
  items: PortfolioItem[];
  history?: PortfolioSnapshot[]; // Исторические данные портфеля (опционально)
}

// Интерфейс для снапшота истории портфеля
interface PortfolioSnapshot {
  date: string;
  totalValue: number;
}

// Интерфейс для ответа GraphQL
interface GraphQLResponse {
  data?: {
    myPortfolios: Portfolio[];
    etfs?: ETF[];
  };
  errors?: Array<{
    message: string;
  }>;
}

export default function PortfolioDetailPage() {
  // Получаем id портфеля из URL
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // Состояние для портфеля
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  
  // Состояние для списка ETF (для выпадающего списка)
  const [etfsList, setEtfsList] = useState<ETF[]>([]);
  
  // Состояния загрузки и ошибки
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Состояние модального окна добавления актива
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Состояние для выбранного ETF и количества
  const [selectedEtfId, setSelectedEtfId] = useState('');
  const [quantity, setQuantity] = useState('1');
  
  // Состояние загрузки при добавлении/удалении
  const [actionLoading, setActionLoading] = useState(false);
  
  // Состояние для активной вкладки (Состав/Динамика)
  const [activeTab, setActiveTab] = useState<'composition' | 'dynamics'>('composition');
  
  // Состояние для истории портфеля
  const [history, setHistory] = useState<PortfolioSnapshot[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Загружаем данные при монтировании компонента
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        
        // Загружаем портфели
        const portfoliosQuery = `
          query {
            myPortfolios {
              id
              name
              totalValue
              dailyChange
              totalReturnPercent
              items {
                itemId
                etf {
                  id
                  symbol
                  name
                }
                quantity
                buyPrice
                currentValue
                change
                changePercent
              }
            }
          }
        `;
        
        const portfoliosResponse = await fetch('/api/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: portfoliosQuery }),
        });
        
        const portfoliosResult: GraphQLResponse = await portfoliosResponse.json();
        
        if (portfoliosResult.errors) {
          throw new Error(portfoliosResult.errors[0].message);
        }
        
        // Находим портфель по id
        const foundPortfolio = portfoliosResult.data?.myPortfolios.find(p => p.id === id);
        
        if (!foundPortfolio) {
          setError('Портфель не найден');
        } else {
          setPortfolio(foundPortfolio);
        }
        
        // Загружаем список ETF для выпадающего списка
        const etfsQuery = `
          query {
            etfs {
              id
              symbol
              name
            }
          }
        `;
        
        const etfsResponse = await fetch('/api/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: etfsQuery }),
        });
        
        const etfsResult: GraphQLResponse = await etfsResponse.json();
        
        if (etfsResult.data?.etfs) {
          setEtfsList(etfsResult.data.etfs);
          // Выбираем первый ETF по умолчанию
          if (etfsResult.data.etfs.length > 0) {
            setSelectedEtfId(etfsResult.data.etfs[0].id);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      } finally {
        setLoading(false);
      }
    }
    
    if (id) {
      fetchData();
    }
  }, [id]);

  // Функция для удаления позиции
  async function handleRemoveItem(itemId: string) {
    // Подтверждение удаления
    if (!confirm('Удалить позицию?')) {
      return;
    }

    try {
      setActionLoading(true);
      
      const mutation = `
        mutation {
          removePortfolioItem(portfolioId: "${id}", itemId: "${itemId}")
        }
      `;
      
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: mutation }),
      });
      
      const result: GraphQLResponse = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      
      // Перезагружаем данные портфеля
      await refreshPortfolio();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось удалить позицию');
    } finally {
      setActionLoading(false);
    }
  }

  // Функция для добавления позиции
  async function handleAddItem() {
    // Проверяем валидность данных
    if (!selectedEtfId) {
      alert('Выберите ETF');
      return;
    }
    
    const quantityNum = parseFloat(quantity);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      alert('Введите корректное количество');
      return;
    }

    try {
      setActionLoading(true);
      
      const mutation = `
        mutation {
          addPortfolioItem(portfolioId: "${id}", etfId: "${selectedEtfId}", quantity: ${quantityNum}) {
            etf {
              symbol
            }
            quantity
          }
        }
      `;
      
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: mutation }),
      });
      
      const result: GraphQLResponse = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      
      // Закрываем модальное окно и перезагружаем данные
      setIsAddModalOpen(false);
      setQuantity('1');
      await refreshPortfolio();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось добавить позицию');
    } finally {
      setActionLoading(false);
    }
  }

  // Функция для перезагрузки данных портфеля
  async function refreshPortfolio() {
    try {
      const query = `
        query {
          myPortfolios {
            id
            name
            totalValue
            dailyChange
            totalReturnPercent
            items {
              etf {
                id
                symbol
                name
              }
              quantity
              buyPrice
              currentValue
              change
              changePercent
            }
          }
        }
      `;
      
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      
      const result: GraphQLResponse = await response.json();
      
      if (result.data?.myPortfolios) {
        const foundPortfolio = result.data.myPortfolios.find(p => p.id === id);
        if (foundPortfolio) {
          setPortfolio(foundPortfolio);
        }
      }
    } catch (err) {
      console.error('Ошибка при обновлении портфеля:', err);
    }
  }

  // Функция для загрузки истории портфеля
  async function fetchPortfolioHistory() {
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      
      // Определяем даты: с 2020-01-01 до сегодня
      const today = new Date().toISOString().split('T')[0];
      const startDate = '2020-01-01';
      
      const query = `
        query {
          myPortfolios {
            id
            history(startDate: "${startDate}", endDate: "${today}") {
              date
              totalValue
            }
          }
        }
      `;
      
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      
      const result: GraphQLResponse = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      
      // Находим портфель по id и получаем историю
      const foundPortfolio = result.data?.myPortfolios.find(p => p.id === id);
      if (foundPortfolio && foundPortfolio.history) {
        setHistory(foundPortfolio.history);
      }
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Не удалось загрузить историю');
      console.error('Ошибка при загрузке истории:', err);
    } finally {
      setHistoryLoading(false);
    }
  }

  // Загружаем историю при переключении на вкладку "Динамика"
  useEffect(() => {
    if (activeTab === 'dynamics' && portfolio && portfolio.items.length > 0) {
      fetchPortfolioHistory();
    }
  }, [activeTab, portfolio]);

  // Форматируем число в рублевый формат с разделителями тысяч
  const formatRubles = (value: number): string => {
    return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
  };

  // Форматируем число с 2 знаками после запятой
  const formatDecimal = (value: number): string => {
    return value.toFixed(2);
  };

  // Определяем цвет для изменения (зелёный или красный)
  const getChangeColor = (value: number): string => {
    return value >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]';
  };

  // Если данные загружаются - показываем скелетон
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Скелетон для шапки */}
          <div className="flex items-center gap-4 mb-8">
            <div className="h-10 w-10 bg-zinc-200 rounded"></div>
            <div className="h-10 w-64 bg-zinc-200 rounded"></div>
          </div>
          
          {/* Скелетон для карточек метрик */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm h-32">
                <div className="h-6 w-32 bg-zinc-200 rounded mb-4"></div>
                <div className="h-10 w-48 bg-zinc-200 rounded"></div>
              </div>
            ))}
          </div>
          
          {/* Скелетон для диаграммы */}
          <div className="bg-white rounded-xl p-6 shadow-sm h-80 mb-8">
            <div className="h-6 w-48 bg-zinc-200 rounded mb-4"></div>
            <div className="h-64 bg-zinc-200 rounded"></div>
          </div>
          
          {/* Скелетон для таблицы */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="h-6 w-48 bg-zinc-200 rounded mb-4"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-zinc-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Если произошла ошибка - показываем сообщение
  if (error) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-red-500 mb-4">Ошибка: {error}</p>
          <button 
            onClick={() => router.back()}
            className="bg-[#2563EB] text-white px-6 py-2 rounded-lg hover:bg-[#1d4ed8] transition-colors"
          >
            Назад
          </button>
        </div>
      </div>
    );
  }

  // Если портфель не найден
  if (!portfolio) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-zinc-600 mb-4">Портфель не найден</p>
          <Link
            href="/portfolios"
            className="bg-[#2563EB] text-white px-6 py-2 rounded-lg hover:bg-[#1d4ed8] transition-colors"
          >
            Вернуться к списку портфелей
          </Link>
        </div>
      </div>
    );
  }

  // Подготавливаем данные для круговой диаграммы
  const chartData = portfolio.totalValue > 0 ? {
    labels: portfolio.items.map(item => item.etf.symbol),
    datasets: [{
      data: portfolio.items.map(item => item.currentValue),
      backgroundColor: [
        '#2563EB', // Синий
        '#16A34A', // Зелёный
        '#F59E0B', // Жёлтый
        '#8B5CF6', // Фиолетовый
        '#EC4899', // Розовый
        '#06B6D4', // Голубой
        '#84CC16', // Лайм
        '#F97316', // Оранжевый
      ],
      borderWidth: 0,
    }],
  } : null;

  // Подготавливаем данные для линейного графика истории
  const lineChartData = history.length > 0 ? {
    labels: history.map(point => {
      // Форматируем дату: из YYYY-MM-DD в DD.MM.YYYY
      const [year, month, day] = point.date.split('-');
      return `${day}.${month}.${year.slice(2)}`;
    }),
    datasets: [{
      label: 'Стоимость портфеля',
      data: history.map(point => point.totalValue),
      borderColor: '#2563EB', // Синий цвет линии
      backgroundColor: 'rgba(37, 99, 235, 0.1)', // Полупрозрачная заливка
      fill: true, // Включаем заливку под графиком
      tension: 0.3, // Сглаживание линии
      pointRadius: 0, // Скрываем точки на графике
      pointHoverRadius: 6, // Показываем точки при наведении
      pointHoverBackgroundColor: '#2563EB',
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2,
    }],
  } : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Шапка страницы */}
        <div className="flex items-center gap-2 mb-8">
          <Link
            href="/portfolios"
            className="flex items-center gap-1 text-zinc-600 hover:text-[#2563EB] transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Назад</span>
          </Link>
          <h1 className="text-2xl md:text-4xl font-bold text-[#1E293B]">
            {portfolio.name}
          </h1>
        </div>

        {/* Сводка метрик */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Общая стоимость */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="text-sm text-zinc-500 mb-2">Общая стоимость</p>
            <p className="text-3xl font-bold text-[#1E293B]">
              {formatRubles(portfolio.totalValue)}
            </p>
          </div>
          
          {/* Изменение за день */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="text-sm text-zinc-500 mb-2">Изменение за день</p>
            <p className={`text-3xl font-bold ${getChangeColor(portfolio.dailyChange)}`}>
              {portfolio.dailyChange >= 0 ? '+' : ''}{formatRubles(portfolio.dailyChange)}
            </p>
          </div>
          
          {/* Общая доходность */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="text-sm text-zinc-500 mb-2">Общая доходность</p>
            <p className={`text-3xl font-bold ${getChangeColor(portfolio.totalReturnPercent)}`}>
              {portfolio.totalReturnPercent >= 0 ? '+' : ''}{formatDecimal(portfolio.totalReturnPercent)}%
            </p>
          </div>
        </div>

        {/* Вкладки и графики */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Левая колонка - вкладки */}
          <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm">
            {/* Кнопки переключения вкладок */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              <button
                onClick={() => setActiveTab('composition')}
                className={`px-3 py-2 md:px-4 rounded-lg font-medium transition-colors text-sm whitespace-nowrap ${
                  activeTab === 'composition'
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                Состав
              </button>
              <button
                onClick={() => setActiveTab('dynamics')}
                className={`px-3 py-2 md:px-4 rounded-lg font-medium transition-colors text-sm whitespace-nowrap ${
                  activeTab === 'dynamics'
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                Динамика
              </button>
            </div>

            {/* Содержимое вкладки "Состав" - круговая диаграмма */}
            {activeTab === 'composition' && (
              <div>
                <h2 className="text-lg md:text-xl font-bold text-[#1E293B] mb-4">
                  Распределение активов
                </h2>
                {chartData ? (
                  <div className="h-64 md:h-80 flex items-center justify-center">
                    <Pie data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
                  </div>
                ) : (
                  <div className="h-64 md:h-80 flex flex-col items-center justify-center">
                    <PieChart className="w-16 h-16 text-zinc-300 mb-4" />
                    <p className="text-zinc-500">Нет активов</p>
                  </div>
                )}
              </div>
            )}

            {/* Содержимое вкладки "Динамика" - линейный график */}
            {activeTab === 'dynamics' && (
              <div>
                <h2 className="text-lg md:text-xl font-bold text-[#1E293B] mb-4">
                  История стоимости
                </h2>
                {historyLoading ? (
                  <div className="h-64 md:h-80 flex items-center justify-center">
                    <p className="text-zinc-500">Загрузка...</p>
                  </div>
                ) : historyError ? (
                  <div className="h-64 md:h-80 flex items-center justify-center">
                    <p className="text-red-500">{historyError}</p>
                  </div>
                ) : lineChartData ? (
                  <div className="h-64 md:h-80">
                    <Line 
                      data={lineChartData} 
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const value = context.parsed.y;
                                if (value === null) return 'Нет данных';
                                return `Стоимость: ${formatRubles(value)}`;
                              }
                            }
                          },
                          legend: {
                            display: false
                          }
                        },
                        scales: {
                          x: {
                            grid: {
                              display: false
                            },
                            ticks: {
                              maxTicksLimit: 6,
                              font: {
                                size: 11
                              }
                            }
                          },
                          y: {
                            grid: {
                              color: 'rgba(0, 0, 0, 0.05)'
                            },
                            ticks: {
                              callback: function(value) {
                                if (typeof value === 'number') {
                                  return formatRubles(value);
                                }
                                return '';
                              }
                            }
                          }
                        }
                      }} 
                    />
                  </div>
                ) : (
                  <div className="h-64 md:h-80 flex flex-col items-center justify-center">
                    <PieChart className="w-16 h-16 text-zinc-300 mb-4" />
                    <p className="text-zinc-500">Нет данных для графика</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Правая колонка - кнопка добавления актива */}
          <div className="bg-white rounded-xl p-6 shadow-sm flex flex-col justify-center items-center">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Добавить актив
            </button>
          </div>
        </div>

        {/* Таблица позиций */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-[#1E293B]">
              Позиции
            </h2>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Добавить актив
            </button>
          </div>
          
          {/* Если позиций нет */}
          {portfolio.items.length === 0 ? (
            <div className="text-center py-16">
              <PieChart className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
              <p className="text-lg text-zinc-600 mb-2">
                В портфеле пока нет активов
              </p>
              <p className="text-sm text-zinc-500 mb-6">
                Добавьте первый, чтобы начать инвестировать
              </p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
              >
                Добавить актив
              </button>
            </div>
          ) : (
            /* Таблица позиций */
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-zinc-600">Тикер</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-zinc-600">Название</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-zinc-600">Цена покупки</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-zinc-600">Текущая цена</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-zinc-600">Кол-во</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-zinc-600">Тек. стоимость</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-zinc-600">Изм. за день</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-zinc-600">Доходность</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-zinc-600">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.items.map((item) => {
                    const currentPrice = item.quantity > 0 ? item.currentValue / item.quantity : 0;
                    return (
                      <tr key={item.itemId} className="border-b border-zinc-100 hover:bg-zinc-50">
                        {/* Тикер */}
                        <td className="py-4 px-4">
                          <span className="font-bold text-[#1E293B]">{item.etf.symbol}</span>
                        </td>
                        
                        {/* Название */}
                        <td className="py-4 px-4 text-sm text-zinc-600">
                          {item.etf.name}
                        </td>
                        
                        {/* Цена покупки */}
                        <td className="py-4 px-4 text-right text-sm text-zinc-600">
                          {formatRubles(item.buyPrice)}
                        </td>
                        
                        {/* Текущая цена */}
                        <td className="py-4 px-4 text-right text-sm text-zinc-600">
                          {formatDecimal(currentPrice)} ₽
                        </td>
                        
                        {/* Количество */}
                        <td className="py-4 px-4 text-right text-sm text-zinc-600">
                          {item.quantity}
                        </td>
                        
                        {/* Текущая стоимость */}
                        <td className="py-4 px-4 text-right text-sm font-medium text-[#1E293B]">
                          {formatRubles(item.currentValue)}
                        </td>
                        
                        {/* Изменение за день */}
                        <td className={`py-4 px-4 text-right text-sm font-medium ${getChangeColor(item.change)}`}>
                          {item.change >= 0 ? '+' : ''}{formatRubles(item.change)}
                        </td>
                        
                        {/* Доходность */}
                        <td className={`py-4 px-4 text-right text-sm font-medium ${getChangeColor(item.changePercent)}`}>
                          {item.changePercent >= 0 ? '+' : ''}{formatDecimal(item.changePercent)}%
                        </td>
                        
                        {/* Действия */}
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleRemoveItem(item.itemId)}
                            disabled={actionLoading}
                            className="text-red-500 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно добавления актива */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Заголовок */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-[#1E293B]">
                Добавить ETF в портфель
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            {/* Выпадающий список ETF */}
            <div className="mb-4">
              <label htmlFor="etfSelect" className="block text-sm font-medium text-zinc-700 mb-2">
                ETF
              </label>
              <select
                id="etfSelect"
                value={selectedEtfId}
                onChange={(e) => setSelectedEtfId(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-zinc-300 bg-white text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-shadow"
              >
                {etfsList.map((etf) => (
                  <option key={etf.id} value={etf.id}>
                    {etf.symbol} - {etf.name}
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
                onClick={() => setIsAddModalOpen(false)}
                disabled={actionLoading}
                className="flex-1 px-4 py-3 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Отмена
              </button>
              <button
                onClick={handleAddItem}
                disabled={actionLoading}
                className="flex-1 bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? 'Добавление...' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
