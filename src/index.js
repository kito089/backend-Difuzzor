// Codigo principal donde se manejan las rutas y la logica del servidor

import express from 'express'; // habilita el uso de rutas
import cors from 'cors'; // permitir solicitudes desde otros dominios
import authRoutes from './routes/auth.js'; // importa las rutas de autenticacion
import crudRoutes from './routes/crud.js'; // importa las rutas de crud

console.log("Iniciando el servidor...");
const app = express();

console.log("Configurando middlewares...");
app.use(cors()); // Habilitar CORS para todas las rutas
app.use(express.json()); // Parsear JSON en las solicitudes

console.log("Configurando rutas...");
app.get("/", (req, res) => {
  res.send("Servidor funcionando correctamente");
});
app.use('/auth', authRoutes); // Rutas de autenticacion
app.use('/crud', crudRoutes); // Rutas de crud

console.log(`Iniciando el servidor en el puerto especificado... ${process.env.PORT || 3000}`);
const PORT = process.env.PORT || 3000; // Puerto del servidor
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`)); // Inicia el servidor