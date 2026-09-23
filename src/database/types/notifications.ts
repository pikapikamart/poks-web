import type { Database } from "@/database/types";

export type Delivery = Database["public"]["Tables"]["deliveries"]["Row"];
export type DeliveryUpdate =
  Database["public"]["Tables"]["deliveries"]["Update"];
