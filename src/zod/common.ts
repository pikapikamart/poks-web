import { z } from "zod";

export const uuid = z.string().uuid();
export const zoneSchema = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });

    return true;
  } catch {
    return false;
  }
}, "Choose a valid time zone");
