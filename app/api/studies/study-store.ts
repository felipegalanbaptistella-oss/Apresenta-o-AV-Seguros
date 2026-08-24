const MAX_BODY_BYTES = 240_000;
const MAX_TEXT_LENGTH = 160;
const MAX_SURRENDER_VALUES = 40;
const MAX_MONEY_VALUE = 1_000_000_000_000;

const CONSULTANT_KEYS = new Set(["fabio", "alexandre", "moises"]);
const FAMILY_MODES = new Set(["single", "couple"]);
const ALLOWED_VALUE_FIELDS = new Set([
  "clientFirstName",
  "clientLastName",
  "spouseName",
  "maritalRegime",
  "xp",
  "otherInvestments",
  "privatePension",
  "realEstate",
  "holdings",
  "currentInsurance",
  "spouseXp",
  "spouseOther",
  "spousePension",
  "spouseRealEstate",
  "spouseHoldings",
  "spouseInsurance",
  "coverageGap",
  "clientAge",
  "annualPremium",
  "ipca",
  "projectionYears",
  "annualReturn",
  "spouseCoverageGap",
  "spouseAge",
  "spouseAnnualPremium",
  "spouseIpca",
  "spouseProjectionYears",
  "spouseAnnualReturn",
  "consultant",
]);

export type StoredStudyPayload = {
  mode: "single" | "couple";
  surrenderValues: {
    primary: number[];
    spouse: number[];
  };
  values: Record<string, string>;
};

export type ValidatedStudy = {
  clientFirstName: string;
  clientLastName: string;
  consultantKey: string;
  coverageGapCents: number;
  familyMode: "single" | "couple";
  maritalRegime: string | null;
  payload: StoredStudyPayload;
  payloadJson: string;
  spouseName: string | null;
  totalAssetsCents: number;
};

export async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new StudyInputError("O estudo excede o tamanho permitido.", 413);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new StudyInputError("O corpo da solicitação não é um JSON válido.");
  }
}

export function validateStudyPayload(input: unknown): ValidatedStudy {
  if (!isRecord(input)) {
    throw new StudyInputError("Dados do estudo ausentes.");
  }

  const mode = cleanText(input.mode, 12);
  if (!FAMILY_MODES.has(mode)) {
    throw new StudyInputError("Composição familiar inválida.");
  }

  if (!isRecord(input.values)) {
    throw new StudyInputError("Campos do estudo ausentes.");
  }

  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.values)) {
    if (!ALLOWED_VALUE_FIELDS.has(key)) continue;
    values[key] = cleanText(value, MAX_TEXT_LENGTH, true);
  }

  const clientFirstName = requiredText(values.clientFirstName, "Informe o nome do cliente.");
  const clientLastName = requiredText(values.clientLastName, "Informe o sobrenome do cliente.");
  const consultantKey = cleanText(values.consultant, 24);
  if (!CONSULTANT_KEYS.has(consultantKey)) {
    throw new StudyInputError("Corretor responsável inválido.");
  }

  const spouseName = mode === "couple"
    ? requiredText(values.spouseName, "Informe o nome do cônjuge.")
    : null;
  const maritalRegime = mode === "couple"
    ? requiredText(values.maritalRegime, "Informe o regime de casamento.")
    : null;

  const surrenderSource = isRecord(input.surrenderValues)
    ? input.surrenderValues
    : {};
  const surrenderValues = {
    primary: cleanNumberArray(surrenderSource.primary),
    spouse: mode === "couple" ? cleanNumberArray(surrenderSource.spouse) : [],
  };

  const payload: StoredStudyPayload = {
    mode: mode as "single" | "couple",
    surrenderValues,
    values,
  };
  const payloadJson = JSON.stringify(payload);
  if (payloadJson.length > MAX_BODY_BYTES) {
    throw new StudyInputError("O estudo excede o tamanho permitido.", 413);
  }

  const primaryAssets = [
    "xp",
    "otherInvestments",
    "privatePension",
    "realEstate",
    "holdings",
  ];
  const spouseAssets = [
    "spouseXp",
    "spouseOther",
    "spousePension",
    "spouseRealEstate",
    "spouseHoldings",
  ];
  const totalAssets = [...primaryAssets, ...(mode === "couple" ? spouseAssets : [])]
    .reduce((sum, key) => sum + parseBrazilianNumber(values[key]), 0);
  const coverageGap = parseBrazilianNumber(values.coverageGap)
    + (mode === "couple" ? parseBrazilianNumber(values.spouseCoverageGap) : 0);

  return {
    clientFirstName,
    clientLastName,
    consultantKey,
    coverageGapCents: toCents(coverageGap),
    familyMode: mode as "single" | "couple",
    maritalRegime,
    payload,
    payloadJson,
    spouseName,
    totalAssetsCents: toCents(totalAssets),
  };
}

export function actorFromRequest(request: Request, consultantKey: string): string {
  const authorization = request.headers.get("authorization") ?? "";
  let username = "acesso-compartilhado";
  if (authorization.startsWith("Basic ")) {
    try {
      const decoded = atob(authorization.slice(6).trim());
      username = cleanText(decoded.split(":", 1)[0], 80) || username;
    } catch {
      // O Worker já validou a autenticação. O fallback evita registrar segredo.
    }
  }
  return `${username}:${consultantKey}`.slice(0, MAX_TEXT_LENGTH);
}

export function isValidStudyId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export class StudyInputError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export function routeError(error: unknown): Response {
  if (error instanceof StudyInputError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("no such table") || message.includes("risk_studies")) {
    return Response.json(
      { error: "O banco ainda não foi inicializado. Publique a migração D1 antes de usar os estudos." },
      { status: 503 },
    );
  }

  return Response.json(
    { error: "Não foi possível concluir a operação no banco." },
    { status: 500 },
  );
}

function cleanNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_SURRENDER_VALUES).map((item) => {
    const number = Number(item);
    if (!Number.isFinite(number) || number < 0 || number > MAX_MONEY_VALUE) {
      throw new StudyInputError("A tabela de resgate contém um valor inválido.");
    }
    return Math.round(number * 100) / 100;
  });
}

function cleanText(value: unknown, limit = MAX_TEXT_LENGTH, allowEmpty = false): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const clean = String(value).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, limit);
  return allowEmpty ? clean : clean.trim();
}

function requiredText(value: unknown, message: string): string {
  const clean = cleanText(value);
  if (!clean) throw new StudyInputError(message);
  return clean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseBrazilianNumber(value: unknown): number {
  const raw = cleanText(value, 80, true).replace(/\s/g, "");
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  const parsed = cleaned.includes(",")
    ? Number(cleaned.replace(/\./g, "").replace(",", "."))
    : /^\d{1,3}(\.\d{3})+$/.test(cleaned)
      ? Number(cleaned.replace(/\./g, ""))
      : Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_MONEY_VALUE) {
    throw new StudyInputError("O estudo contém um valor monetário inválido.");
  }
  return parsed;
}

function toCents(value: number): number {
  return Math.round(value * 100);
}
