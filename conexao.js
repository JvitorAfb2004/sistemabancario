const mysql = require('mysql2');

// Configuração da conexão
const dbConfig = {
  host: '',  // Host do banco de dados
  user: '',       // Usuário do banco
  password: '', // Senha do banco
  database: ''   // Nome do banco
};

// Criar a conexão
const connection = mysql.createConnection(dbConfig);

// Testar a conexão
connection.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao MySQL:', err.message);
    return;
  }
 // console.log('Conexão ao MySQL estabelecida com sucesso!');
});

// Função para adicionar um usuário
function addUser(nome, usuario, senha) {
  connection.query(
    `
    INSERT INTO usuarios (nome, usuario, senha, saldo) 
    VALUES (?, ?, ?, 0)
    `,
    [nome, usuario, senha], // Valores para os placeholders
    (err, results) => {
      if (err) {
        console.error('Erro ao executar a consulta:', err.message);
        return;
      }
      console.log("Usuario cadastrado com sucesso!");
    }
  );
}

// Exportar a conexão e a função
module.exports = {
  connection,
  addUser
};
