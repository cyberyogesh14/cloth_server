import mongoose from "mongoose";

const verificationSchema = new mongoose.Schema(
    {
        otp_hash: { type: String, },

        otp_expires_at: { type: Date, },

        otp_attempts: { type: Number, default: 0, min: 0, },

        // Number of times the account has been locked
        lock_count: { type: Number, default: 0, min: 0, },

        // Account/OTP is locked until this time
        locked_until: { type: Date, },

        is_verified: { type: Boolean, default: false, },

        otp_verified_at: { type: Date, },

        // Prevent OTP resend abuse
        last_otp_sent_at: { type: Date, },

        otp_resend_count: { type: Number, default: 0, },
    },
    { _id: false }
);

const userSchema = new mongoose.Schema(
    {
        profile_img: { type: String, default: null, },

        first_name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50, },

        last_name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50, },

        role: { type: String, enum: ["user", "admin"], default: "user", required: true, },

        gender: { type: String, enum: ["male", "female", "other"], required: true, },

        email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true, },

        address_list: [{ type: Array, ref: "Address", },],

        is_address_list: { type: Boolean, default: false, },

                // Store hashed password, never plaintext
        password: { type: String, required: true, minlength: 8, },

        verification: {
            user: { type: verificationSchema, default: () => ({}), },

            admin: { type: verificationSchema, default: () => ({}), },
        },

        // Login security
        login_security: {
            failed_attempts: { type: Number, default: 0, min: 0, },

            lock_count: { type: Number, default: 0, min: 0, },

            locked_until: { type: Date, },

            last_failed_login: { type: Date, },

            last_login: { type: Date, },
        },

        is_active: { type: Boolean, default: true, },

        is_deleted: { type: Boolean, default: false, },

        

        order_list: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order", },],

        cart_list: [{ type: mongoose.Schema.Types.ObjectId, ref: "Cart", },],
    },
    {
        timestamps: true,
    }
);

const User = mongoose.model("User", userSchema);

export default User;