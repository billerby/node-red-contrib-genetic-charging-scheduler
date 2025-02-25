const { generateRandomActivity, random, isChargingAllowed } = require('./utils');

/**
 * Mutation function for the genetic algorithm
 * Now with improved handling of charging restrictions
 */
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
        
        // Use the enhanced generateRandomActivity that is aware of charging restrictions
        g.activity = generateRandomActivity(gene.activity, periodStart, chargingRestrictions);
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