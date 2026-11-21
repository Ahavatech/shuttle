import mongoose from "mongoose";

// SCHEMA: This schema is for Users
const userSchema = new mongoose.Schema(
  {
    image: {
      type: String,
    },

    firstName: {
      type: String,
      required: true,
    },

    lastName: {
      type: String,
      required: true,
    },

    emailAddress: {
      type: String,
      trim: true,
      match: /.+\@.+\..+/,
      required: true,
    },

    phoneNumber: {
      type: String,
      required: true,
    },

    password: {
      type: String,
      required: true,
    },

    bookings: [
      {
        type: mongoose.Types.ObjectId,
        ref: "Booking",
      },
    ],

    phoneVerification: {
      type: Boolean,
      default: false,
    },

    notificationPreferences: {
      bookingUpdates: {
        type: Boolean,
        default: true,
      },
    },

    pushTokens: [
      {
        token: {
          type: String,
          required: true,
        },
        platform: {
          type: String,
          enum: ["ios", "android", "unknown"],
          default: "unknown",
        },
        deviceId: {
          type: String,
        },
        lastSeenAt: {
          type: Date,
          default: Date.now,
        },
        isActive: {
          type: Boolean,
          default: true,
        },
      },
    ],
  },
  { timestamps: true }
);

const UserModel = mongoose.model("User", userSchema);

export default UserModel;
