import express from "express";
import cors from "cors"
import http from 'http'
import { Server } from 'socket.io';
import mongoose from "mongoose";
import Message from "./models/Message.js";
import User from "./models/User.js";


const app = express();

app.use(cors())

const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: "*"
    },
})

const ALL_USERS = {}

const CHATS = {}

app.get("/api", (req, res) => {
    res.json({ msg: "server is running successfully" })
})

app.get("/api/status", (req, res) => {
    const { ps } = req.query
    if (!ps) {
        res.json({ result: "password has not provided" })
        return
    }
    if (ps != process.env.PASSWORD) {
        res.json({ result: "password has not matched" })
        return
    }
    res.json({ "status": "current status of backend", ALL_USERS, CHATS })
})

app.get("/api/showallusers", async (req, res) => {
    const { ps } = req.query
    if (!ps) {
        res.json({ result: "password has not provided" })
        return
    }
    if (ps != process.env.PASSWORD) {
        res.json({ result: "password has not matched" })
        return
    }
    const result = await User.find()
    res.json({ "show all users result": result })
})

app.get("/api/showallmessages", async (req, res) => {
    const { ps } = req.query
    if (!ps) {
        res.json({ result: "password has not provided" })
        return
    }
    if (ps != process.env.PASSWORD) {
        res.json({ result: "password has not matched" })
        return
    }
    const result = await Message.find()
    res.json({ "show all messages result": result })
})

app.get("/api/deleteallusers", async (req, res) => {
    const { ps } = req.query
    if (!ps) {
        res.json({ result: "password has not provided" })
        return
    }
    if (ps != process.env.PASSWORD) {
        res.json({ result: "password has not matched" })
        return
    }
    const result = await User.deleteMany()
    res.json({ "delete user result": result })
})
app.get("/api/deleteallmessages", async (req, res) => {
    const { ps } = req.query
    if (!ps) {
        res.json({ result: "password has not provided" })
        return
    }
    if (ps != process.env.PASSWORD) {
        res.json({ result: "password has not matched" })
        return
    }
    const result = await Message.deleteMany()
    res.json({ "delete all messages result": result })
})



io.on('connection', (socket) => {

    const handleJoin = async ({ userDetails }) => {
        console.log("join")
        const { contact, userName } = userDetails
        try {
            const user = await User.findOne({ contact: contact })
            if (!user) {
                const newuser = new User({ contact, userName })
                let res = await newuser.save()
                console.log("new user create:", res)
            }
        } catch (e) {
            // when for server crash ALL_USERS BECOME EMPTY
            let allusers = []
            allusers = await User.find().select("userName contact")
            if (allusers) {
                allusers.forEach((u) => {
                    ALL_USERS[u.contact] = { userName: u.userName, socketId: null }
                })
            }
            console.log("error to create user:", contact, e)
        }
        ALL_USERS[contact] = { "userName": userName, "socketId": socket.id }
        io.emit("join", { "newUserList": ALL_USERS })
    }

    const handleMsgRequest = async ({ contact, chatWith }) => {
        let chat
        try {
            const user = await User.findOne({ contact }).select("chats").populate({ path: "chats.messages", model: "Message" })
            if (!user) { throw new Error(`user not found:${contact}`) }
            chat = user.chats.find((chat) => chat.chatWith == chatWith)

        } catch (e) {
            console.log(`user not found:${contact}`)
        } finally {
            io.to(ALL_USERS[contact].socketId).emit("msg:fetchMsg", { "chat": (chat ? chat.messages : []), "chatWith": chatWith })
        }

    }

    const handleSendTo = async ({ sendTo, msg, contact }) => {
        if (!(contact in CHATS)) {
            CHATS[contact] = {}
        }
        if (!(sendTo in CHATS[contact])) {
            CHATS[contact][sendTo] = []
        }
        CHATS[contact][sendTo].push(msg)

        if (ALL_USERS[sendTo].socketId == null) return

        io.to(ALL_USERS[sendTo].socketId).emit("msg:reciveFrom",
            { "reciveFrom": contact, "msg": msg }
        )
    }

    const handleDisconnect = async () => {
        let contact = null
        for (let id in ALL_USERS) {
            if (ALL_USERS[id].socketId == socket.id) {
                contact = id
                break
            }
        }

        if (!contact) {
            return
        }

        ALL_USERS[contact].socketId = null

        const user = await User.findOne({ contact }).select("chats")
        if (!user) return

        for (let chatWith in CHATS[contact]) {

            let otheruser = await User.findOne({ "contact": chatWith }).select("chats")
            if (!otheruser) continue

            let msgIds = []
            try {
                const msgs = await Message.create(CHATS[contact][chatWith], { ordered: true, aggregateErrors: true })
                msgIds = msgs.map((msg) => msg._id)
            } catch (e) {
                console.log("Error to create messages",)
            }

            let chat = null
            chat = user.chats.find((chat) => chat.chatWith === chatWith)

            if (!chat) {
                user.chats.push({ "chatWith": chatWith, "messages": msgIds })
            } else {
                chat.messages.push(...msgIds)
            }

            chat = otheruser.chats.find((chat) => chat.chatWith === contact)
            if (!chat) {
                otheruser.chats.push({ "chatWith": contact, "messages": msgIds })
            } else {
                chat.messages.push(...msgIds)
            }
            await otheruser.save()
            CHATS[contact][chatWith] = []
        }
        await user.save()
    }

    // when a new user join, broadcast to all
    socket.on("join", handleJoin)

    // request for chats of a contact
    socket.on("msg:request", handleMsgRequest)

    // request to send msg to a user
    socket.on("msg:sendTo", handleSendTo)

    // disconnect
    socket.on("disconnect", handleDisconnect)
})



const PORT = process.env.PORT
const DB_URL = process.env.DB_URL
// const DB_URL = "mongodb://localhost:27017/chatapp"


mongoose.connect(DB_URL).then(() => {
    console.log("Atlas database is connected successfully")
    server.listen(PORT, () => {
        console.log(`Server is running successfully on port:${PORT}`)
    })
    server.on("error", () => {
        console.log("server has problem to run")
    })

}).catch((e) => {
    console.log("error has to connect database Atlas:", e)
})