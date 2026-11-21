// @ts-nocheck
import Stripe from "stripe";
const stripeInstance = Stripe(process.env.STRIPE_SECRET_KEY);
import BookingModel from "../model/booking.model.js";
import CurrencyModel from "../model/currency.model.js";
import { validateFields } from "../util/auth.helper.js";
import {
  convertAmountToUserCurrency,
  generateUserBookingDetails,
} from "../util/index.js";
import { sendSMS } from "../util/twilio.js";
import moment from "moment";
import BookingSuccessfulEmail from "../emailTemplates/userEmailTemplates/BookingSuccessfulEmail/index.js";
import { sendEmail, sendSGDynamicEmail } from "../util/sendgrid.js";
import ReactDOMServer from "react-dom/server";
import AirportTransferBookingModel from "../model/airportTransferBooking.model.js";
import CarRentalBookingModel from "../model/carRentalBooking.model.js";
import PriorityPassBookingModel from "../model/priorityPassBooking.model.js";
import VisaOnArrivalBookingModel from "../model/visaOnArrivalBooking.model.js";
import {
  firstEmailValue,
  formatEmailCurrencyAmount,
  formatEmailDate,
  formatEmailName,
  formatEmailPickupTime,
  sanitizeEmailDetailItems,
} from "../util/emailFormatters.js";

export default class PaymentService {
  constructor(ShuttlelanePaymentModel) {
    this.PaymentModel = ShuttlelanePaymentModel;
  }

