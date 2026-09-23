import type { Content } from "../zod/records";

export const blankContent = (timeZone = "UTC"): Content => {
  return {
    title: "",
    notes: "",
    items: [],
    dueAt: null,
    dueDate: null,
    timeZone,
    priority: "normal",
    recurrence: "none",
    nudgeMinutes: 3,
    completed: false,
    archived: false,
    templateId: null,
  };
};

export const completion = (content: Content): boolean => {
  const required = content.items.filter((i) => i.required);

  return content.items.length
    ? required.length
      ? required.every((i) => i.completed)
      : content.items.every((i) => i.completed)
    : content.completed;
};
