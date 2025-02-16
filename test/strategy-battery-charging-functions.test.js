const { expect, describe, it, afterEach } = require('@jest/globals');
const {
  calculateBatteryChargingStrategy,
} = require('../src/strategy-battery-charging-functions');

const moment = require('moment');

afterEach(() => {
  jest.restoreAllMocks();
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
    jest.spyOn(Math, 'random').mockImplementation(random);
    let now = Date.now();
    now = now - (now % (60 * 60 * 1000));
    const priceData = [
      { importPrice: 1, exportPrice: 0, start: new Date(now).toString() },
      {
        importPrice: 500,
        exportPrice: 0,
        start: new Date(now + 60 * 60 * 1000).toString(),
      },
      {
        importPrice: 500,
        exportPrice: 0,
        start: new Date(now + 60 * 60 * 1000 * 2).toString(),
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

    const config = {
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
    };
    const strategy = calculateBatteryChargingStrategy(config);
    const bestSchedule = strategy.best.schedule;

    expect(bestSchedule.length).toEqual(2);
    expect(bestSchedule[0]).toMatchObject({
      activity: 1,
    });
    expect(bestSchedule[1]).toMatchObject({
      activity: -1,
      name: 'discharging',
    });

    const noBatterySchedule = strategy.noBattery.schedule;
    expect(noBatterySchedule.length).toEqual(1);

    expect(strategy.best.excessPvEnergyUse).toEqual(excessPvEnergyUse);
    expect(strategy.best.cost).not.toBeNull();
    expect(strategy.best.cost).not.toBeNaN();
    expect(strategy.best.noBattery).not.toBeNull();
    expect(strategy.best.noBattery).not.toBeNaN();

    console.log(`best: ${strategy.best.cost}`);
    console.log(`no battery: ${strategy.noBattery.cost}`);

    const values = bestSchedule
      .filter((e) => e.activity != 0)
      .reduce((total, e) => {
        const toTimeString = (date) => {
          const HH = date.getHours().toString().padStart(2, '0');
          const mm = date.getMinutes().toString().padStart(2, '0');
          return `${HH}:${mm}`;
        };

        const touPattern = (start, end, charge) => {
          let pattern = toTimeString(start);
          pattern += '-';
          pattern += toTimeString(end);
          pattern += '/';
          pattern += start.getDay();
          pattern += '/';
          pattern += charge;
          return pattern;
        };

        const startDate = new Date(e.start);
        const endDate = new Date(
          startDate.getTime() + (e.duration - 1) * 60000
        );
        const charge = e.activity == 1 ? '+' : '-';
        if (startDate.getDay() == endDate.getDay()) {
          total.push(touPattern(startDate, endDate, charge));
        } else {
          const endDateDay1 = new Date(startDate);
          endDateDay1.setHours(23);
          endDateDay1.setMinutes(59);
          total.push(touPattern(startDate, endDateDay1, charge));

          const startDateDay2 = new Date(endDate);
          startDateDay2.setHours(0);
          startDateDay2.setMinutes(0);
          total.push(touPattern(startDateDay2, endDate, charge));
        }
        return total;
      }, []);
  });

  test('calculate overlapping', () => {
    const payload = require('./payload.json');
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date(payload.priceData[0].start));

    const populationSize = 300;
    const numberOfPricePeriods = 50;
    const generations = 600;
    const mutationRate = 0.03;

    const batteryMaxEnergy = 5; // kWh
    const batteryMaxOutputPower = 2.5; // kW
    const batteryMaxInputPower = 2.5; // kW
    const excessPvEnergyUse = 0;

    const config = {
      priceData: payload.priceData,
      populationSize,
      numberOfPricePeriods,
      generations,
      mutationRate,
      batteryMaxEnergy,
      batteryMaxOutputPower,
      batteryMaxInputPower,
      productionForecast: payload.productionForecast,
      consumptionForecast: payload.consumptionForecast,
      soc: payload.soc,
      excessPvEnergyUse,
    };
    const strategy = calculateBatteryChargingStrategy(config);

    const startTime = (interval) => moment(interval.start);
    const endTime = (interval) =>
      moment(interval.start).add(interval.duration, 's');

    for (let i = 1; i < strategy.best.schedule.length; i++) {
      expect(endTime(strategy.best.schedule[i] - 1).unix()).toBeLessThan(
        startTime(strategy.best.schedule[i]).unix()
      );
    }
  });
});

