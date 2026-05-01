import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="empty-state">
      <h2>Ruta no encontrada</h2>
      <p>La vista solicitada no existe dentro del flujo actual.</p>
      <Link className="text-link" to="/">
        Volver al dashboard
      </Link>
    </section>
  );
}

