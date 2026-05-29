// app/api/cron/update-quotes/route.ts
// API-роут для обновления котировок через Cron Job на Vercel
// Вызывается каждые 6 часов для обновления цен всех активов

import { NextRequest, NextResponse } from 'next/server';
import redis from '@/lib/upstash';

// Интерфейс для котировки
interface QuoteData {
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

// Интерфейс для ответа MOEX ISS API (текущие котировки)
interface MoexQuoteResponse {
  marketdata: {
    data: Array<[number, number, number, number, number, number]>; // [SECID, LAST, CHANGE, LASTTOPREV, VOLUME, VALUE]
  };
}

// Интерфейс для ответа ЦБ РФ (курсы валют)
interface CbrResponse {
  Valute: {
    [key: string]: {
      Value: string;
      Previous: string;
    };
  };
}

// Функция для получения текущей котировки из MOEX ISS API
async function fetchMoexQuote(ticker: string): Promise<QuoteData | null> {
  try {
    // Формируем URL для запроса текущих котировок
    // marketdata.columns=LAST,CHANGE,LASTTOPREV - запрашиваем цену, изменение и изменение в %
    const url = `https://iss.moex.com/iss/engines/stock/markets/shares/securities/${ticker}.json?marketdata.columns=LAST,CHANGE,LASTTOPREV`;
    
    // Выполняем HTTP GET запрос
    const response = await fetch(url);
    
    // Проверяем, что запрос успешен
    if (!response.ok) {
      console.error(`[${ticker}] ❌ Ошибка HTTP: ${response.status}`);
      return null;
    }
    
    // Парсим JSON ответ
    const data: MoexQuoteResponse = await response.json();
    
    // Проверяем, есть ли данные в marketdata.data
    if (!data.marketdata?.data || data.marketdata.data.length === 0) {
      console.error(`[${ticker}] ❌ Нет данных о котировках`);
      return null;
    }
    
    // marketdata.data - это [[secid, last, change, lasttoprev, volume, value], ...]
    // Нам нужны: last (цена), change (абсолютное изменение), lasttoprev (изменение в %)
    const quoteRow = data.marketdata.data[0];
    const last = quoteRow[1]; // LAST - текущая цена
    const change = quoteRow[2]; // CHANGE - абсолютное изменение
    const changePercent = quoteRow[3]; // LASTTOPREV - изменение в процентах
    
    // Если цена равна 0 или null - возвращаем null
    if (!last || last === 0) {
      console.error(`[${ticker}] ❌ Некорректная цена: ${last}`);
      return null;
    }
    
    const quote: QuoteData = {
      price: last,
      change: change || 0,
      changePercent: changePercent || 0,
      timestamp: new Date().toISOString(),
    };
    
    console.log(`[${ticker}] ✅ Цена: ${last}, Изменение: ${changePercent}%`);
    return quote;
    
  } catch (error) {
    console.error(`[${ticker}] ❌ Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// Функция для получения курса валют из ЦБ РФ
async function fetchCbrRate(currency: string): Promise<QuoteData | null> {
  try {
    // Формируем URL для запроса курсов ЦБ РФ
    const url = 'https://www.cbr-xml-daily.ru/daily_json.js';
    
    // Выполняем HTTP GET запрос
    const response = await fetch(url);
    
    // Проверяем, что запрос успешен
    if (!response.ok) {
      console.error(`[${currency}] ❌ Ошибка HTTP ЦБ РФ: ${response.status}`);
      return null;
    }
    
    // Парсим JSON ответ
    const data: CbrResponse = await response.json();
    
    // Маппинг тикеров на коды ЦБ РФ
    const tickerMap: Record<string, string> = {
      'USD/RUB': 'USD',
      'EUR/RUB': 'EUR',
      'CNY/RUB': 'CNY',
    };
    
    const cbrCode = tickerMap[currency];
    if (!cbrCode || !data.Valute[cbrCode]) {
      console.error(`[${currency}] ❌ Валюта не найдена в ответе ЦБ РФ`);
      return null;
    }
    
    const valute = data.Valute[cbrCode];
    const currentRate = parseFloat(valute.Value.replace(',', '.'));
    const previousRate = parseFloat(valute.Previous.replace(',', '.'));
    
    // Вычисляем изменение
    const change = currentRate - previousRate;
    const changePercent = (change / previousRate) * 100;
    
    const quote: QuoteData = {
      price: currentRate,
      change: change,
      changePercent: changePercent,
      timestamp: new Date().toISOString(),
    };
    
    console.log(`[${currency}] ✅ Курс: ${currentRate}, Изменение: ${changePercent.toFixed(2)}%`);
    return quote;
    
  } catch (error) {
    console.error(`[${currency}] ❌ Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// GET обработчик для Cron Job
export async function GET(request: NextRequest) {
  // Проверяем авторизацию через CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.substring(7) !== cronSecret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  console.log('🚀 Начинаем обновление котировок...');
  
  // Список тикеров для обновления (из etfsData)
  const tickers = [
    // ETF
    'TMOS', 'SBMX', 'EQMX', 'DIVD', 'SFIN', 'AKHT', 'ESGR', 'AKME', 'SBSC',
    'SBGB', 'SBRB', 'INFL', 'SBCB', 'GLD',
    // Акции
    'SBER', 'GAZP', 'LKOH', 'NVTK', 'GMKN', 'TATN', 'ROSN', 'YDEX',
    // Облигации
    'SU26240RMFS2', 'SU26238RMFS4', 'SU26230RMFS1',
    // Валюта
    'USD/RUB', 'EUR/RUB', 'CNY/RUB',
  ];
  
  let updatedCount = 0;
  
  // Обновляем котировки для каждого тикера
  for (const ticker of tickers) {
    let quote: QuoteData | null = null;
    
    // Для валют используем ЦБ РФ, для остальных - MOEX ISS
    if (ticker.includes('/')) {
      quote = await fetchCbrRate(ticker);
    } else {
      quote = await fetchMoexQuote(ticker);
    }
    
    // Если данные получены - сохраняем в Redis
    if (quote) {
      try {
        const key = `quote:${ticker}`;
        await redis.set(key, JSON.stringify(quote));
        console.log(`[${ticker}] 💾 Сохранено в Redis (ключ: ${key})`);
        updatedCount++;
      } catch (error) {
        console.error(`[${ticker}] ❌ Ошибка сохранения в Redis: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Делаем паузу 50 мс между запросами, чтобы не перегрузить API
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(`✅ Обновление котировок завершено. Обновлено: ${updatedCount}/${tickers.length}`);
  
  return NextResponse.json({
    success: true,
    updated: updatedCount,
    total: tickers.length,
  });
}
