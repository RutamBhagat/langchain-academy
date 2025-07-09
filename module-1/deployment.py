# %%
import asyncio
from langgraph_sdk import get_client
from langchain_core.messages import HumanMessage


# %%
# This is required to prevent top level await errors
async def main():
    # This is the URL of the local development server
    URL = "http://localhost:8000"
    client = get_client(url=URL)

    # Search all hosted graphs
    assistants = await client.assistants.search()

    assistants[-3]
    # We create a thread for tracking the state of our run
    thread = await client.threads.create()
    print(thread)
    # Input
    input = {"messages": [HumanMessage(content="Multiply 3 by 2.")]}

    # Stream
    async for chunk in client.runs.stream(
        thread["thread_id"],
        "agent",
        input=input,
        stream_mode="values",
    ):
        if chunk.data and chunk.event != "metadata":
            print(chunk.data["messages"][-1])
# %%
if __name__ == "__main__":
    asyncio.run(main())
# %%
