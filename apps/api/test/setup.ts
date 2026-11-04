// Module-level guards in src/db and src/services/auth expect these to exist,
// even though the unit tests below never open a database or Redis connection.
process.env.DATABASE_URL ||= "postgres://fitpal:fitpal@localhost:5432/fitpal";
process.env.REDIS_URL ||= "redis://localhost:6379";
process.env.JWT_SECRET ||= "test-secret-at-least-32-characters-long";
