
const mongoose = require("mongoose");

const emergencySchema = new mongoose.Schema(
  {
    emergencyId: {
      type: String,
      unique: true,
      required: true
    },

    emergencyType: {
      type: String,
      enum: ["Ambulance", "Fire Brigade"],
      required: true
    },

    priority: {
      type: String,
      enum: ["Critical", "High", "Normal"],
      default: "High"
    },

    startLocation: {
      name: String,
      latitude: Number,
      longitude: Number
    },

    destination: {
      name: String,
      latitude: Number,
      longitude: Number
    },

    status: {
      type: String,
      default: "Active"
    },

    route: {
      distance: Number,
      eta: Number,
      predictedDelay: Number,
      trafficLevel: String
    },

    junctions: [
      {
        name: String,
        eta: Number,
        status: {
          type: String,
          default: "Pending"
        }
      }
    ],

    corridorActive: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "Emergency",
  emergencySchema
);
