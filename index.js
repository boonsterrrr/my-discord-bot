// index.js (Level 7: FigJam 파일 예외 처리)

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

async function getAllFileKeysInTeam(teamId) {
  const projectsResponse = await figmaClient.get(`/teams/${teamId}/projects`);
  const projects = projectsResponse.data.projects;
  let allFileKeys = [];

  for (const project of projects) {
    const filesResponse = await figmaClient.get(
      `/projects/${project.id}/files`
    );
    const fileKeys = filesResponse.data.files.map((file) => file.key);
    allFileKeys = allFileKeys.concat(fileKeys);
  }
  return allFileKeys;
}

async function getCardNewsFrames(fileKey) {
  const response = await figmaClient.get(`/files/${fileKey}`);
  const canvas = response.data.document.children[0];
  return {
    frames: canvas.children.filter((node) => /^\[.+\]/.test(node.name)),
    fileName: response.data.name,
  };
}

async function getImageUrl(fileKey, nodeId) {
  const response = await figmaClient.get(`/images/${fileKey}`, {
    params: { ids: nodeId, format: "png", scale: 2 },
  });
  return Object.values(response.data.images)[0];
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!최신") {
    try {
      const workingMsg = await message.reply(
        "🛰️ 팀 프로젝트를 스캔하여 최신 파일을 찾고 있어요..."
      );

      const teamId = process.env.FIGMA_TEAM_ID;
      if (!teamId) {
        return workingMsg.edit("😢 .env 파일에 FIGMA_TEAM_ID를 설정해주세요.");
      }

      const allFileKeys = await getAllFileKeysInTeam(teamId);
      if (allFileKeys.length === 0) {
        return workingMsg.edit("😢 팀에서 파일을 찾을 수 없어요.");
      }

      const filePromises = allFileKeys.map((key) =>
        figmaClient.get(`/files/${key}`)
      );

      // ⭐️⭐️⭐️ [수정] Promise.all -> Promise.allSettled 로 변경 ⭐️⭐️⭐️
      const filePromiseResults = await Promise.allSettled(filePromises);

      // ⭐️⭐️⭐️ [신규] 성공한 요청(Figma 디자인 파일)만 필터링 ⭐️⭐️⭐️
      const successfulResponses = filePromiseResults
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value); // .value에 성공한 응답 데이터가 들어있음

      if (successfulResponses.length === 0) {
        return workingMsg.edit(
          "😢 팀에 스캔할 수 있는 Figma 디자인 파일이 없어요."
        );
      }

      let latestFile = null;
      let latestDate = new Date(0);

      successfulResponses.forEach((res) => {
        // fileResponses -> successfulResponses 로 수정
        const modifiedDate = new Date(res.data.lastModified);
        if (modifiedDate > latestDate) {
          latestDate = modifiedDate;
          latestFile = res.data;
        }
      });

      const latestFileKey = latestFile.document.id;
      const { frames, fileName } = await getCardNewsFrames(latestFileKey);

      if (frames.length === 0) {
        return workingMsg.edit(
          `😢 가장 최근에 작업한 '${fileName}' 파일에 태그가 붙은 프레임이 없어요.`
        );
      }

      const latestFrame = frames[frames.length - 1];
      const imageUrl = await getImageUrl(latestFileKey, latestFrame.id);
      const figmaUrl = `https://www.figma.com/file/${latestFileKey}?node-id=${latestFrame.id}`;

      const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle(`✨ 최신 작업물: ${latestFrame.name}`)
        .setURL(figmaUrl)
        .setImage(imageUrl)
        .setFooter({ text: `출처: ${fileName}` })
        .setTimestamp();

      await workingMsg.edit({ content: " ", embeds: [embed] });
    } catch (error) {
      console.error(error);
      message.reply("❌ 오류가 발생했어요! Figma 팀 ID나 토큰을 확인해주세요.");
    }
  }

  if (message.content === "!모두") {
    message.reply(
      "이제 `!최신` 명령어로 팀 전체에서 최신 파일을 자동으로 찾아옵니다! `!모두` 명령어는 지원되지 않아요."
    );
  }
});

client.login(process.env.DISCORD_TOKEN);
