import express from "express";
import passport from "passport";
import { INVITE_ALLOW_ROLES } from "../config/invites.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  createInvite,
  listInvites,
  getInvite,
  updateInvite,
  resendInvite,
  trackInvite,
  acceptInvite,
} from "../controllers/invitesController.js";

const router = express.Router();

router.get("/track/:code", trackInvite);
router.post("/accept", acceptInvite);

router.use(passport.authenticate("jwt", { session: false }));
router.use(requireRole(INVITE_ALLOW_ROLES));

router.post("/", createInvite);
router.get("/", listInvites);
router.get("/:id", getInvite);
router.patch("/:id", updateInvite);
router.post("/:id/resend", resendInvite);

export default router;
