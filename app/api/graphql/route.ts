import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { ApolloServer } from '@apollo/server';
import { NextRequest } from 'next/server';
import redis from '@/lib/upstash';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Интерфейс для котировки из Upstash Redis
interface QuoteData {
  price: number;
  change: number;
  changePercent: number;
}

// Типы данных для ETF (статические поля)
interface ETF {
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
  assetType?: string; // "etf", "stock", "bond", "currency"
}

// Статические данные российских БПИФ (без цен - цены будут браться из Upstash Redis)
// БПИФ - биржевые паевые инвестиционные фонды, российские аналоги ETF
// Только работающие ETF с подтверждёнными котировками
const etfsData: ETF[] = [
  // Индексы широкого рынка (ETF)
  { id: "1", symbol: "TMOS", name: "Т-Капитал Индекс МосБиржи", price: 0, change: 0, changePercent: 0, expenseRatio: 0.0079, assetsUnderManagement: 0, sector: "Акции", description: "Отслеживает индекс МосБиржи полной доходности", assetType: "etf" },
  { id: "2", symbol: "SBMX", name: "Первая — Индекс МосБиржи", price: 0, change: 0, changePercent: 0, expenseRatio: 0.0095, assetsUnderManagement: 0, sector: "Акции", description: "Рыночный индекс акций РФ", assetType: "etf" },
  { id: "3", symbol: "EQMX", name: "ВИМ Индекс МосБиржи", price: 0, change: 0, changePercent: 0, expenseRatio: 0.0069, assetsUnderManagement: 0, sector: "Акции", description: "Широкий рынок акций РФ от ВИМ Инвестиции", assetType: "etf" },

  // Дивидендные акции (ETF)
  { id: "4", symbol: "DIVD", name: "ДОХОДЪ Индекс дивидендных акций РФ", price: 0, change: 0, changePercent: 0, expenseRatio: 0.0099, assetsUnderManagement: 0, sector: "Акции", description: "Дивидендные акции российских компаний", assetType: "etf" },

  // Секторальные — Финансы (ETF)
  { id: "5", symbol: "SFIN", name: "Первая — Финансы", price: 0, change: 0, changePercent: 0, expenseRatio: 0.0095, assetsUnderManagement: 0, sector: "Акции", description: "Банки и финансовые компании РФ", assetType: "etf" },

  // Секторальные — Технологии (ETF)
  { id: "6", symbol: "AKHT", name: "Альфа-Капитал Технологические акции", price: 0, change: 0, changePercent: 0, expenseRatio: 0.0200, assetsUnderManagement: 0, sector: "Акции", description: "Российские технологические компании", assetType: "etf" },

  // Акции с добавленной стоимостью и управлением (ETF)
  { id: "7", symbol: "ESGR", name: "РСХБ — МосБиржа-РСПП Вектор", price: 0, change: 0, changePercent: 0, expenseRatio: 0.0155, assetsUnderManagement: 0, sector: "Акции", description: "Индекс корпоративного управления и ESG", assetType: "etf" },
  { id: "8", symbol: "AKME", name: "Альфа-Капиталь Умный портфель", price: 0, change: 0, changePercent: 0, expenseRatio: 0.0120, assetsUnderManagement: 0, sector: "Акции", description: "Динамическое распределение активов по алгоритму", assetType: "etf" },
  { id: "9", symbol: "SBSC", name: "Сбер — Сбалансированный", price: 0, change: 0, changePercent: 0, expenseRatio: 0.0070, assetsUnderManagement: 0, sector: "Акции", description: "Фонд активов смешанного типа", assetType: "etf" },

  // Облигации — Государственные (ETF)
  { id: "10", symbol: "SBGB", name: "Первая — ОФЗ", price: 0, change: 0, changePercent: 0, expenseRatio: 0.0082, assetsUnderManagement: 0, sector: "Облигации", description: "Долгосрочные облигации федерального займа", assetType: "etf" },

  // Облигации — Корпоративные (ETF)
  { id: "11", symbol: "SBRB", name: "Первая — Корпоративные облигации", price: 0, change: 0, changePercent: 0, expenseRatio: 0.0060, assetsUnderManagement: 0, sector: "Облигации", description: "Надёжные корпоративные облигации РФ", assetType: "etf" },

  // Облигации — Инфляционные и специализированные (ETF)
  { id: "12", symbol: "INFL", name: "Ингосстрах Инфляционный", price: 0, change: 0, changePercent: 0, expenseRatio: 0.0040, assetsUnderManagement: 0, sector: "Облигации", description: "Защита от инфляции через ОФЗ-ИН", assetType: "etf" },

  // Облигации — Корпоративные (ETF)
  { id: "13", symbol: "SBCB", name: "Сбер — Корпоративные облигации", price: 0, change: 0, changePercent: 0, expenseRatio: 0.0075, assetsUnderManagement: 0, sector: "Облигации", description: "Фонд облигаций от Сбер Управление Активами", assetType: "etf" },

  // Акции (blue chips)
  { id: "14", symbol: "SBER", name: "Сбербанк", price: 0, change: 0, changePercent: 0, expenseRatio: 0, assetsUnderManagement: 0, sector: "Акции", description: "Обыкновенные акции Сбербанка", assetType: "stock" },
  { id: "15", symbol: "GAZP", name: "Газпром", price: 0, change: 0, changePercent: 0, expenseRatio: 0, assetsUnderManagement: 0, sector: "Акции", description: "Акции ПАО Газпром", assetType: "stock" },
  { id: "16", symbol: "LKOH", name: "Лукойл", price: 0, change: 0, changePercent: 0, expenseRatio: 0, assetsUnderManagement: 0, sector: "Акции", description: "Акции ПАО Лукойл", assetType: "stock" },
  { id: "17", symbol: "NVTK", name: "НОВАТЭК", price: 0, change: 0, changePercent: 0, expenseRatio: 0, assetsUnderManagement: 0, sector: "Акции", description: "Акции ПАО НОВАТЭК", assetType: "stock" },
  { id: "18", symbol: "GMKN", name: "Норильский никель", price: 0, change: 0, changePercent: 0, expenseRatio: 0, assetsUnderManagement: 0, sector: "Акции", description: "Акции ПАО ГМК Норникель", assetType: "stock" },
  { id: "19", symbol: "TATN", name: "Татнефть", price: 0, change: 0, changePercent: 0, expenseRatio: 0, assetsUnderManagement: 0, sector: "Акции", description: "Обыкновенные акции Татнефти", assetType: "stock" },
  { id: "20", symbol: "ROSN", name: "Роснефть", price: 0, change: 0, changePercent: 0, expenseRatio: 0, assetsUnderManagement: 0, sector: "Акции", description: "Акции ПАО НК Роснефть", assetType: "stock" },
  { id: "21", symbol: "YDEX", name: "Яндекс", price: 0, change: 0, changePercent: 0, expenseRatio: 0, assetsUnderManagement: 0, sector: "Акции", description: "Акции МКПАО Яндекс", assetType: "stock" },

  // Облигации (ОФЗ)
  { id: "22", symbol: "SU26240RMFS2", name: "ОФЗ 26240 (погашение 2036)", price: 0, change: 0, changePercent: 0, expenseRatio: 0, assetsUnderManagement: 0, sector: "Облигации", description: "Облигации федерального займа с постоянным купонным доходом", assetType: "bond" },
  { id: "23", symbol: "SU26238RMFS4", name: "ОФЗ 26238 (погашение 2041)", price: 0, change: 0, changePercent: 0, expenseRatio: 0, assetsUnderManagement: 0, sector: "Облигации", description: "Долгосрочные ОФЗ с постоянным купонным доходом", assetType: "bond" },
  { id: "24", symbol: "SU26230RMFS1", name: "ОФЗ 26230 (погашение 2039)", price: 0, change: 0, changePercent: 0, expenseRatio: 0, assetsUnderManagement: 0, sector: "Облигации", description: "ОФЗ для консервативных инвестиций", assetType: "bond" },

  // Валюта
  { id: "25", symbol: "USD/RUB", name: "Доллар США к рублю", price: 0, change: 0, changePercent: 0, expenseRatio: 0, assetsUnderManagement: 0, sector: "Валюта", description: "Курс доллара США по данным ЦБ РФ", assetType: "currency" },
  { id: "26", symbol: "EUR/RUB", name: "Евро к рублю", price: 0, change: 0, changePercent: 0, expenseRatio: 0, assetsUnderManagement: 0, sector: "Валюта", description: "Курс евро по данным ЦБ РФ", assetType: "currency" },
  { id: "27", symbol: "CNY/RUB", name: "Юань к рублю", price: 0, change: 0, changePercent: 0, expenseRatio: 0, assetsUnderManagement: 0, sector: "Валюта", description: "Курс китайского юаня по данным ЦБ РФ", assetType: "currency" },

  // Золото (ETF)
  { id: "28", symbol: "GLD", name: "ВТБ Золото — БПИФ на физическое золото", price: 0, change: 0, changePercent: 0, expenseRatio: 0.005, assetsUnderManagement: 0, sector: "Золото", description: "Инвестирует в физическое золото", assetType: "etf" }
];

