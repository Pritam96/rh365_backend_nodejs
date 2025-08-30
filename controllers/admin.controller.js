import ErrorResponse from "../utils/errorResponse.js";
import User from "../models/user.model.js";

export const createUser = async (req, res, next) => {
  try {
    const { email, role = "hr", password, name, phone, designation } = req.body;

    if (!email || !role || !password) {
      return next(
        new ErrorResponse("Please provide an email, role and password", 400)
      );
    }

    // validate role
    if (!["admin", "hr"].includes(role.toLowerCase())) {
      return next(
        new ErrorResponse("Please provide an valid role: admin, hr", 400)
      );
    }

    // validate email address
    if (email && email.trim()) {
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email.trim())) {
        return next(
          new ErrorResponse("Please provide a valid email address", 400)
        );
      }
    }

    // validate phone number
    if (phone && phone.trim()) {
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(phone.trim())) {
        return next(
          new ErrorResponse("Please provide a valid mobile number", 400)
        );
      }
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return next(
        new ErrorResponse("Email is already exists. Please try login", 409)
      );
    }

    const userData = {
      email: email.trim().toLowerCase(),
      role: role.toLowerCase(),
      password,
    };

    if (name) userData.name = name.trim();
    if (phone) userData.phone = phone.trim();
    if (designation) userData.designation = designation;

    // create user
    const createdUser = await User.create(userData);

    res.status(201).json({
      success: true,
      data: createdUser,
    });
  } catch (error) {
    next(error);
  }
};
