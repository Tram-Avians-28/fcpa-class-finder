const WORD_CHARACTER = /[\p{L}\p{N}\p{M}_]/u;

function normalizeWhitespace(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function termPattern(text: string, phrase: boolean): RegExp {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Quoted phrases match complete words, rather than parts of adjacent words.
  const before = phrase && WORD_CHARACTER.test(text[0]) ? "(?:^|[^\\p{L}\\p{N}\\p{M}_])" : "";
  const after = phrase && WORD_CHARACTER.test(text[text.length - 1]) ? "(?=$|[^\\p{L}\\p{N}\\p{M}_])" : "";
  return new RegExp(`${before}${escaped}${after}`, "u");
}

/** Any positive word/phrase may match; every minus-prefixed exclusion must be absent. */
export function createActivitySearch(query = ""): (title: string, description?: string) => boolean {
  const input = query.replace(/[“”]/g, '"');
  const included: RegExp[] = [];
  const excluded: RegExp[] = [];
  let index = 0;

  while (index < input.length) {
    if (/\s/.test(input[index])) {
      index += 1;
      continue;
    }
    // Only a leading, immediately attached minus is an exclusion operator.
    const exclude = input[index] === "-";
    if (exclude) index += 1;
    const phrase = input[index] === '"';
    if (phrase) index += 1;
    const start = index;
    while (index < input.length && input[index] !== '"' && (phrase || !/\s/.test(input[index]))) {
      index += 1;
    }
    const text = normalizeWhitespace(input.slice(start, index));
    // An unfinished quote treats the rest of the query as a phrase.
    if (phrase && input[index] === '"') index += 1;
    if (text) (exclude ? excluded : included).push(termPattern(text, phrase));
  }

  if (!included.length && !excluded.length) return () => true;
  return (title, description = "") => {
    // Keep fields separate so a phrase cannot span a title and its description.
    const fields = [normalizeWhitespace(title), normalizeWhitespace(description)];
    const matches = (pattern: RegExp) => fields.some((field) => pattern.test(field));
    return (!included.length || included.some(matches)) && !excluded.some(matches);
  };
}
