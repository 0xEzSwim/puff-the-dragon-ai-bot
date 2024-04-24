import * as dotenv from "dotenv/config.js";
import pg from "pg";

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

    isDataEmptyOrNull(data) {
        return (!data?.length);
    }

    async query(sql) {
        let result;
        try {
            result = await this.dbClient.query(sql);
        } catch (error) {
            console.error(error);
        } 

        const returnedValue = this.isDataEmptyOrNull(result?.rows) ? null : result?.rows;
        return returnedValue;
    }
}