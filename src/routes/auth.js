// Código para manejar las rutas de /auth/

import express from "express";
import fetch from "node-fetch";
import { seleccionarId, insertarConIdDatos } from "../controllers/dbController.js";
const axios = require("axios");

const router = express.Router();

const scopes = ['openid', 'profile', 'email', 'offline_access', 'User.Read'];

// Ruta de prueba: /auth/
router.get("/", (req, res) => {
  console.log("Accediendo a /auth/");
  res.send("Ruta de autenticación funcionando");
});

// Ruta: /auth/CodeForToken
router.post("/CodeForToken", async (req, res) => {
  try {
    console.log("Accediendo a /auth/CodeForToken");

    const { body } = req.body;
    if (!body) {
      return res.status(400).json({ success: false, message: "authCode is required" });
    }

    const tokenUrl = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;

    const requestBody = new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID,
      code: body,
      redirect_uri: "difuzzor://auth",
      grant_type: "authorization_code",
      scope: scopes.join(" "),
    });

    console.log("Solicitando token a Azure AD...");

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: requestBody.toString(),
    });

    const responseText = await response.text();
    console.log("Respuesta Azure:", responseText);

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${responseText}`);
    }

    const tokenData = JSON.parse(responseText);
    console.log("Token recibido exitosamente desde Azure");

    const base64 = Buffer.from("https://524499105000-my.sharepoint.com/:f:/g/personal/240386_utags_edu_mx/EjpsaW7FtFxDvaLwEozRto8Bd1G285R5N-uJkv6MjWLJ-Q?e=kOdHtB", 'utf8').toString('base64');

    const shareId = "u!" + base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    console.log("Share ID generado:", shareId);
    const url = `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem`;

    const folder = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    console.log("Carpeta obtenida:", folder.data);

    return res.json({
      success: true,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      id_token: tokenData.id_token,
      expires_in: tokenData.expires_in,
    });
  } catch (error) {
    console.error("Error intercambiando código:", error);
    return res.json({ success: false, error: error.message });
  }
});

// Ruta: /auth/RefreshToken
router.post("/RefreshToken", async (req, res) => {
  try {
    console.log("Accediendo a /auth/RefreshToken");
    const { body } = req.body;

    if (!body) {
      return res.status(400).json({ success: false, message: "refreshToken is required" });
    }

    const tokenUrl = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;

    const requestBody = new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID,
      refresh_token: body,
      grant_type: "refresh_token",
      scope: scopes.join(" "),
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: requestBody.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const tokenData = await response.json();
    console.log("Token refrescado exitosamente desde Azure");
    return res.json({
      success: true,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      id_token: tokenData.id_token,
      expires_in: tokenData.expires_in,
    });

  } catch (error) {
    console.error("Error refrescando token:", error);
    return res.json({ success: false, error: error.message });
  }
}); 

// Ruta: /auth/validateToken
router.post("/validateToken", async (req, res) => {
  try {
    console.log("Accediendo a /auth/validateToken");
    const { body } = req.body;

    if (!body) {
      return res.status(400).json({ success: false, message: "accessToken is required" });
    }

    const response = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${body}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Validación del token, estado:", response.status);
    return res.json({ success: response.ok });
  } catch (error) {
    console.error("Error validando token:", error);
    return res.json({ success: false, error: error.message });
  }
});

// Ruta: /auth/getUserInfo
router.post("/getUserInfo", async (req, res) => {
  try {
    console.log("Accediendo a /auth/getUserInfo");
    const { body } = req.body;

    if (!body) {
      return res.status(400).json({ success: false, message: "accessToken is required" });
    }

    // 1. Obtener información del usuario
    const response = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${body}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const userInfo = await response.json();

    // 2. Obtener foto de perfil
    let photoBase64 = null;
    try {
      const photo = await axios.get(
        "https://graph.microsoft.com/v1.0/me/photo/$value",
        {
          responseType: "arraybuffer",
          headers: { Authorization: `Bearer ${body}` },
        }
      );

      photoBase64 = Buffer.from(photo.data, "binary").toString("base64");
      userInfo.photo = `data:image/jpeg;base64,${photoBase64}`;

    } catch (photoError) {
      console.warn("No se pudo obtener la foto del usuario (puede no existir).");
      userInfo.photo = null; // mejor que undefined
    }

    userData = seleccionarId("usuarios", userInfo.id.replace("@utags.edu.mx", ""));
    if (!userData) {
      // guardar foto en drive

      console.log("Usuario no encontrado en la base de datos, insertando nuevo usuario...");
      await insertarConIdDatos("usuarios", {
        idUsuario: userInfo.id.replace("@utags.edu.mx", ""),
        nombres: userInfo.givenName,
        apellidos: userInfo.surname,
        rol: "000"
      });
    }

    return res.json({ success: true, user: userInfo });

  } catch (error) {
    console.error("Error obteniendo información del usuario:", error);
    return res.json({ success: false, error: error.message });
  }
});

export default router;