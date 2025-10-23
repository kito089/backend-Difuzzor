// Código para manejar las rutas de /crud/

import express from "express";
import dbController from '../controllers/dbController.js';

const router = express.Router();


// Ruta de prueba: /crud/
router.get("/", (req, res) => {
  console.log("Accediendo a /crud/");
  res.send("Ruta de crud funcionando");
});

// Ruta: /crud/obtener/:tabla
router.get("/obtener/:tabla", async (req, res) => {
    try {
        const datos = await dbController.seleccionarTodos(req.params.tabla);
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
        const datos = await productosController.obtenerPorId(req,params.tabla, req.params.id);
        if (!datos) return res.status(404).send('Datos no encontrados');
        res.json(datos);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al obtener datos');
    }
});

export default router;