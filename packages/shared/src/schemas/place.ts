import { z } from "zod";
import { geoPointSchema } from "./location";

export const placeSchema = geoPointSchema.extend({
  id: z.string().uuid(),
  circleId: z.string().uuid(),
  name: z.string().min(1).max(60),
  radiusMeters: z.number().positive().max(5000),
  createdAt: z.coerce.date(),
});
export type Place = z.infer<typeof placeSchema>;

export const createPlaceInputSchema = geoPointSchema.extend({
  circleId: z.string().uuid(),
  name: z.string().min(1).max(60),
  radiusMeters: z.number().positive().max(5000).default(150),
});
export type CreatePlaceInput = z.infer<typeof createPlaceInputSchema>;
