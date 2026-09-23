import type { Database } from "./index";

export type Delivery = Database["public"]["Tables"]["deliveries"]["Row"];
export type DeliveryUpdate =
  Database["public"]["Tables"]["deliveries"]["Update"];
