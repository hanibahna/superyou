import "server-only";

// Server code imports the database from here; proxy.ts uses lib/db-core directly.
export * from "@/lib/db-core";
