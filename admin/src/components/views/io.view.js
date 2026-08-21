import { api } from '../../utils/api.js';
import { el } from '../../utils/dom.js';
import { View } from './view.base.js';
import { ImportWizard } from './io/import.wizard.js';

const EXPORTS = [
  { target: 'suppliers', title: 'Поставщики' },
  { target: 'offers', title: 'Предложения' },
  { target: 'arbitrage', title: 'Связки' },
];

// Импорт Excel/CSV с предпросмотром и сопоставлением колонок + выгрузки.
export class IoView extends View {
  #wizard;

  constructor(deps) {
    super(deps);
    this.#wizard = new ImportWizard(this);
  }

  async mount() {
    const importCard = this.card('Импорт Excel / CSV');
    importCard.querySelector('.card__body').append(this.#wizard.element);

    const exportCard = this.card('Выгрузки');
    const box = el('div', 'card__actions');
    for (const item of EXPORTS) {
      for (const format of ['xlsx', 'csv']) {
        const button = el('button', 'button', `${item.title} · ${format.toUpperCase()}`);
        button.type = 'button';
        button.addEventListener('click', () =>
          window.open(api.downloadUrl(`/io/exports/${item.target}`, { format }), '_blank'));
        box.append(button);
      }
    }
    exportCard.querySelector('.card__body').append(box);

    const historyCard = this.card('История импортов');
    this.root.replaceChildren(importCard, exportCard, historyCard);
    this.#wizard.init();
    await this.#loadHistory(historyCard);
  }

  async #loadHistory(card) {
    const jobs = await this.guard(() => api.get('/io/imports'));
    if (!jobs) return;
    card.querySelector('.card__body').replaceChildren(...(jobs.length
      ? jobs.map((job) => el('p', null,
        `${new Date(job.created_at).toLocaleString('ru-RU')} · ${job.filename} · ${job.status}`
        + ` · создано ${job.rows_created}, обновлено ${job.rows_updated}, пропущено ${job.rows_skipped}`))
      : [el('p', 'empty', 'Импортов пока не было')]));
  }
}
