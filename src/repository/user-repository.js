import { Database } from "../database.js";
import { isDataEmptyOrNull } from "../utils/index.js";

export class UserRepository {
    _db;

    constructor() {
        this._db = new Database();
    }

    async getAllUsers() {
        return await this._db.query('SELECT * FROM public."user"');
    }

    async getUserFromDiscordUserId(discordUserId) {
        const userQuery = {
            text: `SELECT * FROM public."user" WHERE discord_user_id = $1`,
            values: [discordUserId]
        };

        const result = await this._db.query(userQuery);
        return isDataEmptyOrNull(result) ? null : result[0];
    }

    async saveUser(discordUserId, discordUsername) {      
        const dateNow = new Date();
        const userQuery = {
            text: `INSERT INTO public."user"(discord_user_id, discord_username, created_timestamp, updated_timestamp) VALUES($1, $2, $3, $4) RETURNING *`,
            values: [discordUserId, discordUsername, dateNow, null]
        };

        const result = await this._db.query(userQuery);
        return result[0];
    }

}
