import { z } from "zod";
export const schema = z.object({ workspaceId: z.string().min(8).max(80) });

