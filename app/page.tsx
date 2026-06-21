'use client'; // Компонент-клиент, так как на странице есть интерактивные элементы

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, PieChart, TrendingUp, Database, Shield, ArrowRight } from 'lucide-react';
import EtfCard from '@/components/EtfCard';

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

export default function Home() {
  // Состояние для списка активов
  const [etfs, setEtfs] = useState<EtfData[]>([]);
  
  // Состояние загрузки
  const [loading, setLoading] = useState(true);
  
  // Состояние ошибки
  const [error, setError] = useState<string | null>(null);

  // Загружаем данные при монтировании компонента
  useEffect(() => {
    async function fetchETFs() {
      try {
        setLoading(true);
        setError(null);
        
        // GraphQL запрос для получения всех активов
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
            }
          }
        `;
        
        // Выполняем GraphQL запрос через обычный fetch (без токена)
        const response = await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });
        const result: GraphQLResponse = await response.json();
        
        // Проверяем на ошибки
        if (result.errors) {
          throw new Error(result.errors[0].message);
        }
        
        // Сохраняем данные в состояние и берём первые 5 активов
        if (result.data?.etfs) {
          setEtfs(result.data.etfs.slice(0, 5));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      } finally {
        setLoading(false);
      }
    }
    
    fetchETFs();
  }, []); // Пустой массив зависимостей - выполняется только один раз при монтировании

  return (
    <div className="min-h-screen">
      {/* Hero секция */}
      <section className="bg-white py-20 px-6 md:px-12 lg:px-24">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12">
          {/* Левая часть: заголовок и кнопки */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#1E293B] leading-tight mb-6">
              Соберите свой портфель за 1–2 минуты
            </h1>
            <p className="text-lg md:text-xl text-zinc-600 mb-8 max-w-xl mx-auto md:mx-0">
              Сравните популярные активы: ETF, акции, облигации, валюту. Соберите портфель и проверьте историю доходности — всё в одном месте.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              {/* Синяя кнопка - ведёт на /catalog */}
              <Link 
                href="/catalog"
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 text-center"
              >
                Собрать демо‑портфель
              </Link>
              {/* Кнопка с обводкой */}
              <Link 
                href="/catalog"
                className="border-2 border-[#2563EB] text-[#2563EB] hover:bg-[#2563EB] hover:text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 text-center"
              >
                Посмотреть каталог
              </Link>
            </div>
          </div>
          
          {/* Правая часть: изображение-заглушка с градиентом и иконкой */}
          <div className="flex-1 w-full max-w-md">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-12 flex items-center justify-center aspect-square">
              <PieChart className="w-32 h-32 text-[#2563EB]" />
            </div>
          </div>
        </div>
      </section>

      {/* Секция "Как это работает" */}
      <section className="bg-[#F8FAFC] py-20 px-6 md:px-12 lg:px-24">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1E293B] text-center mb-4">
            Как это работает
          </h2>
          <p className="text-zinc-600 text-center mb-12 max-w-2xl mx-auto">
            Три простых шага к вашему первому портфелю
          </p>
          
          {/* Три колонки с иконками */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Колонка 1: Сравните активы */}
            <div className="bg-white rounded-xl p-8 text-center shadow-sm">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-[#2563EB]" />
              </div>
              <h3 className="text-xl font-semibold text-[#1E293B] mb-2">
                Сравните активы
              </h3>
              <p className="text-zinc-600">
                Отфильтруйте ETF, акции, облигации или валюту по сектору, комиссии или доходности. Вместо 5 сайтов — один экран.
              </p>
            </div>
            
            {/* Колонка 2: Соберите портфель */}
            <div className="bg-white rounded-xl p-8 text-center shadow-sm">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <PieChart className="w-8 h-8 text-[#2563EB]" />
              </div>
              <h3 className="text-xl font-semibold text-[#1E293B] mb-2">
                Соберите портфель
              </h3>
              <p className="text-zinc-600">
                Добавьте любые активы в портфель в один клик. Система сразу покажет общую стоимость и доли.
              </p>
            </div>
            
            {/* Колонка 3: Проверьте историю */}
            <div className="bg-white rounded-xl p-8 text-center shadow-sm">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-[#2563EB]" />
              </div>
              <h3 className="text-xl font-semibold text-[#1E293B] mb-2">
                Проверьте историю
              </h3>
              <p className="text-zinc-600">
                Узнайте, как вёл бы себя портфель с 2020 года. Никаких «нарисованных» цифр — только реальные данные с MOEX.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Секция "Популярные активы для старта" */}
      <section className="bg-white py-20 px-6 md:px-12 lg:px-24">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1E293B] mb-2">
            Популярные активы для старта
          </h2>
          <p className="text-zinc-600 mb-8">
            Быстрый старт без риска
          </p>
          
          {/* Если данные загружаются - показываем скелетон */}
          {loading ? (
            <div className="flex gap-6 overflow-x-auto pb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex-shrink-0 w-80">
                  <div className="bg-white rounded-xl p-5 shadow-sm h-48">
                    <div className="h-8 w-24 bg-zinc-200 rounded mb-2"></div>
                    <div className="h-4 w-48 bg-zinc-200 rounded mb-4"></div>
                    <div className="h-10 w-32 bg-zinc-200 rounded mb-4"></div>
                    <div className="h-4 w-64 bg-zinc-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            // Если произошла ошибка - показываем сообщение
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">Ошибка загрузки данных</p>
              <button 
                onClick={() => window.location.reload()}
                className="bg-[#2563EB] text-white px-6 py-2 rounded-lg hover:bg-[#1d4ed8] transition-colors"
              >
                Попробовать снова
              </button>
            </div>
          ) : (
            // Горизонтальный скролл с карточками из GraphQL API
            <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory -mx-6 px-6 md:mx-0 md:px-0">
              {etfs.map((etf) => (
                <div key={etf.id} className="flex-shrink-0 w-80 sm:w-[85%] md:w-80 snap-start">
                  <EtfCard etf={etf} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Блок доверия */}
      <section className="bg-[#F8FAFC] py-20 px-6 md:px-12 lg:px-24">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Левая колонка: Данные из MOEX API */}
            <div className="bg-white rounded-xl p-8 flex items-start gap-4 shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Database className="w-6 h-6 text-[#2563EB]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#1E293B] mb-2">
                  Данные из MOEX API
                </h3>
                {/* Источник данных: MOEX ISS API - официальное API Московской биржи */}
                <p className="text-zinc-600">
                  Котировки обновляются каждые 60 секунд. Всегда актуальная информация о ценах
                </p>
              </div>
            </div>
            
            {/* Правая колонка: Ваш портфель под контролем */}
            <div className="bg-white rounded-xl p-8 flex items-start gap-4 shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-[#2563EB]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#1E293B] mb-2">
                  Ваш портфель под контролем
                </h3>
                <p className="text-zinc-600">
                  Только нужные цифры. Никаких лишних данных — чистая аналитика
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Финальный CTA блок */}
      <section className="bg-[#1e3a8a] py-20 px-6 md:px-12 lg:px-24">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Готовы собрать первый портфель?
          </h2>
          <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
            Это бесплатно и займёт не больше 2 минут.
          </p>
          <Link 
            href="/catalog"
            className="inline-flex items-center gap-2 bg-white text-[#1e3a8a] hover:bg-blue-50 px-8 py-4 rounded-lg font-semibold transition-colors duration-200"
          >
            Начать
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
