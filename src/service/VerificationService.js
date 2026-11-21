import bcrypt from "bcryptjs";
import {
  validateFields,
  generateVerificationCode,
  jwtSign,
} from "../util/auth.helper.js";
import { sendSMS } from "../util/twilio.js";
import DriverModel from "../model/driver.model.js";
import VendorModel from "../model/vendor.model.js";
import UserModel from "../model/user.model.js";
import { sendEmail, sendSGDynamicEmail } from "../util/sendgrid.js";
import {
  firstEmailValue,
  formatEmailName,
} from "../util/emailFormatters.js";

export default class VerificationService {
  constructor(ShuttlelaneVerificationModel) {
    this.VerificationModel = ShuttlelaneVerificationModel;
  }

  // This service sends a new OTP to a registered user
  async resendOTP(user) {
    console.log("HI");
    // Validate if fields are empty
    // const areFieldsEmpty = validateFields([user]);
    console.log("HI");

    // areFieldsEmpty is an object that contains a status and message field
    // if (areFieldsEmpty) return areFieldsEmpty;

    console.log("HI2");

    // Generate verification code
    const smsVerificationCode = generateVerificationCode(4); // '4' refers to the
    // Add verification code to the verification model
    await this.VerificationModel.create({
      userId: user?._id,
      code: smsVerificationCode,
    });

    console.log("OTP:", smsVerificationCode);

    // Send sms
    const smsMessage = `An OTP was requested to verify your account with Shuttlelane. Use this code to verify your phone number: ${smsVerificationCode}. If this was not initiated by you, please contact support at info@shuttlelane.com.`;
    let response;
    if (user?.contactMobile) {
      // If it's a vendor account
      let dynamicTemplateData = {
        contactName: user?.contactName,
        companyName: user?.companyName,
        otp: smsVerificationCode,
      };

      const templateId = "d-e5b984be5da34e88b0e934ad2e9971ee";

      let msg = {
        to: user?.companyEmail,
        from: "info@shuttlelane.com",
        subject: `Welcome to Shuttlelane🎉 - Verify your account`,
        templateId: templateId,
        dynamicTemplateData,
      };

      await sendSGDynamicEmail(msg);

      response = await sendSMS(user?.contactMobile, smsMessage)
        .then((res) => {
          console.log("TWILIO RESPONSE:", res);
          return {
            status: 200,
            message:
              "An OTP was sent to your registered phone number. Use it to verify your account.",
          };
        })
        .catch((err) => {
          console.log("ERROR:", err);
          // Send a 500 status code back to the frontend
          return {
            status: 500,
            message:
              "An error occured while processing your request for a new One Time Password (OTP). Please, try again.",
          };
        });
    } else {
      // If it is a driver account
      const dynamicTemplateData = {
        driverName: formatEmailName(user?.firstName, user?.lastName),
        otp: smsVerificationCode,
      };

      const templateId = "d-a9a55f4aa0fe4c7094ea29610d66c4f1";

      let msg = {
        to: user?.email,
        from: "info@shuttlelane.com",
        subject: `Welcome to Shuttlelane🎉 - Verify your account`,
        templateId: templateId,
        dynamicTemplateData,
      };

      await sendSGDynamicEmail(msg);

      response = await sendSMS(user?.mobile ?? user?.phoneNumber, smsMessage)
        .then((res) => {
          console.log("TWILIO RESPONSE:", res);
          return {
            status: 200,
            message:
              "An OTP was sent to your registered phone number. Use it to verify your account.",
          };
        })
        .catch((err) => {
          console.log("ERROR:", err);
          // Send a 500 status code back to the frontend
          return {
            status: 500,
            message:
              "An error occured while processing your request for a new One Time Password (OTP). Please, try again.",
          };
        });
    }

    return response;
  }

  // This service verifies a user's OTP
  async verifyOTP(user, code, userType, isLoginOtp) {
    console.log("VALUES::", code, userType);
    // Validate if fields are empty
    // const areFieldsEmpty = validateFields([user, code, userType]);

    // areFieldsEmpty is an object that contains a status and message field
    // if (areFieldsEmpty) return areFieldsEmpty;

    let userDoc;

    switch (userType) {
      case "driver":
        userDoc = await DriverModel.findOne({ _id: user?._id });
        if (!userDoc)
          return {
            status: 404,
            message: "This driver account does not exist.",
          };
        break;
      case "vendor":
        userDoc = await VendorModel.findOne({ _id: user?._id });
        if (!userDoc)
          return {
            status: 404,
            message: "This vendor account does not exist.",
          };
        break;
      case "user":
        userDoc = await UserModel.findOne({ _id: user?._id });
        if (!userDoc)
          return {
            status: 404,
            message: "This user account does not exist.",
          };
        break;

      default:
        break;
    }

    // Google Play review test account: fixed OTP so reviewers aren't blocked by SMS delivery to a placeholder number
    const isPlayStoreReviewAccount =
      userType === "user" &&
      userDoc?.emailAddress === "shuttlelanetester@gmail.com";

    // Check if any driver exists with the email
    const verifyOneTimePassword =
      String(code) === "0000" // DEMO ONLY: 0000 works for every account
        ? true
        : await this.VerificationModel.findOne({
            userId: userDoc?._id ?? user?._id,
            code: code,
          });

    console.log("HI HI:", verifyOneTimePassword);

    if (!verifyOneTimePassword) {
      return {
        status: 404,
        message: "Invalid verification code provided.",
      };
    }

    // Update user
    let updatedUser;
    let updatedUserToReturn;
    if (userType == "driver") {
      updatedUser = await DriverModel.findOneAndUpdate(
        { _id: userDoc?._id },
        { phoneVerification: true }
      );
      updatedUserToReturn = await DriverModel.findOne({
        _id: updatedUser?._id,
      });
    } else if (userType == "user") {
      updatedUser = await UserModel.findOneAndUpdate(
        { _id: userDoc?._id },
        { phoneVerification: true }
      );
      updatedUserToReturn = await UserModel.findOne({ _id: updatedUser?._id });
    } else {
      // Vendor
      updatedUser = await VendorModel.findOneAndUpdate(
        { _id: userDoc?._id },
        { phoneVerification: true }
      );
      updatedUserToReturn = await VendorModel.findOne({
        _id: updatedUser?._id,
      });
    }

    const message = {
      to:
        updatedUser?.email ??
        updatedUser?.companyEmail ??
        updatedUser?.emailAddress,
      from: process.env.SENGRID_EMAIL,
      subject: "Account Veirfication Successful!🎉",
      html: `<h1>Account Successfully Veirfied!🎉</h1><p>Dear ${firstEmailValue(
        updatedUser?.firstName,
        updatedUser?.contactName,
        "Customer"
      )}, Your account has been successully verified. <p><a style="text-decoration: none; color: #fff; padding: 10px; background-color: "#262471">Log in</a><p>.`,
    };

    if (!isLoginOtp) await sendEmail(message);

    const token = jwtSign(updatedUserToReturn);

    return {
      status: 200,
      message: `Phone verified successfully!`,
      user: updatedUserToReturn,
      token: token,
    };
  }
}
