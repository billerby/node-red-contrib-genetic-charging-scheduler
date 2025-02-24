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
    
    // Set the date to a time when charging is allowed (e.g., 21:00)
    const now = new Date();
    now.setHours(21, 0, 0, 0);
    now.setTime(now.getTime() - (now.getTime() % (60 * 60 * 1000)));
    
    const priceData = [
      { importPrice: 1, exportPrice: 0, start: new Date(now).toString() },
      {
        importPrice: 500,
        exportPrice: 0,
        start: new Date(now.getTime() + 60 * 60 * 1000).toString(),
      },
      {
        importPrice: 500,
        exportPrice: 0,
        start: new Date(now.getTime() + 60 * 60 * 1000 * 2).toString(),
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

describe('Charging Time Restrictions', () => {
  test('should not allow charging during power fee hours in winter', () => {
    // Set date to January 1st at 12:00 (middle of the day during power fee season)
    const winterNoon = new Date('2024-01-01T12:00:00.000Z');
    jest.spyOn(Date, 'now').mockReturnValue(winterNoon.getTime());
    
    const priceData = [
      { importPrice: 1, exportPrice: 0, start: winterNoon.toString() },
      { 
        importPrice: 500, 
        exportPrice: 0, 
        start: new Date(winterNoon.getTime() + 60 * 60 * 1000).toString() 
      }
    ];
    
    const config = {
      priceData,
      populationSize: 100,
      numberOfPricePeriods: 2,
      generations: 100,
      mutationRate: 0.03,
      batteryMaxEnergy: 3,
      batteryMaxOutputPower: 3,
      batteryMaxInputPower: 3,
      productionForecast: priceData.map(v => ({ start: v.start, value: 0 })),
      consumptionForecast: priceData.map(v => ({ start: v.start, value: 1.5 })),
      soc: 0,
      excessPvEnergyUse: 0,
      // Add charging restrictions configuration
      chargingRestrictions: {
        startDate: "11-01",    // November 1st
        endDate: "03-31",      // March 31st
        startTime: "07:00",    // 7 AM
        endTime: "20:00"       // 8 PM
      }
    };

    const strategy = calculateBatteryChargingStrategy(config);
    
    // Check that no charging periods exist during restricted hours
    const chargingPeriods = strategy.best.schedule.filter(period => period.activity === 1);
    expect(chargingPeriods.length).toBe(0);
  });

  test('should allow charging during non-power fee hours in winter', () => {
    // Set date to January 1st at 22:00 (evening, outside power fee hours)
    const winterEvening = new Date('2024-01-01T22:00:00.000Z');
    jest.spyOn(Date, 'now').mockReturnValue(winterEvening.getTime());
    
    const priceData = [
      { importPrice: 1, exportPrice: 0, start: winterEvening.toString() },
      { 
        importPrice: 500, 
        exportPrice: 0, 
        start: new Date(winterEvening.getTime() + 60 * 60 * 1000).toString() 
      }
    ];
    
    const config = {
      priceData,
      populationSize: 100,
      numberOfPricePeriods: 2,
      generations: 100,
      mutationRate: 0.03,
      batteryMaxEnergy: 3,
      batteryMaxOutputPower: 3,
      batteryMaxInputPower: 3,
      productionForecast: priceData.map(v => ({ start: v.start, value: 0 })),
      consumptionForecast: priceData.map(v => ({ start: v.start, value: 1.5 })),
      soc: 0,
      excessPvEnergyUse: 0,
      // Add charging restrictions configuration
      chargingRestrictions: {
        startDate: "11-01",    // November 1st
        endDate: "03-31",      // March 31st
        startTime: "07:00",    // 7 AM
        endTime: "20:00"       // 8 PM
      }
    };

    const strategy = calculateBatteryChargingStrategy(config);
    
    // Verify that charging is allowed during these hours
    const chargingPeriods = strategy.best.schedule.filter(period => period.activity === 1);
    expect(chargingPeriods.length).toBeGreaterThan(0);
  });

  test('should allow charging any time during summer', () => {
    // Set date to July 1st at 12:00 (middle of the day during summer)
    const summerNoon = new Date('2024-07-01T12:00:00.000Z');
    jest.spyOn(Date, 'now').mockReturnValue(summerNoon.getTime());
    
    const priceData = [
      { importPrice: 1, exportPrice: 0, start: summerNoon.toString() },
      { 
        importPrice: 500, 
        exportPrice: 0, 
        start: new Date(summerNoon.getTime() + 60 * 60 * 1000).toString() 
      }
    ];
    
    const config = {
      priceData,
      populationSize: 100,
      numberOfPricePeriods: 2,
      generations: 100,
      mutationRate: 0.03,
      batteryMaxEnergy: 3,
      batteryMaxOutputPower: 3,
      batteryMaxInputPower: 3,
      productionForecast: priceData.map(v => ({ start: v.start, value: 0 })),
      consumptionForecast: priceData.map(v => ({ start: v.start, value: 1.5 })),
      soc: 0,
      excessPvEnergyUse: 0,
      // Add charging restrictions configuration - even with restrictions,
      // summer dates should allow charging
      chargingRestrictions: {
        startDate: "11-01",    // November 1st
        endDate: "03-31",      // March 31st
        startTime: "07:00",    // 7 AM
        endTime: "20:00"       // 8 PM
      }
    };

    const strategy = calculateBatteryChargingStrategy(config);
    
    // Verify that charging is allowed during summer days
    const chargingPeriods = strategy.best.schedule.filter(period => period.activity === 1);
    expect(chargingPeriods.length).toBeGreaterThan(0);
  });
});