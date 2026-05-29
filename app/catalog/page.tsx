// app/catalog/page.tsx
// Страница каталога ETF с поиском, фильтрацией и сортировкой
// Использует хелпер fetchGraphQL для GraphQL запросов

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import EtfCard from '@/components/EtfCard';
import { fetchGraphQL } from '@/lib/api';

// Интерфейс для данных активов (ETF, акции, облигации, валюта)
interface EtfData {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  expenseRatio: number;
  assetsUnderManagement: number;
  sector: string;
  description: string;
  assetType: string; // Тип актива: etf, stock, bond, currency
}

// Интерфейс для ответа GraphQL
interface GraphQLResponse {
  data?: {
    etfs: EtfData[];
  };
  errors?: Array<{
    message: string;
  }>;
}

// Тип для фильтра по сектору
// Теперь используем русские названия секторов: Акции, Облигации, Золото
type SectorFilter = 'all' | 'ETF' | 'Акции' | 'Облигации' | 'Валюта' | 'Золото';

// Тип для фильтра по TER
type TerFilter = 'all' | 'low' | 'medium' | 'high';

// Тип для сортировки
// Добавили новые варианты: recommended, name_asc, price_asc, change_desc, ter_asc
type SortOption = 'recommended' | 'name_asc' | 'price_asc' | 'change_desc' | 'ter_asc';

