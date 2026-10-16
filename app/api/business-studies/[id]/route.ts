import { getD1 } from "../../../../db";
import {
  actorFromRequest, isValidStudyId, readJsonBody, routeError, StudyInputError,
} from "../../studies/study-store";
import { validateBusinessPayload } from "../business-store";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
type StudyRow = {
  id: string;
  client_first_name: string;
  payload_json: string;
  revision: number;
  created_at: string;
  updated_at: string;
};

async function routeId(context: Context): Promise<string> {
  const { id } = await context.params;
  if (!isValidStudyId(id)) throw new StudyInputError("Identificador de estudo inválido.");
  return id;
}

export async function GET(_request: Request, context: Context) {
  try {
    const id = await routeId(context);
    const row = await getD1()
      .prepare(`SELECT id, client_first_name, payload_json, revision, created_at, updated_at
                  FROM risk_studies WHERE id = ? AND family_mode = 'business'`)
      .bind(id).first<StudyRow>();
    if (!row) return Response.json({ error: "Estudo não encontrado." }, { status: 404 });
    return Response.json({
      study: {
        id: row.id, companyName: row.client_first_name, payload: JSON.parse(row.payload_json),
        revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const id = await routeId(context);
    const input = await readJsonBody(request);
    const { payload, payloadJson, valuationCents } = validateBusinessPayload(input);
    const expectedRevision = Number(
      input && typeof input === "object" && "expectedRevision" in input ? input.expectedRevision : 0,
    );
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
      throw new StudyInputError("Versão esperada do estudo inválida.");
    }
    const d1 = getD1();
    const current = await d1
      .prepare("SELECT revision FROM risk_studies WHERE id = ? AND family_mode = 'business'")
      .bind(id).first<{ revision: number }>();
    if (!current) return Response.json({ error: "Estudo não encontrado." }, { status: 404 });
    if (current.revision !== expectedRevision) {
      return Response.json(
        { error: "Este estudo foi alterado por outra pessoa. Reabra-o antes de salvar novamente." },
        { status: 409 },
      );
    }
    const nextRevision = current.revision + 1;
    const now = new Date().toISOString();
    const actor = actorFromRequest(request, payload.consultant);
    await d1.batch([
      d1.prepare(`UPDATE risk_studies
                     SET client_first_name = ?, consultant_key = ?, total_assets_cents = ?,
                         payload_json = ?, revision = ?, updated_by = ?, updated_at = ?
                   WHERE id = ? AND family_mode = 'business' AND revision = ?`)
        .bind(payload.companyName, payload.consultant, valuationCents, payloadJson,
          nextRevision, actor, now, id, expectedRevision),
      d1.prepare(`INSERT INTO risk_study_revisions (study_id, revision, payload_json, changed_by, created_at)
                  VALUES (?, ?, ?, ?, ?)`).bind(id, nextRevision, payloadJson, actor, now),
    ]);
    return Response.json({ id, revision: nextRevision, updatedAt: now });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const id = await routeId(context);
    const result = await getD1()
      .prepare("DELETE FROM risk_studies WHERE id = ? AND family_mode = 'business'")
      .bind(id).run();
    if (!result.meta.changes) return Response.json({ error: "Estudo não encontrado." }, { status: 404 });
    return Response.json({ deleted: true, id });
  } catch (error) {
    return routeError(error);
  }
}
