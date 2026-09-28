import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const TEST_USERNAME = "altavista";
const TEST_PASSWORD = "test-password";

function basicAuthorization(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

async function render(credentials = { username: TEST_USERNAME, password: TEST_PASSWORD }, pathname = "/", configured = true) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const headers = { accept: "text/html" };
  if (credentials) headers.authorization = basicAuthorization(credentials.username, credentials.password);
  return worker.fetch(new Request(`http://localhost${pathname}`, { headers }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    BASIC_AUTH_USERNAME: configured ? TEST_USERNAME : undefined,
    BASIC_AUTH_PASSWORD: configured ? TEST_PASSWORD : undefined,
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("fails closed without valid login credentials", async () => {
  for (const pathname of ["/", "/legacy-v7.html", "/assets/modelo-base.pptx"]) {
    const anonymous = await render(null, pathname);
    assert.equal(anonymous.status, 401);
    assert.match(anonymous.headers.get("www-authenticate") ?? "", /^Basic realm=/);
  }

  const invalid = await render({ username: TEST_USERNAME, password: "wrong-password" });
  assert.equal(invalid.status, 401);

  const missingConfiguration = await render(null, "/", false);
  assert.equal(missingConfiguration.status, 503);
  assert.equal(missingConfiguration.headers.get("www-authenticate"), null);
});

test("server-renders the consolidated generator", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'self'/);
  const html = await response.text();
  assert.match(html, /<title>Gestão de Riscos — Gerador Completo<\/title>/i);
  assert.match(html, /src=["']\/legacy-v7\.html["']/i);
  assert.match(html, /Gerador de apresentação de gestão de riscos/i);
});

test("keeps the form and export contract wired", async () => {
  const [page, layout, legacy, app, template, appCss, studyRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/legacy-v7.html", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/template-ppt.js", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/app.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/studies/[id]/route.ts", import.meta.url), "utf8"),
  ]);
  const templateV28 = await readFile(new URL("../public/assets/template-ppt-v28.js", import.meta.url), "utf8");
  assert.match(page, /src="\/legacy-v7\.html"/);
  assert.match(layout, /generateMetadata\(\): Promise<Metadata>/);
  assert.match(legacy, /id="clientFirstName"/);
  assert.match(legacy, /id="clientLastName"/);
  assert.match(legacy, /id="maritalRegime"[^>]*disabled/);
  assert.match(legacy, /Comunhão universal de bens/);
  assert.match(legacy, /Comunhão parcial de bens/);
  assert.match(legacy, /Separação de bens/);
  assert.match(legacy, /id="spouseCoverageGap"[^>]*data-money-input/);
  assert.match(legacy, /id="spouseAnnualPremium"[^>]*data-money-input/);
  assert.match(legacy, /id="spouseSurrenderInputs"/);
  assert.match(legacy, /src="assets\/study-model\.js\?v=1"/);
  assert.match(legacy, /data-study="primary"/);
  assert.match(legacy, /data-study="spouse"/);
  assert.match(legacy, /id="coverageGap"[^>]*data-money-input/);
  assert.match(legacy, /id="generatePptBtn"/);
  assert.match(legacy, /id="generatePdfBtn"/);
  assert.match(legacy, /id="studyVaultTitle"/);
  assert.match(legacy, /id="saveStudyBtn"/);
  assert.match(legacy, /id="studySearch"/);
  assert.doesNotMatch(legacy, /id="healthProfile"|id="spouseHealthProfile"/);
  assert.match(legacy, /id="healthProfileCard"/);
  assert.match(legacy, /id="previewHealthProfile">\?</);
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
  assert.match(app, /function databasePayload\(\)/);
  assert.match(app, /\/api\/studies/);
  assert.match(app, /async function saveStudy\(\)/);
  assert.match(app, /async function deleteStudy\(study,button\)/);
  assert.match(app, /method:'DELETE'/);
  assert.match(app, /Excluir definitivamente o estudo de/);
  assert.match(app, /className='study-delete-icon'/);
  assert.match(appCss, /\.study-delete\{[^}]*border:0[^}]*background:transparent[^}]*color:#d96b74/);
  assert.match(appCss, /\.study-delete:hover,\.study-delete:focus-visible\{[^}]*color:#ff707a/);
  assert.match(appCss, /\.study-record \.study-delete-icon\{[^}]*border:1\.5px solid currentColor/);
  assert.match(studyRoute, /export async function DELETE/);
  assert.match(studyRoute, /DELETE FROM risk_studies WHERE id = \?/);
  assert.match(app, /maritalRegime:hasSpouse\?\$\('maritalRegime'\)\.value:''/);
  assert.match(app, /maritalRegime\.required=mode==='couple'/);
  assert.doesNotMatch(app, /healthProfile|spouseHealthProfile|ids\.health/);
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
  assert.match(appCss, /gauge-arc:after\{[^}]*width:6px;[^}]*background:#ff6b00;[^}]*box-shadow:/);
  assert.match(appCss, /gauge-arc\{background:conic-gradient\(from 270deg at 50% 100%,#ff4848 0 2%,#70b544 2% 16%/);
  assert.match(appCss, /gauge-arc>span\{color:#fff/);
  assert.match(template, /window\.buildTemplatePpt/);
  assert.match(legacy, /src="assets\/template-ppt-v28\.js\?v=35"/);
  assert.match(template, /slide===5\?'assets\/template-slides\/slide5-only-top-v7\.jpg'/);
  assert.match(template, /\[5,\(\)=>staticSlide\(5\)\]/);
  assert.match(template, /fetch\('assets\/modelo-base\.pptx\?v=3'\)/);
  assert.match(template, /window\.buildTemplatePdf/);
  assert.match(template, /fitText\(ctx,'15% - 20%'/);
  assert.match(template, /text\(ctx,'CAPITAL TOTAL DO CLIENTE'/);
  assert.match(template, /fitText\(ctx,brl\(d\.total\),455,794/);
  assert.match(template, /const label=pct\(actualShares\[i\]\*100\)/);
  assert.match(template, /donutPercentText\(ctx,label,lx-42,ly,84/);
  assert.match(template, /d\.annualPremium\/d\.total\*100:0,proposedAllocation=d\.withoutInsurance\?d\.annualPremium\/d\.withoutInsurance\*100:0/);
  assert.match(template, /ORANGE='#ff6b00'/);
  assert.match(template, /ctx\.lineWidth=6;ctx\.lineJoin='round'/);
  assert.match(template, /ctx\.shadowColor='rgba\(255,107,0,\.7\)'/);
  assert.doesNotMatch(template, /#e98b35/);
  assert.match(template, /text\(ctx,'Ótimo',[\s\S]*?color:WHITE/);
  assert.match(template, /text\(ctx,'Recomendado',[\s\S]*?color:WHITE/);
  assert.match(template, /text\(ctx,'Alta exposição',[\s\S]*?color:WHITE/);
  assert.match(template, /const studySlideNumbers=\[6,7,8,9,10,11,12,15,16,13\]/);
  assert.match(template, /const projectionSlideNumbers=\[11,12,15,16\]/);
  assert.match(template, /function combineStudiesForPpt\(d,studies\)/);
  assert.match(template, /studyLabel:'Estudo familiar consolidado'/);
  assert.match(template, /async function cloneHiddenProjectionSlides\(zip\)/);
  assert.match(template, /const legalInfoSlides=\[/);
  assert.match(template, /Lei 15\.040\/2024 · arts\. 113 a 116/);
  assert.match(template, /Lei 15\.040\/2024 · arts\. 114 e 117/);
  assert.match(template, /Lei 15\.040\/2024 · art\. 122  \|  CPC · art\. 833, VI/);
  assert.match(template, /async function prepareLegalInfoSlides\(zip\)/);
  assert.match(template, /const legalTargets=await prepareLegalInfoSlides\(zip\)/);
  assert.match(template, /benefitPanel\(ctx,1148,600,405,242,[\s\S]*?\{infoIcons:true\}\)/);
  assert.match(template, /addSlideJumpHotspot\(zip,16,legalTargets/);
  assert.match(template, /async function addShowJumpHotspot\(zip,sourceSlide/);
  assert.match(template, /jump='lastslideviewed'/);
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
  assert.match(template, /const directionX=Math\.cos\(angle\),directionY=Math\.sin\(angle\),normalX=-directionY,normalY=directionX/);
  assert.match(template, /ctx\.moveTo\(tipX,tipY\).*ctx\.lineTo\(baseX\+normalX\*needleHalfWidth,baseY\+normalY\*needleHalfWidth\)/);
  assert.match(template, /ctx\.arc\(cx,cy,15,0,Math\.PI\*2\)/);
  assert.doesNotMatch(template, /markerX1/);
  assert.match(template, /text\(ctx,'PERFIL DE SAÚDE'/);
  assert.match(template, /text\(ctx,'\?',1110,738,410,\{size:92/);
  assert.match(template, /text\(ctx,'A PREENCHER'/);
  assert.doesNotMatch(template, /healthProfile|INFORMADO NO DIAGNÓSTICO/);
  assert.match(template, /monthsAtRate\(d,rate\)/);
  assert.match(template, /const surname=\(d\.lastName\|\|d\.firstName\|\|'Cliente'\)/);
  assert.match(template, /const cleanBand=ctx\.createLinearGradient\(0,716,0,794\)/);
  assert.doesNotMatch(template, /getImageData|createImageData|putImageData/);
  assert.match(template, /surnameX=\(W-surnameWidth\)\/2/);
  assert.doesNotMatch(template, /const texture=document\.createElement\('canvas'\)/);
  assert.doesNotMatch(template, /applyTransitionsToAllSlides/);
  assert.doesNotMatch(template, /await preparePlanningStages/);
  assert.doesNotMatch(template, /\[2,\(\)=>planningStage0\(\)\]/);
  assert.doesNotMatch(template, /\[17,\(\)=>staticSlide\(2\)\]/);
  assert.match(template, /\[5,await staticSlide\(5\)\]/);
  assert.match(template, /for\(const study of studies\)rendered\.push\(\.\.\.await renderStudySlides\(study\)\)/);
  assert.match(template, /arrowCenters=\[368,578,808\]/);
  assert.match(templateV28, /arrowCenters=\[368,578,808\]/);
  assert.match(template, /function justifiedRowCenters\(top,bottom,count,rowHeight=32\)/);
  assert.match(templateV28, /function justifiedRowCenters\(top,bottom,count,rowHeight=32\)/);
  assert.match(template, /function downArrow\(ctx,cx,cy\)/);
  assert.match(template, /lineTo\(x\+6,y\+14\)/);
  assert.match(template, /rect\(ctx,82,326,1436,276/);
  assert.match(template, /rect\(ctx,82,618,1436,58/);
  assert.doesNotMatch(template, /ALCANCE E LIMITES|info\.limit/);
  assert.match(template, /for\(let i=11;i<Math\.min\(18,rows\.length\);i\+\+\)/);
  assert.match(template, /const cloneBase=\(await read\('ppt\/slides\/slide11\.xml'\)\).*?<p:timing/);
  assert.match(template, /const sourceXml=\(await read\('ppt\/slides\/slide2\.xml'\)\).*?<p:timing/);
  assert.match(template, /const sourceRels=.*?\/notesSlide/);
  assert.match(template, /slide17\.xml\.rels',sourceRels/);
});

test("keeps the authenticated D1 study database contract wired", async () => {
  const [hosting, schema, listRoute, detailRoute, worker] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/studies/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/studies/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);

  assert.equal(JSON.parse(hosting).d1, "DB");
  assert.match(schema, /sqliteTable\(\s*"risk_studies"/);
  assert.match(schema, /sqliteTable\(\s*"risk_study_revisions"/);
  assert.match(schema, /idx_risk_studies_client_name/);
  assert.match(schema, /uidx_risk_study_revisions_study_revision/);
  assert.match(listRoute, /INSERT INTO risk_studies/);
  assert.match(listRoute, /INSERT INTO risk_study_revisions/);
  assert.match(detailRoute, /revision = \?, updated_by = \?, updated_at = \?/);
  assert.match(detailRoute, /status: 409/);
  assert.match(worker, /hasValidBasicCredentials/);
  assert.match(worker, /if \(!await hasValidBasicCredentials\(request, env\)\)/);
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
