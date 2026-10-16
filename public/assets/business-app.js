(function initBusinessApp() {
  "use strict";
  const $ = id => document.getElementById(id);
  const currency = value => (Number(value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const decimal = value => (Number(value) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const percent = value => (Number(value) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
  const blankPartner = () => ({
    name: "", age: 0, share: 0, wlCoverage: 0, wlPremium: 0,
    termCoverage: 0, termPremium: 0, termYears: 0,
    surrenderValues: Array(20).fill(0),
  });
  let partners = [blankPartner()];
  let currentId = null, currentRevision = null, searchTimer = null;

  function parseNumber(raw) {
    const value = String(raw ?? "").trim().replace(/[^\d,.-]/g, "");
    if (!value) return 0;
    const parsed = value.includes(",")
      ? Number(value.replace(/\./g, "").replace(",", "."))
      : /^\d{1,3}(\.\d{3})+$/.test(value) ? Number(value.replace(/\./g, "")) : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : NaN;
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  }
  function field(label, key, value, options) {
    const attrs = options || "";
    return '<div class="field"><label>' + label + '<input data-field="' + key + '" value="' +
      escapeHtml(value) + '" ' + attrs + ' /></label></div>';
  }
  function renderPartners() {
    const target = $("partnerList");
    target.innerHTML = "";
    partners.forEach((partner, index) => {
      const card = document.createElement("section");
      card.className = "partner-card";
      card.dataset.partnerIndex = String(index);
      const values = partner.surrenderValues || [];
      const rows = Array.from({ length: 20 }, (_, yearIndex) => {
        const year = yearIndex + 1;
        const fixed = year <= 2;
        const value = fixed ? "0,00" : values[yearIndex] ? decimal(values[yearIndex]) : "";
        return '<tr><td>' + year + '</td><td>' + (partner.age ? partner.age + yearIndex : "—") +
          '</td><td><input data-year="' + yearIndex + '" inputmode="decimal" aria-label="Resgate no ano ' + year +
          '" value="' + escapeHtml(value) + '" ' + (fixed ? "disabled" : "") + ' /></td></tr>';
      }).join("");
      card.innerHTML =
        '<div class="partner-head"><div><span>SÓCIO ' + (index + 1) + '</span><h3>' +
          escapeHtml(partner.name || "Novo sócio") +
          '</h3></div><button class="remove-partner" type="button" data-action="remove" aria-label="Remover sócio ' +
          (index + 1) + '">Remover</button></div>' +
        '<div class="partner-grid">' +
          '<div class="group-label">PARTICIPAÇÃO</div>' +
          field("Nome completo", "name", partner.name, 'maxlength="160" required class="partner-name"') +
          field("Idade atual", "age", partner.age || "", 'type="number" min="18" max="100" step="1" inputmode="numeric"') +
          field("Participação na empresa (%)", "share", partner.share ? decimal(partner.share) : "", 'inputmode="decimal" data-percent') +
          '<div class="group-label">COTAÇÃO WL10</div>' +
          field("Capital segurado inicial (R$)", "wlCoverage", partner.wlCoverage ? decimal(partner.wlCoverage) : "", 'inputmode="decimal" data-money') +
          field("Prêmio anual inicial (R$)", "wlPremium", partner.wlPremium ? decimal(partner.wlPremium) : "", 'inputmode="decimal" data-money') +
          '<p class="quote-note">Os 10 aportes anuais são projetados pelo IPCA informado acima.</p>' +
          '<div class="group-label">COTAÇÃO TEMPORÁRIA (OPCIONAL)</div>' +
          field("Capital temporário (R$)", "termCoverage", partner.termCoverage ? decimal(partner.termCoverage) : "", 'inputmode="decimal" data-money') +
          field("Prêmio anual temporário (R$)", "termPremium", partner.termPremium ? decimal(partner.termPremium) : "", 'inputmode="decimal" data-money') +
          field("Vigência (anos)", "termYears", partner.termYears || "", 'type="number" min="1" max="40" step="1" inputmode="numeric"') +
          '<details class="surrender-details"><summary>Valores de resgate da cotação WL10</summary>' +
            '<div class="surrender-controls"><label>Importar PDF da seguradora<input type="file" data-action="pdf" accept="application/pdf,.pdf" /></label>' +
              '<span data-import-status>Ou cole a coluna de resgate abaixo. O arquivo não é enviado ao banco.</span></div>' +
            '<textarea class="surrender-paste" data-paste placeholder="Cole uma coluna de valores, começando no ano 1, ou uma tabela com a coluna de resgate no fim."></textarea>' +
            '<button class="btn secondary" type="button" data-action="paste">Aplicar valores colados</button>' +
            '<div class="surrender-table-wrap"><table class="surrender-table"><thead><tr><th>Ano</th><th>Idade</th><th>Resgate informado (R$)</th></tr></thead><tbody>' +
              rows + '</tbody></table></div>' +
          '</details>' +
        '</div>';
      target.appendChild(card);
    });
    $("addPartnerBtn").disabled = partners.length >= 8;
  }
  function readPartners() {
    return [...document.querySelectorAll(".partner-card")].map(card => {
      const read = name => card.querySelector('[data-field="' + name + '"]')?.value ?? "";
      return {
        name: read("name").trim(), age: Number(read("age")) || 0,
        share: parseNumber(read("share")), wlCoverage: parseNumber(read("wlCoverage")),
        wlPremium: parseNumber(read("wlPremium")), termCoverage: parseNumber(read("termCoverage")),
        termPremium: parseNumber(read("termPremium")), termYears: Number(read("termYears")) || 0,
        surrenderValues: Array.from({ length: 20 }, (_, index) => index < 2 ? 0 :
          parseNumber(card.querySelector('[data-year="' + index + '"]')?.value)),
      };
    });
  }
  function readForm() {
    return {
      kind: "business",
      companyName: $("companyName").value.trim(),
      cnpj: $("cnpj").value.trim(),
      consultant: $("consultant").value,
      valuation: parseNumber($("valuation").value),
      ipca: parseNumber($("ipca").value),
      partners: readPartners(),
    };
  }
  function setStatus(id, message, state) {
    const node = $(id);
    node.textContent = message;
    node.className = "status-line " + (state || "");
  }
  function renderSummary() {
    const data = readForm();
    $("sumValuation").textContent = currency(data.valuation);
    $("sumShares").textContent = percent(data.partners.reduce((sum, p) => sum + (p.share || 0), 0));
    $("sumCoverage").textContent = currency(data.partners.reduce((sum, p) => sum + (p.wlCoverage || 0), 0));
    $("sumPremium").textContent = currency(data.partners.reduce((sum, p) => sum + (p.wlPremium || 0), 0));
    const list = $("partnerSummary");
    list.textContent = "";
    data.partners.forEach((partner, index) => {
      const item = document.createElement("article");
      const title = document.createElement("strong");
      title.textContent = partner.name || "Sócio " + (index + 1);
      const detail = document.createElement("span");
      detail.textContent = percent(partner.share) + " da empresa · participação de " +
        currency(window.BusinessModel.participationValue(data.valuation, partner.share));
      item.append(title, detail); list.appendChild(item);
    });
  }
  async function request(url, options = {}) {
    const response = await fetch(url, { ...options, cache: "no-store",
      headers: { "content-type": "application/json", ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Falha ao acessar o banco (" + response.status + ").");
    return data;
  }
  function renderStudyList(studies) {
    const list = $("studyList"); list.textContent = "";
    if (!studies.length) {
      const empty = document.createElement("p"); empty.className = "study-list-empty"; empty.textContent = "Nenhuma empresa encontrada."; list.appendChild(empty); return;
    }
    studies.forEach(study => {
      const card = document.createElement("article"); card.className = "study-record" + (study.id === currentId ? " active" : "");
      const open = document.createElement("button"); open.type = "button"; open.className = "study-record-open";
      const title = document.createElement("strong"); title.textContent = study.client_first_name;
      const subtitle = document.createElement("span");
      subtitle.textContent = currency((Number(study.total_assets_cents) || 0) / 100) + " · versão " + study.revision;
      open.append(title, subtitle); open.addEventListener("click", () => loadStudy(study.id));
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "study-delete";
      remove.setAttribute("aria-label", "Excluir estudo de " + study.client_first_name); remove.textContent = "×";
      remove.addEventListener("click", () => deleteStudy(study));
      card.append(open, remove); list.appendChild(card);
    });
  }
  async function loadList() {
    setStatus("databaseStatus", "Carregando estudos…");
    try {
      const query = $("studySearch").value.trim();
      const result = await request("/api/business-studies?q=" + encodeURIComponent(query));
      renderStudyList(result.studies || []);
      const count = (result.studies || []).length;
      setStatus("databaseStatus", count + (count === 1 ? " estudo encontrado." : " estudos encontrados."), "success");
    } catch (error) { setStatus("databaseStatus", error.message, "error"); }
  }
  async function loadStudy(id) {
    try {
      const result = await request("/api/business-studies/" + encodeURIComponent(id));
      const data = result.study.payload;
      $("companyName").value = data.companyName || "";
      $("cnpj").value = data.cnpj || "";
      $("consultant").value = data.consultant || "fabio";
      $("valuation").value = data.valuation ? decimal(data.valuation) : "";
      $("ipca").value = decimal(data.ipca ?? 5);
      partners = Array.isArray(data.partners) && data.partners.length ? data.partners : [blankPartner()];
      renderPartners(); renderSummary();
      currentId = result.study.id; currentRevision = result.study.revision;
      $("studyMeta").textContent = data.companyName + " · versão " + currentRevision;
      await loadList();
      setStatus("databaseStatus", "Estudo de " + data.companyName + " carregado.", "success");
      $("businessForm").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) { setStatus("databaseStatus", error.message, "error"); }
  }
  async function deleteStudy(study) {
    if (!window.confirm("Excluir definitivamente o estudo de " + study.client_first_name + "?")) return;
    try {
      await request("/api/business-studies/" + encodeURIComponent(study.id), { method: "DELETE" });
      if (currentId === study.id) { currentId = null; currentRevision = null; $("studyMeta").textContent = "Novo estudo ainda não salvo."; }
      await loadList();
      setStatus("databaseStatus", "Estudo excluído.", "success");
    } catch (error) { setStatus("databaseStatus", error.message, "error"); }
  }
  function verifyData(data, forExport) {
    if (!data.companyName) throw new Error("Informe o nome da empresa.");
    if (!Number.isFinite(data.valuation) || !Number.isFinite(data.ipca)) throw new Error("Confira os valores da empresa.");
    const share = data.partners.reduce((sum, partner) => sum + partner.share, 0);
    if (data.partners.some(partner => !partner.name)) throw new Error("Informe o nome de todos os sócios.");
    if (data.partners.some(partner => !Number.isFinite(partner.share) || partner.share < 0)) throw new Error("Confira as participações dos sócios.");
    if (data.partners.some(partner => [partner.wlCoverage, partner.wlPremium, partner.termCoverage, partner.termPremium, ...partner.surrenderValues].some(value => !Number.isFinite(value)))) {
      throw new Error("Confira os valores das cotações.");
    }
    if (share > 100.01) throw new Error("A soma das participações não pode superar 100%.");
    if (!forExport) return;
    if (data.valuation <= 0) throw new Error("Informe o valuation para gerar a apresentação.");
    if (Math.abs(share - 100) > 0.01) throw new Error("As participações devem somar 100% para gerar a apresentação.");
    if (data.partners.some(partner => !partner.age || partner.age < 18 || partner.age > 100)) throw new Error("Informe a idade de todos os sócios.");
    if (data.partners.some(partner => partner.share <= 0 || partner.wlCoverage <= 0 || partner.wlPremium <= 0)) {
      throw new Error("Informe participação, capital WL10 e prêmio anual de todos os sócios.");
    }
    if ([...document.querySelectorAll(".partner-card")].some(card =>
      [...card.querySelectorAll("[data-year]")].some(input => Number(input.dataset.year) >= 2 && !input.value.trim()))) {
      throw new Error("Preencha os resgates dos anos 3 a 20 para todos os sócios antes de gerar.");
    }
    if (data.partners.some(partner => {
      const anyTerm = partner.termCoverage || partner.termPremium || partner.termYears;
      return anyTerm && !(partner.termCoverage > 0 && partner.termPremium > 0 && partner.termYears > 0);
    })) throw new Error("Complete capital, prêmio e vigência de cada cotação temporária iniciada.");
  }
  async function saveStudy() {
    if (!$("businessForm").reportValidity()) return;
    const button = $("saveStudyBtn"); button.disabled = true;
    try {
      const data = readForm(); verifyData(data, false);
      if (currentId) data.expectedRevision = currentRevision;
      const response = await request(currentId ? "/api/business-studies/" + currentId : "/api/business-studies", {
        method: currentId ? "PUT" : "POST", body: JSON.stringify(data),
      });
      currentId = response.id; currentRevision = response.revision;
      $("studyMeta").textContent = data.companyName + " · versão " + currentRevision;
      await loadList();
      setStatus("formStatus", "Estudo salvo com sucesso.", "success");
    } catch (error) { setStatus("formStatus", error.message, "error"); }
    finally { button.disabled = false; }
  }
  function safeFilename(name) {
    return String(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 70) || "Empresa";
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = name; document.body.appendChild(link); link.click();
    setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 1000);
  }
  async function generate(kind) {
    if (!$("businessForm").reportValidity()) return;
    const ppt = $("generatePptBtn"), pdf = $("generatePdfBtn");
    ppt.disabled = true; pdf.disabled = true;
    try {
      const data = readForm(); verifyData(data, true);
      setStatus("formStatus", "Montando " + (kind === "pdf" ? "o PDF" : "o PowerPoint") + "…");
      const blob = await window.BusinessDeck.create(data, kind);
      download(blob, "Sucessao-Empresarial-" + safeFilename(data.companyName) + "." + kind);
      setStatus("formStatus", "Arquivo gerado com os dados de " + data.partners.length + " sócio(s).", "success");
    } catch (error) { setStatus("formStatus", error.message, "error"); }
    finally { ppt.disabled = false; pdf.disabled = false; }
  }
  function applyPaste(card) {
    const content = card.querySelector("[data-paste]").value.trim();
    if (!content) return;
    const values = [];
    content.split(/\r?\n/).forEach(line => {
      if (/ano\s+(?:de\s+)?(?:emiss[aã]o|contrata[cç][aã]o)/i.test(line)) return;
      const matches = line.match(/(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?|\d+\.\d{2}/g);
      if (!matches?.length || (/^\s*ano\s+\d+\s*$/i.test(line))) return;
      values.push(parseNumber(matches[matches.length - 1]));
    });
    if (!values.length) { card.querySelector("[data-import-status]").textContent = "Nenhum valor reconhecido."; return; }
    values.slice(0, 20).forEach((value, index) => {
      const input = card.querySelector('[data-year="' + index + '"]');
      if (input && index >= 2) input.value = decimal(value);
    });
    card.querySelector("[data-import-status]").textContent = Math.min(values.length, 20) + " valores aplicados. Revise a tabela.";
    renderSummary();
  }
  async function importPdf(card, file) {
    const status = card.querySelector("[data-import-status]");
    if (!file) return;
    if (!window.SurrenderPdf?.extractSurrenderValues) { status.textContent = "Leitor de PDF indisponível."; return; }
    const age = Number(card.querySelector('[data-field="age"]').value) || 0;
    status.textContent = "Lendo PDF localmente…";
    try {
      const result = await window.SurrenderPdf.extractSurrenderValues(file, { currentAge: age, maxValues: 40 });
      if (result.confidence !== "high") { status.textContent = "A tabela não foi reconhecida com segurança. Preencha os valores manualmente."; return; }
      const indices = result.presentIndices || result.values.map((_, index) => index);
      indices.forEach(index => {
        if (index < 2 || index >= 20) return;
        const input = card.querySelector('[data-year="' + index + '"]');
        if (input) input.value = decimal(result.values[index] || 0);
      });
      status.textContent = "Valores de " + file.name + " aplicados. Revise a tabela antes de gerar.";
    } catch (error) { status.textContent = error.message || "Não foi possível ler este PDF."; }
  }
  $("partnerList").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const card = button.closest(".partner-card");
    if (button.dataset.action === "paste") { applyPaste(card); return; }
    if (button.dataset.action === "remove") {
      partners = readPartners();
      partners.splice(Number(card.dataset.partnerIndex), 1);
      if (!partners.length) partners = [blankPartner()];
      renderPartners(); renderSummary();
    }
  });
  $("partnerList").addEventListener("change", event => {
    if (event.target.matches('input[data-action="pdf"]')) importPdf(event.target.closest(".partner-card"), event.target.files?.[0]);
  });
  $("partnerList").addEventListener("input", event => {
    if (event.target.matches(".partner-name")) {
      event.target.closest(".partner-card").querySelector("h3").textContent = event.target.value.trim() || "Novo sócio";
    }
    if (event.target.matches('[data-field="age"]')) {
      const age = Number(event.target.value) || 0;
      event.target.closest(".partner-card").querySelectorAll(".surrender-table tbody tr").forEach((row, index) => {
        row.children[1].textContent = age ? String(age + index) : "—";
      });
    }
    renderSummary();
  });
  $("addPartnerBtn").addEventListener("click", () => {
    partners = readPartners(); if (partners.length >= 8) return;
    partners.push(blankPartner()); renderPartners(); renderSummary();
    document.querySelector(".partner-card:last-child .partner-name")?.focus();
  });
  $("newStudyBtn").addEventListener("click", () => {
    if (currentId && !window.confirm("Iniciar novo estudo? Alterações não salvas serão descartadas.")) return;
    $("businessForm").reset(); $("valuation").value = ""; $("ipca").value = "5,00";
    partners = [blankPartner()]; currentId = null; currentRevision = null;
    renderPartners(); renderSummary();
    $("studyMeta").textContent = "Novo estudo ainda não salvo.";
    setStatus("formStatus", "Novo estudo iniciado."); loadList(); $("companyName").focus();
  });
  $("saveStudyBtn").addEventListener("click", saveStudy);
  $("businessForm").addEventListener("submit", event => { event.preventDefault(); generate("pptx"); });
  $("generatePdfBtn").addEventListener("click", () => generate("pdf"));
  $("refreshStudiesBtn").addEventListener("click", loadList);
  $("studySearch").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadList, 250); });
  $("businessForm").addEventListener("input", event => {
    if (!event.target.closest(".partner-card")) renderSummary();
  });
  $("businessForm").addEventListener("blur", event => {
    if (event.target.matches("[data-money], [data-percent], [data-year]") && event.target.value.trim()) {
      const value = parseNumber(event.target.value);
      if (Number.isFinite(value)) event.target.value = decimal(value);
    }
  }, true);
  renderPartners(); renderSummary(); loadList();
})();
