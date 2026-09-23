export const checked = <T>({ data, error }: { data: T; error: unknown }): T => {
  if (error) throw error;
  return data;
};
