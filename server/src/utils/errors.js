// Иерархия операционных ошибок. Сервисы бросают их, центральный error-middleware превращает в ответ.
export class AppError extends Error {
  constructor(message, { status = 500, code = 'INTERNAL' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.isOperational = true;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Некорректные данные') {
    super(message, { status: 400, code: 'VALIDATION' });
  }
}

export class AuthError extends AppError {
  constructor(message = 'Не авторизован') {
    super(message, { status: 401, code: 'UNAUTHORIZED' });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Не найдено') {
    super(message, { status: 404, code: 'NOT_FOUND' });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Запись с такими данными уже существует') {
    super(message, { status: 409, code: 'CONFLICT' });
  }
}

// Ошибки целостности PostgreSQL наружу должны выглядеть как понятные 4xx, а не как 500.
const PG_ERRORS = {
  23505: () => new ConflictError(),
  23503: () => new ValidationError('Связанная запись не найдена'),
  23514: () => new ValidationError('Значение не проходит проверку базы данных'),
};

export function fromDbError(err) {
  return PG_ERRORS[err?.code]?.() ?? null;
}
