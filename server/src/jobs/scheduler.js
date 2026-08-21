import { logger } from '../utils/logger.js';
import { JOB_SCHEDULE, JOB_START_DELAY_MS } from './schedule.js';

const log = logger.child({ component: 'scheduler' });

// Периодические задачи процесса. Одна задача — один метод в jobs, здесь только запуск.
export class Scheduler {
  #jobs;
  #timers = [];

  constructor(jobs) {
    this.#jobs = jobs;
  }

  start() {
    setTimeout(() => {
      for (const [name, minutes] of Object.entries(JOB_SCHEDULE)) {
        const handler = this.#jobs[name];
        if (!handler) continue;
        this.#timers.push(setInterval(() => this.#run(name, handler), minutes * 60_000));
        this.#run(name, handler);
      }
      log.info('Планировщик запущен', { jobs: Object.keys(JOB_SCHEDULE) });
    }, JOB_START_DELAY_MS).unref();
  }

  stop() {
    this.#timers.forEach((timer) => clearInterval(timer));
    this.#timers = [];
  }

  async #run(name, handler) {
    try {
      const result = await handler();
      log.debug('Задача выполнена', { job: name, result });
    } catch (err) {
      log.error('Задача упала', { job: name, err: err.message });
    }
  }
}
