import { describe, expect, test } from 'vitest';
import moment from 'moment';
import { chargingBlockedMask, isChargingRestricted, type ChargingRestriction } from '../src/utils';

const winterWeekdays: ChargingRestriction = {
  startDate: '11-01',
  endDate: '03-31',
  startTime: '07:00',
  endTime: '20:00',
  allowWeekends: true,
};

const at = (time: string) => moment(time, 'YYYY-MM-DD HH:mm');

describe('Utils - isChargingRestricted', () => {
  test.each([
    ['2026-11-02 07:00', true, 'Monday at restriction start'],
    ['2026-11-02 19:59', true, 'Monday just before restriction end'],
    ['2026-11-02 06:59', false, 'Monday just before restriction start'],
    ['2026-11-02 20:00', false, 'Monday at restriction end'],
    ['2026-11-01 12:00', false, 'Sunday, weekends allowed'],
    ['2026-11-07 12:00', false, 'Saturday, weekends allowed'],
    ['2026-10-30 12:00', false, 'Friday before the season'],
    ['2027-01-04 12:00', true, 'January, season wraps past new year'],
    ['2027-03-31 12:00', true, 'last day of the season'],
    ['2027-04-01 12:00', false, 'day after the season'],
  ])('%s is restricted: %s (%s)', (time, expected) => {
    expect(isChargingRestricted(at(time), winterWeekdays)).toBe(expected);
  });

  test('restricts weekends when they are not allowed', () => {
    expect(
      isChargingRestricted(at('2026-11-01 12:00'), { ...winterWeekdays, allowWeekends: false })
    ).toBe(true);
  });

  test('handles a season within one year', () => {
    const summer = { ...winterWeekdays, startDate: '06-01', endDate: '08-31' };
    expect(isChargingRestricted(at('2026-07-01 12:00'), summer)).toBe(true);
    expect(isChargingRestricted(at('2026-11-02 12:00'), summer)).toBe(false);
  });
});

describe('Utils - chargingBlockedMask', () => {
  test('is undefined without a restriction', () => {
    expect(chargingBlockedMask(at('2026-11-02 06:00').unix(), 120)).toBeUndefined();
  });

  test('marks each blocked minute', () => {
    const mask = chargingBlockedMask(at('2026-11-02 06:00').unix(), 120, winterWeekdays)!;
    expect(mask).toHaveLength(120);
    expect(mask.indexOf(true)).toBe(60);
    expect(mask.slice(0, 60).every((blocked) => !blocked)).toBe(true);
    expect(mask.slice(60).every((blocked) => blocked)).toBe(true);
  });
});
