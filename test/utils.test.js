const { expect, describe } = require('@jest/globals');
const { generateRandomActivity, random, isChargingAllowed } = require('../src/utils');

describe('Utils', () => {
  describe('generateRandomActivity', () => {
    test('should exclude specified value', () => {
      const result = generateRandomActivity(1);
      expect(result).not.toBe(1);
      expect([-1, 0]).toContain(result);
    });

    test('should return valid activity', () => {
      const result = generateRandomActivity(null);
      expect([-1, 0, 1]).toContain(result);
    });
  });

  describe('random', () => {
    test('should generate number within range', () => {
      const result = random(1, 10);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThan(10);
    });
  });

  describe('isChargingAllowed', () => {
    const restrictions = {
      startDate: "11-01",    // November 1st
      endDate: "03-31",      // March 31st
      startTime: "07:00",    // 7 AM
      endTime: "20:00"       // 8 PM
    };

    test('should allow charging when no restrictions provided', () => {
      const date = new Date('2024-01-01T12:00:00');
      expect(isChargingAllowed(date)).toBe(true);
      expect(isChargingAllowed(date, null)).toBe(true);
    });

    test('should not allow charging during restricted winter day hours', () => {
      const date = new Date('2024-01-15T12:00:00');
      expect(isChargingAllowed(date, restrictions)).toBe(false);
    });

    test('should allow charging during winter night hours', () => {
      const date = new Date('2024-01-15T21:00:00');
      expect(isChargingAllowed(date, restrictions)).toBe(true);
      
      const earlyMorning = new Date('2024-01-15T05:00:00');
      expect(isChargingAllowed(earlyMorning, restrictions)).toBe(true);
    });

    test('should allow charging during summer day hours', () => {
      const date = new Date('2024-07-15T12:00:00');
      expect(isChargingAllowed(date, restrictions)).toBe(true);
    });

    test('should handle year boundary correctly', () => {
      // December (should be restricted during day)
      const decDay = new Date('2024-12-16T12:00:00');
      expect(isChargingAllowed(decDay, restrictions)).toBe(false);

      // January (should be restricted during day)
      const janDay = new Date('2024-01-15T12:00:00');
      expect(isChargingAllowed(janDay, restrictions)).toBe(false);
    });

    test('should handle boundary times correctly', () => {
      // Just before restriction starts (7:00)
      const justBefore = new Date('2024-01-15T06:59:00');
      expect(isChargingAllowed(justBefore, restrictions)).toBe(true);

      // Right at restriction start
      const atStart = new Date('2024-01-15T07:00:00');
      expect(isChargingAllowed(atStart, restrictions)).toBe(false);

      // Just before restriction ends (20:00)
      const beforeEnd = new Date('2024-01-15T19:59:00');
      expect(isChargingAllowed(beforeEnd, restrictions)).toBe(false);

      // Right at restriction end
      const atEnd = new Date('2024-01-15T20:00:00');
      expect(isChargingAllowed(atEnd, restrictions)).toBe(true);
    });

    test('should handle boundary dates correctly', () => {
      // Last day of October (should allow)
      const octLast = new Date('2024-10-31T12:00:00');
      expect(isChargingAllowed(octLast, restrictions)).toBe(true);

      // First day of November (should restrict during day)
      const novFirst = new Date('2024-11-01T12:00:00');
      expect(isChargingAllowed(novFirst, restrictions)).toBe(false);

      // March 29 (should restrict during day)
      const marLast = new Date('2024-03-29T12:00:00');
      expect(isChargingAllowed(marLast, restrictions)).toBe(false);

      // First day of April (should allow)
      const aprFirst = new Date('2024-04-01T12:00:00');
      expect(isChargingAllowed(aprFirst, restrictions)).toBe(true);
    });

    test('should handle edge case dates', () => {
      // February 29th (leap year)
      const leapDay = new Date('2024-02-29T12:00:00');
      expect(isChargingAllowed(leapDay, restrictions)).toBe(false);

      // Invalid date handling
      const invalidDate = new Date('invalid');
      expect(isChargingAllowed(invalidDate, restrictions)).toBe(true);
    });

    test('should handle weekend transitions correctly', () => {
    const restrictions = {
      startDate: "11-01",    // November 1st
      endDate: "03-31",      // March 31st
      startTime: "07:00",    // 7 AM
      endTime: "20:00"       // 8 PM
    };

    // Friday 19:00 (restricted) -> Saturday 01:00 (allowed)
    const fridayEvening = new Date('2024-01-19T19:00:00');  // Friday
    expect(fridayEvening.getDay()).toBe(5);  // Verify it's Friday
    expect(isChargingAllowed(fridayEvening, restrictions)).toBe(false);
    
    const saturdayMorning = new Date('2024-01-20T01:00:00');  // Saturday
    expect(saturdayMorning.getDay()).toBe(6);  // Verify it's Saturday
    expect(isChargingAllowed(saturdayMorning, restrictions)).toBe(true);

    // Sunday 23:00 (allowed) -> Monday 03:00 (allowed due to time)
    const sundayNight = new Date('2024-01-21T23:00:00');  // Sunday
    expect(sundayNight.getDay()).toBe(0);  // Verify it's Sunday
    expect(isChargingAllowed(sundayNight, restrictions)).toBe(true);
    
    const mondayMorning = new Date('2024-01-22T03:00:00');  // Monday
    expect(mondayMorning.getDay()).toBe(1);  // Verify it's Monday
    expect(isChargingAllowed(mondayMorning, restrictions)).toBe(true);

    // Sunday 23:00 (allowed) -> Monday 12:00 (restricted)
    const mondayNoon = new Date('2024-01-22T12:00:00');  // Monday
    expect(mondayNoon.getDay()).toBe(1);  // Verify it's Monday
    expect(isChargingAllowed(mondayNoon, restrictions)).toBe(false);
  });

  test('should handle weekend transitions with weekend allowance', () => {
    const restrictions = {
      startDate: "11-01",    // November 1st
      endDate: "03-31",      // March 31st
      startTime: "07:00",    // 7 AM
      endTime: "20:00",      // 8 PM
      allowWeekends: true
    };

    // Friday 19:00 (restricted) -> Saturday 01:00 (allowed because weekend)
    const fridayEvening = new Date('2024-01-19T19:00:00');  // Friday
    expect(fridayEvening.getDay()).toBe(5);  // Verify it's Friday
    expect(isChargingAllowed(fridayEvening, restrictions)).toBe(false);
    
    const saturdayMorning = new Date('2024-01-20T01:00:00');  // Saturday
    expect(saturdayMorning.getDay()).toBe(6);  // Verify it's Saturday
    expect(isChargingAllowed(saturdayMorning, restrictions)).toBe(true);
  });

  test('should handle weekend transitions without weekend allowance', () => {
    const restrictions = {
      startDate: "11-01",    // November 1st
      endDate: "03-31",      // March 31st
      startTime: "07:00",    // 7 AM
      endTime: "20:00",      // 8 PM
      allowWeekends: false
    };

    // Friday 19:00 (restricted) -> Saturday 12:00 (restricted because weekends not allowed)
    const fridayEvening = new Date('2024-01-19T19:00:00');  // Friday
    expect(fridayEvening.getDay()).toBe(5);  // Verify it's Friday
    expect(isChargingAllowed(fridayEvening, restrictions)).toBe(false);
    
    const saturdayNoon = new Date('2024-01-20T12:00:00');  // Saturday
    expect(saturdayNoon.getDay()).toBe(6);  // Verify it's Saturday
    expect(isChargingAllowed(saturdayNoon, restrictions)).toBe(false);

    // Saturday night (outside restricted hours)
    const saturdayNight = new Date('2024-01-20T22:00:00');  // Saturday
    expect(saturdayNight.getDay()).toBe(6);  // Verify it's Saturday
    expect(isChargingAllowed(saturdayNight, restrictions)).toBe(true);
  });

    test('should handle March 31st boundary correctly', () => {
      const restrictions = {
        startDate: "11-01",    // November 1st
        endDate: "03-31",      // March 31st
        startTime: "07:00",    // 7 AM
        endTime: "20:00",      // 8 PM
        allowWeekends: false   // Test with weekends disabled to ensure date logic
      };

      // March 31st - should still be restricted
      const march31Morning = new Date('2024-03-31T06:59:00');  // Just before restriction starts
      expect(isChargingAllowed(march31Morning, restrictions)).toBe(true);

      const march31Noon = new Date('2024-03-31T12:00:00');    // Middle of restricted period
      expect(isChargingAllowed(march31Noon, restrictions)).toBe(false);

      const march31Evening = new Date('2024-03-31T20:00:00'); // Right when restriction ends
      expect(isChargingAllowed(march31Evening, restrictions)).toBe(true);

      const march31Night = new Date('2024-03-31T23:59:59');   // Last second of March
      expect(isChargingAllowed(march31Night, restrictions)).toBe(true);

      // April 1st - should be completely unrestricted
      const april1Midnight = new Date('2024-04-01T00:00:00'); // First moment of April
      expect(isChargingAllowed(april1Midnight, restrictions)).toBe(true);

      const april1Morning = new Date('2024-04-01T07:00:00');  // Would be restriction start
      expect(isChargingAllowed(april1Morning, restrictions)).toBe(true);

      const april1Noon = new Date('2024-04-01T12:00:00');     // Middle of day
      expect(isChargingAllowed(april1Noon, restrictions)).toBe(true);
    });

    test('should handle March 31st with weekend allowance correctly', () => {
      const restrictions = {
        startDate: "11-01",    // November 1st
        endDate: "03-31",      // March 31st
        startTime: "07:00",    // 7 AM
        endTime: "20:00",      // 8 PM
        allowWeekends: true    // Test with weekends enabled (default behavior)
      };

      // March 31, 2024 is a Sunday
      const march31Morning = new Date('2024-03-31T06:59:00');
      expect(march31Morning.getDay()).toBe(0); // Verify it's Sunday
      expect(isChargingAllowed(march31Morning, restrictions)).toBe(true);

      const march31Noon = new Date('2024-03-31T12:00:00');
      expect(isChargingAllowed(march31Noon, restrictions)).toBe(true);

      // April 1, 2024 is a Monday
      const april1Morning = new Date('2024-04-01T07:00:00');
      expect(april1Morning.getDay()).toBe(1); // Verify it's Monday
      expect(isChargingAllowed(april1Morning, restrictions)).toBe(true);
    });

    test('should handle March 31st weekday boundary correctly (2025)', () => {
      const restrictions = {
        startDate: "11-01",    // November 1st
        endDate: "03-31",      // March 31st
        startTime: "07:00",    // 7 AM
        endTime: "20:00",      // 8 PM
        allowWeekends: true    // Default behavior
      };

      // March 31, 2025 is a Monday
      const march31Morning = new Date('2025-03-31T06:59:00');
      expect(march31Morning.getDay()).toBe(1); // Verify it's Monday
      expect(isChargingAllowed(march31Morning, restrictions)).toBe(true);

      const march31Noon = new Date('2025-03-31T12:00:00');
      expect(march31Noon.getDay()).toBe(1);
      expect(isChargingAllowed(march31Noon, restrictions)).toBe(false);

      const march31Evening = new Date('2025-03-31T20:00:00');
      expect(march31Evening.getDay()).toBe(1);
      expect(isChargingAllowed(march31Evening, restrictions)).toBe(true);

      // April 1, 2025 is a Tuesday
      const april1Morning = new Date('2025-04-01T07:00:00');
      expect(april1Morning.getDay()).toBe(2); // Verify it's Tuesday
      expect(isChargingAllowed(april1Morning, restrictions)).toBe(true);

      const april1Noon = new Date('2025-04-01T12:00:00');
      expect(isChargingAllowed(april1Noon, restrictions)).toBe(true);
    });

  test('should handle edge case restrictions', () => {
      // Same start and end time
      const sameTimeRestrictions = {
        ...restrictions,
        startTime: "12:00",
        endTime: "12:00"
      };
      const noonDate = new Date('2024-01-15T12:00:00');
      expect(isChargingAllowed(noonDate, sameTimeRestrictions)).toBe(true);

      // Same start and end date
      const sameDateRestrictions = {
        ...restrictions,
        startDate: "01-15",
        endDate: "01-15"
      };
      expect(isChargingAllowed(noonDate, sameDateRestrictions)).toBe(false);
    });
  });

  describe('isChargingAllowed with specific month boundaries', () => {
    test('should handle start month dates correctly', () => {
      const restrictions = {
        startDate: "11-15",    // November 15th
        endDate: "03-31",      // March 31st
        startTime: "07:00",
        endTime: "20:00"
      };

      // Before start day in start month (November 14th)
      const beforeStart = new Date('2024-11-14T12:00:00');
      expect(isChargingAllowed(beforeStart, restrictions)).toBe(true);

      // On start day in start month (November 15th)
      const onStart = new Date('2024-11-15T12:00:00');
      expect(isChargingAllowed(onStart, restrictions)).toBe(false);

      // After start day in start month (November 18th)
      const afterStart = new Date('2024-11-18T12:00:00');
      expect(isChargingAllowed(afterStart, restrictions)).toBe(false);
    });

    test('should handle end month dates correctly', () => {
      const restrictions = {
        startDate: "11-01",    // November 1st
        endDate: "03-15",      // March 15th
        startTime: "07:00",
        endTime: "20:00"
      };

      // Before end day in end month (March 14th)
      const beforeEnd = new Date('2024-03-14T12:00:00');
      expect(isChargingAllowed(beforeEnd, restrictions)).toBe(false);

      // On end day in end month (March 15th)
      const onEnd = new Date('2024-03-15T12:00:00');
      expect(isChargingAllowed(onEnd, restrictions)).toBe(false);

      // After end day in end month (March 16th)
      const afterEnd = new Date('2024-03-16T12:00:00');
      expect(isChargingAllowed(afterEnd, restrictions)).toBe(true);
    });

    test('should handle months outside restriction period', () => {
      const restrictions = {
        startDate: "11-15",    // November 15th
        endDate: "03-15",      // March 15th
        startTime: "07:00",
        endTime: "20:00"
      };

      // October (completely outside restriction period)
      const october = new Date('2024-10-01T12:00:00');
      expect(isChargingAllowed(october, restrictions)).toBe(true);

      // April (completely outside restriction period)
      const april = new Date('2024-04-01T12:00:00');
      expect(isChargingAllowed(april, restrictions)).toBe(true);
    });
  });

  test('should handle normal (non-cross-year) date ranges correctly', () => {
    const restrictions = {
      startDate: "05-15",    // May 15th
      endDate: "08-15",      // August 15th
      startTime: "07:00",
      endTime: "20:00"
    };
  
    // Test: month < start.month
    const beforeRange = new Date('2024-04-15T12:00:00');
    expect(isChargingAllowed(beforeRange, restrictions)).toBe(true);
  
    // Test: month > end.month
    const afterRange = new Date('2024-09-15T12:00:00');
    expect(isChargingAllowed(afterRange, restrictions)).toBe(true);
  
    // Test: month === start.month && day < start.day
    const earlyMay = new Date('2024-05-14T12:00:00');
    expect(isChargingAllowed(earlyMay, restrictions)).toBe(true);
  
    // Test: month === end.month && day > end.day
    const lateMay = new Date('2024-08-16T12:00:00');
    expect(isChargingAllowed(lateMay, restrictions)).toBe(true);
  
    // Test: within range for comparison
    const withinRange = new Date('2024-06-17T12:00:00');
    expect(isChargingAllowed(withinRange, restrictions)).toBe(false);
  
    // Test: exactly on start day
    const onStart = new Date('2024-05-15T12:00:00');
    expect(isChargingAllowed(onStart, restrictions)).toBe(false);
  
    // Test: exactly on end day
    const onEnd = new Date('2024-08-15T12:00:00');
    expect(isChargingAllowed(onEnd, restrictions)).toBe(false);
  });
});