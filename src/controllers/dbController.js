// dbFunctions.js
import { poolPromise } from "../db.js";

/* ---------------------------------------------------------
   Función para formatear datos y evitar inyección SQL
--------------------------------------------------------- */
export async function formatearDatos(datos) {
    if (datos === null || datos === undefined) return [];
    const pool = poolPromise;

    if (Array.isArray(datos)) {
        return datos.map(d => pool.escape(d)); 
    }

    return [pool.escape(datos)];
}

/* ---------------------------------------------------------
   Obtiene los nombres de columnas de una tabla
--------------------------------------------------------- */
export async function obtenerAtributos(tabla) {
    const pool = poolPromise;

    const [rows] = await pool.query(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?`,
        [tabla]
    );

    return rows.map(r => r.COLUMN_NAME);
}

/* ---------------------------------------------------------
   Seleccionar todos los registros
--------------------------------------------------------- */
export async function seleccionarTodos(tabla) {
    const pool = poolPromise;
    const [rows] = await pool.query(`SELECT * FROM \`${tabla}\``);
    return rows;
}

/* ---------------------------------------------------------
   Seleccionar registro por ID
--------------------------------------------------------- */
export async function seleccionarId(tabla, id) {
    const pool = poolPromise;
    const atributos = await obtenerAtributos(tabla);

    console.log("Atributos:", atributos);
    console.log("ID recibido:", id);
    console.log("Tabla:", tabla);

    const [rows] = await pool.query(
        `SELECT * FROM \`${tabla}\` WHERE \`${atributos[0]}\` = ?`,
        [id]
    );
    console.log(rows);
    return rows[0] ?? null;
}

/* ---------------------------------------------------------
   Insertar datos
--------------------------------------------------------- */
export async function insertarDatos(tabla, datos) {
    try {
        const pool = poolPromise;
        const atributos = await obtenerAtributos(tabla);

        // Columnas (sin la pk)
        const columnas = atributos.slice(1);

        // Valores (?)
        const placeholders = columnas.map(() => '?').join(', ');

        const valores = columnas.map(col => datos[col]);

        const sql = `
            INSERT INTO \`${tabla}\` (${columnas.join(', ')})
            VALUES (${placeholders})
        `;

        await pool.query(sql, valores);

        return { success: true, message: "Datos insertados correctamente" };

    } catch (err) {
        console.error("Error al insertar datos:", err);
        return { success: false, error: err.message };
    }
}

/* ---------------------------------------------------------
   Insertar con ID datos
--------------------------------------------------------- */

export async function insertarConIdDatos(tabla, datos) {
    try {
        const pool = poolPromise;
        const atributos = await obtenerAtributos(tabla);
        const placeholders = atributos.map(() => '?').join(', ');

        const valores = atributos.map(col => datos[col]);

        const sql = `
            INSERT INTO \`${tabla}\` (${atributos.join(', ')})
            VALUES (${placeholders})
        `;

        await pool.query(sql, valores);

        return { success: true, message: "Datos insertados correctamente" };

    } catch (err) {
        console.error("Error al insertar datos con ID:", err);
        return { success: false, error: err.message };
    }
}

/* ---------------------------------------------------------
   Actualizar datos
--------------------------------------------------------- */
export async function actualizarDatos(tabla, id, datos) {
    const pool = poolPromise;
    const atributos = await obtenerAtributos(tabla);

    const columnas = atributos.slice(1);

    const setClause = columnas.map(col => `${col} = ?`).join(', ');
    const valores = columnas.map(col => datos[col]);

    const sql = `
        UPDATE \`${tabla}\`
        SET ${setClause}
        WHERE \`${atributos[0]}\` = ?
    `;

    await pool.query(sql, [...valores, id]);

    return { success: true, message: "Datos actualizados correctamente" };
}

/* ---------------------------------------------------------
   Eliminar datos
--------------------------------------------------------- */
export async function eliminarDatos(tabla, id) {
    try {
        const pool = poolPromise;
        const atributos = await obtenerAtributos(tabla);

        const sql = `
            DELETE FROM \`${tabla}\`
            WHERE \`${atributos[0]}\` = ?
        `;

        await pool.query(sql, [id]);

        return { success: true, message: "Datos eliminados correctamente" };

    } catch (err) {
        console.error("Error al eliminar datos:", err);
        return { success: false, error: err.message };
    }
}