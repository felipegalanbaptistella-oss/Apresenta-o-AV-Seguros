import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the consolidated generator", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Gestão de Riscos — Gerador Completo<\/title>/i);
  assert.match(html, /src=["']\/legacy\.html["']/i);
  assert.match(html, /Gerador de apresentação de gestão de riscos/i);
});

test("keeps the form and export contract wired", async () => {
  const [page, layout, legacy, app, template, appCss] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/legacy.html", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/template-ppt.js", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/app.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /src="\/legacy\.html"/);
  assert.match(layout, /generateMetadata\(\): Promise<Metadata>/);
  assert.match(legacy, /id="clientFirstName"/);
  assert.match(legacy, /id="clientLastName"/);
  assert.match(legacy, /id="coverageGap"[^>]*data-money-input/);
  assert.match(legacy, /id="generatePptBtn"/);
  assert.match(legacy, /id="generatePdfBtn"/);
  assert.doesNotMatch(legacy, /healthProfile|previewHealth/);
  assert.match(legacy, /id="paybackMonths06"/);
  assert.match(legacy, /id="paybackMonths08"/);
  assert.match(legacy, /id="paybackMonths10"/);
  assert.match(legacy, /id="gaugeCurrent"/);
  assert.match(legacy, /id="gaugeProposed"/);
  assert.match(app, /const coverageGap = Math\.max\(0, num\('coverageGap'\)\)/);
  assert.match(app, /const paybackAtRate=/);
  assert.match(app, /currentAllocation=d\.total\?d\.annualPremium\/d\.total\*100:0/);
  assert.match(app, /proposedAllocation=d\.withoutInsurance\?d\.annualPremium\/d\.withoutInsurance\*100:0/);
  assert.match(appCss, /gauge-arc:after\{background:#f28c28\}/);
  assert.match(template, /window\.buildTemplatePpt/);
  assert.match(template, /window\.buildTemplatePdf/);
  assert.match(template, /d\.annualPremium\/d\.total\*100:0,proposedAllocation=d\.withoutInsurance\?d\.annualPremium\/d\.withoutInsurance\*100:0/);
  assert.match(template, /'#f28c28',4/);
  assert.match(template, /effectOnly=new Set\(\[2,11,12,15\]\)/);
  assert.match(template, /\[16,\(\)=>slide11\(d,3\)\]/);
  assert.match(template, /if\(stage>=3\)\{rect\(ctx,48,footerY/);
  assert.match(template, /RENDIMENTOS PAGAM A ALOCAÇÃO ANUAL EM/);
  assert.match(template, /ALOCAÇÃO PROPOSTA VS PATRIMÔNIO LÍQUIDO/);
  assert.match(template, /monthsAtRate\(d,rate\)/);
  assert.match(template, /const surname=\(d\.lastName\|\|d\.firstName\|\|'Cliente'\)/);
  assert.match(template, /const texture=document\.createElement\('canvas'\)/);
});
