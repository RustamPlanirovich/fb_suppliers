import { redis } from '../../utils/redis.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import { CACHE_TTL, REDIS_KEYS, IMPORT_COLUMNS } from '../../utils/constants.js';
import { normalizePhone, normalizeTelegram, normalizeDomain } from '../../utils/text.js';
import { ImportRowsApplier } from './import.rows.applier.js';

const PREVIEW_ROWS = 20;

// Импорт в три шага: загрузка с предпросмотром → сопоставление колонок → применение.
export class ImportService {
  #repo;
  #parser;
  #applier;

  constructor(repo, parser, deps) {
    this.#repo = repo;
    this.#parser = parser;
    this.#applier = new ImportRowsApplier(deps);
  }

  async preview({ buffer, filename, target, adminId }) {
    const { headers, rows } = await this.#parser.parse(buffer, filename);
    const job = await this.#repo.create({ adminId, filename, target, rowsTotal: rows.length });
    await redis.set(REDIS_KEYS.importPreview(job.id), JSON.stringify({ headers, rows }),
      'EX', CACHE_TTL.LONG);
    return {
      job,
      headers,
      columns: IMPORT_COLUMNS[target],
      suggestion: this.#suggestMapping(headers, target),
      sample: rows.slice(0, PREVIEW_ROWS),
      duplicates: await this.#applier.findDuplicates(target, this.#map(rows,
        this.#suggestMapping(headers, target), headers)),
    };
  }

  // Автоподсказка сопоставления: совпадение по имени колонки без учёта регистра.
  #suggestMapping(headers, target) {
    const mapping = {};
    for (const column of IMPORT_COLUMNS[target]) {
      const index = headers.findIndex((header) =>
        header.toLowerCase().replace(/\s+/g, '_') === column);
      if (index >= 0) mapping[column] = index;
    }
    return mapping;
  }

  async apply(jobId, mapping, adminId) {
    const job = await this.#repo.findById(jobId);
    if (!job) throw new NotFoundError('Задание импорта не найдено');
    if (job.status !== 'preview') throw new ValidationError('Задание уже обработано');

    const raw = await redis.get(REDIS_KEYS.importPreview(jobId));
    if (!raw) throw new ValidationError('Предпросмотр истёк — загрузите файл заново');
    const { headers, rows } = JSON.parse(raw);

    await this.#repo.saveMapping(jobId, mapping);
    try {
      const result = await this.#applier.apply(job.target, this.#map(rows, mapping, headers), adminId);
      await redis.del(REDIS_KEYS.importPreview(jobId));
      return this.#repo.finish(jobId, { status: 'applied', ...result });
    } catch (err) {
      await this.#repo.finish(jobId, { status: 'failed', error: err.message });
      throw err;
    }
  }

  // Строки таблицы → объекты по сопоставлению колонок, с нормализацией контактов.
  #map(rows, mapping, headers) {
    return rows.map((row) => {
      const item = {};
      for (const [column, index] of Object.entries(mapping)) {
        const value = String(row[Number(index)] ?? '').trim();
        if (value !== '') item[column] = value;
      }
      if (item.phone) item.phone = normalizePhone(item.phone);
      if (item.telegram) item.telegram = normalizeTelegram(item.telegram);
      if (item.website) item.website = normalizeDomain(item.website);
      if (item.email) item.email = item.email.toLowerCase();
      item.__headers = headers.length;
      return item;
    });
  }

  async list(limit = 50) {
    return this.#repo.list(limit);
  }
}
