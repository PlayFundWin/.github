const axios = require("axios");

async function checkNotionUpdates() {
  const notionResponse = await axios.post(
    `https://api.notion.com/v1/databases/${process.env.DATABASE_ID}/query`,
    {},
    {
      headers: {
        Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
    }
  );

  const latestTask = notionResponse.data.results[0];
  if (latestTask) {
    await sendToTeams(latestTask);
  }
}

async function sendToTeams(task) {
  const message = {
    text: `🚀 **Task Updated:** ${task.properties.Name.title[0].text.content}\n📌 **Status:** ${task.properties.Status.select.name}\n🔗 [View Task in Notion](${task.url})`,
  };

  await axios.post(process.env.TEAMS_WEBHOOK_URL, message);
  console.log("Message sent to Teams successfully!");
}

checkNotionUpdates();
