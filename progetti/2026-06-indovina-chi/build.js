const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
} = require("docx");

// ---------- DATI (da Notion) ----------
const frasi = [
  "A 15 anni studiavo cartomagia",
  "Abuso della Nutella",
  "Arrestato per aver dipinto una panchina",
  "Dovevo studiare a Shangai",
  "Faccio trick con coltelli a farfalla",
  "Ho dormito su un vulcano",
  "Ho paura delle scale",
  "Ho seguito dei crash test",
  "Ho un cane nero",
  "Ho una chiesa di famiglia",
  "Ho vissuto 3 anni in Olanda",
  "Hyper focus arriva alle 18",
  "La Vespa è IL mezzo di trasporto",
  "Mangio i kiwi con la buccia",
  "Mi gasa la mitologia greca",
  "Mi hanno quasi bocciato all'asilo",
  "Mi piace la musica classica",
  "Mi piace la recitazione",
  "Mi sposo il 25 luglio",
  "Non mi piacciono i funghi",
  "Non sopporto mettere la testa sott'acqua",
  "Odio il sushi",
  "Siciliano tra Reggio, Modena, Bologna",
  "So muovere le orecchie",
  "Sogno di laurearmi in storia",
  "Super competitivo, controcorrente quasi sempre",
  "Vado matto per i Lego",
];
const persone = [
  "Alessandro Grotti", "Andrea Mordenti", "Angelo Longano", "Carlo A. Venditti",
  "Cristiano Piscioneri", "Daniele Dalle Nogare", "Davide Leonescu", "Davide Miani",
  "Dmitry Babich", "Federico Frascà", "Francesco Barbanti", "Gabriele Fogu",
  "Leonardo Carboni", "Letizia Maccariello", "Lorenzo Monni Sau", "Lorenzo Tonetta",
  "Luca Stendardo", "Luca Torresan", "Marco Pinelli", "Marco Vita",
  "Mattia Gualandi", "Mattia Palmucci", "Michele Roberti", "Roberto Zanolli",
  "Simone Antimiani", "Simone Brigante", "Tancredi Bosi",
];
const lettere = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), "AA"];
const soluzione = { 0:26,1:8,2:19,3:20,4:9,5:7,6:13,7:14,8:16,9:3,10:12,11:17,12:22,13:25,14:23,15:21,16:6,17:5,18:4,19:15,20:18,21:10,22:2,23:11,24:1,25:24,26:0 };

const SUBTITLE = "Laif Edition - Team building 25-28/06/2026";
const MAX = 27;

// ---------- GEOMETRIA / STILI ----------
const PAGE_W = 11906, PAGE_H = 16838, MARGIN = 720;
const CONTENT_W = PAGE_W - 2 * MARGIN; // 10466
const HEAD = "1F3864", GREEN = "548235", GREENL = "E2EFDA", GREY = "595959", GREYL = "F2F2F2";

const thin = { style: BorderStyle.SINGLE, size: 2, color: "BFBFBF" };
const thinB = { top: thin, bottom: thin, left: thin, right: thin };
const boxb = { style: BorderStyle.SINGLE, size: 6, color: "7F7F7F" };
const boxB = { top: boxb, bottom: boxb, left: boxb, right: boxb };
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noB = { top: none, bottom: none, left: none, right: none };
const lineBottom = { top: none, left: none, right: none, bottom: boxb };

function p(text, o = {}) {
  return new Paragraph({
    spacing: { before: o.before ?? 0, after: o.after ?? 0, line: o.line ?? 240 },
    alignment: o.align ?? AlignmentType.LEFT,
    children: [new TextRun({ text, bold: !!o.bold, italics: !!o.italics, size: o.size ?? 20, color: o.color ?? "000000", font: "Calibri" })],
  });
}
// cella generica
function c(text, w, o = {}) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    borders: o.borders ?? thinB,
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    verticalAlign: o.vAlign ?? VerticalAlign.CENTER,
    margins: o.margins ?? { top: 16, bottom: 16, left: 90, right: 90 },
    children: [p(text ?? "", { size: o.size ?? 18, bold: !!o.bold, italics: !!o.italics, align: o.align ?? AlignmentType.LEFT, color: o.color })],
  });
}
function h(text, w, fill = HEAD, size = 16) {
  return c(text, w, { fill, bold: true, color: "FFFFFF", align: AlignmentType.CENTER, size, margins: { top: 40, bottom: 40, left: 60, right: 60 } });
}