// Функция для получения котировки из Upstash Redis по символу ETF
async function getQuoteFromRedis(symbol: string): Promise<QuoteData | null> {
  try {
    // Формируем ключ для Redis в формате quote:SYMBOL
    const key = `quote:${symbol}`;
    
    // Получаем данные из Upstash Redis
    const data = await redis.get(key);
    
    // Если данных нет - возвращаем null
    if (!data) {
      return null;
    }
    
    // Если данные пришли как строка - парсим JSON
    if (typeof data === 'string') {
      return JSON.parse(data) as QuoteData;
    }
    
    // Если данные уже объект - возвращаем как есть
    return data as QuoteData;
  } catch (error) {
    console.error(`Ошибка при получении котировки для ${symbol} из Upstash Redis:`, error);
    return null;
  }
}

// GraphQL схема - определяет типы данных и доступные запросы
// Поля price, change, changePercent теперь могут быть null (Float вместо Float!)
// Apollo Server поддерживает строки напрямую без использования gql
const typeDefs = `
  type ETF {
    id: ID!
    symbol: String!
    name: String!
    price: Float
    change: Float
    changePercent: Float
    expenseRatio: Float!
    assetsUnderManagement: Float!
    sector: String!
    description: String!
    assetType: String
  }

  type Portfolio {
    id: ID!
    name: String!
    createdAt: String!
    items: [PortfolioItem!]!
    totalValue: Float!
    dailyChange: Float!
    totalReturnPercent: Float!
    history(startDate: String!, endDate: String!): [PortfolioSnapshot!]!
  }

  type PortfolioItem {
    itemId: ID  # Уникальный идентификатор позиции (опциональный для совместимости со старыми данными)
    etf: ETF!
    quantity: Float!
    buyPrice: Float!
    currentValue: Float!
    change: Float!
    changePercent: Float!
  }

  type PortfolioSnapshot {
    date: String!
    totalValue: Float!
  }

  type User {
    id: ID!
    email: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    etfs: [ETF!]!
    etf(symbol: String!): ETF
    etfsBySector(sector: String!): [ETF!]!
    myPortfolios: [Portfolio!]!
  }

  type Mutation {
    createPortfolio(name: String!): Portfolio
    addPortfolioItem(portfolioId: ID!, etfId: ID!, quantity: Float!): PortfolioItem
    removePortfolioItem(portfolioId: ID!, itemId: ID!): Boolean  # Используем itemId вместо etfId для удаления конкретной позиции
    signUp(email: String!, password: String!): AuthPayload
    signIn(email: String!, password: String!): AuthPayload
  }
`;

