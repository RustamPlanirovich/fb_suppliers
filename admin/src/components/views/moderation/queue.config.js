// Описание колонок и допустимых статусов для каждой очереди модерации.
export const QUEUE_COLUMNS = {
  complaints: [
    { title: 'Поставщик', key: 'supplier_name' },
    { title: 'Причина', key: 'reason' },
    { title: 'Текст', key: 'text' },
    { title: 'От кого', key: 'user' },
    { title: 'Статус', key: 'status' },
    { title: 'Создано', key: 'created_at' },
  ],
  reviews: [
    { title: 'Поставщик', key: 'supplier_name' },
    { title: 'Оценка', key: 'rating' },
    { title: 'Текст', key: 'text' },
    { title: 'От кого', key: 'user' },
    { title: 'Статус', key: 'status' },
    { title: 'Создано', key: 'created_at' },
  ],
  submissions: [
    { title: 'Тип', key: 'type' },
    { title: 'Поставщик', key: 'supplier_name' },
    { title: 'Данные', key: 'payload' },
    { title: 'Источник', key: 'evidence' },
    { title: 'От кого', key: 'user' },
    { title: 'Статус', key: 'status' },
    { title: 'Создано', key: 'created_at' },
  ],
  deals: [
    { title: 'Поставщик', key: 'supplier_name' },
    { title: 'Цена', key: 'price' },
    { title: 'Кол-во', key: 'qty' },
    { title: 'Проблемная', key: 'is_problem' },
    { title: 'От кого', key: 'user' },
    { title: 'Статус', key: 'status' },
    { title: 'Создано', key: 'created_at' },
  ],
};

export const QUEUE_STATUSES = {
  complaints: ['in_progress', 'resolved', 'rejected'],
  reviews: ['approved', 'rejected'],
  submissions: ['approved', 'rejected'],
  deals: ['approved', 'rejected'],
};
