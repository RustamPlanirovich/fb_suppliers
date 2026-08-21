// Хранит выделенные строки таблицы. Вынесено отдельно, чтобы таблица не разрасталась.
export class TableSelection {
  #ids = new Set();
  #enabled;

  constructor(enabled) {
    this.#enabled = enabled;
  }

  get enabled() {
    return this.#enabled;
  }

  get ids() {
    return [...this.#ids];
  }

  toggle(id, checked) {
    if (checked) this.#ids.add(String(id));
    else this.#ids.delete(String(id));
  }

  clear() {
    this.#ids.clear();
  }
}
