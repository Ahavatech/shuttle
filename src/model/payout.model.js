import mongoose from "mongoose";

const PayoutsModelSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      required: true,
    },

    booking: {
      type: mongoose.Types.ObjectId,
      ref: "Booking",
      required: true,
    },

    pickupDate: {
      type: Date,
    },

    hasBeenSettled: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const PayoutsModel = mongoose.model("Payout", PayoutsModelSchema);
export default PayoutsModel;
