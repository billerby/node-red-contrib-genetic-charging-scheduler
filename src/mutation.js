const { generateRandomActivity, random, isChargingAllowed } = require('./utils');

const mutationFunction = (props) => (phenotype) => {
  const { totalDuration, mutationRate, input = [], chargingRestrictions } = props;

  const timeAdjustment = (low, mid, high) => {
    return random(0.1 * (low - mid), 0.1 * (high - mid));
  };

  return {
    periods: phenotype.periods.map((gene, node) => {
      const g = { ...gene };
      if (Math.random() < mutationRate) {
        // Get the date for this period, fallback to current date if input not provided
        const baseDate = input[0]?.start ? new Date(input[0].start) : new Date();
        const periodStart = new Date(baseDate);
        periodStart.setMinutes(periodStart.getMinutes() + gene.start);
        
        // When mutating to charging (1), check if it's allowed at this time
        const newActivity = generateRandomActivity(gene.activity);
        if (newActivity === 1 && !isChargingAllowed(periodStart, chargingRestrictions)) {
          // If charging isn't allowed, either keep current activity or set to discharge/idle
          g.activity = Math.random() < 0.5 ? gene.activity : (Math.random() < 0.5 ? -1 : 0);
        } else {
          g.activity = newActivity;
        }
      }

      if (gene.start > 0 && Math.random() < mutationRate) {
        g.start += timeAdjustment(
          node.previous.data.start + 1,
          gene.start,
          node.next ? node.next.data.start : totalDuration
        );
      }
      return g;
    }),
    excessPvEnergyUse: phenotype.excessPvEnergyUse,
  };
};

module.exports = {
  mutationFunction,
};
