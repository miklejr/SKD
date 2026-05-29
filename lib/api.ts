// lib/api.ts
// Хелпер для выполнения GraphQL запросов с автоматическим добавлением токена авторизации

// Интерфейс для ответа GraphQL
interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
  }>;
}

/**
 * Выполняет GraphQL запрос к API
 * Автоматически добавляет заголовок Authorization с токеном из localStorage
 * 
 * @param query - GraphQL запрос или мутация
 * @param variables - переменные для запроса (опционально)
 * @returns Promise с ответом GraphQL
 */
export async function fetchGraphQL<T = any>(
  query: string,
  variables?: Record<string, any>
): Promise<GraphQLResponse<T>> {
  // Получаем токен из localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  
  // Формируем заголовки
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  // Если токен есть - добавляем заголовок Authorization
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    // Выполняем запрос к GraphQL API
    const response = await fetch('/api/graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        variables,
      }),
    });
    
    // Парсим ответ
    const result = await response.json();
    
    return result;
  } catch (error) {
    console.error('Ошибка при выполнении GraphQL запроса:', error);
    return {
      errors: [{ message: 'Не удалось выполнить запрос' }],
    };
  }
}
