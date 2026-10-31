import { describe, expect, test, afterEach, vi } from 'vitest';
import {
  calculateBatteryChargingStrategy,
  Config,
} from '../src/strategy-battery-charging-functions';
import moment from 'moment';

afterEach(() => {
  vi.restoreAllMocks();
});

let seed = 1;
const random = () => {
  if (seed == Infinity) seed = 1;
  const x = seed / Math.PI;
  seed++;
  return x - Math.floor(x);
};

describe('Calculate', () => {
  test('calculate', () => {
    vi.spyOn(Math, 'random').mockImplementation(random);
    const n = moment().add(1, 'h').startOf('hour');
    const priceData = [
      { importPrice: 1, exportPrice: 0, start: n.unix() },
      {
        importPrice: 500,
        exportPrice: 0,
        start: n.clone().add(1, 'h').unix(),
      },
      {
        importPrice: 500,
        exportPrice: 0,
        start: n.clone().add(2, 'h').unix(),
      },
    ];
    const productionForecast = priceData.map((v) => {
      return { start: v.start, value: 0 };
    });
    const consumptionForecast = priceData.map((v) => {
      return { start: v.start, value: 1.5 };
    });
    const populationSize = 100;
    const numberOfPricePeriods = 2;
    const generations = 500;
    const mutationRate = 0.03;

    const batteryMaxEnergy = 3; // kWh
    const batteryMaxOutputPower = 3; // kW
    const batteryMaxInputPower = 3; // kW
    const averageConsumption = 1.5; // kW
    const averageProduction = 0; // kW
    const soc = 0;
    const excessPvEnergyUse = 0;
    const batteryIdleLoss = 0; // kWh/h

    const config: Config = {
      priceData,
      populationSize,
      numberOfPricePeriods,
      generations,
      mutationRate,
      batteryMaxEnergy,
      batteryMaxOutputPower,
      batteryMaxInputPower,
      averageConsumption,
      averageProduction,
      productionForecast,
      consumptionForecast,
      soc,
      excessPvEnergyUse,
      batteryIdleLoss,
    };
    const strategy = calculateBatteryChargingStrategy(config);
    const bestSchedule = strategy!.best.schedule;

    expect(bestSchedule.length).toEqual(2);
    expect(bestSchedule[0]).toMatchObject({
      activity: 1,
    });
    expect(bestSchedule[1]).toMatchObject({
      activity: -1,
      name: 'discharging',
    });

    const noBatterySchedule = strategy!.noBattery.schedule;
    expect(noBatterySchedule.length).toEqual(1);

    expect(strategy!.best.excessPvEnergyUse).toEqual(excessPvEnergyUse);
    expect(strategy!.best.cost).not.toBeNull();
    expect(strategy!.best.cost).not.toBeNaN();
    expect(strategy!.noBattery).not.toBeNull();
    expect(strategy!.noBattery).not.toBeNaN();

    console.log(`best: ${strategy!.best.cost}`);
    console.log(`no battery: ${strategy!.noBattery.cost}`);

    const values = bestSchedule
      .filter((e) => e.activity != 0)
      .reduce((total, e) => {
        const touPattern = (start, end, charge) => {
          let pattern = start.format('HH:mm');
          pattern += '-';
          pattern += end.format('HH:mm');
          pattern += '/';
          pattern += start.day();
          pattern += '/';
          pattern += charge;
          return pattern;
        };

        const startDate = moment(e.start);
        const endDate = startDate.clone().add(e.duration - 1, 'm');
        const charge = e.activity == 1 ? '+' : '-';
        if (startDate.day() === endDate.day()) {
          total.push(touPattern(startDate, endDate, charge));
        } else {
          const endDateDay1 = moment(startDate);
          endDateDay1.hours(23);
          endDateDay1.minutes(59);
          total.push(touPattern(startDate, endDateDay1, charge));

          const startDateDay2 = moment(endDate);
          startDateDay2.hours(0);
          startDateDay2.minutes(0);
          total.push(touPattern(startDateDay2, endDate, charge));
        }
        return total;
      }, [] as string[]);
    expect(values).toBeDefined();
  });
});

describe('Calculate with charging restriction', () => {
  const restriction = {
    startDate: '11-01',
    endDate: '03-31',
    startTime: '07:00',
    endTime: '20:00',
    allowWeekends: true,
  };

  // The 19:00 run on Sunday 2026-11-01 plans until Monday night. Prices are cheapest
  // 03-10 on Monday, so an unrestricted optimizer charges well past 07:00.
  const runMonday = (chargingRestriction?: typeof restriction) => {
    vi.useFakeTimers({ now: moment('2026-11-01 19:00', 'YYYY-MM-DD HH:mm').toDate() });
    const first = moment('2026-11-01 20:00', 'YYYY-MM-DD HH:mm');
    const priceData = Array.from({ length: 28 }, (_, h) => {
      const start = first.clone().add(h, 'h');
      const hour = start.hours();
      const price = hour >= 3 && hour < 10 ? 0.3 : hour >= 16 && hour < 20 ? 3 : 1;
      return { start: start.unix(), importPrice: price, exportPrice: price };
    });
    const config: Config = {
      priceData,
      consumptionForecast: [],
      productionForecast: [],
      populationSize: 50,
      numberOfPricePeriods: 8,
      generations: 400,
      mutationRate: 0.03,
      batteryMaxEnergy: 15,
      batteryMaxOutputPower: 5,
      batteryMaxInputPower: 5,
      averageConsumption: 2,
      excessPvEnergyUse: 0,
      soc: 0.1,
      batteryIdleLoss: 0,
      chargingRestriction,
    };
    const strategy = calculateBatteryChargingStrategy(config)!;
    vi.useRealTimers();
    return { strategy, first, totalDuration: priceData.length * 60 };
  };

  const tariffStart = moment('2026-11-02 07:00', 'YYYY-MM-DD HH:mm');
  const tariffEnd = moment('2026-11-02 20:00', 'YYYY-MM-DD HH:mm');
  const chargesDuringTariff = (schedule: { start: string; activity: number; duration: number }[]) =>
    schedule.some((p) => {
      const start = moment(p.start);
      const end = start.clone().add(p.duration, 'm');
      return p.activity === 1 && start.isBefore(tariffEnd) && end.isAfter(tariffStart);
    });

  test('an unrestricted schedule charges during tariff time', () => {
    seed = 1;
    vi.spyOn(Math, 'random').mockImplementation(random);
    const { strategy } = runMonday();
    expect(chargesDuringTariff(strategy.best.schedule)).toBe(true);
  });

  test.each([1, 1000, 5000])('never charges during tariff time (seed %i)', (s) => {
    seed = s;
    vi.spyOn(Math, 'random').mockImplementation(random);
    const { strategy, first, totalDuration } = runMonday(restriction);
    const schedule = strategy.best.schedule;

    expect(chargesDuringTariff(schedule)).toBe(false);
    // Still charges in the cheap hours before the tariff starts
    expect(schedule.some((p) => p.activity === 1 && moment(p.start).isBefore(tariffStart))).toBe(
      true
    );

    // Contiguous from the first price hour to the last, nothing lost when splitting
    let expectedStart = first.clone();
    for (const p of schedule) {
      expect(moment(p.start).toISOString()).toEqual(expectedStart.toISOString());
      expectedStart = expectedStart.clone().add(p.duration, 'm');
    }
    expect(schedule.reduce((acc, p) => acc + p.duration, 0)).toBe(totalDuration);
    expect(schedule.reduce((acc, p) => acc + p.cost, 0)).toBeCloseTo(strategy.best.cost, 6);
  });
});
