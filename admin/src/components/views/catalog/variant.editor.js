import { api } from '../../../utils/api.js';

// Создание товара и варианта, правка варианта.
export class VariantEditor {
  #view;

  constructor(view) {
    this.#view = view;
  }

  async createProduct() {
    const data = await this.#view.modal.open({
      title: 'Новый товар',
      fields: [
        { name: 'name', label: 'Название', required: true },
        { name: 'description', label: 'Описание', type: 'textarea' },
      ],
    });
    if (!data) return;
    await this.#view.guard(async () => {
      await api.post('/catalog/products', { name: data.name, description: data.description || null });
      this.#view.toast.success('Товар создан');
      await this.#view.reload();
    });
  }

  async createVariant() {
    const products = await this.#view.guard(() => api.get('/catalog/products', { limit: 200 }));
    if (!products) return;
    const data = await this.#view.modal.open({
      title: 'Новый вариант',
      fields: [
        {
          name: 'productId',
          label: 'Товар',
          type: 'select',
          options: products.items.map((item) => ({ value: item.id, label: item.name })),
        },
        { name: 'name', label: 'Название варианта', required: true, hint: 'Например: 12 месяцев' },
      ],
    });
    if (!data) return;
    await this.#view.guard(async () => {
      await api.post('/catalog/variants', { productId: Number(data.productId), name: data.name });
      this.#view.toast.success('Вариант создан');
      await this.#view.reload();
    });
  }

  async editVariant(id) {
    const variant = await this.#view.guard(() => api.get(`/catalog/variants/${id}`));
    if (!variant) return;
    const data = await this.#view.modal.open({
      title: `${variant.product_name} — ${variant.name}`,
      fields: [
        { name: 'name', label: 'Название варианта', value: variant.name, required: true },
        { name: 'isActive', label: 'Активен', type: 'checkbox', value: variant.is_active },
        { name: 'evidence', label: 'Откуда информация', value: '' },
      ],
    });
    if (!data) return;
    await this.#view.guard(async () => {
      await api.patch(`/catalog/variants/${id}`,
        { name: data.name, isActive: Boolean(data.isActive), evidence: data.evidence || null });
      this.#view.toast.success('Вариант обновлён');
      await this.#view.reload();
    });
  }
}
