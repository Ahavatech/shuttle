import express from "express";
import { verifyUserToken } from "../util/auth.helper.js";
import {
  deleteUserById,
  deleteUserByEmail,
  getUserByEmail,
  getUserById,
  loginUser,
  signupUser,
  getUserTotalSpendByUserId,
  getUserBookingsByUserId,
  updateUserById,
  getCities,
  getVisaOnArrivalRates,
  getVisaOnArrivalRatesWithNigerianVisa,
  sendEnquiryEmail,
  createPayment,
  getBookingById,
  getCarRentalCities,
  getPriorityPassCities,
  getUserNotifications,
  resetUserPassword,
  registerPushToken,
  unregisterPushToken,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../controller/user.controller.js";

const userRouter = express.Router();

// Routes
// SIGNUP USER
userRouter.post("/signup", signupUser);
// LOGIN USER
userRouter.post("/login", loginUser);
// GET USER BY EMAIL
userRouter.get("/get-user-by-email", verifyUserToken, getUserByEmail);
// GET USER BY ID
userRouter.get("/get-user/:userId", verifyUserToken, getUserById);
// GET USER BOOKINGS BY USER ID
userRouter.get("/bookings/:userId", getUserBookingsByUserId);
// GET BOOKING BY ID
userRouter.get("/booking/:bookingId", getBookingById);
// GET USER SPEND BY USER ID
userRouter.get(
  "/total-spend/:userId",
  verifyUserToken,
  getUserTotalSpendByUserId
);
// UPDATE USER BY USER ID
userRouter.patch("/update-user/:userId", verifyUserToken, updateUserById);
// REGISTER A USER PUSH TOKEN
userRouter.post(
  "/push/register/:userId",
  verifyUserToken,
  registerPushToken
);
// UNREGISTER A USER PUSH TOKEN
userRouter.post(
  "/push/unregister/:userId",
  verifyUserToken,
  unregisterPushToken
);
// GET USER NOTIFICATIONS
userRouter.get(
  "/notifications/:userId",
  verifyUserToken,
  getUserNotifications
);
// MARK NOTIFICATION AS READ
userRouter.patch(
  "/notifications/:notificationId/read",
  verifyUserToken,
  markNotificationAsRead
);
// MARK ALL NOTIFICATIONS AS READ
userRouter.patch(
  "/notifications/read-all/:userId",
  verifyUserToken,
  markAllNotificationsAsRead
);
// DELETE USER BY EMAIL
userRouter.delete("/delete-user-by-email", verifyUserToken, deleteUserByEmail);
// DELETE USER BY ID
userRouter.delete("/delete-user/:userId", verifyUserToken, deleteUserById);
// RESET USER PASSWORD
userRouter.patch("/reset-password/:userId", verifyUserToken, resetUserPassword);

// CITIES
// Get Cities
userRouter.get("/cities", getCities);
// Get Car Rental Cities
userRouter.get("/cities/car", getCarRentalCities);
// Get Priority Cities
userRouter.get("/cities/priority", getPriorityPassCities);

// VISA ON ARRIVAL RATES
// Get Visa On Arrival Rates
userRouter.get("/voaRates", getVisaOnArrivalRates);
// Get Visa On Arrival Rates With Nigerian Visa Requirement
userRouter.get(
  "/voaRatesWithNigerianVisa",
  getVisaOnArrivalRatesWithNigerianVisa
);

// ENQUIRIES
// Send Enquiry Email
userRouter.post("/enquiries/sendMessage", sendEnquiryEmail);

// PAYMENTS
// Create payment
userRouter.post("/payments", createPayment);

export default userRouter;
