import mongoose from "mongoose";

export const ValueType = {
  PHOTO: 1,
  DATE: 2,
  TEXT: 3,
};

export const KYCStepStatus = {
  TO_FILL: 0,
  TO_VERIFY: 1,
  VALIDATED: 2,
  MISSING: 3,
  REJECTED: 4,
};

export const KYCIdentityStepType = {
  FACE_PHOTO: 1,
  BIRTH_DATE: 2,
  DRIVER_LICENSE: 3,
};

const kycStepSchema = new mongoose.Schema(
  {
    status: {
      type: Number,
      enum: Object.values(KYCStepStatus),
      default: KYCStepStatus.TO_FILL,
    },

    value: [
      {
        name: String,
        value: String,
        type: { type: Number, enum: Object.values(ValueType) },
      },
    ],

    comment: { type: String },
    submitted_at: { type: Date },
    reviewed_at: { type: Date },

    type: {
      type: Number,
      enum: Object.values(KYCIdentityStepType),
      required: true,
    },

    kyc_user_request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KYCUserRequest",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("KYCIdentityStep", kycStepSchema);
