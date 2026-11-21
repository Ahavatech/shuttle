import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipientType: {
      type: String,
      enum: ["User", "Driver", "Vendor"],
      default: "User",
    },

    recipientUser: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      index: true,
    },

    recipientDriver: {
      type: mongoose.Types.ObjectId,
      ref: "Driver",
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    body: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      default: "general",
    },

    eventType: {
      type: String,
      default: "general",
    },

    source: {
      type: String,
      default: "system",
    },

    booking: {
      type: mongoose.Types.ObjectId,
      ref: "Booking",
    },

    bookingReference: {
      type: String,
    },

    data: {
      type: Object,
      default: {},
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
    },

    deliveredAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

const NotificationModel = mongoose.model("Notification", notificationSchema);

export default NotificationModel;
