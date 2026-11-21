// @ts-nocheck
import VerificationModel from "../model/verification.model.js";
import VerificationService from "../service/VerificationService.js";

// Generic messages
const internalServerError =
  "An error occured while we processed your request. Please try again.";

// SERVICE INSTANCES
// Create a new VerificationService instance
const verificationService = new VerificationService(VerificationModel);

// Resend OTP
export const resendOTP = async (req, res) => {
  const { user } = req.body;
  console.log("USER HERE:", req.body.user);
  try {
    console.log("HELLO FROM HERE");
    // Resend otp
    const response = await verificationService.resendOTP(user);

    console.log("resp::::::::::::::::", response);

    // Return a response
    return res.status(response?.status).json({
      status: response?.status,
      message: response?.message,
    });
  } catch (error) {
    console.log('ERROR FROM RESEND OTP:', error)
    return {
      status: 500,
      message:
        "An error occured while processing your request for a new One Time Password (OTP). Please, try again.",
    };
  }
};

// verify OTP
export const verifyOTP = async (req, res) => {
  const { user, code, userType, isLoginOtp } = req.body;
  console.log("REQ.BODY:", req.body);

  try {
    // Verify One Time Password
    const response = await verificationService.verifyOTP(
      user,
      code,
      userType,
      isLoginOtp
    );

    console.log("USER USER USER::::::::::::", response);

    // Return a response
    return res.status(response?.status).json({
      message: response?.message,
      status: response?.status,
      user: response?.user ?? null,
      token: response?.token ?? null,
    });
  } catch (error) {
    console.log("ERROR:", error);
    return res.status(500).json({ message: internalServerError });
  }
};
