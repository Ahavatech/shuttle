import mongoose from "mongoose";

// SCHEMA: This schema is for cities in the Airport transfer service - BY DEFAULT
const citySchema = new mongoose.Schema(
  {
    cityName: {
      type: String,
      required: true,
    },

    airports: [{}],

    vehicleClasses: [
      {
        type: mongoose.Types.ObjectId,
        ref: "VehicleClass",
      },
    ],

    cars: [
      {
        type: mongoose.Types.ObjectId,
        ref: "Car",
      },
    ],
  },
  { timestamps: true }
);

const CityModel = mongoose.model("City", citySchema);

export default CityModel;
