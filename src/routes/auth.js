// Código para manejar las rutas de /auth/

import express from "express";
import fetch from "node-fetch";
import { seleccionarId, insertarConIdDatos } from "../controllers/dbController.js";

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

const uploadPhotoToEasyFileUrl = async (photoBuffer, fileName) => {
  try {
    const formData = new FormData();
    // En Node.js, append recibe (key, value, options) donde value puede ser Buffer
    formData.append('file', photoBuffer, {
      filename: fileName,
      contentType: 'image/jpeg'
    });

    console.log("Subiendo foto a EasyFileURL...");
    
    const uploadResponse = await fetch(
      "https://api.easyfileurl.com/upload",
      {
        method: "POST",
        body: formData,
        // En Node.js, fetch con form-data necesita los headers que form-data provee
        headers: formData.getHeaders()
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Error en respuesta de EasyFileURL:", uploadResponse.status, errorText);
      return null;
    }

    const uploadData = await uploadResponse.json();
    console.log("Respuesta de EasyFileURL:", uploadData);
    
    if (uploadData && uploadData.url) {
      console.log("Foto subida exitosamente. URL:", uploadData.url);
      return uploadData.url;
    } else {
      console.error("Respuesta de EasyFileURL no contiene URL:", uploadData);
      return null;
    }
  } catch (uploadError) {
    console.error("Error al subir foto a EasyFileURL:", uploadError.message);
    return null;
  }
}

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
      console.log("Información de usuario obtenida:", userInfo.userPrincipalName);
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
    console.log("ID de usuario formateado:", formattedUserId);
    
    // 4. Verificar si el usuario ya existe en la base de datos
    let existingUser = null;
    try {
      existingUser = await seleccionarId("Usuarios", formattedUserId);
      if (existingUser) {
        console.log("Usuario encontrado en BD:", existingUser.Nombres, existingUser.Apellidos);
      }
    } catch (dbError) {
      console.warn("Error al buscar usuario en BD:", dbError.message);
    }

    // 5. Función para subir foto a EasyFileURL
    const uploadPhotoToEasyFileURL = async (photoBuffer, fileName) => {
      try {
        const formData = new FormData();
        
        // En Node.js, append necesita el buffer con opciones
        formData.append('file', photoBuffer, {
          filename: fileName,
          contentType: 'image/jpeg'
        });

        console.log("Subiendo foto a EasyFileURL...");
        
        // EasyFileURL acepta multipart/form-data
        const uploadResponse = await fetch(
          "https://api.easyfileurl.com/upload",
          {
            method: "POST",
            body: formData,
            headers: formData.getHeaders()
          }
        );

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error("Error en respuesta de EasyFileURL:", uploadResponse.status, errorText);
          return null;
        }

        const uploadData = await uploadResponse.json();
        console.log("Respuesta de EasyFileURL:", uploadData);
        
        // Verificar diferentes formatos de respuesta de EasyFileURL
        if (uploadData) {
          if (uploadData.url) {
            console.log("Foto subida exitosamente. URL:", uploadData.url);
            return uploadData.url;
          } else if (uploadData.direct_url) {
            console.log("Foto subida exitosamente. URL:", uploadData.direct_url);
            return uploadData.direct_url;
          } else if (uploadData.success && uploadData.file && uploadData.file.url) {
            console.log("Foto subida exitosamente. URL:", uploadData.file.url);
            return uploadData.file.url;
          } else {
            console.error("Respuesta de EasyFileURL no contiene URL válida:", uploadData);
            return null;
          }
        } else {
          console.error("Respuesta de EasyFileURL vacía o inválida");
          return null;
        }
      } catch (uploadError) {
        console.error("Error al subir foto a EasyFileURL:", uploadError.message);
        return null;
      }
    };

    // 6. Manejo de foto del usuario
    let userPhotoUrl = existingUser?.foto || null;
    let photoUpdated = false;

    // Solo intentar obtener y subir foto si:
    // 1. El usuario no existe en BD, o
    // 2. Existe pero no tiene foto, o
    // 3. Queremos forzar una actualización de foto (por ahora solo si no tiene)
    const shouldFetchPhoto = !existingUser || !existingUser.foto;
    
    if (shouldFetchPhoto) {
      try {
        console.log("Intentando obtener foto del perfil de Microsoft Graph...");
        const photoResponse = await fetch(
          "https://graph.microsoft.com/v1.0/me/photo/$value",
          {
            headers: { 
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "image/jpeg"
            },
            timeout: 10000 // 10 segundos timeout
          }
        );

        if (photoResponse.ok && photoResponse.status === 200) {
          const contentType = photoResponse.headers.get('content-type');
          const contentLength = photoResponse.headers.get('content-length');
          
          const photoBuffer = await photoResponse.arrayBuffer();
          console.log(`Foto obtenida de Microsoft Graph, tipo: ${contentType}, tamaño: ${contentLength || photoBuffer.byteLength} bytes`);
          
          if (photoBuffer.byteLength > 0) {
            // Convertir ArrayBuffer a Buffer para Node.js
            const buffer = Buffer.from(photoBuffer);
            
            // Subir a EasyFileURL
            const uploadedUrl = await uploadPhotoToEasyFileURL(buffer, `${formattedUserId}.jpg`);
            
            if (uploadedUrl) {
              userPhotoUrl = uploadedUrl;
              photoUpdated = true;
              console.log("Foto actualizada correctamente:", uploadedUrl);
            } else {
              console.warn("No se pudo subir la foto a EasyFileURL, manteniendo null");
            }
          } else {
            console.warn("Foto obtenida pero vacía (0 bytes)");
          }
        } else if (photoResponse.status === 404) {
          console.warn("El usuario no tiene foto de perfil en Microsoft 365 (404)");
        } else {
          console.warn(`Error al obtener foto: ${photoResponse.status} ${photoResponse.statusText}`);
        }
      } catch (photoError) {
        console.warn("Excepción al obtener/subir foto:", photoError.message);
      }
    } else {
      console.log("Usuario ya tiene foto en BD, usando existente:", existingUser.foto);
    }

    // 7. Preparar datos del usuario para BD
    const userData = {
      idUsuario: formattedUserId,
      Nombres: userInfo.givenName || "",
      Apellidos: userInfo.surname || "",
      Rol: "000", // Rol por defecto
      foto: userPhotoUrl,
      Descripcion: null,
      Clubs_idClubs: null
    };

    // 8. Lógica de inserción/actualización en BD
    try {
      if (!existingUser) {
        // Caso 1: Insertar nuevo usuario
        console.log(`Insertando nuevo usuario: ${formattedUserId}`);
        const insertResult = await insertarConIdDatos("Usuarios", userData);
        
        if (insertResult.success) {
          console.log("Usuario insertado exitosamente");
        } else {
          console.error("Error al insertar usuario:", insertResult.error);
          // Continuar para devolver datos aunque falle la inserción
        }
      } else {
        // Caso 2: Actualizar usuario existente si es necesario
        const needsUpdate = 
          (userData.Nombres && userData.Nombres !== existingUser.Nombres) ||
          (userData.Apellidos && userData.Apellidos !== existingUser.Apellidos) ||
          (photoUpdated && userPhotoUrl && userPhotoUrl !== existingUser.foto);

        if (needsUpdate) {
          console.log(`Actualizando usuario: ${formattedUserId}`);
          
          const updateData = {};
          let updatedFields = [];
          
          if (userData.Nombres && userData.Nombres !== existingUser.Nombres) {
            updateData.Nombres = userData.Nombres;
            updatedFields.push("Nombres");
          }
          
          if (userData.Apellidos && userData.Apellidos !== existingUser.Apellidos) {
            updateData.Apellidos = userData.Apellidos;
            updatedFields.push("Apellidos");
          }
          
          if (photoUpdated && userPhotoUrl) {
            updateData.foto = userPhotoUrl;
            updatedFields.push("Foto");
          }
          
          if (Object.keys(updateData).length > 0) {
            console.log(`Campos a actualizar: ${updatedFields.join(", ")}`);
            
            const updateResult = await actualizarDatos("Usuarios", formattedUserId, updateData);
            
            if (updateResult.success) {
              console.log("Usuario actualizado exitosamente");
            } else {
              console.error("Error al actualizar usuario:", updateResult.error);
            }
          }
        } else {
          console.log("Usuario está actualizado, no se requieren cambios en BD");
          // Usar datos existentes de BD para la respuesta
          userData.Nombres = existingUser.Nombres;
          userData.Apellidos = existingUser.Apellidos;
          userData.Rol = existingUser.Rol;
          userData.foto = existingUser.foto;
        }
      }
    } catch (dbOperationError) {
      console.error("Error en operación de BD:", dbOperationError.message);
      // Continuar para devolver datos aunque falle la operación de BD
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

    console.log("Enviando respuesta al frontend para usuario:", formattedUserId);
    return res.json(responseData);

  } catch (error) {
    console.error("Error crítico en /auth/getUserInfo:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      message: "Error interno del servidor al procesar información del usuario"
    });
  }
});

export default router;