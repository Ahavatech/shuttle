import BookingModel from "../model/booking.model.js";
import NotificationModel from "../model/notification.model.js";
import PaymentModel from "../model/payment.model.js";
import UserModel from "../model/user.model.js";
import BookingService from "../service/BookingService.js";
import PaymentService from "../service/PaymentService.js";
import UserService from "../service/UserService.js";
import {
  forgotPassword,
  resetForgottenPassword,
  resetPassword,
} from "../util/auth.helper.js";

// Generic messages
const internalServerError =
  "An error occured while we processed your request. Please try again.";

// SERVICE INSTANCES
// Create a new UserService instance
const userService = new UserService(UserModel);
const paymentService = new PaymentService(PaymentModel);
const bookingService = new BookingService(BookingModel);

// Sign up user
export const signupUser = async (req, res) => {
  console.log("HI");
  const { firstName, lastName, emailAddress, phoneNumber, password } = req.body;

  try {
    // Create new user
    const response = await userService.signupUser({
      firstName,
      lastName,
      emailAddress,
      phoneNumber,
      password,
    });

    console.log("RESPONSE:::", response);

    return res.status(response?.status).json({
      status: response?.status,
      message: response?.message,
      token: response?.token ?? null,
      user: response?.user ?? null,
    });
  } catch (error) {
    console.log("ERROR FROM SIGNUP USER:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

// Log in user
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  console.log("REQ.BODY:", req.body);

  try {
    // Log in user
    const response = await userService.loginUser(email, password);

    // return a response
    if (response?.status !== 200) {
      console.log("RESPONSE 2:", response);
      return res
        .status(response?.status)
        .json({ message: response?.message, status: response?.status });
    }

    return res.status(response?.status).json({
      message: response?.message,
      status: response?.status,
      token: response?.token,
      code: response?.code,
      user: response?.user,
    });
  } catch (error) {
    console.log("LOG IN ERROR:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

// Get user by email
export const getUserByEmail = async (req, res) => {
  const { email } = req.body;

  try {
    // Fetch user
    const response = await userService.getUserByEmail(email);
    // Return a response
    return res.status(response?.status).json({ message: response?.message });
  } catch (error) {
    return res.status(500).json({ message: internalServerError });
  }
};

// Get user by id
export const getUserById = async (req, res) => {
  const { userId } = req.params;

  try {
    // Fetch user
    const response = await userService.getUserById(userId);

    // Return a response
    return res.status(response?.status).json({ message: response?.message });
  } catch (error) {
    return res.status(500).json({ message: internalServerError });
  }
};

// Get users
// TO-DO: Transfer to admin controller
export const getUsers = async (req, res) => {
  try {
    // Fetch users
    const users = await userService.getUsers();

    // Return a response
    return res
      .status(users?.status)
      .json({ users: users?.user ?? null, message: users?.message });
  } catch (error) {
    return res.status(500).json({ message: internalServerError });
  }
};

// Delete user by email
export const deleteUserByEmail = async (req, res) => {
  const { email } = req.body;
  try {
    // DELETE user
    const response = await userService.deleteUserByEmail(email);

    // Return a response
    return res.status(response?.status).json({ message: response?.message });
  } catch (error) {
    return res.status(500).json({ message: internalServerError });
  }
};

// Delete user by id
export const deleteUserById = async (req, res) => {
  const { userId } = req.params;
  try {
    // DELETE user
    const response = await userService.deleteUserById(userId);

    // Return a response
    return res.status(response?.status).json({ message: response?.message });
  } catch (error) {
    return res.status(500).json({ message: internalServerError });
  }
};

// Update user by id
export const updateUserById = async (req, res) => {
  const { userId } = req.params;

  console.log("USER ID:", userId);
  console.log("REQ.BODY:", req.body);

  try {
    // UPDATE user
    const response = await userService.updateUserById(userId, { ...req.body });

    // Return a response
    return res.status(response?.status).json({ message: response?.message });
  } catch (error) {
    console.log("ERROR:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

export const registerPushToken = async (req, res) => {
  const { userId } = req.params;
  const { token, platform, deviceId } = req.body;

  if (!userId || !token) {
    return res.status(400).json({
      status: 400,
      message: "User id and push token are required.",
    });
  }

  try {
    await UserModel.updateMany(
      {
        _id: { $ne: userId },
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

    const user = await UserModel.findOne({ _id: userId });

    if (!user) {
      return res.status(404).json({
        status: 404,
        message: "No user exists with the id specified.",
      });
    }

    const existingTokens = Array.isArray(user?.pushTokens) ? user.pushTokens : [];
    const nextTokens = existingTokens.filter((entry) => entry?.token !== token);

    nextTokens.push({
      token,
      platform: platform || "unknown",
      deviceId,
      lastSeenAt: new Date(),
      isActive: true,
    });

    user.pushTokens = nextTokens;
    await user.save();

    return res.status(201).json({
      status: 201,
      message: "Push token registered successfully.",
      pushTokens: user.pushTokens,
    });
  } catch (error) {
    console.log("ERROR FROM REGISTER PUSH TOKEN:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

export const unregisterPushToken = async (req, res) => {
  const { userId } = req.params;
  const { token } = req.body;

  if (!userId) {
    return res.status(400).json({
      status: 400,
      message: "User id is required.",
    });
  }

  try {
    const user = await UserModel.findOne({ _id: userId });

    if (!user) {
      return res.status(404).json({
        status: 404,
        message: "No user exists with the id specified.",
      });
    }

    user.pushTokens = token
      ? (user.pushTokens || []).filter((entry) => entry?.token !== token)
      : [];
    await user.save();

    return res.status(200).json({
      status: 200,
      message: "Push token removed successfully.",
      pushTokens: user.pushTokens,
    });
  } catch (error) {
    console.log("ERROR FROM UNREGISTER PUSH TOKEN:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

export const getUserNotifications = async (req, res) => {
  const { userId } = req.params;

  try {
    const notifications = await NotificationModel.find({
      recipientUser: userId,
      recipientType: "User",
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("booking");

    return res.status(200).json({
      status: 200,
      notifications,
      unreadCount: notifications.filter((item) => !item?.isRead).length,
      message: "Notifications fetched successfully.",
    });
  } catch (error) {
    console.log("ERROR FROM GET USER NOTIFICATIONS:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

export const markNotificationAsRead = async (req, res) => {
  const { notificationId } = req.params;
  const { userId } = req.body;

  try {
    const notification = await NotificationModel.findOneAndUpdate(
      {
        _id: notificationId,
        recipientUser: userId,
        recipientType: "User",
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
    console.log("ERROR FROM MARK NOTIFICATION AS READ:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

export const markAllNotificationsAsRead = async (req, res) => {
  const { userId } = req.params;

  try {
    await NotificationModel.updateMany(
      {
        recipientUser: userId,
        recipientType: "User",
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    return res.status(200).json({
      status: 200,
      message: "Notifications marked as read.",
    });
  } catch (error) {
    console.log("ERROR FROM MARK ALL NOTIFICATIONS AS READ:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

export const resetUserPassword = async (req, res) => {
  const { userId } = req.params;
  const { oldPassword, newPassword, userType } = req.body;

  try {
    const response = await resetPassword(
      userId,
      oldPassword,
      newPassword,
      userType
    );

    return res.status(response?.status).json({
      status: response?.status,
      message: response?.message,
    });
  } catch (error) {
    console.log("ERROR FROM RESET USER PASSWORD:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

// Get user total spend by user id
export const getUserTotalSpendByUserId = async (req, res) => {
  const { userId } = req.params;

  try {
    // Fetch user
    const response = await userService.getUserTotalSpendByUserId(userId);

    // Return a response
    return res.status(response?.status).json({ message: response?.message });
  } catch (error) {
    return res.status(500).json({ message: internalServerError });
  }
};

// Get user bookings by user id
export const getUserBookingsByUserId = async (req, res) => {
  const { userId } = req.params;

  try {
    // Fetch user
    const response = await userService.getUserBookingsByUserId(userId);

    // Return a response
    return res
      .status(response?.status)
      .json({
        message: response?.message,
        bookings: response?.bookings ?? null,
      });
  } catch (error) {
    return res.status(500).json({ message: internalServerError });
  }
};

// Get booking by id
export const getBookingById = async (req, res) => {
  const { bookingId } = req.params;

  try {
    // Fetch booking by id
    const response = await bookingService.getBookingById(bookingId);
    // Return a response
    return res
      .status(response?.status)
      .json({ message: response?.message, booking: response?.booking });
  } catch (error) {
    console.log("ERROR FRM BKBYID:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

// CITIES
// Get Cities
export const getCities = async (req, res) => {
  try {
    // Fetch cities
    const response = await userService.getCities(
      req.query.type,
      req.query.userCountry
    );

    // Return a response
    return res.status(response?.status).json({
      currency: response?.currency,
      cities: response?.cities ?? null,
      message: response?.message,
    });
  } catch (error) {
    console.log("ERROR:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

// Get Car Rental Cities
export const getCarRentalCities = async (req, res) => {
  try {
    // Fetch cities
    const response = await userService.getCarRentalCities(
      req.query.userCountry
    );

    // Return a response
    return res.status(response?.status).json({
      currency: response?.currency,
      cities: response?.cities ?? null,
      message: response?.message,
    });
  } catch (error) {
    console.log("ERROR:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

// Get Priority Pass Cities
export const getPriorityPassCities = async (req, res) => {
  try {
    // Fetch cities
    const response = await userService.getPriorityPassCities(
      req.query.userCountry
    );

    // Return a response
    return res.status(response?.status).json({
      currency: response?.currency,
      cities: response?.cities ?? null,
      message: response?.message,
    });
  } catch (error) {
    console.log("ERROR:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

// VISA ON ARRIVAL RATES
export const getVisaOnArrivalRates = async (req, res) => {
  try {
    // Fetch visa on arrival rates
    const response = await userService.getVisaOnArrivalRates();

    // Return a response
    return res.status(response?.status).json({
      visaOnArrivalRates: response?.visaOnArrivalRates ?? null,
      message: response?.message,
    });
  } catch (error) {
    return res.status(500).json({ message: internalServerError });
  }
};

// VISA ON ARRIVAL RATES WITH NIGERIEAN VISA REQUIRMENT
export const getVisaOnArrivalRatesWithNigerianVisa = async (req, res) => {
  console.log("HELLO FROM THE NG CONTROLLER");
  try {
    // Fetch visa on arrival rates with nigerian visa requirement
    const response = await userService.getVisaOnArrivalRatesWithNigerianVisa();

    // Return a response
    return res.status(response?.status).json({
      visaOnArrivalRates: response?.visaOnArrivalRates ?? null,
      message: response?.message,
    });
  } catch (error) {
    return res.status(500).json({ message: internalServerError });
  }
};

// ENQUIRIES
// Send Enquiry Email
export const sendEnquiryEmail = async (req, res) => {
  try {
    // Send Email
    const response = await userService.sendEnquiryEmail(
      req.body?.fullName,
      req.body?.email,
      req.body?.message
    );

    // Return a response
    return res
      .status(response?.status)
      .json({ status: response?.status, message: response?.message });
  } catch (error) {
    console.log("ERROR:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

// PAYMENTS
// Create payment (Shuttlelane Payment)
export const createPayment = async (req, res) => {
  try {
    const response = await paymentService.createPayment(req.body);
    return res
      .status(response?.status)
      .json({ message: response?.message, booking: response?.booking });
  } catch (error) {
    console.log("ERROR:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

// Create payment intent - Stripe
export const createStripePaymentIntent = async (req, res) => {
  const { products, bookingId } = req.body;
  try {
    // Send Email
    const response = await paymentService.createStripePaymentIntent(
      products,
      bookingId
    );

    // Return a response
    return res.status(200).json({ id: response?.id, url: response?.url });
  } catch (error) {
    console.log("ERROR:", error);
    return res.status(500).json({ message: internalServerError });
  }
};

// SECURITY
// Forgot password
export const handleUserForgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Handle forgot password
    const response = await forgotPassword(email, "user");

    // Return a response
    return res.status(response?.status).json({
      status: response?.status,
      message: response?.message,
    });
  } catch (error) {
    console.log("ERROR FROM FORGOT PASSWORD (USER):", error);
    return res.status(500).json({ message: internalServerError });
  }
};

// Reset Forgotten password
export const handleUserResetForgottenPassword = async (req, res) => {
  const { userId } = req.params;
  const { password } = req.body;

  try {
    // Handle reset forgotten password
    const response = await resetForgottenPassword(userId, password, "user");

    // Return a response
    return res.status(response?.status).json({
      status: response?.status,
      message: response?.message,
    });
  } catch (error) {
    console.log("ERROR FROM FORGOT PASSWORD (USER):", error);
    return res.status(500).json({ message: internalServerError });
  }
};
