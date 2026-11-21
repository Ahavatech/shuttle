import DriverModel from "../model/driver.model.js";
import NotificationModel from "../model/notification.model.js";
import PayoutsModel from "../model/payout.model.js";
import VerificationModel from "../model/verification.model.js";
import DriverService from "../service/DriverService.js";
import PayoutService from "../service/PayoutService.js";
import VerificationService from "../service/VerificationService.js";
import {
  forgotPassword,
  resetForgottenPassword,
  resetPassword,
} from "../util/auth.helper.js";

// Generic messages
const internalServerError =
  "An error occured while we processed your request. Please try again.";

// SERVICE INSTANCES
// Create a new DriverService instance
const driverService = new DriverService(DriverModel);
const verificationService = new VerificationService(VerificationModel);
const payoutService = new PayoutService(PayoutsModel);

// Sign up driver
export const signupDriver = async (req, res) => {
  try {
    // Create new driver
    const response = await driverService.signupDriver({
      ...req.body,
    });

    // return a response
    if (response?.status !== 201) {
      return res.status(response?.status).json({ message: response?.message });
    }

    return res.status(response?.status).json({
      message: response?.message,
      token: response?.token,
      driver: response?.driver,
      status: response?.status,
    });
  } catch (error) {
    console.log("ERROR:", error);
    return res.status(500).json({ message: internalServerError, error });
  }
};

// Log in driver
export const loginDriver = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Log in driver
    const response = await driverService.loginDriver(email, password);

    // return a response
    if (response?.status !== 200) {
      return res.status(response?.status).json({ message: response?.message });
    }

    return res.status(response?.status).json({
      otp: response?.otp,
      message: response?.message,
      driver: response?.driver,
      status: response?.status,
    });
  } catch (error) {
    return res.status(500).json({ message: internalServerError });
  }
};

// Get driver by email
export const getDriverByEmail = async (req, res) => {
  const { email } = req.body;

  try {
    // Fetch driver
    const response = await driverService.getDriverByEmail(email);
    // Return a response
    return res.status(response?.status).json({ message: response?.message });
  } catch (error) {
    return res.status(500).json({ message: internalServerError });
  }
};

// Get driver by id
export const getDriverById = async (req, res) => {
  const { driverId } = req.params;

  try {
    // Fetch driver
    const response = await driverService.getDriverById(driverId);

    // Return a response
    return res.status(response?.status).json({ message: response?.message });
  } catch (error) {
    return res.status(500).json({ message: internalServerError });
  }
};

// Delete driver by id
export const deleteDriverById = async (req, res) => {
  const { driverId } = req.params;
  try {
    // DELETE driver
    const response = await driverService.deleteDriverById(driverId);

    // Return a response
    return res.status(response?.status).json({ message: response?.message });
  } catch (error) {
    return res.status(500).json({ message: internalServerError });
  }
};

