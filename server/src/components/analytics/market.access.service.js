import { PRESETS } from './opportunities.repository.js';

// Доступ бота к витрине «что выгодно»: те же условия, что и в админке.
export class MarketAccessService {
  #repo;

  constructor(repo) {
    this.#repo = repo;
  }

  async list(preset, limit) {
    const filters = PRESETS[preset] ?? PRESETS.sell;
    const { rows } = await this.#repo.list(filters, { limit, offset: 0 });
    return rows;
  }
}
