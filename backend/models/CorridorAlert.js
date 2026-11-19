
const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    emergencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Emergency",
      required: true
    },

    junctionName: String,

    status: {
      type: String,
      enum: [
        "Pending",
        "Alert Sent",
        "Acknowledged",
        "Cleared",
        "Vehicle Passed"
      ],
      default: "Pending"
    },

    sentAt: Date,
    acknowledgedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "CorridorAlert",
  alertSchema
);
