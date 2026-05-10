import { Pool } from "pg";
import * as dotenv from "dotenv"

dotenv.config()

const pool = new Pool({
    connectionString: import.meta.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
})

export class RateLimitError extends Error {
    retryAfter: number;
    constructor(retryAfter: number) {
        super("rate limit exceeded");
        this.retryAfter = retryAfter;
        this.name = "RateLimitError";
    }
}

export async function checkRateLimit(
    userId: string,
    endpoint: string,
    opts: { max: number; windowSec: number }
    ): Promise<void> {
  
        const client = await pool.connect();
  
        try {
            await client.query("BEGIN");
            await client.query(
                `DELETE FROM rate_limits WHERE created_at < NOW() - ($1 || ' seconds')::interval`,
                [opts.windowSec]
            );
        
            // Count recent requests
        
            const { rows } = await client.query(
        
                `SELECT COUNT(*) AS count FROM rate_limits
                WHERE user_id = $1 AND endpoint = $2 AND created_at > NOW() - ($3 || ' seconds')::interval`,
                [userId, endpoint, opts.windowSec]
            );
        
            const count = parseInt(rows[0].count, 10);
        
            if (count >= opts.max) {
                await client.query("COMMIT");
                throw new RateLimitError(opts.windowSec);
            }
        
            // Log this request
        
            await client.query(
                `INSERT INTO rate_limits (user_id, endpoint) VALUES ($1, $2)`,
                [userId, endpoint]
            );

            await client.query("COMMIT");
  
        } catch (e) {
            await client.query("ROLLBACK");
            throw e;
        
        } finally {
            
        client.release();
    }
}