// Resolvers - функции, которые возвращают данные для запросов
const resolvers = {
  Query: {
    // Получить все ETF с котировками из Upstash Redis
    etfs: async () => {
      // Получаем котировки для всех ETF параллельно
      const etfsWithQuotes = await Promise.all(
        etfsData.map(async (etf) => {
          // Получаем котировку из Upstash Redis
          const quote = await getQuoteFromRedis(etf.symbol);
          
          // Возвращаем ETF с котировками (или 0 если данных нет)
          return {
            ...etf,
            price: quote?.price || 0,
            change: quote?.change || 0,
            changePercent: quote?.changePercent || 0,
          };
        })
      );
      
      return etfsWithQuotes;
    },
    
    // Получить ETF по символу с котировкой из Upstash Redis
    etf: async (_: any, args: { symbol: string }) => {
      // Находим ETF в статических данных
      const etf = etfsData.find(e => e.symbol === args.symbol);
      
      // Если ETF не найден - возвращаем null
      if (!etf) {
        return null;
      }
      
      // Получаем котировку из Upstash Redis
      const quote = await getQuoteFromRedis(etf.symbol);
      
      // Возвращаем ETF с котировками (или 0 если данных нет)
      return {
        ...etf,
        price: quote?.price || 0,
        change: quote?.change || 0,
        changePercent: quote?.changePercent || 0,
      };
    },
    
    // Получить ETF по сектору с котировками из Upstash Redis
    etfsBySector: async (_: any, args: { sector: string }) => {
      // Фильтруем ETF по сектору
      const filteredEtfs = etfsData.filter(etf => 
        etf.sector.toLowerCase().includes(args.sector.toLowerCase())
      );
      
      // Получаем котировки для отфильтрованных ETF параллельно
      const etfsWithQuotes = await Promise.all(
        filteredEtfs.map(async (etf) => {
          // Получаем котировку из Upstash Redis
          const quote = await getQuoteFromRedis(etf.symbol);
          
          // Возвращаем ETF с котировками (или 0 если данных нет)
          return {
            ...etf,
            price: quote?.price || 0,
            change: quote?.change || 0,
            changePercent: quote?.changePercent || 0,
          };
        })
      );
      
      return etfsWithQuotes;
    },

    // Получить все портфели текущего пользователя
    myPortfolios: async (_: any, __: any, context: { userId: string | null }) => {
      // Проверяем авторизацию - если userId нет, выбрасываем ошибку
      if (!context.userId) {
        throw new Error('Требуется авторизация');
      }

      const userId = context.userId;

      try {
        // Получаем все ID портфелей из Set portfolio_list:{userId}
        const portfolioIds = await redis.smembers(`portfolio_list:${userId}`);

        // Если портфелей нет - возвращаем пустой массив
        if (!portfolioIds || portfolioIds.length === 0) {
          return [];
        }

        // Для каждого ID получаем данные портфеля из Redis
        const portfolios = await Promise.all(
          portfolioIds.map(async (id) => {
            // Получаем JSON портфеля по ключу portfolio:demo-user:{id}
            const portfolioData = await redis.get(`portfolio:${userId}:${id}`);

            // Если данных нет - пропускаем этот портфель
            if (!portfolioData) {
              return null;
            }

            // Парсим JSON
            const portfolio = typeof portfolioData === 'string' 
              ? JSON.parse(portfolioData) 
              : portfolioData;

            // Обрабатываем позиции портфеля
            const items = await Promise.all(
              portfolio.items.map(async (item: any) => {
                // Находим ETF в статических данных по etfId
                const etf = etfsData.find(e => e.id === item.etfId);

                // Если ETF не найден - пропускаем позицию
                if (!etf) {
                  return null;
                }

                // Получаем текущую котировку из Upstash Redis
                const quote = await getQuoteFromRedis(etf.symbol);

                // Текущая цена (или 0 если нет котировки)
                const currentPrice = quote?.price || 0;

                // Вычисляем метрики позиции
                const currentValue = currentPrice * item.quantity;
                const change = (quote?.change || 0) * item.quantity;
                const changePercent = item.buyPrice > 0 
                  ? ((currentPrice - item.buyPrice) / item.buyPrice) * 100 
                  : 0;

                // Возвращаем объект PortfolioItem с itemId
                // Если itemId нет в данных (старый портфель), генерируем его на лету для уникальности
                const itemId = item.itemId || Math.random().toString(36).substr(2, 9);
                
                return {
                  itemId,  // Включаем itemId (из данных или сгенерированный)
                  etf: {
                    ...etf,
                    price: currentPrice,
                    change: quote?.change || 0,
                    changePercent: quote?.changePercent || 0,
                  },
                  quantity: item.quantity,
                  buyPrice: item.buyPrice,
                  currentValue,
                  change,
                  changePercent,
                };
              })
            );

            // Фильтруем null значения (если ETF не найден)
            const validItems = items.filter(item => item !== null);

            // Вычисляем метрики всего портфеля
            const totalValue = validItems.reduce((sum, item) => sum + item!.currentValue, 0);
            const totalInvested = validItems.reduce((sum, item) => sum + (item!.buyPrice * item!.quantity), 0);
            const dailyChange = validItems.reduce((sum, item) => sum + item!.change, 0);
            const totalReturnPercent = totalInvested > 0 
              ? ((totalValue - totalInvested) / totalInvested) * 100 
              : 0;

            // Возвращаем объект Portfolio
            return {
              id: portfolio.id,
              name: portfolio.name,
              createdAt: portfolio.createdAt,
              items: validItems,
              totalValue,
              dailyChange,
              totalReturnPercent,
            };
          })
        );

        // Фильтруем null значения (если портфель не найден)
        return portfolios.filter(p => p !== null);
      } catch (error) {
        console.error('Ошибка при получении портфелей:', error);
        return [];
      }
    }
  },

  Mutation: {
    // Создать новый портфель
    createPortfolio: async (_: any, args: { name: string }, context: { userId: string | null }) => {
      // Проверяем авторизацию - если userId нет, выбрасываем ошибку
      if (!context.userId) {
        throw new Error('Требуется авторизация');
      }

      const userId = context.userId;

      try {
        // Генерируем уникальный ID портфеля
        const id = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;

        // Создаём объект портфеля
        const portfolio = {
          id,
          name: args.name,
          createdAt: new Date().toISOString(),
          items: [],
        };

        // Сохраняем портфель в Redis по ключу portfolio:{userId}:{id}
        await redis.set(`portfolio:${userId}:${id}`, JSON.stringify(portfolio));

        // Добавляем ID в Set portfolio_list:{userId}
        await redis.sadd(`portfolio_list:${userId}`, id);

        // Возвращаем портфель с нулевыми метриками
        return {
          id: portfolio.id,
          name: portfolio.name,
          createdAt: portfolio.createdAt,
          items: [],
          totalValue: 0,
          dailyChange: 0,
          totalReturnPercent: 0,
        };
      } catch (error) {
        console.error('Ошибка при создании портфеля:', error);
        throw new Error('Не удалось создать портфель');
      }
    },

    // Добавить позицию в портфель
    addPortfolioItem: async (_: any, args: { portfolioId: string; etfId: string; quantity: number }, context: { userId: string | null }) => {
      // Проверяем авторизацию - если userId нет, выбрасываем ошибку
      if (!context.userId) {
        throw new Error('Требуется авторизация');
      }

      const userId = context.userId;

      try {
        // Получаем портфель из Redis
        const portfolioData = await redis.get(`portfolio:${userId}:${args.portfolioId}`);

        // Если портфель не найден - выбрасываем ошибку
        if (!portfolioData) {
          throw new Error('Портфель не найден');
        }

        // Парсим JSON
        const portfolio = typeof portfolioData === 'string' 
          ? JSON.parse(portfolioData) 
          : portfolioData;

        // Находим ETF в статических данных по etfId
        const etf = etfsData.find(e => e.id === args.etfId);

        // Если ETF не найден - выбрасываем ошибку
        if (!etf) {
          throw new Error('ETF не найден');
        }

        // Получаем текущую котировку из Upstash Redis
        const quote = await getQuoteFromRedis(etf.symbol);

        // Цена покупки (текущая цена или 0 если нет котировки)
        const buyPrice = quote?.price || 0;

        // Генерируем уникальный itemId для позиции
        // Используем короткий UUID для простоты
        const itemId = Math.random().toString(36).substr(2, 9);

        // Добавляем новую позицию в items с уникальным itemId
        portfolio.items.push({
          itemId,  // Уникальный идентификатор позиции
          etfId: args.etfId,
          quantity: args.quantity,
          buyPrice,
        });

        // Сохраняем обновлённый портфель в Redis
        await redis.set(`portfolio:${userId}:${args.portfolioId}`, JSON.stringify(portfolio));

        // Вычисляем метрики позиции
        const currentPrice = quote?.price || 0;
        const currentValue = currentPrice * args.quantity;
        const change = (quote?.change || 0) * args.quantity;
        const changePercent = buyPrice > 0 
          ? ((currentPrice - buyPrice) / buyPrice) * 100 
          : 0;

        // Возвращаем созданный PortfolioItem с itemId
        return {
          itemId,  // Включаем уникальный идентификатор позиции
          etf: {
            ...etf,
            price: currentPrice,
            change: quote?.change || 0,
            changePercent: quote?.changePercent || 0,
          },
          quantity: args.quantity,
          buyPrice,
          currentValue,
          change,
          changePercent,
        };
      } catch (error) {
        console.error('Ошибка при добавлении позиции в портфель:', error);
        throw new Error('Не удалось добавить позицию в портфель');
      }
    },

    // Удалить позицию из портфеля
    removePortfolioItem: async (_: any, args: { portfolioId: string; itemId: string }, context: { userId: string | null }) => {
      // Проверяем авторизацию - если userId нет, выбрасываем ошибку
      if (!context.userId) {
        throw new Error('Требуется авторизация');
      }

      const userId = context.userId;

      try {
        // Получаем портфель из Redis
        const portfolioData = await redis.get(`portfolio:${userId}:${args.portfolioId}`);

        // Если портфель не найден - возвращаем false
        if (!portfolioData) {
          return false;
        }

        // Парсим JSON
        const portfolio = typeof portfolioData === 'string' 
          ? JSON.parse(portfolioData) 
          : portfolioData;

        // Запоминаем исходное количество позиций
        const originalLength = portfolio.items.length;

        // Удаляем позицию с указанным itemId
        // Если itemId пустой или не найден, пытаемся найти позицию по etfId (для старых данных)
        let removed = false;
        
        if (args.itemId) {
          // Сначала пробуем удалить по itemId (для новых данных)
          const filteredByItemId = portfolio.items.filter((item: any) => item.itemId !== args.itemId);
          if (filteredByItemId.length !== originalLength) {
            portfolio.items = filteredByItemId;
            removed = true;
          }
        }
        
        // Если не нашли по itemId, пробуем найти позицию по etfId (для обратной совместимости)
        if (!removed) {
          // Находим позицию по etfId и удаляем её (первую найденную)
          const itemIndex = portfolio.items.findIndex((item: any) => item.etfId === args.itemId);
          if (itemIndex !== -1) {
            portfolio.items.splice(itemIndex, 1);
            removed = true;
          }
        }

        // Если позиция не была найдена - возвращаем false
        if (!removed) {
          return false;
        }

        // Сохраняем обновлённый портфель в Redis
        await redis.set(`portfolio:${userId}:${args.portfolioId}`, JSON.stringify(portfolio));

        // Возвращаем true - позиция успешно удалена
        return true;
      } catch (error) {
        console.error('Ошибка при удалении позиции из портфеля:', error);
        return false;
      }
    },

    // Регистрация нового пользователя
    signUp: async (_: any, args: { email: string; password: string }) => {
      try {
        // Проверяем, есть ли уже пользователь с таким email
        const existingUserId = await redis.get(`user:email:${args.email}`);
        
        // Если пользователь уже существует - выбрасываем ошибку
        if (existingUserId) {
          throw new Error('Пользователь с таким email уже существует');
        }

        // Хешируем пароль с помощью bcrypt (10 раундов - стандартный уровень безопасности)
        const passwordHash = await bcrypt.hash(args.password, 10);

        // Генерируем уникальный ID пользователя
        const userId = Math.random().toString(36).substr(2, 9);

        // Сохраняем пользователя в Redis по ключу user:{id}
        await redis.set(`user:${userId}`, JSON.stringify({
          id: userId,
          email: args.email,
          passwordHash,
        }));

        // Сохраняем маппинг email -> id для быстрого поиска
        await redis.set(`user:email:${args.email}`, userId);

        // Получаем секретный ключ для JWT из переменной окружения
        const jwtSecret = process.env.JWT_SECRET || 'default-secret-change-in-production';

        // Генерируем JWT токен (срок действия 7 дней)
        const token = jwt.sign(
          { userId }, // Payload - данные, которые кодируются в токен
          jwtSecret, // Секретный ключ для подписи
          { expiresIn: '7d' } // Опции: токен действителен 7 дней
        );

        // Возвращаем токен и данные пользователя
        return {
          token,
          user: {
            id: userId,
            email: args.email,
          },
        };
      } catch (error) {
        console.error('Ошибка при регистрации:', error);
        throw error;
      }
    },

    // Вход в систему
    signIn: async (_: any, args: { email: string; password: string }) => {
      try {
        // Ищем ID пользователя по email
        const userId = await redis.get(`user:email:${args.email}`);

        // Если пользователь не найден - выбрасываем ошибку
        if (!userId) {
          throw new Error('Неверный email или пароль');
        }

        // Получаем данные пользователя из Redis
        const userData = await redis.get(`user:${userId}`);

        // Если данных нет - выбрасываем ошибку
        if (!userData) {
          throw new Error('Неверный email или пароль');
        }

        // Парсим JSON
        const user = typeof userData === 'string' ? JSON.parse(userData) : userData;

        // Сравниваем пароль с хешем с помощью bcrypt
        const passwordMatch = await bcrypt.compare(args.password, user.passwordHash);

        // Если пароль не совпадает - выбрасываем ошибку
        if (!passwordMatch) {
          throw new Error('Неверный email или пароль');
        }

        // Получаем секретный ключ для JWT из переменной окружения
        const jwtSecret = process.env.JWT_SECRET || 'default-secret-change-in-production';

        // Генерируем JWT токен (срок действия 7 дней)
        const token = jwt.sign(
          { userId },
          jwtSecret,
          { expiresIn: '7d' }
        );

        // Возвращаем токен и данные пользователя
        return {
          token,
          user: {
            id: userId,
            email: user.email,
          },
        };
      } catch (error) {
        console.error('Ошибка при входе:', error);
        throw error;
      }
    }
  },

  // Резолверы для полей типа Portfolio
  Portfolio: {
    // Получить историческую доходность портфеля за период
    history: async (parent: any, args: { startDate: string; endDate: string }) => {
      try {
        // Если в портфеле нет позиций - возвращаем пустой массив
        if (!parent.items || parent.items.length === 0) {
          return [];
        }

        // Интерфейс для исторической точки
        interface HistoryPoint {
          date: string;
          close: number;
        }

        // Собираем все символы из позиций портфеля
        const symbols = parent.items.map((item: any) => item.etf.symbol);
        
        // Формируем ключи Redis для всех историй
        const historyKeys = symbols.map((symbol: string) => `history:${symbol}`);
        
        // Загружаем все истории сразу с помощью mget для производительности
        const historyValues = await redis.mget(...historyKeys);
        
        // Интерфейс для хранения историй с заглушками
        const histories: Map<string, HistoryPoint[]> = new Map();
        
        // Сегодняшняя дата для заглушек
        const today = new Date().toISOString().split('T')[0];
        
        // Обрабатываем полученные истории
        for (let i = 0; i < symbols.length; i++) {
          const symbol = symbols[i];
          const historyData = historyValues[i];
          
          if (historyData) {
            // Парсим JSON если есть история
            const history = typeof historyData === 'string' 
              ? JSON.parse(historyData) 
              : historyData;
            
            // Сортируем историю по дате для LOCF
            const sortedHistory = history.sort((a: HistoryPoint, b: HistoryPoint) => 
              a.date.localeCompare(b.date)
            );
            
            histories.set(symbol, sortedHistory);
          } else {
            // Если истории нет (например, для валют) - создаём заглушку с текущей ценой
            // Получаем текущую котировку из Redis
            const quote = await redis.get(`quote:${symbol}`);
            
            if (quote) {
              const quoteData = typeof quote === 'string' 
                ? JSON.parse(quote) 
                : quote;
              
              // Создаём заглушку с одной точкой - сегодняшняя дата и текущая цена
              const stubHistory: HistoryPoint[] = [{
                date: today,
                close: quoteData.price || 0
              }];
              
              histories.set(symbol, stubHistory);
            }
          }
        }

        // Если нет ни одной истории (даже с заглушками) - возвращаем пустой массив
        if (histories.size === 0) {
          return [];
        }

        // Создаём общий набор дат (объединение всех дат из всех позиций)
        const allDates = new Set<string>();
        for (const history of histories.values()) {
          for (const point of history) {
            allDates.add(point.date);
          }
        }

        // Преобразуем Set в массив и сортируем по дате
        const sortedDates = Array.from(allDates).sort();

        // Фильтруем даты по заданному периоду
        const filteredDates = sortedDates.filter(
          date => date >= args.startDate && date <= args.endDate
        );

        // Для каждой даты вычисляем totalValue портфеля
        const snapshots: Array<{ date: string; totalValue: number }> = [];

        // Вычисляем общую сумму инвестиций (buyPrice * quantity) для всех позиций
        const totalInvested = parent.items.reduce((sum: number, item: any) => {
          return sum + (item.buyPrice * item.quantity);
        }, 0);

        // Если есть даты и первая дата раньше даты начала периода,
        // добавляем точку с totalInvested на дату начала
        if (sortedDates.length > 0 && sortedDates[0] > args.startDate) {
          snapshots.push({
            date: args.startDate,
            totalValue: totalInvested
          });
        }

        for (const date of filteredDates) {
          let totalValue = 0;

          // Для каждой позиции находим цену на эту дату (LOCF)
          for (const item of parent.items) {
            const symbol = item.etf.symbol;
            const history = histories.get(symbol);
            
            if (history && history.length > 0) {
              // Ищем точку с нужной датой
              const point = history.find(p => p.date === date);
              
              if (point) {
                // Если нашли точку - используем её цену
                totalValue += point.close * item.quantity;
              } else {
                // Если не нашли - используем LOCF (Last Observation Carried Forward)
                // Берём последнюю точку до этой даты
                const previousPoint = history
                  .filter(p => p.date < date)
                  .pop();
                
                if (previousPoint) {
                  totalValue += previousPoint.close * item.quantity;
                }
                // Если нет предыдущей цены - пропускаем эту позицию для этой даты
              }
            }
          }

          // Добавляем снапшот
          snapshots.push({
            date,
            totalValue
          });
        }

        return snapshots;
      } catch (error) {
        console.error('Ошибка при загрузке истории портфеля:', error);
        return [];
      }
    }
  }
};

