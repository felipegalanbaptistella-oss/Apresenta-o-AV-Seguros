import { getD1 } from "../../../../db";
import {
  actorFromRequest,
  isValidStudyId,
  readJsonBody,
  routeError,
  StudyInputError,
  validateStudyPayload,
} from "../study-store";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

type StudyRow = {
  client_first_name: string;
  client_last_name: string;
  consultant_key: string;
  created_at: string;
  created_by: string;
  id: string;
  payload_json: string;
  revision: number;
  updated_at: string;
  updated_by: string;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!isValidStudyId(id)) throw new StudyInputError("Identificador de estudo inválido.");
    const row = await getD1()
      .prepare(
        `SELECT id, client_first_name, client_last_name, consultant_key,
                payload_json, revision, created_by, updated_by, created_at, updated_at
           FROM risk_studies
          WHERE id = ?`,
      )
      .bind(id)
      .first<StudyRow>();

    if (!row) {
      return Response.json({ error: "Estudo não encontrado." }, { status: 404 });
    }

    return Response.json({
      study: {
        id: row.id,
        clientFirstName: row.client_first_name,
        clientLastName: row.client_last_name,
        consultantKey: row.consultant_key,
        payload: JSON.parse(row.payload_json),
        revision: row.revision,
        createdBy: row.created_by,
        updatedBy: row.updated_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!isValidStudyId(id)) throw new StudyInputError("Identificador de estudo inválido.");
    const input = await readJsonBody(request);
    const study = validateStudyPayload(input);
    const expectedRevision = Number(
      input && typeof input === "object" && "expectedRevision" in input
        ? input.expectedRevision
        : 0,
    );
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
      throw new StudyInputError("Versão esperada do estudo inválida.");
    }

    const d1 = getD1();
    const current = await d1
      .prepare("SELECT revision FROM risk_studies WHERE id = ?")
      .bind(id)
      .first<{ revision: number }>();
    if (!current) {
      return Response.json({ error: "Estudo não encontrado." }, { status: 404 });
    }
    if (current.revision !== expectedRevision) {
      return Response.json(
        { error: "Este estudo foi alterado por outra pessoa. Reabra-o antes de salvar novamente." },
        { status: 409 },
      );
    }

    const nextRevision = current.revision + 1;
    const now = new Date().toISOString();
    const actor = actorFromRequest(request, study.consultantKey);
    await d1.batch([
      d1.prepare(
        `UPDATE risk_studies
            SET client_first_name = ?, client_last_name = ?, spouse_name = ?,
                marital_regime = ?, family_mode = ?, consultant_key = ?,
                total_assets_cents = ?, coverage_gap_cents = ?, payload_json = ?,
                revision = ?, updated_by = ?, updated_at = ?
          WHERE id = ? AND revision = ?`,
      ).bind(
        study.clientFirstName,
        study.clientLastName,
        study.spouseName,
        study.maritalRegime,
        study.familyMode,
        study.consultantKey,
        study.totalAssetsCents,
        study.coverageGapCents,
        study.payloadJson,
        nextRevision,
        actor,
        now,
        id,
        expectedRevision,
      ),
      d1.prepare(
        `INSERT INTO risk_study_revisions (study_id, revision, payload_json, changed_by, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(id, nextRevision, study.payloadJson, actor, now),
    ]);

    return Response.json({ id, revision: nextRevision, updatedAt: now });
  } catch (error) {
    return routeError(error);
  }
}
