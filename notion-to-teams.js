const axios = require("axios");

async function checkNotionUpdates() {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const notionResponse = await axios.post(
      `https://api.notion.com/v1/databases/${process.env.DATABASE_ID}/query`,
      {
        page_size: 100,
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

    if (tasks && tasks.length > 0) {
      // Sort tasks by last_edited_time manually since API sort is failing
      const sortedTasks = tasks.sort(
        (a, b) => new Date(b.last_edited_time) - new Date(a.last_edited_time)
      );

      const taskMessages = sortedTasks.map((task) => {
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

      const message = {
        text: `## 🚀 Recent Notion Updates (Last 10 Minutes)\n${taskMessages.join(
          "\n"
        )}`,
      };

      await sendToTeams(message);
    } else {
      console.log("No updates found in the last 10 minutes");
    }
  } catch (error) {
    console.error("Error in checkNotionUpdates:", error.message);
    if (error.response) {
      console.error("Notion API Error:", error.response.data);
    }
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

checkNotionUpdates().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
