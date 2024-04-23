import * as dotenv from "dotenv/config.js";
import pg from "pg";
import { isDataEmptyOrNull } from "./utils/index.js";

export class Database {
    dbClient;
    instance;

    constructor() {
        if (Database.instance) {
            return Database.instance;
        }

        this.dbClient = new pg.Client({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });   

        this.dbClient.connect(() => {
            console.log("Connected to DB");
        });
        Database.instance = this;
    }

    async query(sql) {
        let result;
        try {
            result = await this.dbClient.query(sql);
        } catch (err) {
            console.error(err);
        } 

        const returnedValue = isDataEmptyOrNull(result?.rows) ? null : result?.rows;
        return returnedValue;
    }
}