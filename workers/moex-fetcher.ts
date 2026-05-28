// workers/moex-fetcher.ts
// Воркер для получения котировок российских БПИФ из MOEX ISS API
// Запускается каждые 60 секунд и сохраняет данные в Upstash Redis

// Сначала загружаем переменные окружения - ДО любых других импортов
// Это критично, так как lib/upstash.ts использует переменные при инициализации
import dotenv from 'dotenv';
import path from 'path';

// Явно указываем путь к .env.local относительно текущего файла
// __dirname - путь к папке, где находится этот файл (workers/)
// path.resolve(__dirname, '../.env.local') - переходим на уровень выше и находим .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Список тикеров российских БПИФ с Московской биржи (ETF + акции + ОФЗ + золото)
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

// Интерфейс для котировки (сохраняется в Redis)
interface QuoteData {
  price: number;
  change: number;
  changePercent: number;
}

// Интерфейс для ответа MOEX ISS API
interface MoexResponse {
  marketdata?: {
    data?: (number | string)[][];
  };
  securities?: {
    data?: (number | string)[][];
  };
}

// Основная асинхронная функция воркера
// Используем async/await для динамического импорта клиента Redis
async function main() {
  // ДИНАМИЧЕСКИЙ ИМПОРТ - загружаем модуль только внутри функции
  // Почему это важно:
  // 1. Верхнеуровневые импорты (import ... from ...) выполняются ДО любого кода
  // 2. Если бы мы сделали import redis из '../lib/upstash' в начале файла,
  //    он бы выполнился ДО dotenv.config(), и переменные окружения были бы пустыми
  // 3. Динамический импорт await import(...) выполняется только когда до него доходит выполнение
  // 4. К этому моменту dotenv.config() уже загрузил переменные из .env.local
  // 5. Поэтому lib/upstash.ts видит корректные переменные и успешно инициализируется
  const { redis } = await import('../lib/upstash');

  // Функция для определения типа актива и соответствующих boards
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
    
    // По умолчанию для всех остальных
    return ['TQTF', 'TQBR', 'TQTD', 'TQIF'];
  }

  // Функция для получения котировки одного тикера из MOEX ISS API с нескольких boards
  async function fetchQuote(ticker: string): Promise<{ data: QuoteData; board: string } | null> {
    // Получаем список boards для данного тикера
    const boards = getBoardsForTicker(ticker);
    
    for (const board of boards) {
      try {
        // Формируем URL для запроса к MOEX ISS API
        const url = `https://iss.moex.com/iss/engines/stock/markets/shares/boards/${board}/securities/${ticker}.json`;
        
        // Выполняем HTTP GET запрос
        const response = await fetch(url);
        
        // Проверяем, что запрос успешен
        if (!response.ok) {
          continue; // Пробуем следующий board
        }
        
        // Парсим JSON ответ
        const data: MoexResponse = await response.json();
        
        // Проверяем, есть ли данные в marketdata.data
        if (data.marketdata?.data && data.marketdata.data.length > 0) {
          const marketdataRow = data.marketdata.data[0];
          
          // Индексы полей в marketdata.data:
          // 12 - цена (LAST или текущая цена)
          // 13 - изменение в валюте (CHANGE)
          // 14 - изменение в процентах (CHANGE в %)
          const price = marketdataRow[12] as number || 0;
          const change = marketdataRow[13] as number || 0;
          const changePercent = marketdataRow[14] as number || 0;
          
          // Возвращаем данные даже если цена 0 (обработка будет позже)
          return {
            data: { price, change, changePercent },
            board,
          };
        }
        
        // Если marketdata пуст, пробуем взять из securities
        if (data.securities?.data && data.securities.data.length > 0) {
          const securitiesRow = data.securities.data[0];
          const lastPrice = securitiesRow[5] as number || securitiesRow[1] as number || 0;
          
          if (lastPrice >= 0) {
            return {
              data: { price: lastPrice, change: 0, changePercent: 0 },
              board,
            };
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

  // Функция для получения последней известной цены из Redis
  async function getLastQuote(ticker: string): Promise<QuoteData | null> {
    try {
      const key = `quote:${ticker}:last`;
      const data = await redis.get(key);
      if (data && typeof data === 'string') {
        return JSON.parse(data) as QuoteData;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // Функция для сохранения котировки в Upstash Redis
  async function saveQuoteToRedis(ticker: string, quoteData: QuoteData, board: string): Promise<void> {
    try {
      // Сохраняем в резервное хранилище только если цена > 0
      if (quoteData.price > 0) {
        const lastKey = `quote:${ticker}:last`;
        await redis.set(lastKey, JSON.stringify(quoteData), { ex: 30 * 24 * 60 * 60 }); // 30 дней
      }
      
      // Основной ключ с TTL 60 секунд
      const mainKey = `quote:${ticker}`;
      await redis.set(mainKey, JSON.stringify(quoteData), { ex: 60 });
      
      const changeSign = quoteData.change >= 0 ? '+' : '';
      console.log(`[${ticker}] ✅ ${board} ${quoteData.price.toFixed(2)} ₽ (${changeSign}${quoteData.change.toFixed(2)}, ${changeSign}${quoteData.changePercent.toFixed(2)}%)`);
    } catch (error) {
      console.error(`[${ticker}] ❌ Ошибка сохранения в Redis: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Функция для получения курсов валют из API ЦБ РФ
  async function fetchCurrencyRates(): Promise<void> {
    try {
      console.log('🔄 Загружаем курсы валют из ЦБ РФ...');
      
      const response = await fetch('https://www.cbr-xml-daily.ru/daily_json.js');
      if (!response.ok) {
        console.error('❌ Ошибка при получении курсов валют от ЦБ РФ');
        return;
      }
      
      const data = await response.json();
      
      // Сохраняем курсы для нужных валют
      const currencies = {
        'USD/RUB': data.Valute.USD,
        'EUR/RUB': data.Valute.EUR,
        'CNY/RUB': data.Valute.CNY
      };
      
      for (const [symbol, currencyData] of Object.entries(currencies)) {
        if (currencyData) {
          const price = currencyData.Value;
          const previous = currencyData.Previous;
          const change = previous - price;
          const changePercent = (change / previous) * 100;
          
          const quoteData: QuoteData = {
            price,
            change,
            changePercent
          };
          
          // Сохраняем в основной ключ
          const mainKey = `quote:${symbol}`;
          await redis.set(mainKey, JSON.stringify(quoteData), { ex: 3600 }); // 1 час
          
          // Сохраняем в резервное хранилище
          const lastKey = `quote:${symbol}:last`;
          await redis.set(lastKey, JSON.stringify(quoteData), { ex: 30 * 24 * 60 * 60 }); // 30 дней
          
          const changeSign = change >= 0 ? '+' : '';
          console.log(`[${symbol}] ✅ ${price.toFixed(2)} ₽ (${changeSign}${change.toFixed(2)}, ${changeSign}${changePercent.toFixed(2)}%)`);
        }
      }
      
      console.log('✅ Курсы валют загружены');
    } catch (error) {
      console.error('❌ Ошибка при загрузке курсов валют:', error);
    }
  }

  // Функция для получения и сохранения всех котировок
  async function fetchAllQuotes() {
    console.log('🔄 Начинаем загрузку котировок из MOEX...');
    
    // Обрабатываем все тикеры параллельно для скорости
    const promises = TICKERS.map(async (ticker) => {
      // Получаем котировку с нескольких boards
      const result = await fetchQuote(ticker);
      
      if (result) {
        // Если данные получены - сохраняем в Redis
        await saveQuoteToRedis(ticker, result.data, result.board);
      } else {
        // Если нигде нет данных - пробуем использовать последнюю известную цену
        const lastQuote = await getLastQuote(ticker);
        if (lastQuote && lastQuote.price > 0) {
          console.log(`[${ticker}] ⏳ Нет данных с MOEX, использую последнюю цену ${lastQuote.price.toFixed(2)} из Redis`);
          // Записываем последнюю цену в основной ключ
          const mainKey = `quote:${ticker}`;
          await redis.set(mainKey, JSON.stringify(lastQuote), { ex: 60 });
        } else {
          console.log(`[${ticker}] ❌ Нет ни свежих, ни исторических данных`);
          // Не обновляем основной ключ, остаётся старое значение или 0
        }
      }
    });
    
    // Ждём завершения всех запросов
    await Promise.all(promises);
    
    console.log('✅ Загрузка котировок завершена');
  }

  // Запускаем первую загрузку котировок сразу при старте
  await fetchAllQuotes();
  
  // Запускаем первую загрузку курсов валют сразу при старте
  await fetchCurrencyRates();

  // Запускаем периодическую загрузку котировок каждые 60 секунд
  // 60000 мс = 60 секунд
  setInterval(() => {
    // Глобальный try...catch для предотвращения падения воркера
    try {
      fetchAllQuotes().catch((error) => {
        console.error('❌ Ошибка в воркере MOEX:', error);
      });
    } catch (error) {
      console.error('❌ Критическая ошибка в setInterval:', error);
    }
  }, 60000);

  // Запускаем периодическую загрузку курсов валют каждые 60 минут
  // 3600000 мс = 60 минут
  setInterval(() => {
    try {
      fetchCurrencyRates().catch((error) => {
        console.error('❌ Ошибка при загрузке курсов валют:', error);
      });
    } catch (error) {
      console.error('❌ Критическая ошибка в setInterval для валют:', error);
    }
  }, 3600000);

  console.log('🚀 Воркер MOEX запущен. Котировки обновляются каждые 60 секунд, курсы валют - каждые 60 минут.');
}

// Запускаем основную функцию и обрабатываем возможные ошибки
// Если main() упадёт с ошибкой, она будет выведена в консоль
main().catch((error) => {
  console.error('Критическая ошибка при запуске воркера:', error);
  process.exit(1); // Завершаем процесс с кодом ошибки
});
