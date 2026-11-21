import mongoose from "mongoose";
import shortid from "shortid";

// SCHEMA: This schema is for Airport Transfer Bookings which includes Airport Pickup and Airport Dropoff
const PriorityPassBookingSchema = new mongoose.Schema(
  {
    bookingReference: {
      type: String,
    },

    service: {
      type: String,
    },

    city: {
      type: mongoose.Types.ObjectId,
      ref: "priorityPassCity",
    },

    pickupAddress: {
      type: String,
      required: true,
    },

    pickupCoordinates: {
      lat: String,
      lng: String,
    },

    passengers: {
      type: Number,
    },

    pass: {
      type: mongoose.Types.ObjectId,
      ref: "PriorityPass",
    },

    flightNumber: {
      type: String,
    },

    pickupDate: {
      type: Date,
    },

    pickupTime: {
      type: String,
    },

    pickupTimeZone: {
      type: String, // e.g., "America/New_York"
    },

    airline: {
      type: String,
    },
  },
  { timestamps: true }
);

const PriorityPassBookingModel = mongoose.model(
  "PriorityPassBooking",
  PriorityPassBookingSchema
);

export default PriorityPassBookingModel;