  // This service CREATES a new payment
  async createPayment(payment) {
    const paymentExists = await this.PaymentModel.findOne({
      booking: payment?.booking,
      paymentStatus: "Successful",
    });
    const bookingExists = await BookingModel.findOne({
      _id: payment?.booking,
    })
      .populate("user")
      .populate("booking")
      .populate("bookingCurrency");

    console.log("BOOKING EXISTS:", bookingExists);

    // If the payment status is "Failed", we want to
    // 1. Delete the booking
    // 2. Return immediately, do not proceed to send an email or sms to the user
    if (payment?.paymentStatus?.toLowerCase() == "failed") {
      const deleteBooking = await BookingModel.findOneAndRemove({
        _id: payment?.booking,
      });
      return {
        status: 201,
        message:
          "Your payment failed. Please try again later or contact booking@shuttlelane.com",
      };
    }

    if (paymentExists) {
      if (paymentExists?.paymentStatus !== "Successful") {
        return {
          status: 409,
          message:
            "Payment has already been made for this booking. Please contact support for further information.",
        };
      } else {
        const updatePayment = await this.PaymentModel.findOneAndUpdate(
          { _id: paymentExists?._id },
          {
            amount: bookingExists?.bookingTotal,
            currency: bookingExists?.bookingCurrency?._id,
            paymentStatus: payment?.paymentStatus,
            booking: payment?.booking,
            gateway: payment?.gateway,
            firstName:
              bookingExists?.user?.firstName ?? bookingExists?.firstName,
            lastName: bookingExists?.user?.lastName ?? bookingExists?.lastName,
            email: bookingExists?.user?.email ?? bookingExists?.email,
          }
        );
      }
    }

    if (!bookingExists) {
      return {
        status: 409,
        message: "Invalid booking id provided.",
      };
    }

    const newPayment = await this.PaymentModel.create({
      amount: bookingExists?.bookingTotal,
      currency: bookingExists?.bookingCurrency?._id,
      paymentStatus: payment?.paymentStatus,
      booking: payment?.booking,
      gateway: payment?.gateway,
      firstName: bookingExists?.user?.firstName ?? bookingExists?.firstName,
      lastName: bookingExists?.user?.lastName ?? bookingExists?.lastName,
      email: bookingExists?.user?.email ?? bookingExists?.email,
    });

    // Update booking payment status
    await BookingModel.findOneAndUpdate(
      { _id: payment?.booking },
      { paymentId: newPayment?._id }
    );

    let smsMessage, bookingDetails, booking;
    if (bookingExists?.bookingType == "Airport") {
      smsMessage = `Hello ${
        bookingExists?.title ?? bookingExists?.user?.title
      } ${
        bookingExists?.firstName ?? bookingExists?.user?.firstName
      }, Your Airport Transfer Service has been booked for ${moment(
        bookingExists?.booking?.pickupDate
      ).format("dddd, MMMM DD YYYY")}, ${
        bookingExists?.booking?.pickupTime
      }. Your booking reference: ${
        bookingExists?.bookingReference
      }. Thank you for using Shuttlelane.`;

      booking = await AirportTransferBookingModel.findOne({
        _id: bookingExists?.booking?._id,
      }).populate("vehicleClass");

      bookingDetails = [
        {
          label: "Pick-up Address",
          value: bookingExists?.booking?.pickupAddress,
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Pick-up Date",
          value: formatEmailDate(bookingExists?.booking?.pickupDate),
          backgroundColor: "#F5F5F5",
        },
        {
          label: "Pick-up Time",
          value: formatEmailPickupTime(bookingExists?.booking?.pickupTime),
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Airline",
          value: bookingExists?.booking?.airline ?? "N/A",
          backgroundColor: "#F5F5F5",
        },
        {
          label: "Flight Number",
          value: bookingExists?.booking?.flightNumber ?? "N/A",
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Drop-off Address",
          value: bookingExists?.booking?.dropoffAddress,
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Vehicle Class",
          value: booking?.vehicleClass?.className,
          backgroundColor: "#F5F5F5",
        },
        {
          label: "Passenger",
          value: formatEmailName(
            bookingExists?.user?.title ?? bookingExists?.title,
            bookingExists?.user?.firstName ?? bookingExists?.firstName,
            bookingExists?.user?.lastName ?? bookingExists?.lastName
          ),
          backgroundColor: "#FFFFFF",
        },
        {
          label: "TOTAL BILLED",
          value: formatEmailCurrencyAmount(
            bookingExists?.bookingCurrency?.symbol,
            bookingExists?.bookingTotal
          ),
          backgroundColor: "#F5F5F5",
        },
      ];
    } else if (bookingExists?.bookingType == "Car") {
      smsMessage = `Hello ${
        bookingExists?.title ?? bookingExists?.user?.title
      } ${
        bookingExists?.firstName ?? bookingExists?.user?.firstName
      }, Your Car Rental Service has been booked for ${moment(
        bookingExists?.booking?.pickupDate
      ).format("dddd, MMMM DD YYYY")}, ${
        bookingExists?.booking?.pickupTime
      }. Your booking reference: ${
        bookingExists?.bookingReference
      }. Thank you for using Shuttlelane.`;

      booking = await CarRentalBookingModel.findOne({
        _id: bookingExists?.booking?._id,
      }).populate("car");

      bookingDetails = [
        {
          label: "Pick-up Address",
          value: bookingExists?.booking?.pickupAddress,
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Pick-up Date",
          value: formatEmailDate(bookingExists?.booking?.pickupDate),
          backgroundColor: "#F5F5F5",
        },
        {
          label: "Pick-up Time",
          value: formatEmailPickupTime(bookingExists?.booking?.pickupTime),
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Car",
          value: booking?.car?.name,
          backgroundColor: "#F5F5F5",
        },
        {
          label: "Days",
          value: bookingExists?.booking?.days,
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Passenger",
          value: formatEmailName(
            bookingExists?.user?.title ?? bookingExists?.title,
            bookingExists?.user?.firstName ?? bookingExists?.firstName,
            bookingExists?.user?.lastName ?? bookingExists?.lastName
          ),
          backgroundColor: "#F5F5F5",
        },
        {
          label: "TOTAL BILLED",
          value: formatEmailCurrencyAmount(
            bookingExists?.bookingCurrency?.symbol,
            bookingExists?.bookingTotal
          ),
          backgroundColor: "#FFFFFF",
        },
      ];
    } else if (bookingExists?.bookingType == "Priority") {
      smsMessage = `Hello ${
        bookingExists?.title ?? bookingExists?.user?.title
      } ${
        bookingExists?.firstName ?? bookingExists?.user?.firstName
      }, Your Priority Pass Service has been booked for ${moment(
        bookingExists?.booking?.pickupDate
      ).format("dddd, MMMM DD YYYY")}, ${
        bookingExists?.booking?.pickupTime
      }. Your booking reference: ${
        bookingExists?.bookingReference
      }. Thank you for using Shuttlelane.`;

      booking = await PriorityPassBookingModel.findOne({
        _id: bookingExists?.booking?._id,
      }).populate("pass");

      bookingDetails = [
        {
          label: "Pick-up Address",
          value: bookingExists?.booking?.pickupAddress,
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Pick-up Date",
          value: formatEmailDate(bookingExists?.booking?.pickupDate),
          backgroundColor: "#F5F5F5",
        },
        {
          label: "Pick-up Time",
          value: formatEmailPickupTime(bookingExists?.booking?.pickupTime),
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Airline",
          value: bookingExists?.booking?.airline ?? "N/A",
          backgroundColor: "#F5F5F5",
        },
        {
          label: "Flight Number",
          value: bookingExists?.booking?.flightNumber ?? "N/A",
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Service Type",
          value: booking?.service,
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Protocol Type",
          value: booking?.pass?.name,
          backgroundColor: "#F5F5F5",
        },
        {
          label: "Passenger",
          value: formatEmailName(
            bookingExists?.user?.title ?? bookingExists?.title,
            bookingExists?.user?.firstName ?? bookingExists?.firstName,
            bookingExists?.user?.lastName ?? bookingExists?.lastName
          ),
          backgroundColor: "#FFFFFF",
        },
        {
          label: "TOTAL BILLED",
          value: formatEmailCurrencyAmount(
            bookingExists?.bookingCurrency?.symbol,
            bookingExists?.bookingTotal
          ),
          backgroundColor: "#F5F5F5",
        },
      ];
    } else if (bookingExists?.bookingType == "Visa") {
      smsMessage = `Hello ${
        bookingExists?.title ?? bookingExists?.user?.title
      } ${
        bookingExists?.firstName ?? bookingExists?.user?.firstName
      }, Your Visa On Arrival Service has been booked. Your booking reference: ${
        bookingExists?.bookingReference
      }. Thank you for using Shuttlelane.`;

      booking = await VisaOnArrivalBookingModel.findOne({
        _id: bookingExists?.booking?._id,
      }).populate("pass");

      bookingDetails = [
        {
          label: "Nationality",
          value: bookingExists?.booking?.nationality,
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Visa Class",
          value: bookingExists?.booking?.visaClass,
          backgroundColor: "#F5F5F5",
        },
        {
          label: "Passport Type",
          value: bookingExists?.booking?.passportType,
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Full Name",
          value: formatEmailName(
            bookingExists?.booking?.title,
            bookingExists?.booking?.surname,
            bookingExists?.booking?.firstName,
            bookingExists?.booking?.middleName
          ),
          backgroundColor: "#F5F5F5",
        },
        {
          label: "Email",
          value: bookingExists?.booking?.email,
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Date Of Birth",
          value: formatEmailDate(bookingExists?.booking?.dateOfBirth),
          backgroundColor: "#F5F5F5",
        },
        {
          label: "Place Of Birth",
          value: bookingExists?.booking?.placeOfBirth,
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Gender",
          value: bookingExists?.booking?.gender,
          backgroundColor: "#F5F5F5",
        },
        {
          label: "Marital Status",
          value: bookingExists?.booking?.maritalStatus,
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Passport Number",
          value: bookingExists?.booking?.passportNumber,
          backgroundColor: "#F5F5F5",
        },
        {
          label: "Passport Expiry Date",
          value: formatEmailDate(bookingExists?.booking?.passportExpiryDate),
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Purpose Of Journey",
          value: bookingExists?.booking?.purposeOfJourney,
          backgroundColor: "#F5F5F5",
        },
        {
          label: "Airline",
          value: bookingExists?.booking?.airline,
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Flight Number",
          value: bookingExists?.booking?.flightNumber,
          backgroundColor: "#F5F5F5",
        },
        {
          label: "Country Of Departure",
          value: bookingExists?.booking?.countryOfDeparture,
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Arrival Date",
          value: formatEmailDate(bookingExists?.booking?.arrivalDate),
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Port Of Entry",
          value: bookingExists?.booking?.portOfEntry,
          backgroundColor: "#F5F5F5",
        },
        {
          label: "Duration Of Stay",
          value: bookingExists?.booking?.durationOfStay,
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Contact Name",
          value: bookingExists?.booking?.contactName,
          backgroundColor: "#F5F5F5",
        },
        {
          label: "Contact Number",
          value: bookingExists?.booking?.contactNumber,
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Contact Address",
          value: bookingExists?.booking?.contactAddress,
          backgroundColor: "#F5F5F5",
        },
        {
          label: "Contact City",
          value: bookingExists?.booking?.contactCity,
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Contact State",
          value: bookingExists?.booking?.contactState,
          backgroundColor: "#F5F5F5",
        },
        {
          label: "Contact Email",
          value: bookingExists?.booking?.contactEmail,
          backgroundColor: "#FFFFFF",
        },
        {
          label: "Contact Postal Code",
          value: bookingExists?.booking?.contactPostalCode,
          backgroundColor: "#F5F5F5",
        },
        {
          label: "TOTAL BILLED",
          value: formatEmailCurrencyAmount(
            bookingExists?.bookingCurrency?.symbol,
            bookingExists?.bookingTotal
          ),
          backgroundColor: "#FFFFFF",
        },
      ];
    }

    bookingDetails = sanitizeEmailDetailItems(bookingDetails);

    let dynamicTemplateData = {
      title: firstEmailValue(
        bookingExists?.user?.title,
        bookingExists?.title,
        "Customer"
      ),
      firstName: firstEmailValue(
        bookingExists?.user?.firstName,
        bookingExists?.firstName,
        "Customer"
      ),
      bookingType:
        bookingExists?.bookingType == "Airport"
          ? "Airport Transfer"
          : bookingExists?.bookingType == "Car"
          ? "Car Rental"
          : bookingExists?.bookingType == "Priority"
          ? "Priority Pass"
          : bookingExists?.bookingType == "Visa"
          ? "Visa On Arrival"
          : "",
      bookingDetails: bookingDetails,
      bookingReference: bookingExists?.bookingReference,
    };

    const templateId = `${
      bookingExists?.bookingType == "Airport"
        ? "d-c7e06ac8c347451ab9de3da1a6f8c418"
        : bookingExists?.bookingType == "Car"
        ? "d-e4516282152f47b199d73195c556b29e"
        : bookingExists?.bookingType == "Priority"
        ? "d-07bed1074544425aba3b919bc9ba9f23"
        : bookingExists?.bookingType == "Visa"
        ? "d-30e154de18774dbc861b94872430b98f"
        : "d-c7e06ac8c347451ab9de3da1a6f8c418"
    }`;

    let msg = {
      to: bookingExists?.user?.email ?? bookingExists?.email,
      from: "booking@shuttlelane.com",
      subject: `${dynamicTemplateData?.bookingType} Booking Confirmation`,
      templateId: templateId,
      dynamicTemplateData,
    };

    await sendSGDynamicEmail(msg);

    // Send sms
    await sendSMS(
      bookingExists?.user?.mobile ?? bookingExists?.mobile,
      smsMessage
    )
      .then((res) => {
        console.log("TWILIO RESPONSE:", res);
      })
      .catch((err) => {
        console.log("ERROR:", err);
      });

    // Fetch all payments (So the frontend can be update without having to refresh the page & to prevent making another request to get them)
    const payments = await this.PaymentModel.find().sort({
      createdAt: -1,
    });

    // Fetch updated booking
    const updatedBooking = await BookingModel.findOne({
      bookingReference: bookingExists?.bookingReference,
    })
      .populate("booking")
      .populate("bookingCurrency")
      .populate("assignedCar")
      .populate("assignedDriver")
      .populate("assignedVendor")
      .populate("vendorAssignedDriver")
      .populate("user")
      .populate("paymentId")
      .populate("driverJobWasSentTo")
      .populate("vendorJobWasSentTo")
      .populate("user");

    // Send email to admin
    const adminBookingDetails = await generateUserBookingDetails(
      updatedBooking
    );

    // To-do: Change email here
    dynamicTemplateData = {
      bookingReference: bookingExists?.bookingReference,
      bookingDetails: adminBookingDetails,
    };

    const adminEmailTemplateId = "d-f632548a96794cb1bd8fe2433241a745";

    msg = {
      to: "booking@shuttlelane.com",
      from: "info@shuttlelane.com",
      subject: "🔔 New Booking Notification",
      templateId: adminEmailTemplateId,
      dynamicTemplateData,
    };

    await sendSGDynamicEmail(msg);

    return {
      status: 201,
      message: `Payment successful!`,
      booking: updatedBooking,
    };
  }

