import { NextRequest } from "next/server";
import { isOwner } from "@/lib/owner-vault/auth";
import { ovAdmin } from "@/lib/owner-vault/db";

export const runtime = "nodejs";

const METHODS = ["bank_account", "wire_transfer", "paypal", "cashapp", "moncash", "natcash"];

export async function POST(request: NextRequest) {
  if (!(await isOwner())) return Response.json({ error: "Accès refusé." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount);
  if (!amount || amount <= 0) return Response.json({ error: "Montant invalide" }, { status: 400 });
  if (!METHODS.includes(body.method)) return Response.json({ error: "Méthode invalide" }, { status: 400 });

  const reference = "WD-" + Date.now().toString(36).toUpperCase();
  const { error } = await ovAdmin.from("owner_withdrawals").insert({
    amount,
    method: body.method,
    destination: body.destination || null,
    notes: body.notes || null,
    reference,
    status: "pending",
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, reference });
}

// Update a withdrawal status (mark completed / failed).
export async function PATCH(request: NextRequest) {
  if (!(await isOwner())) return Response.json({ error: "Accès refusé." }, { status: 403 });
  const { id, status } = await request.json().catch(() => ({}));
  if (!id || !["pending", "processing", "completed", "failed"].includes(status)) {
    return Response.json({ error: "Requête invalide" }, { status: 400 });
  }
  await ovAdmin.from("owner_withdrawals").update({ status }).eq("id", id);
  return Response.json({ ok: true });
}
