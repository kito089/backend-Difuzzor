// Codigo que gestionara la conexion a la base de datos

import sql  from 'mssql'; // conectar con bases de datos SQL Server

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: true, // obligatorio para Azure
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('Conectado a la base de datos SQL');
        return pool;
    })
    .catch(err => console.log('Error al conectar a SQL', err));

module.exports = { sql, poolPromise };
