// Importa bibliotecas
const express = require("express");
const fs = require("fs");
const path = require("path");
// Se for gerar vídeo de verdade, use fluent-ffmpeg
// const ffmpeg = require("fluent-ffmpeg");

const app = express();
app.use(express.json());

// Função que simula a geração de vídeo
async function gerarVideo(titulo) {
  return new Promise((resolve, reject) => {
    // Aqui você colocaria o código real com FFMPEG
    const nomeArquivo = `${titulo.replace(/\s/g, "_")}.mp4`;
    const caminho = path.join(__dirname, nomeArquivo);

    // Simulando criação de vídeo
    fs.writeFile(caminho, "Este é um vídeo de teste", (err) => {
      if (err) return reject(err);
      console.log(`Vídeo criado: ${caminho}`);
      resolve(caminho);
    });
  });
}

// Rota para gerar vídeo
app.post("/gerar-video", async (req, res) => {
  const { titulo } = req.body;

  if (!titulo) {
    return res.status(400).send("Você precisa enviar um título!");
  }

  try {
    // Dispara a geração do vídeo de forma assíncrona
    const arquivo = await gerarVideo(titulo);

    // Aqui você chamaria a função de upload pro YouTube usando a API
    // uploadParaYouTube(arquivo);

    res.send(`Vídeo "${titulo}" gerando!`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao gerar vídeo.");
  }
});

// Porta que o Render define
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
