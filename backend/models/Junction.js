
const mongoose = require("mongoose");

const junctionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  latitude: Number,
  longitude: Number,

  trafficLevel: {
    type: String,
    default: "Moderate"
  },

  queueLength: {
    type: Number,
    default: 10
  }
});

module.exports = mongoose.model(
  "Junction",
  junctionSchema
);
