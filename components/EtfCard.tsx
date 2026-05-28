// components/EtfCard.tsx
// Компонент карточки ETF - отображает информацию об одном ETF с улучшенным дизайном

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import AddToPortfolioModal from './AddToPortfolioModal';

// Интерфейс (тип) для данных ETF
// Определяет структуру объекта с данными ETF
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

// Props - свойства, которые передаются в компонент
// Здесь мы ожидаем объект etf с данными ETF
interface EtfCardProps {
  etf: EtfData;
}

// Компонент EtfCard - функциональный компонент React
// Принимает props и возвращает JSX (разметку)
export default function EtfCard({ etf }: EtfCardProps) {
  // Состояние для модального окна добавления в портфель
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Определяем цвет изменения цены
  // Зелёный (#16A34A) для роста, красный (#DC2626) для падения
  const changeColor = etf.change >= 0 
    ? 'text-[#16A34A]'  // Положительное изменение - зелёный
    : 'text-[#DC2626]'; // Отрицательное изменение - красный

  // Функция для определения типа бейджа по тикеру ETF
  // Возвращает объект с текстом бейджа и его стилями
  const getBadge = () => {
    // Базовые ETF - самые популярные и рекомендуемые
    const basicTickers = ['TMOS', 'SBMX', 'SBGB', 'DIVD'];
    
    // Защитные ETF - золото и другие защитные активы
    const defensiveTickers = ['GLD']; // Пока только GLD, можно расширить
    
    if (basicTickers.includes(etf.symbol)) {
      return {
        text: 'Базовый',
        bgColor: 'bg-[#DBEAFE]',  // Синий фон
        textColor: 'text-[#1E40AF]' // Синий текст
      };
    }
    
    if (defensiveTickers.includes(etf.symbol)) {
      return {
        text: 'Защитный',
        bgColor: 'bg-[#FEF3C7]',  // Жёлтый фон
        textColor: 'text-[#B45309]' // Жёлтый текст
      };
    }
    
    // Все остальные ETF - секторные
    return {
      text: 'Секторный',
      bgColor: 'bg-[#F1F5F9]',  // Серый фон
      textColor: 'text-[#475569]' // Серый текст
    };
  };

  // Получаем данные бейджа
  const badge = getBadge();

  return (
    <>
      {/* Карточка ETF */}
      <div className="group relative bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
        {/* Бейдж ETF - маленькая цветная плашка в правом верхнем углу */}
        <div className={`absolute top-2 right-2 px-2 py-1 rounded-md text-xs font-medium bg-opacity-90 ${badge.bgColor} ${badge.textColor}`}>
          {badge.text}
        </div>

        {/* Верхняя часть карточки: тикер и название */}
        <div className="mb-4 pr-16">
          {/* Тикер ETF (например: SPY) - крупный и жирный */}
          <h2 className="text-2xl font-bold text-zinc-900">
            {etf.symbol}
          </h2>
          {/* Полное название ETF */}
          <p className="text-sm text-zinc-600 mt-1">
            {etf.name}
          </p>
        </div>

        {/* Цена и изменение за день */}
        <div className="flex items-baseline gap-3 mb-4">
          {/* Текущая цена - крупно */}
          <span className="text-3xl font-bold text-zinc-900">
            {etf.price.toFixed(2)} ₽
          </span>
          {/* Изменение за день с цветом */}
          <span className={`text-lg font-medium ${changeColor}`}>
            {/* Добавляем + если изменение положительное */}
            {etf.change >= 0 ? '+' : ''}{etf.changePercent.toFixed(2)}%
          </span>
        </div>

        {/* Информация в одну строку: TER, сектор */}
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          {/* TER - Expense Ratio (комиссия за управление) */}
          <span>
            <span className="font-medium">TER:</span> {etf.expenseRatio}%
          </span>
          {/* Разделитель */}
          <span className="text-zinc-300">•</span>
          {/* Сектор */}
          <span className="font-medium">{etf.sector}</span>
        </div>

        {/* Кнопка "+ В портфель" */}
        {/* На мобильных отображается всегда, на десктопе - только при наведении на карточку */}
        <button 
          onClick={() => setIsModalOpen(true)}
          className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors duration-200 md:opacity-0 md:group-hover:opacity-100"
        >
          {/* Иконка Plus из lucide-react */}
          <Plus className="w-4 h-4" />
          <span>В портфель</span>
        </button>
      </div>
      
      {/* Модальное окно добавления в портфель */}
      <AddToPortfolioModal
        etfId={etf.id}
        etfSymbol={etf.symbol}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
