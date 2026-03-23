import TelegramBot from "node-telegram-bot-api";

const bot = new TelegramBot(process.env.BOT_TOKEN);

export default async function handler(req, res) {
  if (req.method === "POST") {
    const update = req.body;

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      if (text === "/start") {
        await bot.sendMessage(chatId, "Bot is live on Vercel 🚀");
      } else {
        await bot.sendMessage(chatId, "You said: " + text);
      }
    }

    return res.status(200).send("OK");
  }

  res.status(200).send("Bot endpoint");
}	