import { geneticAlgorithmConstructor, Options } from './geneticalgorithm';
import {
  fitnessFunction,
  allPeriodsGenerator,
  allPeriods,
  calculatePeriodScore,
  cost,
  FitnessFunctionProps,
  splitIntoHourIntervals,
} from './fitness';
import { Activity, Phenotype, populationFunction, TimePeriod } from './population';
import { mutationFunction } from './mutation';
import { crossoverFunction } from './crossover';
import { DoublyLinkedList } from './schedule';
import { ChargingRestriction, chargingBlockedMask } from './utils';
import moment from 'moment';

type Price = {
  start: number;
  importPrice: number;
  exportPrice: number;
};

type Value = {
  start: number;
  value: number;
};

export type Config = {
  priceData: (Price & Partial<Value>)[];
  consumptionForecast: Value[];
  productionForecast: Value[];
  populationSize: number;
  numberOfPricePeriods: number;
  generations: number;
  mutationRate: number;
  batteryMaxEnergy: number;
  batteryMaxOutputPower: number;
  batteryMaxInputPower: number;
  averageConsumption?: number;
  averageProduction?: number;
  excessPvEnergyUse: 0 | 1;
  soc: number;
  batteryIdleLoss: number;
  chargingRestriction?: ChargingRestriction;
};

/**
 * A charging period that crosses a restriction boundary is reported as charging
 * outside it and idle inside it, with cost and charge split to match.
 */
const effectivePeriods = (
  props: FitnessFunctionProps,
  period: TimePeriod,
  excessPvEnergyUse: number | undefined,
  currentCharge: number
): TimePeriod[] => {
  if (!props.chargingBlocked || period.activity !== 1) {
    return [period];
  }

  const runs: TimePeriod[] = [];
  for (const interval of splitIntoHourIntervals(period, props.chargingBlocked)) {
    const last = runs.at(-1);
    if (last && last.activity === interval.activity) {
      last.duration = (last.duration ?? 0) + interval.duration;
    } else {
      runs.push({ ...interval });
    }
  }

  let charge = currentCharge;
  return runs.map((run) => {
    const [runCost, runCharge] = calculatePeriodScore(props, run, excessPvEnergyUse, charge);
    charge += runCharge;
    return { ...run, cost: runCost, charge: runCharge };
  });
};

const toSchedule = (
  props: FitnessFunctionProps,
  phenotype: Phenotype
): {
  start: string;
  activity: Activity;
  name: string;
  duration: number;
  cost: number;
  charge: number;
}[] => {
  const { input, soc, batteryMaxEnergy } = props;

  const activityToName = (activity: Activity) => {
    switch (activity) {
      case -1:
        return 'discharging';
      case 1:
        return 'charging';
      default:
        return 'idle';
    }
  };

  const schedule: {
    start: string;
    activity: Activity;
    name: string;
    duration: number;
    cost: number;
    charge: number;
  }[] = [];
  const periodStart = moment.unix(input[0].start);
  let currentCharge = soc * batteryMaxEnergy;
  for (const fullPeriod of allPeriodsGenerator(props, phenotype)) {
    if (fullPeriod.duration != undefined && fullPeriod.duration <= 0) {
      continue;
    }

    for (const period of effectivePeriods(
      props,
      fullPeriod,
      phenotype.excessPvEnergyUse,
      currentCharge
    )) {
      const lastPeriod = schedule.at(-1)!;
      if (lastPeriod && lastPeriod.activity === period.activity) {
        lastPeriod.duration += period.duration ?? 0;
        lastPeriod.cost += period.cost ?? 0;
        lastPeriod.charge += period.charge ?? 0;
      } else {
        schedule.push({
          start: periodStart.clone().add(period.start, 'm').toISOString(),
          activity: period.activity,
          name: activityToName(period.activity),
          duration: period.duration ?? 0,
          cost: period.cost ?? 0,
          charge: period.charge ?? 0,
        });
      }
    }
    currentCharge += fullPeriod.charge ?? 0;
  }

  return schedule;
};

const mergeInput = (config: Config) => {
  const {
    averageConsumption,
    averageProduction,
    priceData,
    consumptionForecast,
    productionForecast,
  } = config;

  // Start at the next whole hour, so the schedule never begins in the past
  const now = moment();
  const firstHour = now.clone().startOf('hour');
  if (now.isAfter(firstHour)) {
    firstHour.add(1, 'h');
  }
  return priceData
    .filter((v) => v.start >= firstHour.unix())
    .map((v) => {
      return {
        start: v.start,
        importPrice: v.importPrice ?? v.value,
        exportPrice: v.exportPrice ?? v.importPrice ?? v.value,
        consumption:
          consumptionForecast.find((c) => c.start === v.start)?.value ?? averageConsumption ?? 0,
        production:
          productionForecast.find((p) => p.start === v.start)?.value ?? averageProduction ?? 0,
      };
    });
};

export const calculateBatteryChargingStrategy = (config: Config) => {
  const { generations } = config;

  const input = mergeInput(config);
  if (input === undefined || input.length === 0) return;

  const totalDuration = input.length * 60;
  const props = {
    ...config,
    input,
    totalDuration,
    batteryIdleLoss: config.batteryIdleLoss ?? 0,
    chargingBlocked: chargingBlockedMask(input[0].start, totalDuration, config.chargingRestriction),
  };

  const options: Options<Phenotype> = {
    mutationFunction: mutationFunction(props),
    crossoverFunction: crossoverFunction(props),
    fitnessFunction: fitnessFunction(props),
    population: populationFunction(props),
  };

  const geneticAlgorithm = geneticAlgorithmConstructor(options);

  for (let i = 0; i < generations; i += 1) {
    geneticAlgorithm.evolve();
  }

  const best = geneticAlgorithm.best();
  const noBattery = {
    periods: new DoublyLinkedList<TimePeriod>().insertBack({
      start: 0,
      activity: 0,
    }),
    excessPvEnergyUse: 0,
  };
  return {
    best: {
      schedule: toSchedule(props, best),
      excessPvEnergyUse: best.excessPvEnergyUse,
      cost: cost(allPeriods(props, best)),
    },
    noBattery: {
      schedule: toSchedule(props, noBattery),
      excessPvEnergyUse: noBattery.excessPvEnergyUse,
      cost: cost(allPeriods(props, noBattery)),
    },
  };
};
