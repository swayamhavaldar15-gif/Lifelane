
const express = require("express");
const router = express.Router();

const {
  createEmergency,
  getEmergencies,
  completeEmergency,
} = require("../controllers/emergencyController");

router.get("/", getEmergencies);
router.post("/", createEmergency);
router.patch("/:emergencyId/complete", completeEmergency);

module.exports = router;
