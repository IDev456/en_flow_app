import { useEffect, useState } from "react";

import { apiGet, apiPatch, apiPost } from "../../../api/client";
import type { Task, TaskCreateInput } from "../types";

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadTasks();
  }, []);

  async function loadTasks() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGet<Task[]>("/tasks/");
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las tareas");
    } finally {
      setLoading(false);
    }
  }

  async function createTask(input: TaskCreateInput) {
    const created = await apiPost<Task>("/tasks/", input);
    setTasks((current) => [created, ...current]);
  }

  async function toggleTask(task: Task) {
    const updated = await apiPatch<Task>(`/tasks/${task.id}`, {
      completed: !task.completed
    });

    setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  return {
    tasks,
    loading,
    error,
    createTask,
    toggleTask,
    reload: loadTasks
  };
}

