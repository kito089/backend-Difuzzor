// Código para manejar las rutas de /auth/

import express from "express";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import fetch from "node-fetch";

const router = express.Router();

// Cliente para obtener las claves públicas de Azure
const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/discovery/v2.0/keys`,
});

const scopes = ['openid', 'profile', 'email', 'offline_access', 'User.Read'];

// Función para obtener la clave pública
function getKey(header, callback) {
  console.log("Obteniendo clave pública de Azure...");
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

// Ruta: /auth/TokenForJWT
router.post("/TokenForJWT", async (req, res) => {
  console.log("Accediendo a /auth/TokenForJWT");
  const { token } = req.body;

  if (!token) {
    return res.status(401).json({ message: "Token is required" });
  }

  jwt.verify(
    token,
    getKey,
    {
      algorithms: ["RS256"],
      audience: process.env.AZURE_CLIENT_ID,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0`,
    },
    (err, decoded) => {
      if (err) {
        console.error("Error verificando el token:", err);
        return res
          .status(401)
          .json({ message: "Invalid token", error: err.message });
      }

      const user = {
        id: decoded.oid,
        email: decoded.preferred_username,
        name: decoded.name,
        roles: decoded.roles || [],
        upn: decoded.upn,
      };

      const appToken = jwt.sign(
        {
          uid: user.id,
          email: user.email,
        },
        process.env.APP_SECRET,
        { expiresIn: "1h" }
      );

      console.log("Token JWT generado correctamente para usuario:", user.email);
      return res.json({ token: appToken, user });
    }
  );
});

// Ruta: /auth/CodeForToken
router.post("/CodeForToken", async (req, res) => {
  try {
    console.log("Accediendo a /auth/CodeForToken");

    const { authCode } = req.body;
    if (!authCode) {
      return res.status(400).json({ success: false, message: "authCode is required" });
    }

    const tokenUrl = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;

    const requestBody = new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID,
      code: authCode,
      redirect_uri: "difuzzor://auth",
      grant_type: "authorization_code",
      scope: scopes.join(" "),
      client_secret: process.env.AZURE_CLIENT_SECRET, //asegúrate de configurarlo en Azure
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

// Ruta: /auth/validateToken
router.post("/validateToken", async (req, res) => {
  try {
    console.log("Accediendo a /auth/validateToken");
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ success: false, message: "accessToken is required" });
    }

    const response = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ success: false, message: "accessToken is required" });
    }

    const response = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const userInfo = await response.json();
    return res.json({ success: true, user: userInfo });
  } catch (error) {
    console.error("Error obteniendo información del usuario:", error);
    return res.json({ success: false, error: error.message });
  }
});

export default router;