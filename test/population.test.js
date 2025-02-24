const { expect, describe } = require('@jest/globals');
const { populationFunction } = require('../src/population');

describe('Population', () => {
  test('generate population of 1', () => {
    const mockDate = new Date('2024-02-22T00:00:00.000Z');
    const population = populationFunction({
      totalDuration: 10,
      populationSize: 1,
      numberOfPricePeriods: 2,
      excessPvEnergyUse: 0,
      input: [
        { start: mockDate.toISOString() }
      ]
    });
    
    expect(population[0].periods.head.data.start).toEqual(0);
    expect(
      population[0].periods.filter((data) => data.activity != 0).length
    ).toEqual(2);
  });
});
