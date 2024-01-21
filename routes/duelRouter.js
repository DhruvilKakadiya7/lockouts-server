import express from 'express';
import duelModel from '../models/duelSchema.js';
import userModel from '../models/userSchema.js';
import DuelManager from '../utils/duelManager.js';
import taskManager from '../utils/taskManager.js';
const duelsRouter = express.Router();

duelsRouter.get('/', async (req, res) => {
	try {
		const duels = await duelModel.find();
		res.json({duels: duels});
	} catch (e) {
		res.status(500).json({ message: e.message });
	}
});

duelsRouter.get('/getById/:id', getDuel, (req, res) => {
	res.json({ duel: res.duel });
})

// POST one duel
duelsRouter.post("/add", async (req, res) => {
	console.log(req.body.players[0].handle)
	const duel = new duelModel(req.body);
	let validDuel = await DuelManager.isValidDuelRequest(
		req.body.problemCount,
		req.body.ratingMin,
		req.body.ratingMax,
		req.body.timeLimit
	);
	try {
		if (validDuel[0]) {
			const problems = await taskManager.getProblems(duel);
            duel.problems = problems;
			const newDuel = await duel.save();
			const duelId = newDuel._id.toString();
			req.body.players[0]['currentDuelId'] = duelId;
			const users = await userModel.find({ uid: req.body.players[0].uid });
			res.json(newDuel);
			if (users.length > 0) {
				await userModel.findOneAndUpdate(
					{ uid: req.body.players[0].uid },
					{
						$set: {
							handle: req.body.players[0].handle,
							currentDuelId: duelId
						}
					}
				);
			}
			else {
				await userModel.insertMany([req.body.players[0]]);
			}
		} else {
			res.status(400).json({ message: validDuel[1] });
		}
	} catch (err) {
		res.status(400).json({ message: err.message });
	}
});

duelsRouter.get('/checkUserInDuel/:uid', async (req, res) => {
	const uid = req.params.uid;
	try {
		const users = await userModel.find({ uid: uid });
		if (users.length === 0) {
			res.json({
				inDuel: false
			});
		}
		else {
			const duel = await duelModel.findById(users[0].currentDuelId);
			if (duel.status === "WAITING" || duel.status === "ONGOING" || duel.status === "INITIALIZED") {
				res.json({ inDuel: true, url: duel._id.toString(), message: 'Already in a duel...' });
			}
			else {
				res.json({ inDuel: false, url: undefined });
			}
		}
	} catch (e) {
		res.status(400).json({ message: e.message });
	}
})

duelsRouter.get('/activeLRU', async (req, res)=>{
	res.json('start activation.')
	await taskManager.activeLRU();
})

async function getDuel(req, res, next) {
	let duel;
	try {
		duel = await duelModel.findById(req.params.id);
		// Check for error and immediately return to avoid setting res.subscriber
		if (duel == null)
			return res.status(404).json({ message: "Duel not found." });
	} catch (err) {
		// Immediately return in case of error to avoid setting res.subscriber
		return res.status(500).json({ message: err.message });
	}

	res.duel = duel;
	next();
}

duelsRouter.delete("/", async (req, res) => {
	try {
		await duelModel.deleteMany();
		await userModel.deleteMany();
		res.json({ message: "All duels and Users deleted." });
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

export default duelsRouter;