export default function CatalogPage() {
  // Состояние для списка ETF
  const [etfs, setEtfs] = useState<EtfData[]>([]);
  
  // Состояние для строки поиска
  const [searchTerm, setSearchTerm] = useState('');
  
  // Состояние для фильтра по сектору
  const [sectorFilter, setSectorFilter] = useState<SectorFilter>('all');
  
  // Состояние для фильтра по TER
  const [terFilter, setTerFilter] = useState<TerFilter>('all');
  
  // Состояние для сортировки
  // По умолчанию используем сортировку 'Рекомендуемые'
  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  
  // Состояния для загрузки и ошибок
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Время последнего обновления данных
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Загружаем данные при монтировании компонента
  useEffect(() => {
    async function fetchETFs() {
      try {
        setLoading(true);
        setError(null);
        
        // GraphQL запрос для получения всех ETF
        const query = `
          query GetETFs {
            etfs {
              id
              symbol
              name
              price
              change
              changePercent
              expenseRatio
              assetsUnderManagement
              sector
              description
              assetType
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
        if (result.data?.etfs) {
          setEtfs(result.data.etfs);
          setLastUpdated(new Date()); // Обновляем время последнего обновления
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      } finally {
        setLoading(false);
      }
    }
    
    fetchETFs();
  }, []); // Пустой массив зависимостей - выполняется только один раз при монтировании

  // Порядок рекомендуемых ETF для сортировки
  // ETF в этом порядке будут показаны первыми при сортировке 'Рекомендуемые'
  const recommendedOrder = [
    // Индексы широкого рынка (базовые ETF)
    'TMOS', 'SBMX', 'EQMX',
    // Дивидендные акции (ETF)
    'DIVD',
    // Облигации (защитные ETF)
    'SBGB', 'SBRB', 'INFL', 'SBCB',
    // Секторальные (популярные ETF)
    'SFIN', 'AKHT',
    // Активное управление (ETF)
    'ESGR', 'AKME', 'SBSC',
    // Акции (blue chips)
    'SBER', 'GAZP', 'LKOH', 'NVTK', 'GMKN', 'TATN', 'ROSN', 'YDEX',
    // Облигации (ОФЗ)
    'SU26240RMFS2', 'SU26238RMFS4', 'SU26230RMFS1',
    // Валюта
    'USD/RUB'
  ];

  // Функция для определения категории сектора ETF
  // Теперь работает с русскими названиями секторов напрямую
  const getSectorCategory = (sector: string, assetType?: string): SectorFilter => {
    // Сначала проверяем assetType для ETF
    if (assetType === 'etf') return 'ETF';
    if (assetType === 'stock') return 'Акции';
    if (assetType === 'bond') return 'Облигации';
    if (assetType === 'currency') return 'Валюта';
    
    // Проверяем точное совпадение с русскими названиями
    if (sector === 'Акции') return 'Акции';
    if (sector === 'Облигации') return 'Облигации';
    if (sector === 'Валюта') return 'Валюта';
    if (sector === 'Золото') return 'Золото';
    
    // Если сектор не совпал, пробуем определить по ключевым словам
    const lowerSector = sector.toLowerCase();
    if (lowerSector.includes('акц') || lowerSector.includes('stock')) return 'Акции';
    if (lowerSector.includes('облиг') || lowerSector.includes('bond')) return 'Облигации';
    if (lowerSector.includes('валют') || lowerSector.includes('currency')) return 'Валюта';
    if (lowerSector.includes('золот') || lowerSector.includes('gold')) return 'Золото';
    
    return 'all';
  };

  // Функция для проверки TER по фильтру
  const matchesTerFilter = (expenseRatio: number, filter: TerFilter): boolean => {
    switch (filter) {
      case 'low':
        return expenseRatio < 0.1;
      case 'medium':
        return expenseRatio >= 0.1 && expenseRatio <= 0.5;
      case 'high':
        return expenseRatio > 0.5;
      case 'all':
      default:
        return true;
    }
  };

  // Фильтруем и сортируем ETF на клиенте
  const filteredAndSortedEtfs = etfs
    .filter((etf) => {
      // Фильтр по поиску (символ и название)
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        etf.symbol.toLowerCase().includes(searchLower) ||
        etf.name.toLowerCase().includes(searchLower);
      
      // Фильтр по сектору - теперь используем точное совпадение с русскими названиями
      const matchesSector = sectorFilter === 'all' || 
        (sectorFilter === 'ETF' && etf.assetType === 'etf') ||
        (sectorFilter === 'Акции' && etf.assetType === 'stock') ||
        (sectorFilter === 'Облигации' && etf.assetType === 'bond') ||
        (sectorFilter === 'Валюта' && etf.assetType === 'currency') ||
        (sectorFilter === 'Золото' && etf.sector === 'Золото') ||
        etf.sector === sectorFilter;
      
      // Фильтр по TER
      const matchesTer = matchesTerFilter(etf.expenseRatio, terFilter);
      
      return matchesSearch && matchesSector && matchesTer;
    })
    .sort((a, b) => {
      // Сортировка по выбранному критерию
      switch (sortBy) {
        case 'recommended':
          // Сортировка по рекомендуемому порядку
          // Сначала ETF из recommendedOrder в заданном порядке
          const aIndex = recommendedOrder.indexOf(a.symbol);
          const bIndex = recommendedOrder.indexOf(b.symbol);
          
          // Если оба ETF в списке - сортируем по индексу
          if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
          }
          // Если только a в списке - a идёт первым
          if (aIndex !== -1) return -1;
          // Если только b в списке - b идёт первым
          if (bIndex !== -1) return 1;
          // Если оба не в списке - сортируем по названию
          return a.name.localeCompare(b.name);
        case 'name_asc':
          return a.name.localeCompare(b.name); // По названию А-Я
        case 'price_asc':
          return a.price - b.price; // По цене возрастание
        case 'change_desc':
          return b.changePercent - a.changePercent; // По изменению убывание
        case 'ter_asc':
          return a.expenseRatio - b.expenseRatio; // По TER возрастание
        default:
          return 0;
      }
    });

  // Если данные загружаются - показываем скелетон
  if (loading) return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Скелетон для хлебных крошек */}
        <div className="h-6 w-48 bg-zinc-200 rounded mb-6"></div>
        
        {/* Скелетон для заголовка */}
        <div className="h-10 w-64 bg-zinc-200 rounded mb-2"></div>
        <div className="h-6 w-96 bg-zinc-200 rounded mb-8"></div>
        
        {/* Скелетон для строки поиска */}
        <div className="h-12 w-full bg-zinc-200 rounded mb-6"></div>
        
        {/* Скелетон для фильтров */}
        <div className="flex gap-2 mb-6">
          <div className="h-10 w-16 bg-zinc-200 rounded-full"></div>
          <div className="h-10 w-16 bg-zinc-200 rounded-full"></div>
          <div className="h-10 w-16 bg-zinc-200 rounded-full"></div>
          <div className="h-10 w-16 bg-zinc-200 rounded-full"></div>
        </div>
        
        {/* Скелетон для карточек */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl p-5 shadow-sm">
              <div className="h-8 w-24 bg-zinc-200 rounded mb-2"></div>
              <div className="h-4 w-48 bg-zinc-200 rounded mb-4"></div>
              <div className="h-10 w-32 bg-zinc-200 rounded mb-4"></div>
              <div className="h-4 w-64 bg-zinc-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Если произошла ошибка - показываем сообщение об ошибке
  if (error) return (
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

  // Форматируем время последнего обновления
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Хлебные крошки */}
        <nav className="flex items-center gap-2 text-sm text-zinc-600 mb-6">
          <Link href="/" className="hover:text-[#2563EB] transition-colors">
            Главная
          </Link>
          <span className="text-zinc-400">/</span>
          <span className="text-zinc-900 font-medium">Каталог ETF</span>
        </nav>

        {/* Заголовок страницы */}
        <h1 className="text-4xl font-bold text-[#1E293B] mb-2">
          Каталог ETF
        </h1>
        <p className="text-lg text-zinc-600 mb-8">
          Сравните, выберите и добавьте в портфель
        </p>

        {/* Строка поиска с иконкой */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="text"
            placeholder="Поиск по названию или тикеру..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-12 py-3 rounded-lg border border-zinc-300 bg-white text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-shadow"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Время последнего обновления */}
        <p className="text-xs text-zinc-500 mb-6">
          Цены обновлены: {formatTime(lastUpdated)}
        </p>

        {/* Фильтры и сортировка */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          {/* Фильтры по сектору (чипы) - обновлённые категории */}
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 lg:pb-0 -mx-6 px-6 lg:mx-0 lg:px-0">
            <button
              onClick={() => setSectorFilter('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                sectorFilter === 'all'
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-300'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => setSectorFilter('ETF')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                sectorFilter === 'ETF'
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-300'
              }`}
            >
              ETF
            </button>
            <button
              onClick={() => setSectorFilter('Акции')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                sectorFilter === 'Акции'
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-300'
              }`}
            >
              Акции
            </button>
            <button
              onClick={() => setSectorFilter('Облигации')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                sectorFilter === 'Облигации'
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-300'
              }`}
            >
              Облигации
            </button>
            <button
              onClick={() => setSectorFilter('Валюта')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                sectorFilter === 'Валюта'
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-300'
              }`}
            >
              Валюта
            </button>
            <button
              onClick={() => setSectorFilter('Золото')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                sectorFilter === 'Золото'
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-300'
              }`}
            >
              Золото
            </button>
          </div>

          {/* Фильтр по TER и сортировка */}
          <div className="flex gap-4 flex-shrink-0">
            {/* Выпадающий список для фильтра по TER */}
            <select
              value={terFilter}
              onChange={(e) => setTerFilter(e.target.value as TerFilter)}
              className="px-4 py-2 rounded-lg border border-zinc-300 bg-white text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-shadow"
            >
              <option value="all">Любая TER</option>
              <option value="low">&lt;0.1%</option>
              <option value="medium">0.1–0.5%</option>
              <option value="high">&gt;0.5%</option>
            </select>

            {/* Выпадающий список для сортировки - расширенные варианты */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-4 py-2 rounded-lg border border-zinc-300 bg-white text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-shadow"
            >
              <option value="recommended">Рекомендуемые</option>
              <option value="name_asc">По названию (А-Я)</option>
              <option value="price_asc">По цене (возрастание)</option>
              <option value="change_desc">По изменению за день (убывание)</option>
              <option value="ter_asc">По комиссии TER (возрастание)</option>
            </select>
          </div>
        </div>

        {/* Сетка карточек ETF */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedEtfs.map((etf) => (
            <EtfCard key={etf.id} etf={etf} />
          ))}
        </div>

        {/* Если ничего не найдено */}
        {filteredAndSortedEtfs.length === 0 && (
          <div className="text-center py-16">
            <X className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
            <p className="text-lg text-zinc-600 mb-2">
              Ничего не найдено
            </p>
            <p className="text-sm text-zinc-500">
              Попробуйте изменить запрос или сбросить фильтры
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSectorFilter('all');
                setTerFilter('all');
                setSortBy('recommended'); // Сбрасываем сортировку на рекомендуемую
              }}
              className="mt-4 text-[#2563EB] hover:text-[#1d4ed8] font-medium transition-colors"
            >
              Сбросить фильтры
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
