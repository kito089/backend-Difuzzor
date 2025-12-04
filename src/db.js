// db.js
import mysql from 'mysql2/promise'; // Conector MySQL

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export const poolPromise = pool;

pool.getConnection()
    .then(() => console.log("Conectado a la base de datos MySQL"))
    .catch(err => console.log("Error al conectar a MySQL:", err));

export default pool;
