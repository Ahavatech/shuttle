import express from "express";
import { verifyUserToken } from "../util/auth.helper.js";
import {
  acceptBooking,
  declineBooking,
  deleteDriverById,
  endBooking,
  fetchPayoutsByWeek,
  getDriverAssignedJobs,
  getDriverBookingsByDriverId,
  getDriverById,
  getDriverNotifications,
  getDriverCompletedJobs,
  getDriverEarnings,
  getDriverOngoingJobs,
  getDriverUpcomingJobs,
  loginDriver,
  markAllDriverNotificationsAsRead,
  markDriverNotificationAsRead,
  registerDriverPushToken,
  resetDriverPassword,
  signupDriver,
  startBooking,
  unregisterDriverPushToken,
  updateDriverById,
} from "../controller/driver.controller.js";

const driverRouter = express.Router();

// Routes
// SIGNUP DRIVER
driverRouter.post("/signup", signupDriver);
// LOGIN DRIVER
driverRouter.post("/login", loginDriver);
// GET DRIVER BY ID
driverRouter.get("/get-driver/:driverId", verifyUserToken, getDriverById);
// GET DRIVER BOOKINGS BY DRIVER ID
driverRouter.patch(
  "/bookings/:driverId",
  verifyUserToken,
  getDriverBookingsByDriverId
);
// UPDATE DRIVER BY DRIVER ID
driverRouter.patch(
  "/update-driver/:driverId",
  verifyUserToken,
  updateDriverById
);
// REGISTER DRIVER PUSH TOKEN
driverRouter.post(
  "/push/register/:driverId",
  verifyUserToken,
  registerDriverPushToken
);
// UNREGISTER DRIVER PUSH TOKEN
driverRouter.post(
  "/push/unregister/:driverId",
  verifyUserToken,
  unregisterDriverPushToken
);
// GET DRIVER NOTIFICATIONS
driverRouter.get(
  "/notifications/:driverId",
  verifyUserToken,
  getDriverNotifications
);
// MARK DRIVER NOTIFICATION AS READ
driverRouter.patch(
  "/notifications/:notificationId/read",
  verifyUserToken,
  markDriverNotificationAsRead
);
// MARK ALL DRIVER NOTIFICATIONS AS READ
driverRouter.patch(
  "/notifications/read-all/:driverId",
  verifyUserToken,
  markAllDriverNotificationsAsRead
);
// RESET DRIVER PASSWORD
driverRouter.patch(
  "/reset-password/:driverId",
  verifyUserToken,
  resetDriverPassword
);
// GET DRIVER'S COMPLETED JOBS
driverRouter.get(
  "/bookings/completed/:driverId",
  verifyUserToken,
  getDriverCompletedJobs
);
// GET DRIVER'S ASSIGNED JOBS
driverRouter.get(
  "/bookings/assigned/:driverId",
  verifyUserToken,
  getDriverAssignedJobs
);
// GET DRIVER'S UPCOMING JOBS
driverRouter.get(
  "/bookings/upcoming/:driverId",
  verifyUserToken,
  getDriverUpcomingJobs
);
// GET DRIVER'S ONGOING JOBS
driverRouter.get(
  "/bookings/ongoing/:driverId",
  verifyUserToken,
  getDriverOngoingJobs
);
// DELETE DRIVER BY ID
driverRouter.delete(
  "/delete-driver/:driverId",
  verifyUserToken,
  deleteDriverById
);

// BOOKINGS
// ACCEPT BOOKING
driverRouter.patch(
  "/booking/accept/:driverId/:bookingId",
  verifyUserToken,
  acceptBooking
);
// DECLINE BOOKING
driverRouter.patch(
  "/booking/decline/:driverId/:bookingId",
  verifyUserToken,
  declineBooking
);
// START BOOKING
driverRouter.patch(
  "/booking/start/:driverId/:bookingId",
  verifyUserToken,
  startBooking
);
// END BOOKING
driverRouter.patch(
  "/booking/end/:driverId/:bookingId",
  verifyUserToken,
  endBooking
);

// FETCH EARNINGS / PAYOUTS
driverRouter.get("/payouts/:driverId", verifyUserToken, fetchPayoutsByWeek);

export default driverRouter;
