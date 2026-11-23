// Module-level guards in src/db and src/services/auth expect these to exist,
// even though the unit tests below never open a database or Redis connection.
// Integration tests point the shared db module at a disposable database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  || process.env.DATABASE_URL
  || "postgres://fitpal:fitpal@localhost:5432/fitpal";
process.env.REDIS_URL ||= "redis://localhost:6379";
process.env.OTP_PEPPER ||= "test-only-otp-pepper-at-least-32-characters-long";
