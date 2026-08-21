import { api } from '../../../utils/api.js';

const SOURCE_LABELS = { auto: 'авто', manual: 'вручную', query: 'из запроса' };

// Синонимы товара: по ним пользователь находит его, как бы он ни написал название.
export class AliasesEditor {
  #view;

  constructor(view) {
    this.#view = view;
  }

  async open(product) {
    const aliases = await this.#view.guard(() => api.get(`/catalog/products/${product.id}/aliases`));
    if (!aliases) return;
    const data = await this.#view.modal.open({
      title: `Синонимы: ${product.name}`,
      submitText: 'Добавить',
      fields: [
        {
          name: '__list',
          label: 'Уже есть',
          type: 'textarea',
          value: aliases.map((row) => `${row.alias} (${SOURCE_LABELS[row.source] ?? row.source})`)
            .join('\n') || 'Пока только автоматические',
        },
        {
          name: 'alias',
          label: 'Новый синоним',
          hint: 'Например: ютуб, ют, чатгпт. Регистр, пробелы и опечатки учитывать не нужно',
        },
        {
          name: 'remove',
          label: 'Удалить синоним (точное написание)',
          hint: 'Автоматические удалить нельзя — они пересобираются из названия',
        },
      ],
    });
    if (!data) return;
    await this.#apply(product, aliases, data);
  }

  async #apply(product, aliases, data) {
    await this.#view.guard(async () => {
      if (data.alias) {
        await api.post(`/catalog/products/${product.id}/aliases`, { alias: data.alias });
      }
      if (data.remove) {
        const found = aliases.find((row) => row.alias === data.remove.trim().toLowerCase());
        if (!found) throw new Error('Синоним не найден — скопируйте написание из списка');
        await api.delete(`/catalog/aliases/${found.id}`);
      }
      if (data.alias || data.remove) this.#view.toast.success('Синонимы обновлены');
    });
  }
}
