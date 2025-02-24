const { generateRandomActivity, random, isChargingAllowed } = require('./utils');

const mutationFunction = (props) => (phenotype) => {
  const { 
      totalDuration, 
      mutationRate, 
      input = [], 
      chargingRestrictions,
      evChargingEnabled 
  } = props;

  const timeAdjustment = (low, mid, high) => {
      return random(0.1 * (low - mid), 0.1 * (high - mid));
  };

  return {
      periods: phenotype.periods.map((gene, node) => {
          const g = { ...gene };
          if (Math.random() < mutationRate) {
              const baseDate = input[0]?.start ? new Date(input[0].start) : new Date();
              const periodStart = new Date(baseDate);
              periodStart.setMinutes(periodStart.getMinutes() + gene.start);
              
              // Consider EV charging when generating new activity
              const newActivity = generateRandomActivity(gene.activity, evChargingEnabled);
              
              // Check if charging is allowed for both battery and EV charging
              if ((newActivity === 1 || newActivity === 2) && 
                  !isChargingAllowed(periodStart, chargingRestrictions)) {
                  // If charging isn't allowed, set to discharge or idle
                  g.activity = Math.random() < 0.5 ? -1 : 0;
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
