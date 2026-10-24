export function normalizeTypingAnswer(value) {
  return value.normalize('NFKC').toLowerCase().replace(/\p{P}/gu, '').trim().replace(/\s+/gu, ' ');
}
export function isTypingCorrect(answer, target) {
  const normalized = normalizeTypingAnswer(answer);
  return (
    Boolean(normalized) && normalized === normalizeTypingAnswer(target.replace(/（[^）]+）/g, ''))
  );
}
export function isOrderCorrect(selected, tokens) {
  return (
    selected.length === tokens.length &&
    selected.every((token, index) => token.id === tokens[index].id)
  );
}
export function serializeCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) =>
          /[",\r\n]/.test(String(value ?? ''))
            ? `"${String(value ?? '').replaceAll('"', '""')}"`
            : String(value ?? ''),
        )
        .join(','),
    )
    .join('\n');
}
