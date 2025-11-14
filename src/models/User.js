import mongoose from 'mongoose'

export const UserRole = {
    ADMIN: 1,
    SUPPORT: 2,
    USER: 3,
}

const userSchema = new mongoose.Schema(
    {
        firstname: { type: String, required: true },
        lastname: { type: String, required: true },
        username: { type: String },
        email: { type: String, required: true, unique: true },
        phone: { type: String, required: true, unique: true },
        password: { type: String },

        role: {
            type: Number,
            enum: Object.values(UserRole),
            default: UserRole.USER,
        },

        birth_date: { type: Date },
        avatar: { type: String },

        // RELATIONS
        kyc_user_request: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'KYCUserRequest',
        },

        notifications: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Notification',
            },
        ],
    },
    { timestamps: true }
)

// INSTANCE METHOD
userSchema.methods.initializeKYCRequest = async function () {
    if (this.kyc_user_request) return

    const KYCUserRequest = mongoose.model('KYCUserRequest')

    const request = await KYCUserRequest.create({
        user: this._id,
    })

    await request.initializeKYCSteps()

    this.kyc_user_request = request._id
    await this.save()
}

export default mongoose.model('User', userSchema)
