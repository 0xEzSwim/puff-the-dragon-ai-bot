import { Database } from "../database.js";

export class ThreadRepository {
    DISCORD_CHANNEL_DURATION = +process.env.DISCORD_CHANNEL_DURATION_IN_MS;
    _db;

    constructor() {
        this._db = new Database();
    }

    async getAllThreads() {
        const result = await this._db.query('SELECT * FROM public."thread"');
        return this._db.isDataEmptyOrNull(result) ? null : result.map(thread => ({
            id: thread.id,
            discordThreadId: thread.discord_thread_id,
            openaiThreadId: thread.openai_thread_id,
            userId: thread.user_id,
            isDeleted: thread.is_deleted,
            hasReachedMaxQuota: thread.has_reached_max_quota,
            createdTimestamp: thread.created_timestamp,
            updatedTimestamp: thread.updated_timestamp
        }));
    }

    async getAllActiveThreads() {
        const dateCompare = new Date(Date.now() - this.DISCORD_CHANNEL_DURATION);
        const threadQuery = {
            text: `SELECT   
	                            thread.id,
                                thread.discord_thread_id,
                                thread.openai_thread_id,
                                thread.user_id,
                                member.discord_user_id,
                                member.discord_username,
                                thread.is_deleted,
                                thread.has_reached_max_quota,
                                thread.created_timestamp,
                                thread.updated_timestamp
                    
                    FROM        public."thread" AS thread
                    INNER JOIN  public."user" AS member
                        ON      thread.user_id = member.id
                    WHERE       thread.is_deleted = false
                        AND     (
                                    thread.updated_timestamp IS NULL
                                    OR      thread.updated_timestamp >= TIMESTAMP '${dateCompare.toISOString()}');`,
            values: []
        };

        const result = await this._db.query(threadQuery);
        return this._db.isDataEmptyOrNull(result) ? null : result.map(thread => ({
            id: thread.id,
            discordThreadId: thread.discord_thread_id,
            openaiThreadId: thread.openai_thread_id,
            userId: thread.user_id,
            discordUserId: thread.discord_user_id,
            discordUsername: thread.discord_username,
            isDeleted: thread.is_deleted,
            hasReachedMaxQuota: thread.has_reached_max_quota,
            createdTimestamp: thread.created_timestamp,
            updatedTimestamp: thread.updated_timestamp
        }));
    }

    async getLastActiveThreadFromDiscordUserId(discordUserId) {
        const dateCompare = new Date(Date.now() - this.DISCORD_CHANNEL_DURATION);
        const threadQuery = {
            text: `SELECT   
                                thread.id,
                                thread.discord_thread_id,
                                thread.openai_thread_id,
                                thread.user_id,
                                member.discord_user_id,
                                member.discord_username,
                                thread.is_deleted,
                                thread.has_reached_max_quota,
                                thread.created_timestamp,
                                thread.updated_timestamp
                    FROM 		public."thread" AS thread
                    INNER JOIN  public."user" AS member
                        ON 		thread.user_id = member.id
                    WHERE 		member.discord_user_id = $1
                        AND     thread.is_deleted = false
                        AND 	(
                                        thread.updated_timestamp IS null 
                                    OR 	thread.updated_timestamp >= TIMESTAMP '${dateCompare.toISOString()}'
                                )
                    ORDER BY  	thread.created_timestamp DESC, 
                                thread.updated_timestamp DESC
                    LIMIT 1;`,
            values: [discordUserId]
        };

        const result = await this._db.query(threadQuery);
        return this._db.isDataEmptyOrNull(result) ? null : {
            id: result[0].id,
            discordThreadId: result[0].discord_thread_id,
            openaiThreadId: result[0].openai_thread_id,
            userId: result[0].user_id,
            discordUserId: result[0].discord_user_id,
            discordUsername: result[0].discord_username,
            isDeleted: result[0].is_deleted,
            hasReachedMaxQuota: result[0].has_reached_max_quota,
            createdTimestamp: result[0].created_timestamp,
            updatedTimestamp: result[0].updated_timestamp
        };
    }

    async getThreadFromDiscordThreadId(discordThreadId) {
        const threadQuery = {
            text: `SELECT * FROM public."thread" WHERE discord_thread_id = $1;`,
            values: [discordThreadId]
        };

        const result = await this._db.query(threadQuery);
        return this._db.isDataEmptyOrNull(result) ? null : {
            id: result[0].id,
            discordThreadId: result[0].discord_thread_id,
            openaiThreadId: result[0].openai_thread_id,
            userId: result[0].user_id,
            isDeleted: result[0].is_deleted,
            hasReachedMaxQuota: result[0].has_reached_max_quota,
            createdTimestamp: result[0].created_timestamp,
            updatedTimestamp: result[0].updated_timestamp
        };
    }

    async saveThread(userId, discordThreadId) {
        const dateNow = new Date();
        const threadQuery = {
            text: `INSERT INTO public."thread"(discord_thread_id, openai_thread_id, user_id, created_timestamp, updated_timestamp)
                    VALUES($1, $2, $3, $4, $5)
                    RETURNING *;`,
            values: [discordThreadId, null, userId, dateNow, null]
        };

        const result = await this._db.query(threadQuery);
        return {
            id: result[0].id,
            discordThreadId: result[0].discord_thread_id,
            openaiThreadId: result[0].openai_thread_id,
            userId: result[0].user_id,
            isDeleted: result[0].is_deleted,
            hasReachedMaxQuota: result[0].has_reached_max_quota,
            createdTimestamp: result[0].created_timestamp,
            updatedTimestamp: result[0].updated_timestamp
        };
    }

    async updateThread(discordThreadId, openaiThreadId = null, isDeleted = null, hasReachedMaxQuota = null) {
        const dateNow = new Date();
        const threadQuery = {
            text: `UPDATE   public."thread" 
                    SET     updated_timestamp = $1
                            ${ openaiThreadId ? `,openai_thread_id = '${openaiThreadId}'` : '' }
                            ${ isDeleted ? `,is_deleted = '${isDeleted}'` : '' }
                            ${ hasReachedMaxQuota ? `,has_reached_max_quota = '${hasReachedMaxQuota}'` : '' }
                    WHERE   discord_thread_id = $2 
                    RETURNING *;`,
            values: [dateNow, discordThreadId]
        };
        
        const result = await this._db.query(threadQuery);
        return this._db.isDataEmptyOrNull(result) ? null : {
            id: result[0].id,
            discordThreadId: result[0].discord_thread_id,
            openaiThreadId: result[0].openai_thread_id,
            userId: result[0].user_id,
            isDeleted: result[0].is_deleted,
            hasReachedMaxQuota: result[0].has_reached_max_quota,
            createdTimestamp: result[0].created_timestamp,
            updatedTimestamp: result[0].updated_timestamp
        };
    }

}
