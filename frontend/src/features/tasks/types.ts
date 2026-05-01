export type Task = {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
};

export type TaskCreateInput = {
  title: string;
  description: string | null;
};

