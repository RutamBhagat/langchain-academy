# %%
import os
import json
from pprint import pprint
from typing import Annotated
from dotenv import load_dotenv
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages
from langchain.schema import AIMessage, HumanMessage

# %%

load_dotenv()
# Import all environment variables into the current namespace
for key, value in os.environ.items():
    globals()[key] = value


# %%
# Note: Docstring is required for the function to be recognized as a tool
def multiply(a: int, b: int) -> int:
    """Multiply a and b.

    Args:
        a: first int
        b: second int
    """
    return a * b


llm = ChatOpenAI(model=os.getenv("OPENAI_MODEL"))
llm_with_tools = llm.bind_tools([multiply])


# %%
class MessagesState(BaseModel):
    messages: Annotated[list[AnyMessage], add_messages] = Field(
        [], description="List of messages"
    )


def tool_calling_llm(state: MessagesState):
    state.messages = llm_with_tools.invoke(state.messages)
    return state


# %%
# Build graph
builder = StateGraph(MessagesState)

# Add nodes
builder.add_node("tool_calling_llm", tool_calling_llm)
builder.add_node("tools", ToolNode([multiply]))

# Add edges
builder.add_edge(START, "tool_calling_llm")
builder.add_conditional_edges(
    "tool_calling_llm",
    # If the latest message (result) from assistant is a tool call -> tools_condition routes to tools
    # If the latest message (result) from assistant is a not a tool call -> tools_condition routes to END
    tools_condition,
)
builder.add_edge("tools", END)
graph = builder.compile()

# %%
# Get the graph in PNG format
graph_png = graph.get_graph().draw_mermaid_png()

# Save the PNG to a file in the current directory
with open("graph.png", "wb") as f:
    f.write(graph_png)

# %%
messages = [HumanMessage(content="What is 2 times 3?")]
messages = graph.invoke({"messages": messages})
# %%
for message in messages.get("messages", []):
    message.pretty_print()

# %%
