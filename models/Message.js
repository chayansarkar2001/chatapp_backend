import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    "sender": { type: String, required: true },
    "reciver": { type: String, required: true },
    "contend": { type: String, default: "" }
})

export default mongoose.model("Message", messageSchema)