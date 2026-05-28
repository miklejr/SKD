// lib/upstash.ts
// Этот файл создаёт и экспортирует клиент Upstash Redis
// Upstash Redis - это облачная база данных Redis, которая работает через REST API
// Нам не нужен Docker - всё работает в облаке

import { Redis } from '@upstash/redis';

// Получаем URL и токен Upstash Redis из переменных окружения
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Проверяем, что переменные заданы
if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN должны быть заданы в .env.local');
}

// Создаём экземпляр клиента Upstash Redis
// Этот клиент будет использоваться для сохранения и получения котировок
export const redis = new Redis({
  url: UPSTASH_REDIS_REST_URL,
  token: UPSTASH_REDIS_REST_TOKEN,
});

// Экспортируем клиент для использования в других файлах
export default redis;
