const { poolPromise } = require('../db'); // Importa la conexion a la base de datos

async function seleccionarTodos(tabla) {
    const pool = await poolPromise;
    const result = await pool.request()
    .input('tabla', tabla)
    .query('SELECT * FROM @tabla');
    return result.recordset;
}

async function seleccionarId(tabla, id) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('tabla', tabla)
        .input('id', id)
        .query('SELECT * FROM @tabla WHERE id = @id');
    return result.recordset[0] || null;
}

// obtener atributos
// insertar datos
// actualizar datos
// eliminar datos

module.exports = {
    seleccionarTodos,
    seleccionarId
};
