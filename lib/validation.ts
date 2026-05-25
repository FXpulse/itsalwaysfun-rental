// Centralized Zod schemas for input validation.
import { z } from "zod";

export const ProductInputSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, numbers, hyphens only"),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().min(1, "Category is required").max(100),
  price_per_day: z
    .number()
    .int("Price must be in whole cents")
    .min(0, "Price cannot be negative")
    .max(10_000_00, "Price too high"),
  stock: z.number().int().min(0).max(100),
  image_url: z.string().url().or(z.literal("")).optional().nullable(),
  ghl_listing_id: z.string().max(100).optional().nullable(),
  is_active: z.boolean(),
  setup_area: z.string().max(100).optional().nullable(),
  actual_size: z.string().max(100).optional().nullable(),
  outlets_required: z.number().int().min(0).max(10).optional(),
  age_group: z.string().max(100).optional().nullable(),
  is_addon: z.boolean().optional(),
  cost_cents: z.number().int().min(0).optional(),
  weekend_price_per_day: z.number().int().min(0).nullable().optional(),
});

export type ProductInput = z.infer<typeof ProductInputSchema>;

export const BookingInputSchema = z.object({
  product_id: z.string().uuid(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().nullable(),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().nullable(),
  customer_first_name: z.string().min(1).max(100),
  customer_last_name: z.string().min(1).max(100),
  customer_email: z.string().email(),
  customer_phone: z.string().max(40).optional().nullable(),
  customer_address: z.string().max(500).optional().nullable(),
});

export const BlockDateInputSchema = z.object({
  product_id: z.string().uuid(),
  blocked_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).optional().nullable(),
});
