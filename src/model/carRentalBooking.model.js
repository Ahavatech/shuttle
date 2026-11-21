import mongoose from "mongoose";

// SCHEMA: This schema is for Car Rental Bookings
const carRentalBookingSchema = new mongoose.Schema(
  {
    bookingReference: {
      type: String,
    },

    bookingId: {
      type: mongoose.Types.ObjectId,
      ref: "Booking",
    },

    days: {
      type: Number,
    },

    city: {
      type: mongoose.Types.ObjectId,
      ref: "CarRentalCity",
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

    car: {
      type: mongoose.Types.ObjectId,
      ref: "Car",
    },
  },
  { timestamps: true }
);

const CarRentalBookingModel = mongoose.model(
  "CarRentalBooking",
  carRentalBookingSchema
);

export default CarRentalBookingModel;
