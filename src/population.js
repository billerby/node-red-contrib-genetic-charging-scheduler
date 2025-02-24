const { generateRandomActivity, isChargingAllowed } = require('./utils');
const { DoublyLinkedList } = require('./schedule');

const populationFunction = (props) => {
  const {
      totalDuration,
      populationSize,
      numberOfPricePeriods,
      excessPvEnergyUse = 0,
      input = [],
      chargingRestrictions,
      evChargingEnabled,
      evMaxChargingTimeMinutes = 120 // Default to 2 hours if not specified
  } = props;

  const population = [];
  for (let i = 0; i < populationSize; i += 1) {
      const timePeriods = new DoublyLinkedList();
      const activities = [];
      let currentNumberOfPricePeriods = 0;
      let previousActivity = undefined;
      let evChargingIncluded = false; // Track if an EV charging period is already included

      while (currentNumberOfPricePeriods < numberOfPricePeriods) {
          const baseDate = input[0]?.start ? new Date(input[0].start) : new Date();
          const periodStart = new Date(baseDate);
          periodStart.setMinutes(periodStart.getMinutes() + currentNumberOfPricePeriods * 30);
          
          let activity;
          
          // Check charging restrictions first
          if (!isChargingAllowed(periodStart, chargingRestrictions)) {
              // During restricted hours, only allow discharge or idle
              activity = Math.random() < 0.5 ? -1 : 0;
          } else {
              // Outside restricted hours, generate a random activity
              
              // If EV charging is enabled, but we already have an EV charging period,
              // exclude it from possible activities
              const excludeEVCharging = evChargingIncluded;
              
              // Get a random activity, potentially including EV charging (2)
              activity = generateRandomActivity(
                  previousActivity, 
                  evChargingEnabled && !excludeEVCharging
              );
              
              // If this is an EV charging activity, mark it as included
              if (activity === 2) {
                  evChargingIncluded = true;
              }
          }
          
          currentNumberOfPricePeriods += activity != 0;
          activities.push(activity);
          previousActivity = activity;
      }

      // Generate distributed start times for each activity
      const startTimes = new Set();
      startTimes.add(0);
      while (startTimes.size < activities.length) {
          startTimes.add(Math.floor(Math.random() * totalDuration));
      }
      
      // Convert to array, sort, and create periods
      const sortedStartTimes = Array.from(startTimes).sort((a, b) => a - b);
      
      // Insert periods with appropriate durations
      for (let i = 0; i < sortedStartTimes.length; i++) {
          const start = sortedStartTimes[i];
          const activity = activities[i];
          
          // For EV charging, limit maximum duration directly in the population
          if (activity === 2 && evMaxChargingTimeMinutes) {
              // Calculate available duration until next period or until max EV charging time
              const nextStartTime = i < sortedStartTimes.length - 1 ? 
                  sortedStartTimes[i + 1] : totalDuration;
              
              const availableDuration = nextStartTime - start;
              const maxEVDuration = Math.min(availableDuration, evMaxChargingTimeMinutes);
              
              // Insert period with limited duration
              timePeriods.insertBack({ 
                  start, 
                  activity,
                  // Optionally add a max duration hint that other code can use
                  maxDuration: maxEVDuration
              });
          } else {
              // For non-EV periods, insert normally
              timePeriods.insertBack({ start, activity });
          }
      }

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