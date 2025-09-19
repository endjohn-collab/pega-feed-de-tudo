const http = require("http");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Olá! Seu app Node.js está rodando no Render 🚀");
});

const PORT = process.env.PORT || 3000; // Render define a porta automaticamente
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
