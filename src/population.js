const { generateRandomActivity, isChargingAllowed } = require('./utils');
const { DoublyLinkedList } = require('./schedule');

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
      
      let activity;
      if (!isChargingAllowed(periodStart, chargingRestrictions)) {
        // During restricted hours, only allow discharge or idle
        activity = generateRandomActivity(previousActivity);
        if (activity === 1) activity = Math.random() < 0.5 ? -1 : 0;
      } else {
        activity = generateRandomActivity(previousActivity);
      }
      
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
