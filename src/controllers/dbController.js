// Importa la conexion a la base de datos
import sql, { poolPromise } from '../db.js';

export async function seleccionarTodos(tabla) {
    const pool = await poolPromise;
    const result = await pool.request().query(`SELECT * FROM ${tabla}`);
    return result.recordset;
}

export async function seleccionarId(tabla, id) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', id)
        .query(`SELECT * FROM ${tabla} WHERE id = @id`);
    return result.recordset[0] || null;
}

// obtener atributos
// insertar datos
// actualizar datos
// eliminar datos