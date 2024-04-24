import { Database } from "../database.js";

export class UserRepository {
    _db;

    constructor() {
        this._db = new Database();
    }

    async getAllUsers() {
        const result = await this._db.query('SELECT * FROM public."user";');
        return this._db.isDataEmptyOrNull(result) ? null : result.map(user => ({
            id: user.id,
            discordUserId: user.discord_user_id,
            discordUsername: user.discord_username,
            createdTimestamp: user.created_timestamp,
            updatedTimestamp: user.updated_timestamp
        }));
    }

    async getUserFromDiscordUserId(discordUserId) {
        const userQuery = {
            text: `SELECT * FROM public."user" WHERE discord_user_id = $1;`,
            values: [discordUserId]
        };

        const result = await this._db.query(userQuery);
        return this._db.isDataEmptyOrNull(result) ? null : {
            id: result[0].id,
            discordUserId: result[0].discord_user_id,
            discordUsername: result[0].discord_username,
            createdTimestamp: result[0].created_timestamp,
            updatedTimestamp: result[0].updated_timestamp
        };
    }

    async saveUser(discordUserId, discordUsername) {      
        const dateNow = new Date();
        const userQuery = {
            text: `INSERT INTO public."user"(discord_user_id, discord_username, created_timestamp, updated_timestamp) VALUES($1, $2, $3, $4) RETURNING *;`,
            values: [discordUserId, discordUsername, dateNow, null]
        };

        const result = await this._db.query(userQuery);
        return this._db.isDataEmptyOrNull(result) ? null : {
            id: result[0].id,
            discordUserId: result[0].discord_user_id,
            discordUsername: result[0].discord_username,
            createdTimestamp: result[0].created_timestamp,
            updatedTimestamp: result[0].updated_timestamp
        };
    }

}
