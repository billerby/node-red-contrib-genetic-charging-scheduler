function* splitIntoHourIntervalsGenerator(seed, props) {
  let remainingDuration = seed.duration;
  let start = seed.start;
  
  while (remainingDuration > 0) {
    // Default split at hour boundaries
    let splitDuration = Math.min(60 - (start % 60), remainingDuration);
    
    // If charging restrictions are enabled, check for restriction boundaries
    // Apply to both battery (activity 1) and EV (activity 2) charging
    if (props?.chargingRestrictions && (seed.activity === 1 || seed.activity === 2)) {
      const baseDate = new Date(props.input[0].start);
      const periodDate = new Date(baseDate);
      periodDate.setMinutes(periodDate.getMinutes() + start);
      
      // If currently allowed but not allowed in next period, split at restriction start
      if (isChargingAllowed(periodDate, props.chargingRestrictions)) {
        const nextMinute = new Date(periodDate);
        nextMinute.setMinutes(nextMinute.getMinutes() + splitDuration);
        if (!isChargingAllowed(nextMinute, props.chargingRestrictions)) {
          // Find exact minute where restriction starts
          for (let i = 1; i <= splitDuration; i++) {
            const checkDate = new Date(periodDate);
            checkDate.setMinutes(checkDate.getMinutes() + i);
            if (!isChargingAllowed(checkDate, props.chargingRestrictions)) {
              splitDuration = i;
              break;
            }
          }
        }
      }
    }
    
    // Special handling for EV charging to enforce maximum charging time
    if (seed.activity === 2 && props?.evMaxChargingTimeMinutes) {
      // If this would exceed the max EV charging time, limit it
      if (start - seed.start + splitDuration > props.evMaxChargingTimeMinutes) {
        splitDuration = Math.max(0, props.evMaxChargingTimeMinutes - (start - seed.start));
        if (splitDuration <= 0) break; // Stop if we've reached maximum charging time
      }
    }
    
    yield {
      start: start,
      duration: splitDuration,
      activity: seed.activity,
    };
    
    start += splitDuration;
    remainingDuration -= splitDuration;
  }
  return;
}

const splitIntoHourIntervals = (seed) => [
  ...splitIntoHourIntervalsGenerator(seed),
];

function* allPeriodsGenerator(props, phenotype) {
  const { batteryMaxEnergy, soc, totalDuration } = props;
  const { excessPvEnergyUse, periods } = phenotype;
  let currentCharge = soc * batteryMaxEnergy;

  const addCosts = (period) => {
    const score = calculatePeriodScore(
      props,
      period,
      excessPvEnergyUse,
      currentCharge
    );
    currentCharge += score[1];
    period.cost = score[0];
    period.charge = score[1];
    return period;
  };

  let node = periods.head;
  while (node) {
    const end = node.next ? node.next.data.start : totalDuration;
    const period = { ...node.data };
    period.duration = end - period.start;
    yield addCosts(period);
    node = node.next;
  }
}

const allPeriods = (props, phenotype) => {
  return [...allPeriodsGenerator(props, phenotype)];
};

const FEED_TO_GRID = 0;
const CHARGE = 1;

const calculateDischargeScore = (props) => {
  const {
    exportPrice,
    importPrice,
    consumption,
    production,
    maxDischarge,
    maxCharge,
    excessPvEnergyUse,
  } = props;

  const consumedFromProduction = Math.min(consumption, production);
  const batteryChargeFromProduction =
    excessPvEnergyUse == CHARGE
      ? Math.min(production - consumedFromProduction, maxCharge)
      : 0;
  const consumedFromBattery = Math.min(
    consumption - consumedFromProduction,
    maxDischarge
  );
  const soldFromProduction =
    production - consumedFromProduction - batteryChargeFromProduction;
  const consumedFromGrid =
    consumption - consumedFromProduction - consumedFromBattery;

  let cost = consumedFromGrid * importPrice - soldFromProduction * exportPrice;
  let charge = batteryChargeFromProduction - consumedFromBattery;

  return [cost, charge];
};

const calculateNormalScore = (props) => {
  const {
    exportPrice,
    importPrice,
    maxCharge,
    consumption,
    production,
    excessPvEnergyUse,
  } = props;

  const consumedFromProduction = Math.min(consumption, production);
  const batteryChargeFromProduction =
    excessPvEnergyUse == CHARGE
      ? Math.min(production - consumedFromProduction, maxCharge)
      : 0;
  const soldFromProduction =
    production - consumedFromProduction - batteryChargeFromProduction;
  const consumedFromGrid = consumption - consumedFromProduction;

  let cost = importPrice * consumedFromGrid - exportPrice * soldFromProduction;
  let charge = batteryChargeFromProduction;
  return [cost, charge];
};

const calculateChargeScore = (props) => {
  const { exportPrice, importPrice, consumption, production, maxCharge } =
    props;

  const consumedFromProduction = Math.min(consumption, production);
  const batteryChargeFromProduction = Math.min(
    production - consumedFromProduction,
    maxCharge
  );
  const soldFromProduction =
    production - consumedFromProduction - batteryChargeFromProduction;
  const consumedFromGrid = consumption - consumedFromProduction;
  const chargedFromGrid = maxCharge - batteryChargeFromProduction;

  let cost =
    (consumedFromGrid + chargedFromGrid) * importPrice -
    soldFromProduction * exportPrice;
  let charge = batteryChargeFromProduction + chargedFromGrid;

  return [cost, charge];
};

const calculateIntervalScore = (props) => {
  switch (props.activity) {
    case -1:
      return calculateDischargeScore(props);
    case 1:
      return calculateChargeScore(props);
    default:
      return calculateNormalScore(props);
  }
};

