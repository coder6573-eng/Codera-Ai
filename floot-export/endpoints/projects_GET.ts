import { db } from "../helpers/db";
import { schema } from "./projects_GET.schema";

export async function handle(request: Request) {
  try {
    const { workspaceId } = schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const projects = await db.selectFrom("coderaProjects")
      .select(["id","workspaceId","name","prompt","planJson","status","createdAt","updatedAt"])
      .where("workspaceId","=",workspaceId)
      .orderBy("updatedAt","desc")
      .execute();
    return Response.json({ projects });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load projects" }, { status: 400 });
  }
}

