const express = require('express');
const { google } = require('googleapis');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Google Sheets API setup
const spreadsheetId = '1aLCmp5zMTYim2eWfuZgEJGmHLwWFaRVUSfgvMEdV-qg';
const range = 'Dataset!A2:J';

const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Cek apakah ada sesi yang disimpan
const sessionFilePath = './session.json';
let sessionData;
if (fs.existsSync(sessionFilePath)) {
  sessionData = JSON.parse(fs.readFileSync(sessionFilePath, 'utf-8'));
  console.log('Session loaded from file');
} else {
  console.log('No session file found, starting new session');
}

// Inisialisasi WhatsApp Web Client
const client = new Client({
  authStrategy: new LocalAuth({ clientId: "client" }),  // Menggunakan LocalAuth jika sesi ada
});

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('WhatsApp Web client is ready!');
  
  // Simpan sesi ke file setelah berhasil login
  const authInfo = client.base64EncodedAuthInfo();
  fs.writeFileSync(sessionFilePath, JSON.stringify(authInfo));
  console.log('Session saved to session.json');
});

// Google Sheets API untuk ambil data
async function getSheetData() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return response.data.values;
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    return [];
  }
}

// Routes untuk form HTML dan pengambilan data dari Google Sheets
app.get('/', async (req, res) => {
  const data = await getSheetData();
  const idLaporList = data.map(row => row[1]);
  res.render('index', { idLaporList });
});

app.get('/getDataByIdLapor', async (req, res) => {
  const { idLapor } = req.query;
  const data = await getSheetData();
  const result = data.find(row => row[1] === idLapor);
  if (result) {
    res.json({
      nama_perusahaan: result[2],
      nomor_ponsel: result[3],
      tanggal: result[4],
      hari: result[5],
      pukul: result[6],
      materi: result[7],
      persiapan_training: result[8],
      detail_isi_pesan: result[9],
    });
  } else {
    res.status(404).json({ message: 'Data not found' });
  }
});

// Route untuk mengirim pesan WhatsApp
app.post('/sendWhatsApp', async (req, res) => {
  const { nomor_ponsel, pesan } = req.body;
  try {
    const formattedNumber = `${nomor_ponsel}@c.us`;
    await client.sendMessage(formattedNumber, pesan);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

client.initialize();

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
