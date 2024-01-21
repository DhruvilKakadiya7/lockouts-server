import userModel from '../models/userSchema.js';
import duelModel from '../models/duelSchema.js';
import { ObjectId } from "mongodb";

class DuelManager {
    static async isValidDuelRequest(
        problemCount,
        ratingMin,
        ratingMax,
        timeLimit,
    ) {
        let validProblemCount =
            problemCount && problemCount >= 1 && problemCount <= 10;
        if (!validProblemCount) {
            return [false, "Invalid Problem Count"];
        }
        let validRatings =
            ratingMin &&
            ratingMax &&
            ratingMin <= ratingMax &&
            ratingMin >= 800 &&
            ratingMax <= 3500;
        if (!validRatings) {
            return [false, "Invalid Ratings"];
        }
        let validTimeLimit = timeLimit && timeLimit >= 5 && timeLimit <= 180;
        if (!validTimeLimit) {
            return [false, "Invalid Time Limit"];
        }
        return [true];
    }

    static async getDuelById(id) {
        try {
            const duel = await duelModel.findById(id);
            if (duel) {
                return duel;
            }
        } catch (e) {
            console.log(
                "Error: invalid findDuel() request... Probably an invalid id."
            );
        }
        return null;
    }

    static async isValidJoinRequest(duel, username, uid) {
        try {
            if (duel.players.length === 2) {
                return [false, "Duel Full"];
            }
            if (duel.players[0].uid === uid) {
                return [false, "You are not a valid user."];
            }
            const user = await userModel.findOne({ uid: uid });
            let result = [];
            if (user) {
                const duel2 = await duelModel.findById(user.currentDuelId);
                if (duel2.status === "WAITING" || duel2.status === "ONGOING" || duel2.status === "INITIALIZED") {
                    return [false, "Already in a duel."];
                }
                else {
                    await userModel.findOneAndUpdate({ uid: uid }, {
                        $set: { currentDuelId: duel._id.toString(), handle: username },
                    });
                    return [true];
                }
            }
            else {
                const newUser = new userModel({ handle: username, uid: uid, currentDuelId: duel._id.toString() });
                // console.log(newUser);
                await newUser.save();
            }
            return [true];
        } catch (e) {
            console.log(e);
            return [false]
        }
    }

    static async addDuelPlayer(id, username, uid) {
        await duelModel.findOneAndUpdate(
            {
                _id: id,
            },
            {
                $push: {
                    players: {
                        handle: username,
                        uid: uid,
                    },
                },
            }
        );

    }

    static async changeDuelState(id, newState) {
        console.log("Duel " + id + " State Changed to " + newState);
        await duelModel.findOneAndUpdate(
            {
                _id: id,
            },
            {
                $set: {
                    status: newState,
                },
            }
        );

    }

    static async ReadynessChange(id, uid) {
        let duel = await duelModel.findById(id);
        await duelModel.findOneAndUpdate({ _id: id }, {
            $set: {
                playerReady: [
                    duel.players[0].uid === uid ? true : duel.playerReady[0],
                    duel.players[1].uid === uid ? true : duel.playerReady[1],
                ],
            },
        });
        duel.playerReady = [
            duel.players[0].uid === uid ? true : duel.playerReady[0],
            duel.players[1].uid === uid ? true : duel.playerReady[1],
        ];
        let count = (duel.playerReady[0] ? 1 : 0) + (duel.playerReady[1] ? 1 : 0);
        return count;
    }

    static async unReadynessChange(id, uid) {
        let duel = await duelModel.findById(id);
        await duelModel.findOneAndUpdate({ _id: id }, {
            $set: {
                playerReady: [
                    duel.players[0].uid === uid ? false : duel.playerReady[0],
                    duel.players[1].uid === uid ? false : duel.playerReady[1],
                ],
            },
        });
    }

