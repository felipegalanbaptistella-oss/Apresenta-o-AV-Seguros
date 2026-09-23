(function initSurrenderPdf(global) {
  "use strict";

  const MAX_FILE_BYTES = 25 * 1024 * 1024;
  const MAX_PAGES = 40;
  const MAX_TEXT_ITEMS_PER_PAGE = 10000;
  const MAX_TEXT_ITEMS_TOTAL = 100000;
  const MAX_TEXT_CHARACTERS_TOTAL = 2000000;
  const MAX_OCR_SIDE = 4096;
  const MAX_OCR_PIXELS_PER_PAGE = 12000000;
  const MAX_OCR_PIXELS_TOTAL = 80000000;
  const MIN_CONFIDENT_ROWS = 5;
  const HEADER_RE = /\b(?:RESGATE|RESERVA\s*RESGAT(?:ÁVEL|AVEL|\?VEL)|RESERVA\s*FINANCEIRA|VALOR\s+DA\s+RESERVA|CASH\s+VALUE|SURRENDER(?:\s+VALUE)?)\b/i;
  const MONEY_RE = /(?:R\$|BRL|US\$)?\s*-?\(?(?:(?:\d{1,3}(?:[.\s]\d{3})+|\d+),\d{2}|(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})\)?|(?:R\$|BRL|US\$)\s*-?\(?\d+\)?/gi;
  let pdfJsPromise;
  let ocrWorkerPromise;

  class SurrenderPdfError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "SurrenderPdfError";
      this.code = code;
    }
  }

  function validateTextBudget(items, budget) {
    const itemCount = Array.isArray(items) ? items.length : 0;
    const characterCount = (items || []).reduce((sum, item) => sum + String(item?.str ?? "").length, 0);
    if (itemCount > MAX_TEXT_ITEMS_PER_PAGE) {
      throw new SurrenderPdfError("too_complex", "O PDF possui texto demais em uma única página.");
    }
    budget.items += itemCount;
    budget.characters += characterCount;
    if (budget.items > MAX_TEXT_ITEMS_TOTAL || budget.characters > MAX_TEXT_CHARACTERS_TOTAL) {
      throw new SurrenderPdfError("too_complex", "O PDF excede o limite seguro de conteúdo processado.");
    }
  }

  function validateOcrViewport(width, height, budget) {
    const safeWidth = Math.ceil(Number(width));
    const safeHeight = Math.ceil(Number(height));
    const pixels = safeWidth * safeHeight;
    if (!Number.isFinite(pixels) || safeWidth <= 0 || safeHeight <= 0 || safeWidth > MAX_OCR_SIDE || safeHeight > MAX_OCR_SIDE || pixels > MAX_OCR_PIXELS_PER_PAGE) {
      throw new SurrenderPdfError("too_complex", "Uma página do PDF excede o limite seguro de dimensões para OCR.");
    }
    budget.pixels += pixels;
    if (budget.pixels > MAX_OCR_PIXELS_TOTAL) {
      throw new SurrenderPdfError("too_complex", "O PDF excede o limite seguro de processamento de imagens.");
    }
    return { width: safeWidth, height: safeHeight };
  }

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function isContractStartYearRow(line) {
    const label = normalizeText(line?.text ?? line?.items?.map(item => item.str).join(" "));
    // PDF.js may split accented labels across text items, such as "Emiss ã o".
    const compactLabel = label.replace(/[^A-Z0-9]/g, "");
    return /^ANO/.test(compactLabel) && /(?:EMISSAO|CONTRATACAO|CONTRATO)/.test(compactLabel);
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
    const malformedBrazilian = lastComma < 0 && lastDot >= 0 && /^(?:\d{1,3})(?:\.\d{3})+\d{2}$/.test(numeric);
    if (malformedBrazilian) {
      const digits = numeric.replace(/\D/g, "");
      numeric = `${digits.slice(0, -2)}.${digits.slice(-2)}`;
      const parsed = Number(numeric);
      return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : null;
    }
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
          const gap = second.x - (first.x + first.width);
          const maxHeaderWordGap = Math.max(6, Math.min(16, Math.min(first.width, second.width) * 0.5));
          if (gap > maxHeaderWordGap) continue;
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
      if (/(?:R\$|BRL|US\$)/i.test(item.str) && (item.str.match(/\d/g) || []).length >= 4) {
        const wholeValue = parseMoneyToken(item.str);
        if (wholeValue !== null) {
          candidates.push({ value: wholeValue, center: item.center, raw: item.str });
          continue;
        }
      }
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
      // Some PDFs combine the year label and number into one text item ("Ano 3").
      const match = normalizeText(item.str).match(/^\s*(?:(?:ANO|YEAR)\s+)?(\d{1,4})\s*(?:º|°|ANOS?|YEARS?)?\s*$/i);
      if (!match) return [];
      return [{ value: Number(match[1]), center: item.center }];
    });
  }

  function labeledYearCandidate(line) {
    for (const item of line.items) {
      const match = normalizeText(item.str).match(/^\s*ANO\s+(\d{1,3})(?:\s*\(\s*\d{1,3}\s*ANOS?\s*\))?\s*$/i);
      const value = Number(match?.[1]);
      if (Number.isInteger(value) && value >= 1 && value <= 80) {
        return { value, center: item.center };
      }
    }
    return null;
  }

  function nearestInteger(integers, x, maxDistance = 70) {
    if (!Number.isFinite(x)) return null;
    const ordered = integers.map(item => ({ ...item, distance: Math.abs(item.center - x) })).sort((a, b) => a.distance - b.distance);
    return ordered[0] && ordered[0].distance <= maxDistance ? ordered[0].value : null;
  }

  function inferAgeOffset(lines, header, options = {}) {
    if (!Number.isFinite(options.currentAge) || !Number.isFinite(header.ageX) || !Number.isFinite(header.yearX)) return null;
    const offsets = [];
    for (let index = header.lineIndex + 1; index < Math.min(lines.length, header.lineIndex + 14); index += 1) {
      const integers = integerCandidates(lines[index]);
      const year = nearestInteger(integers, header.yearX);
      const age = nearestInteger(integers, header.ageX);
      if (!Number.isInteger(year) || !Number.isInteger(age) || year < 1 || year > 80 || age < 18 || age > 130 || year === age) continue;
      offsets.push(age - Number(options.currentAge) - (year - 1));
    }
    if (!offsets.length) return null;
    const counts = new Map();
    offsets.forEach(offset => counts.set(offset, (counts.get(offset) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  function sequenceQuality(indices) {
    if (!indices.length) return 0;
    const unique = [...new Set(indices)].sort((a, b) => a - b);
    return unique[0] === 0 && unique.every((value, index) => value === index) ? 1 : 0;
  }

  function parseTableAfterHeader(lines, header, options = {}) {
    const rows = [];
    let ignoredContractStartRow = false;
    let missesAfterRows = 0;
    const ageOffset = inferAgeOffset(lines, header, options);
    for (let index = header.lineIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (HEADER_RE.test(normalizeText(line.text))) break;
      if (isContractStartYearRow(line)) {
        ignoredContractStartRow = true;
        missesAfterRows = 0;
        continue;
      }
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
      const labeledYear = labeledYearCandidate(line);
      const hasRowMarker = integers.some(item => item.center < header.left)
        || Boolean(labeledYear && labeledYear.center < header.left);
      if (!amounts.length || !hasRowMarker) {
        if (rows.length) missesAfterRows += 1;
        if (missesAfterRows >= 8) break;
        continue;
      }

      const year = nearestInteger(integers, header.yearX) ?? labeledYear?.value ?? null;
      const age = nearestInteger(integers, header.ageX);
      let rowIndex = Number.isInteger(year) && year >= 1 && year <= 80 ? year - 1 : null;
      if (Number.isInteger(age) && Number.isFinite(options.currentAge)) {
        const ageIndex = age - Number(options.currentAge) - (Number.isFinite(ageOffset) ? ageOffset : 0);
        if (ageIndex >= 0 && ageIndex <= 80 && (rowIndex === null || Math.abs(rowIndex - ageIndex) > 2)) rowIndex = ageIndex;
      }
      if (labeledYear && labeledYear.center < header.left) rowIndex = labeledYear.value - 1;
      if (rowIndex === null && !Number.isFinite(header.yearX) && !Number.isFinite(header.ageX)) {
        const possibleYear = integers.filter(item => item.center < header.left).map(item => item.value).find(value => value >= 1 && value <= 80);
        if (possibleYear !== undefined) rowIndex = possibleYear - 1;
      }

      rows.push({ index: rowIndex, value: Math.max(0, amounts[0].value), x: amounts[0].center, raw: amounts[0].raw });
      missesAfterRows = 0;
    }
    return { rows, ignoredContractStartRow };
  }

  function extractSurrenderValuesFromPages(pages, options = {}) {
    const maxValues = Math.max(1, Math.min(Number(options.maxValues) || 40, 80));
    const indexed = new Map();
    const sequential = [];
    let headerCount = 0;
    let ambiguousHeaderCount = 0;
    let ignoredContractStartRow = false;
    let textCharacters = 0;
    const alignments = [];

    (pages || []).forEach((items, pageIndex) => {
      const lines = groupItemsByLine(items);
      textCharacters += lines.reduce((sum, line) => sum + line.text.length, 0);
      const headers = findHeaders(lines);
      headerCount += headers.length;
      ambiguousHeaderCount += headers.filter(header => header.ambiguous).length;
      headers.forEach(header => {
        const parsed = parseTableAfterHeader(lines, header, options);
        ignoredContractStartRow ||= parsed.ignoredContractStartRow;
        parsed.rows.forEach(row => {
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

    return { values, presentIndices, confidence, reason, headerCount, ambiguousHeaderCount, rowCount, textCharacters, ignoredContractStartRow };
  }

  function scriptBaseUrl() {
    if (typeof document === "undefined") return null;
    const ownScript = [...document.scripts].find(script => /\/surrender-pdf\.js(?:\?|$)/.test(script.src));
    return new URL(".", ownScript?.src || document.baseURI);
  }

  function ocrAssetsBaseUrl() {
    const base = scriptBaseUrl();
    return base ? new URL("ocr/", base) : null;
  }

  async function loadOcrWorker(options = {}) {
    if (!global.Tesseract?.createWorker) {
      throw new SurrenderPdfError("ocr_unavailable", "O OCR local nao esta disponivel neste navegador.");
    }
    if (!ocrWorkerPromise) {
      const base = ocrAssetsBaseUrl();
      if (!base) throw new SurrenderPdfError("ocr_unavailable", "O OCR local nao esta disponivel neste navegador.");
      ocrWorkerPromise = global.Tesseract.createWorker("por", 1, {
        workerPath: new URL("worker.min.js", base).href,
        corePath: new URL("tesseract-core.wasm.js", base).href,
        langPath: base.href,
        gzip: true,
        logger: message => options.onProgress?.(message),
      }).catch(error => {
        ocrWorkerPromise = undefined;
        throw error;
      });
    }
    return ocrWorkerPromise;
  }

  async function recognizePageWithOcr(pdfPage, options = {}) {
    if (typeof document === "undefined") throw new SurrenderPdfError("ocr_unavailable", "O OCR local nao esta disponivel neste navegador.");
    const scale = Number(options.scale) || 1.7;
    const viewport = pdfPage.getViewport({ scale });
    const dimensions = validateOcrViewport(viewport.width, viewport.height, options.ocrBudget || { pixels: 0 });
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    await pdfPage.render({ canvasContext: context, viewport }).promise;
    const worker = await loadOcrWorker(options);
    const result = await worker.recognize(canvas, {}, { text: true, blocks: true });
    const words = [];
    const collectWords = node => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(collectWords);
        return;
      }
      if (Array.isArray(node.words)) {
        words.push(...node.words);
        return;
      }
      [node.blocks, node.paragraphs, node.lines, node.layoutBlocks].forEach(collectWords);
    };
    collectWords(result?.data);
    const items = words.map(word => {
      const text = String(word?.text || "").trim();
      const bbox = word?.bbox || {};
      const x = Number(bbox.x0) || 0;
      const yTop = Number(bbox.y0) || 0;
      const yBottom = Number(bbox.y1) || yTop + 1;
      return {
        str: text,
        width: Math.max((Number(bbox.x1) || x + Math.max(1, text.length * 8)) - x, 1),
        transform: [1, 0, 0, 1, x, canvas.height - (yTop + yBottom) / 2],
      };
    }).filter(item => item.str);
    canvas.width = 1;
    canvas.height = 1;
    return items;
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
      loadingTask = pdfjs.getDocument({
        data: bytes,
        isEvalSupported: false,
        maxImageSize: MAX_OCR_PIXELS_PER_PAGE,
        canvasMaxAreaInBytes: MAX_OCR_PIXELS_PER_PAGE * 4,
      });
      pdf = await loadingTask.promise;
      if (pdf.numPages > MAX_PAGES) throw new SurrenderPdfError("too_many_pages", "A cotação possui mais de 40 páginas.");
      const pages = [];
      const textBudget = { items: 0, characters: 0 };
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent({ disableNormalization: false });
        const items = content.items || [];
        validateTextBudget(items, textBudget);
        pages.push(items);
        page.cleanup();
      }
      const textResult = extractSurrenderValuesFromPages(pages, options);
      if (textResult.reason !== "no_text") {
        return { ...textResult, pageCount: pdf.numPages, filename, source: "text" };
      }

      options.onProgress?.({ status: "ocr", progress: 0 });
      const ocrPages = [];
      const ocrBudget = { pixels: 0 };
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        options.onProgress?.({ status: "recognizing", page: pageNumber, total: pdf.numPages, progress: pageNumber / pdf.numPages });
        ocrPages.push(await recognizePageWithOcr(page, { ...options, ocrBudget }));
        page.cleanup();
      }
      const ocrResult = extractSurrenderValuesFromPages(ocrPages, options);
      return { ...ocrResult, pageCount: pdf.numPages, filename, source: "ocr" };
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
    validateOcrViewport,
    validateTextBudget,
  };
})(typeof window !== "undefined" ? window : globalThis);
