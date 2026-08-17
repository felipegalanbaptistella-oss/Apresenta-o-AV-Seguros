import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
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
  assert.match(legacy, /id="spouseCoverageGap"[^>]*data-money-input/);
  assert.match(legacy, /id="spouseAnnualPremium"[^>]*data-money-input/);
  assert.match(legacy, /id="spouseSurrenderInputs"/);
  assert.match(legacy, /src="assets\/study-model\.js\?v=1"/);
  assert.match(legacy, /data-study="primary"/);
  assert.match(legacy, /data-study="spouse"/);
  assert.match(legacy, /id="coverageGap"[^>]*data-money-input/);
  assert.match(legacy, /id="generatePptBtn"/);
  assert.match(legacy, /id="generatePdfBtn"/);
  assert.doesNotMatch(legacy, /healthProfile|previewHealth/);
  assert.match(legacy, /id="paybackMonths06"/);
  assert.match(legacy, /id="paybackMonths08"/);
  assert.match(legacy, /id="paybackMonths10"/);
  assert.match(legacy, /id="gaugeCurrent"/);
  assert.match(legacy, /id="gaugeProposed"/);
  assert.match(legacy, /class="succession-range">15% - 20%<\/strong>/);
  assert.match(legacy, /id="previewTotalCapital"/);
  assert.match(legacy, /class="donut-center" id="donutWithoutCenter"/);
  assert.match(legacy, /class="donut-center" id="donutWithCenter"/);
  assert.match(app, /const surrenderValuesByStudy = \{primary:\[\],spouse:\[\]\}/);
  assert.match(app, /function personData\(role='primary'\)/);
  assert.match(app, /window\.RiskStudy\.calculatePerson/);
  assert.match(app, /function exportData\(\)/);
  assert.match(app, /setText\('previewTotalCapital',money\(d\.total\)\)/);
  assert.match(app, /label\.className='donut-label'/);
  assert.match(app, /share\*100\)\.toLocaleString\('pt-BR'/);
  assert.match(appCss, /donut-label\{[^}]*background:transparent;border:0;[^}]*text-shadow:/);
  assert.match(template, /function donutPercentText\(ctx,value,x,y,w,/);
  assert.doesNotMatch(template, /rect\(ctx,lx-40,ly-15,80,30/);
  assert.doesNotMatch(template, /rect\(ctx,tx-4,ey-14,88,28/);
  assert.match(app, /studies=hasSpouse\?\[primary,personData\('spouse'\)\]:\[primary\]/);
  assert.match(app, /const paybackAtRate=/);
  assert.match(app, /currentAllocation=d\.total\?d\.annualPremium\/d\.total\*100:0/);
  assert.match(app, /proposedAllocation=d\.withoutInsurance\?d\.annualPremium\/d\.withoutInsurance\*100:0/);
  assert.match(appCss, /gauge-arc:after\{background:#f28c28\}/);
  assert.match(appCss, /gauge-arc\{background:conic-gradient\(from 270deg at 50% 100%,#ff4848 0 2%,#70b544 2% 16%/);
  assert.match(appCss, /gauge-arc>span\{color:#fff/);
  assert.match(template, /window\.buildTemplatePpt/);
  assert.match(template, /fetch\('assets\/modelo-base\.pptx\?v=2'\)/);
  assert.match(template, /window\.buildTemplatePdf/);
  assert.match(template, /fitText\(ctx,'15% - 20%'/);
  assert.match(template, /text\(ctx,'CAPITAL TOTAL DO CLIENTE'/);
  assert.match(template, /fitText\(ctx,brl\(d\.total\),455,794/);
  assert.match(template, /const label=pct\(actualShares\[i\]\*100\)/);
  assert.match(template, /donutPercentText\(ctx,label,lx-42,ly,84/);
  assert.match(template, /d\.annualPremium\/d\.total\*100:0,proposedAllocation=d\.withoutInsurance\?d\.annualPremium\/d\.withoutInsurance\*100:0/);
  assert.match(template, /'#f28c28',4/);
  assert.doesNotMatch(template, /#e98b35/);
  assert.match(template, /text\(ctx,'Ótimo',[\s\S]*?color:WHITE/);
  assert.match(template, /text\(ctx,'Recomendado',[\s\S]*?color:WHITE/);
  assert.match(template, /text\(ctx,'Alta exposição',[\s\S]*?color:WHITE/);
  assert.match(template, /const studySlideNumbers=\[6,7,8,9,10,11,12,15,16,13\]/);
  assert.match(template, /const projectionSlideNumbers=\[11,12,15,16\]/);
  assert.match(template, /function combineStudiesForPpt\(d,studies\)/);
  assert.match(template, /studyLabel:'Estudo familiar consolidado'/);
  assert.match(template, /async function cloneHiddenProjectionSlides\(zip\)/);
  assert.match(template, /async function ensureRiskNavigation\(zip\)/);
  assert.match(template, /addSlideJumpHotspot\(zip,2,3,/);
  assert.match(template, /replaceSlide\(zip,no,bytes,\{hidden:no===3\}\)/);
  assert.match(template, /await ensureRiskNavigation\(zip\)/);
  assert.match(template, /Number\(hiddenCount\)\+count/);
  assert.match(template, /replace\(\/\\s\+show="0"[\s\S]*?'<p:sld show="0"'/);
  assert.match(template, /addSlideJumpHotspot\(zip,source,hiddenTargets\[0\]/);
  assert.match(template, /hiddenTargets\[index\+1\]\|\|13/);
  assert.match(template, /Target="slide\$\{targetSlide\}\.xml"/);
  assert.match(template, /for\(const study of studies\)rendered\.push\(\.\.\.await renderStudySlides\(study\)\)/);
  assert.match(template, /effectOnly=new Set\(\[11,12,15\]\)/);
  assert.match(template, /\[16,\(\)=>slide11\(d,3\)\]/);
  assert.match(template, /if\(stage>=3\)\{rect\(ctx,48,footerY/);
  assert.match(template, /RENDIMENTOS PAGAM A ALOCAÇÃO ANUAL EM/);
  assert.match(template, /ALOCAÇÃO PROPOSTA VS PATRIMÔNIO LÍQUIDO/);
  assert.match(template, /monthsAtRate\(d,rate\)/);
  assert.match(template, /const surname=\(d\.lastName\|\|d\.firstName\|\|'Cliente'\)/);
  assert.match(template, /const texture=document\.createElement\('canvas'\)/);
  assert.doesNotMatch(template, /applyTransitionsToAllSlides/);
  assert.doesNotMatch(template, /await preparePlanningStages/);
  assert.doesNotMatch(template, /\[2,\(\)=>planningStage0\(\)\]/);
  assert.doesNotMatch(template, /\[17,\(\)=>staticSlide\(2\)\]/);
  assert.match(template, /\[5,await staticSlide\(5\)\]/);
  assert.match(template, /for\(const study of studies\)rendered\.push\(\.\.\.await renderStudySlides\(study\)\)/);
  assert.match(template, /arrowCenters=\[405,645,876\]/);
  assert.match(template, /for\(let i=11;i<Math\.min\(18,rows\.length\);i\+\+\)/);
  assert.match(template, /const cloneBase=\(await read\('ppt\/slides\/slide11\.xml'\)\).*?<p:timing/);
  assert.match(template, /const sourceXml=\(await read\('ppt\/slides\/slide2\.xml'\)\).*?<p:timing/);
  assert.match(template, /const sourceRels=.*?\/notesSlide/);
  assert.match(template, /slide17\.xml\.rels',sourceRels/);
});

test("keeps the presentation model transition sequence", () => {
  const pptx = fileURLToPath(new URL("../public/assets/modelo-base.pptx", import.meta.url));
  const slideXml = (number) => {
    const result = spawnSync("tar", ["-xOf", pptx, `ppt/slides/slide${number}.xml`], {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(result.status, 0, result.stderr || `Could not inspect slide ${number}`);
    return result.stdout;
  };

  assert.doesNotMatch(slideXml(1), /<p:transition\b/);
  assert.match(slideXml(2), /<p:transition spd="med" p14:dur="700"><p:fade\/>/);
  assert.match(slideXml(2), /<p:timing\b/);
  assert.match(slideXml(2), /delay="250"/);
  assert.match(slideXml(2), /delay="500"/);
  assert.match(slideXml(2), /delay="750"/);
  assert.match(slideXml(2), /delay="1000"/);
  assert.match(slideXml(5), /<p159:morph option="byObject"\/>/);
  assert.match(slideXml(6), /p14:dur="2000"><p159:morph option="byObject"\/>/);
  assert.match(slideXml(8), /<p:transition spd="slow"><p:wipe\/>/);
  assert.match(slideXml(9), /<p:transition spd="slow"><p:push dir="u"\/>/);
  assert.match(slideXml(11), /<p:transition spd="slow"><p:wipe\/>/);
  assert.match(slideXml(12), /p14:dur="800"><p:circle\/>/);
  assert.match(slideXml(13), /<p:transition spd="slow"><p:push dir="u"\/>/);
  assert.match(slideXml(14), /<p:transition spd="med" p14:dur="700"><p:fade\/>/);
});
