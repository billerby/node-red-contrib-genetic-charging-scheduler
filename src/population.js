const { generateRandomActivity, isChargingAllowed } = require('./utils');
const { DoublyLinkedList } = require('./schedule');

/**
 * Generate initial population for the genetic algorithm
 * Now with improved handling of charging restrictions
 */
const populationFunction = (props) => {
  const {
    totalDuration,
    populationSize,
    numberOfPricePeriods,
    excessPvEnergyUse = 0,
    input = [],
    chargingRestrictions
  } = props;

  const population = [];
  for (let i = 0; i < populationSize; i += 1) {
    const timePeriods = new DoublyLinkedList();
    const activities = [];
    let currentNumberOfPricePeriods = 0;
    let previousActivity = undefined;

    while (currentNumberOfPricePeriods < numberOfPricePeriods) {
      // Use the input start time if available, otherwise use current time
      const baseDate = input[0]?.start ? new Date(input[0].start) : new Date();
      const periodStart = new Date(baseDate);
      periodStart.setMinutes(periodStart.getMinutes() + currentNumberOfPricePeriods * 30);
      
      // Use the enhanced generateRandomActivity that is aware of charging restrictions
      const activity = generateRandomActivity(previousActivity, periodStart, chargingRestrictions);
      
      currentNumberOfPricePeriods += activity != 0;
      activities.push(activity);
      previousActivity = activity;
    }

    const startTimes = new Set();
    startTimes.add(0);
    while (startTimes.size < activities.length) {
      startTimes.add(Math.floor(Math.random() * totalDuration));
    }
    Array.from(startTimes)
      .sort((a, b) => a - b)
      .forEach((start, i) =>
        timePeriods.insertBack({ start, activity: activities[i] })
      );

    population.push({
      periods: timePeriods,
      excessPvEnergyUse,
    });
  }
  return population;
};

module.exports = {
  populationFunction,
};