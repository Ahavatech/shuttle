import UserModel from "../model/user.model.js";
import jsonwebtoken from "jsonwebtoken";
import routes from "../routes.js";
import bcrypt from "bcryptjs";
import DriverModel from "../model/driver.model.js";
import AdminModel from "../model/admin.model.js";
import VendorModel from "../model/vendor.model.js";
import VerificationModel from "../model/verification.model.js";
import config from "../config/index.js";
import { sendEmail } from "./sendgrid.js";
import ReactDOMServer from "react-dom/server";
import DriverResetPasswordEmailTemplate from "../emailTemplates/driverEmailTemplates/DriverResetPasswordEmail/index.js";
import VendorResetPasswordEmailTemplate from "../emailTemplates/vendorEmailTemplates/VendorResetPasswordEmail/index.js";
import ResetPasswordSuccessEmailTemplate from "../emailTemplates/reusable/PasswordResetSuccessful/index.js";
import { sendSMS } from "./twilio.js";
import { firstEmailValue } from "./emailFormatters.js";

const { sign, verify } = jsonwebtoken;

// This function validates input fields
export function validateFields(args) {
  let response = null;
  args.forEach((arg, i) => {
    console.log(`arg-${i}`, arg);
    if (!arg || (typeof arg === "string" && arg.trim() === "")) {
      response = {
        status: 404,
        message: "Please fill in the missing fields",
      };
    }
  });

  return response;
}

