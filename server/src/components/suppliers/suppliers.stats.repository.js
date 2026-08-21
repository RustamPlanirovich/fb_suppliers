import { query } from '../../utils/db.js';

// Пересчёт агрегатов карточки: отзывы, жалобы, сделки, офферы, надёжность.
export class SuppliersStatsRepository {
  async refresh(supplierId) {
    const { rows } = await query(
      `UPDATE suppliers s SET
         reviews_count       = r.cnt,
         rating              = r.avg_rating,
         score_response      = r.avg_response,
         score_delivery      = r.avg_delivery,
         score_accuracy      = r.avg_accuracy,
         complaints_count    = cm.cnt,
         confirmed_deals     = d.total,
         confirmed_deals_30d = d.last30,
         problem_rate        = CASE WHEN d.total > 0
                                 THEN round(d.problems::numeric * 100 / d.total, 2) ELSE 0 END,
         offers_count        = o.cnt,
         score_reliability   = round((
             coalesce(r.avg_rating, 3)
             - least(2, cm.cnt::numeric * 0.2)
             + least(1, d.last30::numeric * 0.05)
           )::numeric, 2)
       FROM
         (SELECT count(*)::int AS cnt,
                 round(avg(rating)::numeric, 2) AS avg_rating,
                 round(avg(score_response)::numeric, 2) AS avg_response,
                 round(avg(score_delivery)::numeric, 2) AS avg_delivery,
                 round(avg(score_accuracy)::numeric, 2) AS avg_accuracy
          FROM reviews WHERE supplier_id = $1 AND status = 'approved') r,
         (SELECT count(*)::int AS cnt FROM complaints
          WHERE supplier_id = $1 AND status IN ('new', 'in_progress', 'resolved')) cm,
         (SELECT count(*)::int AS total,
                 count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS last30,
                 count(*) FILTER (WHERE is_problem)::int AS problems
          FROM deal_confirmations WHERE supplier_id = $1 AND status = 'approved') d,
         (SELECT count(*)::int AS cnt FROM offers WHERE supplier_id = $1 AND is_active) o
       WHERE s.id = $1
       RETURNING s.id, s.rating, s.score_reliability, s.confirmed_deals_30d, s.complaints_count`,
      [supplierId],
    );
    return rows[0] ?? null;
  }

  async refreshMany(supplierIds) {
    const results = [];
    for (const id of supplierIds) results.push(await this.refresh(id));
    return results.filter(Boolean);
  }
}
