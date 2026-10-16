import { getD1 } from "../../../db";
import { actorFromRequest, readJsonBody, routeError } from "../studies/study-store";
import { validateBusinessPayload } from "./business-store";

export const dynamic = "force-dynamic";

type ListRow = {
  id: string;
  client_first_name: string;
  total_assets_cents: number;
  revision: number;
  updated_at: string;
};

export async function GET(request: Request) {
  try {
    const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
    const result = await getD1()
      .prepare(`SELECT id, client_first_name, total_assets_cents, revision, updated_at
                  FROM risk_studies
                 WHERE family_mode = 'business'
                   AND (? = '' OR instr(lower(client_first_name || ' ' || payload_json), lower(?)) > 0)
                 ORDER BY updated_at DESC, client_first_name ASC
                 LIMIT 50`)
      .bind(query, query)
      .all<ListRow>();
    return Response.json({ studies: result.results });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { payload, payloadJson, valuationCents } = validateBusinessPayload(await readJsonBody(request));
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const actor = actorFromRequest(request, payload.consultant);
    const d1 = getD1();
    await d1.batch([
      d1.prepare(`INSERT INTO risk_studies (
          id, client_first_name, client_last_name, spouse_name, marital_regime,
          family_mode, consultant_key, total_assets_cents, coverage_gap_cents,
          payload_json, revision, created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, '', NULL, NULL, 'business', ?, ?, 0, ?, 1, ?, ?, ?, ?)`)
        .bind(id, payload.companyName, payload.consultant, valuationCents, payloadJson, actor, actor, now, now),
      d1.prepare(`INSERT INTO risk_study_revisions (study_id, revision, payload_json, changed_by, created_at)
                  VALUES (?, 1, ?, ?, ?)`).bind(id, payloadJson, actor, now),
    ]);
    return Response.json({ id, revision: 1, updatedAt: now }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
