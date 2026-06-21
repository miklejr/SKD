// app/api/cron/load-history/route.ts
// API-роут для первичной загрузки исторических котировок
// Загружает историю с MOEX ISS API с 2020 года и сохраняет в Redis

import { NextRequest, NextResponse } from 'next/server';

// Интерфейс для исторической котировки
interface HistoryPoint {
  date: string;  // Дата в формате YYYY-MM-DD
  close: number; // Цена закрытия
}

// Интерфейс для ответа MOEX ISS API (история)
interface MoexHistoryResponse {
  history: {
    data: Array<[string, number, number]>; // [TRADEDATE, CLOSE, VOLUME]
  };
}

// Список тикеров для загрузки истории
// Валюты (USD/RUB, EUR/RUB, CNY/RUB) пропускаем - история для них будет позже
const TICKERS = [
  // ETF - Индексы широкого рынка
  "TMOS", "SBMX", "EQMX",
  // ETF - Дивидендные акции
  "DIVD",
  // ETF - Финансы
  "SFIN",
  // ETF - Технологии
  "AKHT",
  // ETF - Активное управление
  "ESGR", "AKME", "SBSC",
  // ETF - Облигации
  "SBGB", "SBRB", "INFL", "SBCB",
  // ETF - Золото
  "GLD",
  // Акции (blue chips)
  "SBER", "GAZP", "LKOH", "NVTK", "GMKN", "TATN", "ROSN", "YDEX",
  // Облигации (ОФЗ)
  "SU26240RMFS2", "SU26238RMFS4", "SU26230RMFS1"
];

// Функция для загрузки истории одного тикера из MOEX ISS API
async function fetchHistory(ticker: string): Promise<HistoryPoint[]> {
  try {
    console.log(`📊 Загружаем историю для ${ticker}...`);
    
    // Формируем URL для запроса истории
    // from=2020-01-01 - с 1 января 2020
    // till=2026-12-31 - до конца 2026 (будущее, чтобы захватить текущий год)
    // history.columns=TRADEDATE,CLOSE,VOLUME - запрашиваем только нужные колонки
    const url = `https://iss.moex.com/iss/history/engines/stock/markets/shares/securities/${ticker}.json?from=2020-01-01&till=2026-12-31&history.columns=TRADEDATE,CLOSE,VOLUME`;
    
    // Выполняем HTTP GET запрос
    const response = await fetch(url);
    
    // Проверяем, что запрос успешен
    if (!response.ok) {
      console.error(`[${ticker}] ❌ Ошибка HTTP: ${response.status}`);
      return [];
    }
    
    // Парсим JSON ответ
    const data: MoexHistoryResponse = await response.json();
    
    // Проверяем, есть ли данные в history.data
    if (!data.history?.data || data.history.data.length === 0) {
      console.error(`[${ticker}] ❌ Нет исторических данных`);
      return [];
    }
    
    // Преобразуем массив массивов в массив объектов
    // data.history.data - это [[date, close, volume], [date, close, volume], ...]
    // Нам нужны только date и close
    const history: HistoryPoint[] = data.history.data.map(([date, close]) => ({
      date,
      close
    }));
    
    console.log(`[${ticker}] ✅ Загружено ${history.length} записей`);
    return history;
    
  } catch (error) {
    console.error(`[${ticker}] ❌ Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

// GET обработчик для загрузки истории
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

  // Динамический импорт Redis - чтобы клиент инициализировался уже с переменными окружения из Vercel
  const { default: redis } = await import('@/lib/upstash');
  
  console.log('🚀 Начинаем загрузку исторических котировок...');
  
  let loadedCount = 0;
  
  // Загружаем историю для каждого тикера последовательно
  // Не параллельно, чтобы не перегрузить API MOEX
  for (const ticker of TICKERS) {
    // Загружаем историю
    const history = await fetchHistory(ticker);
    
    // Если данные получены - сохраняем в Redis
    if (history.length > 0) {
      try {
        // Формируем ключ для Redis в формате history:TICKER
        const key = `history:${ticker}`;
        
        // Сохраняем массив исторических данных в Redis как JSON
        // TTL не ставим - храним вечно
        await redis.set(key, JSON.stringify(history));
        
        console.log(`[${ticker}] 💾 Сохранено в Redis (ключ: ${key})`);
        loadedCount++;
      } catch (error) {
        console.error(`[${ticker}] ❌ Ошибка сохранения в Redis: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Делаем паузу 100 мс между запросами, чтобы не перегрузить API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('✅ Загрузка исторических котировок завершена');
  console.log(`📊 Обработано тикеров: ${loadedCount}/${TICKERS.length}`);
  
  return NextResponse.json({
    success: true,
    loaded: loadedCount,
    total: TICKERS.length,
  });
}
