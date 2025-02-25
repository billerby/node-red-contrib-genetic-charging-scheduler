const random = (min, max) => {
  return Math.floor(Math.random() * (max - min) + min);
};

/**
 * Generates a random activity value (-1, 0, 1) different from the excluded value.
 * Now with support for charging restrictions.
 * 
 * @param {number} excludedValue - The activity value to exclude
 * @param {Date|null} currentDate - The date to check for charging restrictions
 * @param {Object|null} chargingRestrictions - The charging restrictions configuration
 * @returns {number} A randomly selected activity value
 */
const generateRandomActivity = (excludedValue, currentDate = null, chargingRestrictions = null) => {
  // If we have a date and restrictions, and charging is not allowed at this time
  if (currentDate && chargingRestrictions && !isChargingAllowed(currentDate, chargingRestrictions)) {
    // Filter out both the excluded value and charging (1)
    const allowedValues = [-1, 0].filter(val => val !== excludedValue);
    // If there's only one valid activity left, return it
    if (allowedValues.length === 1) {
      return allowedValues[0];
    }
    // Otherwise randomly select from the allowed values
    const randomIndex = Math.floor(Math.random() * allowedValues.length);
    return allowedValues[randomIndex];
  }

  // Standard behavior when no restrictions apply
  const randomArray = [-1, 0, 1].filter((val) => val !== excludedValue);
  const randomIndex = Math.floor(Math.random() * randomArray.length);
  return randomArray[randomIndex];
};

const parseTime = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
};

const parseDate = (dateStr) => {
  const [month, day] = dateStr.split('-').map(Number);
  return { month, day };
};

const isWithinTimeRange = (date, startTime, endTime) => {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const hours = date.getHours();
  const minutes = date.getMinutes();

  const totalMinutes = hours * 60 + minutes;
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;

  return totalMinutes >= startMinutes && totalMinutes < endMinutes;
};

const isWithinDateRange = (date, startDate, endDate) => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const month = date.getMonth() + 1;  // JavaScript months are 0-based
  const day = date.getDate();

  // Handle range that crosses year boundary (e.g., Nov-Mar)
  if (start.month > end.month) {
    if (month > end.month && month < start.month) {
      return false; // Outside the range completely
    }
    if (month === start.month) {
      return day >= start.day;
    }
    if (month === end.month) {
      return day <= end.day;
    }
    return (month > start.month) || (month < end.month);
  }
  
  // Normal date range within same year
  if (month < start.month || month > end.month) {
    return false;
  }
  if (month === start.month && day < start.day) {
    return false;
  }
  if (month === end.month && day > end.day) {
    return false;
  }
  return true;
};

const isChargingAllowed = (date, restrictions = null) => {
  // If no restrictions are configured, charging is always allowed
  if (!restrictions) {
    return true;
  }

  const { startDate, endDate, startTime, endTime, allowWeekends = true } = restrictions;

  // Allow charging on weekends if configured (0 = Sunday, 6 = Saturday)
  const dayOfWeek = date.getDay();
  if (allowWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
    return true;
  }

  // Check if we're in the restricted date range
  if (isWithinDateRange(date, startDate, endDate)) {
    // Check if we're in the restricted time range
    if (isWithinTimeRange(date, startTime, endTime)) {
      return false;  // Within both date and time restrictions
    }
  }

  return true;  // Outside restriction period
};

module.exports = { 
  generateRandomActivity, 
  random,
  isChargingAllowed 
};