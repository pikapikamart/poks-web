import type { AppDatabase } from "@/database/types/schema";

export type Delivery =
  AppDatabase["public"]["Tables"]["notification_deliveries"]["Row"];
export type DeliveryUpdate =
  AppDatabase["public"]["Tables"]["notification_deliveries"]["Update"];
