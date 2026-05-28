// workers/fetcher.ts
// Этот файл - воркер, который периодически получает котировки ETF из Finnhub API
// Воркер работает в отдельном процессе и сохраняет данные в Upstash Redis
// НЕ использует BullMQ - просто setInterval для периодического обновления

import redis from '../lib/upstash';

// Список тикеров ETF для отслеживания
// Это те же 10 ETF, которые мы используем в GraphQL API
const ETF_TICKERS = [
  'SPY',  // SPDR S&P 500 ETF Trust
  'QQQ',  // Invesco QQQ Trust
  'VTI',  // Vanguard Total Stock Market ETF
  'VWO',  // Vanguard Emerging Markets Stock ETF
  'IWM',  // iShares Russell 2000 ETF
  'GLD',  // SPDR Gold Shares
  'TLT',  // iShares 20+ Year Treasury Bond ETF
  'XLE',  // Energy Select Sector SPDR Fund
  'XLV',  // Health Care Select Sector SPDR Fund
  'XLF',  // Financial Select Sector SPDR Fund
];

// Получаем API ключ Finnhub из переменной окружения
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

// Проверяем, что API ключ задан
if (!FINNHUB_API_KEY) {
  console.error('Ошибка: FINNHUB_API_KEY не задан в переменных окружения');
  process.exit(1);
}

// Интерфейс для ответа от Finnhub API
// Finnhub возвращает котировку в следующем формате:
interface FinnhubQuote {
  c: number;  // Текущая цена (current price)
  d: number;  // Изменение цены (change)
  dp: number; // Изменение в процентах (change percent)
  h: number;  // Максимальная цена за день (high)
  l: number;  // Минимальная цена за день (low)
  o: number;  // Цена открытия (open)
  pc: number; // Цена закрытия предыдущего дня (previous close)
  t: number;  // Временная метка (timestamp)
}

// Интерфейс для сохранения в Upstash Redis
interface QuoteData {
  price: number;        // Текущая цена
  change: number;       // Изменение цены
  changePercent: number; // Изменение в процентах
}

// Функция для получения котировки одного тикера из Finnhub API
async function fetchQuote(symbol: string): Promise<QuoteData | null> {
  try {
    // Формируем URL для запроса к Finnhub API
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
    
    // Выполняем HTTP запрос
    const response = await fetch(url);
    
    // Проверяем, что запрос успешен
    if (!response.ok) {
      console.error(`Ошибка HTTP для ${symbol}: ${response.status}`);
      return null;
    }
    
    // Парсим JSON ответ
    const data: FinnhubQuote = await response.json();
    
    // Проверяем, что данные валидны (цена должна быть больше 0)
    if (!data.c || data.c <= 0) {
      console.error(`Невалидные данные для ${symbol}:`, data);
      return null;
    }
    
    // Формируем объект для сохранения в Upstash Redis
    const quoteData: QuoteData = {
      price: data.c,           // Текущая цена
      change: data.d,          // Изменение цены
      changePercent: data.dp,  // Изменение в процентах
    };
    
    console.log(`Получена котировка для ${symbol}: $${data.c} (${data.dp}%)`);
    return quoteData;
    
  } catch (error) {
    console.error(`Ошибка при получении котировки для ${symbol}:`, error);
    return null;
  }
}

// Функция для сохранения котировки в Upstash Redis
async function saveQuoteToRedis(symbol: string, quoteData: QuoteData): Promise<void> {
  try {
    // Формируем ключ для Redis в формате quote:SYMBOL
    const key = `quote:${symbol}`;
    
    // Сохраняем данные в Upstash Redis как JSON строку
    // ex: 60 - срок действия 60 секунд (данные устареют через минуту)
    await redis.set(key, JSON.stringify(quoteData), { ex: 60 });
    
    console.log(`Сохранена котировка для ${symbol} в Upstash Redis`);
  } catch (error) {
    console.error(`Ошибка при сохранении котировки для ${symbol} в Upstash Redis:`, error);
  }
}

// Главная функция воркера
// Получает котировки для всех тикеров и сохраняет их в Upstash Redis
async function fetchAllQuotes(): Promise<void> {
  console.log('--- Начало обновления котировок ---');
  
  // Обрабатываем все тикеры параллельно для ускорения
  const promises = ETF_TICKERS.map(async (symbol) => {
    // Получаем котировку из Finnhub
    const quoteData = await fetchQuote(symbol);
    
    // Если данные получены успешно - сохраняем в Upstash Redis
    if (quoteData) {
      await saveQuoteToRedis(symbol, quoteData);
    }
  });
  
  // Ждём завершения всех запросов
  await Promise.all(promises);
  
  console.log('--- Обновление котировок завершено ---');
}

// Запускаем бесконечный цикл
// setInterval выполняет функцию каждые 30 секунд (30000 мс)
console.log('Запуск воркера для получения котировок ETF...');
console.log(`Отслеживаем тикеры: ${ETF_TICKERS.join(', ')}`);
console.log('Интервал обновления: 30 секунд');

// Сразу получаем первые данные при запуске
fetchAllQuotes();

// Затем запускаем периодическое обновление
setInterval(fetchAllQuotes, 30000); // 30 секунд
