import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const dbHost = process.env.DB_HOST;
const dbUser = process.env.DB_USER;

app.get('/', (req, res) => {
  res.send('API 服务已启动');
});

app.listen(PORT, () => {
  console.log(`服务器已启动，端口：${PORT}`);
});
