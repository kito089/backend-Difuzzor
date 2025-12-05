// Código para manejar las rutas de /auth/

import express from "express";
import fetch from "node-fetch";
import { seleccionarId, insertarConIdDatos } from "../controllers/dbController.js";
import axios from "axios";

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
    const { body: accessToken } = req.body;

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
    const userId = userInfo.userPrincipalName;
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: "No se pudo obtener el ID del usuario" 
      });
    }

    const formattedUserId = userId.replace("@utags.edu.mx", "");
    console.log("Usuario autenticado:", formattedUserId);
    // 4. Verificar si el usuario ya existe en la base de datos
    let existingUser = null;
    try {
      existingUser = await seleccionarId("Usuarios", formattedUserId);
    } catch (dbError) {
      console.warn("Error al buscar usuario en BD:", dbError.message);
    }

    // 5. Variables para manejar la foto
    let userPhotoUrl = null;
    let needsPhotoUpdate = false;

    // 6. Intentar obtener y subir la foto del perfil solo si no existe o no tiene foto
    if (!existingUser || !existingUser.foto) {
      try {
        // Obtener foto del perfil desde Microsoft Graph
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
          
          // Subir la foto a Easy File URL
          try {
            // Convertir ArrayBuffer a Buffer para FormData
            const buffer = Buffer.from(photoBuffer);
            
            // Crear FormData para enviar el archivo
            const formData = new FormData();
            const blob = new Blob([buffer], { type: 'image/jpeg' });
            formData.append('file', blob, `${formattedUserId}.jpg`);
            
            // Configurar opciones para Easy File URL
            formData.append('visibility', 'public');
            formData.append('permanent', 'false');

            const easyFileUrl = 'https://easyfileurl.com/api/v1/files'; // URL de la API de Easy File URL
            const apiKey = process.env.EASYFILEURL_API_KEY;
            
            const uploadResponse = await fetch(easyFileUrl, {
              method: "POST",
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                // No establecer 'Content-Type' cuando se usa FormData, fetch lo hace automáticamente
              },
              body: formData
            });

            if (uploadResponse.ok) {
              const uploadData = await uploadResponse.json();
              
              // La respuesta de Easy File URL generalmente contiene la URL del archivo subido
              // Ajusta según la estructura de respuesta real de la API
              userPhotoUrl = uploadData.url || uploadData.data?.url || uploadData.fileUrl;
              
              if (userPhotoUrl) {
                needsPhotoUpdate = true;
                console.log("Foto subida correctamente a Easy File URL:", userPhotoUrl);
              } else {
                console.warn("Easy File URL no devolvió una URL válida:", uploadData);
              }
            } else {
              const errorText = await uploadResponse.text();
              console.warn("No se pudo subir la foto a Easy File URL:", uploadResponse.status, errorText);
            }
          } catch (uploadError) {
            console.warn("Error al subir la foto a Easy File URL:", uploadError.message);
          }
        } else {
          console.warn("El usuario no tiene foto de perfil o no se pudo obtener");
        }
      } catch (photoError) {
        console.warn("No se pudo obtener la foto del usuario:", photoError.message);
      }
    } else {
      // Usuario ya tiene foto, usar la existente
      userPhotoUrl = existingUser.foto;
    }

    // 7. Preparar datos del usuario
    const userData = {
      idUsuario: formattedUserId,
      Nombres: userInfo.givenName || "",
      Apellidos: userInfo.surname || "",
      Rol: "000",
      foto: userPhotoUrl,
      // Campos adicionales de la tabla
      Descripcion: null,
      Clubs_idClubs: null
    };

    // 8. Lógica de inserción/actualización (igual que antes)
    let operationResult = null;

    if (!existingUser) {
      console.log(`Usuario ${formattedUserId} no encontrado, insertando nuevo registro...`);
      try {
        operationResult = await insertarConIdDatos("Usuarios", userData);
        if (operationResult.success) {
          console.log("Usuario insertado correctamente");
        } else {
          console.error("Error al insertar usuario:", operationResult.error);
        }
      } catch (insertError) {
        console.error("Error al insertar usuario:", insertError.message);
      }
    } else {
      const needsUpdate = 
        (userData.Nombres && userData.Nombres !== existingUser.Nombres) ||
        (userData.Apellidos && userData.Apellidos !== existingUser.Apellidos) ||
        (needsPhotoUpdate && userPhotoUrl && userPhotoUrl !== existingUser.foto);

      if (needsUpdate) {
        console.log(`Usuario ${formattedUserId} desactualizado, actualizando registro...`);
        
        const updateData = {};
        if (userData.Nombres && userData.Nombres !== existingUser.Nombres) {
          updateData.Nombres = userData.Nombres;
        }
        if (userData.Apellidos && userData.Apellidos !== existingUser.Apellidos) {
          updateData.Apellidos = userData.Apellidos;
        }
        if (needsPhotoUpdate && userPhotoUrl) {
          updateData.foto = userPhotoUrl;
          userData.foto = userPhotoUrl;
        } else {
          userData.foto = existingUser.foto;
        }

        if (Object.keys(updateData).length > 0) {
          try {
            operationResult = await actualizarDatos("Usuarios", formattedUserId, updateData);
            if (operationResult.success) {
              console.log("Usuario actualizado correctamente");
            } else {
              console.error("Error al actualizar usuario:", operationResult.error);
            }
          } catch (updateError) {
            console.error("Error al actualizar usuario:", updateError.message);
          }
        } else {
          console.log("No hay campos para actualizar");
          userData.foto = existingUser.foto;
        }
      } else {
        console.log("Usuario actualizado, no se requieren cambios");
        userData.Nombres = existingUser.Nombres;
        userData.Apellidos = existingUser.Apellidos;
        userData.Rol = existingUser.Rol;
        userData.foto = existingUser.foto;
      }
    }

    // 9. Preparar respuesta para el frontend
    const responseData = {
      success: true,
      user: {
        idUsuario: userData.idUsuario,
        nombres: userData.Nombres,
        apellidos: userData.Apellidos,
        rol: userData.Rol,
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