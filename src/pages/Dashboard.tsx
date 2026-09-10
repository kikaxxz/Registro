import { useEffect, useState } from "react";
import { api } from "../services/api";
import { Users } from "lucide-react";

import type { Profile } from "../types";
import { errorMessage } from "../utils/errors";
import { History } from "./History";
export function useEmployees() {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    api<{ employees: Profile[] }>("/employees")
      .then((data) => {
        if (current) setEmployees(data.employees);
      })
      .catch((e) => {
        if (current) setError(errorMessage(e));
      });
    return () => {
      current = false;
    };
  }, []);
  return { employees, error };
}
export function Dashboard({
  profile,
  historyOnly = false,
}: {
  profile: Profile;
  historyOnly?: boolean;
}) {
  const { employees, error } = useEmployees();
  return (
    <>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {historyOnly ? (
        <History profile={profile} employees={employees} />
      ) : (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">JEFATURA</span>
              <h1>Personal</h1>
              <p>Trabajadores y estado de sus cuentas.</p>
            </div>
            <Users className="heading-icon" size={29} />
          </div>
          <section className="panel personnel">
            <div className="panel-heading">
              <div>
                <h2>Equipo de Electricidad</h2>
                <p>
                  {employees.filter((p) => p.activo).length} cuentas habilitadas
                </p>
              </div>
              <span className="count-tag">{employees.length} personas</span>
            </div>
            {employees.length === 0 ? (
              <div className="empty">
                <Users size={30} />
                <h3>Aún no hay trabajadores</h3>
              </div>
            ) : (
              <div className="team-list">
                {employees.map((person) => (
                  <div className="team-person" key={person.uid}>
                    <span className="avatar">{person.nombre.slice(0, 1)}</span>
                    <div className="person-name">
                      <strong>{person.nombre}</strong>
                      <span>Usuario: {person.username ?? person.nombre}</span>
                    </div>
                    <span className={`badge ${person.activo ? "working" : ""}`}>
                      <i />
                      {person.activo ? "Habilitada" : "Inactiva"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
