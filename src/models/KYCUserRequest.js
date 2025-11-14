import mongoose from "mongoose";

export const KYCStatus = {
  TO_FILL: 0,
  TO_VERIFY: 1,
  VALIDATED: 2,
  MISSING: 3,
  RETURNED: 4,
  REJECTED: 5,
};

const kycRequestSchema = new mongoose.Schema(
  {
    status: {
      type: Number,
      enum: Object.values(KYCStatus),
      default: KYCStatus.TO_FILL,
    },

    comment: { type: String },
    submitted_at: { type: Date },
    reviewed_at: { type: Date },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    kyc_steps: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "KYCIdentityStep",
      },
    ],
  },
  { timestamps: true }
);

// INSTANCE METHOD
kycRequestSchema.methods.initializeKYCSteps = async function () {
  const KYCIdentityStep = mongoose.model("KYCIdentityStep");

  const requiredSteps = [1, 2, 3]; // FACE_PHOTO, BIRTH_DATE, DRIVER_LICENSE

  const existing = await KYCIdentityStep.find({
    kyc_user_request: this._id,
  }).select("type");

  const existingTypes = new Set(existing.map((s) => s.type));

  const missingSteps = requiredSteps.filter((t) => !existingTypes.has(t));

  if (missingSteps.length > 0) {
    const created = await KYCIdentityStep.insertMany(
      missingSteps.map((type) => ({
        kyc_user_request: this._id,
        type,
      }))
    );

    this.kyc_steps.push(...created.map((c) => c._id));
    await this.save();
  }
};

export default mongoose.model("KYCUserRequest", kycRequestSchema);
