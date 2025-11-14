import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(400).json({
        errors: ["api.form.errors.invalid_login"],
      });
    }

    // 2. Compare password
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(400).json({
        errors: ["api.form.errors.invalid_login"],
      });
    }

    // 3. Create JWT
    const token = jwt.sign(
      { user_id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      data: { token },
    });

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      errors: ["api.internal_error"],
    });
  }
};
