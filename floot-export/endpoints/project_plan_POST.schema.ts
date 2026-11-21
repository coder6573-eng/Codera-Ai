import { z } from "zod";
export const schema = z.object({ projectId: z.string().min(8), prompt: z.string().trim().min(1).max(12000), model: z.string().optional() });

