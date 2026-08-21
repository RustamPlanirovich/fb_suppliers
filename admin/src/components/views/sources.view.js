import { api } from '../../utils/api.js';
import { el } from '../../utils/dom.js';
import { dateTime, num } from '../../utils/format.js';
import { View } from './view.base.js';
import { SyncWizard } from './sources/sync.wizard.js';

// Источники цен: разделы площадки, из которых наполняются товары, цены и карточки продавцов.
export class SourcesView extends View {
  #wizard;

  constructor(deps) {
    super(deps);
    this.#wizard = new SyncWizard(this);
  }

  async mount() {
    const wizardCard = this.card('Загрузка раздела площадки');
    wizardCard.querySelector('.card__body').append(this.#wizard.element);

    const savedCard = this.card('Разделы на регулярной синхронизации', [
      { title: 'Обновить список', onClick: () => this.reload() },
    ]);
    this.root.replaceChildren(wizardCard, savedCard);
    await this.#wizard.init();
    await this.reload();
  }

  async reload() {
    const sources = await this.guard(() => api.get('/sources/saved/list'));
    if (!sources) return;
    const body = this.root.querySelectorAll('.card__body')[1];
    body.replaceChildren(...(sources.length
      ? sources.map((source) => this.#sourceRow(source))
      : [el('p', 'empty', 'Пока ничего не сохранено. Загрузите раздел выше и нажмите «Сохранить раздел».')]));
  }

  #sourceRow(source) {
    const box = el('div', 'card');
    const title = `${source.game_name ?? ''} · ${source.node_name ?? ''}`.trim();
    box.append(el('p', 'card__title',
      `${source.marketplace_code}: ${title} (раздел ${source.node_id})`));
    const result = source.last_result ?? {};
    box.append(el('p', 'page__hint',
      `Обновлён: ${dateTime(source.last_synced_at)} · предложений ${num(result.offers)}`
      + ` · вариантов ${num(result.variants)} · карточек создано ${num(result.suppliersCreated)}`));
    if (!source.is_active) box.append(this.badge('выключен', 'danger'));

    const actions = el('div', 'card__actions');
    actions.append(
      this.#button('Обновить сейчас', () => this.#sync(source.id)),
      this.#button(source.is_active ? 'Выключить' : 'Включить',
        () => this.#toggle(source.id, !source.is_active)),
      this.#button('Удалить', () => this.#remove(source.id)),
    );
    box.append(actions);
    return box;
  }

  #button(title, onClick) {
    const button = el('button', 'button button_small', title);
    button.type = 'button';
    button.addEventListener('click', onClick);
    return button;
  }

  async #sync(id) {
    this.toast.show('Обновляю раздел, это занимает несколько секунд…');
    const result = await this.guard(() => api.post(`/sources/saved/${id}/sync`, {}, { timeout: 600_000 }));
    if (!result) return;
    this.toast.success(
      `Готово: предложений ${result.offers}, вариантов ${result.variants},`
      + ` создано карточек ${result.suppliersCreated}, обновлено цен ${result.offersUpdated}`);
    await this.reload();
  }

  async #toggle(id, isActive) {
    await this.guard(async () => {
      await api.post(`/sources/saved/${id}/active`, { isActive });
      await this.reload();
    });
  }

  async #remove(id) {
    if (!confirm('Убрать раздел из регулярной синхронизации?')) return;
    await this.guard(async () => {
      await api.delete(`/sources/saved/${id}`);
      this.toast.success('Раздел удалён');
      await this.reload();
    });
  }
}
