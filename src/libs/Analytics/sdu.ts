/**
 * Calculates the grams of alcohol in a drink.
 *
 * @param ml - The volume of the drink in milliliters.
 * @param abv - The alcohol by volume of the drink.
 * @returns The grams of alcohol in the drink.
 */
const gramsOfAlcohol = (ml: number, abv: number) => ml * abv * 0.789;

/**
 * Calculates the standard drinks units in a drink.
 *
 * @param ml - The volume of the drink in milliliters.
 * @param abv - The alcohol by volume of the drink.
 * @param gramsPerUnit - The number of grams per unit of alcohol.
 * @returns The standard drinks units in the drink.
 */
const sduFrom = (ml: number, abv: number, gramsPerUnit = 10) =>
  gramsOfAlcohol(ml, abv) / gramsPerUnit;

export {gramsOfAlcohol, sduFrom};
