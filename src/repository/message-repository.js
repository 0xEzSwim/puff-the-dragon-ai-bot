import { Database } from "../database.js";

export class MessageRepository {
    _db;

    constructor() {
        this._db = new Database();
    }

    async getAllMessages() {
        const result = await this._db.query('SELECT * FROM public."message";');
        return this._db.isDataEmptyOrNull(result) ? null : result.map(msg => ({
            id: msg.id,
            userId: msg.user_id,
            threadId: msg.thread_id,
            messageContent: msg.message,
            createdTimestamp: msg.created_timestamp,
            updatedTimestamp: msg.updated_timestamp
        }));
    }

    async getMessagesQuotaFromDiscordThreadId(discordThreadId) {
        const messageQuery = {
            text: `SELECT      COUNT(*)
                    FROM        public."message" AS msg
                    INNER JOIN  public."thread" AS thread
                        ON 		msg.thread_id  = thread.id
                    INNER JOIN  public."user" AS member
                        ON 		msg.user_id  = member.id 
                    WHERE       thread.discord_thread_id = $1
                        AND		member.is_bot = $2;`,
            values: [discordThreadId, false]
        };

        const result = await this._db.query(messageQuery);
        return this._db.isDataEmptyOrNull(result) ? null : +(result[0].count);
    }

    async getMessagesFromThreadId(threadId) {
        const messageQuery = {
            text: `SELECT * FROM public."message" WHERE thread_id = $1;`,
            values: [threadId]
        };

        const result = await this._db.query(messageQuery);
        return this._db.isDataEmptyOrNull(result) ? null : {
            id: result[0].id,
            userId: result[0].user_id,
            threadId: result[0].thread_id,
            messageContent: result[0].message,
            createdTimestamp: result[0].created_timestamp,
            updatedTimestamp: result[0].updated_timestamp
        };
    }

    async saveMessage(messageContent, userId, threadId) {
        const dateNow = new Date();
        const messageQuery = {
            text: `INSERT INTO public."message"(user_id, thread_id, message, created_timestamp, updated_timestamp) VALUES($1, $2, $3, $4, $5) RETURNING *;`,
            values: [userId, threadId, messageContent, dateNow, null]
        };

        const result = await this._db.query(messageQuery);
        return {
            id: result[0].id,
            userId: result[0].user_id,
            threadId: result[0].thread_id,
            messageContent: result[0].message,
            createdTimestamp: result[0].created_timestamp,
            updatedTimestamp: result[0].updated_timestamp
        };
    }

}
