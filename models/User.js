import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    "contact": { type: String, required: true },
    "userName": { type: String, default: "newuser" },
    "chats": [{
        "chatWith": { type: String, required: true },
        "messages": [{
            type: mongoose.Types.ObjectId, ref: "Message"
        }]
    }]
})

export default mongoose.model("User", userSchema) 