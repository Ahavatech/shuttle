import mongoose from "mongoose";

// SCHEMA: This schema is for cities on the car rental service
const carRentalCitySchema = new mongoose.Schema(
  {
    cityName: {
      type: String,
      required: true,
    },

    cars: [
      {
        type: mongoose.Types.ObjectId,
        ref: "Car",
      },
    ],
  },
  { timestamps: true }
);

const CarRentalCityModel = mongoose.model("CarRentalCity", carRentalCitySchema);

export default CarRentalCityModel;
