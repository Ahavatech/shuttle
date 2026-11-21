import mongoose from "mongoose";
import shortid from "shortid";

// SCHEMA: This schema is for Airport Transfer Bookings which includes Airport Pickup and Airport Dropoff
const airportTransferBookingSchema = new mongoose.Schema(
  {
    bookingReference: {
      type: String,
    },

    isRoundTrip: {
      type: Boolean,
      required: true,
    },

    passengers: {
      type: Number,
    },

    airline: {
      type: String,
    },

    flightNumber: {
      type: String,
    },

    // vehicleClass: {
    //   type: mongoose.Types.ObjectId,
    //   ref: "VehicleClass",
    // },

    vehicleClass: {
      type: mongoose.Types.ObjectId,
      ref: "VehicleClass",
      required: true,
    },

    // city: {
    //   type: mongoose.Types.ObjectId,
    //   ref: "City",
    // },

    city: {
      type: String,
    },

    pickupAddress: {
      type: String,
    },

    pickupCoordinates: {
      lat: String,
      lng: String,
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

    dropoffAddress: {
      type: String,
      trim: true,
    },

    dropoffCoordinates: {
      lat: Number,
      lng: Number,
    },

    returnDate: {
      type: Date,
    },

    returnTime: {
      type: String,
    },

    returnTimeZone: {
      type: String, // e.g., "America/New_York"
    },

    hasPriorityPass: {
      type: Boolean,
      default: false,
    },

    priorityPassType: {
      type: mongoose.Types.ObjectId,
      ref: "PriorityPass",
    },

    priorityPassCount: {
      type: Number,
    },
  },
  { timestamps: true }
);

const AirportTransferBookingModel = mongoose.model(
  "AirportTransferBooking",
  airportTransferBookingSchema
);

export default AirportTransferBookingModel;
