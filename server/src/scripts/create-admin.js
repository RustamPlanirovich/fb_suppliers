// Создание первого администратора: npm run create-admin -- email "Имя" пароль
import { AuthRepository } from '../components/auth/auth.repository.js';
import { AuthService } from '../components/auth/auth.service.js';
import { pool } from '../utils/db.js';
import { redis } from '../utils/redis.js';
import { logger } from '../utils/logger.js';

const [email, name, password] = process.argv.slice(2);

if (!email || !name || !password) {
  logger.error('Использование: npm run create-admin -- email "Имя" пароль');
  process.exit(1);
}

const service = new AuthService(new AuthRepository());
try {
  const admin = await service.bootstrap({ email, name, password });
  logger.info('Администратор создан', { id: admin.id, email: admin.email, role: admin.role });
} catch (err) {
  logger.error('Не удалось создать администратора', { err: err.message });
  process.exitCode = 1;
} finally {
  await pool.end();
  redis.disconnect();
}