describe('Price spread calculations', () => {
  test('should skip optimization when price spread is below threshold', () => {
    jest.spyOn(Math, 'random').mockImplementation(random);
    let now = Date.now();
    now = now - (now % (60 * 60 * 1000));
    
    // Create prices with less than 10% spread
    const priceData = [
      { importPrice: 1.00, exportPrice: 0, start: new Date(now).toString() },
      { importPrice: 1.07, exportPrice: 0, start: new Date(now + 60 * 60 * 1000).toString() },
      { importPrice: 1.09, exportPrice: 0, start: new Date(now + 60 * 60 * 1000 * 2).toString() },
    ];
    
    const productionForecast = priceData.map((v) => {
      return { start: v.start, value: 0 };
    });
    const consumptionForecast = priceData.map((v) => {
      return { start: v.start, value: 1.5 };
    });

    const config = {
      priceData,
      populationSize: 100,
      numberOfPricePeriods: 2,
      generations: 500,
      mutationRate: 0.03,
      minPriceSpreadPercent: 10,
      batteryMaxEnergy: 3,
      batteryMaxOutputPower: 3,
      batteryMaxInputPower: 3,
      averageConsumption: 1.5,
      averageProduction: 0,
      productionForecast,
      consumptionForecast,
      soc: 0,
      excessPvEnergyUse: 0,
    };

    const strategy = calculateBatteryChargingStrategy(config);
    
    // Verify the strategy was skipped
    expect(strategy.skippedDueToLowPriceSpread).toBe(true);
    expect(strategy.priceSpreadPercentage).toBeLessThan(10);
    expect(strategy.best.schedule.length).toBe(1);
    expect(strategy.best.schedule[0].activity).toBe(0); // Should be idle
  });

  test('should run optimization when price spread is above threshold', () => {
    jest.spyOn(Math, 'random').mockImplementation(random);
    let now = Date.now();
    now = now - (now % (60 * 60 * 1000));
    
    // Create prices with more than 10% spread
    const priceData = [
      { importPrice: 1.00, exportPrice: 0, start: new Date(now).toString() },
      { importPrice: 1.50, exportPrice: 0, start: new Date(now + 60 * 60 * 1000).toString() },
      { importPrice: 1.20, exportPrice: 0, start: new Date(now + 60 * 60 * 1000 * 2).toString() },
    ];
    
    const productionForecast = priceData.map((v) => {
      return { start: v.start, value: 0 };
    });
    const consumptionForecast = priceData.map((v) => {
      return { start: v.start, value: 1.5 };
    });

    const config = {
      priceData,
      populationSize: 100,
      numberOfPricePeriods: 2,
      generations: 500,
      mutationRate: 0.03,
      minPriceSpreadPercent: 10,
      batteryMaxEnergy: 3,
      batteryMaxOutputPower: 3,
      batteryMaxInputPower: 3,
      averageConsumption: 1.5,
      averageProduction: 0,
      productionForecast,
      consumptionForecast,
      soc: 0,
      excessPvEnergyUse: 0,
    };

    const strategy = calculateBatteryChargingStrategy(config);
    
    // Verify the strategy was not skipped
    expect(strategy.skippedDueToLowPriceSpread).toBeFalsy();
    expect(strategy.priceSpreadPercentage).toBeGreaterThan(10);
    expect(strategy.best.schedule.length).toBeGreaterThan(1);
  });

  test('should use default threshold when not specified', () => {
    jest.spyOn(Math, 'random').mockImplementation(random);
    let now = Date.now();
    now = now - (now % (60 * 60 * 1000));
    
    const priceData = [
      { importPrice: 1.00, exportPrice: 0, start: new Date(now).toString() },
      { importPrice: 1.05, exportPrice: 0, start: new Date(now + 60 * 60 * 1000).toString() },
      { importPrice: 1.08, exportPrice: 0, start: new Date(now + 60 * 60 * 1000 * 2).toString() },
    ];
    
    const productionForecast = priceData.map((v) => {
      return { start: v.start, value: 0 };
    });
    const consumptionForecast = priceData.map((v) => {
      return { start: v.start, value: 1.5 };
    });
    
    const config = {
      priceData,
      populationSize: 100,
      numberOfPricePeriods: 2,
      generations: 500,
      mutationRate: 0.03,
      // minPriceSpreadPercent not specified - should use default 10%
      batteryMaxEnergy: 3,
      batteryMaxOutputPower: 3,
      batteryMaxInputPower: 3,
      averageConsumption: 1.5,
      productionForecast,
      consumptionForecast,
      soc: 0,
      excessPvEnergyUse: 0,
    };

    const strategy = calculateBatteryChargingStrategy(config);
    
    // Verify default threshold was used
    expect(strategy.skippedDueToLowPriceSpread).toBe(true);
    expect(strategy.priceSpreadPercentage).toBeLessThan(10);
  });

  test('should handle custom threshold values', () => {
    jest.spyOn(Math, 'random').mockImplementation(random);
    let now = Date.now();
    now = now - (now % (60 * 60 * 1000));
    
    const priceData = [
      { importPrice: 1.00, exportPrice: 0, start: new Date(now).toString() },
      { importPrice: 1.05, exportPrice: 0, start: new Date(now + 60 * 60 * 1000).toString() },
      { importPrice: 1.08, exportPrice: 0, start: new Date(now + 60 * 60 * 1000 * 2).toString() },
    ];
    
    const productionForecast = priceData.map((v) => {
      return { start: v.start, value: 0 };
    });
    const consumptionForecast = priceData.map((v) => {
      return { start: v.start, value: 1.5 };
    });
    
    const config = {
      priceData,
      populationSize: 100,
      numberOfPricePeriods: 2,
      generations: 500,
      mutationRate: 0.03,
      minPriceSpreadPercent: 5, // Set lower threshold
      batteryMaxEnergy: 3,
      batteryMaxOutputPower: 3,
      batteryMaxInputPower: 3,
      averageConsumption: 1.5,
      productionForecast,
      consumptionForecast,
      soc: 0,
      excessPvEnergyUse: 0,
    };

    const strategy = calculateBatteryChargingStrategy(config);
    
    // Verify custom threshold was used
    expect(strategy.skippedDueToLowPriceSpread).toBe(false);
    expect(strategy.priceSpreadPercentage).toBeGreaterThan(5);
  });

  test('should use correct default threshold value of 12%', () => {
    jest.spyOn(Math, 'random').mockImplementation(random);
    let now = Date.now();
    now = now - (now % (60 * 60 * 1000));
    
    // Create prices with exactly 11% spread - should skip with 12% threshold but would not have skipped with 10%
    const priceData = [
      { importPrice: 1.00, exportPrice: 0, start: new Date(now).toString() },
      { importPrice: 1.11, exportPrice: 0, start: new Date(now + 60 * 60 * 1000).toString() },
      { importPrice: 1.05, exportPrice: 0, start: new Date(now + 60 * 60 * 1000 * 2).toString() },
    ];
    
    const productionForecast = priceData.map((v) => {
      return { start: v.start, value: 0 };
    });
    const consumptionForecast = priceData.map((v) => {
      return { start: v.start, value: 1.5 };
    });
    
    const config = {
      priceData,
      populationSize: 100,
      numberOfPricePeriods: 2,
      generations: 500,
      mutationRate: 0.03,
      // minPriceSpreadPercent not specified - should use default 12%
      batteryMaxEnergy: 3,
      batteryMaxOutputPower: 3,
      batteryMaxInputPower: 3,
      averageConsumption: 1.5,
      productionForecast,
      consumptionForecast,
      soc: 0,
      excessPvEnergyUse: 0,
    };

    const strategy = calculateBatteryChargingStrategy(config);
    
    // With 11% spread and 12% threshold, should skip
    expect(strategy.skippedDueToLowPriceSpread).toBe(true);
    expect(strategy.priceSpreadPercentage).toBeCloseTo(11, 1);
  });
});