import { db } from "../helpers/db";
import { createPlan } from "../helpers/coderaAgent";
import { schema } from "./project_plan_POST.schema";

export async function handle(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const project = await db.selectFrom("coderaProjects").select("id").where("id","=",input.projectId).executeTakeFirst();
    if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
    const plan = await createPlan(input.prompt, input.model);
    await db.updateTable("coderaProjects").set({ prompt: input.prompt, planJson: plan, status: "planned", updatedAt: new Date() }).where("id","=",input.projectId).execute();
    await db.insertInto("coderaMessages").values({ projectId: input.projectId, role: "user", content: input.prompt }).execute();
    await db.insertInto("coderaMessages").values({ projectId: input.projectId, role: "assistant", content: JSON.stringify(plan) }).execute();
    return Response.json({ plan, model: input.model ?? "kilo-auto/free" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Plan failed" }, { status: 500 });
  }
}

