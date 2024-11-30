// index.js
const readline = require('readline');
const { connection, addUser } = require('./conexao');
const bcrypt = require('bcrypt'); // Para hashing de senhas

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let usuarios = [];
let usuarioLogin = null;

// Função para obter usuários do banco de dados
function getUsers() {
  connection.query('SELECT * FROM usuarios', (err, results) => {
    if (err) {
      console.error('Erro ao executar a consulta:', err.message);
      return;
    }
    usuarios = results;
  });
}

// Atualizar a lista de usuários a cada 5 segundos
setInterval(getUsers, 5000);

// Função para fazer perguntas no terminal
function question(query) {
  return new Promise((resolve) => {
    rl.question(query, (resposta) => {
      resolve(resposta);
    });
  });
}

// Iniciar o aplicativo
start();

// Função principal de início
async function start() {
  console.clear();
  console.log("## Olá, Seja Bem-vindo! ##");
  console.log("Escolha uma opção abaixo:");
  console.log("1. Criar Conta | 2. Fazer Login | 3. Sair");

  const opcao = await question("> ");

  switch (opcao) {
    case "1":
      console.clear();
      await criarConta();
      break;
    case "2":
      console.clear();
      await login();
      break;
    case "3":
      console.log("Até logo!");
      rl.close();
      process.exit(0);
      break;
    default:
      console.log("Opção inválida. Tente novamente.");
      await start();
  }
}

// Função para criar uma nova conta
async function criarConta() {
  console.log("\n--- Criar Conta ---");

  const usuario = await question("Escolha um nome de usuário: ");
  if (usuarios.some(u => u.usuario === usuario)) {
    console.log("Este nome de usuário já está em uso. Tente outro.");
    return await criarConta();
  }

  const nome = await question("Digite seu nome completo: ");
  const senha = await question("Escolha uma senha: ");

  if (usuario && nome && senha) {
    // Hash da senha antes de armazenar
    const hashedSenha = await bcrypt.hash(senha, 10);
    addUser(nome, usuario, hashedSenha);
    console.log("Conta criada com sucesso!");
  } else {
    console.log("Erro: todos os campos são obrigatórios.");
    return await criarConta();
  }

  await start();
}

// Função para realizar o login
async function login() {
  console.log("\n--- Login ---");

  const usuario = await question("Digite seu usuário: ");
  const senha = await question("Digite sua senha: ");

  connection.query(
    `
    SELECT * FROM usuarios WHERE usuario = ?
    `,
    [usuario],
    async (err, results) => {
      if (err) {
        console.error("Erro ao executar a consulta:", err.message);
        return;
      }

      if (results.length > 0) {
        const user = results[0];
        const senhaValida = await bcrypt.compare(senha, user.senha);
        if (senhaValida) {
          usuarioLogin = user;
          console.clear();
          console.log("Verificando credenciais...");
          setTimeout(() => {
            console.clear();
            menu();
          }, 1000);
        } else {
          console.log("Senha inválida.");
          setTimeout(() => {
            console.clear();
            start();
          }, 2000);
        }
      } else {
        console.log("Usuário não encontrado.");
        setTimeout(() => {
          console.clear();
          start();
        }, 2000);
      }
    }
  );
}

// Função de menu para usuário logado
async function menu() {
  console.log(`# MENU | Saldo: R$${usuarioLogin.saldo} | Usuário: ${usuarioLogin.usuario} | Nome: ${usuarioLogin.nome}`);

  console.log("\n1. Saldo\n2. Pix\n3. Sair da conta");
  const opcao = await question("> ");

  switch (opcao) {
    case "1":
      console.log(`Seu saldo é R$${usuarioLogin.saldo}`);
      setTimeout(() => {
        console.clear();
        menu();
      }, 1000);
      break;

    case "2":
      console.clear();
      console.log("PIX | Saldo: R$" + usuarioLogin.saldo);
      const destinatario = await question("Qual o usuário do destinatário? ");
      const valorStr = await question("Qual o valor? ");
      const valor = parseFloat(valorStr);

      if (isNaN(valor) || valor <= 0) {
        console.log("Valor inválido.");
        setTimeout(() => {
          console.clear();
          menu();
        }, 2000);
        break;
      }

      await pix(usuarioLogin.usuario, destinatario, valor);
      break;

    case "3":
      console.log("Saindo da conta...");
      usuarioLogin = null;
      setTimeout(() => {
        console.clear();
        start();
      }, 1000);
      break;

    default:
      console.log("Opção inválida.");
      setTimeout(() => {
        console.clear();
        menu();
      }, 2000);
      break;
  }
}

// Função para realizar transferência PIX
async function pix(remetente, destinatario, valor) {
  try {
    // Inicia uma transação
    await new Promise((resolve, reject) => {
      connection.beginTransaction(err => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Verifica saldo do remetente
    const [remetenteData] = await new Promise((resolve, reject) => {
      connection.query(
        `SELECT saldo FROM usuarios WHERE usuario = ?`,
        [remetente],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    if (!remetenteData) {
      throw new Error("Usuário remetente não encontrado.");
    }

    if (remetenteData.saldo < valor) {
      throw new Error("Saldo insuficiente.");
    }

    // Deduz saldo do remetente
    await new Promise((resolve, reject) => {
      connection.query(
        `UPDATE usuarios SET saldo = saldo - ? WHERE usuario = ?`,
        [valor, remetente],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    // Verifica se o destinatário existe
    const [destinatarioData] = await new Promise((resolve, reject) => {
      connection.query(
        `SELECT saldo FROM usuarios WHERE usuario = ?`,
        [destinatario],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    if (!destinatarioData) {
      throw new Error("Usuário destinatário não encontrado.");
    }

    // Adiciona saldo ao destinatário
    await new Promise((resolve, reject) => {
      connection.query(
        `UPDATE usuarios SET saldo = saldo + ? WHERE usuario = ?`,
        [valor, destinatario],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    // Atualiza o saldo no objeto de login
    usuarioLogin.saldo -= valor;

    // Confirma a transação
    await new Promise((resolve, reject) => {
      connection.commit(err => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log("PIX realizado com sucesso!");

    // Atualiza o saldo do destinatário no array de usuários
    usuarios = usuarios.map(u => {
      if (u.usuario === destinatario) {
        u.saldo += valor;
      }
      return u;
    });

    setTimeout(() => {
      console.clear();
      menu();
    }, 2000);

  } catch (error) {
    // Desfaz a transação em caso de erro
    await new Promise((resolve, reject) => {
      connection.rollback(() => {
        resolve();
      });
    });
    console.error("Erro ao realizar o PIX:", error.message);
    setTimeout(() => {
      console.clear();
      menu();
    }, 2000);
  }
}