// Update driver by id
export const updateDriverById = async (req, res) => {
  const { driverId } = req.params;

  console.log("HI FROM THE CONTROLLER MOD:", req.body);

  try {
    // UPDATE driver
    const response = await driverService.updateDriverById(driverId, {
      ...req.body,
    });

    // Return a response
    return res.status(response?.status).json({
      status: response?.status,
      message: response?.message,
      driver: response?.driver,
      token: response?.token,
    });
  } catch (error) {
    console.log("ERROR FROM UPDATE DRIVER:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

export const registerDriverPushToken = async (req, res) => {
  const { driverId } = req.params;
  const { token, platform, deviceId } = req.body;

  if (!driverId || !token) {
    return res.status(400).json({
      status: 400,
      message: "Driver id and push token are required.",
    });
  }

  try {
    await DriverModel.updateMany(
      {
        _id: { $ne: driverId },
        "pushTokens.token": token,
      },
      {
        $pull: {
          pushTokens: {
            token,
          },
        },
      }
    );

    const driver = await DriverModel.findOne({ _id: driverId });

    if (!driver) {
      return res.status(404).json({
        status: 404,
        message: "No driver exists with the id specified.",
      });
    }

    const existingTokens = Array.isArray(driver?.pushTokens)
      ? driver.pushTokens
      : [];
    const nextTokens = existingTokens.filter((entry) => entry?.token !== token);

    nextTokens.push({
      token,
      platform: platform || "unknown",
      deviceId,
      lastSeenAt: new Date(),
      isActive: true,
    });

    driver.pushTokens = nextTokens;
    await driver.save();

    return res.status(201).json({
      status: 201,
      message: "Driver push token registered successfully.",
      pushTokens: driver.pushTokens,
    });
  } catch (error) {
    console.log("ERROR FROM REGISTER DRIVER PUSH TOKEN:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

export const unregisterDriverPushToken = async (req, res) => {
  const { driverId } = req.params;
  const { token } = req.body;

  if (!driverId) {
    return res.status(400).json({
      status: 400,
      message: "Driver id is required.",
    });
  }

  try {
    const driver = await DriverModel.findOne({ _id: driverId });

    if (!driver) {
      return res.status(404).json({
        status: 404,
        message: "No driver exists with the id specified.",
      });
    }

    driver.pushTokens = token
      ? (driver.pushTokens || []).filter((entry) => entry?.token !== token)
      : [];
    await driver.save();

    return res.status(200).json({
      status: 200,
      message: "Driver push token removed successfully.",
      pushTokens: driver.pushTokens,
    });
  } catch (error) {
    console.log("ERROR FROM UNREGISTER DRIVER PUSH TOKEN:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

export const getDriverNotifications = async (req, res) => {
  const { driverId } = req.params;

  try {
    const notifications = await NotificationModel.find({
      recipientDriver: driverId,
      recipientType: "Driver",
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("booking");

    return res.status(200).json({
      status: 200,
      notifications,
      unreadCount: notifications.filter((item) => !item?.isRead).length,
      message: "Driver notifications fetched successfully.",
    });
  } catch (error) {
    console.log("ERROR FROM GET DRIVER NOTIFICATIONS:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

export const markDriverNotificationAsRead = async (req, res) => {
  const { notificationId } = req.params;
  const { driverId } = req.body;

  try {
    const notification = await NotificationModel.findOneAndUpdate(
      {
        _id: notificationId,
        recipientDriver: driverId,
        recipientType: "Driver",
      },
      {
        isRead: true,
        readAt: new Date(),
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        status: 404,
        message: "Notification not found.",
      });
    }

    return res.status(200).json({
      status: 200,
      notification,
      message: "Notification marked as read.",
    });
  } catch (error) {
    console.log("ERROR FROM MARK DRIVER NOTIFICATION AS READ:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

export const markAllDriverNotificationsAsRead = async (req, res) => {
  const { driverId } = req.params;

  try {
    await NotificationModel.updateMany(
      {
        recipientDriver: driverId,
        recipientType: "Driver",
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    return res.status(200).json({
      status: 200,
      message: "Driver notifications marked as read.",
    });
  } catch (error) {
    console.log("ERROR FROM MARK ALL DRIVER NOTIFICATIONS AS READ:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

// Reset driver password
export const resetDriverPassword = async (req, res) => {
  const { driverId } = req.params;
  const { oldPassword, newPassword, userType } = req.body;

  try {
    // RESET password
    const response = await resetPassword(
      driverId,
      oldPassword,
      newPassword,
      userType
    );

    // Return a response
    return res.status(response?.status).json({
      status: response?.status,
      message: response?.message,
    });
  } catch (error) {
    console.log("ERROR FROM RESET DRIVER PASSWORD:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

// This service GETS all driver's completed jobs
export const getDriverCompletedJobs = async (req, res) => {
  const { driverId } = req.params;

  try {
    // Fetch driver's completed jobs
    const response = await driverService.getDriverCompletedJobs(driverId);

    // Return a response
    return res.status(response?.status).json({
      message: response?.message,
      bookings: response?.bookings,
      status: response?.status,
    });
  } catch (error) {
    return res.status(500).json({ message: internalServerError });
  }
};

// This service GETS all driver's assigned jobs
export const getDriverAssignedJobs = async (req, res) => {
  const { driverId } = req.params;

  try {
    // Fetch driver's assigned jobs
    const response = await driverService.getDriverAssignedJobs(driverId);

    // Return a response
    return res.status(response?.status).json({
      message: response?.message,
      bookings: response?.bookings,
      status: response?.status,
    });
  } catch (error) {
    return res.status(500).json({ message: internalServerError });
  }
};

// This service GETS all driver's upcoming jobs
export const getDriverUpcomingJobs = async (req, res) => {
  const { driverId } = req.params;

  try {
    // Fetch driver's upcoming jobs
    const response = await driverService.getDriverUpcomingJobs(driverId);

    // Return a response
    return res.status(response?.status).json({
      message: response?.message,
      bookings: response?.bookings,
      status: response?.status,
    });
  } catch (error) {
    return res.status(500).json({ message: internalServerError });
  }
};

// This service GETS all driver's ongoing jobs
export const getDriverOngoingJobs = async (req, res) => {
  const { driverId } = req.params;

  try {
    // Fetch driver's ongoing jobs
    const response = await driverService.getDriverOngoingJobs(driverId);

    // Return a response
    return res.status(response?.status).json({
      message: response?.message,
      bookings: response?.bookings,
      status: response?.status,
    });
  } catch (error) {
    return res.status(500).json({ message: internalServerError });
  }
};

// Get driver bookings by driver id
export const getDriverBookingsByDriverId = async (req, res) => {
  const { driverId } = req.params;

  try {
    // Fetch driver
    const response = await driverService.getDriverBookingsByDriverId(driverId);

    // Return a response
    return res.status(response?.status).json({ message: response?.message });
  } catch (error) {
    return res.status(500).json({ message: internalServerError });
  }
};

// Accept booking
export const acceptBooking = async (req, res) => {
  const { driverId, bookingId } = req.params;

  try {
    // Accept booking
    const response = await driverService.acceptJob(driverId, bookingId);

    // Return a response
    return res.status(response?.status).json({
      upcomingBookings: response?.upcomingBookings,
      assignedBookings: response?.assignedBookings,
      status: response?.status,
      message: response?.message,
    });
  } catch (error) {
    console.log("ERROR FROM ACCEPT BOOKING:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

// Reject booking
export const declineBooking = async (req, res) => {
  const { driverId, bookingId } = req.params;

  try {
    // Reject booking
    const response = await driverService.declineJob(driverId, bookingId);

    // Return a response
    return res.status(response?.status).json({
      upcomingBookings: response?.upcomingBookings,
      assignedBookings: response?.assignedBookings,
      status: response?.status,
      message: response?.message,
    });
  } catch (error) {
    console.log("ERROR FROM DECLINE BOOKING:", error);
    return res.status(500).json({ message: internalServerError, error });
  }
};

// GET driver earnings
export const getDriverEarnings = async (req, res) => {
  const { driverId } = req.params;

  try {
    // Reject booking
    const response = await driverService.getDriverEarnings(driverId);

    // Return a response
    return res.status(response?.status).json({
      earnings: response?.earnings,
      expectedEarnings: response?.expectedEarnings,
      status: response?.status,
      message: response?.message,
    });
  } catch (error) {
    return res.status(500).json({ message: internalServerError });
  }
};

// Start booking
export const startBooking = async (req, res) => {
  const { driverId, bookingId } = req.params;

  try {
    // Start booking
    const response = await driverService.startBooking(driverId, bookingId);

    // Return a response
    return res.status(response?.status).json({
      upcomingBookings: response?.upcomingBookings,
      assignedBookings: response?.assignedBookings,
      ongoingBookings: response?.ongoingBookings,
      status: response?.status,
      message: response?.message,
    });
  } catch (error) {
    console.log("ERROR FROM ACCEPT BOOKING:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

// End booking
export const endBooking = async (req, res) => {
  const { driverId, bookingId } = req.params;

  try {
    // End booking
    const response = await driverService.endBooking(driverId, bookingId);

    // Return a response
    return res.status(response?.status).json({
      upcomingBookings: response?.upcomingBookings,
      assignedBookings: response?.assignedBookings,
      ongoingBookings: response?.ongoingBookings,
      completedBookings: response?.completedBookings,
      status: response?.status,
      message: response?.message,
    });
  } catch (error) {
    console.log("ERROR FROM ACCEPT BOOKING:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

// Forgot password
export const handleDriverForgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Handle forgot password
    const response = await forgotPassword(email, "driver");

    // Return a response
    return res.status(response?.status).json({
      status: response?.status,
      message: response?.message,
    });
  } catch (error) {
    console.log("ERROR FROM FORGOT PASSWORD (DRIVER):", error);
    return res.status(500).json({ message: internalServerError });
  }
};

// Reset Forgotten password
export const handleDriverResetForgottenPassword = async (req, res) => {
  const { driverId } = req.params;
  const { password } = req.body;

  try {
    // Handle reset forgotten password
    const response = await resetForgottenPassword(driverId, password, "driver");

    // Return a response
    return res.status(response?.status).json({
      status: response?.status,
      message: response?.message,
    });
  } catch (error) {
    console.log("ERROR FROM FORGOT PASSWORD (DRIVER):", error);
    return res.status(500).json({ message: internalServerError });
  }
};

// Fetch payouts by week (Sunday - Monday)
export const fetchPayoutsByWeek = async (req, res) => {
  const { driverId } = req.params;
  try {
    const response = await payoutService.fetchUserPayouts(driverId);

    return res.status(response.status).json({
      ...response,
    });
  } catch (error) {
    console.log("Error frm fetch payouts (Driver):", error);
    return res.status(500).json({
      status: 500,
      message: internalServerError,
      error: error,
    });
  }
};
