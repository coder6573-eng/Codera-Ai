import { z } from "zod";
export const schema = z.object({
  workspaceId: z.string().min(8).max(80),
  name: z.string().trim().min(1).max(100),
  prompt: z.string().trim().max(12000).default(""),
});

