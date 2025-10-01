// index.js (Level 3.1: 레이어 순서 버그 수정)

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("clientReady", () => {
  console.log(`${client.user.tag} 봇이 준비되었습니다! 🤖`);
});

const figmaClient = axios.create({
  baseURL: "https://api.figma.com/v1",
  headers: {
    "X-Figma-Token": process.env.FIGMA_TOKEN,
  },
});

async function getCardNewsFrames() {
  const response = await figmaClient.get(
    `/files/${process.env.FIGMA_FILE_KEY}`
  );
  const canvas = response.data.document.children[0];
  return canvas.children.filter((node) => node.name.startsWith("[카드뉴스]"));
}

async function getImageUrl(nodeId) {
  const response = await figmaClient.get(
    `/images/${process.env.FIGMA_FILE_KEY}`,
    {
      params: { ids: nodeId, format: "png", scale: 2 },
    }
  );
  return Object.values(response.data.images)[0];
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!최신") {
    try {
      const workingMsg = await message.reply(
        "📈 최신 카드뉴스를 찾고 있어요..."
      );
      const cardNewsFrames = await getCardNewsFrames();

      if (cardNewsFrames.length === 0) {
        return workingMsg.edit(
          "😢 '[카드뉴스]'로 시작하는 프레임을 찾을 수 없어요."
        );
      }

      // ⭐️⭐️⭐️ 바로 이 부분! 배열의 '마지막' 항목을 가져오도록 수정 ⭐️⭐️⭐️
      const latestFrame = cardNewsFrames[cardNewsFrames.length - 1];

      const imageUrl = await getImageUrl(latestFrame.id);
      const figmaUrl = `https://www.figma.com/file/${process.env.FIGMA_FILE_KEY}?node-id=${latestFrame.id}`;

      const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle(`✨ 최신 카드뉴스: ${latestFrame.name}`)
        .setURL(figmaUrl)
        .setImage(imageUrl)
        .setTimestamp();

      await workingMsg.edit({ content: " ", embeds: [embed] });
    } catch (error) {
      console.error(error);
      message.reply(
        "❌ 오류가 발생했어요! Figma 파일 키나 토큰을 확인해주세요."
      );
    }
  }

  if (message.content === "!모두") {
    try {
      const workingMsg = await message.reply(
        "📚 모든 카드뉴스 목록을 가져오는 중..."
      );
      const cardNewsFrames = await getCardNewsFrames();

      if (cardNewsFrames.length === 0) {
        return workingMsg.edit(
          "😢 '[카드뉴스]'로 시작하는 프레임을 찾을 수 없어요."
        );
      }

      const options = cardNewsFrames.map((frame) => ({
        label: frame.name.substring(5).trim(),
        description: `ID: ${frame.id}`,
        value: frame.id,
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("cardnews_select")
        .setPlaceholder("보고 싶은 카드뉴스를 선택하세요!")
        .addOptions(options.slice(0, 25));

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await workingMsg.edit({
        content: "📜 아래 메뉴에서 카드뉴스를 선택해주세요.",
        components: [row],
      });
    } catch (error) {
      console.error(error);
      message.reply(
        "❌ 오류가 발생했어요! Figma 파일 키나 토큰을 확인해주세요."
      );
    }
  }
});

client.on("interactionCreate", async (interaction) => {
  if (
    !interaction.isStringSelectMenu() ||
    interaction.customId !== "cardnews_select"
  )
    return;

  await interaction.deferReply();

  try {
    const selectedNodeId = interaction.values[0];
    const imageUrl = await getImageUrl(selectedNodeId);
    const frameName = interaction.component.options.find(
      (opt) => opt.value === selectedNodeId
    ).label;
    const figmaUrl = `https://www.figma.com/file/${process.env.FIGMA_FILE_KEY}?node-id=${selectedNodeId}`;

    const embed = new EmbedBuilder()
      .setColor("#0099ff")
      .setTitle(`🖼️ 선택한 카드뉴스: ${frameName}`)
      .setURL(figmaUrl)
      .setImage(imageUrl)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    await interaction.editReply("❌ 이미지를 가져오는 중 오류가 발생했어요.");
  }
});

client.login(process.env.DISCORD_TOKEN);
