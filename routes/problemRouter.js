import express from 'express';
import duelModel from '../models/duelSchema.js';
import userModel from '../models/userSchema.js';
import DuelManager from '../utils/duelManager.js';
import taskManager from '../utils/taskManager.js';
import problemModel from '../models/problemSchema.js'
const problemRouter = express.Router();

problemRouter.get('/getProblem/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const problem = await problemModel.findById(id);
        // console.log(problem);
        res.json({problem: problem});
    }   
    catch (e) {
        res.status(400).json({message: e.message});
    }
});

export default problemRouter;