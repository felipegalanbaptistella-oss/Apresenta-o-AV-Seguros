import { StudyInputError } from "../studies/study-store";

const MAX_MONEY = 1_000_000_000_000;
const CONSULTANTS = new Set(["fabio", "alexandre", "moises"]);

type Partner = {
  name: string;
  age: number;
  share: number;
  wlCoverage: number;
  wlPremium: number;
  termCoverage: number;
  termPremium: number;
  termYears: number;
  surrenderValues: number[];
};

export type BusinessPayload = {
  kind: "business";
  companyName: string;
  cnpj: string;
  consultant: string;
  valuation: number;
  ipca: number;
  partners: Partner[];
};

export function validateBusinessPayload(input: unknown): {
  payload: BusinessPayload;
  payloadJson: string;
  valuationCents: number;
} {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new StudyInputError("Dados do estudo empresarial ausentes.");
  }
  const source = input as Record<string, unknown>;
  const companyName = cleanText(source.companyName, 160);
  if (!companyName) throw new StudyInputError("Informe o nome da empresa.");
  const cnpj = cleanText(source.cnpj, 18).replace(/\D/g, "");
  if (cnpj && cnpj.length !== 14) throw new StudyInputError("O CNPJ deve ter 14 dígitos.");
  const consultant = cleanText(source.consultant, 24);
  if (!CONSULTANTS.has(consultant)) throw new StudyInputError("Corretor responsável inválido.");
  const valuation = cleanNumber(source.valuation, MAX_MONEY, "Valuation inválido.");
  const ipca = cleanNumber(source.ipca, 30, "IPCA projetado inválido.");
  if (!Array.isArray(source.partners) || source.partners.length < 1 || source.partners.length > 8) {
    throw new StudyInputError("Cadastre de 1 a 8 sócios.");
  }
  const partners = source.partners.map((item, index): Partner => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new StudyInputError(`Dados do sócio ${index + 1} inválidos.`);
    }
    const part = item as Record<string, unknown>;
    const name = cleanText(part.name, 160);
    if (!name) throw new StudyInputError(`Informe o nome do sócio ${index + 1}.`);
    const age = cleanInteger(part.age, 100, "Idade inválida.");
    if (age !== 0 && age < 18) throw new StudyInputError("A idade do sócio deve ser de pelo menos 18 anos.");
    const share = cleanNumber(part.share, 100, "Participação societária inválida.");
    const termYears = cleanInteger(part.termYears, 40, "Prazo da cobertura temporária inválido.");
    const surrenderValues = Array.isArray(part.surrenderValues)
      ? part.surrenderValues.slice(0, 40).map(value => cleanNumber(value, MAX_MONEY, "Valor de resgate inválido."))
      : [];
    return {
      name, age, share,
      wlCoverage: cleanNumber(part.wlCoverage, MAX_MONEY, "Capital WL10 inválido."),
      wlPremium: cleanNumber(part.wlPremium, MAX_MONEY, "Prêmio WL10 inválido."),
      termCoverage: cleanNumber(part.termCoverage, MAX_MONEY, "Capital temporário inválido."),
      termPremium: cleanNumber(part.termPremium, MAX_MONEY, "Prêmio temporário inválido."),
      termYears, surrenderValues,
    };
  });
  if (partners.reduce((sum, partner) => sum + partner.share, 0) > 100.01) {
    throw new StudyInputError("A soma das participações não pode superar 100%.");
  }
  const payload: BusinessPayload = {
    kind: "business", companyName, cnpj, consultant, valuation, ipca, partners,
  };
  const payloadJson = JSON.stringify(payload);
  if (payloadJson.length > 240_000) throw new StudyInputError("O estudo excede o tamanho permitido.", 413);
  return { payload, payloadJson, valuationCents: Math.round(valuation * 100) };
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max)
    : "";
}

function cleanNumber(value: unknown, max: number, error: string): number {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0 || number > max) throw new StudyInputError(error);
  return Math.round(number * 100) / 100;
}

function cleanInteger(value: unknown, max: number, error: string): number {
  const number = Number(value ?? 0);
  if (!Number.isInteger(number) || number < 0 || number > max) throw new StudyInputError(error);
  return number;
}
