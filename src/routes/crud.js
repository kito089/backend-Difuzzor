// Código para manejar las rutas de /crud/

import express from "express";
import {seleccionarTodos , seleccionarId} from '../controllers/dbController.js';

const router = express.Router();

// Ruta de prueba: /crud/
router.get("/", (req, res) => {
  console.log("Accediendo a /crud/");
  res.send("Ruta de crud funcionando");
});

// Ruta: /crud/obtener/:tabla
router.get("/obtener/:tabla", async (req, res) => {
    try {
        const datos = await seleccionarTodos(req.params.tabla);
        if (!datos) return res.status(404).send('Tabla no encontrada');
        res.json(datos);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al obtener datos');
    }
});

// Ruta: /crud/obtener/:tabla/:id
router.get('/obtener/:tabla/:id', async (req, res) => {
    try {
        const datos = await seleccionarId(req.params.tabla, req.params.id);
        if (!datos) return res.status(404).send('Datos no encontrados');
        res.json(datos);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al obtener datos');
    }
});

router.get('/insertar/:tabla', async (req, res) => {
    try {
        const datos = JSON.parse(decodeURIComponent(req.query.datos));
        console.log(datos);
        const resultado = await insertarDatos(req.params.tabla, datos);
        res.json(resultado);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al insertar datos');
    }
});

export default router;