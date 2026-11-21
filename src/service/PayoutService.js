import mongoose from "mongoose";
import { validateFields } from "../util/auth.helper.js";
import BookingModel from "../model/booking.model.js";
import moment from "moment";
import { sendSGDynamicEmail } from "../util/sendgrid.js";

export default class PayoutService {
  constructor(ShuttlelanePayoutModel) {
    this.PayoutModel = ShuttlelanePayoutModel;
  }

  // This method fetches a user's (Driver / Vendor) payouts by week
  async fetchUserPayouts(userId) {
    // Check for empty fields
    const areFieldsEmpty = validateFields([userId]);
    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    const weeklyPayouts = await this.PayoutModel.aggregate([
      {
        // Step 1: Match the specific userId
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        // Step 1: Populate the 'booking' field from the Payout schema
        $lookup: {
          from: "bookings", // Replace with your actual collection name for Booking schema
          localField: "booking",
          foreignField: "_id",
          as: "bookingDetails",
        },
      },
      {
        // Step 2: Unwind the populated bookingDetails array
        $unwind: "$bookingDetails",
      },
      {
        // Step 3: Use $facet to handle multiple booking types
        $facet: {
          airportTransfer: [
            {
              $match: {
                "bookingDetails.bookingSchemaType": "AirportTransferBooking",
              },
            },
            {
              $lookup: {
                from: "airporttransferbookings",
                localField: "bookingDetails.booking",
                foreignField: "_id",
                as: "pickupDetails",
              },
            },
            { $unwind: "$pickupDetails" },
          ],
          carRental: [
            {
              $match: {
                "bookingDetails.bookingSchemaType": "CarRentalBooking",
              },
            },
            {
              $lookup: {
                from: "carrentalbookings",
                localField: "bookingDetails.booking",
                foreignField: "_id",
                as: "pickupDetails",
              },
            },
            { $unwind: "$pickupDetails" },
          ],
          priorityPass: [
            {
              $match: {
                "bookingDetails.bookingSchemaType": "PriorityPassBooking",
              },
            },
            {
              $lookup: {
                from: "prioritypassbookings",
                localField: "bookingDetails.booking",
                foreignField: "_id",
                as: "pickupDetails",
              },
            },
            { $unwind: "$pickupDetails" },
          ],
          visaOnArrival: [
            {
              $match: {
                "bookingDetails.bookingSchemaType": "VisaOnArrivalBooking",
              },
            },
            {
              $lookup: {
                from: "visaonarrivalbookings",
                localField: "bookingDetails.booking",
                foreignField: "_id",
                as: "pickupDetails",
              },
            },
            { $unwind: "$pickupDetails" },
          ],
        },
      },
      {
        // Step 4: Merge all results from the facets
        $project: {
          mergedResults: {
            $concatArrays: [
              "$airportTransfer",
              "$carRental",
              "$priorityPass",
              "$visaOnArrival",
            ],
          },
        },
      },
      { $unwind: "$mergedResults" },
      {
        // Step 5: Replace root with the merged results
        $replaceRoot: { newRoot: "$mergedResults" },
      },
      {
        // Step 6: Add week and year fields based on 'pickupDetails.pickupDate'
        $addFields: {
          week: { $isoWeek: "$pickupDetails.pickupDate" },
          year: { $isoWeekYear: "$pickupDetails.pickupDate" },
          bookingRate: {
            $toDouble: "$bookingDetails.bookingRate",
          },
        },
      },
      {
        // Step 7: Lookup drivers and vendors
        $lookup: {
          from: "drivers", // Replace with your actual collection name for drivers
          localField: "userId",
          foreignField: "_id",
          as: "driverDetails",
        },
      },
      {
        // Step 8: Lookup vendors
        $lookup: {
          from: "vendors", // Replace with your actual collection name for vendors
          localField: "userId",
          foreignField: "_id",
          as: "vendorDetails",
        },
      },
      {
        // Step 9: Add a field to get user details and isDriver flag
        $addFields: {
          userDetails: {
            $cond: {
              if: { $gt: [{ $size: "$driverDetails" }, 0] },
              then: { $arrayElemAt: ["$driverDetails", 0] },
              else: { $arrayElemAt: ["$vendorDetails", 0] },
            },
          },
          isDriver: {
            $gt: [{ $size: "$driverDetails" }, 0], // true if user is a driver
          },
        },
      },
      {
        // Step 10: Group by userId (driver/vendor), week, and year
        $group: {
          _id: {
            userId: "$userId", // Group by driver/vendor
            year: "$year",
            week: "$week",
          },
          totalBookingRate: { $sum: "$bookingRate" }, // Sum the bookingRate for each userId in the week
          hasBeenSettled: { $max: "$hasBeenSettled" }, // Check if any hasBeenSettled is true
          startDate: { $min: "$pickupDetails.pickupDate" },
          endDate: { $max: "$pickupDetails.pickupDate" },
          userDetails: { $first: "$userDetails" }, // Keep user details
          jobs: { $sum: 1 }, // Count number of jobs per driver/vendor
        },
      },
      {
        // Step 11: Sort groups by year and week chronologically
        $sort: { "_id.year": 1, "_id.week": 1 },
      },
      {
        // Step 13: Project the final format
        $project: {
          _id: 0,
          week: "$_id.week",
          year: "$_id.year",
          userId: "$_id.userId",
          userDetails: 1,
          totalBookingRate: 1,
          jobs: 1,
          hasBeenSettled: 1,
          startDate: 1,
          endDate: 1,
          isDriver: 1, // Add the isDriver field to the final output
        },
      },
    ]);

    console.log("WEEKLY PAYOUTS:", weeklyPayouts);
    return {
      payouts: weeklyPayouts,
      message: "User's weekly payouts fetched",
      status: 200,
    };
  }

