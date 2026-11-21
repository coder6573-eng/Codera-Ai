import { db } from "../helpers/db";

export async function handle() {
  const rows = await db.selectFrom("coderaWorkspaces")
    .select(["id","name","createdAt","updatedAt"])
    .orderBy("updatedAt","desc")
    .execute();
  return Response.json({ workspaces: rows });
}

