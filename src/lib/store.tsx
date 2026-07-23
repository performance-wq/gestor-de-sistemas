"use client";

// Store respaldado por Supabase. Mantiene la misma interfaz que usaban las
// vistas (proyectos anidados + métodos de mutación), pero persiste en la
// base de datos con RLS. Las mutaciones son optimistas: actualizan el estado
// local y escriben en Supabase en segundo plano.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Estado, Proyecto, Sistema, Punto } from "./types";
import { createClient } from "./supabase/client";

export type Rol = "admin" | "subcuenta";

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}

interface CrearProyectoInput {
  nombre: string;
  estado: Estado;
  fechaIncorporacion: string;
  fechaCierre?: string;
}

interface StoreValue {
  proyectos: Proyecto[];
  cargado: boolean;
  usuario: Usuario | null;
  getProyecto: (id: string) => Proyecto | undefined;
  refrescar: () => Promise<void>;
  crearProyecto: (input: CrearProyectoInput) => Promise<Proyecto | null>;
  actualizarProyecto: (
    id: string,
    patch: Partial<Omit<Proyecto, "id" | "sistemas" | "creado">>,
  ) => Promise<void>;
  eliminarProyecto: (id: string) => Promise<void>;
  agregarSistema: (pid: string, nombre: string) => Promise<void>;
  renombrarSistema: (pid: string, sid: string, nombre: string) => Promise<void>;
  eliminarSistema: (pid: string, sid: string) => Promise<void>;
  agregarPunto: (pid: string, sid: string, nombre: string) => Promise<void>;
  actualizarPunto: (
    pid: string,
    sid: string,
    ptid: string,
    patch: Partial<Omit<Punto, "id">>,
  ) => Promise<void>;
  eliminarPunto: (pid: string, sid: string, ptid: string) => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

// --- Mapeo de filas de Supabase (snake_case) al modelo de la app ---
type Row = Record<string, unknown>;

function mapPunto(p: Row): Punto {
  return {
    id: p.id as string,
    nombre: p.nombre as string,
    copy: (p.copy as string) ?? "",
    imagen: (p.imagen as string) ?? undefined,
    video: (p.video as string) ?? undefined,
    fijo: (p.fijo as boolean) ?? false,
  };
}

function mapSistema(s: Row): Sistema {
  const puntos = ((s.puntos as Row[]) ?? [])
    .slice()
    .sort((a, b) => (a.orden as number) - (b.orden as number))
    .map(mapPunto);
  return { id: s.id as string, nombre: s.nombre as string, puntos };
}

function mapProyecto(p: Row): Proyecto {
  const sistemas = ((p.sistemas as Row[]) ?? [])
    .slice()
    .sort((a, b) => (a.orden as number) - (b.orden as number))
    .map(mapSistema);
  return {
    id: p.id as string,
    nombre: p.nombre as string,
    estado: p.estado as Estado,
    fechaIncorporacion: (p.fecha_incorporacion as string) ?? "",
    fechaCierre: (p.fecha_cierre as string) ?? undefined,
    creado: (p.created_at as string) ?? "",
    sistemas,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargado, setCargado] = useState(false);
  const initRef = useRef(false);

  const fetchProyectos = useCallback(async () => {
    const { data, error } = await supabase
      .from("proyectos")
      .select("*, sistemas(*, puntos(*))")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error cargando proyectos:", error.message);
      return;
    }
    setProyectos((data ?? []).map(mapProyecto));
  }, [supabase]);

  const refrescar = useCallback(async () => {
    await fetchProyectos();
  }, [fetchProyectos]);