  // This method fetches all (Driver / Vendor) payouts by week
  async fetchPayouts() {
    const weeklyPayouts = await this.PayoutModel.aggregate([
      {
        // Step 1: Populate the 'booking' field from the Payout schema
        $lookup: {
          from: "bookings", // Replace with your actual collection name for Booking schema
          localField: "booking",
          foreignField: "_id",
          as: "bookingDetails",
        },
      },
      {
        // Step 2: Unwind the populated bookingDetails array
        $unwind: "$bookingDetails",
      },
      {
        // Step 3: Use $facet to handle multiple booking types
        $facet: {
          airportTransfer: [
            {
              $match: {
                "bookingDetails.bookingSchemaType": "AirportTransferBooking",
              },
            },
            {
              $lookup: {
                from: "airporttransferbookings",
                localField: "bookingDetails.booking",
                foreignField: "_id",
                as: "pickupDetails",
              },
            },
            { $unwind: "$pickupDetails" },
          ],
          carRental: [
            {
              $match: {
                "bookingDetails.bookingSchemaType": "CarRentalBooking",
              },
            },
            {
              $lookup: {
                from: "carrentalbookings",
                localField: "bookingDetails.booking",
                foreignField: "_id",
                as: "pickupDetails",
              },
            },
            { $unwind: "$pickupDetails" },
          ],
          priorityPass: [
            {
              $match: {
                "bookingDetails.bookingSchemaType": "PriorityPassBooking",
              },
            },
            {
              $lookup: {
                from: "prioritypassbookings",
                localField: "bookingDetails.booking",
                foreignField: "_id",
                as: "pickupDetails",
              },
            },
            { $unwind: "$pickupDetails" },
          ],
          visaOnArrival: [
            {
              $match: {
                "bookingDetails.bookingSchemaType": "VisaOnArrivalBooking",
              },
            },
            {
              $lookup: {
                from: "visaonarrivalbookings",
                localField: "bookingDetails.booking",
                foreignField: "_id",
                as: "pickupDetails",
              },
            },
            { $unwind: "$pickupDetails" },
          ],
        },
      },
      {
        // Step 4: Merge all results from the facets
        $project: {
          mergedResults: {
            $concatArrays: [
              "$airportTransfer",
              "$carRental",
              "$priorityPass",
              "$visaOnArrival",
            ],
          },
        },
      },
      { $unwind: "$mergedResults" },
      {
        // Step 5: Replace root with the merged results
        $replaceRoot: { newRoot: "$mergedResults" },
      },
      {
        // Step 6: Add week and year fields based on 'pickupDetails.pickupDate'
        $addFields: {
          week: { $isoWeek: "$pickupDetails.pickupDate" },
          year: { $isoWeekYear: "$pickupDetails.pickupDate" },
          bookingRate: {
            $toDouble: "$bookingDetails.bookingRate",
          },
        },
      },
      {
        // Step 7: Lookup drivers and vendors
        $lookup: {
          from: "drivers", // Replace with your actual collection name for drivers
          localField: "userId",
          foreignField: "_id",
          as: "driverDetails",
        },
      },
      {
        // Step 8: Lookup vendors
        $lookup: {
          from: "vendors", // Replace with your actual collection name for vendors
          localField: "userId",
          foreignField: "_id",
          as: "vendorDetails",
        },
      },
      {
        // Step 9: Add a field to get user details and isDriver flag
        $addFields: {
          userDetails: {
            $cond: {
              if: { $gt: [{ $size: "$driverDetails" }, 0] },
              then: { $arrayElemAt: ["$driverDetails", 0] },
              else: { $arrayElemAt: ["$vendorDetails", 0] },
            },
          },
          isDriver: {
            $gt: [{ $size: "$driverDetails" }, 0], // true if user is a driver
          },
        },
      },
      {
        // Step 10: Group by userId (driver/vendor), week, and year
        $group: {
          _id: {
            userId: "$userId", // Group by driver/vendor
            year: "$year",
            week: "$week",
          },
          totalBookingRate: { $sum: "$bookingRate" }, // Sum the bookingRate for each userId in the week
          hasBeenSettled: { $max: "$hasBeenSettled" }, // Check if any hasBeenSettled is true
          startDate: { $min: "$pickupDetails.pickupDate" },
          endDate: { $max: "$pickupDetails.pickupDate" },
          userDetails: { $first: "$userDetails" }, // Keep user details
          jobs: { $sum: 1 }, // Count number of jobs per driver/vendor
        },
      },
      {
        // Step 11: Sort groups by year and week chronologically
        $sort: { "_id.year": 1, "_id.week": 1 },
      },
      {
        // Step 13: Project the final format
        $project: {
          _id: 0,
          week: "$_id.week",
          year: "$_id.year",
          userId: "$_id.userId",
          userDetails: 1,
          totalBookingRate: 1,
          jobs: 1,
          hasBeenSettled: 1,
          startDate: 1,
          endDate: 1,
          isDriver: 1, // Add the isDriver field to the final output
        },
      },
    ]);

    // const payouts = await this.PayoutModel.find({}).populate("booking").populate("userId").sort({ createdAt: -1 });

    console.log("WEEKLY PAYOUTS:", weeklyPayouts);
    return {
      payouts: weeklyPayouts,
      // weeklyPayouts: weeklyPayouts,
      message: "All payouts fetched",
      status: 200,
    };
  }

