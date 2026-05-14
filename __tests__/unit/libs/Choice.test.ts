/**
 * @jest-environment node
 */

import {getRandomChoice, getRandomInt} from '@libs/Choice';

describe('getRandomChoice', () => {
  const stringChoices = ['test-choice1', 'test-choice2', 'test-choice3'];
  const numericChoices = [1, 2, 3];

  it('chooses a value that belongs to the array', () => {
    const stringChoice = getRandomChoice(stringChoices);
    const numericChoice = getRandomChoice(numericChoices);

    expect(stringChoices).toContain(stringChoice);
    expect(numericChoices).toContain(numericChoice);

    expect(typeof stringChoice).toEqual('string');
    expect(typeof numericChoice).toEqual('number');
  });
});

describe('getRandomInt', () => {
  const rangeMin = 0;
  const rangeMax = 10;

  it('always returns a number within the range', () => {
    for (let i = 0; i < rangeMax; i++) {
      const randomInt = getRandomInt(rangeMin, i);

      expect(randomInt).toBeGreaterThanOrEqual(rangeMin);
      expect(randomInt).toBeLessThanOrEqual(rangeMax);
      expect(typeof randomInt).toEqual('number');
    }
  });
});
