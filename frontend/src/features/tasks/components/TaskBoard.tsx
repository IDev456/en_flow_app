import { FormEvent, useState } from "react";

import { Panel } from "../../../components/Panel";
import { useTasks } from "../hooks/useTasks";
import type { Task } from "../types";

export function TaskBoard() {
  const { tasks, loading, error, createTask, toggleTask } = useTasks();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      await createTask({
        title: title.trim(),
        description: description.trim() || null
      });
      setTitle("");
      setDescription("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="task-board">
      <Panel title="Nueva tarea">
        <form className="task-form" onSubmit={handleSubmit}>
          <label>
            Titulo
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Preparar demo"
            />
          </label>

          <label>
            Descripcion
            <textarea
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Agrega contexto, fecha o notas"
            />
          </label>

          <button type="submit" disabled={submitting}>
            {submitting ? "Guardando..." : "Crear tarea"}
          </button>
        </form>
      </Panel>

      <Panel title="Tareas actuales">
        {loading && <p className="status">Cargando tareas...</p>}
        {error && <p className="status">{error}</p>}
        {!loading && !error && <TaskList tasks={tasks} onToggle={toggleTask} />}
      </Panel>
    </div>
  );
}

type TaskListProps = {
  tasks: Task[];
  onToggle: (task: Task) => Promise<void>;
};

function TaskList({ tasks, onToggle }: TaskListProps) {
  if (tasks.length === 0) {
    return <p className="status">Todavia no hay tareas creadas.</p>;
  }

  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <li key={task.id} className="task-item" data-completed={task.completed}>
          <header>
            <div>
              <h3>{task.title}</h3>
              {task.description && <p>{task.description}</p>}
            </div>

            <button type="button" onClick={() => void onToggle(task)}>
              {task.completed ? "Reabrir" : "Completar"}
            </button>
          </header>
        </li>
      ))}
    </ul>
  );
}

