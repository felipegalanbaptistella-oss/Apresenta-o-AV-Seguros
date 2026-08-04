import assert from "node:assert/strict";
import test from "node:test";

await import("../public/assets/surrender-pdf.js");

const {
  extractSurrenderValuesFromPages,
  parseMoneyToken,
} = globalThis.SurrenderPdf;

function item(str, x, y, width = Math.max(18, str.length * 5)) {
  return { str, width, transform: [1, 0, 0, 1, x, y] };
}

test("interpreta valores monetários brasileiros e americanos", () => {
  assert.equal(parseMoneyToken("R$ 1.234.567,89"), 1234567.89);
  assert.equal(parseMoneyToken("1,234,567.89"), 1234567.89);
  assert.equal(parseMoneyToken("1234,56"), 1234.56);
  assert.equal(parseMoneyToken("1234.56"), 1234.56);
  assert.equal(parseMoneyToken("0,00"), 0);
  assert.equal(parseMoneyToken("(R$ 1.000,00)"), -1000);
  assert.equal(parseMoneyToken("R$1.901.88683"), 1901886.83);
});

test("localiza a coluna de resgate sem confundir capital ou aporte", () => {
  const page = [
    item("ANO", 42, 720, 28),
    item("IDADE", 102, 720, 42),
    item("CAPITAL SEGURADO", 190, 720, 110),
    item("APORTE ACUMULADO", 345, 720, 115),
    item("VALOR DE RESGATE", 515, 720, 105),
  ];
  const expected = [0, 4500.25, 12750.5, 22100.75, 32000];
  expected.forEach((surrender, index) => {
    const y = 690 - index * 28;
    page.push(
      item(String(index + 1), 47, y, 12),
      item(String(23 + index), 112, y, 18),
      item(`R$ ${(525000 * (index + 1)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 200, y, 90),
      item(`R$ ${(20000 * (index + 1)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 365, y, 85),
      item(index === 0 ? "—" : `R$ ${surrender.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 530, y, 82),
    );
  });

  const result = extractSurrenderValuesFromPages([page], { currentAge: 23, maxValues: 20 });
  assert.equal(result.confidence, "high");
  assert.equal(result.rowCount, 5);
  assert.deepEqual(result.values, expected);
});

test("reconhece cabeçalho quebrado de reserva resgatável", () => {
  const page = [
    item("ANO DE VIGÊNCIA", 42, 720, 100),
    item("IDADE", 170, 720, 42),
    item("CONTRIBUIÇÕES", 250, 720, 90),
    item("CAPITAL SEGURADO", 360, 720, 105),
    item("RESERVA", 500, 720, 52),
    item("RESGATAVEL", 555, 720, 70),
  ];
  [0, 0, 16002.84, 73702.09, 182149.43].forEach((value, index) => {
    const y = 690 - index * 25;
    page.push(
      item(String(index + 1), 50, y, 14),
      item(String(55 + index), 175, y, 18),
      item("R$ 155.410,95", 250, y, 85),
      item("R$ 2.720.000,00", 360, y, 95),
      item(`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 505, y, 95),
    );
  });
  const result = extractSurrenderValuesFromPages([page], { currentAge: 54, maxValues: 20 });
  assert.equal(result.confidence, "high");
  assert.deepEqual(result.values, [0, 0, 16002.84, 73702.09, 182149.43]);
});

test("reconhece a coluna reserva financeira da Omint", () => {
  const page = [
    item("IDADE", 50, 720, 42),
    item("TEMPO", 110, 720, 48),
    item("PRÊMIO ANUAL ACUMULADO", 180, 720, 150),
    item("CAPITAL SEGURADO", 360, 720, 105),
    item("RESERVA", 500, 720, 52),
    item("FINANCEIRA", 555, 720, 75),
  ];
  [0, 0, 88527.42, 179697.81, 304112.04].forEach((value, index) => {
    const y = 690 - index * 25;
    page.push(
      item(String(55 + index), 55, y, 18),
      item(String(index + 1), 115, y, 14),
      item("R$ 0,00", 220, y, 65),
      item("R$ 2.720.000,00", 360, y, 95),
      item(`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 505, y, 95),
    );
  });
  const result = extractSurrenderValuesFromPages([page], { currentAge: 54, maxValues: 20 });
  assert.equal(result.confidence, "high");
  assert.deepEqual(result.values, [0, 0, 88527.42, 179697.81, 304112.04]);
});

test("usa a idade quando o OCR confunde ou perde o tempo", () => {
  const page = [
    item("IDADE", 50, 720, 42),
    item("TEMPO", 110, 720, 48),
    item("RESERVA FINANCEIRA", 430, 720, 130),
  ];
  [1000, 2500, 4000, 5750, 7300].forEach((value, index) => {
    const y = 690 - index * 25;
    page.push(
      item(String(64 + index), 55, y, 18),
      item(index === 1 ? "nn" : String(10 + index), 115, y, 18),
      item(`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 470, y, 80),
    );
  });
  const result = extractSurrenderValuesFromPages([page], { currentAge: 54, maxValues: 20 });
  assert.equal(result.confidence, "medium");
  assert.deepEqual(result.values.slice(9), [1000, 2500, 4000, 5750, 7300]);
});

test("usa a idade para ordenar quando a tabela não possui coluna de ano", () => {
  const page = [
    item("IDADE", 80, 700, 42),
    item("PRÊMIO", 250, 700, 48),
    item("CASH VALUE", 470, 700, 75),
  ];
  [1000, 2500, 4000, 5750, 7300].forEach((value, index) => {
    const y = 670 - index * 25;
    page.push(
      item(String(40 + index), 90, y, 18),
      item("R$ 20.000,00", 245, y, 82),
      item(`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 475, y, 80),
    );
  });

  const result = extractSurrenderValuesFromPages([page], { currentAge: 40, maxValues: 20 });
  assert.equal(result.confidence, "high");
  assert.deepEqual(result.values, [1000, 2500, 4000, 5750, 7300]);
});

test("não autoriza importação sem cabeçalho reconhecido", () => {
  const page = [
    item("RESUMO DA PROPOSTA", 100, 700, 120),
    item("R$ 525.000,00", 400, 650, 90),
    item("R$ 20.000,00", 400, 620, 90),
  ];
  const result = extractSurrenderValuesFromPages([page], { maxValues: 20 });
  assert.equal(result.confidence, "low");
  assert.equal(result.reason, "no_header");
  assert.deepEqual(result.values, []);
});

test("rejeita uma sequência de anos com lacuna", () => {
  const page = [item("ANO", 50, 700, 28), item("VALOR DE RESGATE", 450, 700, 105)];
  [1, 2, 3, 4, 11].forEach((year, index) => {
    const y = 670 - index * 25;
    page.push(item(String(year), 55, y, 14), item(`R$ ${(year * 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 470, y, 86));
  });
  const result = extractSurrenderValuesFromPages([page], { maxValues: 20 });
  assert.notEqual(result.confidence, "high");
  assert.equal(result.reason, "non_sequential_rows");
});

test("não escolhe silenciosamente entre resgate bruto e líquido", () => {
  const page = [
    item("ANO", 45, 700, 28),
    item("CAPITAL", 220, 700, 50),
    item("RESGATE BRUTO", 410, 700, 90),
    item("RESGATE LÍQUIDO", 520, 700, 96),
  ];
  for (let index = 0; index < 5; index += 1) {
    const y = 670 - index * 25;
    page.push(
      item(String(index + 1), 50, y, 14),
      item("R$ 525.000,00", 220, y, 90),
      item(`R$ ${((index + 1) * 900).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 420, y, 75),
      item(`R$ ${((index + 1) * 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 530, y, 80),
    );
  }
  const result = extractSurrenderValuesFromPages([page], { maxValues: 20 });
  assert.notEqual(result.confidence, "high");
  assert.equal(result.reason, "ambiguous_surrender_columns");
});
