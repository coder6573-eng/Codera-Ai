import { z } from "zod";
export const schema = z.object({ projectId: z.string().min(8).max(80) });

