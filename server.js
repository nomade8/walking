const express = require('express');
const app = express();
const port = 3010;

app.use(express.static('./'));

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    console.log('Para acessar o jogo, abra o navegador e digite: http://localhost:3010');
});