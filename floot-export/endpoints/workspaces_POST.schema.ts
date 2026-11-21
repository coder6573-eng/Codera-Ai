import { z } from "zod";
export const schema = z.object({ id: z.string().min(8).max(80).optional(), name: z.string().trim().min(1).max(80) });
