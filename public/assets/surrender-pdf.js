(function initSurrenderPdf(global) {
  "use strict";

  const MAX_FILE_BYTES = 25 * 1024 * 1024;
  const MAX_PAGES = 80;
  const MIN_CONFIDENT_ROWS = 5;
  const HEADER_RE = /\b(?:RESGATE|RESERVA\s+RESGAT(?:ÁVEL|AVEL|\?VEL)|RESERVA\s+FINANCEIRA|VALOR\s+DA\s+RESERVA|CASH\s+VALUE|SURRENDER(?:\s+VALUE)?)\b/i;
  const MONEY_RE = /(?:R\$|BRL|US\$)?\s*-?\(?(?:(?:\d{1,3}(?:[.\s]\d{3})+|\d+),\d{2}|(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})\)?|(?:R\$|BRL|US\$)\s*-?\(?\d+\)?/gi;
  let pdfJsPromise;

  class SurrenderPdfError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "SurrenderPdfError";
      this.code = code;
    }
  }

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function parseMoneyToken(value) {
    const raw = String(value ?? "").replace(/\u00a0/g, " ").trim();
    if (!/\d/.test(raw)) return null;
    const negative = /-/.test(raw) || /^\s*\(.*\)\s*$/.test(raw);
    let numeric = raw.replace(/[^\d.,]/g, "");
    if (!numeric) return null;

    const lastComma = numeric.lastIndexOf(",");
    const lastDot = numeric.lastIndexOf(".");
    let decimalSeparator = "";
    if (lastComma >= 0 && lastDot >= 0) {
      decimalSeparator = lastComma > lastDot ? "," : ".";
    } else {
      const separator = lastComma >= 0 ? "," : lastDot >= 0 ? "." : "";
      if (separator) {
        const last = numeric.lastIndexOf(separator);
        const decimalDigits = numeric.length - last - 1;
        if (decimalDigits === 1 || decimalDigits === 2) decimalSeparator = separator;
      }
    }

    if (decimalSeparator) {
      const decimalIndex = numeric.lastIndexOf(decimalSeparator);
      const integerPart = numeric.slice(0, decimalIndex).replace(/[.,]/g, "");
      const decimalPart = numeric.slice(decimalIndex + 1).replace(/[.,]/g, "");
      numeric = `${integerPart || "0"}.${decimalPart}`;
    } else {
      numeric = numeric.replace(/[.,]/g, "");
    }

    const parsed = Number(numeric);
    return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : null;
  }

  function itemGeometry(item) {
    const transform = Array.isArray(item?.transform) ? item.transform : [];
    const x = Number(transform[4]) || 0;
    const y = Number(transform[5]) || 0;
    const width = Math.max(Number(item?.width) || String(item?.str ?? "").length * 5, 1);
    return { str: String(item?.str ?? "").replace(/\u00a0/g, " ").trim(), x, y, width, center: x + width / 2 };
  }

  function groupItemsByLine(items, tolerance = 3) {
    const tokens = (items || []).map(itemGeometry).filter(item => item.str);
    tokens.sort((a, b) => Math.abs(b.y - a.y) > tolerance ? b.y - a.y : a.x - b.x);
    const lines = [];
    for (const token of tokens) {
      let line = lines.find(candidate => Math.abs(candidate.y - token.y) <= tolerance);
      if (!line) {
        line = { y: token.y, items: [] };
        lines.push(line);
      }
      line.items.push(token);
      line.y = line.items.reduce((sum, item) => sum + item.y, 0) / line.items.length;
    }
    lines.forEach(line => {
      line.items.sort((a, b) => a.x - b.x);
      line.text = line.items.map(item => item.str).join(" ").replace(/\s+/g, " ").trim();
    });
    return lines.sort((a, b) => b.y - a.y);
  }

  function headerCategory(text) {
    const normalized = normalizeText(text);
    if (HEADER_RE.test(normalized)) return "surrender";
    if (/\b(?:ANO|YEAR|TEMPO)\b/.test(normalized)) return "year";
    if (/\b(?:IDADE|AGE)\b/.test(normalized)) return "age";
    if (/\b(?:CAPITAL|COBERTURA|BENEFICIO)\b/.test(normalized)) return "capital";
    if (/\b(?:PREMIO|APORTE|PAGAMENTO)\b/.test(normalized)) return "premium";
    if (/\b(?:ACUMULADO|TOTAL\s+PAGO)\b/.test(normalized)) return "accumulated";
    return null;
  }

  function surrenderHeaderPriority(text) {
    const normalized = normalizeText(text);
    if (/LIQUID/.test(normalized)) return 3;
    if (/BRUT/.test(normalized)) return 1;
    return 2;
  }

  function findHeaders(lines) {
    const headers = [];
    lines.forEach((line, lineIndex) => {
      if (!HEADER_RE.test(normalizeText(line.text))) return;
      const nearby = lines.filter(candidate => Math.abs(candidate.y - line.y) <= 22);
      const anchors = new Map();
      const surrenderCandidates = [];
      for (const candidateLine of nearby) {
        const candidateItems = [...candidateLine.items];
        for (let itemIndex = 0; itemIndex < candidateLine.items.length - 1; itemIndex += 1) {
          const first = candidateLine.items[itemIndex];
          const second = candidateLine.items[itemIndex + 1];
          const combined = `${first.str} ${second.str}`;
          if (HEADER_RE.test(normalizeText(combined))) {
            candidateItems.push({
              ...first,
              str: combined,
              x: first.x,
              width: second.x + second.width - first.x,
              center: (first.center + second.center) / 2,
            });
          }
        }
        for (const item of candidateItems) {
          const category = headerCategory(item.str);
          if (!category) continue;
          if (category === "surrender") surrenderCandidates.push({ center: item.center, text: item.str });
          const existing = anchors.get(category);
          const distance = Math.abs(candidateLine.y - line.y);
          const priority = category === "surrender" ? surrenderHeaderPriority(item.str) : 0;
          const shouldReplace = !existing
            || distance < Math.abs(existing.y - line.y)
            || (category === "surrender" && distance === Math.abs(existing.y - line.y) && (priority > existing.priority || (priority === existing.priority && item.center > existing.center)));
          if (shouldReplace) {
            anchors.set(category, { center: item.center, y: candidateLine.y, text: item.str, priority });
          }
        }
      }
      const surrender = anchors.get("surrender") || line.items.map(item => ({ item, normalized: normalizeText(item.str) })).find(entry => HEADER_RE.test(entry.normalized))?.item;
      if (!surrender) return;
      const distinctSurrenderColumns = surrenderCandidates
        .sort((a, b) => a.center - b.center)
        .filter((candidate, index, all) => index === 0 || Math.abs(candidate.center - all[index - 1].center) > 35);
      const lineSurrenderColumns = line.items
        .filter(item => HEADER_RE.test(normalizeText(item.str)))
        .map(item => ({ center: item.center, text: item.str }))
        .sort((a, b) => a.center - b.center)
        .filter((candidate, index, all) => index === 0 || Math.abs(candidate.center - all[index - 1].center) > 35);
      const nearbyText = normalizeText(nearby.map(candidate => candidate.text).join(" "));
      const ambiguous = distinctSurrenderColumns.length > 1 || (/BRUT/.test(nearbyText) && /LIQUID/.test(nearbyText));
      const tableHeaderShape = ["year", "capital", "premium", "accumulated"].some(category => anchors.has(category));
      const headerAmbiguous = tableHeaderShape && (lineSurrenderColumns.length > 1 || (/BRUT/.test(normalizeText(line.text)) && /LIQUID/.test(normalizeText(line.text))));
      const surrenderX = Number(surrender.center) || Number(surrender.x) || 0;
      const otherCenters = [...anchors.entries()]
        .filter(([category]) => category !== "surrender")
        .map(([, value]) => value.center)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      const previous = otherCenters.filter(center => center < surrenderX - 8).at(-1);
      const next = otherCenters.find(center => center > surrenderX + 8);
      headers.push({
        lineIndex,
        y: line.y,
        surrenderX,
        left: previous === undefined ? surrenderX - 170 : (previous + surrenderX) / 2,
        right: next === undefined ? surrenderX + 170 : (next + surrenderX) / 2,
        yearX: anchors.get("year")?.center,
        ageX: anchors.get("age")?.center,
        ambiguous: headerAmbiguous,
        text: line.text,
      });
    });
    return headers;
  }

  function moneyCandidates(line) {
    const candidates = [];
    for (const item of line.items) {
      MONEY_RE.lastIndex = 0;
      let match;
      while ((match = MONEY_RE.exec(item.str)) !== null) {
        const value = parseMoneyToken(match[0]);
        if (value === null) continue;
        const ratio = item.str.length ? (match.index + match[0].length / 2) / item.str.length : 0.5;
        candidates.push({ value, center: item.x + item.width * ratio, raw: match[0] });
      }
    }
    return candidates;
  }

  function integerCandidates(line) {
    return line.items.flatMap(item => {
      if (/R\$|BRL|US\$/i.test(item.str)) return [];
      const match = item.str.match(/^\s*(\d{1,4})\s*(?:º|°|ANOS?|YEARS?)?\s*$/i);
      if (!match) return [];
      return [{ value: Number(match[1]), center: item.center }];
    });
  }

  function nearestInteger(integers, x, maxDistance = 70) {
    if (!Number.isFinite(x)) return null;
    const ordered = integers.map(item => ({ ...item, distance: Math.abs(item.center - x) })).sort((a, b) => a.distance - b.distance);
    return ordered[0] && ordered[0].distance <= maxDistance ? ordered[0].value : null;
  }

  function sequenceQuality(indices) {
    if (!indices.length) return 0;
    const unique = [...new Set(indices)].sort((a, b) => a - b);
    return unique[0] === 0 && unique.every((value, index) => value === index) ? 1 : 0;
  }

  function parseTableAfterHeader(lines, header, options = {}) {
    const rows = [];
    let missesAfterRows = 0;
    for (let index = header.lineIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (HEADER_RE.test(normalizeText(line.text))) break;
      const amounts = moneyCandidates(line)
        .filter(candidate => candidate.center >= header.left && candidate.center <= header.right)
        .sort((a, b) => Math.abs(a.center - header.surrenderX) - Math.abs(b.center - header.surrenderX));
      if (!amounts.length) {
        const zeroPlaceholder = line.items
          .filter(item => /^(?:[-–—]+|N\/?A)$/i.test(item.str.trim()) && item.center >= header.left && item.center <= header.right)
          .sort((a, b) => Math.abs(a.center - header.surrenderX) - Math.abs(b.center - header.surrenderX))[0];
        if (zeroPlaceholder) amounts.push({ value: 0, center: zeroPlaceholder.center, raw: zeroPlaceholder.str });
      }
      const integers = integerCandidates(line);
      const hasRowMarker = integers.some(item => item.center < header.left);
      if (!amounts.length || !hasRowMarker) {
        if (rows.length) missesAfterRows += 1;
        if (missesAfterRows >= 8) break;
        continue;
      }

      const year = nearestInteger(integers, header.yearX);
      const age = nearestInteger(integers, header.ageX);
      let rowIndex = Number.isInteger(year) && year >= 1 && year <= 80 ? year - 1 : null;
      if (rowIndex === null && Number.isInteger(age) && Number.isFinite(options.currentAge)) {
        const ageIndex = age - Number(options.currentAge);
        if (ageIndex >= 0 && ageIndex <= 80) rowIndex = ageIndex;
      }
      if (rowIndex === null && !Number.isFinite(header.yearX) && !Number.isFinite(header.ageX)) {
        const possibleYear = integers.filter(item => item.center < header.left).map(item => item.value).find(value => value >= 1 && value <= 80);
        if (possibleYear !== undefined) rowIndex = possibleYear - 1;
      }

      rows.push({ index: rowIndex, value: Math.max(0, amounts[0].value), x: amounts[0].center, raw: amounts[0].raw });
      missesAfterRows = 0;
    }
    return rows;
  }

  function extractSurrenderValuesFromPages(pages, options = {}) {
    const maxValues = Math.max(1, Math.min(Number(options.maxValues) || 40, 80));
    const indexed = new Map();
    const sequential = [];
    let headerCount = 0;
    let ambiguousHeaderCount = 0;
    let textCharacters = 0;
    const alignments = [];

    (pages || []).forEach((items, pageIndex) => {
      const lines = groupItemsByLine(items);
      textCharacters += lines.reduce((sum, line) => sum + line.text.length, 0);
      const headers = findHeaders(lines);
      headerCount += headers.length;
      ambiguousHeaderCount += headers.filter(header => header.ambiguous).length;
      headers.forEach(header => {
        const rows = parseTableAfterHeader(lines, header, options);
        rows.forEach(row => {
          alignments.push(Math.abs(row.x - header.surrenderX));
          if (Number.isInteger(row.index) && row.index >= 0 && row.index < maxValues) {
            if (!indexed.has(row.index)) indexed.set(row.index, { ...row, pageIndex });
          } else {
            sequential.push({ ...row, pageIndex });
          }
        });
      });
    });

    let values = [];
    let indices = [];
    if (indexed.size) {
      indices = [...indexed.keys()].sort((a, b) => a - b);
      const lastIndex = Math.min(Math.max(...indices), maxValues - 1);
      values = Array.from({ length: lastIndex + 1 }, (_, index) => indexed.get(index)?.value ?? 0);
    } else {
      values = sequential.slice(0, maxValues).map(row => row.value);
    }

    const rowCount = indexed.size || sequential.length;
    const continuity = indexed.size ? sequenceQuality(indices) : rowCount >= 3 ? 0.8 : 0;
    const meanAlignment = alignments.length ? alignments.reduce((sum, value) => sum + value, 0) / alignments.length : Infinity;
    const presentIndices = indexed.size ? indices : values.map((_, index) => index);
    const confidence = headerCount > 0 && ambiguousHeaderCount === 0 && rowCount >= MIN_CONFIDENT_ROWS && continuity >= 0.65 && meanAlignment <= 130 ? "high" : rowCount >= 2 ? "medium" : "low";
    const reason = textCharacters < 30
      ? "no_text"
      : headerCount === 0
        ? "no_header"
        : ambiguousHeaderCount > 0
          ? "ambiguous_surrender_columns"
        : rowCount < MIN_CONFIDENT_ROWS
          ? "too_few_rows"
          : continuity < 0.65
            ? "non_sequential_rows"
            : meanAlignment > 130
              ? "misaligned_column"
              : null;

    return { values, presentIndices, confidence, reason, headerCount, ambiguousHeaderCount, rowCount, textCharacters };
  }

  function scriptBaseUrl() {
    if (typeof document === "undefined") return null;
    const ownScript = [...document.scripts].find(script => /\/surrender-pdf\.js(?:\?|$)/.test(script.src));
    return new URL(".", ownScript?.src || document.baseURI);
  }

  async function loadPdfJs() {
    if (!pdfJsPromise) {
      const base = scriptBaseUrl();
      if (!base) throw new SurrenderPdfError("runtime", "Leitor de PDF indisponível neste navegador.");
      const moduleUrl = new URL("pdfjs/pdf.min.mjs", base).href;
      const workerUrl = new URL("pdfjs/pdf.worker.min.mjs", base).href;
      pdfJsPromise = import(moduleUrl)
        .then(pdfjs => {
          pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
          return pdfjs;
        })
        .catch(error => {
          pdfJsPromise = undefined;
          throw error;
        });
    }
    return pdfJsPromise;
  }

  async function extractSurrenderValues(file, options = {}) {
    if (!file) throw new SurrenderPdfError("missing_file", "Selecione um arquivo PDF.");
    const filename = String(file.name || "cotação.pdf");
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(filename);
    if (!isPdf) throw new SurrenderPdfError("invalid_type", "O arquivo selecionado não é um PDF.");
    if (file.size > MAX_FILE_BYTES) throw new SurrenderPdfError("too_large", "O PDF excede o limite de 25 MB.");

    let loadingTask;
    let pdf;
    try {
      const pdfjs = await loadPdfJs();
      const bytes = new Uint8Array(await file.arrayBuffer());
      loadingTask = pdfjs.getDocument({ data: bytes, isEvalSupported: false });
      pdf = await loadingTask.promise;
      if (pdf.numPages > MAX_PAGES) throw new SurrenderPdfError("too_many_pages", "A cotação possui mais de 80 páginas.");
      const pages = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent({ disableNormalization: false });
        pages.push(content.items || []);
        page.cleanup();
      }
      return { ...extractSurrenderValuesFromPages(pages, options), pageCount: pdf.numPages, filename };
    } catch (error) {
      if (error instanceof SurrenderPdfError) throw error;
      const name = String(error?.name || "");
      if (/PasswordException/i.test(name)) throw new SurrenderPdfError("password", "O PDF é protegido por senha e não pôde ser lido.");
      if (/InvalidPDFException|MissingPDFException|UnexpectedResponseException/i.test(name)) throw new SurrenderPdfError("invalid_pdf", "O PDF está corrompido ou não pôde ser aberto.");
      throw new SurrenderPdfError("read_error", "Não foi possível ler esta cotação em PDF.");
    } finally {
      try { await pdf?.destroy(); } catch (_) { /* sem ação */ }
      try { await loadingTask?.destroy(); } catch (_) { /* sem ação */ }
    }
  }

  global.SurrenderPdf = {
    SurrenderPdfError,
    extractSurrenderValues,
    extractSurrenderValuesFromPages,
    groupItemsByLine,
    normalizeText,
    parseMoneyToken,
  };
})(typeof window !== "undefined" ? window : globalThis);
