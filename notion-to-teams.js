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

    console.log(
      "Notion API Response:",
      JSON.stringify(notionResponse.data, null, 2)
    );

    const latestTask = notionResponse.data.results[0];
    if (latestTask) {
      await sendToTeams(latestTask);
    } else {
      console.log("No tasks found in the response");
    }
  } catch (error) {
    console.error("Error in checkNotionUpdates:", error.message);
    throw error;
  }
}

async function sendToTeams(task) {
  try {
    // Safely access nested properties with correct mapping
    const taskName =
      task.properties?.["Task name"]?.title?.[0]?.text?.content ||
      "Untitled Task";
    const taskStatus = task.properties?.Status?.status?.name || "No Status";
    const taskUrl = task.url || "";

    // Add assignee information if available
    const assignee =
      task.properties?.Assignee?.people?.[0]?.name || "Unassigned";

    const message = {
      text: `🚀 **Task Updated:** ${taskName}\n👤 **Assignee:** ${assignee}\n📌 **Status:** ${taskStatus}\n🔗 [View Task in Notion](${taskUrl})`,
    };

    await axios.post(process.env.TEAMS_WEBHOOK_URL, message);
    console.log("Message sent to Teams successfully!");
  } catch (error) {
    console.error("Error in sendToTeams:", error.message);
    console.error("Task properties:", JSON.stringify(task.properties, null, 2));
    throw error;
  }
}

checkNotionUpdates().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
