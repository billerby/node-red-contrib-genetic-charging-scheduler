const random = (min, max) => {
  return Math.floor(Math.random() * (max - min) + min);
};

const generateRandomActivity = (excludedValue, evEnabled = false) => {
  // When EV charging is enabled, include 2 as a possible activity
  const possibleActivities = evEnabled ? [-1, 0, 1, 2] : [-1, 0, 1];
  const randomArray = possibleActivities.filter((val) => val !== excludedValue);
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