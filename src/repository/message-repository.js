import { Database } from "../database.js";
import { isDataEmptyOrNull } from "../utils/index.js";

export class MessageRepository {
    _db;

    constructor() {
        this._db = new Database();
    }

    async getAllMessages() {
        return await this._db.query('SELECT * FROM public."message"');
    }

    async getMessagesFromThreadId(threadId) {
        const messageQuery = {
            text: `SELECT * FROM public."message" WHERE thread_id = $1`,
            values: [threadId]
        };

        const result = await this._db.query(messageQuery);
        return isDataEmptyOrNull(result) ? null : result[0];
    }

    async saveMessage(messageContent, userId, threadId) {
        const dateNow = new Date();
        const messageQuery = {
            text: `INSERT INTO public."message"(user_id, thread_id, message, created_timestamp, updated_timestamp) VALUES($1, $2, $3, $4, $5) RETURNING *`,
            values: [userId, threadId, messageContent, dateNow, null]
        };

        const result = await this._db.query(messageQuery);
        return result[0];
    }

}
