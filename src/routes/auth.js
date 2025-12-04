// Código para manejar las rutas de /auth/

import express from "express";
import fetch from "node-fetch";
import { seleccionarId, insertarConIdDatos } from "../controllers/dbController.js";
import axios from "axios";

const router = express.Router();

const scopes = ['openid', 'profile', 'email', 'offline_access', 'User.Read', 'Files.ReadWrite', 'Sites.Read.All', 'Files.Read'];

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

    const base64 = Buffer.from("https://524499105000-my.sharepoint.com/:f:/g/personal/240386_utags_edu_mx/EjpsaW7FtFxDvaLwEozRto8Bd1G285R5N-uJkv6MjWLJ-Q?e=FbT2gm", 'utf8').toString('base64');

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
// Ruta: /auth/getUserInfo
router.post("/getUserInfo", async (req, res) => {
  try {
    console.log("Accediendo a /auth/getUserInfo");
    const { accessToken } = req.body;

    // 1. Validar que se proporcionó el accessToken
    if (!accessToken) {
      return res.status(400).json({ 
        success: false, 
        message: "accessToken es requerido" 
      });
    }

    // 2. Obtener información del usuario desde Microsoft Graph
    let userInfo;
    try {
      const userResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!userResponse.ok) {
        throw new Error(`HTTP ${userResponse.status}: ${await userResponse.text()}`);
      }

      userInfo = await userResponse.json();
    } catch (graphError) {
      console.error("Error al obtener información de Microsoft Graph:", graphError);
      return res.status(401).json({ 
        success: false, 
        message: "No se pudo autenticar con Microsoft Graph" 
      });
    }

    // 3. Extraer y formatear el ID del usuario
    const userId = userInfo.id || userInfo.userPrincipalName;
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: "No se pudo obtener el ID del usuario" 
      });
    }

    const formattedUserId = userId.replace("@utags.edu.mx", "");
    
    // 4. Variables para manejar la foto
    let userPhotoUrl = null;
    let needsPhotoUpdate = false;

    // 5. Intentar obtener la foto del perfil desde Microsoft Graph
    try {
      const photoResponse = await fetch(
        "https://graph.microsoft.com/v1.0/me/photo/$value",
        {
          headers: { 
            Authorization: `Bearer ${accessToken}` 
          }
        }
      );

      if (photoResponse.ok) {
        const photoBuffer = await photoResponse.arrayBuffer();
        
        // 6. Subir la foto a OneDrive si es necesario
        // (Asumiendo que tienes configurado folderId)
        const folderId = "";
        
        if (folderId) {
          try {
            const uploadResponse = await fetch(
              `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}:/${formattedUserId}.jpg:/content`,
              {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "image/jpeg",
                  "Content-Length": photoBuffer.byteLength.toString()
                },
                body: Buffer.from(photoBuffer)
              }
            );

            if (uploadResponse.ok) {
              const uploadData = await uploadResponse.json();
              userPhotoUrl = uploadData["@microsoft.graph.downloadUrl"];
              needsPhotoUpdate = true;
            }
          } catch (uploadError) {
            console.warn("Error al subir la foto a OneDrive:", uploadError.message);
          }
        }
      }
    } catch (photoError) {
      console.warn("No se pudo obtener la foto del usuario:", photoError.message);
    }

    // 7. Verificar si el usuario ya existe en la base de datos
    let existingUser = null;
    try {
      existingUser = await seleccionarId("usuarios", formattedUserId);
    } catch (dbError) {
      console.warn("Error al buscar usuario en BD:", dbError.message);
    }

    // 8. Preparar datos para respuesta y posible inserción/actualización
    const userData = {
      idUsuario: formattedUserId,
      nombres: userInfo.givenName || "",
      apellidos: userInfo.surname || "",
      rol: "000", // Rol por defecto
      foto: userPhotoUrl || (existingUser?.foto || null),
      // Campos opcionales para actualización
      correo: userInfo.userPrincipalName || userInfo.mail || "",
      displayName: userInfo.displayName || "",
      fechaActualizacion: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };

    // 9. Lógica de inserción/actualización
    if (!existingUser) {
      // Caso 1: Usuario no existe - Insertar nuevo
      console.log("Usuario no encontrado, insertando nuevo registro...");
      try {
        await insertarConIdDatos("usuarios", {
          ...userData,
          fechaRegistro: new Date().toISOString().slice(0, 19).replace('T', ' ')
        });
        console.log("Usuario insertado correctamente");
      } catch (insertError) {
        console.error("Error al insertar usuario:", insertError.message);
        // Continuar aunque falle la inserción para devolver datos al frontend
      }
    } else {
      // Caso 2: Usuario existe - Verificar si necesita actualización
      const needsUpdate = 
        (userData.nombres && userData.nombres !== existingUser.nombres) ||
        (userData.apellidos && userData.apellidos !== existingUser.apellidos) ||
        (needsPhotoUpdate && userPhotoUrl !== existingUser.foto);

      if (needsUpdate) {
        console.log("Usuario desactualizado, actualizando registro...");
        
        const updateData = {};
        if (userData.nombres && userData.nombres !== existingUser.nombres) {
          updateData.nombres = userData.nombres;
        }
        if (userData.apellidos && userData.apellidos !== existingUser.apellidos) {
          updateData.apellidos = userData.apellidos;
        }
        if (needsPhotoUpdate && userPhotoUrl) {
          updateData.foto = userPhotoUrl;
        }
        updateData.fechaActualizacion = userData.fechaActualizacion;

        try {
          await actualizarDatos("usuarios", formattedUserId, updateData);
          
          // Actualizar userData con los nuevos valores
          userData.nombres = updateData.nombres || userData.nombres;
          userData.apellidos = updateData.apellidos || userData.apellidos;
          userData.foto = updateData.foto || userData.foto;
          
          console.log("Usuario actualizado correctamente");
        } catch (updateError) {
          console.error("Error al actualizar usuario:", updateError.message);
        }
      } else {
        console.log("Usuario actualizado, no se requieren cambios");
        // Si no necesita actualización, usar los datos existentes
        userData.foto = existingUser.foto;
      }
    }

    // 10. Preparar respuesta para el frontend
    const responseData = {
      success: true,
      user: {
        idUsuario: userData.idUsuario,
        nombres: userData.nombres,
        apellidos: userData.apellidos,
        rol: userData.rol,
        foto: userData.foto
      }
    };

    return res.json(responseData);

  } catch (error) {
    console.error("Error crítico en /auth/getUserInfo:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      message: "Error interno del servidor" 
    });
  }
});

export default router;