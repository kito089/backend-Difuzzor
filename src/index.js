// Codigo principal donde se manejan las rutas y la logica del servidor

import express from 'express'; // habilita el uso de rutas
import cors from 'cors'; // permitir solicitudes desde otros dominios
import authRoutes from './routes/auth.js'; // importa las rutas de autenticacion

const app = express();

app.use(cors()); // Habilitar CORS para todas las rutas
app.use(express.json()); // Parsear JSON en las solicitudes

app.use('/auth', authRoutes); // Rutas de autenticacion