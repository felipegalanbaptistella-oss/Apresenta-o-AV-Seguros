import { getD1 } from "../../../db";
import {
  actorFromRequest,
  readJsonBody,
  routeError,
  validateStudyPayload,
} from "./study-store";

export const dynamic = "force-dynamic";

type StudyListRow = {
  client_first_name: string;
  client_last_name: string;
  consultant_key: string;
  coverage_gap_cents: number;
  family_mode: string;
  id: string;
  revision: number;
  spouse_name: string | null;
  total_assets_cents: number;
  updated_at: string;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
    const d1 = getD1();
    const result = await d1
      .prepare(
        `SELECT id, client_first_name, client_last_name, spouse_name,
                family_mode, consultant_key, total_assets_cents,
                coverage_gap_cents, revision, updated_at
           FROM risk_studies
          WHERE ? = ''
             OR instr(lower(client_first_name || ' ' || client_last_name || ' ' || coalesce(spouse_name, '')), lower(?)) > 0
          ORDER BY updated_at DESC, client_last_name ASC, client_first_name ASC
          LIMIT 50`,
      )
      .bind(query, query)
      .all<StudyListRow>();

    return Response.json({ studies: result.results });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = await readJsonBody(request);
    const study = validateStudyPayload(input);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const actor = actorFromRequest(request, study.consultantKey);
    const d1 = getD1();

    await d1.batch([
      d1.prepare(
        `INSERT INTO risk_studies (
           id, client_first_name, client_last_name, spouse_name, marital_regime,
           family_mode, consultant_key, total_assets_cents, coverage_gap_cents,
           payload_json, revision, created_by, updated_by, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      ).bind(
        id,
        study.clientFirstName,
        study.clientLastName,
        study.spouseName,
        study.maritalRegime,
        study.familyMode,
        study.consultantKey,
        study.totalAssetsCents,
        study.coverageGapCents,
        study.payloadJson,
        actor,
        actor,
        now,
        now,
      ),
      d1.prepare(
        `INSERT INTO risk_study_revisions (study_id, revision, payload_json, changed_by, created_at)
         VALUES (?, 1, ?, ?, ?)`,
      ).bind(id, study.payloadJson, actor, now),
    ]);

    return Response.json({ id, revision: 1, updatedAt: now }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
