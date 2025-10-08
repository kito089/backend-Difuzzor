// Codigo para manejar las rutas de /auth/

import express from 'express'; // habilita el uso de rutas
import jwt from 'jsonwebtoken'; // permite generar tokens JWT
import jwksClient from "jwks-rsa"; // permite obtener las claves publicas para validar tokens de Azure
import fetch from 'node-fetch'; // permite hacer solicitudes HTTP

const router = express.Router(); // crea un router para manejar las rutas /auth/

const client = jwksClient({
    jwksUri: 'https://login.microsoftonline.com/${process.env.AZURE_TENNANT_ID}/discovery/v2.0/keys' // URL para obtener las claves publicas de Azure
});

function getKey(header, callback) { // obtener la clave publica para validar el token
    client.getSigningKey(header.kid, (err, key) =>{
        if (err) return callback(err);
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
    });
}

router.post('/login', async (req, res) => { // ruta /auth/login esperando un POST
    const {token} = req.body; // recibe el token enviado desde el frontend

    if (!token) { // token no enviado
            return res.status(401).json({message: 'Token is required'}); // 401: Unathorized
    }

    jwt.verify(
        token,
        getKey,
        {
            algorithms: ['RS256'], // algoritmo usado por Azure
            audience: process.env.AZURE_CLIENT_ID, // ID de Difuzzor en Azure
            issuer: `https://login.microsoftonline.com/${process.env.AZURE_TENNANT_ID}/v2.0` // emisor del token
        }, (err, decoded) => { // callback despues de verificar el token
            if (err) { // token invalido
                console.error('Token verification error:', err);
                return res.status(401).json({message: 'Invalid token', error: err.message}); // 401: Unathorized
            }

            const user = {
                id: decoded.oid, // ID unico del usuario en Azure
                email: decoded.preferred_username, // correo del usuario
                name: decoded.name, // nombre del usuario
                roles: decoded.roles || [], // roles del usuario
                upn: decoded.upn // User Principal Name
            }

            const appToken = jwt.sign( // genera un nuevo token para la app
                {
                    uid: user.id, // ID unico del usuario en Azure
                    email: user.email // correo del usuario
                },
                process.env.APP_SECRET, // clave secreta para firmar el token
                {expiresIn: '1h'} // expira en 1 hora
            );

            return res.json({token: appToken, user}); // devuelve el nuevo token
        }
    );
});

export default router; // exporta el router para usarlo en index.js