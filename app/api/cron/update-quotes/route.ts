// app/api/cron/update-quotes/route.ts
// API-роут для обновления котировок через Cron Job на Vercel
// Вызывается каждые 6 часов для обновления цен всех активов
// Защищён секретным ключом CRON_SECRET в заголовке Authorization: Bearer <CRON_SECRET>

import { NextRequest, NextResponse } from 'next/server';

// Интерфейс для котировки, которая сохраняется в Redis
// Важно: GraphQL ожидает поля price, change, changePercent
interface QuoteData {
  price: number;
  change: number;
  changePercent: number;
}

// Интерфейс для ответа MOEX ISS API (текущие котировки)
interface MoexResponse {
  marketdata?: {
    data?: (number | string)[][];
  };
  securities?: {
    data?: (number | string)[][];
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

// Список тикеров для обновления котировок
// Скопирован из массива etfsData в app/api/graphql/route.ts
// Включает ETF, акции, облигации, золото и валюты
const TICKERS = [
  // ETF - Индексы широкого рынка
  'TMOS', 'SBMX', 'EQMX',
  // ETF - Дивидендные акции
  'DIVD',
  // ETF - Финансы
  'SFIN',
  // ETF - Технологии
  'AKHT',
  // ETF - Активное управление
  'ESGR', 'AKME', 'SBSC',
  // ETF - Облигации
  'SBGB', 'SBRB', 'INFL', 'SBCB',
  // ETF - Золото
  'GLD',
  // Акции (blue chips)
  'SBER', 'GAZP', 'LKOH', 'NVTK', 'GMKN', 'TATN', 'ROSN', 'YDEX',
  // Облигации (ОФЗ)
  'SU26240RMFS2', 'SU26238RMFS4', 'SU26230RMFS1',
  // Валюта
  'USD/RUB', 'EUR/RUB', 'CNY/RUB',
];

// Определяем подходящие boards (торговые режимы) для каждого типа актива
// Разные активы торгуются на разных boards на Московской бирже
function getBoardsForTicker(ticker: string): string[] {
  // ETF и золото
  const etfTickers = ['TMOS', 'SBMX', 'EQMX', 'DIVD', 'SFIN', 'AKHT', 'ESGR', 'AKME', 'SBSC', 'SBGB', 'SBRB', 'INFL', 'SBCB', 'GLD'];
  // Акции
  const stockTickers = ['SBER', 'GAZP', 'LKOH', 'NVTK', 'GMKN', 'TATN', 'ROSN', 'YDEX'];
  // ОФЗ
  const bondTickers = ['SU26240RMFS2', 'SU26238RMFS4', 'SU26230RMFS1'];

  if (etfTickers.includes(ticker)) {
    return ['TQTF', 'TQBR', 'TQTD', 'TQIF'];
  } else if (stockTickers.includes(ticker)) {
    return ['TQBR'];
  } else if (bondTickers.includes(ticker)) {
    return ['TQOB'];
  }

  // По умолчанию пробуем все основные boards
  return ['TQTF', 'TQBR', 'TQTD', 'TQIF'];
}

// Получаем текущую котировку одного тикера из MOEX ISS API
// Пробуем несколько boards, пока не найдём данные
async function fetchMoexQuote(ticker: string): Promise<QuoteData | null> {
  const boards = getBoardsForTicker(ticker);

  for (const board of boards) {
    try {
      // Формируем URL для запроса к MOEX ISS API
      const url = `https://iss.moex.com/iss/engines/stock/markets/shares/boards/${board}/securities/${ticker}.json`;

      // Выполняем HTTP GET запрос
      const response = await fetch(url);

      // Если запрос не успешен - пробуем следующий board
      if (!response.ok) {
        continue;
      }

      // Парсим JSON ответ
      const data: MoexResponse = await response.json();

      // Сначала смотрим в marketdata (текущие торги)
      if (data.marketdata?.data && data.marketdata.data.length > 0) {
        const marketdataRow = data.marketdata.data[0];

        // Индексы полей в marketdata.data:
        // 12 - цена (LAST или текущая цена)
        // 13 - изменение в валюте (CHANGE)
        // 14 - изменение в процентах (CHANGE в %)
        const price = marketdataRow[12] as number || 0;
        const change = marketdataRow[13] as number || 0;
        const changePercent = marketdataRow[14] as number || 0;

        if (price > 0) {
          return { price, change, changePercent };
        }
      }

      // Если marketdata пуст, пробуем взять цену из securities
      if (data.securities?.data && data.securities.data.length > 0) {
        const securitiesRow = data.securities.data[0];
        const lastPrice = securitiesRow[5] as number || securitiesRow[1] as number || 0;

        if (lastPrice > 0) {
          return { price: lastPrice, change: 0, changePercent: 0 };
        }
      }
    } catch (error) {
      // Продолжаем пробовать следующий board при ошибке
      continue;
    }
  }

  // Нигде не нашли данных
  return null;
}

// Получаем курс валюты из API ЦБ РФ
async function fetchCbrRate(currency: string): Promise<QuoteData | null> {
  try {
    const url = 'https://www.cbr-xml-daily.ru/daily_json.js';
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[${currency}] ❌ Ошибка HTTP ЦБ РФ: ${response.status}`);
      return null;
    }

    const data: CbrResponse = await response.json();

    // Маппинг тикеров на коды валют ЦБ РФ
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

    const change = currentRate - previousRate;
    const changePercent = (change / previousRate) * 100;

    return {
      price: currentRate,
      change,
      changePercent,
    };
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

  if (!cronSecret || !authHeader || !authHeader.startsWith('Bearer ') || authHeader.substring(7) !== cronSecret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Динамический импорт Redis - чтобы клиент инициализировался уже с переменными окружения из Vercel
  const { default: redis } = await import('@/lib/upstash');

  console.log('🚀 Начинаем обновление котировок...');

  let updatedCount = 0;

  // Обновляем котировки для каждого тикера
  for (const ticker of TICKERS) {
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

  console.log(`✅ Обновление котировок завершено. Обновлено: ${updatedCount}/${TICKERS.length}`);

  return NextResponse.json({
    success: true,
    updated: updatedCount,
    total: TICKERS.length,
  });
}
