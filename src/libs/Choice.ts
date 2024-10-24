/** Choose from an array of any values one at random.
 * Return this randomly chosen value.
 */
function getRandomChoice(values: any[]): any {
  return values[Math.floor(Math.random() * values.length)];
}

/** Using a numeric range, choose one number at random and return it.
 *
 * @param min Minimum value
 * @param max Maximum value
 * @returns Randomly chosen value (number)
 */
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export {getRandomChoice, getRandomInt};