// ===== FOGLIO GIOCATORE (una sola tabella) =====
function buildGame() {
  // header strip: Nome e Cognome | Voto finale
  const NAMEW = 6900, SCOREW = CONTENT_W - NAMEW;
  const headerStrip = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [NAMEW, SCOREW], borders: noB,
    rows: [new TableRow({ height: { value: 560, rule: "atLeast" }, children: [
      new TableCell({ width: { size: NAMEW, type: WidthType.DXA }, borders: lineBottom, verticalAlign: VerticalAlign.BOTTOM,
        margins: { top: 40, bottom: 40, left: 20, right: 200 }, children: [p("Nome e Cognome:", { bold: true, size: 20 })] }),
      new TableCell({ width: { size: SCOREW, type: WidthType.DXA }, borders: boxB, verticalAlign: VerticalAlign.CENTER,
        shading: { fill: "F7F9FC", type: ShadingType.CLEAR, color: "auto" }, margins: { top: 30, bottom: 30, left: 60, right: 60 },
        children: [ p("VOTO FINALE", { bold: true, size: 15, align: AlignmentType.CENTER, color: HEAD }), p(`________  /  ${MAX}`, { size: 20, align: AlignmentType.CENTER }) ] }),
    ] })],
  });

  // tabella unica: N° | Caratteristica | 1° | 2° | 3° | Esatta | (solco) | Lett. | Persona
  const W = [360, 4300, 360, 360, 360, 470, 160, 440, 3656]; // = 10466
  const header = new TableRow({ tableHeader: true, children: [
    h("N°", W[0]), h("Caratteristica", W[1]), h("1°", W[2]), h("2°", W[3]), h("3°", W[4]), h("Esatta", W[5], GREEN),
    new TableCell({ width: { size: W[6], type: WidthType.DXA }, borders: noB, children: [p("")] }),
    h("Lett.", W[7], GREY), h("Elenco persone", W[8], GREY),
  ] });
  const rows = frasi.map((f, i) => new TableRow({
    height: { value: 320, rule: "atLeast" },
    children: [
      c(String(i + 1), W[0], { align: AlignmentType.CENTER, bold: true, color: HEAD }),
      c(f, W[1], { size: 18 }),
      c("", W[2], { borders: boxB }), c("", W[3], { borders: boxB }), c("", W[4], { borders: boxB }),
      c("", W[5], { borders: boxB, fill: GREENL }),
      new TableCell({ width: { size: W[6], type: WidthType.DXA }, borders: noB, children: [p("")] }),
      c(lettere[i], W[7], { align: AlignmentType.CENTER, bold: true, fill: GREYL, color: HEAD }),
      c(persone[i], W[8], { fill: GREYL }),
    ],
  }));
  const table = new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: W, rows: [header, ...rows] });

  return new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
      children: [
        p("Indovina Chi!", { bold: true, size: 34, align: AlignmentType.CENTER, after: 20, color: HEAD }),
        p(SUBTITLE, { italics: true, size: 18, align: AlignmentType.CENTER, after: 130, color: "595959" }),
        headerStrip,
        p("Per ogni frase scrivi nelle 3 caselle la LETTERA della persona che pensi l'abbia scritta (3 tentativi). Ogni frase indovinata vale 1 punto.",
          { size: 15, align: AlignmentType.CENTER, before: 120, after: 30, color: "595959" }),
        p("Le colonne grigie a destra sono solo l'elenco delle persone: l'ordine NON è collegato ai numeri delle frasi. La colonna verde «Esatta» si compila in fase di correzione.",
          { size: 13, italics: true, align: AlignmentType.CENTER, after: 110, color: "808080" }),
        table,
      ],
    }],
  });
}

// ===== FOGLIO CORRETTORE (una sola tabella) =====
function buildCorrection() {
  // N° | Caratteristica | Esatta | Persona | Punteggio | Posizione
  const W = [440, 3800, 820, 2500, 1500, 1406]; // = 10466
  const header = new TableRow({ tableHeader: true, children: [
    h("N°", W[0]), h("Caratteristica", W[1]), h("Esatta", W[2], GREEN), h("Persona (giocatore)", W[3]),
    h(`Punteggio (max ${MAX})`, W[4]), h("Posizione", W[5]),
  ] });
  const rows = frasi.map((f, i) => {
    const pid = soluzione[i], alt = i % 2 === 1, bg = alt ? "EEF2F8" : "FFFFFF";
    return new TableRow({ height: { value: 360, rule: "atLeast" }, children: [
      c(String(i + 1), W[0], { align: AlignmentType.CENTER, bold: true, fill: bg }),
      c(f, W[1], { fill: bg }),
      c(lettere[pid], W[2], { align: AlignmentType.CENTER, bold: true, color: GREEN, fill: bg }),
      c(persone[pid], W[3], { fill: bg }),
      c("", W[4], { align: AlignmentType.CENTER, fill: bg }),
      c("", W[5], { align: AlignmentType.CENTER, fill: bg }),
    ] });
  });
  const table = new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: W, rows: [header, ...rows] });

  return new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
      children: [
        p("Indovina Chi! — Correzione e punteggi", { bold: true, size: 26, align: AlignmentType.CENTER, after: 16, color: HEAD }),
        p(SUBTITLE + "  ·  solo per chi conduce", { italics: true, size: 16, align: AlignmentType.CENTER, after: 90, color: "595959" }),
        p("Colonne «N° / Caratteristica / Esatta»: chiave per correggere i fogli (1 punto per frase indovinata in uno dei 3 tentativi, max 27).",
          { size: 14, italics: true, align: AlignmentType.CENTER, after: 24, color: "808080" }),
        p("Ogni persona ha scritto una sola frase, quindi compare una volta: segna il suo Punteggio totale e la Posizione sulla sua riga.",
          { size: 14, italics: true, align: AlignmentType.CENTER, after: 120, color: "808080" }),
        table,
      ],
    }],
  });
}

(async () => {
  const path = require("path");
  fs.writeFileSync(path.join(__dirname, "indovina-chi.docx"), await Packer.toBuffer(buildGame()));
  fs.writeFileSync(path.join(__dirname, "indovina-chi-correzione.docx"), await Packer.toBuffer(buildCorrection()));
  console.log("OK");
})();