  // This method fetches a payout
  async fetchPayout(payoutId) {
    // Check for empty fields
    const areFieldsEmpty = validateFields([payoutId]);
    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    const payout = await this.PayoutModel.findOne({ _id: payoutId });

    console.log("WEEKLY PAYOUTS:", weeklyPayouts);
    return {
      payout: payout,
      message: "Payout has been fetched",
      status: 201,
    };
  }

  // This method marks a payout as settled
  async settlePayout(userId, week, year, amount, name, email) {
    // Check for empty fields
    const areFieldsEmpty = validateFields([userId, year, week]);
    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    // Grab all user payouts that are within a specified week of the year
    const userPayouts = await this.PayoutModel.find({
      userId: userId,
    }).populate("booking");

    // Loop filter through the list to get the bookings that fall in the same week as the week provided
    const filteredUserPayouts = userPayouts.filter((payout) => {
      console.log("PAYOUT INNER:", payout);
      // Prepare date data
      const pickupDate = moment(payout?.pickupDate);
      console.log("PICKUPDATE:", payout?.pickupDate);
      const payoutWeek = pickupDate.isoWeek();
      console.log("PAYOUT WEEK:", payoutWeek);
      return week == pickupDate.isoWeek();
    });
    console.log("user payouts:", userPayouts);
    console.log("filtered payouts:", filteredUserPayouts);

    // UpdateMany and mark the hasBeenSettled field on each of these payouts as true
    filteredUserPayouts?.forEach(async (payout) => {
      const updatePayout = await this.PayoutModel.findOneAndUpdate(
        {
          _id: payout?._id,
        },
        { hasBeenSettled: true },
      );

      console.log("UPDATE PAYOUT::+:+:++:+:+:+:+:+:=:", updatePayout);
    });

    // Send email to driver / vendor here
    // Send a notification to the user
    const dynamicTemplateData = {
      total: amount,
      name: name,
    };

    let msg = {
      from: "booking@shuttlelane.com",
      to: email,
      subject: "Credit Alert 🎉",
      templateId: "d-8709c6488df04bf69ddd967a43ecf37f",
      dynamicTemplateData: dynamicTemplateData,
    };
    await sendSGDynamicEmail(msg);

    const weeklyPayouts = await this.PayoutModel.aggregate([
      {
        // Step 1: Populate the 'booking' field from the Payout schema
        $lookup: {
          from: "bookings", // Replace with your actual collection name for Booking schema
          localField: "booking",
          foreignField: "_id",
          as: "bookingDetails",
        },
      },
      {
        // Step 2: Unwind the populated bookingDetails array
        $unwind: "$bookingDetails",
      },
      {
        // Step 3: Use $facet to handle multiple booking types
        $facet: {
          airportTransfer: [
            {
              $match: {
                "bookingDetails.bookingSchemaType": "AirportTransferBooking",
              },
            },
            {
              $lookup: {
                from: "airporttransferbookings",
                localField: "bookingDetails.booking",
                foreignField: "_id",
                as: "pickupDetails",
              },
            },
            { $unwind: "$pickupDetails" },
          ],
          carRental: [
            {
              $match: {
                "bookingDetails.bookingSchemaType": "CarRentalBooking",
              },
            },
            {
              $lookup: {
                from: "carrentalbookings",
                localField: "bookingDetails.booking",
                foreignField: "_id",
                as: "pickupDetails",
              },
            },
            { $unwind: "$pickupDetails" },
          ],
          priorityPass: [
            {
              $match: {
                "bookingDetails.bookingSchemaType": "PriorityPassBooking",
              },
            },
            {
              $lookup: {
                from: "prioritypassbookings",
                localField: "bookingDetails.booking",
                foreignField: "_id",
                as: "pickupDetails",
              },
            },
            { $unwind: "$pickupDetails" },
          ],
          visaOnArrival: [
            {
              $match: {
                "bookingDetails.bookingSchemaType": "VisaOnArrivalBooking",
              },
            },
            {
              $lookup: {
                from: "visaonarrivalbookings",
                localField: "bookingDetails.booking",
                foreignField: "_id",
                as: "pickupDetails",
              },
            },
            { $unwind: "$pickupDetails" },
          ],
        },
      },
      {
        // Step 4: Merge all results from the facets
        $project: {
          mergedResults: {
            $concatArrays: [
              "$airportTransfer",
              "$carRental",
              "$priorityPass",
              "$visaOnArrival",
            ],
          },
        },
      },
      { $unwind: "$mergedResults" },
      {
        // Step 5: Replace root with the merged results
        $replaceRoot: { newRoot: "$mergedResults" },
      },
      {
        // Step 6: Add week and year fields based on 'pickupDetails.pickupDate'
        $addFields: {
          week: { $isoWeek: "$pickupDetails.pickupDate" },
          year: { $isoWeekYear: "$pickupDetails.pickupDate" },
          bookingRate: {
            $toDouble: "$bookingDetails.bookingRate",
          },
        },
      },
      {
        // Step 7: Lookup drivers and vendors
        $lookup: {
          from: "drivers", // Replace with your actual collection name for drivers
          localField: "userId",
          foreignField: "_id",
          as: "driverDetails",
        },
      },
      {
        // Step 8: Lookup vendors
        $lookup: {
          from: "vendors", // Replace with your actual collection name for vendors
          localField: "userId",
          foreignField: "_id",
          as: "vendorDetails",
        },
      },
      {
        // Step 9: Add a field to get user details and isDriver flag
        $addFields: {
          userDetails: {
            $cond: {
              if: { $gt: [{ $size: "$driverDetails" }, 0] },
              then: { $arrayElemAt: ["$driverDetails", 0] },
              else: { $arrayElemAt: ["$vendorDetails", 0] },
            },
          },
          isDriver: {
            $gt: [{ $size: "$driverDetails" }, 0], // true if user is a driver
          },
        },
      },
      {
        // Step 10: Group by userId (driver/vendor), week, and year
        $group: {
          _id: {
            userId: "$userId", // Group by driver/vendor
            year: "$year",
            week: "$week",
          },
          totalBookingRate: { $sum: "$bookingRate" }, // Sum the bookingRate for each userId in the week
          hasBeenSettled: { $max: "$hasBeenSettled" }, // Check if any hasBeenSettled is true
          startDate: { $min: "$pickupDetails.pickupDate" },
          endDate: { $max: "$pickupDetails.pickupDate" },
          userDetails: { $first: "$userDetails" }, // Keep user details
          jobs: { $sum: 1 }, // Count number of jobs per driver/vendor
        },
      },
      {
        // Step 11: Sort groups by year and week chronologically
        $sort: { "_id.year": 1, "_id.week": 1 },
      },
      {
        // Step 13: Project the final format
        $project: {
          _id: 0,
          week: "$_id.week",
          year: "$_id.year",
          userId: "$_id.userId",
          userDetails: 1,
          totalBookingRate: 1,
          jobs: 1,
          hasBeenSettled: 1,
          startDate: 1,
          endDate: 1,
          isDriver: 1, // Add the isDriver field to the final output
        },
      },
    ]);

    console.log("WEEKLY PAYOUTS:", weeklyPayouts);
    return {
      payouts: weeklyPayouts,
      message: "Payout has been settled",
      status: 201,
    };
  }
}
