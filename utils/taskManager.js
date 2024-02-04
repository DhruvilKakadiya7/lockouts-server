import problemIdSchema from '../models/problemIdSchema.js'
import { LRUCache } from 'lru-cache';

const options = {

    // how long to live in ms
    ttl: 1000 * 60 * 1000,
    max: 5000000,

    // for use with tracking overall storage size
    maxSize: 50000000,
    sizeCalculation: (value, key) => {
        return 1
    },
}

const cache = new LRUCache(options)
class taskManager {
    static async activeLRU() {
        const cacheKey = 'problems';
        // console.log(cacheKey);
        let cachedProblems = cache.get(cacheKey);
        // console.log(cachedProblems?.length);
        if (cachedProblems) {

        }
        else {
            const allProblems = await problemIdSchema.find({});
            // console.log(allProblems.length);
            cache.set(cacheKey, allProblems);
            cachedProblems = allProblems;
        }
    }
    static async selectProblems(allProblems, selectedDiffs, problemCount) {
        let result = [];
        for (let i = 0; i < selectedDiffs.length; i++) {
            const problems = allProblems.filter(
                (problem) => problem.difficulty === selectedDiffs[i]
            );
            let idx = Math.abs(Math.floor(Math.random() * (problems.length - 1)));
            let temp = problems[idx];
            temp['difficulty'] = selectedDiffs[i] + (250 * i);
            // console.log(temp);
            result.push(temp);
            if (result.length === problemCount) {
                break;
            }
        }
        return result;
    }

    static async getProblems(duel) {
        const cacheKey = 'problems';
        // console.log(cacheKey);
        let cachedProblems = cache.get(cacheKey);
        // console.log(cachedProblems?.length);
        if (cachedProblems) {

        }
        else {
            const allProblems = await problemIdSchema.find({});
            // console.log(allProblems.length);
            cache.set(cacheKey, allProblems);
            cachedProblems = allProblems;
        }
        // console.log(cachedProblems.length);
        let low = duel.ratingMin;
        let high = duel.ratingMax;
        let difficulties = [];
        for (let i = low; i <= high; i += 100) {
            difficulties.push(i);
        }
        let diff = Math.floor(difficulties.length / duel.problemCount);
        let currIdx = 0;
        let selectedDiffs = [];
        console.log(diff);
        if (diff === 0) {
            for (let i = 0; i < duel.problemCount; i++) {
                const randomIndex = Math.floor(Math.random() * (difficulties.length - 1));
                selectedDiffs.push(difficulties[randomIndex]);
            }
            selectedDiffs.sort();
        }
        else {
            for (let i = 0; i < duel.problemCount; i++) {
                let endIdx = currIdx + diff - 1;
                console.log(currIdx, endIdx);
                if (i == duel.problemCount - 1) {
                    endIdx = difficulties.length - 1;
                }
                let temp = [];
                for (let j = currIdx; j <= endIdx; j++) {
                    temp.push(difficulties[j]);
                }
                const randomIndex = Math.floor(Math.random() * (temp.length - 1));
                selectedDiffs.push(temp[randomIndex]);
                currIdx = endIdx + 1;
            }
        }

        console.log(selectedDiffs);
        return this.selectProblems(cachedProblems, selectedDiffs, duel.problemCount);
    }
}

export default taskManager