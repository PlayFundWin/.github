const axios = require("axios");

async function checkNotionUpdates() {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const notionResponse = await axios.post(
      `https://api.notion.com/v1/databases/${process.env.DATABASE_ID}/query`,
      {
        sorts: [
          {
            property: "last_edited_time",
            direction: "descending",
          },
        ],
        filter: {
          timestamp: "last_edited_time",
          last_edited_time: {
            after: tenMinutesAgo,
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
      }
    );

    const tasks = notionResponse.data.results;
    let message;

    if (tasks && tasks.length > 0) {
      const taskMessages = tasks.map((task) => {
        const taskName =
          task.properties["Task name"]?.title?.[0]?.text?.content ||
          "Untitled Task";
        const taskStatus = task.properties.Status?.status?.name || "No Status";
        const assignee =
          task.properties.Assignee?.people?.[0]?.name || "Unassigned";
        const taskUrl = task.url;
        const lastEdited = new Date(task.last_edited_time).toLocaleTimeString();

        return `### ${taskName}\n👤 ${assignee} | 📌 ${taskStatus} | ⏰ ${lastEdited}\n🔗 [View in Notion](${taskUrl})\n---`;
      });

      message = {
        text: `## 🚀 Recent Notion Updates (Last 10 Minutes)\n${taskMessages.join(
          "\n"
        )}`,
      };
    } else {
      message = {
        text: "## 🔍 Notion Update Check\nNo updates found in the last 10 minutes",
      };
    }

    await sendToTeams(message);
  } catch (error) {
    console.error("Error in checkNotionUpdates:", error.message);
    throw error;
  }
}

async function sendToTeams(message) {
  try {
    await axios.post(process.env.TEAMS_WEBHOOK_URL, message);
    console.log("Message sent to Teams successfully!");
  } catch (error) {
    console.error("Error in sendToTeams:", error.message);
    throw error;
  }
}

// ...existing code...

checkNotionUpdates().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