  // Carga inicial: usuario + perfil + proyectos.
  // Usa getSession() (lee la cookie local, no depende de la red) y garantiza
  // con try/finally que 'cargado' siempre se marque — nunca se queda cargando.
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;
        if (user) {
          const { data: perfil } = await supabase
            .from("profiles")
            .select("nombre, rol")
            .eq("id", user.id)
            .maybeSingle();
          setUsuario({
            id: user.id,
            email: user.email ?? "",
            nombre: perfil?.nombre ?? user.email ?? "",
            rol: (perfil?.rol as Rol) ?? "subcuenta",
          });
          await fetchProyectos();
        }
      } catch (e) {
        console.error("Error inicializando el store:", e);
      } finally {
        setCargado(true);
      }
    })();
  }, [supabase, fetchProyectos]);

  const getProyecto = useCallback(
    (id: string) => proyectos.find((p) => p.id === id),
    [proyectos],
  );

  const crearProyecto = useCallback(
    async (input: CrearProyectoInput) => {
      const { data, error } = await supabase.rpc("crear_proyecto", {
        p_nombre: input.nombre.trim(),
        p_estado: input.estado,
        p_fecha_incorporacion: input.fechaIncorporacion || null,
      });
      if (error) {
        console.error("Error creando proyecto:", error.message);
        return null;
      }
      await fetchProyectos();
      const nuevoId = data as string;
      return (
        (await supabase
          .from("proyectos")
          .select("*, sistemas(*, puntos(*))")
          .eq("id", nuevoId)
          .single()
          .then(({ data: p }) => (p ? mapProyecto(p) : null))) ?? null
      );
    },
    [supabase, fetchProyectos],
  );

  const actualizarProyecto = useCallback(
    async (
      id: string,
      patch: Partial<Omit<Proyecto, "id" | "sistemas" | "creado">>,
    ) => {
      setProyectos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      );
      const row: Row = {};
      if (patch.nombre !== undefined) row.nombre = patch.nombre;
      if (patch.estado !== undefined) row.estado = patch.estado;
      if (patch.fechaIncorporacion !== undefined)
        row.fecha_incorporacion = patch.fechaIncorporacion || null;
      if (patch.fechaCierre !== undefined)
        row.fecha_cierre = patch.fechaCierre || null;
      const { error } = await supabase.from("proyectos").update(row).eq("id", id);
      if (error) console.error("Error actualizando proyecto:", error.message);
    },
    [supabase],
  );

  const eliminarProyecto = useCallback(
    async (id: string) => {
      setProyectos((prev) => prev.filter((p) => p.id !== id));
      const { error } = await supabase.from("proyectos").delete().eq("id", id);
      if (error) console.error("Error eliminando proyecto:", error.message);
    },
    [supabase],
  );

  const agregarSistema = useCallback(
    async (pid: string, nombre: string) => {
      const proyecto = proyectos.find((p) => p.id === pid);
      const orden = (proyecto?.sistemas.length ?? 0) + 1;
      const { data, error } = await supabase
        .from("sistemas")
        .insert({ proyecto_id: pid, nombre: nombre.trim() || "Nuevo sistema", orden })
        .select()
        .single();
      if (error) {
        console.error("Error agregando sistema:", error.message);
        return;
      }
      setProyectos((prev) =>
        prev.map((p) =>
          p.id === pid
            ? { ...p, sistemas: [...p.sistemas, { id: data.id, nombre: data.nombre, puntos: [] }] }
            : p,
        ),
      );
    },
    [supabase, proyectos],
  );

  const renombrarSistema = useCallback(
    async (pid: string, sid: string, nombre: string) => {
      setProyectos((prev) =>
        prev.map((p) =>
          p.id === pid
            ? {
                ...p,
                sistemas: p.sistemas.map((s) =>
                  s.id === sid ? { ...s, nombre } : s,
                ),
              }
            : p,
        ),
      );
      const { error } = await supabase
        .from("sistemas")
        .update({ nombre })
        .eq("id", sid);
      if (error) console.error("Error renombrando sistema:", error.message);
    },
    [supabase],
  );

  const eliminarSistema = useCallback(
    async (pid: string, sid: string) => {
      setProyectos((prev) =>
        prev.map((p) =>
          p.id === pid
            ? { ...p, sistemas: p.sistemas.filter((s) => s.id !== sid) }
            : p,
        ),
      );
      const { error } = await supabase.from("sistemas").delete().eq("id", sid);
      if (error) console.error("Error eliminando sistema:", error.message);
    },
    [supabase],
  );

  const agregarPunto = useCallback(
    async (pid: string, sid: string, nombre: string) => {
      const proyecto = proyectos.find((p) => p.id === pid);
      const sistema = proyecto?.sistemas.find((s) => s.id === sid);
      const orden = (sistema?.puntos.length ?? 0) + 1;
      const { data, error } = await supabase
        .from("puntos")
        .insert({
          sistema_id: sid,
          nombre: nombre.trim() || `Punto ${orden}`,
          orden,
        })
        .select()
        .single();
      if (error) {
        console.error("Error agregando punto:", error.message);
        return;
      }
      setProyectos((prev) =>
        prev.map((p) =>
          p.id === pid
            ? {
                ...p,
                sistemas: p.sistemas.map((s) =>
                  s.id === sid ? { ...s, puntos: [...s.puntos, mapPunto(data)] } : s,
                ),
              }
            : p,
        ),
      );
    },
    [supabase, proyectos],
  );

  const actualizarPunto = useCallback(
    async (
      pid: string,
      sid: string,
      ptid: string,
      patch: Partial<Omit<Punto, "id">>,
    ) => {
      setProyectos((prev) =>
        prev.map((p) =>
          p.id === pid
            ? {
                ...p,
                sistemas: p.sistemas.map((s) =>
                  s.id === sid
                    ? {
                        ...s,
                        puntos: s.puntos.map((pt) =>
                          pt.id === ptid ? { ...pt, ...patch } : pt,
                        ),
                      }
                    : s,
                ),
              }
            : p,
        ),
      );
      const row: Row = {};
      if (patch.nombre !== undefined) row.nombre = patch.nombre;
      if (patch.copy !== undefined) row.copy = patch.copy;
      if (patch.imagen !== undefined) row.imagen = patch.imagen ?? null;
      if (patch.video !== undefined) row.video = patch.video ?? null;
      const { error } = await supabase.from("puntos").update(row).eq("id", ptid);
      if (error) console.error("Error actualizando punto:", error.message);
    },
    [supabase],
  );

  const eliminarPunto = useCallback(
    async (pid: string, sid: string, ptid: string) => {
      setProyectos((prev) =>
        prev.map((p) =>
          p.id === pid
            ? {
                ...p,
                sistemas: p.sistemas.map((s) =>
                  s.id === sid
                    ? { ...s, puntos: s.puntos.filter((pt) => pt.id !== ptid) }
                    : s,
                ),
              }
            : p,
        ),
      );
      const { error } = await supabase.from("puntos").delete().eq("id", ptid);
      if (error) console.error("Error eliminando punto:", error.message);
    },
    [supabase],
  );

  const value = useMemo<StoreValue>(
    () => ({
      proyectos,
      cargado,
      usuario,
      getProyecto,
      refrescar,
      crearProyecto,
      actualizarProyecto,
      eliminarProyecto,
      agregarSistema,
      renombrarSistema,
      eliminarSistema,
      agregarPunto,
      actualizarPunto,
      eliminarPunto,
    }),
    [
      proyectos,
      cargado,
      usuario,
      getProyecto,
      refrescar,
      crearProyecto,
      actualizarProyecto,
      eliminarProyecto,
      agregarSistema,
      renombrarSistema,
      eliminarSistema,
      agregarPunto,
      actualizarPunto,
      eliminarPunto,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore debe usarse dentro de <StoreProvider>");
  return ctx;
}
