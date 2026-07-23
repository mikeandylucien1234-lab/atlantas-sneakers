import { isOwner } from "@/lib/owner-vault/auth";
import { getVaultData } from "@/lib/owner-vault/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isOwner())) return Response.json({ error: "Accès refusé." }, { status: 403 });
  const data = await getVaultData();
  return Response.json(data);
}
