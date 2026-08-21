// Валидация входа zod-схемой на границе HTTP. Невалидно — ValidationError (400) до вызова сервиса.
import { ValidationError } from './errors.js';

export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join('; ');
    throw new ValidationError(message);
  }
  return result.data;
}
