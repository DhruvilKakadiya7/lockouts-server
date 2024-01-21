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
    static async selectProblems(allProblems, difficulties, problemCount) {
        let result = [];
        for (let i = 0; i < difficulties.length; i++) {
            const problems = allProblems.filter(
                (problem) => problem.difficulty === difficulties[i]
            );
            let idx = Math.floor(Math.random() * (problems.length - 1));
            let temp = problems[idx];
            temp['difficulty'] = difficulties[i] + (250 * i);
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
        let d = (high - low) / duel.problemCount;
        let difficulties = [];
        for (let i = low; i <= high; i += d) {
            difficulties.push(Math.floor(i / 100) * 100);
        }
        return this.selectProblems(cachedProblems, difficulties, duel.problemCount);
    }
}

export default taskManager