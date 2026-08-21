// Поля карточки поставщика, редактируемые админкой; они же попадают в историю изменений.
export const EDITABLE_FIELDS = [
  'category_id', 'name', 'description', 'external_url', 'external_id', 'telegram', 'phone',
  'email', 'website', 'contacts_extra', 'score_reliability', 'score_response', 'score_delivery',
  'score_accuracy', 'quality_score', 'quality_note', 'sales_count', 'status', 'is_hidden',
];

// Контактные поля: у источников-площадок они запрещены (см. миграцию 003).
export const CONTACT_FIELDS = ['telegram', 'phone', 'email', 'contacts_extra'];

export const SUPPLIER_COLUMNS = `
  s.id, s.category_id, s.name, s.description, s.source, s.external_url, s.external_id,
  s.source_rating, s.source_reviews_count, s.source_stats, s.source_synced_at,
  s.telegram, s.phone, s.email, s.website, s.contacts_extra,
  s.score_reliability, s.score_response, s.score_delivery, s.score_accuracy,
  s.quality_score, s.quality_note, s.reviews_count, s.rating, s.complaints_count,
  s.problem_rate, s.confirmed_deals, s.confirmed_deals_30d, s.offers_count, s.sales_count,
  s.first_seen_at, s.status, s.is_hidden, s.checked_at, s.checked_by, s.merged_into_id,
  s.created_at, s.updated_at
`;

export const SUPPLIER_RETURNING = SUPPLIER_COLUMNS.replaceAll('s.', '');
