// Белый список очередей модерации: имя очереди → таблица и колонки для выборки.
// Имена таблиц берутся ТОЛЬКО отсюда, из запроса они прийти не могут.
export const QUEUES = {
  reviews: {
    table: 'reviews',
    statuses: ['pending', 'approved', 'rejected'],
    defaultStatus: 'pending',
    select: `r.id, r.supplier_id, r.user_id, r.rating, r.score_response, r.score_delivery,
             r.score_accuracy, r.text, r.status, r.resolution, r.resolved_at, r.created_at`,
  },
  complaints: {
    table: 'complaints',
    statuses: ['new', 'in_progress', 'resolved', 'rejected'],
    defaultStatus: 'new',
    select: `r.id, r.supplier_id, r.offer_id, r.user_id, r.reason, r.text, r.status,
             r.resolution, r.resolved_at, r.created_at`,
  },
  deals: {
    table: 'deal_confirmations',
    statuses: ['pending', 'approved', 'rejected'],
    defaultStatus: 'pending',
    select: `r.id, r.supplier_id, r.offer_id, r.user_id, r.price, r.qty, r.is_problem,
             r.status, r.resolved_at, r.created_at`,
  },
  submissions: {
    table: 'submissions',
    statuses: ['new', 'approved', 'rejected'],
    defaultStatus: 'new',
    select: `r.id, r.supplier_id, r.offer_id, r.variant_id, r.user_id, r.type, r.payload,
             r.evidence, r.status, r.resolution, r.resolved_at, r.created_at`,
  },
};

export const QUEUE_NAMES = Object.keys(QUEUES);
