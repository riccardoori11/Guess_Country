import { describe, expect, it } from 'vitest';
import { countries } from './countries';
import { capitalsByCountry } from './capitals';

describe('capital data', () => {
  it('covers exactly the existing 195 countries by stable ISO code', () => {
    expect(Object.keys(capitalsByCountry).sort()).toEqual(countries.map((country) => country.id).sort());
    expect(Object.keys(capitalsByCountry)).toHaveLength(195);
    expect(Object.keys(capitalsByCountry).every((id) => /^[a-z]{2}$/.test(id))).toBe(true);
  });

  it('has nonempty display names, explicit alias lists, and plain-text notes', () => {
    for (const capital of Object.values(capitalsByCountry)) {
      expect(capital.name.trim()).toBe(capital.name);
      expect(capital.name.length).toBeGreaterThan(1);
      expect(Array.isArray(capital.aliases)).toBe(true);
      expect(new Set(capital.aliases).size).toBe(capital.aliases.length);
      for (const alias of capital.aliases) {
        expect(alias.trim()).toBe(alias);
        expect(alias.length).toBeGreaterThan(1);
        expect(alias).not.toBe(capital.name);
        expect(alias).not.toMatch(/[|;<>]/);
      }
      if (capital.note !== undefined) {
        expect(capital.note.trim().length).toBeGreaterThan(10);
        expect(capital.note).not.toMatch(/[<>]/);
      }
    }
  });

  it('uses reviewed current names rather than stale source capitals', () => {
    expect(capitalsByCountry.gq.name).toBe('Ciudad de la Paz');
    expect(capitalsByCountry.bi.name).toBe('Gitega');
    expect(capitalsByCountry.kz.name).toBe('Astana');
    expect(capitalsByCountry.id.name).toBe('Jakarta');
    expect(capitalsByCountry.tz.name).toBe('Dodoma');
    expect(capitalsByCountry.pw.name).toBe('Ngerulmud');
    expect(capitalsByCountry.ss.name).toBe('Juba');
    expect(capitalsByCountry.ad.name).toBe('Andorra la Vella');
    expect(capitalsByCountry.ad.aliases).not.toContain('Andorra');
  });

  it('does not accept a former capital in a different city or an unfinished planned successor', () => {
    const rejected: Record<string, string[]> = {
      gq: ['Malabo'], bi: ['Bujumbura'], kz: ['Almaty'], id: ['Nusantara'],
      tz: ['Dar es Salaam'], pw: ['Koror'], ss: ['Ramciel'], mm: ['Yangon'],
      ng: ['Lagos'], br: ['Rio de Janeiro'], tr: ['Istanbul'], us: ['New York'],
    };
    for (const [id, names] of Object.entries(rejected)) {
      const accepted = [capitalsByCountry[id].name, ...capitalsByCountry[id].aliases];
      for (const name of names) expect(accepted).not.toContain(name);
    }
  });

  it('documents accepted concurrent capitals and government seats', () => {
    const alternatives: Record<string, string[]> = {
      bj: ['Cotonou'], bo: ['La Paz'], ci: ['Abidjan'],
      eg: ['New Administrative Capital'], hn: ['Comayagüela'],
      lk: ['Colombo'], me: ['Cetinje'], my: ['Putrajaya'],
      nl: ['The Hague'], ps: ['Ramallah'], sz: ['Lobamba'],
      ye: ['Aden'], za: ['Cape Town', 'Bloemfontein'],
    };
    for (const [id, names] of Object.entries(alternatives)) {
      for (const name of names) expect(capitalsByCountry[id].aliases).toContain(name);
      expect(capitalsByCountry[id].note).toBeTruthy();
    }
  });

  it('handles no-official-capital and disputed-capital cases explicitly', () => {
    expect(capitalsByCountry.nr.name).toBe('Yaren');
    expect(capitalsByCountry.nr.note).toContain('no official capital');
    expect(capitalsByCountry.ch.note).toContain('federal city');
    expect(capitalsByCountry.ps.name).toBe('East Jerusalem');
    expect(capitalsByCountry.ps.note).toContain('disputed');
    expect(capitalsByCountry.il.name).toBe('Jerusalem');
    expect(capitalsByCountry.il.note).toContain('disputed');
  });

  it('whitelists common city spellings and abbreviations', () => {
    expect(capitalsByCountry.us.aliases).toEqual(expect.arrayContaining(['Washington', 'Washington DC', 'DC']));
    expect(capitalsByCountry.ua.aliases).toContain('Kiev');
    expect(capitalsByCountry.cn.aliases).toContain('Peking');
    expect(capitalsByCountry.mx.aliases).toContain('Ciudad de México');
    expect(capitalsByCountry.kz.aliases).toContain('Nur-Sultan');
    expect(capitalsByCountry.lk.aliases).toContain('Kotte');
    expect(capitalsByCountry.fr).toEqual({ name: 'Paris', aliases: [] });
  });
});
