import { z } from 'zod';
import {
  SUPPLIER_STATUSES, SUPPLIER_SOURCES, DUPLICATE_FIELDS, BULK_LIMIT,
} from '../../utils/constants.js';

const optionalText = (max) => z.string().trim().max(max).optional().nullable();
const csv = (schema) => z.preprocess(
  (value) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value),
  z.array(schema).optional(),
);

export const listQuerySchema = z.object({
  q: optionalText(200),
  status: csv(z.enum(SUPPLIER_STATUSES)),
  source: csv(z.enum(SUPPLIER_SOURCES)),
  categoryId: z.coerce.number().int().positive().optional(),
  tagIds: csv(z.coerce.number().int().positive()),
  qualityMin: z.coerce.number().int().min(1).max(5).optional(),
  reliabilityMin: z.coerce.number().min(0).max(5).optional(),
  variantId: z.coerce.number().int().positive().optional(),
  isHidden: z.preprocess((v) => (v === undefined ? undefined : v === 'true' || v === true), z.boolean().optional()),
  needsCheck: z.preprocess((v) => v === 'true' || v === true, z.boolean().optional()),
  staleCheckDays: z.coerce.number().int().min(1).max(365).optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  sort: z.enum(['created', 'name', 'reliability', 'reviews', 'quality', 'deals', 'complaints', 'checked'])
    .optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const createSchema = z.object({
  name: z.string().trim().min(2).max(200),
  source: z.enum(SUPPLIER_SOURCES).optional(),
  category_id: z.coerce.number().int().positive().optional().nullable(),
  description: optionalText(4000),
  external_url: optionalText(500),
  external_id: optionalText(120),
  telegram: optionalText(120),
  phone: optionalText(40),
  email: z.string().trim().email().max(200).optional().nullable(),
  website: optionalText(200),
  quality_score: z.coerce.number().int().min(1).max(5).optional().nullable(),
  quality_note: optionalText(1000),
  sales_count: z.coerce.number().int().min(0).optional().nullable(),
  status: z.enum(SUPPLIER_STATUSES).optional(),
  is_hidden: z.boolean().optional(),
  tagIds: z.array(z.coerce.number().int().positive()).optional(),
  evidence: optionalText(500),
});

export const updateSchema = createSchema.partial().extend({
  score_reliability: z.coerce.number().min(0).max(5).optional().nullable(),
  score_response: z.coerce.number().min(0).max(5).optional().nullable(),
  score_delivery: z.coerce.number().min(0).max(5).optional().nullable(),
  score_accuracy: z.coerce.number().min(0).max(5).optional().nullable(),
});

export const checkSchema = z.object({
  status: z.enum(SUPPLIER_STATUSES).optional(),
  comment: optionalText(500),
});

export const bulkSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(BULK_LIMIT),
  action: z.enum(['status', 'category', 'hide', 'show', 'assign_check', 'add_tags', 'delete']),
  value: z.any().optional(),
});

export const duplicatesSchema = z.object({
  fields: z.preprocess(
    (value) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value),
    z.array(z.enum(DUPLICATE_FIELDS)).optional(),
  ),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export const mergeSchema = z.object({
  targetId: z.coerce.number().int().positive(),
  sourceId: z.coerce.number().int().positive(),
});

export const idParam = z.object({ id: z.coerce.number().int().positive() });
