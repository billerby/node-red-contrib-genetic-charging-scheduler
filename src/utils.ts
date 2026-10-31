import moment from 'moment';
import { Activity } from './population';

export const random = (min: number, max: number) => Math.floor(Math.random() * (max - min) + min);

export const generateRandomActivity = (excludedValue?: Activity) => {
  const randomArray: Activity[] = [-1, 0, 1].filter(
    (val): val is Activity => val !== excludedValue
  );
  const randomIndex = Math.floor(Math.random() * randomArray.length);
  return randomArray[randomIndex];
};

export type ChargingRestriction = {
  startDate: string; // MM-DD, inclusive
  endDate: string; // MM-DD, inclusive, may wrap past new year
  startTime: string; // HH:mm, inclusive
  endTime: string; // HH:mm, exclusive
  allowWeekends: boolean;
};

const toMonthDay = (date: string) => {
  const [month, day] = date.split('-').map(Number);
  return month * 100 + day;
};

const toMinuteOfDay = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * True when grid charging is not allowed at the given local time.
 */
export const isChargingRestricted = (time: moment.Moment, restriction: ChargingRestriction) => {
  const weekday = time.day();
  if (restriction.allowWeekends && (weekday === 0 || weekday === 6)) {
    return false;
  }

  const monthDay = (time.month() + 1) * 100 + time.date();
  const start = toMonthDay(restriction.startDate);
  const end = toMonthDay(restriction.endDate);
  const inSeason =
    start <= end ? monthDay >= start && monthDay <= end : monthDay >= start || monthDay <= end;
  if (!inSeason) {
    return false;
  }

  const minute = time.hours() * 60 + time.minutes();
  return (
    minute >= toMinuteOfDay(restriction.startTime) && minute < toMinuteOfDay(restriction.endTime)
  );
};

/**
 * One entry per minute of the schedule, true where grid charging is not allowed.
 */
export const chargingBlockedMask = (
  start: number,
  totalDuration: number,
  restriction?: ChargingRestriction
) => {
  if (!restriction) {
    return undefined;
  }
  const startTime = moment.unix(start);
  return Array.from({ length: totalDuration }, (_, minute) =>
    isChargingRestricted(startTime.clone().add(minute, 'm'), restriction)
  );
};
