import { nanoid } from "nanoid";
import { db } from "../helpers/db";
import { schema } from "./projects_POST.schema";

export async function handle(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const project = await db.insertInto("coderaProjects")
      .values({ id: nanoid(16), workspaceId: input.workspaceId, name: input.name, prompt: input.prompt, status: "draft" })
      .returning(["id","workspaceId","name","prompt","planJson","status","createdAt","updatedAt"])
      .executeTakeFirstOrThrow();
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not create project" }, { status: 400 });
  }
}

