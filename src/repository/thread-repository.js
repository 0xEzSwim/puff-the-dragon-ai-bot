import { Database } from "../database.js";
import { isDataEmptyOrNull } from "../utils/index.js";

export class ThreadRepository {
    _db;

    constructor() {
        this._db = new Database();
    }

    async getAllThreads() {
        return await this._db.query('SELECT * FROM public."thread"');
    }

    async getThreadFromDiscordThreadId(discordThreadId) {
        const threadQuery = {
            text: `SELECT * FROM public."thread" WHERE discord_thread_id = $1`,
            values: [discordThreadId]
        };

        const result = await this._db.query(threadQuery);
        return isDataEmptyOrNull(result) ? null : result[0];
    }

    async saveThread(userId, discordThreadId, openaiThreadId = null) {
        const dateNow = new Date();
        const threadQuery = {
            text: `INSERT INTO public."thread"(discord_thread_id, openai_thread_id, user_id, created_timestamp, updated_timestamp) VALUES($1, $2, $3, $4, $5) RETURNING *`,
            values: [discordThreadId, openaiThreadId, userId, dateNow, null]
        };

        const result = await this._db.query(threadQuery);
        return result[0];
    }

    async updateThread(discordThreadId) {
        const dateNow = new Date();
        const threadQuery = {
            text: `UPDATE public."thread" SET updated_timestamp = $1 WHERE discord_thread_id = $2 RETURNING *`,
            values: [dateNow, discordThreadId]
        };
        
        const result = await this._db.query(threadQuery);
        return isDataEmptyOrNull(result) ? null : result[0];
    }

}
