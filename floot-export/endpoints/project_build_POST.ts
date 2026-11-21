import { db } from "../helpers/db";
import { buildProject } from "../helpers/coderaAgent";
import { schema } from "./project_build_POST.schema";

export async function handle(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const project = await db.selectFrom("coderaProjects").selectAll().where("id","=",input.projectId).executeTakeFirst();
    if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
    const existing = await db.selectFrom("coderaFiles").select(["path","content","language"]).where("projectId","=",input.projectId).orderBy("path").execute();
    const result = await buildProject({ prompt: input.prompt, plan: input.plan ?? project.planJson ?? undefined, files: existing, model: input.model });
    for (const file of result.files) {
      await db.insertInto("coderaFiles").values({ projectId: input.projectId, path: file.path, content: file.content, language: file.language ?? "text", updatedAt: new Date() })
        .onConflict((oc) => oc.columns(["projectId","path"]).doUpdateSet({ content: file.content, language: file.language ?? "text", updatedAt: new Date() })).execute();
    }
    if (result.removedFiles.length) await db.deleteFrom("coderaFiles").where("projectId","=",input.projectId).where("path","in",result.removedFiles).execute();
    await db.updateTable("coderaProjects").set({ prompt: input.prompt, status: "built", updatedAt: new Date() }).where("id","=",input.projectId).execute();
    await db.insertInto("coderaMessages").values({ projectId: input.projectId, role: "user", content: input.prompt }).execute();
    await db.insertInto("coderaMessages").values({ projectId: input.projectId, role: "assistant", content: result.summary }).execute();
    return Response.json({ result, model: input.model ?? "kilo-auto/free" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Build failed" }, { status: 500 });
  }
}

