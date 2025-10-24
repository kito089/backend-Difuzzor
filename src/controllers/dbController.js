// Importa la conexion a la base de datos
import e from 'express';
import sql, { poolPromise } from '../db.js';

//Funcion para formatear datos y evitar inyecciones SQL
export async function formatearDatos(datos) {
    if (datos === null || datos === undefined) return [];
    const pool = await poolPromise;
    if (Array.isArray(datos)) return pool.escape(datos);
    return [pool.escape(datos)];
}
// Funcion para obtener atributos de una tabla
export async function obtenerAtributos(tabla) {
    const pool = await poolPromise;
    const result = await pool.request()
    .query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${pool.escape(tabla)}'`);
    return result.recordset.map(row => row.COLUMN_NAME);
}

// Funcion para seleccionar todos los registros de una tabla
export async function seleccionarTodos(tabla) {
    const pool = await poolPromise;
    const result = await pool.request().query(`SELECT * FROM ${pool.escape(tabla)}`);
    return result.recordset;
}

// Funcion para seleccionar un registro por ID
export async function seleccionarId(tabla, id) {
    const pool = await poolPromise;
    const atributos = await obtenerAtributos(tabla);
    const result = await pool.request()
        .input('id', id)
        .query(`SELECT * FROM ${pool.escape(tabla)} WHERE ${atributos[0]} = @id`);
    return result.recordset[0] || null;
}

// Funcion para insertar datos

export async function insertarDatos(tabla, datos) {
    console.log("Insertando en tabla:", tabla, "los datos:", datos);
    try{
        const pool = await poolPromise;
        const atributos = await obtenerAtributos(tabla);
        const columnas = atributos.slice(1).join(', ');
        const valores = atributos.slice(1).map(attr => `@${attr}`).join(', '); // Valores parametrizados (@id, @nombre, ...)
        const datosFormateados = formatearDatos(datos);
        console.log("Datos formateados para insercion:", datosFormateados);
        const request = pool.request();
        atributos.slice(1).forEach((attr, i) => {
            console.log("Asignando valor para:", attr, "Valor:", datosFormateados[i]);
            request.input(attr, datosFormateados[i]); // Asigna cada valor al parametro correspondiente
        });
        const query = `INSERT INTO ${pool.escape(tabla)} (${columnas}) VALUES (${valores})`;
        console.log("Query de insercion:", query);
        await request.query(query);
        return { success: true, message: 'Datos insertados correctamente' };
    }catch(err){
        console.error("Error al insertar datos:", err);
        return { success: false, message: 'Error al insertar datos', error: err.message };
    }
}

// Funcion para actualizar datos

export async function actualizarDatos(tabla, id, datos) {
    const pool = await poolPromise;
    const atributos = await obtenerAtributos(tabla);
    const setClause = atributos.slice(1).map(attr => `${attr} = @${attr}`).join(', '); // Genera la clausula SET
    const datosFormateados = formatearDatos(datos);
    console.log("Datos formateados para actualizacion:", datosFormateados);
    const request = pool.request();
    atributos.slice(1).forEach((attr, i) => {
        console.log("Asignando valor para:", attr, "Valor:", datosFormateados[i]);
        request.input(attr, datosFormateados[i]); // Asigna cada valor al parametro correspondiente
    }); // Parametro para el ID
    const query = `UPDATE ${pool.escape(tabla)} SET ${setClause} WHERE ${atributos[0]} = ${pool.escape(id)}`;
    console.log("Query de actualizacion:", query);
    await request.query(query);
    return { success: true, message: 'Datos actualizados correctamente' };
}

// Funcion para eliminar datos

export async function eliminarDatos(tabla, id) {
    try{
        const pool = await poolPromise;
        const atributos = await obtenerAtributos(tabla);
        const request = pool.request();
        request.input(atributos[0], id);
        const query = `DELETE FROM ${pool.escape(tabla)} WHERE ${atributos[0]} = @${atributos[0]}`;
        await request.query(query);
        return { success: true, message: 'Datos eliminados correctamente' };
    }catch(err){
        console.error("Error al eliminar datos:", err);
        return { success: false, message: 'Error al eliminar datos', error: err.message };
    }
}