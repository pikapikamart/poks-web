import { createServerClient } from "@/supabase";

export const deleteUserById = async (userId: string) =>
  createServerClient().auth.admin.deleteUser(userId);
