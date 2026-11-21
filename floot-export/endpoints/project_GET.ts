import { db } from "../helpers/db";
import { schema } from "./project_GET.schema";

export async function handle(request: Request) {
  try {
    const { projectId } = schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const project = await db.selectFrom("coderaProjects")
      .selectAll()
      .where("id","=",projectId)
      .executeTakeFirst();
    if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
    const files = await db.selectFrom("coderaFiles").selectAll().where("projectId","=",projectId).orderBy("path").execute();
    const messages = await db.selectFrom("coderaMessages").select(["id","role","content","createdAt"]).where("projectId","=",projectId).orderBy("createdAt").execute();
    return Response.json({ project, files, messages });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load project" }, { status: 400 });
  }
}

