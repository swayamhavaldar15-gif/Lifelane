
const Emergency = require("../models/Emergency");

const priorityRank = {
  Critical: 1,
  High: 2,
  Normal: 3
};

const sortQueue = (a, b) => {
  const priorityDifference =
    (priorityRank[a.priority] || 4) -
    (priorityRank[b.priority] || 4);

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  return new Date(a.createdAt) - new Date(b.createdAt);
};

const createEmergency = async (req, res) => {
  try {
    const {
      emergencyType,
      priority,
      startLocation,
      destination
    } = req.body;

    if (
      !emergencyType ||
      !startLocation?.name ||
      typeof startLocation?.latitude !== "number" ||
      typeof startLocation?.longitude !== "number" ||
      !destination?.name ||
      typeof destination?.latitude !== "number" ||
      typeof destination?.longitude !== "number"
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid emergency details and coordinates."
      });
    }

    const selectedPriority = priority || "Normal";

    const activeEmergency = await Emergency.findOne({
      status: "Active"
    });

    let newStatus = "Queued";

    // A new critical request takes priority over an active
    // lower-priority request in this academic prototype.
    if (
      !activeEmergency ||
      (selectedPriority === "Critical" &&
        (priorityRank[selectedPriority] <
          (priorityRank[activeEmergency.priority] || 4)))
    ) {
      if (activeEmergency) {
        activeEmergency.status = "Queued";
        await activeEmergency.save();
      }

      newStatus = "Active";
    }

    const emergency = await Emergency.create({
      emergencyId: "LL-" + Date.now(),
      emergencyType,
      priority: selectedPriority,
      startLocation,
      destination,
      status: newStatus,
      route: {
        distance: 8.4,
        eta: 14,
        predictedDelay: 2.8,
        trafficLevel: "Moderate"
      },
      junctions: [
        { name: "Kharadi Junction", eta: 2, status: "Pending" },
        { name: "Viman Nagar Junction", eta: 5, status: "Pending" },
        { name: "Airport Road Junction", eta: 9, status: "Pending" }
      ]
    });

    res.status(201).json({
      success: true,
      message:
        newStatus === "Active"
          ? "Emergency activated successfully."
          : "Emergency added to priority queue successfully.",
      emergency
    });
  } catch (error) {
    console.error("Create emergency error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getEmergencies = async (req, res) => {
  try {
    const emergencies = await Emergency.find().sort({
      createdAt: -1
    });

    res.json({
      success: true,
      emergencies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Complete the active emergency and promote the next request.
const completeEmergency = async (req, res) => {
  try {
    const emergency = await Emergency.findOne({
      emergencyId: req.params.emergencyId,
      status: "Active"
    });

    if (!emergency) {
      return res.status(404).json({
        success: false,
        message: "Active emergency not found."
      });
    }

    emergency.status = "Completed";
    emergency.corridorActive = false;
    await emergency.save();

    const nextEmergency = await Emergency.find({
      status: "Queued"
    });

    nextEmergency.sort(sortQueue);

    let promotedEmergency = null;

    if (nextEmergency.length > 0) {
      promotedEmergency = nextEmergency[0];
      promotedEmergency.status = "Active";
      await promotedEmergency.save();
    }

    res.json({
      success: true,
      message: promotedEmergency
        ? "Emergency completed. Next priority request activated."
        : "Emergency completed. No requests are waiting.",
      completedEmergency: emergency,
      promotedEmergency
    });
  } catch (error) {
    console.error("Complete emergency error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createEmergency,
  getEmergencies,
  completeEmergency
};
