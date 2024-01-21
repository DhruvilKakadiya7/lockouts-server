import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bodyParser from 'body-parser';
import { Server } from 'socket.io';
import duelsRouter from './routes/duelRouter.js';
import DuelManager from './utils/duelManager.js';
import duelModel from './models/duelSchema.js'
import e from 'express';
import { ObjectId } from "mongodb";
import problemRouter from './routes/problemRouter.js';
import mailRouter from './routes/mailRouter.js';
// import socket from '../client/src/socket.js';
import dotenv from 'dotenv';
dotenv.config();
const app = express();

const allowedOrigins = '*';

var corsOptions = {
    origin: allowedOrigins,
    optionsSuccessStatus: 200,
}

app.use(cors(corsOptions));
app.use(express.urlencoded({
    extended: true,
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true,
}));
app.use('/duels', duelsRouter);
app.use('/problems', problemRouter);
app.use('/mail', mailRouter);

const PORT = process.env.PORT || 5000;

// Connect DataBase
const DATABASE_URL = process.env.DATABASE_LINK;
mongoose.connect(DATABASE_URL);
const db = mongoose.connection;
db.on('error', (err) => console.log("Database err " + err));
db.once('open', async () => console.log("DataBase connection successful."));

// Sleeper function, pass time in ms it will delay the time by that ms.
export const sleep = (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

const server = app.listen(PORT, () => {
    console.log(`Server is started on port ${PORT}.`);
});

const io = new Server(
    server,
    cors({
        origin: allowedOrigins,
    })
);

async function getTimeLeft(
	startTime,
	maxTime,
	timeInterval,
	checkInterval,
	roomId,
	io
) {
	const curTime = new Date();
	let timeDifference = Math.abs(curTime.getTime() - startTime.getTime());
	if (timeDifference >= maxTime) {
		if (timeInterval) clearInterval(timeInterval);
		if (checkInterval) clearInterval(checkInterval);
		await DuelManager.finishDuel(roomId);
		io.emit("status-change", { roomId: roomId, newStatus: "FINISHED" });
		return "Time's up.";
	}
	return Math.ceil((maxTime - timeDifference) / 1000);
}



io.on('connection', (socket) => {
    console.log('socket connectedd', socket.id);

    socket.on('join', (roomId) => {
        console.log('Joining room: ', roomId);
        socket.join(roomId);
    });

    socket.on('join-duel', async ({
        roomId,
        username,
        guest,
        uid
    }) => {
        const duel = await DuelManager.getDuelById(roomId);
        if (duel) {
            if (duel.status === "WAITING") {
                console.log(username + " Wants to Join Duel " + roomId);
                let validateJoining = await DuelManager.isValidJoinRequest(duel, username, uid);
                console.log(validateJoining);
                if (validateJoining && validateJoining[0]) {
                    await DuelManager.addDuelPlayer(roomId, username, uid);
                    await DuelManager.changeDuelState(roomId, "INITIALIZED");
                    io.emit("status-change", {
                        roomId: roomId,
                        newStatus: "INITIALIZED",
                    });
                }
                else {
                    io.to(socket.id).emit("error-message", validateJoining);
                }
            }
        }
        else {
            io.to(socket.id).emit("error-message", 'Duel Not Found');
        }
    });

    socket.on('player-ready', async ({
        roomId,
        uid
    }) => {
        let count = await DuelManager.ReadynessChange(roomId, uid, true);
        io.emit("player-ready-changed", { roomId });
        console.log(count);
        if (count === 2) {
            await DuelManager.changeDuelState(roomId, "READY");
            socket.emit("status-change", {
                roomId: roomId,
                newStatus: "READY",
            });
        }
    });

    socket.on('player-unready', async ({
        roomId,
        uid
    }) => {
        await DuelManager.unReadynessChange(roomId, uid, true);
        io.emit("player-ready-changed", { roomId });
    })

    socket.on('start-duel', async({ roomId }) => {
        const duel = await DuelManager.getDuelById(roomId);
        if (duel.status === "READY") {
            let timeLimit = duel.timeLimit;
            const startTime = new Date();
            const maxTime = timeLimit * 60 * 1000;
            await duelModel.findOneAndUpdate(
                {
                    _id: new ObjectId(roomId),
                },
                {
                    $set: {
                        startTime: startTime,
                        status: "ONGOING",
                    }
                }
            );
			io.emit("status-change", { roomId: roomId, newStatus: "ONGOING" });
            io.emit("time-left", { roomId: roomId, timeLeft: 1 * 60 });
            let timeInterval;
			let checkInterval;

			checkInterval = setInterval(async () => {
				// await DuelManager.checkProblemSolves(roomId);
				let duel = await DuelManager.getDuelById(roomId);
			}, 3000);
			timeInterval = setInterval(async () => {
				let timeLeft = await getTimeLeft(
					startTime,
					maxTime, 
					timeInterval,
					checkInterval,
					roomId,
					io
				);
				io.emit("time-left", { roomId: roomId, timeLeft: timeLeft });
			}, 1000);
        }
    });

    socket.on("abort-duel", async ({ roomId, uid }) => {
        console.log("ABORT");
        await DuelManager.changeResult(roomId, uid, "ABORTED");
        io.emit("status-change", {
            roomId: roomId,
            newStatus: "ABORTED",
        });
    }); 

    socket.on("resign-duel", async ({ roomId, uid }) => {
        await DuelManager.changeResult(roomId, uid, "RESIGNED");
        io.emit("status-change", {
            roomId: roomId,
            newStatus: "RESIGNED",
        });
    });

    socket.on('submit-success', async({verdict, uid, duelId, problemId}) => {
        try{
            if(verdict.includes('Accepted')) {
                const res = await DuelManager.setProblemPoints(uid, duelId, problemId);
                if(res) {
                    io.emit('problem-accepted', {duelId, uid});
                    io.emit('problem-accepted-2', {duelId, uid});
                }
            }
            else {
                const res = await DuelManager.setPenalty(uid, duelId, problemId);
                if (res) {
                    io.emit('problem-not-accepted', {duelId, uid});
                }
            }
        }
        catch(e) {
            console.log(e);
            io.emit('problem-not-accepted', {duelId, roomId});
        }
    })

    socket.on('disconnecting', () => {
        console.log('socket disconnected', socket.id);
        socket.leave();
    });
})