    static async finishDuel(id) {
        // await this.changeDuelState(id, "FINISHED");
        // await this.checkProblemSolves(id);
        // let winner = await this.findWinner(id);.
        const duel = await duelModel.findById(id);
        let result = [];
        let playerOneScore = duel.playerOneScore;
        let playerTwoScore = duel.playerTwoScore;
        let res = (playerOneScore > playerTwoScore ? "WON" : (playerOneScore < playerTwoScore ? "WON" : "TIE"));
        result.push(res);
        if(playerOneScore > playerTwoScore) {
            result.push(duel.players[0].handle);
        }
        else {
            result.push(duel.players[1].handle);
        }
        await duelModel.updateOne(
            {
                _id: duel._id,
            },
            {
                $set: {
                    status: "FINISHED",
                    result: result
                },
            }
        );
    }

    static async changeResult(id, uid, status) {
        let duel = await duelModel.findById(id);
        let val;
        if (duel.players[0]?.uid === uid) {
            val = duel.players[1]?.handle;
        }
        else {
            val = duel.players[0]?.handle;
        }
        await duelModel.findOneAndUpdate(
            {
                _id: id,
            },
            {
                $set: {
                    result: [status, val],
                    status: status
                },
            }
        );
    }

    static async setProblemPoints(uid, duelId, problemId) {
        try {
            const duel = await duelModel.findById(duelId);
            if (duel.players[0].uid == uid) {
                const problem = duel.problems[problemId];
                if (problem.playerOneScore === 0) {
                    const currTime = new Date();
                    const timeDiff = Math.floor((currTime - duel.startTime) / (1000 * 60));
                    let score = problem.difficulty - (50 * problem.playerOneAttempts) - Math.floor(timeDiff);
                    problem.playerOneScore = Math.max(0, score);
                    await duelModel.updateOne(
                        { _id: duel._id },
                        {
                            $set: {
                                [`problems.${problemId}`]: problem,
                                playerOneScore: duel.playerOneScore + score,
                                playerOneSolveCount: duel.playerOneSolveCount + 1,
                            }
                        }
                    );
                }
                return true;
            }
            else if (duel.players[1].uid == uid) {
                const problem = duel.problems[problemId];
                if (problem.playerTwoScore === 0) {
                    const currTime = new Date();
                    const timeDiff = Math.floor((currTime - duel.startTime) / (1000 * 60));
                    let score = problem.difficulty - (50 * problem.playerTwoAttempts) - Math.floor(timeDiff);
                    problem.playerTwoScore = Math.max(0, score);
                    // duel.playerTwoScore += score;
                    await duelModel.updateOne(
                        { _id: duel._id },
                        {
                            $set: {
                                [`problems.${problemId}`]: problem,
                                playerTwoScore: duel.playerTwoScore + score,
                                playerTwoSolveCount: duel.playerTwoSolveCount + 1,
                            }
                        }
                    );
                }
                return true;
            }
            return false;
        }
        catch (e) {
            console.log(e);
            return false;
        }
    }

    static async setPenalty(uid, duelId, problemId) {
        try {
            const duel = await duelModel.findById(duelId);
            if (duel.players[0].uid == uid) {
                const problem = duel.problems[problemId];
                if (problem.playerOneScore === 0) {
                    problem.playerOneAttempts += 1;
                    await duelModel.updateOne(
                        { _id: duel._id },
                        {
                            $set: {
                                [`problems.${problemId}`]: problem
                            }
                        }
                    );
                }
                return true;
            }
            else if (duel.players[1].uid == uid){
                const problem = duel.problems[problemId];
                if (problem.playerTwoScore === 0) {
                    problem.playerTwoAttempts += 1;
                    await duelModel.updateOne(
                        { _id: duel._id },
                        {
                            $set: {
                                [`problems.${problemId}`]: problem
                            }
                        }
                    );
                }
                return true;
            }
            return false;
        }
        catch (e) {
            console.log(e);
            return false;
        }
    }
}

export default DuelManager;