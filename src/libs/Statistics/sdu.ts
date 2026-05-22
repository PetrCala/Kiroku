/**
 * Grams of pure ethanol in `ml` of a drink at `abv`. The 0.789 factor is
 * the density of ethanol (g/ml at 20°C).
 */
const gramsOfAlcohol = (ml: number, abv: number) => ml * abv * 0.789;

/**
 * Standard drink units. `gramsPerUnit` defaults to 10 (the WHO standard).
 */
const sduFrom = (ml: number, abv: number, gramsPerUnit = 10) =>
  gramsOfAlcohol(ml, abv) / gramsPerUnit;

export {gramsOfAlcohol, sduFrom};
