
function predictTraffic(data) {
  const {
    vehicleDensity,
    averageSpeed,
    queueLength,
    timeFactor
  } = data;

  let delay =
    (vehicleDensity * 0.04) +
    (queueLength * 0.12) +
    ((60 - averageSpeed) * 0.04) +
    (timeFactor * 0.5);

  delay = Math.max(0, delay);

  let congestionLevel = "Low";

  if (delay >= 5) {
    congestionLevel = "Critical";
  } else if (delay >= 3) {
    congestionLevel = "Heavy";
  } else if (delay >= 1.5) {
    congestionLevel = "Moderate";
  }

  return {
    predictedDelay: Number(delay.toFixed(2)),
    congestionLevel
  };
}

module.exports = { predictTraffic };
