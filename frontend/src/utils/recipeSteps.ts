function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function stepsFromHtml(html: string): string[] {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const li = Array.from(tmp.querySelectorAll('li'))
    .map((x) => x.textContent?.trim() ?? '')
    .filter(Boolean);
  if (li.length >= 2) return li;
  return stepsFromText(stripHtml(html));
}

function stepsFromText(text: string): string[] {
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!cleaned) return [];

  // Prefer splitting by blank lines.
  const byParagraph = cleaned.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  if (byParagraph.length >= 3) return byParagraph;

  // Then try numbered steps: "1. ... 2. ..."
  const numbered = cleaned.split(/(?:^|\n)\s*\d+\.\s+/).map((s) => s.trim()).filter(Boolean);
  if (numbered.length >= 3) return numbered;

  // Fallback: single block.
  return [cleaned];
}

export function extractSteps(instructions: string): string[] {
  if (!instructions) return [];
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(instructions);
  return looksLikeHtml ? stepsFromHtml(instructions) : stepsFromText(instructions);
}

