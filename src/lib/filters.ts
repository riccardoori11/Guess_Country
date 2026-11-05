import {
  countries,
  type Continent,
  type Country,
} from '../data/countries';

export const LETTERS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
] as const;
export type Letter = (typeof LETTERS)[number];

// Classification uses only the canonical name, never answer aliases.
export function startingLetter(country: Pick<Country, 'name'>): string {
  return country.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .charAt(0)
    .toUpperCase();
}

export function eligibleCountries(
  continents: readonly Continent[],
  letters: readonly Letter[] = LETTERS,
): Country[] {
  const selectedContinents = new Set(continents);
  const selectedLetters = new Set<string>(letters);
  return countries.filter(
    (country) =>
      selectedContinents.has(country.continent) &&
      selectedLetters.has(startingLetter(country)),
  );
}

export function emptySelectionMessage(
  continents: readonly Continent[],
  letters: readonly Letter[],
  count: number,
): string | undefined {
  if (!continents.length && !letters.length)
    return 'Choose at least one continent and one letter to start a round.';
  if (!continents.length)
    return 'Choose at least one continent to start a round.';
  if (!letters.length)
    return 'Choose at least one letter to start a round.';
  if (!count)
    return 'No countries match these continents and letters. Try a different selection.';
}
