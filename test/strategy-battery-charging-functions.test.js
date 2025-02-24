const { expect, describe, it, afterEach, beforeEach } = require('@jest/globals');
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

describe('EV Charging Strategy Tests', () => {
  let baseConfig;
  let mockDate;
  
  beforeEach(() => {
      // Set up base test date to a non-restricted time
      mockDate = new Date('2024-01-15T21:00:00.000Z'); // 9 PM
      jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
      
      // Create base price data for 3 hours
      const priceData = Array.from({ length: 3 }).map((_, i) => ({
          importPrice: 1 + Math.sin(i * Math.PI / 2), // Creates price variation
          exportPrice: (1 + Math.sin(i * Math.PI / 2)) * 0.5,
          start: new Date(mockDate.getTime() + i * 60 * 60 * 1000).toString()
      }));
      
      // Base configuration
      baseConfig = {
          priceData,
          populationSize: 100,
          numberOfPricePeriods: 4,
          generations: 100,
          mutationRate: 0.03,
          batteryMaxEnergy: 13.5,
          batteryMaxOutputPower: 5,
          batteryMaxInputPower: 5,
          soc: 50,
          productionForecast: priceData.map(v => ({ start: v.start, value: 0 })),
          consumptionForecast: priceData.map(v => ({ start: v.start, value: 1 })),
          evChargingEnabled: true,
          evMaxChargingPower: 11,
          ev_soc: 30,
          ev_limit: 80
      };
  });

  test('should generate separate schedules for EV and home battery', () => {
      const strategy = calculateBatteryChargingStrategy(baseConfig);
      
      const evPeriods = strategy.best.schedule.filter(p => p.name === 'charging_ev');
      const batteryPeriods = strategy.best.schedule.filter(p => p.name === 'charging_battery');
      
      expect(evPeriods.length).toBeGreaterThan(0);
      expect(batteryPeriods.length).toBeGreaterThan(0);
  });

  test('should not schedule EV charging when disabled', () => {
      const config = {
          ...baseConfig,
          evChargingEnabled: false
      };
      
      const strategy = calculateBatteryChargingStrategy(config);
      const evPeriods = strategy.best.schedule.filter(p => p.name === 'charging_ev');
      
      expect(evPeriods.length).toBe(0);
  });

  test('should respect charging restrictions for both EV and battery', () => {
      // Set date to winter (when restrictions apply)
      const winterDate = new Date('2024-01-15T12:00:00.000Z'); // Noon, should be restricted
      jest.spyOn(Date, 'now').mockReturnValue(winterDate.getTime());
      
      const config = {
          ...baseConfig,
          chargingRestrictions: {
              startDate: "11-01",
              endDate: "03-31",
              startTime: "07:00",
              endTime: "20:00",
              allowWeekends: false
          },
          // Update price data for new time
          priceData: Array.from({ length: 3 }).map((_, i) => ({
              importPrice: 1 + Math.sin(i * Math.PI / 2),
              exportPrice: (1 + Math.sin(i * Math.PI / 2)) * 0.5,
              start: new Date(winterDate.getTime() + i * 60 * 60 * 1000).toString()
          }))
      };
      
      const strategy = calculateBatteryChargingStrategy(config);
      
      const restrictedPeriods = strategy.best.schedule.filter(p => 
          (p.name === 'charging_ev' || p.name === 'charging_battery') &&
          new Date(p.start).getHours() >= 7 &&
          new Date(p.start).getHours() < 20
      );
      
      expect(restrictedPeriods.length).toBe(0);
  });

  test('should prioritize charging during low price periods', () => {
    // Set up test time
    const mockDate = new Date('2024-01-15T21:00:00.000Z'); // 9 PM
    jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
    
    // Create more extreme price differences to make optimization more obvious
    const priceData = [
        { importPrice: 0.1, exportPrice: 0.05, start: mockDate.toString() },
        { importPrice: 5.0, exportPrice: 2.50, start: new Date(mockDate.getTime() + 60 * 60 * 1000).toString() },
        { importPrice: 0.2, exportPrice: 0.10, start: new Date(mockDate.getTime() + 60 * 60 * 1000 * 2).toString() }
    ];
    
    const config = {
        ...baseConfig,
        priceData,
        populationSize: 150,
        numberOfPricePeriods: 4,
        generations: 250,
        soc: 20,
        ev_soc: 20,
        productionForecast: priceData.map(v => ({ start: v.start, value: 0 })),
        consumptionForecast: priceData.map(v => ({ start: v.start, value: 1 }))
    };
    
    const strategy = calculateBatteryChargingStrategy(config);
    
    console.log('Complete schedule:', strategy.best.schedule);
    
    let cheapChargingMinutes = 0;
    let expensiveChargingMinutes = 0;
    
    strategy.best.schedule.forEach(period => {
        if (period.name === 'charging_ev' || period.name === 'charging_battery') {
            const periodStart = new Date(period.start);
            const hourDiff = (periodStart.getTime() - mockDate.getTime()) / (60 * 60 * 1000);
            const priceIndex = Math.floor(hourDiff);
            
            console.log('Charging period:', {
                name: period.name,
                start: periodStart.toISOString(),
                priceIndex,
                price: priceData[priceIndex]?.importPrice,
                duration: period.duration
            });
            
            if (priceIndex >= 0 && priceIndex < priceData.length) {
                if (priceData[priceIndex].importPrice < 1.0) {
                    cheapChargingMinutes += period.duration;
                } else {
                    expensiveChargingMinutes += period.duration;
                }
            }
        }
    });
    
    console.log('Charging minutes in cheap periods:', cheapChargingMinutes);
    console.log('Charging minutes in expensive periods:', expensiveChargingMinutes);
    console.log('Strategy cost:', strategy.best.cost);
    
    // Ensure we have some charging
    expect(cheapChargingMinutes + expensiveChargingMinutes).toBeGreaterThan(0);
    // Should have significantly more charging during cheap times
    expect(cheapChargingMinutes).toBeGreaterThan(expensiveChargingMinutes * 2);
});
});