// Создаем Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

// Функция для создания контекста - извлекает userId из токена
async function createContext(request: NextRequest) {
  // Получаем заголовок Authorization из запроса
  const authHeader = request.headers.get('authorization');
  
  let userId: string | null = null;
  
  // Если заголовок есть и начинается с "Bearer "
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      // Извлекаем токен (убираем "Bearer " префикс)
      const token = authHeader.substring(7);
      
      // Получаем секретный ключ для JWT из переменной окружения
      const jwtSecret = process.env.JWT_SECRET || 'default-secret-change-in-production';
      
      // Проверяем токен и извлекаем payload
      const decoded = jwt.verify(token, jwtSecret) as { userId: string };
      
      // Сохраняем userId из токена
      userId = decoded.userId;
    } catch (error) {
      // Если токен невалидный - userId остаётся null
      console.error('Ошибка при проверке токена:', error);
    }
  }
  
  // Возвращаем контекст с userId (может быть null, если токена нет или он невалиден)
  return { userId };
}

// Обработчик для Next.js 16 App Router
async function handleRequest(request: NextRequest) {
  // Получаем тело запроса
  const body = await request.json();
  
  // Проверяем, что запрос содержит query
  if (!body || !body.query) {
    return new Response(JSON.stringify({ errors: [{ message: 'Query is required' }] }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  
  // Создаём контекст с userId из токена
  const context = await createContext(request);
  
  // Выполняем GraphQL запрос через Apollo Server с контекстом
  const response = await server.executeOperation({
    query: body.query,
    variables: body.variables,
    operationName: body.operationName,
  }, { contextValue: context });
  
  // Проверяем на ошибки
  if (response.body.kind === 'single') {
    const result = await response.body.singleResult;
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  
  // Если ответ в другом формате
  return new Response(JSON.stringify({ errors: [{ message: 'Invalid response format' }] }), {
    status: 500,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// Экспортируем обработчики для GET и POST запросов
export { handleRequest as GET, handleRequest as POST };
