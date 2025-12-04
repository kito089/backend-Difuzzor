// Codigo para manejar las rutas de /crud/

import express from "express";
import {
    seleccionarTodos,
    seleccionarId,
    insertarDatos,
    actualizarDatos,
    eliminarDatos
} from '../controllers/dbController.js';

const router = express.Router();

// Ruta de prueba
router.get("/", (req, res) => {
  res.send("Ruta de crud funcionando");
});

/* ----------------------------------------------------------
   POST /crud/obtener/:tabla
   Body esperado:
   {}
----------------------------------------------------------- */
router.post("/obtener/:tabla", async (req, res) => {
    try {
        const tabla = req.params.tabla;
        const datos = await seleccionarTodos(tabla);

        res.json(datos);
    } catch (err) {
        console.error("Error en obtener todos:", err);
        res.status(500).send("Error al obtener datos");
    }
});

/* ----------------------------------------------------------
   POST /crud/obtenerId/:tabla
   Body esperado:
   { id:  }
----------------------------------------------------------- */
router.post("/obtenerId/:tabla", async (req, res) => {
    try {
        const { id } = req.body;
        const tabla = req.params.tabla;

        if (!id) return res.status(400).send("Falta el id");

        const datos = await seleccionarId(tabla, id);

        if (!datos) return res.status(404).send("Registro no encontrado");

        res.json(datos);
    } catch (err) {
        console.error("Error en obtener por id:", err);
        res.status(500).send("Error al obtener datos");
    }
});

/* ----------------------------------------------------------
   POST /crud/insertar/:tabla
   Body esperado:
   { datos: {...} }
----------------------------------------------------------- */
router.post("/insertar/:tabla", async (req, res) => {
    try {
        const tabla = req.params.tabla;
        const { datos } = req.body;

        if (!datos) return res.status(400).send("Faltan los datos");

        const resultado = await insertarDatos(tabla, datos);
        res.json(resultado);

    } catch (err) {
        console.error("Error al insertar:", err);
        res.status(500).send("Error al insertar datos");
    }
});

/* ----------------------------------------------------------
   POST /crud/actualizar/:tabla
   Body esperado:
   { id: , datos: {...} }
----------------------------------------------------------- */
router.post("/actualizar/:tabla", async (req, res) => {
    try {
        const tabla = req.params.tabla;
        const { id, datos } = req.body;

        if (!id) return res.status(400).send("Falta el id");
        if (!datos) return res.status(400).send("Faltan los datos");

        const resultado = await actualizarDatos(tabla, id, datos);
        res.json(resultado);

    } catch (err) {
        console.error("Error al actualizar:", err);
        res.status(500).send("Error al actualizar datos");
    }
});

/* ----------------------------------------------------------
   POST /crud/eliminar/:tabla
   Body esperado:
   { id: }
----------------------------------------------------------- */
router.post("/eliminar/:tabla", async (req, res) => {
    try {
        const tabla = req.params.tabla;
        const { id } = req.body;

        if (!id) return res.status(400).send("Falta el id");

        const resultado = await eliminarDatos(tabla, id);
        res.json(resultado);

    } catch (err) {
        console.error("Error al eliminar:", err);
        res.status(500).send("Error al eliminar datos");
    }
});

export default router;
