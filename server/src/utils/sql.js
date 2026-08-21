// Помощник для сборки параметризованного SQL. Значения НИКОГДА не попадают в текст запроса —
// только в массив params, в текст идут плейсхолдеры $1, $2, ...
export class SqlBuilder {
  #conditions = [];
  #params = [];

  // Добавляет условие с плейсхолдерами: where('price >= ?', 100) → 'price >= $1'
  where(template, ...values) {
    let index = 0;
    const sql = template.replace(/\?/g, () => {
      this.#params.push(values[index]);
      index += 1;
      return `$${this.#params.length}`;
    });
    this.#conditions.push(sql);
    return this;
  }

  // Условие добавляется, только если значение задано.
  whereIf(value, template, ...values) {
    const skip = value === undefined || value === null || value === '';
    if (!skip) this.where(template, ...(values.length ? values : [value]));
    return this;
  }

  // Регистрирует значение отдельно (для LIMIT/OFFSET) и возвращает его плейсхолдер.
  param(value) {
    this.#params.push(value);
    return `$${this.#params.length}`;
  }

  get clause() {
    return this.#conditions.length ? `WHERE ${this.#conditions.join(' AND ')}` : '';
  }

  get params() {
    return this.#params;
  }
}

// Белый список колонок для ORDER BY: имя сортировки → безопасный SQL-фрагмент.
export function orderBy(map, key, fallback) {
  return map[key] ?? map[fallback];
}