  // This service fetches all payments
  async getPayments() {
    const payments = await this.PaymentModel.find({})
      .populate("booking")
      .populate("currency")
      .sort({ createdAt: -1 });
    // Return a response
    return {
      status: 200,
      message: `All payments fetched`,
      payments: payments,
    };
  }

  // This service fetches a payment
  async getPayment(paymentId) {
    // Validate if fields are empty
    const areFieldsEmpty = validateFields([paymentId]);

    // areFieldsEmpty is an object that contains a status and message field
    if (areFieldsEmpty) return areFieldsEmpty;

    const payment = await this.PaymentModel.findOne({
      _id: paymentId,
    })
      .populate("booking")
      .populate("currency");

    // Return a response
    return {
      status: 200,
      message: `Payment fetched`,
      payment: payment,
    };
  }

  // This service handles creating a Stripe payment intent
  async createStripePaymentIntent(products, bookingRef) {
    const booking = await BookingModel.findOne({
      bookingReference: bookingRef,
    }).populate("bookingCurrency");

    console.log("BOOKING REF:", bookingRef);
    console.log("BOOKING:", booking);

    console.log("PRODUCTS:", products);

    const lineItems = products?.map((product) => ({
      price_data: {
        currency: booking?.bookingCurrency?.alias?.toLowerCase(),
        product_data: {
          name: product?.name,
          images: [product?.image],
        },
        unit_amount: Math.round(product?.price * 100),
      },
      quantity: product?.quantity,
    }));

    // Create checkout session with Stripe
    const session = await stripeInstance.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `https://www.shuttlelane.com/booking/payment-status?bid=${booking?._id}&status=success&ch=Stripe`,
      cancel_url: `https://www.shuttlelane.com/booking/payment-status?bid=${booking?._id}&status=failed&ch=Stripe`,
    });

    console.log("SESSION:", session);

    return {
      id: session?.id,
      url: session.url,
    };
  }
}
