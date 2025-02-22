function* splitIntoHourIntervalsGenerator(seed, props) {
  let remainingDuration = seed.duration;
  let start = seed.start;
  
  while (remainingDuration > 0) {
    // Default split at hour boundaries
    let splitDuration = Math.min(60 - (start % 60), remainingDuration);
    
    // If charging restrictions are enabled, check for restriction boundaries
    if (props?.chargingRestrictions && seed.activity === 1) {
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
    chargingRestrictions
  } = props;
  
  let cost = 0;
  let currentCharge = _currentCharge;
  
  // Check if this is a charging period that overlaps with restrictions
  if (period.activity === 1 && chargingRestrictions) {
    const baseDate = new Date(input[0].start);
    const periodStart = new Date(baseDate);
    periodStart.setMinutes(periodStart.getMinutes() + period.start);
    
    // Check first minute of period
    if (!isChargingAllowed(periodStart, chargingRestrictions)) {
      // Return massive penalty for restricted charging
      return [1000000, 0]; // Extremely high cost, no charge gain
    }
    
    // Check end of period
    const periodEnd = new Date(periodStart);
    periodEnd.setMinutes(periodEnd.getMinutes() + period.duration);
    if (!isChargingAllowed(periodEnd, chargingRestrictions)) {
      // Return massive penalty for restricted charging
      return [1000000, 0];
    }
  }

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
    const { importPrice, exportPrice, consumption, production } =
      input[Math.floor(interval.start / 60)];

    const v = calculateIntervalScore({
      activity: interval.activity,
      importPrice,
      exportPrice,
      consumption: consumption * duration,
      production: production * duration,
      maxCharge,
      maxDischarge,
      excessPvEnergyUse: excessPvEnergyUse,
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