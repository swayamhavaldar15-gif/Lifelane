
const Emergency = require("../models/Emergency");

const priorityRank = {
  Critical: 1,
  High: 2,
  Normal: 3,
};

const sortByPriority = (a, b) => {
  const priorityDifference =
    (priorityRank[a.priority] || 4) -
    (priorityRank[b.priority] || 4);

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
};

// Keep exactly one Active request and order all remaining requests.
const rebalanceQueue = async () => {
  const pending = await Emergency.find({
    status: { $in: ["Active", "Queued"] },
  });

  pending.sort(sortByPriority);

  for (let index = 0; index < pending.length; index++) {
    const desiredStatus = index === 0 ? "Active" : "Queued";

    if (pending[index].status !== desiredStatus) {
      pending[index].status = desiredStatus;
      await pending[index].save();
    }
  }

  return pending;
};

const createEmergency = async (req, res) => {
  try {
    const {
      emergencyType,
      priority,
      startLocation,
      destination,
    } = req.body;

    if (
      !emergencyType ||
      !["Ambulance", "Fire Brigade"].includes(emergencyType) ||
      !["Critical", "High", "Normal"].includes(priority) ||
      !startLocation?.name ||
      typeof startLocation.latitude !== "number" ||
      typeof startLocation.longitude !== "number" ||
      !destination?.name ||
      typeof destination.latitude !== "number" ||
      typeof destination.longitude !== "number"
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid emergency details and coordinates.",
      });
    }

    const emergency = await Emergency.create({
      emergencyId: "LL-" + Date.now(),
      emergencyType,
      priority,
      startLocation,
      destination,
      status: "Queued",
      corridorActive: false,
      route: {
        distance: 8.4,
        eta: 14,
        predictedDelay: 2.8,
        trafficLevel: "Moderate",
      },
      junctions: [
        { name: "Kharadi Junction", eta: 2, status: "Pending" },
        { name: "Viman Nagar Junction", eta: 5, status: "Pending" },
        { name: "Airport Road Junction", eta: 9, status: "Pending" },
      ],
    });

    const queue = await rebalanceQueue();

    const updatedEmergency = await Emergency.findById(emergency._id);

    res.status(201).json({
      success: true,
      message:
        updatedEmergency.status === "Active"
          ? "Emergency dispatched successfully."
          : "Emergency added to priority queue.",
      emergency: updatedEmergency,
      queue: queue.map((item) => ({
        emergencyId: item.emergencyId,
        priority: item.priority,
        status: item.status,
      })),
    });
  } catch (error) {
    console.error("Create emergency error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getEmergencies = async (req, res) => {
  try {
    const emergencies = await Emergency.find().sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      emergencies,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Complete the current request and automatically dispatch the next one.
const completeEmergency = async (req, res) => {
  try {
    const emergency = await Emergency.findOne({
      emergencyId: req.params.emergencyId,
    });

    if (!emergency) {
      return res.status(404).json({
        success: false,
        message: "Emergency not found.",
      });
    }

    if (emergency.status === "Completed") {
      const queue = await rebalanceQueue();

      return res.json({
        success: true,
        message: "Emergency was already completed.",
        completedEmergency: emergency,
        nextEmergency: queue[0] || null,
      });
    }

    if (emergency.status !== "Active") {
      return res.status(409).json({
        success: false,
        message: "Only the active emergency can be completed.",
      });
    }

    emergency.status = "Completed";
    emergency.corridorActive = false;
    await emergency.save();

    const queue = await rebalanceQueue();

    const nextEmergency = queue.find(
      (item) => item.status === "Active"
    ) || null;

    res.json({
      success: true,
      message: nextEmergency
        ? "Emergency completed. Next request dispatched automatically."
        : "Emergency completed. No requests are waiting.",
      completedEmergency: emergency,
      nextEmergency,
    });
  } catch (error) {
    console.error("Complete emergency error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createEmergency,
  getEmergencies,
  completeEmergency,
};
