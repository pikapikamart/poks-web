import type { Database } from "@/database/types";

export type Delivery =
  Database["public"]["Tables"]["notification_deliveries"]["Row"];
export type DeliveryUpdate =
  Database["public"]["Tables"]["notification_deliveries"]["Update"];
