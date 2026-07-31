import { AINote, Language } from "../types";


function markdownText(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

export function notesToMarkdown(
  notes: AINote[],
  language: Language,
): string {
  const heading = language === "VI"
    ? "# Bộ AI Note — Slide2Study"
    : "# AI Notes — Slide2Study";
  const exportedAt = new Date().toISOString();
  const sections = notes.map((note) => {
    const sources = note.sourcePages.length > 0
      ? note.sourcePages.map((page) => (
          language === "VI" ? `Trang ${page}` : `Page ${page}`
        )).join(", ")
      : (language === "VI" ? "Không có" : "None");
    const takeaways = note.keyTakeaways.length > 0
      ? note.keyTakeaways.map((item) => `- ${markdownText(item)}`).join("\n")
      : `- ${language === "VI" ? "Không có" : "None"}`;
    return [
      `## ${markdownText(note.title)}`,
      "",
      `**${language === "VI" ? "Nguồn" : "Sources"}:** ${sources}`,
      "",
      markdownText(note.summary),
      "",
      `### ${language === "VI" ? "Ý cần nhớ" : "Key takeaways"}`,
      takeaways,
      note.example
        ? [
            "",
            `### ${language === "VI"
              ? "Ví dụ minh họa do AI tạo"
              : "AI-generated example"}`,
            markdownText(note.example),
          ].join("\n")
        : "",
      note.misconception
        ? [
            "",
            `### ${language === "VI" ? "Dễ hiểu nhầm" : "Common pitfall"}`,
            markdownText(note.misconception),
          ].join("\n")
        : "",
      note.userText.trim()
        ? [
            "",
            `### ${language === "VI" ? "Ghi chú của tôi" : "My note"}`,
            markdownText(note.userText),
          ].join("\n")
        : "",
    ].filter(Boolean).join("\n");
  });
  return [
    heading,
    "",
    `_${language === "VI" ? "Xuất lúc" : "Exported at"} ${exportedAt}_`,
    "",
    ...sections.flatMap((section, index) => (
      index === 0 ? [section] : ["---", "", section]
    )),
    "",
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function paragraphs(value: string): string {
  return escapeHtml(value)
    .split(/\n{2,}/)
    .map((part) => `<p>${part.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function notesToPrintableHtml(
  notes: AINote[],
  language: Language,
): string {
  const title = language === "VI"
    ? "Bộ AI Note — Slide2Study"
    : "AI Notes — Slide2Study";
  const sections = notes.map((note) => `
    <article>
      <h2>${escapeHtml(note.title)}</h2>
      <div class="sources">${escapeHtml(
        note.sourcePages.map((page) => (
          language === "VI" ? `Trang ${page}` : `Page ${page}`
        )).join(" · "),
      )}</div>
      ${paragraphs(note.summary)}
      <h3>${language === "VI" ? "Ý cần nhớ" : "Key takeaways"}</h3>
      <ul>${note.keyTakeaways.map(
        (item) => `<li>${escapeHtml(item)}</li>`,
      ).join("")}</ul>
      ${note.example ? `
        <section class="ai-example">
          <strong>${language === "VI"
            ? "Ví dụ minh họa do AI tạo"
            : "AI-generated example"}</strong>
          ${paragraphs(note.example)}
        </section>` : ""}
      ${note.misconception ? `
        <section class="warning">
          <strong>${language === "VI" ? "Dễ hiểu nhầm" : "Common pitfall"}</strong>
          ${paragraphs(note.misconception)}
        </section>` : ""}
      ${note.userText.trim() ? `
        <h3>${language === "VI" ? "Ghi chú của tôi" : "My note"}</h3>
        ${paragraphs(note.userText)}` : ""}
    </article>
  `).join("");
  return `<!doctype html>
<html lang="${language === "VI" ? "vi" : "en"}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 18mm; }
    body { color: #172033; font: 14px/1.55 Arial, sans-serif; margin: 0; }
    h1 { color: #6d28d9; font-size: 24px; }
    h2 { margin-bottom: 4px; page-break-after: avoid; }
    h3 { font-size: 14px; margin-top: 18px; }
    article { border-top: 2px solid #ddd6fe; margin-top: 24px; padding-top: 14px; }
    .sources { color: #475569; font-size: 12px; font-weight: 700; }
    .ai-example, .warning { border-radius: 8px; margin-top: 12px; padding: 10px; }
    .ai-example { background: #eff6ff; }
    .warning { background: #fffbeb; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${language === "VI"
    ? "Nhấn In và chọn “Save as PDF” để lưu tệp PDF."
    : "Choose Print and “Save as PDF” to create a PDF file."}</p>
  ${sections}
</body>
</html>`;
}
