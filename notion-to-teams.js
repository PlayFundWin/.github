const axios = require("axios");

async function checkNotionUpdates() {
  try {
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

    const tasks = notionResponse.data.results;
    if (tasks && tasks.length > 0) {
      // Create a formatted message for each task
      const taskMessages = tasks.map((task) => {
        const taskName =
          task.properties["Task name"]?.title?.[0]?.text?.content ||
          "Untitled Task";
        const taskStatus = task.properties.Status?.status?.name || "No Status";
        const assignee =
          task.properties.Assignee?.people?.[0]?.name || "Unassigned";
        const taskUrl = task.url;

        return `
            ### ${taskName}
            👤 **Assignee:** ${assignee}
            📌 **Status:** ${taskStatus}
            🔗 [View in Notion](${taskUrl})
            ---`;
      });

      // Combine all task messages into one card
      const message = {
        text: `# 🚀 Notion Tasks Update\n\n${taskMessages.join("\n")}`,
      };

      await sendToTeams(message);
    } else {
      console.log("No tasks found in the response");
    }
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