// This function generates a verification code
export function generateVerificationCode(digits) {
  const min = Math.pow(10, digits - 1); // Lower bound
  const max = Math.pow(10, digits) - 1; // Upper bound
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const jwtSign = (payload) => {
  const jwtToken = sign({ payload }, `${config.jwt.JWT_SECRET}`, {
    expiresIn: "24h",
  });
  return jwtToken;
};

export const jwtVerify = (token) => {
  try {
    return verify(token, `${config.jwt.JWT_SECRET}`);
  } catch (error) {
    return false;
  }
};

export const verifyJWT = (request, response) => {
  try {
    const authHeader = request.body.token;
    console.log("req.body token:", request.body.token);
    let result;
    if (authHeader) {
      result = jwtVerify(authHeader);
      if (!result) {
        response
          .status(403)
          .json({ message: "Invalid bearer token", status: 403 });
      } else {
        response
          .status(200)
          .json({ message: "Token still Valid", status: 200 });
      }
    } else {
      response.status(500).send("Token is required!");
    }
  } catch (error) {
    console.log(error);
    return response.status(500).json({
      error: error,
    });
  }
};

// Middleware
export const verifyUserToken = (request, response, next) => {
  try {
    const authHeader = request.headers.token;
    let result;
    if (authHeader) {
      const token = authHeader.split(" ")[1];

      result = jwtVerify(token);
      if (!result) {
        response.status(400).send("Invalid bearer token");
      } else {
        request.decoded = result;
        next();
      }
    } else {
      response.status(500).send("Token is required!");
    }
  } catch (error) {
    console.log(error);
    return response.status(500).json({
      error: error,
    });
  }
};

// This function validates the user log in OTP (deprecated)
export async function validateLoginOTP(otp, userType, userId) {
  try {
    const verifyOTP = await VerificationModel.findOne({ userId, code: otp });
    if (!verifyOTP) {
      return {
        status: 403,
        message: "Invalid OTP. Please provide a valid OTP.",
      };
    }

    let user = null;
    let token = null;

    switch (userType) {
      case "vendor":
        user = await VendorModel.findOne({ _id: userId });
        break;

      case "driver":
        user = await DriverModel.findOne({ _id: userId });
        break;

      default:
        break;
    }

    if (!user)
      return {
        status: 404,
        message: "We could not find an account with the associated id",
      };

    token = jwtSign(user);

    return {
      status: 200,
      token: token,
      user: user,
    };
  } catch (error) {
    console.log("AN ERROR OCCURED WHILE VERIFYING USER LOG IN OTP:", error);
  }
}

// This function validates the user OTP
export async function validateOTP(otp) {}

// This function validates a user's login details provided
export async function validateUserLoginDetails(email, password) {
  const userExists = await UserModel.findOne({ emailAddress: email }).populate({
    path: "bookings",
    options: {
      sort: {
        createdAt: -1,
      },
    },
  });

  console.log("USER EXISTS:", userExists);

  if (!userExists)
    return {
      message: "No account is associated with the email provided",
      status: 404,
    };

  const isPasswordCorrect = bcrypt.compareSync(password, userExists?.password);
  console.log("IS PASSWORD CORRECT:", isPasswordCorrect);

  if (!isPasswordCorrect)
    return {
      message: "Wrong password",
      status: 403,
    };

  // TO-DO: Send phone verification SMS here
  // Generate verification code
  const smsVerificationCode = generateVerificationCode(4); // '4' refers to the
  // Add verification code to the verification model
  const verificationRecord = await VerificationModel.create({
    userId: userExists?._id,
    code: smsVerificationCode,
  });
  // Update User document to include the verification
  const userVerification = await UserModel.findOneAndUpdate(
    { _id: userExists?._id },
    {
      phoneVerification: true,
    }
  );

  // Send sms
  const smsMessage = `A recent login activity was detected on your account. Use this code to verify your identity: ${smsVerificationCode}. Please, reach out to info@shuttlelane.com if this was not initiated by you.`;
  await sendSMS(userExists?.phoneNumber, smsMessage)
    .then((res) => console.log("SMS sent successfully!"))
    .catch((err) =>
      console.log(
        "An error occured while sending the verification SMS => ",
        err
      )
    );

  const token = await jwtSign(userExists);

  return {
    message: "An OTP was sent to your number. Use it to verify your identity.!",
    user: userExists,
    code: smsVerificationCode,
    token: token,
    status: 200,
  };
}

// This function validates a driver's login details provided
export async function validateDriverLoginDetails(email, password) {
  const driverExists = await DriverModel.findOne({ email }).populate(
    "phoneVerification"
  );
  console.log("DRIVER RETURNED:", driverExists?.phoneVerification);
  if (!driverExists)
    return {
      message: "Invalid email provided",
      status: 409,
    };

  const isPasswordCorrect = bcrypt.compareSync(
    password,
    driverExists?.password
  );

  if (!isPasswordCorrect)
    return {
      message: "Invalid email or password",
      status: 403,
    };

  return {
    message: "Almost there. Verify your access to this driver account.",
    driver: driverExists,
    status: 200,
  };
}

// This function validates an admin's login details provided
export async function validateAdminLoginDetails(username, password) {
  const adminExists = await AdminModel.findOne({ username });
  if (!adminExists)
    return {
      message: "Invalid username provided",
      status: 409,
    };

  console.log("ADMIN EXISTS:", adminExists);
  const isPasswordCorrect = bcrypt.compareSync(password, adminExists?.password);

  if (!isPasswordCorrect)
    return {
      message: "Invalid username or password",
      status: 403,
    };

  const token = jwtSign(adminExists);

  return {
    message: "Log in successful!",
    admin: adminExists,
    token: token,
    status: 200,
  };
}

// This function validates a vendor's login details provided
export async function validateVendorLoginDetails(email, password) {
  const vendorExists = await VendorModel.findOne({
    companyEmail: email,
  }).populate("operatingCities");
  if (!vendorExists)
    return {
      message: "Invalid email provided",
      status: 409,
    };

  const isPasswordCorrect = bcrypt.compareSync(
    password,
    vendorExists?.password
  );

  console.log("isPasswordCorrect:", isPasswordCorrect);

  if (!isPasswordCorrect)
    return {
      message: "Invalid email or password",
      status: 403,
    };

  return {
    message: "Almost there. Verify your access to this vendor account.",
    vendor: vendorExists,
    status: 200,
  };
}

export async function resetPassword(_id, oldPassword, newPassword, userType) {
  try {
    let user;
    switch (userType) {
      case "driver":
        user = await DriverModel.findById(_id);
        break;
      case "user":
        user = await UserModel.findById(_id);
        break;
      case "vendor":
        user = await VendorModel.findById(_id);
        break;
      default:
        break;
    }

    if (!user)
      return { status: 400, message: "No user exists with the id specified." };

    const isPasswordCorrect = bcrypt.compareSync(oldPassword, user?.password);
    if (!isPasswordCorrect)
      return {
        message:
          "You have provided a wrong password. Your password was not reset.",
        status: 403,
      };

    // TO-DO: Perform security measures
    // Do not allow more than 3 attempts on password change / block the account after 3 attempts

    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Hash the password
    user.password = hashedPassword;
    const updatedUserDoc = await user.save();

    // TO-DO: Send confirmation email here
    const message = {
      to: user?.email ?? user?.companyEmail ?? user?.emailAddress,
      from: process.env.SENGRID_EMAIL,
      subject: "Password Reset Successful",
      html: `<h1>Your password has been reset successfully!</h1><p>Dear ${firstEmailValue(
        user?.firstName,
        user?.contactName,
        "Customer"
      )}, Your password has just been reset. If this was not initiated by you, please reach out to info@shuttlelane.com immediately.`,
    };
    await sendEmail(message);

    return {
      status: 201,
      message: `Your password has been successfully reset. You'll be required to log in again.`,
      user: updatedUserDoc,
    };
  } catch (error) {
    return {
      status: 500,
      message:
        "An error occured while processing your request. Please, try again.",
    };
  }
}

export async function forgotPassword(email, userType) {
  try {
    let user;
    switch (userType) {
      case "driver":
        user = await DriverModel.findOne({ email: email });
        if (!user)
          return {
            status: 404,
            message:
              "No account exists with the email provided. Plase try again with a different email address.",
          };

        // TO-DO: Send confirmation email here
        const emailHTML = DriverResetPasswordEmailTemplate({
          driverId: user?._id,
        });

        const message = {
          to: user?.email,
          from: process.env.SENGRID_EMAIL,
          subject: "Password Reset",
          html: ReactDOMServer.renderToStaticMarkup(emailHTML),
        };

        sendEmail(message);
        break;
      case "user":
        user = await UserModel.findOne({ emailAddress: email });
        if (!user)
          return {
            status: 404,
            message:
              "No account exists with the email provided. Plase try again with a different email address.",
          };

        // TO-DO: Send confirmation email here
        //   const userEmailHTML = DriverResetPasswordEmailTemplate({
        //     driverId: user?._id,
        //   });

        //   const message = {
        //     to: user?.email,
        //     from: process.env.SENGRID_EMAIL,
        //     subject: "Password Reset",
        //     html: ReactDOMServer.renderToStaticMarkup(userEmailHTML),
        //   };

        //   sendEmail(message);
        break;
      case "vendor":
        user = await VendorModel.findOne({ companyEmail: email });
        if (!user)
          return {
            status: 404,
            message:
              "No account exists with the email provided. Plase try again with a different email address.",
          };

        // TO-DO: Send confirmation email here
        const vendorEmailHTML = VendorResetPasswordEmailTemplate({
          vendorId: user?._id,
        });

        const vendorMessage = {
          to: user?.companyEmail,
          from: process.env.SENGRID_EMAIL,
          subject: "Password Reset",
          html: ReactDOMServer.renderToStaticMarkup(vendorEmailHTML),
        };

        sendEmail(vendorMessage);
        break;
      default:
        break;
    }

    return {
      status: 200,
      message: `We will send a password reset link to the email provided if it is associated with an account on Shuttlelane.`,
    };
  } catch (error) {
    return {
      status: 500,
      message:
        "An error occured while processing your request. Please, try again.",
    };
  }
}

export async function resetForgottenPassword(_id, newPassword, userType) {
  try {
    let user;
    switch (userType) {
      case "driver":
        user = await DriverModel.findById(_id);
        break;
      case "user":
        user = await UserModel.findById(_id);
        break;
      case "vendor":
        user = await VendorModel.findById(_id);
        break;
      default:
        break;
    }

    console.log("user:", user);

    if (!user)
      return { status: 400, message: "No user exists with the id specified." };

    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Hash the password
    user.password = hashedPassword;
    const updatedUserDoc = await user.save();

    console.log("UPDATED USER DOC:", updatedUserDoc);

    // TO-DO: Send confirmation email here
    const emailHTML = ResetPasswordSuccessEmailTemplate(
      user?.email ?? user?.companyEmail ?? user?.emailAddress
    );

    const message = {
      to: user?.email ?? user?.companyEmail ?? user?.emailAddress,
      from: process.env.SENGRID_EMAIL,
      subject: "Password Successfully Reset",
      html: ReactDOMServer.renderToStaticMarkup(emailHTML),
    };

    sendEmail(message);

    return {
      status: 201,
      message: `Your password has been successfully reset.`,
      user: updatedUserDoc,
    };
  } catch (error) {
    console.log("ERROR FROM RESET FORGOT PASSWORD (DRIVER):", error);
    return {
      status: 500,
      message:
        "An error occured while processing your request. Please, try again.",
    };
  }
}
