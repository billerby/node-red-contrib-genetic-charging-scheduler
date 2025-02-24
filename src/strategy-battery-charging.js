const {
  calculateBatteryChargingStrategy,
} = require('./strategy-battery-charging-functions')

const node = (RED) => {
  RED.nodes.registerType(
    'enell-strategy-genetic-charging-seasonal',
    function callback(config) {
      RED.nodes.createNode(this, config)
      console.log('Node config received:', {
        restrictChargingEnabled: config.restrictChargingEnabled,
        allowWeekends: config.allowWeekends,
        evChargingEnabled: config.evChargingEnabled
      });
      const {
        populationSize,
        numberOfPricePeriods,
        generations,
        mutationRate,
        batteryMaxEnergy,
        batteryMaxInputPower,
        batteryMaxOutputPower = batteryMaxInputPower, // Default to input power if not specified
        averageConsumption,
        restrictChargingEnabled,
        restrictionStartDate,
        restrictionEndDate,
        restrictionStartTime,
        restrictionEndTime,
        allowWeekends,
        // Extract EV configuration params
        evChargingEnabled,
        evMaxChargingCurrent,
        evVoltage,
        evPhases
      } = config

      this.on('input', async (msg, send, done) => {
        const priceData = msg.payload?.priceData ?? []
        const consumptionForecast = msg.payload?.consumptionForecast ?? []
        const productionForecast = msg.payload?.productionForecast ?? []
        const soc = msg.payload?.soc
        
        // Get EV data from message payload or use defaults
        const ev_soc = msg.payload?.ev_soc ?? 50
        const ev_limit = msg.payload?.ev_limit ?? 80
        
        // Calculate EV max charging power based on current, voltage and phases
        const evMaxChargingPower = evChargingEnabled ? 
          (parseFloat(evMaxChargingCurrent) * parseFloat(evVoltage) * parseInt(evPhases, 10)) / 1000 : 0

        const strategy = calculateBatteryChargingStrategy({
          priceData,
          consumptionForecast,
          productionForecast,
          populationSize,
          numberOfPricePeriods,
          generations,
          mutationRate: mutationRate / 100,
          batteryMaxEnergy,
          batteryMaxOutputPower,
          batteryMaxInputPower,
          averageConsumption,
          consumptionForecast,
          productionForecast,
          excessPvEnergyUse: 0, // 0=Fed to grid, 1=Charge
          soc: soc / 100,
          // Add charging restrictions
          chargingRestrictions: restrictChargingEnabled ? {
            startDate: restrictionStartDate,    // "MM-DD" format
            endDate: restrictionEndDate,        // "MM-DD" format
            startTime: restrictionStartTime,    // "HH:mm" format
            endTime: restrictionEndTime,        // "HH:mm" format
            allowWeekends                       // boolean
          } : null,
          // Add EV charging configuration
          evChargingEnabled: Boolean(evChargingEnabled),
          evMaxChargingPower,
          ev_soc,
          ev_limit
        })

        const payload = msg.payload ?? {}

        if (strategy && Object.keys(strategy).length > 0) {
          msg.payload.schedule = strategy.best.schedule
          msg.payload.excessPvEnergyUse = strategy.best.excessPvEnergyUse
          msg.payload.cost = strategy.best.cost
          msg.payload.noBattery = {
            schedule: strategy.noBattery.schedule,
            excessPvEnergyUse: strategy.noBattery.excessPvEnergyUse,
            cost: strategy.noBattery.cost,
          }
        }
        msg.payload = payload

        send(msg)
        done()
      })
    }
  )
}

module.exports = node