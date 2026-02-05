require('dotenv').config();

const path = require('path');
const express = require('express');
const mysql = require('mysql2/promise');

const PORT = Number(process.env.PORT || 3000);
const GUILD_ID = process.env.GUILD_ID;

const {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
} = process.env;

if (!GUILD_ID) {
  console.error('❌ Falta GUILD_ID no .env');
  process.exit(1);
}

if (!DB_HOST || !DB_USER || !DB_NAME) {
  console.error('❌ Falta configuração do MySQL no .env (DB_HOST/DB_USER/DB_NAME).');
  process.exit(1);
}

const pool = mysql.createPool({
  host: DB_HOST,
  port: Number(DB_PORT || 3306),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,

  // Mantém datas consistentes em UTC (igual ao seu bot)
  timezone: 'Z',

  // Evita problemas com BIGINT
  supportBigNumbers: true,
  bigNumberStrings: true,
});

const app = express();

// Se você tiver uma pasta "assets", isso permite /assets/...
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Se você tiver outros arquivos estáticos, pode descomentar:
// app.use(express.static(__dirname, { extensions: ['html'] }));

/**
 * Página principal
 * (Troque para 'index.html' quando você substituir o seu arquivo pelo atualizado)
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/**
 * Endpoint para o site puxar as estatísticas reais
 */
app.get('/api/stats', async (req, res) => {
  try {
    const guildId = String(req.query.guildId || GUILD_ID);

    const [rows] = await pool.execute(
      `
      SELECT
        guild_id,
        total_members,
        online_members,
        joins_today,
        joins_last_30_days,
        updated_at
      FROM guild_stats_latest
      WHERE guild_id = ?
      LIMIT 1
      `,
      [guildId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        error: 'Sem estatísticas ainda para esse servidor. (O bot já rodou o updateStats?)',
        guildId,
      });
    }

    const row = rows[0];

    return res.json({
      guildId: row.guild_id,
      totalMembers: Number(row.total_members),
      onlineMembers: Number(row.online_members),
      joinsToday: Number(row.joins_today),
      joinsLast30Days: Number(row.joins_last_30_days),
      updatedAt: row.updated_at, // Date -> vira ISO string no JSON
    });
  } catch (err) {
    console.error('❌ Erro no /api/stats:', err);
    return res.status(500).json({ error: 'Erro interno ao ler o banco.' });
  }
});

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('✅ MySQL conectado (site).');
  } catch (err) {
    console.error('❌ Não foi possível conectar no MySQL (site):', err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`✅ Site/API rodando em http://localhost:${PORT}`);
  });
}

start();
