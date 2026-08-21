import { z } from 'zod';
import { PRICE_SOURCES } from '../../utils/constants.js';

const optionalText = (max) => z.string().trim().max(max).optional().nullable();

export const idParam = z.object({ id: z.coerce.number().int().positive() });

export const productListSchema = z.object({
  q: optionalText(200),
  categoryId: z.coerce.number().int().positive().optional(),
  isActive: z.preprocess((v) => (v === undefined ? undefined : v === 'true' || v === true),
    z.boolean().optional()),
  marginMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
  hasOffers: z.preprocess((v) => v === 'true' || v === true, z.boolean().optional()),
  sort: z.enum(['name', 'margin', 'offers', 'suppliers', 'price', 'demand', 'variants']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const productSchema = z.object({
  name: z.string().trim().min(2).max(200),
  categoryId: z.coerce.number().int().positive().optional().nullable(),
  description: optionalText(4000),
});

export const productUpdateSchema = productSchema.partial().extend({
  isActive: z.boolean().optional(),
  evidence: optionalText(500),
});

export const variantListSchema = productListSchema.extend({
  productId: z.coerce.number().int().positive().optional(),
  marginMin: z.coerce.number().optional(),
  competition: z.enum(['low', 'medium', 'high']).optional(),
  priceMax: z.coerce.number().optional(),
  hasOffers: z.preprocess((v) => v === 'true' || v === true, z.boolean().optional()),
  sort: z.enum(['margin', 'demand', 'price', 'trend', 'name', 'suppliers']).optional(),
});

export const variantSchema = z.object({
  productId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  attrs: z.record(z.string(), z.any()).optional(),
});

export const variantUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  attrs: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().optional(),
  evidence: optionalText(500),
});

export const offerListSchema = z.object({
  q: optionalText(200),
  variantId: z.coerce.number().int().positive().optional(),
  supplierId: z.coerce.number().int().positive().optional(),
  priceMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
  staleDays: z.coerce.number().int().positive().max(365).optional(),
  isActive: z.preprocess((v) => (v === undefined ? undefined : v === 'true' || v === true),
    z.boolean().optional()),
  sort: z.enum(['price', 'reliability', 'deals', 'fresh', 'updated']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const offerSchema = z.object({
  variantId: z.coerce.number().int().positive(),
  supplierId: z.coerce.number().int().positive(),
  title: optionalText(300),
  price: z.coerce.number().nonnegative().optional().nullable(),
  currency: z.string().trim().length(3).optional(),
  minQty: z.coerce.number().int().positive().optional(),
  stock: z.coerce.number().int().min(0).optional().nullable(),
  url: optionalText(500),
  externalId: optionalText(120),
  isActive: z.boolean().optional(),
  source: z.enum(PRICE_SOURCES).optional(),
  evidence: optionalText(500),
});

export const offerUpdateSchema = offerSchema.partial().omit({ variantId: true, supplierId: true });

export const priceSchema = z.object({
  price: z.coerce.number().nonnegative(),
  source: z.enum(PRICE_SOURCES).optional(),
  evidence: z.string().trim().max(500).optional(),
});

export const marketSnapshotSchema = z.object({
  variantId: z.coerce.number().int().positive(),
  marketplaceId: z.coerce.number().int().positive(),
  priceMin: z.coerce.number().optional(),
  priceAvg: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
  priceMedian: z.coerce.number().optional(),
  sellersCount: z.coerce.number().int().min(0).optional(),
  salesCount: z.coerce.number().int().min(0).optional(),
  sourceUrl: optionalText(500),
});

export const marketplaceSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  commissionPct: z.coerce.number().min(0).max(100).optional(),
  payoutFee: z.coerce.number().min(0).optional(),
  url: optionalText(300),
  isActive: z.boolean().optional(),
});
