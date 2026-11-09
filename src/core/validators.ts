import { z } from 'zod';

export const projectInfoSchema = z.object({
  name: z.string().min(2),
  district: z.string().min(1),
  use: z.string().min(1)
});

export const plotSchema = z.object({
  officialArea: z.number().positive(),
  length: z.number().positive().optional(),
  width: z.number().positive().optional()
});

export const financialSchema = z.object({
  landPrice: z.number().min(0),
  structuralRate: z.number().min(0),
  finishingRate: z.number().min(0),
  mepRate: z.number().min(0),
  sellingPriceResidential: z.number().min(0)
});
