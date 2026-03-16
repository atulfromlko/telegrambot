const { Telegraf, Markup } = require("telegraf")
const { Pool } = require("pg")

// BOT TOKEN
const bot = new Telegraf("8703492157:AAFPPo6HCu_7i4Cig6b2sVCj_fGLZU87Rck")

// DATABASE
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "blueredbot",
  password: "atul",
  port: 5432,
})


// START COMMAND
bot.start(async (ctx) => {

const user = ctx.from

await pool.query(
  `INSERT INTO users (telegram_id, username, first_name, last_name)
   VALUES ($1,$2,$3,$4)
   ON CONFLICT (telegram_id) DO NOTHING`,
  [
    user.id,
    user.username || null,
    user.first_name || null,
    user.last_name || null
  ]
)

  if (ctx.chat.type !== "private") {
    return ctx.reply("This bot works in private chat only.")
  }

  const categories = await pool.query(
    "SELECT id, name FROM categories ORDER BY id"
  )

  const buttons = categories.rows.map(cat =>
    [Markup.button.callback(cat.name, `cat_${cat.id}`)]
  )

  ctx.reply(
    "🔞 18+ Questions Bot\n\nChoose a category:",
    Markup.inlineKeyboard(buttons)
  )

})


// CATEGORY SELECT
bot.action(/cat_(\d+)/, async (ctx) => {

  const categoryId = ctx.match[1]
  const userId = ctx.from.id

  const result = await pool.query(
    `SELECT * FROM questions
     WHERE category_id=$1
     AND id NOT IN (
       SELECT question_id FROM user_question_history
       WHERE telegram_id=$2
     )
     ORDER BY RANDOM()
     LIMIT 1`,
    [categoryId, userId]
  )

  if (!result.rows.length) {
    return ctx.reply("🎉 You finished this category.")
  }

  const q = result.rows[0]

  // QUESTIONS ANSWERED
  const progress = await pool.query(
    `SELECT COUNT(*) FROM user_question_history h
     JOIN questions q ON q.id = h.question_id
     WHERE h.telegram_id=$1 AND q.category_id=$2`,
    [userId, categoryId]
  )

  const answered = parseInt(progress.rows[0].count) + 1

  // TOTAL QUESTIONS IN CATEGORY
  const total = await pool.query(
    `SELECT COUNT(*) FROM questions WHERE category_id=$1`,
    [categoryId]
  )

  const totalQuestions = total.rows[0].count

  ctx.reply(
    `Question ${answered} / ${totalQuestions}\n\n${q.question}`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(`🔵 ${q.blue_option}`, `vote_${q.id}_${q.category_id}_B`),
        Markup.button.callback(`🔴 ${q.red_option}`, `vote_${q.id}_${q.category_id}_R`)
      ]
    ])
  )

})


// VOTE HANDLER
bot.action(/vote_(\d+)_(\d+)_(B|R)/, async (ctx) => {

  const questionId = ctx.match[1]
  const categoryId = ctx.match[2]
  const color = ctx.match[3]
  const userId = ctx.from.id

  try {

    await pool.query(
      `INSERT INTO votes (question_id, telegram_id, chosen_color)
       VALUES ($1,$2,$3)`,
      [questionId, userId, color]
    )

    await pool.query(
      `INSERT INTO user_question_history (telegram_id, question_id)
       VALUES ($1,$2)`,
      [userId, questionId]
    )

  } catch {
    return ctx.answerCbQuery("You already voted")
  }

  // POLL RESULTS
  const results = await pool.query(
    `SELECT chosen_color, COUNT(*) as count
     FROM votes
     WHERE question_id=$1
     GROUP BY chosen_color`,
    [questionId]
  )

  let blue = 0
  let red = 0

  results.rows.forEach(r => {
    if (r.chosen_color === "B") blue = parseInt(r.count)
    if (r.chosen_color === "R") red = parseInt(r.count)
  })

  const totalVotes = blue + red
  const bluePercent = totalVotes ? Math.round((blue / totalVotes) * 100) : 0
  const redPercent = totalVotes ? Math.round((red / totalVotes) * 100) : 0

  await ctx.editMessageText(
    `📊 Poll Results\n\n🔵 ${bluePercent}% (${blue})\n\n🔴 ${redPercent}% (${red})`
  )

  // SMALL DELAY
  await new Promise(resolve => setTimeout(resolve, 1200))

  // NEXT QUESTION
  const next = await pool.query(
    `SELECT * FROM questions
     WHERE category_id=$1
     AND id NOT IN (
       SELECT question_id FROM user_question_history
       WHERE telegram_id=$2
     )
     ORDER BY RANDOM()
     LIMIT 1`,
    [categoryId, userId]
  )

  if (!next.rows.length) {
    return ctx.reply("🎉 You finished this category.")
  }

  const q = next.rows[0]

  // QUESTIONS ANSWERED
  const progress = await pool.query(
    `SELECT COUNT(*) FROM user_question_history h
     JOIN questions q ON q.id = h.question_id
     WHERE h.telegram_id=$1 AND q.category_id=$2`,
    [userId, categoryId]
  )

  const answered = parseInt(progress.rows[0].count) + 1

  // TOTAL QUESTIONS
  const total = await pool.query(
    `SELECT COUNT(*) FROM questions WHERE category_id=$1`,
    [categoryId]
  )

  const totalQuestions = total.rows[0].count

  ctx.reply(
    `Question ${answered} / ${totalQuestions}\n\n${q.question}`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(`🔵 ${q.blue_option}`, `vote_${q.id}_${q.category_id}_B`),
        Markup.button.callback(`🔴 ${q.red_option}`, `vote_${q.id}_${q.category_id}_R`)
      ]
    ])
  )

})


// START BOT
bot.launch()

console.log("Bot is running...")