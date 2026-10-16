import assert from "node:assert/strict";
import test from "node:test";

await import("../public/assets/business-model.js");
const { participationValue, projection } = globalThis.BusinessModel;

test("calcula a participação a partir do valuation informado", () => {
  assert.equal(participationValue(50_000_000, 34), 17_000_000);
  assert.equal(participationValue(50_000_000, 33), 16_500_000);
});

test("projeta dez aportes, preserva o acumulado e usa os resgates da cotação", () => {
  const surrenderValues = Array.from({ length: 20 }, (_, index) => (index + 1) * 1000);
  const rows = projection({
    age: 47, wlCoverage: 15_000_000, wlPremium: 845_088.76, surrenderValues,
  }, 5);
  assert.equal(rows.length, 20);
  assert.equal(rows[0].capital, 15_000_000);
  assert.equal(rows[0].age, 47);
  assert.equal(rows[0].surrender, 0);
  assert.equal(rows[1].surrender, 0);
  assert.equal(rows[2].surrender, 3000);
  assert.equal(rows[9].premium > 0, true);
  assert.equal(rows[10].premium, 0);
  assert.equal(rows[10].accumulated, rows[9].accumulated);
  assert.equal(rows[19].accumulated, rows[9].accumulated);
  assert.equal(rows[19].surrender, 20_000);
});
