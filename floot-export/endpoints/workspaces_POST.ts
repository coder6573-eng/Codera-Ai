import { nanoid } from "nanoid";
import { db } from "../helpers/db";
import { schema } from "./workspaces_POST.schema";

export async function handle(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const id = input.id || nanoid(12);
    const workspace = await db.insertInto("coderaWorkspaces")
      .values({ id, name: input.name })
      .returning(["id","name","createdAt","updatedAt"])
      .executeTakeFirstOrThrow();
    return Response.json({ workspace }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not create workspace" }, { status: 400 });
  }
}

