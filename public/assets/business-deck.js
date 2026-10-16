(function initBusinessDeck(global) {
  "use strict";
  const W = 1280, H = 720;
  const NAVY = "#020e34", GOLD = "#e5b957", WHITE = "#f9fbff", BLUE = "#d9e4f4";
  const money = value => (Number(value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const percent = value => (Number(value) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
  const assets = {
    cover: "assets/sucessao/cover-sunset.jpeg",
    buyout: "assets/sucessao/business-buyout.png",
    family: "assets/sucessao/family-business.jpeg",
    mark: "assets/marca.png",
    planning: "assets/sucessao/reference-02.png",
    inventory: "assets/sucessao/reference-03.png",
    question: "assets/sucessao/reference-05.png",
    contact: "assets/sucessao/reference-10.png",
  };
  async function loadImages() {
    const pairs = await Promise.all(Object.entries(assets).map(([key, src]) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve([key, image]);
      image.onerror = () => reject(new Error("Não foi possível carregar a arte: " + src));
      image.src = src;
    })));
    return Object.fromEntries(pairs);
  }
  function canvas() {
    const el = document.createElement("canvas");
    el.width = W; el.height = H;
    return [el, el.getContext("2d")];
  }
  function text(ctx, value, x, y, size = 24, color = WHITE, weight = 400, align = "left") {
    ctx.save();
    ctx.font = weight + " " + size + "px Arial";
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    ctx.fillText(String(value), x, y);
    ctx.restore();
  }
  function fitText(ctx, value, x, y, maxWidth, size, minSize, color = WHITE, weight = 700, align = "left") {
    let fontSize = size;
    do { ctx.font = weight + " " + fontSize + "px Arial"; if (ctx.measureText(value).width <= maxWidth) break; fontSize--; } while (fontSize > minSize);
    text(ctx, value, x, y, fontSize, color, weight, align);
  }
  function lines(ctx, value, x, y, maxWidth, size, lineHeight, color = WHITE, weight = 400, maxLines = 5) {
    ctx.font = weight + " " + size + "px Arial";
    const words = String(value).split(/\s+/);
    const result = [];
    let current = "";
    words.forEach(word => {
      const next = current ? current + " " + word : word;
      if (ctx.measureText(next).width > maxWidth && current) { result.push(current); current = word; }
      else current = next;
    });
    if (current) result.push(current);
    result.slice(0, maxLines).forEach((line, index) => text(ctx, line, x, y + index * lineHeight, size, color, weight));
    return Math.min(result.length, maxLines) * lineHeight;
  }
  function background(ctx) { ctx.fillStyle = NAVY; ctx.fillRect(0, 0, W, H); }
  function brand(ctx, img) {
    ctx.drawImage(img, 40, 34, 100, 36);
    text(ctx, "GESTÃO DE RISCOS", 160, 41, 18, GOLD, 700);
  }
  function staticSlide(image) {
    const [el, ctx] = canvas();
    ctx.drawImage(image, 0, 0, W, H);
    return el;
  }
  function coverSlide(data, img) {
    const [el, ctx] = canvas();
    background(ctx);
    ctx.drawImage(img.cover, 0, 0, 820, H);
    const shade = ctx.createLinearGradient(0, 0, 840, 0);
    shade.addColorStop(0, "rgba(2,14,52,0)");
    shade.addColorStop(.38, "rgba(2,14,52,.16)");
    shade.addColorStop(1, NAVY);
    ctx.fillStyle = shade; ctx.fillRect(0, 0, 840, H);
    ctx.fillStyle = NAVY; ctx.fillRect(820, 0, 460, H);
    text(ctx, "SUCESSÃO EMPRESARIAL", 42, 286, 40, WHITE, 400);
    text(ctx, "GESTÃO DE RISCOS", 42, 340, 52, WHITE, 700);
    ctx.drawImage(img.mark, 855, 175, 72, 30);
    text(ctx, "ALTAVISTA", 940, 166, 42, WHITE, 400);
    ctx.fillStyle = GOLD; ctx.fillRect(856, 468, 385, 2);
    fitText(ctx, data.companyName.toUpperCase(), 1235, 487, 365, 27, 17, GOLD, 700, "right");
    const names = data.partners.map(partner => partner.name.toUpperCase()).slice(0, 8);
    names.forEach((name, index) => fitText(ctx, name, 1235, 531 + index * 21, 365, 17, 12, WHITE, 600, "right"));
    return el;
  }
  function scenarioSlide(data, img) {
    const [el, ctx] = canvas();
    background(ctx); brand(ctx, img.mark);
    text(ctx, "SUCESSÃO EMPRESARIAL", 160, 83, 37, WHITE, 700);
    ctx.fillStyle = "#a98b47"; ctx.fillRect(710, 18, 570, 96);
    fitText(ctx, "VALUATION INFORMADO  " + money(data.valuation), 1245, 40, 505, 25, 18, WHITE, 700, "right");
    const shareLine = data.partners.slice(0, 3).map(partner => partner.name.split(" ")[0] + " " + percent(partner.share)).join("   •   ");
    fitText(ctx, shareLine, 1245, 77, 510, 17, 12, WHITE, 400, "right");
    text(ctx, "OPÇÃO 1", 310, 152, 26, WHITE, 700, "center");
    text(ctx, "OPÇÃO 2", 950, 152, 26, WHITE, 700, "center");
    ctx.drawImage(img.buyout, 80, 197, 480, 267);
    ctx.drawImage(img.family, 704, 197, 480, 267);
    lines(ctx, "Os sócios sobreviventes adquirem a participação do sócio falecido", 100, 490, 460, 24, 29, GOLD, 700, 3);
    lines(ctx, "A família do sócio falecido ingressa na empresa", 727, 490, 440, 24, 29, GOLD, 700, 3);
    text(ctx, "PONTO DE ATENÇÃO", 90, 600, 19, GOLD, 700);
    lines(ctx, "Necessidade de liquidez para a aquisição da participação.", 90, 628, 500, 19, 22, WHITE, 400, 2);
    text(ctx, "PONTO DE ATENÇÃO", 713, 600, 19, GOLD, 700);
    lines(ctx, "Governança e preparação dos sucessores para a operação.", 713, 628, 500, 19, 22, WHITE, 400, 2);
    return el;
  }
  function ownershipSlide(data, img, partners, index, total) {
    const [el, ctx] = canvas(); background(ctx); brand(ctx, img.mark);
    text(ctx, "PARTICIPAÇÕES SOCIETÁRIAS", 95, 100, 39, WHITE, 700);
    text(ctx, data.companyName, 95, 153, 24, GOLD, 700);
    text(ctx, "Valuation informado: " + money(data.valuation), 95, 199, 22, WHITE);
    ctx.fillStyle = "#aa8a49"; ctx.fillRect(92, 270, 1092, 46);
    text(ctx, "SÓCIO", 110, 281, 20, WHITE, 700);
    text(ctx, "PARTICIPAÇÃO", 800, 281, 20, WHITE, 700, "right");
    text(ctx, "VALOR DA PARTICIPAÇÃO", 1160, 281, 20, WHITE, 700, "right");
    partners.forEach((partner, row) => {
      const y = 323 + row * 70;
      ctx.fillStyle = row % 2 ? "#132a53" : "#0a1e44"; ctx.fillRect(92, y, 1092, 65);
      fitText(ctx, partner.name, 110, y + 17, 580, 24, 17, WHITE, 600);
      text(ctx, percent(partner.share), 800, y + 17, 24, GOLD, 700, "right");
      text(ctx, money(global.BusinessModel.participationValue(data.valuation, partner.share)), 1160, y + 17, 24, WHITE, 700, "right");
    });
    text(ctx, "Cálculo: valuation informado × participação de cada sócio.", 95, 652, 18, BLUE);
    if (total > 1) text(ctx, (index + 1) + " / " + total, 1180, 652, 18, GOLD, 700, "right");
    return el;
  }
  function quoteSlide(data, partner, img) {
    const [el, ctx] = canvas(); background(ctx); ctx.drawImage(img.mark, 40, 34, 100, 36);
    fitText(ctx, "IPCA PROJETADO: " + percent(data.ipca) + " A.A.  |  CAPITAL INICIAL: " + money(partner.wlCoverage), 160, 33, 670, 30, 21, WHITE, 700);
    fitText(ctx, partner.name.toUpperCase() + "  •  " + percent(partner.share) + " DAS COTAS", 1245, 44, 382, 21, 15, WHITE, 700, "right");
    const x = [165, 232, 430, 615, 815, 1010];
    const headings = ["IDADE", "CAPITAL SEGURADO", "APORTE ANUAL", "APORTE ACUMULADO", "RESGATE"];
    ctx.fillStyle = "#555a62"; ctx.fillRect(x[0], 82, x[5] - x[0], 38);
    headings.forEach((heading, col) => fitText(ctx, heading, (x[col] + x[col + 1]) / 2, 91, x[col + 1] - x[col] - 8, 17, 13, WHITE, 700, "center"));
    const rows = global.BusinessModel.projection(partner, data.ipca);
    rows.forEach((row, index) => {
      const y = 124 + index * 26.6;
      ctx.fillStyle = index % 2 ? "#d5dfef" : "#f8fafc"; ctx.fillRect(x[0], y, x[5] - x[0], 26);
      const values = [
        row.age ?? "—", money(row.capital), money(row.premium),
        money(row.accumulated), money(row.surrender),
      ];
      values.forEach((value, col) => fitText(ctx, String(value), (x[col] + x[col + 1]) / 2, y + 5, x[col + 1] - x[col] - 6, 15, 12, col === 1 && index === 0 ? "#ba8800" : "#061535", index === 9 || index === 19 ? 700 : 400, "center"));
      if (index === 9 || index === 19) {
        ctx.strokeStyle = index === 9 ? "#e54d4d" : GOLD; ctx.lineWidth = 3;
        ctx.strokeRect(x[0], y, x[5] - x[0], 26);
      }
    });
    ctx.fillStyle = "#152a52"; ctx.fillRect(1035, 114, 217, 539);
    text(ctx, "ALOCAÇÃO", 1055, 138, 23, GOLD, 700);
    lines(ctx, "Capital e prêmio projetados pelo IPCA informado.", 1055, 174, 175, 16, 22, WHITE);
    text(ctx, "10 APORTES", 1055, 300, 22, GOLD, 700);
    lines(ctx, "Após o 10º ano, sem novos aportes. O total pago permanece acumulado.", 1055, 335, 175, 16, 22, WHITE);
    text(ctx, "RESGATE", 1055, 492, 22, GOLD, 700);
    lines(ctx, "Valores preenchidos da cotação da seguradora.", 1055, 526, 175, 16, 22, WHITE);
    text(ctx, "Projeção ilustrativa. Confira a proposta da seguradora.", 165, 680, 16, BLUE);
    return el;
  }
  function temporarySlide(data, img, partners, index, total) {
    const [el, ctx] = canvas(); background(ctx); brand(ctx, img.mark);
    text(ctx, "COBERTURA TEMPORÁRIA", 95, 103, 40, WHITE, 700);
    text(ctx, "Alternativa conforme as cotações cadastradas", 95, 158, 23, GOLD);
    const x = [94, 500, 757, 1014, 1184];
    const headers = ["SÓCIO", "CAPITAL", "PRÊMIO ANUAL", "VIGÊNCIA"];
    ctx.fillStyle = "#a98b47"; ctx.fillRect(94, 238, 1090, 48);
    headers.forEach((header, col) => text(ctx, header, col ? x[col + 1] - 18 : x[col] + 20, 250, 19, WHITE, 700, col ? "right" : "left"));
    partners.forEach((partner, row) => {
      const y = 296 + row * 65;
      ctx.fillStyle = row % 2 ? "#122a54" : "#0a2047"; ctx.fillRect(94, y, 1090, 60);
      fitText(ctx, partner.name, 114, y + 17, 360, 24, 17, WHITE, 700);
      text(ctx, partner.termCoverage ? money(partner.termCoverage) : "N/D", x[2] - 18, y + 18, 19, GOLD, 700, "right");
      text(ctx, partner.termPremium ? money(partner.termPremium) : "N/D", x[3] - 18, y + 18, 19, WHITE, 700, "right");
      text(ctx, partner.termYears ? partner.termYears + " anos" : "N/D", x[4] - 18, y + 18, 19, WHITE, 700, "right");
    });
    text(ctx, "N/D: cotação temporária não cadastrada para o sócio.", 95, 632, 17, BLUE);
    text(ctx, "Coberturas, prêmio e vigência dependem da proposta da seguradora.", 95, 661, 17, BLUE);
    if (total > 1) text(ctx, (index + 1) + " / " + total, 1180, 661, 17, GOLD, 700, "right");
    return el;
  }
  function chunks(array, size) {
    const parts = [];
    for (let i = 0; i < array.length; i += size) parts.push(array.slice(i, i + size));
    return parts;
  }
  async function render(data) {
    const img = await loadImages();
    const slides = [coverSlide(data, img), staticSlide(img.planning), staticSlide(img.inventory), scenarioSlide(data, img)];
    const ownership = chunks(data.partners, 4);
    if (data.partners.length > 3) {
      ownership.forEach((part, index) => slides.push(ownershipSlide(data, img, part, index, ownership.length)));
    }
    slides.push(staticSlide(img.question));
    data.partners.forEach(partner => slides.push(quoteSlide(data, partner, img)));
    const temporary = chunks(data.partners, 5);
    temporary.forEach((part, index) => slides.push(temporarySlide(data, img, part, index, temporary.length)));
    slides.push(staticSlide(img.contact));
    return slides;
  }
  async function create(data, kind) {
    const slides = await render(data);
    if (kind === "pdf") {
      const document = await global.PDFLib.PDFDocument.create();
      for (const slide of slides) {
        const png = await document.embedPng(slide.toDataURL("image/png"));
        document.addPage([W, H]).drawImage(png, { x: 0, y: 0, width: W, height: H });
      }
      return new Blob([await document.save()], { type: "application/pdf" });
    }
    const pptx = new global.PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "Alta Vista";
    pptx.subject = "Sucessão empresarial";
    pptx.title = "Sucessão empresarial - " + data.companyName;
    slides.forEach(slide => pptx.addSlide().addImage({ data: slide.toDataURL("image/png"), x: 0, y: 0, w: 13.333, h: 7.5 }));
    return new Blob([await pptx.write({ outputType: "arraybuffer", compression: true })], {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
  }
  global.BusinessDeck = { create, render };
})(window);
