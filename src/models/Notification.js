import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String },
    location: { type: String },
    location_id: { type: Number },
    location_title: { type: String },

    sub_location: { type: String },
    sub_location_id: { type: Number },
    sub_location_title: { type: String },

    is_opened: { type: Boolean, default: false },

    created_for_user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    created_by_user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