const calculatePeriodScore = (props, period, excessPvEnergyUse, _currentCharge) => {
  const {
      input,
      batteryMaxEnergy,
      batteryMaxInputPower,
      batteryMaxOutputPower,
      chargingRestrictions,
      evChargingEnabled,
      evMaxChargingPower,
      ev_soc,
      ev_limit,
      evMaxChargingTimeMinutes
  } = props;

  // Check charging restrictions for both EV and home battery charging
  if ((period.activity === 1 || period.activity === 2) && chargingRestrictions) {
      const baseDate = new Date(input[0].start);
      
      // Check more thoroughly - sample multiple points within the period
      const periodLengthMinutes = period.duration;
      const samplingInterval = Math.min(30, periodLengthMinutes); // Check every 30 minutes or at period end
      
      for (let minute = 0; minute <= periodLengthMinutes; minute += samplingInterval) {
          const checkPoint = new Date(baseDate);
          checkPoint.setMinutes(checkPoint.getMinutes() + period.start + minute);
          
          if (!isChargingAllowed(checkPoint, chargingRestrictions)) {
              return [1000000, 0]; // Extremely high cost to prevent selection
          }
      }
  }

  // Check if this is an EV charging period
  if (period.activity === 2) {
      if (!evChargingEnabled || ev_soc >= ev_limit) {
          return [1000000, 0]; // Extremely high cost to prevent selection
      }
      
      // Apply EV charging time limit if configured
      if (evMaxChargingTimeMinutes && period.duration > evMaxChargingTimeMinutes) {
          // If period is longer than necessary, apply a penalty
          return [1000000, 0]; // Extremely high cost to prevent selection
      }

      let cost = 0;
      let evCharge = 0;

      for (const interval of splitIntoHourIntervals(period)) {
          const duration = interval.duration / 60; // Convert minutes to hours
          
          // Limit charge amount based on available capacity and charging power
          const maxCharge = Math.min(
              evMaxChargingPower * duration,
              ev_limit - ev_soc
          );

          const hourIndex = Math.floor(interval.start / 60);
          if (hourIndex >= input.length) {
              // Safety check for index out of bounds
              continue;
          }
          
          const { importPrice, exportPrice, consumption, production } = input[hourIndex];

          const consumedFromProduction = Math.min(consumption, production);
          const evChargeFromProduction = Math.min(production - consumedFromProduction, maxCharge);
          const evChargeFromGrid = maxCharge - evChargeFromProduction;
          
          // Price multiplier only for EV charging - adjust to make algorithm prioritize EV charging
          // at good times but not create excessively long periods
          const evPriceMultiplier = importPrice <= 1.0 ? 0.5 : 2.0;
          cost += evChargeFromGrid * importPrice * evPriceMultiplier;
          evCharge += maxCharge;
      }

      // Apply slight penalty for very long charging sessions to prevent unnecessary duration
      const durationPenalty = Math.max(0, period.duration - 120) * 0.001; // Gentle penalty after 2 hours
      cost += durationPenalty;

      return [cost, evCharge];
  }

  // Home battery logic - unchanged from original
  let cost = 0;
  let currentCharge = _currentCharge;
  
  for (const interval of splitIntoHourIntervals(period)) {
      const duration = interval.duration / 60;
      const maxCharge = Math.min(
          batteryMaxInputPower * duration,
          batteryMaxEnergy - currentCharge
      );
      const maxDischarge = Math.min(
          batteryMaxOutputPower * duration,
          currentCharge
      );

      const hourIndex = Math.floor(interval.start / 60);
      if (hourIndex >= input.length) {
          // Safety check for index out of bounds
          continue;
      }
      
      const { importPrice, exportPrice, consumption, production } = input[hourIndex];

      const v = calculateIntervalScore({
          activity: interval.activity,
          importPrice,
          exportPrice,
          consumption: consumption * duration,
          production: production * duration,
          maxCharge,
          maxDischarge,
          excessPvEnergyUse
      });
      cost += v[0];
      currentCharge += v[1];
  }
  return [cost, currentCharge - _currentCharge];
};

const cost = (periods) => {
  return periods.reduce((acc, cur) => acc + cur.cost, 0);
};

const { isChargingAllowed } = require('./utils');

const fitnessFunction = (props) => (phenotype) => {
  const periods = allPeriods(props, phenotype);
  let score = -cost(periods);

  // Calculate average price for penalty calculations
  let averagePrice = props.input.reduce((acc, cur) => acc + cur.importPrice, 0) / props.input.length;
  
  // Apply existing penalty for zero charge/discharge periods
  score -= periods.reduce((acc, cur) => {
    if (cur.activity != 0 && cur.charge == 0)
      return acc + (cur.duration * averagePrice) / 60;
    else return acc;
  }, 0);

  // Add new penalty for charging during restricted times
  if (props.chargingRestrictions) {
    const baseDate = new Date(props.input[0].start);
    score -= periods.reduce((acc, period) => {
      if (period.activity === 1) { // If charging
        // Check each hour within the period
        for (let minute = 0; minute < period.duration; minute += 60) {
          const periodDate = new Date(baseDate);
          periodDate.setMinutes(periodDate.getMinutes() + period.start + minute);
          
          if (!isChargingAllowed(periodDate, props.chargingRestrictions)) {
            // Apply extreme penalty for charging during restricted time
            // Using 20x normal price as penalty to strongly discourage any charging during restricted hours
            return acc + (60 * averagePrice * 20); // 20x penalty multiplier
          }
        }
      }
      return acc;
    }, 0);
  }

  return score;
};

module.exports = {
  cost,
  fitnessFunction,
  splitIntoHourIntervals,
  allPeriodsGenerator,
  allPeriods,
  calculatePeriodScore,
  calculateDischargeScore,
  calculateChargeScore,
  calculateNormalScore,
};