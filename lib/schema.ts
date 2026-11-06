// lib/schema.ts
import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  smallint,
  boolean,
  char,
  integer,
  check, // <<— viktigt: check() kommer härifrån
} from "drizzle-orm/pg-core";

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamName: text("team_name").notNull(),
  participants: text("participants"), // <— NY: komma-separerade namn eller fri text
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  step: smallint("step").notNull().default(0),
  orderIds: text("order_ids").array().notNull().default(sql`ARRAY[]::TEXT[]`), // gåte-id:n i spelordning
  penaltiesSec: integer("penalties_sec").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastWrongAt: timestamp("last_wrong_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  finalCode: char("final_code", { length: 6 }),
  fraudSuspected: boolean("fraud_suspected").notNull().default(false),
});


export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    digit: smallint("digit").notNull(),
    correct: boolean("correct").notNull(),
    timeLeftAtSubmit: integer("time_left_at_submit").notNull(),
  },
  (t) => ({
    // CHECK (digit BETWEEN 0 AND 9)
    digitBetween: check("submissions_digit_between", sql`${t.digit} BETWEEN 0 AND 9`),
  })
);

export const contentClues = pgTable(
  "content_clues",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    icon: text("icon").notNull(),
    riddle: text("riddle").notNull(),
    locationHint: text("location_hint"),
    safetyHint: text("safety_hint"),
    expectedDigit: smallint("expected_digit").notNull(),
    verification: text("verification"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
  },
  (t) => ({
    // CHECK (expected_digit BETWEEN 0 AND 9)
    expectedBetween: check(
      "content_clues_expected_digit_between",
      sql`${t.expectedDigit} BETWEEN 0 AND 9`
    ),
  })
);




/**
 * Tidsspelet – ett försök per lag. Laget startar/stoppar klockan med mellanslag
 * utan att se tiden; närmast 60 s vinner.
 */
export const timeRuns = pgTable("time_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamName: text("team_name").notNull(),
  teamKey: text("team_key").notNull().unique(), // normaliserat lagnamn (lowercase, trimmat)
  participants: text("participants"),
  targetSec: integer("target_sec").notNull().default(60),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  elapsedMs: integer("elapsed_ms"),
  diffMs: integer("diff_ms"), // elapsed - target (positivt = för sent)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
