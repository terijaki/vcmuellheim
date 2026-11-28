export type NumberToGermanWordOptions = {
  uppercase?: boolean;
  indefinite_eine?: boolean;
};

const WORDS_0_19 = [
  "",
  "eins",
  "zwei",
  "drei",
  "vier",
  "fünf",
  "sechs",
  "sieben",
  "acht",
  "neun",
  "zehn",
  "elf",
  "zwölf",
  "dreizehn",
  "vierzehn",
  "fünfzehn",
  "sechzehn",
  "siebzehn",
  "achtzehn",
  "neunzehn",
] as const;

const TENS = [
  "",
  "zehn",
  "zwanzig",
  "dreißig",
  "vierzig",
  "fünfzig",
  "sechzig",
  "siebzig",
  "achtzig",
  "neunzig",
] as const;

function twoDigitsToWord(value: number): string {
  if (value <= 19) {
    return WORDS_0_19[value] ?? "";
  }
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  const tensWord = TENS[tens] ?? "";
  if (ones === 0) {
    return tensWord;
  }
  if (ones === 1) {
    return `einund${tensWord}`;
  }
  return `${WORDS_0_19[ones]}und${tensWord}`;
}

function formatGermanInteger0To99(value: number, options: NumberToGermanWordOptions): string {
  if (value === 0) {
    return "";
  }
  if (value === 1 && options.indefinite_eine) {
    return "eine";
  }
  return twoDigitsToWord(value);
}

export function numberToGermanWord(
  number: number,
  options: NumberToGermanWordOptions = {},
): string {
  if (!Number.isFinite(number) || !Number.isInteger(number) || number < 0 || number > 99) {
    return String(number);
  }

  let result = formatGermanInteger0To99(number, options);
  if (options.uppercase !== false && result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }
  return result;
}
