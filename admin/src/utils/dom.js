// Создание узлов без innerHTML: только createElement и textContent.
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

export function clone(templateId) {
  const template = document.getElementById(templateId);
  if (!template) throw new Error(`Не найден шаблон #${templateId}`);
  return template.content.cloneNode(true);
}

// Пары «подпись → значение» в один контейнер: используется в карточках и формах.
export function fillFields(root, fields) {
  for (const [selector, value] of Object.entries(fields)) {
    const node = root.querySelector(selector);
    if (node) node.textContent = value ?? '—';
  }
  return root;
}

export function emit(target, name, detail) {
  target.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
}

export function option(value, text, selected) {
  const node = el('option', null, text);
  node.value = value;
  if (selected) node.selected = true;
  return node;
}
