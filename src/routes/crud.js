// Código para manejar las rutas de /crud/

import express from "express";
import {seleccionarTodos , seleccionarId, insertarDatos, actualizarDatos, eliminarDatos, obtenerAtributos} from '../controllers/dbController.js';

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
        res.json({success: true, datos: datos});
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
        res.json({success: true, datos: datos});
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al obtener datos');
    }
});

router.get('/insertar/:tabla', async (req, res) => {
    try {
        console.log("Insertando en tabla:", req.params.tabla);
        const datos = req.query.datos;
        //const datos = JSON.parse(datosStr);
        console.log("Datos recibidos: ", datos);
        const resultado = await insertarDatos(req.params.tabla, datos);
        res.json(resultado);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al insertar datos');
    }
});

router.get('/actualizar/:tabla/:id', async (req, res) => {
    try {
        console.log("Actualizando en tabla:", req.params.tabla, "ID:", req.params.id);
        const datos = req.query.datos;
        //const datos = JSON.parse(datosStr);
        console.log("Datos recibidos: ", datos);
        const resultado = await actualizarDatos(req.params.tabla, req.params.id, datos);
        res.json(resultado);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al actualizar datos');
    }
});

router.get('/eliminar/:tabla/:id', async (req, res) => {
    try {
        console.log("Eliminando de tabla:", req.params.tabla, "ID:", req.params.id);
        const resultado = await eliminarDatos(req.params.tabla, req.params.id);
        res.json(resultado);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al eliminar datos');
    }
});

router.get('/atributos/:tabla', async (req, res) => {
    try {
        console.log("Agregando a tabla:", req.params.tabla);
        const atributos = await obtenerAtributos(req.params.tabla);
        console.log("Atributos recibidos: ", atributos);
        res.json({success: true, atributos: atributos});
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al enviar atributo');
    }
});

export default router;