// История изменений: кто, когда и что поменял. Пишется из сервисов после успешной операции.
import { query } from './db.js';
import { logger } from './logger.js';

const log = logger.child({ component: 'audit' });

export async function writeAudit({ adminId, entity, entityId, action, changes = {}, comment = null }) {
  try {
    await query(
      `INSERT INTO audit_log (admin_id, entity, entity_id, action, changes, comment)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [adminId, entity, entityId, action, JSON.stringify(changes), comment],
    );
  } catch (err) {
    // Провал журналирования не должен ломать бизнес-операцию.
    log.error('Не удалось записать в audit_log', { entity, action, err: err.message });
  }
}

// Разница между старой и новой версией записи — только по реально изменённым полям.
export function diff(before, after, fields) {
  const changes = {};
  for (const field of fields) {
    if (!(field in after)) continue;
    const from = before?.[field] ?? null;
    const to = after[field] ?? null;
    if (String(from) !== String(to)) changes[field] = { from, to };
  }
  return changes;
}
