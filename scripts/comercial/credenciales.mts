/**
 * La conexión a la base, leída de un archivo que sólo puede leer su dueño.
 *
 *   ~/.config/gastroos/credenciales     (o el que diga GASTROOS_CREDENCIALES)
 *   DATABASE_URL=postgresql://postgres:…@db.….supabase.co:5432/postgres
 *
 * Un archivo y no una variable de entorno porque las variables se filtran: a
 * un `ps`, a un registro de la terminal, a un proceso hijo que las imprime al
 * fallar. Y con permisos 600 o nada: si el archivo lo puede leer otro usuario
 * de la máquina, esto se niega a usarlo y dice cómo arreglarlo. Una clave de
 * dueño de la base que lee cualquiera no es una clave.
 */

import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function conexionDeLaBase(): string {
  const ruta = process.env.GASTROOS_CREDENCIALES ?? join(homedir(), '.config', 'gastroos', 'credenciales');
  let modo: number;
  try {
    modo = statSync(ruta).mode & 0o777;
  } catch {
    throw new Error(`No existe ${ruta}. Creala con una línea DATABASE_URL=… y \`chmod 600\`.`);
  }
  if ((modo & 0o077) !== 0) {
    throw new Error(`${ruta} tiene permisos ${modo.toString(8)}: la puede leer otro usuario. Corré \`chmod 600 ${ruta}\`.`);
  }
  const url = readFileSync(ruta, 'utf8').match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  if (!url) throw new Error(`${ruta} no tiene una línea DATABASE_URL=…`);
  return url;
}

/**
 * La conexión partida en las variables que lee `psql` (`PGHOST`, `PGUSER`…).
 *
 * No se le pasa la URL entera: `PGDATABASE` con una URL adentro no se expande
 * —`psql` la toma como nombre de base y se va a buscar un socket local—, y por
 * argumento la vería cualquiera con `ps`.
 */
export function entornoDePsql(url: string): NodeJS.ProcessEnv {
  const u = new URL(url);
  return {
    ...process.env,
    PGHOST: u.hostname,
    PGPORT: u.port || '5432',
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: u.pathname.replace(/^\//, '') || 'postgres',
    PGSSLMODE: u.searchParams.get('sslmode') ?? 'require',
  };
}
