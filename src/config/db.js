import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const db = process.env.MONGO_URI

const connectDB = async () => {
    try {
        await mongoose.connect(db, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            // useCreateIndex: true,
            // useFindAndModify: false,
        })
        console.log('MongoDB Connected...')
    } catch (err) {
        console.error(err)
        // Exit process with failure
        process.exit(1)
    }
}

export default connectDB
