// Importa la conexion a la base de datos
import e from 'express';
import sql, { poolPromise } from '../db.js';

// Funcion para obtener atributos de una tabla
export async function obtenerAtributos(tabla) {
    const pool = await poolPromise;
    const result = await pool.request()
    .query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${tabla}'`);
    return result.recordset.map(row => row.COLUMN_NAME);
}

// Funcion para seleccionar todos los registros de una tabla
export async function seleccionarTodos(tabla) {
    const pool = await poolPromise;
    const result = await pool.request().query(`SELECT * FROM ${tabla}`);
    return result.recordset;
}

// Funcion para seleccionar un registro por ID
export async function seleccionarId(tabla, id) {
    const pool = await poolPromise;
    const atributos = await obtenerAtributos(tabla);
    const result = await pool.request()
        .input('id', id)
        .query(`SELECT * FROM ${tabla} WHERE ${atributos[0]} = @id`);
    return result.recordset[0] || null;
}

// Funcion para insertar datos

export async function insertarDatos(tabla, datos) {
    console.log("Insertando en tabla:", tabla, "los datos:", datos);
    try{
        const pool = await poolPromise;
        const atributos = await obtenerAtributos(tabla);
        console.log("Atributos de la tabla:", atributos);
        const columnas = atributos.slice(1).join(', ');
        console.log("Columnas para insertar:", columnas);
        const valores = atributos.slice(1).map(attr => `@${attr}`).join(', '); // Valores parametrizados (@id, @nombre, ...)
        console.log("Valores para insertar:", valores);
        const request = pool.request();
        atributos.slice(1).forEach(attr => {
            console.log("Asignando valor para:", attr, "Valor:", datos[attr]);
            request.input(attr, datos[attr]); // Asigna cada valor al parametro correspondiente
        });
        const query = `INSERT INTO ${tabla} (${columnas}) VALUES (${valores})`;
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
    const setClause = atributos.map(attr => `${attr} = @${attr}`).join(', '); // Genera la clausula SET
    const request = pool.request();
    atributos.forEach(attr => {
        console.log("Asignando valor para:", attr, "Valor:", datos[attr]);
        request.input(attr, datos[attr]); // Asigna cada valor al parametro correspondiente
    });
    request.input(atributos[0], id); // Parametro para el ID
    const query = `UPDATE ${tabla} SET ${setClause} WHERE ${atributos[0]} = @${atributos[0]}`;
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
        const query = `DELETE FROM ${tabla} WHERE ${atributos[0]} = @${atributos[0]}`;
        await request.query(query);
        return { success: true, message: 'Datos eliminados correctamente' };
    }catch(err){
        console.error("Error al eliminar datos:", err);
        return { success: false, message: 'Error al eliminar datos', error: err.message };
    }
}